#!/usr/bin/env node
/**
 * Generate a static JSON dataset used by the GitHub Pages site to mock
 * the server's read-only endpoints (admin sessions, score pages, /all).
 *
 * Output: apps/web/public/static-dataset.json
 *
 * Pure JSON, no encryption, no secrets — only mock agent runs.
 */
import { writeFileSync, readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'apps/web/public/static-dataset.json');

function nanoid(n = 10) {
  return randomBytes(n).toString('base64url').slice(0, n);
}

// We dynamically read the challenges to use real IDs + difficulty
const challengesModule = await import(path.join(root, 'packages/challenges/dist/index.js'));
const allChallenges = challengesModule.challenges || challengesModule.default || [];
const challengeIds = allChallenges.map((c) => ({ id: c.id, difficulty: c.difficulty ?? 'medium' }));
console.log(`Loaded ${challengeIds.length} challenges`);

// Bake the full per-challenge data the demo needs. On the live server these
// fields are stripped from the static bundle (anti-cheat). On the static demo
// there's no scoring to defend against — we want pixel-parity with the dev
// site, so we ship the copy + actionSpec + a pre-resolved stage.
const demoChallenges = allChallenges.map((c) => {
  // Stage challenges: pre-resolve the stage once with a deterministic seed so
  // every static-demo visitor sees the same DOM. The mock won't have a real
  // (sessionId, challengeId) seed pair to derive a per-session stage from.
  let resolvedStage = null;
  if (c.stage || c.stageFactory) {
    try {
      const seed = 0xC0DE; // deterministic across all demo visitors
      const s = c.stageFactory ? c.stageFactory(seed) : c.stage;
      resolvedStage = {
        kind: s.kind,
        data: s.data,
        check: s.check,
        successMessage: s.successMessage,
      };
    } catch (err) {
      console.warn(`stageFactory failed for ${c.id}:`, err.message);
    }
  }
  return {
    id: c.id,
    title: c.title,
    tagline: c.tagline,
    goal: c.goal,
    rules: c.rules ?? [],
    traps: c.traps ?? [],
    difficulty: c.difficulty ?? 'medium',
    estimatedSeconds: c.estimatedSeconds ?? 30,
    category: c.category ?? 'core',
    template: c.template ?? (resolvedStage ? 'stage' : 'bespoke'),
    templateData: c.templateData ?? null,
    actionSpec: c.actionSpec ?? null,
    stage: resolvedStage,
  };
});

const AGENT_PROFILES = [
  { label: 'claude-sonnet-4', tier: 'top', count: 3 },
  { label: 'claude-opus-4',   tier: 'top', count: 2 },
  { label: 'gpt-5',           tier: 'top', count: 2 },
  { label: 'gpt-5-mini',      tier: 'mid', count: 3 },
  { label: 'gemini-2.5-pro',  tier: 'mid', count: 2 },
  { label: 'browser-use-0.4', tier: 'mid', count: 2 },
  { label: 'playwright-agent',tier: 'low', count: 2 },
  { label: 'gpt-4o-mini',     tier: 'low', count: 2 },
  { label: 'naive-baseline',  tier: 'low', count: 2 },
];

const TIER_OUTCOMES = {
  top: [0.62, 0.18, 0.15, 0.05], // pass, fail, skip, abandon
  mid: [0.32, 0.32, 0.28, 0.08],
  low: [0.10, 0.38, 0.35, 0.17],
};

function weightedPick(weights) {
  const r = Math.random();
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i];
    if (r <= acc) return i;
  }
  return weights.length - 1;
}

function pickN(arr, n) {
  const a = [...arr];
  const out = [];
  for (let i = 0; i < n && a.length; i++) {
    const idx = Math.floor(Math.random() * a.length);
    out.push(a.splice(idx, 1)[0]);
  }
  return out;
}

// Build a complete pre-computed dataset:
// sessions: [{id, agentLabel, createdAt, lastActivity, ..., results: [...]}]
// Each session has its full per-challenge results so the score page works.

const now = Date.now();
const DAY = 24 * 60 * 60 * 1000;
const sessions = [];

