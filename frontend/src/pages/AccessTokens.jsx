import { useState, useEffect } from 'react';
import { accessTokensAPI } from '../services/api';

const C = { indigo: '#6366f1', border: '#e5e2f5', ink: '#1e1b4b', sub: '#6b7280' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnGhost = { padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const lbl = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };

export default function AccessTokens() {
  const [tokens, setTokens] = useState([]);
  const [meta, setMeta] = useState({ max: 6, used: 0 });
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState(null); // raw token shown once

  const load = async () => {
    setLoading(true);
    try { const r = await accessTokensAPI.getAll(); setTokens(r.data.tokens); setMeta({ max: r.data.max, used: r.data.used }); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>Access Tokens ({meta.used}/{meta.max})</h2>
          <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 14 }}>Generate access tokens to authenticate API requests</p>
        </div>
        <button style={btnPrimary} onClick={() => setCreating(true)}>+ Create new token</button>
      </div>

      {loading ? <div style={{ textAlign: 'center', padding: 50, color: C.sub }}>Loading…</div>
        : tokens.length === 0 ? (
          <div style={{ ...card, padding: 50, textAlign: 'center' }}>
            <div style={{ fontSize: 38, marginBottom: 10 }}>🔑</div>
            <div style={{ fontWeight: 600, color: C.ink, marginBottom: 4 }}>Create your first access token</div>
            <div style={{ color: C.sub, fontSize: 14, marginBottom: 16 }}>Access tokens are required to authenticate your requests to the API.</div>
            <button style={btnPrimary} onClick={() => setCreating(true)}>+ Create new token</button>
          </div>
        ) : (
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr 120px', padding: '12px 18px', background: '#f9f8ff', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>
              <span>Token</span><span>Type</span><span>Status</span><span>Recapture</span><span style={{ textAlign: 'right' }}>Actions</span>
            </div>
            {tokens.map((t, i) => (
              <div key={t._id} style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1.2fr 120px', padding: '14px 18px', alignItems: 'center', borderBottom: i < tokens.length - 1 ? '1px solid #f0eef8' : 'none' }}>
                <div><div style={{ fontWeight: 600, color: C.ink }}>{t.name}</div><code style={{ fontSize: 12, color: C.sub }}>{t.tokenPrefix}••••</code></div>
                <span style={{ fontSize: 13, color: C.indigo, fontWeight: 600, textTransform: 'capitalize' }}>{t.apiType}</span>
                <span><span style={{ background: t.status === 'active' ? '#d1fae5' : '#fee2e2', color: t.status === 'active' ? '#059669' : '#dc2626', padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>{t.status}</span></span>
                <span style={{ fontSize: 13, color: C.sub }}>{(t.recapturePreference || '').replace(/_/g, ' ')}</span>
                <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  {t.status === 'active' && <button style={{ ...btnGhost, padding: '5px 10px' }} onClick={async () => { if (confirm('Revoke this token?')) { await accessTokensAPI.revoke(t._id); load(); } }}>Revoke</button>}
                  <button style={{ ...btnGhost, padding: '5px 10px', color: '#dc2626', borderColor: '#fecaca' }} onClick={async () => { if (confirm('Delete?')) { await accessTokensAPI.delete(t._id); load(); } }}>✕</button>
                </span>
              </div>
            ))}
          </div>
        )}

      <div style={{ ...card, padding: 18, marginTop: 22, background: '#fffbeb', borderColor: '#fde68a' }}>
        <div style={{ fontWeight: 700, color: '#b45309', marginBottom: 8 }}>🛡️ Security & Best Practices</div>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#92400e', fontSize: 13, lineHeight: 1.7 }}>
          <li>Tokens are only visible once after creation. Download immediately.</li>
          <li>Keep tokens secure and never share publicly.</li>
          <li>Lost tokens must be revoked and regenerated.</li>
        </ul>
      </div>

      {creating && <CreateModal onClose={() => setCreating(false)} onCreated={(raw) => { setCreating(false); setNewToken(raw); load(); }} />}
      {newToken && <RevealModal rawToken={newToken} onClose={() => setNewToken(null)} />}
    </div>
  );
}

function CreateModal({ onClose, onCreated }) {
  const [f, setF] = useState({ name: '', apiType: 'async', recapturePreference: 'once_a_day' });
  const [saving, setSaving] = useState(false);
  const set = (p) => setF(x => ({ ...x, ...p }));

  const create = async () => {
    if (!f.name.trim()) return alert('Token name required');
    setSaving(true);
    try { const r = await accessTokensAPI.create(f); onCreated(r.data.rawToken); }
    catch (e) { alert(e.response?.data?.message || 'Failed'); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ ...card, width: 460, maxWidth: '92vw', padding: 22 }}>
        <h3 style={{ margin: '0 0 16px', color: C.ink }}>Create new API Token</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label style={lbl}>Token name</label><input value={f.name} onChange={e => set({ name: e.target.value })} placeholder="e.g. Website integration" style={inp} /></div>
          <div><label style={lbl}>Lead Recapture Preference</label>
            <select value={f.recapturePreference} onChange={e => set({ recapturePreference: e.target.value })} style={inp}>
              <option value="once_a_day">Once a day</option><option value="once_a_week">Once a week</option><option value="never">Never</option>
            </select>
          </div>
          <div><label style={lbl}>API Type</label>
            <div style={{ display: 'grid', gap: 10 }}>
              {[['async', 'Async APIs', 'Fire-and-forget, ideal for high-volume lead processing. 18,000 req/hr.'], ['sync', 'Sync APIs', 'Rate-limited, immediate response. Lower throughput.']].map(([val, t, d]) => (
                <label key={val} style={{ border: `1.5px solid ${f.apiType === val ? C.indigo : C.border}`, borderRadius: 10, padding: 12, cursor: 'pointer', background: f.apiType === val ? '#f0eeff' : '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input type="radio" checked={f.apiType === val} onChange={() => set({ apiType: val })} />
                    <span style={{ fontWeight: 600, color: C.ink }}>{t}</span>
                    {val === 'async' && <span style={{ fontSize: 11, background: '#dbeafe', color: '#1d4ed8', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>Recommended</span>}
                  </div>
                  <div style={{ fontSize: 12, color: C.sub, marginTop: 4, marginLeft: 24 }}>{d}</div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button style={btnGhost} onClick={onClose}>Cancel</button>
          <button style={btnPrimary} disabled={saving} onClick={create}>{saving ? 'Generating…' : 'Generate Token'}</button>
        </div>
      </div>
    </div>
  );
}

function RevealModal({ rawToken, onClose }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(30,27,75,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1001 }}>
      <div style={{ ...card, width: 520, maxWidth: '92vw', padding: 22 }}>
        <h3 style={{ margin: '0 0 6px', color: C.ink }}>✅ Token created</h3>
        <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 14px', fontWeight: 600 }}>Copy this now — it will never be shown again.</p>
        <div style={{ background: '#0f172a', color: '#a5f3fc', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 13, wordBreak: 'break-all' }}>{rawToken}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
          <button style={btnGhost} onClick={() => { navigator.clipboard.writeText(rawToken); setCopied(true); }}>{copied ? 'Copied!' : 'Copy'}</button>
          <button style={btnPrimary} onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}