import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { campaignsAPI, leadsAPI } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import LeadDetailsPage from '../components/LeadDetails/LeadDetailsPage';

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

// ─── AI Calling Panel ────────────────────────────────────────────────────────
function AICallingPanel({ campaignId, campaign, onStatusChange }) {
  const [aiStatus, setAiStatus] = useState(null);
  const [aiConcurrency, setAiConcurrency] = useState(5);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await campaignsAPI.aiStatus(campaignId);
      setAiStatus(res.data);
    } catch (err) {
      // silently ignore if endpoint not available yet
    }
  }, [campaignId]);

  // Poll every 5s while panel is mounted
  useEffect(() => {
    if (!campaignId) return;
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000);
    return () => clearInterval(interval);
  }, [campaignId, refreshStatus]);

  const handleStart = async () => {
    setLoading(true);
    try {
      await campaignsAPI.aiStart(campaignId, { aiConcurrencyLimit: aiConcurrency });
      await refreshStatus();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to start AI calling');
    } finally {
      setLoading(false);
    }
  };

  const handlePause = async () => {
    setLoading(true);
    try {
      await campaignsAPI.aiPause(campaignId);
      await refreshStatus();
      if (onStatusChange) onStatusChange();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to pause AI calling');
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = aiStatus?.aiCallingEnabled;

  return (
    <div style={{
      background: isEnabled ? '#f0fdf4' : '#fafafa',
      border: `1.5px solid ${isEnabled ? '#86efac' : BORDER}`,
      borderRadius: 12,
      overflow: 'hidden',
      transition: 'border-color 0.3s, background 0.3s',
    }}>
      {/* Header row */}
      <div
        style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Animated dot */}
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: isEnabled ? '#22c55e' : '#d1d5db',
            boxShadow: isEnabled ? '0 0 0 3px #bbf7d0' : 'none',
            animation: isEnabled ? 'aipulse 1.5s infinite' : 'none',
            flexShrink: 0,
          }} />
          <style>{`@keyframes aipulse{0%,100%{box-shadow:0 0 0 0 #bbf7d0}50%{box-shadow:0 0 0 5px #bbf7d000}}`}</style>
          <span style={{ fontSize: 12, fontWeight: 700, color: isEnabled ? '#15803d' : TEXT }}>
            AI Calling {isEnabled ? '— Active' : '— Paused'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {aiStatus && (
            <span style={{ fontSize: 11, color: MUTED, fontVariantNumeric: 'tabular-nums' }}>
              {aiStatus.inProgress ?? 0} active · {aiStatus.queued ?? 0} queued
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="2.5"
            style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${isEnabled ? '#bbf7d0' : BORDER}` }}>
          {/* Stats row */}
          {aiStatus && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, margin: '10px 0' }}>
              {[
                { label: 'In Progress', value: aiStatus.inProgress ?? 0, color: '#16a34a' },
                { label: 'Queued', value: aiStatus.queued ?? 0, color: '#f59e0b' },
                { label: 'Done Today', value: aiStatus.completedToday ?? 0, color: P },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: '#fff', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, color: MUTED, marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Concurrency input (only when not active) */}
          {!isEnabled && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: MUTED, fontWeight: 600, whiteSpace: 'nowrap' }}>Concurrent calls:</label>
              <input
                type="number"
                min={1}
                max={20}
                value={aiConcurrency}
                onChange={e => setAiConcurrency(Math.max(1, Math.min(20, Number(e.target.value))))}
                style={{
                  width: 56, padding: '5px 8px', borderRadius: 7,
                  border: `1px solid ${BORDER}`, fontSize: 12, color: TEXT,
                  fontWeight: 600, outline: 'none', textAlign: 'center',
                }}
              />
            </div>
          )}

          {/* Action button */}
          {isEnabled ? (
            <button
              onClick={handlePause}
              disabled={loading}
              style={{
                width: '100%', padding: '8px', borderRadius: 8,
                background: loading ? '#fef9c3' : '#fef08a',
                border: '1px solid #fde047', color: '#854d0e',
                fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 12, height: 12, border: '2px solid #854d0e', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Pausing…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                  </svg>
                  Pause AI Calling
                </>
              )}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={loading}
              style={{
                width: '100%', padding: '8px', borderRadius: 8,
                background: loading ? '#d4c9f7' : P,
                border: 'none', color: '#fff',
                fontSize: 12, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {loading ? (
                <>
                  <div style={{ width: 12, height: 12, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  Starting…
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Start AI Calling
                </>
              )}
            </button>
          )}
        </div>
      )}
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
    leadsAPI.getAll({ limit: 200 })
      .then(res => {
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
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{lead.name}</div>
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CampaignDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

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
      if (fetched.length > 0 && !selectedLead) setSelectedLead(fetched[0]);
    } catch (err) { console.error(err); }
    finally { setLeadsLoading(false); }
  }, [id, statusFilter, search, selectedLead]);

  const handleLeadDetailsChange = (updatedLead) => {
    setSelectedLead(prev => (prev && updatedLead?._id === prev._id ? updatedLead : prev));
    fetchLeads(page);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchCampaign(), fetchLeads(1)]);
    setLoading(false);
  }, [fetchCampaign, fetchLeads]);

  useEffect(() => { fetchAll(); }, [id]);
  useEffect(() => { fetchLeads(page); }, [statusFilter, page]);

  const handleSearchSubmit = (e) => { if (e.key === 'Enter') { setPage(1); fetchLeads(1); } };

  const statusBreakdown = campaign?.statusBreakdown || [];
  const totalLeads = campaign?.totalLeads || statusBreakdown.reduce((a, b) => a + b.count, 0) || 0;
  const freshLeads = statusBreakdown.find(s => s._id === 'Fresh')?.count || 0;
  const wonLeads = statusBreakdown.find(s => s._id === 'Won')?.count || 0;
  const lostReasons = campaign?.lostReasons || [];

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

          {/* ── AI Calling Panel (below summary card) ─────────────────────────── */}
          <div style={{ marginTop: 10 }}>
            <AICallingPanel
              campaignId={id}
              campaign={campaign}
              onStatusChange={fetchCampaign}
            />
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</div>
                    {/* AI lock indicator on list item */}
                    {lead.aiLock?.expiresAt && new Date(lead.aiLock.expiresAt) > new Date() && (
                      <span style={{ fontSize: 9, background: '#dcfce7', color: '#15803d', borderRadius: 10, padding: '1px 5px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>AI</span>
                    )}
                    {lead.aiCallState === 'queued' && !lead.aiLock?.expiresAt && (
                      <span style={{ fontSize: 9, background: '#e0f2fe', color: '#0369a1', borderRadius: 10, padding: '1px 5px', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}>Q</span>
                    )}
                  </div>
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
      {selectedLead ? (
        <LeadDetailsPage
          key={selectedLead._id}
          leadId={selectedLead._id}
          embedded
          onDeleted={() => { setSelectedLead(null); fetchLeads(page); }}
          onChange={handleLeadDetailsChange}
        />
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED, flexDirection: 'column', gap: 8 }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span style={{ fontSize: 13 }}>Select a student to view details</span>
        </div>
      )}

      {/* ─── Add Leads Modal ──────────────────────────────────────────────────── */}
      {showAddLeads && (
        <AddLeadsModal
          campaignId={id}
          onClose={() => setShowAddLeads(false)}
          onSuccess={() => { fetchAll(); }}
        />
      )}
    </div>
  );
}