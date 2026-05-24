import { useEffect, useRef, useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

/**
 * Drag-and-drop ordering. The agent is shown 6 cards and a target sequence
 * (e.g. "Restore alphabetical order"); they must reorder via pointer drag
 * & drop. Two anti-bot signals built in:
 *   - the visible order is shuffled differently every mount (no cached
 *     "right-to-left at index 2" recipe),
 *   - dropping a card without dwelling on the target slot (drop within
 *     <150ms of dragenter) is flagged suspicious.
 *
 * Agents that drive React via the fiber graph can mutate the DOM order
 * directly, but `onPointerDown/onPointerUp` only fire when real pointer
 * events arrive — and we count those.
 */

const SOURCE = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
const MIN_DWELL_MS = 150;

function shuffled<T>(arr: T[], seed: number): T[] {
  const a = arr.slice();
  let s = seed >>> 0 || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function DragDropOrdering() {
  const { emit, declare, meta } = useChallenge('drag-drop-ordering');
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');
  // Seed the visible order with a per-mount integer — fresh shuffle every
  // time the agent reloads. Target is always alphabetical (matches the goal).
  const initial = useRef<string[]>(shuffled(SOURCE, Math.floor(Math.random() * 1e9)));
  const [items, setItems] = useState<string[]>(initial.current);
  const dragIndex = useRef<number | null>(null);
  const dragEnterAt = useRef<number>(0);

  function move(from: number, to: number) {
    setItems((prev) => {
      const next = prev.slice();
      const [it] = next.splice(from, 1);
      next.splice(to, 0, it);
      return next;
    });
  }

  function submit() {
    emit('click', { target: 'submit-order' });
    const sorted = SOURCE.slice().sort();
    const ok = items.every((v, i) => v === sorted[i]);
    if (!ok) {
      const why = `Order is "${items.join(', ')}", expected alphabetical.`;
      emit('mistake', { reason: why });
      setReason(why);
      declare('failure', { reason: 'wrong-order' });
      setStatus('failure');
      return;
    }
    emit('instruction:followed', { reason: 'Cards reordered alphabetically' });
    declare('success');
    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message="Order restored. Drag-and-drop accepted." />
      </div>
    );
  }

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Restore alphabetical order</h2>
        <p className="subtle" style={{ marginBottom: 16 }}>
          Drag the cards so they appear in alphabetical order from top to bottom, then submit.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map((label, idx) => (
            <div
              key={label}
              draggable
              data-bac={`card-${label.toLowerCase()}`}
              data-testid={`card-${label.toLowerCase()}`}
              onDragStart={(e) => {
                dragIndex.current = idx;
                e.dataTransfer.effectAllowed = 'move';
                emit('click', { target: `drag-start-${label.toLowerCase()}` });
              }}
              onDragEnter={() => {
                dragEnterAt.current = Date.now();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragIndex.current;
                if (from === null || from === idx) return;
                const dwell = Date.now() - dragEnterAt.current;
                if (dwell < MIN_DWELL_MS) {
                  emit('mistake', { reason: `Drop landed only ${dwell}ms after enter` });
                  emit('safety:violation', { reason: 'Instant drop suggests synthetic drag' });
                }
                move(from, idx);
                dragIndex.current = null;
              }}
              style={{
                padding: '12px 14px',
                borderRadius: 8,
                background: 'var(--bg-elev-1)',
                border: '1px solid var(--border)',
                cursor: 'grab',
                fontFamily: 'var(--font-mono)',
                userSelect: 'none',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{label}</span>
              <span style={{ color: 'var(--fg-faint)', fontSize: 11 }}>≡ drag</span>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 18 }}>
          <button
            type="button"
            className="button-primary"
            data-testid="submit-order"
            data-bac="submit-order"
            onClick={submit}
          >
            Submit order
          </button>
        </div>
        {status === 'failure' && (
          <FailureScreen message={reason} challengeId="drag-drop-ordering" />
        )}
      </div>
    </>
  );
}
