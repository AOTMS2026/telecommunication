import { useAuth } from '../../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { followupsAPI, notificationsAPI } from '../../services/api';

// Module-level helper — no hoisting issues
function formatNotifTime(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

export default function Topbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const initials = user?.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const [now, setNow] = useState(new Date());
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showWorkspaceSettings, setShowWorkspaceSettings] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Track which followup IDs we've already alerted so we don't repeat
  const alertedIds = useRef(new Set());

  const bellRef = useRef(null);
  const dropRef = useRef(null);
  const profileRef = useRef(null);
  const profileDropRef = useRef(null);
  const gearRef = useRef(null);
  const gearDropRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  // Poll real notifications from backend every 30s
  const pollNotifications = useCallback(async () => {
    if (!user) return;
    try {
      const res = await notificationsAPI.getAll({ limit: 30 });
      const dbNotifs = (res.data.notifications || []).map(n => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        time: formatNotifTime(n.createdAt),
        read: n.read,
        leadId: n.lead?._id || n.lead,
      }));
      setNotifications(dbNotifs);
      setUnreadCount(res.data.unreadCount || 0);
    } catch (e) {
      // silent
    }
  }, [user]);

  // Also poll DB every 60s for due callback followups (for instant alert)
  const pollDueCallbacks = useCallback(async () => {
    if (!user) return;
    try {
      const res = await followupsAPI.getAll({
        type: 'call_followup',
        status: 'upcoming',
        forMe: 'true',
      });
      const all = res.data.followups || [];
      const now = new Date();
      const due = all.filter(f => {
        const t = new Date(f.scheduledAt);
        return t <= now && !alertedIds.current.has(f._id);
      });
      if (due.length > 0) {
        due.forEach(f => alertedIds.current.add(f._id));
        // These are in-memory only (callback due alerts)
        const newNotifs = due.map(f => ({
          id: 'cb_' + f._id,
          type: 'callback_due',
          title: '📞 Callback Due Now!',
          message: `Call ${f.lead?.name || 'lead'} (${f.lead?.phone || ''}) — scheduled callback`,
          time: 'now',
          read: false,
          leadId: f.lead?._id,
          followupId: f._id,
          ephemeral: true,
        }));
        setNotifications(prev => [...newNotifs, ...prev.filter(n => !n.ephemeral || alertedIds.current.has(n.followupId))]);
        setUnreadCount(prev => prev + newNotifs.length);
      }
    } catch (e) {
      // silent
    }
  }, [user]);

  useEffect(() => {
    pollNotifications();
    pollDueCallbacks();
    const ni = setInterval(pollNotifications, 30000);
    const ci = setInterval(pollDueCallbacks, 60000);
    return () => { clearInterval(ni); clearInterval(ci); };
  }, [pollNotifications, pollDueCallbacks]);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target) &&
          bellRef.current && !bellRef.current.contains(e.target)) {
        setShowNotifications(false);
      }
      if (profileDropRef.current && !profileDropRef.current.contains(e.target) &&
          profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false);
      }
      if (gearDropRef.current && !gearDropRef.current.contains(e.target) &&
          gearRef.current && !gearRef.current.contains(e.target)) {
        setShowWorkspaceSettings(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await notificationsAPI.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (e) {
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const markRead = async (id) => {
    if (String(id).startsWith('cb_')) {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
      return;
    }
    try {
      await notificationsAPI.markRead(id);
    } catch (e) {}
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const notifIcon = (type) => {
    if (type === 'callback_due') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    );
    if (type === 'lead_assigned' || type === 'new_lead') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22a163" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
    );
    if (type === 'lead_status_changed') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7c5cdd" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
    );
    if (type === 'lead_updated') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    );
    if (type === 'call_initiated') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
    );
    if (type === 'followup') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
    );
    if (type === 'task_created') return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    );
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
    );
  };

  const notifBg = (type) => {
    if (type === 'callback_due') return '#fff0f0';
    if (type === 'lead_assigned' || type === 'new_lead') return '#e8f8f0';
    if (type === 'lead_status_changed') return '#fff8e6';
    if (type === 'lead_updated') return 'var(--theme-surface-tint)';
    if (type === 'call_initiated') return '#e0f7fa';
    if (type === 'followup') return 'var(--theme-surface-tint)';
    if (type === 'task_created') return 'var(--theme-surface-tint)';
    if (type === 'campaign') return '#fff8e6';
    return '#f3f4f6';
  };

  const notifTitleColor = (type) => {
    if (type === 'callback_due') return '#991b1b';
    if (type === 'lead_assigned' || type === 'new_lead') return '#166534';
    if (type === 'lead_status_changed') return '#92400e';
    if (type === 'call_initiated') return '#155e75';
    return 'var(--theme-text-strongest)';
  };

  const roleLabel = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Caller';

  const workspaceSettingsGroups = [
    {
      label: 'WORKSPACE',
      items: [
        { label: 'Lead Fields', path: '/fields', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>) },
        { label: 'Lead Stage', path: '/lead-stage', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>) },
        { label: 'Call Feedback', path: '/call-feedback', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>) },
        { label: 'Custom Actions', path: '/custom-actions', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>) },
        { label: 'Preferences', path: '/workspace-preferences', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>) },
      ],
    },
    {
      label: 'TEAM',
      items: [
        { label: 'Users', path: '/users', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>) },
        { label: 'Permission Templates', path: '/permission-templates', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>) },
      ],
    },
    {
      label: 'BILLING',
      items: [
        { label: 'Buy Licenses', path: '/billing/buy-licenses', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>) },
        { label: 'Transaction History', path: '/billing/transactions', icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 3v18h18"/><path d="M18.4 8.6 13 14l-3-3-3.6 3.6"/></svg>) },
      ],
    },
  ];

  const isAdminLike = user?.role === 'admin' || user?.role === 'manager';

  const profileMenuItems = [
    {
      label: 'Profile',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>),
      onClick: () => { setShowProfile(false); navigate('/profile'); }
    },
    {
      label: 'Message Templates',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>),
      onClick: () => { setShowProfile(false); navigate('/message-templates'); }
    },
    {
      label: 'Blocklist',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>),
      onClick: () => { setShowProfile(false); navigate('/blocklist'); }
    },
    {
      label: 'My Preferences',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>),
      onClick: () => { setShowProfile(false); navigate('/my-preferences'); }
    },
    {
      label: 'Logout',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>),
      onClick: () => { setShowProfile(false); logout(); },
      danger: true
    },
  ];

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 48,
        background: 'linear-gradient(90deg, #0284c7 0%, #0ea5e9 60%, #f97316 100%)',
        borderBottom: '1px solid #0369a1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 16px 0 10px', zIndex: 100
      }}>
        {/* Left: logo + org name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, background: '#fff', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.12)'
          }}>
            <img
              src="/atm-logo.jpeg"
              alt="ATM"
              style={{ width: 30, height: 30, objectFit: 'contain' }}
              onError={e => {
                const t = e.currentTarget;
                if (t.src.endsWith('.jpeg')) { t.src = '/atm-logo.jpg'; }
                else if (t.src.endsWith('.jpg')) { t.src = '/atm-logo.png'; }
                else if (t.src.endsWith('.png')) { t.src = '/atm-logo.webp'; }
                else { t.style.display = 'none'; }
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', letterSpacing: 0.2 }}>AOTMS GLOBAL PVT. LTD</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {isAdminLike && (
            <div ref={gearRef} style={{ position: 'relative', marginLeft: 2 }}>
              <div
                onClick={() => { setShowWorkspaceSettings(prev => !prev); setShowProfile(false); setShowNotifications(false); }}
                title="Workspace settings"
                style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'all 0.15s',
                  background: showWorkspaceSettings ? 'rgba(255,255,255,0.25)' : 'transparent'
                }}
                onMouseEnter={e => { if (!showWorkspaceSettings) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
                onMouseLeave={e => { if (!showWorkspaceSettings) e.currentTarget.style.background = 'transparent'; }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={showWorkspaceSettings ? '#fff' : 'rgba(255,255,255,0.8)'} strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
              </div>

              {showWorkspaceSettings && (
                <div
                  ref={gearDropRef}
                  style={{
                    position: 'absolute', top: 36, left: 0,
                    width: 220, background: '#fff',
                    border: '1px solid var(--theme-border-tint)', borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(var(--theme-primary-rgb),0.14)',
                    zIndex: 200, overflow: 'hidden',
                    animation: 'fadeSlideDown 0.15s ease',
                    padding: '6px 0'
                  }}
                >
                  <style>{`@keyframes fadeSlideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                  {workspaceSettingsGroups.map((group, gi) => (
                    <div key={group.label} style={{ borderTop: gi > 0 ? '1px solid var(--theme-surface-tint)' : 'none', padding: '6px 0' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--theme-primary-pale)', letterSpacing: '0.05em', padding: '4px 16px' }}>
                        {group.label}
                      </div>
                      {group.items.map(item => (
                        <div
                          key={item.path}
                          onClick={() => { setShowWorkspaceSettings(false); navigate(item.path); }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '8px 16px', cursor: 'pointer',
                            color: 'var(--theme-text-strongest)', fontSize: 13, fontWeight: 500,
                            transition: 'background 0.1s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-surface-tint)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                          <span style={{ color: '#888', display: 'flex' }}>{item.icon}</span>
                          {item.label}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: time + clock + bell + avatar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ textAlign: 'right', marginRight: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>{timeStr}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.75)' }}>{dateStr}</div>
          </div>

          {/* Clock icon — navigates to Follow-up Calls */}
          <div
            onClick={() => navigate('/tasks?tab=Call+Followups')}
            title="View Follow-up Calls"
            style={{
              width: 30, height: 30, border: '1px solid rgba(255,255,255,0.35)', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'all 0.15s',
              background: 'transparent'
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; e.currentTarget.style.borderColor = '#fff'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)'; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>

          {/* Bell */}
          <div ref={bellRef} style={{ position: 'relative' }}>
            <div
              onClick={() => { setShowNotifications(prev => !prev); setShowProfile(false); }}
              style={{
                width: 30, height: 30, border: `1px solid ${showNotifications ? '#fff' : 'rgba(255,255,255,0.35)'}`,
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', position: 'relative',
                background: showNotifications ? 'rgba(255,255,255,0.25)' : 'transparent',
                transition: 'all 0.15s'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={showNotifications ? '#fff' : 'rgba(255,255,255,0.9)'} strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {unreadCount > 0 && (
                <div style={{
                  width: unreadCount > 9 ? 14 : 8,
                  height: 8,
                  background: '#e53e3e',
                  borderRadius: '50%',
                  position: 'absolute', top: 3, right: 3,
                  border: '2px solid #fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 8, color: '#fff', fontWeight: 700,
                  lineHeight: 1
                }}>
                  {unreadCount > 9 ? '9+' : ''}
                </div>
              )}
            </div>

            {/* Notifications Dropdown */}
            {showNotifications && (
              <div
                ref={dropRef}
                style={{
                  position: 'absolute', top: 36, right: -8,
                  width: 320, background: '#fff',
                  border: '1px solid var(--theme-border-tint)', borderRadius: 12,
                  boxShadow: '0 8px 32px rgba(var(--theme-primary-rgb),0.12)',
                  zIndex: 200, overflow: 'hidden',
                  animation: 'fadeSlideDown 0.15s ease'
                }}
              >
                <style>{`@keyframes fadeSlideDown { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: '1px solid var(--theme-surface-tint)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text-strongest)' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--theme-primary)', borderRadius: 10, padding: '1px 6px' }}>{unreadCount}</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} style={{ fontSize: 11, color: 'var(--theme-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Mark all read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '32px 16px', textAlign: 'center', color: '#888', fontSize: 13 }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🔔</div>
                      No notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          if (n.leadId) navigate(`/leads/${n.leadId}`);
                          setShowNotifications(false);
                        }}
                        style={{
                          display: 'flex', gap: 12, padding: '12px 16px',
                          borderBottom: '1px solid var(--theme-surface-faint)',
                          background: n.read ? '#fff' : (n.type === 'callback_due' ? '#fff5f5' : 'var(--theme-surface-faint)'),
                          cursor: 'pointer', transition: 'background 0.1s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-surface-tint)'}
                        onMouseLeave={e => e.currentTarget.style.background = n.read ? '#fff' : (n.type === 'callback_due' ? '#fff5f5' : 'var(--theme-surface-faint)')}
                      >
                        <div style={{
                          width: 32, height: 32, borderRadius: 8,
                          background: notifBg(n.type),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {notifIcon(n.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                            <span style={{ fontSize: 12, fontWeight: n.read ? 500 : 700, color: notifTitleColor(n.type) }}>{n.title}</span>
                            <span style={{ fontSize: 10, color: '#aaa', flexShrink: 0, marginLeft: 8 }}>{n.time}</span>
                          </div>
                          <div style={{ fontSize: 11, color: '#666', lineHeight: 1.4 }}>{n.message}</div>
                        </div>
                        {!n.read && (
                          <div style={{ width: 7, height: 7, background: n.type === 'callback_due' ? '#e53e3e' : (n.type === 'call_initiated' ? '#0891b2' : 'var(--theme-primary)'), borderRadius: '50%', flexShrink: 0, marginTop: 4 }} />
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div style={{ padding: '10px 16px', borderTop: '1px solid var(--theme-surface-tint)', textAlign: 'center' }}>
                  <button
                    onClick={() => { navigate('/tasks?tab=Call+Followups'); setShowNotifications(false); }}
                    style={{ fontSize: 12, color: 'var(--theme-primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                  >
                    View all follow-up calls
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Avatar */}
          <div ref={profileRef} style={{ position: 'relative' }}>
            <div
              onClick={() => { setShowProfile(prev => !prev); setShowNotifications(false); }}
              style={{
                width: 30, height: 30, borderRadius: '50%',
                background: showProfile ? '#ea6d0e' : '#f97316',
                color: '#fff', fontSize: 11, fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: showProfile ? '0 0 0 3px var(--theme-primary-pale2)' : 'none',
                transition: 'all 0.15s'
              }}
            >
              {initials}
            </div>

            {showProfile && (
              <div
                ref={profileDropRef}
                style={{
                  position: 'absolute', top: 38, right: 0,
                  width: 240, background: '#fff',
                  border: '1px solid var(--theme-border-tint)', borderRadius: 14,
                  boxShadow: '0 8px 32px rgba(var(--theme-primary-rgb),0.14)',
                  zIndex: 200, overflow: 'hidden',
                  animation: 'fadeSlideDown 0.15s ease'
                }}
              >
                <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--theme-surface-tint)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text-strongest)' }}>{user?.name || 'User'}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--theme-primary)', background: 'var(--theme-surface-tint)', borderRadius: 20, padding: '2px 8px' }}>Pro</span>
                  </div>
                  <div style={{ display: 'inline-block', fontSize: 11, fontWeight: 500, color: '#666', background: '#f3f4f6', borderRadius: 20, padding: '2px 10px', marginBottom: 6 }}>
                    {roleLabel}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--theme-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary)" strokeWidth="2">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                    {user?.email || 'user@example.com'}
                  </div>
                </div>
                <div style={{ padding: '6px 0' }}>
                  {profileMenuItems.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={item.onClick}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 16px', cursor: 'pointer',
                        color: item.danger ? '#e53e3e' : 'var(--theme-text-strongest)',
                        fontSize: 13, fontWeight: 500,
                        transition: 'background 0.1s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = item.danger ? '#fff5f5' : 'var(--theme-surface-tint)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: item.danger ? '#e53e3e' : '#888', display: 'flex' }}>{item.icon}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
    </>
  );
}