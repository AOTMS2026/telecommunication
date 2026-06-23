import { useState, useEffect, useCallback } from 'react';
import { salesformsAPI } from '../services/api';

const C = { indigo: '#6366f1', border: '#e5e2f5', ink: '#1e1b4b', sub: '#6b7280' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnGhost = { padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const lbl = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };

const EVENTS = [
  { value: 'on_status_update', label: 'On Status Update' },
  { value: 'on_button_click', label: 'On Button Click' },
  { value: 'on_field_change', label: 'On Field Change' },
];
const STATUSES = ['Fresh', 'Connected', 'Call Back Later', 'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost'];

export default function Salesforms() {
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState([]);
  const [tab, setTab] = useState('published');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setForms((await salesformsAPI.getAll({ status: tab })).data.salesforms); }
    catch (e) { console.error(e); }
    setLoading(false);
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  if (editing) return <SalesformEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>Salesforms</h2>
          <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 14 }}>Automatically fill lead form data</p>
        </div>
        <button style={btnPrimary} onClick={() => setEditing({ name: '', status: 'draft', triggerEvent: 'on_button_click', triggerConfig: {}, fields: [], actions: [] })}>Create Salesform +</button>
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        {['published', 'draft'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: 'none', border: 'none', padding: '8px 2px', cursor: 'pointer', fontSize: 14, fontWeight: 600, textTransform: 'capitalize', color: tab === t ? C.indigo : C.sub, borderBottom: tab === t ? `2px solid ${C.indigo}` : '2px solid transparent' }}>{t}</button>
        ))}
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>Loading…</div> : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 120px', padding: '12px 18px', background: '#f9f8ff', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>
            <span>Name</span><span>Events</span><span>Status</span><span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          {forms.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>No salesforms found</div>
            : forms.map((f, i) => (
              <div key={f._id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.2fr 1fr 120px', padding: '14px 18px', alignItems: 'center', borderBottom: i < forms.length - 1 ? '1px solid #f0eef8' : 'none' }}>
                <span style={{ fontWeight: 600, color: C.ink, cursor: 'pointer' }} onClick={() => setEditing(f)}>{f.name}</span>
                <span style={{ fontSize: 13, color: C.sub }}>{EVENTS.find(e => e.value === f.triggerEvent)?.label}</span>
                <Toggle on={f.status === 'published'} onToggle={async () => { await salesformsAPI.setStatus(f._id, f.status === 'published' ? 'draft' : 'published').catch(e => alert(e.response?.data?.message)); load(); }} />
                <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={{ ...btnGhost, padding: '5px 10px' }} onClick={() => setEditing(f)}>Edit</button>
                  <button style={{ ...btnGhost, padding: '5px 10px', color: '#dc2626', borderColor: '#fecaca' }} onClick={async () => { if (confirm('Delete?')) { await salesformsAPI.delete(f._id); load(); } }}>✕</button>
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ on, onToggle }) {
  return <button onClick={onToggle} style={{ width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer', background: on ? C.indigo : '#d1d5db', position: 'relative' }}>
    <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
  </button>;
}

function SalesformEditor({ initial, onClose, onSaved }) {
  const [f, setF] = useState(initial);
  const [tab, setTab] = useState('form');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setF(p => ({ ...p, ...patch }));

  const addField = () => set({ fields: [...f.fields, { id: `f${Date.now()}`, label: '', type: 'text', required: false, options: [], mapToLeadField: '' }] });
  const updField = (i, patch) => { const n = [...f.fields]; n[i] = { ...n[i], ...patch }; set({ fields: n }); };
  const rmField = (i) => set({ fields: f.fields.filter((_, x) => x !== i) });

  const save = async (publish) => {
    if (!f.name.trim()) return alert('Enter a name');
    setSaving(true);
    try {
      const saved = f._id ? (await salesformsAPI.update(f._id, f)).data.salesform : (await salesformsAPI.create(f)).data.salesform;
      if (publish) await salesformsAPI.setStatus(saved._id, 'published');
      onSaved();
    } catch (e) { alert(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  return (
    <div style={{ padding: '20px 28px', maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onClose} style={{ ...btnGhost, padding: '6px 12px' }}>←</button>
        <input value={f.name} onChange={e => set({ name: e.target.value })} placeholder="Salesform name" style={{ ...inp, fontWeight: 700, maxWidth: 340 }} />
        <div style={{ flex: 1 }} />
        <button style={btnGhost} disabled={saving} onClick={() => save(false)}>Save Draft</button>
        <button style={btnPrimary} disabled={saving} onClick={() => save(true)}>{saving ? 'Saving…' : 'Publish'}</button>
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${C.border}`, marginBottom: 18 }}>
        {[['form', 'Salesform'], ['config', 'Configuration']].map(([k, t]) => (
          <button key={k} onClick={() => setTab(k)} style={{ background: 'none', border: 'none', padding: '8px 2px', cursor: 'pointer', fontSize: 14, fontWeight: 600, color: tab === k ? C.indigo : C.sub, borderBottom: tab === k ? `2px solid ${C.indigo}` : '2px solid transparent' }}>{t}</button>
        ))}
      </div>

      {tab === 'config' ? (
        <div style={{ ...card, padding: 18 }}>
          <label style={lbl}>Trigger Event</label>
          <select value={f.triggerEvent} onChange={e => set({ triggerEvent: e.target.value })} style={inp}>
            {EVENTS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
          {f.triggerEvent === 'on_status_update' && (
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Show form when status becomes</label>
              <select value={f.triggerConfig?.status || ''} onChange={e => set({ triggerConfig: { ...f.triggerConfig, status: e.target.value } })} style={inp}>
                <option value="">Any status</option>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}
          {f.triggerEvent === 'on_field_change' && (
            <div style={{ marginTop: 12 }}>
              <label style={lbl}>Field name</label>
              <input value={f.triggerConfig?.field || ''} onChange={e => set({ triggerConfig: { ...f.triggerConfig, field: e.target.value } })} placeholder="e.g. leadSource" style={inp} />
            </div>
          )}
        </div>
      ) : (
        <div style={{ ...card, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <label style={{ ...lbl, margin: 0 }}>Form Fields</label>
            <button style={btnGhost} onClick={addField}>+ Add Field</button>
          </div>
          {f.fields.length === 0 && <div style={{ color: C.sub, fontSize: 13 }}>No fields yet.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {f.fields.map((fld, i) => (
              <div key={fld.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, background: '#fafaff' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 8 }}>
                  <input value={fld.label} onChange={e => updField(i, { label: e.target.value })} placeholder="Field label" style={inp} />
                  <select value={fld.type} onChange={e => updField(i, { type: e.target.value })} style={inp}>
                    {['text', 'number', 'date', 'select', 'textarea', 'checkbox'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input value={fld.mapToLeadField} onChange={e => updField(i, { mapToLeadField: e.target.value })} placeholder="Map to lead field (optional)" style={inp} />
                </div>
                {fld.type === 'select' && (
                  <input style={{ ...inp, marginTop: 8 }} placeholder="Options, comma-separated"
                    value={(fld.options || []).join(', ')} onChange={e => updField(i, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <label style={{ fontSize: 13, color: C.ink, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={fld.required} onChange={e => updField(i, { required: e.target.checked })} /> Required
                  </label>
                  <button onClick={() => rmField(i)} style={{ ...btnGhost, padding: '4px 10px', color: '#dc2626', borderColor: '#fecaca' }}>Remove</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}