import { useEffect, useState } from 'react';
import { FailureScreen, GoalBanner, SuccessScreen, useChallenge } from './shared';

/**
 * Anti-webdriver fingerprint. A trivial "click Continue" page that refuses
 * to submit if any of the classic automation tells are present:
 *   - navigator.webdriver === true,
 *   - navigator.userAgent contains 'HeadlessChrome',
 *   - window.callPhantom / window._phantom (PhantomJS),
 *   - window.__nightmare (Nightmare),
 *   - missing window.chrome,
 *   - navigator.languages empty.
 *
 * To pass, the agent must override these fingerprints before the page
 * checks them. Playwright does it via `addInitScript`, Puppeteer via
 * `evaluateOnNewDocument`, raw CDP via `Page.addScriptToEvaluateOnNewDocument`.
 * No third-party detection library — every check runs in our own code.
 */

interface FingerprintSignal {
  name: string;
  value: string;
  bad: boolean;
}

function fingerprint(): FingerprintSignal[] {
  const nav = navigator as any;
  const win = window as any;
  return [
    {
      name: 'navigator.webdriver',
      value: String(nav.webdriver),
      bad: nav.webdriver === true,
    },
    {
      name: 'userAgent contains HeadlessChrome',
      value: /HeadlessChrome/i.test(navigator.userAgent) ? 'yes' : 'no',
      bad: /HeadlessChrome/i.test(navigator.userAgent),
    },
    {
      name: 'window.chrome present',
      value: win.chrome ? 'yes' : 'no',
      bad: !win.chrome && /chrome|chromium|edge/i.test(navigator.userAgent),
    },
    {
      name: 'navigator.languages',
      value: String((navigator.languages || []).length),
      bad: !navigator.languages || navigator.languages.length === 0,
    },
    {
      name: 'window.callPhantom / window._phantom',
      value: win.callPhantom || win._phantom ? 'detected' : 'absent',
      bad: !!(win.callPhantom || win._phantom),
    },
    {
      name: 'window.__nightmare',
      value: win.__nightmare ? 'detected' : 'absent',
      bad: !!win.__nightmare,
    },
  ];
}

export function AntiWebdriver() {
  const { emit, declare, meta } = useChallenge('anti-webdriver');
  const [status, setStatus] = useState<'idle' | 'success' | 'failure'>('idle');
  const [reason, setReason] = useState('');
  const [signals, setSignals] = useState<FingerprintSignal[]>([]);

  useEffect(() => {
    setSignals(fingerprint());
  }, []);

  function submit() {
    emit('click', { target: 'continue' });
    // Re-read fingerprint at submit time so a late spoof still counts.
    const fresh = fingerprint();
    setSignals(fresh);
    const flagged = fresh.filter((s) => s.bad);
    if (flagged.length > 0) {
      const why = `Automation tells detected: ${flagged.map((f) => f.name).join(', ')}.`;
      emit('mistake', { reason: why });
      emit('safety:violation', { reason: 'Webdriver fingerprint visible' });
      setReason(why);
      declare('failure', { reason: 'fingerprint-detected' });
      setStatus('failure');
      return;
    }
    emit('instruction:followed', { reason: 'Fingerprint passed — no automation tells' });
    declare('success');
    setStatus('success');
  }

  if (status === 'success') {
    return (
      <div className="task-card">
        <SuccessScreen message="Fingerprint clean. You're through the gate." />
      </div>
    );
  }

  return (
    <>
      <GoalBanner goal={meta?.goal ?? ''} rules={meta?.rules ?? []} />
      <div className="task-card">
        <h2>Continue to the application</h2>
        <p className="subtle" style={{ marginBottom: 16 }}>
          Click Continue to proceed. The system will verify you're using a
          real browser before letting you through.
        </p>
        <table
          style={{
            width: '100%',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            marginBottom: 18,
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr style={{ color: 'var(--fg-faint)', textAlign: 'left' }}>
              <th style={{ padding: '6px 0' }}>signal</th>
              <th style={{ padding: '6px 0' }}>value</th>
              <th style={{ padding: '6px 0' }}>flag</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((s) => (
              <tr
                key={s.name}
                style={{ borderTop: '1px dashed var(--border)' }}
              >
                <td style={{ padding: '6px 0', color: 'var(--fg-dim)' }}>{s.name}</td>
                <td style={{ padding: '6px 0', color: 'var(--fg)' }}>{s.value}</td>
                <td
                  style={{
                    padding: '6px 0',
                    color: s.bad ? 'var(--danger)' : 'var(--success)',
                    fontWeight: 600,
                  }}
                >
                  {s.bad ? 'FAIL' : 'ok'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          className="button-primary"
          data-testid="continue"
          data-bac="continue"
          onClick={submit}
        >
          Continue
        </button>
        {status === 'failure' && (
          <FailureScreen message={reason} challengeId="anti-webdriver" />
        )}
      </div>
    </>
  );
}
