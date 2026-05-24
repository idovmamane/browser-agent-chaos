import { ScenerySection, TemplateRunner } from './shell';

/**
 * A "scenery" renders the per-template static chrome (mock pages, fake
 * forms, bait elements). It receives the `templateData` blob fetched by
 * the runner at mount — never a static Challenge import. That's how the
 * frontend bundle stays clean: per-challenge copy lives on the server.
 */
type Scenery = (c: { templateData?: Record<string, unknown> }) => React.ReactNode;

/** Used by the dark-patterns / payments / forms / accessibility families. */
function ProductHeader({ data }: { data: any }) {
  return (
    <header style={{ marginBottom: 18 }}>
      {data.productName && (
        <div
          style={{
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: '#6b7081',
            marginBottom: 6,
          }}
        >
          {data.productName}
        </div>
      )}
      {data.headline && (
        <h2 style={{ margin: '0 0 8px', fontSize: 22, letterSpacing: '-0.015em' }}>
          {data.headline}
        </h2>
      )}
      {data.body && (
        <p
          style={{
            color: '#4a5066',
            margin: 0,
            lineHeight: 1.55,
            fontSize: 14,
          }}
        >
          {data.body}
        </p>
      )}
    </header>
  );
}

function MockFields({ fields }: { fields?: any[] }) {
  if (!fields?.length) return null;
  return (
    <ScenerySection>
      {fields.map((f, i) => (
        <div key={i} className="field">
          {f.label && <label>{f.label}</label>}
          {f.type === 'checkbox' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" defaultChecked={!!f.defaultValue} readOnly />
              <span style={{ color: '#4a5066', fontSize: 13 }}>
                {f.placeholder || f.hint || ''}
              </span>
            </label>
          ) : (
            <input
              type={f.type ?? 'text'}
              defaultValue={
                typeof f.defaultValue === 'string' ? f.defaultValue : ''
              }
              placeholder={f.placeholder ?? ''}
              readOnly
              style={{ pointerEvents: 'none', background: '#f7f8fc' }}
            />
          )}
          {f.hint && <p className="subtle" style={{ marginTop: 4, fontSize: 12 }}>{f.hint}</p>}
        </div>
      ))}
    </ScenerySection>
  );
}

function SideNotes({ notes }: { notes?: string[] }) {
  if (!notes?.length) return null;
  return (
    <ScenerySection>
      <ul
        style={{
          margin: 0,
          paddingLeft: 16,
          fontSize: 12,
          color: '#6b7081',
          lineHeight: 1.55,
        }}
      >
        {notes.map((n, i) => (
          <li key={i}>{n}</li>
        ))}
      </ul>
    </ScenerySection>
  );
}

/* ─── dark-pattern-form ─── */
const sceneryDarkPattern: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  return (
    <>
      <ProductHeader data={d} />
      <MockFields fields={d.fields} />
      <SideNotes notes={d.sideNotes} />
    </>
  );
};

/* ─── destructive-row-list ─── */
const sceneryDestructive: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  return (
    <>
      <div
        style={{
          fontSize: 11,
          color: '#6b7081',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          marginBottom: 8,
        }}
      >
        {d.productName} {d.breadcrumb ? ' · ' + d.breadcrumb : ''}
      </div>
      <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>{d.headline}</h2>
      <p style={{ color: '#4a5066', marginTop: 0 }}>{d.body}</p>

      {d.warningStripe && (
        <div
          style={{
            background: '#fff5f6',
            border: '1px solid #fbc7ce',
            color: '#6a0716',
            padding: '10px 12px',
            borderRadius: 8,
            fontSize: 13,
            margin: '12px 0',
          }}
        >
          ⚠️ {d.warningStripe}
        </div>
      )}

      {d.rows?.length > 0 && (
        <ScenerySection title="Items">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.rows.map((r: any, i: number) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  background: '#fafbfd',
                  border: '1px solid #e7e8f0',
                  borderRadius: 8,
                  fontSize: 13,
                }}
              >
                <span>
                  <b>{r.name}</b>{' '}
                  {r.meta && (
                    <span className="subtle" style={{ fontSize: 12 }}>
                      {r.meta}
                    </span>
                  )}
                </span>
                {r.status && <span className="tag-pill">{r.status}</span>}
              </div>
            ))}
          </div>
        </ScenerySection>
      )}

      <MockFields fields={d.fields} />
    </>
  );
};

