import { useState, useEffect, useMemo } from 'react';
import { campaignsAPI, messageTemplatesAPI, emailCampaignsAPI } from '../services/api';
import EmailRichEditor from './EmailRichEditor';
import { extractSubjectAndBody, plainTextToEditableHtml, applyTemplateVariables } from '../utils/emailTemplateUtils';

const STEPS = [
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'students', label: 'Students' },
  { key: 'template', label: 'Template' },
  { key: 'preview', label: 'Preview' },
  { key: 'send', label: 'Send' },
];

const PURPLE = 'var(--theme-primary)';
const NAVY = 'var(--theme-text-strong)';
const BORDER = 'var(--theme-border-tint)';
const LIGHT = 'var(--theme-surface-tint)';

// Converts a saved MessageTemplate (legacy plain-text OR new rich-html) into
// { subject, bodyHtml } ready to seed the rich editor.
function templateToEditorSeed(tpl) {
  if (tpl.bodyFormat === 'html') {
    return { subject: tpl.subject || '', bodyHtml: tpl.message || '' };
  }
  if (tpl.subject) {
    return { subject: tpl.subject, bodyHtml: plainTextToEditableHtml(tpl.message) };
  }
  const { subject, body } = extractSubjectAndBody(tpl.message);
  return { subject, bodyHtml: plainTextToEditableHtml(body) };
}

/**
 * initialData (optional) — used to re-run/edit a campaign from history:
 *   { campaignIds: [...], subject, body, bodyFormat, mode: 'rerun' | 'edit' }
 */
