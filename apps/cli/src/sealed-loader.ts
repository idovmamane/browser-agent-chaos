import {
  createDecipheriv,
  scryptSync,
} from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Loads the sealed challenge catalogue if present, falls back to the plain
 * `@browser-agent-chaos/challenges` import otherwise.
 *
 * Sealed mode:
 *   1. Read sealed-bundle.bin
 *   2. Derive AES-256-GCM key from BAC_SEAL_KEY (env or prompt)
 *   3. Decrypt → tar → untar to a tempdir
 *   4. require() the .jsc bytecode files via bytenode
 *   5. Return the same shape (challenges array + getChallenge)
 *
 * Dev mode (no sealed-bundle.bin):
 *   Just import from the workspace package.
 *
 * The sealed bundle is decrypted in memory, written to an OS-private tmpdir
 * (chmod 0700), required, then the tmpdir is deleted. The .jsc bytecode
 * never lives at a predictable path and never survives the process — but
 * an attacker with shell access to this node process while it runs can
 * still race the tmpdir or attach a debugger. This is obfuscation, not a
 * security boundary.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function deriveKey(passphrase: string): Buffer {
  try {
    const raw = Buffer.from(passphrase, 'base64');
    if (raw.length === 32) return raw;
  } catch {}
  return scryptSync(passphrase, 'bac-static-salt-v1', 32);
}

async function readPassphrase(): Promise<string | null> {
  if (process.env.BAC_SEAL_KEY) return process.env.BAC_SEAL_KEY;
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((res) =>
    rl.question('BAC_SEAL_KEY: ', (a) => {
      rl.close();
      res(a);
    }),
  );
}

function tryDecrypt(blob: Buffer, key: Buffer): Buffer | null {
  if (blob.slice(0, 4).toString('ascii') !== 'BACB') return null;
  if (blob.readUInt8(4) !== 1) return null;
  const iv = blob.slice(5, 17);
  const tag = blob.slice(17, 33);
  const ct = blob.slice(33);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ct), decipher.final()]);
  } catch {
    return null;
  }
}

function untarToTmp(tarBuf: Buffer): string {
  const dir = path.join(tmpdir(), `bac-sealed-${process.pid}-${Date.now()}`);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const res = spawnSync('tar', ['-xf', '-', '-C', dir], {
    input: tarBuf,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (res.status !== 0) {
    rmSync(dir, { recursive: true, force: true });
    throw new Error('untar failed');
  }
  return dir;
}

function resolveBundlePath(): string | null {
  const candidates = [
    path.resolve(__dirname, 'sealed-bundle.bin'),
    path.resolve(__dirname, '../sealed-bundle.bin'),
    path.resolve(process.cwd(), 'apps/cli/dist/sealed-bundle.bin'),
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

export interface ChallengesModule {
  // matches the shape exported by packages/challenges/src/index.ts
  challenges: any[];
  getChallenge: (id: string) => any;
}

export async function loadChallenges(): Promise<{
  mod: ChallengesModule;
  sealed: boolean;
}> {
  const bundlePath = resolveBundlePath();
  if (bundlePath) {
    const blob = readFileSync(bundlePath);
    const passphrase = await readPassphrase();
    if (!passphrase) {
      console.warn(
        '⚠  sealed-bundle.bin present but BAC_SEAL_KEY missing; falling back to dev mode.',
      );
    } else {
      const key = deriveKey(passphrase);
      const plain = tryDecrypt(blob, key);
      if (!plain) {
        console.warn(
          '⚠  Could not decrypt sealed bundle (wrong key?). Falling back to dev mode.',
        );
      } else {
        const dir = untarToTmp(plain);
        // The tar contains `dist-sealed/` at the root. Resolve the entry file.
        const sealedRoot = path.join(dir, 'dist-sealed');
        const indexJsc = path.join(sealedRoot, 'index.jsc');
        if (!existsSync(indexJsc)) {
          console.warn(`⚠  expected ${indexJsc} not found, falling back.`);
          rmSync(dir, { recursive: true, force: true });
        } else {
          // bytenode hooks Node's require() so .jsc files load like .js.
          // We have to load it via CommonJS — wrap with createRequire.
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { createRequire } = await import('node:module');
          const requireBin = createRequire(import.meta.url);
          requireBin('bytenode');
          const mod: ChallengesModule = requireBin(indexJsc);
          // Schedule tmpdir wipe on exit. We KEEP it until exit because .jsc
          // files are mmap'd by V8 and removing them mid-process is unsafe.
          const cleanup = () => {
            try {
              rmSync(dir, { recursive: true, force: true });
            } catch {}
          };
          process.once('exit', cleanup);
          process.once('SIGINT', () => { cleanup(); process.exit(130); });
          process.once('SIGTERM', () => { cleanup(); process.exit(143); });
          return { mod, sealed: true };
        }
      }
    }
  }
  // Dev mode fallback.
  const plain = await import('@browser-agent-chaos/challenges');
  return { mod: plain as any, sealed: false };
}
