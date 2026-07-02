import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { recordingsAPI, usersAPI } from '../services/api';
import RunCallIqModal from '../components/RunCallIqModal';
import axios from 'axios';

const PURPLE = 'var(--theme-primary)';
const TEXT_MAIN = 'var(--theme-text-strongest)';
const TEXT_MUTED = '#6b7280';
const BORDER = 'var(--theme-border-tint)';
const BG = 'var(--theme-surface-faint6)';

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short',
    year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function AudioPlayer({ url }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  const toggle = () => {
    if (!audioRef.current) return;
    if (playing) { audioRef.current.pause(); setPlaying(false); }
    else { audioRef.current.play().catch(() => setError(true)); setPlaying(true); }
  };

  const seek = (e) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = ratio * duration;
  };

  function fmtTime(s) {
    if (!s || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: BG, borderRadius: 10, padding: '8px 12px', border: `1px solid ${BORDER}` }}>
      <audio
        ref={audioRef}
        src={url}
        preload="metadata"
        onTimeUpdate={() => setProgress(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => { const d = audioRef.current?.duration; if (d && isFinite(d)) setDuration(d); }}
        onDurationChange={() => { const d = audioRef.current?.duration; if (d && isFinite(d)) setDuration(d); }}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onError={() => setError(true)}
      />
      <button
        onClick={toggle}
        style={{ width: 34, height: 34, borderRadius: '50%', background: error ? '#fee2e2' : PURPLE, border: 'none', cursor: error ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
      >
        {error ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        ) : playing ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        )}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div onClick={seek} style={{ height: 4, background: 'var(--theme-primary-pale2)', borderRadius: 2, cursor: 'pointer', position: 'relative' }}>
          <div style={{ height: '100%', width: `${duration ? (progress / duration) * 100 : 0}%`, background: PURPLE, borderRadius: 2, transition: 'width 0.1s' }} />
        </div>
      </div>
      <span style={{ fontSize: 11, color: TEXT_MUTED, flexShrink: 0 }}>
        {fmtTime(progress)} / {fmtTime(duration)}
      </span>
      <a href={url} download style={{ color: TEXT_MUTED, display: 'flex', alignItems: 'center' }} title="Download">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      </a>
    </div>
  );
}

