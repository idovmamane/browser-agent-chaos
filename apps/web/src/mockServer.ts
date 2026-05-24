/**
 * Client-side mock of the server endpoints. Loaded only when the SPA detects
 * it's running on the static GitHub Pages build (no Node backend).
 *
 * Intercepts fetch() for /api/* and /all paths. For read-only endpoints we
 * serve from a baked JSON dataset. For write endpoints (mount/act/declare,
 * stage mount/interact/skip) we run a faithful in-memory port of the server
 * scoring loop so previews render and respond exactly like dev mode —
 * cookie modals, dark patterns, success/failure screens, etc.
 *
 * What we deliberately DON'T mock:
 *   - cross-session persistence beyond a tab reload (in-memory only)
 *   - real telemetry to a backend (events are accepted and dropped)
 *   - strict-mode timing/trusted checks (no agent driving the demo)
 */
import {
  applyInteraction,
  check as runCheck,
  emptyState,
  type InteractionEvent,
  type InteractionState,
  type MountResponse,
  type PublicAction,
  type ActResponse,
} from '@browser-agent-chaos/core';

interface DemoChallenge {
  id: string;
  title: string;
  tagline: string;
  goal: string;
  rules: string[];
  traps: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedSeconds: number;
  category: string;
  template: string;
  templateData: Record<string, unknown> | null;
  actionSpec: {
    correct: { id: string; label: string; successMessage: string };
    others: Array<{
      id: string;
      label: string;
      description: string;
      kind: 'correct' | 'wrong' | 'danger' | 'skip';
    }>;
    prompt?: string;
  } | null;
  stage: {
    kind: string;
    data: Record<string, unknown>;
    check: any;
    successMessage: string;
  } | null;
}

interface Dataset {
  generatedAt: number;
  packSizes: { short: number; intermediary: number; long: number };
  catalogue: Array<{
    id: string;
    category: string;
    difficulty: 'easy' | 'medium' | 'hard';
    template: string;
    estimatedSeconds: number;
  }>;
  challenges: DemoChallenge[];
  sessions: Array<{
    id: string;
    agentLabel?: string;
    createdAt: number;
    lastActivity: number;
    durationSeconds: number;
    attempted: number;
    passed: number;
    failed: number;
    skipped: number;
    suspicious: number;
    avg: number;
    totalMounts: number;
    mountsWithoutInteract: number;
    byTier: Record<string, { pass: number; fail: number; skip: number }>;
    recent: Array<{ challengeId: string; event: string; timestamp: number }>;
    results: Array<any>;
  }>;
}

let datasetPromise: Promise<Dataset> | null = null;

function loadDataset(): Promise<Dataset> {
  if (!datasetPromise) {
    // BASE_URL is the deploy prefix (e.g. `/browser-agent-chaos/` on
    // Pages, `/` on local dev). The dataset is colocated at the SPA root.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = ((import.meta as any).env?.BASE_URL ?? '/') as string;
    const url = `${base}static-dataset.json`;
    datasetPromise = fetch(url).then((r) => r.json());
  }
  return datasetPromise;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function rndId(prefix: string, bytes = 9): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let hex = '';
  for (const b of arr) hex += b.toString(16).padStart(2, '0');
  return `${prefix}_${hex}`;
}

// ─── In-memory mount table (lives for the duration of the tab) ────────────

interface ActionToken {
  token: string;
  realId: string;
  label: string;
  kind: 'correct' | 'wrong' | 'danger' | 'skip';
}

interface V1Mount {
  kind: 'v1';
  sessionId: string;
  challengeId: string;
  mountNonce: string;
  mountedAt: number;
  publicActions: PublicAction[];
  tokens: Map<string, ActionToken>;
  attempt: 'open' | 'sealed';
  outcome?: 'success' | 'failure' | 'skipped';
}

interface V2Mount {
  kind: 'v2';
  sessionId: string;
  challengeId: string;
  mountNonce: string;
  mountedAt: number;
  state: InteractionState;
  attempt: 'open' | 'sealed';
  outcome?: 'success' | 'failure' | 'skipped';
}

const mounts = new Map<string, V1Mount | V2Mount>();
const mountKey = (s: string, c: string) => `${s}::${c}`;

function challengeById(ds: Dataset, id: string): DemoChallenge | undefined {
  return ds.challenges.find((c) => c.id === id);
}

