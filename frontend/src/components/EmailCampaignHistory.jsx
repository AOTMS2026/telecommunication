import { useState, useEffect } from 'react';
import { X, History, RotateCcw, Pencil, Trash2, ChevronDown, Users, CheckCircle2, XCircle, Mail } from 'lucide-react';
import { emailCampaignsAPI } from '../services/api';
import { formatDateTime } from '../utils/emailTemplateUtils';

const PURPLE = 'var(--theme-primary)';
const NAVY = 'var(--theme-text-strong)';
const BORDER = 'var(--theme-border-tint)';

const STATUS_STYLES = {
  completed: { bg: '#f0fff4', color: '#1a9e5c', label: 'Completed' },
  sending: { bg: '#fffaf0', color: '#c47f17', label: 'Sending' },
  pending: { bg: '#f0f4ff', color: 'var(--theme-primary)', label: 'Pending' },
  failed: { bg: '#fff0f0', color: '#e53e3e', label: 'Failed' },
};

export default function EmailCampaignHistory({ onClose, onReuse }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [detailById, setDetailById] = useState({});
  const [detailLoadingId, setDetailLoadingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await emailCampaignsAPI.getAll();
      setItems(res.data.emailCampaigns || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load campaign history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchHistory(); }, []);

  const toggleExpand = async (item) => {
    if (expandedId === item._id) { setExpandedId(null); return; }
    setExpandedId(item._id);
    if (!detailById[item._id]) {
      try {
        setDetailLoadingId(item._id);
        const res = await emailCampaignsAPI.getOne(item._id);
        setDetailById((prev) => ({ ...prev, [item._id]: res.data.emailCampaign }));
      } catch (err) {
        console.error(err);
      } finally {
        setDetailLoadingId(null);
      }
    }
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete "${item.name}" from history? This only removes the history record, not the students or campaigns.`)) return;
    try {
      setDeletingId(item._id);
      await emailCampaignsAPI.delete(item._id);
      setItems((prev) => prev.filter((i) => i._id !== item._id));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReuse = (item, mode) => {
    onReuse?.({
      campaignIds: (item.sourceCampaigns || []).map((c) => (typeof c === 'string' ? c : c._id)),
      subject: item.subject,
      body: item.body,
      bodyFormat: item.bodyFormat || 'text',
    }, mode);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,45,107,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 18, width: '100%', maxWidth: 880, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '18px 26px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,var(--theme-primary),var(--theme-primary-mid))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <History size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 800, color: NAVY }}>Campaign History</div>
              <div style={{ fontSize: 11.5, color: '#888' }}>Every email campaign you've sent, in one place</div>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', padding: 4 }}><X size={20} /></button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, background: 'var(--theme-surface-faint)' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#888', fontSize: 13.5 }}>Loading campaign history...</div>
          ) : error ? (
            <div style={{ padding: 16, background: '#fff0f0', color: '#e53e3e', borderRadius: 10, fontSize: 13 }}>{error}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center', color: '#aaa' }}>
              <Mail size={32} style={{ marginBottom: 10, opacity: 0.5 }} />
              <div style={{ fontSize: 13.5 }}>No email campaigns sent yet.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {items.map((item) => {
                const statusStyle = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
                const isExpanded = expandedId === item._id;
                const detail = detailById[item._id];
                return (
                  <div key={item._id} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
                    <div style={{ padding: '16px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: NAVY }}>{item.name}</span>
                          <span style={{ fontSize: 10.5, fontWeight: 700, padding: '2px 9px', borderRadius: 12, background: statusStyle.bg, color: statusStyle.color }}>{statusStyle.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.subject}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
                          {(item.sourceCampaigns || []).map((c) => (
                            <span key={c._id} style={{ fontSize: 10.5, background: 'var(--theme-surface-tint)', color: PURPLE, padding: '3px 9px', borderRadius: 12, fontWeight: 600 }}>{c.name}</span>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontSize: 11.5, color: '#999' }}>
                          <span>{formatDateTime(item.createdAt)}</span>
                          <span>by {item.createdBy?.name || 'Unknown'}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                        <div style={{ display: 'flex', gap: 10 }}>
                          <Stat icon={<Users size={13} />} value={item.totalRecipients} label="students" />
                          <Stat icon={<CheckCircle2 size={13} color="#1a9e5c" />} value={item.sentCount} label="sent" color="#1a9e5c" />
                          {item.failedCount > 0 && <Stat icon={<XCircle size={13} color="#e53e3e" />} value={item.failedCount} label="failed" color="#e53e3e" />}
                        </div>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <ActionBtn title="Re-run (send again as-is)" onClick={() => handleReuse(item, 'rerun')}><RotateCcw size={14} /></ActionBtn>
                          <ActionBtn title="Edit & resend" onClick={() => handleReuse(item, 'edit')}><Pencil size={14} /></ActionBtn>
                          <ActionBtn title="Delete from history" danger onClick={() => handleDelete(item)} loading={deletingId === item._id}><Trash2 size={14} /></ActionBtn>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleExpand(item)}
                      style={{ width: '100%', padding: '8px 18px', background: 'var(--theme-surface-faint)', border: 'none', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: 'pointer', color: '#888', fontSize: 11.5, fontWeight: 600 }}
                    >
                      {isExpanded ? 'Hide' : 'View'} recipient details
                      <ChevronDown size={13} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
                    </button>

                    {isExpanded && (
                      <div style={{ borderTop: `1px solid ${BORDER}`, maxHeight: 220, overflowY: 'auto' }}>
                        {detailLoadingId === item._id ? (
                          <div style={{ padding: 16, textAlign: 'center', color: '#888', fontSize: 12.5 }}>Loading recipients...</div>
                        ) : detail ? (
                          detail.recipients.map((r, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 18px', borderBottom: '1px solid var(--theme-surface-faint)', fontSize: 12 }}>
                              <span style={{ color: NAVY, fontWeight: 600, flex: 1 }}>{r.name}</span>
                              <span style={{ color: '#888', flex: 1.4 }}>{r.email}</span>
                              <span style={{ color: r.status === 'sent' ? '#1a9e5c' : '#e53e3e', fontWeight: 600, flex: 1, textAlign: 'right' }}>
                                {r.status === 'sent' ? 'Sent' : (r.error || 'Failed')}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: 16, textAlign: 'center', color: '#aaa', fontSize: 12.5 }}>No detail available.</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value, label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: color || '#888', fontWeight: 700 }}>
      {icon}{value}
      <span style={{ color: '#aaa', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

function ActionBtn({ children, title, onClick, danger, loading }) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={loading}
      style={{
        width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `1.5px solid ${danger ? '#ffd6d6' : BORDER}`, background: danger ? '#fff5f5' : '#fff',
        borderRadius: 7, color: danger ? '#e53e3e' : 'var(--theme-text-strong)', cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.5 : 1,
      }}
    >
      {children}
    </button>
  );
}