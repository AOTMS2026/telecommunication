import { useState, useEffect } from 'react';
import { apiTemplatesAPI } from '../services/api';

const C = { indigo: '#6366f1', border: '#e5e2f5', ink: '#1e1b4b', sub: '#6b7280' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnGhost = { padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' };
const lbl = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };

export default function ApiTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const load = async () => { setLoading(true); try { setTemplates((await apiTemplatesAPI.getAll()).data.templates); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); }, []);

  if (editing) return <Editor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>API Templates</h2>
          <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 14 }}>Create an API template once and use it everywhere</p>
        </div>
        <button style={btnPrimary} onClick={() => setEditing({ name: '', method: 'POST', endpointUrl: '', headers: {}, bodyTemplate: {}, variablesUsed: [] })}>Create new +</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>Loading…</div> : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 120px', padding: '12px 18px', background: '#f9f8ff', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>
            <span>Template Name</span><span>Endpoint URL</span><span>Method</span><span>Modified By</span><span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          {templates.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>No API templates found. + Create new</div>
            : templates.map((t, i) => (
              <div key={t._id} style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr 1fr 1fr 120px', padding: '14px 18px', alignItems: 'center', borderBottom: i < templates.length - 1 ? '1px solid #f0eef8' : 'none' }}>
                <span style={{ fontWeight: 600, color: C.ink, cursor: 'pointer' }} onClick={() => setEditing(t)}>{t.name}</span>
                <span style={{ fontSize: 12, color: C.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.endpointUrl}</span>
                <span style={{ fontSize: 13, color: C.indigo, fontWeight: 600 }}>{t.method}</span>
                <span style={{ fontSize: 13, color: C.sub }}>{t.lastModifiedBy?.name || '—'}</span>
                <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={{ ...btnGhost, padding: '5px 10px' }} onClick={() => setEditing(t)}>Edit</button>
                  <button style={{ ...btnGhost, padding: '5px 10px', color: '#dc2626', borderColor: '#fecaca' }} onClick={async () => { if (confirm('Delete?')) { await apiTemplatesAPI.delete(t._id); load(); } }}>✕</button>
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function Editor({ initial, onClose, onSaved }) {
  const [t, setT] = useState({ ...initial, headersText: JSON.stringify(initial.headers || {}, null, 2), bodyText: JSON.stringify(initial.bodyTemplate || {}, null, 2) });
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const set = (patch) => setT(p => ({ ...p, ...patch }));

  const parse = (text, fallback) => { try { return JSON.parse(text || '{}'); } catch { return fallback; } };

  const save = async () => {
    if (!t.name.trim() || !t.endpointUrl.trim()) return alert('Name and endpoint URL are required');
    setSaving(true);
    try {
      const payload = {
        name: t.name, method: t.method, endpointUrl: t.endpointUrl,
        headers: parse(t.headersText, {}), bodyTemplate: parse(t.bodyText, {}),
        variablesUsed: (t.bodyText + t.endpointUrl).match(/\{\{[^}]+\}\}/g)?.map(s => s.replace(/[{}]/g, '')) || [],
      };
      if (t._id) await apiTemplatesAPI.update(t._id, payload); else await apiTemplatesAPI.create(payload);
      onSaved();
    } catch (e) { alert(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  const runTest = async () => {
    if (!t._id) return alert('Save the template first, then test it.');
    try { setTestResult((await apiTemplatesAPI.test(t._id, {})).data.result); }
    catch (e) { setTestResult({ error: e.response?.data?.message || e.message }); }
  };

  return (
    <div style={{ padding: '20px 28px', maxWidth: 760, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onClose} style={{ ...btnGhost, padding: '6px 12px' }}>←</button>
        <h3 style={{ margin: 0, color: C.ink }}>{t._id ? 'Edit' : 'New'} API Template</h3>
        <div style={{ flex: 1 }} />
        {t._id && <button style={btnGhost} onClick={runTest}>Test Run</button>}
        <button style={btnPrimary} disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button>
      </div>

      <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={lbl}>Template Name</label><input value={t.name} onChange={e => set({ name: e.target.value })} style={inp} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 12 }}>
          <div><label style={lbl}>Method</label>
            <select value={t.method} onChange={e => set({ method: e.target.value })} style={inp}>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}</select>
          </div>
          <div><label style={lbl}>Endpoint URL</label><input value={t.endpointUrl} onChange={e => set({ endpointUrl: e.target.value })} placeholder="https://api.example.com/leads" style={inp} /></div>
        </div>
        <div><label style={lbl}>Headers (JSON)</label><textarea value={t.headersText} onChange={e => set({ headersText: e.target.value })} rows={3} style={{ ...inp, fontFamily: 'monospace', fontSize: 13 }} /></div>
        <div>
          <label style={lbl}>Body Template (JSON · use {'{{lead.name}}'} tokens)</label>
          <textarea value={t.bodyText} onChange={e => set({ bodyText: e.target.value })} rows={6} style={{ ...inp, fontFamily: 'monospace', fontSize: 13 }}
            placeholder={'{\n  "name": "{{lead.name}}",\n  "phone": "{{lead.phone}}"\n}'} />
        </div>
        {testResult && (
          <div style={{ background: '#0f172a', color: '#a5f3fc', borderRadius: 8, padding: 12, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(testResult, null, 2)}
          </div>
        )}
      </div>
    </div>
  );
}