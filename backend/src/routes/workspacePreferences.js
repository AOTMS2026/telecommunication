import { useState, useEffect } from 'react';
import { workspacePreferencesAPI } from '../services/api';

function Toggle({ checked, onChange }) {
  return (
    <label style={{ position: 'relative', display: 'inline-block', width: 40, height: 22 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
      <span onClick={() => onChange(!checked)} style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: checked ? '#7c5cf0' : '#ccc', borderRadius: 22, transition: '0.2s' }}>
        <span style={{ position: 'absolute', height: 18, width: 18, left: checked ? 20 : 2, bottom: 2, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
      </span>
    </label>
  );
}

function Row({ icon, label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 4px', borderBottom: '1px solid #f4f3fa' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ color: '#888' }}>{icon}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: '#333' }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

const gearIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>);
const powerIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>);
const stageIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>);
const starIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>);
const pinIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>);
const atIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>);
const activityIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>);
const usersIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>);
const recaptureIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>);
const syncIcon = (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10"/><path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14"/></svg>);

export default function WorkspacePreferences() {
  const [prefs, setPrefs] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await workspacePreferencesAPI.get();
      setPrefs(res.data.preferences);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (patch) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    await workspacePreferencesAPI.update(patch);
  };

  const saveNested = async (group, key, value) => {
    const next = { ...prefs, [group]: { ...prefs[group], [key]: value } };
    setPrefs(next);
    await workspacePreferencesAPI.update({ [group]: { [key]: value } });
  };

  if (loading || !prefs) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  return (
    <div style={{ padding: 24, maxWidth: 760 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1f1f3d', margin: '0 0 14px' }}>Workspace Preferences</h2>
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '4px 18px', marginBottom: 22 }}>
        <Row icon={gearIcon} label="Default Country Code">
          <input value={prefs.defaultCountryCode} onChange={e => save({ defaultCountryCode: e.target.value })} style={{ width: 70, padding: '6px 10px', border: '1px solid #e0ddf0', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
        </Row>
        <Row icon={gearIcon} label="Default Timezone">
          <select value={prefs.defaultTimezone} onChange={e => save({ defaultTimezone: e.target.value })} style={{ padding: '6px 10px', border: '1px solid #e0ddf0', borderRadius: 6, fontSize: 13, minWidth: 160 }}>
            <option value="Asia/Kolkata">Asia/Kolkata</option>
            <option value="Asia/Dubai">Asia/Dubai</option>
            <option value="UTC">UTC</option>
            <option value="America/New_York">America/New_York</option>
            <option value="Europe/London">Europe/London</option>
          </select>
        </Row>
        <Row icon={gearIcon} label="Default Currency">
          <select value={prefs.defaultCurrency} onChange={e => save({ defaultCurrency: e.target.value })} style={{ padding: '6px 10px', border: '1px solid #e0ddf0', borderRadius: 6, fontSize: 13, minWidth: 100 }}>
            <option value="INR">INR</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="AED">AED</option>
          </select>
        </Row>
        <Row icon={gearIcon} label="Connected Call Minimum Duration (in sec)">
          <input type="number" min={0} value={prefs.connectedCallMinDuration} onChange={e => save({ connectedCallMinDuration: Number(e.target.value) })} style={{ width: 70, padding: '6px 10px', border: '1px solid #e0ddf0', borderRadius: 6, fontSize: 13, textAlign: 'right' }} />
        </Row>
        <Row icon={powerIcon} label="Session Timeout">
          <select value={prefs.sessionTimeout} onChange={e => save({ sessionTimeout: e.target.value })} style={{ padding: '6px 10px', border: '1px solid #e0ddf0', borderRadius: 6, fontSize: 13, minWidth: 110 }}>
            <option value="Never">Never</option>
            <option value="1 hour">1 hour</option>
            <option value="8 hours">8 hours</option>
            <option value="24 hours">24 hours</option>
            <option value="7 days">7 days</option>
          </select>
        </Row>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f1f3d', margin: '0 0 10px' }}>Leaderboard</h3>
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '4px 18px', marginBottom: 22 }}>
        <Row icon={stageIcon} label="Lead Stage">
          <Toggle checked={prefs.leaderboard.leadStage} onChange={v => saveNested('leaderboard', 'leadStage', v)} />
        </Row>
        <Row icon={starIcon} label="Lead Rating">
          <Toggle checked={prefs.leaderboard.leadRating} onChange={v => saveNested('leaderboard', 'leadRating', v)} />
        </Row>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f1f3d', margin: '0 0 10px' }}>Features</h3>
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '4px 18px', marginBottom: 22 }}>
        <Row icon={pinIcon} label="Location Check-in">
          <Toggle checked={prefs.features.locationCheckIn} onChange={v => saveNested('features', 'locationCheckIn', v)} />
        </Row>
        <Row icon={atIcon} label="Campaign">
          <Toggle checked={prefs.features.campaign} onChange={v => saveNested('features', 'campaign', v)} />
        </Row>
        <Row icon={activityIcon} label="Custom Actions">
          <Toggle checked={prefs.features.customActions} onChange={v => saveNested('features', 'customActions', v)} />
        </Row>
        <Row icon={usersIcon} label="Sales Group">
          <Toggle checked={prefs.features.salesGroup} onChange={v => saveNested('features', 'salesGroup', v)} />
        </Row>
        <Row icon={recaptureIcon} label="Lead Recapture">
          <Toggle checked={prefs.features.leadRecapture} onChange={v => saveNested('features', 'leadRecapture', v)} />
        </Row>
      </div>

      <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1f1f3d', margin: '0 0 10px' }}>Sync Permissions</h3>
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: '4px 18px' }}>
        <Row icon={syncIcon} label="Smart Syncing">
          <Toggle checked={prefs.syncPermissions.smartSyncing} onChange={v => saveNested('syncPermissions', 'smartSyncing', v)} />
        </Row>
      </div>
    </div>
  );
}