export default function EmailCampaignWizard({ onClose, initialData }) {
  const [step, setStep] = useState(0);
  const [prefilling, setPrefilling] = useState(!!initialData);

  // Step 0 — campaigns
  const [allCampaigns, setAllCampaigns] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [campaignSearch, setCampaignSearch] = useState('');
  const [selectedCampaignIds, setSelectedCampaignIds] = useState(initialData?.campaignIds || []);

  // Step 1 — students preview
  const [previewing, setPreviewing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewError, setPreviewError] = useState('');

  // Step 2 — template / rich body
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('custom');
  const [subject, setSubject] = useState(initialData?.subject || '');
  const [body, setBody] = useState(
    initialData ? (initialData.bodyFormat === 'html' ? initialData.body : plainTextToEditableHtml(initialData.body)) : ''
  );
  const [editorSeed, setEditorSeed] = useState({ key: 'initial', html: body });

  // Step 4 — sending
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);
  const [sendResult, setSendResult] = useState(null);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoadingCampaigns(true);
        const res = await campaignsAPI.getAll();
        setAllCampaigns(res.data.campaigns || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingCampaigns(false);
      }
    })();
  }, []);

  // One-time prefill flow when opened from Campaign History ("Re-run" / "Edit").
  useEffect(() => {
    if (!initialData) return;
    (async () => {
      try {
        const res = await emailCampaignsAPI.previewRecipients(initialData.campaignIds);
        setPreviewData(res.data);
      } catch (err) {
        setPreviewError(err.response?.data?.message || 'Failed to load student preview');
      } finally {
        setPrefilling(false);
        setStep(initialData.mode === 'rerun' ? 3 : 2);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase();
    if (!q) return allCampaigns;
    return allCampaigns.filter((c) => c.name?.toLowerCase().includes(q));
  }, [allCampaigns, campaignSearch]);

  const selectedCampaignObjs = allCampaigns.filter((c) => selectedCampaignIds.includes(c._id));

  const toggleCampaign = (id) => {
    setSelectedCampaignIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const goToStudentsPreview = async () => {
    if (selectedCampaignIds.length === 0) return;
    setPreviewError('');
    setPreviewing(true);
    setStep(1);
    try {
      const res = await emailCampaignsAPI.previewRecipients(selectedCampaignIds);
      setPreviewData(res.data);
    } catch (err) {
      setPreviewError(err.response?.data?.message || 'Failed to load student preview');
    } finally {
      setPreviewing(false);
    }
  };

  const goToTemplateStep = async () => {
    setStep(2);
    if (emailTemplates.length === 0) {
      try {
        setLoadingTemplates(true);
        const res = await messageTemplatesAPI.getAll({ type: 'email' });
        setEmailTemplates(res.data.templates || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingTemplates(false);
      }
    }
  };

  const handlePickTemplate = (tpl) => {
    setSelectedTemplateId(tpl._id);
    const { subject: s, bodyHtml } = templateToEditorSeed(tpl);
    setSubject(s);
    setBody(bodyHtml);
    setEditorSeed({ key: tpl._id, html: bodyHtml });
  };

  const handleWriteCustom = () => {
    setSelectedTemplateId('custom');
    setSubject('');
    setBody('');
    setEditorSeed({ key: 'custom-' + Date.now(), html: '' });
  };

  const sampleStudent = previewData?.students?.[0] || {
    name: 'John Doe',
    email: 'john@example.com',
    campaignName: selectedCampaignObjs[0]?.name || previewData?.campaigns?.[0]?.name || 'Sample Campaign',
  };

  const previewSubject = applyTemplateVariables(subject, {
    student_name: sampleStudent.name, student_email: sampleStudent.email, campaign_name: sampleStudent.campaignName,
  });
  const previewBodyHtml = applyTemplateVariables(body, {
    student_name: sampleStudent.name, student_email: sampleStudent.email, campaign_name: sampleStudent.campaignName,
  });

  const handleSend = async () => {
    setSendError('');
    setSendResult(null);
    setSending(true);
    setSendProgress(4);
    setStep(4);

    const interval = setInterval(() => {
      setSendProgress((p) => (p < 92 ? p + Math.max(1, Math.round((92 - p) * 0.08)) : p));
    }, 350);

    try {
      const res = await emailCampaignsAPI.send({
        campaignIds: selectedCampaignIds,
        subject,
        body,
        bodyFormat: 'html',
      });
      clearInterval(interval);
      setSendProgress(100);
      setSendResult(res.data);
    } catch (err) {
      clearInterval(interval);
      setSendError(err.response?.data?.message || 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  const canGoNextFromStudents = !previewing && previewData && previewData.totalStudents > 0;
  const stripHtml = (html) => String(html || '').replace(/<[^>]*>/g, '').trim();
  const canGoNextFromTemplate = subject.trim().length > 0 && stripHtml(body).length > 0;

  if (prefilling) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,107,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 32, textAlign: 'center', minWidth: 280 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', border: '4px solid var(--theme-surface-tint)', borderTopColor: PURPLE, margin: '0 auto 16px', animation: 'aotmsEmailSpin 0.8s linear infinite' }} />
          <style>{`@keyframes aotmsEmailSpin { to { transform: rotate(360deg); } }`}</style>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: NAVY }}>Loading previous campaign…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,107,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20 }}>
      <style>{`@keyframes aotmsEmailSpin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 860, maxHeight: '92vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '20px 28px 0', borderBottom: '1px solid var(--theme-surface-tint)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: NAVY }}>
                {initialData?.mode === 'edit' ? 'Edit & Resend Campaign' : initialData?.mode === 'rerun' ? 'Re-run Campaign' : 'Create Email Campaign'}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>Send a personalized email to students from one or more existing campaigns</div>
            </div>
            <button onClick={onClose} disabled={sending} style={{ border: 'none', background: 'none', cursor: sending ? 'not-allowed' : 'pointer', color: '#888', fontSize: 22, lineHeight: 1, padding: 0 }}>×</button>
          </div>
          <div style={{ display: 'flex', gap: 4, paddingBottom: 14 }}>
            {STEPS.map((s, i) => (
              <div key={s.key} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ height: 4, borderRadius: 4, marginBottom: 6, background: i <= step ? PURPLE : BORDER, transition: 'background 0.2s' }} />
                <div style={{ fontSize: 10.5, fontWeight: i === step ? 700 : 500, color: i === step ? PURPLE : '#aaa' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 28 }}>
          {/* Step 0 — Select Campaigns */}
          {step === 0 && (
            <div>
              <input
                type="text"
                placeholder="Search campaigns..."
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13.5, outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
              />
              {selectedCampaignIds.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                  {selectedCampaignObjs.map((c) => (
                    <span key={c._id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: LIGHT, color: PURPLE, padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {c.name}
                      <span onClick={() => toggleCampaign(c._id)} style={{ cursor: 'pointer', fontWeight: 800 }}>×</span>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, maxHeight: 320, overflowY: 'auto' }}>
                {loadingCampaigns ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#888', fontSize: 13 }}>Loading campaigns...</div>
                ) : filteredCampaigns.length === 0 ? (
                  <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No campaigns found.</div>
                ) : (
                  filteredCampaigns.map((c) => {
                    const checked = selectedCampaignIds.includes(c._id);
                    return (
                      <label key={c._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid var(--theme-surface-faint)', cursor: 'pointer', background: checked ? 'var(--theme-surface-faint7)' : '#fff' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleCampaign(c._id)} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>{c.name}</div>
                          <div style={{ fontSize: 11.5, color: '#888' }}>{c.totalLeads || 0} leads · {c.status}</div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Step 1 — Preview Student Count */}
          {step === 1 && (
            <div>
              {previewing ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13.5 }}>Fetching students from selected campaigns...</div>
              ) : previewError ? (
                <div style={{ padding: 18, color: '#e53e3e', background: '#fff0f0', borderRadius: 10, fontSize: 13 }}>{previewError}</div>
              ) : previewData && (
                <>
                  <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
                    <div style={{ flex: 1, background: 'var(--theme-surface-faint7)', borderRadius: 12, padding: 18, textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: PURPLE }}>{previewData.totalCampaigns}</div>
                      <div style={{ fontSize: 11.5, color: '#888', marginTop: 4 }}>Campaigns Selected</div>
                    </div>
                    <div style={{ flex: 1, background: '#f0fff4', borderRadius: 12, padding: 18, textAlign: 'center' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#1a9e5c' }}>{previewData.totalStudents}</div>
                      <div style={{ fontSize: 11.5, color: '#888', marginTop: 4 }}>Unique Students</div>
                    </div>
                    {previewData.skippedNoEmail > 0 && (
                      <div style={{ flex: 1, background: '#fffaf0', borderRadius: 12, padding: 18, textAlign: 'center' }}>
                        <div style={{ fontSize: 26, fontWeight: 800, color: '#c47f17' }}>{previewData.skippedNoEmail}</div>
                        <div style={{ fontSize: 11.5, color: '#888', marginTop: 4 }}>Skipped (No Email)</div>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 8 }}>Selected campaigns</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
                    {previewData.campaigns?.map((c) => (
                      <span key={c._id} style={{ background: LIGHT, color: PURPLE, padding: '5px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{c.name}</span>
                    ))}
                  </div>

                  {previewData.totalStudents === 0 ? (
                    <div style={{ padding: 16, background: '#fff0f0', color: '#e53e3e', borderRadius: 10, fontSize: 13 }}>
                      No students with a valid email address were found in the selected campaign(s).
                    </div>
                  ) : (
                    <div style={{ border: `1px solid ${BORDER}`, borderRadius: 10, maxHeight: 220, overflowY: 'auto' }}>
                      {previewData.students.slice(0, 50).map((s) => (
                        <div key={s.leadId} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--theme-surface-faint)', fontSize: 12.5 }}>
                          <span style={{ fontWeight: 600, color: NAVY, flex: 1 }}>{s.name}</span>
                          <span style={{ color: '#888', flex: 1.4 }}>{s.email}</span>
                          <span style={{ color: '#aaa', flex: 1, textAlign: 'right' }}>{s.campaignName}</span>
                        </div>
                      ))}
                      {previewData.students.length > 50 && (
                        <div style={{ padding: 10, textAlign: 'center', color: '#aaa', fontSize: 11.5 }}>+ {previewData.students.length - 50} more</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Step 2 — Select / Compose Template */}
          {step === 2 && (
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: NAVY, marginBottom: 10 }}>Choose a saved Email template, or write a custom one</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, maxHeight: 170, overflowY: 'auto' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1.5px solid ${selectedTemplateId === 'custom' ? PURPLE : BORDER}`, borderRadius: 10, cursor: 'pointer', background: selectedTemplateId === 'custom' ? 'var(--theme-surface-faint7)' : '#fff' }}>
                  <input type="radio" checked={selectedTemplateId === 'custom'} onChange={handleWriteCustom} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: NAVY }}>✎ Write custom email</span>
                </label>
                {loadingTemplates ? (
                  <div style={{ padding: 14, color: '#888', fontSize: 12.5 }}>Loading templates...</div>
                ) : emailTemplates.length === 0 ? (
                  <div style={{ padding: 14, color: '#aaa', fontSize: 12.5 }}>No saved email templates yet. You can still write a custom email below.</div>
                ) : (
                  emailTemplates.map((t) => (
                    <label key={t._id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', border: `1.5px solid ${selectedTemplateId === t._id ? PURPLE : BORDER}`, borderRadius: 10, cursor: 'pointer', background: selectedTemplateId === t._id ? 'var(--theme-surface-faint7)' : '#fff' }}>
                      <input type="radio" checked={selectedTemplateId === t._id} onChange={() => handlePickTemplate(t)} />
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>/{t.shortcut}</div>
                        <div style={{ fontSize: 11.5, color: '#888', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{t.subject || t.message?.replace(/<[^>]*>/g, '')}</div>
                      </div>
                    </label>
                  ))
                )}
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Welcome to {{campaign_name}}, {{student_name}}!"
                  style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: NAVY, marginBottom: 6 }}>Body</label>
                <EmailRichEditor initialHtml={editorSeed.html} resetSignal={editorSeed.key} onChange={setBody} minHeight={200} />
              </div>
            </div>
          )}

          {/* Step 3 — Preview Email */}
          {step === 3 && (
            <div>
              <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
                Previewing with <strong style={{ color: NAVY }}>{sampleStudent.name}</strong> ({sampleStudent.email}) as a sample student. Each of the {previewData?.totalStudents || 0} students will receive their own personalized copy.
              </div>
              <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ padding: '14px 18px', background: 'linear-gradient(135deg,var(--theme-primary),var(--theme-primary-mid))' }}>
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>AOTMS</span>
                </div>
                <div style={{ padding: '12px 18px', background: 'var(--theme-surface-faint7)', borderBottom: `1px solid ${BORDER}` }}>
                  <div style={{ fontSize: 11, color: '#aaa' }}>Subject</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{previewSubject || '(no subject)'}</div>
                </div>
                <div
                  style={{ padding: 18, fontSize: 13.5, color: '#333', lineHeight: 1.7, minHeight: 140 }}
                  dangerouslySetInnerHTML={{ __html: previewBodyHtml || '<span style="color:#bbb">(empty body)</span>' }}
                />
                <div style={{ padding: '10px 18px', background: 'var(--theme-surface-faint)', borderTop: `1px solid ${BORDER}`, fontSize: 10.5, color: '#aaa' }}>
                  This email was sent by AOTMS · Academy Of Tech Masters
                </div>
              </div>
            </div>
          )}

          {/* Step 4 — Send / Result */}
          {step === 4 && (
            <div style={{ padding: '20px 0', textAlign: 'center' }}>
              {sendError ? (
                <div style={{ padding: 20, background: '#fff0f0', color: '#e53e3e', borderRadius: 10, fontSize: 13.5 }}>{sendError}</div>
              ) : sendResult ? (
                <div>
                  <div style={{ fontSize: 38, marginBottom: 8 }}>{sendResult.failed > 0 ? '⚠️' : '✅'}</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: NAVY, marginBottom: 18 }}>Email Campaign Sent</div>
                  <div style={{ display: 'flex', gap: 14, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
                    <div style={{ background: '#f0fff4', borderRadius: 12, padding: '16px 22px', minWidth: 100 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a9e5c' }}>{sendResult.sent}</div>
                      <div style={{ fontSize: 11.5, color: '#888' }}>Sent</div>
                    </div>
                    <div style={{ background: sendResult.failed > 0 ? '#fff0f0' : 'var(--theme-surface-faint7)', borderRadius: 12, padding: '16px 22px', minWidth: 100 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: sendResult.failed > 0 ? '#e53e3e' : '#aaa' }}>{sendResult.failed}</div>
                      <div style={{ fontSize: 11.5, color: '#888' }}>Failed</div>
                    </div>
                    <div style={{ background: 'var(--theme-surface-faint7)', borderRadius: 12, padding: '16px 22px', minWidth: 100 }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: PURPLE }}>{sendResult.totalRecipients}</div>
                      <div style={{ fontSize: 11.5, color: '#888' }}>Total Students</div>
                    </div>
                  </div>
                  {sendResult.failures?.length > 0 && (
                    <div style={{ textAlign: 'left', border: '1px solid #ffe2e2', borderRadius: 10, maxHeight: 160, overflowY: 'auto' }}>
                      {sendResult.failures.map((f, i) => (
                        <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid #fff5f5', fontSize: 11.5 }}>
                          <span style={{ fontWeight: 700, color: NAVY }}>{f.name}</span> · <span style={{ color: '#888' }}>{f.email}</span> — <span style={{ color: '#e53e3e' }}>{f.error}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div style={{ width: 56, height: 56, borderRadius: '50%', border: '4px solid var(--theme-surface-tint)', borderTopColor: PURPLE, margin: '0 auto 20px', animation: 'aotmsEmailSpin 0.8s linear infinite' }} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: NAVY, marginBottom: 14 }}>
                    Sending personalized emails to {previewData?.totalStudents || 0} students...
                  </div>
                  <div style={{ width: '80%', margin: '0 auto', height: 8, background: LIGHT, borderRadius: 8, overflow: 'hidden' }}>
                    <div style={{ width: `${sendProgress}%`, height: '100%', background: PURPLE, transition: 'width 0.3s ease' }} />
                  </div>
                  <div style={{ fontSize: 12, color: '#aaa', marginTop: 8 }}>{sendProgress}%</div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', borderTop: '1px solid var(--theme-surface-tint)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          {step === 4 ? (
            <>
              <div />
              {(sendResult || sendError) ? (
                <button onClick={onClose} style={{ padding: '10px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, background: PURPLE, color: '#fff', cursor: 'pointer' }}>Done</button>
              ) : (
                <button disabled style={{ padding: '10px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--theme-border-tint)', color: '#aaa', cursor: 'not-allowed' }}>Sending...</button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                style={{ padding: '10px 18px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: step === 0 ? '#ccc' : NAVY, cursor: step === 0 ? 'not-allowed' : 'pointer' }}
              >Back</button>

              {step === 0 && (
                <button onClick={goToStudentsPreview} disabled={selectedCampaignIds.length === 0} style={{ padding: '10px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, background: selectedCampaignIds.length === 0 ? 'var(--theme-border-tint)' : PURPLE, color: selectedCampaignIds.length === 0 ? '#aaa' : '#fff', cursor: selectedCampaignIds.length === 0 ? 'not-allowed' : 'pointer' }}>
                  Next ({selectedCampaignIds.length} selected)
                </button>
              )}
              {step === 1 && (
                <button onClick={goToTemplateStep} disabled={!canGoNextFromStudents} style={{ padding: '10px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, background: !canGoNextFromStudents ? 'var(--theme-border-tint)' : PURPLE, color: !canGoNextFromStudents ? '#aaa' : '#fff', cursor: !canGoNextFromStudents ? 'not-allowed' : 'pointer' }}>
                  Next: Choose Template
                </button>
              )}
              {step === 2 && (
                <button onClick={() => setStep(3)} disabled={!canGoNextFromTemplate} style={{ padding: '10px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, background: !canGoNextFromTemplate ? 'var(--theme-border-tint)' : PURPLE, color: !canGoNextFromTemplate ? '#aaa' : '#fff', cursor: !canGoNextFromTemplate ? 'not-allowed' : 'pointer' }}>
                  Next: Preview Email
                </button>
              )}
              {step === 3 && (
                <button onClick={handleSend} style={{ padding: '10px 22px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, background: PURPLE, color: '#fff', cursor: 'pointer' }}>
                  Send to {previewData?.totalStudents || 0} Students
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}