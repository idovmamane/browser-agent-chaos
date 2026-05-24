import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { LogoIcon } from '../components/Logo';

interface DashboardSession {
  id: string;
  agentLabel?: string;
  createdAt: number;
  lastActivity: number;
  durationSeconds: number;
  attempted: number;
  passed: number;
  failed: number;
  skipped: number;
  suspicious: number;
  avg: number;
  totalMounts: number;
  mountsWithoutInteract: number;
  byTier: Record<string, { pass: number; fail: number; skip: number }>;
  recent: Array<{
    challengeId: string;
    event: string;
    timestamp: number;
    metadata?: any;
  }>;
}

const VIEW_STORAGE_KEY = 'bac.dashboard.view';
type DashboardView = 'cards' | 'table';

export function DashboardPage() {
  const [sessions, setSessions] = useState<DashboardSession[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [now, setNow] = useState<number>(() => Date.now());
  const [view, setView] = useState<DashboardView>(() => {
    if (typeof window === 'undefined') return 'cards';
    return window.localStorage.getItem(VIEW_STORAGE_KEY) === 'table' ? 'table' : 'cards';
  });
  // Bulk-selection (table view only). Keep IDs in a Set so add/remove is O(1)
  // and the React diff is small. Cleared on view-switch.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(VIEW_STORAGE_KEY, view);
    }
    // Switching views drops the selection — selection is a table-only concept.
    if (view === 'cards') setSelected(new Set());
  }, [view]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let alive = true;
    const fetchIt = () =>
      fetch('/api/admin/sessions')
        .then(async (r) => {
          if (!r.ok) {
            if (alive) setError(`HTTP ${r.status}`);
            return null;
          }
          return r.json();
        })
        .then((d) => {
          if (!alive || !d) return;
          setSessions(d.sessions ?? []);
          setError(null);
        })
        .catch((e) => {
          if (alive) setError(String(e?.message ?? e));
        });
    fetchIt();
    const t = setInterval(fetchIt, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const visible = useMemo(() => {
    if (!filter) return sessions;
    const q = filter.toLowerCase();
    return sessions.filter(
      (s) =>
        s.id.toLowerCase().includes(q) ||
        (s.agentLabel ?? '').toLowerCase().includes(q),
    );
  }, [sessions, filter]);

  async function handleDelete(sessionId: string): Promise<boolean> {
    try {
      const r = await fetch(
        `/api/admin/sessions/${encodeURIComponent(sessionId)}?confirm=${encodeURIComponent(sessionId)}`,
        { method: 'DELETE' },
      );
      if (!r.ok) {
        setError(`Delete failed: HTTP ${r.status}`);
        return false;
      }
      // Optimistic update; the next 2s poll will reconcile anyway.
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      return true;
    } catch (e: any) {
      setError(String(e?.message ?? e));
      return false;
    }
  }

  async function handleBulkDelete(): Promise<boolean> {
    const ids = [...selected];
    if (ids.length === 0) return false;
    try {
      const r = await fetch('/api/admin/sessions/delete-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, confirm: ids.length }),
      });
      if (!r.ok) {
        setError(`Bulk delete failed: HTTP ${r.status}`);
        return false;
      }
      const data = (await r.json()) as { deleted: string[] };
      const dropped = new Set(data.deleted);
      setSessions((prev) => prev.filter((s) => !dropped.has(s.id)));
      setSelected(new Set());
      return true;
    } catch (e: any) {
      setError(String(e?.message ?? e));
      return false;
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function selectAllVisible() {
    setSelected(new Set(visible.map((s) => s.id)));
  }
  function clearSelection() {
    setSelected(new Set());
  }
  const allVisibleSelected =
    visible.length > 0 && visible.every((s) => selected.has(s.id));

  return (
    <div className="bg-mesh">
      <div className="container">
        <div className="nav-bar">
          <Link to="/" className="brand-mark" style={{ textDecoration: 'none' }}>
            <div className="logo">
              <LogoIcon size={56} />
            </div>
            <div className="brand-text">
              <div className="brand-line1">BROWSER AGENT · ADMIN</div>
              <div className="brand-line2-chaos" data-text="CHAOS">CHAOS</div>
            </div>
          </Link>
          <div className="nav-links">
            <Link to="/">Home</Link>
          </div>
        </div>
        <div className="hero" style={{ paddingBottom: 12 }}>
          <h1 style={{ marginBottom: 6 }}>Dashboard</h1>
          <p className="sub">
            Live view of every active session. Auto-refreshes every 2 seconds.
          </p>
          {error && (
            <div className="warning" style={{ marginTop: 14 }}>
              {error}
            </div>
          )}
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by session id or agent label…"
              style={{
                width: 360,
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border)',
                background: 'var(--bg-elev-1)',
                color: 'var(--fg)',
                fontSize: 13,
              }}
            />
            <ViewToggle view={view} onChange={setView} />
            <span style={{ color: 'var(--fg-faint)', fontSize: 13 }}>
              {visible.length} session{visible.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {view === 'cards' ? (
          <div className="grid" style={{ marginTop: 4 }}>
            {visible.map((s) => (
              <SessionCard key={s.id} s={s} now={now} onDelete={handleDelete} />
            ))}
            {visible.length === 0 && (
              <div className="empty-state">
                {sessions.length === 0
                  ? 'No sessions yet. Start one via /new-session.'
                  : 'No sessions match this filter.'}
              </div>
            )}
          </div>
        ) : (
          <SessionTable
            sessions={visible}
            allSessionsEmpty={sessions.length === 0}
            now={now}
            selected={selected}
            onToggle={toggleSelect}
            onToggleAll={
              allVisibleSelected ? clearSelection : selectAllVisible
            }
            allVisibleSelected={allVisibleSelected}
            onDelete={handleDelete}
          />
        )}

        {selected.size > 0 && (
          <BulkActionBar
            count={selected.size}
            onClear={clearSelection}
            onDelete={() => setBulkConfirm(true)}
          />
        )}
        {bulkConfirm && (
          <ConfirmDeleteModal
            title={`Delete ${selected.size} session${selected.size === 1 ? '' : 's'}?`}
            body={
              <>
                All events, scores, and mount records for the{' '}
                <b style={{ color: 'var(--fg)' }}>{selected.size}</b> selected
                session{selected.size === 1 ? '' : 's'} will be permanently
                removed. This can't be undone.
              </>
            }
            confirmLabel={`Delete ${selected.size} session${selected.size === 1 ? '' : 's'}`}
            onCancel={() => setBulkConfirm(false)}
            onConfirm={async () => {
              const ok = await handleBulkDelete();
              if (ok) setBulkConfirm(false);
              return ok;
            }}
          />
        )}
      </div>
    </div>
  );
}

function SessionCard({
  s,
  now,
  onDelete,
}: {
  s: DashboardSession;
  now: number;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const idleMs = now - s.lastActivity;
  const isLive = idleMs < 5000;
  return (
    <div className="card" style={{ cursor: 'default' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              color: 'var(--fg)',
            }}
          >
            {s.id}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
            {s.agentLabel ?? 'auto'} · started{' '}
            {new Date(s.createdAt).toLocaleTimeString()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isLive ? (
            <span
              className="badge"
              style={{
                background: 'var(--success-soft)',
                color: 'var(--success)',
                borderColor: 'rgba(74,222,128,0.3)',
              }}
            >
              live
            </span>
          ) : (
            <span
              className="badge"
              style={{
                background: 'var(--bg-elev-2)',
                color: 'var(--fg-faint)',
                borderColor: 'var(--border)',
              }}
            >
              idle {Math.round(idleMs / 1000)}s
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginTop: 14,
        }}
      >
        <Stat label="avg" value={`${s.avg}/100`} highlight />
        <Stat label="pass" value={s.passed} color="var(--success)" />
        <Stat label="fail" value={s.failed} color="var(--danger)" />
        <Stat label="skip" value={s.skipped} color="var(--warn)" />
      </div>

      <div
        style={{
          fontSize: 12,
          color: 'var(--fg-faint)',
          marginTop: 12,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <span>{s.attempted} attempted</span>
        <span>· {s.totalMounts} mounts</span>
        {s.mountsWithoutInteract > 0 && (
          <span style={{ color: 'var(--warn)' }}>
            · {s.mountsWithoutInteract} no-interact
          </span>
        )}
        {s.suspicious > 0 && (
          <span style={{ color: 'var(--warn)' }}>
            · {s.suspicious} suspicious
          </span>
        )}
        <span>· {Math.round(s.durationSeconds)}s session</span>
      </div>

      {/* Per-tier breakdown */}
      <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['easy', 'medium', 'hard'] as const).map((t) => {
          const b = s.byTier[t] ?? { pass: 0, fail: 0, skip: 0 };
          const total = b.pass + b.fail + b.skip;
          if (total === 0) return null;
          return (
            <div
              key={t}
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--fg-dim)',
                padding: '4px 8px',
                borderRadius: 6,
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--border)',
              }}
            >
              {t}: <b style={{ color: 'var(--success)' }}>{b.pass}</b>/
              <b style={{ color: 'var(--danger)' }}>{b.fail}</b>/
              <b style={{ color: 'var(--warn)' }}>{b.skip}</b>
            </div>
          );
        })}
      </div>

      {/* Recent activity */}
      {s.recent.length > 0 && (
        <details style={{ marginTop: 14 }}>
          <summary
            style={{
              cursor: 'pointer',
              color: 'var(--fg-faint)',
              fontSize: 11,
            }}
          >
            Last {s.recent.length} events
          </summary>
          <div
            style={{
              marginTop: 8,
              maxHeight: 200,
              overflowY: 'auto',
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              color: 'var(--fg-dim)',
            }}
          >
            {s.recent
              .slice()
              .reverse()
              .map((e, i) => (
                <div key={i}>
                  <span style={{ color: 'var(--fg-faint)' }}>
                    {new Date(e.timestamp).toLocaleTimeString()}
                  </span>{' '}
                  {e.event.padEnd(18)} {e.challengeId}
                </div>
              ))}
          </div>
        </details>
      )}

      <div
        style={{
          marginTop: 12,
          paddingTop: 10,
          borderTop: '1px dashed var(--border)',
          display: 'flex',
          gap: 12,
          fontSize: 12,
          alignItems: 'center',
        }}
      >
        <Link to={`/score/${s.id}`} style={{ color: 'var(--accent-2)' }}>
          full score →
        </Link>
        <a
          href={`/api/export/${s.id}.md`}
          target="_blank"
          rel="noopener"
          style={{ color: 'var(--fg-faint)' }}
        >
          .md export
        </a>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          title="Delete this session and its events permanently."
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            border: '1px solid rgba(248,113,113,0.25)',
            color: 'var(--danger)',
            padding: '4px 10px',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Delete
        </button>
      </div>
      {showConfirm && (
        <ConfirmDeleteModal
          title="Delete this session?"
          body={
            <>
              All events, scores, and mount records for session{' '}
              <code
                style={{
                  color: 'var(--fg)',
                  background: 'var(--bg-elev-2)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 12.5,
                }}
              >
                {s.id}
              </code>{' '}
              will be permanently removed. This can't be undone.
            </>
          }
          confirmLabel="Delete session"
          onCancel={() => setShowConfirm(false)}
          onConfirm={async () => {
            const ok = await onDelete(s.id);
            if (ok) setShowConfirm(false);
            return ok;
          }}
        />
      )}
    </div>
  );
}

