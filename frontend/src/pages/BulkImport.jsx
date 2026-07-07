import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignsAPI, usersAPI } from '../services/api';
import api from '../services/api';

// ── Theme ─────────────────────────────────────────────────────────────────────
const PURPLE = 'var(--theme-primary)';
const PURPLE_LIGHT = 'var(--theme-surface-tint)';
const TEXT_MAIN = 'var(--theme-text-strong)';
const TEXT_MUTED = '#888';
const BORDER = 'var(--theme-border-tint)';
const GREEN = '#22c55e';
const ORANGE = '#f59e0b';
const RED = '#ef4444';

// ── UI Helpers ────────────────────────────────────────────────────────────────
const Step = ({ n, label, active, done }) => (
  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
    <div style={{ width:30, height:30, borderRadius:'50%', background:done?GREEN:active?PURPLE:'var(--theme-border-tint)', color:done||active?'#fff':TEXT_MUTED, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, flexShrink:0 }}>{done?'✓':n}</div>
    <span style={{ fontSize:12, fontWeight:active?700:400, color:active?PURPLE:TEXT_MUTED, whiteSpace:'nowrap' }}>{label}</span>
  </div>
);
const Divider = () => <div style={{ flex:1, height:2, background:BORDER, margin:'0 4px' }} />;
const Card = ({ children, style={} }) => (
  <div style={{ background:'#fff', borderRadius:14, boxShadow:'0 2px 16px rgba(var(--theme-primary-rgb), 0.08)', padding:24, ...style }}>{children}</div>
);
const Btn = ({ children, onClick, disabled, variant='primary', style={} }) => {
  const variants = { primary:{background:'var(--btn-gradient)',color:'#fff'}, outline:{background:'#fff',color:PURPLE,border:`1.5px solid ${PURPLE}`}, danger:{background:RED,color:'#fff'}, success:{background:GREEN,color:'#fff'} };
  return <button onClick={onClick} disabled={disabled} style={{ padding:'10px 24px', borderRadius:8, fontWeight:600, fontSize:14, cursor:disabled?'not-allowed':'pointer', border:'none', opacity:disabled?.5:1, ...variants[variant], ...style }}>{children}</button>;
};
const InfoBox = ({ type='info', children }) => {
  const colors = { info:'#e0f2fe', warning:'#fef9c3', error:'#fee2e2', success:'#dcfce7' };
  const icons = { info:'ℹ️', warning:'⚠️', error:'❌', success:'✅' };
  return <div style={{ background:colors[type], borderRadius:8, padding:'12px 16px', display:'flex', gap:10, alignItems:'flex-start', marginBottom:12 }}><span>{icons[type]}</span><span style={{ fontSize:13, color:TEXT_MAIN }}>{children}</span></div>;
};

// ── Constants ─────────────────────────────────────────────────────────────────
const SYSTEM_FIELDS = [
  { key:'name', label:'Name ★', required:true },
  { key:'phone', label:'Phone Number ★', required:true },
  { key:'email', label:'Email ID' },
  { key:'collegeName', label:'College Name' },
  { key:'alternatePhone', label:'Alternate Phone' },
  { key:'status', label:'Status' },
  { key:'leadSource', label:'Lead Source' },
  { key:'location', label:'Location' },
  { key:'budget', label:'Budget' },
  { key:'lastQualification', label:'Last Qualification' },
  { key:'preferredCourses', label:'Preferred Courses' },
  { key:'nextFollowupDate', label:'Next Followup Date' },
];

const WIZARD_STEPS = [
  { n:1, label:'Sheet Selection' },
  { n:2, label:'Field Mapping' },
  { n:3, label:'Duplicate Checking' },
  { n:4, label:'Campaign & List' },
  { n:5, label:'Lead Distribution' },
];

