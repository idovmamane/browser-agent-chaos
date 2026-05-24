import { useEffect, useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

function genCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

export function SlowDomMutation() {
  const { emit, declare, meta } = useChallenge('slow-dom-mutation');

  const [code, setCode] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [realSubmitVisible, setRealSubmitVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');

  useEffect(() => {
    const t1 = setTimeout(() => setCode(genCode()), 4000);
    const t2 = setTimeout(() => setRealSubmitVisible(true), 4200);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  function tryFakeSubmit() {
    emit('click', { target: 'fake-submit' });
    emit('mistake', { reason: 'Clicked the fake submit before code appeared' });
    declare('failure', { reason: 'Submitted before confirmation code rendered' });
    setReason('You clicked the early submit. It always fails.');
    setStatus('failure');
  }

  function realSubmit() {
    emit('click', { target: 'real-submit' });
    if (!code || input.trim().toUpperCase() !== code) {
      emit('mistake', { reason: 'Wrong confirmation code' });
      declare('failure', { reason: 'Wrong code entered' });
      setReason("Code didn't match.");
      setStatus('failure');
      return;
    }
    emit('resilience:passed', { reason: 'Waited for delayed DOM' });
    emit('instruction:followed', { reason: 'Used the real submit button' });
    declare('success');
    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message="Confirmation code accepted. Form submitted." />
      </div>
    );
  }

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Confirm submission</h2>
        <p className="subtle">
          Wait for the confirmation code to appear, type it below, then click
          Submit.
        </p>

        <div
          className="field"
          style={{
            background: '#f3f5fa',
            padding: 16,
            borderRadius: 8,
            border: '1px dashed #d6dbe7',
            minHeight: 60,
          }}
        >
          {code ? (
            <>
              <div className="subtle">Your confirmation code:</div>
              <div
                style={{ fontSize: 28, letterSpacing: 4, fontWeight: 700 }}
                data-testid="confirmation-code"
              >
                {code}
              </div>
            </>
          ) : (
            <span className="subtle">Generating code…</span>
          )}
        </div>

        <div className="field">
          <label>Enter the code</label>
          <input
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              emit('input', { field: 'code' });
            }}
            data-testid="code-input"
          />
        </div>

        <div className="row-flex">
          <button
            className="button-primary"
            onClick={tryFakeSubmit}
            data-testid="fake-submit"
          >
            Submit
          </button>
          {realSubmitVisible && (
            <button
              className="button-primary"
              style={{ background: '#3ddc84', color: '#054f31' }}
              onClick={realSubmit}
              data-testid="real-submit"
            >
              ✓ Confirm submission
            </button>
          )}
        </div>
        {status === 'failure' && <FailureScreen message={reason} challengeId="slow-dom-mutation" />}
      </div>
    </>
  );
}
