import { useState, useEffect } from 'react';
import { leadFieldsAPI } from '../services/api';

const TYPE_ICON = {
  text: 'T', number: '#', phone: '📞', email: '✉', date: '📅', money: '₹', dropdown: '▾', checkbox: '☑', textarea: '¶',
};

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const day = 86400000;
  if (diff < day) return 'Today';
  if (diff < 30 * day) return `${Math.floor(diff / day)}d ago`;
  return `${Math.floor(diff / (30 * day))}M ago`;
}

function AddFieldModal({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [optionsText, setOptionsText] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const options = type === 'dropdown' ? optionsText.split(',').map(o => o.trim()).filter(Boolean) : [];
      await leadFieldsAPI.create({ name: name.trim(), type, options });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,40,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: 440, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: 0 }}>Add a new Field</h3>
          <span onClick={onClose} style={{ cursor: 'pointer', color: '#888' }}>✕</span>
        </div>
        <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Field name</label>
        <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Branch Code" style={{ width: '100%', marginTop: 6, marginBottom: 14, padding: '9px 12px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box' }} />
        <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Type</label>
        <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%', marginTop: 6, marginBottom: 14, padding: '9px 8px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5 }}>
          {Object.keys(TYPE_ICON).map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
        {type === 'dropdown' && (
          <>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Options (comma separated)</label>
            <input value={optionsText} onChange={e => setOptionsText(e.target.value)} placeholder="Option 1, Option 2" style={{ width: '100%', marginTop: 6, marginBottom: 14, padding: '9px 12px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box' }} />
          </>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--theme-border-tint2)', background: '#fff', color: '#444', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={!name.trim() || saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !name.trim() ? 'var(--theme-primary-pale)' : 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: !name.trim() ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : 'Add Field'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Fields() {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [view, setView] = useState('Active Fields');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await leadFieldsAPI.getAll({ search, view });
      setFields(res.data.fields);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load fields');
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [search, view]);

  const toggleHide = async (f) => {
    await leadFieldsAPI.toggleHide(f._id, !f.hidden);
    load();
  };

  const remove = async (f) => {
    if (!window.confirm(`Delete field "${f.name}"?`)) return;
    await leadFieldsAPI.delete(f._id);
    load();
  };

  const saveEdit = async (f) => {
    if (editName.trim() && editName.trim() !== f.name) {
      await leadFieldsAPI.update(f._id, { name: editName.trim() });
      load();
    }
    setEditingId(null);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--theme-text-strongest2)" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          Fields Settings
        </h2>
        <button onClick={() => setShowAdd(true)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          + Add a new Field
        </button>
      </div>

      <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>Lead Id <span style={{ color: 'var(--theme-primary-mid)', cursor: 'pointer' }}>Learn more</span></p>

      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
        <span style={{ color: 'var(--theme-primary-mid)', fontSize: 20 }}>📱</span>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>Phone</div>
          <div style={{ fontSize: 12.5, color: '#aaa' }}>+91 9999999999</div>
        </div>
      </div>

      <div style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.05em', marginBottom: 10 }}>PRIMARY FIELDS (ASSIGN)</div>
      {[{ tag: 'H1', name: 'Name', icon: 'T' }, { tag: 'H2', name: 'Phone', icon: '📞' }].map(p => (
        <div key={p.tag} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: '#fff', border: '1px solid #eee', borderRadius: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#aaa', width: 24 }}>{p.tag}:</span>
          <span>{p.icon}</span>
          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: '#333' }}>{p.name}</span>
          <span style={{ color: '#bbb' }}>✎</span>
        </div>
      ))}

      <div style={{ fontSize: 12, fontWeight: 700, color: '#999', letterSpacing: '0.05em', margin: '22px 0 10px' }}>OTHER FIELDS</div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." style={{ flex: 1, padding: '9px 14px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5 }} />
        <select value={view} onChange={e => setView(e.target.value)} style={{ padding: '9px 14px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5 }}>
          <option>Active Fields</option>
          <option>Hidden Fields</option>
          <option>All</option>
        </select>
      </div>

      <p style={{ fontSize: 12.5, color: '#999', marginBottom: 10 }}>{fields.length} results found</p>

      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr', padding: '12px 18px', fontSize: 12.5, fontWeight: 700, color: '#666', background: 'var(--theme-surface-faint)' }}>
          <span>Field Name</span><span>Type</span><span>Created On</span><span>Last Modified</span><span>Actions</span>
        </div>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#888' }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#e53e3e', marginBottom: 14, fontSize: 13.5 }}>{error}</p>
            <button onClick={load} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : fields.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>No fields found.</div>
        ) : (
          fields.map(f => (
            <div key={f._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1.2fr', padding: '12px 18px', fontSize: 13.5, borderTop: '1px solid var(--theme-surface-faint)', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, color: '#333' }}>
                <span style={{ color: '#888' }}>{TYPE_ICON[f.type] || 'T'}</span>
                {editingId === f._id ? (
                  <input autoFocus value={editName} onChange={e => setEditName(e.target.value)} onBlur={() => saveEdit(f)} onKeyDown={e => { if (e.key === 'Enter') saveEdit(f); if (e.key === 'Escape') setEditingId(null); }} style={{ border: '1px solid var(--theme-primary-pale2)', borderRadius: 6, padding: '4px 8px', fontSize: 13 }} />
                ) : f.name}
              </span>
              <span style={{ color: '#888', textTransform: 'capitalize' }}>{f.type}</span>
              <span style={{ color: '#888' }}>{timeAgo(f.createdAt)}</span>
              <span style={{ color: '#888' }}>{timeAgo(f.updatedAt)}</span>
              <div style={{ display: 'flex', gap: 14 }}>
                <span onClick={() => { setEditingId(f._id); setEditName(f.name); }} style={{ cursor: 'pointer', color: 'var(--theme-primary-mid)', fontWeight: 600, fontSize: 12.5 }}>✎ Edit</span>
                <span onClick={() => toggleHide(f)} style={{ cursor: 'pointer', color: '#888', fontWeight: 600, fontSize: 12.5 }}>{f.hidden ? '👁 Show' : '🚫 Hide'}</span>
                {!f.isSystem && <span onClick={() => remove(f)} style={{ cursor: 'pointer', color: '#e53e3e', fontWeight: 600, fontSize: 12.5 }}>🗑</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {showAdd && <AddFieldModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}