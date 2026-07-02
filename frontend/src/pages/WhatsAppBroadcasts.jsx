import { useState, useEffect } from 'react';
import { Send, Users, Clock, CheckCircle2, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { broadcastsAPI, messageTemplatesAPI, campaignsAPI, leadStagesAPI } from '../services/api';

const BTABS = ['NEW BROADCAST', 'HISTORY'];

const STATUS_COLORS = {
  draft: '#94a3b8',
  sending: '#f6c453',
  completed: '#22c55e',
  failed: '#ef4444',
  cancelled: '#94a3b8',
};

export default function WhatsAppBroadcasts() {
  const [activeTab, setActiveTab] = useState('NEW BROADCAST');

  // Shared reference data
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [statuses, setStatuses] = useState([]);

  // New broadcast form state
  const [name, setName] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [filters, setFilters] = useState({ status: '', campaign: '', leadSource: '' });
  const [previewCount, setPreviewCount] = useState(null);
  const [previewSample, setPreviewSample] = useState([]);
  const [previewing, setPreviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState(null);
  const [formError, setFormError] = useState('');

  // History state
  const [broadcasts, setBroadcasts] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [tplRes, campRes, stageRes] = await Promise.all([
          messageTemplatesAPI.getAll({ type: 'whatsapp' }),
          campaignsAPI.getAll(),
          leadStagesAPI.get(),
        ]);
        setTemplates(tplRes.data.templates || []);
        setCampaigns(campRes.data.campaigns || campRes.data || []);
        setStatuses((stageRes.data.config?.statuses || []).map((s) => s.name));
      } catch (err) {
        console.error(err);
      }
    })();
  }, []);

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await broadcastsAPI.getAll({ limit: 50 });
      setBroadcasts(res.data.broadcasts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'HISTORY') fetchHistory();
  }, [activeTab]);

  const resetForm = () => {
    setName('');
    setTemplateId('');
    setFilters({ status: '', campaign: '', leadSource: '' });
    setPreviewCount(null);
    setPreviewSample([]);
    setSendResult(null);
    setFormError('');
  };

  const handlePreview = async () => {
    try {
      setPreviewing(true);
      setFormError('');
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await broadcastsAPI.preview(cleanFilters);
      setPreviewCount(res.data.count);
      setPreviewSample(res.data.sample || []);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to preview audience');
    } finally {
      setPreviewing(false);
    }
  };

  const handleSend = async () => {
    if (!name.trim() || !templateId) {
      setFormError('Broadcast name and template are required');
      return;
    }
    if (!window.confirm(`Send this WhatsApp broadcast to ${previewCount ?? 'the matching'} lead(s)?`)) return;
    try {
      setSending(true);
      setFormError('');
      const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await broadcastsAPI.create({ name, templateId, filters: cleanFilters });
      setSendResult(res.data.broadcast);
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  };

  const selectedTemplate = templates.find((t) => t._id === templateId);

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--theme-border-tint)' }}>
        {BTABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #25D366' : '2px solid transparent',
              color: activeTab === tab ? 'var(--theme-text-strong)' : '#888',
              fontWeight: activeTab === tab ? 700 : 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {tab === 'NEW BROADCAST' ? 'New Broadcast' : 'Broadcast History'}
          </button>
        ))}
      </div>

      {activeTab === 'NEW BROADCAST' && (
        <div style={{ maxWidth: 640 }}>
          {sendResult ? (
            <div style={{ padding: 20, borderRadius: 10, background: 'var(--theme-surface-faint3)', border: '1px solid var(--theme-border-tint)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <CheckCircle2 size={20} color="#22c55e" />
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--theme-text-strong)' }}>Broadcast "{sendResult.name}" sent</div>
              </div>
              <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#888' }}>
                <div><strong style={{ color: 'var(--theme-text-strong)' }}>{sendResult.recipientCount}</strong> recipients</div>
                <div><strong style={{ color: '#22c55e' }}>{sendResult.sentCount}</strong> sent</div>
                <div><strong style={{ color: '#ef4444' }}>{sendResult.failedCount}</strong> failed</div>
              </div>
              <button
                onClick={resetForm}
                style={{ marginTop: 16, padding: '8px 18px', background: '#25D366', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                Send Another Broadcast
              </button>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Broadcast Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. July Enrollment Reminder"
                  style={inputStyle}
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>WhatsApp Template</label>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} style={inputStyle}>
                  <option value="">Select a template…</option>
                  {templates.map((t) => (
                    <option key={t._id} value={t._id}>{t.shortcut}</option>
                  ))}
                </select>
                {templates.length === 0 && (
                  <div style={{ fontSize: 12, color: '#f6c453', marginTop: 4 }}>
                    No WhatsApp templates yet — create one in the Templates tab first.
                  </div>
                )}
              </div>

              {selectedTemplate && (
                <div style={{ marginBottom: 14, padding: 12, borderRadius: 8, background: 'var(--theme-surface-faint3)', fontSize: 13, color: '#888', whiteSpace: 'pre-wrap' }}>
                  {selectedTemplate.message}
                </div>
              )}

              <div style={{ fontSize: 12, fontWeight: 700, color: '#888', textTransform: 'uppercase', margin: '18px 0 8px' }}>Audience Filters</div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Lead Status</label>
                  <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={inputStyle}>
                    <option value="">Any status</option>
                    {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Campaign</label>
                  <select value={filters.campaign} onChange={(e) => setFilters({ ...filters, campaign: e.target.value })} style={inputStyle}>
                    <option value="">Any campaign</option>
                    {campaigns.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Lead Source</label>
                  <input
                    value={filters.leadSource}
                    onChange={(e) => setFilters({ ...filters, leadSource: e.target.value })}
                    placeholder="e.g. Facebook"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <button
                  onClick={handlePreview}
                  disabled={previewing}
                  style={{ padding: '9px 16px', background: 'var(--theme-surface-faint3)', border: '1px solid var(--theme-border-tint)', borderRadius: 8, fontSize: 13, fontWeight: 600, color: 'var(--theme-text-strong)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {previewing ? <Loader2 size={14} className="spin" /> : <Users size={14} />}
                  Preview Audience
                </button>
                {previewCount !== null && (
                  <div style={{ fontSize: 13, color: 'var(--theme-text-strong)' }}>
                    <strong>{previewCount}</strong> matching lead{previewCount === 1 ? '' : 's'}
                  </div>
                )}
              </div>

              {previewSample.length > 0 && (
                <div style={{ fontSize: 12, color: '#888', marginBottom: 14 }}>
                  e.g. {previewSample.map((l) => l.name).join(', ')}{previewCount > previewSample.length ? '…' : ''}
                </div>
              )}

              {formError && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{formError}</div>}

              <button
                onClick={handleSend}
                disabled={sending || !name.trim() || !templateId}
                style={{
                  padding: '10px 22px',
                  background: sending || !name.trim() || !templateId ? '#94a3b8' : '#25D366',
                  color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  cursor: sending || !name.trim() || !templateId ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {sending ? <Loader2 size={15} className="spin" /> : <Send size={15} />}
                {sending ? 'Sending…' : 'Send Broadcast'}
              </button>
            </>
          )}
        </div>
      )}

      {activeTab === 'HISTORY' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button onClick={fetchHistory} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: '1px solid var(--theme-border-tint)', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#888', cursor: 'pointer' }}>
              <RefreshCw size={13} /> Refresh
            </button>
          </div>

          {historyLoading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading broadcasts…</div>
          ) : broadcasts.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>
              <Clock size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
              <div>No broadcasts sent yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {broadcasts.map((b) => (
                <div key={b._id} style={{ border: '1px solid var(--theme-border-tint)', borderRadius: 10, padding: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                       onClick={() => setExpandedId(expandedId === b._id ? null : b._id)}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--theme-text-strong)' }}>{b.name}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        Template: {b.template?.shortcut || '—'} · {new Date(b.createdAt).toLocaleString()} · by {b.createdBy?.name || 'Unknown'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                      <div style={{ fontSize: 12, color: '#888' }}>
                        <strong style={{ color: 'var(--theme-text-strong)' }}>{b.recipientCount}</strong> recipients
                      </div>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#22c55e' }}>{b.sentCount} sent</span>
                        {b.failedCount > 0 && <span style={{ color: '#ef4444', marginLeft: 8 }}>{b.failedCount} failed</span>}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20,
                        color: STATUS_COLORS[b.status] || '#888',
                        background: `${STATUS_COLORS[b.status] || '#888'}20`,
                      }}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                  {expandedId === b._id && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--theme-border-tint)' }}>
                      <div style={{ fontSize: 12, color: '#888', marginBottom: 8, whiteSpace: 'pre-wrap' }}>{b.message}</div>
                      {b.errors?.length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#ef4444', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <XCircle size={13} /> Failed sends ({b.errors.length})
                          </div>
                          {b.errors.slice(0, 10).map((e, i) => (
                            <div key={i} style={{ fontSize: 12, color: '#888' }}>{e.phone}: {e.message}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle = { display: 'block', fontSize: 12, fontWeight: 600, color: '#888', marginBottom: 6 };
const inputStyle = {
  width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--theme-border-tint)',
  background: '#fff', color: 'var(--theme-text-strong)', fontSize: 13, boxSizing: 'border-box',
};