import { useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

/**
 * File-drop upload. The page rejects clicks on the dropzone — files must
 * arrive via a real `drop` DataTransfer event. The MIME type is
 * verified server-side-feeling: only application/pdf is accepted. There
 * is NO `<input type="file">` fallback by design; the agent has to dispatch
 * a synthetic-but-valid DragEvent with a DataTransfer carrying a File, or
 * simulate a real drop via CDP. Most casual automation will get stuck.
 */

const ACCEPT = 'application/pdf';

export function FileDropUpload() {
  const { emit, declare, meta } = useChallenge('file-drop-upload');
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');
  const [hover, setHover] = useState(false);

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setHover(false);
    emit('click', { target: 'file-drop' });
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length === 0) {
      const why = 'Drop event carried no files.';
      emit('mistake', { reason: why });
      setReason(why);
      declare('failure', { reason: 'no-files' });
      setStatus('failure');
      return;
    }
    const f = files[0];
    if (f.type !== ACCEPT) {
      const why = `File type was "${f.type || '(unknown)'}", expected ${ACCEPT}.`;
      emit('mistake', { reason: why });
      setReason(why);
      declare('failure', { reason: 'wrong-mime' });
      setStatus('failure');
      return;
    }
    if (f.size < 64) {
      const why = `File is only ${f.size} bytes — too small to be a real PDF.`;
      emit('mistake', { reason: why });
      setReason(why);
      declare('failure', { reason: 'too-small' });
      setStatus('failure');
      return;
    }
    emit('instruction:followed', { reason: `Uploaded ${f.name} (${f.size}B, ${f.type})` });
    declare('success');
    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message="PDF received. Upload complete." />
      </div>
    );
  }

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Upload your PDF</h2>
        <p className="subtle" style={{ marginBottom: 16 }}>
          Drag and drop a PDF file onto the zone below. Clicks won't open a
          file picker — there's no input element. Use a real drop event.
        </p>
        <div
          data-bac="file-drop"
          data-testid="file-drop"
          onDragOver={(e) => {
            e.preventDefault();
            if (!hover) setHover(true);
          }}
          onDragLeave={() => setHover(false)}
          onDrop={handleDrop}
          onClick={() => {
            emit('mistake', { reason: 'Clicked the dropzone (no input fallback)' });
            setReason('Clicks are ignored on this dropzone. Use a drag-and-drop.');
            declare('failure', { reason: 'clicked-dropzone' });
            setStatus('failure');
          }}
          style={{
            padding: '36px 24px',
            border: '2px dashed ' + (hover ? 'var(--accent-2)' : 'var(--border-strong)'),
            borderRadius: 12,
            background: hover ? 'rgba(124,58,255,0.08)' : 'var(--bg-elev-1)',
            textAlign: 'center',
            color: 'var(--fg-dim)',
            fontFamily: 'var(--font-mono)',
            fontSize: 14,
            transition: 'background 0.12s ease, border-color 0.12s ease',
            cursor: 'copy',
          }}
        >
          {hover ? 'Release to upload' : 'Drop your PDF here'}
          <div style={{ marginTop: 10, fontSize: 11, color: 'var(--fg-faint)' }}>
            accepted: application/pdf · min 64 bytes
          </div>
        </div>
        {status === 'failure' && (
          <FailureScreen message={reason} challengeId="file-drop-upload" />
        )}
      </div>
    </>
  );
}
