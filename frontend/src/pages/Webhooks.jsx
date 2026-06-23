import { useState, useEffect } from 'react';
import { webhooksAPI, workflowsAPI } from '../services/api';

const C = { indigo: '#6366f1', border: '#e5e2f5', ink: '#1e1b4b', sub: '#6b7280' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnGhost = { padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const lbl = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };

export default function Webhooks() {
  const [hooks, setHooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [events, setEvents] = useState([]);
  const [modal, setModal] = useState(null);

  const load = async () => { setLoading(true); try { setHooks((await webhooksAPI.getAll()).data.webhooks); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); workflowsAPI.meta().then(r => setEvents(r.data.events)).catch(() => {}); }, []);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>Webhook Management</h2>
          <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 14 }}>Manage outbound webhooks and connect to external systems</p>
        </div>
        <button style={btnPrimary} onClick={() => setModal({ name: '', url: '', events: [], status: 'active' })}>Create new webhook +</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>Loading…</div>
        : hooks.length === 0 ? (
          <div style={{ ...card, padding: 50, textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>🪝</div>
            <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>No webhooks yet</div>
            <div style={{ color: C.sub, fontSize: 14, marginBottom: 16 }}>Create your first webhook to push lead events to other systems.</div>
            <button style={btnPrimary} onClick={() => setModal({ name: '', url: '', events: [], status: 'active' })}>Create your first webhook</button>
          </div>
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 150px', padding: '12px 18px', background: '#f9f8ff', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>
              <span>Name</span><span>URL</span><span>Events</span><span>Status</span><span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {hooks.map((h, i) => (
              <div key={h._id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 150px', padding: '14px 18px', alignItems: 'center', borderBottom: i < hooks.length - 1 ? '1px solid #f0eef8' : 'none' }}>
                <span style={{ fontWeight: 600, color: C.ink }}>{h.name}</span>
                <span style={{ fontSize: 12, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.url}</span>
                <span style={{ fontSize: 13, color: C.sub }}>{h.events?.length || 0}</span>
                <span><span style={{ background: h.status === 'active' ? '#d1fae5' : '#f3f4f6', color: h.status === 'active' ? '#059669' : '#6b7280', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{h.status}</span></span>
                <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={{ ...btnGhost, padding: '5px 10px' }} onClick={async () => { const r = await webhooksAPI.test(h._id); alert(r.data.result?.message || 'Sent'); load(); }}>Test</button>
                  <button style={{ ...btnGhost, padding: '5px 10px' }} onClick={() => setModal(h)}>Edit</button>
                  <button style={{ ...btnGhost, padding: '5px 10px', color: '#dc2626', borderColor: '#fecaca' }} onClick={async () => { if (confirm('Delete?')) { await webhooksAPI.delete(h._id); load(); } }}>✕</button>
                </span>
              </div>
            ))}
          </div>
        )}

      {modal && <WebhookModal initial={modal} events={events} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
    </div>
  );
}

function WebhookModal({ initial, events, onClose, onSaved }) {
  const [h, setH] = useState(initial);
  const [saving, setSaving] = useState(false);
  const set = (patch) => setH(p => ({ ...p, ...patch }));
  const toggleEvent = (val) => set({ events: h.events?.includes(val) ? h.events.filter(e => e !== val) : [...(h.events || []), val] });

  const save = async () => {
    if (!h.name.trim() || !h.url.trim()) return alert('Name and URL required');
    setSaving(true);
    try { if (h._id) await webhooksAPI.update(h._id, h); else await webhooksAPI.create(h); onSaved(); }
    catch (e) { alert(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ ...card, width: 480, maxWidth: '92vw', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', color: C.ink }}>{h._id ? 'Edit' : 'Create new'} webhook</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Webhook name</label><input value={h.name} onChange={e => set({ name: e.target.value })} style={inp} /></div>
          <div><label style={lbl}>Target URL</label><input value={h.url} onChange={e => set({ url: e.target.value })} placeholder="https://your-system.com/webhook" style={inp} /></div>
          <div>
            <label style={lbl}>Subscribed Events</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {events.map(e => (
                <button key={e.value} onClick={() => toggleEvent(e.value)} style={{
                  padding: '5px 12px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 500,
                  border: `1.5px solid ${h.events?.includes(e.value) ? C.indigo : C.border}`,
                  background: h.events?.includes(e.value) ? '#f0eeff' : '#fff', color: h.events?.includes(e.value) ? C.indigo : C.sub,
                }}>{e.label}</button>
              ))}
            </div>
          </div>
          {h.secret && <div style={{ fontSize: 12, color: C.sub }}>Signing secret: <code>{h.secret}</code></div>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button style={btnGhost} onClick={onClose}>Cancel</button>
          <button style={btnPrimary} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}