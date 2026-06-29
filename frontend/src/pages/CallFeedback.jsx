import { useState, useEffect, useRef } from 'react';
import { callFeedbackAPI } from '../services/api';

export default function CallFeedback() {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [menuFor, setMenuFor] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const dragItem = useRef(null);
  const menuRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await callFeedbackAPI.get();
      setConfig(res.data.config);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load call feedback settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuFor(null); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading...</div>;

  if (error || !config) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ color: '#e53e3e', marginBottom: 14, fontSize: 13.5 }}>{error || 'Something went wrong while loading.'}</p>
      <button onClick={load} style={{ padding: '9px 20px', borderRadius: 8, border: 'none', background: 'var(--theme-primary-mid)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Retry</button>
    </div>
  );

  const statuses = [...config.statuses].filter(s => !s.archived).sort((a, b) => a.order - b.order);

  const confirmAdd = async () => {
    if (!newName.trim()) { setAdding(false); return; }
    const res = await callFeedbackAPI.addStatus(newName.trim());
    setConfig(res.data.config);
    setNewName('');
    setAdding(false);
  };

  const saveEdit = async (id) => {
    if (editName.trim()) {
      const res = await callFeedbackAPI.updateStatus(id, editName.trim());
      setConfig(res.data.config);
    }
    setEditingId(null);
  };

  const setDefault = async (id) => {
    const res = await callFeedbackAPI.setDefault(id);
    setConfig(res.data.config);
    setMenuFor(null);
  };

  const archive = async (id) => {
    const res = await callFeedbackAPI.archiveStatus(id, true);
    setConfig(res.data.config);
    setMenuFor(null);
  };

  const onDrop = async (targetId) => {
    const ids = statuses.map(s => s._id);
    const from = ids.indexOf(dragItem.current);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1 || from === to) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    const res = await callFeedbackAPI.reorder(ids);
    setConfig(res.data.config);
  };

  return (
    <div style={{ padding: 24, maxWidth: 700 }}>
      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--theme-text-strongest2)', margin: '0 0 8px' }}>Call Feedback</h2>
        <p style={{ fontSize: 13.5, color: '#777', margin: 0, lineHeight: 1.5 }}>
          Automatically <span style={{ color: 'var(--theme-primary-mid)', fontWeight: 600 }}>default</span> status is assigned if call duration &gt; {config.minConnectedDuration}s.<br />
          However you can update anytime.
        </p>
      </div>

      <div style={{ background: '#fff', border: '1px solid #eee', borderRadius: 12, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--theme-text-strongest2)' }}>Available status ({statuses.length})</span>
          <span onClick={() => setAdding(true)} style={{ cursor: 'pointer', color: 'var(--theme-primary-mid)' }} title="Add status">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
          </span>
        </div>

        {statuses.map(s => (
          <div
            key={s._id}
            draggable
            onDragStart={() => { dragItem.current = s._id; }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(s._id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', marginBottom: 8, background: 'var(--theme-surface-faint)', borderRadius: 8, cursor: 'grab' }}
          >
            <span style={{ color: '#aaa' }}>⠿</span>
            {editingId === s._id ? (
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onBlur={() => saveEdit(s._id)}
                onKeyDown={e => { if (e.key === 'Enter') saveEdit(s._id); if (e.key === 'Escape') setEditingId(null); }}
                style={{ flex: 1, border: '1px solid var(--theme-primary-pale2)', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}
              />
            ) : (
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: '#333', letterSpacing: 0.3 }}>{s.name}</span>
            )}
            {s.isDefault && <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', background: 'var(--theme-primary-mid)', borderRadius: 20, padding: '2px 10px' }}>default</span>}

            <div style={{ position: 'relative' }}>
              <span onClick={() => setMenuFor(menuFor === s._id ? null : s._id)} style={{ cursor: 'pointer', color: '#999', padding: 4 }}>⋮</span>
              {menuFor === s._id && (
                <div ref={menuRef} style={{ position: 'absolute', right: 0, top: 24, background: '#fff', border: '1px solid #eee', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', width: 170, zIndex: 50, padding: '6px 0' }}>
                  <div onClick={() => setDefault(s._id)} style={{ padding: '8px 14px', fontSize: 13, color: '#333', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-surface-faint8)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Set default</div>
                  <div
                    onClick={() => { if (!s.isSystem) { setEditingId(s._id); setEditName(s.name); setMenuFor(null); } }}
                    style={{ padding: '8px 14px', fontSize: 13, color: s.isSystem ? '#bbb' : '#333', cursor: s.isSystem ? 'default' : 'pointer' }}
                    onMouseEnter={e => { if (!s.isSystem) e.currentTarget.style.background = 'var(--theme-surface-faint8)'; }}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    Edit
                    {s.isSystem && <div style={{ fontSize: 10.5, color: '#bbb' }}>can't edit system generated</div>}
                  </div>
                  <div onClick={() => archive(s._id)} style={{ padding: '8px 14px', fontSize: 13, color: '#e53e3e', cursor: 'pointer' }} onMouseEnter={e => e.currentTarget.style.background = '#fff5f5'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>Archive</div>
                </div>
              )}
            </div>
          </div>
        ))}

        {adding && (
          <div style={{ position: 'relative' }}>
            <input
              autoFocus
              maxLength={20}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') confirmAdd(); if (e.key === 'Escape') { setAdding(false); setNewName(''); } }}
              placeholder="e.g. Not Answered"
              style={{ width: '100%', padding: '12px 80px 12px 14px', border: '1.5px solid var(--theme-primary-mid)', borderRadius: 8, fontSize: 13.5, boxSizing: 'border-box' }}
            />
            <span style={{ position: 'absolute', right: 46, top: 13, fontSize: 12, color: '#aaa' }}>{20 - newName.length}</span>
            <span onClick={confirmAdd} style={{ position: 'absolute', right: 22, top: 11, cursor: 'pointer', color: 'var(--theme-primary-mid)' }}>✓</span>
            <span onClick={() => { setAdding(false); setNewName(''); }} style={{ position: 'absolute', right: -2, top: -2, cursor: 'pointer', color: '#e53e3e', background: '#fff', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, border: '1px solid #e53e3e' }}>✕</span>
          </div>
        )}
      </div>
    </div>
  );
}