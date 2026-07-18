import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// Axios instance with auth token
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL.replace(/\/$/, '') + '/api' : '/api' });
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('aotms_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

const GREEN      = '#25D366';
const DARK_GREEN = '#128C7E';
const PURPLE     = '#5b3fc7';
const TEXT_MAIN  = '#2d2d6b';
const TEXT_MUTED = '#888';
const BORDER     = '#e5e2f5';
const BG         = '#f8f7ff';

const NAV_ITEMS = [
  { key: 'inbox', label: 'Inbox',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> },
  { key: 'broadcasts', label: 'Broadcasts',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 8.5c0 2.5-1.5 4.5-3.5 5.5L22 21H16l-1.5-3h-5L8 21H2l3.5-7C3.5 13 2 11 2 8.5 2 5.5 4.5 3 8 3h8c3.5 0 6 2.5 6 5.5z"/></svg> },
  { key: 'templates',  label: 'Templates',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg> },
  { key: 'lists',      label: 'Lists',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg> },
  { key: 'interactive',label: 'Interactive',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" y1="10" x2="15" y2="10"/></svg> },
  { key: 'analytics',  label: 'Analytics',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg> },
  { key: 'setup',      label: 'Setup',
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg> },
];

// ── Hamburger Menu (TeleCRM-style dropdown) ───────────────────────────────────
function HamburgerMenu({ activeTab, onSelect }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(p => !p)}
        title="Menu"
        style={{
          width: 34, height: 34, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 4,
          background: open ? '#f0ecff' : '#fff',
          border: `1.5px solid ${open ? PURPLE : BORDER}`,
          borderRadius: 8, cursor: 'pointer', padding: 0, transition: 'all 0.15s',
        }}
      >
        {[0,1,2].map(i => (
          <span key={i} style={{ display: 'block', width: 15, height: 2, background: open ? PURPLE : '#555', borderRadius: 2 }} />
        ))}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 40, left: 0,
          background: '#fff', border: `1px solid ${BORDER}`,
          borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          zIndex: 400, minWidth: 200, overflow: 'hidden',
          animation: 'fadeDown 0.12s ease',
        }}>
          <style>{`@keyframes fadeDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {NAV_ITEMS.map((item, idx) => (
            <button key={item.key}
              onClick={() => { onSelect(item.key); setOpen(false); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 16px',
                background: activeTab === item.key ? '#f0fdf4' : '#fff',
                color: activeTab === item.key ? DARK_GREEN : TEXT_MAIN,
                border: 'none',
                borderBottom: idx < NAV_ITEMS.length - 1 ? `1px solid #f5f5f5` : 'none',
                cursor: 'pointer', fontSize: 13,
                fontWeight: activeTab === item.key ? 700 : 500,
                textAlign: 'left', transition: 'background 0.1s',
              }}
              onMouseEnter={e => { if (activeTab !== item.key) e.currentTarget.style.background = BG; }}
              onMouseLeave={e => { if (activeTab !== item.key) e.currentTarget.style.background = '#fff'; }}
            >
              <span style={{ color: activeTab === item.key ? GREEN : '#aaa', flexShrink: 0, display: 'flex' }}>{item.icon}</span>
              {item.label}
              {activeTab === item.key && <span style={{ marginLeft: 'auto', width: 7, height: 7, borderRadius: '50%', background: GREEN }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Add Template Form ─────────────────────────────────────────────────────────
function AddTemplateForm({ onCancel, onSave, integrationId }) {
  const [name, setName]           = useState('');
  const [type, setType]           = useState('Marketing');
  const [language, setLanguage]   = useState('English');
  const [headerType, setHeaderType] = useState('Text');
  const [headerText, setHeaderText] = useState('');
  const [mediaFile, setMediaFile]   = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [message, setMessage]     = useState('');
  const [footer, setFooter]       = useState('');
  const [buttons, setButtons]     = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const fileRef = useRef(null);

  const hasUnsavedChanges = Boolean(
    name.trim() || headerText.trim() || mediaFile || message.trim() || footer.trim() || buttons.length > 0
  );

  const handleCancelClick = () => {
    if (hasUnsavedChanges) {
      setShowDiscardConfirm(true);
    } else {
      onCancel();
    }
  };

  const addVariable = (setter) => setter(p => p + ' {{' + (p.match(/\{\{(\d+)\}\}/g)?.length + 1 || 1) + '}}');

  const addButton = (btnType) => {
    if (buttons.length >= 3) return;
    setButtons(p => [...p, { type: btnType, text: '', value: '' }]);
  };
  const removeButton = (i) => setButtons(p => p.filter((_, idx) => idx !== i));
  const updateButton = (i, field, val) => setButtons(p => p.map((b, idx) => idx === i ? { ...b, [field]: val } : b));

  const handleMedia = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setMediaFile(f);
    const reader = new FileReader();
    reader.onload = ev => setMediaPreview(ev.target.result);
    reader.readAsDataURL(f);
  };

  // Live preview text
  const previewBody = message.replace(/\{\{(\d+)\}\}/g, (_, n) => `[Variable ${n}]`);
  const previewHeader = headerType === 'Text' ? headerText : null;

  return (
    <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
      {/* Form */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: TEXT_MAIN, marginBottom: 24 }}>Add Template</div>

        {/* Name + Type + Language row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px 160px', gap: 16, marginBottom: 20 }}>
          <div>
            <label style={labelStyle}>Template Name <span style={{ color: '#e53e3e' }}>*</span></label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Enter template name"
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={type} onChange={e => setType(e.target.value)} style={inputStyle}>
              <option>Marketing</option><option>Utility</option><option>Authentication</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Language</label>
            <select value={language} onChange={e => setLanguage(e.target.value)} style={inputStyle}>
              <option>English</option><option>Hindi</option><option>Telugu</option><option>Tamil</option>
            </select>
          </div>
        </div>

        {/* Header Type */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Header Type</label>
          <select value={headerType} onChange={e => { setHeaderType(e.target.value); setMediaFile(null); setMediaPreview(null); }} style={{ ...inputStyle, maxWidth: 320 }}>
            <option value="Text">Text</option>
            <option value="Media">Media (Image / Video / Document)</option>
            <option value="None">None</option>
          </select>
        </div>

        {/* Header content */}
        {headerType === 'Text' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>Header Text <span style={{ color: '#e53e3e' }}>*</span></label>
              <button onClick={() => addVariable(setHeaderText)} style={varBtnStyle}>+ Add variable</button>
            </div>
            <input value={headerText} onChange={e => setHeaderText(e.target.value)} placeholder="Enter header text"
              style={inputStyle} maxLength={60} />
            <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 3 }}>{headerText.length}/60</div>
          </div>
        )}

        {headerType === 'Media' && (
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Upload Media <span style={{ color: '#e53e3e' }}>*</span></label>
            <div
              onClick={() => fileRef.current.click()}
              style={{
                border: `2px dashed ${mediaFile ? GREEN : BORDER}`,
                borderRadius: 10, padding: '22px 16px', textAlign: 'center',
                cursor: 'pointer', background: mediaFile ? '#f0fdf4' : '#fafafa',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (!mediaFile) e.currentTarget.style.borderColor = PURPLE; }}
              onMouseLeave={e => { if (!mediaFile) e.currentTarget.style.borderColor = BORDER; }}
            >
              {mediaPreview ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                  {mediaFile?.type?.startsWith('image') ? (
                    <img src={mediaPreview} alt="preview" style={{ height: 80, maxWidth: 160, objectFit: 'cover', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
                  ) : (
                    <div style={{ fontSize: 40 }}>📎</div>
                  )}
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_MAIN }}>{mediaFile.name}</div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED }}>{(mediaFile.size / 1024).toFixed(1)} KB</div>
                    <button onClick={e => { e.stopPropagation(); setMediaFile(null); setMediaPreview(null); }}
                      style={{ marginTop: 6, fontSize: 11, color: '#e53e3e', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      ✕ Remove
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="1.5" style={{ marginBottom: 8 }}>
                    <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_MAIN, marginBottom: 3 }}>Click to upload image, video or document</div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED }}>JPG, PNG, MP4, PDF · Max 16 MB</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*,.pdf,.doc,.docx" style={{ display: 'none' }} onChange={handleMedia} />
          </div>
        )}

        {/* Message */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>Message <span style={{ color: '#e53e3e' }}>*</span></label>
            <button onClick={() => addVariable(setMessage)} style={varBtnStyle}>+ Add variable</button>
          </div>
          <textarea value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Enter body text" rows={5}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 3 }}>{message.length}/1024</div>
        </div>

        {/* Footer */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Footer</label>
          <input value={footer} onChange={e => setFooter(e.target.value)} placeholder="Enter footer text (optional)"
            style={inputStyle} maxLength={60} />
        </div>

        {/* Buttons */}
        <div style={{ marginBottom: 28 }}>
          <label style={labelStyle}>Button(s)</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: TEXT_MUTED, alignSelf: 'center', marginRight: 4 }}>Add:</span>
            {[
              { type: 'Quick Reply',   icon: '🔘' },
              { type: 'Phone Number', icon: '📞' },
              { type: 'Coupon Code',  icon: '🏷️' },
              { type: 'URL',          icon: '🔗' },
            ].map(b => (
              <button key={b.type} onClick={() => addButton(b.type)}
                disabled={buttons.length >= 3}
                style={{
                  padding: '6px 14px', borderRadius: 20, border: `1.5px solid ${PURPLE}`,
                  background: '#f0ecff', color: PURPLE, fontSize: 12, fontWeight: 600,
                  cursor: buttons.length >= 3 ? 'not-allowed' : 'pointer',
                  opacity: buttons.length >= 3 ? 0.5 : 1,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                {b.icon} {b.type}
              </button>
            ))}
          </div>
          {buttons.map((btn, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8, background: BG, borderRadius: 8, padding: '10px 12px' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: PURPLE, minWidth: 90, flexShrink: 0 }}>{btn.type}</span>
              <input placeholder="Button text" value={btn.text} onChange={e => updateButton(i, 'text', e.target.value)}
                style={{ ...inputStyle, flex: 1, marginBottom: 0, padding: '7px 10px', fontSize: 12 }} />
              {(btn.type === 'URL' || btn.type === 'Phone Number') && (
                <input placeholder={btn.type === 'URL' ? 'https://...' : '+91...'}
                  value={btn.value} onChange={e => updateButton(i, 'value', e.target.value)}
                  style={{ ...inputStyle, flex: 1, marginBottom: 0, padding: '7px 10px', fontSize: 12 }} />
              )}
              <button onClick={() => removeButton(i)} style={{ background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}>×</button>
            </div>
          ))}
        </div>

        {/* Error / Success feedback */}
        {submitError && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#e53e3e' }}>
            ⚠️ {submitError}
          </div>
        )}
        {submitSuccess && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#16a34a' }}>
            ✅ {submitSuccess}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={handleCancelClick}
            style={{ padding: '10px 28px', background: '#fff', color: TEXT_MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Cancel
          </button>
          <button
            disabled={submitting}
            onClick={async () => {
              if (!name.trim()) return setSubmitError('Template name is required.');
              if (!message.trim()) return setSubmitError('Message body is required.');
              setSubmitError('');
              setSubmitSuccess('');
              setSubmitting(true);
              try {
                if (integrationId) {
                  // Submit to Meta via backend
                  const res = await api.post(`/integrations/${integrationId}/whatsapp/templates`, {
                    name, category: type, language, headerType, headerText, message, footer, buttons,
                  });
                  setSubmitSuccess(`Template submitted! Status: ${res.data.status || 'PENDING'}. Meta will review within a few minutes.`);
                  onSave({ name, type, language, headerType, headerText, mediaFile, message, footer, buttons, metaId: res.data.metaTemplateId, status: res.data.status || 'PENDING' });
                } else {
                  // No integration yet — save locally only
                  setSubmitSuccess('Template saved locally. Connect your WhatsApp integration in Setup to submit to Meta.');
                  onSave({ name, type, language, headerType, headerText, mediaFile, message, footer, buttons, status: 'LOCAL' });
                }
              } catch (err) {
                const msg = err.response?.data?.message || err.message || 'Submission failed';
                setSubmitError(msg);
              } finally {
                setSubmitting(false);
              }
            }}
            style={{ padding: '10px 28px', background: submitting ? '#a78bfa' : PURPLE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            {submitting && <span style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />}
            {submitting ? 'Submitting...' : 'Submit for review'}
          </button>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>

      {/* Preview panel */}
      <div style={{ width: 280, flexShrink: 0, borderLeft: `1px solid ${BORDER}`, background: '#f0f2f5', padding: 20, overflowY: 'auto' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN, marginBottom: 16 }}>Preview</div>
        <div style={{ background: '#e5ddd5', borderRadius: 12, padding: 12, minHeight: 200, backgroundImage: 'url("data:image/svg+xml,%3Csvg...")', position: 'relative' }}>
          {(headerText || mediaPreview || message || footer || buttons.length > 0) ? (
            <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
              {/* Header */}
              {headerType === 'Media' && mediaPreview && mediaFile?.type?.startsWith('image') && (
                <img src={mediaPreview} alt="" style={{ width: '100%', maxHeight: 140, objectFit: 'cover' }} />
              )}
              {headerType === 'Media' && mediaPreview && !mediaFile?.type?.startsWith('image') && (
                <div style={{ background: '#f0f0f0', padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>📎</span>
                  <span style={{ fontSize: 12, color: TEXT_MUTED }}>{mediaFile?.name}</span>
                </div>
              )}
              {headerType === 'Text' && previewHeader && (
                <div style={{ padding: '10px 12px 4px', fontSize: 13, fontWeight: 700, color: '#111' }}>{previewHeader}</div>
              )}
              {/* Body */}
              {previewBody && (
                <div style={{ padding: '8px 12px', fontSize: 12, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{previewBody}</div>
              )}
              {/* Footer */}
              {footer && (
                <div style={{ padding: '2px 12px 8px', fontSize: 11, color: TEXT_MUTED }}>{footer}</div>
              )}
              {/* Timestamp */}
              <div style={{ padding: '0 10px 6px', textAlign: 'right', fontSize: 10, color: TEXT_MUTED }}>
                {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ✓✓
              </div>
              {/* Buttons */}
              {buttons.length > 0 && (
                <div style={{ borderTop: '1px solid #f0f0f0' }}>
                  {buttons.map((b, i) => (
                    <div key={i} style={{ padding: '9px 12px', textAlign: 'center', fontSize: 12, color: '#0a8dff', fontWeight: 600, borderBottom: i < buttons.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                      {b.text || b.type}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, color: TEXT_MUTED, fontSize: 12, textAlign: 'center' }}>
              Start filling the form<br/>to see a preview
            </div>
          )}
        </div>
      </div>
      {showDiscardConfirm && (
        <div
          onClick={() => setShowDiscardConfirm(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(15,15,25,0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: '32px 36px', width: 400,
              maxWidth: '90vw', textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%', background: '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px',
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_MAIN, marginBottom: 8 }}>Discard your changes?</div>
            <div style={{ fontSize: 13, color: TEXT_MUTED, marginBottom: 24, lineHeight: 1.5 }}>
              Your changes haven't been saved, so you'll lose them if you navigate away.
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowDiscardConfirm(false)}
                style={{ padding: '10px 24px', background: '#fff', color: TEXT_MAIN, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => { setShowDiscardConfirm(false); onCancel(); }}
                style={{ padding: '10px 24px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Discard changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle = { fontSize: 12, fontWeight: 600, color: TEXT_MAIN, display: 'block', marginBottom: 6 };
const inputStyle = { width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', background: '#fff', color: TEXT_MAIN };
const varBtnStyle = { fontSize: 11, color: PURPLE, background: '#f0ecff', border: `1px solid #d6ccff`, borderRadius: 5, padding: '3px 10px', cursor: 'pointer', fontWeight: 600 };

// ── Inbox Tab ──────────────────────────────────────────────────────────────────
// Matches the All / Pending / Intervened lead-inbox reference UI.
//   All         -> every lead that's ever been part of a broadcast or WhatsApp conversation
//   Pending     -> lead replied, no agent response yet
//   Intervened  -> an agent has replied
function InboxTab({ onSendTemplate }) {
  const TABS = [
    { key: 'all', label: 'All' },
    { key: 'pending', label: 'Pending' },
    { key: 'intervened', label: 'Intervened' },
  ];

  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState([]);
  const [counts, setCounts] = useState({ all: 0, pending: 0, intervened: 0 });
  const [loadingList, setLoadingList] = useState(false);

  const [selectedId, setSelectedId] = useState(null);
  const [thread, setThread] = useState(null); // { lead, thread, withinWindow }
  const [loadingThread, setLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);

  const fetchLeads = async () => {
    setLoadingList(true);
    try {
      const res = await api.get('/whatsapp-inbox', { params: { tab, search } });
      setLeads(res.data.leads || []);
      setCounts(res.data.counts || { all: 0, pending: 0, intervened: 0 });
    } catch {
      // swallow — keep prior list on transient errors
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [tab, search]);

  const openThread = async (leadId) => {
    setSelectedId(leadId);
    setLoadingThread(true);
    try {
      const res = await api.get(`/whatsapp-inbox/${leadId}`);
      setThread(res.data);
    } catch {
      setThread(null);
    } finally {
      setLoadingThread(false);
    }
  };

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [thread]);

  const sendReply = async () => {
    if (!replyText.trim() || !selectedId) return;
    setSending(true);
    try {
      await api.post(`/whatsapp-inbox/${selectedId}/reply`, { text: replyText.trim() });
      setReplyText('');
      await openThread(selectedId);   // refresh thread
      await fetchLeads();             // lead may have moved from Pending -> Intervened
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to send reply');
    } finally {
      setSending(false);
    }
  };

  const waStatusDot = (s) => s === 'pending' ? '#f59e0b' : s === 'intervened' ? GREEN : '#ccc';

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Left: tabs + search + lead list */}
      <div style={{ width: 320, borderRight: `1px solid ${BORDER}`, background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div style={{ display: 'flex', borderBottom: `1px solid ${BORDER}` }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => { setTab(t.key); setSelectedId(null); setThread(null); }}
              style={{
                flex: 1, padding: '12px 6px', border: 'none', background: 'none', cursor: 'pointer',
                fontSize: 12.5, fontWeight: tab === t.key ? 700 : 500,
                color: tab === t.key ? DARK_GREEN : TEXT_MUTED,
                borderBottom: `2px solid ${tab === t.key ? GREEN : 'transparent'}`,
                marginBottom: -1, transition: 'all 0.15s',
              }}>
              {t.label} ({counts[t.key] ?? 0})
            </button>
          ))}
        </div>

        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}` }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search lead(s)"
            style={{ ...inputStyle, marginBottom: 0, fontSize: 12.5, padding: '8px 10px' }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingList && <div style={{ padding: 20, textAlign: 'center', color: TEXT_MUTED, fontSize: 12.5 }}>Loading…</div>}
          {!loadingList && leads.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: TEXT_MUTED, fontSize: 12.5 }}>
              No leads in this tab yet.
            </div>
          )}
          {!loadingList && leads.map(lead => (
            <div key={lead._id} onClick={() => openThread(lead._id)}
              style={{
                padding: '12px 14px', cursor: 'pointer',
                background: selectedId === lead._id ? '#f0fdf4' : '#fff',
                borderBottom: '1px solid #f5f5f5', borderLeft: `3px solid ${selectedId === lead._id ? GREEN : 'transparent'}`,
              }}
              onMouseEnter={e => { if (selectedId !== lead._id) e.currentTarget.style.background = BG; }}
              onMouseLeave={e => { if (selectedId !== lead._id) e.currentTarget.style.background = '#fff'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN }}>{lead.name || lead.phone}</span>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: waStatusDot(lead.waStatus), flexShrink: 0 }} />
              </div>
              <div style={{ fontSize: 11.5, color: TEXT_MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lead.lastWaMessagePreview || 'No messages yet'}
              </div>
              <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                {lead.lastWaMessageAt ? new Date(lead.lastWaMessageAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: chat thread */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: '#e9f5ee' }}>
        {!selectedId && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: 13 }}>
            Select a lead to view the conversation
          </div>
        )}

        {selectedId && loadingThread && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, fontSize: 13 }}>
            Loading conversation…
          </div>
        )}

        {selectedId && !loadingThread && thread && (
          <>
            <div style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '12px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_MAIN }}>{thread.lead.name || thread.lead.phone}</div>
              <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>{thread.lead.phone}</div>
            </div>

            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {thread.thread.length === 0 && (
                <div style={{ textAlign: 'center', color: TEXT_MUTED, fontSize: 12.5, marginTop: 40 }}>No messages yet</div>
              )}
              {thread.thread.map((m, i) => {
                const isInbound = m.direction === 'inbound';
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: isInbound ? 'flex-start' : 'flex-end' }}>
                    <div style={{
                      maxWidth: '65%', padding: '8px 12px', borderRadius: 10,
                      background: isInbound ? '#fff' : '#d9fdd3',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
                      fontSize: 13, color: '#111', lineHeight: 1.5,
                    }}>
                      {m.description}
                      <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 4, textAlign: 'right' }}>
                        {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        {m.direction === 'outbound_broadcast' && '  · broadcast'}
                        {m.direction === 'outbound_agent' && '  · agent'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ background: '#fff', borderTop: `1px solid ${BORDER}`, padding: '12px 20px' }}>
              {thread.withinWindow ? (
                <div style={{ display: 'flex', gap: 10 }}>
                  <input value={replyText} onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !sending) sendReply(); }}
                    placeholder="Type a reply…" style={{ ...inputStyle, marginBottom: 0, flex: 1 }} />
                  <button onClick={sendReply} disabled={sending || !replyText.trim()}
                    style={{ padding: '10px 20px', background: sending || !replyText.trim() ? '#ccc' : GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: sending || !replyText.trim() ? 'not-allowed' : 'pointer' }}>
                    {sending ? 'Sending…' : 'Send'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px' }}>
                  <span style={{ fontSize: 12.5, color: '#92400e' }}>
                    You can only send template messages because the 24hr window passed
                  </span>
                  <button onClick={() => onSendTemplate && onSendTemplate(thread.lead)}
                    style={{ padding: '7px 16px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Send Template
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Templates Tab ──────────────────────────────────────────────────────────────
function TemplatesTab() {
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [integrationId, setIntegrationId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [previewId, setPreviewId] = useState(null);
  const [broadcastStats, setBroadcastStats] = useState({});

  useEffect(() => {
    api.get('/broadcasts', { params: { limit: 200 } }).then(res => {
      const list = res.data?.broadcasts || [];
      const stats = {};
      list.forEach(b => {
        const tid = b.template?._id || b.template;
        if (!tid) return;
        stats[tid] = (stats[tid] || 0) + (b.sentCount || 0);
      });
      setBroadcastStats(stats);
    }).catch(() => {});
  }, []);

  const loadTemplates = () => {
    setLoading(true);
    api.get('/message-templates', { params: { type: 'whatsapp' } })
      .then(res => {
        const raw = res.data?.templates || res.data || [];
        setTemplates(raw.map(t => {
          const comps = Array.isArray(t.components) ? t.components : [];
          const header = comps.find(c => c.type === 'HEADER');
          const footerComp = comps.find(c => c.type === 'FOOTER');
          const buttonsComp = comps.find(c => c.type === 'BUTTONS');
          return {
            id: t._id,
            name: t.shortcut,
            category: t.category || 'MARKETING',
            status: t.waStatus || 'LOCAL',
            language: t.language || 'en_US',
            body: t.message,
            rejectedReason: t.rejectedReason,
            headerText: header?.text || '',
            footer: footerComp?.text || '',
            buttons: buttonsComp?.buttons || [],
          };
        }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  // Fetch the active WhatsApp Cloud integration ID on mount, then load templates
  useEffect(() => {
    api.get('/integrations').then(res => {
      const integrations = res.data?.integrations || [];
      const wa = integrations.find(i => i.type === 'whatsapp_cloud' && i.status === 'active');
      if (wa) setIntegrationId(wa._id);
    }).catch(() => {});
    loadTemplates();
  }, []);

  const syncWithMeta = async () => {
    if (!integrationId) return;
    setSyncing(true);
    try {
      await api.post(`/integrations/${integrationId}/whatsapp/templates/sync`);
      loadTemplates();
    } catch {
      // non-fatal — statuses will still update via the approval webhook
    } finally {
      setSyncing(false);
    }
  };

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s) => s === 'APPROVED' ? '#16a34a' : s === 'PENDING' ? '#d97706' : s === 'LOCAL' ? TEXT_MUTED : '#e53e3e';
  const statusBg   = (s) => s === 'APPROVED' ? '#f0fdf4'  : s === 'PENDING' ? '#fffbeb'  : s === 'LOCAL' ? BG : '#fef2f2';

  if (creating) {
    return (
      <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
        {/* Left: template list */}
        <div style={{ width: 280, borderRight: `1px solid ${BORDER}`, background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '16px 14px 10px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN }}>{templates.length} Templates</div>
            <button onClick={() => setCreating(true)}
              style={{ fontSize: 12, color: PURPLE, background: '#f0ecff', border: 'none', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontWeight: 600 }}>
              + Create Template
            </button>
          </div>
          <div style={{ padding: '10px 10px 6px' }}>
            <input placeholder="Search template(s) by name or description" value={search} onChange={e => setSearch(e.target.value)}
              style={{ ...inputStyle, fontSize: 12, padding: '7px 10px' }} />
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {filtered.map(t => {
              const isExpanded = expandedId === t.id;
              return (
                <div key={t.id} style={{ borderBottom: `1px solid #f5f5f5` }}>
                  <div
                    style={{ padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = BG}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                    onClick={() => setExpandedId(isExpanded ? null : t.id)}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: BG, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600, color: TEXT_MAIN }}>{t.name}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, background: statusBg(t.status), color: statusColor(t.status), borderRadius: 4, padding: '1px 6px' }}>{t.category}</span>
                      </div>
                      <div style={{ fontSize: 11, color: TEXT_MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, marginTop: 8, transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }}>
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </div>
                  {isExpanded && (
                    <div style={{ padding: '0 14px 14px 50px', fontSize: 11.5, color: TEXT_MAIN }}>
                      {t.headerText && (
                        <div style={{ marginBottom: 6 }}><strong>Header:</strong> {t.headerText}</div>
                      )}
                      <div style={{ marginBottom: 6, whiteSpace: 'pre-wrap', color: TEXT_MUTED }}>{t.body}</div>
                      {t.footer && (
                        <div style={{ marginBottom: 6, color: TEXT_MUTED }}><strong>Footer:</strong> {t.footer}</div>
                      )}
                      {t.buttons?.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {t.buttons.map((b, i) => (
                            <span key={i} style={{ fontSize: 10.5, background: '#f0ecff', color: PURPLE, borderRadius: 5, padding: '2px 8px', fontWeight: 600 }}>{b.text || b.type}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ marginTop: 6, fontSize: 10.5, color: TEXT_MUTED }}>Language: {t.language}</div>
                      {t.status === 'REJECTED' && t.rejectedReason && (
                        <div style={{ marginTop: 6, color: '#e53e3e' }}>Rejected: {t.rejectedReason}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        {/* Right: Add Template form */}
        <AddTemplateForm
          integrationId={integrationId}
          onCancel={() => setCreating(false)}
          onSave={() => {
            setCreating(false);
            loadTemplates(); // refetch so the real Meta-assigned status (PENDING) shows up
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Left: template list */}
      <div style={{ width: 300, borderRight: `1px solid ${BORDER}`, background: '#fff', display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto' }}>
        <div style={{ padding: '20px 20px 12px' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT_MAIN }}>Message Templates</div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>Pre-approved WhatsApp Business templates</div>
        </div>
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8 }}>
          {integrationId && (
            <button onClick={syncWithMeta} disabled={syncing}
              style={{ flex: 1, padding: '8px 10px', background: '#fff', color: PURPLE, border: `1.5px solid ${PURPLE}`, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer' }}>
              {syncing ? 'Syncing…' : '↻ Sync'}
            </button>
          )}
          <button onClick={() => setCreating(true)}
            style={{ flex: 1, padding: '8px 10px', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Create
          </button>
        </div>
        {!integrationId && (
          <div style={{ margin: '0 16px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', fontSize: 11.5, color: '#92400e' }}>
            No active WhatsApp Cloud integration — templates save locally until you connect one in Setup.
          </div>
        )}
        <div style={{ padding: '0 16px 12px' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search template(s) by name or description"
            style={{ ...inputStyle, fontSize: 12, padding: '8px 10px' }} />
        </div>
        {loading && <div style={{ textAlign: 'center', padding: 30, color: TEXT_MUTED, fontSize: 13 }}>Loading…</div>}
        {!loading && filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 30, color: TEXT_MUTED, fontSize: 13 }}>No templates yet. Create your first one.</div>
        )}
        <div style={{ flex: 1 }}>
          {!loading && filtered.map(t => {
            const isSelected = previewId === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setPreviewId(t.id)}
                style={{
                  padding: '12px 16px', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: 8,
                  borderBottom: `1px solid #f5f5f5`, background: isSelected ? BG : '#fff',
                  borderLeft: isSelected ? `3px solid ${PURPLE}` : '3px solid transparent',
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#fafafa'; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = '#fff'; }}
              >
                <div style={{ width: 28, height: 28, borderRadius: 6, background: BG, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: TEXT_MAIN, marginBottom: 3 }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, background: statusBg(t.status), color: statusColor(t.status), borderRadius: 4, padding: '1px 6px' }}>{t.status === 'LOCAL' ? t.category : t.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: TEXT_MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.body}</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isSelected ? PURPLE : TEXT_MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 8 }}>
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            );
          })}
        </div>
      </div>

      {/* Right: preview panel */}
      <div style={{ flex: 1, overflowY: 'auto', background: BG }}>
        {!previewId ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: TEXT_MUTED, fontSize: 13 }}>
            Select a template on the left to preview it
          </div>
        ) : (
          <TemplatePreviewPanel
            template={templates.find(t => t.id === previewId)}
            sentCount={broadcastStats[previewId] || 0}
          />
        )}
      </div>
    </div>
  );
}

// ── Template preview panel (right-hand side, matches the reference detail view) ──
function TemplatePreviewPanel({ template, sentCount }) {
  if (!template) return null;
  const t = template;

  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fff', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: TEXT_MAIN }}>{t.name}</div>
          <span style={{ fontSize: 10.5, background: '#f0ecff', color: PURPLE, borderRadius: 5, padding: '2px 8px', fontWeight: 700 }}>
            {t.category}-({t.language?.split('_')[0] || 'en'})
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, marginTop: 24, alignItems: 'flex-start' }}>
        {/* WhatsApp bubble render */}
        <div style={{ width: 340, flexShrink: 0, background: '#ece5dd', borderRadius: 16, padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}>
            {t.headerText && (
              <div style={{ padding: '10px 12px 4px', fontSize: 13, fontWeight: 700, color: '#111' }}>{t.headerText}</div>
            )}
            <div style={{ padding: '8px 12px', fontSize: 12.5, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{t.body}</div>
            {t.footer && (
              <div style={{ padding: '2px 12px 8px', fontSize: 11, color: TEXT_MUTED }}>{t.footer}</div>
            )}
            <div style={{ padding: '0 10px 6px', textAlign: 'right', fontSize: 10, color: TEXT_MUTED }}>
              {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} ✓✓
            </div>
            {t.buttons?.length > 0 && (
              <div style={{ borderTop: '1px solid #f0f0f0' }}>
                {t.buttons.map((b, i) => (
                  <div key={i} style={{ padding: '10px 12px', textAlign: 'center', fontSize: 13, color: '#0a8dff', fontWeight: 600, borderBottom: i < t.buttons.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                    {b.text || b.type}
                  </div>
                ))}
              </div>
            )}
          </div>
          {t.status === 'REJECTED' && t.rejectedReason && (
            <div style={{ marginTop: 10, fontSize: 12, color: '#e53e3e', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 10px' }}>
              Rejected: {t.rejectedReason}
            </div>
          )}
        </div>

        {/* Performance */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_MAIN, marginBottom: 14 }}>Performance</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12, marginBottom: 16 }}>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_MAIN }}>{sentCount}</div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4, fontWeight: 600 }}>SENT</div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_MUTED }}>—</div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4, fontWeight: 600 }}>DELIVERED</div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_MUTED }}>—</div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4, fontWeight: 600 }}>READ</div>
            </div>
            <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '16px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_MUTED }}>—</div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4, fontWeight: 600 }}>REPLIED</div>
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: TEXT_MUTED, marginBottom: 20 }}>
            Sent count is totaled from broadcasts using this template. Delivered / Read / Replied require Meta's delivery-status webhooks, which aren't wired up yet.
          </div>
          {t.headerText && (
            <div style={{ marginBottom: 10, fontSize: 12.5 }}><strong style={{ color: TEXT_MAIN }}>Header:</strong> <span style={{ color: TEXT_MUTED }}>{t.headerText}</span></div>
          )}
          {t.footer && (
            <div style={{ marginBottom: 10, fontSize: 12.5 }}><strong style={{ color: TEXT_MAIN }}>Footer:</strong> <span style={{ color: TEXT_MUTED }}>{t.footer}</span></div>
          )}
          <div style={{ fontSize: 12.5, color: TEXT_MUTED }}>Language: {t.language}</div>
        </div>
      </div>
    </div>
  );
}

// ── Broadcasts Tab ─────────────────────────────────────────────────────────────
function BroadcastsTab() {
  const [subTab, setSubTab] = useState('new');
  const [broadcastName, setBroadcastName] = useState('');
  const [template, setTemplate] = useState('');
  const [leadStatus, setLeadStatus] = useState('');
  const [campaign, setCampaign] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [history, setHistory] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [preview, setPreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sendSuccess, setSendSuccess] = useState('');

  useEffect(() => {
    api.get('/message-templates', { params: { type: 'whatsapp' } })
      .then(res => setTemplates(res.data?.templates || res.data || []))
      .catch(() => {});
    api.get('/campaigns')
      .then(res => setCampaigns(res.data?.campaigns || res.data || []))
      .catch(() => {});
  }, []);

  const fetchHistory = () => {
    api.get('/broadcasts').then(res => setHistory(res.data?.broadcasts || [])).catch(() => {});
  };
  useEffect(() => { if (subTab === 'history') fetchHistory(); }, [subTab]);

  const filters = () => ({
    status: leadStatus || undefined,
    campaign: campaign || undefined,
    leadSource: leadSource || undefined,
  });

  const previewAudience = async () => {
    try {
      const res = await api.post('/broadcasts/preview', { filters: filters() });
      setPreview(res.data);
    } catch (err) {
      setSendError(err.response?.data?.message || 'Failed to preview audience');
    }
  };

  const sendBroadcast = async () => {
    setSendError(''); setSendSuccess(''); setSending(true);
    try {
      await api.post('/broadcasts', { name: broadcastName, templateId: template, filters: filters() });
      setSendSuccess('Broadcast sent! Recipients now appear in the WhatsApp Inbox under "All".');
      setBroadcastName(''); setTemplate(''); setPreview(null);
    } catch (err) {
      setSendError(err.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: TEXT_MAIN }}>Broadcasts</div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>Send bulk WhatsApp messages to your lead lists</div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${BORDER}`, marginBottom: 24, marginTop: 16 }}>
        {[{ key: 'new', label: 'New Broadcast' }, { key: 'history', label: 'Broadcast History' }].map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: subTab === t.key ? 700 : 500,
              color: subTab === t.key ? DARK_GREEN : TEXT_MUTED,
              borderBottom: `2px solid ${subTab === t.key ? GREEN : 'transparent'}`,
              marginBottom: -1, transition: 'all 0.15s',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'new' && (
        <div style={{ maxWidth: '100%' }}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Broadcast Name</label>
            <input value={broadcastName} onChange={e => setBroadcastName(e.target.value)}
              placeholder="e.g. July Enrollment Reminder" style={inputStyle} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>WhatsApp Template</label>
            <select value={template} onChange={e => setTemplate(e.target.value)} style={inputStyle}>
              <option value="">Select a template...</option>
              {templates.map(t => <option key={t._id} value={t._id}>{t.shortcut} {t.waStatus && t.waStatus !== 'LOCAL' ? `(${t.waStatus})` : ''}</option>)}
            </select>
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 12 }}>AUDIENCE FILTERS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={labelStyle}>Lead Status</label>
              <select value={leadStatus} onChange={e => setLeadStatus(e.target.value)} style={inputStyle}>
                <option value="">Any status</option>
                <option>Interested</option><option>Not Interested</option><option>Call Back Later</option><option>Enrolled</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Campaign</label>
              <select value={campaign} onChange={e => setCampaign(e.target.value)} style={inputStyle}>
                <option value="">Any campaign</option>
                {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Lead Source</label>
            <input value={leadSource} onChange={e => setLeadSource(e.target.value)} placeholder="e.g. Facebook" style={inputStyle} />
          </div>
          {preview && (
            <div style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12.5, color: TEXT_MAIN }}>
              <strong>{preview.count}</strong> leads match this audience.
              {preview.sample?.length > 0 && (
                <div style={{ color: TEXT_MUTED, marginTop: 4 }}>
                  e.g. {preview.sample.map(s => s.name).join(', ')}
                </div>
              )}
            </div>
          )}
          {sendError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#e53e3e' }}>⚠️ {sendError}</div>
          )}
          {sendSuccess && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: '#16a34a' }}>✅ {sendSuccess}</div>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={previewAudience} style={{ padding: '10px 20px', background: '#fff', color: PURPLE, border: `1.5px solid ${PURPLE}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Preview Audience
            </button>
            <button onClick={sendBroadcast} disabled={!template || !broadcastName || sending}
              style={{ padding: '10px 20px', background: template && broadcastName && !sending ? GREEN : '#ccc', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: template && broadcastName && !sending ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', gap: 7 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              {sending ? 'Sending…' : 'Send Broadcast'}
            </button>
          </div>
        </div>
      )}

      {subTab === 'history' && (
        history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: TEXT_MUTED }}>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.5" style={{ marginBottom: 12 }}>
              <path d="M22 8.5c0 2.5-1.5 4.5-3.5 5.5L22 21H16l-1.5-3h-5L8 21H2l3.5-7C3.5 13 2 11 2 8.5 2 5.5 4.5 3 8 3h8c3.5 0 6 2.5 6 5.5z"/>
            </svg>
            <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_MAIN }}>No broadcasts sent yet</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 4 }}>Your sent broadcasts will appear here.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 10 }}>
            {history.map(b => (
              <div key={b._id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN }}>{b.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, borderRadius: 5, padding: '2px 8px', background: b.status === 'completed' ? '#f0fdf4' : b.status === 'failed' ? '#fef2f2' : '#fffbeb', color: b.status === 'completed' ? '#16a34a' : b.status === 'failed' ? '#e53e3e' : '#d97706' }}>{b.status}</span>
                </div>
                <div style={{ fontSize: 11.5, color: TEXT_MUTED }}>
                  {b.sentCount}/{b.recipientCount} sent · {b.failedCount} failed · {new Date(b.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

// ── Lists Tab ──────────────────────────────────────────────────────────────────
function ListsTab() {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700, color: TEXT_MAIN }}>Contact Lists</div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>Organise your leads into broadcast-ready WhatsApp lists</div>
        </div>
        <button style={{ padding: '9px 18px', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New List</button>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '60px 24px', textAlign: 'center' }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.5" style={{ marginBottom: 14 }}>
          <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
          <circle cx="3" cy="6" r="1" fill={GREEN}/><circle cx="3" cy="12" r="1" fill={GREEN}/><circle cx="3" cy="18" r="1" fill={GREEN}/>
        </svg>
        <div style={{ fontSize: 15, fontWeight: 700, color: TEXT_MAIN, marginBottom: 6 }}>No Lists Yet</div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 18 }}>Create contact lists to send targeted broadcasts.</div>
        <button style={{ padding: '9px 22px', background: GREEN, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>+ New List</button>
      </div>
    </div>
  );
}

// ── Interactive Tab ────────────────────────────────────────────────────────────
function InteractiveTab() {
  const types = [
    { icon: '🔘', title: 'Button Messages', desc: 'Add quick-reply buttons to your messages for easy responses.' },
    { icon: '📋', title: 'List Messages', desc: 'Show a menu of up to 10 options for leads to choose from.' },
    { icon: '⭐', title: 'Star Ratings', desc: 'Collect customer satisfaction scores via star rating prompts.' },
    { icon: '📝', title: 'Form Messages', desc: 'Gather information through multi-step interactive forms.' },
  ];
  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: TEXT_MAIN }}>Interactive Messages</div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>Build engaging two-way conversations with interactive elements</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
        {types.map(t => (
          <div key={t.title} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '22px 20px', cursor: 'pointer', transition: 'box-shadow 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(91,63,199,0.10)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{t.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_MAIN, marginBottom: 6 }}>{t.title}</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, lineHeight: 1.5 }}>{t.desc}</div>
            <button style={{ marginTop: 14, padding: '7px 16px', background: BG, color: PURPLE, border: `1px solid ${BORDER}`, borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Create</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Analytics Tab ──────────────────────────────────────────────────────────────
function AnalyticsTab() {
  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: TEXT_MAIN }}>WhatsApp Analytics</div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>Track message delivery, read rates, and engagement</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[{ label: 'Messages Sent', value: '0', color: PURPLE }, { label: 'Delivered', value: '0%', color: GREEN }, { label: 'Read Rate', value: '0%', color: DARK_GREEN }, { label: 'Replied', value: '0%', color: '#f59e0b' }].map(s => (
          <div key={s.label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 3 }}>{s.label}</div>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT_MUTED }}>No data yet</div>
        <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Send your first broadcast to see analytics here.</div>
      </div>
    </div>
  );
}

// ── Setup Tab ──────────────────────────────────────────────────────────────────
function SetupTab() {
  const steps = [
    { num: 1, title: 'Connect WhatsApp Business Account', desc: 'Link your WhatsApp Business API account via Meta Business Manager.', done: false, action: 'Connect Account' },
    { num: 2, title: 'Verify Phone Number', desc: 'Verify your business phone number to start sending messages.', done: false, action: 'Verify Number' },
    { num: 3, title: 'Set Display Name', desc: 'Set your business display name that appears in WhatsApp chats.', done: false, action: 'Set Name' },
    { num: 4, title: 'Upload Business Profile', desc: 'Add your logo, description, address and business category.', done: false, action: 'Edit Profile' },
    { num: 5, title: 'Configure Webhook', desc: 'Set up webhooks to receive incoming messages and status updates.', done: false, action: 'Configure' },
    { num: 6, title: 'Create First Template', desc: 'Create and submit a message template for Meta approval.', done: false, action: 'Create Template' },
  ];
  const [apiKey, setApiKey] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [accountId, setAccountId] = useState('');
  return (
    <div style={{ padding: 28 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 17, fontWeight: 700, color: TEXT_MAIN }}>WhatsApp Setup</div>
        <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>Configure your WhatsApp Business API connection</div>
      </div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: '6px 0', marginBottom: 24 }}>
        {steps.map((s, i) => (
          <div key={s.num} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', borderBottom: i < steps.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: s.done ? '#f0fdf4' : BG, border: `2px solid ${s.done ? GREEN : BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {s.done ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      : <span style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED }}>{s.num}</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_MAIN }}>{s.title}</div>
              <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 2 }}>{s.desc}</div>
            </div>
            <button style={{ padding: '7px 16px', background: s.done ? BG : GREEN, color: s.done ? TEXT_MUTED : '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
              {s.done ? '✓ Done' : s.action}
            </button>
          </div>
        ))}
      </div>
      <div style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_MAIN, marginBottom: 16 }}>API Configuration</div>
        {[{ label: 'WhatsApp API Token', value: apiKey, setter: setApiKey, placeholder: 'EAAxxxxxxxxxxxxx...', type: 'password' },
          { label: 'Phone Number ID', value: phoneId, setter: setPhoneId, placeholder: '1234567890', type: 'text' },
          { label: 'WhatsApp Business Account ID', value: accountId, setter: setAccountId, placeholder: '9876543210', type: 'text' }
        ].map(f => (
          <div key={f.label} style={{ marginBottom: 14 }}>
            <label style={labelStyle}>{f.label}</label>
            <input type={f.type} value={f.value} onChange={e => f.setter(e.target.value)} placeholder={f.placeholder}
              style={{ ...inputStyle, fontFamily: f.type === 'password' ? 'monospace' : 'inherit' }} />
          </div>
        ))}
        <button style={{ padding: '10px 24px', background: PURPLE, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          Save Configuration
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function WhatsApp() {
  const [activeTab, setActiveTab] = useState('inbox');
  const activeItem = NAV_ITEMS.find(n => n.key === activeTab);

  const renderTab = () => {
    switch (activeTab) {
      case 'inbox':       return <InboxTab onSendTemplate={() => setActiveTab('templates')} />;
      case 'broadcasts':  return <BroadcastsTab />;
      case 'templates':   return <TemplatesTab />;
      case 'lists':       return <ListsTab />;
      case 'interactive': return <InteractiveTab />;
      case 'analytics':   return <AnalyticsTab />;
      case 'setup':       return <SetupTab />;
      default:            return null;
    }
  };

  return (
    <div className="wa-shell" style={{ display: 'flex', flexDirection: 'column', minHeight: 'calc(100vh - 48px)', background: BG, maxWidth: '100%', overflowX: 'hidden' }}>
      <style>{`
        @media (max-width: 640px) {
          .wa-shell [style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
          .wa-brand-text { display: none; }
          .wa-top-header { padding: 0 12px !important; gap: 8px !important; }
        }
      `}</style>

      {/* Top header */}
      <div className="wa-top-header" style={{ background: '#fff', borderBottom: `1px solid ${BORDER}`, padding: '0 24px', minHeight: 56, display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <div style={{ width: 34, height: 34, background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
          </div>
          <div className="wa-brand-text">
            <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN, lineHeight: 1.2 }}>WhatsApp CRM</div>
            <div style={{ fontSize: 10, color: TEXT_MUTED }}>Business API</div>
          </div>
        </div>

        {/* Hamburger — shows 6-item dropdown on click */}
        <HamburgerMenu activeTab={activeTab} onSelect={setActiveTab} />

        <div style={{ width: 1, height: 22, background: BORDER }} />

        {/* Active section breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: GREEN, display: 'flex' }}>{activeItem?.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: TEXT_MAIN }}>{activeItem?.label}</span>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: activeTab === 'inbox' ? 'hidden' : 'auto' }}>
        {renderTab()}
      </div>
    </div>
  );
}