import { useState, useEffect } from 'react';
import { n8nAPI } from '../services/api';

const C = { indigo: 'var(--theme-primary-alt)', border: 'var(--theme-border-tint)', ink: 'var(--theme-text-strongest)', sub: '#6b7280' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, border: 'none', background: 'var(--btn-gradient)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnGhost = { padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const lbl = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };

export default function N8nSettings() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ baseUrl: '', apiKey: '' });
  const [workflows, setWorkflows] = useState([]);
  const [wfLoading, setWfLoading] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await n8nAPI.getConfig();
      if (r.data.config) {
        setConfig(r.data.config);
        setForm({ baseUrl: r.data.config.baseUrl || '', apiKey: r.data.config.apiKey || '' });
        if (r.data.config.cachedWorkflows?.length) setWorkflows(r.data.config.cachedWorkflows);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const saveConfig = async () => {
    if (!form.baseUrl.trim() || !form.apiKey.trim()) return alert('Base URL and API key are required');
    setSaving(true);
    try {
      const r = await n8nAPI.saveConfig(form);
      setConfig(r.data.config);
      setTestResult(r.data.test);
    } catch (e) { alert(e.response?.data?.message || 'Save failed'); }
    setSaving(false);
  };

  const testConn = async () => {
    try { const r = await n8nAPI.test(); setTestResult(r.data); }
    catch (e) { setTestResult({ ok: false, error: e.response?.data?.message || e.message }); }
  };

  const refreshWorkflows = async () => {
    setWfLoading(true);
    try { const r = await n8nAPI.listWorkflows(); setWorkflows(r.data.workflows || []); }
    catch (e) { alert(e.response?.data?.message || 'Failed to fetch workflows'); }
    setWfLoading(false);
  };

  const triggerTest = async (n8nId) => {
    try {
      const r = await n8nAPI.trigger(n8nId, { test: true, source: 'AOTMS', message: 'Test trigger from AOTMS' });
      alert(r.data.ok ? `✅ Triggered via ${r.data.method}` : `❌ ${r.data.error || 'Failed'}`);
    } catch (e) { alert(e.response?.data?.message || 'Trigger failed'); }
  };

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: C.sub }}>Loading…</div>;

  const isConnected = config?.status === 'connected';

  return (
    <div style={{ padding: '24px 28px', maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 28 }}>⚡</span> n8n Integration
          </h2>
          <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 14 }}>Connect your self-hosted n8n instance to power workflow automations</p>
        </div>
        {isConnected && (
          <span style={{ background: '#d1fae5', color: '#059669', padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600 }}>
            ● Connected {config.n8nVersion ? `(${config.n8nVersion})` : ''}
          </span>
        )}
      </div>

      {/* Connection settings */}
      <div style={{ ...card, padding: 20, marginBottom: 20 }}>
        <h3 style={{ margin: '0 0 14px', fontSize: 15, fontWeight: 700, color: C.ink }}>Connection Settings</h3>
        <div style={{ display: 'grid', gap: 14 }}>
          <div>
            <label style={lbl}>n8n Base URL</label>
            <input value={form.baseUrl} onChange={e => setForm(f => ({ ...f, baseUrl: e.target.value }))}
              placeholder="https://n8n.yourdomain.com" style={inp} />
          </div>
          <div>
            <label style={lbl}>API Key</label>
            <input value={form.apiKey} onChange={e => setForm(f => ({ ...f, apiKey: e.target.value }))}
              placeholder="n8n_api_..." style={inp} type="password" />
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
              Generate at n8n → Settings → API → Create API Key
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnPrimary} disabled={saving} onClick={saveConfig}>
              {saving ? 'Saving…' : 'Save & Test Connection'}
            </button>
            {config && <button style={btnGhost} onClick={testConn}>Test Connection</button>}
          </div>
          {testResult && (
            <div style={{
              padding: 12, borderRadius: 8, fontSize: 13,
              background: testResult.ok ? '#ecfdf5' : '#fef2f2',
              color: testResult.ok ? '#059669' : '#dc2626',
              border: `1px solid ${testResult.ok ? '#a7f3d0' : '#fecaca'}`,
            }}>
              {testResult.ok
                ? `✅ Connected to n8n ${testResult.version || ''}`
                : `❌ Connection failed: ${testResult.error || 'Unknown error'}`}
            </div>
          )}
        </div>
      </div>

      {/* How it works */}
      <div style={{ ...card, padding: 20, marginBottom: 20, background: 'var(--theme-surface-faint)' }}>
        <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700, color: C.ink }}>How it works</h3>
        <div style={{ fontSize: 13, color: C.sub, lineHeight: 1.7 }}>
          <p style={{ margin: '0 0 8px' }}>Once connected, AOTMS can trigger n8n workflows when CRM events happen (lead created, status changed, etc.).</p>
          <p style={{ margin: '0 0 8px' }}><strong>Setup in n8n:</strong> Create a workflow that starts with a <strong>Webhook node</strong>. The webhook path should be the workflow ID. AOTMS will POST lead data to that webhook whenever the automation fires.</p>
          <p style={{ margin: 0 }}><strong>Setup in AOTMS:</strong> Go to Workflows → Create/Edit a workflow → add a "Trigger n8n Workflow" action and pick the n8n workflow. Or link the entire AOTMS workflow to an n8n workflow in the editor.</p>
        </div>
      </div>

      {/* n8n Workflows */}
      {isConnected && (
        <div style={{ ...card, padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: C.ink }}>n8n Workflows</h3>
            <button style={btnGhost} onClick={refreshWorkflows} disabled={wfLoading}>
              {wfLoading ? 'Loading…' : '↻ Refresh'}
            </button>
          </div>

          {workflows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: C.sub }}>
              No workflows found. Create workflows in your n8n instance first, then refresh.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {workflows.map(w => (
                <div key={w.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 14px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: w.active ? '#10b981' : '#d1d5db',
                    }} />
                    <div>
                      <div style={{ fontWeight: 600, color: C.ink, fontSize: 14 }}>{w.name}</div>
                      <div style={{ fontSize: 12, color: C.sub }}>ID: {w.id} {w.tags?.length > 0 && `· ${w.tags.join(', ')}`}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                      background: w.active ? '#d1fae5' : '#f3f4f6',
                      color: w.active ? '#059669' : '#6b7280',
                    }}>{w.active ? 'Active' : 'Inactive'}</span>
                    <button style={{ ...btnGhost, padding: '5px 12px' }} onClick={() => triggerTest(w.id)}>
                      Test ▸
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}