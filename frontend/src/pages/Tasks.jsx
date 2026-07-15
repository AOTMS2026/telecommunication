import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { followupsAPI, leadsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatISTDateTime } from '../utils/dateFormat';

const PURPLE = '#0891b2';
const PURPLE_LIGHT = '#e0f7ff';
const GRADIENT = 'linear-gradient(90deg, #ffb37c 0%, #38bdf8 100%)';
const TEXT_MAIN = '#164e63';
const TEXT_MUTED = '#888';

const STATUS_COLORS = {
  upcoming: { bg: '#fff8e6', color: '#b45309' },
  pending:  { bg: '#fff8e6', color: '#b45309' },
  done:     { bg: '#e8f8f0', color: '#22a163' },
  late:     { bg: '#fff0f0', color: '#e53e3e' },
  cancelled:{ bg: '#f3f4f6', color: '#6b7280' },
};

const PRIORITY_COLORS = {
  high:   { bg: '#fff0f0', color: '#e53e3e' },
  medium: { bg: '#fff8e6', color: '#b45309' },
  low:    { bg: '#e8f8f0', color: '#22a163' },
};

// ── 12-hour Time Picker (hour / minute / AM-PM) ─────────────────────────────
// Native <input type="time"> renders in 24h format in most locales/browsers,
// so we build our own to guarantee an explicit AM/PM control.
function TimeInput12h({ value, onChange }) {
  // value / onChange operate on 24-hour "HH:MM" strings, same as before.
  const [hh24, mm] = value ? value.split(':') : ['09', '00'];
  const hh24Num = parseInt(hh24, 10) || 0;
  const period = hh24Num >= 12 ? 'PM' : 'AM';
  let hh12 = hh24Num % 12;
  if (hh12 === 0) hh12 = 12;

  const commit = (newHh12, newMm, newPeriod) => {
    let h = parseInt(newHh12, 10) % 12;
    if (newPeriod === 'PM') h += 12;
    const hhStr = String(h).padStart(2, '0');
    const mmStr = String(newMm).padStart(2, '0');
    onChange(`${hhStr}:${mmStr}`);
  };

  const selectStyle = {
    border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 8px',
    fontSize: 13, outline: 'none', background: '#fff', cursor: 'pointer'
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <select
        value={hh12}
        onChange={e => commit(e.target.value, mm, period)}
        style={{ ...selectStyle, width: 58 }}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
        ))}
      </select>
      <span style={{ color: TEXT_MUTED, fontWeight: 700 }}>:</span>
      <select
        value={mm}
        onChange={e => commit(hh12, e.target.value, period)}
        style={{ ...selectStyle, width: 58 }}
      >
        {Array.from({ length: 60 }, (_, i) => i).map(m => (
          <option key={m} value={String(m).padStart(2, '0')}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
      <div style={{ display: 'flex', border: '1px solid #bae6fd', borderRadius: 10, overflow: 'hidden' }}>
        {['AM', 'PM'].map(p => (
          <button
            type="button"
            key={p}
            onClick={() => commit(hh12, mm, p)}
            style={{
              border: 'none', padding: '9px 10px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              background: period === p ? GRADIENT : '#fff',
              color: period === p ? '#fff' : TEXT_MAIN,
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ task, onClose, onSaved, readOnly = false }) {
  const [form, setForm] = useState({
    note: task.note || task.description || '',
    scheduledAt: task.scheduledAt ? task.scheduledAt.slice(0, 16) : '',
    priority: task.priority || 'medium',
    status: task.status || 'upcoming',
    title: task.title || task.note || task.description || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (readOnly) return;
    setSaving(true);
    setError('');
    try {
      const update = {
        note: form.note,
        title: task.type === 'todo' ? form.note : (form.title || ''),
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
        priority: form.priority,
        status: form.status,
      };
      const res = await followupsAPI.update(task._id, update);
      onSaved(res.data.followup);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 40px rgba(91,63,199,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, margin: 0 }}>{readOnly ? 'View Task' : 'Edit Follow-up'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: TEXT_MUTED, lineHeight: 1 }}>×</button>
        </div>

        {readOnly && (
          <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 10, padding: '9px 14px', marginBottom: 16, fontSize: 12, color: '#9a5b13', fontWeight: 500 }}>
            👁 View only. You can mark this task complete, but only a manager or admin can edit its details.
          </div>
        )}

        {task.lead?.name && (
          <div style={{ background: '#e0f7ff', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: PURPLE, fontWeight: 600 }}>
            📞 {task.lead.name} — {task.lead.phone}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Description / Note</label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={3}
              disabled={readOnly}
              style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box', background: readOnly ? '#f9fafb' : '#fff', color: readOnly ? '#6b7280' : TEXT_MAIN }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Due Date & Time</label>
            <div style={{ display: 'flex', gap: 8, opacity: readOnly ? 0.6 : 1, pointerEvents: readOnly ? 'none' : 'auto' }}>
              <input
                type="date"
                value={form.scheduledAt ? form.scheduledAt.slice(0, 10) : ''}
                onChange={e => {
                  const timePart = form.scheduledAt ? form.scheduledAt.slice(11, 16) : '09:00';
                  setForm(f => ({ ...f, scheduledAt: e.target.value + 'T' + timePart }));
                }}
                disabled={readOnly}
                style={{ flex: 1, border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              <TimeInput12h
                value={form.scheduledAt ? form.scheduledAt.slice(11, 16) : '09:00'}
                onChange={time => {
                  const datePart = form.scheduledAt ? form.scheduledAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
                  setForm(f => ({ ...f, scheduledAt: datePart + 'T' + time }));
                }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                disabled={readOnly}
                style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', background: readOnly ? '#f9fafb' : '#fff', color: readOnly ? '#6b7280' : TEXT_MAIN }}
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {error && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #bae6fd', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: TEXT_MAIN }}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: GRADIENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
function UploadModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setError('');
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please choose an Excel or CSV file first');
      return;
    }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await followupsAPI.import(formData);
      setResult({ count: res.data.count, total: res.data.total });
      onImported();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 460, padding: 24, boxShadow: '0 8px 40px rgba(91,63,199,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, margin: 0 }}>Upload Tasks</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: TEXT_MUTED, lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 12, color: TEXT_MUTED, margin: '0 0 18px' }}>
          Bulk-create follow-ups / to-dos from an Excel or CSV file. Expected columns: <b>Note/Description</b>, <b>Due Date</b>, <b>Priority</b>, <b>Phone</b> (optional, links to a lead) and <b>Type</b> (optional — call_followup or todo).
        </p>

        <div
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${file ? PURPLE : '#bae6fd'}`, borderRadius: 12,
            padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
            background: file ? PURPLE_LIGHT : '#f0fbff', transition: 'all 0.15s'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2" style={{ marginBottom: 8 }}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <div style={{ fontSize: 13, fontWeight: 600, color: file ? PURPLE : TEXT_MAIN }}>
            {file ? file.name : 'Click to choose a file'}
          </div>
          <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 3 }}>.xlsx, .xls or .csv</div>
        </div>

        {error && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 12 }}>{error}</p>}
        {result && (
          <p style={{ color: '#22a163', fontSize: 12, marginTop: 12, fontWeight: 600 }}>
            Imported {result.count} of {result.total} row{result.total === 1 ? '' : 's'} successfully.
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #bae6fd', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: TEXT_MAIN }}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: GRADIENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (uploading || !file) ? 0.6 : 1 }}
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Add Task Modal ────────────────────────────────────────────────────────────
function AddTaskModal({ type, onClose, onCreated }) {
  const { user: currentUser } = useAuth();
  const isCallFollowup = type === 'call_followup';
  // Allow Admins, Super Admins, and Callers to assign tasks
  const canAssign = !!currentUser;

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [priority, setPriority] = useState('medium');
  const [leadQuery, setLeadQuery] = useState('');
  const [leadResults, setLeadResults] = useState([]);
  const [selectedLead, setSelectedLead] = useState(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Recurrence — "None" keeps the old single-task behaviour. Any other
  // frequency needs an end date so we know how far out to generate tasks.
  const [repeatFrequency, setRepeatFrequency] = useState('none');
  const [repeatEndDate, setRepeatEndDate] = useState('');

  const [users, setUsers] = useState([]);
  const [assignedTo, setAssignedTo] = useState(currentUser?._id || '');
  const [assignedBy, setAssignedBy] = useState(currentUser?._id || '');

  // Load the user list for the Assigned To / Assigned By dropdowns (admins only)
  useEffect(() => {
    if (!canAssign) return;
    usersAPI.getAll()
      .then(res => setUsers(res.data.users || []))
      .catch((err) => {
        console.error('Failed to load users for assignment dropdown:', err);
        setUsers([]);
      });
  }, [canAssign]);

  // Who can be picked in "Assigned To":
  // - Super Admin (admin role) can assign to everyone
  // - Manager can only assign to callers (and themselves)
  // - Caller can only assign to themselves
  const assignableUsers = (() => {
    if (currentUser?.role === 'admin') return users;
    if (currentUser?.role === 'manager') {
      return users.filter(u => u.role === 'caller' || u._id === currentUser._id);
    }
    return users.filter(u => u._id === currentUser?._id);
  })();

  // If the currently selected assignee falls outside the allowed list
  // (e.g. role loaded after selection), snap back to the current user.
  useEffect(() => {
    if (!assignableUsers.length) return;
    if (!assignableUsers.some(u => u._id === assignedTo)) {
      setAssignedTo(currentUser?._id || assignableUsers[0]._id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // Debounced lead search — optional for Call Followups, just helps link a lead if you want
  useEffect(() => {
    if (!isCallFollowup || selectedLead || leadQuery.trim().length < 2) {
      setLeadResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await leadsAPI.getAll({ search: leadQuery.trim(), limit: 6 });
        setLeadResults(res.data.leads || []);
      } catch (err) {
        setLeadResults([]);
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [leadQuery, isCallFollowup, selectedLead]);

  const handleCreate = async () => {
    setError('');
    if (!scheduledAt) {
      setError('Please choose a due date & time');
      return;
    }
    if (repeatFrequency !== 'none' && !repeatEndDate) {
      setError('Please choose an end date for the repeating task');
      return;
    }
    if (repeatFrequency !== 'none' && new Date(repeatEndDate) < new Date(scheduledAt)) {
      setError('Repeat end date must be after the due date');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        title: !isCallFollowup ? note : '',
        note,
        scheduledAt: new Date(scheduledAt).toISOString(),
        priority,
      };
      // Lead is optional — only attach it if one was actually picked
      if (isCallFollowup && selectedLead) payload.lead = selectedLead._id;
      if (canAssign) {
        payload.assignedTo = assignedTo || currentUser._id;
        payload.assignedBy = assignedBy || currentUser._id;
      }
      // Recurrence — backend pre-generates one task per occurrence (e.g. one
      // per day) up to and including the end date, so the task reappears
      // fresh ("upcoming") on every scheduled day even after today's is done.
      if (repeatFrequency !== 'none') {
        payload.recurrence = {
          frequency: repeatFrequency,
          endDate: new Date(repeatEndDate + 'T23:59:59').toISOString(),
        };
      }
      const res = await followupsAPI.create(payload);
      onCreated(res.data.followup);  // notify parent first (sets forFilter / triggers fetch)
      onClose();                     // then close the modal
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, padding: 24, boxShadow: '0 8px 40px rgba(91,63,199,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, margin: 0 }}>
            Add {isCallFollowup ? 'Call Follow-up' : 'Task'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: TEXT_MUTED, lineHeight: 1 }}>×</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isCallFollowup && (
            <div style={{ position: 'relative' }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Lead (optional)</label>
              {selectedLead ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#e0f7ff', borderRadius: 10, padding: '9px 12px' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: PURPLE }}>{selectedLead.name}</div>
                    <div style={{ fontSize: 11, color: TEXT_MUTED }}>{selectedLead.phone}</div>
                  </div>
                  <span
                    onClick={() => { setSelectedLead(null); setLeadQuery(''); }}
                    style={{ cursor: 'pointer', color: TEXT_MUTED, fontWeight: 700, fontSize: 16 }}
                  >×</span>
                </div>
              ) : (
                <>
                  <input
                    value={leadQuery}
                    onChange={e => setLeadQuery(e.target.value)}
                    placeholder="Search lead by name or phone..."
                    style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                  {leadQuery.trim().length >= 2 && (
                    <div style={{ border: '1px solid #bae6fd', borderRadius: 10, marginTop: 4, maxHeight: 160, overflowY: 'auto', background: '#fff', boxShadow: '0 4px 16px rgba(91,63,199,0.1)' }}>
                      {searching ? (
                        <div style={{ padding: 10, fontSize: 12, color: TEXT_MUTED }}>Searching...</div>
                      ) : leadResults.length === 0 ? (
                        <div style={{ padding: 10, fontSize: 12, color: TEXT_MUTED }}>No leads found</div>
                      ) : (
                        leadResults.map(l => (
                          <div
                            key={l._id}
                            onClick={() => { setSelectedLead(l); setLeadResults([]); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: 13 }}
                            onMouseEnter={e => e.currentTarget.style.background = '#f0fbff'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                          >
                            <div style={{ fontWeight: 600, color: TEXT_MAIN }}>{l.name}</div>
                            <div style={{ fontSize: 11, color: TEXT_MUTED }}>{l.phone}</div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>
              {isCallFollowup ? 'Description / Note' : 'Task Title'}
            </label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder={isCallFollowup ? 'What should this call be about?' : 'What needs to be done?'}
              style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Due Date & Time</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                value={scheduledAt ? scheduledAt.slice(0, 10) : ''}
                onChange={e => {
                  const timePart = scheduledAt ? scheduledAt.slice(11, 16) : '09:00';
                  setScheduledAt(e.target.value + 'T' + timePart);
                }}
                style={{ flex: 1, border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              <TimeInput12h
                value={scheduledAt ? scheduledAt.slice(11, 16) : '09:00'}
                onChange={time => {
                  const datePart = scheduledAt ? scheduledAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
                  setScheduledAt(datePart + 'T' + time);
                }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Repeat</label>
            <select
              value={repeatFrequency}
              onChange={e => setRepeatFrequency(e.target.value)}
              style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}
            >
              <option value="none">Does not repeat</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
            {repeatFrequency !== 'none' && (
              <div style={{ marginTop: 8 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Repeat Until</label>
                <input
                  type="date"
                  value={repeatEndDate}
                  min={scheduledAt ? scheduledAt.slice(0, 10) : undefined}
                  onChange={e => setRepeatEndDate(e.target.value)}
                  style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                />
                <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 4 }}>
                  A fresh task will be created for each {repeatFrequency === 'daily' ? 'day' : repeatFrequency === 'weekly' ? 'week' : 'month'} up to this date — e.g. set it a month out for a daily task all through the month.
                </div>
              </div>
            )}
          </div>

          {canAssign && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Assigned To</label>
                <select
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}
                >
                  {assignableUsers.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name}{u._id === currentUser?._id ? ' (You)' : ''}
                    </option>
                  ))}
                </select>
                {currentUser?.role === 'manager' && (
                  <p style={{ fontSize: 10.5, color: TEXT_MUTED, margin: '4px 0 0' }}>Managers can assign tasks to callers or themselves.</p>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Assigned By</label>
                <select
                  value={assignedBy}
                  onChange={e => setAssignedBy(e.target.value)}
                  style={{ width: '100%', border: '1px solid #bae6fd', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}
                >
                  {users.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name}{u._id === currentUser?._id ? ' (You)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {error && <p style={{ color: '#e53e3e', fontSize: 12, marginTop: 10 }}>{error}</p>}

        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #bae6fd', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: TEXT_MAIN }}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: GRADIENT, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Creating...' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Download helper ───────────────────────────────────────────────────────────
function downloadCSV(tasks, tab) {
  const headers = ['Lead Name', 'Phone', 'Description', 'Assignee', 'Status', 'Due Date', 'Priority'];
  const rows = tasks.map(t => [
    t.lead?.name || '',
    t.lead?.phone || '',
    t.note || t.description || '',
    t.assignedTo?.name || '',
    t.status || '',
    t.scheduledAt ? formatISTDateTime(t.scheduledAt) : '',
    t.priority || '',
  ]);
  const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${tab.replace(/ /g, '_')}_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Tasks() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(() => {
    const tab = searchParams.get('tab');
    return tab || 'Call Followups';
  });

  // Sync tab when URL ?tab= changes (e.g. notification click while already on this page)
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && tab !== activeTab) {
      setActiveTab(tab);
    }
  }, [searchParams]);
  const [forFilter, setForFilter] = useState('Me');
  const [dueFilter, setDueFilter] = useState(null);
  // Completed ("done") tasks are no longer mixed into the active list — they
  // live under the History view instead (see historyMode below).
  const [statusFilter, setStatusFilter] = useState(['pending', 'late', 'cancelled']);
  const [historyMode, setHistoryMode] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdditional, setShowAdditional] = useState(false);
  const [priorityFilter, setPriorityFilter] = useState('');
  const [sortField, setSortField] = useState('dueDate');
  const [sortDir, setSortDir] = useState('asc');
  const [editingTask, setEditingTask] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deletingTaskId, setDeletingTaskId] = useState(null);
  const [descriptionPopup, setDescriptionPopup] = useState(null);
  const [teamUsers, setTeamUsers] = useState([]);
  const [teamMemberFilter, setTeamMemberFilter] = useState('');
  const [showTeamDrop, setShowTeamDrop] = useState(false);
  const teamDropRef = useRef(null);
  const { user: currentUser } = useAuth();
  const canDelete = currentUser?.role === 'manager' || currentUser?.role === 'admin';
  const [markingCompleteId, setMarkingCompleteId] = useState(null);

  // Callers never get edit rights on tasks — they can only view them (and
  // mark them complete via the checkmark action). Only managers/admins edit.
  const canEditTask = () => currentUser?.role !== 'caller';

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      // ── History view: only ever shows completed ("done") tasks ──────────
      if (historyMode) {
        const res = await followupsAPI.getAll({
          forMe: forFilter === 'Me',
          due: dueFilter ? dueFilter.toLowerCase().replace(' ', '_') : undefined,
          status: 'done',
          type: activeTab === 'Call Followups' ? 'call_followup' : 'todo',
          ...(teamMemberFilter ? { callerId: teamMemberFilter } : {}),
        });
        let items = res.data.followups || res.data.tasks || [];
        items = items.filter(t => t.status === 'done');
        if (priorityFilter) items = items.filter(t => t.priority === priorityFilter);
        setTasks(items);
        return;
      }

      const isAll = statusFilter.length === 3; // pending + late + cancelled selected = no filter
      const wantsLate = statusFilter.includes('late');
      const wantsPending = statusFilter.includes('pending');
      const wantsCancelled = statusFilter.includes('cancelled');

      // Build DB-level statuses to fetch — 'done' is intentionally excluded;
      // completed tasks only ever show up under History.
      const dbStatuses = [];
      if (wantsPending || wantsLate) dbStatuses.push('upcoming');
      if (wantsCancelled) dbStatuses.push('cancelled');

      const res = await followupsAPI.getAll({
        forMe: forFilter === 'Me',
        due: dueFilter ? dueFilter.toLowerCase().replace(' ', '_') : undefined,
        status: dbStatuses.join(','),
        type: activeTab === 'Call Followups' ? 'call_followup' : 'todo',
        ...(teamMemberFilter ? { callerId: teamMemberFilter } : {}),
      });
      let items = res.data.followups || res.data.tasks || [];
      // Safety net: never show completed tasks in the active view.
      items = items.filter(t => t.status !== 'done');

      // Refine upcoming into pending vs late on the frontend
      if (!isAll) {
        if (wantsLate && !wantsPending) {
          items = items.filter(t =>
            (t.status === 'cancelled' && wantsCancelled) ||
            (t.status === 'upcoming' && new Date(t.scheduledAt) < new Date())
          );
        } else if (wantsPending && !wantsLate) {
          items = items.filter(t =>
            (t.status === 'cancelled' && wantsCancelled) ||
            (t.status === 'upcoming' && new Date(t.scheduledAt) >= new Date())
          );
        }
      }

      if (priorityFilter) {
        items = items.filter(t => t.priority === priorityFilter);
      }
      setTasks(items);
    } catch (err) {
      console.error(err);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, forFilter, dueFilter, statusFilter.join(','), priorityFilter, teamMemberFilter, historyMode]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Load team members for dropdown (all roles)
  useEffect(() => {
    usersAPI.getAll().then(r => setTeamUsers(r.data.users || [])).catch(() => {});
  }, []);

  // Close team dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (teamDropRef.current && !teamDropRef.current.contains(e.target)) setShowTeamDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchTasksRef = useRef(fetchTasks);
  useEffect(() => { fetchTasksRef.current = fetchTasks; }, [fetchTasks]);
  const additionalRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (additionalRef.current && !additionalRef.current.contains(e.target)) setShowAdditional(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleStatus = (s) => {
    setStatusFilter(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const handleEditSaved = (updated) => {
    setTasks(prev => {
      // Task just got marked done while viewing the active list → it now
      // belongs in History, so drop it from here instead of leaving it in place.
      if (!historyMode && updated.status === 'done') {
        return prev.filter(t => t._id !== updated._id);
      }
      // Task got reopened while viewing History → it no longer belongs here.
      if (historyMode && updated.status !== 'done') {
        return prev.filter(t => t._id !== updated._id);
      }
      return prev.map(t => t._id === updated._id ? { ...t, ...updated } : t);
    });
    setEditingTask(null);
  };

  const handleMarkComplete = async (taskId) => {
    setMarkingCompleteId(taskId);
    try {
      await followupsAPI.update(taskId, { status: 'done' });
      // Completed tasks live under History, so drop it out of the active list.
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) {
      console.error('Failed to mark task complete:', err);
      alert(err.response?.data?.message || 'Failed to mark task complete');
    } finally {
      setMarkingCompleteId(null);
    }
  };

  const handleDelete = async (taskId) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      setDeletingTaskId(taskId);
      await followupsAPI.delete(taskId);
      setTasks(prev => prev.filter(t => t._id !== taskId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete task');
    } finally {
      setDeletingTaskId(null);
    }
  };

  const SortIcon = ({ field }) => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
      stroke={sortField === field ? PURPLE : '#ccc'} strokeWidth="2.5">
      {sortField === field && sortDir === 'asc'
        ? <polyline points="18 15 12 9 6 15"/>
        : <polyline points="6 9 12 15 18 9"/>}
    </svg>
  );

  return (
    <div style={{ padding: 24 }}>
      {/* Description popup for Todo */}
      {descriptionPopup && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setDescriptionPopup(null)}
        >
          <div
            style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480, padding: 28, boxShadow: '0 8px 40px rgba(91,63,199,0.18)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: TEXT_MAIN, margin: 0 }}>Task Description</h3>
              <button onClick={() => setDescriptionPopup(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: TEXT_MUTED, lineHeight: 1 }}>×</button>
            </div>
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{descriptionPopup}</p>
          </div>
        </div>
      )}

      {editingTask && (
        <EditModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={handleEditSaved}
          readOnly={!canEditTask(editingTask)}
        />
      )}

      {showUploadModal && (
        <UploadModal
          onClose={() => setShowUploadModal(false)}
          onImported={fetchTasks}
        />
      )}

      {showAddModal && (
        <AddTaskModal
          type={activeTab === 'Call Followups' ? 'call_followup' : 'todo'}
          onClose={() => setShowAddModal(false)}
          onCreated={(newTask) => {
            // Re-fetch the task list so the new task appears immediately.
            // We do NOT change forFilter here — if the user is on "Me" view
            // and created a task for themselves, it should show up right there.
            fetchTasksRef.current();
          }}
        />
      )}

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: TEXT_MAIN, display: 'flex', alignItems: 'center', gap: 8 }}>
            Tasks
          </div>
          <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 3 }}>
            Never miss a followup by creating task{' '}
            <span style={{ color: PURPLE, cursor: 'pointer', textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
              Learn More
            </span>
          </div>
        </div>

        {/* ADD — small + button, opens popup to create a single task */}
        <button
          onClick={fetchTasks}
          title="Refresh"
          style={{
            width: 30, height: 30, borderRadius: '50%',
            border: '1.5px solid #bae6fd', background: '#fff', color: PURPLE,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 1px 4px rgba(91,63,199,0.1)'
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2.5">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/>
          </svg>
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2px solid #bae6fd', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {['Call Followups', 'Todo'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setHistoryMode(false); }}
              style={{
                padding: '9px 20px', border: 'none', background: 'none',
                cursor: 'pointer', fontSize: 13, fontWeight: 600,
                color: (!historyMode && activeTab === tab) ? PURPLE : TEXT_MUTED,
                borderBottom: (!historyMode && activeTab === tab) ? `2px solid ${PURPLE}` : '2px solid transparent',
                marginBottom: -2, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* HISTORY — completed tasks move here instead of cluttering the active list */}
        <button
          onClick={() => setHistoryMode(p => !p)}
          title="View completed tasks"
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 16px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600,
            color: historyMode ? PURPLE : TEXT_MUTED,
            borderBottom: historyMode ? `2px solid ${PURPLE}` : '2px solid transparent',
            marginBottom: -2, transition: 'all 0.15s'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/>
          </svg>
          History
        </button>
      </div>

      {historyMode && (
        <div style={{ background: '#e8f8f0', border: '1px solid #bbf7d0', borderRadius: 10, padding: '9px 14px', marginBottom: 14, fontSize: 12, color: '#166534', fontWeight: 500 }}>
          ✅ Showing completed {activeTab === 'Call Followups' ? 'call follow-ups' : 'to-dos'}. Mark a task as "Upcoming" again from Edit to move it back to the active list.
        </div>
      )}

      {/* Filters bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
          </svg>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>For:</span>
          <button
            onClick={() => setForFilter('Me')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 11px', borderRadius: 6, border: 'none',
              background: forFilter === 'Me' ? GRADIENT : '#e0f7ff',
              color: forFilter === 'Me' ? '#fff' : TEXT_MAIN,
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={forFilter === 'Me' ? '#fff' : PURPLE} strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            Me
          </button>
          <div ref={teamDropRef} style={{ position: 'relative' }}>
            <button
              onClick={() => { setForFilter('Team'); setShowTeamDrop(p => !p); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 11px', borderRadius: 6,
                border: forFilter === 'Team' ? 'none' : '1px solid #bae6fd',
                background: forFilter === 'Team' ? GRADIENT : '#e0f7ff',
                color: forFilter === 'Team' ? '#fff' : TEXT_MAIN,
                fontSize: 12, fontWeight: 600, cursor: 'pointer'
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={forFilter === 'Team' ? '#fff' : PURPLE} strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              {teamMemberFilter ? (teamUsers.find(u => u._id === teamMemberFilter)?.name || 'Team') : 'Team'}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={forFilter === 'Team' ? '#fff' : '#aaa'} strokeWidth="2.5">
                <polyline points={showTeamDrop ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
              </svg>
            </button>
            {showTeamDrop && (
              <div style={{
                position: 'absolute', top: '110%', left: 0, zIndex: 300,
                background: '#fff', border: '1px solid #bae6fd', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(91,63,199,0.13)', minWidth: 180, padding: '6px 0'
              }}>
                <div
                  onClick={() => { setTeamMemberFilter(''); setShowTeamDrop(false); }}
                  style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: !teamMemberFilter ? PURPLE : TEXT_MAIN, fontWeight: !teamMemberFilter ? 700 : 400, background: !teamMemberFilter ? '#e0f7ff' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#e0f7ff'}
                  onMouseLeave={e => e.currentTarget.style.background = !teamMemberFilter ? '#e0f7ff' : 'transparent'}
                >All Members</div>
                {teamUsers.map(u => (
                  <div
                    key={u._id}
                    onClick={() => { setTeamMemberFilter(u._id); setShowTeamDrop(false); }}
                    style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: teamMemberFilter === u._id ? PURPLE : TEXT_MAIN, fontWeight: teamMemberFilter === u._id ? 700 : 400, background: teamMemberFilter === u._id ? '#e0f7ff' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#e0f7ff'}
                    onMouseLeave={e => e.currentTarget.style.background = teamMemberFilter === u._id ? '#e0f7ff' : 'transparent'}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#e0f7ff', color: PURPLE, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {u.name.slice(0,2).toUpperCase()}
                    </div>
                    {u.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: '#bae6fd' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>Due:</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            border: `1px solid ${dueFilter ? PURPLE : '#bae6fd'}`, borderRadius: 6,
            background: dueFilter ? '#e0f7ff' : '#fff', padding: '5px 10px', cursor: 'pointer',
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
              <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            <select
              value={dueFilter || ''}
              onChange={e => setDueFilter(e.target.value || null)}
              style={{ border: 'none', outline: 'none', background: 'none', fontSize: 12, color: dueFilter ? PURPLE : TEXT_MAIN, cursor: 'pointer', fontWeight: dueFilter ? 600 : 400 }}
            >
              <option value="">All</option>
              {['Today', 'Tomorrow', 'This Week', 'Overdue'].map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            {dueFilter && (
              <span onClick={(e) => { e.stopPropagation(); setDueFilter(null); }}
                style={{ cursor: 'pointer', color: PURPLE, fontWeight: 700, fontSize: 14, lineHeight: 1, marginLeft: 2 }}>×</span>
            )}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>

        {!historyMode && (
          <>
            <div style={{ width: 1, height: 20, background: '#bae6fd' }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>Status:</span>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                border: `1px solid ${statusFilter.length < 3 ? PURPLE : '#bae6fd'}`,
                borderRadius: 6,
                background: statusFilter.length < 3 ? '#e0f7ff' : '#fff',
                padding: '5px 10px', cursor: 'pointer',
              }}>
                <select
                  value={statusFilter.length === 1 ? statusFilter[0] : statusFilter.length === 3 ? 'all' : 'custom'}
                  onChange={e => {
                    const val = e.target.value;
                    if (val === 'all') setStatusFilter(['pending', 'late', 'cancelled']);
                    else if (val === 'pending') setStatusFilter(['pending']);
                    else if (val === 'late') setStatusFilter(['late']);
                    else if (val === 'cancelled') setStatusFilter(['cancelled']);
                  }}
                  style={{ border: 'none', outline: 'none', background: 'none', fontSize: 12, color: statusFilter.length < 3 ? PURPLE : TEXT_MAIN, cursor: 'pointer', fontWeight: statusFilter.length < 3 ? 600 : 400 }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">⏳ Upcoming</option>
                  <option value="late">🔴 Late / Overdue</option>
                  <option value="cancelled">❌ Cancelled</option>
                </select>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
            </div>
          </>
        )}

        <div ref={additionalRef} style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>Additional Filters:</span>
          <button
            onClick={() => setShowAdditional(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              border: `1.5px solid ${(showAdditional || priorityFilter) ? PURPLE : '#bae6fd'}`,
              borderRadius: 6, padding: '5px 11px',
              background: (showAdditional || priorityFilter) ? PURPLE_LIGHT : '#fff',
              color: (showAdditional || priorityFilter) ? PURPLE : TEXT_MAIN,
              fontSize: 12, fontWeight: 600, cursor: 'pointer'
            }}
          >
            {priorityFilter ? `Priority: ${priorityFilter}` : 'Select filters'}
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points={showAdditional ? '18 15 12 9 6 15' : '6 9 12 15 18 9'}/>
            </svg>
          </button>
          {priorityFilter && (
            <span onClick={() => setPriorityFilter('')}
              style={{ cursor: 'pointer', color: PURPLE, fontWeight: 700, fontSize: 14 }}>×</span>
          )}
          {showAdditional && (
            <div style={{
              position: 'absolute', top: '110%', left: 0, zIndex: 200,
              background: '#fff', border: '1px solid #bae6fd', borderRadius: 12,
              boxShadow: '0 8px 24px rgba(91,63,199,0.12)', padding: 16, minWidth: 220
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Filter by Priority</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {['', 'high', 'medium', 'low'].map(p => (
                  <div
                    key={p}
                    onClick={() => { setPriorityFilter(p); setShowAdditional(false); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 7, cursor: 'pointer',
                      background: priorityFilter === p ? PURPLE_LIGHT : 'transparent',
                      color: priorityFilter === p ? PURPLE : TEXT_MAIN,
                      fontWeight: priorityFilter === p ? 600 : 400, fontSize: 13,
                    }}
                  >
                    {p === '' ? (
                      <span style={{ fontSize: 13 }}>All Priorities</span>
                    ) : (
                      <>
                        <span style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: p === 'high' ? '#e53e3e' : p === 'medium' ? '#f59e0b' : '#22a163',
                          flexShrink: 0
                        }} />
                        <span style={{ textTransform: 'capitalize' }}>{p}</span>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1 }} />

        {!historyMode && (
          <>
            {/* NEW TASK — text button beside Upload */}
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: GRADIENT, border: 'none', borderRadius: 7, cursor: 'pointer',
                fontSize: 12, color: '#fff', fontWeight: 600, padding: '6px 12px'
              }}
              title="Create new task"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              New Task
            </button>

            {/* UPLOAD — bulk import tasks via Excel/CSV */}
            <button
              onClick={() => setShowUploadModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: PURPLE, fontWeight: 600
              }}
              title="Upload tasks from Excel/CSV"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Upload
            </button>
          </>
        )}

        {/* DOWNLOAD — exports real filtered data as CSV */}
        <button
          onClick={() => downloadCSV(tasks, activeTab)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: PURPLE, fontWeight: 600
          }}
          title="Download current list as CSV"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Download
        </button>
      </div>

      <div style={{ fontSize: 12, color: TEXT_MUTED, marginBottom: 12 }}>
        <span style={{ fontWeight: 700, color: TEXT_MAIN }}>{tasks.length}</span> matching tasks found
      </div>

      {/* Table */}
      <div style={{ background: '#fff', border: '1px solid #bae6fd', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e0f7ff' }}>
              {[
                ...(activeTab === 'Call Followups' ? [{ label: 'Lead', field: 'lead' }] : []),
                { label: 'Description', field: 'description' },
                { label: 'Assignee', field: 'assignee' },
                { label: 'Assigned By', field: 'assignedBy' },
                { label: 'Status', field: 'status' },
                { label: 'Due date', field: 'dueDate', highlight: !!dueFilter },
                { label: 'Priority', field: 'priority' },
                { label: 'Actions', field: null },
              ].map(col => (
                <th
                  key={col.label}
                  onClick={() => col.field && handleSort(col.field)}
                  style={{
                    padding: '11px 16px', textAlign: 'left',
                    fontSize: 12, fontWeight: 600,
                    color: sortField === col.field ? PURPLE : TEXT_MUTED,
                    background: col.highlight ? '#e0f7ff' : 'transparent',
                    cursor: col.field ? 'pointer' : 'default',
                    userSelect: 'none', whiteSpace: 'nowrap'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {col.label}
                    {col.field && col.field !== 'description' && col.field !== 'assignee' && col.field !== 'assignedBy' && (
                      <SortIcon field={col.field} />
                    )}
                    {col.field === 'dueDate' && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2.5">
                        <polyline points="8 9 12 5 16 9"/><polyline points="16 15 12 19 8 15"/>
                      </svg>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={activeTab === 'Call Followups' ? 8 : 7} style={{ padding: '48px 16px', textAlign: 'center' }}>
                  <div className="spinner-gradient" style={{ width: 24, height: 24, margin: '0 auto' }} />
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={activeTab === 'Call Followups' ? 8 : 7} style={{ padding: '80px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, color: '#ccc', fontWeight: 300, letterSpacing: 2 }}>No Tasks</div>
                </td>
              </tr>
            ) : (
              tasks.map((task, i) => (
                <tr key={task._id || i}
                  style={{ borderBottom: '1px solid #f9f8ff' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f0fbff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Lead — only for Call Followups */}
                  {activeTab === 'Call Followups' && (
                    <td style={{ padding: '12px 16px', fontSize: 13, color: TEXT_MAIN, fontWeight: 500 }}>
                      {task.lead?._id ? (
                        <div
                          onClick={() => navigate(`/leads/${task.lead._id}`)}
                          style={{ cursor: 'pointer' }}
                          title="Open lead profile"
                        >
                          <div style={{ fontWeight: 600, color: PURPLE, textDecoration: 'underline', textDecorationStyle: 'dotted' }}>
                            {task.lead.name}
                          </div>
                          <div style={{ fontSize: 11, color: TEXT_MUTED }}>{task.lead.phone}</div>
                        </div>
                      ) : (
                        <div style={{ fontWeight: 600 }}>—</div>
                      )}
                    </td>
                  )}
                  {/* Description — clickable popup for Todo */}
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#555', maxWidth: 220 }}>
                    {activeTab === 'Todo' ? (
                      <div
                        onClick={() => setDescriptionPopup(task.title || task.note || task.description || '')}
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer', color: PURPLE, fontWeight: 500, textDecoration: 'underline', textDecorationStyle: 'dotted' }}
                        title="Click to see full description"
                      >
                        {task.title || task.note || task.description || '—'}
                      </div>
                    ) : (
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.title || task.note || task.description || '—'}
                      </div>
                    )}
                  </td>
                  {/* Assignee */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: PURPLE_LIGHT, color: PURPLE,
                        fontSize: 11, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {(task.assignedTo?.name || task.assignee?.name || 'ME').slice(0, 2).toUpperCase()}
                      </div>
                      <span style={{ fontSize: 12, color: TEXT_MAIN }}>
                        {task.assignedTo?.name || task.assignee?.name || 'Me'}
                      </span>
                    </div>
                  </td>
                  {/* Assigned By */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {task.assignedBy?.name ? (
                        <>
                          <div style={{
                            width: 28, height: 28, borderRadius: '50%',
                            background: '#fef3c7', color: '#92400e',
                            fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                          }}>
                            {task.assignedBy.name.slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 12, color: TEXT_MAIN }}>{task.assignedBy.name}</span>
                        </>
                      ) : (
                        <span style={{ fontSize: 12, color: TEXT_MUTED }}>—</span>
                      )}
                    </div>
                  </td>
                  {/* Status */}
                  <td style={{ padding: '12px 16px' }}>
                    {(() => {
                      const isLate = task.status === 'upcoming' && new Date(task.scheduledAt) < new Date();
                      const displayStatus = isLate ? 'late' : task.status;
                      const displayLabel = isLate ? 'Late' : (task.status || 'upcoming');
                      return (
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10,
                          background: STATUS_COLORS[displayStatus]?.bg || '#f3f4f6',
                          color: STATUS_COLORS[displayStatus]?.color || TEXT_MUTED
                        }}>
                          {displayLabel}
                        </span>
                      );
                    })()}
                  </td>
                  {/* Due date */}
                  <td style={{ padding: '12px 16px', background: '#f0fbff', fontSize: 12, color: TEXT_MAIN }}>
                    {task.scheduledAt ? formatISTDateTime(task.scheduledAt) : '—'}
                  </td>
                  {/* Priority */}
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 10,
                      background: PRIORITY_COLORS[task.priority || 'low']?.bg || '#f3f4f6',
                      color: PRIORITY_COLORS[task.priority || 'low']?.color || TEXT_MUTED
                    }}>
                      {task.priority || 'low'}
                    </span>
                  </td>
                  {/* Actions */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {/* Edit / View — callers get view-only on tasks assigned to them by someone else */}
                      <button
                        title={canEditTask(task) ? 'Edit' : 'View only'}
                        onClick={() => setEditingTask(task)}
                        style={{ background: 'none', border: '1px solid #bae6fd', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = PURPLE}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#bae6fd'}
                      >
                        {canEditTask(task) ? (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                          </svg>
                        ) : (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                          </svg>
                        )}
                      </button>

                      {/* Mark Complete — moves the task straight to History */}
                      {!historyMode && (
                        <button
                          title="Mark as complete"
                          onClick={() => handleMarkComplete(task._id)}
                          disabled={markingCompleteId === task._id}
                          style={{ background: 'none', border: '1px solid #bbf7d0', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', transition: 'border-color 0.15s', opacity: markingCompleteId === task._id ? 0.5 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = '#22a163'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = '#bbf7d0'}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22a163" strokeWidth="2.5">
                            <polyline points="3 12 9 18 21 6"/>
                          </svg>
                        </button>
                      )}

                      {/* Delete — only for admin / manager */}
                      {canDelete && (
                        <button
                          title="Delete"
                          onClick={() => handleDelete(task._id)}
                          disabled={deletingTaskId === task._id}
                          style={{ background: 'none', border: '1px solid #fecaca', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', transition: 'border-color 0.15s', opacity: deletingTaskId === task._id ? 0.5 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = '#e53e3e'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = '#fecaca'}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" strokeWidth="2">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14H6L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4h6v2"/>
                          </svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}