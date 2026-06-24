import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

// Icons
const Icons = {
  dashboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  calls: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l1.42-1.42a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  tasks: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  leads: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  addLead: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>,
  singleLead: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>,
  upload: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  integration: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  campaigns: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>,
  templates: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  whatsapp: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" fill="none"/></svg>,
  leaderboard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/></svg>,
  reports: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  teamOps: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  staleLeads: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  blocklist: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  users: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>,
  automations: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  workflows: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6a2 2 0 0 1 2 2v7"/></svg>,
  schedules: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  salesform: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>,
  apiTemplates: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  webhooks: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/></svg>,
  callIq: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 4.8L20 8l-4 3.6.9 5.4L12 14.8 7.1 17l.9-5.4L4 8l5.6-1.2z"/></svg>,
  accessTokens: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>,
  integrations: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  mcp: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  chevronDown: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  logout: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'super admin';

  const isActive = (path) => {
    if (path === '/leads') return location.pathname === '/leads';
    return location.pathname.startsWith(path);
  };

  const automationPaths = ['/workflows', '/schedules', '/salesforms', '/api-templates', '/webhooks', '/n8n-settings'];
  const isAutomationActive = automationPaths.some(p => location.pathname.startsWith(p));

  const addLeadPaths = ['/leads/new', '/bulk-import'];
  const isAddLeadsActive = addLeadPaths.some(p => location.pathname.startsWith(p));

  // Auto-open groups if current path matches
  useEffect(() => {
    if (isAutomationActive) setAutomationsOpen(true);
    if (isAddLeadsActive) setAddLeadsOpen(true);
  }, [location.pathname]);

  const navLink = (to, icon, label, opts = {}) => {
    const active = isActive(to);
    return (
      <div
        key={to}
        onClick={() => navigate(to)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '7px 14px', borderRadius: 7, cursor: 'pointer', margin: '1px 6px',
          background: active ? '#ede9fe' : 'transparent',
          color: active ? '#5b3fc7' : '#4b5563',
          fontWeight: active ? 600 : 400,
          fontSize: 13.5,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f3ff'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ color: active ? '#5b3fc7' : (opts.iconColor || '#6b7280'), flexShrink: 0 }}>{icon}</span>
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {opts.badge && (
          <span style={{ marginLeft: 'auto', background: '#5b3fc7', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>{opts.badge}</span>
        )}
      </div>
    );
  };

  const sectionLabel = (text) => (
    <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 20px 4px', marginTop: 4 }}>
      {text}
    </div>
  );

  return (
    <aside style={{
      position: 'fixed', top: 48, left: 0, bottom: 0,
      width: 210, background: '#ffffff',
      borderRight: '1px solid #e9e6f8',
      display: 'flex', flexDirection: 'column',
      zIndex: 99, overflowY: 'auto', overflowX: 'hidden',
    }}>
      <div style={{ flex: 1, paddingTop: 8 }}>
        {/* Main */}
        {navLink('/dashboard', Icons.dashboard, 'Dashboard')}
        {navLink('/my-calls', Icons.calls, 'My Calls')}
        {navLink('/tasks', Icons.tasks, 'Tasks')}

        {sectionLabel('Leads')}
        {navLink('/leads', Icons.leads, 'All Leads')}

        {/* Add Leads expandable */}
        <div style={{ margin: '1px 6px' }}>
          <div
            onClick={() => setAddLeadsOpen(o => !o)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
              background: isAddLeadsActive ? '#ede9fe' : 'transparent',
              color: isAddLeadsActive ? '#5b3fc7' : '#4b5563',
              fontWeight: isAddLeadsActive ? 600 : 400,
              fontSize: 13.5, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isAddLeadsActive) e.currentTarget.style.background = '#f5f3ff'; }}
            onMouseLeave={e => { if (!isAddLeadsActive) e.currentTarget.style.background = 'transparent'; }}
          >
            <span style={{ color: isAddLeadsActive ? '#5b3fc7' : '#6b7280', flexShrink: 0 }}>{Icons.addLead}</span>
            <span style={{ flex: 1 }}>Add Leads</span>
            <span style={{ color: '#9ca3af', transform: addLeadsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>{Icons.chevronDown}</span>
          </div>
          {addLeadsOpen && (
            <div style={{ marginLeft: 16, borderLeft: '2px solid #e9e6f8', marginTop: 2, marginBottom: 2 }}>
              {[
                { to: '/leads/new', icon: Icons.singleLead, label: 'Add Single Lead' },
                { to: '/bulk-import', icon: Icons.upload, label: 'Add From Excel' },
                { to: '/integrations', icon: Icons.integration, label: 'Add From Integration' },
              ].map(({ to, icon, label }) => {
                const active = location.pathname === to || (to === '/integrations' && location.pathname.startsWith('/integrations'));
                return (
                  <div
                    key={to}
                    onClick={() => navigate(to)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '6px 12px', borderRadius: 6, cursor: 'pointer', margin: '1px 4px',
                      background: active ? '#ede9fe' : 'transparent',
                      color: active ? '#5b3fc7' : '#6b7280',
                      fontWeight: active ? 600 : 400,
                      fontSize: 13,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f3ff'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ color: active ? '#5b3fc7' : '#9ca3af', flexShrink: 0 }}>{icon}</span>
                    {label}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {navLink('/campaigns', Icons.campaigns, 'Campaigns')}
        {navLink('/message-templates', Icons.templates, 'Message Templates')}
        {navLink('/whatsapp', Icons.whatsapp, 'WhatsApp', { iconColor: '#25D366' })}
        {navLink('/leaderboard', Icons.leaderboard, 'Leaderboard')}
        {navLink('/reports', Icons.reports, 'Reports')}

        {isAdmin && (
          <>
            {sectionLabel('Management')}
            {navLink('/team-operations', Icons.teamOps, 'Team Operations')}
            {navLink('/stale-leads', Icons.staleLeads, 'Stale Leads')}
            {navLink('/blocklist', Icons.blocklist, 'Blocklist')}
            {navLink('/users', Icons.users, 'Users')}

            {sectionLabel('Automations')}
            {/* Automations expandable group */}
            <div style={{ margin: '1px 6px' }}>
              <div
                onClick={() => setAutomationsOpen(o => !o)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
                  background: isAutomationActive ? '#ede9fe' : 'transparent',
                  color: isAutomationActive ? '#5b3fc7' : '#4b5563',
                  fontWeight: isAutomationActive ? 600 : 400,
                  fontSize: 13.5, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { if (!isAutomationActive) e.currentTarget.style.background = '#f5f3ff'; }}
                onMouseLeave={e => { if (!isAutomationActive) e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ color: isAutomationActive ? '#5b3fc7' : '#6b7280', flexShrink: 0 }}>{Icons.automations}</span>
                <span style={{ flex: 1 }}>Automations</span>
                <span style={{ color: '#9ca3af', transform: automationsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>{Icons.chevronDown}</span>
              </div>
              {automationsOpen && (
                <div style={{ marginLeft: 16, borderLeft: '2px solid #e9e6f8', marginTop: 2, marginBottom: 2 }}>
                  {[
                    { to: '/workflows', icon: Icons.workflows, label: 'Workflows' },
                    { to: '/schedules', icon: Icons.schedules, label: 'Schedules' },
                    { to: '/salesforms', icon: Icons.salesform, label: 'Salesform' },
                    { to: '/api-templates', icon: Icons.apiTemplates, label: 'API Templates' },
                    { to: '/webhooks', icon: Icons.webhooks, label: 'Webhooks' },
                    { to: '/n8n-settings', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>, label: 'n8n' },
                  ].map(({ to, icon, label }) => {
                    const active = location.pathname.startsWith(to);
                    return (
                      <div
                        key={to}
                        onClick={() => navigate(to)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          padding: '6px 12px', borderRadius: 6, cursor: 'pointer', margin: '1px 4px',
                          background: active ? '#ede9fe' : 'transparent',
                          color: active ? '#5b3fc7' : '#6b7280',
                          fontWeight: active ? 600 : 400,
                          fontSize: 13, transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f5f3ff'; }}
                        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <span style={{ color: active ? '#5b3fc7' : '#9ca3af', flexShrink: 0 }}>{icon}</span>
                        {label}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {sectionLabel('Developer')}
            {navLink('/call-iq-agents', Icons.callIq, 'Call-IQ Agents')}
            {navLink('/access-tokens', Icons.accessTokens, 'Access Tokens')}
            {navLink('/integrations', Icons.integrations, 'Integrations')}
            {navLink('/mcp', Icons.mcp, 'MCP')}
          </>
        )}
      </div>

      {/* Bottom: Logout */}
      <div style={{ borderTop: '1px solid #f0eef8', padding: '8px 6px 10px' }}>
        <div
          onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '7px 14px', borderRadius: 7, cursor: 'pointer',
            color: '#ef4444', fontSize: 13.5, fontWeight: 500,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
          {Icons.logout}
          <span>Logout</span>
        </div>
        <div style={{ fontSize: 9, color: '#d1d5db', textAlign: 'center', marginTop: 4 }}>v189.1</div>
      </div>
    </aside>
  );
}