import { useState, useEffect } from 'react';
import { billingAPI } from '../services/api';

const BLUE = 'var(--theme-primary)'; const BLUE_L = 'var(--theme-surface-tint)'; const ORANGE = '#f97316';
const TEXT = '#1e293b'; const MUTED = '#64748b'; const BORDER = 'var(--theme-border-tint)';

const STATUS_COLORS = {
  Successful: { bg:'#dcfce7', color:'#16a34a' },
  Failed:     { bg:'#fee2e2', color:'#dc2626' },
  Cancelled:  { bg:'#fef3c7', color:'#d97706' },
  Processing: { bg:'#dbeafe', color:'#2563eb' },
  'Pending Payment': { bg:'#f3f4f6', color:'#6b7280' },
};

function StatusBadge({ status }) {
  const s = STATUS_COLORS[status] || { bg:'#f3f4f6', color:'#6b7280' };
  return <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:20, background:s.bg, color:s.color }}>{status}</span>;
}

function AddBillingModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ country:'India', companyName:'', address:'', address2:'', pincode:'', email:'', phone:'' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k,v) => setForm(f=>({...f,[k]:v}));
  const save = async () => {
    if (!form.companyName||!form.address||!form.pincode||!form.email||!form.phone) { setErr('Please fill all required fields.'); return; }
    setSaving(true); setErr('');
    try { await billingAPI.addInfo(form); onSaved(); } catch(e) { setErr(e?.response?.data?.error||'Failed to save.'); } finally { setSaving(false); }
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:16, width:480, maxHeight:'90vh', overflowY:'auto', padding:32, position:'relative' }}>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, background:'none', border:'none', cursor:'pointer', color:MUTED }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <h2 style={{ fontSize:18, fontWeight:700, color:TEXT, marginBottom:20 }}>Add Billing Information</h2>
        {err && <div style={{ color:'#dc2626', fontSize:13, marginBottom:12 }}>{err}</div>}
        {[
          { label:'Country (required)', key:'country', type:'select', options:['India','USA','UK','Australia','Canada','Singapore','UAE'] },
          { label:'Registered Name of the Company (required)', key:'companyName' },
          { label:'Address (required)', key:'address' },
          { label:'Address Line 2', key:'address2', required:false },
          { label:'Pincode (required)', key:'pincode' },
          { label:'Email (required)', key:'email', type:'email' },
          { label:'Phone (required)', key:'phone' },
        ].map(f => (
          <div key={f.key} style={{ marginBottom:14 }}>
            <label style={{ fontSize:12, color:MUTED, display:'block', marginBottom:4 }}>{f.label}</label>
            {f.type==='select'
              ? <select value={form[f.key]} onChange={e=>set(f.key,e.target.value)} style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13, color:TEXT }}>
                  {f.options.map(o=><option key={o}>{o}</option>)}
                </select>
              : <input type={f.type||'text'} value={form[f.key]} onChange={e=>set(f.key,e.target.value)}
                  style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13, color:TEXT, boxSizing:'border-box' }} />
            }
          </div>
        ))}
        <button onClick={save} disabled={saving} style={{ width:'100%', padding:'12px', background:BLUE, color:'#fff', border:'none', borderRadius:8, fontWeight:700, fontSize:14, cursor:'pointer', marginTop:8 }}>
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </div>
    </div>
  );
}

