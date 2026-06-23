import { useState, useEffect, useRef } from 'react';
import { webhooksAPI, workflowsAPI } from '../services/api';

const C = { indigo: '#6366f1', border: '#e5e2f5', ink: '#1e1b4b', sub: '#6b7280', bg: '#f9f8ff' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnGhost = { padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
const lbl = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };

function fmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export default function Webhooks() {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [expanded, setExpanded] = useState(null); // webhook _id being edited inline
  const [testResults, setTestResults] = useState({}); // id -> { loading, msg, ok }

  const load = async () => {
    setLoading(true);
    try { setHooks((await webhooksAPI.getAll()).data.webhooks); } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => {
    load();
    workflowsAPI.meta().then(r => setEvents(r.data.events || [])).catch(() => {});
  }, []);

  const handleTest = async (h) => {
    setTestResults(p => ({ ...p, [h._id]: { loading: true } }));
    try {
      const r = await webhooksAPI.test(h._id);
      setTestResults(p => ({ ...p, [h._id]: { loading: false, ok: true, msg: r.data.result?.message || 'Test delivered' } }));
      load();
    } catch (e) {
      setTestResults(p => ({ ...p, [h._id]: { loading: false, ok: false, msg: e.response?.data?.message || 'Test failed' } }));
    }
    setTimeout(() => setTestResults(p => { const n = { ...p }; delete n[h._id]; return n; }), 4000);
  };

  const handleDelete = async (h) => {
    if (!confirm(`Delete webhook "${h.name}"?`)) return;
    await webhooksAPI.delete(h._id);
    if (expanded === h._id) setExpanded(null);
    load();
  };

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>Webhook Management</h2>
          <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 14 }}>Manage outbound webhooks and connect to external systems</p>
        </div>
        <button style={btnPrimary} onClick={() => { setShowCreate(true); setExpanded(null); }}>+ Create new webhook</button>
      </div>

      {showCreate && (
        <div style={{ ...card, marginBottom: 20, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <h3 style={{ margin: 0, color: C.ink, fontSize: 16 }}>Create New Webhook</h3>
            <button style={{ ...btnGhost, padding: '4px 10px' }} onClick={() => setShowCreate(false)}>✕</button>
          </div>
          <WebhookSettingsForm
            initial={{ name: '', url: '', events: [], status: 'active' }}
            events={events}
            onSaved={() => { setShowCreate(false); load(); }}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>Loading…</div>
      ) : hooks.length === 0 ? (
        <div style={{ ...card, padding: 50, textAlign: 'center' }}>
          <div style={{ fontSize: 38, marginBottom: 10 }}>🪝</div>
          <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>No webhooks yet</div>
          <div style={{ color: C.sub, fontSize: 14, marginBottom: 16 }}>Create your first webhook to push lead events to other systems.</div>
          <button style={btnPrimary} onClick={() => setShowCreate(true)}>Create your first webhook</button>
        </div>
      ) : (
        <div style={{ ...card, overflow: 'hidden' }}>
          {/* Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 2fr 0.7fr 0.9fr 1.2fr 0.8fr 160px', padding: '12px 20px', background: C.bg, borderBottom: `1px solid ${C.border}`, fontSize: 11, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Name</span>
            <span>URL</span>
            <span>Events</span>
            <span>Status</span>
            <span>Last Triggered</span>
            <span>Deliveries</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {hooks.map((h, i) => {
            const tr = testResults[h._id];
            const isExpanded = expanded === h._id;
            return (
              <div key={h._id}>
                {/* Row */}
                <div
                  style={{ display: 'grid', gridTemplateColumns: '1.4fr 2fr 0.7fr 0.9fr 1.2fr 0.8fr 160px', padding: '14px 20px', alignItems: 'center', borderBottom: `1px solid ${isExpanded ? C.border : i < hooks.length - 1 ? '#f0eef8' : 'transparent'}`, cursor: 'default', background: isExpanded ? '#faf9ff' : '#fff' }}
                >
                  <span style={{ fontWeight: 600, color: C.ink, fontSize: 14 }}>{h.name}</span>
                  <span style={{ fontSize: 12, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>{h.url}</span>
                  <span style={{ fontSize: 13, color: C.sub }}>{h.events?.length || 0}</span>
                  <span>
                    <span style={{ background: h.status === 'active' ? '#d1fae5' : '#f3f4f6', color: h.status === 'active' ? '#059669' : '#6b7280', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                      {h.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </span>
                  <span style={{ fontSize: 12, color: C.sub }}>{fmt(h.lastTriggeredAt)}</span>
                  <span style={{ fontSize: 12 }}>
                    <span style={{ color: '#059669', fontWeight: 600 }}>{h.successCount || 0}</span>
                    <span style={{ color: C.sub }}> / </span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{h.failCount || 0}</span>
                  </span>
                  <span style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                    <button
                      style={{ ...btnGhost, padding: '5px 10px', fontSize: 12, color: tr?.ok === false ? '#dc2626' : tr?.ok ? '#059669' : C.ink }}
                      disabled={tr?.loading}
                      onClick={() => handleTest(h)}
                    >
                      {tr?.loading ? '…' : 'Test'}
                    </button>
                    <button
                      style={{ ...btnGhost, padding: '5px 10px', fontSize: 12, background: isExpanded ? '#f0eeff' : '#fff', color: isExpanded ? C.indigo : C.ink, borderColor: isExpanded ? C.indigo : C.border }}
                      onClick={() => setExpanded(isExpanded ? null : h._id)}
                    >
                      {isExpanded ? 'Close' : 'Settings'}
                    </button>
                    <button
                      style={{ ...btnGhost, padding: '5px 8px', fontSize: 12, color: '#dc2626', borderColor: '#fecaca' }}
                      onClick={() => handleDelete(h)}
                    >✕</button>
                  </span>
                </div>

                {/* Inline test result */}
                {tr && !tr.loading && (
                  <div style={{ padding: '8px 20px', background: tr.ok ? '#f0fdf4' : '#fef2f2', borderBottom: `1px solid ${tr.ok ? '#bbf7d0' : '#fecaca'}`, fontSize: 13, color: tr.ok ? '#15803d' : '#dc2626', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{tr.ok ? '✓' : '✕'}</span> {tr.msg}
                  </div>
                )}

                {/* Expanded settings */}
                {isExpanded && (
                  <div style={{ padding: '20px 24px', background: '#faf9ff', borderBottom: i < hooks.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <WebhookSettingsForm
                      initial={h}
                      events={events}
                      onSaved={() => { setExpanded(null); load(); }}
                      onCancel={() => setExpanded(null)}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WebhookSettingsForm({ initial, events, onSaved, onCancel }) {
  const [h, setH] = useState({ ...initial });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const set = (patch) => setH(p => ({ ...p, ...patch }));

  const toggleEvent = (val) =>
    set({ events: h.events?.includes(val) ? h.events.filter(e => e !== val) : [...(h.events || []), val] });

  const copySecret = () => {
    if (h.secret) {
      navigator.clipboard.writeText(h.secret).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    }
  };

  const save = async () => {
    if (!h.name?.trim() || !h.url?.trim()) return alert('Name and URL required');
    setSaving(true);
    try {
      if (h._id) await webhooksAPI.update(h._id, h);
      else await webhooksAPI.create(h);
      onSaved();
    } catch (e) { alert(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 28px' }}>
      {/* Webhook Name */}
      <div>
        <label style={lbl}>Webhook Name</label>
        <input value={h.name || ''} onChange={e => set({ name: e.target.value })} style={inp} placeholder="My Webhook" />
      </div>

      {/* Target URL */}
      <div>
        <label style={lbl}>Target URL</label>
        <input value={h.url || ''} onChange={e => set({ url: e.target.value })} style={inp} placeholder="https://your-system.com/webhook" />
      </div>

      {/* Secret */}
      {h._id && h.secret && (
        <div>
          <label style={lbl}>Signing Secret</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={h.secret} readOnly style={{ ...inp, fontFamily: 'monospace', fontSize: 12, color: C.sub, background: C.bg, flex: 1 }} />
            <button style={{ ...btnGhost, whiteSpace: 'nowrap', color: copied ? '#059669' : C.ink }} onClick={copySecret}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {/* Status toggle */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-start' }}>
        <label style={lbl}>Status</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            onClick={() => set({ status: h.status === 'active' ? 'inactive' : 'active' })}
            style={{ width: 44, height: 24, borderRadius: 12, background: h.status === 'active' ? C.indigo : '#d1d5db', cursor: 'pointer', position: 'relative', transition: 'background 0.2s' }}
          >
            <div style={{ position: 'absolute', top: 3, left: h.status === 'active' ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
          </div>
          <span style={{ fontSize: 14, color: h.status === 'active' ? '#059669' : C.sub, fontWeight: 600 }}>
            {h.status === 'active' ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      {/* Events */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={lbl}>Subscribed Events</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
          {events.map(e => (
            <label key={e.value} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: `1.5px solid ${h.events?.includes(e.value) ? C.indigo : C.border}`, borderRadius: 8, cursor: 'pointer', background: h.events?.includes(e.value) ? '#f0eeff' : '#fff', userSelect: 'none' }}>
              <input
                type="checkbox"
                checked={!!(h.events?.includes(e.value))}
                onChange={() => toggleEvent(e.value)}
                style={{ accentColor: C.indigo, width: 16, height: 16 }}
              />
              <span style={{ fontSize: 13, color: h.events?.includes(e.value) ? C.indigo : C.ink, fontWeight: h.events?.includes(e.value) ? 600 : 400 }}>{e.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Buttons */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
        <button style={btnGhost} onClick={onCancel}>Cancel</button>
        <button style={btnPrimary} disabled={saving} onClick={save}>
          {saving ? 'Saving…' : h._id ? 'Save Settings' : 'Create Webhook'}
        </button>
      </div>
    </div>
  );
}