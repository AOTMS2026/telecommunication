import { useState, useEffect } from 'react';
import { permissionTemplatesAPI } from '../services/api';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const day = 86400000;
  if (diff < day) return 'Today';
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return `${Math.floor(diff / (30 * day))}M ago`;
}

function TemplateModal({ template, onClose, onSaved }) {
  const isEdit = !!template;
  const [form, setForm] = useState(() => template ? { ...template } : {
    name: '', baseRole: 'caller',
    permissions: {
      leads: { view: 'own', edit: true, delete: false, export: false, transfer: false, bulkImport: false },
      campaigns: { view: true, manage: false },
      reports: { view: true },
      users: { view: false, manage: false },
      settings: { manage: false },
      workflows: { manage: false },
    },
  });
  const [saving, setSaving] = useState(false);

  const setPerm = (group, key, val) => setForm(f => ({ ...f, permissions: { ...f.permissions, [group]: { ...f.permissions[group], [key]: val } } }));

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (isEdit) await permissionTemplatesAPI.update(template._id, form);
      else await permissionTemplatesAPI.create(form);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const Bool = ({ group, k, label }) => (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#444', padding: '6px 0' }}>
      <input type="checkbox" checked={!!form.permissions[group][k]} onChange={e => setPerm(group, k, e.target.checked)} />
      {label}
    </label>
  );

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,40,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: 560, maxHeight: '85vh', overflowY: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: 0 }}>{isEdit ? 'Edit Permission Template' : 'Add Permission Template'}</h3>
          <span onClick={onClose} style={{ cursor: 'pointer', color: '#888', fontSize: 18 }}>✕</span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Template name</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Telecaller Permissions" style={{ width: '100%', marginTop: 6, padding: '9px 12px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box' }} />
          </div>
          <div style={{ width: 160 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Base role</label>
            <select value={form.baseRole} onChange={e => setForm(f => ({ ...f, baseRole: e.target.value }))} style={{ width: '100%', marginTop: 6, padding: '9px 8px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13 }}>
              <option value="caller">Caller</option>
              <option value="manager">Manager</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
          <div>
            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: '0 0 6px' }}>Leads</h4>
            <label style={{ fontSize: 12.5, color: '#666' }}>View scope</label>
            <select value={form.permissions.leads.view} onChange={e => setPerm('leads', 'view', e.target.value)} style={{ width: '100%', marginTop: 4, marginBottom: 6, padding: '6px 8px', border: '1px solid var(--theme-border-tint2)', borderRadius: 6, fontSize: 12.5 }}>
              <option value="none">None</option>
              <option value="own">Own</option>
              <option value="team">Team</option>
              <option value="all">All</option>
            </select>
            <Bool group="leads" k="edit" label="Edit" />
            <Bool group="leads" k="delete" label="Delete" />
            <Bool group="leads" k="export" label="Export" />
            <Bool group="leads" k="transfer" label="Transfer" />
            <Bool group="leads" k="bulkImport" label="Bulk Import" />
          </div>
          <div>
            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: '0 0 6px' }}>Campaigns</h4>
            <Bool group="campaigns" k="view" label="View" />
            <Bool group="campaigns" k="manage" label="Manage" />

            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: '14px 0 6px' }}>Reports</h4>
            <Bool group="reports" k="view" label="View" />

            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: '14px 0 6px' }}>Users</h4>
            <Bool group="users" k="view" label="View" />
            <Bool group="users" k="manage" label="Manage" />

            <h4 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: '14px 0 6px' }}>Settings & Workflows</h4>
            <Bool group="settings" k="manage" label="Manage settings" />
            <Bool group="workflows" k="manage" label="Manage workflows" />
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--theme-border-tint2)', background: '#fff', color: '#444', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={!form.name.trim() || saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !form.name.trim() ? 'var(--theme-primary-pale)' : 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: !form.name.trim() ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PermissionTemplates() {
  const [tab, setTab] = useState('all');
  const [templates, setTemplates] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await permissionTemplatesAPI.getAll(tab === 'defaults' ? 'defaults' : undefined);
      setTemplates(res.data.templates);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load permission templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [tab]);

  const filtered = templates.filter(t => t.name.toLowerCase().includes(search.toLowerCase()));

  const remove = async (t) => {
    if (t.isDefault) { alert("Can't delete a default template"); return; }
    if (!window.confirm(`Delete "${t.name}"?`)) return;
    try {
      await permissionTemplatesAPI.delete(t._id);
      load();
    } catch (e) {
      alert(e.response?.data?.message || 'Failed to delete');
    }
  };

  return (
    <div className="pt-shell" style={{ padding: 24, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        @media (max-width: 640px) {
          .pt-shell { padding: 14px !important; }
          .pt-shell [style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
          .pt-shell div[style*="display: flex"] { flex-wrap: wrap; row-gap: 6px; }
          .pt-shell div[style*="display: flex"] > * { min-width: 0; }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--theme-text-strongest2)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          Permission Templates
        </h2>
        <button onClick={() => { setEditTarget(null); setModalOpen(true); }} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          + Add new
        </button>
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #eee', marginBottom: 14 }}>
        {['all', 'defaults'].map(t => (
          <span key={t} onClick={() => setTab(t)} style={{ padding: '8px 2px', fontSize: 14, fontWeight: 600, cursor: 'pointer', color: tab === t ? 'var(--theme-primary-mid)' : '#888', borderBottom: tab === t ? '2px solid var(--theme-primary-mid)' : '2px solid transparent', textTransform: 'capitalize' }}>
            {t}
          </span>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5, marginBottom: 8, boxSizing: 'border-box' }} />
      <p style={{ fontSize: 12.5, color: '#999', margin: '0 0 14px' }}>{filtered.length} templates found</p>

      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 18px', fontSize: 12.5, fontWeight: 700, color: '#666', background: 'var(--theme-surface-faint)' }}>
          <span>Name</span><span>Assigned to</span><span>Last modified on</span><span></span>
        </div>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#888' }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#e53e3e', marginBottom: 14, fontSize: 13.5 }}>{error}</p>
            <button onClick={load} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No templates found.</div>
        ) : (
          filtered.map(t => (
            <div key={t._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', padding: '12px 18px', fontSize: 13.5, borderTop: '1px solid var(--theme-surface-faint)', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#333', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--theme-primary-mid)" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                {t.name}
              </span>
              <span style={{ color: '#888' }}>{t.assignedCount}</span>
              <span style={{ color: '#888' }}>{timeAgo(t.updatedAt)}</span>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                {t.isDefault && t.assignedCount > 0 ? (
                  <span style={{ cursor: 'pointer', color: 'var(--theme-primary-mid)' }} title="View">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  </span>
                ) : (
                  <span onClick={() => { setEditTarget(t); setModalOpen(true); }} style={{ cursor: 'pointer', color: 'var(--theme-primary-mid)' }} title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </span>
                )}
                <span onClick={() => remove(t)} style={{ cursor: t.isDefault ? 'not-allowed' : 'pointer', color: t.isDefault ? '#f0c2c2' : '#e53e3e' }} title={t.isDefault ? "Can't delete a default template" : 'Delete'}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {modalOpen && (
        <TemplateModal template={editTarget} onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); load(); }} />
      )}
    </div>
  );
}