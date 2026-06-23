import { useState, useEffect, useCallback } from 'react';
import { workflowsAPI, usersAPI, apiTemplatesAPI, webhooksAPI } from '../services/api';

const C = { indigo: '#6366f1', indigoBg: '#f0eeff', border: '#e5e2f5', ink: '#1e1b4b', sub: '#6b7280' };

const card = { background: '#fff', border: `1px solid ${C.border}`, borderRadius: 12 };
const btnPrimary = { padding: '8px 18px', borderRadius: 8, border: 'none', background: C.indigo, color: '#fff', fontWeight: 600, fontSize: 14, cursor: 'pointer' };
const btnGhost = { padding: '7px 14px', borderRadius: 8, border: `1.5px solid ${C.border}`, background: '#fff', color: C.ink, fontWeight: 600, fontSize: 13, cursor: 'pointer' };
const inp = { width: '100%', padding: '9px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, outline: 'none', boxSizing: 'border-box' };
const label = { fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'block' };

function Spinner() {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
    <div style={{ width: 30, height: 30, border: `3px solid ${C.indigo}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
  </div>;
}

export default function Workflows({ kind = 'WORKFLOW' }) {
  const isSchedule = kind === 'SCHEDULE';
  const title = isSchedule ? 'Schedules' : 'Workflows';
  const subtitle = isSchedule ? 'Automatically keep in touch with your leads' : 'Execute complex automations with ease';

  const [loading, setLoading] = useState(true);
  const [workflows, setWorkflows] = useState([]);
  const [summary, setSummary] = useState({ totalRuns: 0, success: 0, failed: 0 });
  const [tab, setTab] = useState('published');
  const [search, setSearch] = useState('');
  const [meta, setMeta] = useState({ events: [], actions: [] });
  const [editing, setEditing] = useState(null); // workflow being edited (or 'new')
  const [users, setUsers] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [hooks, setHooks] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [wf, m] = await Promise.all([
        workflowsAPI.getAll({ kind, status: tab, search }),
        workflowsAPI.meta(),
      ]);
      setWorkflows(wf.data.workflows);
      setSummary(wf.data.summary);
      setMeta(m.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [kind, tab, search]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    usersAPI.getAll().then(r => setUsers(r.data.users || r.data || [])).catch(() => {});
    apiTemplatesAPI.getAll().then(r => setTemplates(r.data.templates || [])).catch(() => {});
    webhooksAPI.getAll().then(r => setHooks(r.data.webhooks || [])).catch(() => {});
  }, []);

  const openNew = () => setEditing({
    name: '', kind, status: 'draft',
    triggerEvent: meta.events[0]?.value || 'lead.status_changed',
    triggerConfig: {}, conditions: [], actions: [],
    scheduleConfig: { delayMinutes: isSchedule ? 60 : 0, cancelIfStatusChanged: true },
  });

  if (editing) {
    return <WorkflowEditor
      kind={kind} initial={editing} meta={meta} users={users} templates={templates} hooks={hooks}
      onClose={() => setEditing(null)}
      onSaved={() => { setEditing(null); load(); }}
    />;
  }

  const filtered = workflows;

  return (
    <div style={{ padding: '24px 28px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.ink }}>{title}</h2>
          <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 14 }}>{subtitle}</p>
        </div>
        <button style={btnPrimary} onClick={openNew}>
          {isSchedule ? 'Create New Schedule' : 'Create Workflow'} +
        </button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 22 }}>
        {[
          { k: 'totalRuns', label: 'Total Runs', color: C.ink },
          { k: 'success', label: 'Success', color: '#059669' },
          { k: 'failed', label: 'Failed', color: '#dc2626' },
        ].map(s => (
          <div key={s.k} style={{ ...card, padding: '18px 20px' }}>
            <div style={{ fontSize: 30, fontWeight: 700, color: s.color }}>
              {s.k === 'success' ? `${summary.totalRuns ? Math.round((summary.success / summary.totalRuns) * 100) : 0}%` : summary[s.k]}
            </div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{s.label} · last 24h</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${C.border}`, marginBottom: 16 }}>
        {['published', 'draft'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', padding: '8px 2px', cursor: 'pointer',
            fontSize: 14, fontWeight: 600, textTransform: 'capitalize',
            color: tab === t ? C.indigo : C.sub,
            borderBottom: tab === t ? `2px solid ${C.indigo}` : '2px solid transparent',
          }}>{t}</button>
        ))}
      </div>

      <input value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search flowchart by Name" style={{ ...inp, marginBottom: 16, maxWidth: 420 }} />

      {loading ? <Spinner /> : (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 140px', padding: '12px 18px', background: '#f9f8ff', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            <span>Name</span><span>Events</span><span>Status</span><span>Updated by</span><span style={{ textAlign: 'right' }}>Actions</span>
          </div>
          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: C.sub }}>No Flowcharts Found</div>
          ) : filtered.map((w, i) => {
            const ev = meta.events.find(e => e.value === w.triggerEvent);
            return (
              <div key={w._id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1.5fr 1fr 1fr 140px', padding: '14px 18px', alignItems: 'center', borderBottom: i < filtered.length - 1 ? `1px solid #f0eef8` : 'none' }}>
                <span style={{ fontWeight: 600, color: C.ink, cursor: 'pointer' }} onClick={() => setEditing(w)}>{w.name}</span>
                <span style={{ fontSize: 13, color: C.sub }}>{ev?.label || w.triggerEvent}</span>
                <span>
                  <StatusToggle status={w.status} onToggle={async () => {
                    await workflowsAPI.setStatus(w._id, w.status === 'published' ? 'draft' : 'published').catch(err => alert(err.response?.data?.message || 'Failed'));
                    load();
                  }} />
                </span>
                <span style={{ fontSize: 13, color: C.sub }}>{w.updatedBy?.name || '—'}</span>
                <span style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button style={{ ...btnGhost, padding: '5px 10px' }} onClick={() => setEditing(w)}>Edit</button>
                  <button style={{ ...btnGhost, padding: '5px 10px', color: '#dc2626', borderColor: '#fecaca' }}
                    onClick={async () => { if (confirm('Delete this flowchart?')) { await workflowsAPI.delete(w._id); load(); } }}>✕</button>
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusToggle({ status, onToggle }) {
  const on = status === 'published';
  return (
    <button onClick={onToggle} title={on ? 'Published — click to unpublish' : 'Draft — click to publish'} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      background: on ? C.indigo : '#d1d5db', position: 'relative', transition: 'background .15s',
    }}>
      <span style={{ position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  );
}

// ── Editor (Editor tab + Executions tab) ─────────────────────────────────────
function WorkflowEditor({ kind, initial, meta, users, templates, hooks, onClose, onSaved }) {
  const isSchedule = kind === 'SCHEDULE';
  const [wf, setWf] = useState(initial);
  const [tab, setTab] = useState('editor');
  const [saving, setSaving] = useState(false);
  const [executions, setExecutions] = useState([]);
  const id = wf._id;

  useEffect(() => {
    if (tab === 'executions' && id) {
      workflowsAPI.getExecutions(id, { limit: 30 }).then(r => setExecutions(r.data.executions)).catch(() => {});
    }
  }, [tab, id]);

  const set = (patch) => setWf(p => ({ ...p, ...patch }));

  const save = async (publish = false) => {
    if (!wf.name.trim()) return alert('Please enter a name');
    setSaving(true);
    try {
      let saved;
      const payload = { ...wf, kind };
      if (id) saved = (await workflowsAPI.update(id, payload)).data.workflow;
      else saved = (await workflowsAPI.create(payload)).data.workflow;
      if (publish) await workflowsAPI.setStatus(saved._id, 'published');
      onSaved();
    } catch (e) {
      alert(e.response?.data?.message || 'Save failed');
    }
    setSaving(false);
  };

  const addAction = () => set({ actions: [...wf.actions, { type: 'notify_team_member', config: {} }] });
  const updateAction = (i, patch) => {
    const next = [...wf.actions];
    next[i] = { ...next[i], ...patch };
    set({ actions: next });
  };
  const removeAction = (i) => set({ actions: wf.actions.filter((_, idx) => idx !== i) });

  return (
    <div style={{ padding: '20px 28px', maxWidth: 920, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={onClose} style={{ ...btnGhost, padding: '6px 12px' }}>←</button>
        <input value={wf.name} onChange={e => set({ name: e.target.value })} placeholder={isSchedule ? 'Schedule Name' : 'Workflow Name'}
          style={{ ...inp, fontWeight: 700, fontSize: 16, maxWidth: 360 }} />
        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: wf.status === 'published' ? '#d1fae5' : '#fef3c7', color: wf.status === 'published' ? '#059669' : '#b45309' }}>
          {wf.status === 'published' ? 'Published' : 'Draft'}
        </span>
        <div style={{ flex: 1 }} />
        <button style={btnGhost} disabled={saving} onClick={() => save(false)}>Save Draft</button>
        <button style={btnPrimary} disabled={saving} onClick={() => save(true)}>{saving ? 'Saving…' : 'Publish'}</button>
      </div>

      <div style={{ display: 'flex', gap: 24, borderBottom: `1px solid ${C.border}`, marginBottom: 20 }}>
        {['editor', 'executions'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            background: 'none', border: 'none', padding: '8px 2px', cursor: 'pointer', fontSize: 14, fontWeight: 600, textTransform: 'capitalize',
            color: tab === t ? C.indigo : C.sub, borderBottom: tab === t ? `2px solid ${C.indigo}` : '2px solid transparent',
          }}>{t}</button>
        ))}
      </div>

      {tab === 'editor' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Trigger */}
          <div style={{ ...card, padding: 18 }}>
            <label style={label}>When this happens (Event)</label>
            <select value={wf.triggerEvent} onChange={e => set({ triggerEvent: e.target.value })} style={inp}>
              {meta.events.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
            {wf.triggerEvent === 'lead.field_changed' && (
              <div style={{ marginTop: 12 }}>
                <label style={label}>Which field?</label>
                <input value={wf.triggerConfig?.field || ''} onChange={e => set({ triggerConfig: { ...wf.triggerConfig, field: e.target.value } })}
                  placeholder="e.g. leadSource, budget, location" style={inp} />
              </div>
            )}
            {isSchedule && (
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={label}>Delay before running (minutes)</label>
                  <input type="number" min="0" value={wf.scheduleConfig?.delayMinutes ?? 0}
                    onChange={e => set({ scheduleConfig: { ...wf.scheduleConfig, delayMinutes: Number(e.target.value) } })} style={inp} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'end', fontSize: 14, color: C.ink }}>
                  <input type="checkbox" checked={!!wf.scheduleConfig?.cancelIfStatusChanged}
                    onChange={e => set({ scheduleConfig: { ...wf.scheduleConfig, cancelIfStatusChanged: e.target.checked } })} />
                  Skip if lead status changed before delay
                </label>
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ ...card, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <label style={{ ...label, margin: 0 }}>Do this… (Actions)</label>
              <button style={btnGhost} onClick={addAction}>+ Add Action</button>
            </div>
            {wf.actions.length === 0 && <div style={{ color: C.sub, fontSize: 13, padding: '8px 0' }}>No actions yet. Add at least one before publishing.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {wf.actions.map((a, i) => (
                <ActionRow key={i} action={a} users={users} templates={templates} hooks={hooks} actionDefs={meta.actions}
                  onChange={patch => updateAction(i, patch)} onRemove={() => removeAction(i)} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <ExecutionsTable executions={executions} hasId={!!id} />
      )}
    </div>
  );
}

function ActionRow({ action, users, templates, hooks, actionDefs, onChange, onRemove }) {
  const def = actionDefs.find(d => d.value === action.type);
  const setCfg = (patch) => onChange({ config: { ...action.config, ...patch } });
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, background: '#fafaff' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <select value={action.type} onChange={e => onChange({ type: e.target.value, config: {} })} style={{ ...inp, maxWidth: 280 }}>
          {actionDefs.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={onRemove} style={{ ...btnGhost, padding: '5px 10px', color: '#dc2626', borderColor: '#fecaca' }}>Remove</button>
      </div>
      <div style={{ marginTop: 10 }}>
        {action.type === 'call_api' && (
          <select value={action.config.apiTemplateId || ''} onChange={e => setCfg({ apiTemplateId: e.target.value })} style={inp}>
            <option value="">Select API Template…</option>
            {templates.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        )}
        {action.type === 'trigger_webhook' && (
          <select value={action.config.webhookId || ''} onChange={e => setCfg({ webhookId: e.target.value })} style={inp}>
            <option value="">Select Webhook…</option>
            {hooks.map(h => <option key={h._id} value={h._id}>{h.name}</option>)}
          </select>
        )}
        {action.type === 'notify_team_member' && (
          <div style={{ display: 'grid', gap: 8 }}>
            <select value={action.config.userId || ''} onChange={e => setCfg({ userId: e.target.value })} style={inp}>
              <option value="">Notify assigned caller (default)</option>
              {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
            <input value={action.config.message || ''} onChange={e => setCfg({ message: e.target.value })}
              placeholder="Message (use {{lead.name}})" style={inp} />
          </div>
        )}
        {action.type === 'update_lead_assignee' && (
          <select value={action.config.userId || ''} onChange={e => setCfg({ userId: e.target.value })} style={inp}>
            <option value="">Select user…</option>
            {users.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
          </select>
        )}
        {action.type === 'update_lead_status' && (
          <select value={action.config.status || ''} onChange={e => setCfg({ status: e.target.value })} style={inp}>
            <option value="">Select status…</option>
            {['Fresh', 'Connected', 'Call Back Later', 'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {action.type === 'update_lead_rating' && (
          <select value={action.config.rating || ''} onChange={e => setCfg({ rating: Number(e.target.value) })} style={inp}>
            <option value="">Select rating…</option>
            {[1, 2, 3, 4, 5].map(r => <option key={r} value={r}>{r} ★</option>)}
          </select>
        )}
        {action.type === 'custom_action' && (
          <input value={action.config.label || ''} onChange={e => setCfg({ label: e.target.value })} placeholder="Custom action label" style={inp} />
        )}
      </div>
    </div>
  );
}

function ExecutionsTable({ executions, hasId }) {
  if (!hasId) return <div style={{ ...card, padding: 40, textAlign: 'center', color: C.sub }}>Save the workflow first to see executions.</div>;
  return (
    <div style={{ ...card, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '12px 18px', background: '#f9f8ff', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.sub, textTransform: 'uppercase' }}>
        <span>Lead</span><span>Status</span><span>Duration</span><span>When</span>
      </div>
      {executions.length === 0 ? <div style={{ padding: 36, textAlign: 'center', color: C.sub }}>No executions found</div>
        : executions.map((ex, i) => (
          <div key={ex._id} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr 1fr', padding: '12px 18px', alignItems: 'center', borderBottom: i < executions.length - 1 ? '1px solid #f0eef8' : 'none', fontSize: 13 }}>
            <span style={{ color: C.ink, fontWeight: 600 }}>{ex.lead?.name || '—'}</span>
            <span><ExBadge status={ex.status} /></span>
            <span style={{ color: C.sub }}>{ex.durationMs ? `${ex.durationMs} ms` : '—'}</span>
            <span style={{ color: C.sub }}>{new Date(ex.createdAt).toLocaleString()}</span>
          </div>
        ))}
    </div>
  );
}

function ExBadge({ status }) {
  const map = {
    success: ['#d1fae5', '#059669'], failed: ['#fee2e2', '#dc2626'],
    pending: ['#e0e7ff', '#4f46e5'], cancelled: ['#f3f4f6', '#6b7280'],
  };
  const [bg, fg] = map[status] || map.pending;
  return <span style={{ background: bg, color: fg, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>;
}