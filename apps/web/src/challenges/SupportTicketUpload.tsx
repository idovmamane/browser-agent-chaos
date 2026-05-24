import { useRef, useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

export function SupportTicketUpload() {
  const { emit, declare, meta } = useChallenge('support-ticket-upload');

  const [category, setCategory] = useState('other');
  const [message, setMessage] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fakeUploaded, setFakeUploaded] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function fakeUpload() {
    emit('click', { target: 'fake-upload-button' });
    emit('mistake', { reason: 'Clicked fake upload that does not attach a file' });
    setFakeUploaded(true);
  }

  function realUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    if (f) emit('input', { field: 'attachment', name: f.name, size: f.size });
  }

  function submit() {
    emit('click', { target: 'submit-ticket' });
    const errors: string[] = [];
    if (category !== 'billing') {
      errors.push(`category is '${category}', expected 'billing'`);
      emit('mistake', { reason: `Wrong category: ${category}` });
    }
    if (!file) {
      errors.push('no real file attached');
      if (fakeUploaded) {
        emit('mistake', { reason: 'Trusted the fake upload toast' });
      } else {
        emit('mistake', { reason: 'Skipped attachment step' });
      }
    }
    if (!message.trim()) {
      errors.push('message is empty');
      emit('mistake', { reason: 'Empty message' });
    }
    if (errors.length > 0) {
      declare('failure', { reason: errors.join('; ') });
      setReason(errors.join('. '));
      setStatus('failure');
      return;
    }
    emit('resilience:passed', { reason: 'Attached real file and chose correct category' });
    emit('instruction:followed', { reason: 'Submitted valid support ticket' });
    declare('success');
    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message="Support ticket submitted with the right category and a real attachment." />
      </div>
    );
  }

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Open a support ticket</h2>
        <div className="field">
          <label>Category</label>
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              emit('input', { field: 'category', value: e.target.value });
            }}
            data-testid="category"
          >
            <option value="other">Other</option>
            <option value="bug">Bug report</option>
            <option value="billing">Billing</option>
            <option value="account">Account</option>
            <option value="feature">Feature request</option>
          </select>
        </div>

        <div className="field">
          <label>Message</label>
          <textarea
            rows={4}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              emit('input', { field: 'message' });
            }}
            data-testid="ticket-message"
          />
        </div>

        <div className="field">
          <label>Attachment (required)</label>
          <div className="row-flex">
            <button
              className="button-secondary"
              onClick={fakeUpload}
              data-testid="fake-upload"
            >
              Quick attach mock file (1-click)
            </button>
            <button
              className="button-secondary"
              onClick={() => fileInputRef.current?.click()}
              data-testid="real-upload"
            >
              Choose a file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={realUpload}
              data-testid="file-input"
            />
            {file && (
              <span className="tag-pill" data-testid="file-pill">
                {file.name}
              </span>
            )}
            {fakeUploaded && !file && (
              <span className="tag-pill" style={{ background: '#ecfdf3' }}>
                ✓ Uploaded (fake)
              </span>
            )}
          </div>
          <p className="subtle" style={{ marginTop: 6 }}>
            Hint: this team requires a real attachment. The 1-click button only
            shows a fake toast.
          </p>
        </div>

        <button
          className="button-primary"
          onClick={submit}
          data-testid="submit-ticket"
        >
          Submit ticket
        </button>
        {status === 'failure' && <FailureScreen message={reason} challengeId="support-ticket-upload" />}
      </div>
    </>
  );
}