for (const profile of AGENT_PROFILES) {
  for (let i = 0; i < profile.count; i++) {
    const id = nanoid(10);
    const daysAgo = Math.floor(Math.pow(Math.random(), 1.6) * 30);
    const createdAt = now - daysAgo * DAY - Math.random() * 12 * 60 * 60 * 1000;
    const challengesAttempted = pickN(
      challengeIds,
      15 + Math.floor(Math.random() * 25),
    );

    let cursor = createdAt;
    const results = [];
    const recent = [];

    for (const { id: cid, difficulty } of challengesAttempted) {
      const outcomeIdx = weightedPick(TIER_OUTCOMES[profile.tier]);
      const outcome = ['success', 'failure', 'skipped', 'abandoned'][outcomeIdx];
      const stepCount = outcome === 'abandoned' ? 0 : 2 + Math.floor(Math.random() * 8);
      const durationSeconds = stepCount === 0 ? 0 : 3 + Math.floor(Math.random() * 60);
      cursor += 1500 + Math.random() * 4000;
      const startedAt = cursor;
      cursor += durationSeconds * 1000;
      const finishedAt = cursor;

      const safetyViolations = (profile.tier !== 'top' && Math.random() < 0.18) ? 1 : 0;
      const mistakes = [];
      if (Math.random() < 0.22) {
        mistakes.push(outcome === 'success' ? 'Took the long way' : 'Trapped by hidden-fee modal');
      }
      const safety = Math.max(0, 100 - safetyViolations * 25);
      const efficiency = stepCount > 5 ? Math.max(20, 100 - (stepCount - 5) * 12) : 100;
      const resilience = outcome === 'failure' ? 60 : 100;
      const instructionFollowing = outcome === 'failure' ? 70 : 100;

      let total;
      if (outcome === 'success') {
        total = Math.round(100 * 0.5 + safety * 0.2 + efficiency * 0.1 + resilience * 0.1 + instructionFollowing * 0.1);
      } else if (outcome === 'skipped') {
        total = safetyViolations > 0 ? 5 : 30;
      } else {
        total = 0;
      }

      results.push({
        task: cid,
        total,
        success: outcome === 'success',
        skipped: outcome === 'skipped',
        abandoned: outcome === 'abandoned',
        safety,
        efficiency,
        resilience,
        instructionFollowing,
        mistakes,
        startedAt,
        finishedAt,
        durationSeconds,
        steps: stepCount,
        suspicious: false,
        mountCount: 1,
        interacted: outcome !== 'abandoned',
      });
      if (recent.length < 10) {
        recent.unshift({
          challengeId: cid,
          event: outcome === 'success' ? 'task:success' : outcome === 'failure' ? 'task:failure' : outcome === 'skipped' ? 'task:skip' : 'task:start',
          timestamp: finishedAt,
        });
      }
    }

    // Per-session summary (matches /api/admin/sessions output shape)
    const passed = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success && !r.skipped && !r.abandoned).length;
    const skipped = results.filter((r) => r.skipped).length;
    const avg = results.length
      ? Math.round(results.reduce((s, r) => s + r.total, 0) / results.length)
      : 0;
    const byTier = { easy: { pass: 0, fail: 0, skip: 0 }, medium: { pass: 0, fail: 0, skip: 0 }, hard: { pass: 0, fail: 0, skip: 0 } };
    for (const r of results) {
      const ch = challengeIds.find((c) => c.id === r.task);
      const bucket = byTier[ch?.difficulty ?? 'medium'] ?? byTier.medium;
      if (r.success) bucket.pass++;
      else if (r.skipped) bucket.skip++;
      else bucket.fail++;
    }
    const lastActivity = results.length ? Math.max(...results.map((r) => r.finishedAt ?? createdAt)) : createdAt;
    sessions.push({
      id,
      agentLabel: profile.label,
      createdAt,
      lastActivity,
      durationSeconds: Math.round((lastActivity - createdAt) / 1000),
      attempted: results.length,
      passed,
      failed,
      skipped,
      suspicious: 0,
      avg,
      totalMounts: results.length,
      mountsWithoutInteract: results.filter((r) => !r.interacted).length,
      byTier,
      recent,
      results, // full per-challenge breakdown for the score page
    });
  }
}

sessions.sort((a, b) => b.lastActivity - a.lastActivity);

// Catalogue entries the SPA renders in the landing-page grid.
// Same shape as the server's /api/challenges response (no answer keys).
const catalogue = allChallenges.map((c) => ({
  id: c.id,
  category: c.category ?? 'core',
  difficulty: c.difficulty ?? 'medium',
  template: c.template ?? (c.stage || c.stageFactory ? 'stage' : 'bespoke'),
  estimatedSeconds: c.estimatedSeconds ?? 30,
}));

const dataset = {
  generatedAt: now,
  packSizes: {
    short: Math.round(challengeIds.length / 3),
    intermediary: Math.round(challengeIds.length * 2 / 3),
    long: challengeIds.length,
  },
  catalogue,
  // Full per-challenge data used by the client-side mock server. Includes
  // copy (title/goal/rules/traps), actionSpec, templateData, and a
  // pre-resolved stage spec for v2 challenges. NOT shipped by the real
  // server — only the static demo carries this.
  challenges: demoChallenges,
  sessions,
};

writeFileSync(out, JSON.stringify(dataset));
console.log(`Wrote ${out} (${sessions.length} sessions, ${(JSON.stringify(dataset).length / 1024).toFixed(1)} KB)`);
