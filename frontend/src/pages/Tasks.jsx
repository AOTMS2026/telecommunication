import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { followupsAPI, leadsAPI, usersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { formatISTDateTime } from '../utils/dateFormat';

const PURPLE = '#5b3fc7';
const PURPLE_LIGHT = '#f0ecff';
const TEXT_MAIN = '#2d2d6b';
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

// ── Edit Modal ────────────────────────────────────────────────────────────────
function EditModal({ task, onClose, onSaved }) {
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
          <h3 style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, margin: 0 }}>Edit Follow-up</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: TEXT_MUTED, lineHeight: 1 }}>×</button>
        </div>

        {task.lead?.name && (
          <div style={{ background: '#f5f3ff', borderRadius: 10, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: PURPLE, fontWeight: 600 }}>
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
              style={{ width: '100%', border: '1px solid #e5e2f5', borderRadius: 10, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Due Date & Time</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="date"
                value={form.scheduledAt ? form.scheduledAt.slice(0, 10) : ''}
                onChange={e => {
                  const timePart = form.scheduledAt ? form.scheduledAt.slice(11, 16) : '09:00';
                  setForm(f => ({ ...f, scheduledAt: e.target.value + 'T' + timePart }));
                }}
                style={{ flex: 1, border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                type="time"
                value={form.scheduledAt ? form.scheduledAt.slice(11, 16) : ''}
                onChange={e => {
                  const datePart = form.scheduledAt ? form.scheduledAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
                  setForm(f => ({ ...f, scheduledAt: datePart + 'T' + e.target.value }));
                }}
                style={{ width: 110, border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Priority</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                style={{ width: '100%', border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}
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
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #e5e2f5', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: TEXT_MAIN }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
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
            border: `2px dashed ${file ? PURPLE : '#e5e2f5'}`, borderRadius: 12,
            padding: '24px 16px', textAlign: 'center', cursor: 'pointer',
            background: file ? PURPLE_LIGHT : '#faf9ff', transition: 'all 0.15s'
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
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #e5e2f5', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: TEXT_MAIN }}>
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: (uploading || !file) ? 0.6 : 1 }}
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f5f3ff', borderRadius: 10, padding: '9px 12px' }}>
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
                    style={{ width: '100%', border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                  {leadQuery.trim().length >= 2 && (
                    <div style={{ border: '1px solid #e5e2f5', borderRadius: 10, marginTop: 4, maxHeight: 160, overflowY: 'auto', background: '#fff', boxShadow: '0 4px 16px rgba(91,63,199,0.1)' }}>
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
                            onMouseEnter={e => e.currentTarget.style.background = '#faf9ff'}
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
              style={{ width: '100%', border: '1px solid #e5e2f5', borderRadius: 10, padding: '10px 12px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box' }}
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
                style={{ flex: 1, border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
              <input
                type="time"
                value={scheduledAt ? scheduledAt.slice(11, 16) : ''}
                onChange={e => {
                  const datePart = scheduledAt ? scheduledAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
                  setScheduledAt(datePart + 'T' + e.target.value);
                }}
                style={{ width: 110, border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Priority</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              style={{ width: '100%', border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {canAssign && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Assigned To</label>
                <select
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}
                >
                  {users.map(u => (
                    <option key={u._id} value={u._id}>
                      {u.name}{u._id === currentUser?._id ? ' (You)' : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: TEXT_MUTED, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Assigned By</label>
                <select
                  value={assignedBy}
                  onChange={e => setAssignedBy(e.target.value)}
                  style={{ width: '100%', border: '1px solid #e5e2f5', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}
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
          <button onClick={onClose} style={{ flex: 1, padding: '10px', border: '1px solid #e5e2f5', borderRadius: 10, background: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: TEXT_MAIN }}>Cancel</button>
          <button
            onClick={handleCreate}
            disabled={saving}
            style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 10, background: PURPLE, color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}
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
  const [statusFilter, setStatusFilter] = useState(['pending', 'late', 'done', 'cancelled']);
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

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const isAll = statusFilter.length === 4; // all 4 options selected = no filter
      const wantsLate = statusFilter.includes('late');
      const wantsPending = statusFilter.includes('pending');
      const wantsDone = statusFilter.includes('done');
      const wantsCancelled = statusFilter.includes('cancelled');

      // Build DB-level statuses to fetch
      const dbStatuses = [];
      if (wantsPending || wantsLate) dbStatuses.push('upcoming');
      if (wantsDone) dbStatuses.push('done');
      if (wantsCancelled) dbStatuses.push('cancelled');

      const res = await followupsAPI.getAll({
        forMe: forFilter === 'Me',
        due: dueFilter ? dueFilter.toLowerCase().replace(' ', '_') : undefined,
        status: isAll ? undefined : dbStatuses.join(','),
        type: activeTab === 'Call Followups' ? 'call_followup' : 'todo',
        ...(teamMemberFilter ? { callerId: teamMemberFilter } : {}),
      });
      let items = res.data.followups || res.data.tasks || [];

      // Refine upcoming into pending vs late on the frontend
      if (!isAll) {
        if (wantsLate && !wantsPending) {
          items = items.filter(t =>
            (t.status === 'done' && wantsDone) ||
            (t.status === 'cancelled' && wantsCancelled) ||
            (t.status === 'upcoming' && new Date(t.scheduledAt) < new Date())
          );
        } else if (wantsPending && !wantsLate) {
          items = items.filter(t =>
            (t.status === 'done' && wantsDone) ||
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
  }, [activeTab, forFilter, dueFilter, statusFilter.join(','), priorityFilter, teamMemberFilter]);

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
    setTasks(prev => prev.map(t => t._id === updated._id ? { ...t, ...updated } : t));
    setEditingTask(null);
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
            border: '1.5px solid #e5e2f5', background: '#fff', color: PURPLE,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, borderBottom: '2px solid #e5e2f5', marginBottom: 20 }}>
        {['Call Followups', 'Todo'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '9px 20px', border: 'none', background: 'none',
              cursor: 'pointer', fontSize: 13, fontWeight: 600,
              color: activeTab === tab ? PURPLE : TEXT_MUTED,
              borderBottom: activeTab === tab ? `2px solid ${PURPLE}` : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 7
            }}
          >
            {tab}

          </button>
        ))}
      </div>

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
              background: forFilter === 'Me' ? PURPLE : '#f3f1fb',
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
                border: forFilter === 'Team' ? 'none' : '1px solid #e5e2f5',
                background: forFilter === 'Team' ? PURPLE : '#f3f1fb',
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
                background: '#fff', border: '1px solid #e5e2f5', borderRadius: 10,
                boxShadow: '0 8px 24px rgba(91,63,199,0.13)', minWidth: 180, padding: '6px 0'
              }}>
                <div
                  onClick={() => { setTeamMemberFilter(''); setShowTeamDrop(false); }}
                  style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: !teamMemberFilter ? PURPLE : TEXT_MAIN, fontWeight: !teamMemberFilter ? 700 : 400, background: !teamMemberFilter ? '#f5f3ff' : 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                  onMouseLeave={e => e.currentTarget.style.background = !teamMemberFilter ? '#f5f3ff' : 'transparent'}
                >All Members</div>
                {teamUsers.map(u => (
                  <div
                    key={u._id}
                    onClick={() => { setTeamMemberFilter(u._id); setShowTeamDrop(false); }}
                    style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', color: teamMemberFilter === u._id ? PURPLE : TEXT_MAIN, fontWeight: teamMemberFilter === u._id ? 700 : 400, background: teamMemberFilter === u._id ? '#f5f3ff' : 'transparent', display: 'flex', alignItems: 'center', gap: 8 }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f5f3ff'}
                    onMouseLeave={e => e.currentTarget.style.background = teamMemberFilter === u._id ? '#f5f3ff' : 'transparent'}
                  >
                    <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#f0ecff', color: PURPLE, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {u.name.slice(0,2).toUpperCase()}
                    </div>
                    {u.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ width: 1, height: 20, background: '#e5e2f5' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>Due:</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            border: `1px solid ${dueFilter ? PURPLE : '#e5e2f5'}`, borderRadius: 6,
            background: dueFilter ? '#f0ecff' : '#fff', padding: '5px 10px', cursor: 'pointer',
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

        <div style={{ width: 1, height: 20, background: '#e5e2f5' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>Status:</span>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 5,
            border: `1px solid ${statusFilter.length < 4 ? PURPLE : '#e5e2f5'}`,
            borderRadius: 6,
            background: statusFilter.length < 4 ? '#f0ecff' : '#fff',
            padding: '5px 10px', cursor: 'pointer',
          }}>
            <select
              value={statusFilter.length === 1 ? statusFilter[0] : statusFilter.length === 4 ? 'all' : 'custom'}
              onChange={e => {
                const val = e.target.value;
                if (val === 'all') setStatusFilter(['pending', 'late', 'done', 'cancelled']);
                else if (val === 'pending') setStatusFilter(['pending']);
                else if (val === 'late') setStatusFilter(['late']);
                else if (val === 'done') setStatusFilter(['done']);
                else if (val === 'cancelled') setStatusFilter(['cancelled']);
              }}
              style={{ border: 'none', outline: 'none', background: 'none', fontSize: 12, color: statusFilter.length < 4 ? PURPLE : TEXT_MAIN, cursor: 'pointer', fontWeight: statusFilter.length < 4 ? 600 : 400 }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">⏳ Upcoming</option>
              <option value="late">🔴 Late / Overdue</option>
              <option value="done">✅ Done</option>
              <option value="cancelled">❌ Cancelled</option>
            </select>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>
        </div>

        <div ref={additionalRef} style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <span style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 500 }}>Additional Filters:</span>
          <button
            onClick={() => setShowAdditional(p => !p)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              border: `1.5px solid ${(showAdditional || priorityFilter) ? PURPLE : '#e5e2f5'}`,
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
              background: '#fff', border: '1px solid #e5e2f5', borderRadius: 12,
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

        {/* NEW TASK — text button beside Upload */}
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            background: PURPLE, border: 'none', borderRadius: 7, cursor: 'pointer',
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
      <div style={{ background: '#fff', border: '1px solid #e5e2f5', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #f0ecff' }}>
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
                    background: col.highlight ? '#f3f1fb' : 'transparent',
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
                  <div style={{ width: 24, height: 24, border: `3px solid ${PURPLE}`, borderTopColor: 'transparent', borderRadius: '50%', margin: '0 auto', animation: 'spin 0.7s linear infinite' }} />
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
                  onMouseEnter={e => e.currentTarget.style.background = '#faf9ff'}
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
                  <td style={{ padding: '12px 16px', background: '#faf9ff', fontSize: 12, color: TEXT_MAIN }}>
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
                      {/* Edit */}
                      <button
                        title="Edit"
                        onClick={() => setEditingTask(task)}
                        style={{ background: 'none', border: '1px solid #e5e2f5', borderRadius: 6, padding: '4px 7px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => e.currentTarget.style.borderColor = PURPLE}
                        onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e2f5'}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {/* Delete — only for admin / admin */}
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