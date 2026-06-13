import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const navItems = [
  {
    key: 'dashboard', to: '/dashboard', tooltip: 'Dashboard',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
  },
  {
    key: 'my-calls', to: '/my-calls', tooltip: 'My Calls',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9a16 16 0 0 0 6.29 6.29l1.42-1.42a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
  },
  {
    key: 'tasks', to: '/tasks', tooltip: 'Tasks',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
  },
  {
    key: 'leads', to: '/leads', tooltip: 'Leads',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
  },
  {
    key: 'add-leads', tooltip: 'Add Leads',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>,
    hasSubmenu: true,
    submenu: [
      {
        key: 'add-single-lead', to: '/leads/new', label: 'Add Single Lead',
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="16" y1="11" x2="22" y2="11"/></svg>
      },
      {
        key: 'bulk-import', to: '/bulk-import', label: 'Add From Excel',
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      },
      {
        key: 'integrations', to: '/integrations', label: 'Add From Integration',
        icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
      },
    ]
  },
  {
    key: 'campaigns', to: '/campaigns', tooltip: 'Campaigns',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
  },
  {
    key: 'message-templates', to: '/message-templates', tooltip: 'Message Templates',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  },
  {
    key: 'whatsapp', to: '/whatsapp', tooltip: 'WhatsApp',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"
          stroke="currentColor" fill="none"/>
      </svg>
    ),
    whatsapp: true
  },
  {
    key: 'leaderboard', to: '/leaderboard', tooltip: 'Leaderboard',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/></svg>
  },
  {
    key: 'reports', to: '/reports', tooltip: 'Reports',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
  },
  {
    key: 'team-operations', to: '/team-operations', tooltip: 'Team Operations', adminOnly: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
  },
  {
    key: 'stale-leads', to: '/stale-leads', tooltip: 'Stale Leads', adminOnly: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  },
  {
    key: 'blocklist', to: '/blocklist', tooltip: 'Blocklist',
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
  },
  {
    key: 'users', to: '/users', tooltip: 'Users', adminOnly: true,
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
  },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [openSubmenu, setOpenSubmenu] = useState(null);
  const submenuRef = useRef(null);

  const filteredNavItems = navItems.filter(item => {
    if (item.adminOnly) {
      return user?.role === 'admin' || user?.role === 'super admin';
    }
    return true;
  });

  // Determine active key
  const activeKey = (() => {
    if (location.pathname.startsWith('/integrations')) return 'integrations';
    if (location.pathname.startsWith('/bulk-import')) return 'bulk-import';
    if (location.pathname === '/leads/new') return 'add-single-lead';
    if (location.pathname === '/leads') return 'leads';
    return filteredNavItems.find(n => !n.hasSubmenu && n.to && location.pathname.startsWith(n.to))?.key || 'dashboard';
  })();

  // Close submenu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (submenuRef.current && !submenuRef.current.contains(e.target)) {
        setOpenSubmenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // add-leads submenu icon is highlighted when any sub-route is active
  const addLeadsSubKeys = ['add-single-lead', 'bulk-import', 'integrations'];
  const isAddLeadsActive = addLeadsSubKeys.includes(activeKey);

  return (
    <aside style={{
      position: 'fixed', top: 48, left: 0, bottom: 0,
      width: 52, background: '#ffffff',
      borderRight: '1px solid #e5e2f5',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', padding: '10px 0 4px', gap: 4,
      zIndex: 99
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: 6, width: '100%', overflowY: 'auto', overflowX: 'hidden',
        maxHeight: 'calc(100vh - 120px)', paddingBottom: 8
      }} ref={submenuRef}>
        {filteredNavItems.map((item) => {
          const isActive = item.hasSubmenu ? isAddLeadsActive : activeKey === item.key;

          if (item.hasSubmenu) {
            return (
              <div key={item.key} style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
                <div
                  title={item.tooltip}
                  onClick={() => setOpenSubmenu(openSubmenu === item.key ? null : item.key)}
                  className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                  style={{ cursor: 'pointer' }}
                >
                  {item.icon}
                </div>

                {/* Submenu popup */}
                {openSubmenu === item.key && (
                  <div style={{
                    position: 'fixed', left: 56, top: 'auto',
                    background: '#fff', border: '1px solid #e5e2f5', borderRadius: 10,
                    boxShadow: '0 8px 24px rgba(99,102,241,0.12)',
                    minWidth: 210, zIndex: 200, overflow: 'hidden',
                    animation: 'fadeIn 0.15s ease'
                  }}>
                    {/* Header label */}
                    <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid #f0eef8' }}>
                      Leads
                    </div>
                    {item.submenu.map(sub => (
                      <div
                        key={sub.key}
                        onClick={() => { navigate(sub.to); setOpenSubmenu(null); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '11px 16px', cursor: 'pointer',
                          background: activeKey === sub.key ? '#f0eeff' : '#fff',
                          color: activeKey === sub.key ? '#6366f1' : '#374151',
                          fontWeight: activeKey === sub.key ? 600 : 400,
                          fontSize: 14,
                          transition: 'background 0.1s'
                        }}
                        onMouseEnter={e => { if (activeKey !== sub.key) e.currentTarget.style.background = '#faf9ff'; }}
                        onMouseLeave={e => { if (activeKey !== sub.key) e.currentTarget.style.background = '#fff'; }}
                      >
                        <span style={{ color: activeKey === sub.key ? '#6366f1' : '#9ca3af' }}>{sub.icon}</span>
                        {sub.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <div
              key={item.key}
              title={item.tooltip}
              onClick={() => { navigate(item.to); setOpenSubmenu(null); }}
              className={`sidebar-nav-item ${isActive ? 'active' : ''} ${item.whatsapp ? 'whatsapp-nav-item' : ''}`}
              style={item.whatsapp && !isActive ? { color: '#25D366' } : {}}
            >
              {item.icon}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* Logout button */}
      <div
        title="Logout"
        onClick={logout}
        className="sidebar-nav-item logout-nav-item"
        style={{ marginBottom: 4, flexShrink: 0 }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </div>
      <div style={{ fontSize: 8, color: '#ccc', marginBottom: 2, flexShrink: 0 }}>v189.1</div>
    </aside>
  );
}