function ConfirmDeleteModal({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);

  // ESC closes the modal — small affordance that users expect.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel, busy]);

  // Render through a portal so the modal is a direct child of <body> and
  // can't be clipped or stacked behind by any ancestor's overflow / z-index.
  return createPortal(
    <div
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 6, 12, 0.62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'bac-modal-fade 0.12s ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-elev-1)',
          border: '1px solid var(--border-strong)',
          borderRadius: 16,
          padding: '28px 28px 22px',
          maxWidth: 440,
          width: '90%',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55)',
          position: 'relative',
        }}
      >
        {/* danger glyph */}
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: 'rgba(248, 113, 113, 0.12)',
            border: '1px solid rgba(248, 113, 113, 0.28)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--danger)',
            fontSize: 22,
            marginBottom: 14,
          }}
          aria-hidden
        >
          ⚠
        </div>
        <h3 style={{ margin: 0, marginBottom: 8, fontSize: 19, letterSpacing: '-0.01em' }}>
          {title}
        </h3>
        <p
          style={{
            fontSize: 13.5,
            lineHeight: 1.6,
            color: 'var(--fg-dim)',
            marginBottom: 22,
            marginTop: 0,
          }}
        >
          {body}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            autoFocus
            style={{
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--fg-dim)',
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              cursor: busy ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              setBusy(false);
            }}
            style={{
              background: 'var(--danger)',
              border: '1px solid var(--danger)',
              color: '#0a0a0e',
              padding: '9px 16px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.6 : 1,
              transition: 'opacity 0.15s ease',
            }}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Stat({
  label,
  value,
  color,
  highlight,
}: {
  label: string;
  value: string | number;
  color?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--fg-faint)',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: highlight ? 22 : 18,
          fontWeight: 600,
          color: color ?? 'var(--fg)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: DashboardView;
  onChange: (v: DashboardView) => void;
}) {
  const cell = (active: boolean): React.CSSProperties => ({
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.04em',
    color: active ? 'var(--fg)' : 'var(--fg-faint)',
    background: active ? 'var(--bg-elev-2)' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'color 0.12s ease, background 0.12s ease',
  });
  return (
    <div
      role="tablist"
      style={{
        display: 'inline-flex',
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        background: 'var(--bg-elev-1)',
      }}
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === 'cards'}
        onClick={() => onChange('cards')}
        style={cell(view === 'cards')}
      >
        Cards
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'table'}
        onClick={() => onChange('table')}
        style={cell(view === 'table')}
      >
        Table
      </button>
    </div>
  );
}

