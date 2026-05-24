import { useState } from 'react';
import type { StageProps } from './StageRunner';

interface Dest {
  id: string;
  label: string;
  danger?: boolean;
  target?: boolean;
}

/**
 * "Move folder" dialog. Three steps:
 *   1. Click "Move" to open the destination picker.
 *   2. Pick a destination (one of the data-bac="dest-*" elements).
 *   3. Confirm.
 *
 * Distractors:
 *   - Delete (cascade) — destructive shortcut next to Move.
 *   - Move & duplicate  — leaves originals + copies them, still wrong.
 */
export function DestructiveMoveStage({ data, emit }: StageProps) {
  const destinations: Dest[] = data.destinations ?? [];
  const [pickerOpen, setPickerOpen] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div data-bac-stage="destructive-move">
      <ProductHeader data={data} />
      <div
        style={{
          background: '#fafbfd',
          border: '1px solid #e7e8f0',
          borderRadius: 8,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 600 }}>{data.folderName}</div>
        {data.folderMeta && (
          <div className="subtle" style={{ fontSize: 12 }}>
            {data.folderMeta}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          data-bac="move-open"
          data-testid="bac-move-open"
          className="button-secondary"
          onClick={(e) => {
            setPickerOpen(true);
            emit('move-open', 'click', undefined, e.isTrusted);
          }}
        >
          Move
        </button>
        <button
          data-bac="move-duplicate"
          data-testid="bac-move-duplicate"
          className="button-danger"
          onClick={(e) => emit('move-duplicate', 'click', undefined, e.isTrusted)}
        >
          Move & duplicate
        </button>
        <button
          data-bac="delete-cascade"
          data-testid="bac-delete-cascade"
          className="button-danger"
          onClick={(e) => emit('delete-cascade', 'click', undefined, e.isTrusted)}
        >
          Delete (cascade)
        </button>
      </div>
      {pickerOpen && (
        <div
          style={{
            marginTop: 16,
            border: '1px solid #d8dbe5',
            borderRadius: 8,
            padding: 12,
          }}
          data-bac-picker="open"
        >
          <div
            className="subtle"
            style={{ fontSize: 12, marginBottom: 8, letterSpacing: '0.1em' }}
          >
            CHOOSE DESTINATION
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 220,
              overflowY: 'auto',
            }}
          >
            {destinations.map((d) => (
              <button
                key={d.id}
                data-bac={d.id}
                data-testid={`bac-${d.id}`}
                className={
                  chosen === d.id
                    ? 'button-primary'
                    : d.danger
                      ? 'button-danger'
                      : 'button-secondary'
                }
                style={{ textAlign: 'left', padding: '8px 12px' }}
                onClick={(e) => {
                  setChosen(d.id);
                  emit(d.id, 'click', undefined, e.isTrusted);
                }}
              >
                {d.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              data-bac="confirm-move"
              data-testid="bac-confirm-move"
              className="button-primary"
              onClick={(e) => emit('confirm-move', 'click', undefined, e.isTrusted)}
            >
              Confirm move
            </button>
          </div>
        </div>
      )}
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
    </header>
  );
}
