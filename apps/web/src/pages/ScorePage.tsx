import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { ChallengeResult, SessionScore } from '@browser-agent-chaos/core';
import { LogoIcon } from '../components/Logo';

export function ScorePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [score, setScore] = useState<SessionScore | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let alive = true;
    const fetchIt = async () => {
      try {
        // Raw fetch so we can distinguish 404 (preview session expired,
        // unknown id) from a real SessionScore payload. api.score swallows
        // non-500 errors and returns the JSON, which would otherwise let
        // the page render a corrupt half-state for a stale `pv_…` URL.
        const res = await fetch(`/api/score/${encodeURIComponent(sessionId)}`);
        if (res.status === 404) {
          if (alive) setErr('Session not found or expired.');
          return;
        }
        if (!res.ok) {
          if (alive) setErr(`HTTP ${res.status}`);
          return;
        }
        const s: SessionScore = await res.json();
        if (alive) {
          setScore(s);
          setErr(null);
        }
      } catch (e: any) {
        if (alive) setErr(e.message);
      }
    };
    fetchIt();
    const t = setInterval(fetchIt, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [sessionId]);

  if (err)
    return (
      <div className="bg-mesh">
        <div className="container">Error: {err}</div>
      </div>
    );
  if (!score)
    return (
      <div className="bg-mesh">
        <div className="container">
          <p className="subtle">Loading score…</p>
        </div>
      </div>
    );

  const exportUrl = `/api/export/${sessionId}.md`;

  return (
    <div className="bg-mesh">
      <div className="container">
        <div className="nav-bar">
          <Link to="/" className="brand-mark" style={{ textDecoration: 'none' }}>
            <div className="logo">
              <LogoIcon size={56} />
            </div>
            <div className="brand-text">
              <div className="brand-line1">BROWSER AGENT</div>
              <div className="brand-line2-chaos" data-text="CHAOS">CHAOS</div>
            </div>
          </Link>
          <div className="nav-links">
            <Link to="/dashboard">← Dashboard</Link>
            <a href={exportUrl} target="_blank" rel="noopener">
              Export .md
            </a>
          </div>
        </div>

        {/* "All tests completed" / progress banner. Only renders when the
            server tells us the pack size, so legacy sessions without a pack
            stay quiet. Three states: done (green), in-progress (warm yellow),
            empty (skipped). */}
        {score.packSize !== undefined && (() => {
          const total = score.packSize!;
          const done = score.attempted;
          const remaining = Math.max(0, total - done);
          const allDone = remaining === 0 && done > 0;
          const cls = allDone ? 'pf pass' : 'pf skip';
          return (
            <div
              className="all-done-banner"
              style={{
                margin: '14px 0 18px',
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-elev-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                flexWrap: 'wrap',
              }}
            >
              <span className={cls} style={{ flexShrink: 0 }}>
                {allDone ? '● all done' : `● ${done}/${total}`}
              </span>
              <span style={{ color: 'var(--fg-dim)', fontSize: 14 }}>
                {allDone
                  ? `Every challenge in the ${score.pack ?? ''} pack has a final outcome.`
                  : `${remaining} challenge${remaining === 1 ? '' : 's'} left to attempt${
                      score.pack ? ` in the ${score.pack} pack` : ''
                    }.`}
              </span>
            </div>
          );
        })()}

        <div className="score-hero">
          <div>
            <div className="score-headline">Benchmark result</div>
            <h1>
              {score.total}
              <span className="of"> / 100</span>
            </h1>
            <p className="subtle" style={{ marginTop: 4 }}>
              session <code style={{ color: 'var(--fg)' }}>{score.sessionId}</code>
              {score.agentLabel && (
                <>
                  {' · '}agent <b style={{ color: 'var(--fg)' }}>{score.agentLabel}</b>
                </>
              )}
            </p>
            <div className="stat-row">
              <div className="stat-pill">
                <div className="lbl">Passed</div>
                <div className="val">
                  {score.passed}
                  <small style={{ color: 'var(--fg-faint)', fontWeight: 500 }}>
                    {' '}
                    / {score.attempted}
                  </small>
                </div>
              </div>
              <div className="stat-pill">
                <div className="lbl">Avg total</div>
                <div className="val">{score.total}</div>
              </div>
              <div className="stat-pill">
                <div className="lbl">Started</div>
                <div className="val" style={{ fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                  {new Date(score.createdAt).toLocaleTimeString()}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
              <a className="btn primary" href={exportUrl} target="_blank" rel="noopener">
                Download report (.md)
              </a>
            </div>
          </div>
          <div
            className="score-ring"
            style={{ ['--pct' as any]: String(score.total) }}
          >
            <div className="score-num">
              {score.total}
              <small> /100</small>
            </div>
          </div>
        </div>

        <div className="section-title">
          <span>Per-challenge results</span>
          <span className="section-count">
            {score.packSize !== undefined
              ? `${score.results.length} / ${score.packSize} attempted`
              : `${score.results.length} attempted`}
          </span>
        </div>

        {score.results.length === 0 && (
          <div className="empty-state">
            No events yet — your agent hasn't reached any success screen.
            <br />
            <span className="subtle">
              Open a challenge URL with{' '}
              <code style={{ color: 'var(--fg)' }}>?session={sessionId}</code> in your agent.
            </span>
          </div>
        )}

        <div className="grid">
          {score.results.map((r) => (
            <ResultCard key={r.task} r={r} sessionId={sessionId!} />
          ))}
        </div>

        <div className="bottom-meta">
          Auto-refreshing every 3s · scores update as your agent works
        </div>
      </div>
    </div>
  );
}

function ResultCard({ r, sessionId }: { r: ChallengeResult; sessionId: string }) {
  const status: 'pass' | 'skip' | 'abandoned' | 'fail' = r.success
    ? 'pass'
    : r.skipped
      ? 'skip'
      : r.abandoned
        ? 'abandoned'
        : 'fail';
  const statusLabel = {
    pass: '● pass',
    skip: '● skipped',
    abandoned: '⊝ abandoned',
    fail: '● fail',
  }[status];
  return (
    <Link
      to={`/score/${sessionId}/${r.task}`}
      className="result-card"
      style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
    >
      <div className="rc-head">
        <h3>{r.task}</h3>
        <span className={`pf ${status}`}>{statusLabel}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="subtle">Total</span>
        <b style={{ fontSize: 20, letterSpacing: '-0.015em' }}>{r.total}/100</b>
      </div>
      <Metric label="Safety" value={r.safety} />
      <Metric label="Efficiency" value={r.efficiency} />
      <Metric label="Resilience" value={r.resilience} />
      <Metric label="Instruction" value={r.instructionFollowing} />
      <div
        style={{
          display: 'flex',
          gap: 14,
          justifyContent: 'space-between',
          fontFamily: 'var(--font-mono)',
          fontSize: 11.5,
          color: 'var(--fg-faint)',
          paddingTop: 4,
        }}
      >
        <span>{r.steps ?? 0} steps</span>
        <span>{r.durationSeconds ?? 0}s</span>
      </div>
      {r.mistakes.length > 0 && (
        <div className="subtle" style={{ marginTop: 6, fontSize: 12 }}>
          {r.mistakes.length} mistake{r.mistakes.length === 1 ? '' : 's'} — click for details
        </div>
      )}
      <div
        style={{
          marginTop: 10,
          fontSize: 11,
          color: 'var(--fg-faint)',
          letterSpacing: '0.05em',
        }}
      >
        view details →
      </div>
    </Link>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-bar">
      <div className="mb-head">
        <span>{label}</span>
        <span className="mb-val">{value}</span>
      </div>
      <div className="mb-track">
        <div className="mb-fill" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
