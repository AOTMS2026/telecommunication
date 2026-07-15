import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Phone, PhoneOff, Mail, MapPin, Award, IndianRupee, Globe, User, Calendar, Tag, Star, Edit3, Save, X, Plus, Clock, MessageCircle, Copy, Check, Trash2, BookOpen, Zap, Sparkles } from 'lucide-react';
import { leadsAPI, campaignsAPI, usersAPI, coursesAPI, followupsAPI, blocklistAPI, leadStagesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../common/StatusBadge';
import RunCallIqModal from '../RunCallIqModal';
import { formatDistanceToNow, format } from 'date-fns';

const FALLBACK_STATUSES = ['Fresh', 'Connected', 'Call Not Responding', 'Call Back Later', 'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost'];
const SOURCES = ['Manual', 'Facebook', 'WhatsApp', 'Website', 'Excel', 'Referral'];
const MODES = ['Online', 'Offline', 'Hybrid'];

function fmtDuration(sec) {
  if (!sec) return '0s';
  const m = Math.floor(sec / 60); const s = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function CallTimer({ onStop }) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    ref.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(ref.current);
  }, []);
  return (
    <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm animate-pulse">
      <div className="w-3.5 h-3.5 bg-green-500 rounded-full animate-ping" />
      <div className="flex-1">
        <p className="text-xs font-semibold text-green-700 uppercase tracking-wider">Call in progress</p>
        <p className="text-2xl font-mono font-bold text-green-800">{fmtDuration(elapsed)}</p>
      </div>
      <button onClick={() => onStop(elapsed)} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm">
        <PhoneOff className="w-4 h-4" /> End Call
      </button>
    </div>
  );
}

