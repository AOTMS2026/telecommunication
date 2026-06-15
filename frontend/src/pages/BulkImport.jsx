import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { campaignsAPI, usersAPI } from '../services/api';
import api from '../services/api';

const PURPLE = '#5b3fc7';
const PURPLE_LIGHT = '#f0ecff';
const TEXT_MAIN = '#2d2d6b';
const TEXT_MUTED = '#888';
const BORDER = '#e5e2f5';

// ── tiny helpers ──────────────────────────────────────────────────────────────
const Step = ({ n, label, active, done }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: done ? '#22c55e' : active ? PURPLE : '#e5e2f5',
      color: done || active ? '#fff' : TEXT_MUTED,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 700, fontSize: 13,
    }}>
      {done ? '✓' : n}
    </div>
    <span style={{ fontSize: 13, fontWeight: active ? 700 : 400, color: active ? PURPLE : TEXT_MUTED }}>{label}</span>
  </div>
);

const Divider = () => <div style={{ flex: 1, height: 1, background: BORDER, margin: '0 8px' }} />;

const Card = ({ children, style = {} }) => (
  <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 2px 16px rgba(91,63,199,0.08)', padding: 24, ...style }}>
    {children}
  </div>
);

const Label = ({ children, required }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
    {children}{required && <span style={{ color: '#ef4444', marginLeft: 3 }}>*</span>}
  </div>
);

const Select = ({ value, onChange, children, style = {}, error }) => (
  <select
    value={value}
    onChange={onChange}
    style={{
      width: '100%', padding: '9px 12px', border: `1px solid ${error ? '#ef4444' : BORDER}`,
      borderRadius: 8, fontSize: 13, color: TEXT_MAIN, background: '#fff',
      outline: 'none', cursor: 'pointer', ...style,
    }}
  >
    {children}
  </select>
);