export default function CallRecordings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'manager';
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [filterUser, setFilterUser] = useState('');
  const [search, setSearch] = useState('');
  const [rematching, setRematching] = useState(false);
  const [rematchResult, setRematchResult] = useState(null);
  const [runCallIqRecordingId, setRunCallIqRecordingId] = useState(null);

  const load = async (uid = filterUser) => {
    setLoading(true); setError('');
    try {
      let res;
      if (isAdmin) res = await recordingsAPI.getAll(uid || undefined);
      else res = await recordingsAPI.getMy();
      setRecordings(res.data.recordings || []);
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to load recordings');
    } finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (isAdmin) {
      usersAPI.getAll().then(r => setUsers((r.data.users || []).filter(u => u.role === 'caller'))).catch(() => {});
    }
  }, []);

  const handleRematch = async () => {
    setRematching(true);
    setRematchResult(null);
    try {
      const res = await axios.post('/api/recordings/rematch');
      setRematchResult(res.data);
      load();
    } catch (e) {
      setRematchResult({ error: e?.response?.data?.error || 'Rematch failed' });
    } finally { setRematching(false); }
  };

  const filtered = recordings.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.leadName || '').toLowerCase().includes(q) ||
      (r.leadPhone || '').toLowerCase().includes(q) ||
      (r.phone || '').toLowerCase().includes(q) ||
      (r.userName || '').toLowerCase().includes(q)
    );
  });

  const unlinkedCount = recordings.filter(r => !r.leadName).length;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: PURPLE }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: TEXT_MAIN, margin: 0 }}>Call Recordings</h1>
          <span style={{ fontSize: 12, background: 'var(--theme-surface-tint)', color: PURPLE, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{recordings.length}</span>
          {unlinkedCount > 0 && (
            <span style={{ fontSize: 12, background: '#fef3c7', color: '#d97706', borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{unlinkedCount} unlinked</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && unlinkedCount > 0 && (
            <button
              onClick={handleRematch}
              disabled={rematching}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--btn-gradient)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: rematching ? 'not-allowed' : 'pointer', opacity: rematching ? 0.7 : 1 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
              {rematching ? 'Matching...' : 'Auto-Match Leads'}
            </button>
          )}
          <button
            onClick={() => load()}
            style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--btn-gradient)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Rematch result banner */}
      {rematchResult && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: rematchResult.error ? '#fee2e2' : '#d1fae5', color: rematchResult.error ? '#dc2626' : '#065f46', fontSize: 13, fontWeight: 600 }}>
          {rematchResult.error
            ? `Error: ${rematchResult.error}`
            : `✓ Matched ${rematchResult.matched} of ${rematchResult.total} unlinked recordings to leads`
          }
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Search by lead name, phone, agent..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: 200, padding: '9px 14px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, outline: 'none', color: TEXT_MAIN }}
        />
        {isAdmin && (
          <select
            value={filterUser}
            onChange={e => { setFilterUser(e.target.value); load(e.target.value); }}
            style={{ padding: '9px 14px', border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 13, color: TEXT_MAIN, background: '#fff', minWidth: 160 }}
          >
            <option value="">All Callers</option>
            {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: TEXT_MUTED }}>
          <div style={{ width: 32, height: 32, border: `3px solid ${BORDER}`, borderTopColor: PURPLE, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          Loading recordings...
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={{ color: '#dc2626', fontSize: 14, marginBottom: 12 }}>{error}</div>
          <button onClick={() => load()} style={{ background: 'var(--btn-gradient)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 20px', cursor: 'pointer', fontWeight: 600 }}>Retry</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80, color: TEXT_MUTED }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={BORDER} strokeWidth="1.5" style={{ margin: '0 auto 16px', display: 'block' }}><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
          <p style={{ fontWeight: 600, color: TEXT_MAIN, marginBottom: 4 }}>No recordings found</p>
          <p style={{ fontSize: 13 }}>Recordings synced from the mobile app will appear here</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map(r => (
            <div key={r._id} style={{ background: '#fff', border: `1px solid ${r.leadName ? BORDER : '#fde68a'}`, borderRadius: 12, padding: '16px 18px', boxShadow: '0 1px 4px #0000000a' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {r.leadName ? (
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN }}>{r.leadName}</span>
                      {r.leadPhone && <span style={{ fontSize: 12, color: TEXT_MUTED, marginLeft: 6 }}>{r.leadPhone}</span>}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: '#d97706', fontStyle: 'italic', fontWeight: 600 }}>No lead linked</span>
                      {r.phone && (
                        <span style={{ fontSize: 11, background: '#fef3c7', color: '#92400e', borderRadius: 12, padding: '2px 8px', fontWeight: 600 }}>
                          📞 {r.phone}
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {isAdmin && r.userName && (
                    <span style={{ fontSize: 11, background: 'var(--theme-surface-tint2)', color: PURPLE, borderRadius: 20, padding: '2px 10px', fontWeight: 600 }}>{r.userName}</span>
                  )}
                  {r.size > 0 && <span style={{ fontSize: 11, color: TEXT_MUTED }}>{fmtSize(r.size)}</span>}
                  <span style={{ fontSize: 11, color: TEXT_MUTED }}>{fmtDate(r.recordedAt)}</span>
                </div>
              </div>
              <AudioPlayer url={r.url} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 10, flexWrap: 'wrap' }}>
                <button
                  onClick={() => setRunCallIqRecordingId(r._id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--theme-surface-tint2)', color: PURPLE, border: `1px solid var(--theme-border-tint)`, borderRadius: 8, padding: '6px 12px', fontWeight: 600, fontSize: 12, cursor: 'pointer' }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l1.9 4.4L18 9l-4.1 1.6L12 15l-1.9-4.4L6 9l4.1-1.6L12 3z"/><path d="M5 19l.8-1.9L8 16.5l-2.2-.6L5 14l-.8 1.9L2 16.5l2.2.6L5 19z"/></svg>
                  Run Call IQ
                </button>
                {r.transcriptStatus === 'done' && (
                  <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>✓ Transcribed</span>
                )}
                {r.transcriptStatus === 'failed' && (
                  <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }} title={r.transcriptError}>Transcription failed</span>
                )}
              </div>
              {r.transcript && (
                <p style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 8, background: BG, borderRadius: 8, padding: '8px 10px', fontStyle: 'italic' }}>
                  "{r.transcript.slice(0, 220)}{r.transcript.length > 220 ? '…' : ''}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {runCallIqRecordingId && (
        <RunCallIqModal
          recordingId={runCallIqRecordingId}
          onClose={() => { setRunCallIqRecordingId(null); load(); }}
        />
      )}
    </div>
  );
}