function autoMap(columns) {
  const norm = s => s.toLowerCase().replace(/[\s_\-\.]+/g,'');
  const rules = [
    { keys:['name','fullname','leadname','candidatename'], field:'name' },
    { keys:['phone','mobile','phonenumber','mobilenumber','contactnumber'], field:'phone' },
    { keys:['email','emailid','emailaddress','mail'], field:'email' },
    { keys:['collegename','college','institution','instname','institutename','school','university'], field:'collegeName' },
    { keys:['alternatephone','altphone','altmobile','phone2'], field:'alternatePhone' },
    { keys:['status','leadstatus'], field:'status' },
    { keys:['leadsource','source'], field:'leadSource' },
    { keys:['location','city','place'], field:'location' },
    { keys:['budget'], field:'budget' },
    { keys:['qualification','lastqualification','education'], field:'lastQualification' },
    { keys:['courses','preferredcourses','course'], field:'preferredCourses' },
  ];
  const mapping = {};
  for (const col of columns) {
    const n = norm(col);
    const match = rules.find(r => r.keys.includes(n));
    mapping[col] = match ? match.field : '';
  }
  return mapping;
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function BulkImport() {
  const navigate = useNavigate();
  const fileRef = useRef();

  // Wizard state
  const [step, setStep] = useState(0);
  const [file, setFile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [callers, setCallers] = useState([]);

  // Keep the browser's Back button inside the Import Leads wizard: without this,
  // pressing Back mid-upload pops the *actual* previous page in history (another
  // module) instead of going to the previous wizard step.
  const poppingRef = useRef(false);
  useEffect(() => {
    window.history.replaceState({ step: 0 }, '');
    const onPopState = (e) => {
      poppingRef.current = true;
      setStep(typeof e.state?.step === 'number' ? e.state.step : 0);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (poppingRef.current) { poppingRef.current = false; return; }
    window.history.pushState({ step }, '');
  }, [step]);

  // Step 1
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState('');
  const [columns, setColumns] = useState([]);
  const [preview, setPreview] = useState([]);
  const [totalRows, setTotalRows] = useState(0);
  const [loadingSheet, setLoadingSheet] = useState(false);

  // Step 2 — field mapping + "Other" custom labels
  const [fieldMapping, setFieldMapping] = useState({});
  const [customLabels, setCustomLabels] = useState({}); // { excelCol: 'myCustomLabel' }
  const [confirmedCustom, setConfirmedCustom] = useState({}); // { excelCol: true } after Enter
  const [savedCustomFields, setSavedCustomFields] = useState([]); // loaded from DB
  const [dupCheckField, setDupCheckField] = useState('phone');

  // Step 3
  const [dupSummary, setDupSummary] = useState(null);
  const [loadingDup, setLoadingDup] = useState(false);
  const [duplicateHandling, setDuplicateHandling] = useState('skip');

  // Step 4
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  // Step 5
  const [selectedCallers, setSelectedCallers] = useState([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  // History
  const [history, setHistory] = useState([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Import leads view
  const [viewingImport, setViewingImport] = useState(null);
  const [importLeads, setImportLeads] = useState([]);
  const [importLeadsTotal, setImportLeadsTotal] = useState(0);
  const [importLeadsPage, setImportLeadsPage] = useState(1);
  const [loadingImportLeads, setLoadingImportLeads] = useState(false);

  // Edit import modal
  const [editImport, setEditImport] = useState(null);
  const [editCampaign, setEditCampaign] = useState('');
  const [editCallers, setEditCallers] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    campaignsAPI.getAll().then(r => setCampaigns(r.data.campaigns || [])).catch(console.error);
    usersAPI.getAll().then(r => { const all = r.data.users||[]; setCallers(all.filter(u=>u.role==='caller'||u.role==='admin')); }).catch(console.error);
    loadHistory(1);
    api.get('/lead-fields').then(r => setSavedCustomFields((r.data.fields || []).map(f => f.name))).catch(console.error);
  }, []);

  const loadHistory = async (page=1) => {
    setLoadingHistory(true);
    try {
      const r = await api.get(`/bulk-import/history?page=${page}&limit=10`);
      setHistory(r.data.records||[]);
      setHistoryTotal(r.data.total||0);
      setHistoryPage(page);
    } catch(e){ console.error(e); }
    setLoadingHistory(false);
  };

  // ── File Handling ──────────────────────────────────────────────────────────
  const handleFile = async (f) => {
    if (!f) return;
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) { alert('Please upload an Excel (.xlsx, .xls) or CSV file'); return; }
    setFile(f); setLoadingSheet(true);
    try {
      const fd = new FormData(); fd.append('file', f);
      const r = await api.post('/bulk-import/parse-file', fd);
      setSheetNames(r.data.sheetNames||[]);
      setSelectedSheet(r.data.defaultSheet||'');
      setColumns(r.data.columns||[]);
      setPreview(r.data.preview||[]);
      setTotalRows(r.data.totalRows||0);
      setFieldMapping(autoMap(r.data.columns||[]));
      setCustomLabels({});
      setStep(1);
    } catch(e){ alert('Failed to parse file: '+(e.response?.data?.message||e.message)); }
    setLoadingSheet(false);
  };

  const handleSheetChange = async (name) => {
    setSelectedSheet(name);
    if (!file || !name) return;
    setLoadingSheet(true);
    try {
      const fd = new FormData(); fd.append('file',file); fd.append('sheetName',name);
      const r = await api.post('/bulk-import/select-sheet', fd);
      setColumns(r.data.columns||[]);
      setPreview(r.data.preview||[]);
      setTotalRows(r.data.totalRows||0);
      setFieldMapping(autoMap(r.data.columns||[]));
      setCustomLabels({});
    } catch(e){ alert(e.response?.data?.message||e.message); }
    setLoadingSheet(false);
  };

  // Build the final fieldMapping to send: replace 'other' with 'custom__<label>'
  const buildFinalMapping = () => {
    const final = {};
    for (const [col, val] of Object.entries(fieldMapping)) {
      if (val === '__other__') {
        const label = (customLabels[col]||'').trim();
        if (label) final[col] = `custom__${label}`;
        else final[col] = '__ignore__';
      } else if (val && val.startsWith('__custom__')) {
        final[col] = `custom__${val.slice(10)}`;
      } else {
        final[col] = val;
      }
    }
    return final;
  };

  // ── Step navigation ────────────────────────────────────────────────────────
  const goToStep2 = () => { if (!selectedSheet) { alert('Please select a sheet'); return; } setStep(2); };

  const goToStep3 = async () => {
    const finalMapping = buildFinalMapping();
    const mappedFields = Object.values(finalMapping).filter(Boolean);
    if (!mappedFields.includes('name')) { alert('Please map the Name column'); return; }
    if (!mappedFields.includes('phone')) { alert('Please map the Phone Number column'); return; }
    setLoadingDup(true);
    try {
      const fd = new FormData(); fd.append('file',file); fd.append('sheetName',selectedSheet); fd.append('fieldMapping',JSON.stringify(finalMapping));
      const r = await api.post('/bulk-import/check-duplicates', fd);
      setDupSummary(r.data); setStep(3);
    } catch(e){ alert(e.response?.data?.message||e.message); }
    setLoadingDup(false);
  };

  const goToStep4 = () => setStep(4);
  const goToStep5 = () => { if (!selectedCampaign) { alert('Please select a campaign'); return; } setStep(5); };

  // ── Create new campaign ────────────────────────────────────────────────────
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) { alert('Enter campaign name'); return; }
    setCreatingCampaign(true);
    try {
      const r = await api.post('/campaigns', { name: newCampaignName.trim(), description:'Created from bulk import' });
      const created = r.data.campaign || r.data;
      setCampaigns(prev => [created, ...prev]);
      setSelectedCampaign(created._id);
      setNewCampaignName('');
      setShowNewCampaign(false);
    } catch(e){ alert(e.response?.data?.message||e.message); }
    setCreatingCampaign(false);
  };

  // ── Caller distribution ────────────────────────────────────────────────────
  const distributeEvenly = (list) => {
    if (!list.length) { setSelectedCallers([]); return; }
    const base = Math.floor(100/list.length), rem = 100-base*list.length;
    setSelectedCallers(list.map((c,i) => ({ ...c, pct:base+(i===list.length-1?rem:0) })));
  };
  const handleAddCaller = (id) => {
    if (!id || selectedCallers.find(c=>c.id===id)) return;
    const u = callers.find(c=>c._id===id); if (!u) return;
    distributeEvenly([...selectedCallers, { id, name:u.name, pct:0 }]);
  };
  const handleRemoveCaller = (id) => distributeEvenly(selectedCallers.filter(c=>c.id!==id));
  const handlePctChange = (id, val) => setSelectedCallers(prev => prev.map(c=>c.id===id?{...c,pct:parseInt(val)||0}:c));
  const totalPct = selectedCallers.reduce((s,c)=>s+c.pct, 0);

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (totalPct !== 100) { alert(`Percentages must total 100% (currently ${totalPct}%)`); return; }
    setImporting(true);
    try {
      const finalMapping = buildFinalMapping();
      const fd = new FormData();
      fd.append('file',file); fd.append('sheetName',selectedSheet);
      fd.append('fieldMapping',JSON.stringify(finalMapping));
      fd.append('campaignId',selectedCampaign);
      fd.append('duplicateHandling',duplicateHandling);
      fd.append('importName',file.name);
      fd.append('callerAssignments',JSON.stringify(selectedCallers.map(c=>({ callerId:c.id, pct:c.pct }))));
      const r = await api.post('/bulk-import/import', fd);
      setResult(r.data); setStep(6); loadHistory(1);
    } catch(e){ alert('Import failed: '+(e.response?.data?.message||e.message)); }
    setImporting(false);
  };

  const resetWizard = () => {
    setStep(0); setFile(null); setSheetNames([]); setSelectedSheet(''); setColumns([]); setPreview([]);
    setTotalRows(0); setFieldMapping({}); setCustomLabels({}); setDupSummary(null);
    setSelectedCampaign(''); setSelectedCallers([]); setResult(null); setViewingImport(null);
    setImportLeads([]); setShowNewCampaign(false); setNewCampaignName('');
    if (fileRef.current) fileRef.current.value='';
  };

  // ── View import leads ──────────────────────────────────────────────────────
  const viewImportLeads = async (record, page=1) => {
    setViewingImport(record); setLoadingImportLeads(true);
    try {
      const r = await api.get(`/bulk-import/history/${record._id}/leads?page=${page}&limit=100`);
      setImportLeads(r.data.leads||[]); setImportLeadsTotal(r.data.total||0); setImportLeadsPage(page);
    } catch(e){ console.error(e); }
    setLoadingImportLeads(false);
  };

  // ── Delete import ──────────────────────────────────────────────────────────
  const handleDeleteImport = async (record) => {
    if (!confirm(`Delete import "${record.importName||record.fileName}" and all ${record.importedRecords||0} leads? This cannot be undone.`)) return;
    try {
      await api.delete(`/bulk-import/history/${record._id}`);
      loadHistory(historyPage);
    } catch(e){ alert(e.response?.data?.message||e.message); }
  };

  // ── Edit import ────────────────────────────────────────────────────────────
  const openEditImport = (record) => {
    setEditImport(record);
    setEditCampaign(record.campaign?._id||'');
    const existing = (record.callerAssignments||[]).map(ca => ({ id:ca.callerId, name:ca.callerName, pct:ca.pct }));
    setEditCallers(existing);
  };
  const handleEditAddCaller = (id) => {
    if (!id || editCallers.find(c=>c.id===id)) return;
    const u = callers.find(c=>c._id===id); if (!u) return;
    const list = [...editCallers, { id, name:u.name, pct:0 }];
    const base=Math.floor(100/list.length), rem=100-base*list.length;
    setEditCallers(list.map((c,i)=>({...c,pct:base+(i===list.length-1?rem:0)})));
  };
  const handleEditRemoveCaller = (id) => {
    const list = editCallers.filter(c=>c.id!==id);
    const base=Math.floor(100/list.length)||0, rem=100-base*list.length;
    setEditCallers(list.map((c,i)=>({...c,pct:base+(i===list.length-1?rem:0)})));
  };
  const editTotalPct = editCallers.reduce((s,c)=>s+c.pct,0);

  const handleSaveEdit = async () => {
    if (editTotalPct !== 100 && editCallers.length) { alert(`Percentages must total 100% (got ${editTotalPct}%)`); return; }
    setSavingEdit(true);
    try {
      await api.put(`/bulk-import/history/${editImport._id}`, {
        ...(editCampaign ? { campaignId:editCampaign } : {}),
        ...(editCallers.length ? { callerAssignments: editCallers.map(c=>({ callerId:c.id, pct:c.pct })) } : {}),
      });
      setEditImport(null); loadHistory(historyPage);
    } catch(e){ alert(e.response?.data?.message||e.message); }
    setSavingEdit(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: Import Leads View
  // ─────────────────────────────────────────────────────────────────────────────
  if (viewingImport) {
    const allCustomKeys = [...new Set(importLeads.flatMap(l => Object.keys(l.customFields||{})))];
    return (
      <div style={{ padding:24, maxWidth:1200, margin:'0 auto' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
          <button onClick={()=>setViewingImport(null)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:22,color:PURPLE }}>←</button>
          <div>
            <h2 style={{ margin:0, color:TEXT_MAIN, fontSize:20 }}>{viewingImport.importName||viewingImport.fileName}</h2>
            <span style={{ fontSize:12, color:TEXT_MUTED }}>
              {new Date(viewingImport.createdAt).toLocaleString()} · {importLeadsTotal} leads · Campaign: {viewingImport.campaign?.name||'—'}
            </span>
          </div>
        </div>
        {loadingImportLeads ? (
          <Card><p style={{ textAlign:'center', color:TEXT_MUTED, padding:40 }}>Loading leads…</p></Card>
        ) : (
          <Card style={{ padding:0, overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ background:PURPLE_LIGHT }}>
                  {['Name','Phone','Email','College','Status','Assigned To', ...allCustomKeys.slice(0,3)].map(h=>(
                    <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:PURPLE, fontWeight:700, whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {importLeads.map((l,i)=>(
                  <tr key={l._id} style={{ borderBottom:`1px solid ${BORDER}`, background:i%2?'#fafafa':'#fff' }}>
                    <td style={{ padding:'10px 14px', fontWeight:600, color:TEXT_MAIN }}>{l.name}</td>
                    <td style={{ padding:'10px 14px', color:TEXT_MUTED }}>{l.phone}</td>
                    <td style={{ padding:'10px 14px', color:TEXT_MUTED }}>{l.email||'—'}</td>
                    <td style={{ padding:'10px 14px', color:TEXT_MUTED }}>{l.collegeName||'—'}</td>
                    <td style={{ padding:'10px 14px' }}><span style={{ background:PURPLE_LIGHT, color:PURPLE, borderRadius:20, padding:'3px 10px', fontSize:12 }}>{l.status}</span></td>
                    <td style={{ padding:'10px 14px', color:TEXT_MUTED }}>{l.assignedTo?.name||'—'}</td>
                    {allCustomKeys.slice(0,3).map(k=>(
                      <td key={k} style={{ padding:'10px 14px', color:TEXT_MUTED, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.customFields?.[k]||'—'}</td>
                    ))}
                  </tr>
                ))}
                {!importLeads.length&&<tr><td colSpan={6+allCustomKeys.slice(0,3).length} style={{ padding:40, textAlign:'center', color:TEXT_MUTED }}>No leads found.</td></tr>}
              </tbody>
            </table>
          </Card>
        )}
        {/* Pagination for import leads */}
        {importLeadsTotal > 100 && (
          <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16, alignItems:'center' }}>
            <span style={{ fontSize:13, color:TEXT_MUTED }}>Showing {((importLeadsPage-1)*100)+1}–{Math.min(importLeadsPage*100,importLeadsTotal)} of {importLeadsTotal}</span>
            {importLeadsPage > 1 && <Btn onClick={()=>viewImportLeads(viewingImport,importLeadsPage-1)} variant="outline" style={{ padding:'6px 14px' }}>← Prev</Btn>}
            {importLeadsPage*100 < importLeadsTotal && <Btn onClick={()=>viewImportLeads(viewingImport,importLeadsPage+1)} variant="primary" style={{ padding:'6px 14px' }}>Next →</Btn>}
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: Success
  // ─────────────────────────────────────────────────────────────────────────────
  if (step===6 && result) {
    return (
      <div style={{ padding:24, maxWidth:700, margin:'0 auto' }}>
        <Card style={{ textAlign:'center' }}>
          <div style={{ fontSize:60, marginBottom:16 }}>🎉</div>
          <h2 style={{ color:GREEN, margin:'0 0 8px' }}>Import Complete!</h2>
          <p style={{ color:TEXT_MUTED, margin:'0 0 24px' }}>Campaign: <strong>{result.campaignName}</strong></p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
            {[{label:'Total Rows',value:result.total,color:TEXT_MAIN},{label:'Imported',value:result.imported,color:GREEN},{label:'Skipped',value:result.skipped,color:ORANGE},{label:'Failed',value:result.errors,color:RED}].map(s=>(
              <div key={s.label} style={{ background:'#f9fafb', borderRadius:10, padding:16 }}>
                <div style={{ fontSize:28, fontWeight:700, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:12, color:TEXT_MUTED }}>{s.label}</div>
              </div>
            ))}
          </div>
          {result.callerBreakdown?.length>0&&(
            <div style={{ marginBottom:24 }}>
              <h4 style={{ color:TEXT_MAIN, margin:'0 0 10px' }}>Lead Distribution</h4>
              {result.callerBreakdown.map(cb=>(
                <div key={cb.callerId} style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'#f9fafb', borderRadius:8, marginBottom:6 }}>
                  <span style={{ fontWeight:600, color:TEXT_MAIN }}>{cb.callerName}</span>
                  <span style={{ color:TEXT_MUTED }}>{cb.count} leads ({cb.pct}%)</span>
                </div>
              ))}
            </div>
          )}
          <InfoBox type="success">Notifications sent to assigned callers via bell icon!</InfoBox>
          <div style={{ display:'flex', gap:12, justifyContent:'center', marginTop:8 }}>
            <Btn onClick={resetWizard} variant="outline">Import More</Btn>
            <Btn onClick={()=>navigate('/leads')} variant="success">View Leads</Btn>
          </div>
        </Card>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: Landing (History)
  // ─────────────────────────────────────────────────────────────────────────────
  if (step===0) {
    return (
      <div style={{ padding:24, maxWidth:1100, margin:'0 auto' }}>
        {/* Upload Zone */}
        <Card style={{ marginBottom:24 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
            <span style={{ fontSize:28 }}>📊</span>
            <h2 style={{ margin:0, color:TEXT_MAIN, fontSize:22 }}>Import Leads</h2>
          </div>
          <div
            onDrop={e=>{ e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
            onDragOver={e=>{ e.preventDefault(); setDragOver(true); }}
            onDragLeave={()=>setDragOver(false)}
            onClick={()=>fileRef.current?.click()}
            style={{ border:`2px dashed ${dragOver?PURPLE:BORDER}`, borderRadius:12, padding:'48px 24px', textAlign:'center', cursor:'pointer', background:dragOver?PURPLE_LIGHT:'var(--theme-surface-faint)', transition:'all .2s' }}
          >
            <div style={{ fontSize:40, marginBottom:12 }}>☁️</div>
            <p style={{ margin:'0 0 4px', fontWeight:600, color:TEXT_MAIN, fontSize:16 }}>{loadingSheet?'Parsing file…':'Click to upload .csv or .xlsx files'}</p>
            <p style={{ margin:'0 0 16px', color:TEXT_MUTED, fontSize:13 }}>(max 100mb and 100k rows/sheet)</p>
            <Btn onClick={e=>{e.stopPropagation();fileRef.current?.click();}} disabled={loadingSheet}>📤 Upload file</Btn>
            <div style={{ marginTop:8 }}><a href="/api/bulk-import/template" style={{ fontSize:12, color:PURPLE }}>⬇ Download sample</a></div>
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e=>handleFile(e.target.files[0])} />
        </Card>

        {/* Import History */}
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <h3 style={{ margin:0, color:TEXT_MAIN }}>Import History</h3>
            <span style={{ fontSize:13, color:TEXT_MUTED }}>{historyTotal} imports</span>
          </div>
          {loadingHistory ? (
            <p style={{ color:TEXT_MUTED, textAlign:'center', padding:32 }}>Loading…</p>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
              <thead>
                <tr style={{ borderBottom:`2px solid ${BORDER}` }}>
                  {['Import Name','File Name','Date','Campaign','Uploaded By','Leads','Status','Actions'].map(h=>(
                    <th key={h} style={{ padding:'10px 12px', textAlign:'left', color:TEXT_MUTED, fontWeight:600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((rec,i)=>(
                  <tr key={rec._id} style={{ borderBottom:`1px solid ${BORDER}`, background:i%2?'#fafafa':'#fff' }}>
                    <td style={{ padding:'10px 12px', color:TEXT_MAIN, fontWeight:600 }}>{rec.importName||rec.fileName}</td>
                    <td style={{ padding:'10px 12px', color:TEXT_MUTED, maxWidth:140, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{rec.fileName}</td>
                    <td style={{ padding:'10px 12px', color:TEXT_MUTED }}>{new Date(rec.createdAt).toLocaleDateString()}</td>
                    <td style={{ padding:'10px 12px', color:TEXT_MUTED }}>{rec.campaign?.name||'—'}</td>
                    <td style={{ padding:'10px 12px', color:TEXT_MUTED }}>{rec.uploadedBy?.name||'—'}</td>
                    <td style={{ padding:'10px 12px' }}>
                      <span onClick={()=>viewImportLeads(rec)} style={{ color:PURPLE, fontWeight:600, cursor:'pointer', textDecoration:'underline' }}>{rec.importedRecords??'—'}</span>
                    </td>
                    <td style={{ padding:'10px 12px' }}>
                      <span style={{ background:rec.status==='completed'?'#dcfce7':rec.status==='failed'?'#fee2e2':'#fef9c3', color:rec.status==='completed'?'#16a34a':rec.status==='failed'?RED:'#92400e', borderRadius:20, padding:'3px 10px', fontSize:12, fontWeight:600 }}>{rec.status}</span>
                    </td>
                    <td style={{ padding:'10px 12px', display:'flex', gap:8 }}>
                      <button onClick={()=>viewImportLeads(rec)} title="View leads" style={{ background:PURPLE_LIGHT, border:'none', borderRadius:6, color:PURPLE, cursor:'pointer', padding:'5px 9px', fontSize:14 }}>🔍</button>
                      <button onClick={()=>openEditImport(rec)} title="Edit / Reassign" style={{ background:'#e0f2fe', border:'none', borderRadius:6, color:'#0369a1', cursor:'pointer', padding:'5px 9px', fontSize:14 }}>✏️</button>
                      <button onClick={()=>handleDeleteImport(rec)} title="Delete import & leads" style={{ background:'#fee2e2', border:'none', borderRadius:6, color:RED, cursor:'pointer', padding:'5px 9px', fontSize:14 }}>🗑️</button>
                    </td>
                  </tr>
                ))}
                {!history.length&&<tr><td colSpan={7} style={{ padding:32, textAlign:'center', color:TEXT_MUTED }}>No imports yet.</td></tr>}
              </tbody>
            </table>
          )}
          {historyTotal>10&&(
            <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:16 }}>
              {Array.from({length:Math.ceil(historyTotal/10)},(_,i)=>i+1).map(p=>(
                <button key={p} onClick={()=>loadHistory(p)} style={{ width:32, height:32, borderRadius:6, border:`1px solid ${BORDER}`, background:p===historyPage?PURPLE:'#fff', color:p===historyPage?'#fff':TEXT_MAIN, cursor:'pointer', fontWeight:600, fontSize:13 }}>{p}</button>
              ))}
            </div>
          )}
        </Card>

        {/* Edit Import Modal */}
        {editImport&&(
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ background:'#fff', borderRadius:14, padding:28, width:500, maxWidth:'95vw', maxHeight:'90vh', overflowY:'auto' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
                <h3 style={{ margin:0, color:TEXT_MAIN }}>Edit Import</h3>
                <button onClick={()=>setEditImport(null)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:20, color:TEXT_MUTED }}>✕</button>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:TEXT_MUTED, textTransform:'uppercase', marginBottom:6 }}>Campaign</div>
                <select value={editCampaign} onChange={e=>setEditCampaign(e.target.value)}
                  style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13 }}>
                  <option value="">Keep current ({editImport.campaign?.name||'—'})</option>
                  {campaigns.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:12, fontWeight:600, color:TEXT_MUTED, textTransform:'uppercase', marginBottom:6 }}>Reassign Callers</div>
                <select onChange={e=>{handleEditAddCaller(e.target.value);e.target.value='';}}
                  style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13, marginBottom:10 }}>
                  <option value="">Add a caller…</option>
                  {callers.filter(c=>!editCallers.find(s=>s.id===c._id)).map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                {editCallers.map(c=>(
                  <div key={c.id} style={{ display:'grid', gridTemplateColumns:'1fr 80px 32px', gap:8, alignItems:'center', marginBottom:8 }}>
                    <span style={{ fontWeight:600, color:TEXT_MAIN, fontSize:13 }}>{c.name}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                      <input type="number" min={0} max={100} value={c.pct} onChange={e=>setEditCallers(prev=>prev.map(ec=>ec.id===c.id?{...ec,pct:parseInt(e.target.value)||0}:ec))}
                        style={{ width:52, padding:'6px 8px', border:`1px solid ${BORDER}`, borderRadius:6, fontSize:13, textAlign:'center' }} />
                      <span style={{ fontSize:12, color:TEXT_MUTED }}>%</span>
                    </div>
                    <button onClick={()=>handleEditRemoveCaller(c.id)} style={{ background:'#fee2e2', border:'none', borderRadius:6, color:RED, cursor:'pointer', padding:'4px 8px' }}>✕</button>
                  </div>
                ))}
                {editCallers.length>0&&(
                  <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:editTotalPct===100?'#dcfce7':'#fff7ed', borderRadius:8, marginTop:8 }}>
                    <span style={{ fontSize:13, fontWeight:600 }}>Total</span>
                    <span style={{ fontWeight:700, color:editTotalPct===100?GREEN:ORANGE }}>{editTotalPct}%</span>
                  </div>
                )}
              </div>
              <InfoBox type="warning">Saving will reassign all leads from this import to the new callers/campaign and send notifications.</InfoBox>
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <Btn onClick={()=>setEditImport(null)} variant="outline">Cancel</Btn>
                <Btn onClick={handleSaveEdit} disabled={savingEdit||(editCallers.length>0&&editTotalPct!==100)} variant="primary">{savingEdit?'Saving…':'Save Changes'}</Btn>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Render: Wizard Steps
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:24, maxWidth:1000, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:24 }}>
        <span style={{ fontSize:28 }}>📊</span>
        <h2 style={{ margin:0, color:TEXT_MAIN, fontSize:22 }}>Import Leads</h2>
      </div>

      {/* Step Indicator */}
      <Card style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center' }}>
          {WIZARD_STEPS.map((s,i)=>(
            <div key={s.n} style={{ display:'flex', alignItems:'center', flex:i<WIZARD_STEPS.length-1?1:'unset' }}>
              <Step n={s.n} label={s.label} active={step===s.n} done={step>s.n} />
              {i<WIZARD_STEPS.length-1&&<Divider/>}
            </div>
          ))}
        </div>
      </Card>

      {/* ── Step 1: Sheet Selection ─────────────────────────────────────── */}
      {step===1&&(
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <div>
              <div style={{ fontSize:12, color:TEXT_MUTED, fontWeight:600, textTransform:'uppercase', marginBottom:4 }}>File name</div>
              <div style={{ fontWeight:600, color:TEXT_MAIN }}>{file?.name}</div>
            </div>
            <button onClick={resetWizard} style={{ background:'none', border:'none', color:PURPLE, cursor:'pointer', fontWeight:600, fontSize:13 }}>Change File</button>
          </div>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, color:TEXT_MUTED, fontWeight:600, textTransform:'uppercase', marginBottom:6 }}>Select sheet</div>
            <p style={{ fontSize:12, color:TEXT_MUTED, margin:'0 0 8px' }}>Which sheet would you like to create leads from?</p>
            <select value={selectedSheet} onChange={e=>handleSheetChange(e.target.value)}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13, color:TEXT_MAIN, background:'#fff' }}>
              <option value="">Select the sheet to create leads</option>
              {sheetNames.map(s=><option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {loadingSheet&&<p style={{ color:TEXT_MUTED, fontSize:13 }}>Loading sheet data…</p>}
          {columns.length>0&&(
            <div>
              <div style={{ fontSize:12, color:TEXT_MUTED, fontWeight:600, textTransform:'uppercase', marginBottom:8 }}>Preview ({totalRows} rows, {columns.length} columns)</div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', fontSize:12, width:'100%' }}>
                  <thead>
                    <tr style={{ background:PURPLE_LIGHT }}>
                      {columns.slice(0,8).map(c=><th key={c} style={{ padding:'8px 12px', textAlign:'left', color:PURPLE, fontWeight:600, whiteSpace:'nowrap' }}>{c}</th>)}
                      {columns.length>8&&<th style={{ padding:'8px 12px', color:TEXT_MUTED }}>+{columns.length-8} more</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0,3).map((row,i)=>(
                      <tr key={i} style={{ borderBottom:`1px solid ${BORDER}` }}>
                        {columns.slice(0,8).map(c=><td key={c} style={{ padding:'8px 12px', color:TEXT_MUTED, maxWidth:120, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{String(row[c]??'')}</td>)}
                        {columns.length>8&&<td style={{ padding:'8px 12px', color:TEXT_MUTED }}>…</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:24 }}>
            <Btn onClick={()=>setStep(0)} variant="outline">← Back</Btn>
            <Btn onClick={goToStep2} disabled={!selectedSheet||loadingSheet}>Next →</Btn>
          </div>
        </Card>
      )}

      {/* ── Step 2: Field Mapping ──────────────────────────────────────── */}
      {step===2&&(
        <Card>
          <InfoBox type="info">Map your Excel columns to system fields. <strong>Name</strong> and <strong>Phone Number</strong> are required. Choose <em>"Other (Custom)"</em> to define your own field name.</InfoBox>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', border:`1px solid ${BORDER}`, borderRadius:10, marginBottom:20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:20 }}>⚡</span>
              <div>
                <div style={{ fontWeight:600, color:TEXT_MAIN, fontSize:14 }}>Lead Source</div>
                <div style={{ fontSize:12, color:TEXT_MUTED }}>Source of imported leads</div>
              </div>
            </div>
            <div style={{ background:'#f0f9ff', borderRadius:8, padding:'6px 12px', fontSize:13, color:'#0369a1', fontWeight:600 }}>📊 Excel</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'16px 1fr 1fr 32px', gap:8, marginBottom:8, alignItems:'center' }}>
            <div/>
            <div style={{ fontSize:11, fontWeight:700, color:TEXT_MUTED, textTransform:'uppercase', letterSpacing:1 }}>📊 EXCEL COLUMN</div>
            <div style={{ fontSize:11, fontWeight:700, color:PURPLE, textTransform:'uppercase', letterSpacing:1 }}>🔷 SYSTEM FIELD</div>
            <div/>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
            {columns.map(col=>{
              const mapped = fieldMapping[col]||'';
              const isOther = mapped==='__other__';
              const isMapped = !!mapped && mapped!=='__ignore__';
              return (
                <div key={col}>
                  <div style={{ display:'grid', gridTemplateColumns:'16px 1fr 1fr 32px', gap:8, alignItems:'center' }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:isMapped?GREEN:BORDER, margin:'0 auto' }}/>
                    <div style={{ padding:'10px 14px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13, color:TEXT_MAIN, background:'#fafafa', fontWeight:500 }}>{col}</div>
                    <select value={mapped} onChange={e=>setFieldMapping(prev=>({...prev,[col]:e.target.value}))}
                      style={{ padding:'10px 12px', border:`1.5px solid ${isMapped?(mapped==='name'||mapped==='phone'?PURPLE:GREEN):BORDER}`, borderRadius:8, fontSize:13, color:TEXT_MAIN, background:'#fff', width:'100%' }}>
                      <option value="">[ Select Field To Map ]</option>
                      <option value="__ignore__">— Ignore this column —</option>
                      {SYSTEM_FIELDS.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}
                      {savedCustomFields.map(name=><option key={name} value={`__custom__${name}`}>✏️ {name}</option>)}
                      <option value="__other__">✏️ Other (Custom field…)</option>
                    </select>
                    <span style={{ fontSize:16, textAlign:'center' }}>{isMapped?'✅':'ℹ️'}</span>
                  </div>
                  {isOther&&(
                    <div style={{ marginLeft:24, marginTop:6, display:'flex', alignItems:'center', gap:8 }}>
                      {confirmedCustom[col] ? (
                        <div style={{ flex:1, padding:'8px 12px', border:`1.5px solid ${GREEN}`, borderRadius:8, fontSize:13, color:TEXT_MAIN, background:'#f0fdf4', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                          <span>✅ {customLabels[col]}</span>
                          <span onClick={()=>{ setConfirmedCustom(prev=>({...prev,[col]:false})); }} style={{ cursor:'pointer', fontSize:11, color:TEXT_MUTED, marginLeft:8 }}>✎ edit</span>
                        </div>
                      ) : (
                        <input
                          placeholder="Enter custom field name, press Enter to save"
                          value={customLabels[col]||''}
                          onChange={e=>setCustomLabels(prev=>({...prev,[col]:e.target.value}))}
                          onKeyDown={async e=>{
                            if(e.key==='Enter'){
                              const name=(customLabels[col]||'').trim();
                              if(!name) return;
                              setConfirmedCustom(prev=>({...prev,[col]:true}));
                              if(!savedCustomFields.includes(name)){
                                try{
                                  await api.post('/lead-fields',{name,type:'text'});
                                  setSavedCustomFields(prev=>[...prev,name]);
                                }catch(err){ console.warn('Could not save custom field:',err.message); }
                              }
                            }
                          }}
                          style={{ flex:1, padding:'8px 12px', border:`1.5px solid ${ORANGE}`, borderRadius:8, fontSize:13, color:TEXT_MAIN }}
                        />
                      )}
                      <span style={{ fontSize:12, color:TEXT_MUTED }}>→ stored as custom field</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:16, marginBottom:20 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontWeight:600, color:TEXT_MAIN, fontSize:14 }}>Check duplicates on</div>
                <div style={{ fontSize:12, color:TEXT_MUTED }}>This will help to prevent duplicate lead creation</div>
              </div>
              <select value={dupCheckField} onChange={e=>setDupCheckField(e.target.value)}
                style={{ padding:'8px 12px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13 }}>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between' }}>
            <Btn onClick={()=>setStep(1)} variant="outline">← Back</Btn>
            <Btn onClick={goToStep3} disabled={loadingDup}>{loadingDup?'Checking…':'Next →'}</Btn>
          </div>
        </Card>
      )}

      {/* ── Step 3: Duplicate Checking ──────────────────────────────────── */}
      {step===3&&dupSummary&&(
        <Card>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
            <div>
              <div style={{ fontWeight:700, color:TEXT_MAIN, fontSize:15 }}>File errors</div>
              <div style={{ fontSize:12, color:TEXT_MUTED }}>Duplicated or empty values for Phone</div>
            </div>
          </div>
          <InfoBox type={dupSummary.fileErrorRows===0?'success':'warning'}>
            {dupSummary.fileErrorRows===0?'0 Errors! No duplicate or empty rows found in uploaded file.':`${dupSummary.fileErrorRows} row(s) with duplicate or empty phone numbers within the file.`}
          </InfoBox>
          <InfoBox type="info">Proceeding with {dupSummary.uniqueInFile} leads from original excel sheet with {dupSummary.totalRows} leads.</InfoBox>
          <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:16, marginBottom:12, marginTop:16 }}>
            <div style={{ fontWeight:700, color:TEXT_MAIN, fontSize:15, marginBottom:4 }}>TeleCRM duplicates</div>
            <div style={{ fontSize:12, color:TEXT_MUTED, marginBottom:12 }}>Leads from the file which are already present in TeleCRM based on Phone</div>
          </div>
          {dupSummary.crmDuplicates===0?(
            <InfoBox type="info">Proceed to create {dupSummary.uniqueCount} leads from excel sheet</InfoBox>
          ):(
            <div style={{ background:'#fffbeb', border:`1px solid ${ORANGE}`, borderRadius:10, padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:12 }}>
                <span>⚠️</span>
                <span style={{ fontWeight:700, color:'#92400e' }}>Warning! found {dupSummary.crmDuplicates} duplicate from Phone, from {dupSummary.uniqueInFile} entrie(s) in excel</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="dupHandling" checked={duplicateHandling==='skip'} onChange={()=>setDuplicateHandling('skip')} />
                  Continue with <strong>{dupSummary.uniqueCount}</strong> unique rows only
                  <span style={{ background:'#dcfce7', color:'#16a34a', borderRadius:20, padding:'2px 8px', fontSize:11, fontWeight:700 }}>Recommended</span>
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="dupHandling" checked={duplicateHandling==='add'} onChange={()=>setDuplicateHandling('add')} />
                  Add Duplicate To CRM.
                </label>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:13 }}>
                  <input type="radio" name="dupHandling" checked={duplicateHandling==='reset'} onChange={()=>setDuplicateHandling('reset')} />
                  Delete {dupSummary.crmDuplicates} duplicates from TeleCRM and create {dupSummary.crmDuplicates} new leads from excel (RESET)
                </label>
                {Object.keys(dupSummary.crmDupByStatus||{}).length>0&&(
                  <div style={{ marginTop:8, paddingLeft:24 }}>
                    {Object.entries(dupSummary.crmDupByStatus).map(([status,count])=>(
                      <div key={status} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, fontSize:12 }}>
                        <input type="checkbox" disabled />
                        <span>Reset <strong>{count} duplicate leads</strong> of</span>
                        <span style={{ background:PURPLE_LIGHT, color:PURPLE, borderRadius:20, padding:'2px 8px', fontSize:11 }}>{status}</span>
                        <span>status</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:24 }}>
            <Btn onClick={()=>setStep(2)} variant="outline">← Back</Btn>
            <Btn onClick={goToStep4}>Next →</Btn>
          </div>
        </Card>
      )}

      {/* ── Step 4: Campaign & List ────────────────────────────────────── */}
      {step===4&&(
        <Card>
          <h3 style={{ margin:'0 0 20px', color:TEXT_MAIN }}>Campaign & List Configuration</h3>
          <InfoBox type="info">Select the campaign to associate imported leads with.</InfoBox>
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:12, fontWeight:600, color:TEXT_MUTED, textTransform:'uppercase', marginBottom:6 }}>CAMPAIGN <span style={{ color:RED }}>*</span></div>
            <select value={selectedCampaign} onChange={e=>{ if(e.target.value==='__new__'){setShowNewCampaign(true);} else setSelectedCampaign(e.target.value); }}
              style={{ width:'100%', padding:'10px 12px', border:`1.5px solid ${selectedCampaign?PURPLE:BORDER}`, borderRadius:8, fontSize:13, color:TEXT_MAIN }}>
              <option value="">Select Campaign</option>
              {campaigns.map(c=><option key={c._id} value={c._id}>{c.name}</option>)}
              <option value="__new__">➕ Create New Campaign…</option>
            </select>
          </div>
          {showNewCampaign&&(
            <div style={{ background:'#f9fafb', borderRadius:10, padding:16, marginBottom:16 }}>
              <div style={{ fontSize:13, fontWeight:600, color:TEXT_MAIN, marginBottom:10 }}>New Campaign</div>
              <input placeholder="Campaign name" value={newCampaignName} onChange={e=>setNewCampaignName(e.target.value)}
                style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13, marginBottom:10, boxSizing:'border-box' }} />
              <div style={{ display:'flex', gap:8 }}>
                <Btn onClick={handleCreateCampaign} disabled={creatingCampaign} variant="success">{creatingCampaign?'Creating…':'Create Campaign'}</Btn>
                <Btn onClick={()=>{setShowNewCampaign(false);setNewCampaignName('');}} variant="outline">Cancel</Btn>
              </div>
            </div>
          )}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:24 }}>
            <Btn onClick={()=>setStep(3)} variant="outline">← Back</Btn>
            <Btn onClick={goToStep5} disabled={!selectedCampaign}>Next →</Btn>
          </div>
        </Card>
      )}

      {/* ── Step 5: Lead Distribution ──────────────────────────────────── */}
      {step===5&&(
        <Card>
          <h3 style={{ margin:'0 0 20px', color:TEXT_MAIN }}>Lead Distribution</h3>
          <InfoBox type="info">Assign callers and set percentage. Total must equal 100%. Assigned callers will receive a notification.</InfoBox>
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, fontWeight:600, color:TEXT_MUTED, textTransform:'uppercase', marginBottom:6 }}>Add Caller</div>
            <select onChange={e=>{handleAddCaller(e.target.value);e.target.value='';}}
              style={{ width:'100%', padding:'10px 12px', border:`1px solid ${BORDER}`, borderRadius:8, fontSize:13 }}>
              <option value="">Select a caller to add…</option>
              {callers.filter(c=>!selectedCallers.find(s=>s.id===c._id)).map(c=><option key={c._id} value={c._id}>{c.name} ({c.role})</option>)}
            </select>
          </div>
          {selectedCallers.length>0&&(
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:16 }}>
              {selectedCallers.map(c=>(
                <div key={c.id} style={{ display:'grid', gridTemplateColumns:'1fr 120px 36px', gap:10, alignItems:'center', padding:'12px 16px', border:`1px solid ${BORDER}`, borderRadius:10 }}>
                  <div>
                    <div style={{ fontWeight:600, color:TEXT_MAIN, fontSize:14 }}>{c.name}</div>
                    <div style={{ fontSize:12, color:TEXT_MUTED }}>~{Math.round((c.pct/100)*(dupSummary?.uniqueCount||totalRows))} leads</div>
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <input type="number" min={0} max={100} value={c.pct} onChange={e=>handlePctChange(c.id,e.target.value)}
                      style={{ width:65, padding:'6px 8px', border:`1px solid ${BORDER}`, borderRadius:6, fontSize:13, textAlign:'center' }}/>
                    <span style={{ fontSize:13, color:TEXT_MUTED }}>%</span>
                  </div>
                  <button onClick={()=>handleRemoveCaller(c.id)} style={{ background:'#fee2e2', border:'none', borderRadius:6, color:RED, cursor:'pointer', fontSize:16, padding:'4px 8px' }}>✕</button>
                </div>
              ))}
              <div style={{ padding:'10px 16px', background:totalPct===100?'#dcfce7':'#fff7ed', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span style={{ fontWeight:600, fontSize:13 }}>Total</span>
                <span style={{ fontWeight:700, color:totalPct===100?GREEN:ORANGE, fontSize:14 }}>{totalPct}%</span>
              </div>
              {totalPct!==100&&<InfoBox type="warning">Percentages must total 100%. Current: {totalPct}%</InfoBox>}
            </div>
          )}
          {!selectedCallers.length&&<InfoBox type="warning">Please add at least one caller.</InfoBox>}
          <div style={{ display:'flex', justifyContent:'space-between', marginTop:24 }}>
            <Btn onClick={()=>setStep(4)} variant="outline">← Back</Btn>
            <Btn onClick={handleImport} disabled={importing||!selectedCallers.length||totalPct!==100} variant="success">
              {importing?'⏳ Importing…':'🚀 Start Import'}
            </Btn>
          </div>
        </Card>
      )}
    </div>
  );
}