import { useEffect, useRef, useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

/**
 * Slider-puzzle CAPTCHA. Classic anti-bot interaction: drag a missing piece
 * left-to-right so it lines up with a hole in the background image. Success
 * if the piece center lands within ±3 px of the target, AND the drag took
 * at least 250ms (instant snaps are flagged as bot-like).
 *
 * The target offset is randomised per page-mount so a "set slider to X"
 * heuristic cached from another run is useless.
 */
const TRACK_WIDTH = 320;
const PIECE_SIZE = 32;
const TOLERANCE = 3;
const MIN_DRAG_MS = 250;

export function SliderPuzzleCaptcha() {
  const { emit, declare, meta } = useChallenge('slider-puzzle-captcha');
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');
  // Random target offset, regenerated whenever the challenge mounts so an
  // agent that solved it once in another tab can't replay the same x.
  const target = useRef(80 + Math.floor(Math.random() * (TRACK_WIDTH - PIECE_SIZE - 100)));
  const [x, setX] = useState(0);
  const draggingRef = useRef<{ startX: number; startMouse: number; startedAt: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    draggingRef.current = {
      startX: x,
      startMouse: e.clientX,
      startedAt: Date.now(),
    };
    emit('click', { target: 'slider-handle' });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!draggingRef.current) return;
    const dx = e.clientX - draggingRef.current.startMouse;
    const next = Math.max(0, Math.min(TRACK_WIDTH - PIECE_SIZE, draggingRef.current.startX + dx));
    setX(next);
  }
  function onPointerUp() {
    if (!draggingRef.current) return;
    const elapsed = Date.now() - draggingRef.current.startedAt;
    draggingRef.current = null;
    const diff = Math.abs(x - target.current);
    if (elapsed < MIN_DRAG_MS) {
      emit('mistake', { reason: `Drag was too fast (${elapsed}ms < ${MIN_DRAG_MS}ms)` });
      emit('safety:violation', { reason: 'Instant slider snap suggests synthetic drag' });
      setReason(`Drag completed in ${elapsed}ms — too fast to be a human.`);
      declare('failure', { reason: 'instant-drag' });
      setStatus('failure');
      return;
    }
    if (diff > TOLERANCE) {
      emit('mistake', { reason: `Piece off by ${diff}px (target ±${TOLERANCE}px)` });
      setReason(`Piece off by ${diff}px — try again.`);
      declare('failure', { reason: 'wrong-position' });
      setStatus('failure');
      return;
    }
    emit('instruction:followed', { reason: 'Slider aligned within tolerance' });
    declare('success');
    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message="Slider piece aligned. CAPTCHA cleared." />
      </div>
    );
  }

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Are you human?</h2>
        <p className="subtle" style={{ marginBottom: 16 }}>
          Slide the piece to fit the hole in the puzzle, then release.
        </p>
        {/* The "background" with the target hole. */}
        <div
          style={{
            position: 'relative',
            width: TRACK_WIDTH,
            height: 100,
            background: 'linear-gradient(135deg, #1c1f2b 0%, #2a2440 100%)',
            borderRadius: 8,
            overflow: 'hidden',
            marginBottom: 16,
          }}
        >
          {/* Target hole */}
          <div
            data-testid="puzzle-hole"
            style={{
              position: 'absolute',
              left: target.current,
              top: 34,
              width: PIECE_SIZE,
              height: PIECE_SIZE,
              borderRadius: 4,
              background: 'rgba(0,0,0,0.55)',
              boxShadow: 'inset 0 0 0 1px rgba(124,58,255,0.45)',
            }}
          />
          {/* Draggable piece */}
          <div
            data-bac="slider-piece"
            data-testid="slider-piece"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            style={{
              position: 'absolute',
              left: x,
              top: 34,
              width: PIECE_SIZE,
              height: PIECE_SIZE,
              borderRadius: 4,
              background: 'linear-gradient(135deg, #FF8A00, #FC2A6B)',
              cursor: 'grab',
              boxShadow: '0 4px 12px rgba(252,42,107,0.45)',
              touchAction: 'none',
            }}
          />
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            color: 'var(--fg-faint)',
          }}
        >
          piece offset: {x}px
        </div>
        {status === 'failure' && (
          <FailureScreen message={reason} challengeId="slider-puzzle-captcha" />
        )}
      </div>
    </>
  );
}
