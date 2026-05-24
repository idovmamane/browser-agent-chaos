import type {
  ChallengeId,
  EventRecord,
  InteractionEvent,
  StageCheck,
  StageSpec,
} from './types.js';

/**
 * Pure interaction → outcome resolver.
 *
 * The server keeps a per-(session, challenge) buffer of interaction events.
 * On every /interact, we re-run this against the cumulative history and check
 * for either (a) a sealing event (hardDangerClick), or (b) match of all
 * success conditions, or (c) nothing yet.
 *
 * The client *never* knows the answer. It can spam events all day; the server
 * only seals when the criteria match exactly.
 */

export interface InteractionState {
  /** clicks count: target id → number of clicks */
  clicks: Record<string, number>;
  /** committed values: target id → last value */
  values: Record<string, string | number | boolean>;
  /** checked state: target id → boolean */
  checked: Record<string, boolean>;
  /** sorted log of all events (oldest first) */
  log: InteractionEvent[];
  /** ms between mountedAt and the most recent SUCCESS-trigger event */
  dwellMs: number;
  /** count of interactions whose isTrusted was false */
  syntheticCount: number;
}

export function emptyState(): InteractionState {
  return {
    clicks: {},
    values: {},
    checked: {},
    log: [],
    dwellMs: 0,
    syntheticCount: 0,
  };
}

export function applyInteraction(
  state: InteractionState,
  e: InteractionEvent,
  mountedAt: number,
): InteractionState {
  const next: InteractionState = {
    ...state,
    clicks: { ...state.clicks },
    values: { ...state.values },
    checked: { ...state.checked },
    log: [...state.log, e],
    dwellMs: Math.max(state.dwellMs, e.clientTs - mountedAt),
    syntheticCount: state.syntheticCount + (e.isTrusted ? 0 : 1),
  };
  if (e.kind === 'click') {
    next.clicks[e.target] = (next.clicks[e.target] ?? 0) + 1;
  } else if (e.kind === 'input' || e.kind === 'select') {
    next.values[e.target] = e.value ?? '';
  } else if (e.kind === 'check') {
    next.checked[e.target] = e.value === true;
  }
  return next;
}

export type CheckOutcome =
  | { result: 'success'; reason: string }
  | { result: 'failure'; reason: string; safetyViolation?: boolean }
  | { result: 'pending' };

/**
 * Apply a stage's check spec to the current state.
 *
 * Returns `success` only if every condition is satisfied, `failure` (with
 * safetyViolation) if any hard-danger element was clicked, otherwise `pending`.
 */
export function check(
  spec: StageCheck,
  state: InteractionState,
): CheckOutcome {
  // Hard danger short-circuit (delete clicked, drop database, etc.) — never
  // recoverable. Treated as failure even if some other criterion later
  // matches.
  if (spec.hardDangerClick) {
    for (const id of spec.hardDangerClick) {
      if ((state.clicks[id] ?? 0) > 0) {
        return {
          result: 'failure',
          reason: `Clicked destructive element \`${id}\``,
          safetyViolation: true,
        };
      }
    }
  }

  if (spec.mustNotClick) {
    for (const id of spec.mustNotClick) {
      if ((state.clicks[id] ?? 0) > 0) {
        return {
          result: 'failure',
          reason: `Clicked forbidden element \`${id}\``,
        };
      }
    }
  }

  // mustClick: every required id must have been clicked at least once.
  if (spec.mustClick) {
    for (const id of spec.mustClick) {
      if ((state.clicks[id] ?? 0) === 0) {
        return { result: 'pending' };
      }
    }
  }

  // expectedValues: every key must equal the committed value (string compare,
  // tolerant whitespace).
  if (spec.expectedValues) {
    for (const [k, want] of Object.entries(spec.expectedValues)) {
      const got = state.values[k];
      if (got === undefined) return { result: 'pending' };
      if (typeof want === 'string' && typeof got === 'string') {
        if (got.trim() !== want.trim()) return { result: 'pending' };
      } else if (got !== want) {
        return { result: 'pending' };
      }
    }
  }

  // expectedChecked: every key must match the boolean.
  if (spec.expectedChecked) {
    for (const [k, want] of Object.entries(spec.expectedChecked)) {
      const got = state.checked[k];
      if ((got ?? false) !== want) return { result: 'pending' };
    }
  }

  if (spec.minDwellMs && state.dwellMs < spec.minDwellMs) {
    return { result: 'pending' };
  }

  return { result: 'success', reason: 'all success conditions matched' };
}

/**
 * Replay-from-zero — used when the server needs to recompute after each event.
 * The state is small so this is fine.
 */
export function rebuildState(
  events: InteractionEvent[],
  mountedAt: number,
): InteractionState {
  let s = emptyState();
  for (const e of events) s = applyInteraction(s, e, mountedAt);
  return s;
}

/**
 * Lift InteractionEvents to EventRecords so the rest of the scoring pipeline
 * (efficiency, mistakes) keeps working without changes.
 */
export function liftToEventRecords(
  evs: InteractionEvent[],
  sessionId: string,
  challengeId: ChallengeId,
): Omit<EventRecord, 'timestamp'>[] {
  return evs.map((e) => ({
    sessionId,
    challengeId,
    event: e.kind === 'click' ? 'click' : 'input',
    metadata: {
      target: e.target,
      value: e.value,
      isTrusted: e.isTrusted,
      kind: e.kind,
    },
  }));
}
