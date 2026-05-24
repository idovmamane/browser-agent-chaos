import type { StageProps } from './StageRunner';

interface Row {
  id: string;
  name: string;
  meta?: string;
  target?: boolean; // hint to humans only; server checker is the source of truth
}
interface RowAction {
  kind: string;
  label: string;
  danger?: boolean;
}

/**
 * Renders a list of rows with per-row action buttons. The agent must click the
 * right action on the right row. Stable element ids are `<rowId>/<actionKind>`
 * — exposed via data-bac and data-testid so the server can identify them and
 * Playwright can target them.
 */
export function DestructiveRowActionStage({ data, emit }: StageProps) {
  const rows: Row[] = data.rows ?? [];
  const actions: RowAction[] = data.actionsPerRow ?? [];
  const topBar = data.topBarButton as
    | { id: string; label: string; danger?: boolean }
    | undefined;

  return (
    <div data-bac-stage="destructive-row-action">
      <ProductHeader data={data} />
      {topBar && (
        <div style={{ marginBottom: 12 }}>
          <button
            className={topBar.danger ? 'button-danger' : 'button-secondary'}
            data-bac={topBar.id}
            data-testid={`bac-${topBar.id}`}
            onClick={(e) => emit(topBar.id, 'click', undefined, e.isTrusted)}
          >
            {topBar.label}
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((row) => (
          <div
            key={row.id}
            data-bac-row={row.id}
            data-testid={`bac-row-${row.id}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              background: '#fafbfd',
              border: '1px solid #e7e8f0',
              borderRadius: 8,
            }}
          >
            <div>
              <b>{row.name}</b>
              {row.meta && (
                <span className="subtle" style={{ marginLeft: 10, fontSize: 12 }}>
                  {row.meta}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {actions.map((a) => {
                const id = `${row.id}/${a.kind}`;
                return (
                  <button
                    key={id}
                    data-bac={id}
                    data-testid={`bac-${id}`}
                    className={a.danger ? 'button-danger' : 'button-secondary'}
                    style={{ padding: '6px 12px', fontSize: 13 }}
                    onClick={(e) => emit(id, 'click', undefined, e.isTrusted)}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
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
