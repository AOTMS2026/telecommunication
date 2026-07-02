import { useState, useEffect, useMemo, useCallback } from 'react';
import { broadcastsAPI, messageTemplatesAPI, integrationsAPI, leadsAPI, usersAPI } from '../services/api';
import {
  ArrowLeft, Megaphone, RefreshCw, Search, Filter as FilterIcon, Users, X,
  Check, Phone, ChevronDown, Image as ImageIcon,
} from 'lucide-react';

const STATUSES = ['Fresh', 'Connected', 'Call Not Responding', 'Call Back Later', 'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost', 'Blocked'];
const SOURCES = ['Manual', 'Facebook', 'WhatsApp', 'Website', 'Excel'];

function timeAgo(date) {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 0)}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}M`;
}

function initials(name) {
  if (!name) return '—';
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function ProgressRing({ percent }) {
  if (percent === null || percent === undefined || Number.isNaN(percent)) {
    return (
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#9ca3af' }}>NA</div>
    );
  }
  const r = 17, c = 2 * Math.PI * r;
  const offset = c - (Math.min(percent, 100) / 100) * c;
  return (
    <div style={{ position: 'relative', width: 40, height: 40 }}>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" stroke="#fee2e2" strokeWidth="3" />
        <circle cx="20" cy="20" r={r} fill="none" stroke="#22c55e" strokeWidth="3" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 20 20)" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#111827' }}>{Math.round(percent)}%</div>
    </div>
  );
}

function defaultBroadcastName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `bulk-messaging-at-${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}-${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export default function WhatsAppBroadcasts({ onClose, waIntegrationId, workspaceLabel }) {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showWizard, setShowWizard] = useState(false);

  const fetchBroadcasts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await broadcastsAPI.getAll(search ? { search } : {});
      setBroadcasts(res.data.broadcasts || []);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchBroadcasts(); }, [fetchBroadcasts]);

  const filtered = useMemo(() => broadcasts, [broadcasts]);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* LEFT: broadcast history list */}
      <div style={{ width: 340, minWidth: 340, borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', background: '#fff' }}>
        <div style={{ padding: '14px 16px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onClose} style={iconBtnStyle}><ArrowLeft size={18} /></button>
            <Megaphone size={16} color="var(--theme-primary)" />
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--theme-text-strong)' }}>Broadcasts</span>
            <button onClick={fetchBroadcasts} style={{ ...iconBtnStyle, marginLeft: 'auto' }}>
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
          {workspaceLabel && <div style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 2, marginLeft: 26 }}>{workspaceLabel}</div>}
        </div>

        <div style={{ padding: '10px 16px 8px', display: 'flex', gap: 8 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 9, top: 9, color: '#9ca3af' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search broadcast(s) by name"
              style={{ width: '100%', padding: '7px 10px 7px 28px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12.5, outline: 'none' }}
            />
          </div>
          <button style={{ ...iconBtnStyle, border: '1px solid #e5e7eb' }}><FilterIcon size={14} /></button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 16px 10px' }}>
          <span style={{ fontSize: 12.5, color: '#6b7280', fontWeight: 600 }}>{broadcasts.length} Broadcasts</span>
          <button onClick={() => setShowWizard(true)} style={{ background: 'none', border: 'none', color: 'var(--theme-primary)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
            + Create Broadcast
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', borderTop: '1px solid #f1f1f1' }}>
          {!loading && filtered.length === 0 && (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No broadcasts yet.</div>
          )}
          {filtered.map((b) => (
            <div
              key={b._id}
              onClick={() => setSelected(b)}
              style={{
                padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                background: selected?._id === b._id ? 'var(--theme-surface-faint3)' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--theme-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{b.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 11.5, color: '#9ca3af' }}>
                  <span>{timeAgo(b.createdAt)}</span>
                  <span style={{ background: 'var(--theme-surface-tint)', color: 'var(--theme-primary)', borderRadius: 20, padding: '1px 6px', fontWeight: 700, fontSize: 10 }}>
                    {initials(b.createdBy?.name)}
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Users size={11} /> {b.totalLeads}</span>
                </div>
              </div>
              <ProgressRing percent={b.totalLeads ? (b.sentCount / b.totalLeads) * 100 : (b.status === 'completed' ? 100 : null)} />
            </div>
          ))}
        </div>
      </div>

      {/* RIGHT: detail / empty state */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--theme-surface-faint3)', position: 'relative' }}>
        {selected ? (
          <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--theme-text-strong)', marginBottom: 4 }}>@{selected.name}</div>
            <div style={{ fontSize: 12.5, color: '#9ca3af', marginBottom: 16 }}>Sent {timeAgo(selected.createdAt)} ago by {selected.createdBy?.name || 'Unknown'}</div>
            <div style={{ display: 'flex', gap: 24 }}>
              <Stat label="Recipients" value={selected.totalLeads} />
              <Stat label="Sent" value={selected.sentCount} />
              <Stat label="Failed" value={selected.failedCount} />
              <Stat label="Status" value={selected.status} />
            </div>
            <div style={{ marginTop: 16, fontSize: 12.5, color: '#6b7280' }}>
              Template: <span style={{ fontWeight: 600, color: 'var(--theme-primary)' }}>{selected.templateName || '—'}</span>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#9ca3af' }}>
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="1.5" strokeLinecap="round" style={{ margin: '0 auto 16px' }}>
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
            </svg>
            <div style={{ fontWeight: 700, fontSize: 17, color: 'var(--theme-text-strong)' }}>Whatsapp Broadcasts</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>Create a broadcast to start</div>
          </div>
        )}

        {showWizard && (
          <CreateBroadcastWizard
            waIntegrationId={waIntegrationId}
            workspaceLabel={workspaceLabel}
            onClose={() => setShowWizard(false)}
            onDone={() => { setShowWizard(false); fetchBroadcasts(); }}
          />
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--theme-text-strong)' }}>{value ?? 0}</div>
      <div style={{ fontSize: 11, color: '#9ca3af' }}>{label}</div>
    </div>
  );
}

function CreateBroadcastWizard({ waIntegrationId, workspaceLabel, onClose, onDone }) {
  const [step, setStep] = useState(0); // 0 select leads, 1 select template, 2 confirmation
  const [filters, setFilters] = useState({ status: '', source: '', assignedTo: '', ratingMin: '', createdFrom: '', createdTo: '', search: '' });
  const [leadCount, setLeadCount] = useState(null);
  const [counting, setCounting] = useState(false);
  const [users, setUsers] = useState([]);

  const [templates, setTemplates] = useState([]);
  const [templateSearch, setTemplateSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const [name, setName] = useState(defaultBroadcastName());
  const [retryOnFail, setRetryOnFail] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });

  useEffect(() => { usersAPI.getAll().then((res) => setUsers(res.data.users || res.data || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (step === 1) {
      messageTemplatesAPI.getAll({ type: 'whatsapp' }).then((res) => setTemplates(res.data.templates || [])).catch(() => {});
    }
  }, [step]);

  const handleCount = async () => {
    setCounting(true);
    try {
      const res = await broadcastsAPI.preview(filters);
      setLeadCount(res.data.count);
    } catch (err) { console.error(err); } finally { setCounting(false); }
  };

  const filteredTemplates = templates.filter((t) =>
    !templateSearch || t.shortcut.toLowerCase().includes(templateSearch.toLowerCase()) || t.message.toLowerCase().includes(templateSearch.toLowerCase())
  );

  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    setStep(2);
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const res = await broadcastsAPI.create({
        name, filters, templateId: selectedTemplate._id, templateName: selectedTemplate.shortcut,
        contactField: 'phone', retryOnFail,
      });
      const { broadcast, leads } = res.data;
      setProgress({ sent: 0, total: leads.length });

      let sent = 0, failed = 0;
      for (const lead of leads) {
        try {
          if (waIntegrationId) {
            await integrationsAPI.sendWhatsAppTemplate(waIntegrationId, { to: lead.phone, templateName: selectedTemplate.shortcut, languageCode: 'en_US' });
          }
          await leadsAPI.addNote(lead._id, { note: `You: ${selectedTemplate.message}`, type: 'whatsapp' });
          sent += 1;
        } catch (err) {
          failed += 1;
        }
        setProgress({ sent: sent + failed, total: leads.length });
      }

      await broadcastsAPI.update(broadcast._id, { sentCount: sent, failedCount: failed, status: 'completed' });
      onDone();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not create broadcast.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#fff', display: 'flex', flexDirection: 'column', zIndex: 30 }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, ...iconBtnStyle, border: '1px solid #e5e7eb' }}><X size={16} /></button>

      <div style={{ padding: '24px 32px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 22, fontWeight: 700, color: 'var(--theme-text-strong)' }}>
          <Megaphone size={22} color="var(--theme-primary)" /> Create Broadcast
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, margin: '26px auto 8px', maxWidth: 460 }}>
          {['Select leads', 'Select template', 'Confirmation'].map((label, i) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'unset' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: step >= i ? 'var(--theme-primary)' : '#fff', border: `2px solid ${step >= i ? 'var(--theme-primary)' : '#d1d5db'}`,
                }}>
                  {step > i ? <Check size={14} color="#fff" /> : <span style={{ width: 8, height: 8, borderRadius: '50%', background: step === i ? '#fff' : 'transparent' }} />}
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: step >= i ? 'var(--theme-primary)' : '#9ca3af', whiteSpace: 'nowrap' }}>{label}</span>
              </div>
              {i < 2 && <div style={{ flex: 1, height: 2, background: step > i ? 'var(--theme-primary)' : '#e5e7eb', margin: '0 8px 20px' }} />}
            </div>
          ))}
        </div>

        {workspaceLabel && (
          <div style={{ textAlign: 'center', fontSize: 13, color: '#374151', marginTop: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#25D366" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            {workspaceLabel}
          </div>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 32px' }}>
        {step === 0 && (
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 12 }}>Filter leads to broadcast to</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input placeholder="Search by name or phone" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} style={fieldStyle} />
                <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })} style={fieldStyle}>
                  <option value="">Lead Status: Any</option>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.source} onChange={(e) => setFilters({ ...filters, source: e.target.value })} style={fieldStyle}>
                  <option value="">Source: Any</option>
                  {SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.assignedTo} onChange={(e) => setFilters({ ...filters, assignedTo: e.target.value })} style={fieldStyle}>
                  <option value="">Assignee: Any</option>
                  {users.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
                </select>
                <select value={filters.ratingMin} onChange={(e) => setFilters({ ...filters, ratingMin: e.target.value })} style={fieldStyle}>
                  <option value="">Rating: Any</option>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ stars</option>)}
                </select>
                <div style={{ display: 'flex', gap: 6 }}>
                  <input type="date" value={filters.createdFrom} onChange={(e) => setFilters({ ...filters, createdFrom: e.target.value })} style={fieldStyle} title="Created from" />
                  <input type="date" value={filters.createdTo} onChange={(e) => setFilters({ ...filters, createdTo: e.target.value })} style={fieldStyle} title="Created to" />
                </div>
              </div>
            </div>

            <button
              onClick={handleCount}
              disabled={counting}
              style={{ marginTop: 18, width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'var(--theme-primary)', color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              {counting ? 'Counting…' : leadCount === null ? 'Preview Matching Leads' : `${leadCount} lead(s) match — Select`}
            </button>

            {leadCount !== null && (
              <button
                onClick={() => setStep(1)}
                disabled={leadCount === 0}
                style={{ marginTop: 10, width: '100%', padding: '12px', borderRadius: 10, border: '1px solid var(--theme-primary)', background: '#fff', color: 'var(--theme-primary)', fontWeight: 600, fontSize: 14, cursor: leadCount === 0 ? 'default' : 'pointer', opacity: leadCount === 0 ? 0.5 : 1 }}
              >
                Continue to template
              </button>
            )}
          </div>
        )}

        {step === 1 && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ position: 'relative', marginBottom: 14 }}>
              <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: '#9ca3af' }} />
              <input
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Search by name or content"
                style={{ width: '100%', padding: '9px 10px 9px 32px', borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 13.5, outline: 'none' }}
              />
            </div>
            {filteredTemplates.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13, border: '1px dashed #e5e7eb', borderRadius: 10 }}>
                No WhatsApp templates found. Create one in Message Templates first.
              </div>
            )}
            {filteredTemplates.map((tpl) => (
              <button
                key={tpl._id}
                onClick={() => handleSelectTemplate(tpl)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '12px 14px',
                  marginBottom: 8, borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer',
                }}
              >
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--theme-surface-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <ImageIcon size={16} color="var(--theme-primary)" />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13.5, color: 'var(--theme-primary)' }}>
                    {tpl.shortcut} {tpl.isShared && <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', padding: '1px 6px', borderRadius: 6 }}>Shared</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tpl.message}</div>
                </div>
              </button>
            ))}
            <button onClick={() => setStep(0)} style={{ marginTop: 8, background: 'none', border: 'none', color: '#6b7280', fontSize: 13, cursor: 'pointer' }}>
              ← Back to leads
            </button>
          </div>
        )}

        {step === 2 && (
          <div style={{ maxWidth: 560, margin: '0 auto' }}>
            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Broadcast Name</label>
            <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', marginTop: 6, marginBottom: 18 }}>
              <span style={{ color: '#9ca3af', marginRight: 4 }}>@</span>
              <input value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13.5 }} />
            </div>

            <label style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Choose contact field on which broadcast is to be sent</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid #e5e7eb', borderRadius: 10, padding: '9px 12px', marginTop: 6, marginBottom: 18, color: '#374151' }}>
              <Phone size={14} /> Phone <ChevronDown size={14} style={{ marginLeft: 'auto', color: '#9ca3af' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: 13.5, color: '#374151' }}>If message delivery fails, should it be retried automatically?</span>
              <button
                onClick={() => setRetryOnFail((v) => !v)}
                style={{
                  width: 40, height: 22, borderRadius: 20, border: 'none', cursor: 'pointer',
                  background: retryOnFail ? 'var(--theme-primary)' : '#e5e7eb', position: 'relative', flexShrink: 0,
                }}
              >
                <span style={{ position: 'absolute', top: 2, left: retryOnFail ? 20 : 2, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left 0.15s' }} />
              </button>
            </div>

            <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 8 }}>
              Sending <b>{selectedTemplate?.shortcut}</b> to <b>{leadCount}</b> lead(s).
            </div>

            {sending && (
              <div style={{ fontSize: 12.5, color: '#6b7280', marginBottom: 8 }}>
                Sending… {progress.sent}/{progress.total}
              </div>
            )}
          </div>
        )}
      </div>

      {step === 2 && (
        <div style={{ borderTop: '1px solid #eee', padding: '16px 32px', display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={() => setStep(1)} disabled={sending} style={{ padding: '10px 22px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff', fontWeight: 600, fontSize: 13.5, cursor: 'pointer' }}>Back</button>
          <button onClick={handleSend} disabled={sending} style={{ padding: '10px 26px', borderRadius: 10, border: 'none', background: 'var(--theme-primary)', color: '#fff', fontWeight: 600, fontSize: 13.5, cursor: sending ? 'default' : 'pointer', opacity: sending ? 0.7 : 1 }}>
            {sending ? 'Sending…' : 'Send broadcast'}
          </button>
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  width: 30, height: 30, borderRadius: 8, border: 'none', background: 'transparent',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#4b5563',
};

const fieldStyle = {
  padding: '8px 10px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12.5, color: '#374151', outline: 'none', width: '100%',
};