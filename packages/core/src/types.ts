export type ChallengeId = string;

export type ChallengeCategory =
  | 'core'
  | 'dark-patterns'
  | 'destructive'
  | 'injection'
  | 'timing'
  | 'forms'
  | 'navigation'
  | 'modals'
  | 'payments'
  | 'accessibility';

/**
 * UI templates. Each template renders a category-appropriate fake page that
 * reads `actionSpec` and `templateData` from the challenge.
 *
 * 'bespoke' = a hand-written React component (the 10 originals).
 * The rest are category templates shared across challenges in that family;
 * per-challenge variation comes from the actionSpec payload.
 */
export type ChallengeTemplate =
  | 'bespoke'
  // v2 — real-DOM stage renderer (the future)
  | 'stage'
  | 'dark-pattern-form'
  | 'destructive-row-list'
  | 'injection-feed'
  | 'timing-action'
  | 'form-builder'
  | 'navigation-puzzle'
  | 'modal-puzzle'
  | 'payment-form'
  | 'a11y-form';

export interface Challenge {
  id: ChallengeId;
  title: string;
  tagline: string;
  goal: string;
  rules: string[];
  traps: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedSeconds: number;
  category?: ChallengeCategory;
  /** UI template + actions. Bespoke challenges use 'bespoke' and have a hand-written React component. */
  template?: ChallengeTemplate;
  /**
   * Server-side action declaration. **Never leaves the server**. The public
   * shape (`PublicChallenge`) strips this so the client can't read the answer
   * key from the bundle, the network response, or `/api/challenges`.
   */
  actionSpec?: ChallengeActionSpec;
  /** Free-form template-specific config (headline copy, fake stats, etc.). Safe to ship to the client. */
  templateData?: Record<string, unknown>;
  /**
   * v2 — real-DOM stage. When present, the challenge is rendered via the
   * stage runner (apps/web/src/stages/<kind>.tsx) and scored by a server-side
   * checker over `stage.check`. v1 `actionSpec`/`template` are ignored when
   * `stage` is set.
   *
   * For v2 the `stage` field is computed per-session by a `stageFactory`. A
   * literal `stage` is still allowed (legacy), but new challenges use the
   * factory so values, ids, and label paraphrases are randomised per session.
   */
  stage?: StageSpec;
  /**
   * Server-only. Called once per mount to produce a fresh stage with
   * session-specific seeds (values, ids, label paraphrase). Stripped from
   * the public payload exactly like actionSpec/check.
   */
  stageFactory?: (seed: number) => StageSpec;
}

/**
 * The shape the client (browser, Playwright recipe, any external caller) is
 * allowed to see. Strict whitelist — only the structural fields the renderer
 * actually needs. Title / goal / rules / tagline / traps are NOT in here:
 * they are challenge metadata served *only* via the mount response, so they
 * never end up in the static frontend bundle.
 */
export interface PublicChallenge {
  id: ChallengeId;
  difficulty: 'easy' | 'medium' | 'hard';
  estimatedSeconds: number;
  category?: ChallengeCategory;
  template?: ChallengeTemplate;
  templateData?: Record<string, unknown>;
  /** v2 stage: only kind + data; check / successMessage are server-only. */
  stage?: { kind: string; data: Record<string, unknown> };
}

/**
 * Per-action token sent down with /mount. The token is opaque to the client;
 * the server maps token → real actionId via the in-memory mount table.
 */
export interface PublicAction {
  token: string;
  label: string;
}

/**
 * Human-readable challenge metadata. Served only as part of a mount
 * response — never bundled in the static frontend JS. An agent that wants
 * to know what a challenge wants must mount it first.
 */
export interface ChallengeMeta {
  title: string;
  tagline: string;
  /** Per-session goal text. May be a dynamic per-mount string (v2 stages). */
  goal: string;
  rules: string[];
  traps: string[];
}

export interface MountResponse {
  session: string;
  challengeId: ChallengeId;
  mountNonce: string;
  /** server timestamp at mount; clients echo this on /act so the server can enforce a timing floor */
  mountedAt: number;
  actions: PublicAction[];
  attempt: 'open' | 'sealed';
  /** Structural shape only — id, template, stage.data, … No copy / no answer key. */
  challenge: PublicChallenge;
  /** Title / goal / rules / traps. Served per-mount so they stay out of the bundle. */
  meta: ChallengeMeta;
}

export interface ActRequest {
  session: string;
  /** opaque token from MountResponse.actions[*].token */
  token: string;
  /** nonce echoed from MountResponse.mountNonce */
  mountNonce: string;
  /** true if the click came from a real user gesture (event.isTrusted) */
  isTrusted: boolean;
  /** client ts when the click happened — used in --strict timing checks */
  clientTs: number;
}

export interface ActResponse {
  ok: boolean;
  outcome: 'success' | 'failure' | 'skipped' | 'noop' | 'rejected';
  /** server-side message; safe to display */
  message: string;
  /** if the run is now sealed (no further /act accepted for this challenge) */
  sealed: boolean;
  /** the success message if outcome=success, otherwise undefined */
  successMessage?: string;
  /** reason for rejection if outcome=rejected */
  rejectedReason?: string;
}

export interface ChallengeAction {
  id: string;
  label: string;
  description: string;
  kind: 'correct' | 'wrong' | 'danger' | 'skip';
  fail?: boolean;
}

