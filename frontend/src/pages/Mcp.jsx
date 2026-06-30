import { useState, useEffect } from 'react';
import { mcpAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const C = { indigo: 'var(--theme-primary-alt)', border: 'var(--theme-border-tint)', ink: 'var(--theme-text-strongest)', sub: '#6b7280' };
const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const PROVIDERS = [
  { key: 'claude', label: 'Claude', emoji: '✶' },
  { key: 'gemini', label: 'Gemini', emoji: '✦' },
  { key: 'chatgpt', label: 'ChatGPT', emoji: '◍' },
];

export default function Mcp() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requested, setRequested] = useState(false);
  const [requestedAt, setRequestedAt] = useState(null);
  const [provider, setProvider] = useState('claude');
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const r = await mcpAPI.status();
      setStatus(r.data);
      if (r.data?.hasPendingRequest) {
        setRequested(true);
        if (r.data.pendingProvider) setProvider(r.data.pendingProvider);
        if (r.data.pendingRequestedAt) setRequestedAt(r.data.pendingRequestedAt);
      }
    }
    catch (e) { console.error(e); }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const requestEmail = status?.requestEmail || 'aotms.marketing@gmail.com';
  const providerLabel = PROVIDERS.find(p => p.key === provider)?.label || provider;

  const subject = `Early Access Request — MCP Beta (${providerLabel})`;
  const body = `Hi Team,

I'd like to request early access to the MCP (Model Context Protocol) beta integration on AOTMS.

Requested by: ${user?.name || ''} (${user?.email || ''})
Provider requested: ${providerLabel}

I understand this feature is currently in beta and may be subject to instability, breaking changes, or unexpected behaviour — and I'm comfortable working within those constraints. My intent is to explore and evaluate the integration early, and I'm happy to share feedback to help improve it before general availability.

Looking forward to hearing back.

Thanks,
${user?.name || ''}`;

  const openModal = () => setShowModal(true);

  const copyText = async (label, text) => {
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch (e) { /* fall through to legacy method */ }

    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { ok = false; }
    }

    if (ok) {
      setCopied(label);
      setTimeout(() => setCopied(''), 1500);
    } else {
      alert('Could not copy automatically — please select and copy the text manually.');
    }
  };

  const markRequested = async () => {
    setRequested(true);
    setRequestedAt(new Date().toISOString());
    setShowModal(false);
    // Log the request server-side too (so an admin can see/approve it),
    // independent of whether the email client actually sent anything.
    try { await mcpAPI.requestAccess(provider); } catch (e) { /* non-blocking */ }
  };

  const openInMailApp = () => {
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(requestEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, '_blank');
    markRequested();
  };

  const copyFullEmail = () => {
    copyText('full', `To: ${requestEmail}\nSubject: ${subject}\n\n${body}`);
    markRequested();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.sub }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto', position: 'relative' }}>
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
            <p style={{ color: 'var(--theme-primary-pale)', fontSize: 15, maxWidth: 560, marginBottom: 18 }}>
              This feature is currently in closed beta. Reach out to your account manager to request access — we'll respond within 2 business days.
            </p>

            {!requested && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                {PROVIDERS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setProvider(p.key)}
                    style={{
                      background: provider === p.key ? '#fff' : 'rgba(255,255,255,0.1)',
                      color: provider === p.key ? 'var(--theme-text-strongest)' : '#fff',
                      border: provider === p.key ? '2px solid #fff' : '2px solid transparent',
                      borderRadius: 20, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
                      fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}
                  >
                    <span>{p.emoji}</span>{p.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={openModal}
                style={{ background: '#fff', color: 'var(--theme-text-strongest)', border: 'none', borderRadius: 8, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                ✉ {requested ? 'View / resend request' : 'Request access'}
              </button>
              <span style={{ color: 'var(--theme-primary-pale)', fontSize: 13 }}>Avg approval · 2 business days</span>
            </div>

            {requested && (
              <div style={{ marginTop: 14, fontSize: 13, color: '#a7f3d0' }}>
                ✓ Previously requested {PROVIDERS.find(p => p.key === provider)?.label || provider} access
                {requestedAt ? ` on ${new Date(requestedAt).toLocaleString()}` : ''}.
              </div>
            )}
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

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,30,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowModal(false)}>
          <div style={{ background: '#fff', borderRadius: 16, width: 560, maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 26px 16px' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--theme-surface-tint2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✉</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>Request access to MCP</div>
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 4, maxWidth: 420 }}>
                    We've prepared an email for your account manager. Send it automatically through your mail app, or copy it and send manually.
                  </div>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: 'none', border: 'none', fontSize: 18, color: C.sub, cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>

            <div style={{ padding: '0 26px', overflowY: 'auto', flex: 1 }}>
              <FieldRow label="TO" value={requestEmail} onCopy={() => copyText('to', requestEmail)} copied={copied === 'to'} />
              <FieldRow label="SUBJECT" value={subject} onCopy={() => copyText('subject', subject)} copied={copied === 'subject'} />

              <div style={{ marginTop: 4, marginBottom: 16 }}>
                <div style={{ position: 'relative', border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', background: 'var(--theme-surface-faint2)' }}>
                  <button onClick={() => copyText('body', body)} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: C.sub, fontSize: 13 }}>
                    {copied === 'body' ? '✓' : '⧉'}
                  </button>
                  <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 13.5, color: C.ink, whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 260, overflowY: 'auto' }}>{body}</pre>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, padding: '16px 26px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={copyFullEmail} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                {copied === 'full' ? '✓ Copied' : '⧉ Copy full email'}
              </button>
              <button onClick={openInMailApp} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                Open in mail app →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, onCopy, copied }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.sub, letterSpacing: '0.04em', width: 64, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, fontSize: 14, color: C.ink }}>{value}</span>
      <button onClick={onCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.sub, fontSize: 14 }}>{copied ? '✓' : '⧉'}</button>
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