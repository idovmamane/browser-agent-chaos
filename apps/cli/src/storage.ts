/**
 * Persistent, encrypted store for Browser Agent Chaos.
 *
 * Why: sessions used to live in-memory only — `kill -9` and they were gone.
 * We want them to survive restarts so the dashboard keeps a history of every
 * agent that has ever run against this machine.
 *
 * Why encrypted: the agent under test runs as the same OS user as the server,
 * so it can read any file the server can read. A plain JSON dump under the
 * user's home would let an agent grep its own session events from disk and
 * cheat the benchmark. Encrypting the dump means the agent has to read the
 * server's source code AND derive the key AND parse the binary format — at
 * which point it's no longer "obviously trivial cheating" and we've raised
 * the bar enough that the threat model is whatever the agent's source-reading
 * capability is, not whatever its filesystem-reading capability is.
 *
 * Crypto: AES-256-GCM. Key is derived (scrypt) from a machine-bound
 * passphrase = `${username}:${hostname}:${APP_SALT}`. Same machine + same
 * user → same key, no user prompt, but a different machine can't decrypt a
 * dump it stole. The salt is constant in source; security boundary is the
 * agent not reading server source.
 *
 * File layout: [magic "BAC1" 4B][nonce 12B][tag 16B][ciphertext …]
 * Path: cross-platform "state" directory under the user's home.
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  unlinkSync,
} from 'node:fs';
import { homedir, hostname, userInfo } from 'node:os';
import path from 'node:path';
import type { EventRecord, Session } from '@browser-agent-chaos/core';

// Magic bytes so we can sniff format-version bumps later.
const MAGIC = Buffer.from('BAC1', 'utf8');
const NONCE_LEN = 12;
const TAG_LEN = 16;
// Constant in source — the security boundary is the agent not reading source,
// not the salt being secret. (See module docstring.)
const APP_SALT = Buffer.from('bac.state.v1.salt.do.not.move');

export interface PersistedMount {
  sessionId: string;
  challengeId: string;
  mountedAt: number;
  mountNonce: string;
  attempt: 'open' | 'sealed';
  /** tokens map (token → ChallengeAction & { realId }) skipped on purpose: those
   *  are reissued on each /mount and shouldn't outlive a process restart. */
  mountCount: number;
  interactedSinceMount: boolean;
}

/** Opaque task-URL token entry. Kept in sync with the runtime TaskToken type
 *  in server.ts — duplicating the shape here so storage.ts doesn't have to
 *  import from server.ts (which would create a cycle through challenges). */
export interface PersistedTaskToken {
  sessionId: string;
  challengeId: string;
  audience: 'agent' | 'preview';
  createdAt: number;
}

export interface PersistedState {
  /** Bumps when we change the shape; reader can refuse incompatible files. */
  version: 1;
  sessions: Session[];
  events: Array<[string, EventRecord[]]>; // [sessionId, events]
  mounts: Array<[string, PersistedMount]>; // [mountKey, mount]
  /** Optional — only present in dumps written after the token refactor. */
  taskTokens?: Array<[string, PersistedTaskToken]>;
  tokenBySessionChallenge?: Array<[string, string]>;
}

function stateDir(): string {
  // Try the platform-conventional state directory first, but fall through to
  // ~/.bac-state if it isn't writable. We've seen ~/.local/state owned by
  // root on machines where a previous tool created it as root — we don't
  // want a zero-config CLI to fail because of that.
  const candidates: string[] = [];
  if (process.platform === 'win32') {
    const base = process.env.LOCALAPPDATA ?? path.join(homedir(), 'AppData', 'Local');
    candidates.push(path.join(base, 'browser-agent-chaos'));
  } else {
    const xdg = process.env.XDG_STATE_HOME;
    if (xdg) candidates.push(path.join(xdg, 'browser-agent-chaos'));
    candidates.push(path.join(homedir(), '.local', 'state', 'browser-agent-chaos'));
  }
  // Final fallback: a dotfile directly under $HOME. Always writable by the
  // running user; the leading dot keeps it out of `ls`. Less conventional
  // but bulletproof.
  candidates.push(path.join(homedir(), '.browser-agent-chaos'));

  for (const dir of candidates) {
    try {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      // Verify writability with a touch — mkdirSync can succeed on an existing
      // root-owned tree that we still can't write to.
      const probe = path.join(dir, '.writable-probe');
      writeFileSync(probe, '');
      try {
        unlinkSync(probe);
      } catch { /* ignore */ }
      return dir;
    } catch {
      continue;
    }
  }
  // If every candidate failed, return the first one anyway and let writes
  // fail loudly downstream — there's nothing useful to do here.
  return candidates[0];
}

