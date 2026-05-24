import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getSessionId } from '../lib/api';
import { LogoIcon } from '../components/Logo';

/**
 * Shape of the entries served by GET /api/challenges (the catalogue). No
 * title / goal / rules / templateData — those live only in the server's
 * mount response, which is how we keep the static frontend bundle free of
 * per-challenge copy.
 */
interface CatalogueEntry {
  id: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  template: string;
  estimatedSeconds: number;
}

function copy(text: string) {
  navigator.clipboard.writeText(text);
}

export function Home() {
  // The Home page is a landing for humans. It never creates a session itself
  // — that's what /new-session is for. So we just read whatever session is
  // already in localStorage (if any) to display a "back to your last
  // session" link, but never write one.
  // Landing on the home page means the user is done with whatever preview
  // play-test they were on. Drop the throwaway preview id from sessionStorage
  // so the "your last session" pill (and every other read) never picks it up.
  if (typeof window !== 'undefined') {
    window.sessionStorage.removeItem('bac.previewSessionId');
  }
  const sessionId = getSessionId();

  // Verify the persisted sessionId still maps to a live server session before
  // showing the "your last session" pill. Otherwise a stale id from
  // localStorage (from a previous server boot, a deleted session, or a
  // preview that's been swept) would render a link to a 404. Also: prune
  // localStorage so we don't ask again on every render.
  const [liveSessionId, setLiveSessionId] = useState<string | null>(null);
  useEffect(() => {
    if (!sessionId) {
      setLiveSessionId(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/score/${encodeURIComponent(sessionId)}`)
      .then((r) => {
        if (cancelled) return;
        if (r.ok) {
          setLiveSessionId(sessionId);
        } else {
          setLiveSessionId(null);
          if (r.status === 404) {
            // Stale — drop it so we don't query it forever.
            localStorage.removeItem('bac.sessionId');
          }
        }
      })
      .catch(() => {
        if (!cancelled) setLiveSessionId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);
  const [toast, setToast] = useState<
    | null
    | { kind: 'simple'; text: string }
    | { kind: 'clipboard'; label: string; content: string }
  >(null);
  // Three pre-built packs the user picks from. Each is a deterministic
  // session-scoped mix of ~1/3 easy + 1/3 medium + 1/3 hard.
  const [pack, setPack] = useState<'short' | 'intermediary' | 'long'>(
    'intermediary',
  );
  // Advanced run-constraints. All default to "any" / undefined, in which case
  // we don't append them to the start URL and the prompt stays unchanged.
  type Display = 'any' | 'headed' | 'headless';
  type Tool = 'any' | 'playwright' | 'puppeteer' | 'selenium';
  type Engine = 'any' | 'chromium' | 'firefox' | 'webkit';
  type Budget = 0 | 5 | 10 | 30 | 60; // 0 means unlimited
  const [display, setDisplay] = useState<Display>('any');
  const [tool, setTool] = useState<Tool>('any');
  const [engine, setEngine] = useState<Engine>('any');
  const [budget, setBudget] = useState<Budget>(0);
  // Default false: prompt enforces the solo-run rule. Flipping this to
  // true sends `?human=allowed`, which replaces the no-human block in
  // the prompt with a "co-pilot mode" disclaimer.
  const [humanAllowed, setHumanAllowed] = useState<boolean>(false);
  // Server tells us whether to reveal the challenge grid. Off by default so
  // agents can't enumerate ids by hitting `/`. Enable with `--dev` / BAC_DEV=1.
  const [devMode, setDevMode] = useState<boolean>(false);
  // The catalogue is fetched from the server — the static frontend bundle no
  // longer contains the challenges table. Entries are structural only
  // (id/category/difficulty/template) — no title / goal / rules.
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  useEffect(() => {
    fetch('/api/challenges')
      .then((r) => (r.ok ? r.json() : { challenges: [] }))
      .then((d) => setCatalogue(d.challenges ?? []))
      .catch(() => setCatalogue([]));
  }, []);

  useEffect(() => {
    fetch('/api/mode')
      .then((r) => (r.ok ? r.json() : { dev: false }))
      .then((d) => setDevMode(!!d.dev))
      .catch(() => setDevMode(false));
  }, []);

  // The agent server lives on a different (random) port than the human site.
  // Ask the human server which port that is, so the Copy-prompt button hands
  // the agent a URL it can actually reach. Falls back to window.location.host
  // if the endpoint is unavailable (e.g. dev mode where everything ran on one
  // port pre-split).
  const [agentPort, setAgentPort] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/agent-port')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && typeof d.port === 'number' && setAgentPort(d.port))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (toast) {
      // Clipboard toast lingers longer so the user can read the copied text.
      const ms = toast.kind === 'clipboard' ? 6000 : 2000;
      const t = setTimeout(() => setToast(null), ms);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const humanBaseUrl = window.location.origin;
  const agentBaseUrl = agentPort
    ? `${window.location.protocol}//${window.location.hostname}:${agentPort}`
    : humanBaseUrl;
  // Real per-pack counts come from the server (they depend on the loaded
  // catalogue). Falls back to the catalogue size if the endpoint hasn't
  // resolved yet so the first paint isn't blank.
  const [packSizes, setPackSizes] = useState<{
    short: number;
    intermediary: number;
    long: number;
  } | null>(null);
  useEffect(() => {
    fetch('/api/pack-sizes')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPackSizes(d))
      .catch(() => {});
  }, []);
  const fallbackLong = catalogue.length || 1;
  const effectiveSizes = packSizes ?? {
    short: Math.max(1, Math.round(fallbackLong / 3)),
    intermediary: Math.max(1, Math.round((fallbackLong * 2) / 3)),
    long: fallbackLong,
  };
  const tierCount = effectiveSizes[pack];
  // The whole "prompt" is now a single line. The agent fetches /start, the
  // server creates a session, builds the catalogue with absolute URLs, and
  // hands back a ready-to-use markdown system prompt. One paste, one fetch.
  // Advanced constraints only get appended if the user moved them off
  // "any" / "unlimited" — otherwise the URL stays tidy.
  const startQuery = new URLSearchParams({ pack });
  if (display !== 'any') startQuery.set('display', display);
  if (tool !== 'any') startQuery.set('tool', tool);
  if (engine !== 'any') startQuery.set('engine', engine);
  if (budget > 0) startQuery.set('budget', String(budget));
  if (humanAllowed) startQuery.set('human', 'allowed');
  const startOneLiner = `start challenge: ${agentBaseUrl}/start?${startQuery.toString()}`;

  function handleCardMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }

  const grouped = useMemo(() => {
    const map: Record<string, CatalogueEntry[]> = {};
    for (const c of catalogue) {
      const cat = c.category ?? 'core';
      if (!map[cat]) map[cat] = [];
      map[cat].push(c);
    }
    return map;
  }, [catalogue]);

  const categoryOrder = [
    'core',
    'dark-patterns',
    'destructive',
    'injection',
    'timing',
    'forms',
    'navigation',
    'modals',
    'payments',
    'accessibility',
  ];
  const sortedCats = Object.keys(grouped).sort(
    (a, b) =>
      (categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a)) -
      (categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b)),
  );

  return (
    <div className="bg-mesh">
      <div className="container">
        <div className="nav-bar">
          <div className="brand-mark">
            <div className="logo">
              <LogoIcon size={56} />
            </div>
            <div className="brand-text">
              <div className="brand-line1">BROWSER AGENT</div>
              <div className="brand-line2-chaos" data-text="CHAOS">CHAOS</div>
            </div>
          </div>
          <div className="nav-links">
            <Link to="/dashboard">Dashboard</Link>
            <a
              href="https://github.com/idovmamane/browser-agent-chaos"
              target="_blank"
              rel="noopener"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="hero">
          <span className="eyebrow">
            <span className="dot" />
            v0.1 — {catalogue.length || '~100'} challenges, fully local
          </span>
          <h1>
            The evil website
            <br />
            test suite for{' '}
            <span className="grad">AI browser agents.</span>
          </h1>
          <p className="tag">Your agent passed the demo. It failed the web.</p>
          <p className="sub">
            Browser Agent Chaos is a local, agent-agnostic benchmark of dark
            patterns, prompt injection, slow DOM, ambiguous buttons, and
            destructive traps. One command. One URL. Any agent.
          </p>
          {/*
            CTA design: pick tier, copy a prompt, drop it into your agent.
            /all is now a JSON endpoint — no human "Open /all" link makes
            sense. Humans who want to watch a live session go to /dashboard.
          */}
          <div className="cta-row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <PackPicker pack={pack} onChange={setPack} sizes={effectiveSizes} />
            <button
              className="btn primary"
              onClick={() => {
                copy(startOneLiner);
                setToast({
                  kind: 'clipboard',
                  label: 'Copied to clipboard',
                  content: startOneLiner,
                });
              }}
              title="One line. Your agent fetches /start and gets everything it needs."
            >
              Copy prompt
            </button>
            <Link
              className="btn ghost"
              to="/dashboard"
              title="Live view of every active session."
            >
              Dashboard →
            </Link>
          </div>
          <AdvancedOptions
            display={display}
            setDisplay={setDisplay}
            tool={tool}
            setTool={setTool}
            engine={engine}
            setEngine={setEngine}
            budget={budget}
            setBudget={setBudget}
            humanAllowed={humanAllowed}
            setHumanAllowed={setHumanAllowed}
          />
          {liveSessionId && !liveSessionId.startsWith('pv_') && (
            <div style={{ marginTop: 16 }}>
              <span className="session-pill">
                <span className="live-dot" />
                your last session{' '}
                <b style={{ color: 'var(--fg)' }}>{liveSessionId}</b>
                <span style={{ color: 'var(--border-strong)' }}>·</span>
                <Link
                  to={`/score/${liveSessionId}`}
                  style={{ color: 'var(--accent-2)' }}
                >
                  view score
                </Link>
              </span>
            </div>
          )}
        </div>

        {/* One prompt for every type of agent — one line, one URL, the
            server hands back a ready-to-go session + catalogue. */}
        <div className="section-title">
          <span>One prompt. Any agent.</span>
          <span className="section-count">one line · zero setup</span>
        </div>
        <div className="feature-grid">
          <div className="feature">
            <span className="ic">📋</span>
            <h4>Paste one line</h4>
            <p>
              The Copy prompt button puts a single line in your clipboard:{' '}
              <code style={{ color: 'var(--fg)' }}>
                start challenge: {`{base}`}/start?pack={`{pack}`}
              </code>
              . Drop it into any agent — Claude Code, Cursor, Cline, Codex,
              Claude Computer Use, Browser Use, Stagehand, Playwright MCP — and
              go.
            </p>
          </div>
          <div className="feature">
            <span className="ic">⚡</span>
            <h4>One fetch, everything ready</h4>
            <p>
              The agent fetches that URL and the server creates a session,
              builds the challenge catalogue with absolute task URLs baked in,
              and hands back a markdown system prompt. No SDK, no API key, no
              tier juggling. Tool choice is the agent's — Playwright, Puppeteer,
              raw CDP, OS automation, whatever it has.
            </p>
          </div>
        </div>

        {/*
          Prompt previews are intentionally NOT inlined on the landing page —
          they're long and noisy. The Copy buttons above put the full text in
          the clipboard. To inspect what a prompt contains, open the details
          below.
        */}
        {devMode && (
          <details style={{ marginTop: 20, marginBottom: 36 }}>
            <summary
              style={{
                cursor: 'pointer',
                color: 'var(--fg-faint)',
                fontSize: 13,
              }}
            >
              Preview the prompt (not copied — use the button above)
            </summary>
            <div style={{ marginTop: 14 }}>
              <div className="section-title">
                <span>What gets copied</span>
                <span className="section-count">{tierCount} challenges · {pack} pack</span>
              </div>
              <pre className="prompt">{startOneLiner}</pre>
              <p
                className="subtle"
                style={{ marginTop: 8, fontSize: 13, maxWidth: 600 }}
              >
                The agent fetches that URL and receives a pre-created session,
                the full challenge catalogue with absolute URLs, scoring
                endpoints, and the contract. One round-trip, zero parsing.
              </p>
            </div>
          </details>
        )}

        {/* Challenges — hidden in prod, only shown when server is in --dev mode.
            Off by default so agents can't enumerate ids by scraping /. */}
        {devMode && (
          <>
        <div className="section-title">
          <span>The Benchmark</span>
          <span className="section-count">
            {catalogue.length} challenges · <span style={{ color: 'var(--warn)' }}>dev mode</span>
          </span>
        </div>
        <p
          className="subtle"
          style={{ marginTop: -8, marginBottom: 18, maxWidth: 600 }}
        >
          Browse all categories below. Titles and goals aren't shipped to the
          frontend bundle — open a card to mount the challenge and see the
          actual brief.
        </p>
        {sortedCats.map((cat) => (
          <div key={cat} style={{ marginBottom: 28 }}>
            <div
              style={{
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--fg-faint)',
                marginBottom: 12,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {cat.replace('-', ' ')} · {grouped[cat].length}
            </div>
            <div className="grid">
              {grouped[cat].map((c) => {
                // The "Open" button POSTs /api/preview/:slug on the HUMAN
                // port and navigates to the returned opaque `/task/<token>`
                // path. No slug ever lands in the address bar; the preview
                // session is isolated (audience='preview', invisible to the
                // dashboard, dead on the agent port).
                const openPreview = async () => {
                  // Pre-open the tab synchronously *inside* the user gesture
                  // — Safari/Firefox pop-up blockers refuse window.open if
                  // it's called after the awaited fetch. We then point that
                  // tab at the preview URL once the server responds.
                  const tab = window.open('', '_blank');
                  try {
                    const r = await fetch(
                      `/api/preview/${encodeURIComponent(c.id)}`,
                      { method: 'POST' },
                    );
                    if (!r.ok) {
                      tab?.close();
                      setToast({ kind: 'simple', text: `Preview unavailable (HTTP ${r.status})` });
                      return;
                    }
                    const d = await r.json();
                    if (d.path) {
                      if (tab) {
                        tab.location.href = d.path;
                      } else {
                        // Pop-up blocked — fall back to opening in the
                        // current tab so the click still does something.
                        window.location.href = d.path;
                      }
                    }
                  } catch (e: any) {
                    tab?.close();
                    setToast({ kind: 'simple', text: `Preview failed: ${e?.message ?? e}` });
                  }
                };
                return (
                  <div
                    key={c.id}
                    className="card"
                    onMouseMove={handleCardMove}
                  >
                    <div className="ch-head">
                      <span className={`badge ${c.difficulty}`}>
                        {c.difficulty}
                      </span>
                      <span className="ch-arrow">→</span>
                    </div>
                    {/* No title / tagline — those live on the server now. The
                        opaque id + the structural metadata is all we render
                        from the catalogue. Open the card to mount the
                        challenge and see the actual goal banner. */}
                    <h3 style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{c.id}</h3>
                    <div className="meta">
                      <span>{c.category}</span>
                      <span>~{c.estimatedSeconds}s</span>
                    </div>
                    <div style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        onClick={openPreview}
                        className="btn"
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        Open preview
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
          </>
        )}

        {/* Agents */}
        <div className="section-title">
          <span>Works with any agent</span>
          <span className="section-count">no SDK · no API key</span>
        </div>
        <div className="agents-row">
          <span className="agent-chip">Claude Computer Use</span>
          <span className="agent-chip">Browser Use</span>
          <span className="agent-chip">Stagehand</span>
          <span className="agent-chip">Playwright MCP</span>
          <span className="agent-chip">Playwright (headless)</span>
          <span className="agent-chip">OpenAI computer-use</span>
          <span className="agent-chip">Custom agents</span>
        </div>

        {/* Closer */}
        <div className="closer">
          <div className="closer-text">
            <b>We break browser agents. We don't build them.</b>
            <div className="subtle" style={{ marginTop: 6 }}>
              100% local. No telemetry. No login. MIT.
            </div>
          </div>
          <a
            className="btn primary"
            href="https://github.com/idovmamane/browser-agent-chaos"
            target="_blank"
            rel="noopener"
          >
            Star on GitHub
          </a>
        </div>

        <div className="bottom-meta">npx browser-agent-chaos · v0.1</div>

        {toast && toast.kind === 'simple' && (
          <div className="toast">
            <span className="check">✓</span>
            {toast.text}
          </div>
        )}
        {toast && toast.kind === 'clipboard' && (
          <div className="toast toast-clipboard">
            <div className="toast-row">
              <span className="check">✓</span>
              <span className="toast-label">{toast.label}</span>
            </div>
            <pre className="toast-code">{toast.content}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Difficulty selector — placed next to the Copy buttons so the user picks a
 * tier first, then copies a prompt whose contents reflect that filter.
 * "all" by default; the other four are the bench's actual tiers.
 */
function PackPicker({
  pack,
  onChange,
  sizes,
}: {
  pack: 'short' | 'intermediary' | 'long';
  onChange: (p: 'short' | 'intermediary' | 'long') => void;
  sizes: { short: number; intermediary: number; long: number };
}) {
  return (
    <label
      className="btn ghost"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        cursor: 'pointer',
      }}
      title="How many challenges this run includes. Every pack mixes ~1/3 easy + 1/3 medium + 1/3 hard."
    >
      <span style={{ color: 'var(--fg-faint)', fontSize: 12 }}>Pack:</span>
      <select
        value={pack}
        onChange={(e) =>
          onChange(e.target.value as 'short' | 'intermediary' | 'long')
        }
        style={{
          background: 'transparent',
          color: 'inherit',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 13,
          cursor: 'pointer',
        }}
      >
        <option value="short">Short · {sizes.short}</option>
        <option value="intermediary">Intermediary · {sizes.intermediary}</option>
        <option value="long">Long · {sizes.long}</option>
      </select>
    </label>
  );
}

/**
 * Advanced run-constraints panel. Collapsed by default so the landing CTA
 * stays focused; opening it lets the user pin browser, tool, engine or a
 * time budget. The values are appended to the /start query string and the
 * server renders them inside the prompt as honor-system rules.
 */
function AdvancedOptions({
  display,
  setDisplay,
  tool,
  setTool,
  engine,
  setEngine,
  budget,
  setBudget,
  humanAllowed,
  setHumanAllowed,
}: {
  display: 'any' | 'headed' | 'headless';
  setDisplay: (v: 'any' | 'headed' | 'headless') => void;
  tool: 'any' | 'playwright' | 'puppeteer' | 'selenium';
  setTool: (v: 'any' | 'playwright' | 'puppeteer' | 'selenium') => void;
  engine: 'any' | 'chromium' | 'firefox' | 'webkit';
  setEngine: (v: 'any' | 'chromium' | 'firefox' | 'webkit') => void;
  budget: 0 | 5 | 10 | 30 | 60;
  setBudget: (v: 0 | 5 | 10 | 30 | 60) => void;
  humanAllowed: boolean;
  setHumanAllowed: (v: boolean) => void;
}) {
  const pinnedCount =
    (display !== 'any' ? 1 : 0) +
    (tool !== 'any' ? 1 : 0) +
    (engine !== 'any' ? 1 : 0) +
    (budget > 0 ? 1 : 0) +
    (humanAllowed ? 1 : 0);
  return (
    <details className="advanced-panel">
      <summary>
        <span>Advanced</span>
        {pinnedCount > 0 && (
          <span className="advanced-pin-count">{pinnedCount} pinned</span>
        )}
      </summary>
      <div className="advanced-grid">
        <AdvancedField label="Browser display">
          <select
            value={display}
            onChange={(e) => setDisplay(e.target.value as typeof display)}
          >
            <option value="any">Any</option>
            <option value="headed">Visible (headed)</option>
            <option value="headless">Headless</option>
          </select>
        </AdvancedField>
        <AdvancedField label="Tool">
          <select
            value={tool}
            onChange={(e) => setTool(e.target.value as typeof tool)}
          >
            <option value="any">Any</option>
            <option value="playwright">Playwright</option>
            <option value="puppeteer">Puppeteer</option>
            <option value="selenium">Selenium</option>
          </select>
        </AdvancedField>
        <AdvancedField label="Browser engine">
          <select
            value={engine}
            onChange={(e) => setEngine(e.target.value as typeof engine)}
          >
            <option value="any">Any</option>
            <option value="chromium">Chromium</option>
            <option value="firefox">Firefox</option>
            <option value="webkit">WebKit</option>
          </select>
        </AdvancedField>
        <AdvancedField label="Time budget">
          <select
            value={budget}
            onChange={(e) =>
              setBudget(parseInt(e.target.value, 10) as typeof budget)
            }
          >
            <option value={0}>Unlimited</option>
            <option value={5}>5 min</option>
            <option value={10}>10 min</option>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        </AdvancedField>
        <AdvancedField label="Human intervention">
          <select
            value={humanAllowed ? 'allowed' : 'no'}
            onChange={(e) => setHumanAllowed(e.target.value === 'allowed')}
          >
            <option value="no">Not allowed (solo run)</option>
            <option value="allowed">Allowed (co-pilot)</option>
          </select>
        </AdvancedField>
      </div>
      <p className="advanced-hint">
        Honor-system: the server passes these as constraints in the prompt;
        it doesn't enforce them. Use them to compare runs of two agents
        under identical conditions. Note: enabling "Human intervention
        allowed" marks the run as assisted — it's not directly comparable
        to a solo benchmark.
      </p>
    </details>
  );
}

function AdvancedField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="advanced-field">
      <span className="advanced-field-label">{label}</span>
      {children}
    </label>
  );
}
