import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { campaignsAPI, leadsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/common/StatusBadge';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// ─── Design tokens ──────────────────────────────────────────────────────────
const P = '#5b3fc7';
const P_LIGHT = '#f0ecff';
const TEXT = '#1a1a3e';
const MUTED = '#888';
const BORDER = '#ede9f8';

const STATUS_COLORS = {
  Fresh: '#6366f1',
  Connected: '#10b981',
  'Call Not Responding': '#ea580c',
  'Call Back Later': '#f59e0b',
  'Not interested': '#6b7280',
  'Demo Scheduled': '#8b5cf6',
  'Demo Done': '#3b82f6',
  Won: '#16a34a',
  Lost: '#dc2626',
  Blocked: '#111827',
};

const PIE_COLORS = ['#5b3fc7', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#3b82f6', '#ec4899'];

function Avatar({ name, size = 32, bg = P_LIGHT, color = P }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, color, fontWeight: 700,
      fontSize: size * 0.35, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 120 }}>
      <div style={{ width: 28, height: 28, border: `3px solid ${P}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Status mini-badge ───────────────────────────────────────────────────────
function MiniStatus({ status }) {
  const bg = (STATUS_COLORS[status] || '#888') + '22';
  const color = STATUS_COLORS[status] || '#888';
  return (
    <span style={{ background: bg, color, borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
      {status || '—'}
    </span>
  );
}

// ─── Stat card ───────────────────────────────────────────────────────────────
function StatCard({ label, value, color = TEXT }) {
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: '10px 14px', border: `1px solid ${BORDER}`, textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value ?? '—'}</div>
    </div>
  );
}

// ─── Add Leads Modal ─────────────────────────────────────────────────────────
function AddLeadsModal({ campaignId, onClose, onSuccess }) {
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(new Set());
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Fetch leads NOT already in this campaign (campaign=null or other)
    leadsAPI.getAll({ limit: 200 })
      .then(res => {
        // Show only leads that are not in THIS campaign
        const all = res.data.leads || [];
        setAllLeads(all.filter(l => !l.campaign || l.campaign._id !== campaignId));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campaignId]);

  const filtered = allLeads.filter(l =>
    !search ||
    l.name?.toLowerCase().includes(search.toLowerCase()) ||
    l.phone?.includes(search)
  );

  const toggle = (id) => {
    setSelected(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(l => l._id)));
  };

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    try {
      await campaignsAPI.addLeads(campaignId, [...selected]);
      onSuccess();
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to add leads');
    } finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 16px 48px rgba(91,63,199,0.18)' }}>
        {/* Header */}
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Add Students to Campaign</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Select students from your lead list to assign to this campaign</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', lineHeight: 1 }}>✕</button>
        </div>

        {/* Search */}
        <div style={{ padding: '12px 20px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f8f7ff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 12px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or phone..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: 13, color: TEXT, width: '100%' }} />
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
          {loading ? <Spinner /> : filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: MUTED, fontSize: 13 }}>No available students found</div>
          ) : (
            <>
              <div onClick={toggleAll} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', cursor: 'pointer', borderBottom: `1px solid ${BORDER}` }}>
                <input type="checkbox" readOnly checked={selected.size === filtered.length && filtered.length > 0} style={{ accentColor: P, width: 15, height: 15 }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: P }}>Select All ({filtered.length})</span>
              </div>
              {filtered.map(lead => (
                <div key={lead._id} onClick={() => toggle(lead._id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', cursor: 'pointer', borderBottom: `1px solid #f9f8ff` }}>
                  <input type="checkbox" readOnly checked={selected.has(lead._id)} style={{ accentColor: P, width: 15, height: 15, flexShrink: 0 }} />
                  <Avatar name={lead.name} size={32} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, truncate: true }}>{lead.name}</div>
                    <div style={{ fontSize: 11, color: MUTED }}>{lead.phone}</div>
                  </div>
                  <MiniStatus status={lead.status} />
                  <div style={{ fontSize: 11, color: MUTED, flexShrink: 0 }}>{lead.location || ''}</div>
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: MUTED }}>{selected.size} student{selected.size !== 1 ? 's' : ''} selected</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={{ padding: '8px 16px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff', color: TEXT }}>Cancel</button>
            <button onClick={handleAdd} disabled={saving || selected.size === 0}
              style={{ padding: '8px 16px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: selected.size === 0 ? 'not-allowed' : 'pointer', background: selected.size === 0 ? '#d4c9f7' : P, color: '#fff' }}>
              {saving ? 'Adding...' : `Add ${selected.size > 0 ? selected.size : ''} Student${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Initiate Call Modal (same flow as LeadProfile — sends push notification) ──
function CallModal({ lead, callers, currentUser, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const isCaller = currentUser?.role === 'caller';
  const [selectedCaller, setSelectedCaller] = useState(
    isCaller ? currentUser?._id : (lead?.assignedTo?._id || '')
  );

  const handleSend = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await leadsAPI.initiateCall(lead._id, selectedCaller || undefined);
      setResult({ success: true, message: res.data.message });
      if (onSuccess) onSuccess();
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Failed to send notification' });
    } finally {
      setLoading(false);
    }
  };

  const callersList = (callers || []).filter(c => c.role === 'caller');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 16px 48px rgba(91,63,199,0.18)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>📲 Initiate Call</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Send notification to caller's mobile app</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <div style={{ background: P_LIGHT, borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: MUTED }}>Lead</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: TEXT }}>{lead?.name}</div>
            <div style={{ fontSize: 12, color: MUTED, fontFamily: 'monospace' }}>{lead?.phone}</div>
          </div>

          {isCaller ? (
            <div style={{ background: '#eef6ff', border: '1px solid #d6e8ff', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: '#1d4ed8', marginBottom: 14 }}>
              📱 Sending to your mobile: <strong>{currentUser?.name}</strong>
            </div>
          ) : callersList.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: MUTED, marginBottom: 6, textTransform: 'uppercase' }}>Send notification to</div>
              <select
                value={selectedCaller}
                onChange={e => setSelectedCaller(e.target.value)}
                style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: TEXT }}
              >
                <option value="">-- Assigned Caller ({lead?.assignedTo?.name || 'None'}) --</option>
                {callersList.map(c => (
                  <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>
          )}

          {result && (
            <div style={{ borderRadius: 10, padding: '10px 14px', fontSize: 12.5, fontWeight: 600, marginBottom: 4, background: result.success ? '#ecfdf5' : '#fef2f2', color: result.success ? '#15803d' : '#b91c1c', border: `1px solid ${result.success ? '#bbf7d0' : '#fecaca'}` }}>
              {result.success ? '✅ ' : '❌ '}{result.message}
            </div>
          )}
        </div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 14px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff', color: TEXT }}>
            {result?.success ? 'Close' : 'Cancel'}
          </button>
          {!result?.success && (
            <button onClick={handleSend} disabled={loading} style={{ flex: 1, padding: '9px 14px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', background: '#22c55e', color: '#fff' }}>
              {loading ? 'Sending...' : 'Send Notification'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Note Modal ─────────────────────────────────────────────────────────────
function AddNoteModal({ lead, onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      await onSubmit(note);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, boxShadow: '0 16px 48px rgba(91,63,199,0.18)' }}>
        <div style={{ padding: '18px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>Add Note — {lead?.name}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#aaa', lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ padding: '18px 20px' }}>
          <textarea
            autoFocus
            rows={4}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Write a note about this student..."
            style={{ width: '100%', border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10, fontSize: 13, color: TEXT, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
          />
        </div>
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 14px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#fff', color: TEXT }}>Cancel</button>
          <button onClick={handleSave} disabled={saving || !note.trim()} style={{ flex: 1, padding: '9px 14px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: (saving || !note.trim()) ? 'not-allowed' : 'pointer', background: P, color: '#fff' }}>
            {saving ? 'Saving...' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Lead Detail Panel ────────────────────────────────────────────────────────
function LeadDetailPanel({ lead, onAction }) {
  if (!lead) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexDirection: 'column', gap: 8 }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
      <span style={{ fontSize: 13 }}>Select a student to view details</span>
    </div>
  );

  const fields = [
    { label: 'Mobile Number', value: lead.phone },
    { label: 'Email Address', value: lead.email || '—' },
    { label: 'Lead Source', value: lead.leadSource || '—' },
    { label: 'City / Location', value: lead.location || '—' },
    { label: 'Course Interest', value: lead.preferredCourses?.join(', ') || '—' },
    { label: 'Budget', value: lead.budget ? `₹${Number(lead.budget).toLocaleString('en-IN')}` : '—' },
    { label: 'Qualification', value: lead.lastQualification || '—' },
    { label: 'Learning Mode', value: lead.mode || '—' },
    { label: 'Total Calls Made', value: lead.totalCalls ?? 0 },
    { label: 'Next Follow-up', value: lead.nextFollowupDate ? new Date(lead.nextFollowupDate).toLocaleDateString('en-IN') : '—' },
  ];

  const actions = [
    { label: 'Call', color: '#22c55e', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.22 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
    { label: 'Call Later', color: '#f59e0b', icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.22 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> },
    { label: 'Add Note', color: P, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> },
  ];

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#fff', padding: '20px 24px' }}>
      {/* Student header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <Avatar name={lead.name} size={46} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: TEXT }}>{lead.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <MiniStatus status={lead.status} />
              {lead.assignedTo?.name && (
                <span style={{ fontSize: 12, color: MUTED }}>Assigned to: {lead.assignedTo.name}</span>
              )}
            </div>
          </div>
        </div>
        <Avatar name={lead.assignedTo?.name || 'U'} size={34} />
      </div>

      {/* Fields grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        {fields.map(({ label, value }) => (
          <div key={label} style={{ border: `1px solid ${BORDER}`, borderRadius: 10, padding: '10px 14px', background: '#faf9ff' }}>
            <div style={{ fontSize: 11, color: MUTED, marginBottom: 3 }}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: value === '—' ? '#ccc' : TEXT }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, marginBottom: 16 }}>
        {actions.map(({ label, color, icon }) => (
          <button key={label} onClick={() => onAction?.(label, lead)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '8px 4px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: color + '18', color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {icon}
            </div>
            <span style={{ fontSize: 10, color: MUTED, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
          </button>
        ))}
      </div>

      {/* Activity history */}
      <div style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 16px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Activity History</div>
        {!lead.activities?.length ? (
          <div style={{ textAlign: 'center', color: MUTED, fontSize: 12, padding: '16px 0' }}>No activities recorded yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {lead.activities.slice(0, 10).map((a, i) => {
              const isCall = a.type === 'call';
              return (
                <div key={i} style={{ display: 'flex', gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: isCall ? '#dcfce7' : P_LIGHT, color: isCall ? '#16a34a' : P, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {isCall
                      ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.22 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                      : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    }
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: TEXT }}>{a.description || `${a.type}${a.callStatus ? ` — ${a.callStatus}` : ''}`}</div>
                    <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
                      {a.callDuration > 0 && `${Math.floor(a.callDuration / 60)}m ${a.callDuration % 60}s • `}
                      {a.createdAt ? new Date(a.createdAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  const [campaign, setCampaign] = useState(null);
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [showAddLeads, setShowAddLeads] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [callers, setCallers] = useState([]);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showAddNoteModal, setShowAddNoteModal] = useState(false);

  useEffect(() => {
    usersAPI.getAll().then(res => setCallers(res.data.users || [])).catch(() => {});
  }, []);

  // Re-fetch the selected lead's full record (so Activity History reflects new
  // calls/notes immediately) and refresh the list/stat panels in the background.
  const refreshSelectedLead = useCallback(async () => {
    if (!selectedLead?._id) return;
    try {
      const res = await leadsAPI.getOne(selectedLead._id);
      setSelectedLead(res.data.lead);
    } catch (err) { console.error(err); }
  }, [selectedLead]);

  const handleLeadAction = async (action, lead) => {
    if (action === 'Call') {
      setShowCallModal(true);
    } else if (action === 'Call Later') {
      try {
        await leadsAPI.updateStatus(lead._id, { status: 'Call Back Later' });
        await refreshSelectedLead();
        fetchLeads(page);
      } catch (err) {
        alert(err.response?.data?.message || 'Failed to update status');
      }
    } else if (action === 'Add Note') {
      setShowAddNoteModal(true);
    }
  };

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await campaignsAPI.getOne(id);
      setCampaign(res.data.campaign);
    } catch (err) { console.error(err); }
  }, [id]);

  const fetchLeads = useCallback(async (pg = 1) => {
    setLeadsLoading(true);
    try {
      const params = { campaign: id, page: pg, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const res = await leadsAPI.getAll(params);
      const fetched = res.data.leads || [];
      setLeads(fetched);
      setTotalPages(res.data.pages || 1);
      setTotalCount(res.data.total || fetched.length);
      if (fetched.length > 0 && (!selectedLead || pg === 1)) setSelectedLead(fetched[0]);
    } catch (err) { console.error(err); }
    finally { setLeadsLoading(false); }
  }, [id, statusFilter, search, selectedLead]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCampaign(), fetchLeads(1)]);
    setLoading(false);
  }, [fetchCampaign, fetchLeads]);

  useEffect(() => { fetchAll(); }, [id]);

  // Re-fetch leads when filter/search/page changes
  useEffect(() => { fetchLeads(page); }, [statusFilter, page]);

  const handleSearchSubmit = (e) => { if (e.key === 'Enter') { setPage(1); fetchLeads(1); } };

  const statusBreakdown = campaign?.statusBreakdown || [];
  const totalLeads = campaign?.totalLeads || statusBreakdown.reduce((a, b) => a + b.count, 0) || 0;
  const freshLeads = statusBreakdown.find(s => s._id === 'Fresh')?.count || 0;
  const wonLeads = statusBreakdown.find(s => s._id === 'Won')?.count || 0;
  const connectedLeads = statusBreakdown.find(s => s._id === 'Connected')?.count || 0;
  const lostReasons = campaign?.lostReasons || [];

  // All unique statuses for filter dropdown
  const allStatuses = ['Fresh', 'Connected', 'Call Not Responding', 'Call Back Later', 'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost', 'Blocked'];

  if (loading) return <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>;
  if (!campaign) return <div style={{ textAlign: 'center', padding: 48, color: MUTED }}>Campaign not found</div>;

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 48px)', fontFamily: 'inherit', overflow: 'hidden' }}>
      {/* ─── LEFT PANEL: Student List ─────────────────────────────────────────── */}
      <div style={{ width: 280, flexShrink: 0, background: '#fff', borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Back + campaign info */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <button onClick={() => navigate('/campaigns')}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: MUTED, marginBottom: 10, padding: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
            Back to Campaigns
          </button>

          {/* Campaign summary card */}
          <div style={{ background: P_LIGHT, borderRadius: 12, padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: P }}>@{campaign.name}</span>
              <button onClick={fetchAll} style={{ background: 'none', border: 'none', cursor: 'pointer', color: P }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/></svg>
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
              <StatCard label="Total" value={totalLeads} color={P} />
              <StatCard label="Fresh" value={freshLeads} color="#6366f1" />
              <StatCard label="Won" value={wonLeads} color="#22c55e" />
              <StatCard label="Callers" value={campaign.assignedCallers?.length || 0} color={TEXT} />
            </div>
          </div>
        </div>

        {/* Search + filter */}
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f8f7ff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 10px' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={handleSearchSubmit}
              placeholder="Search students..." style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: TEXT, width: '100%' }} />
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              style={{ flex: 1, fontSize: 11, padding: '5px 8px', border: `1px solid ${BORDER}`, borderRadius: 7, color: TEXT, background: '#fff', outline: 'none' }}>
              <option value="">All Statuses</option>
              {allStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <button onClick={() => { setShowAddLeads(true); }}
              style={{ background: P, color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add
            </button>
          </div>
          <div style={{ fontSize: 11, color: MUTED }}>{totalCount} student{totalCount !== 1 ? 's' : ''} in this campaign</div>
        </div>

        {/* Student list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {leadsLoading ? <Spinner /> : leads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: MUTED }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ddd" strokeWidth="1.5" style={{ marginBottom: 8 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              <div style={{ fontSize: 12 }}>No students found</div>
              <button onClick={() => setShowAddLeads(true)}
                style={{ marginTop: 10, background: P, color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                + Add Students
              </button>
            </div>
          ) : leads.map(lead => (
            <div key={lead._id} onClick={() => setSelectedLead(lead)}
              style={{
                padding: '11px 14px', borderBottom: `1px solid #f9f8ff`, cursor: 'pointer',
                background: selectedLead?._id === lead._id ? P_LIGHT : 'transparent',
                borderLeft: selectedLead?._id === lead._id ? `3px solid ${P}` : '3px solid transparent',
                transition: 'background 0.1s',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Avatar name={lead.name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                  <div style={{ fontSize: 11, color: MUTED, fontFamily: 'monospace' }}>{lead.phone}</div>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
              <div style={{ marginTop: 5 }}><MiniStatus status={lead.status} /></div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '10px 14px', borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: page === 1 ? 'not-allowed' : 'pointer', color: page === 1 ? '#ccc' : TEXT }}>‹ Prev</button>
            <span style={{ fontSize: 11, color: MUTED }}>{page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: page === totalPages ? 'not-allowed' : 'pointer', color: page === totalPages ? '#ccc' : TEXT }}>Next ›</button>
          </div>
        )}
      </div>

      {/* ─── MIDDLE PANEL: Analytics ──────────────────────────────────────────── */}
      <div style={{ width: 240, flexShrink: 0, background: '#faf9ff', borderRight: `1px solid ${BORDER}`, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Lead Status Distribution (Pie) */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Lead Status Distribution</div>
          {statusBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={110}>
                <PieChart>
                  <Pie data={statusBreakdown.map(s => ({ name: s._id, value: s.count }))}
                    cx="50%" cy="50%" outerRadius={48} innerRadius={24} dataKey="value">
                    {statusBreakdown.map((s, i) => (
                      <Cell key={s._id} fill={STATUS_COLORS[s._id] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 6 }}>
                {statusBreakdown.map((s, i) => (
                  <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[s._id] || PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                      <span style={{ color: '#444', maxWidth: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s._id}</span>
                    </div>
                    <span style={{ fontWeight: 600, color: TEXT }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : <div style={{ textAlign: 'center', color: MUTED, fontSize: 12, padding: '20px 0' }}>No data yet</div>}
        </div>

        {/* Lost / Dropped Reasons */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Dropped / Lost Reasons</div>
          {lostReasons.length > 0 ? (
            lostReasons.map((r, i) => (
              <div key={r._id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: '#555' }}>{r._id}</span>
                  <span style={{ fontWeight: 600, color: TEXT }}>{r.count}</span>
                </div>
                <div style={{ height: 5, background: '#f0ecff', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: PIE_COLORS[i % PIE_COLORS.length], borderRadius: 4, width: `${totalLeads > 0 ? Math.round(r.count / totalLeads * 100) : 0}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))
          ) : <div style={{ textAlign: 'center', color: MUTED, fontSize: 12, padding: '16px 0' }}>No dropped leads yet</div>}
        </div>

        {/* Call Outcomes */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Call Outcomes</div>
          {statusBreakdown.length > 0 ? (
            statusBreakdown.map((s, i) => (
              <div key={s._id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                  <span style={{ color: '#555', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s._id}</span>
                  <span style={{ fontWeight: 600, color: TEXT }}>{s.count}</span>
                </div>
                <div style={{ height: 5, background: '#f0ecff', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: STATUS_COLORS[s._id] || PIE_COLORS[i % PIE_COLORS.length], borderRadius: 4, width: `${totalLeads > 0 ? Math.round(s.count / totalLeads * 100) : 0}%`, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))
          ) : <div style={{ textAlign: 'center', color: MUTED, fontSize: 12, padding: '16px 0' }}>No call data yet</div>}
        </div>

        {/* Assigned Callers */}
        {campaign.assignedCallers?.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: '14px 12px', border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 10 }}>Assigned Callers</div>
            {campaign.assignedCallers.map(caller => (
              <div key={caller._id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Avatar name={caller.name} size={26} />
                <span style={{ fontSize: 12, color: TEXT }}>{caller.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── RIGHT PANEL: Lead Detail ─────────────────────────────────────────── */}
      <LeadDetailPanel lead={selectedLead} onAction={handleLeadAction} />

      {/* ─── Add Leads Modal ──────────────────────────────────────────────────── */}
      {showAddLeads && (
        <AddLeadsModal
          campaignId={id}
          onClose={() => setShowAddLeads(false)}
          onSuccess={() => { fetchAll(); }}
        />
      )}

      {/* ─── Initiate Call Modal ──────────────────────────────────────────────── */}
      {showCallModal && selectedLead && (
        <CallModal
          lead={selectedLead}
          callers={callers}
          currentUser={currentUser}
          onClose={() => setShowCallModal(false)}
          onSuccess={refreshSelectedLead}
        />
      )}

      {/* ─── Add Note Modal ───────────────────────────────────────────────────── */}
      {showAddNoteModal && selectedLead && (
        <AddNoteModal
          lead={selectedLead}
          onClose={() => setShowAddNoteModal(false)}
          onSubmit={async (note) => {
            try {
              await leadsAPI.addNote(selectedLead._id, { note, type: 'note' });
              await refreshSelectedLead();
              fetchLeads(page);
            } catch (err) {
              alert(err.response?.data?.message || 'Failed to save note');
              throw err;
            }
          }}
        />
      )}
    </div>
  );
}