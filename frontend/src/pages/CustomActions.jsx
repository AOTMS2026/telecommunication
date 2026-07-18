import { useState, useEffect } from 'react';
import { customActionsAPI } from '../services/api';

const ICONS = ['activity', 'star', 'flag', 'check-circle', 'thumbs-up', 'alert-circle', 'zap'];
const FIELD_TYPES = ['text', 'number', 'date', 'dropdown', 'checkbox'];

function ActionDrawer({ action, onClose, onSaved }) {
  const isEdit = !!action;
  const [form, setForm] = useState(() => action ? { ...action } : {
    icon: 'activity', name: '', score: 0, direction: 'information', description: '',
    allowPredefinedActions: false,
    fields: [{ name: 'Notes', type: 'text', required: true, hidden: false }],
  });
  const [dirty, setDirty] = useState(false);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };

  const addField = () => set('fields', [...form.fields, { name: '', type: 'text', required: false, hidden: false }]);
  const updateField = (idx, patch) => {
    const fields = form.fields.map((f, i) => i === idx ? { ...f, ...patch } : f);
    set('fields', fields);
  };
  const removeField = (idx) => set('fields', form.fields.filter((_, i) => i !== idx));

  const requestClose = () => { if (dirty) setConfirmingClose(true); else onClose(); };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      if (isEdit) await customActionsAPI.update(action._id, form);
      else await customActionsAPI.create(form);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,40,0.4)', zIndex: 300, display: 'flex', justifyContent: 'flex-end' }} onClick={requestClose}>
      <div style={{ width: 480, background: '#fff', height: '100%', padding: 24, overflowY: 'auto', boxShadow: '-8px 0 30px rgba(0,0,0,0.15)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22 }}>
          <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: 0 }}>{isEdit ? 'Edit Custom Action' : 'Add Custom Action'}</h3>
          <span onClick={requestClose} style={{ cursor: 'pointer', color: '#888', fontSize: 18 }}>✕</span>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ width: 90 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Icon</label>
            <select value={form.icon} onChange={e => set('icon', e.target.value)} style={{ width: '100%', marginTop: 6, padding: '9px 8px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13 }}>
              {ICONS.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Name</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Enter name" style={{ width: '100%', marginTop: 6, padding: '9px 12px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box' }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Score (Min. -1000 / Max. 1000)</label>
            <input type="number" min={-1000} max={1000} value={form.score} onChange={e => set('score', Number(e.target.value))} style={{ width: '100%', marginTop: 6, padding: '9px 12px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box' }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Direction</label>
            <select value={form.direction} onChange={e => set('direction', e.target.value)} style={{ width: '100%', marginTop: 6, padding: '9px 8px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13 }}>
              <option value="information">Information</option>
              <option value="positive">Positive</option>
              <option value="negative">Negative</option>
            </select>
          </div>
        </div>

        <label style={{ fontSize: 12.5, fontWeight: 600, color: '#444' }}>Description</label>
        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} style={{ width: '100%', marginTop: 6, marginBottom: 16, padding: '9px 12px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box', resize: 'vertical' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <span style={{ fontSize: 13.5, color: '#444', fontWeight: 500 }}>Allow Predefined Actions</span>
          <label style={{ position: 'relative', display: 'inline-block', width: 38, height: 20 }}>
            <input type="checkbox" checked={form.allowPredefinedActions} onChange={e => set('allowPredefinedActions', e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
            <span onClick={() => set('allowPredefinedActions', !form.allowPredefinedActions)} style={{ position: 'absolute', cursor: 'pointer', inset: 0, background: form.allowPredefinedActions ? 'var(--theme-primary-mid)' : '#ccc', borderRadius: 20, transition: '0.2s' }}>
              <span style={{ position: 'absolute', height: 16, width: 16, left: form.allowPredefinedActions ? 20 : 2, bottom: 2, background: '#fff', borderRadius: '50%', transition: '0.2s' }} />
            </span>
          </label>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--theme-text-strongest2)' }}>Fields ({form.fields.length})</span>
          <span onClick={addField} style={{ fontSize: 12.5, color: 'var(--theme-primary-mid)', fontWeight: 600, cursor: 'pointer' }}>+Add field</span>
        </div>

        {form.fields.map((f, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--theme-surface-faint)', borderRadius: 8, marginBottom: 8 }}>
            <span style={{ color: '#aaa' }}>⠿</span>
            <select value={f.type} onChange={e => updateField(idx, { type: e.target.value })} style={{ border: 'none', background: 'transparent', fontSize: 13, color: '#666' }}>
              {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input value={f.name} onChange={e => updateField(idx, { name: e.target.value })} placeholder="Field name" style={{ flex: 1, border: '1px solid var(--theme-border-tint2)', borderRadius: 6, padding: '5px 8px', fontSize: 13 }} />
            {f.required && <span style={{ color: '#e53e3e', fontWeight: 700 }}>*</span>}
            <span onClick={() => removeField(idx)} style={{ cursor: 'pointer', color: '#e53e3e' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </span>
          </div>
        ))}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button onClick={requestClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--theme-border-tint2)', background: '#fff', color: '#444', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={save} disabled={!form.name.trim() || saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !form.name.trim() ? 'var(--theme-primary-pale)' : 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: !form.name.trim() ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>

        {confirmingClose && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,40,0.45)', zIndex: 310, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ background: '#fff', borderRadius: 14, width: 380, padding: 26, textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⚙️</div>
              <h4 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 8px', color: 'var(--theme-text-strongest2)' }}>Discard your changes?</h4>
              <p style={{ fontSize: 13, color: '#777', margin: '0 0 20px' }}>Your changes haven't been saved, so you'll lose them if you navigate away.</p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                <button onClick={() => setConfirmingClose(false)} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--theme-border-tint2)', background: '#fff', color: '#444', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#e53e3e', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Discard changes</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomActions() {
  const [tab, setTab] = useState('active');
  const [actions, setActions] = useState([]);
  const [counts, setCounts] = useState({ activeCount: 0, archivedCount: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const load = async (status = tab) => {
    setLoading(true);
    setError('');
    try {
      const res = await customActionsAPI.getAll(status);
      setActions(res.data.actions);
      setCounts({ activeCount: res.data.activeCount, archivedCount: res.data.archivedCount });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load custom actions');
      setActions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(tab); }, [tab]);

  const filtered = actions.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) || a.code?.toLowerCase().includes(search.toLowerCase())
  );

  const archiveToggle = async (id) => {
    await customActionsAPI.archive(id);
    load(tab);
  };
  const remove = async (id) => {
    if (!window.confirm('Delete this custom action permanently?')) return;
    await customActionsAPI.delete(id);
    load(tab);
  };

  return (
    <div className="ca-shell" style={{ padding: 24, maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        @media (max-width: 640px) {
          .ca-shell { padding: 14px !important; }
          .ca-shell [style*="grid-template-columns"] { grid-template-columns: 1fr !important; }
          .ca-shell div[style*="display: flex"] { flex-wrap: wrap; row-gap: 6px; }
        }
      `}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--theme-text-strongest2)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          Custom actions
        </h2>
        <button onClick={() => { setEditTarget(null); setDrawerOpen(true); }} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
          + Add a new action
        </button>
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search custom action by name or code"
        style={{ width: '100%', padding: '10px 14px', border: '1px solid var(--theme-border-tint2)', borderRadius: 8, fontSize: 13.5, marginBottom: 8, boxSizing: 'border-box' }}
      />
      <p style={{ fontSize: 12.5, color: '#999', margin: '0 0 14px' }}>{filtered.length} actions found</p>

      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid #eee', marginBottom: 14 }}>
        {['active', 'archived'].map(t => (
          <span
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 2px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              color: tab === t ? 'var(--theme-primary-mid)' : '#888',
              borderBottom: tab === t ? '2px solid var(--theme-primary-mid)' : '2px solid transparent',
            }}
          >
            {t === 'active' ? 'Active' : `Archived (${counts.archivedCount})`}
          </span>
        ))}
      </div>

      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 18px', fontSize: 12.5, fontWeight: 700, color: '#666', background: 'var(--theme-surface-faint)' }}>
          <span>Name</span><span>Code</span><span>Score</span><span>View Leads</span><span></span>
        </div>
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: '#888' }}>Loading...</div>
        ) : error ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#e53e3e', marginBottom: 14, fontSize: 13.5 }}>{error}</p>
            <button onClick={() => load(tab)} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <p style={{ color: '#888', marginBottom: 14 }}>No action found!</p>
            {tab === 'active' && (
              <button onClick={() => { setEditTarget(null); setDrawerOpen(true); }} style={{ padding: '9px 18px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                + Add new action
              </button>
            )}
          </div>
        ) : (
          filtered.map(a => (
            <div key={a._id} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '12px 18px', fontSize: 13.5, borderTop: '1px solid var(--theme-surface-faint)', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: '#333' }}>{a.name}</span>
              <span style={{ color: '#888' }}>{a.code}</span>
              <span style={{ color: a.score > 0 ? '#16a34a' : a.score < 0 ? '#e53e3e' : '#888' }}>{a.score}</span>
              <span style={{ color: 'var(--theme-primary-mid)', cursor: 'pointer', fontWeight: 600 }}>{a.usageCount || 0}</span>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <span onClick={() => { setEditTarget(a); setDrawerOpen(true); }} style={{ cursor: 'pointer', color: 'var(--theme-primary-mid)' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </span>
                <span onClick={() => archiveToggle(a._id)} title={tab === 'active' ? 'Archive' : 'Unarchive'} style={{ cursor: 'pointer', color: '#888' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
                </span>
                <span onClick={() => remove(a._id)} style={{ cursor: 'pointer', color: '#e53e3e' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {drawerOpen && (
        <ActionDrawer
          action={editTarget}
          onClose={() => setDrawerOpen(false)}
          onSaved={() => { setDrawerOpen(false); load(tab); }}
        />
      )}
    </div>
  );
}