import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { integrationsAPI } from '../services/api';

const LOGO_COLORS = {
  facebook: '#1877F2', justdial: '#E87722', whatsapp: '#25D366',
  whatsapp_cloud: '#25D366', '99acres': '#E01E1E', callerdesk: '#FF5722',
  google_meet: '#00BCD4', google_sheets: '#34A853', housing: '#F26522',
  indiamart: '#E31E25', knowlarity: '#6C3483', magicbricks: '#E74C3C',
  maqsam: '#C0392B',
  sulekha: '#FF6B35', tradeindia: '#0066CC', webhook: 'var(--theme-primary-alt)',
};

// Per-type config field definitions (same fields used once the integration is active)
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
const GENERIC_WEBHOOK_TYPES = ['justdial', '99acres', 'housing', 'indiamart', 'magicbricks', 'sulekha', 'tradeindia', 'webhook'];

const s = {
  card: { background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, padding: 24 },
  inp: { width: '100%', padding: '9px 12px', border: '1px solid var(--theme-border-tint)', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' },
  lbl: { display: 'block', fontSize: 12, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
};

const IntegrationLogo = ({ type, name, size = 40 }) => {
  const color = LOGO_COLORS[type] || 'var(--theme-primary-alt)';
  const initials = (name || type || '??').slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 10,
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0
    }}>
      {initials}
    </div>
  );
};

export default function IntegrationSetup() {
  const { type } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [catalogItem, setCatalogItem] = useState(location.state || null);
  const [loading, setLoading] = useState(!location.state);
  const [activeTab, setActiveTab] = useState('overview');
  const [config, setConfig] = useState({});
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (catalogItem) return;
    (async () => {
      try {
        setLoading(true);
        const res = await integrationsAPI.getCatalog();
        const found = (res.data || []).find(i => i.type === type);
        setCatalogItem(found || { type, name: type, description: '' });
      } catch (err) {
        setCatalogItem({ type, name: type, description: '' });
      } finally {
        setLoading(false);
      }
    })();
  }, [type]);

  const fields = CONFIG_FIELDS[type] || [];
  const isOAuth = OAUTH_TYPES.includes(type);
  const isGenericWebhook = GENERIC_WEBHOOK_TYPES.includes(type);

  const handleConfigureNow = () => {
    setActiveTab('configuration');
  };

  const handleActivate = async () => {
    setActivating(true);
    setError('');
    try {
      const res = await integrationsAPI.create({ type, config });
      navigate(`/integrations/${res.data._id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to activate integration');
    } finally {
      setActivating(false);
    }
  };

  if (loading || !catalogItem) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--theme-primary-alt)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      <button
        onClick={() => navigate('/integrations')}
        style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 0, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 4 }}
      >
        &lsaquo; Back to Integrations
      </button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <IntegrationLogo type={catalogItem.type} name={catalogItem.name} />
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--theme-text-strongest)' }}>{catalogItem.name}</h2>
            <div style={{ fontSize: 14, color: '#6b7280', marginTop: 2 }}>{catalogItem.description}</div>
          </div>
        </div>
        <button
          onClick={activeTab === 'overview' ? handleConfigureNow : handleActivate}
          disabled={activating}
          style={{
            padding: '10px 22px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-alt)',
            color: '#fff', fontWeight: 600, fontSize: 14, cursor: activating ? 'wait' : 'pointer',
            opacity: activating ? 0.7 : 1, whiteSpace: 'nowrap'
          }}
        >
          {activating ? 'Activating...' : activeTab === 'overview' ? 'Configure now' : 'Activate Integration'}
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--theme-border-tint)', marginBottom: 24 }}>
        <button
          onClick={() => setActiveTab('overview')}
          style={{
            background: 'none', border: 'none', padding: '0 0 12px', fontSize: 14, cursor: 'pointer',
            fontWeight: activeTab === 'overview' ? 700 : 500,
            color: activeTab === 'overview' ? 'var(--theme-text-strongest)' : '#6b7280',
            borderBottom: activeTab === 'overview' ? '2px solid var(--theme-primary-alt)' : '2px solid transparent',
            marginBottom: -1
          }}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('configuration')}
          style={{
            background: 'none', border: 'none', padding: '0 0 12px', fontSize: 14, cursor: 'pointer',
            fontWeight: activeTab === 'configuration' ? 700 : 500,
            color: activeTab === 'configuration' ? 'var(--theme-text-strongest)' : '#6b7280',
            borderBottom: activeTab === 'configuration' ? '2px solid var(--theme-primary-alt)' : '2px solid transparent',
            marginBottom: -1
          }}
        >
          Configuration
        </button>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#dc2626', borderRadius: 8, padding: '10px 16px', marginBottom: 16, fontSize: 14 }}>
          {error}
        </div>
      )}

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={s.card}>
            <h4 style={{ margin: '0 0 10px', fontSize: 16 }}>1) What this integration does</h4>
            <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>{catalogItem.description}</p>
          </div>
          {isOAuth && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 10px', fontSize: 16 }}>2) Connect your account</h4>
              <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>
                You'll be asked to sign in and grant access so leads can sync automatically once activated.
              </p>
            </div>
          )}
          {isGenericWebhook && (
            <div style={s.card}>
              <h4 style={{ margin: '0 0 10px', fontSize: 16 }}>2) Webhook setup</h4>
              <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>
                A unique webhook URL is generated for you after activation. Paste it into your {catalogItem.name} account to start receiving leads.
              </p>
            </div>
          )}
          <div style={s.card}>
            <h4 style={{ margin: '0 0 10px', fontSize: 16 }}>3) Need help?</h4>
            <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.6 }}>
              If you don't see the option you're looking for, drop a mail at <span style={{ color: 'var(--theme-primary-alt)' }}>support@telecrm.in</span>
            </p>
          </div>
        </div>
      )}

      {/* Configuration tab */}
      {activeTab === 'configuration' && (
        <div style={s.card}>
          <h4 style={{ margin: '0 0 4px', fontSize: 16 }}>Configuration</h4>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: '#9ca3af' }}>
            Fill in the details below, then click "Activate Integration" to finish setup.
          </p>

          {fields.length === 0 && !isGenericWebhook && (
            <p style={{ fontSize: 14, color: '#6b7280' }}>
              No additional setup is required. Click "Activate Integration" above to enable {catalogItem.name}.
            </p>
          )}

          {isGenericWebhook && (
            <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
              No fields to fill here — once activated, a unique webhook URL will be shown on the integration's page for you to paste into {catalogItem.name}.
            </p>
          )}

          {fields.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {fields.map(f => (
                <div key={f.key}>
                  <label style={s.lbl}>{f.label}</label>
                  <input
                    style={s.inp}
                    placeholder={f.placeholder}
                    value={config[f.key] || ''}
                    onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                  />
                  {f.hint && <div style={s.hint}>{f.hint}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}