export default function Billing() {
  const [tab, setTab] = useState('transactions');
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [hasBilling, setHasBilling] = useState(false);
  const [statusFilter, setStatusFilter] = useState([]);
  const [cycleFilter, setCycleFilter] = useState('');
  const [showStatusDrop, setShowStatusDrop] = useState(false);
  const STATUSES = ['Successful','Failed','Cancelled','Processing','Pending Payment'];
  const CYCLES = ['Monthly','Quarterly','Annually'];

  const loadTransactions = async () => {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter.length) params.status = statusFilter.join(',');
      if (cycleFilter) params.cycle = cycleFilter;
      const res = await billingAPI.getTransactions(params);
      setTransactions(res.data.transactions||[]);
      setHasBilling(true);
    } catch(e) {
      if (e?.response?.status===404||e?.response?.status===400) setHasBilling(false);
      setTransactions([]);
    } finally { setLoading(false); }
  };

  useEffect(()=>{ loadTransactions(); }, [statusFilter, cycleFilter]);

  const fmtDate = d => d ? new Date(d).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—';
  const fmtAmt = a => a ? `₹${Number(a).toLocaleString('en-IN')}` : '—';

  return (
    <div style={{ padding:'28px 32px', maxWidth:1100, margin:'0 auto' }}>
      {showAddModal && <AddBillingModal onClose={()=>setShowAddModal(false)} onSaved={()=>{ setShowAddModal(false); loadTransactions(); }} />}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:700, color:TEXT, margin:0 }}>Billing</h1>
          <p style={{ fontSize:13, color:MUTED, margin:'4px 0 0' }}>Manage your billing information</p>
        </div>
        <button onClick={()=>setShowAddModal(true)} style={{ display:'flex', alignItems:'center', gap:6, background:BLUE, color:'#fff', border:'none', borderRadius:8, padding:'9px 18px', fontWeight:600, fontSize:13, cursor:'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Buy Licenses
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, borderBottom:`2px solid ${BORDER}`, marginBottom:24 }}>
        {['transactions'].map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{ padding:'10px 18px', border:'none', background:'none', cursor:'pointer', fontSize:13, fontWeight:tab===t?700:400, color:tab===t?BLUE:MUTED, borderBottom:tab===t?`2px solid ${BLUE}`:'2px solid transparent', marginBottom:-2 }}>
            Transaction History
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        {/* Status filter */}
        <div style={{ position:'relative' }}>
          <button onClick={()=>setShowStatusDrop(s=>!s)} style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:`1px solid ${BORDER}`, borderRadius:8, background:'#fff', fontSize:13, cursor:'pointer', color:TEXT }}>
            {statusFilter.length ? statusFilter.map(s=><StatusBadge key={s} status={s}/>) : <span style={{color:MUTED}}>Status</span>}
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showStatusDrop && (
            <div style={{ position:'absolute', top:'110%', left:0, background:'#fff', border:`1px solid ${BORDER}`, borderRadius:10, boxShadow:'0 4px 20px rgba(0,0,0,0.1)', zIndex:50, minWidth:200, padding:8 }}>
              <input placeholder="Search..." style={{ width:'100%', padding:'6px 10px', border:`1px solid ${BORDER}`, borderRadius:6, fontSize:12, marginBottom:6, boxSizing:'border-box' }} readOnly />
              {STATUSES.map(s=>(
                <div key={s} onClick={()=>setStatusFilter(f=>f.includes(s)?f.filter(x=>x!==s):[...f,s])}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, cursor:'pointer', background:statusFilter.includes(s)?BLUE_L:'transparent' }}>
                  <input type="checkbox" readOnly checked={statusFilter.includes(s)} style={{ accentColor:BLUE }} />
                  <StatusBadge status={s} />
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Billing cycle filter */}
        <select value={cycleFilter} onChange={e=>setCycleFilter(e.target.value)} style={{ padding:'8px 14px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13, color:cycleFilter?TEXT:MUTED, background:'#fff', cursor:'pointer' }}>
          <option value="">Billing Cycle</option>
          {CYCLES.map(c=><option key={c} value={c}>{c}</option>)}
        </select>
        {(statusFilter.length||cycleFilter) ? (
          <button onClick={()=>{setStatusFilter([]);setCycleFilter('');}} style={{ padding:'8px 14px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:12, color:MUTED, background:'#fff', cursor:'pointer' }}>Clear</button>
        ):null}
      </div>

      {/* Table */}
      <div style={{ background:'#fff', border:`1px solid ${BORDER}`, borderRadius:12, overflow:'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:BLUE_L, borderBottom:`1px solid ${BORDER}` }}>
              {['Order ID','Date','Amount','Billing Cycle','Status','Actions'].map(h=>(
                <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontWeight:600, color:BLUE, fontSize:12 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:48, color:MUTED }}>
                <div style={{ width:28, height:28, border:`3px solid ${BORDER}`, borderTopColor:BLUE, borderRadius:'50%', animation:'spin 0.8s linear infinite', margin:'0 auto 10px' }} />
                Loading...
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </td></tr>
            ) : transactions.length===0 ? (
              <tr><td colSpan={6} style={{ textAlign:'center', padding:64, color:MUTED }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={BORDER} strokeWidth="1.5" style={{ display:'block', margin:'0 auto 12px' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                No transactions found!
                {!hasBilling && <div style={{ marginTop:12 }}><button onClick={()=>setShowAddModal(true)} style={{ background:BLUE, color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', cursor:'pointer', fontWeight:600, fontSize:13 }}>+ Add Billing Information</button></div>}
              </td></tr>
            ) : transactions.map((t,i)=>(
              <tr key={t._id||i} style={{ borderBottom:`1px solid ${BORDER}`, transition:'background 0.1s' }} onMouseEnter={e=>e.currentTarget.style.background=BLUE_L} onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <td style={{ padding:'12px 16px', fontWeight:600, color:BLUE }}>{t.orderId||'—'}</td>
                <td style={{ padding:'12px 16px', color:MUTED }}>{fmtDate(t.date||t.createdAt)}</td>
                <td style={{ padding:'12px 16px', fontWeight:600, color:TEXT }}>{fmtAmt(t.amount)}</td>
                <td style={{ padding:'12px 16px', color:MUTED }}>{t.billingCycle||'—'}</td>
                <td style={{ padding:'12px 16px' }}><StatusBadge status={t.status||'Processing'} /></td>
                <td style={{ padding:'12px 16px' }}>
                  {t.invoiceUrl && <a href={t.invoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize:12, color:BLUE, fontWeight:600 }}>Download Invoice</a>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}