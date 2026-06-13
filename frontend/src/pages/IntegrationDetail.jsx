import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { integrationsAPI, campaignsAPI, usersAPI } from '../services/api';

const STEPS = [
  { label: 'Step 1', sub: 'Integration details' },
  { label: 'Step 2', sub: 'Field mapping' },
  { label: 'Step 3', sub: 'Choose campaign' },
  { label: 'Step 4', sub: 'Lead distribution' },
  { label: 'Step 5', sub: 'Webhook setup' },
  { label: 'Step 6', sub: 'Finish' },
];

export default function IntegrationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [integration, setIntegration] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadsTotal, setLeadsTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview | configuration | leads
  const [step, setStep] = useState(0);
  const [campaigns, setCampaigns] = useState([]);
  const [users, setUsers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState(null);

  // Config form state
  const [config, setConfig] = useState({});
  const [fieldMapping, setFieldMapping] = useState({ name: 'name', phone: 'phone', email: 'email', location: 'location' });
  const [defaultCampaign, setDefaultCampaign] = useState('');
  const [defaultAssignedTo, setDefaultAssignedTo] = useState('');

  useEffect(() => {
    fetchAll();
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
      setDefaultCampaign(intg.defaultCampaign?._id || '');
      setDefaultAssignedTo(intg.defaultAssignedTo?._id || '');
      setCampaigns(campRes.data || []);
      setUsers(usersRes.data || []);

      // fetch leads
      const leadsRes = await integrationsAPI.getLeads(id);
      setLeads(leadsRes.data.leads || []);
      setLeadsTotal(leadsRes.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await integrationsAPI.update(id, { config, fieldMapping, defaultCampaign: defaultCampaign || null, defaultAssignedTo: defaultAssignedTo || null });
      alert('Saved successfully');
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

  const handleGetWebhookInfo = async () => {
    try {
      const res = await integrationsAPI.testWebhook(id);
      setWebhookInfo(res.data);
    } catch (err) {
      alert('Failed to get webhook info');
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ width: 32, height: 32, border: '3px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );

  if (!integration) return <div style={{ padding: 32, color: '#9ca3af' }}>Integration not found.</div>;

  const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || window.location.origin.replace('3000', '5000');
  const webhookUrl = `${backendUrl}/api/integrations/webhook/${integration.webhookKey}`;

  return (
    <div style={{ padding: '20px 28px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Back + header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button onClick={() => navigate('/integrations')} style={{ background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}>
          ← Back to Integrations
        </button>
        <button
          onClick={handleRemove}
          disabled={removing}
          style={{ padding: '7px 18px', borderRadius: 8, border: '1.5px solid #ef4444', background: '#fff', color: '#ef4444', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
        >
          {removing ? 'Removing...' : '⊗ Unlink'}
        </button>
      </div>

      {/* Integration header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 52, height: 52, borderRadius: 12, background: '#6366f1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 20 }}>
          {integration.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>{integration.name}</h2>
          <p style={{ margin: 0, fontSize: 13, color: '#6b7280' }}>{integration.description}</p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e5e2f5', marginBottom: 24 }}>
        {['overview', 'configuration', 'leads'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
            color: activeTab === tab ? '#6366f1' : '#6b7280',
            borderBottom: activeTab === tab ? '2px solid #6366f1' : '2px solid transparent',
            marginBottom: -2, textTransform: 'capitalize'
          }}>
            {tab}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
            {[
              { label: 'Total Leads Imported', value: integration.totalLeadsImported },
              { label: 'Status', value: integration.status === 'active' ? '✓ Active' : 'Inactive' },
              { label: 'Last Lead', value: integration.lastLeadAt ? new Date(integration.lastLeadAt).toLocaleDateString() : 'Never' },
              { label: 'Default Campaign', value: integration.defaultCampaign?.name || 'None' },
            ].map(stat => (
              <div key={stat.label} style={{ background: '#fff', border: '1px solid #e5e2f5', borderRadius: 12, padding: '16px 24px', minWidth: 160 }}>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{stat.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#1e1b4b' }}>{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Webhook URL */}
          <div style={{ background: '#fff', border: '1px solid #e5e2f5', borderRadius: 12, padding: 20, marginBottom: 20 }}>
            <h4 style={{ margin: '0 0 12px', fontSize: 15, color: '#1e1b4b' }}>Webhook URL</h4>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>Use this URL to send leads from external sources</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <code style={{ flex: 1, background: '#f9f8ff', padding: '8px 14px', borderRadius: 8, fontSize: 12, color: '#4f46e5', wordBreak: 'break-all', border: '1px solid #e0dff5' }}>
                {webhookUrl}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(webhookUrl); alert('Copied!'); }}
                style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid #6366f1', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                Copy
              </button>
            </div>
            <div style={{ marginTop: 12, background: '#f9f8ff', borderRadius: 8, padding: 14 }}>
              <p style={{ margin: '0 0 8px', fontSize: 13, color: '#374151', fontWeight: 600 }}>Sample POST payload:</p>
              <pre style={{ margin: 0, fontSize: 12, color: '#4f46e5' }}>{JSON.stringify({ name: 'John Doe', phone: '9876543210', email: 'john@example.com', location: 'Hyderabad' }, null, 2)}</pre>
            </div>
          </div>
        </div>
      )}

      {/* Configuration tab - stepper */}
      {activeTab === 'configuration' && (
        <div>
          {/* Stepper */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32, overflowX: 'auto', paddingBottom: 4 }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }} onClick={() => setStep(i)}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    border: `2px solid ${i <= step ? '#6366f1' : '#d1d5db'}`,
                    background: i < step ? '#6366f1' : '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: i < step ? '#fff' : i === step ? '#6366f1' : '#9ca3af',
                    fontWeight: 700, fontSize: 13
                  }}>
                    {i < step ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 11, color: i === step ? '#6366f1' : '#9ca3af', fontWeight: i === step ? 600 : 400, marginTop: 4, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {s.label}<br /><span style={{ fontSize: 10 }}>{s.sub}</span>
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{ height: 1, width: 60, background: i < step ? '#6366f1' : '#d1d5db', margin: '0 4px', marginBottom: 24 }} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <div style={{ background: '#fff', border: '1px solid #e5e2f5', borderRadius: 12, padding: 28 }}>
            {step === 0 && (
              <div>
                <h4 style={{ margin: '0 0 20px', color: '#1e1b4b' }}>Integration Details</h4>
                <div style={{ display: 'grid', gap: 16 }}>
                  {['apiKey', 'accessToken', 'pageId', 'formId'].map(field => (
                    <div key={field}>
                      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                        {field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}
                      </label>
                      <input
                        value={config[field] || ''}
                        onChange={e => setConfig(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`Enter ${field}`}
                        style={{ width: '100%', padding: '8px 12px', border: '1px solid #e0dff5', borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div>
                <h4 style={{ margin: '0 0 8px', color: '#1e1b4b' }}>Map Integration Fields</h4>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>Map your integration's field names to TeleCRM fields</p>
                <div style={{ display: 'grid', gap: 12 }}>
                  {['name', 'phone', 'email', 'location'].map(field => (
                    <div key={field} style={{ display: 'grid', gridTemplateColumns: '120px 20px 1fr', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: '#1e1b4b', textTransform: 'capitalize' }}>{field}</span>
                      <span style={{ color: '#9ca3af' }}>←</span>
                      <input
                        value={fieldMapping[field] || ''}
                        onChange={e => setFieldMapping(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder={`Source field for "${field}"`}
                        style={{ padding: '8px 12px', border: '1px solid #e0dff5', borderRadius: 8, fontSize: 14, outline: 'none' }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 2 && (
              <div>
                <h4 style={{ margin: '0 0 8px', color: '#1e1b4b' }}>Choose Campaign</h4>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>Assign leads from this integration to a campaign</p>
                <select
                  value={defaultCampaign}
                  onChange={e => setDefaultCampaign(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0dff5', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff' }}
                >
                  <option value="">No campaign</option>
                  {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
            )}

            {step === 3 && (
              <div>
                <h4 style={{ margin: '0 0 8px', color: '#1e1b4b' }}>Lead Distribution</h4>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>Assign leads from this integration to a team member</p>
                <select
                  value={defaultAssignedTo}
                  onChange={e => setDefaultAssignedTo(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid #e0dff5', borderRadius: 8, fontSize: 14, outline: 'none', background: '#fff' }}
                >
                  <option value="">Auto assign / None</option>
                  {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                </select>
              </div>
            )}

            {step === 4 && (
              <div>
                <h4 style={{ margin: '0 0 8px', color: '#1e1b4b' }}>Webhook Setup</h4>
                <p style={{ color: '#6b7280', fontSize: 13, margin: '0 0 20px' }}>Copy this webhook URL and configure it in your {integration.name} account</p>
                <div style={{ background: '#f9f8ff', borderRadius: 8, padding: 16, border: '1px solid #e0dff5', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>POST URL</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ flex: 1, fontSize: 12, color: '#4f46e5', wordBreak: 'break-all' }}>{webhookUrl}</code>
                    <button onClick={() => { navigator.clipboard.writeText(webhookUrl); alert('Copied!'); }}
                      style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #6366f1', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap' }}>
                      Copy
                    </button>
                  </div>
                </div>
                <div style={{ background: '#f9f8ff', borderRadius: 8, padding: 16, border: '1px solid #e0dff5' }}>
                  <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>Sample Payload</div>
                  <pre style={{ margin: 0, fontSize: 12, color: '#374151' }}>{JSON.stringify({ name: 'John Doe', phone: '9876543210', email: 'john@example.com', location: 'Hyderabad' }, null, 2)}</pre>
                </div>
              </div>
            )}

            {step === 5 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 52, marginBottom: 16 }}>🎉</div>
                <h4 style={{ margin: '0 0 8px', color: '#1e1b4b', fontSize: 18 }}>Integration Complete!</h4>
                <p style={{ color: '#6b7280', fontSize: 14 }}>{integration.name} is now active and ready to receive leads.</p>
                <button onClick={() => setActiveTab('leads')} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  View Leads
                </button>
              </div>
            )}
          </div>

          {/* Nav buttons */}
          {step < 5 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
              <button
                onClick={() => setStep(s => Math.max(0, s - 1))}
                disabled={step === 0}
                style={{ padding: '9px 24px', borderRadius: 8, border: '1.5px solid #e0dff5', background: '#fff', color: '#6b7280', fontWeight: 600, fontSize: 14, cursor: step === 0 ? 'default' : 'pointer', opacity: step === 0 ? 0.5 : 1 }}
              >
                Back
              </button>
              <button
                onClick={() => {
                  if (step === 4) { handleSave(); setStep(5); }
                  else setStep(s => s + 1);
                }}
                style={{ padding: '9px 24px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
              >
                {step === 4 ? (saving ? 'Saving...' : 'Save & Finish') : 'Next'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Leads tab */}
      {activeTab === 'leads' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#1e1b4b' }}>
              Leads from {integration.name} ({leadsTotal})
            </h3>
          </div>
          {leads.length === 0 ? (
            <div style={{ background: '#fff', border: '1px solid #e5e2f5', borderRadius: 12, padding: 40, textAlign: 'center', color: '#9ca3af' }}>
              No leads yet. Configure the webhook to start receiving leads.
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid #e5e2f5', borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ background: '#f9f8ff' }}>
                    {['Name', 'Phone', 'Email', 'Status', 'Assigned To', 'Date'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #f0eef8' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead, idx) => (
                    <tr key={lead._id} style={{ borderBottom: idx < leads.length - 1 ? '1px solid #f0eef8' : 'none', cursor: 'pointer' }}
                      onClick={() => navigate(`/leads/${lead._id}`)}>
                      <td style={{ padding: '12px 16px', fontWeight: 500 }}>{lead.name}</td>
                      <td style={{ padding: '12px 16px', color: '#4f46e5' }}>{lead.phone}</td>
                      <td style={{ padding: '12px 16px', color: '#6b7280' }}>{lead.email || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: 12, background: '#ede9fe', color: '#7c3aed', fontSize: 12, fontWeight: 500 }}>{lead.status}</span>
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