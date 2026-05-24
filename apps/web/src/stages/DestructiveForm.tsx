import { useState } from 'react';
import type { StageProps } from './StageRunner';

interface FieldText {
  id: string;
  label: string;
  kind: 'text';
  defaultValue?: string;
  readOnly?: boolean;
}
interface FieldCheckbox {
  id: string;
  label: string;
  kind: 'checkbox';
  defaultValue?: boolean;
}
interface FieldRadio {
  id: string;
  label: string;
  kind: 'radio';
  defaultValue?: string;
  options: { value: string; label: string }[];
}
type Field = FieldText | FieldCheckbox | FieldRadio;

interface Btn {
  id: string;
  label: string;
  danger?: boolean;
  primary?: boolean;
}

/**
 * A form with mixed input kinds + a row of buttons. Every meaningful change
 * fires an `input`/`check`/`select` event so the server checker can validate
 * the final state. Buttons fire `click`.
 */
export function DestructiveFormStage({ data, emit }: StageProps) {
  const fields: Field[] = data.fields ?? [];
  const buttons: Btn[] = data.buttons ?? [];

  // Mirror the field defaults locally so React renders controlled inputs.
  // The server still tracks the canonical value via /interact.
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields
        .filter((f): f is FieldText => f.kind === 'text')
        .map((f) => [f.id, f.defaultValue ?? '']),
    ),
  );
  const [checks, setChecks] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      fields
        .filter((f): f is FieldCheckbox => f.kind === 'checkbox')
        .map((f) => [f.id, f.defaultValue ?? false]),
    ),
  );
  const [radios, setRadios] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields
        .filter((f): f is FieldRadio => f.kind === 'radio')
        .map((f) => [f.id, f.defaultValue ?? '']),
    ),
  );

  return (
    <div data-bac-stage="destructive-form">
      <ProductHeader data={data} />
      {data.warningStripe && (
        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fbc7ce',
            color: '#6a0716',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            margin: '10px 0',
          }}
        >
          ⚠️ {String(data.warningStripe)}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map((f) => {
          if (f.kind === 'text') {
            return (
              <div key={f.id} className="field">
                <label htmlFor={`bac-${f.id}`}>{f.label}</label>
                <input
                  id={`bac-${f.id}`}
                  data-bac={f.id}
                  data-testid={`bac-${f.id}`}
                  type="text"
                  value={values[f.id] ?? ''}
                  readOnly={f.readOnly === true}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.id]: e.target.value }))
                  }
                  onBlur={(e) => emit(f.id, 'input', e.target.value, e.isTrusted ?? true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      emit(f.id, 'input', (e.target as HTMLInputElement).value, e.isTrusted);
                    }
                  }}
                />
              </div>
            );
          }
          if (f.kind === 'checkbox') {
            return (
              <div key={f.id} className="field">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    id={`bac-${f.id}`}
                    data-bac={f.id}
                    data-testid={`bac-${f.id}`}
                    type="checkbox"
                    checked={checks[f.id] ?? false}
                    onChange={(e) => {
                      const v = e.target.checked;
                      setChecks((c) => ({ ...c, [f.id]: v }));
                      emit(f.id, 'check', v, e.isTrusted ?? true);
                    }}
                  />
                  {f.label}
                </label>
              </div>
            );
          }
          // radio
          return (
            <div key={f.id} className="field">
              <div style={{ fontSize: 13, color: '#3a4257', marginBottom: 6 }}>
                {f.label}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {f.options.map((o) => (
                  <label
                    key={o.value}
                    style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    <input
                      type="radio"
                      name={f.id}
                      data-bac={`${f.id}/${o.value}`}
                      data-testid={`bac-${f.id}-${o.value}`}
                      checked={radios[f.id] === o.value}
                      onChange={(e) => {
                        setRadios((r) => ({ ...r, [f.id]: o.value }));
                        emit(f.id, 'select', o.value, e.isTrusted ?? true);
                      }}
                    />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {buttons.map((b) => (
          <button
            key={b.id}
            data-bac={b.id}
            data-testid={`bac-${b.id}`}
            className={
              b.danger
                ? 'button-danger'
                : b.primary
                  ? 'button-primary'
                  : 'button-secondary'
            }
            onClick={(e) => emit(b.id, 'click', undefined, e.isTrusted)}
          >
            {b.label}
          </button>
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
