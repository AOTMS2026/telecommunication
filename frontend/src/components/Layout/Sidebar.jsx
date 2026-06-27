import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ACTIVE_BG = '#e0f2fe';
const ACTIVE_COLOR = '#0369a1';
const ACTIVE_ICON = '#0284c7';
const HOVER_BG = '#f0f9ff';
const TEXT = '#374151';
const ICON_COLOR = '#6b7280';
const SECTION_COLOR = '#94a3b8';
const ACCENT = '#f97316';
const BORDER_COLOR = '#e0f0ff';
const COLLAPSED_W = 48;
const EXPANDED_W = 210;

const Icons = {
  dashboard:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  calls:        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l1.42-1.42a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  recordings:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>,
  tasks:        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  leads:        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  addLead:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>,
  singleLead:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>,
  upload:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  integration:  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  campaigns:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>,
  templates:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  whatsapp:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor"/></svg>,
  leaderboard:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/></svg>,
  reports:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  teamOps:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>,
  staleLeads:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  blocklist:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>,
  users:        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>,
  automations:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  workflows:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="15" y="15" width="6" height="6" rx="1"/><path d="M9 6h6a2 2 0 0 1 2 2v7"/></svg>,
  schedules:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  salesform:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>,
  apiTemplates: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>,
  webhooks:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 16.98h-5.99c-1.1 0-1.95.94-2.48 1.9A4 4 0 0 1 2 17c.01-.7.2-1.4.57-2"/><path d="m6 17 3.13-5.78c.53-.97.1-2.18-.5-3.1a4 4 0 1 1 6.89-4.06"/><path d="m12 6 3.13 5.73C15.66 12.7 16.9 13 18 13a4 4 0 0 1 0 8"/></svg>,
  callIq:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 4.8L20 8l-4 3.6.9 5.4L12 14.8 7.1 17l.9-5.4L4 8l5.6-1.2z"/></svg>,
  accessTokens: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>,
  integrations: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>,
  mcp:          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>,
  chevronDown:  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  logout:       <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  n8n:          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>,
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [addLeadsOpen, setAddLeadsOpen] = useState(false);

  const isAdmin = user?.role === 'admin' || user?.role === 'manager';

  const isActive = (path) => {
    if (path === '/leads') return location.pathname === '/leads';
    return location.pathname.startsWith(path);
  };

  const automationPaths = ['/workflows', '/schedules', '/salesforms', '/api-templates', '/webhooks', '/n8n-settings'];
  const isAutomationActive = automationPaths.some(p => location.pathname.startsWith(p));
  const addLeadPaths = ['/leads/new', '/bulk-import'];
  const isAddLeadsActive = addLeadPaths.some(p => location.pathname.startsWith(p));

  useEffect(() => {
    if (isAutomationActive) setAutomationsOpen(true);
    if (isAddLeadsActive) setAddLeadsOpen(true);
  }, [location.pathname]);

  const NavItem = ({ to, icon, label, iconColor, badge }) => {
    const active = isActive(to);
    return (
      <div
        onClick={() => navigate(to)}
        title={!isOpen ? label : ''}
        style={{
          display: 'flex', alignItems: 'center',
          gap: isOpen ? 10 : 0,
          padding: '0',
          height: 38,
          borderRadius: 8,
          cursor: 'pointer',
          margin: '1px 5px',
          background: active ? ACTIVE_BG : 'transparent',
          color: active ? ACTIVE_COLOR : TEXT,
          fontWeight: active ? 600 : 400,
          fontSize: 13,
          transition: 'background 0.15s',
          borderLeft: active ? `3px solid ${ACCENT}` : '3px solid transparent',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = HOVER_BG; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          width: COLLAPSED_W - 10,
          minWidth: COLLAPSED_W - 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: active ? ACTIVE_ICON : (iconColor || ICON_COLOR),
        }}>{icon}</span>
        {isOpen && <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
        {isOpen && badge && (
          <span style={{ marginRight: 8, background: ACCENT, color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px', fontWeight: 700 }}>{badge}</span>
        )}
      </div>
    );
  };

  const SectionLabel = ({ text }) => isOpen ? (
    <div style={{ fontSize: 10, fontWeight: 700, color: SECTION_COLOR, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '10px 14px 4px', marginTop: 4 }}>
      {text}
    </div>
  ) : (
    <div style={{ height: 1, background: BORDER_COLOR, margin: '8px 10px 4px' }} />
  );

  const ExpandGroup = ({ icon, label, isActiveGroup, open, setOpen, children }) => (
    <div style={{ margin: '1px 5px' }}>
      <div
        onClick={() => isOpen && setOpen(o => !o)}
        title={!isOpen ? label : ''}
        style={{
          display: 'flex', alignItems: 'center',
          height: 38,
          borderRadius: 8, cursor: 'pointer',
          background: isActiveGroup ? ACTIVE_BG : 'transparent',
          color: isActiveGroup ? ACTIVE_COLOR : TEXT,
          fontWeight: isActiveGroup ? 600 : 400,
          fontSize: 13, transition: 'background 0.15s',
          borderLeft: isActiveGroup ? `3px solid ${ACCENT}` : '3px solid transparent',
          overflow: 'hidden', whiteSpace: 'nowrap',
        }}
        onMouseEnter={e => { if (!isActiveGroup) e.currentTarget.style.background = HOVER_BG; }}
        onMouseLeave={e => { if (!isActiveGroup) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{
          width: COLLAPSED_W - 10, minWidth: COLLAPSED_W - 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isActiveGroup ? ACTIVE_ICON : ICON_COLOR,
        }}>{icon}</span>
        {isOpen && <span style={{ flex: 1 }}>{label}</span>}
        {isOpen && <span style={{ color: SECTION_COLOR, marginRight: 10, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>{Icons.chevronDown}</span>}
      </div>
      {isOpen && open && (
        <div style={{ marginLeft: 20, borderLeft: `2px solid ${BORDER_COLOR}`, marginTop: 2, marginBottom: 2 }}>
          {children}
        </div>
      )}
    </div>
  );

  const SubItem = ({ to, icon, label }) => {
    const active = location.pathname === to || (location.pathname.startsWith(to) && to.length > 1);
    return (
      <div
        onClick={() => navigate(to)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 6, cursor: 'pointer', margin: '1px 4px',
          background: active ? ACTIVE_BG : 'transparent',
          color: active ? ACTIVE_COLOR : ICON_COLOR,
          fontWeight: active ? 600 : 400,
          fontSize: 12.5, transition: 'background 0.15s',
          whiteSpace: 'nowrap', overflow: 'hidden',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = HOVER_BG; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
      >
        <span style={{ color: active ? ACTIVE_ICON : '#9ca3af', flexShrink: 0 }}>{icon}</span>
        {label}
      </div>
    );
  };

  return (
    <div
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
      style={{
        position: 'fixed', top: 48, left: 0, bottom: 0,
        width: isOpen ? EXPANDED_W : COLLAPSED_W,
        zIndex: 99,
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1)',
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: 0, bottom: 0,
        width: isOpen ? EXPANDED_W : COLLAPSED_W,
        background: '#ffffff',
        borderRight: `1px solid ${BORDER_COLOR}`,
        display: 'flex', flexDirection: 'column',
        overflowY: 'auto', overflowX: 'hidden',
        boxShadow: isOpen ? '4px 0 20px rgba(2,132,199,0.10)' : 'none',
        transition: 'width 0.22s cubic-bezier(0.4,0,0.2,1), box-shadow 0.22s',
      }}>
        <div style={{ flex: 1, paddingTop: 6 }}>
          <NavItem to="/dashboard"     icon={Icons.dashboard}   label="Dashboard" />
          <NavItem to="/my-calls"      icon={Icons.calls}       label="My Calls" />
          <NavItem to="/call-recordings" icon={Icons.recordings} label="Call Recordings" />
          <NavItem to="/tasks"         icon={Icons.tasks}       label="Tasks" />

          <SectionLabel text="Leads" />
          <NavItem to="/leads"         icon={Icons.leads}       label="All Leads" />

          <ExpandGroup
            icon={Icons.addLead} label="Add Leads"
            isActiveGroup={isAddLeadsActive} open={addLeadsOpen} setOpen={setAddLeadsOpen}
          >
            <SubItem to="/leads/new"   icon={Icons.singleLead} label="Add Single Lead" />
            <SubItem to="/bulk-import" icon={Icons.upload}     label="Add From Excel" />
            <SubItem to="/integrations" icon={Icons.integration} label="Add From Integration" />
          </ExpandGroup>

          <NavItem to="/campaigns"        icon={Icons.campaigns}   label="Campaigns" />
          <NavItem to="/message-templates" icon={Icons.templates}  label="Message Templates" />
          <NavItem to="/whatsapp"         icon={Icons.whatsapp}    label="WhatsApp" iconColor="#25D366" />
          <NavItem to="/leaderboard"      icon={Icons.leaderboard} label="Leaderboard" />
          <NavItem to="/reports"          icon={Icons.reports}     label="Reports" />

          {isAdmin && (
            <>
              <SectionLabel text="Management" />
              <NavItem to="/team-operations" icon={Icons.teamOps}    label="Team Operations" />
              <NavItem to="/stale-leads"     icon={Icons.staleLeads} label="Stale Leads" />
              <NavItem to="/blocklist"       icon={Icons.blocklist}  label="Blocklist" />
              <NavItem to="/users"           icon={Icons.users}      label="Users" />

              <SectionLabel text="Automations" />
              <ExpandGroup
                icon={Icons.automations} label="Automations"
                isActiveGroup={isAutomationActive} open={automationsOpen} setOpen={setAutomationsOpen}
              >
                <SubItem to="/workflows"    icon={Icons.workflows}    label="Workflows" />
                <SubItem to="/schedules"    icon={Icons.schedules}    label="Schedules" />
                <SubItem to="/salesforms"   icon={Icons.salesform}    label="Salesform" />
                <SubItem to="/api-templates" icon={Icons.apiTemplates} label="API Templates" />
                <SubItem to="/webhooks"     icon={Icons.webhooks}     label="Webhooks" />
                <SubItem to="/n8n-settings" icon={Icons.n8n}          label="n8n" />
              </ExpandGroup>

              <SectionLabel text="Developer" />
              <NavItem to="/call-iq-agents" icon={Icons.callIq}       label="Call-IQ Agents" />
              <NavItem to="/access-tokens"  icon={Icons.accessTokens} label="Access Tokens" />
              <NavItem to="/integrations"   icon={Icons.integrations} label="Integrations" />
              <NavItem to="/mcp"            icon={Icons.mcp}          label="MCP" />
            </>
          )}
        </div>

        <div style={{ borderTop: `1px solid ${BORDER_COLOR}`, padding: '6px 5px 10px' }}>
          <div
            onClick={logout}
            title={!isOpen ? 'Logout' : ''}
            style={{
              display: 'flex', alignItems: 'center',
              height: 38, borderRadius: 8, cursor: 'pointer',
              color: '#ef4444', fontSize: 13, fontWeight: 500,
              transition: 'background 0.15s', overflow: 'hidden', whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => e.currentTarget.style.background = '#fee2e2'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            <span style={{ width: COLLAPSED_W - 10, minWidth: COLLAPSED_W - 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{Icons.logout}</span>
            {isOpen && <span>Logout</span>}
          </div>
          {isOpen && <div style={{ fontSize: 9, color: '#d1d5db', textAlign: 'center', marginTop: 4 }}>v189.1</div>}
        </div>
      </div>
    </div>
  );
}