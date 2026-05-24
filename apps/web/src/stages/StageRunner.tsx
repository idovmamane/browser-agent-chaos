import { useEffect, useRef, useState } from 'react';
import type {
  InteractionEvent,
  InteractionKind,
} from '@browser-agent-chaos/core';
import { FailureScreen, GoalBanner, SkippedScreen, SuccessScreen } from '../challenges/shared';
import { getSessionId } from '../lib/api';
import { DestructiveRowActionStage } from './DestructiveRowAction';
import { DestructiveFormStage } from './DestructiveForm';
import { DestructiveTableStage } from './DestructiveTable';
import { DestructiveMoveStage } from './DestructiveMove';

/**
 * Server-authoritative stage runner.
 *
 * Mount → /api/stage/:id/mount returns { mountNonce, stage: { kind, data } }.
 * The runner then renders the matching stage component (one per `kind`) and
 * gives it a single `emit(event)` hook. Every DOM interaction (click, input,
 * checkbox, radio) flows through emit → /api/stage/:id/interact.
 *
 * The runner has NO knowledge of which interaction is correct. The server's
 * checker decides outcome on each event; we just render whatever the server
 * told us (success/failure/pending).
 */
/**
 * Hook: emit behavior signals (mousemove/scroll/focus/keydown) to /api/events
 * so the server can flag interacts that arrive with no preceding human
 * activity as "suspicious". Debounced to ≤ 1 / 500ms per kind so we don't
 * flood the server.
 */
function useBehaviorSignals(sessionId: string, challengeId: string, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !sessionId) return;
    const lastSent: Record<string, number> = {};
    const fire = (kind: 'mousemove' | 'scroll' | 'focus' | 'keydown') => {
      const now = Date.now();
      if ((now - (lastSent[kind] ?? 0)) < 500) return;
      lastSent[kind] = now;
      fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          challengeId,
          event: `signal:${kind}`,
          metadata: { isTrusted: true },
        }),
      }).catch(() => {});
    };
    const onMove = (e: MouseEvent) => { if (e.isTrusted) fire('mousemove'); };
    const onScroll = () => fire('scroll');
    const onFocus = (e: FocusEvent) => { if (e.isTrusted) fire('focus'); };
    const onKey = (e: KeyboardEvent) => { if (e.isTrusted) fire('keydown'); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('scroll', onScroll, { capture: true });
    window.addEventListener('focus', onFocus, { capture: true });
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('scroll', onScroll, { capture: true } as any);
      window.removeEventListener('focus', onFocus, { capture: true } as any);
      window.removeEventListener('keydown', onKey);
    };
  }, [sessionId, challengeId, enabled]);
}

