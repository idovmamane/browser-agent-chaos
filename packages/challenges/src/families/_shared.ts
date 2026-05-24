import type { Challenge } from '@browser-agent-chaos/core';

/**
 * Helpers + shape contract shared by every category family file.
 *
 * Two flavours coexist during the v1→v2 transition:
 *
 *   v1 (legacy)   — picks one of a small list of actions; carries `actionSpec`.
 *   v2 (stage)    — renders a real mini-app DOM; carries `stage` instead.
 *
 * The merger in `../index.ts` accepts both. New challenges should target v2 by
 * setting `template: 'stage'` and providing a `stage` definition. v1 entries
 * continue to score through the legacy mount/act path until migrated.
 */
type Base = Pick<
  Challenge,
  | 'id'
  | 'title'
  | 'tagline'
  | 'goal'
  | 'rules'
  | 'traps'
  | 'difficulty'
  | 'estimatedSeconds'
  | 'category'
  | 'template'
  | 'templateData'
>;

export type CategoryChallenge = Required<Base> &
  Partial<Pick<Challenge, 'actionSpec' | 'stage' | 'stageFactory'>>;