export default function BulkImport() {
  const navigate = useNavigate();
  const fileRef = useRef();

  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [callers, setCallers] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedCallers, setSelectedCallers] = useState([]); // array of {id, name, pct}
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState({});

  // Create campaign modal
  const [showCreateCampaign, setShowCreateCampaign] = useState(false);
  const [newCampaignName, setNewCampaignName] = useState('');
  const [newCampaignDesc, setNewCampaignDesc] = useState('');
  const [creatingCampaign, setCreatingCampaign] = useState(false);

  useEffect(() => {
    campaignsAPI.getAll().then(r => setCampaigns(r.data.campaigns || [])).catch(console.error);
    usersAPI.getAll().then(r => {
      const all = r.data.users || [];
      setCallers(all.filter(u => u.role === 'caller' || u.role === 'admin'));
    }).catch(console.error);
  }, []);

  // ── File handling ──────────────────────────────────────────────────────────
  const handleFile = (f) => {
    if (!f) return;
    const ok = f.name.match(/\.(xlsx|xls|csv)$/i);
    if (!ok) { alert('Please upload an Excel (.xlsx, .xls) or CSV file'); return; }
    setFile(f);
    setStep(2);
    setPreview(null);
    setResult(null);
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    handleFile(f);
  };

  // ── Create Campaign ────────────────────────────────────────────────────────
  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) return;
    setCreatingCampaign(true);
    try {
      const res = await api.post('/campaigns', { name: newCampaignName.trim(), description: newCampaignDesc.trim() });
      const created = res.data.campaign;
      setCampaigns(prev => [created, ...prev]);
      setSelectedCampaign(created._id);
      setShowCreateCampaign(false);
      setNewCampaignName('');
      setNewCampaignDesc('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create campaign');
    } finally {
      setCreatingCampaign(false);
    }
  };

  // ── Caller multi-select ────────────────────────────────────────────────────
  const toggleCaller = (caller) => {
    setSelectedCallers(prev => {
      const exists = prev.find(c => c.id === caller._id);
      if (exists) {
        const updated = prev.filter(c => c.id !== caller._id);
        return redistributePct(updated);
      } else {
        const updated = [...prev, { id: caller._id, name: caller.name, role: caller.role, pct: 0 }];
        return redistributePct(updated);
      }
    });
  };

  const redistributePct = (list) => {
    if (!list.length) return list;
    const base = Math.floor(100 / list.length);
    const remainder = 100 - base * list.length;
    return list.map((c, i) => ({ ...c, pct: base + (i === 0 ? remainder : 0) }));
  };

  const updatePct = (id, val) => {
    const num = Math.max(0, Math.min(100, parseInt(val) || 0));
    setSelectedCallers(prev => prev.map(c => c.id === id ? { ...c, pct: num } : c));
  };

  const totalPct = selectedCallers.reduce((s, c) => s + c.pct, 0);

  // ── Validate ───────────────────────────────────────────────────────────────
  const validate = () => {
    const errs = {};
    if (!selectedCampaign) errs.campaign = 'Please select a campaign';
    if (!selectedCallers.length) errs.callers = 'Please select at least one caller';
    if (selectedCallers.length > 0 && totalPct !== 100) errs.pct = `Percentages must total 100% (currently ${totalPct}%)`;
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  // ── Preview ────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!validate()) return;
    if (!file) return;
    setLoadingPreview(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/bulk-import/preview', fd);
      setPreview(res.data);
      setStep(3);
    } catch (err) {
      alert(err.response?.data?.message || 'Preview failed');
    } finally {
      setLoadingPreview(false);
    }
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!validate()) return;
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('campaignId', selectedCampaign);
      fd.append('callerAssignments', JSON.stringify(selectedCallers.map(c => ({ callerId: c.id, pct: c.pct }))));
      fd.append('skipDuplicates', String(skipDuplicates));
      const res = await api.post('/bulk-import/import', fd);
      setResult(res.data);
      setStep(4);
    } catch (err) {
      alert(err.response?.data?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ── Download template ──────────────────────────────────────────────────────
  const handleTemplate = () => {
    const token = localStorage.getItem('aotms_token');
    const base = (import.meta.env.VITE_API_URL || '/api').replace(/\/api\/?$/, '');
    fetch(`${base}/api/bulk-import/template`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob);
      const a2 = document.createElement('a');
      a2.href = url; a2.download = 'leads-import-template.xlsx';
      a2.click(); URL.revokeObjectURL(url);
    });
  };

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setFile(null); setStep(1); setPreview(null); setResult(null);
    setSelectedCampaign(''); setSelectedCallers([]); setErrors({});
  };

  const stepDone = (n) => step > n;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
      <style>{`
        @keyframes floatSheet { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-8px)} }
        @keyframes rowSlideIn { 0%{opacity:0;transform:translateX(-12px)} 100%{opacity:1;transform:translateX(0)} }
        @keyframes pulse-ring { 0%{box-shadow:0 0 0 0 rgba(91,63,199,.18)} 70%{box-shadow:0 0 0 14px rgba(91,63,199,0)} 100%{box-shadow:0 0 0 0 rgba(91,63,199,0)} }
        @keyframes arrowBounce { 0%,100%{transform:translateY(0);opacity:.7} 50%{transform:translateY(5px);opacity:1} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .bulk-drop-zone:hover .excel-sheet{animation:floatSheet 1.6s ease-in-out infinite!important}
        .bulk-drop-zone:hover{border-color:${PURPLE}!important;background:${PURPLE_LIGHT}!important}
        .caller-chip{transition:all .18s;cursor:pointer}
        .caller-chip:hover{transform:translateY(-1px);box-shadow:0 4px 12px rgba(91,63,199,.15)}
        .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;z-index:1000;animation:fadeIn .2s}
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontWeight: 800, fontSize: 22, color: TEXT_MAIN }}>Bulk Import Leads</h1>
          <p style={{ margin: '4px 0 0', color: TEXT_MUTED, fontSize: 13 }}>Upload Excel or CSV · assign to campaign & caller · import to MongoDB</p>
        </div>
        <button
          onClick={handleTemplate}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: `1.5px solid ${PURPLE}`, borderRadius: 8, background: PURPLE_LIGHT, color: PURPLE, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
        >
          ↓ Download Template
        </button>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        <Step n={1} label="Upload File" active={step === 1} done={stepDone(1)} />
        <Divider />
        <Step n={2} label="Configure" active={step === 2} done={stepDone(2)} />
        <Divider />
        <Step n={3} label="Preview" active={step === 3} done={stepDone(3)} />
        <Divider />
        <Step n={4} label="Done" active={step === 4} done={false} />
      </div>

      {/* ── STEP 1: Upload ── */}
      {step === 1 && (
        <Card>
          <div
            className="bulk-drop-zone"
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? PURPLE : BORDER}`,
              borderRadius: 14, padding: '36px 24px 28px', textAlign: 'center',
              cursor: 'pointer', background: dragOver ? PURPLE_LIGHT : '#fafafa',
              transition: 'all 0.25s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
              <div style={{ position: 'relative', width: 110, height: 90 }}>
                <div style={{ position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: 70, height: 8, background: 'rgba(91,63,199,0.10)', borderRadius: '50%' }} />
                <svg className="excel-sheet" style={{ animation: 'floatSheet 2.4s ease-in-out infinite', position: 'relative', zIndex: 2 }}
                  width="110" height="82" viewBox="0 0 110 82" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="8" y="4" width="94" height="74" rx="7" fill="white" stroke="#e5e2f5" strokeWidth="1.5"/>
                  <rect x="8" y="4" width="94" height="18" rx="7" fill="#217346"/>
                  <rect x="8" y="14" width="94" height="8" fill="#217346"/>
                  <text x="17" y="17" fontSize="11" fontWeight="800" fill="white" fontFamily="Arial">X</text>
                  <text x="29" y="17" fontSize="8" fontWeight="600" fill="rgba(255,255,255,0.85)" fontFamily="Arial">leads.xlsx</text>
                  <rect x="8" y="22" width="94" height="11" fill="#f0ecff"/>
                  {[16,38,60,82].map((x,i) => (
                    <text key={i} x={x} y="31" fontSize="7" fontWeight="700" fill={PURPLE} fontFamily="Arial">{['Name','Phone','Email','Camp'][i]}</text>
                  ))}
                  {[0,1,2,3].map(row => (
                    <g key={row} style={{ animation: `rowSlideIn 0.4s ease ${0.1+row*0.12}s both` }}>
                      <rect x="8" y={33+row*11} width="94" height="11" fill={row%2===0?'white':'#fafafa'}/>
                      {[16,38,60,82].map((x,col) => (
                        <rect key={col} x={x} y={36+row*11} width={col===0?18:col===1?18:col===2?18:14} height="5" rx="2" fill={col===0?'#d1c4f7':'#e8e8e8'}/>
                      ))}
                    </g>
                  ))}
                  <rect x="8" y="77" width="94" height="1" fill="#e5e2f5"/>
                </svg>
                <div style={{ position:'absolute',top:-10,right:6,width:26,height:26,borderRadius:'50%',background:PURPLE,display:'flex',alignItems:'center',justifyContent:'center',animation:'pulse-ring 2s ease-out infinite',zIndex:3 }}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 9.5V3.5M6.5 3.5L4 6M6.5 3.5L9 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: TEXT_MAIN, marginBottom: 6 }}>Drag & drop your Excel / CSV file here</div>
            <div style={{ color: TEXT_MUTED, fontSize: 12, marginBottom: 18 }}>or click to browse · Supports .xlsx, .xls, .csv · Max 10 MB</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 4 }}>
              {[{label:'.XLSX',color:'#217346',bg:'#e8f5ee'},{label:'.XLS',color:'#1a5c38',bg:'#d9f0e5'},{label:'.CSV',color:'#5b3fc7',bg:'#f0ecff'}].map(f => (
                <span key={f.label} style={{ padding:'3px 10px',borderRadius:20,fontSize:11,fontWeight:700,background:f.bg,color:f.color,letterSpacing:.5,border:`1px solid ${f.color}22` }}>{f.label}</span>
              ))}
            </div>
            <div style={{ marginTop: 14, animation: 'arrowBounce 1.6s ease-in-out infinite', color: PURPLE, fontSize: 18 }}>↓</div>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={e => handleFile(e.target.files[0])} />
          </div>
          <div style={{ display:'flex',gap:0,marginTop:18,borderTop:`1px solid ${BORDER}`,paddingTop:16 }}>
            {[{icon:'📁',title:'Upload File',desc:'Drop your Excel or CSV'},{icon:'⚙️',title:'Configure',desc:'Assign campaign & callers'},{icon:'👁',title:'Preview',desc:'Review before import'},{icon:'✅',title:'Done',desc:'Leads saved to database'}].map((item,i,arr) => (
              <div key={i} style={{ flex:1,textAlign:'center',padding:'0 8px',borderRight:i<arr.length-1?`1px solid ${BORDER}`:'none' }}>
                <div style={{ fontSize:18,marginBottom:4 }}>{item.icon}</div>
                <div style={{ fontSize:11,fontWeight:700,color:TEXT_MAIN }}>{item.title}</div>
                <div style={{ fontSize:10,color:TEXT_MUTED,marginTop:2 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── STEP 2 & 3: Configure ── */}
      {step >= 2 && step <= 3 && (
        <Card style={{ marginTop: 0 }}>
          {/* File info row */}
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,padding:'10px 14px',background:PURPLE_LIGHT,borderRadius:8 }}>
            <div style={{ display:'flex',alignItems:'center',gap:10 }}>
              <div style={{ width:36,height:36,background:'#217346',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                <span style={{ fontSize:18,fontWeight:900,color:'#fff',fontFamily:'Arial',lineHeight:1 }}>X</span>
              </div>
              <div>
                <div style={{ fontWeight:700,fontSize:13,color:TEXT_MAIN }}>{file?.name}</div>
                <div style={{ fontSize:11,color:TEXT_MUTED }}>{file?(file.size/1024).toFixed(1)+' KB · Ready to import':''}</div>
              </div>
            </div>
            <button onClick={reset} style={{ background:'none',border:'none',cursor:'pointer',color:TEXT_MUTED,fontSize:18 }}>✕</button>
          </div>

          {/* Campaign */}
          <div style={{ marginBottom: 20 }}>
            <Label required>Assign to Campaign</Label>
            <div style={{ display:'flex',gap:8 }}>
              <div style={{ flex:1 }}>
                <Select
                  value={selectedCampaign}
                  onChange={e => { if(e.target.value==='__create__'){setShowCreateCampaign(true);}else{setSelectedCampaign(e.target.value);} }}
                  error={errors.campaign}
                >
                  <option value="">— Select Campaign —</option>
                  <option value="__create__" style={{ color:PURPLE,fontWeight:600 }}>+ Create New Campaign</option>
                  {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </Select>
                {errors.campaign && <div style={{ color:'#ef4444',fontSize:11,marginTop:4 }}>{errors.campaign}</div>}
              </div>
              <button
                onClick={() => setShowCreateCampaign(true)}
                style={{ padding:'9px 14px',borderRadius:8,border:`1.5px solid ${PURPLE}`,background:PURPLE_LIGHT,color:PURPLE,fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap' }}
              >+ New</button>
            </div>
          </div>

          {/* Callers multi-select */}
          <div style={{ marginBottom: 20 }}>
            <Label required>Assign to Callers</Label>
            <div style={{ border:`1px solid ${errors.callers?'#ef4444':BORDER}`,borderRadius:10,padding:12,background:'#fafafa' }}>
              {/* Select All */}
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
                <span style={{ fontSize:12,color:TEXT_MUTED }}>Select callers to distribute leads</span>
                <div style={{ display:'flex',gap:8 }}>
                  <button
                    onClick={() => setSelectedCallers(redistributePct(callers.map(c => ({id:c._id,name:c.name,role:c.role,pct:0}))))}
                    style={{ fontSize:11,padding:'3px 10px',borderRadius:6,border:`1px solid ${PURPLE}`,background:PURPLE_LIGHT,color:PURPLE,cursor:'pointer',fontWeight:600 }}
                  >Select All</button>
                  <button
                    onClick={() => setSelectedCallers([])}
                    style={{ fontSize:11,padding:'3px 10px',borderRadius:6,border:`1px solid ${BORDER}`,background:'#fff',color:TEXT_MUTED,cursor:'pointer' }}
                  >Clear</button>
                </div>
              </div>
              {/* Caller chips */}
              <div style={{ display:'flex',flexWrap:'wrap',gap:8,marginBottom:selectedCallers.length?12:0 }}>
                {callers.map(caller => {
                  const sel = selectedCallers.find(c => c.id === caller._id);
                  return (
                    <div
                      key={caller._id}
                      className="caller-chip"
                      onClick={() => toggleCaller(caller)}
                      style={{
                        display:'flex',alignItems:'center',gap:6,
                        padding:'6px 12px',borderRadius:20,fontSize:12,fontWeight:600,
                        border:`1.5px solid ${sel?PURPLE:BORDER}`,
                        background:sel?PURPLE_LIGHT:'#fff',
                        color:sel?PURPLE:TEXT_MAIN,
                        userSelect:'none',
                      }}
                    >
                      <div style={{ width:20,height:20,borderRadius:'50%',background:sel?PURPLE:'#e5e2f5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,color:sel?'#fff':TEXT_MUTED,fontWeight:700 }}>
                        {caller.name[0].toUpperCase()}
                      </div>
                      {caller.name}
                      <span style={{ fontSize:10,opacity:.7 }}>({caller.role})</span>
                      {sel && <span style={{ fontSize:14,color:PURPLE }}>✓</span>}
                    </div>
                  );
                })}
              </div>

              {/* Percentage sliders */}
              {selectedCallers.length > 0 && (
                <div style={{ borderTop:`1px solid ${BORDER}`,paddingTop:12 }}>
                  <div style={{ fontSize:11,fontWeight:600,color:TEXT_MUTED,marginBottom:8 }}>
                    LEAD DISTRIBUTION &nbsp;
                    <span style={{ color:totalPct===100?'#22c55e':'#ef4444',fontWeight:700 }}>({totalPct}% total — must equal 100%)</span>
                  </div>
                  {selectedCallers.map((caller) => (
                    <div key={caller.id} style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                      <div style={{ width:26,height:26,borderRadius:'50%',background:PURPLE,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#fff',fontWeight:700,flexShrink:0 }}>
                        {caller.name[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize:12,color:TEXT_MAIN,minWidth:100,fontWeight:600 }}>{caller.name}</span>
                      <input
                        type="range" min="0" max="100" value={caller.pct}
                        onChange={e => updatePct(caller.id, e.target.value)}
                        style={{ flex:1,accentColor:PURPLE }}
                      />
                      <div style={{ display:'flex',alignItems:'center',gap:4 }}>
                        <input
                          type="number" min="0" max="100" value={caller.pct}
                          onChange={e => updatePct(caller.id, e.target.value)}
                          style={{ width:52,padding:'4px 6px',borderRadius:6,border:`1px solid ${BORDER}`,fontSize:12,textAlign:'center',color:TEXT_MAIN,outline:'none' }}
                        />
                        <span style={{ fontSize:12,color:TEXT_MUTED }}>%</span>
                      </div>
                    </div>
                  ))}
                  {errors.pct && <div style={{ color:'#ef4444',fontSize:11,marginTop:4 }}>{errors.pct}</div>}
                </div>
              )}
            </div>
            {errors.callers && <div style={{ color:'#ef4444',fontSize:11,marginTop:4 }}>{errors.callers}</div>}
          </div>

          {/* Skip duplicates */}
          <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:20,padding:'10px 14px',border:`1px solid ${BORDER}`,borderRadius:8 }}>
            <input
              type="checkbox" id="skipDups" checked={skipDuplicates}
              onChange={e => setSkipDuplicates(e.target.checked)}
              style={{ accentColor:PURPLE,width:16,height:16,cursor:'pointer' }}
            />
            <label htmlFor="skipDups" style={{ cursor:'pointer',fontSize:13,color:TEXT_MAIN }}>
              Skip duplicate phone numbers (recommended)
            </label>
          </div>

          <div style={{ display:'flex',gap:10 }}>
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              style={{ flex:1,padding:'10px',border:'none',borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',background:'#f0f0f0',color:TEXT_MAIN }}
            >
              {loadingPreview?'Loading...':'👁 Preview Data'}
            </button>
            <button
              onClick={handleImport}
              disabled={importing||loadingPreview}
              style={{ flex:2,padding:'10px',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',background:PURPLE,color:'#fff' }}
            >
              {importing?'Importing...':'⬆ Import to Database'}
            </button>
          </div>
        </Card>
      )}

      {/* ── STEP 3: Preview table ── */}
      {step === 3 && preview && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14 }}>
            <div style={{ fontWeight:700,fontSize:14,color:TEXT_MAIN }}>
              Preview — first 5 rows (total: <span style={{ color:PURPLE }}>{preview.totalRows}</span>)
            </div>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
              <thead>
                <tr>
                  {preview.columns.slice(0,10).map(col => (
                    <th key={col} style={{ padding:'8px 10px',background:PURPLE_LIGHT,color:PURPLE,fontWeight:700,textAlign:'left',whiteSpace:'nowrap',borderBottom:`2px solid ${BORDER}` }}>{col}</th>
                  ))}
                  {preview.columns.length>10 && <th style={{ padding:'8px 10px',background:PURPLE_LIGHT,color:TEXT_MUTED }}>+{preview.columns.length-10} more</th>}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row,i) => (
                  <tr key={i} style={{ background:i%2===0?'#fff':'#fafafa' }}>
                    {preview.columns.slice(0,10).map(col => (
                      <td key={col} style={{ padding:'7px 10px',borderBottom:`1px solid ${BORDER}`,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{String(row[col]||'—')}</td>
                    ))}
                    {preview.columns.length>10 && <td style={{ padding:'7px 10px',borderBottom:`1px solid ${BORDER}`,color:TEXT_MUTED }}>…</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ display:'flex',gap:10,marginTop:16 }}>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{ flex:1,padding:'11px',border:'none',borderRadius:8,fontSize:14,fontWeight:700,cursor:'pointer',background:PURPLE,color:'#fff' }}
            >
              {importing?'⏳ Importing...':`⬆ Import ${preview.totalRows} Leads`}
            </button>
          </div>
        </Card>
      )}

      {/* ── STEP 4: Result ── */}
      {step === 4 && result && (
        <Card style={{ animation: 'fadeIn .4s ease' }}>
          {/* Header */}
          <div style={{ display:'flex',alignItems:'center',gap:16,marginBottom:24,padding:'20px 24px',background:'linear-gradient(135deg,#5b3fc7 0%,#7c5ee8 100%)',borderRadius:12,color:'#fff' }}>
            <div style={{ width:52,height:52,borderRadius:'50%',background:'rgba(255,255,255,.18)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0 }}>
              {result.imported > 0 ? '✓' : '⚠'}
            </div>
            <div>
              <div style={{ fontWeight:800,fontSize:20,marginBottom:2 }}>
                {result.imported > 0 ? 'Import Successful' : 'Import Complete'}
              </div>
              <div style={{ fontSize:13,opacity:.85 }}>
                {result.imported} of {result.total} leads imported successfully
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:20 }}>
            {[
              { label:'Total Rows',value:result.total,color:TEXT_MAIN,icon:'📋',bg:'#f8f8ff' },
              { label:'Imported',value:result.imported,color:'#16a34a',icon:'✅',bg:'#f0fdf4' },
              { label:'Skipped',value:result.skipped,color:'#d97706',icon:'⏭',bg:'#fffbeb' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign:'center',padding:'18px 8px',background:stat.bg,borderRadius:10,border:`1px solid ${BORDER}` }}>
                <div style={{ fontSize:18,marginBottom:4 }}>{stat.icon}</div>
                <div style={{ fontSize:30,fontWeight:800,color:stat.color,lineHeight:1 }}>{stat.value}</div>
                <div style={{ fontSize:12,color:TEXT_MUTED,marginTop:4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Caller distribution */}
          {result.callerBreakdown && result.callerBreakdown.length > 0 && (
            <div style={{ marginBottom:16,border:`1px solid ${BORDER}`,borderRadius:10,overflow:'hidden' }}>
              <div style={{ padding:'10px 14px',background:PURPLE_LIGHT,fontWeight:700,fontSize:12,color:PURPLE,textTransform:'uppercase',letterSpacing:.5 }}>
                Lead Distribution by Caller
              </div>
              {result.callerBreakdown.map((cb,i) => (
                <div key={i} style={{ display:'flex',alignItems:'center',gap:12,padding:'10px 14px',borderTop:i?`1px solid ${BORDER}`:'none',background:'#fff' }}>
                  <div style={{ width:32,height:32,borderRadius:'50%',background:PURPLE,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',fontWeight:700,flexShrink:0 }}>
                    {cb.callerName?.[0]?.toUpperCase()||'?'}
                  </div>
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontWeight:600,fontSize:13,color:TEXT_MAIN }}>{cb.callerName}</div>
                    <div style={{ height:6,background:'#e5e2f5',borderRadius:3,marginTop:4,overflow:'hidden' }}>
                      <div style={{ height:'100%',background:PURPLE,borderRadius:3,width:`${cb.pct}%`,transition:'width .6s ease' }} />
                    </div>
                  </div>
                  <div style={{ textAlign:'right',flexShrink:0 }}>
                    <div style={{ fontWeight:700,fontSize:14,color:TEXT_MAIN }}>{cb.count}</div>
                    <div style={{ fontSize:11,color:TEXT_MUTED }}>{cb.pct}%</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Campaign info */}
          {result.campaignName && (
            <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 14px',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,marginBottom:12,fontSize:13,color:'#166534' }}>
              <span style={{ fontSize:16 }}>📁</span>
              <span>Added to campaign: <strong>{result.campaignName}</strong></span>
            </div>
          )}

          {/* Errors */}
          {result.errors?.length > 0 && (
            <div style={{ background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:12,marginBottom:16 }}>
              <div style={{ fontWeight:700,fontSize:12,color:'#c2410c',marginBottom:6 }}>⚠ {result.errors.length} rows had errors</div>
              {result.errors.slice(0,5).map((e,i) => (
                <div key={i} style={{ fontSize:12,color:'#9a3412' }}>Row {e.row}: {e.reason}</div>
              ))}
              {result.errors.length>5 && <div style={{ fontSize:12,color:TEXT_MUTED }}>…and {result.errors.length-5} more</div>}
            </div>
          )}

          <div style={{ display:'flex',gap:10,marginTop:4 }}>
            <button onClick={reset} style={{ flex:1,padding:'11px',border:`1.5px solid ${BORDER}`,borderRadius:8,fontSize:13,fontWeight:600,cursor:'pointer',background:'#fff',color:TEXT_MAIN }}>
              Import Another File
            </button>
            <button onClick={() => navigate('/leads')} style={{ flex:1,padding:'11px',border:'none',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',background:PURPLE,color:'#fff' }}>
              View Leads →
            </button>
          </div>
        </Card>
      )}

      {/* ── Create Campaign Modal ── */}
      {showCreateCampaign && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget&&setShowCreateCampaign(false)}>
          <div style={{ background:'#fff',borderRadius:16,padding:28,width:420,boxShadow:'0 20px 60px rgba(91,63,199,.2)',animation:'fadeIn .25s' }}>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
              <div style={{ fontWeight:800,fontSize:17,color:TEXT_MAIN }}>Create New Campaign</div>
              <button onClick={() => setShowCreateCampaign(false)} style={{ background:'none',border:'none',cursor:'pointer',fontSize:20,color:TEXT_MUTED,lineHeight:1 }}>✕</button>
            </div>
            <div style={{ marginBottom:14 }}>
              <Label required>Campaign Name</Label>
              <input
                type="text"
                value={newCampaignName}
                onChange={e => setNewCampaignName(e.target.value)}
                placeholder="e.g. Summer Batch 2026"
                autoFocus
                style={{ width:'100%',padding:'9px 12px',border:`1px solid ${BORDER}`,borderRadius:8,fontSize:13,color:TEXT_MAIN,outline:'none',boxSizing:'border-box' }}
              />
            </div>
            <div style={{ marginBottom:20 }}>
              <Label>Description (optional)</Label>
              <textarea
                value={newCampaignDesc}
                onChange={e => setNewCampaignDesc(e.target.value)}
                placeholder="Brief description..."
                rows={2}
                style={{ width:'100%',padding:'9px 12px',border:`1px solid ${BORDER}`,borderRadius:8,fontSize:13,color:TEXT_MAIN,outline:'none',resize:'vertical',boxSizing:'border-box' }}
              />
            </div>
            <div style={{ display:'flex',gap:10 }}>
              <button onClick={() => setShowCreateCampaign(false)} style={{ flex:1,padding:'10px',borderRadius:8,border:`1px solid ${BORDER}`,background:'#fff',color:TEXT_MAIN,fontSize:13,fontWeight:600,cursor:'pointer' }}>
                Cancel
              </button>
              <button
                onClick={handleCreateCampaign}
                disabled={!newCampaignName.trim()||creatingCampaign}
                style={{ flex:2,padding:'10px',borderRadius:8,border:'none',background:PURPLE,color:'#fff',fontSize:13,fontWeight:700,cursor:'pointer',opacity:!newCampaignName.trim()||creatingCampaign?.5:1 }}
              >
                {creatingCampaign?'Creating...':'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}