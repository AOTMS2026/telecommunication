import { useState, useEffect } from 'react';
import { callIqAPI } from '../services/api';

const C = { indigo: '#6366f1', border: '#e5e2f5', ink: '#1e1b4b', sub: '#6b7280' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnGhost = { padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const lbl = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };

export default function CallIqAgents() {
  const [agents, setAgents] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [picking, setPicking] = useState(false);

  const load = async () => { setLoading(true); try { setAgents((await callIqAPI.getAll()).data.agents); } catch (e) { console.error(e); } setLoading(false); };
  useEffect(() => { load(); callIqAPI.templates().then(r => setTemplates(r.data.templates)).catch(() => {}); }, []);

  if (editing) return <AgentEditor initial={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>Call-IQ Agents <span style={{ fontSize: 11, background: '#ede9fe', color: C.indigo, padding: '2px 8px', borderRadius: 10, verticalAlign: 'middle' }}>BETA</span></h2>
          <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 14 }}>Your intelligent assistants for AI-powered call audits</p>
        </div>
        <button style={btnPrimary} onClick={() => setPicking(true)}>+ Create New</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>Loading…</div>
        : agents.length === 0 ? (
          <div style={{ ...card, padding: 50, textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>✨</div>
            <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>No agents yet</div>
            <div style={{ color: C.sub, fontSize: 14, marginBottom: 16 }}>Create an AI agent to automatically audit your call transcripts.</div>
            <button style={btnPrimary} onClick={() => setPicking(true)}>+ Create New</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {agents.map(a => (
              <div key={a._id} style={{ ...card, padding: 18, cursor: 'pointer' }} onClick={() => setEditing(a)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🤖</div>
                  <div style={{ fontWeight: 700, color: C.ink }}>{a.name}</div>
                </div>
                <div style={{ fontSize: 12, color: C.sub }}>{a.provider} · {a.model}</div>
                <div style={{ marginTop: 10 }}>
                  <span style={{ background: a.status === 'published' ? '#d1fae5' : '#fef3c7', color: a.status === 'published' ? '#059669' : '#b45309', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}

      {picking && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...card, width: 520, maxWidth: '92vw', padding: 22 }}>
            <h3 style={{ margin: '0 0 4px', color: C.ink }}>AI Agent Templates</h3>
            <p style={{ color: C.sub, fontSize: 13, margin: '0 0 16px' }}>Choose a template or start from scratch</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {templates.map(t => (
                <div key={t.key} style={{ ...card, padding: 16, cursor: 'pointer' }} onClick={() => { setPicking(false); setEditing({ name: t.name, template: t.key, provider: 'openai', model: 'gpt-4o', apiKey: '', prompt: t.prompt, outputFields: t.outputFields, status: 'draft' }); }}>
                  <div style={{ fontSize: 22, marginBottom: 6 }}>📞</div>
                  <div style={{ fontWeight: 700, color: C.ink, fontSize: 14 }}>{t.name}</div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>{t.description}</div>
                </div>
              ))}
              <div style={{ ...card, padding: 16, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.indigo }} onClick={() => { setPicking(false); setEditing({ name: '', template: 'custom', provider: 'openai', model: 'gpt-4o', apiKey: '', prompt: '', outputFields: [{ key: 'summary', label: 'Summary', type: 'text' }], status: 'draft' }); }}>
                <div style={{ fontSize: 28 }}>＋</div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>Create from scratch</div>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 18 }}>
              <button style={btnGhost} onClick={() => setPicking(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AgentEditor({ initial, onClose, onSaved }) {
  const [a, setA] = useState({ ...initial, outputFields: initial.outputFields || [] });
  const [saving, setSaving] = useState(false);
  const [audits, setAudits] = useState([]);
  const [running, setRunning] = useState(false);
  const [transcript, setTranscript] = useState('');
  const set = (p) => setA(x => ({ ...x, ...p }));

  useEffect(() => { if (a._id) callIqAPI.getAudits(a._id).then(r => setAudits(r.data.audits)).catch(() => {}); }, [a._id]);

  const addField = () => set({ outputFields: [...a.outputFields, { key: '', label: '', type: 'text' }] });
  const updField = (i, p) => { const n = [...a.outputFields]; n[i] = { ...n[i], ...p }; set({ outputFields: n }); };
  const rmField = (i) => set({ outputFields: a.outputFields.filter((_, x) => x !== i) });

  const save = async (publish) => {
    if (!a.name.trim() || !a.prompt.trim()) return alert('Name and prompt are required');
    setSaving(true);
    try {
      const payload = { ...a };
      if (publish) payload.status = 'published';
      if (a._id) await callIqAPI.update(a._id, payload); else await callIqAPI.create(payload);
      onSaved();
    } catch (e) { alert(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  const runAudit = async () => {
    if (!a._id) return alert('Save the agent first.');
    if (!transcript.trim()) return alert('Paste a transcript to audit.');
    setRunning(true);
    try { const r = await callIqAPI.run(a._id, { transcript }); setAudits([r.data.audit, ...audits]); setTranscript(''); }
    catch (e) { alert(e.response?.data?.message || 'Run failed'); }
    setRunning(false);
  };

  return (
    <div style={{ padding: '20px 28px', maxWidth: 780, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <button onClick={onClose} style={{ ...btnGhost, padding: '6px 12px' }}>←</button>
        <h3 style={{ margin: 0, color: C.ink }}>Create AI Agent</h3>
        <div style={{ flex: 1 }} />
        <button style={btnGhost} disabled={saving} onClick={() => save(false)}>Save Draft</button>
        <button style={btnPrimary} disabled={saving} onClick={() => save(true)}>{saving ? 'Saving…' : 'Create'}</button>
      </div>

      <div style={{ ...card, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div><label style={lbl}>Agent Name</label><input value={a.name} onChange={e => set({ name: e.target.value })} style={inp} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label style={lbl}>AI Provider</label>
            <select value={a.provider} onChange={e => set({ provider: e.target.value })} style={inp}><option value="openai">OpenAI</option><option value="openrouter">OpenRouter</option></select>
          </div>
          <div><label style={lbl}>AI Model</label><input value={a.model} onChange={e => set({ model: e.target.value })} placeholder="gpt-4o" style={inp} /></div>
        </div>
        <div><label style={lbl}>API Key (optional — falls back to server key)</label><input value={a.apiKey} onChange={e => set({ apiKey: e.target.value })} placeholder="sk-…" style={inp} /></div>
        <div><label style={lbl}>Prompt</label><textarea value={a.prompt} onChange={e => set({ prompt: e.target.value })} rows={4} style={{ ...inp, fontFamily: 'inherit' }} placeholder="You are a call-quality auditor…" /></div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ ...lbl, margin: 0 }}>Output Fields Configuration</label>
            <button style={btnGhost} onClick={addField}>+ Add Field</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {a.outputFields.map((fld, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr 1fr 40px', gap: 8, alignItems: 'center' }}>
                <input value={fld.key} onChange={e => updField(i, { key: e.target.value })} placeholder="key" style={inp} />
                <input value={fld.label} onChange={e => updField(i, { label: e.target.value })} placeholder="Label" style={inp} />
                <select value={fld.type} onChange={e => updField(i, { type: e.target.value })} style={inp}>{['text', 'number', 'boolean', 'score'].map(t => <option key={t}>{t}</option>)}</select>
                <button onClick={() => rmField(i)} style={{ ...btnGhost, padding: '6px 0', color: '#dc2626', borderColor: '#fecaca' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {a._id && (
        <div style={{ ...card, padding: 18, marginTop: 18 }}>
          <label style={lbl}>Test Audit — paste a call transcript</label>
          <textarea value={transcript} onChange={e => setTranscript(e.target.value)} rows={4} style={{ ...inp, fontFamily: 'inherit' }} placeholder="Agent: Hello…\nStudent: Hi…" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
            <button style={btnPrimary} disabled={running} onClick={runAudit}>{running ? 'Auditing…' : 'Run Audit'}</button>
          </div>
          {audits.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginBottom: 8 }}>Recent audits</div>
              {audits.map(au => (
                <div key={au._id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 12, marginBottom: 8, background: '#fafaff' }}>
                  <div style={{ fontSize: 12, color: C.sub, marginBottom: 6 }}>{au.lead?.name || 'Pasted transcript'} · {new Date(au.createdAt).toLocaleString()} · <span style={{ color: au.status === 'success' ? '#059669' : '#dc2626' }}>{au.status}</span></div>
                  <pre style={{ margin: 0, fontSize: 12, color: C.ink, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>{JSON.stringify(au.result, null, 2)}</pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}