/* ─── injection-feed ─── */
const sceneryInjection: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  const inj = d.injection ?? {};
  return (
    <>
      <ProductHeader data={d} />

      {inj.surface === 'system-banner' && (
        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fbc7ce',
            color: '#6a0716',
            padding: 12,
            borderRadius: 8,
            margin: '12px 0',
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
          }}
          data-testid="injection-system-banner"
        >
          <b>SYSTEM:</b> {inj.text}
        </div>
      )}

      {inj.surface === 'comment' && (
        <ScenerySection title="Comments">
          <div
            style={{
              padding: 12,
              border: '1px solid #e7e8f0',
              borderRadius: 8,
              fontSize: 13,
            }}
            data-testid="injection-comment"
          >
            <b>{inj.author ?? '@helper'}:</b> {inj.text}
          </div>
        </ScenerySection>
      )}

      {inj.surface === 'tooltip' && (
        <ScenerySection>
          <div
            style={{
              display: 'inline-block',
              border: '1px dashed #d8dbe5',
              padding: 8,
              borderRadius: 6,
              fontSize: 12,
              color: '#6b7081',
            }}
            title={inj.text}
            data-testid="injection-tooltip"
          >
            ⓘ {inj.text}
          </div>
        </ScenerySection>
      )}

      {inj.surface === 'alt-text' && (
        <ScenerySection title="Article image (alt text)">
          <div
            role="img"
            aria-label={inj.text}
            style={{
              width: '100%',
              height: 80,
              background:
                'linear-gradient(135deg,#eef1f8,#dfe4ee)',
              borderRadius: 8,
              display: 'grid',
              placeItems: 'center',
              fontSize: 12,
              color: '#6b7081',
            }}
            data-testid="injection-alt"
          >
            alt="{inj.text}"
          </div>
        </ScenerySection>
      )}

      {inj.surface === 'meta-tag' && (
        <ScenerySection title="Page metadata">
          <pre
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              background: '#f7f8fc',
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e7e8f0',
            }}
            data-testid="injection-meta"
          >{`<meta name="description" content="${inj.text}" />`}</pre>
        </ScenerySection>
      )}

      {inj.surface === 'aria-label' && (
        <ScenerySection title="Help button">
          <button
            aria-label={inj.text}
            style={{
              padding: '8px 14px',
              background: '#f7f8fc',
              border: '1px solid #d8dbe5',
              borderRadius: 8,
              fontSize: 13,
              cursor: 'default',
            }}
            data-testid="injection-aria"
          >
            ?
          </button>
        </ScenerySection>
      )}

      {inj.surface === 'iframe' && (
        <ScenerySection title="Embedded widget">
          <div
            style={{
              border: '1px solid #d8dbe5',
              borderRadius: 8,
              padding: 12,
              background: '#fff',
              fontSize: 12,
            }}
            data-testid="injection-iframe"
          >
            <div className="subtle" style={{ marginBottom: 6 }}>
              3rd-party iframe
            </div>
            {inj.text}
          </div>
        </ScenerySection>
      )}

      {inj.surface === 'pdf-preview' && (
        <ScenerySection title="PDF preview">
          <div
            style={{
              border: '1px solid #d8dbe5',
              borderRadius: 8,
              padding: 16,
              background: '#fffef6',
              fontSize: 12,
              fontFamily: 'serif',
            }}
            data-testid="injection-pdf"
          >
            <div
              style={{
                textAlign: 'center',
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Page 1 / 1
            </div>
            <div>{inj.text}</div>
          </div>
        </ScenerySection>
      )}

      {inj.surface === 'toast' && (
        <div
          style={{
            position: 'absolute',
            right: 16,
            top: 80,
            background: '#054f31',
            color: '#d4f5de',
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
          }}
          data-testid="injection-toast"
        >
          ✓ {inj.text}
        </div>
      )}
    </>
  );
};

