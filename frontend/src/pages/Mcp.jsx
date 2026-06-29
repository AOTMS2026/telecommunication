import { useState, useEffect } from 'react';
import { mcpAPI } from '../services/api';

const C = { indigo: 'var(--theme-primary-alt)', border: 'var(--theme-border-tint)', ink: 'var(--theme-text-strongest)', sub: '#6b7280' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };

export default function Mcp() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requested, setRequested] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await mcpAPI.status(); setStatus(r.data); }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const requestAccess = async () => {
    setRequesting(true);
    try { await mcpAPI.requestAccess('claude'); setRequested(true); }
    catch (e) { alert(e.response?.data?.message || 'Failed to submit request'); }
    setRequesting(false);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.sub }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>📎</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.ink }}>Model Context Protocol</h2>
        <span style={{ background: 'var(--theme-surface-tint2)', color: 'var(--theme-primary)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>BETA</span>
      </div>
      <p style={{ color: C.sub, fontSize: 15, margin: '0 0 22px', maxWidth: 720 }}>
        Connect Claude, ChatGPT, or Gemini directly to your workspace. Query leads, run summaries, and build AI workflows in plain language.
      </p>

      <div style={{ background: 'linear-gradient(135deg,var(--theme-text-strongest),var(--theme-text-strongest))', borderRadius: 16, padding: 36, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          ⚡ CLOSED BETA · BY INVITATION
        </span>

        {status?.betaEnabled ? (
          <>
            <h1 style={{ fontSize: 34, fontWeight: 800, margin: '20px 0 10px' }}>MCP is enabled for this workspace.</h1>
            <p style={{ color: 'var(--theme-primary-pale)', fontSize: 15, maxWidth: 560, marginBottom: 20 }}>
              Approved connections appear below. Tokens are workspace-scoped, read-only, and revocable anytime.
            </p>
            <div style={{ display: 'grid', gap: 10, maxWidth: 480 }}>
              {(status.connections || []).length === 0 && (
                <div style={{ color: 'var(--theme-primary-pale)', fontSize: 14 }}>No providers connected yet.</div>
              )}
              {(status.connections || []).map(c => (
                <div key={c._id} style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 700, textTransform: 'capitalize' }}>{c.provider}</span>
                  <span style={{ fontSize: 12, color: '#a7f3d0' }}>{c.status}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 38, fontWeight: 800, margin: '20px 0 10px', lineHeight: 1.15 }}>
              You don't have access to<br />MCP yet.
            </h1>
            <p style={{ color: 'var(--theme-primary-pale)', fontSize: 15, maxWidth: 560, marginBottom: 24 }}>
              This feature is currently in closed beta. Reach out to your account manager to request access — we'll respond within 2 business days.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={requestAccess}
                disabled={requesting || requested}
                style={{ background: '#fff', color: 'var(--theme-text-strongest)', border: 'none', borderRadius: 8, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: requested ? 'default' : 'pointer', opacity: requesting ? 0.7 : 1 }}
              >
                ✉ {requested ? 'Request sent' : requesting ? 'Sending…' : 'Request access'}
              </button>
              <span style={{ color: 'var(--theme-primary-pale)', fontSize: 13 }}>Avg approval · 2 business days</span>
            </div>
          </>
        )}

        <div style={{ position: 'absolute', right: 30, top: 30, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end' }}>
          <Pill label="Claude" emoji="✶" />
          <Pill label="Gemini" emoji="✦" />
          <Pill label="ChatGPT" emoji="◍" />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 24 }}>
        <Feature icon="🔗" title="Three providers" desc="Connect Claude, ChatGPT, or Gemini. Switch anytime." />
        <Feature icon="🛡️" title="Read-only by default" desc="Tokens are workspace-scoped and read-only. Revoke any time from this page." />
        <Feature icon="📄" title="Private context" desc="Workspace context shapes responses for your organization." />
      </div>
    </div>
  );
}

function Pill({ label, emoji }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 20, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 14 }}>
      <span>{emoji}</span>{label}
    </div>
  );
}

function Feature({ icon, title, desc }) {
  return (
    <div style={{ ...card, padding: 20 }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: C.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ color: C.sub, fontSize: 13, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}