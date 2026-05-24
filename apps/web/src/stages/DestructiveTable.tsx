import { useState } from 'react';
import type { StageProps } from './StageRunner';

interface Row {
  id: string;
  name: string;
  meta?: string;
  target?: boolean;
}

/**
 * A table with a master "select all" checkbox + per-row checkboxes + a
 * top-bar action button. The agent must un-tick the master, tick only the
 * target row, then click the action. Optionally per-row actions (e.g.
 * Restore on Dropbox).
 */
export function DestructiveTableStage({ data, emit }: StageProps) {
  const rows: Row[] = data.rows ?? [];
  const masterDefault: boolean = !!data.masterCheckboxDefault;
  const topBar = data.topBarButton as
    | { id: string; label: string; danger?: boolean }
    | undefined;
  const perRow = (data.actionsPerRow ?? []) as {
    kind: string;
    label: string;
    danger?: boolean;
  }[];

  const [master, setMaster] = useState(masterDefault);
  const [checked, setChecked] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, masterDefault])),
  );

  return (
    <div data-bac-stage="destructive-table">
      <ProductHeader data={data} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 8,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            data-bac="select-all"
            data-testid="bac-select-all"
            checked={master}
            onChange={(e) => {
              const v = e.target.checked;
              setMaster(v);
              const nextChecked = Object.fromEntries(rows.map((r) => [r.id, v]));
              setChecked(nextChecked);
              emit('select-all', 'check', v, e.isTrusted ?? true);
              // Also emit a check event per row so the server sees the cascading state.
              for (const r of rows) {
                emit(`check/${r.id}`, 'check', v, e.isTrusted ?? true);
              }
            }}
          />
          Select all
        </label>
        {topBar && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              data-bac={topBar.id}
              data-testid={`bac-${topBar.id}`}
              className={topBar.danger ? 'button-danger' : 'button-secondary'}
              onClick={(e) => emit(topBar.id, 'click', undefined, e.isTrusted)}
            >
              {topBar.label}
            </button>
            <button
              data-bac="delete-selected"
              data-testid="bac-delete-selected"
              className="button-danger"
              onClick={(e) => emit('delete-selected', 'click', undefined, e.isTrusted)}
            >
              Delete selected
            </button>
          </div>
        )}
        {!topBar && (
          <button
            data-bac="delete-selected"
            data-testid="bac-delete-selected"
            className="button-danger"
            onClick={(e) => emit('delete-selected', 'click', undefined, e.isTrusted)}
          >
            Delete selected
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r) => (
          <div
            key={r.id}
            data-bac-row={r.id}
            data-testid={`bac-row-${r.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 12px',
              background: checked[r.id] ? '#fff8eb' : '#fafbfd',
              border: '1px solid #e7e8f0',
              borderRadius: 6,
            }}
          >
            <input
              type="checkbox"
              data-bac={`check/${r.id}`}
              data-testid={`bac-check-${r.id}`}
              checked={checked[r.id] ?? false}
              onChange={(e) => {
                const v = e.target.checked;
                setChecked((c) => ({ ...c, [r.id]: v }));
                // If we mutated a row directly the master might be out of sync;
                // we conservatively reflect that.
                if (!v && master) {
                  setMaster(false);
                  emit('select-all', 'check', false, e.isTrusted ?? true);
                }
                emit(`check/${r.id}`, 'check', v, e.isTrusted ?? true);
              }}
            />
            <div style={{ flex: 1 }}>
              <b>{r.name}</b>
              {r.meta && (
                <span className="subtle" style={{ marginLeft: 10, fontSize: 12 }}>
                  {r.meta}
                </span>
              )}
            </div>
            {perRow.map((a) => {
              const id = `${r.id}/${a.kind}`;
              return (
                <button
                  key={id}
                  data-bac={id}
                  data-testid={`bac-${id}`}
                  className={a.danger ? 'button-danger' : 'button-secondary'}
                  style={{ padding: '4px 10px', fontSize: 12 }}
                  onClick={(e) => emit(id, 'click', undefined, e.isTrusted)}
                >
                  {a.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductHeader({ data }: { data: any }) {
  return (
    <header style={{ marginBottom: 14 }}>
      {data.productName && (
        <div className="subtle" style={{ fontSize: 11, letterSpacing: '0.14em' }}>
          {String(data.productName).toUpperCase()}
        </div>
      )}
      {data.headline && (
        <h2 style={{ margin: '6px 0 4px', fontSize: 20 }}>{data.headline}</h2>
      )}
      {data.body && <p style={{ margin: 0, color: '#4a5066' }}>{data.body}</p>}
    </header>
  );
}
