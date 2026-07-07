import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignsAPI, usersAPI, leadsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const PURPLE = 'var(--theme-primary)';
const PURPLE_DARK = 'var(--theme-primary-dark)';
const PURPLE_LIGHT = 'var(--theme-surface-tint2)';
const PURPLE_MID = 'var(--theme-primary-soft)';
const TEXT_MAIN = 'var(--theme-text-strongest)';
const TEXT_MUTED = '#94a3b8';
const TEXT_SUB = '#64748b';
const SURFACE = '#ffffff';
const BG = 'var(--theme-surface-faint)';
const BORDER = 'var(--theme-border-tint)';
const GRADIENT = 'var(--btn-gradient)';
const GRADIENT_SUBTLE = 'linear-gradient(135deg, var(--theme-surface-tint2) 0%, var(--theme-surface-faint) 100%)';

const globalStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  .campaign-page * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; }

  .campaign-row { transition: all 0.18s cubic-bezier(0.4,0,0.2,1); }
  .campaign-row:hover { background: linear-gradient(90deg, var(--theme-surface-faint8) 0%, var(--theme-surface-faint6) 100%) !important; transform: translateX(2px); box-shadow: inset 3px 0 0 var(--theme-primary); }

  .action-btn { transition: all 0.15s ease; }
  .action-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(var(--theme-primary-rgb),0.2); }

  .create-btn { transition: all 0.2s cubic-bezier(0.4,0,0.2,1); position: relative; overflow: hidden; }
  .create-btn::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 60%); pointer-events: none; }
  .create-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(var(--theme-primary-rgb),0.4) !important; }
  .create-btn:active { transform: translateY(0); }

  .filter-pill { transition: all 0.15s ease; }
  .filter-pill:hover { border-color: var(--theme-primary) !important; box-shadow: 0 2px 8px rgba(var(--theme-primary-rgb),0.12); }

  .search-box { transition: all 0.15s ease; }
  .search-box:focus-within { border-color: var(--theme-primary) !important; box-shadow: 0 0 0 3px rgba(var(--theme-primary-rgb),0.1) !important; }

  .stat-card { transition: all 0.2s ease; }
  .stat-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(var(--theme-primary-rgb),0.15) !important; }

  @keyframes spin { to { transform: rotate(360deg); } }
  .spin { animation: spin 0.8s linear infinite; }

  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  .fade-in { animation: fadeIn 0.3s ease forwards; }

  .progress-glow circle:last-child { filter: drop-shadow(0 0 4px rgba(var(--theme-primary-rgb),0.5)); }

  .table-header th { letter-spacing: 0.05em; }