export interface ChallengeActionSpec {
  /** Action shown as the "success" path. */
  correct: { id: string; label: string; successMessage: string };
  /** Other actions (distractors, dangerous ones). Skip is added automatically. */
  others: ChallengeAction[];
  /** Optional human prompt shown above the actions in the UI. */
  prompt?: string;
}

/**
 * v2 challenge contract — real DOM, not a list of action tokens.
 *
 * Each challenge ships a mini React app (the "stage"). The page emits granular
 * `interaction` events to the server as the agent manipulates it. The server
 * keeps an authoritative state machine and a checker function decides
 * outcome based on the final state, NOT on what the client claims.
 *
 * This collapses the cheat surface to "actually drive the DOM" — there is no
 * action-token, no `kind: 'correct'`, no list of valid choices. The agent
 * must find the right element on its own and interact with it correctly.
 */
export type InteractionKind =
  | 'click'         // user clicked an element with data-bac="..."
  | 'input'         // text/input/textarea value committed
  | 'check'         // checkbox toggled
  | 'select'        // <select> changed
  | 'navigate'      // route changed within the challenge stage
  | 'scroll'        // scrolled to a region marked data-bac-scroll
  | 'submit'        // a marked form was submitted
  | 'wait';         // explicit wait marker (set by the stage on timers)

export interface InteractionEvent {
  /** stable id of the element interacted with (data-bac attribute) */
  target: string;
  /** which kind of interaction */
  kind: InteractionKind;
  /** for input/select/check: the new value (sanitised) */
  value?: string | boolean | number;
  /** client timestamp; server also records its own */
  clientTs: number;
  /** event.isTrusted from the original DOM event (false ⇒ synthetic) */
  isTrusted: boolean;
}

export type StageDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

/**
 * Server-side success criteria. Each challenge declares a final-state shape
 * the server matches against the accumulated interaction history. The client
 * never sees these.
 */
export interface StageCheck {
  /** ids that MUST have been clicked at least once (in any order) */
  mustClick?: string[];
  /** ids that MUST NEVER have been clicked */
  mustNotClick?: string[];
  /** field id → expected final value */
  expectedValues?: Record<string, string | number | boolean>;
  /** ids that must be in their final checked state */
  expectedChecked?: Record<string, boolean>;
  /** minimum ms between mount and first success-trigger click (defaults to 0) */
  minDwellMs?: number;
  /** ids whose click immediately seals the challenge as failure with safety violation */
  hardDangerClick?: string[];
}

export interface StageSpec {
  /** Used by the React side to pick the stage component. */
  kind: string;
  /** Server-only success criteria. */
  check: StageCheck;
  /** Server-only message shown to the agent on success. */
  successMessage: string;
  /** Free-form scenery for the stage component (text, defaults, etc.). */
  data: Record<string, unknown>;
}

export interface Session {
  id: string;
  createdAt: number;
  agentLabel?: string;
  /** Pack the session was started with, persisted so /all re-reads return
   *  the same curated list rather than re-shuffling the whole catalogue. */
  pack?: 'short' | 'intermediary' | 'long';
}

export interface EventRecord {
  sessionId: string;
  challengeId: ChallengeId;
  event: string;
  metadata?: Record<string, unknown>;
  timestamp: number;
}

export interface ChallengeResult {
  task: ChallengeId;
  total: number;
  success: boolean;
  skipped: boolean;
  /**
   * Mounted but never produced a success/failure/skip outcome — i.e. the agent
   * opened the challenge and walked away. Counts as 0/100; distinct from
   * `success: false, skipped: false` (which used to mean "in progress" with
   * partial credit, a scoring loophole).
   */
  abandoned: boolean;
  safety: number;
  efficiency: number;
  resilience: number;
  instructionFollowing: number;
  mistakes: string[];
  startedAt?: number;
  finishedAt?: number;
  durationSeconds?: number;
  steps?: number;
  /**
   * True if at least one outcome-affecting interaction arrived with no
   * preceding human signal (mousemove/scroll/focus) inside SUSPICIOUS_WINDOW_MS.
   * Triggers a soft -10 penalty on `total` and a "suspicious" badge on the
   * score page.
   */
  suspicious?: boolean;
  /**
   * Number of /mount calls before any /interact landed. >1 hints at scout-style
   * usage (open the page, read the DOM, leave without trying). Not penalised
   * yet; surfaced so reviewers can flag.
   */
  mountCount?: number;
  /** Whether at least one /interact happened on this attempt. */
  interacted?: boolean;
}

export interface SessionScore {
  sessionId: string;
  agentLabel?: string;
  createdAt: number;
  results: ChallengeResult[];
  total: number;
  passed: number;
  attempted: number;
  /** Pack the session was started with. Surfaced so the UI can show
   *  "all done" when attempted reaches packSize. */
  pack?: 'short' | 'intermediary' | 'long';
  /** Total number of challenges expected for this run (the pack size).
   *  Undefined for legacy sessions started before the pack field was
   *  persisted. */
  packSize?: number;
}

export type ScoreEventName =
  | 'task:start'
  | 'task:success'
  | 'task:failure'
  | 'click'
  | 'navigation'
  | 'input'
  | 'mistake'
  | 'safety:violation'
  | 'resilience:passed'
  | 'instruction:followed'
  | 'instruction:violated';
