import { useState, useEffect } from 'react';
import { Plus, Mail, History, Search } from 'lucide-react';
import { messageTemplatesAPI } from '../services/api';
import EmailCampaignWizard from '../components/EmailCampaignWizard';
import EmailTemplateModal from '../components/EmailTemplateModal';
import EmailCampaignHistory from '../components/EmailCampaignHistory';

const TABS = ['WHATSAPP', 'SMS', 'EMAIL'];
const TAB_TYPE_MAP = { WHATSAPP: 'whatsapp', SMS: 'sms', EMAIL: 'email' };

// FIX BUG-06: Templates now saved to/loaded from database
export default function MessageTemplates() {
  const [activeTab, setActiveTab] = useState('WHATSAPP');
  const [selected, setSelected] = useState(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTemplate, setNewTemplate] = useState({ shortcut: '', message: '', isShared: false });
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All'); // All | Mine | Shared (WhatsApp/SMS only)
  const [emailSearch, setEmailSearch] = useState(''); // Email tab only

  // Email-only feature state
  const [showEmailTemplateModal, setShowEmailTemplateModal] = useState(false);
  const [showEmailCampaignWizard, setShowEmailCampaignWizard] = useState(false);
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [wizardInitialData, setWizardInitialData] = useState(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await messageTemplatesAPI.getAll({ type: TAB_TYPE_MAP[activeTab] });
      const all = res.data.templates || [];
      setTemplates(all);
      setSelected(all[0] || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTemplates(); }, [activeTab]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setFilter('All');
    setEmailSearch('');
    setSelected(null);
  };

  const handleAdd = async () => {
    if (!newTemplate.shortcut || !newTemplate.message) return;
    try {
      await messageTemplatesAPI.create({
        type: TAB_TYPE_MAP[activeTab],
        shortcut: newTemplate.shortcut,
        message: newTemplate.message,
        isShared: newTemplate.isShared,
      });
      setNewTemplate({ shortcut: '', message: '', isShared: false });
      setShowNewModal(false);
      fetchTemplates();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create template');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this template?')) return;
    try {
      await messageTemplatesAPI.delete(id);
      fetchTemplates();
    } catch (err) {
      alert('Failed to delete template');
    }
  };

  const handleCopy = (tpl) => {
    if (tpl.bodyFormat === 'html') {
      const el = document.createElement('div');
      el.innerHTML = tpl.message;
      navigator.clipboard.writeText(el.innerText || el.textContent || '');
    } else {
      navigator.clipboard.writeText(tpl.message);
    }
  };

  const handleEmailTemplateSaved = (tpl) => {
    setShowEmailTemplateModal(false);
    fetchTemplates();
    setSelected(tpl);
  };

  const openWizardFresh = () => {
    setWizardInitialData(null);
    setShowEmailCampaignWizard(true);
  };

  const handleReuseFromHistory = (data, mode) => {
    setShowEmailHistory(false);
    setWizardInitialData({ ...data, mode });
    setShowEmailCampaignWizard(true);
  };

  const filteredTemplates = templates.filter((t) => {
    if (activeTab === 'EMAIL') {
      const q = emailSearch.trim().toLowerCase();
      if (!q) return true;
      return (t.shortcut?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q));
    }
    if (filter === 'Mine') return !t.isShared;
    if (filter === 'Shared') return t.isShared;
    return true;
  });

  const tabIcon = (tab) => {
    if (tab === 'WHATSAPP') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    );
    if (tab === 'SMS') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" />
      </svg>
    );
  };

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--theme-text-strong)' }}>Message Templates</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>Manage reusable message templates for WhatsApp, SMS, and Email. Shared templates are visible to all team members.</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1.5px solid var(--theme-border-tint)', paddingBottom: 0 }}>
        {TABS.map(tab => (
          <button key={tab} onClick={() => handleTabChange(tab)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 18px', border: 'none', background: 'none',
            borderBottom: activeTab === tab ? '2.5px solid var(--theme-primary)' : '2.5px solid transparent',
            color: activeTab === tab ? 'var(--theme-primary)' : '#888',
            fontWeight: activeTab === tab ? 700 : 500,
            fontSize: 13, cursor: 'pointer', transition: 'all 0.15s'
          }}>
            {tabIcon(tab)} {tab}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, minHeight: 500 }}>
        {/* Left Sidebar */}
        <div style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {activeTab === 'EMAIL' ? (
            <>
              {/* Email tab header: search + new template */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--theme-surface-tint)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#bbb' }} />
                  <input
                    type="text" placeholder="Search templates..." value={emailSearch}
                    onChange={(e) => setEmailSearch(e.target.value)}
                    style={{ width: '100%', padding: '7px 8px 7px 28px', border: '1.5px solid var(--theme-border-tint)', borderRadius: 7, fontSize: 12, color: '#444', background: '#fff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <button
                  title="New Email Template"
                  onClick={() => setShowEmailTemplateModal(true)}
                  style={{ width: 30, height: 30, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--theme-primary)', color: '#fff', border: 'none', borderRadius: 7, cursor: 'pointer' }}
                >
                  <Plus size={15} />
                </button>
              </div>

              {/* Primary email actions */}
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, borderBottom: '1px solid var(--theme-surface-tint)' }}>
                <button onClick={openWizardFresh} style={{
                  padding: '10px 12px', background: 'linear-gradient(135deg,var(--theme-primary),var(--theme-primary-mid))',
                  color: '#fff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  <Mail size={14} /> Create Email Campaign
                </button>
                <button onClick={() => setShowEmailHistory(true)} style={{
                  padding: '9px 12px', background: 'var(--theme-surface-faint7)', color: 'var(--theme-primary)', border: '1.5px solid var(--theme-border-tint)',
                  borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}>
                  <History size={14} /> Campaign History
                </button>
              </div>
            </>
          ) : (
            /* WhatsApp / SMS — unchanged filter + New */
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--theme-surface-tint)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <select value={filter} onChange={e => setFilter(e.target.value)}
                style={{ flex: 1, padding: '6px 8px', border: '1.5px solid var(--theme-border-tint)', borderRadius: 7, fontSize: 12, color: '#444', background: '#fff', outline: 'none' }}>
                <option>All</option>
                <option>Mine</option>
                <option>Shared</option>
              </select>
              <button onClick={() => setShowNewModal(true)} style={{
                padding: '6px 12px', background: 'var(--theme-primary)', color: '#fff', border: 'none',
                borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap'
              }}>+ New</button>
            </div>
          )}

          {/* Template List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#888', fontSize: 13 }}>Loading...</div>
            ) : filteredTemplates.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                No templates yet.<br />
                <span style={{ color: 'var(--theme-primary)', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => activeTab === 'EMAIL' ? setShowEmailTemplateModal(true) : setShowNewModal(true)}>Create one →</span>
              </div>
            ) : filteredTemplates.map(t => (
              <div key={t._id}
                onClick={() => setSelected(t)}
                style={{
                  padding: '12px 14px', cursor: 'pointer',
                  borderBottom: '1px solid var(--theme-surface-faint)',
                  background: selected?._id === t._id ? 'var(--theme-surface-tint)' : 'transparent',
                  borderLeft: selected?._id === t._id ? '3px solid var(--theme-primary)' : '3px solid transparent',
                  transition: 'all 0.12s'
                }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--theme-text-strong)', marginBottom: 3 }}>/{t.shortcut}</div>
                <div style={{ fontSize: 11.5, color: '#888', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                  {t.bodyFormat === 'html' ? (t.subject || 'Rich email template') : t.message}
                </div>
                {t.isShared && <div style={{ fontSize: 10, color: 'var(--theme-primary)', marginTop: 3, fontWeight: 600 }}>Shared</div>}
              </div>
            ))}
          </div>
        </div>

        {/* Right — Preview */}
        <div style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 14 }}>
              Select a template to preview
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-text-strong)' }}>/{selected.shortcut}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    Created by {selected.createdBy?.name || 'You'} · {selected.isShared ? 'Shared with team' : 'Private'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleCopy(selected)}
                    style={{ padding: '7px 14px', background: 'var(--theme-surface-tint)', color: 'var(--theme-primary)', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >Copy</button>
                  <button
                    onClick={() => handleDelete(selected._id)}
                    style={{ padding: '7px 14px', background: '#fff0f0', color: '#e53e3e', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                  >Delete</button>
                </div>
              </div>

              {selected.bodyFormat === 'html' ? (
                <div style={{ flex: 1, border: '1.5px solid var(--theme-border-tint)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: '12px 16px', background: 'var(--theme-surface-faint7)', borderBottom: '1px solid var(--theme-border-tint)' }}>
                    <div style={{ fontSize: 11, color: '#aaa' }}>Subject</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text-strong)' }}>{selected.subject || '(no subject)'}</div>
                  </div>
                  <div
                    style={{ flex: 1, padding: 18, fontSize: 13.5, color: '#333', lineHeight: 1.7, overflowY: 'auto' }}
                    dangerouslySetInnerHTML={{ __html: selected.message }}
                  />
                </div>
              ) : (
                <div style={{
                  flex: 1, background: 'var(--theme-surface-faint7)', borderRadius: 10,
                  padding: 18, fontSize: 13.5, color: '#333',
                  lineHeight: 1.7, whiteSpace: 'pre-wrap',
                  border: '1.5px solid var(--theme-border-tint)'
                }}>
                  {selected.message}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* New Template Modal — WhatsApp / SMS only (unchanged) */}
      {showNewModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,107,0.4)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999 }}>
          <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 500, padding: 28, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--theme-text-strong)', marginBottom: 20 }}>New {activeTab} Template</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--theme-text-strong)', marginBottom: 6 }}>Shortcut (no spaces)</label>
                <input
                  type="text" placeholder="e.g. intro"
                  value={newTemplate.shortcut}
                  onChange={e => setNewTemplate({ ...newTemplate, shortcut: e.target.value.replace(/\s/g, '') })}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--theme-border-tint)', borderRadius: 8, fontSize: 13.5, outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--theme-text-strong)', marginBottom: 6 }}>Message</label>
                <textarea
                  rows={6} placeholder="Hi {{NAME}}, this is {{MY NAME}} from..."
                  value={newTemplate.message}
                  onChange={e => setNewTemplate({ ...newTemplate, message: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--theme-border-tint)', borderRadius: 8, fontSize: 13.5, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }}
                />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={newTemplate.isShared} onChange={e => setNewTemplate({ ...newTemplate, isShared: e.target.checked })} />
                Share with all team members
              </label>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowNewModal(false)} style={{ padding: '10px 18px', border: '1.5px solid var(--theme-border-tint)', borderRadius: 8, fontSize: 13, fontWeight: 600, background: '#fff', color: 'var(--theme-text-strong)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAdd} style={{ padding: '10px 18px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, background: 'var(--theme-primary)', color: '#fff', cursor: 'pointer' }}>Save Template</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New professional Email Template editor */}
      {showEmailTemplateModal && (
        <EmailTemplateModal onClose={() => setShowEmailTemplateModal(false)} onSaved={handleEmailTemplateSaved} />
      )}

      {/* Email Campaign Wizard (fresh, or prefilled from history Re-run/Edit) */}
      {showEmailCampaignWizard && (
        <EmailCampaignWizard
          initialData={wizardInitialData}
          onClose={() => { setShowEmailCampaignWizard(false); setWizardInitialData(null); }}
        />
      )}

      {/* Campaign History */}
      {showEmailHistory && (
        <EmailCampaignHistory onClose={() => setShowEmailHistory(false)} onReuse={handleReuseFromHistory} />
      )}
    </div>
  );
}