function buildV1Mount(
  sessionId: string,
  challenge: DemoChallenge,
): V1Mount {
  const spec = challenge.actionSpec;
  const sourceActions: Array<{
    id: string;
    label: string;
    kind: 'correct' | 'wrong' | 'danger' | 'skip';
  }> = spec
    ? [
        { id: spec.correct.id, label: spec.correct.label, kind: 'correct' },
        ...spec.others.map((a) => ({
          id: a.id,
          label: a.label,
          kind: a.kind,
        })),
        { id: 'skip', label: 'Skip this challenge', kind: 'skip' as const },
      ]
    : [{ id: 'skip', label: 'Skip this challenge', kind: 'skip' as const }];

  // Shuffle so the correct action isn't always first.
  const shuffled = [...sourceActions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const tokens = new Map<string, ActionToken>();
  const publicActions: PublicAction[] = [];
  for (const a of shuffled) {
    const token = rndId('tk');
    tokens.set(token, { token, realId: a.id, label: a.label, kind: a.kind });
    publicActions.push({ token, label: a.label });
  }
  return {
    kind: 'v1',
    sessionId,
    challengeId: challenge.id,
    mountNonce: rndId('mn', 12),
    mountedAt: Date.now(),
    publicActions,
    tokens,
    attempt: 'open',
  };
}

function buildV2Mount(sessionId: string, challenge: DemoChallenge): V2Mount {
  return {
    kind: 'v2',
    sessionId,
    challengeId: challenge.id,
    mountNonce: rndId('mn', 12),
    mountedAt: Date.now(),
    state: emptyState(),
    attempt: 'open',
  };
}

function mountResponseFromV1(
  mount: V1Mount,
  challenge: DemoChallenge,
): MountResponse & { outcome?: string } {
  return {
    session: mount.sessionId,
    challengeId: mount.challengeId,
    mountedAt: mount.mountedAt,
    mountNonce: mount.mountNonce,
    actions: mount.publicActions,
    attempt: mount.attempt,
    challenge: {
      id: challenge.id,
      difficulty: challenge.difficulty,
      estimatedSeconds: challenge.estimatedSeconds,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      category: challenge.category as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      template: challenge.template as any,
      templateData: challenge.templateData ?? undefined,
    },
    meta: {
      title: challenge.title,
      tagline: challenge.tagline,
      goal: challenge.goal,
      rules: challenge.rules,
      traps: challenge.traps,
    },
    outcome: mount.outcome,
  };
}

// ─── Endpoint handlers ────────────────────────────────────────────────────

async function handle(url: URL, init?: RequestInit): Promise<Response | null> {
  const p = url.pathname;
  const method = (init?.method ?? 'GET').toUpperCase();
  const ds = await loadDataset();

  if (p === '/api/mode') return json({ dev: true });
  if (p === '/api/agent-port') return json({ port: 0 });
  if (p === '/api/pack-sizes') return json(ds.packSizes);
  if (p === '/api/challenges') return json({ challenges: ds.catalogue });
  if (p === '/api/admin/sessions') return json({ sessions: ds.sessions });

  if (p.startsWith('/api/score/')) {
    const id = decodeURIComponent(p.slice('/api/score/'.length));
    const s = ds.sessions.find((x) => x.id === id);
    if (!s) return json({ error: 'not found' }, 404);
    return json({
      sessionId: s.id,
      agentLabel: s.agentLabel,
      createdAt: s.createdAt,
      results: s.results,
      total: s.avg,
      passed: s.passed,
      failed: s.failed,
      skipped: s.skipped,
      attempted: s.attempted,
      packSize: ds.packSizes.long,
    });
  }
  if (p.startsWith('/api/result/')) {
    const [, sessionId, challengeId] = p.slice('/api/result/'.length).split('/');
    const s = ds.sessions.find((x) => x.id === sessionId);
    if (!s) return json({ error: 'session not found' }, 404);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = s.results.find((x: any) => x.task === challengeId);
    if (!r) return json({ error: 'challenge not attempted' }, 404);
    return json(r);
  }
  if (p === '/all') {
    const sessionId = url.searchParams.get('session') ?? '';
    const s = ds.sessions.find((x) => x.id === sessionId);
    if (!s) return json({ challenges: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const challenges = s.results.map((r: any) => ({
      id: r.task,
      status: r.success ? 'pass' : r.skipped ? 'skip' : r.abandoned ? 'abandoned' : 'fail',
      total: r.total,
      taskUrl: `#`,
    }));
    return json({ session: sessionId, challenges });
  }

  // Preview endpoint: open a TaskPage that resolves to the actual challenge.
  if (p.startsWith('/api/preview/')) {
    const slug = decodeURIComponent(p.slice('/api/preview/'.length));
    const token = `demo_${slug}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = ((import.meta as any).env?.BASE_URL ?? '/') as string;
    return json({ token, path: `${base.replace(/\/$/, '')}/task/${token}` });
  }

  // /api/resolve/:token — TaskPage's first call. Map demo_<id> → real
  // challenge with its actual template so the right renderer fires.
  if (p.startsWith('/api/resolve/')) {
    const token = decodeURIComponent(p.slice('/api/resolve/'.length));
    if (token.startsWith('demo_')) {
      const slug = token.slice('demo_'.length);
      const ch = challengeById(ds, slug);
      if (!ch) return json({ error: 'unknown challenge' }, 404);
      return json({
        sessionId: token,
        challengeId: slug,
        audience: 'preview',
        template: ch.template,
      });
    }
    return json({ error: 'unknown' }, 404);
  }

  // ─── Mount / Act / Declare (v1 — bespoke + templated) ───────────────────

  // v1 mount
  const mMount = p.match(/^\/api\/challenge\/([^/]+)\/mount$/);
  if (mMount && method === 'POST') {
    const id = decodeURIComponent(mMount[1]);
    const body = parseBody(init);
    const sessionId = body.session as string | undefined;
    if (!sessionId) return json({ error: 'session required' }, 400);
    const challenge = challengeById(ds, id);
    if (!challenge) return json({ error: 'unknown challenge' }, 404);

    const key = mountKey(sessionId, id);
    let mount = mounts.get(key);
    if (!mount) {
      mount =
        challenge.stage
          ? buildV2Mount(sessionId, challenge)
          : buildV1Mount(sessionId, challenge);
      mounts.set(key, mount);
    }
    if (mount.kind === 'v1') {
      return json(mountResponseFromV1(mount, challenge));
    }
    // v2: handled below in /api/stage/*, but TaskPage may probe via /mount
    // for sealed-attempt detection. Reply with a sealed-aware payload.
    return json({
      session: sessionId,
      challengeId: id,
      mountedAt: mount.mountedAt,
      mountNonce: mount.mountNonce,
      actions: [],
      attempt: mount.attempt,
      challenge: {
        id: challenge.id,
        difficulty: challenge.difficulty,
        estimatedSeconds: challenge.estimatedSeconds,
        category: challenge.category,
        template: challenge.template,
        templateData: challenge.templateData,
      },
      meta: {
        title: challenge.title,
        tagline: challenge.tagline,
        goal: challenge.goal,
        rules: challenge.rules,
        traps: challenge.traps,
      },
      outcome: mount.outcome,
    });
  }

  // v1 act
  const mAct = p.match(/^\/api\/challenge\/([^/]+)\/act$/);
  if (mAct && method === 'POST') {
    const id = decodeURIComponent(mAct[1]);
    const body = parseBody(init);
    const sessionId = body.session as string | undefined;
    const token = body.token as string | undefined;
    const nonce = body.mountNonce as string | undefined;
    if (!sessionId || !token || !nonce) {
      return json({ error: 'session, token, mountNonce required' }, 400);
    }
    const challenge = challengeById(ds, id);
    if (!challenge) return json({ error: 'unknown challenge' }, 404);
    const mount = mounts.get(mountKey(sessionId, id));
    if (!mount || mount.kind !== 'v1') {
      return json(
        actResp('rejected', false, 'No mount — call /mount first.', 'no-mount'),
        400,
      );
    }
    if (mount.mountNonce !== nonce) {
      return json(
        actResp('rejected', mount.attempt === 'sealed', 'mountNonce mismatch.', 'bad-nonce'),
        400,
      );
    }
    if (mount.attempt === 'sealed') {
      return json(
        actResp('rejected', true, `Already ${mount.outcome ?? 'sealed'}.`, 'sealed'),
      );
    }
    const action = mount.tokens.get(token);
    if (!action) {
      return json(
        actResp('rejected', false, 'Unknown action token.', 'bad-token'),
        400,
      );
    }
    const outcome: 'success' | 'failure' | 'skipped' =
      action.kind === 'correct' ? 'success' : action.kind === 'skip' ? 'skipped' : 'failure';
    mount.attempt = 'sealed';
    mount.outcome = outcome;
    const successMessage =
      outcome === 'success' && challenge.actionSpec
        ? challenge.actionSpec.correct.successMessage
        : undefined;
    const resp: ActResponse = {
      ok: true,
      outcome,
      sealed: true,
      message:
        outcome === 'success'
          ? '✅ Success — moving on.'
          : outcome === 'skipped'
            ? '⏭️ Skipped.'
            : action.kind === 'danger'
              ? '❌ Safety violation recorded.'
              : '❌ Wrong action recorded.',
      successMessage,
    };
    return json(resp);
  }

  // bespoke declare
  const mDeclare = p.match(/^\/api\/challenge\/([^/]+)\/declare$/);
  if (mDeclare && method === 'POST') {
    const id = decodeURIComponent(mDeclare[1]);
    const body = parseBody(init);
    const sessionId = body.session as string | undefined;
    const nonce = body.mountNonce as string | undefined;
    const kind = body.kind as 'success' | 'failure' | 'skipped' | undefined;
    if (!sessionId || !nonce || !kind) {
      return json({ error: 'session, mountNonce, kind required' }, 400);
    }
    const mount = mounts.get(mountKey(sessionId, id));
    if (!mount || mount.mountNonce !== nonce) {
      return json({ ok: false, error: 'bad mount' }, 400);
    }
    if (mount.attempt === 'sealed') {
      return json({ ok: false, error: 'already sealed' });
    }
    mount.attempt = 'sealed';
    mount.outcome = kind;
    return json({ ok: true, outcome: kind, sealed: true });
  }

  // ─── Stage (v2) ─────────────────────────────────────────────────────────

  const mStageMount = p.match(/^\/api\/stage\/([^/]+)\/mount$/);
  if (mStageMount && method === 'POST') {
    const id = decodeURIComponent(mStageMount[1]);
    const body = parseBody(init);
    const sessionId = body.session as string | undefined;
    if (!sessionId) return json({ error: 'session required' }, 400);
    const challenge = challengeById(ds, id);
    if (!challenge || !challenge.stage) {
      return json({ error: 'unknown stage' }, 404);
    }
    const key = mountKey(sessionId, id);
    let mount = mounts.get(key);
    if (!mount || mount.kind !== 'v2') {
      mount = buildV2Mount(sessionId, challenge);
      mounts.set(key, mount);
    }
    // Strip dynamicGoal from public data.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { dynamicGoal: _drop, ...publicData } = (challenge.stage.data ?? {}) as any;
    const dynamicGoal =
      (challenge.stage.data?.dynamicGoal as string | undefined) ?? challenge.goal;
    return json({
      session: sessionId,
      challengeId: id,
      mountedAt: mount.mountedAt,
      mountNonce: mount.mountNonce,
      attempt: mount.attempt,
      outcome: mount.outcome,
      challenge: {
        id: challenge.id,
        difficulty: challenge.difficulty,
        estimatedSeconds: challenge.estimatedSeconds,
        category: challenge.category,
        template: challenge.template,
      },
      meta: {
        title: challenge.title,
        tagline: challenge.tagline,
        goal: dynamicGoal,
        rules: challenge.rules,
        traps: challenge.traps,
      },
      stage: {
        kind: challenge.stage.kind,
        data: publicData,
      },
    });
  }

  const mStageInteract = p.match(/^\/api\/stage\/([^/]+)\/interact$/);
  if (mStageInteract && method === 'POST') {
    const id = decodeURIComponent(mStageInteract[1]);
    const body = parseBody(init);
    const sessionId = body.session as string | undefined;
    const nonce = body.mountNonce as string | undefined;
    const event = body.event as Partial<InteractionEvent> | undefined;
    if (!sessionId || !nonce || !event) {
      return json({ error: 'session, mountNonce, event required' }, 400);
    }
    const challenge = challengeById(ds, id);
    if (!challenge || !challenge.stage) return json({ error: 'unknown stage' }, 404);
    const mount = mounts.get(mountKey(sessionId, id));
    if (!mount || mount.kind !== 'v2' || mount.mountNonce !== nonce) {
      return json({
        ok: false,
        outcome: 'rejected',
        sealed: !!mount && mount.attempt === 'sealed',
        message: 'mount missing or nonce mismatch',
        rejectedReason: 'bad-mount',
      }, 400);
    }
    if (mount.attempt === 'sealed') {
      return json({
        ok: false,
        outcome: 'rejected',
        sealed: true,
        message: `Already ${mount.outcome ?? 'sealed'}`,
        rejectedReason: 'sealed',
      });
    }
    if (typeof event.target !== 'string' || typeof event.kind !== 'string') {
      return json({ error: 'event.target and event.kind required' }, 400);
    }
    const interaction: InteractionEvent = {
      target: event.target,
      kind: event.kind as InteractionEvent['kind'],
      value: event.value,
      clientTs: typeof event.clientTs === 'number' ? event.clientTs : Date.now(),
      isTrusted: event.isTrusted === true,
    };
    mount.state = applyInteraction(mount.state, interaction, mount.mountedAt);
    const outcome = runCheck(challenge.stage.check, mount.state);
    if (outcome.result === 'success') {
      mount.attempt = 'sealed';
      mount.outcome = 'success';
      return json({
        ok: true,
        outcome: 'success',
        sealed: true,
        message: '✅ ' + challenge.stage.successMessage,
        successMessage: challenge.stage.successMessage,
      });
    }
    if (outcome.result === 'failure') {
      mount.attempt = 'sealed';
      mount.outcome = 'failure';
      return json({
        ok: true,
        outcome: 'failure',
        sealed: true,
        message: '❌ ' + outcome.reason,
      });
    }
    return json({
      ok: true,
      outcome: 'pending',
      sealed: false,
      message: 'event accepted; goal not yet satisfied',
    });
  }

  const mStageSkip = p.match(/^\/api\/stage\/([^/]+)\/skip$/);
  if (mStageSkip && method === 'POST') {
    const id = decodeURIComponent(mStageSkip[1]);
    const body = parseBody(init);
    const sessionId = body.session as string | undefined;
    const nonce = body.mountNonce as string | undefined;
    if (!sessionId || !nonce) {
      return json({ error: 'session, mountNonce required' }, 400);
    }
    const mount = mounts.get(mountKey(sessionId, id));
    if (!mount || mount.mountNonce !== nonce) {
      return json({ ok: false, outcome: 'rejected', rejectedReason: 'bad-mount' });
    }
    if (mount.attempt === 'sealed') {
      return json({
        ok: false,
        outcome: 'rejected',
        sealed: true,
        rejectedReason: 'sealed',
      });
    }
    mount.attempt = 'sealed';
    mount.outcome = 'skipped';
    return json({ ok: true, outcome: 'skipped', sealed: true });
  }

  // Skip via /api/skip/:token — preview sessions seal the underlying mount.
  if (p.startsWith('/api/skip/')) {
    const token = decodeURIComponent(p.slice('/api/skip/'.length));
    if (token.startsWith('demo_')) {
      const slug = token.slice('demo_'.length);
      const m = mounts.get(mountKey(token, slug));
      if (m && m.attempt !== 'sealed') {
        m.attempt = 'sealed';
        m.outcome = 'skipped';
      }
      return json({ ok: true, sealed: true, outcome: 'skipped' });
    }
    return json({ ok: false, error: 'unknown token' }, 404);
  }

  // Anything that writes a session / telemetry: accept silently. Components
  // call /api/events as fire-and-forget and won't break on a 204.
  if (p === '/api/events' || p === '/api/session') {
    return json({ ok: true });
  }

  return null;
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body) return {};
  if (typeof init.body === 'string') {
    try {
      return JSON.parse(init.body);
    } catch {
      return {};
    }
  }
  return {};
}

function actResp(
  outcome: ActResponse['outcome'],
  sealed: boolean,
  message: string,
  rejectedReason?: string,
): ActResponse {
  return { ok: false, outcome, sealed, message, rejectedReason };
}

export function installMockServer() {
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL;
    try {
      url =
        typeof input === 'string'
          ? new URL(input, document.baseURI)
          : input instanceof URL
            ? input
            : new URL((input as Request).url, document.baseURI);
    } catch {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return origFetch(input as any, init);
    }
    const isLocal = url.origin === window.location.origin;
    const handled =
      isLocal && (url.pathname.startsWith('/api/') || url.pathname === '/all');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!handled) return origFetch(input as any, init);
    const mocked = await handle(url, init);
    if (mocked) return mocked;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return origFetch(input as any, init);
  };
  loadDataset().catch(() => {});
}
