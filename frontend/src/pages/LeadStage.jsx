import { useState, useEffect, useRef } from 'react';
import { leadStagesAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

const COLOR_OPTIONS = [
  '#94a3b8', '#f6c453', '#60a5fa', '#c084fc', '#f87171', '#fb923c',
  '#818cf8', '#a78bfa', '#38bdf8', '#facc15', '#22c55e', '#ef4444', '#14b8a6', '#ec4899',
];

function AddStatusModal({ stage, onClose, onSave }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_OPTIONS[2]);
  const [showColors, setShowColors] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), color, stage });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,15,40,0.45)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 14, width: 480, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: '#1f1f3d', margin: 0 }}>Add Status</h3>
          <span onClick={onClose} style={{ cursor: 'pointer', color: '#888', fontSize: 18 }}>✕</span>
        </div>
        <label style={{ fontSize: 13, color: '#444', fontWeight: 500 }}>Status name</label>
        <div style={{ position: 'relative', marginTop: 6, marginBottom: 18 }}>
          <input
            autoFocus
            value={name}
            maxLength={40}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Not Answered"
            style={{ width: '100%', padding: '10px 50px 10px 12px', border: '1px solid #e0ddf0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
          />
          <span style={{ position: 'absolute', right: 12, top: 11, fontSize: 12, color: '#aaa' }}>{40 - name.length}</span>
        </div>
        <label style={{ fontSize: 13, color: '#444', fontWeight: 500 }}>Choose Color</label>
        <div style={{ position: 'relative', marginTop: 6 }}>
          <div
            onClick={() => setShowColors(p => !p)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', border: '1px solid #e0ddf0', borderRadius: 8, cursor: 'pointer' }}
          >
            <span style={{ width: '100%', height: 22, background: color, borderRadius: 5 }} />
            <span style={{ marginLeft: 8, color: '#888' }}>▾</span>
          </div>
          {showColors && (
            <div style={{ position: 'absolute', top: 42, left: 0, right: 0, background: '#fff', border: '1px solid #e0ddf0', borderRadius: 8, padding: 10, display: 'flex', flexWrap: 'wrap', gap: 8, zIndex: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
              {COLOR_OPTIONS.map(c => (
                <span
                  key={c}
                  onClick={() => { setColor(c); setShowColors(false); }}
                  style={{ width: 26, height: 26, borderRadius: 6, background: c, cursor: 'pointer', border: c === color ? '2px solid #1f1f3d' : '2px solid transparent' }}
                />
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28 }}>
          <button onClick={onClose} style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid #e0ddf0', background: '#fff', color: '#444', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
          <button onClick={submit} disabled={!name.trim() || saving} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: !name.trim() ? '#c9bdf5' : '#7c5cf0', color: '#fff', fontWeight: 600, cursor: !name.trim() ? 'default' : 'pointer' }}>
            {saving ? 'Saving...' : 'Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusRow({ status, onEdit, onDelete, onSetDefault, dragHandlers, canEdit }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(status.name);

  const save = async () => {
    if (name.trim() && name.trim() !== status.name) await onEdit(status._id, { name: name.trim() });
    setEditing(false);
  };

  return (
    <div
      {...dragHandlers}
      style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', marginBottom: 8,
        background: status.color ? `${status.color}22` : '#f3f4f6', borderLeft: `4px solid ${status.color || '#94a3b8'}`,
        borderRadius: 8, cursor: 'grab',
      }}
    >
      <span style={{ color: '#999', fontSize: 13, letterSpacing: -1 }}>⠿</span>
      {editing ? (
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={save}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
          style={{ flex: 1, border: '1px solid #d8d4f0', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
        />
      ) : (
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: '#2d2d2d' }}>{status.name}</span>
      )}
      {status.isDefault && <span style={{ fontSize: 11, fontWeight: 700, color: '#7c5cf0', fontStyle: 'italic' }}>Default</span>}
      {!editing && canEdit && (
        <>
          <span onClick={() => setEditing(true)} title="Edit" style={{ cursor: 'pointer', color: '#7c5cf0' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </span>
          {!status.isSystem && (
            <span onClick={() => onDelete(status._id)} title="Delete" style={{ cursor: 'pointer', color: '#e53e3e' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default function LeadStage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'super admin';
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalStage, setModalStage] = useState(null);
  const [newReason, setNewReason] = useState('');
  const [showDeleted, setShowDeleted] = useState(false);
  const dragItem = useRef(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await leadStagesAPI.get();
      setConfig(res.data.config);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load lead stages');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  if (error || !config) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: '#e53e3e', marginBottom: 14, fontSize: 13.5 }}>{error || 'Something went wrong while loading.'}</p>
      <button onClick={load} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: '#7c5cf0', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  const byStage = (stage) => config.statuses.filter(s => s.stage === stage && !s.archived).sort((a, b) => a.order - b.order);
  const initial = byStage('initial');
  const active = byStage('active');
  const won = byStage('closed_won');
  const lost = byStage('closed_lost');
  const archivedCount = config.statuses.filter(s => s.archived).length;

  const addStatus = async (data) => {
    const res = await leadStagesAPI.addStatus(data);
    setConfig(res.data.config);
  };
  const editStatus = async (id, data) => {
    const res = await leadStagesAPI.updateStatus(id, data);
    setConfig(res.data.config);
  };
  const deleteStatus = async (id) => {
    if (!window.confirm('Delete this status? Leads using it will keep the label until reassigned.')) return;
    const res = await leadStagesAPI.deleteStatus(id);
    setConfig(res.data.config);
  };

  const addReason = async () => {
    if (!newReason.trim()) return;
    const res = await leadStagesAPI.addLostReason(newReason.trim());
    setConfig(res.data.config);
    setNewReason('');
  };
  const deleteReason = async (id) => {
    const res = await leadStagesAPI.deleteLostReason(id);
    setConfig(res.data.config);
  };

  const onDragStart = (id) => { dragItem.current = id; };
  const onDrop = async (stage, targetId) => {
    const items = byStage(stage);
    const ids = items.map(i => i._id);
    const from = ids.indexOf(dragItem.current);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const res = await leadStagesAPI.reorder({ stage, orderedIds: ids });
    setConfig(res.data.config);
  };

  const Column = ({ title, color, children, showAdd, onAdd }) => (
    <div style={{ flex: 1, minWidth: 280 }}>
      <div style={{ background: `${color}22`, borderRadius: '10px 10px 0 0', padding: '10px 16px', textAlign: 'center', border: `1px solid ${color}55` }}>
        <span style={{ fontWeight: 700, color, fontSize: 15 }}>{title}</span>
      </div>
      <div style={{ border: `1px solid ${color}33`, borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 14, minHeight: 80 }}>
        {showAdd && (
          <button onClick={onAdd} style={{ width: '100%', padding: '9px 0', marginBottom: 10, background: '#fff', border: '1px solid #e0ddf0', borderRadius: 8, color: '#7c5cf0', fontWeight: 600, cursor: 'pointer' }}>
            + Add
          </button>
        )}
        {children}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 1400 }}>
      <div style={{ marginBottom: 18 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: '#1f1f3d', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1f1f3d" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          Lead stages
        </h2>
        <p style={{ fontSize: 13, color: '#888', margin: '4px 0 0' }}>Configure Your Sales Pipeline</p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <Column title="Initial stage" color="#64748b">
          {initial.map(s => (
            <StatusRow key={s._id} status={s} onEdit={editStatus} onDelete={deleteStatus} canEdit={canEdit} />
          ))}
        </Column>

        <Column title="Active stage" color="#16a34a" showAdd={canEdit} onAdd={() => setModalStage('active')}>
          {active.map(s => (
            <div key={s._id} draggable onDragStart={() => onDragStart(s._id)} onDragOver={e => e.preventDefault()} onDrop={() => onDrop('active', s._id)}>
              <StatusRow status={s} onEdit={editStatus} onDelete={deleteStatus} canEdit={canEdit} />
            </div>
          ))}
        </Column>

        <div style={{ flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <div style={{ background: '#16a34a22', borderRadius: '10px 10px 0 0', padding: '8px 16px', border: '1px solid #16a34a55' }}>
              <span style={{ fontWeight: 700, color: '#16a34a', fontSize: 14 }}>Won</span>
            </div>
            <div style={{ border: '1px solid #16a34a33', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 12 }}>
              {won.map(s => <StatusRow key={s._id} status={s} onEdit={editStatus} onDelete={deleteStatus} canEdit={canEdit} />)}
            </div>
          </div>

          <div>
            <div style={{ background: '#ef444422', borderRadius: '10px 10px 0 0', padding: '8px 16px', border: '1px solid #ef444455' }}>
              <span style={{ fontWeight: 700, color: '#ef4444', fontSize: 14 }}>Lost</span>
            </div>
            <div style={{ border: '1px solid #ef444433', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: 12 }}>
              {lost.map(s => <StatusRow key={s._id} status={s} onEdit={editStatus} onDelete={deleteStatus} canEdit={canEdit} />)}

              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Reason for Lost leads ({config.lostReasons.length}/25)</span>
                  {canEdit && <span onClick={addReason} style={{ fontSize: 12, color: '#7c5cf0', fontWeight: 600, cursor: 'pointer' }}>+ Add</span>}
                </div>
                {canEdit && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
                    <input
                      value={newReason}
                      onChange={e => setNewReason(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addReason()}
                      placeholder="New reason..."
                      style={{ flex: 1, padding: '6px 10px', border: '1px solid #e0ddf0', borderRadius: 6, fontSize: 12.5 }}
                    />
                  </div>
                )}
                {config.lostReasons.map(r => (
                  <div key={r._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f5f3ff' }}>
                    <span style={{ color: '#bbb', fontSize: 12 }}>⠿</span>
                    <span style={{ flex: 1, fontSize: 13, color: '#333' }}>{r.name}</span>
                    {canEdit && (
                      <span onClick={() => deleteReason(r._id)} style={{ cursor: 'pointer', color: '#e53e3e' }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <span onClick={() => setShowDeleted(p => !p)} style={{ fontSize: 13, color: '#7c5cf0', fontWeight: 600, cursor: 'pointer' }}>
          Deleted statuses ({archivedCount}) {showDeleted ? '▴' : '▾'}
        </span>
        {showDeleted && (
          <div style={{ marginTop: 10, maxWidth: 400 }}>
            {config.statuses.filter(s => s.archived).map(s => (
              <div key={s._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: '#f7f6fb', borderRadius: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: '#666' }}>{s.name}</span>
                {canEdit && (
                  <button onClick={async () => { const res = await leadStagesAPI.archiveStatus(s._id, false); setConfig(res.data.config); }} style={{ fontSize: 12, color: '#7c5cf0', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Restore</button>
                )}
              </div>
            ))}
            {archivedCount === 0 && <p style={{ fontSize: 12, color: '#aaa' }}>No deleted statuses.</p>}
          </div>
        )}
      </div>

      {modalStage && canEdit && (
        <AddStatusModal stage={modalStage} onClose={() => setModalStage(null)} onSave={addStatus} />
      )}
    </div>
  );
}