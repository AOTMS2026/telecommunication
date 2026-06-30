import { useState, useEffect } from 'react';
import { mcpAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const C = {
  indigo: 'var(--theme-primary-alt)',
  border: 'var(--theme-border-tint)',
  ink: 'var(--theme-text-strongest)',
  sub: '#6b7280',
  green: '#065f46',
  greenBg: '#d1fae5',
  yellowBg: '#fef9c3',
  yellow: '#92400e',
  redBg: '#fee2e2',
  red: '#991b1b',
};

const PROVIDERS = [
  {
    key: 'claude',
    label: 'Claude',
    emoji: '✶',
    color: '#d97706',
    bg: '#fffbeb',
    docsUrl: 'https://docs.anthropic.com/en/docs/mcp',
    connectSteps: [
      'Open Claude Desktop → Settings → Integrations',
      'Click "Add MCP Server"',
      'Paste your AOTMS MCP token when prompted',
      'Set server URL to your AOTMS workspace endpoint',
      'Save and restart Claude Desktop',
    ],
    serverUrl: 'https://api.aotms.com/mcp/claude',
  },
  {
    key: 'chatgpt',
    label: 'ChatGPT',
    emoji: '◍',
    color: '#16a34a',
    bg: '#f0fdf4',
    docsUrl: 'https://platform.openai.com/docs/plugins/getting-started',
    connectSteps: [
      'Open ChatGPT → Explore GPTs → My GPTs',
      'Click "Create a GPT" → Configure → Actions',
      'Import your AOTMS OpenAPI schema using the URL below',
      'Add Bearer token authentication with your MCP token',
      'Save your GPT and test a lead query',
    ],
    serverUrl: 'https://api.aotms.com/mcp/chatgpt/openapi.json',
  },
  {
    key: 'gemini',
    label: 'Gemini',
    emoji: '✦',
    color: '#2563eb',
    bg: '#eff6ff',
    docsUrl: 'https://ai.google.dev/gemini-api/docs',
    connectSteps: [
      'Open Google AI Studio → Extensions',
      'Click "Connect a data source"',
      'Select "Custom API" and enter your AOTMS endpoint',
      'Paste your MCP token as the Bearer token',
      'Click Authorize and verify the connection',
    ],
    serverUrl: 'https://api.aotms.com/mcp/gemini',
  },
];

export default function Mcp() {
  const { user } = useAuth();
  const [status, setStatus] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState('claude');
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(null); // connection object
  const [modalRequest, setModalRequest] = useState(null);
  const [copied, setCopied] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await mcpAPI.status();
      setStatus(r.data);
      setRequests(r.data?.requests || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const approvedConnections = requests.filter(r => r.status === 'approved');
  const pendingRequests = requests.filter(r => r.status === 'pending');
  const otherRequests = requests.filter(r => r.status !== 'approved');
  const hasAnyRequest = requests.length > 0;

  const requestEmail = status?.requestEmail || 'aotms.marketing@gmail.com';

  const buildEmailContent = (prov) => {
    const provObj = PROVIDERS.find(p => p.key === prov) || {};
    const subject = `Early Access Request — MCP Beta (${provObj.label || prov})`;
    const body = `Hi Team,

I'd like to request early access to the MCP (Model Context Protocol) beta integration on AOTMS.

Requested by: ${user?.name || ''} (${user?.email || ''})
Provider requested: ${provObj.label || prov}

I understand this feature is currently in beta and may be subject to instability, breaking changes, or unexpected behaviour — and I'm comfortable working within those constraints. My intent is to explore and evaluate the integration early, and I'm happy to share feedback to help improve it before general availability.

Looking forward to hearing back.

Thanks,
${user?.name || ''}`;
    return { subject, body };
  };

  const copyToClipboard = async (text, label) => {
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); ok = true; } catch (_) {}
    }
    if (!ok) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        Object.assign(ta.style, { position: 'fixed', top: '-9999px', left: '-9999px', opacity: '0' });
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ta.setSelectionRange(0, ta.value.length);
        ok = document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (_) {}
    }
    if (ok) {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    } else {
      alert('Auto-copy failed. Please manually copy:\n\n' + text);
    }
    return ok;
  };

  const submitRequest = async () => {
    setSubmitting(true);
    try {
      const res = await mcpAPI.requestAccess(provider);
      const newReq = res.data?.request || { provider, requestedAt: new Date().toISOString(), status: 'pending', _id: Date.now() };
      setRequests(prev => [newReq, ...prev]);
      setShowRequestModal(false);
      setModalRequest(null);
    } catch (e) { console.error(e); }
    setSubmitting(false);
  };

  // Just copies the email — does NOT submit a request
  const handleCopyEmail = async () => {
    const prov = modalRequest?.provider || provider;
    const { subject, body } = buildEmailContent(prov);
    await copyToClipboard(`To: ${requestEmail}\nSubject: ${subject}\n\n${body}`, 'full');
  };

  // Opens Gmail compose AND submits the request (treated as confirmation of intent)
  const handleOpenGmail = async () => {
    const prov = modalRequest?.provider || provider;
    const { subject, body } = buildEmailContent(prov);
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(requestEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (!modalRequest) await submitRequest();
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: C.sub }}>Loading…</div>;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <span style={{ fontSize: 22 }}>📎</span>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.ink }}>Model Context Protocol</h2>
        <span style={{ background: 'var(--theme-surface-tint2)', color: 'var(--theme-primary)', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6 }}>BETA</span>
      </div>
      <p style={{ color: C.sub, fontSize: 15, margin: '0 0 22px', maxWidth: 720 }}>
        Connect Claude, ChatGPT, or Gemini directly to your workspace. Query leads, run summaries, and build AI workflows in plain language.
      </p>

      {/* ── APPROVED CONNECTIONS ── */}
      {approvedConnections.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 12 }}>Connected Providers</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {approvedConnections.map(conn => {
              const provObj = PROVIDERS.find(p => p.key === conn.provider) || {};
              return (
                <div key={conn._id} style={{ background: '#fff', border: `2px solid ${C.greenBg}`, borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 42, height: 42, borderRadius: 12, background: provObj.bg || '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
                        {provObj.emoji || '🔌'}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700, color: C.ink, fontSize: 15 }}>{provObj.label || conn.provider}</div>
                        <div style={{ fontSize: 12, color: C.sub }}>Approved {conn.approvedAt ? new Date(conn.approvedAt).toLocaleDateString() : ''}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: C.greenBg, color: C.green }}>
                      ✓ Approved
                    </span>
                  </div>

                  {conn.tokenPrefix && (
                    <div style={{ background: '#f9fafb', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, marginBottom: 2 }}>TOKEN PREFIX</div>
                        <code style={{ fontSize: 13, color: C.ink, fontFamily: 'monospace' }}>{conn.tokenPrefix}…</code>
                      </div>
                      <span style={{ fontSize: 11, color: C.sub, background: '#e5e7eb', padding: '3px 8px', borderRadius: 6 }}>Read-only</span>
                    </div>
                  )}

                  <button
                    onClick={() => setShowConnectModal(conn)}
                    style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
                  >
                    🔌 View Connection Setup
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── HERO (locked / beta gate) ── */}
      <div style={{ background: 'linear-gradient(135deg,var(--theme-text-strongest),var(--theme-text-strongest))', borderRadius: 16, padding: 36, color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          ⚡ CLOSED BETA · BY INVITATION
        </span>

        {/* Provider pills — always top right */}
        <div style={{ position: 'absolute', right: 30, top: 30, display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end' }}>
          {PROVIDERS.map(p => <Pill key={p.key} label={p.label} emoji={p.emoji} />)}
        </div>

        {status?.betaEnabled && approvedConnections.length > 0 ? (
          <>
            <h1 style={{ fontSize: 34, fontWeight: 800, margin: '20px 0 10px' }}>MCP is active for this workspace.</h1>
            <p style={{ color: 'var(--theme-primary-pale)', fontSize: 15, maxWidth: 560 }}>
              Your approved connections are shown above. Tokens are workspace-scoped, read-only, and revocable anytime.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 38, fontWeight: 800, margin: '20px 0 10px', lineHeight: 1.15 }}>
              You don't have access to<br />MCP yet.
            </h1>
            <p style={{ color: 'var(--theme-primary-pale)', fontSize: 15, maxWidth: 560, marginBottom: 18 }}>
              This feature is currently in closed beta. Request access below — we'll respond within 2 business days.
            </p>

            {/* Provider selector — only if no pending requests */}
            {pendingRequests.length === 0 && (
              <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
                {PROVIDERS.map(p => (
                  <button key={p.key} onClick={() => setProvider(p.key)} style={{
                    background: provider === p.key ? '#fff' : 'rgba(255,255,255,0.1)',
                    color: provider === p.key ? 'var(--theme-text-strongest)' : '#fff',
                    border: provider === p.key ? '2px solid #fff' : '2px solid transparent',
                    borderRadius: 20, padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8,
                    fontWeight: 600, fontSize: 14, cursor: 'pointer',
                  }}>
                    <span>{p.emoji}</span>{p.label}
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <button
                onClick={() => { setModalRequest(null); setShowRequestModal(true); }}
                style={{ background: '#fff', color: 'var(--theme-text-strongest)', border: 'none', borderRadius: 8, padding: '11px 22px', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
              >
                ✉ Request access
              </button>
              <span style={{ color: 'var(--theme-primary-pale)', fontSize: 13 }}>Avg approval · 2 business days</span>
            </div>
          </>
        )}
      </div>

      {/* ── PREVIOUS REQUESTS ── */}
      {otherRequests.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink, marginBottom: 12 }}>Previous Requests</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {otherRequests.map((req, i) => {
              const provObj = PROVIDERS.find(p => p.key === req.provider) || {};
              const dateStr = req.createdAt || req.requestedAt ? new Date(req.createdAt || req.requestedAt).toLocaleString() : '';
              const statusColor = req.status === 'approved' ? { bg: C.greenBg, text: C.green }
                : req.status === 'revoked' ? { bg: C.redBg, text: C.red }
                : { bg: C.yellowBg, text: C.yellow };
              return (
                <div
                  key={req._id || i}
                  onClick={() => { setModalRequest(req); setShowRequestModal(true); }}
                  style={{ background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.08)'}
                  onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, background: provObj.bg || 'var(--theme-surface-tint2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                      {provObj.emoji || '✉'}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: C.ink, fontSize: 14 }}>{provObj.label || req.provider} — MCP Beta Access</div>
                      <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>Requested {dateStr}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: statusColor.bg, color: statusColor.text, textTransform: 'capitalize' }}>
                      {req.status}
                    </span>
                    <span style={{ color: C.sub, fontSize: 18 }}>›</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 14 }}>
            <button
              onClick={() => { setModalRequest(null); setShowRequestModal(true); }}
              style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, color: C.ink, cursor: 'pointer' }}
            >
              ✉ Send another request
            </button>
          </div>
        </div>
      )}

      {/* ── FEATURE CARDS ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 18, marginTop: 28 }}>
        <Feature icon="🔗" title="Three providers" desc="Connect Claude, ChatGPT, or Gemini. Switch anytime." />
        <Feature icon="🛡️" title="Read-only by default" desc="Tokens are workspace-scoped and read-only. Revoke any time from this page." />
        <Feature icon="📄" title="Private context" desc="Workspace context shapes responses for your organization." />
      </div>

      {/* ── REQUEST ACCESS MODAL ── */}
      {showRequestModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,30,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
          onClick={() => { setShowRequestModal(false); setModalRequest(null); }}>
          <div style={{ background: '#fff', borderRadius: 16, width: 580, maxHeight: '88vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '22px 26px 16px' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--theme-surface-tint2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>✉</div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{modalRequest ? 'Request Details' : 'Request access to MCP'}</div>
                  <div style={{ fontSize: 13, color: C.sub, marginTop: 4 }}>
                    {modalRequest ? `Submitted on ${new Date(modalRequest.createdAt || modalRequest.requestedAt).toLocaleString()}` : "We've prepared an email for your account manager."}
                  </div>
                </div>
              </div>
              <button onClick={() => { setShowRequestModal(false); setModalRequest(null); }} style={{ background: 'none', border: 'none', fontSize: 20, color: C.sub, cursor: 'pointer', padding: '2px 6px' }}>✕</button>
            </div>

            {!modalRequest && (
              <div style={{ padding: '0 26px 16px', display: 'flex', gap: 8 }}>
                {PROVIDERS.map(p => (
                  <button key={p.key} onClick={() => setProvider(p.key)} style={{
                    background: provider === p.key ? C.indigo : '#f3f4f6',
                    color: provider === p.key ? '#fff' : C.ink,
                    border: 'none', borderRadius: 20, padding: '6px 14px',
                    display: 'flex', alignItems: 'center', gap: 6,
                    fontWeight: 600, fontSize: 13, cursor: 'pointer',
                  }}>
                    <span>{p.emoji}</span>{p.label}
                  </button>
                ))}
              </div>
            )}

            <EmailPreview
              prov={modalRequest?.provider || provider}
              user={user}
              requestEmail={requestEmail}
              buildEmailContent={buildEmailContent}
              copied={copied}
              copyToClipboard={copyToClipboard}
            />

            <div style={{ display: 'flex', gap: 12, padding: '16px 26px', borderTop: `1px solid ${C.border}` }}>
              <button onClick={handleCopyEmail} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: `1px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                {copied === 'full' ? '✓ Copied!' : '⧉ Copy full email'}
              </button>
              <button onClick={handleOpenGmail} disabled={submitting} style={{ flex: 1, padding: '11px 16px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: submitting ? 'wait' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
                {submitting ? 'Submitting…' : 'Open in Gmail →'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CONNECT SETUP MODAL ── */}
      {showConnectModal && (
        <ConnectModal
          conn={showConnectModal}
          onClose={() => setShowConnectModal(null)}
          copied={copied}
          copyToClipboard={copyToClipboard}
        />
      )}
    </div>
  );
}

/* ── Connect Setup Modal ── */
function ConnectModal({ conn, onClose, copied, copyToClipboard }) {
  const provObj = PROVIDERS.find(p => p.key === conn.provider) || {};
  const [activeTab, setActiveTab] = useState('setup');

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,30,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 18, width: 620, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}>

        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '22px 26px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: provObj.bg || '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
              {provObj.emoji}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18, color: 'var(--theme-text-strongest)' }}>Connect {provObj.label}</div>
              <div style={{ fontSize: 13, color: '#6b7280' }}>Follow the steps below to link {provObj.label} to your workspace</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, color: '#6b7280', cursor: 'pointer', padding: '2px 6px' }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, padding: '16px 26px 0', borderBottom: '1px solid var(--theme-border-tint)' }}>
          {['setup', 'token', 'test'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              background: 'none', border: 'none', padding: '10px 18px', fontWeight: 600, fontSize: 14, cursor: 'pointer',
              color: activeTab === tab ? 'var(--theme-primary-alt)' : '#6b7280',
              borderBottom: activeTab === tab ? '2px solid var(--theme-primary-alt)' : '2px solid transparent',
              marginBottom: -1,
            }}>
              {tab === 'setup' ? '⚙️ Setup Steps' : tab === 'token' ? '🔑 Your Token' : '✅ Test Connection'}
            </button>
          ))}
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 26px' }}>

          {/* SETUP TAB */}
          {activeTab === 'setup' && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--theme-text-strongest)', marginBottom: 16, fontSize: 15 }}>
                How to connect {provObj.label} to AOTMS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {(provObj.connectSteps || []).map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: provObj.bg || '#f3f4f6', color: provObj.color || '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                      {i + 1}
                    </div>
                    <div style={{ fontSize: 14, color: 'var(--theme-text-strongest)', lineHeight: 1.6, paddingTop: 4 }}>{step}</div>
                  </div>
                ))}
              </div>

              {/* Server URL */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, letterSpacing: '0.04em' }}>SERVER / ENDPOINT URL</div>
                <div style={{ background: '#f9fafb', border: '1px solid var(--theme-border-tint)', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <code style={{ fontSize: 13, color: 'var(--theme-text-strongest)', fontFamily: 'monospace', wordBreak: 'break-all' }}>{provObj.serverUrl}</code>
                  <button onClick={() => copyToClipboard(provObj.serverUrl, 'url')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14, flexShrink: 0 }}>
                    {copied === 'url' ? '✓' : '⧉'}
                  </button>
                </div>
              </div>

              {provObj.docsUrl && (
                <a href={provObj.docsUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 16, fontSize: 13, color: 'var(--theme-primary-alt)', textDecoration: 'none', fontWeight: 600 }}>
                  📖 View {provObj.label} MCP documentation ↗
                </a>
              )}
            </div>
          )}

          {/* TOKEN TAB */}
          {activeTab === 'token' && (
            <div>
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#92400e' }}>
                ⚠️ Your full token was delivered via email when your request was approved. Store it securely — it won't be shown in full here.
              </div>

              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 8, letterSpacing: '0.04em' }}>TOKEN PREFIX (for identification)</div>
                <div style={{ background: '#f9fafb', border: '1px solid var(--theme-border-tint)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <code style={{ fontSize: 15, fontFamily: 'monospace', color: 'var(--theme-text-strongest)', letterSpacing: '0.05em' }}>
                    {conn.tokenPrefix || 'mcp_xxxxxx'}…
                  </code>
                  <button onClick={() => copyToClipboard(conn.tokenPrefix || '', 'token')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14 }}>
                    {copied === 'token' ? '✓' : '⧉'}
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <InfoRow label="Provider" value={provObj.label || conn.provider} />
                <InfoRow label="Scope" value="Read-only" />
                <InfoRow label="Approved" value={conn.approvedAt ? new Date(conn.approvedAt).toLocaleString() : '—'} />
                {conn.lastUsedAt && <InfoRow label="Last used" value={new Date(conn.lastUsedAt).toLocaleString()} />}
              </div>

              <div style={{ marginTop: 20, padding: '14px 16px', background: '#f0fdf4', borderRadius: 10, fontSize: 13, color: '#065f46', lineHeight: 1.6 }}>
                💡 To use this token: paste it into {provObj.label}'s integration settings as a <strong>Bearer token</strong> or <strong>API key</strong>, depending on the provider's UI.
              </div>
            </div>
          )}

          {/* TEST TAB */}
          {activeTab === 'test' && (
            <div>
              <div style={{ fontWeight: 600, color: 'var(--theme-text-strongest)', marginBottom: 14, fontSize: 15 }}>Verify your connection is working</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { icon: '1️⃣', title: 'Open ' + provObj.label, desc: 'Launch the app or interface where you added the AOTMS integration.' },
                  { icon: '2️⃣', title: 'Ask about a lead', desc: 'Try: "Show me the last 5 leads added to AOTMS" or "Summarize open leads this week."' },
                  { icon: '3️⃣', title: 'Check for results', desc: 'If AOTMS data appears in the response, your connection is working correctly.' },
                  { icon: '4️⃣', title: 'Something wrong?', desc: 'Re-check the server URL and token in your provider settings, or contact your AOTMS account manager.' },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', gap: 14, background: '#f9fafb', borderRadius: 10, padding: '14px 16px' }}>
                    <span style={{ fontSize: 20 }}>{s.icon}</span>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--theme-text-strongest)', fontSize: 14, marginBottom: 4 }}>{s.title}</div>
                      <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 20, padding: '14px 16px', background: '#eff6ff', borderRadius: 10, fontSize: 13, color: '#1d4ed8', lineHeight: 1.6 }}>
                🔒 All queries through MCP are <strong>read-only</strong>. {provObj.label} cannot write, modify, or delete any data in your AOTMS workspace.
              </div>
            </div>
          )}
        </div>

        <div style={{ padding: '16px 26px', borderTop: '1px solid var(--theme-border-tint)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Small helpers ── */
function EmailPreview({ prov, user, requestEmail, buildEmailContent, copied, copyToClipboard }) {
  const { subject, body } = buildEmailContent(prov);
  return (
    <div style={{ padding: '0 26px', overflowY: 'auto', flex: 1 }}>
      <FieldRow label="TO" value={requestEmail} onCopy={() => copyToClipboard(requestEmail, 'to')} copied={copied === 'to'} />
      <FieldRow label="SUBJECT" value={subject} onCopy={() => copyToClipboard(subject, 'subject')} copied={copied === 'subject'} />
      <div style={{ marginTop: 4, marginBottom: 16 }}>
        <div style={{ position: 'relative', border: '1px solid var(--theme-border-tint)', borderRadius: 10, padding: '14px 16px', background: 'var(--theme-surface-faint2)' }}>
          <button onClick={() => copyToClipboard(body, 'body')} style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14 }}>
            {copied === 'body' ? '✓' : '⧉'}
          </button>
          <pre style={{ margin: 0, fontFamily: 'inherit', fontSize: 13.5, color: 'var(--theme-text-strongest)', whiteSpace: 'pre-wrap', lineHeight: 1.6, maxHeight: 260, overflowY: 'auto', paddingRight: 24 }}>{body}</pre>
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value, onCopy, copied }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--theme-border-tint)' }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', letterSpacing: '0.04em', width: 64, flexShrink: 0 }}>{label}</span>
      <span style={{ flex: 1, fontSize: 14, color: 'var(--theme-text-strongest)', wordBreak: 'break-all' }}>{value}</span>
      <button onClick={onCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: 14, flexShrink: 0 }}>{copied ? '✓' : '⧉'}</button>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: '#f9fafb', borderRadius: 8 }}>
      <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--theme-text-strongest)', fontWeight: 500 }}>{value}</span>
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
    <div style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, padding: 20 }}>
      <div style={{ fontSize: 22, marginBottom: 10 }}>{icon}</div>
      <div style={{ fontWeight: 700, color: 'var(--theme-text-strongest)', marginBottom: 6 }}>{title}</div>
      <div style={{ color: '#6b7280', fontSize: 13, lineHeight: 1.5 }}>{desc}</div>
    </div>
  );
}