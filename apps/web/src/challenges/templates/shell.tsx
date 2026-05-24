import { useEffect, useState } from 'react';
import type {
  ActResponse,
  MountResponse,
  PublicAction,
} from '@browser-agent-chaos/core';
import {
  FailureScreen,
  GoalBanner,
  SkippedScreen,
  SuccessScreen,
} from '../shared';
import { api, getSessionId } from '../../lib/api';

/**
 * Server-authoritative shell.
 *
 * The component never sees `actionSpec.correct` — that's the answer key and it
 * stays on the server. On mount we POST /api/challenge/:id/mount which returns
 * opaque action tokens; on click we POST /act and let the server decide
 * outcome. The component cannot lie, and an agent reading the bundle learns
 * nothing more than an agent reading the rendered DOM.
 */
export function TemplateRunner({
  challengeId,
  renderScenery,
}: {
  challengeId: string;
  /** Render the per-template scenery from the templateData fetched server-side at mount. */
  renderScenery: (templateData: Record<string, unknown>) => React.ReactNode;
}) {
  const sessionId = getSessionId();
  const [mount, setMount] = useState<MountResponse | null>(null);
  const [acting, setActing] = useState(false);
  const [outcome, setOutcome] = useState<ActResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    api
      .mount(sessionId, challengeId)
      .then((m) => {
        if (cancelled) return;
        setMount(m);
        // Pre-existing seal (page reload after a completed attempt).
        if (m.attempt === 'sealed') {
          setOutcome({
            ok: false,
            outcome: 'rejected',
            sealed: true,
            message:
              'This challenge is already sealed for this session. ' +
              'Each task allows exactly one attempt.',
            rejectedReason: 'sealed',
          });
        }
      })
      .catch((e) => {
        if (cancelled) return;
        setError(String(e.message ?? e));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, challengeId]);

  async function pickAction(
    action: PublicAction,
    isTrusted: boolean,
  ): Promise<void> {
    if (!mount || acting) return;
    setActing(true);
    try {
      const res = await api.act(challengeId, {
        session: sessionId,
        token: action.token,
        mountNonce: mount.mountNonce,
        isTrusted,
        clientTs: Date.now(),
      });
      setOutcome(res);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setActing(false);
    }
  }

  // Render: header + scenery + buttons + status.
  if (error) {
    return (
      <div className="task-card" role="alert">
        <h2>Server error</h2>
        <p className="subtle">{error}</p>
      </div>
    );
  }
  if (!mount) {
    return (
      <div className="task-card">
        <p className="subtle">Loading challenge…</p>
      </div>
    );
  }

  // If success, render the SuccessScreen (server told us the message).
  if (outcome?.ok && outcome.outcome === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen
          message={
            outcome.successMessage ?? 'Server confirmed: this attempt counts as a success.'
          }
          challengeId={challengeId}
        />
      </div>
    );
  }

  // Skip is a legit terminal state — render the dedicated SkippedScreen so
  // the agent sees "30/100" framing instead of a generic "failure".
  if (outcome && outcome.outcome === 'skipped') {
    return (
      <div className="task-card">
        <SkippedScreen message={outcome.message} challengeId={challengeId} />
      </div>
    );
  }
  // Sealed reload: the mount returns sealed with a prior outcome — show the
  // right screen rather than dumping the user back into the scenery.
  if (mount.attempt === 'sealed') {
    const prior = (mount as unknown as { outcome?: string }).outcome;
    const msg =
      outcome?.message ??
      'This challenge is already sealed for this session.';
    if (prior === 'skipped') {
      return (
        <div className="task-card">
          <SkippedScreen
            message="You already skipped this challenge."
            challengeId={challengeId}
          />
        </div>
      );
    }
    return (
      <div className="task-card">
        <FailureScreen message={msg} challengeId={challengeId} />
      </div>
    );
  }
  // Fresh rejection or judged failure: lock the screen, point at Next.
  if (
    outcome &&
    (outcome.outcome === 'rejected' || outcome.outcome === 'failure')
  ) {
    return (
      <div className="task-card">
        <FailureScreen message={outcome.message} challengeId={challengeId} />
      </div>
    );
  }

  const templateData = (mount.challenge?.templateData ?? {}) as Record<string, unknown>;
  const scenery = renderScenery(templateData);

  return (
    <>
      <GoalBanner
        title={mount.meta?.title ?? ''}
        goal={mount.meta?.goal ?? ''}
        rules={mount.meta?.rules ?? []}
      />
      <div className="task-card">{scenery}</div>
      <ActionButtons
        actions={mount.actions}
        disabled={acting}
        onPick={pickAction}
      />
    </>
  );
}

function ActionButtons({
  actions,
  disabled,
  onPick,
}: {
  actions: PublicAction[];
  disabled: boolean;
  onPick: (a: PublicAction, isTrusted: boolean) => void;
}) {
  return (
    <div className="task-card" style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {actions.map((a) => (
          <button
            key={a.token}
            data-testid={`action-${a.token}`}
            disabled={disabled}
            onClick={(e) => onPick(a, e.isTrusted)}
            className="button-secondary"
            style={{
              opacity: disabled ? 0.5 : 1,
              textAlign: 'left',
              padding: '12px 16px',
            }}
          >
            {a.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Tiny helper kept here so families can render arbitrary scenery sections
 * without importing extra primitives.
 */
export function ScenerySection({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      {title && (
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: '#7c5cff',
            marginBottom: 6,
          }}
        >
          {title}
        </div>
      )}
      {children}
    </div>
  );
}
