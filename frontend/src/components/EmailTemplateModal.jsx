import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { messageTemplatesAPI } from '../services/api';
import EmailRichEditor from './EmailRichEditor';
import { applyTemplateVariables } from '../utils/emailTemplateUtils';

const PURPLE = 'var(--theme-primary)';
const NAVY = 'var(--theme-text-strong)';
const BORDER = 'var(--theme-border-tint)';

const SAMPLE_DATA = { student_name: 'John Doe', student_email: 'john@example.com', campaign_name: 'Sample Campaign' };

export default function EmailTemplateModal({ onClose, onSaved }) {
  const [shortcut, setShortcut] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canSave = shortcut.trim().length > 0 && subject.trim().length > 0 && body.trim().length > 0;

  const handleSave = async () => {
    if (!canSave || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await messageTemplatesAPI.create({
        type: 'email',
        shortcut: shortcut.trim(),
        subject: subject.trim(),
        message: body,
        bodyFormat: 'html',
        isShared,
      });
      onSaved?.(res.data.template);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const previewSubject = applyTemplateVariables(subject, SAMPLE_DATA);
  const previewBodyHtml = applyTemplateVariables(body, SAMPLE_DATA);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,107,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 980, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 26px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--theme-primary),var(--theme-primary-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 800, color: NAVY }}>New Email Template</div>
              <div style={{ fontSize: 11.5, color: '#888' }}>Build a reusable, branded email template for your campaigns</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: 4 }}><X size={20} /></button>
        </div>

        {/* Body: form (left) + live preview (right) */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', gap: 0 }}>
          <div style={{ flex: '1 1 58%', padding: 24, borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
            <div style={{ display: 'flex', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Template name (shortcut)</label>
                <input
                  type="text" placeholder="e.g. welcome-email" value={shortcut}
                  onChange={(e) => setShortcut(e.target.value.replace(/\s/g, '-'))}
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12.5, color: NAVY, paddingTop: 22, whiteSpace: 'nowrap' }}>
                <input type="checkbox" checked={isShared} onChange={(e) => setIsShared(e.target.checked)} />
                Share with team
              </label>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Subject line</label>
              <input
                type="text" placeholder="e.g. Welcome to {{campaign_name}}, {{student_name}}!"
                value={subject} onChange={(e) => setSubject(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Email body</label>
              <EmailRichEditor initialHtml="" resetSignal="new" onChange={setBody} minHeight={260} />
            </div>

            {error && <div style={{ padding: 12, background: '#fff0f0', color: '#e53e3e', borderRadius: 8, fontSize: 12.5 }}>{error}</div>}
          </div>

          {/* Live preview */}
          <div style={{ flex: '1 1 42%', padding: 24, background: 'var(--theme-surface-faint7)', minWidth: 0 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: '#aaa', marginBottom: 10, letterSpacing: 0.4 }}>LIVE PREVIEW</div>
            <div style={{ background: '#fff', borderRadius: 12, border: `1px solid ${BORDER}`, overflow: 'hidden', boxShadow: '0 8px 20px -8px rgba(var(--theme-primary-rgb), 0.18)' }}>
              <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg,var(--theme-primary),var(--theme-primary-mid))' }}>
                <div style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>AOTMS</div>
              </div>
              <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 10.5, color: '#aaa' }}>Subject</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{previewSubject || '(no subject yet)'}</div>
              </div>
              <div
                style={{ padding: 18, fontSize: 13, color: '#333', lineHeight: 1.7, minHeight: 160 }}
                dangerouslySetInnerHTML={{ __html: previewBodyHtml || '<span style="color:#bbb">Start typing your email body…</span>' }}
              />
              <div style={{ padding: '12px 18px', background: 'var(--theme-surface-faint)', fontSize: 10.5, color: '#aaa', borderTop: `1px solid ${BORDER}` }}>
                Sent via AOTMS · Academy Of Tech Masters
              </div>
            </div>
            <div style={{ fontSize: 11, color: '#aaa', marginTop: 10 }}>Preview uses sample data — actual emails are personalized per student.</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 26px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} style={{ padding: '10px 18px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: NAVY, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{ padding: '10px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, background: (!canSave || saving) ? 'var(--theme-border-tint)' : PURPLE, color: (!canSave || saving) ? '#aaa' : '#fff', cursor: (!canSave || saving) ? 'not-allowed' : 'pointer' }}
          >
            {saving ? 'Saving…' : 'Save Template'}
          </button>
        </div>
      </div>
    </div>
  );
}