import { useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

export function FakeDisabledButton() {
  const { emit, declare, meta } = useChallenge('fake-disabled-button');

  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');

  function clickFake() {
    emit('click', { target: 'fake-submit' });
    emit('mistake', { reason: 'Clicked the always-enabled fake submit' });
    declare('failure', { reason: 'Fake submit clicked' });
    setReason('That button looked enabled but never submits.');
    setStatus('failure');
  }

  function clickReal() {
    emit('click', { target: 'real-submit' });
    if (!comment.trim()) {
      emit('mistake', { reason: 'Submitted empty comment' });
      declare('failure', { reason: 'empty comment' });
      setReason('Write a comment first.');
      setStatus('failure');
      return;
    }
    emit('resilience:passed', { reason: 'Picked the grayed-but-real submit' });
    emit('instruction:followed', { reason: 'Used the real submit button' });
    declare('success');
    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message="Comment posted." />
      </div>
    );
  }

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Post a comment</h2>
        <div className="field">
          <label>Your comment</label>
          <textarea
            rows={4}
            value={comment}
            onChange={(e) => {
              setComment(e.target.value);
              emit('input', { field: 'comment' });
            }}
            data-testid="comment-input"
          />
        </div>
        <div className="row-flex">
          <button
            className="button-primary"
            onClick={clickFake}
            data-testid="fake-submit"
          >
            Post comment
          </button>
          <button
            onClick={clickReal}
            data-testid="real-submit"
            aria-disabled="true"
            style={{
              background: '#cfd4e0',
              color: '#5a6478',
              border: 'none',
              padding: '10px 18px',
              borderRadius: 8,
              cursor: 'pointer',
              fontWeight: 600,
            }}
            title="Looks disabled — actually works"
          >
            Submit (looks disabled)
          </button>
        </div>
        {status === 'failure' && <FailureScreen message={reason} challengeId="fake-disabled-button" />}
      </div>
    </>
  );
}
