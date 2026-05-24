import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, setSessionId } from '../lib/api';
import { resolveChallengeComponent } from '../challenges/registry';
import { TemplateChallenge } from '../challenges/templates/families';
import { StageRunner } from '../stages/StageRunner';
import { LogoIcon } from '../components/Logo';

type ResolvedTemplate = 'bespoke' | 'stage' | string;

/**
 * TaskPage receives an opaque task token in the URL (`/task/r_<…>`). It
 * cannot read the challenge or session from the URL itself — both are
 * resolved server-side via GET /api/resolve/:token. This is what keeps the
 * slug out of every URL the agent ever sees, and what prevents cross-session
 * URL reuse.
 *
 *  /task/r_aaa  (token from session A)
 *    → /api/resolve/r_aaa → { sessionId: A, challengeId: 'drop-database', audience: 'agent' }
 *    → setSessionId(A), render the matching component for 'drop-database'.
 *
 *  /task/r_bbb (token from a *different* session) opened in the same tab:
 *    → /api/resolve/r_bbb → { sessionId: B, ... } → setSessionId(B).
 *  Two browser tabs on different tokens stay isolated thanks to React state
 *  + each component's own use of setSessionId at mount.
 */
export function TaskPage() {
  const { token } = useParams<{ token: string }>();
  const [resolution, setResolution] = useState<
    | { state: 'loading' }
    | { state: 'unknown' }
    | {
        state: 'ready';
        sessionId: string;
        challengeId: string;
        audience: 'agent' | 'preview';
        template: ResolvedTemplate;
      }
  >({ state: 'loading' });

  // For bespoke challenges, we pre-fetch the mount state at the page level so
  // we can show a clear "Already attempted" screen when the server has sealed
  // the attempt — instead of letting the user click through and discover it
  // through a useless "Failure / Try again" loop.
  const [sealedOutcome, setSealedOutcome] = useState<
    'success' | 'failure' | 'skipped' | null
  >(null);

  // 1) Resolve the token. The server tells us which session and which
  // challenge it points to.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetch(`/api/resolve/${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (!d || !d.sessionId || !d.challengeId) {
          setResolution({ state: 'unknown' });
          return;
        }
        // Preview tokens are throwaway: park their session id in
        // sessionStorage (tab-scoped) so it doesn't overwrite the real
        // sessionId in localStorage. Real (agent / human) tokens persist
        // normally.
        if (d.audience === 'preview') {
          window.sessionStorage.setItem('bac.previewSessionId', d.sessionId);
        } else {
          setSessionId(d.sessionId);
          window.sessionStorage.removeItem('bac.previewSessionId');
        }
        setResolution({
          state: 'ready',
          sessionId: d.sessionId,
          challengeId: d.challengeId,
          audience: d.audience,
          template: d.template ?? 'bespoke',
        });
      })
      .catch(() => {
        if (!cancelled) setResolution({ state: 'unknown' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  // 2) Bespoke-only: detect already-sealed attempts.
  useEffect(() => {
    if (resolution.state !== 'ready') return;
    if (resolution.template !== 'bespoke') return;
    let cancelled = false;
    api
      .mount(resolution.sessionId, resolution.challengeId)
      .then((m) => {
        if (cancelled) return;
        if (m.attempt === 'sealed') {
          const o = (m as unknown as { outcome?: string }).outcome;
          if (o === 'success' || o === 'failure' || o === 'skipped') {
            setSealedOutcome(o);
          } else {
            setSealedOutcome('failure');
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [resolution]);

  if (resolution.state === 'loading') {
    return (
      <div className="task-shell">
        <div className="task-body">
          <p className="subtle">Loading challenge…</p>
        </div>
      </div>
    );
  }
  if (resolution.state === 'unknown') {
    return (
      <div className="task-shell">
        <div className="task-body">
          <h1>Unknown task URL</h1>
          <p className="subtle">
            This task token isn't valid for this server, or you're trying to
            open it on the wrong port. Tokens are bound to a single session
            and a single port — they can't be shared across sessions.
          </p>
          <Link to="/">Back home</Link>
        </div>
      </div>
    );
  }

  const { sessionId, challengeId, template } = resolution;
  const Component = resolveChallengeComponent(challengeId);

  return (
    <div className="task-shell">
      <div className="nav">
        <Link to="/" className="brand" style={{ textDecoration: 'none' }}>
          <span className="logo">
            <LogoIcon size={26} />
          </span>
        </Link>
        {!sealedOutcome && token && (
          <SkipTaskButton token={token} sessionId={sessionId} />
        )}
      </div>
      <div className="task-body">
        {sealedOutcome ? (
          <AlreadyAttempted outcome={sealedOutcome} sessionId={sessionId} />
        ) : Component ? (
          <Component />
        ) : template === 'stage' ? (
          <StageRunner challengeId={challengeId} />
        ) : template && template !== 'bespoke' ? (
          <TemplateChallenge challengeId={challengeId} template={template} />
        ) : (
          <UnknownTemplate id={challengeId} />
        )}
      </div>
    </div>
  );
}

/**
 * Always-on "Skip challenge" affordance in the task nav. Works for every
 * template (bespoke / v1 / v2) because it goes through /api/skip/:token,
 * which the server resolves to (session, challenge) regardless of how the
 * page is rendered. After the call, we hard-reload so the page picks up the
 * sealed-with-outcome:'skipped' mount and renders the SkippedScreen with
 * the standard Next-challenge CTA.
 */
/**
 * Skip is a benchmark-level action — not a challenge action. We keep it in
 * the top-right of the page chrome (the sticky `.task-nav-meta` block) and
 * style it as a muted, monospaced badge so an agent looking at "what
 * buttons does this page have" can't mistake it for part of the test.
 */
function SkipTaskButton({
  token,
  sessionId,
}: {
  token: string;
  sessionId: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div
      className="task-nav-meta"
      style={{
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}
    >
      <span
        style={{
          fontSize: 9,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: '#9aa0ae',
          fontFamily: 'var(--font-mono)',
        }}
      >
        benchmark
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            // Skip first, then ask the server which row is next so the user
            // jumps directly to it instead of landing on a "Skipped" screen
            // with a manual Next button.
            await fetch(`/api/skip/${encodeURIComponent(token)}`).catch(() => {});
            try {
              const r = await fetch(
                `/all?session=${encodeURIComponent(sessionId)}`,
              );
              if (r.ok) {
                const d = await r.json();
                const next = (d.challenges ?? []).find(
                  (row: { status: string; id: string; taskUrl: string }) =>
                    row.status === 'todo' && row.id !== token,
                );
                if (next?.taskUrl) {
                  window.location.href = next.taskUrl;
                  return;
                }
                // Nothing left to do — drop the user on the score endpoint.
                window.location.href = `/api/score/${encodeURIComponent(sessionId)}`;
                return;
              }
            } catch {
              /* fall through to reload */
            }
            window.location.reload();
          } finally {
            // (we only get here on the reload path)
          }
        }}
        title="Skip this challenge — counts as 30/100 and locks the attempt for this session."
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.04em',
          padding: '5px 10px',
          color: '#5a6478',
          background: 'rgba(20, 30, 50, 0.04)',
          border: '1px solid rgba(20, 30, 50, 0.1)',
          borderRadius: 6,
          cursor: busy ? 'not-allowed' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Skipping…' : 'Skip challenge'}
      </button>
    </div>
  );
}

function UnknownTemplate({ id }: { id: string }) {
  return (
    <div className="task-card">
      <h2>Missing template</h2>
      <p className="subtle">
        Challenge <code>{id}</code> has no actionSpec yet. This is a bug — the
        challenge was registered but its family data wasn't loaded.
      </p>
    </div>
  );
}

function AlreadyAttempted({
  outcome,
  sessionId,
}: {
  outcome: 'success' | 'failure' | 'skipped';
  sessionId: string;
}) {
  const label = {
    success: 'You already passed this challenge.',
    failure: 'You already failed this challenge.',
    skipped: 'You already skipped this challenge.',
  }[outcome];
  const color =
    outcome === 'success'
      ? 'var(--success)'
      : outcome === 'failure'
        ? 'var(--danger)'
        : 'var(--warn)';
  return (
    <div className="task-card" data-testid="already-attempted">
      <h2 style={{ color }}>Attempt sealed</h2>
      <p>{label}</p>
      <p className="subtle" style={{ marginTop: 6, fontSize: 13 }}>
        Each challenge gets one attempt per session. The result is locked —
        reloading or re-mounting won't reset it. This is how Browser Agent
        Chaos prevents agents from grinding the same task to bump their score.
      </p>
      <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        {sessionId && (
          <Link className="button-secondary" to={`/score/${sessionId}`}>
            View score
          </Link>
        )}
        <Link className="button-secondary" to="/">
          Back home
        </Link>
      </div>
    </div>
  );
}