function statePath(): string {
  return path.join(stateDir(), 'state.bin');
}

function deriveKey(): Buffer {
  const passphrase = `${userInfo().username}:${hostname()}:bac-v1`;
  // scrypt with conservative cost — we derive once per process at boot.
  return scryptSync(passphrase, APP_SALT, 32);
}

function encrypt(plaintext: Buffer): Buffer {
  const key = deriveKey();
  const nonce = randomBytes(NONCE_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, nonce, tag, ciphertext]);
}

function decrypt(blob: Buffer): Buffer | null {
  if (blob.length < MAGIC.length + NONCE_LEN + TAG_LEN) return null;
  const magic = blob.subarray(0, MAGIC.length);
  if (!magic.equals(MAGIC)) return null;
  const nonce = blob.subarray(MAGIC.length, MAGIC.length + NONCE_LEN);
  const tag = blob.subarray(MAGIC.length + NONCE_LEN, MAGIC.length + NONCE_LEN + TAG_LEN);
  const ciphertext = blob.subarray(MAGIC.length + NONCE_LEN + TAG_LEN);
  try {
    const key = deriveKey();
    const decipher = createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    return null;
  }
}

export function loadState(): PersistedState | null {
  const file = statePath();
  if (!existsSync(file)) return null;
  let blob: Buffer;
  try {
    blob = readFileSync(file);
  } catch {
    return null;
  }
  const plain = decrypt(blob);
  if (!plain) {
    // Wrong machine / corrupted / older format. Don't crash; warn and start
    // fresh. The bad file stays put — the user can delete it manually.
    console.warn(
      `⚠  Could not decrypt session store at ${file}. Starting fresh (the old file is preserved).`,
    );
    return null;
  }
  try {
    const parsed = JSON.parse(plain.toString('utf8')) as PersistedState;
    if (parsed.version !== 1) {
      console.warn(`⚠  Session store version ${parsed.version} not supported; starting fresh.`);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveState(state: PersistedState): void {
  const dir = stateDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = statePath();
  const tmp = `${file}.tmp`;
  const plain = Buffer.from(JSON.stringify(state), 'utf8');
  const blob = encrypt(plain);
  // Write-then-rename so a crash mid-write doesn't corrupt the existing file.
  writeFileSync(tmp, blob, { mode: 0o600 });
  renameSync(tmp, file);
}

/**
 * Debounced save: lots of mutations land in quick bursts (mount, event, event,
 * event, …). Flush at most every `intervalMs`. Also exposes a forceFlush() for
 * shutdown.
 */
export function makeDebouncedSaver(intervalMs = 500) {
  let pending: PersistedState | null = null;
  let timer: NodeJS.Timeout | null = null;
  const flush = () => {
    if (!pending) return;
    try {
      saveState(pending);
    } catch (err) {
      console.warn('⚠  saveState failed:', err);
    }
    pending = null;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  };
  return {
    schedule(state: PersistedState) {
      pending = state;
      if (timer) return;
      timer = setTimeout(flush, intervalMs);
    },
    forceFlush() {
      flush();
    },
    /** Best-effort sync flush — for SIGINT/SIGTERM/exit. */
    flushSync() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (pending) {
        try {
          saveState(pending);
        } catch {
          /* swallow on shutdown */
        }
        pending = null;
      }
    },
  };
}

export function statePathForLog(): string {
  return statePath();
}
