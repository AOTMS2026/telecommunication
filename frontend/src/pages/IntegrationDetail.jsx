import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { integrationsAPI, campaignsAPI, usersAPI } from '../services/api';
import api from '../services/api';

const STEPS = [
  { label: 'Step 1', sub: 'Integration details' },
  { label: 'Step 2', sub: 'Field mapping' },
  { label: 'Step 3', sub: 'Choose campaign' },
  { label: 'Step 4', sub: 'Lead distribution' },
  { label: 'Step 5', sub: 'Connect & finish' },
  { label: 'Step 6', sub: 'Done' },
];

// Per-type config field definitions
const CONFIG_FIELDS = {
  facebook: [
    { key: 'accessToken', label: 'User Access Token', placeholder: 'EAAxxxxxxxx', hint: 'Long-lived user token from Meta App Dashboard' },
    { key: 'pageId', label: 'Facebook Page ID', placeholder: '123456789' },
    { key: 'pageAccessToken', label: 'Page Access Token', placeholder: 'EAAxxxxxxxx', hint: 'Token scoped to your Page' },
    { key: 'formId', label: 'Lead Form ID (optional)', placeholder: 'Leave blank to capture all forms' },
  ],
  whatsapp_cloud: [
    { key: 'accessToken', label: 'Permanent Access Token', placeholder: 'EAAxxxxxxxx', hint: 'From Meta Business App > WhatsApp > API Setup' },
    { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '123456789', hint: 'From Meta Business App > WhatsApp > API Setup' },
    { key: 'wabaId', label: 'WhatsApp Business Account ID', placeholder: '123456789' },
    { key: 'webhookVerifyToken', label: 'Webhook Verify Token', placeholder: 'your_custom_verify_token', hint: 'Any random string — you set this on Meta side too' },
  ],
  whatsapp: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Enter your WhatsApp API key' },
    { key: 'webhookVerifyToken', label: 'Webhook Verify Token', placeholder: 'your_verify_token' },
  ],
  google_sheets: [
    { key: 'sheetId', label: 'Google Sheet ID', placeholder: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms', hint: 'From the sheet URL: /spreadsheets/d/{SHEET_ID}/' },
    { key: 'sheetRange', label: 'Sheet Range', placeholder: 'Sheet1!A1:Z1000', hint: 'Range to read/write leads' },
  ],
  google_meet: [],
  knowlarity: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your Knowlarity x-api-key', hint: 'From Knowlarity Developer Portal' },
    { key: 'accessToken', label: 'Access Token / Authorization', placeholder: 'Bearer xxxxxxxx' },
    { key: 'virtualNumber', label: 'Virtual Number (SR Number)', placeholder: '+918xxxxxxxxx' },
  ],
  callerdesk: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your CallerDesk API key', hint: 'From CallerDesk Dashboard > API' },
    { key: 'did', label: 'DID / Virtual Number', placeholder: '+918xxxxxxxxx' },
  ],
  maqsam: [
    { key: 'apiKey', label: 'API Key', placeholder: 'Your Maqsam API key' },
    { key: 'apiSecret', label: 'API Secret', placeholder: 'Your Maqsam API secret' },
    { key: 'did', label: 'DID Number', placeholder: '+971xxxxxxxxx' },
  ],
};

const OAUTH_TYPES = ['facebook', 'google_sheets', 'google_meet'];
const WEBHOOK_TYPES = ['whatsapp_cloud', 'whatsapp', 'knowlarity', 'callerdesk', 'maqsam'];
const GENERIC_WEBHOOK_TYPES = ['justdial', '99acres', 'housing', 'indiamart', 'magicbricks', 'sulekha', 'tradeindia', 'webhook'];

