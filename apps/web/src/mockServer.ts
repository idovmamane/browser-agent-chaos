/**
 * Client-side mock of the read-only server endpoints. Loaded only when the
 * SPA detects it's running on the static GitHub Pages build (no Node
 * backend). Intercepts fetch() for /api/* paths and serves from a baked
 * JSON dataset generated at build time.
 *
 * What IS mocked (read-only):
 *   - /api/mode
 *   - /api/agent-port
 *   - /api/pack-sizes
 *   - /api/challenges
 *   - /api/admin/sessions
 *   - /api/score/:sessionId
 *   - /api/result/:sessionId/:challengeId
 *   - /all?session=<id>
 *
 * What is NOT mocked (writes / interactive previews):
 *   - /api/preview/:slug          → returns a friendly "demo mode" 410
 *   - /api/challenge/:id/mount    → idem
 *   - /api/challenge/:id/act      → idem
 *   - /api/challenge/:id/declare  → idem
 *   - /api/stage/:id/*            → idem
 *
 * The visitor can browse, filter, drill into score pages, see the full
 * per-challenge breakdown. Previews on the landing grid open a "this is
 * the static demo" banner instead of mounting a real challenge.
 */

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

async function handle(url: URL, init?: RequestInit): Promise<Response | null> {
  const p = url.pathname;
  const ds = await loadDataset();

  if (p === '/api/mode') {
    // Dev mode = true so the landing page shows the challenge grid.
    return json({ dev: true });
  }
  if (p === '/api/agent-port') {
    return json({ port: 0 });
  }
  if (p === '/api/pack-sizes') {
    return json(ds.packSizes);
  }
  if (p === '/api/challenges') {
    return json({ challenges: ds.catalogue });
  }
  if (p === '/api/admin/sessions') {
    return json({ sessions: ds.sessions });
  }
  if (p.startsWith('/api/score/')) {
    const id = decodeURIComponent(p.slice('/api/score/'.length));
    const s = ds.sessions.find((x) => x.id === id);
    if (!s) return json({ error: 'not found' }, 404);
    return json({
      sessionId: s.id,
      agentLabel: s.agentLabel,
      createdAt: s.createdAt,
      results: s.results,
      // Aggregated fields the score page renders in its header
      total: s.avg,
      passed: s.passed,
      failed: s.failed,
      skipped: s.skipped,
      attempted: s.attempted,
      packSize: ds.packSizes.long, // approximate
    });
  }
  if (p.startsWith('/api/result/')) {
    const [_, sessionId, challengeId] = p.slice('/api/result/'.length).split('/');
    const s = ds.sessions.find((x) => x.id === sessionId);
    if (!s) return json({ error: 'session not found' }, 404);
    const r = s.results.find((x: any) => x.task === challengeId);
    if (!r) return json({ error: 'challenge not attempted' }, 404);
    return json(r);
  }
  if (p === '/all') {
    const sessionId = url.searchParams.get('session') ?? '';
    const s = ds.sessions.find((x) => x.id === sessionId);
    if (!s) return json({ challenges: [] });
    // Build a /all response approximating the server's shape: a list of
    // challenges with their status for this session. We don't have full
    // challenge metadata client-side so we report what we know.
    const challenges = s.results.map((r: any) => ({
      id: r.task,
      status: r.success ? 'pass' : r.skipped ? 'skip' : r.abandoned ? 'abandoned' : 'fail',
      total: r.total,
      taskUrl: `#`, // dead link — no live agent run on the demo site
    }));
    return json({ session: sessionId, challenges });
  }

  // Preview endpoint: open a TaskPage that resolves to a "demo-only"
  // banner. We need to return { token, path } so Home.tsx's openPreview
  // navigates the popup tab to /task/<token>.
  if (p.startsWith('/api/preview/')) {
    const slug = decodeURIComponent(p.slice('/api/preview/'.length));
    const token = `demo_${slug}`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const base = ((import.meta as any).env?.BASE_URL ?? '/') as string;
    return json({ token, path: `${base.replace(/\/$/, '')}/task/${token}` });
  }
  // /api/resolve/:token — TaskPage's first call. Resolve our demo_* tokens
  // to a fake bespoke session so TaskPage renders the proper "demo-only"
  // screen instead of "unknown task URL".
  if (p.startsWith('/api/resolve/')) {
    const token = decodeURIComponent(p.slice('/api/resolve/'.length));
    if (token.startsWith('demo_')) {
      const slug = token.slice('demo_'.length);
      return json({
        sessionId: token,
        challengeId: slug,
        audience: 'preview',
        template: 'demo-mode',
      });
    }
    return json({ error: 'unknown' }, 404);
  }
  // Other write endpoints: tell SPA we're in demo mode.
  if (
    p.startsWith('/api/challenge/') ||
    p.startsWith('/api/stage/') ||
    p === '/api/events' ||
    p === '/api/session' ||
    p.startsWith('/api/skip/')
  ) {
    return json(
      {
        error: 'demo-mode',
        message:
          'This is a static demo. Running real challenges requires `npx browser-agent-chaos`.',
      },
      410,
    );
  }

  // Unknown — let the real fetch handle it (will probably 404 from Pages)
  return null;
}

export function installMockServer() {
  const origFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url: URL;
    try {
      url = typeof input === 'string'
        ? new URL(input, document.baseURI)
        : input instanceof URL
          ? input
          : new URL((input as Request).url, document.baseURI);
    } catch {
      return origFetch(input as any, init);
    }
    // Only intercept same-origin /api/* and /all
    const isLocal = url.origin === window.location.origin;
    const handled = isLocal && (url.pathname.startsWith('/api/') || url.pathname === '/all');
    if (!handled) return origFetch(input as any, init);

    const mocked = await handle(url, init);
    if (mocked) return mocked;
    return origFetch(input as any, init);
  };
  // Eagerly load the dataset (small) so the first dashboard render is snappy
  loadDataset().catch(() => {});
}
