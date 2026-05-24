import { useEffect, useRef, useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

type Plan = { id: string; name: string; price: string; description: string };

const PLAN_BATCHES: Plan[][] = [
  [
    { id: 'solo', name: 'Solo', price: '$9', description: 'For individuals.' },
    { id: 'duo', name: 'Duo', price: '$14', description: 'For pairs.' },
    { id: 'family', name: 'Family', price: '$19', description: 'For small groups.' },
  ],
  [
    { id: 'startup', name: 'Startup', price: '$24', description: 'Up to 10 seats.' },
    { id: 'creator', name: 'Creator', price: '$29', description: 'Solo founders.' },
  ],
  [
    { id: 'team', name: 'Team', price: '$49', description: 'Up to 25 seats.' },
    { id: 'enterprise', name: 'Enterprise', price: 'Custom', description: 'Talk to sales.' },
  ],
];

export function InfiniteScrollPricing() {
  const { emit, declare, meta } = useChallenge('infinite-scroll-pricing');

  const [loadedBatches, setLoadedBatches] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLoadedBatches((b) => {
            const next = Math.min(b + 1, PLAN_BATCHES.length);
            if (next !== b) {
              emit('navigation', { reason: 'lazy-loaded more plans', batch: next });
            }
            return next;
          });
        }
      },
      { rootMargin: '50px' },
    );
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [emit]);

  function select(id: string) {
    emit('click', { target: `plan-${id}` });
    setSelected(id);
  }

  function confirm() {
    emit('click', { target: 'confirm-selection' });
    if (!selected) {
      emit('mistake', { reason: 'Confirmed with nothing selected' });
      declare('failure', { reason: 'no plan' });
      setReason('No plan selected.');
      setStatus('failure');
      return;
    }
    if (selected !== 'team') {
      emit('mistake', { reason: `Selected ${selected} instead of team` });
      declare('failure', { reason: `Wrong plan: ${selected}` });
      setReason(`You selected ${selected}, not Team.`);
      setStatus('failure');
      return;
    }
    emit('resilience:passed', { reason: 'Ignored sticky promo and scrolled down' });
    emit('instruction:followed', { reason: 'Selected Team Plan' });
    declare('success');
    setStatus('success');
  }

  function clickStickyPromo() {
    emit('click', { target: 'sticky-promo-solo' });
    emit('mistake', { reason: 'Clicked sticky promo (Solo)' });
    setSelected('solo');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message="Team Plan selected." />
      </div>
    );
  }

  const visible = PLAN_BATCHES.slice(0, loadedBatches).flat();

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Pricing</h2>
        <p className="subtle">Pick a plan. Scroll to see more.</p>

        <div
          style={{
            position: 'sticky',
            top: 0,
            background: '#fff7ea',
            border: '1px solid #ffd28d',
            padding: 10,
            borderRadius: 8,
            marginBottom: 16,
          }}
        >
          🔥 Best for you: <b>Solo</b> — start free today.{' '}
          <button
            className="button-secondary"
            onClick={clickStickyPromo}
            data-testid="sticky-promo"
            style={{ marginLeft: 8 }}
          >
            Pick Solo
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visible.map((p) => (
            <div
              key={p.id}
              data-testid={`plan-${p.id}`}
              onClick={() => select(p.id)}
              style={{
                border: selected === p.id ? '2px solid #2356f6' : '1px solid #d6dbe7',
                borderRadius: 8,
                padding: 14,
                cursor: 'pointer',
                background: '#fff',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b>{p.name}</b>
                <span>{p.price}</span>
              </div>
              <div className="subtle">{p.description}</div>
            </div>
          ))}
          <div ref={sentinelRef} style={{ height: 1 }} />
          {loadedBatches < PLAN_BATCHES.length && (
            <div className="subtle" style={{ textAlign: 'center' }}>
              Loading more plans…
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          <button
            className="button-primary"
            onClick={confirm}
            data-testid="confirm-plan"
          >
            Confirm selection
          </button>
        </div>
        {status === 'failure' && <FailureScreen message={reason} challengeId="infinite-scroll-pricing" />}
      </div>
    </>
  );
}