export function StageRunner({ challengeId }: { challengeId: string }) {
  const sessionId = getSessionId();
  const [mountNonce, setMountNonce] = useState<string | null>(null);
  const [mountedAt, setMountedAt] = useState<number | null>(null);
  // The server's /mount response carries the resolved stage (kind+data) and
  // the dynamic title/goal/rules (under `meta`) for this session. The static
  // frontend bundle no longer contains any per-challenge copy — every page
  // must mount before rendering. The Vite plugin strips stageFactory and the
  // resulting `stage` at build time, so client-side `challenge.stage` is
  // always undefined for v2 challenges, which is fine.
  const [stage, setStage] = useState<{ kind: string; data: any } | null>(null);
  const [resolvedMeta, setResolvedMeta] = useState<{
    title: string;
    goal: string;
    rules: string[];
  } | null>(null);
  // Hook in behavior telemetry.
  useBehaviorSignals(sessionId, challengeId, !!sessionId);
  const [outcome, setOutcome] = useState<
    | { state: 'idle' }
    | { state: 'success'; message: string }
    | { state: 'failure'; message: string }
    | { state: 'skipped'; message: string }
    | { state: 'sealed'; message: string }
  >({ state: 'idle' });
  const inFlight = useRef(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    fetch(`/api/stage/${encodeURIComponent(challengeId)}/mount`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: sessionId }),
    })
      .then((r) => r.json())
      .then((m) => {
        if (cancelled) return;
        if (m.mountNonce) {
          setMountNonce(m.mountNonce);
          setMountedAt(m.mountedAt);
          if (m.stage) setStage(m.stage);
          if (m.meta) {
            setResolvedMeta({
              title: m.meta.title,
              goal: m.meta.goal,
              rules: m.meta.rules ?? [],
            });
          }
          if (m.attempt === 'sealed') {
            const prior = (m as { outcome?: string }).outcome;
            if (prior === 'success') {
              setOutcome({
                state: 'success',
                message: 'You already passed this challenge.',
              });
            } else if (prior === 'skipped') {
              setOutcome({
                state: 'skipped',
                message: 'You already skipped this challenge.',
              });
            } else {
              setOutcome({
                state: 'sealed',
                message:
                  prior === 'failure'
                    ? 'You already failed this challenge.'
                    : 'This challenge is already sealed for this session.',
              });
            }
          }
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [sessionId, challengeId]);

  async function emit(
    target: string,
    kind: InteractionKind,
    value: string | boolean | number | undefined,
    isTrusted: boolean,
  ) {
    if (!mountNonce || inFlight.current || outcome.state !== 'idle') return;
    inFlight.current = true;
    try {
      const ev: InteractionEvent = {
        target,
        kind,
        value,
        clientTs: Date.now(),
        isTrusted,
      };
      const res = await fetch(
        `/api/stage/${encodeURIComponent(challengeId)}/interact`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session: sessionId,
            mountNonce,
            event: ev,
          }),
        },
      );
      const body = await res.json();
      if (body?.outcome === 'success') {
        setOutcome({ state: 'success', message: body.message ?? 'Success.' });
      } else if (body?.outcome === 'failure') {
        setOutcome({ state: 'failure', message: body.message ?? 'Failure.' });
      } else if (body?.outcome === 'rejected') {
        setOutcome({
          state: 'sealed',
          message: body.message ?? 'Rejected.',
        });
      }
      // outcome=pending: no state change, just keep going.
    } finally {
      inFlight.current = false;
    }
  }

  if (!mountNonce || !stage) {
    return (
      <div className="task-card">
        <p className="subtle">Loading challenge…</p>
      </div>
    );
  }

  const banner = resolvedMeta ?? { title: '', goal: '', rules: [] };

  if (outcome.state === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message={outcome.message} challengeId={challengeId} />
      </div>
    );
  }
  if (outcome.state === 'skipped') {
    return (
      <div className="task-card">
        <SkippedScreen message={outcome.message} challengeId={challengeId} />
      </div>
    );
  }
  if (outcome.state === 'failure' || outcome.state === 'sealed') {
    return (
      <>
        <GoalBanner
          title={banner.title}
          goal={banner.goal}
          rules={banner.rules}
        />
        <div className="task-card">
          <FailureScreen message={outcome.message} challengeId={challengeId} />
        </div>
      </>
    );
  }

  const Body = pickStage(stage.kind);
  return (
    <>
      <GoalBanner
        title={banner.title}
        goal={banner.goal}
        rules={banner.rules}
      />
      <div className="task-card">
        <Body
          data={stage.data}
          emit={emit}
          mountedAt={mountedAt!}
        />
      </div>
    </>
  );
}

/** Per-stage component. data + emit. */
export interface StageProps {
  data: any;
  emit: (
    target: string,
    kind: InteractionKind,
    value: string | boolean | number | undefined,
    isTrusted: boolean,
  ) => void;
  mountedAt: number;
}

function pickStage(kind: string): React.FC<StageProps> {
  switch (kind) {
    case 'destructive-row-action':
      return DestructiveRowActionStage;
    case 'destructive-form':
      return DestructiveFormStage;
    case 'destructive-table':
      return DestructiveTableStage;
    case 'destructive-move':
      return DestructiveMoveStage;
    default:
      return UnknownStage;
  }
}

function UnknownStage({ data }: StageProps) {
  return (
    <div>
      <h2>Unknown stage</h2>
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