function AddNoteModal({ onClose, onSubmit }) {
  const [note, setNote] = useState('');
  const [type, setType] = useState('note');
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-base">Add Note / Log Activity</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex gap-2 mb-4">
          {['note', 'whatsapp'].map(t => (
            <button key={t} onClick={() => setType(t)} className={`text-xs px-3 py-1.5 rounded-full capitalize font-semibold transition-all ${type === t ? 'bg-indigo-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{t}</button>
          ))}
        </div>
        <textarea className="input-field resize-none w-full border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm" rows={4} placeholder="Write details here..." value={note} onChange={e => setNote(e.target.value)} />
        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 rounded-xl py-2.5 font-semibold text-sm">Cancel</button>
          <button onClick={() => onSubmit(note, type)} className="btn-primary flex-1 rounded-xl py-2.5 font-semibold text-sm justify-center" disabled={!note.trim()}>Save Activity</button>
        </div>
      </div>
    </div>
  );
}

function LogCallModal({ lead, onClose, onSubmit }) {
  const [form, setForm] = useState({ callStatus: 'connected', duration: 0, note: '', transcript: '' });

  const handleSubmit = () => {
    const combinedNote = form.transcript.trim()
      ? `${form.note}${form.note ? '\n\n' : ''}Transcript:\n${form.transcript.trim()}`
      : form.note;
    onSubmit({ callStatus: form.callStatus, duration: form.duration, note: combinedNote });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 text-base">Log Call — {lead.name}</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Call Status</label>
            <select className="input-field w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.callStatus} onChange={e => setForm({ ...form, callStatus: e.target.value })}>
              <option value="connected">Connected</option>
              <option value="no_answer">No Answer</option>
              <option value="busy">Busy</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Duration (seconds)</label>
            <input type="number" className="input-field w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={form.duration} onChange={e => setForm({ ...form, duration: +e.target.value })} min={0} />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">Call Summary Note</label>
            <textarea className="input-field w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" rows={3} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Write call feedback notes..." />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1 block">
              Transcript <span className="text-gray-400 font-normal">(optional — enables Call IQ audit)</span>
            </label>
            <textarea className="input-field w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" rows={4} value={form.transcript} onChange={e => setForm({ ...form, transcript: e.target.value })} placeholder={"Paste or type the call transcript...\nAgent: Hello...\nCustomer: Hi..."} />
          </div>
        </div>
        <div className="flex gap-2.5 mt-5">
          <button onClick={onClose} className="btn-secondary flex-1 rounded-xl py-2.5 font-semibold text-sm">Cancel</button>
          <button onClick={handleSubmit} className="btn-primary flex-1 rounded-xl py-2.5 font-semibold text-sm justify-center">Save Call Log</button>
        </div>
      </div>
    </div>
  );
}

// ── Initiate Call Modal ───────────────────────────────────────────────────────
function InitiateCallModal({ lead, callers, currentUser, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const isCaller = currentUser?.role === 'caller';
  const [selectedCaller, setSelectedCaller] = useState(
    isCaller ? currentUser?._id : (lead?.assignedTo?._id || '')
  );

  const handleSend = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await leadsAPI.initiateCall(lead._id, selectedCaller || undefined);
      setResult({ success: true, message: res.data.message });
      if (onSuccess) onSuccess();
    } catch (err) {
      setResult({ success: false, message: err.response?.data?.message || 'Failed to send notification' });
    } finally {
      setLoading(false);
    }
  };

  const callersList = callers.filter(c => c.role === 'caller');

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-100">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                <path d="M16 5.3a5 5 0 0 1 0 6.4" stroke="#16a34a" strokeOpacity="0.6"/>
                <path d="M19 3a9 9 0 0 1 0 11" stroke="#16a34a" strokeOpacity="0.35"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-gray-900 text-base">📲 Initiate Call</h3>
              <p className="text-xs text-gray-500">Send notification to caller's mobile app</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Lead</p>
            <p className="font-bold text-gray-800 text-lg">{lead?.name}</p>
            <p className="text-gray-500 font-mono text-sm">{lead?.phone}</p>
            {lead?.assignedTo?.name && (
              <p className="text-xs text-indigo-600 font-semibold mt-1">Assigned to: {lead.assignedTo.name}</p>
            )}
          </div>

          {isCaller ? (
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3">
              <p className="text-indigo-700 text-sm font-semibold">
                📱 Sending to your mobile: <span className="font-bold">{currentUser?.name}</span>
              </p>
              <p className="text-indigo-500 text-xs mt-1">The notification will appear on your phone</p>
            </div>
          ) : callersList.length > 0 && (
            <div>
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5 block">Send notification to</label>
              <select
                value={selectedCaller}
                onChange={e => setSelectedCaller(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Assigned Caller ({lead?.assignedTo?.name || 'None'}) --</option>
                {callersList.map(c => (
                  <option key={c._id} value={c._id}>{c.name} ({c.email})</option>
                ))}
              </select>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
            <p className="text-blue-700 text-xs leading-relaxed">
              💡 The caller will receive a push notification on their mobile app showing this lead's name and phone number. They can tap it to call directly.
            </p>
          </div>

          {result && (
            <div className={`rounded-xl p-4 border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-sm font-semibold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                {result.success ? '✅ ' : '❌ '}{result.message}
              </p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm">
            {result?.success ? 'Close' : 'Cancel'}
          </button>
          {!result?.success && (
            <button
              onClick={handleSend}
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Sending...</>
              ) : (
                <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/><path d="M16 5.3a5 5 0 0 1 0 6.4" strokeOpacity="0.6"/><path d="M19 3a9 9 0 0 1 0 11" strokeOpacity="0.4"/></svg>Send Notification</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Callback Time Picker Modal ────────────────────────────────────────────────
function CallbackTimeModal({ lead, currentUser, onClose, onScheduled }) {
  const PRESETS = [
    { label: '5 min', minutes: 5 },
    { label: '10 min', minutes: 10 },
    { label: '15 min', minutes: 15 },
    { label: '30 min', minutes: 30 },
    { label: '1 hour', minutes: 60 },
    { label: '1 day', minutes: 1440 },
  ];
  const [selected, setSelected] = useState(null);
  const [manualDate, setManualDate] = useState('');
  const [manualTime, setManualTime] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const getScheduledAt = () => {
    if (selected !== null) return new Date(Date.now() + selected * 60000);
    if (manualDate && manualTime) return new Date(`${manualDate}T${manualTime}`);
    return null;
  };

  const handleSave = async () => {
    const scheduledAt = getScheduledAt();
    if (!scheduledAt || isNaN(scheduledAt.getTime())) {
      setError('Please select a time or enter a valid date/time.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await followupsAPI.create({
        lead: lead._id,
        assignedTo: lead.assignedTo?._id || currentUser?._id,
        scheduledAt: scheduledAt.toISOString(),
        type: 'call_followup',
        status: 'upcoming',
        note: note || ('Callback scheduled for ' + lead.name),
      });
      onScheduled(res.data.followup, scheduledAt);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule callback');
    } finally {
      setSaving(false);
    }
  };

  const scheduledAt = getScheduledAt();

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-orange-100 flex items-center justify-center">
              <Clock className="w-4 h-4 text-orange-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-base">Schedule Callback</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          For <strong>{lead.name}</strong> ({lead.phone}) — pick a time to be reminded to call back.
        </p>
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => { setSelected(p.minutes); setManualDate(''); setManualTime(''); }}
              className={`py-2 rounded-xl text-xs font-bold border transition-all ${selected === p.minutes ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Or set manually</p>
          <div className="flex gap-2">
            <input type="date" value={manualDate} min={new Date().toISOString().split('T')[0]}
              onChange={e => { setManualDate(e.target.value); setSelected(null); }}
              className="flex-1 border border-gray-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
            <input type="time" value={manualTime}
              onChange={e => { setManualTime(e.target.value); setSelected(null); }}
              className="flex-1 border border-gray-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>
        </div>
        <textarea
          className="w-full border border-gray-200 rounded-xl p-3 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 mb-4"
          rows={2} placeholder="Add a note (optional)..." value={note} onChange={e => setNote(e.target.value)}
        />
        {scheduledAt && !isNaN(scheduledAt.getTime()) && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-4 text-xs text-orange-700 font-semibold">
            Callback at: {scheduledAt.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
          </div>
        )}
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2.5">
          <button onClick={onClose} className="btn-secondary flex-1 rounded-xl py-2.5 font-semibold text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving || !scheduledAt || isNaN(scheduledAt?.getTime())}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Saving...' : 'Schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Schedule Demo Date Modal ──────────────────────────────────────────────────
function ScheduleDemoModal({ lead, onClose, onSave }) {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const [date, setDate] = useState(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
  const [time, setTime] = useState(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!date || !time) { setError('Please pick a date and time for the demo.'); return; }
    const demoScheduledDate = new Date(`${date}T${time}`);
    if (isNaN(demoScheduledDate.getTime())) { setError('Invalid date/time.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave(demoScheduledDate);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to schedule demo');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-purple-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-base">Schedule Demo</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          For <strong>{lead.name}</strong> ({lead.phone}) — pick when the demo will happen.
        </p>
        <div className="flex gap-2 mb-4">
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
          <input type="time" value={time} onChange={e => setTime(e.target.value)}
            className="flex-1 border border-gray-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-purple-400" />
        </div>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        <div className="flex gap-2.5">
          <button onClick={onClose} className="btn-secondary flex-1 rounded-xl py-2.5 font-semibold text-sm">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            {saving ? 'Saving...' : 'Schedule Demo'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── AI State Banner ───────────────────────────────────────────────────────────
// Shows a non-intrusive info strip when the lead is currently being handled
// by the AI engine (locked = actively calling; queued = waiting for a slot).
function AIStateBanner({ lead }) {
  const isLocked = lead?.aiLock?.expiresAt && new Date(lead.aiLock.expiresAt) > new Date();
  const isQueued = !isLocked && lead?.aiCallState === 'queued';

  if (!isLocked && !isQueued) return null;

  if (isLocked) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: '#f0fdf4', border: '1px solid #86efac',
        borderRadius: 10, padding: '8px 14px', margin: '0 0 4px',
      }}>
        {/* pulsing green dot */}
        <div style={{
          width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
          boxShadow: '0 0 0 3px #bbf7d0',
          animation: 'aibanner-pulse 1.5s infinite',
        }} />
        <style>{`@keyframes aibanner-pulse{0%,100%{box-shadow:0 0 0 0 #bbf7d0}50%{box-shadow:0 0 0 5px #bbf7d000}}`}</style>
        <div className="flex-1">
          <span className="text-xs font-bold text-green-800">🤖 AI is calling this lead right now</span>
          {lead.aiLock.lockedBy && lead.aiLock.lockedBy !== 'ai-engine' && (
            <span className="text-xs text-green-600 ml-2">· locked by {lead.aiLock.lockedBy}</span>
          )}
        </div>
        <span className="text-[10px] text-green-600 font-semibold whitespace-nowrap">
          Until {format(new Date(lead.aiLock.expiresAt), 'hh:mm a')}
        </span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: '#eff6ff', border: '1px solid #bfdbfe',
      borderRadius: 10, padding: '8px 14px', margin: '0 0 4px',
    }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      <span className="text-xs font-bold text-blue-800">Queued for AI callback</span>
      <span className="text-[10px] text-blue-500 ml-auto">Waiting for an available AI slot</span>
    </div>
  );
}

// ── Shared Lead Details Component ─────────────────────────────────────────────
export default function LeadDetailsPage({
  leadId,
  embedded = false,
  showBackButton = !embedded,
  backLabel = 'Back to Leads',
  onBack,
  onDeleted,
  onChange,
}) {
  const id = leadId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'admin';
  const isAdmin = user?.role === 'manager' || user?.role === 'admin';
  const isCaller = user?.role === 'caller';

  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [campaigns, setCampaigns] = useState([]);
  const [callers, setCallers] = useState([]);
  const [courses, setCourses] = useState([]);
  const [leadFollowups, setLeadFollowups] = useState([]);
  const [statuses, setStatuses] = useState(FALLBACK_STATUSES);

  const [isCalling, setIsCalling] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [showLogCallModal, setShowLogCallModal] = useState(false);
  const [runCallIqActivityId, setRunCallIqActivityId] = useState(null);
  const [showInitiateCallModal, setShowInitiateCallModal] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [copiedText, setCopiedText] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockEntryId, setBlockEntryId] = useState(null);
  const [blockingAction, setBlockingAction] = useState(false);

  const [activityFilter, setActivityFilter] = useState('all');

  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingInfo, setSavingInfo] = useState(false);

  const fetchLeadDetails = async () => {
    try {
      const [res, followupsRes] = await Promise.all([
        leadsAPI.getOne(id),
        followupsAPI.getAll({ leadId: id }),
      ]);
      setLead(res.data.lead);
      setLeadFollowups(followupsRes.data.followups || []);
      onChange?.(res.data.lead);
      const l = res.data.lead;
      setEditForm({
        name: l.name || '',
        phone: l.phone || '',
        alternatePhone: l.alternatePhone || '',
        email: l.email || '',
        status: l.status || 'Fresh',
        rating: l.rating || 0,
        leadSource: l.leadSource || 'Manual',
        courseInterest: l.courseInterest?._id || l.courseInterest || '',
        mode: l.mode || '',
        budget: l.budget > 0 ? l.budget : '',
        location: l.location || '',
        lastQualification: l.lastQualification || '',
        assignedTo: l.assignedTo?._id || '',
        campaign: l.campaign?._id || '',
      });
    } catch (err) {
      console.error('Failed to load lead details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeadDetails();
    campaignsAPI.getAll().then(res => setCampaigns(res.data.campaigns || [])).catch(console.error);
    coursesAPI.getAll().then(res => setCourses(res.data.courses || [])).catch(console.error);
    usersAPI.getAll().then(res => {
      setCallers((res.data.users || []).filter(u => u.role === 'caller' || u.role === 'manager' || u.role === 'admin'));
    }).catch(console.error);
    leadStagesAPI.get().then(res => {
      const active = (res.data.config?.statuses || [])
        .filter(s => !s.archived)
        .sort((a, b) => a.order - b.order)
        .map(s => s.name);
      if (active.length) setStatuses(active);
    }).catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!lead?.phone) return;
    blocklistAPI.check(lead.phone).then(res => {
      setIsBlocked(res.data.blocked);
      setBlockEntryId(res.data.entry?._id || null);
    }).catch(() => {});
  }, [lead?.phone]);

  const handleBlockToggle = async () => {
    setBlockingAction(true);
    try {
      if (isBlocked) {
        if (blockEntryId) await blocklistAPI.remove(blockEntryId);
        else await blocklistAPI.removeByPhone(lead.phone);
        if (lead.status === 'Blocked') {
          await leadsAPI.updateStatus(lead._id, { status: 'Fresh' });
          setLead(prev => prev ? { ...prev, status: 'Fresh' } : prev);
        }
        setIsBlocked(false);
        setBlockEntryId(null);
      } else {
        const res = await blocklistAPI.add({ phone: lead.phone, name: lead.name, reason: 'Blocked from lead profile' });
        setIsBlocked(true);
        setBlockEntryId(res.data.entry?._id || null);
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      if (err.response?.status === 400 && err.response?.data?.entry) {
        setIsBlocked(true);
        setBlockEntryId(err.response.data.entry._id);
      } else {
        alert(isBlocked ? 'Failed to unblock: ' + msg : 'Failed to block: ' + msg);
      }
    }
    setBlockingAction(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(''), 2000);
  };

  const handleToggleStar = async () => {
    try {
      const res = await leadsAPI.update(lead._id, { isStarred: !lead.isStarred });
      setLead(prev => ({ ...prev, isStarred: res.data.lead.isStarred }));
    } catch (err) { console.error(err); }
  };

  const handleStatusChange = async (newStatus) => {
    if (newStatus === 'Demo Scheduled') {
      setShowDemoModal(true);
      return;
    }
    try {
      const res = await leadsAPI.updateStatus(lead._id, { status: newStatus });
      setLead(res.data.lead);
      setEditForm(prev => ({ ...prev, status: newStatus }));
    } catch (err) { console.error(err); }
  };

  const handleScheduleDemo = async (demoScheduledDate) => {
    const res = await leadsAPI.updateStatus(lead._id, { status: 'Demo Scheduled', demoScheduledDate: demoScheduledDate.toISOString() });
    setLead(res.data.lead);
    setEditForm(prev => ({ ...prev, status: 'Demo Scheduled' }));
    setShowDemoModal(false);
  };

  const handleRatingChange = async (newRating) => {
    try {
      const res = await leadsAPI.update(lead._id, { rating: newRating });
      setLead(res.data.lead);
      setEditForm(prev => ({ ...prev, rating: newRating }));
    } catch (err) { console.error(err); }
  };

  const handleDeleteLead = async () => {
    if (!confirm('Are you sure you want to delete this lead? This action cannot be undone.')) return;
    try {
      await leadsAPI.delete(lead._id);
      if (onDeleted) onDeleted(); else navigate('/leads');
    } catch (err) { alert(err.response?.data?.message || 'Failed to delete lead'); }
  };

  const handleStartCall = () => { if (!isCalling) setIsCalling(true); };

  const handleCallEnded = async (duration) => {
    setIsCalling(false);
    setSavingInfo(true);
    try {
      await leadsAPI.logCall(lead._id, { duration, callStatus: 'connected', note: 'Autologged duration call' });
      await fetchLeadDetails();
    } catch (err) { console.error(err); }
    finally { setSavingInfo(false); }
  };

  const handleLogManualCall = async (form) => {
    setSavingInfo(true);
    try {
      await leadsAPI.logCall(lead._id, form);
      setShowLogCallModal(false);
      await fetchLeadDetails();
    } catch (err) { console.error(err); }
    finally { setSavingInfo(false); }
  };

  const handleCallbackScheduled = async (followup, scheduledAt) => {
    setShowCallbackModal(false);
    try {
      await leadsAPI.updateStatus(lead._id, { status: 'Call Back Later' });
      await fetchLeadDetails();
    } catch (err) { console.error(err); }
  };

  const handleAddNote = async (note, type) => {
    setSavingInfo(true);
    try {
      await leadsAPI.addNote(lead._id, { note, type });
      setShowNoteModal(false);
      await fetchLeadDetails();
    } catch (err) { console.error(err); }
    finally { setSavingInfo(false); }
  };

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setSavingInfo(true);
    try {
      const data = { ...editForm, budget: editForm.budget !== '' ? +editForm.budget : 0, assignedTo: editForm.assignedTo || null, campaign: editForm.campaign || null, courseInterest: editForm.courseInterest || null };
      const res = await leadsAPI.update(lead._id, data);
      setLead(res.data.lead);
      setIsEditingInfo(false);
    } catch (err) { alert(err.response?.data?.message || 'Failed to update lead profile information'); }
    finally { setSavingInfo(false); }
  };

  if (loading) {
    return (
      <div className={embedded ? 'h-full flex items-center justify-center bg-gray-50' : 'min-h-screen flex items-center justify-center bg-gray-50'}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 spinner-gradient" />
          <p className="text-gray-500 text-sm">Loading lead profile...</p>
        </div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className={embedded ? 'h-full flex items-center justify-center bg-gray-50 p-6' : 'min-h-screen flex items-center justify-center bg-gray-50 p-6'}>
        <div className="text-center bg-white p-8 rounded-2xl shadow-md max-w-sm">
          <X className="w-12 h-12 text-red-500 mx-auto mb-3" />
          <h3 className="font-bold text-gray-900 text-lg">Lead Not Found</h3>
          <p className="text-gray-500 text-sm mt-1">The lead you are trying to view does not exist or has been deleted.</p>
          {showBackButton && (
            <button onClick={() => (onBack ? onBack() : navigate('/leads'))} className="btn-primary mt-5 inline-flex items-center gap-1.5"><ArrowLeft className="w-4 h-4" /> {backLabel}</button>
          )}
        </div>
      </div>
    );
  }

  const activityIcon = (type) => {
    if (type === 'call') return <Phone className="w-4 h-4 text-green-600" />;
    if (type === 'whatsapp') return <MessageCircle className="w-4 h-4 text-green-500" />;
    if (type === 'status_change') return <Tag className="w-4 h-4 text-orange-600" />;
    if (type === 'api_call') return <Zap className="w-4 h-4 text-purple-600" />;
    return <Clock className="w-4 h-4 text-indigo-600" />;
  };

  // Derived AI state flags (used in multiple places below)
  const isAILocked = lead.aiLock?.expiresAt && new Date(lead.aiLock.expiresAt) > new Date();
  const isAIQueued = !isAILocked && lead.aiCallState === 'queued';

  return (
    <div className={embedded ? 'h-full bg-gray-50/50 overflow-y-auto' : 'min-h-screen bg-gray-50/50 pb-12'}>
      {/* Top Navigation Banner */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-40 backdrop-blur-md bg-white/95">
        <div className="flex items-center gap-4 min-w-0">
          {showBackButton && (
            <button onClick={() => (onBack ? onBack() : navigate('/leads'))} className="w-9 h-9 rounded-xl border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-all active:scale-95">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900 truncate">{lead.name}</h2>
              <button onClick={handleToggleStar} className="text-yellow-400 hover:scale-110 transition-transform active:scale-90">
                <Star className={`w-5 h-5 ${lead.isStarred ? 'fill-yellow-400' : 'text-gray-300'}`} />
              </button>
              {/* ── AI state badges in the header ── */}
              {isAILocked && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#dcfce7', color: '#15803d',
                  borderRadius: 20, padding: '2px 9px',
                  fontSize: 11, fontWeight: 700, border: '1px solid #86efac',
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  AI calling now
                </span>
              )}
              {isAIQueued && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  background: '#dbeafe', color: '#1d4ed8',
                  borderRadius: 20, padding: '2px 9px',
                  fontSize: 11, fontWeight: 700, border: '1px solid #93c5fd',
                }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                  Queued for AI
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 font-mono mt-0.5">{lead._id}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Initiate Call Button */}
          <button
            onClick={() => setShowInitiateCallModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
            title="Send call notification to mobile app"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.58 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 8.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
              <path d="M16 5.3a5 5 0 0 1 0 6.4" stroke="currentColor" strokeOpacity="0.7"/>
              <path d="M19 3a9 9 0 0 1 0 11" stroke="currentColor" strokeOpacity="0.5"/>
            </svg>
            <span className="hidden sm:inline">Initiate Call</span>
          </button>

          <select
            value={lead.status}
            onChange={e => handleStatusChange(e.target.value)}
            className="text-xs font-semibold border border-indigo-200 rounded-xl px-3 py-2 bg-indigo-50/40 text-indigo-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all hover:bg-indigo-50"
          >
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {isAdmin && (
            <button onClick={handleDeleteLead} className="w-9 h-9 rounded-xl border border-red-200 hover:bg-red-50 text-red-500 flex items-center justify-center transition-all hover:text-red-700 active:scale-95" title="Delete Lead">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-4 space-y-6">
          <div className="card bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/40">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                <User className="w-4 h-4 text-indigo-600" /> Basic Information
              </h3>
              {!isEditingInfo ? (
                <button onClick={() => setIsEditingInfo(true)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-indigo-50">
                  <Edit3 className="w-3.5 h-3.5" /> Edit Info
                </button>
              ) : (
                <button onClick={() => setIsEditingInfo(false)} className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors flex items-center gap-1 py-1 px-2.5 rounded-lg hover:bg-red-50">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              )}
            </div>
            <form onSubmit={handleSaveInfo}>
              <div className="p-5 space-y-4">
                {isEditingInfo ? (
                  <div className="space-y-3.5">
                    {[
                      ['Full Name', 'name', 'text', true],
                      ['Phone Number', 'phone', 'text', true],
                      ['Alternate Phone', 'alternatePhone', 'text', false],
                      ['Email', 'email', 'email', false],
                      ['Location', 'location', 'text', false],
                      ['Last Qualification', 'lastQualification', 'text', false],
                    ].map(([label, field, type, required]) => {
                      const isPhoneField = field === 'phone';
                      const locked = isPhoneField && !isSuperAdmin;
                      return (
                        <div key={field}>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                            {label}{locked && <span className="normal-case font-medium text-gray-400"> (only Super Admin can edit)</span>}
                          </label>
                          <input
                            type={type}
                            className={`input-field w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${locked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''}`}
                            value={editForm[field]}
                            onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                            required={required}
                            readOnly={locked}
                            title={locked ? 'Only Super Admin can edit the phone number' : undefined}
                          />
                        </div>
                      );
                    })}
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Budget (INR)</label>
                      <input type="number" className="input-field w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.budget} onChange={e => setEditForm({ ...editForm, budget: e.target.value })} placeholder="Enter budget amount" min={0} />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Lead Source</label>
                      <select className="input-field w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.leadSource} onChange={e => setEditForm({ ...editForm, leadSource: e.target.value })}>
                        {SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    {isAdmin && (
                      <>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Assignee</label>
                          <select className="input-field w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.assignedTo} onChange={e => setEditForm({ ...editForm, assignedTo: e.target.value })}>
                            <option value="">Unassigned</option>
                            {callers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Campaign</label>
                          <select className="input-field w-full border border-gray-200 rounded-xl p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.campaign} onChange={e => setEditForm({ ...editForm, campaign: e.target.value })}>
                            <option value="">No Campaign</option>
                            {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                          </select>
                        </div>
                      </>
                    )}
                    <button type="submit" disabled={savingInfo} className="btn-primary w-full justify-center rounded-xl py-2.5 font-bold text-sm shadow-sm mt-4">
                      <Save className="w-4 h-4 mr-1.5" /> Save Changes
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {[
                      { icon: Phone, label: 'Phone', value: lead.phone, copyable: true },
                      { icon: Phone, label: 'Alternate Phone', value: lead.alternatePhone || '—', copyable: !!lead.alternatePhone },
                      { icon: Mail, label: 'Email', value: lead.email || '—' },
                      { icon: MapPin, label: 'Location', value: lead.location || '—' },
                      { icon: Award, label: 'Qualification', value: lead.lastQualification || '—' },
                      { icon: IndianRupee, label: 'Budget', value: lead.budget ? `₹${lead.budget.toLocaleString()}` : '—' },
                      { icon: Globe, label: 'Source', value: lead.leadSource },
                      { icon: User, label: 'Campaign', value: lead.campaign?.name || 'None' },
                      { icon: User, label: 'Assignee', value: lead.assignedTo?.name || 'Unassigned' },
                    ].map(({ icon: Icon, label, value, copyable }) => (
                      <div key={label} className="flex items-start gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0 text-gray-400 mt-0.5"><Icon className="w-4 h-4" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="font-semibold text-gray-800 break-all">{value}</p>
                            {copyable && value !== '—' && (
                              <button type="button" onClick={() => copyToClipboard(value)} className="text-gray-400 hover:text-indigo-600 transition-colors flex-shrink-0">
                                {copiedText === value ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-500">Rating</span>
                      <div className="flex items-center gap-1">
                        {[1,2,3,4,5].map(r => (
                          <button type="button" key={r} onClick={() => handleRatingChange(r)} className="hover:scale-110 active:scale-95 transition-transform">
                            <Star className={`w-4 h-4 ${r <= lead.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-8 space-y-6">
          {isCalling && <CallTimer onStop={handleCallEnded} />}

          {/* ── AI State Banner (shown below call timer, above other cards) ── */}
          <AIStateBanner lead={lead} />

          {/* Course Section */}
          <div className="card bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-gray-100 bg-gray-50/40 flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-indigo-600" /> Course Interest & Enrollment Mode
              </h3>
            </div>
            <div className="p-5">
              {isEditingInfo ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Course Target</label>
                    <select
                      className="input-field w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={editForm.courseInterest}
                      onChange={e => {
                        const selectedCourse = courses.find(c => c._id === e.target.value);
                        setEditForm(prev => ({
                          ...prev,
                          courseInterest: e.target.value,
                          budget: selectedCourse ? selectedCourse.cost : prev.budget,
                        }));
                      }}
                    >
                      <option value="">No Course Linked</option>
                      {courses.map(c => <option key={c._id} value={c._id}>{c.name} (₹{c.cost.toLocaleString()})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">Learning Mode</label>
                    <select className="input-field w-full border border-gray-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" value={editForm.mode} onChange={e => setEditForm({ ...editForm, mode: e.target.value })}>
                      <option value="">Select Mode</option>
                      {MODES.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1 block">
                      Budget / Negotiated Fee (₹)
                      {editForm.courseInterest && courses.find(c => c._id === editForm.courseInterest) && (
                        <span className="ml-2 font-normal text-indigo-500 normal-case">
                          Course default: ₹{courses.find(c => c._id === editForm.courseInterest)?.cost?.toLocaleString()}
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₹</span>
                      <input
                        type="number"
                        className="input-field w-full border border-gray-200 rounded-xl p-2.5 pl-7 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={editForm.budget}
                        onChange={e => setEditForm({ ...editForm, budget: e.target.value })}
                        placeholder="Enter budget amount"
                        min={0}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="md:col-span-2 bg-indigo-50/20 border border-indigo-100 rounded-2xl p-5 flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center flex-shrink-0 mt-0.5"><BookOpen className="w-6 h-6" /></div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">Selected Course</p>
                      <h4 className="text-lg font-bold text-gray-800">{lead.courseInterest?.name || 'No Course Selected'}</h4>
                      {lead.courseInterest?.description && <p className="text-xs text-gray-500 leading-relaxed pt-1">{lead.courseInterest.description}</p>}
                      {lead.courseInterest?.duration && (
                        <div className="inline-flex items-center gap-1 bg-white border border-indigo-100 text-[10px] font-bold text-indigo-600 px-2 py-0.5 rounded-full mt-2.5 shadow-xs">
                          <Clock className="w-3 h-3" /> {lead.courseInterest.duration}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="bg-emerald-50/25 border border-emerald-100 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Course Fee</p>
                      <h4 className="text-3xl font-extrabold text-emerald-800 mt-1">
                        {lead.courseInterest?.cost ? `₹${lead.courseInterest.cost.toLocaleString()}` : '—'}
                      </h4>
                      {lead.budget > 0 && lead.budget !== lead.courseInterest?.cost && (
                        <p className="text-xs text-emerald-600 mt-1 font-semibold">Budget: ₹{lead.budget.toLocaleString()}</p>
                      )}
                      {lead.budget > 0 && !lead.courseInterest && (
                        <p className="text-xs text-emerald-600 mt-1 font-semibold">Budget: ₹{lead.budget.toLocaleString()}</p>
                      )}
                    </div>
                    <div className="pt-4 border-t border-emerald-100/50 mt-4 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Learning Mode</span>
                      {lead.mode ? (
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow-xs">{lead.mode}</span>
                      ) : <span className="text-xs text-gray-400 italic">Not set</span>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Center */}
          <div className="card bg-white rounded-2xl border border-gray-200 shadow-xs p-5" style={{ position: 'relative', overflow: 'hidden' }}>
            {isBlocked && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(254,242,242,0.93)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 16 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#dc2626' }}>Number Blocked — Actions Disabled</span>
                <span style={{ fontSize: 11, color: '#991b1b' }}>Unblock this number to re-enable all actions</span>
              </div>
            )}
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">Quick Action Center</h3>
              <button
                onClick={handleBlockToggle}
                disabled={blockingAction}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 11px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: blockingAction ? 'not-allowed' : 'pointer',
                  border: isBlocked ? '1px solid #86efac' : '1px solid #fca5a5',
                  background: isBlocked ? '#f0fdf4' : '#fff0f0',
                  color: isBlocked ? '#16a34a' : '#dc2626',
                  opacity: blockingAction ? 0.6 : 1,
                }}
              >
                {isBlocked ? (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-5"/></svg>{blockingAction ? '…' : 'Unblock'}</>
                ) : (
                  <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>{blockingAction ? '…' : 'Block'}</>
                )}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Phone, label: 'CALL NOW', action: () => setShowInitiateCallModal(true), color: 'bg-green-500 hover:bg-green-600 text-white shadow-sm hover:shadow', disabled: isBlocked },
                { icon: Clock, label: 'CALLBACK LATER', action: () => setShowCallbackModal(true), color: 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200', disabled: isBlocked },
                { icon: Plus, label: 'ADD NOTE', action: () => setShowNoteModal(true), color: 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200', disabled: isBlocked },
              ].map(({ icon: Icon, label, action, color, disabled }) => (
                <button key={label} onClick={action} disabled={disabled}
                  className={`flex flex-col items-center justify-center gap-2 py-3 px-2.5 rounded-xl font-bold transition-all text-center ${color} disabled:opacity-40 disabled:cursor-not-allowed`}>
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] tracking-wider font-extrabold uppercase">{label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 flex justify-center">
              <button disabled={isBlocked} onClick={() => setShowLogCallModal(true)} className="text-xs font-bold text-indigo-650 hover:text-indigo-800 hover:underline transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                + Log call records manually
              </button>
            </div>
          </div>

          {/* Activity Timeline */}
          <div className="card bg-white rounded-2xl border border-gray-200 shadow-xs p-6">
            <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide mb-4 pb-2.5 border-b border-gray-100">Activity & Calling History</h3>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-5">
              {[
                { key: 'all', label: 'All' },
                { key: 'call', label: 'Calls' },
                { key: 'followup', label: 'Callback Later' },
                { key: 'note', label: 'Notes' },
              ].map(tab => {
                let count;
                if (tab.key === 'all') {
                  count = (lead.activities?.length || 0) + leadFollowups.length;
                } else if (tab.key === 'followup') {
                  count = leadFollowups.length;
                } else {
                  count = lead.activities?.filter(a => a.type === tab.key).length || 0;
                }
                const isActive = activityFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActivityFilter(tab.key)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: isActive ? 'var(--theme-primary)' : '#f3f4f6',
                      color: isActive ? '#fff' : '#6b7280',
                      border: isActive ? '1px solid var(--theme-primary)' : '1px solid #e5e7eb',
                    }}
                  >
                    {tab.label}
                    <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                      style={{ background: isActive ? 'rgba(255,255,255,0.25)' : '#e5e7eb', color: isActive ? '#fff' : '#9ca3af' }}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Timeline */}
            <div className="relative border-l border-gray-100 ml-4 space-y-6">
              {(() => {
                if (activityFilter === 'followup') {
                  if (leadFollowups.length === 0) {
                    return (
                      <div className="text-center py-10">
                        <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">No callback scheduled yet.</p>
                      </div>
                    );
                  }
                  return leadFollowups.map((f, i) => (
                    <div key={f._id || i} className="relative pl-6">
                      <div className="absolute -left-3.5 top-0 w-7 h-7 rounded-full bg-white border border-gray-200 shadow-xs flex items-center justify-center text-gray-500">
                        <Clock className="w-4 h-4 text-orange-500" />
                      </div>
                      <div className="bg-orange-50/50 rounded-xl p-3.5 border border-orange-100 hover:border-orange-200 transition-colors shadow-2xs">
                        <div className="flex items-center justify-between gap-4 flex-wrap">
                          <div className="font-bold text-sm text-gray-800">📅 Callback Scheduled</div>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${f.status === 'upcoming' ? 'bg-orange-100 text-orange-700' : f.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            {f.status === 'upcoming' ? '⏳ Upcoming' : f.status === 'completed' ? '✅ Done' : f.status}
                          </span>
                        </div>
                        {f.note && (
                          <p className="text-xs text-gray-500 italic mt-1.5 bg-white border border-orange-100/50 rounded-lg p-2">"{f.note}"</p>
                        )}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-orange-100/30 text-[10px] text-gray-400 font-semibold">
                          <span>ASSIGNED TO: {f.assignedTo?.name || 'Unassigned'}</span>
                          {f.scheduledAt && <span>📅 {format(new Date(f.scheduledAt), 'dd MMM yyyy, hh:mm a')}</span>}
                        </div>
                      </div>
                    </div>
                  ));
                }

                const activityItems = activityFilter === 'all'
                  ? (lead.activities || [])
                  : (lead.activities || []).filter(a => a.type === activityFilter);

                const followupItems = activityFilter === 'all'
                  ? leadFollowups.map(f => ({
                      _followup: true,
                      _id: f._id,
                      type: 'followup',
                      description: f.note || 'Callback scheduled',
                      createdAt: f.createdAt,
                      scheduledAt: f.scheduledAt,
                      status: f.status,
                      performedBy: f.assignedTo,
                    }))
                  : [];

                const allItems = [...activityItems, ...followupItems].sort(
                  (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
                );

                if (allItems.length === 0) {
                  return (
                    <div className="text-center py-10">
                      <Clock className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                      <p className="text-gray-400 text-sm">
                        {activityFilter === 'all' ? 'No activity history logged yet.' : `No ${activityFilter} activity found.`}
                      </p>
                    </div>
                  );
                }

                return allItems.map((a, i) => (
                  <div key={a._id || i} className="relative pl-6">
                    <div className={`absolute -left-3.5 top-0 w-7 h-7 rounded-full bg-white border shadow-xs flex items-center justify-center ${a._followup ? 'border-orange-200' : 'border-gray-200'}`}>
                      {a._followup ? <Clock className="w-4 h-4 text-orange-500" /> : activityIcon(a.type)}
                    </div>
                    <div className={`rounded-xl p-3.5 border hover:border-gray-200 transition-colors shadow-2xs ${a._followup ? 'bg-orange-50/40 border-orange-100' : 'bg-gray-50/50 border-gray-100'}`}>
                      <div className="flex items-center justify-between gap-4 flex-wrap">
                        <div className="font-bold text-sm text-gray-800">
                          {a._followup ? (
                            <span className="flex items-center gap-2">
                              📅 Callback Scheduled
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${a.status === 'upcoming' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                                {a.status === 'upcoming' ? '⏳ Upcoming' : '✅ Done'}
                              </span>
                            </span>
                          ) : a.type === 'call' ? (
                            <span>Logged Call — {fmtDuration(a.callDuration)} ({a.callStatus?.toUpperCase() || 'CONNECTED'})</span>
                          ) : a.type === 'status_change' ? (
                            <span className="text-orange-700">{a.description}</span>
                          ) : a.type === 'api_call' ? (
                            <span className="flex items-center gap-1.5 text-purple-700">⚡ {a.templateName || 'API Template'}</span>
                          ) : (
                            <span>{a.description}</span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 font-medium">{a.createdAt ? formatDistanceToNow(new Date(a.createdAt), { addSuffix: true }) : ''}</span>
                      </div>
                      {a._followup && a.scheduledAt && (
                        <p className="text-xs text-orange-600 font-semibold mt-1.5 bg-white border border-orange-100 rounded-lg p-2">
                          ⏰ Due: {format(new Date(a.scheduledAt), 'dd MMM yyyy, hh:mm a')}
                        </p>
                      )}
                      {a._followup && a.description && (
                        <p className="text-xs text-gray-500 italic mt-1 bg-white border border-orange-100/50 rounded-lg p-2">"{a.description}"</p>
                      )}
                      {!a._followup && a.type === 'call' && a.description && (
                        <>
                          <p className="text-xs text-gray-500 italic mt-1.5 bg-white border border-gray-100/50 rounded-lg p-2">"{a.description}"</p>
                          <button
                            onClick={() => setRunCallIqActivityId(a._id)}
                            className="mt-1.5 text-[11px] font-bold text-violet-600 hover:text-violet-800 hover:underline flex items-center gap-1"
                          >
                            <Sparkles className="w-3 h-3" /> Run Call IQ
                          </button>
                        </>
                      )}
                      {!a._followup && a.type === 'api_call' && a.fields?.length > 0 && (
                        <div className="mt-2 bg-white border border-gray-100 rounded-lg overflow-hidden">
                          <div className="grid grid-cols-[1fr_2fr] bg-gray-50 text-[10px] font-bold text-gray-500 uppercase px-3 py-1.5 border-b border-gray-100">
                            <span>Field</span><span>Value</span>
                          </div>
                          {a.fields.map((f, fi) => (
                            <div key={fi} className={`grid grid-cols-[1fr_2fr] px-3 py-2 text-xs ${fi < a.fields.length - 1 ? 'border-b border-gray-50' : ''}`}>
                              <span className="font-semibold text-gray-700 flex items-center gap-1">
                                <span className="text-gray-400 font-mono text-[10px]">{f.type === 'Number' ? '#' : 'T'}</span> {f.label}
                              </span>
                              <span className="text-gray-600 break-words">{String(f.value ?? '')}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100/30 text-[10px] text-gray-400 font-semibold">
                        <span>BY: {a.performedBy?.name || 'System / Unassigned'}</span>
                        {a.createdAt && <span>{format(new Date(a.createdAt), 'dd MMM yyyy, hh:mm a')}</span>}
                      </div>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showNoteModal && <AddNoteModal onClose={() => setShowNoteModal(false)} onSubmit={handleAddNote} />}
      {showLogCallModal && <LogCallModal lead={lead} onClose={() => setShowLogCallModal(false)} onSubmit={handleLogManualCall} />}
      {runCallIqActivityId && (
        <RunCallIqModal
          leadId={lead._id}
          activityId={runCallIqActivityId}
          onClose={() => setRunCallIqActivityId(null)}
        />
      )}
      {showCallbackModal && lead && <CallbackTimeModal lead={lead} currentUser={user} onClose={() => setShowCallbackModal(false)} onScheduled={handleCallbackScheduled} />}
      {showDemoModal && lead && <ScheduleDemoModal lead={lead} onClose={() => setShowDemoModal(false)} onSave={handleScheduleDemo} />}
      {showInitiateCallModal && (
        <InitiateCallModal
          lead={lead}
          callers={callers}
          currentUser={user}
          onClose={() => setShowInitiateCallModal(false)}
          onSuccess={fetchLeadDetails}
        />
      )}
    </div>
  );
}