function SessionTable({
  sessions,
  allSessionsEmpty,
  now,
  selected,
  onToggle,
  onToggleAll,
  allVisibleSelected,
  onDelete,
}: {
  sessions: DashboardSession[];
  allSessionsEmpty: boolean;
  now: number;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
  allVisibleSelected: boolean;
  onDelete: (id: string) => Promise<boolean>;
}) {
  if (sessions.length === 0) {
    return (
      <div className="empty-state" style={{ marginTop: 16 }}>
        {allSessionsEmpty
          ? 'No sessions yet. Start one via /start.'
          : 'No sessions match this filter.'}
      </div>
    );
  }
  return (
    <div
      style={{
        marginTop: 16,
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'auto',
        background: 'var(--bg-elev-1)',
      }}
    >
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 13,
          fontFamily: 'var(--font-mono)',
        }}
      >
        <thead>
          <tr style={{ background: 'var(--bg-elev-2)', textAlign: 'left' }}>
            <th style={thStyle(40)}>
              <input
                type="checkbox"
                checked={allVisibleSelected}
                onChange={onToggleAll}
                aria-label={allVisibleSelected ? 'Clear selection' : 'Select all visible'}
              />
            </th>
            <th style={thStyle()}>Session</th>
            <th style={thStyle(120)}>Agent</th>
            <th style={thStyle(80, true)}>Status</th>
            <th style={thStyle(70, true)}>Avg</th>
            <th style={thStyle(60, true)}>Pass</th>
            <th style={thStyle(60, true)}>Fail</th>
            <th style={thStyle(60, true)}>Skip</th>
            <th style={thStyle(90, true)}>Started</th>
            <th style={thStyle(80, true)}>Duration</th>
            <th style={thStyle(120)}></th>
          </tr>
        </thead>
        <tbody>
          {sessions.map((s) => (
            <SessionRow
              key={s.id}
              s={s}
              now={now}
              checked={selected.has(s.id)}
              onToggle={() => onToggle(s.id)}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function thStyle(width?: number, numeric?: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    fontSize: 10,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--fg-faint)',
    borderBottom: '1px solid var(--border)',
    width,
    textAlign: numeric ? 'right' : 'left',
    whiteSpace: 'nowrap',
  };
}
function tdStyle(numeric?: boolean): React.CSSProperties {
  return {
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--fg-dim)',
    fontVariantNumeric: 'tabular-nums',
    textAlign: numeric ? 'right' : 'left',
    whiteSpace: 'nowrap',
  };
}