`;

function TransferLeadsModal({ onClose }) {
  const [callers, setCallers] = useState([]);
  const [fromCaller, setFromCaller] = useState('');
  const [toCaller, setToCaller] = useState('');
  const [fromLeads, setFromLeads] = useState([]);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [loadingCallers, setLoadingCallers] = useState(true);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [transferMode, setTransferMode] = useState('all'); // 'all' | 'select'
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    usersAPI.getAll().then(res => {
      setCallers((res.data.users || []).filter(u => u.role === 'caller' && u.isActive));
    }).catch(() => {}).finally(() => setLoadingCallers(false));
  }, []);

  useEffect(() => {
    if (!fromCaller) { setFromLeads([]); setSelectedLeads([]); return; }
    setLoadingLeads(true);
    setSelectedLeads([]);
    leadsAPI.getByCallerAll(fromCaller)
      .then(res => setFromLeads(res.data.leads || []))
      .catch(() => setFromLeads([]))
      .finally(() => setLoadingLeads(false));
  }, [fromCaller]);

  const toggleLead = (id) => {
    setSelectedLeads(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedLeads.length === fromLeads.length) setSelectedLeads([]);
    else setSelectedLeads(fromLeads.map(l => l._id));
  };

  const handleTransfer = async () => {
    if (!fromCaller || !toCaller) return alert('Select both callers');
    if (fromCaller === toCaller) return alert('Source and destination cannot be the same');
    const leadsToTransfer = transferMode === 'select' ? selectedLeads : [];
    if (transferMode === 'select' && leadsToTransfer.length === 0) return alert('Select at least one lead');
    setSaving(true);
    try {
      const payload = { fromCallerId: fromCaller, toCallerId: toCaller };
      if (transferMode === 'select') payload.leadIds = leadsToTransfer;
      const res = await leadsAPI.transferLeads(payload);
      setResult(res.data);
    } catch (err) {
      alert(err.response?.data?.message || 'Transfer failed');
    } finally {
      setSaving(false);
    }
  };

  const fromCallerObj = callers.find(c => c._id === fromCaller);
  const toCallerObj = callers.find(c => c._id === toCaller);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,10,40,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(6px)' }}>
      <div className="fade-in" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(var(--theme-primary-rgb),0.2), 0 0 0 1px rgba(var(--theme-primary-rgb),0.08)', width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
        {/* Accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: GRADIENT, borderRadius: '20px 20px 0 0' }} />

        {/* Header */}
        <div style={{ padding: '28px 28px 16px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18, color: TEXT_MAIN, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2.5"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                Transfer Leads
              </div>
              <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 3 }}>Reassign leads from one caller to another</div>
            </div>
            <button onClick={onClose} style={{ background: '#f1f0f9', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SUB, fontSize: 16 }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: 28, overflowY: 'auto', flex: 1 }}>
          {result ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: '#e8f5e9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4caf50" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div style={{ fontWeight: 800, fontSize: 17, color: TEXT_MAIN, marginBottom: 8 }}>Transfer Complete!</div>
              <div style={{ fontSize: 13, color: TEXT_SUB, lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700, color: PURPLE }}>{result.modifiedCount}</span> lead(s) transferred<br />
                from <span style={{ fontWeight: 700 }}>{result.fromCaller}</span> → <span style={{ fontWeight: 700 }}>{result.toCaller}</span>
              </div>
              <button onClick={onClose} style={{ marginTop: 20, background: GRADIENT, color: '#fff', border: 'none', padding: '10px 28px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Done</button>
            </div>
          ) : (
            <>
              {/* Caller selectors */}
              {loadingCallers ? (
                <div style={{ textAlign: 'center', padding: 24, color: TEXT_MUTED }}>Loading callers...</div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, alignItems: 'end', marginBottom: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: TEXT_SUB, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>From Caller</label>
                      <select
                        value={fromCaller}
                        onChange={e => { setFromCaller(e.target.value); setTransferMode('all'); }}
                        style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${fromCaller ? PURPLE : BORDER}`, borderRadius: 10, fontSize: 13, outline: 'none', color: TEXT_MAIN, background: '#fafafa', cursor: 'pointer' }}
                      >
                        <option value="">Select caller...</option>
                        {callers.filter(c => c._id !== toCaller).map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ paddingBottom: 2, color: PURPLE_MID, fontWeight: 700 }}>→</div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: TEXT_SUB, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>To Caller</label>
                      <select
                        value={toCaller}
                        onChange={e => setToCaller(e.target.value)}
                        style={{ width: '100%', padding: '10px 12px', border: `1.5px solid ${toCaller ? PURPLE : BORDER}`, borderRadius: 10, fontSize: 13, outline: 'none', color: TEXT_MAIN, background: '#fafafa', cursor: 'pointer' }}
                      >
                        <option value="">Select caller...</option>
                        {callers.filter(c => c._id !== fromCaller).map(c => (
                          <option key={c._id} value={c._id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Lead count badge */}
                  {fromCaller && (
                    <div style={{ background: PURPLE_LIGHT, borderRadius: 10, padding: '8px 14px', marginBottom: 16, fontSize: 12.5, color: PURPLE, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2.5"><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0113 0"/></svg>
                      {loadingLeads ? 'Loading leads...' : `${fromLeads.length} lead(s) assigned to ${fromCallerObj?.name || ''}`}
                    </div>
                  )}

                  {/* Transfer mode toggle */}
                  {fromCaller && fromLeads.length > 0 && !loadingLeads && (
                    <>
                      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
                        {['all', 'select'].map(mode => (
                          <button
                            key={mode}
                            onClick={() => { setTransferMode(mode); setSelectedLeads([]); }}
                            style={{ padding: '6px 16px', borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', border: `1.5px solid ${transferMode === mode ? PURPLE : BORDER}`, background: transferMode === mode ? PURPLE_LIGHT : '#fff', color: transferMode === mode ? PURPLE : TEXT_SUB, transition: 'all 0.15s' }}
                          >
                            {mode === 'all' ? 'Transfer All' : 'Select Leads'}
                          </button>
                        ))}
                      </div>

                      {/* Lead selection list */}
                      {transferMode === 'select' && (
                        <div style={{ border: `1.5px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                          <div style={{ padding: '8px 12px', background: 'var(--theme-surface-faint6)', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input type="checkbox" checked={selectedLeads.length === fromLeads.length && fromLeads.length > 0} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: TEXT_SUB }}>
                              {selectedLeads.length > 0 ? `${selectedLeads.length} selected` : 'Select all'}
                            </span>
                          </div>
                          {fromLeads.map(lead => (
                            <div
                              key={lead._id}
                              onClick={() => toggleLead(lead._id)}
                              style={{ padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: `1px solid var(--theme-surface-faint4)`, background: selectedLeads.includes(lead._id) ? 'var(--theme-surface-faint8)' : '#fff', transition: 'background 0.12s' }}
                            >
                              <input type="checkbox" checked={selectedLeads.includes(lead._id)} onChange={() => {}} style={{ cursor: 'pointer', pointerEvents: 'none' }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: TEXT_MAIN }}>{lead.name}</div>
                                <div style={{ fontSize: 11, color: TEXT_MUTED }}>{lead.phone} {lead.campaign?.name ? `· ${lead.campaign.name}` : ''}</div>
                              </div>
                              <span style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 20, background: PURPLE_LIGHT, color: PURPLE, fontWeight: 600 }}>{lead.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {fromCaller && !loadingLeads && fromLeads.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 13, color: TEXT_MUTED }}>No leads assigned to this caller.</div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!result && (
          <div style={{ padding: '16px 28px', borderTop: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 10, border: `1.5px solid ${BORDER}`, background: '#fff', color: TEXT_SUB, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            <button
              onClick={handleTransfer}
              disabled={saving || !fromCaller || !toCaller || (transferMode === 'select' && selectedLeads.length === 0)}
              style={{ padding: '9px 22px', borderRadius: 10, border: 'none', background: (!fromCaller || !toCaller || saving) ? 'var(--theme-primary-pale)' : GRADIENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: (!fromCaller || !toCaller || saving) ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {saving ? 'Transferring...' : `Transfer ${transferMode === 'select' && selectedLeads.length > 0 ? selectedLeads.length + ' Lead(s)' : transferMode === 'all' && fromLeads.length > 0 ? fromLeads.length + ' Lead(s)' : 'Leads'}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CreateCampaignModal({ onClose, onSuccess }) {
  const [form, setForm] = useState({ name: '', description: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await campaignsAPI.create(form); onSuccess(); onClose(); }
    catch (err) { alert(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,10,40,0.55)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, backdropFilter: 'blur(6px)' }}>
      <div className="fade-in" style={{ background: '#fff', borderRadius: 20, boxShadow: '0 24px 64px rgba(var(--theme-primary-rgb),0.2), 0 0 0 1px rgba(var(--theme-primary-rgb),0.08)', width: '100%', maxWidth: 460, padding: 32, position: 'relative' }}>
        {/* Modal accent bar */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: GRADIENT, borderRadius: '20px 20px 0 0' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 18, color: TEXT_MAIN }}>New Campaign</div>
            <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>Set up a new outreach campaign</div>
          </div>
          <button onClick={onClose} style={{ background: '#f1f0f9', border: 'none', cursor: 'pointer', width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: TEXT_SUB, fontSize: 16, transition: 'all 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = PURPLE_LIGHT}
            onMouseLeave={e => e.currentTarget.style.background = '#f1f0f9'}
          >✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: TEXT_SUB, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Campaign Name *</label>
            <input
              placeholder="e.g. mba-batch-2025"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 13, outline: 'none', boxSizing: 'border-box', color: TEXT_MAIN, background: '#fafafa', transition: 'all 0.15s' }}
              onFocus={e => { e.target.style.borderColor = PURPLE; e.target.style.boxShadow = '0 0 0 3px rgba(var(--theme-primary-rgb),0.1)'; }}
              onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: TEXT_SUB, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Description</label>
            <textarea
              placeholder="Briefly describe this campaign's goal..."
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ width: '100%', padding: '10px 14px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box', color: TEXT_MAIN, background: '#fafafa', transition: 'all 0.15s' }}
              onFocus={e => { e.target.style.borderColor = PURPLE; e.target.style.boxShadow = '0 0 0 3px rgba(var(--theme-primary-rgb),0.1)'; }}
              onBlur={e => { e.target.style.borderColor = BORDER; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', border: `1.5px solid ${BORDER}`, borderRadius: 10, fontSize: 13, cursor: 'pointer', background: '#fff', color: TEXT_SUB, fontWeight: 600, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = PURPLE_MID; e.currentTarget.style.color = PURPLE; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = TEXT_SUB; }}
            >Cancel</button>
            <button type="submit" disabled={saving} className="create-btn" style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer', background: GRADIENT, color: '#fff', fontWeight: 700, boxShadow: '0 4px 16px rgba(var(--theme-primary-rgb),0.3)' }}>
              {saving ? 'Creating...' : '+ Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AssigneeAvatars({ callers }) {
  const colors = [
    { bg: 'var(--theme-primary-pale2)', color: 'var(--theme-primary-deep)' },
    { bg: '#dbeafe', color: '#1d4ed8' },
    { bg: '#d1fae5', color: '#065f46' },
    { bg: '#fce7f3', color: 'var(--theme-text-strong)' },
  ];
  if (!callers || callers.length === 0) return <span style={{ color: TEXT_MUTED, fontSize: 12 }}>—</span>;
  const shown = callers.slice(0, 4);
  const extra = callers.length - 4;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((c, i) => (
        <div key={c._id || i} title={c.name} style={{
          width: 28, height: 28, borderRadius: '50%',
          background: colors[i % colors.length].bg,
          color: colors[i % colors.length].color,
          fontSize: 10, fontWeight: 800,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2.5px solid #fff',
          marginLeft: i === 0 ? 0 : -8, zIndex: shown.length - i,
          position: 'relative',
          boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          letterSpacing: '0.02em',
        }}>
          {c.name?.slice(0, 2).toUpperCase() || 'U'}
        </div>
      ))}
      {extra > 0 && (
        <div style={{ fontSize: 10, color: TEXT_MUTED, marginLeft: 6, fontWeight: 600, background: '#f1f0f9', borderRadius: 20, padding: '1px 6px' }}>+{extra}</div>
      )}
    </div>
  );
}

function ProgressCircle({ value = 0 }) {
  const r = 15;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const dash = (pct / 100) * circ;
  const color = pct === 100 ? '#22c55e' : pct >= 70 ? PURPLE : pct >= 40 ? '#f59e0b' : '#f87171';
  const trackColor = pct === 100 ? '#dcfce7' : pct >= 70 ? 'var(--theme-surface-tint2)' : pct >= 40 ? '#fef9c3' : '#fee2e2';
  return (
    <div className="progress-glow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke={trackColor} strokeWidth="3.5" />
        <circle cx="20" cy="20" r={r} fill="none" stroke={color} strokeWidth="3.5"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
        <text x="20" y="24" textAnchor="middle" fontSize="9" fill={color} fontWeight="800">{pct}%</text>
      </svg>
    </div>
  );
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  return `${mins}m ago`;
}

function fmtLeads(n) {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(2)}K`;
  return String(n);
}

function FilterDropdown({ label, options, value, onChange, icon }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const active = !!value;

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        className="filter-pill"
        onClick={() => setOpen(p => !p)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: active ? PURPLE_LIGHT : SURFACE,
          border: `1.5px solid ${active ? PURPLE : BORDER}`,
          borderRadius: 10, padding: '7px 13px', cursor: 'pointer',
          fontSize: 12, color: active ? PURPLE : TEXT_SUB,
          fontWeight: active ? 700 : 500, whiteSpace: 'nowrap',
          boxShadow: active ? '0 0 0 3px rgba(var(--theme-primary-rgb),0.08)' : 'none',
        }}
      >
        {icon && <span style={{ opacity: 0.7 }}>{icon}</span>}
        {active ? value : label}
        {active
          ? <span onClick={e => { e.stopPropagation(); onChange(''); }} style={{ fontWeight: 800, fontSize: 14, lineHeight: 1, marginLeft: 2, color: PURPLE, opacity: 0.7 }}>×</span>
          : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
        }
      </div>
      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: '110%', left: 0, zIndex: 300,
          background: '#fff', border: `1.5px solid ${BORDER}`, borderRadius: 14,
          boxShadow: '0 12px 40px rgba(var(--theme-primary-rgb),0.15)', padding: 8, minWidth: 200
        }}>
          <div
            onClick={() => { onChange(''); setOpen(false); }}
            style={{ padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12, color: !value ? PURPLE : TEXT_MUTED, background: !value ? PURPLE_LIGHT : 'transparent', fontWeight: !value ? 700 : 500, marginBottom: 2 }}
          >
            All
          </div>
          {options.map(opt => (
            <div
              key={opt.value || opt}
              onClick={() => { onChange(opt.value || opt); setOpen(false); }}
              style={{
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                color: value === (opt.value || opt) ? PURPLE : TEXT_MAIN,
                background: value === (opt.value || opt) ? PURPLE_LIGHT : 'transparent',
                fontWeight: value === (opt.value || opt) ? 700 : 500,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {opt.dot && <span style={{ width: 8, height: 8, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} />}
              {opt.label || opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Campaigns() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');

  const [priorityFilter, setPriorityFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [createdByFilter, setCreatedByFilter] = useState('');

  // Transfer Leads modal state
  const [showTransfer, setShowTransfer] = useState(false);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await campaignsAPI.getAll();
      const raw = res.data.campaigns || [];
      const withProgress = raw.map(c => {
        const breakdown = c.statusBreakdown || [];
        let total = 0, called = 0, won = 0;
        breakdown.forEach(s => {
          total += s.count;
          if (s._id !== 'Fresh') called += s.count;
          if (s._id === 'Won') won += s.count;
        });
        const totalLeads = total || c.totalLeads || 0;
        const progress = totalLeads > 0 ? Math.round((called / totalLeads) * 100) : 0;
        return { ...c, totalLeads, called, won, progress };
      });
      setCampaigns(withProgress);
    }
    catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadCampaigns(); }, []);

  const allAssignees = [...new Map(
    campaigns.flatMap(c => c.assignedCallers || []).map(a => [a._id, a])
  ).values()];

  const allCreators = [...new Map(
    campaigns.filter(c => c.createdBy).map(c => [c.createdBy._id || c.createdBy, c.createdBy])
  ).values()];

  const dateRanges = {
    'Today': 1,
    'Last 7 days': 7,
    'Last 30 days': 30,
    'Last 3 months': 90,
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  let filtered = campaigns.filter(c => {
    if (search && !c.name?.toLowerCase().includes(search.toLowerCase())) return false;
    if (priorityFilter && c.priority !== priorityFilter) return false;
    if (dateFilter && dateRanges[dateFilter]) {
      const cutoff = Date.now() - dateRanges[dateFilter] * 24 * 60 * 60 * 1000;
      if (new Date(c.createdAt).getTime() < cutoff) return false;
    }
    if (assigneeFilter) {
      const has = (c.assignedCallers || []).some(a => (a._id || a) === assigneeFilter);
      if (!has) return false;
    }
    if (createdByFilter) {
      const creator = c.createdBy?._id || c.createdBy;
      if (creator !== createdByFilter) return false;
    }
    return true;
  });

  filtered = [...filtered].sort((a, b) => {
    let av = a[sortField], bv = b[sortField];
    if (sortField === 'createdAt') { av = new Date(av); bv = new Date(bv); }
    if (sortField === 'totalLeads' || sortField === 'progress') { av = Number(av) || 0; bv = Number(bv) || 0; }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const SortIcon = ({ field }) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      {sortField === field
        ? <polyline points={sortDir === 'asc' ? '8 9 12 5 16 9' : '8 15 12 19 16 15'} />
        : <><polyline points="8 9 12 5 16 9"/><polyline points="16 15 12 19 8 15"/></>
      }
    </svg>
  );

  const refresh = () => loadCampaigns();

  const handleDeleteCampaign = async (campaign, e) => {
    e.stopPropagation();
    if (!window.confirm(`Delete campaign "${campaign.name}"? This will remove it from any linked leads.`)) return;
    try {
      await campaignsAPI.delete(campaign._id);
      await loadCampaigns();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete campaign');
    }
  };

  // Derive summary stats
  const totalLeadsAll = campaigns.reduce((s, c) => s + (c.totalLeads || 0), 0);
  const avgProgress = campaigns.length > 0 ? Math.round(campaigns.reduce((s, c) => s + (c.progress || 0), 0) / campaigns.length) : 0;
  const activeCampaigns = campaigns.filter(c => (c.progress || 0) < 100).length;

  return (
    <div className="campaign-page" style={{ padding: '28px 28px 40px', background: BG, minHeight: 'calc(100vh - 64px)', boxSizing: 'border-box' }}>
      <style>{globalStyles}</style>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(var(--theme-primary-rgb),0.3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: TEXT_MAIN, margin: 0, letterSpacing: '-0.02em' }}>Campaigns</h1>
            <button onClick={refresh} title="Refresh" style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED, display: 'flex', padding: 4, borderRadius: 6, transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.color = PURPLE; e.currentTarget.style.background = PURPLE_LIGHT; }}
              onMouseLeave={e => { e.currentTarget.style.color = TEXT_MUTED; e.currentTarget.style.background = 'none'; }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/>
              </svg>
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: TEXT_MUTED, margin: 0, fontWeight: 500 }}>
            Your calling list sorted.{' '}
            <span style={{ color: PURPLE, cursor: 'pointer', fontWeight: 600, borderBottom: `1px dashed ${PURPLE_MID}` }}>Learn More</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {(user?.role === 'manager' || user?.role === 'admin') && (
            <button
              className="action-btn"
              onClick={() => setShowTransfer(true)}
              style={{ background: '#fff', color: PURPLE, border: `1.5px solid ${PURPLE}`, padding: '10px 18px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2.5"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
              Transfer Leads
            </button>
          )}
          <button
            className="create-btn"
            onClick={() => setShowCreate(true)}
            style={{ background: GRADIENT, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, boxShadow: '0 4px 20px rgba(var(--theme-primary-rgb),0.35)' }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Create New
          </button>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          {
            label: 'Total Campaigns',
            value: campaigns.length,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>,
            color: PURPLE, bg: PURPLE_LIGHT, suffix: ''
          },
          {
            label: 'Total Leads',
            value: fmtLeads(totalLeadsAll),
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
            color: '#2563eb', bg: '#dbeafe', suffix: ''
          },
          {
            label: 'Avg. Progress',
            value: avgProgress,
            icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/></svg>,
            color: '#059669', bg: '#d1fae5', suffix: '%'
          },
        ].map((stat, i) => (
          <div key={i} className="stat-card" style={{ background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 14, boxShadow: '0 2px 8px rgba(var(--theme-primary-rgb),0.04)' }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: stat.bg, color: stat.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {stat.icon}
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: TEXT_MAIN, letterSpacing: '-0.03em', lineHeight: 1.1 }}>{stat.value}{stat.suffix}</div>
              <div style={{ fontSize: 11.5, color: TEXT_MUTED, fontWeight: 500, marginTop: 2 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div className="search-box" style={{ flex: 1, minWidth: 180, maxWidth: 340, display: 'flex', alignItems: 'center', gap: 8, background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 10, padding: '8px 13px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2.5">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search campaigns..."
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12.5, color: TEXT_MAIN, width: '100%', fontWeight: 500 }}
          />
          {search && <span onClick={() => setSearch('')} style={{ cursor: 'pointer', color: TEXT_MUTED, fontWeight: 700, fontSize: 15 }}>×</span>}
        </div>

        <FilterDropdown
          label="Priority"
          value={priorityFilter}
          onChange={setPriorityFilter}
          options={[
            { label: 'High', value: 'high', dot: '#ef4444' },
            { label: 'Medium', value: 'medium', dot: '#f59e0b' },
            { label: 'Low', value: 'low', dot: '#22c55e' },
          ]}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>}
        />

        <FilterDropdown
          label="Date"
          value={dateFilter}
          onChange={setDateFilter}
          options={['Today', 'Last 7 days', 'Last 30 days', 'Last 3 months']}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
        />

        <FilterDropdown
          label="Select Assignee"
          value={assigneeFilter ? (allAssignees.find(a => a._id === assigneeFilter)?.name || assigneeFilter) : ''}
          onChange={(val) => {
            if (!val) { setAssigneeFilter(''); return; }
            const found = allAssignees.find(a => a.name === val);
            setAssigneeFilter(found?._id || val);
          }}
          options={allAssignees.map(a => ({ label: a.name, value: a.name }))}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>}
        />

        <FilterDropdown
          label="Select Created by"
          value={createdByFilter ? (typeof allCreators.find(c => (c._id || c) === createdByFilter) === 'object' ? allCreators.find(c => (c._id || c) === createdByFilter)?.name : createdByFilter) : ''}
          onChange={(val) => {
            if (!val) { setCreatedByFilter(''); return; }
            const found = allCreators.find(c => c.name === val);
            setCreatedByFilter(found?._id || val);
          }}
          options={allCreators.filter(c => c && c.name).map(c => ({ label: c.name, value: c.name }))}
          icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
        />
      </div>

      {/* ── Active filter chips ── */}
      {(priorityFilter || dateFilter || assigneeFilter || createdByFilter) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 600 }}>Active filters:</span>
          {[
            priorityFilter && { label: `Priority: ${priorityFilter}`, clear: () => setPriorityFilter('') },
            dateFilter && { label: `Date: ${dateFilter}`, clear: () => setDateFilter('') },
            assigneeFilter && { label: `Assignee: ${allAssignees.find(a => a._id === assigneeFilter)?.name || assigneeFilter}`, clear: () => setAssigneeFilter('') },
            createdByFilter && { label: `Created by: ${allCreators.find(c => (c._id || c) === createdByFilter)?.name || createdByFilter}`, clear: () => setCreatedByFilter('') },
          ].filter(Boolean).map((f, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, background: PURPLE_LIGHT, color: PURPLE, borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, border: `1px solid ${PURPLE}22` }}>
              {f.label}
              <span onClick={f.clear} style={{ cursor: 'pointer', fontWeight: 800, fontSize: 13, opacity: 0.7 }}>×</span>
            </span>
          ))}
          <span
            onClick={() => { setPriorityFilter(''); setDateFilter(''); setAssigneeFilter(''); setCreatedByFilter(''); }}
            style={{ fontSize: 11, color: TEXT_MUTED, cursor: 'pointer', textDecoration: 'underline', fontWeight: 600 }}
          >Clear all</span>
        </div>
      )}

      {/* ── Table ── */}
      <div style={{ background: SURFACE, border: `1.5px solid ${BORDER}`, borderRadius: 18, overflow: 'hidden', boxShadow: '0 4px 24px rgba(var(--theme-primary-rgb),0.06)' }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 140, gap: 12 }}>
            <div className="spin" style={{ width: 30, height: 30, border: `3px solid ${PURPLE_LIGHT}`, borderTopColor: PURPLE, borderRadius: '50%' }} />
            <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>Loading campaigns...</span>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead className="table-header">
              <tr style={{ borderBottom: `2px solid ${BORDER}`, background: GRADIENT_SUBTLE }}>
                {[
                  { label: 'Name', field: 'name' },
                  { label: 'Priority', field: 'priority' },
                  { label: 'Assignee', field: 'assignee' },
                  { label: 'Total Leads', field: 'totalLeads' },
                  { label: 'Progress', field: 'progress' },
                  { label: 'Created on', field: 'createdAt' },
                  { label: 'Actions', field: null },
                ].map(col => (
                  <th
                    key={col.label}
                    onClick={() => col.field && handleSort(col.field)}
                    style={{
                      padding: '13px 18px', textAlign: 'left', fontSize: 11,
                      color: sortField === col.field ? PURPLE : TEXT_MUTED,
                      fontWeight: 700, cursor: col.field ? 'pointer' : 'default',
                      userSelect: 'none', whiteSpace: 'nowrap',
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {col.label}
                      {col.field && <SortIcon field={col.field} />}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: '56px 18px', textAlign: 'center', color: TEXT_MUTED, fontSize: 13 }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📢</div>
                    <div style={{ fontWeight: 700, color: TEXT_SUB, fontSize: 14, marginBottom: 4 }}>
                      {search || priorityFilter || dateFilter || assigneeFilter || createdByFilter ? 'No campaigns match your filters' : 'No campaigns yet'}
                    </div>
                    <div style={{ fontSize: 12, color: TEXT_MUTED }}>
                      {!search && !priorityFilter && !dateFilter && !assigneeFilter && !createdByFilter && 'Create your first campaign to get started.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((c, idx) => (
                  <tr
                    key={c._id}
                    className="campaign-row"
                    style={{ borderBottom: `1px solid var(--theme-surface-faint)`, cursor: 'pointer' }}
                    onClick={() => navigate(`/campaigns/${c._id}`)}
                  >
                    {/* Name */}
                    <td style={{ padding: '15px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 9, background: GRADIENT_SUBTLE, border: `1.5px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: PURPLE }}>
                            {c.name?.slice(0, 1).toUpperCase() || 'C'}
                          </span>
                        </div>
                        <span style={{ fontSize: 13.5, color: TEXT_MAIN, fontWeight: 700, letterSpacing: '-0.01em' }}>@{c.name}</span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td style={{ padding: '15px 18px' }}>
                      {c.priority ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                          background: c.priority === 'high' ? '#fff1f1' : c.priority === 'medium' ? '#fffbeb' : '#f0fdf4',
                          color: c.priority === 'high' ? '#dc2626' : c.priority === 'medium' ? '#d97706' : '#16a34a',
                          border: `1px solid ${c.priority === 'high' ? '#fecaca' : c.priority === 'medium' ? '#fde68a' : '#bbf7d0'}`,
                          textTransform: 'capitalize', letterSpacing: '0.02em',
                        }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                          {c.priority}
                        </span>
                      ) : (
                        <span style={{ color: TEXT_MUTED, fontSize: 12 }}>—</span>
                      )}
                    </td>

                    {/* Assignee avatars */}
                    <td style={{ padding: '15px 18px' }}>
                      <AssigneeAvatars callers={c.assignedCallers} />
                    </td>

                    {/* Total leads */}
                    <td style={{ padding: '15px 18px' }}>
                      <span style={{ fontSize: 14, color: TEXT_MAIN, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtLeads(c.totalLeads || 0)}</span>
                    </td>

                    {/* Progress circle */}
                    <td style={{ padding: '15px 18px' }} onClick={e => e.stopPropagation()}>
                      <ProgressCircle value={c.progress || 0} />
                    </td>

                    {/* Created on */}
                    <td style={{ padding: '15px 18px' }}>
                      <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500, background: 'var(--theme-surface-faint)', padding: '3px 8px', borderRadius: 6, border: `1px solid ${BORDER}` }}>
                        {timeAgo(c.createdAt)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '15px 18px' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="action-btn"
                          title="Analytics"
                          style={{ background: PURPLE_LIGHT, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: PURPLE }}
                          onClick={() => navigate(`/campaigns/${c._id}`)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/>
                          </svg>
                        </button>
                        <button
                          className="action-btn"
                          title="Delete campaign"
                          style={{ background: '#fff1f1', border: '1px solid #fecaca', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#dc2626' }}
                          onClick={(e) => handleDeleteCampaign(c, e)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                          </svg>
                        </button>
                        <button
                          className="action-btn"
                          title="Refresh"
                          style={{ background: 'var(--theme-surface-faint)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: TEXT_SUB }}
                          onClick={loadCampaigns}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/>
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Row count footer */}
      {!loading && filtered.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 11.5, color: TEXT_MUTED, fontWeight: 500, textAlign: 'right' }}>
          Showing <span style={{ color: PURPLE, fontWeight: 700 }}>{filtered.length}</span> of <span style={{ fontWeight: 700, color: TEXT_SUB }}>{campaigns.length}</span> campaigns
        </div>
      )}

      {showCreate && <CreateCampaignModal onClose={() => setShowCreate(false)} onSuccess={loadCampaigns} />}
      {showTransfer && <TransferLeadsModal onClose={() => setShowTransfer(false)} />}
    </div>
  );
}