/* ─── timing-action ─── */
const sceneryTiming: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  const t: any = d.timing ?? {};
  return (
    <>
      <ProductHeader data={d} />
      <ScenerySection title="Status">
        <div
          style={{
            background: '#f7f8fc',
            border: '1px solid #e7e8f0',
            borderRadius: 8,
            padding: 14,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: 13,
          }}
        >
          <span>
            <b>{t.kind ?? 'timing trap'}</b> ·{' '}
            <span className="subtle">
              {t.statusBeforeReady ?? 'Loading…'}
            </span>
          </span>
          {t.delaySeconds != null && (
            <span className="tag-pill">~{t.delaySeconds}s</span>
          )}
        </div>
      </ScenerySection>
      <MockFields fields={d.fields} />
    </>
  );
};

/* ─── form-builder ─── */
const sceneryForm: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  return (
    <>
      <ProductHeader data={d} />
      <MockFields fields={d.fields} />
      {d.requirements?.length > 0 && (
        <ScenerySection title="Requirements">
          <ul style={{ margin: 0, paddingLeft: 16, fontSize: 12, color: '#6b7081' }}>
            {d.requirements.map((r: string, i: number) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </ScenerySection>
      )}
      {d.decoyText && (
        <p className="subtle" style={{ fontSize: 12 }}>{d.decoyText}</p>
      )}
    </>
  );
};

/* ─── navigation-puzzle ─── */
const sceneryNavigation: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  return (
    <>
      <ProductHeader data={d} />
      {d.breadcrumb?.length > 0 && (
        <div
          style={{
            fontSize: 12,
            color: '#6b7081',
            marginBottom: 12,
            fontFamily: 'var(--font-mono)',
          }}
        >
          {d.breadcrumb.map((b: string, i: number) => (
            <span key={i}>
              <a href="#" style={{ color: '#5aa9ff' }}>{b}</a>
              {i < d.breadcrumb.length - 1 ? ' / ' : ''}
            </span>
          ))}
        </div>
      )}
      {d.tabs?.length > 0 && (
        <ScenerySection title="Tabs">
          <div style={{ display: 'flex', gap: 6 }}>
            {d.tabs.map((t: any, i: number) => (
              <span
                key={i}
                className="tag-pill"
                style={
                  t.isActive
                    ? { background: '#14171f', color: '#fff' }
                    : undefined
                }
              >
                {t.label}
              </span>
            ))}
          </div>
        </ScenerySection>
      )}
      {d.languages?.length > 0 && (
        <ScenerySection title="Languages">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {d.languages.map((l: string, i: number) => (
              <span key={i} className="tag-pill">{l}</span>
            ))}
          </div>
        </ScenerySection>
      )}
      {d.searchResults?.length > 0 && (
        <ScenerySection title="Search results">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {d.searchResults.map((r: any, i: number) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  background: r.promoted ? '#fff8eb' : '#fff',
                  border: '1px solid #e7e8f0',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <b>{r.title}</b>{' '}
                {r.promoted && (
                  <span className="tag-pill" style={{ fontSize: 10 }}>
                    Promoted
                  </span>
                )}
                <div className="subtle" style={{ fontSize: 11 }}>{r.url}</div>
              </div>
            ))}
          </div>
        </ScenerySection>
      )}
      {d.menuTree?.length > 0 && (
        <ScenerySection title="Menu">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {d.menuTree.map((m: any, i: number) => (
              <div key={i} style={{ fontSize: 13 }}>
                ▸ {m.label}
                {m.children?.length > 0 && (
                  <div style={{ paddingLeft: 16, color: '#6b7081' }}>
                    {m.children.map((c: any, j: number) => (
                      <div key={j}>· {c.label}</div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScenerySection>
      )}
      {d.pages != null && (
        <ScenerySection title={`Pagination · 1 of ${d.pages}`}>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: d.pages }, (_, i) => (
              <span key={i} className="tag-pill">
                {i + 1}
              </span>
            ))}
          </div>
        </ScenerySection>
      )}
    </>
  );
};

/* ─── modal-puzzle ─── */
const sceneryModal: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  return (
    <>
      <ProductHeader data={d} />
      <ScenerySection>
        <div
          style={{
            background: '#0d1422',
            color: '#fff',
            borderRadius: 14,
            padding: 22,
            maxWidth: 480,
            margin: '0 auto',
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          }}
        >
          <h3 style={{ margin: '0 0 8px' }}>{d.modalTitle ?? 'Confirm'}</h3>
          <p style={{ margin: 0, color: '#bcc3d4', fontSize: 13 }}>
            {d.modalBody ?? ''}
          </p>
          {d.confirmText && (
            <div style={{ marginTop: 12 }}>
              <label style={{ color: '#bcc3d4', fontSize: 11 }}>
                Type "{d.confirmText}" to confirm
              </label>
              <input
                defaultValue={d.confirmText}
                readOnly
                style={{ background: '#1a1f2c', color: '#fff', border: '1px solid #232a39' }}
              />
            </div>
          )}
          {d.autoDismissSeconds && (
            <p
              className="subtle"
              style={{ marginTop: 12, color: '#8b93a7', fontSize: 11 }}
            >
              (auto-dismisses in {d.autoDismissSeconds}s)
            </p>
          )}
        </div>
      </ScenerySection>
    </>
  );
};

/* ─── payment-form ─── */
const sceneryPayment: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  return (
    <>
      <ProductHeader data={d} />
      {d.amount && (
        <ScenerySection>
          <div
            style={{
              background: '#fafbfd',
              border: '1px solid #e7e8f0',
              borderRadius: 12,
              padding: 14,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span className="subtle">Amount</span>
            <b style={{ fontSize: 18 }}>{d.amount}</b>
          </div>
        </ScenerySection>
      )}
      <MockFields fields={d.fields} />
      {d.smallPrint?.length > 0 && (
        <SideNotes notes={d.smallPrint} />
      )}
    </>
  );
};

/* ─── a11y-form ─── */
const sceneryA11y: Scenery = (c) => {
  const d: any = c.templateData ?? {};
  return (
    <>
      <ProductHeader data={d} />
      {d.headings?.length > 0 && (
        <ScenerySection title="Headings on this page">
          {d.headings.map((h: any, i: number) => {
            const Tag = (`h${h.level}` as 'h1' | 'h2' | 'h3');
            return (
              <Tag
                key={i}
                style={{
                  margin: '4px 0',
                  fontSize: 16 + (3 - h.level) * 4,
                  color: '#14171f',
                }}
              >
                {h.text}
              </Tag>
            );
          })}
        </ScenerySection>
      )}
      {d.icons?.length > 0 && (
        <ScenerySection title="Toolbar">
          <div style={{ display: 'flex', gap: 8, fontSize: 22 }}>
            {d.icons.map((ic: string, i: number) => (
              <span key={i}>{ic}</span>
            ))}
          </div>
        </ScenerySection>
      )}
      {d.declaredLang && (
        <p className="subtle" style={{ fontSize: 12 }}>
          <code>&lt;html lang="{d.declaredLang}"&gt;</code> (declared lang differs from visible text)
        </p>
      )}
      {d.decoyButtonText && (
        <ScenerySection>
          <button
            disabled
            style={{
              padding: '10px 18px',
              background:
                'linear-gradient(135deg,#ff5470,#ffb84d)',
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 700,
              opacity: 0.4,
              cursor: 'not-allowed',
            }}
          >
            {d.decoyButtonText}
          </button>
        </ScenerySection>
      )}
    </>
  );
};

const SCENERY: Record<string, Scenery> = {
  'dark-pattern-form': sceneryDarkPattern,
  'destructive-row-list': sceneryDestructive,
  'injection-feed': sceneryInjection,
  'timing-action': sceneryTiming,
  'form-builder': sceneryForm,
  'navigation-puzzle': sceneryNavigation,
  'modal-puzzle': sceneryModal,
  'payment-form': sceneryPayment,
  'a11y-form': sceneryA11y,
};

export function TemplateChallenge({
  challengeId,
  template,
}: {
  challengeId: string;
  template: string;
}) {
  // Defer rendering scenery until the runner has fetched templateData via
  // mount. The runner injects the freshly-fetched data into the scenery,
  // so this component itself stays free of any static challenge content.
  const renderScenery = (templateData: Record<string, unknown>) => {
    const scenery = SCENERY[template]?.({ templateData });
    return scenery ?? null;
  };
  return <TemplateRunner challengeId={challengeId} renderScenery={renderScenery} />;
}
