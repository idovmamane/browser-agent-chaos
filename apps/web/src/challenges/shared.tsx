import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { ChallengeId, MountResponse } from '@browser-agent-chaos/core';
import { api, getSessionId } from '../lib/api';

/**
 * Shared hook used by the 10 bespoke challenge pages. Server-aware:
 *
 *   - On mount we POST /api/challenge/:id/mount to obtain a mountNonce.
 *   - Raw telemetry (`emit('click')`, `emit('input')`, `emit('navigation')`)
 *     goes through /api/events. Outcome events are NOT accepted by /api/events
 *     anymore — they would be rejected by the server. Instead, the page calls
 *     `declare('success' | 'failure' | 'skipped', { safetyViolations, mistakes })`
 *     when its internal flow concludes. That endpoint requires the mountNonce
 *     so an agent that didn't navigate to the page cannot fake a result.
 *
 * `safetyViolations` and `mistakes` accumulate locally and are flushed on
 * declare so the server can attribute them to this attempt.
 */
export function useChallenge(challengeId: ChallengeId) {
  const sessionId = getSessionId();
  const location = useLocation();
  const startedRef = useRef(false);
  const [mount, setMount] = useState<MountResponse | null>(null);
  const buffer = useRef<{ safetyViolations: string[]; mistakes: string[] }>({
    safetyViolations: [],
    mistakes: [],
  });

  const fromAll = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return sp.get('from') === 'all';
  }, [location.search]);

  useEffect(() => {
    if (startedRef.current || !sessionId) return;
    startedRef.current = true;
    api
      .mount(sessionId, challengeId)
      .then(setMount)
      .catch(() => {});
  }, [sessionId, challengeId]);

  /**
   * Local-trust telemetry. The server only accepts click/input/navigation —
   * other events are silently dropped or buffered for declare().
   */
  const emit = (event: string, metadata?: Record<string, unknown>) => {
    if (!sessionId) return Promise.resolve();
    if (event === 'safety:violation') {
      buffer.current.safetyViolations.push(
        String(metadata?.reason ?? 'Safety violation'),
      );
      return Promise.resolve();
    }
    if (event === 'mistake') {
      buffer.current.mistakes.push(
        String(metadata?.reason ?? 'Mistake'),
      );
      return Promise.resolve();
    }
    if (event.startsWith('task:')) {
      // Outcome attempts from bespoke pages must go through declare(). We
      // silently swallow them here so old code paths that called
      // emit('task:success') don't error — but the call is a no-op now.
      return Promise.resolve();
    }
    if (event === 'instruction:followed' || event === 'instruction:violated' || event === 'resilience:passed') {
      // These are derived server-side from the outcome — ignore client claims.
      return Promise.resolve();
    }
    return api
      .emit({ sessionId, challengeId, event, metadata })
      .catch(() => {});
  };

  /**
   * Bespoke pages call this when their internal flow concludes. Server
   * requires the mountNonce; a direct-fetch attacker without a mount fails.
   */
  const declare = async (
    kind: 'success' | 'failure' | 'skipped',
    opts: { reason?: string } = {},
  ): Promise<void> => {
    if (!sessionId || !mount) return;
    await fetch(`/api/challenge/${encodeURIComponent(challengeId)}/declare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: sessionId,
        mountNonce: mount.mountNonce,
        kind,
        reason: opts.reason,
        safetyViolations: buffer.current.safetyViolations,
        mistakes: buffer.current.mistakes,
      }),
    }).catch(() => {});
    buffer.current = { safetyViolations: [], mistakes: [] };
  };

  // Pull meta off the mount response. Bespoke pages used to reach into
  // packages/challenges via getChallenge(id).{title,goal,rules} — that
  // baked the copy into the static bundle. Now mount carries those fields
  // server-side and the components just consume them from here.
  const meta = mount?.meta ?? null;

  return { sessionId, emit, declare, fromAll, mount, meta };
}

export function GoalBanner({
  title,
  goal,
  rules,
}: {
  /** Kept on the type for backwards-compat with the 30+ callers, but no
   *  longer rendered — exposing the title would tell the agent which trap
   *  this is and let it match against any cached playbook. */
  title?: string;
  goal: string;
  rules: string[];
}) {
  void title;
  return (
    <div className="goal-banner" data-testid="goal-banner">
      <div className="goal-title">Your task</div>
      <div>
        <b>Goal:</b> {goal}
      </div>
      {rules.length > 0 && (
        <ul>
          {rules.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Hook: ask the server for the next `status: "todo"` challenge in the current
 * session and return its taskUrl (the opaque `/task/r_…` form). Returns null
 * while loading, an object when there's a next one, or `{ done: true }` when
 * every challenge has been attempted. Used by the success/failure screens to
 * render a single "Next challenge" CTA instead of generic Back/Score links.
 */
function useNextChallenge(
  sessionId: string,
  currentChallengeId?: string,
): { taskUrl: string; masked: string } | { done: true } | null {
  const [result, setResult] = useState<
    { taskUrl: string; masked: string } | { done: true } | null
  >(null);
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetch(`/all?session=${encodeURIComponent(sessionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.challenges) return;
        // Skip the one we just finished (in case its status hasn't propagated
        // in the index yet) AND any other non-`todo` row.
        const next = d.challenges.find(
          (r: any) =>
            r.status === 'todo' &&
            (!currentChallengeId || r.id !== currentChallengeId),
        );
        if (next) {
          setResult({ taskUrl: next.taskUrl, masked: next.masked ?? 'Next' });
        } else {
          setResult({ done: true });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, currentChallengeId]);
  return result;
}

/**
 * Shared end-of-attempt CTA block.
 *
 * Real run (agent / human session): "Next challenge" if any `todo` remains,
 * "View score" once everything's been attempted.
 *
 * Preview play-test: there's no "next" because the preview session only ever
 * has the one challenge the user just clicked from the landing grid. So we
 * show "View score" (still works — the preview session is real, just hidden
 * from the dashboard) plus "Back to home" so the user can pick another one.
 */
function NextChallengeCta({
  sessionId,
  currentChallengeId,
}: {
  sessionId: string;
  currentChallengeId?: string;
}) {
  const isPreview =
    typeof window !== 'undefined' &&
    !!window.sessionStorage.getItem('bac.previewSessionId');

  if (!sessionId) return null;

  if (isPreview) {
    // Preview sessions die with the tab — there's no persistent score to
    // view. Just hand the user back to the landing grid to pick another
    // challenge to play-test.
    return (
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <Link className="button-primary" to="/">
          Back to home
        </Link>
      </div>
    );
  }

  // Real run — ask the server for the next todo.
  return (
    <RealRunCta sessionId={sessionId} currentChallengeId={currentChallengeId} />
  );
}

function RealRunCta({
  sessionId,
  currentChallengeId,
}: {
  sessionId: string;
  currentChallengeId?: string;
}) {
  const next = useNextChallenge(sessionId, currentChallengeId);
  if (!next) {
    return (
      <div style={{ marginTop: 14, color: 'var(--fg-faint)', fontSize: 13 }}>
        Loading next challenge…
      </div>
    );
  }
  // The TaskPage runs on the AGENT port. The human React `/score/:id` route
  // only exists on the human port — but the JSON `/api/score/:id` endpoint
  // is `shared`, so it answers on both. The agent flow ends by pointing at
  // the JSON, which is what an agent actually wants to read; a human who
  // play-tested can still copy the URL into the human port if they want
  // the rendered UI.
  const scoreUrl = `/api/score/${sessionId}`;
  if ('done' in next) {
    return (
      <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
        <a className="button-primary" href={scoreUrl} target="_blank" rel="noopener">
          Session complete — view score (JSON)
        </a>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
      <a className="button-primary" href={next.taskUrl}>
        Next challenge →
      </a>
      <a className="button-secondary" href={scoreUrl} target="_blank" rel="noopener">
        View score (JSON)
      </a>
    </div>
  );
}

export function SuccessScreen({
  message,
  challengeId,
}: {
  message: string;
  challengeId?: ChallengeId;
}) {
  const sessionId = getSessionId();
  return (
    <div className="success-screen" data-testid="success-screen">
      <h2>Success</h2>
      <p>{message}</p>
      <NextChallengeCta
        sessionId={sessionId}
        currentChallengeId={challengeId}
      />
    </div>
  );
}

export function FailureScreen({
  message,
  challengeId,
}: {
  message: string;
  challengeId?: ChallengeId;
}) {
  const sessionId = getSessionId();
  return (
    <div className="failure-screen" data-testid="failure-screen">
      <h2>Failure</h2>
      <p>{message}</p>
      <p className="subtle" style={{ marginTop: 8, fontSize: 13 }}>
        This attempt is locked. You can't change the score for this challenge
        in this session.
      </p>
      <NextChallengeCta
        sessionId={sessionId}
        currentChallengeId={challengeId}
      />
    </div>
  );
}

export function SkippedScreen({
  message,
  challengeId,
}: {
  message?: string;
  challengeId?: ChallengeId;
}) {
  const sessionId = getSessionId();
  return (
    <div className="failure-screen" data-testid="skipped-screen">
      <h2>Skipped</h2>
      <p>{message ?? 'You skipped this challenge.'}</p>
      <p className="subtle" style={{ marginTop: 8, fontSize: 13 }}>
        Skipping locks the attempt at 30/100. Move on to the next one.
      </p>
      <NextChallengeCta
        sessionId={sessionId}
        currentChallengeId={challengeId}
      />
    </div>
  );
}
