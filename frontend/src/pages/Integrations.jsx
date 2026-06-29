import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { integrationsAPI } from '../services/api';

const LOGO_COLORS = {
  facebook: '#1877F2', justdial: '#E87722', whatsapp: '#25D366',
  whatsapp_cloud: '#25D366', '99acres': '#E01E1E', callerdesk: '#FF5722',
  google_meet: '#00BCD4', google_sheets: '#34A853', housing: '#F26522',
  indiamart: '#E31E25', knowlarity: '#6C3483', magicbricks: '#E74C3C',
  maqsam: '#C0392B',
  sulekha: '#FF6B35', tradeindia: '#0066CC', webhook: 'var(--theme-primary-alt)',
};

const IntegrationLogo = ({ type, name, size = 36 }) => {
  const color = LOGO_COLORS[type] || 'var(--theme-primary-alt)';
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 700, fontSize: size * 0.35, flexShrink: 0
    }}>
      {initials}
    </div>
  );
};

export default function Integrations() {
  const navigate = useNavigate();
  const [data, setData] = useState({ active: [], available: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activating, setActivating] = useState(null);

  const fetchIntegrations = async () => {
    try {
      setLoading(true);
      const res = await integrationsAPI.getAll();
      setData(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  const handleActivate = async (type) => {
    setActivating(type);
    try {
      await integrationsAPI.create({ type });
      await fetchIntegrations();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to activate');
    } finally {
      setActivating(null);
    }
  };

  const filteredAvailable = data.available.filter(i =>
    i.name.toLowerCase().includes(search.toLowerCase()) ||
    i.description.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--theme-primary-alt)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1000, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: 'var(--theme-text-strongest)' }}>Integrations</h2>
        <div style={{ flex: 1, minWidth: 200 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search Integration by name"
            style={{
              width: '100%', padding: '8px 14px', border: '1px solid var(--theme-border-tint)',
              borderRadius: 8, fontSize: 14, outline: 'none', background: '#fafafa'
            }}
          />
        </div>
      </div>

      {/* Active Integrations */}
      {data.active.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
            Active Integration ({data.active.length})
          </h3>
          <div style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px 120px', padding: '10px 20px', borderBottom: '1px solid var(--theme-surface-faint5)', background: 'var(--theme-surface-faint2)' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>INTEGRATIONS</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>STATUS</span>
              <span></span>
            </div>
            {data.active.map((integration, idx) => (
              <div key={integration._id} style={{
                display: 'grid', gridTemplateColumns: '1fr 160px 120px',
                padding: '14px 20px', alignItems: 'center',
                borderBottom: idx < data.active.length - 1 ? '1px solid var(--theme-surface-faint5)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <IntegrationLogo type={integration.type} name={integration.name} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--theme-text-strongest)' }}>{integration.name}</div>
                    {integration.totalLeadsImported > 0 && (
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{integration.totalLeadsImported} leads imported</div>
                    )}
                  </div>
                </div>
                <div>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#d1fae5', color: '#059669', borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 500 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981' }} />
                    Active
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => navigate(`/integrations/${integration._id}`)}
                    style={{ padding: '6px 16px', borderRadius: 20, border: '1.5px solid var(--theme-primary-alt)', background: '#fff', color: 'var(--theme-primary-alt)', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
                  >
                    Manage
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Available Integrations */}
      <section>
        <h3 style={{ fontSize: 15, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          Available Integration ({filteredAvailable.length})
        </h3>
        <div style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--theme-surface-faint5)', background: 'var(--theme-surface-faint2)' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>INTEGRATIONS</span>
          </div>
          {filteredAvailable.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af' }}>No integrations found</div>
          ) : (
            filteredAvailable.map((integration, idx) => (
              <div key={integration.type} style={{
                display: 'flex', alignItems: 'center', padding: '14px 20px',
                borderBottom: idx < filteredAvailable.length - 1 ? '1px solid var(--theme-surface-faint5)' : 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
                  <IntegrationLogo type={integration.type} name={integration.name} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--theme-text-strongest)' }}>{integration.name}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>{integration.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleActivate(integration.type)}
                  disabled={activating === integration.type}
                  style={{
                    padding: '6px 18px', borderRadius: 20, border: '1.5px solid var(--theme-primary-alt)',
                    background: '#fff', color: 'var(--theme-primary-alt)', fontWeight: 600, fontSize: 13,
                    cursor: activating === integration.type ? 'wait' : 'pointer',
                    opacity: activating === integration.type ? 0.7 : 1
                  }}
                >
                  {activating === integration.type ? 'Activating...' : 'Activate now'}
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}