const s = {
  card: { background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, padding: 20 },
  inp: { width: '100%', padding: '9px 12px', border: '1px solid var(--theme-border-tint)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  lbl: { display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 },
  btnPrimary: { padding: '9px 22px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-alt)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' },
  btnGhost: { padding: '8px 18px', borderRadius: 8, border: '1.5px solid var(--theme-border-tint)', background: '#fff', color: 'var(--theme-text-strongest)', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  btnDanger: { padding: '7px 18px', borderRadius: 8, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  badge: (color) => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: color === 'green' ? '#d1fae5' : '#fef3c7', color: color === 'green' ? '#059669' : '#b45309' }),
};

export default function IntegrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [integration, setIntegration] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [step, setStep] = useState(0);
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [actionResult, setActionResult] = useState(null);

  // Config state
  const [config, setConfig] = useState({});
  const [fieldMapping, setFieldMapping] = useState({ name: 'name', phone: 'phone', email: 'email', location: 'location' });
  const [defaultCampaign, setDefaultCampaign] = useState('');
  const [defaultAssignedTo, setDefaultAssignedTo] = useState('');

  // Multiple Google Sheets sources (google_sheets type only) — each has its own
  // sheetId/sheetRange/fieldMapping and its own fetched column list.
  const emptySheetSource = () => ({ sheetId: '', sheetRange: '', name: '', fieldMapping: { name: '', phone: '', email: '', location: '' }, columns: [], columnsLoading: false, columnsError: '' });
  const [sheetSources, setSheetSources] = useState([emptySheetSource()]);

  // Extra states for Google Meet
  const [meetings, setMeetings] = useState([]);
  const [newMeeting, setNewMeeting] = useState({ summary: '', startTime: '', attendeeEmails: '' });

  useEffect(() => { fetchAll(); }, [id]);

  // Handle Google OAuth popup completion
  useEffect(() => {
    const oauthStatus = searchParams.get('google_oauth');
    if (!oauthStatus) return;

    if (window.opener && window.opener !== window) {
      // This tab IS the OAuth popup — notify the original tab and close.
      window.opener.postMessage({ type: 'google_oauth', status: oauthStatus }, window.location.origin);
      window.close();
      return;
    }

    // This tab is the main app tab (fallback if popup blocked / same-tab redirect)
    if (oauthStatus === 'success') {
      fetchAll();
      alert('Google account connected successfully.');
    } else {
      alert(`Google authorization failed: ${searchParams.get('message') || 'Unknown error'}`);
    }
    searchParams.delete('google_oauth');
    searchParams.delete('type');
    searchParams.delete('message');
    setSearchParams(searchParams, { replace: true });
  }, [searchParams]);

  // Listen for postMessage from the OAuth popup window
  useEffect(() => {
    const handler = (event) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'google_oauth') return;
      if (event.data.status === 'success') {
        fetchAll();
        alert('Google account connected successfully.');
      } else {
        alert('Google authorization failed. Please try again.');
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [intRes, campRes, usersRes] = await Promise.all([
        integrationsAPI.getOne(id),
        campaignsAPI.getAll(),
        usersAPI.getAll(),
      ]);
      const intg = intRes.data;
      setIntegration(intg);
      setConfig(intg.config || {});
      setFieldMapping(intg.fieldMapping || { name: 'name', phone: 'phone', email: 'email', location: 'location' });
      if (intg.type === 'google_sheets') {
        const existing = (intg.config?.sheetSources && intg.config.sheetSources.length > 0)
          ? intg.config.sheetSources
          : [{ sheetId: intg.config?.sheetId || '', sheetRange: intg.config?.sheetRange || '', name: '', fieldMapping: intg.fieldMapping || {} }];
        setSheetSources(existing.map(src => ({
          sheetId: src.sheetId || '',
          sheetRange: src.sheetRange || '',
          name: src.name || '',
          fieldMapping: { name: src.fieldMapping?.name || '', phone: src.fieldMapping?.phone || '', email: src.fieldMapping?.email || '', location: src.fieldMapping?.location || '' },
          columns: [],
          columnsLoading: false,
          columnsError: '',
        })));
      }
      setDefaultCampaign(intg.defaultCampaign?._id || '');
      setDefaultAssignedTo(intg.defaultAssignedTo?._id || '');
      setCampaigns(campRes.data?.campaigns || []);
      setUsers(usersRes.data?.users || []);
      const leadsRes = await integrationsAPI.getLeads(id);
      setLeads(leadsRes.data.leads || []);
      setLeadsTotal(leadsRes.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (extra = {}, silent = false) => {
    setSaving(true);
    try {
      await integrationsAPI.update(id, { config, fieldMapping, defaultCampaign: defaultCampaign || null, defaultAssignedTo: defaultAssignedTo || null, ...extra });
      if (!extra.status) alert('Saved successfully');
      fetchAll();
    } catch (err) {
      alert(err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove this integration? Leads already imported will remain.')) return;
    setRemoving(true);
    try {
      await integrationsAPI.remove(id);
      navigate('/integrations');
    } catch (err) {
      alert('Failed to remove');
      setRemoving(false);
    }
  };

  const doAction = async (label, fn) => {
    setActionLoading(label);
    setActionResult(null);
    try {
      const res = await fn();
      setActionResult({ ok: true, data: res.data, label });
    } catch (err) {
      setActionResult({ ok: false, msg: err.response?.data?.message || err.message, needsAuth: !!err.response?.data?.needsAuth, label });
    } finally {
      setActionLoading('');
    }
  };

  const addSheetSource = () => setSheetSources(prev => [...prev, emptySheetSource()]);

  const removeSheetSource = (idx) => setSheetSources(prev => prev.filter((_, i) => i !== idx));

  const updateSheetSource = (idx, patch) => setSheetSources(prev => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));

  const updateSheetSourceMapping = (idx, field, value) => setSheetSources(prev => prev.map((s, i) => (
    i === idx ? { ...s, fieldMapping: { ...s.fieldMapping, [field]: value } } : s
  )));

  const fetchColumnsForSource = async (idx) => {
    const src = sheetSources[idx];
    if (!src.sheetId) { updateSheetSource(idx, { columnsError: 'Enter a Sheet ID first.' }); return; }
    updateSheetSource(idx, { columnsLoading: true, columnsError: '' });
    try {
      const res = await integrationsAPI.getSheetColumns(id, src.sheetId, src.sheetRange);
      updateSheetSource(idx, { columns: res.data.columns || [], columnsLoading: false });
    } catch (err) {
      updateSheetSource(idx, { columnsLoading: false, columnsError: err.response?.data?.message || 'Could not load columns' });
    }
  };

  const startGoogleOAuth = async () => {
    const res = await api.get(`/integrations/google/oauth/url?type=${integration.type}&integrationId=${id}`);
    window.open(res.data.url, '_blank', 'width=600,height=700');
  };

  const startFacebookOAuth = async () => {
    const res = await api.get(`/integrations/facebook/oauth/url`);
    window.open(res.data.url, '_blank', 'width=600,height=700');
  };

  const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin.replace('3000', '5000');

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div className="spinner-gradient" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (!integration) return <div style={{ padding: 32, color: '#9ca3af' }}>Integration not found.</div>;

  const type = integration.type;
  const webhookUrl = `${backendUrl}/api/integrations/webhook/${integration.webhookKey}`;
  const configFields = CONFIG_FIELDS[type] || [];
  const isOAuth = OAUTH_TYPES.includes(type);
  const isGenericWebhook = GENERIC_WEBHOOK_TYPES.includes(type);
  const isRealWebhook = WEBHOOK_TYPES.includes(type);

  return (
    <div style={{ padding: '20px 28px', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => navigate('/integrations')} style={{ background: 'none', border: 'none', color: 'var(--theme-primary-alt)', cursor: 'pointer', fontSize: 14, padding: 0 }}>
          ← Back to Integrations
        </button>
        <button onClick={handleRemove} disabled={removing} style={s.btnDanger}>
          {removing ? 'Removing...' : '⊗ Unlink'}
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: 'var(--theme-primary-alt)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20 }}>
          {integration.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--theme-text-strongest)' }}>{integration.name}</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{integration.description}</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--theme-border-tint)', marginBottom: 24 }}>
        {['overview', 'configuration', 'actions', 'leads'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14,
            fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? 'var(--theme-primary-alt)' : '#6b7280',
            borderBottom: activeTab === tab ? '2px solid var(--theme-primary-alt)' : '2px solid transparent',
            marginBottom: -2, textTransform: 'capitalize',
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
            {[
              { label: 'Total Leads Imported', value: integration.totalLeadsImported },
              { label: 'Status', value: integration.status === 'active' ? '✓ Active' : integration.status === 'pending' ? 'Pending setup' : 'Inactive' },
              { label: 'Last Lead', value: integration.lastLeadAt ? new Date(integration.lastLeadAt).toLocaleDateString() : 'Never' },
              { label: 'Default Campaign', value: integration.defaultCampaign?.name || 'None' },
            ].map(stat => (
              <div key={stat.label} style={{ ...s.card, padding: '16px 24px', minWidth: 160 }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--theme-text-strongest)' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Connection method info */}
          <div style={{ ...s.card, marginBottom: 20, borderLeft: '4px solid var(--theme-primary-alt)' }}>
            <div style={{ fontWeight: 700, color: 'var(--theme-text-strongest)', marginBottom: 8 }}>
              {type === 'facebook' && '📘 Connected via Meta Graph API'}
              {(type === 'whatsapp_cloud' || type === 'whatsapp') && '💬 Connected via WhatsApp Cloud API'}
              {type === 'google_sheets' && '📊 Connected via Google Sheets API'}
              {type === 'google_meet' && '🎥 Connected via Google Calendar API'}
              {type === 'knowlarity' && '📞 Connected via Knowlarity REST API'}
              {type === 'callerdesk' && '📞 Connected via CallerDesk API'}
              {type === 'maqsam' && '📞 Connected via Maqsam API'}
              {isGenericWebhook && '🔗 Connected via Webhook'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>
              {type === 'facebook' && 'Leads are pulled in real-time from Facebook Lead Ads via Meta webhooks.'}
              {(type === 'whatsapp_cloud') && 'Incoming WhatsApp messages create leads automatically. You can also send messages from lead profiles.'}
              {type === 'google_sheets' && 'Import leads from your sheet or export leads to it. Use the Actions tab to sync.'}
              {type === 'google_meet' && 'Create Google Meet links directly from lead profiles. Use the Actions tab.'}
              {(type === 'knowlarity' || type === 'callerdesk' || type === 'maqsam') && 'Inbound calls create leads automatically. CDR is logged against existing leads.'}
              {isGenericWebhook && `${integration.name} sends leads to your webhook URL. Copy it and paste in your ${integration.name} dashboard.`}
            </div>
          </div>

          {/* Webhook URL for generic types */}
          {(isGenericWebhook || isRealWebhook) && (
            <div style={{ ...s.card, marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 15 }}>
                {isRealWebhook ? 'Webhook URL (for CDR / events)' : 'Webhook URL'}
              </h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, background: 'var(--theme-surface-faint2)', padding: '8px 14px', borderRadius: 8, fontSize: 12, color: '#4f46e5', wordBreak: 'break-all', border: '1px solid var(--theme-border-tint)' }}>
                  {type === 'whatsapp_cloud' || type === 'whatsapp' ? `${backendUrl}/api/integrations/whatsapp/webhook` : webhookUrl}
                </code>
                <button onClick={() => { navigator.clipboard.writeText(type === 'whatsapp_cloud' ? `${backendUrl}/api/integrations/whatsapp/webhook` : webhookUrl); alert('Copied!'); }} style={s.btnPrimary}>
                  Copy
                </button>
              </div>
              {type === 'whatsapp_cloud' && (
                <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
                  Paste this URL in Meta Business → WhatsApp → Configuration → Webhook URL. Subscribe to <strong>messages</strong> field.
                </div>
              )}
            </div>
          )}

          {/* Facebook webhook URL */}
          {type === 'facebook' && (
            <div style={{ ...s.card }}>
              <h4 style={{ margin: '0 0 12px' }}>Meta Webhook URL</h4>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <code style={{ flex: 1, background: 'var(--theme-surface-faint2)', padding: '8px 14px', borderRadius: 8, fontSize: 12, color: '#4f46e5', wordBreak: 'break-all', border: '1px solid var(--theme-border-tint)' }}>
                  {backendUrl}/api/integrations/facebook/webhook
                </code>
                <button onClick={() => { navigator.clipboard.writeText(`${backendUrl}/api/integrations/facebook/webhook`); alert('Copied!'); }} style={s.btnPrimary}>Copy</button>
              </div>
              <div style={{ marginTop: 10, fontSize: 13, color: '#6b7280' }}>
                Paste in Meta App → Webhooks → Page → leadgen. Verify token: set <code>FACEBOOK_WEBHOOK_VERIFY_TOKEN</code> in your .env
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Configuration ── */}
      {activeTab === 'configuration' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
            {STEPS.map((st, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => setStep(i)}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: `2px solid ${i <= step ? 'var(--theme-primary-alt)' : '#d1d5db'}`,
                    background: i < step ? 'var(--theme-primary-alt)' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: i < step ? '#fff' : i === step ? 'var(--theme-primary-alt)' : '#9ca3af',
                    fontWeight: 700, fontSize: 13,
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 11, color: i === step ? 'var(--theme-primary-alt)' : '#9ca3af', fontWeight: i === step ? 600 : 400, marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {st.label}<br /><span style={{ fontSize: 10 }}>{st.sub}</span>
                  </div>
                </div>
                {i < STEPS.length - 1 && <div style={{ height: 1, width: 60, background: i < step ? 'var(--theme-primary-alt)' : '#d1d5db', margin: '0 4px', marginBottom: 24 }} />}
              </div>
            ))}
          </div>

          <div style={{ ...s.card, padding: 28 }}>

            {/* Step 0: API credentials */}
            {step === 0 && (
              <div>
                <h4 style={{ margin: '0 0 20px', color: 'var(--theme-text-strongest)' }}>Integration Credentials</h4>

                {/* OAuth types */}
                {type === 'facebook' && (
                  <div style={{ marginBottom: 20 }}>
                    <button onClick={startFacebookOAuth} style={s.btnPrimary}>🔐 Connect with Facebook (OAuth)</button>
                    <p style={s.hint}>This will open a Facebook login window. Authorize to get your page access token.</p>
                    <div style={{ marginTop: 16, padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                      Or fill credentials manually below if you already have tokens:
                    </div>
                  </div>
                )}

                {(type === 'google_sheets' || type === 'google_meet') && (
                  <div style={{ marginBottom: 20 }}>
                    <button onClick={startGoogleOAuth} style={s.btnPrimary}>🔐 Connect with Google (OAuth)</button>
                    <p style={s.hint}>Opens Google login to authorize access. Integration ID is saved automatically.</p>
                    {integration.config?.refreshToken && (
                      <div style={{ marginTop: 10, ...s.badge('green') }}>✓ Google account connected</div>
                    )}
                  </div>
                )}

                {type === 'google_sheets' && (
                  <div style={{ display: 'grid', gap: 16 }}>
                    {sheetSources.map((src, idx) => (
                      <div key={idx} style={{ ...s.card, position: 'relative' }}>
                        {sheetSources.length > 1 && (
                          <button onClick={() => removeSheetSource(idx)} style={{ position: 'absolute', top: 12, right: 12, ...s.btnDanger, padding: '4px 10px' }}>
                            Remove
                          </button>
                        )}
                        <div style={{ display: 'grid', gap: 12 }}>
                          <div>
                            <label style={s.lbl}>Sheet Label (optional)</label>
                            <input
                              value={src.name}
                              onChange={e => updateSheetSource(idx, { name: e.target.value })}
                              placeholder={`Sheet ${idx + 1}`}
                              style={s.inp}
                            />
                          </div>
                          <div>
                            <label style={s.lbl}>Google Sheet ID</label>
                            <input
                              value={src.sheetId}
                              onChange={e => updateSheetSource(idx, { sheetId: e.target.value, columns: [] })}
                              placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
                              style={s.inp}
                            />
                            <div style={s.hint}>From the sheet URL: /spreadsheets/d/&#123;SHEET_ID&#125;/</div>
                          </div>
                          <div>
                            <label style={s.lbl}>Sheet Range</label>
                            <input
                              value={src.sheetRange}
                              onChange={e => updateSheetSource(idx, { sheetRange: e.target.value, columns: [] })}
                              placeholder="Sheet1!A1:Z1000"
                              style={s.inp}
                            />
                          </div>
                          <button onClick={() => fetchColumnsForSource(idx)} style={s.btnGhost} disabled={src.columnsLoading}>
                            {src.columnsLoading ? 'Loading columns...' : '↻ Load Columns from this Sheet'}
                          </button>
                          {src.columnsError && <div style={{ color: '#dc2626', fontSize: 13 }}>{src.columnsError}</div>}
                          {src.columns.length > 0 && (
                            <div style={{ fontSize: 12, color: '#059669' }}>✓ {src.columns.length} columns loaded — map them in Step 2</div>
                          )}
                        </div>
                      </div>
                    ))}
                    <button onClick={addSheetSource} style={s.btnGhost}>+ Add Another Sheet</button>
                  </div>
                )}

                {/* Manual config fields */}
                {configFields.length > 0 && type !== 'google_sheets' && (
                  <div style={{ display: 'grid', gap: 16, marginTop: 16 }}>
                    {configFields.map(field => (
                      <div key={field.key}>
                        <label style={s.lbl}>{field.label}</label>
                        <input
                          value={config[field.key] || ''}
                          onChange={e => setConfig(prev => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          style={s.inp}
                          type={field.key.toLowerCase().includes('secret') || field.key.toLowerCase().includes('token') ? 'password' : 'text'}
                        />
                        {field.hint && <div style={s.hint}>{field.hint}</div>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Generic webhook types have no credentials */}
                {isGenericWebhook && (
                  <div style={{ padding: 20, background: 'var(--theme-surface-faint2)', borderRadius: 8, fontSize: 14, color: '#374151' }}>
                    <strong>{integration.name}</strong> uses a webhook push model — no API credentials needed here.
                    Just copy the webhook URL from the Overview tab and paste it in your {integration.name} account.
                  </div>
                )}
              </div>
            )}

            {/* Step 1: Field mapping */}
            {step === 1 && (
              <div>
                <h4 style={{ margin: '0 0 8px', color: 'var(--theme-text-strongest)' }}>Map Fields</h4>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>
                  {type === 'google_sheets'
                    ? 'Pick which column from each sheet fills each AOTMS lead field. Only mapped columns are imported.'
                    : 'Map the source field names to AOTMS lead fields. Leave as-is if they match.'}
                </p>
                {type === 'facebook' && (
                  <div style={{ marginBottom: 16, padding: 12, background: '#eff6ff', borderRadius: 8, fontSize: 13, color: '#1e40af' }}>
                    Facebook default fields: <code>full_name</code>, <code>phone_number</code>, <code>email</code>, <code>city</code>
                  </div>
                )}

                {type === 'google_sheets' ? (
                  <div style={{ display: 'grid', gap: 20 }}>
                    {sheetSources.map((src, idx) => (
                      <div key={idx} style={s.card}>
                        <h5 style={{ margin: '0 0 4px' }}>{src.name || `Sheet ${idx + 1}`}</h5>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12, wordBreak: 'break-all' }}>{src.sheetId || 'No Sheet ID set'}</div>
                        {src.columns.length === 0 ? (
                          <div style={{ fontSize: 13, color: '#b45309', background: '#fef3c7', padding: 10, borderRadius: 8 }}>
                            No columns loaded yet — go back to Step 1 and click "Load Columns from this Sheet".
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 12 }}>
                            {['name', 'phone', 'email', 'location'].map(field => (
                              <div key={field} style={{ display: 'grid', gridTemplateColumns: '120px 20px 1fr', alignItems: 'center', gap: 12 }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-text-strongest)', textTransform: 'capitalize' }}>
                                  {field}{field === 'phone' && ' *'}
                                </span>
                                <span style={{ color: '#9ca3af' }}>←</span>
                                <select
                                  value={src.fieldMapping[field] || ''}
                                  onChange={e => updateSheetSourceMapping(idx, field, e.target.value)}
                                  style={s.inp}
                                >
                                  <option value="">-- Not mapped (skip) --</option>
                                  {src.columns.map(col => (
                                    <option key={col} value={col}>{col}</option>
                                  ))}
                                </select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>* Phone must be mapped or that sheet is skipped on import.</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {['name', 'phone', 'email', 'location'].map(field => (
                      <div key={field} style={{ display: 'grid', gridTemplateColumns: '120px 20px 1fr', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--theme-text-strongest)', textTransform: 'capitalize' }}>{field}</span>
                        <span style={{ color: '#9ca3af' }}>←</span>
                        <input
                          value={fieldMapping[field] || ''}
                          onChange={e => setFieldMapping(prev => ({ ...prev, [field]: e.target.value }))}
                          placeholder={`Source field for "${field}"`}
                          style={s.inp}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Campaign */}
            {step === 2 && (
              <div>
                <h4 style={{ margin: '0 0 8px' }}>Default Campaign</h4>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>Leads from this integration will be added to this campaign.</p>
                <select value={defaultCampaign} onChange={e => setDefaultCampaign(e.target.value)} style={s.inp}>
                  <option value="">No campaign</option>
                  {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {/* Step 3: Lead distribution */}
            {step === 3 && (
              <div>
                <h4 style={{ margin: '0 0 8px' }}>Lead Distribution</h4>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>Auto-assign leads to a team member.</p>
                <select value={defaultAssignedTo} onChange={e => setDefaultAssignedTo(e.target.value)} style={s.inp}>
                  <option value="">Auto assign / None</option>
                  {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            )}

            {/* Step 4: Connect & verify */}
            {step === 4 && (
              <div>
                <h4 style={{ margin: '0 0 20px' }}>Connect & Verify</h4>

                {type === 'facebook' && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <button onClick={() => doAction('subscribe', () => api.post(`/integrations/${id}/facebook/subscribe`))} style={s.btnPrimary} disabled={!!actionLoading}>
                      {actionLoading === 'subscribe' ? 'Subscribing...' : '1. Subscribe Page to Lead Webhooks'}
                    </button>
                    <button onClick={() => doAction('sync', () => api.post(`/integrations/${id}/facebook/sync`))} style={s.btnGhost} disabled={!!actionLoading}>
                      {actionLoading === 'sync' ? 'Syncing...' : '2. Pull Existing Leads from Form'}
                    </button>
                    <button onClick={() => doAction('forms', () => api.get(`/integrations/${id}/facebook/forms`))} style={s.btnGhost} disabled={!!actionLoading}>
                      {actionLoading === 'forms' ? 'Loading...' : '3. List Available Lead Forms'}
                    </button>
                  </div>
                )}

                {(type === 'whatsapp_cloud') && (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, fontSize: 13 }}>
                      <strong>Setup steps:</strong>
                      <ol style={{ paddingLeft: 18, margin: '8px 0 0' }}>
                        <li>Go to Meta Business → WhatsApp → Configuration</li>
                        <li>Set Webhook URL: <code>{backendUrl}/api/integrations/whatsapp/webhook</code></li>
                        <li>Set Verify Token to whatever you put in <strong>Webhook Verify Token</strong> field above</li>
                        <li>Subscribe to <strong>messages</strong> field</li>
                        <li>Save credentials and click Save & Finish</li>
                      </ol>
                    </div>
                    <button onClick={() => doAction('wainfo', () => api.get(`/integrations/${id}/whatsapp/templates`))} style={s.btnGhost} disabled={!!actionLoading}>
                      {actionLoading === 'wainfo' ? 'Testing...' : 'Test Connection (Load Templates)'}
                    </button>
                  </div>
                )}

                {(type === 'google_sheets') && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    {!integration.config?.refreshToken && (
                      <div style={{ padding: 12, background: '#fef3c7', borderRadius: 8, fontSize: 13, color: '#92400e' }}>
                        Google account not connected yet.
                        <button onClick={startGoogleOAuth} style={{ ...s.btnPrimary, marginTop: 10 }}>🔐 Connect with Google (OAuth)</button>
                      </div>
                    )}
                    <button onClick={() => doAction('sheets', async () => { await handleSave({}, true); return api.get(`/integrations/${id}/sheets/list`); })} style={s.btnPrimary} disabled={!!actionLoading}>
                      {actionLoading === 'sheets' ? 'Loading...' : 'Test Connection (List Sheets)'}
                    </button>
                    {actionResult && !actionResult.ok && actionResult.needsAuth && (
                      <button onClick={startGoogleOAuth} style={s.btnGhost}>🔐 Reconnect Google Account</button>
                    )}
                  </div>
                )}

                {(type === 'google_meet') && (
                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, fontSize: 13 }}>
                    Google Meet is connected via OAuth. You can now create meetings from the Actions tab or from lead profiles.
                  </div>
                )}

                {(type === 'knowlarity' || type === 'callerdesk' || type === 'maqsam') && (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <button onClick={() => doAction('agents', () => api.get(`/integrations/${id}/${type}/agents`))} style={s.btnPrimary} disabled={!!actionLoading}>
                      {actionLoading === 'agents' ? 'Testing...' : 'Test Connection (Load Agents)'}
                    </button>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>
                      Also paste the webhook URL below in your {integration.name} dashboard to receive inbound call events:
                    </div>
                    <code style={{ background: '#f3f4f6', padding: '8px 12px', borderRadius: 8, fontSize: 12, color: '#4f46e5', wordBreak: 'break-all' }}>
                      {webhookUrl}
                    </code>
                  </div>
                )}

                {isGenericWebhook && (
                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600, fontSize: 14 }}>Your webhook URL:</p>
                    <code style={{ fontSize: 12, color: '#4f46e5', wordBreak: 'break-all' }}>{webhookUrl}</code>
                    <p style={{ margin: '12px 0 0', fontSize: 13, color: '#6b7280' }}>
                      Paste this in your {integration.name} dashboard under webhook / lead push settings.
                    </p>
                  </div>
                )}

                {actionResult && (
                  <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: actionResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${actionResult.ok ? '#86efac' : '#fca5a5'}`, fontSize: 13 }}>
                    {actionResult.ok ? (
                      <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: '#166534', fontSize: 12 }}>
                        {JSON.stringify(actionResult.data, null, 2)}
                      </pre>
                    ) : (
                      <span style={{ color: '#dc2626' }}>❌ {actionResult.msg}</span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Done */}
            {step === 5 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
                <h4 style={{ margin: '0 0 8px', color: 'var(--theme-text-strongest)', fontSize: 18 }}>Integration Complete!</h4>
                <p style={{ color: '#6b7280', fontSize: 14 }}>{integration.name} is now active and ready.</p>
                <button onClick={() => setActiveTab('leads')} style={{ ...s.btnPrimary, marginTop: 16 }}>View Leads</button>
              </div>
            )}
          </div>

          {step < 5 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0} style={{ ...s.btnGhost, opacity: step === 0 ? 0.5 : 1 }}>Back</button>
              <button onClick={() => {
                if (step === 4) { handleSave({ status: 'active' }); setStep(5); }
                else setStep(s => s + 1);
              }} style={s.btnPrimary}>
                {step === 4 ? (saving ? 'Saving...' : 'Save & Finish') : 'Next'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Actions tab ── */}
      {activeTab === 'actions' && (
        <div style={{ display: 'grid', gap: 20 }}>

          {type === 'facebook' && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 16px' }}>Facebook Actions</h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => doAction('sync', () => api.post(`/integrations/${id}/facebook/sync`))} style={s.btnPrimary} disabled={!!actionLoading}>
                  {actionLoading === 'sync' ? 'Syncing...' : '↓ Pull Leads from Form'}
                </button>
                <button onClick={() => doAction('subscribe', () => api.post(`/integrations/${id}/facebook/subscribe`))} style={s.btnGhost} disabled={!!actionLoading}>
                  {actionLoading === 'subscribe' ? '...' : 'Re-subscribe Webhook'}
                </button>
                <button onClick={() => doAction('forms', () => api.get(`/integrations/${id}/facebook/forms`))} style={s.btnGhost} disabled={!!actionLoading}>
                  {actionLoading === 'forms' ? '...' : 'List Lead Forms'}
                </button>
                <button onClick={() => doAction('pages', () => api.get(`/integrations/${id}/facebook/pages`))} style={s.btnGhost} disabled={!!actionLoading}>
                  {actionLoading === 'pages' ? '...' : 'List Pages'}
                </button>
              </div>
            </div>
          )}

          {type === 'whatsapp_cloud' && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 16px' }}>WhatsApp Actions</h4>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={s.lbl}>Send Test Message</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input id="wa-to" placeholder="Recipient phone (91xxxxxxxxxx)" style={{ ...s.inp, flex: 1 }} />
                    <input id="wa-msg" placeholder="Message text" style={{ ...s.inp, flex: 2 }} />
                    <button onClick={() => doAction('send', () => api.post(`/integrations/${id}/whatsapp/send`, {
                      to: document.getElementById('wa-to').value,
                      message: document.getElementById('wa-msg').value,
                    }))} style={s.btnPrimary} disabled={!!actionLoading}>
                      {actionLoading === 'send' ? '...' : 'Send'}
                    </button>
                  </div>
                </div>
              </div>
              <button onClick={() => doAction('templates', () => api.get(`/integrations/${id}/whatsapp/templates`))} style={s.btnGhost} disabled={!!actionLoading}>
                {actionLoading === 'templates' ? '...' : 'Load Message Templates'}
              </button>
            </div>
          )}

          {type === 'google_sheets' && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 16px' }}>Google Sheets Actions</h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button onClick={() => doAction('import', () => api.post(`/integrations/${id}/sheets/import`))} style={s.btnPrimary} disabled={!!actionLoading}>
                  {actionLoading === 'import' ? 'Importing...' : '↓ Import Leads from Sheet'}
                </button>
                <button onClick={() => doAction('listsheets', () => api.get(`/integrations/${id}/sheets/list`))} style={s.btnGhost} disabled={!!actionLoading}>
                  {actionLoading === 'listsheets' ? '...' : 'List Sheets in Spreadsheet'}
                </button>
              </div>
            </div>
          )}

          {type === 'google_meet' && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 16px' }}>Create Google Meet</h4>
              <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={s.lbl}>Meeting Title</label>
                  <input value={newMeeting.summary} onChange={e => setNewMeeting(p => ({ ...p, summary: e.target.value }))} style={s.inp} placeholder="Discovery Call" />
                </div>
                <div>
                  <label style={s.lbl}>Start Time</label>
                  <input type="datetime-local" value={newMeeting.startTime} onChange={e => setNewMeeting(p => ({ ...p, startTime: e.target.value }))} style={s.inp} />
                </div>
                <div>
                  <label style={s.lbl}>Attendee Emails (comma separated)</label>
                  <input value={newMeeting.attendeeEmails} onChange={e => setNewMeeting(p => ({ ...p, attendeeEmails: e.target.value }))} style={s.inp} placeholder="lead@email.com, colleague@email.com" />
                </div>
                <button onClick={() => doAction('meet', () => api.post(`/integrations/${id}/meet/create`, {
                  summary: newMeeting.summary,
                  startTime: newMeeting.startTime,
                  attendeeEmails: newMeeting.attendeeEmails.split(',').map(e => e.trim()).filter(Boolean),
                }))} style={s.btnPrimary} disabled={!!actionLoading}>
                  {actionLoading === 'meet' ? 'Creating...' : 'Create Meeting'}
                </button>
              </div>
              <button onClick={() => doAction('listmeet', () => api.get(`/integrations/${id}/meet/list`))} style={s.btnGhost} disabled={!!actionLoading}>
                {actionLoading === 'listmeet' ? '...' : 'View Upcoming Meetings'}
              </button>

              {actionResult && actionResult.ok && actionResult.label === 'meet' && actionResult.data?.meetLink && (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#166534' }}>✅ Meeting created: {actionResult.data.summary}</div>
                  <a href={actionResult.data.meetLink} target="_blank" rel="noreferrer" style={{ ...s.btnPrimary, display: 'inline-block', textDecoration: 'none' }}>
                    🎥 Join Google Meet
                  </a>
                </div>
              )}

              {actionResult && actionResult.ok && Array.isArray(actionResult.data) && (
                <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  {actionResult.data.length === 0 && (
                    <div style={{ color: '#9ca3af', fontSize: 13 }}>No upcoming meetings with a Google Meet link found.</div>
                  )}
                  {actionResult.data.map(m => (
                    <div key={m.eventId} style={{ padding: 12, border: '1px solid var(--theme-border-tint)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{m.summary || 'Meeting'}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{m.start ? new Date(m.start).toLocaleString() : ''}</div>
                      </div>
                      {m.meetLink ? (
                        <a href={m.meetLink} target="_blank" rel="noreferrer" style={{ ...s.btnPrimary, textDecoration: 'none', padding: '7px 16px' }}>
                          🎥 Join
                        </a>
                      ) : (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>No link</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {(type === 'knowlarity' || type === 'callerdesk' || type === 'maqsam') && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 16px' }}>{integration.name} Actions</h4>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
                <button onClick={() => doAction('agents', () => api.get(`/integrations/${id}/${type}/agents`))} style={s.btnGhost} disabled={!!actionLoading}>
                  {actionLoading === 'agents' ? '...' : 'Load Agents'}
                </button>
                <button onClick={() => doAction('calllogs', () => api.get(`/integrations/${id}/${type}/call-logs`))} style={s.btnGhost} disabled={!!actionLoading}>
                  {actionLoading === 'calllogs' ? '...' : 'View Call Logs'}
                </button>
              </div>
              <div>
                <label style={s.lbl}>Click-to-Call</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input id="cl-agent" placeholder="Agent extension" style={{ ...s.inp, flex: 1 }} />
                  <input id="cl-cust" placeholder="Customer phone" style={{ ...s.inp, flex: 1 }} />
                  <button onClick={() => doAction('call', () => api.post(`/integrations/${id}/${type}/call`, {
                    agentExtension: document.getElementById('cl-agent').value,
                    customerPhone: document.getElementById('cl-cust').value,
                  }))} style={s.btnPrimary} disabled={!!actionLoading}>
                    {actionLoading === 'call' ? '...' : 'Call'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isGenericWebhook && (
            <div style={{ ...s.card, textAlign: 'center', padding: 40, color: '#9ca3af' }}>
              No manual actions available. {integration.name} pushes leads to your webhook URL automatically.
            </div>
          )}

          {actionResult && !(type === 'google_meet' && (actionResult.label === 'meet' || actionResult.label === 'listmeet')) && (
            <div style={{ ...s.card, background: actionResult.ok ? '#f0fdf4' : '#fef2f2', border: `1px solid ${actionResult.ok ? '#86efac' : '#fca5a5'}` }}>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 12, color: actionResult.ok ? '#166534' : '#dc2626' }}>
                {actionResult.ok ? JSON.stringify(actionResult.data, null, 2) : `❌ ${actionResult.msg}`}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Leads tab ── */}
      {activeTab === 'leads' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--theme-text-strongest)' }}>
              Leads from {integration.name} ({leadsTotal})
            </h3>
          </div>
          {leads.length === 0 ? (
            <div style={{ ...s.card, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              No leads yet from {integration.name}.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: 'var(--theme-surface-faint2)' }}>
                    {['Name', 'Phone', 'Email', 'Status', 'Assigned To', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid var(--theme-surface-faint5)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, idx) => (
                    <tr key={lead._id} style={{ borderBottom: idx < leads.length - 1 ? '1px solid var(--theme-surface-faint5)' : 'none', cursor: 'pointer' }}
                      onClick={() => navigate(`/leads/${lead._id}`)}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{lead.name}</td>
                      <td style={{ padding: '12px 16px', color: '#4f46e5' }}>{lead.phone}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{lead.email || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 12, background: 'var(--theme-surface-tint2)', color: 'var(--theme-primary)', fontSize: 12, fontWeight: 500 }}>{lead.status}</span>
                      </td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{lead.assignedTo?.name || '-'}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{new Date(lead.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}