function SessionRow({
  s,
  now,
  checked,
  onToggle,
  onDelete,
}: {
  s: DashboardSession;
  now: number;
  checked: boolean;
  onToggle: () => void;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const idleMs = now - s.lastActivity;
  const isLive = idleMs < 5000;
  return (
    <tr
      style={{
        background: checked ? 'rgba(124,58,237,0.06)' : 'transparent',
        transition: 'background 0.12s ease',
      }}
    >
      <td style={tdStyle()}>
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          aria-label={`Select session ${s.id}`}
        />
      </td>
      <td style={{ ...tdStyle(), color: 'var(--fg)' }}>
        <Link to={`/score/${s.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
          {s.id}
        </Link>
      </td>
      <td style={tdStyle()}>{s.agentLabel ?? 'auto'}</td>
      <td style={tdStyle(true)}>
        {isLive ? (
          <span
            className="badge"
            style={{
              background: 'var(--success-soft)',
              color: 'var(--success)',
              borderColor: 'rgba(74,222,128,0.3)',
            }}
          >
            live
          </span>
        ) : (
          <span style={{ color: 'var(--fg-faint)' }}>
            idle {Math.round(idleMs / 1000)}s
          </span>
        )}
      </td>
      <td style={{ ...tdStyle(true), color: 'var(--fg)', fontWeight: 600 }}>{s.avg}</td>
      <td style={{ ...tdStyle(true), color: 'var(--success)' }}>{s.passed}</td>
      <td style={{ ...tdStyle(true), color: 'var(--danger)' }}>{s.failed}</td>
      <td style={{ ...tdStyle(true), color: 'var(--warn)' }}>{s.skipped}</td>
      <td style={tdStyle(true)}>{new Date(s.createdAt).toLocaleTimeString()}</td>
      <td style={tdStyle(true)}>{Math.round(s.durationSeconds)}s</td>
      <td style={{ ...tdStyle(), textAlign: 'right' }}>
        <a
          href={`/api/export/${s.id}.md`}
          target="_blank"
          rel="noopener"
          style={{
            color: 'var(--fg-faint)',
            marginRight: 12,
            fontSize: 11,
            letterSpacing: '0.04em',
          }}
        >
          .md
        </a>
        <button
          type="button"
          onClick={() => setShowConfirm(true)}
          title="Delete this session and its events permanently."
          style={{
            background: 'transparent',
            border: '1px solid rgba(248,113,113,0.25)',
            color: 'var(--danger)',
            padding: '3px 9px',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
            letterSpacing: '0.04em',
          }}
        >
          Delete
        </button>
      </td>
      {showConfirm && (
        <ConfirmDeleteModal
          title="Delete this session?"
          body={
            <>
              All events, scores, and mount records for session{' '}
              <code
                style={{
                  color: 'var(--fg)',
                  background: 'var(--bg-elev-2)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  fontSize: 12.5,
                }}
              >
                {s.id}
              </code>{' '}
              will be permanently removed.
            </>
          }
          confirmLabel="Delete session"
          onCancel={() => setShowConfirm(false)}
          onConfirm={async () => {
            const ok = await onDelete(s.id);
            if (ok) setShowConfirm(false);
            return ok;
          }}
        />
      )}
    </tr>
  );
}

function BulkActionBar({
  count,
  onClear,
  onDelete,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '10px 16px',
        background: 'var(--bg-elev-2)',
        border: '1px solid var(--border-strong)',
        borderRadius: 12,
        boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
        zIndex: 900,
        animation: 'bac-modal-fade 0.15s ease-out',
      }}
    >
      <span style={{ fontSize: 13, color: 'var(--fg)', fontWeight: 600 }}>
        {count} selected
      </span>
      <button
        type="button"
        onClick={onClear}
        style={{
          background: 'transparent',
          border: '1px solid var(--border)',
          color: 'var(--fg-dim)',
          padding: '6px 12px',
          borderRadius: 8,
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Clear
      </button>
      <button
        type="button"
        onClick={onDelete}
        style={{
          background: 'var(--danger)',
          border: '1px solid var(--danger)',
          color: '#0a0a0e',
          padding: '6px 14px',
          borderRadius: 8,
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          letterSpacing: '0.04em',
        }}
      >
        Delete {count}
      </button>
    </div>
  );
}
