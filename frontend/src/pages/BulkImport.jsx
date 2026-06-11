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

const Label = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 600, color: TEXT_MUTED, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
    {children}
  </div>
);

const Select = ({ value, onChange, children, style = {} }) => (
  <select
    value={value}
    onChange={onChange}
    style={{
      width: '100%', padding: '9px 12px', border: `1px solid ${BORDER}`,
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

  const [step, setStep] = useState(1); // 1=upload 2=configure 3=preview 4=done
  const [file, setFile] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [callers, setCallers] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState('');
  const [selectedCaller, setSelectedCaller] = useState('');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [preview, setPreview] = useState(null); // { columns, preview, totalRows }
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  // Load campaigns & callers
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

  // ── Preview ────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
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
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      if (selectedCampaign) fd.append('campaignId', selectedCampaign);
      if (selectedCaller) fd.append('callerId', selectedCaller);
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
    const a = document.createElement('a');
    a.href = `${base}/api/bulk-import/template`;
    a.download = 'leads-import-template.xlsx';
    // add auth header via fetch blob instead
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
    setSelectedCampaign(''); setSelectedCaller('');
  };

  const stepDone = (n) => step > n;

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '24px 16px' }}>
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
      {step >= 1 && step <= 1 && (
        <Card>
          <div
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragOver ? PURPLE : BORDER}`,
              borderRadius: 12, padding: '48px 24px', textAlign: 'center',
              cursor: 'pointer', background: dragOver ? PURPLE_LIGHT : '#fafafa',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: 15, color: TEXT_MAIN, marginBottom: 6 }}>
              Drag & drop your file here
            </div>
            <div style={{ color: TEXT_MUTED, fontSize: 13 }}>
              or click to browse · Supports .xlsx, .xls, .csv · Max 10 MB
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files[0])}
            />
          </div>
        </Card>
      )}

      {/* ── STEP 2: Configure ── */}
      {step >= 2 && step <= 3 && (
        <Card style={{ marginTop: 0 }}>
          {/* File info row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '10px 14px', background: PURPLE_LIGHT, borderRadius: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 22 }}>📄</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, color: TEXT_MAIN }}>{file?.name}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED }}>{file ? (file.size / 1024).toFixed(1) + ' KB' : ''}</div>
              </div>
            </div>
            <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: TEXT_MUTED, fontSize: 18 }}>✕</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <Label>Assign to Campaign (optional)</Label>
              <Select value={selectedCampaign} onChange={e => setSelectedCampaign(e.target.value)}>
                <option value="">— No Campaign —</option>
                {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Assign to Caller (optional)</Label>
              <Select value={selectedCaller} onChange={e => setSelectedCaller(e.target.value)}>
                <option value="">— No Caller —</option>
                {callers.map(u => <option key={u._id} value={u._id}>{u.name} ({u.role})</option>)}
              </Select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, padding: '10px 14px', border: `1px solid ${BORDER}`, borderRadius: 8 }}>
            <input
              type="checkbox"
              id="skipDups"
              checked={skipDuplicates}
              onChange={e => setSkipDuplicates(e.target.checked)}
              style={{ accentColor: PURPLE, width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="skipDups" style={{ cursor: 'pointer', fontSize: 13, color: TEXT_MAIN }}>
              Skip duplicate phone numbers (recommended)
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#f0f0f0', color: TEXT_MAIN }}
            >
              {loadingPreview ? 'Loading...' : '👁 Preview Data'}
            </button>
            <button
              onClick={handleImport}
              disabled={importing || loadingPreview}
              style={{ flex: 2, padding: '10px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: PURPLE, color: '#fff' }}
            >
              {importing ? 'Importing...' : '⬆ Import to Database'}
            </button>
          </div>
        </Card>
      )}

      {/* ── STEP 3: Preview table ── */}
      {step === 3 && preview && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: TEXT_MAIN }}>
              Preview — first 5 rows (total: <span style={{ color: PURPLE }}>{preview.totalRows}</span>)
            </div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr>
                  {preview.columns.slice(0, 10).map(col => (
                    <th key={col} style={{ padding: '8px 10px', background: PURPLE_LIGHT, color: PURPLE, fontWeight: 700, textAlign: 'left', whiteSpace: 'nowrap', borderBottom: `2px solid ${BORDER}` }}>
                      {col}
                    </th>
                  ))}
                  {preview.columns.length > 10 && <th style={{ padding: '8px 10px', background: PURPLE_LIGHT, color: TEXT_MUTED }}>+{preview.columns.length - 10} more</th>}
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    {preview.columns.slice(0, 10).map(col => (
                      <td key={col} style={{ padding: '7px 10px', borderBottom: `1px solid ${BORDER}`, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {String(row[col] || '—')}
                      </td>
                    ))}
                    {preview.columns.length > 10 && <td style={{ padding: '7px 10px', borderBottom: `1px solid ${BORDER}`, color: TEXT_MUTED }}>…</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={handleImport}
              disabled={importing}
              style={{ flex: 1, padding: '11px', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', background: PURPLE, color: '#fff' }}
            >
              {importing ? '⏳ Importing...' : `⬆ Import ${preview.totalRows} Leads`}
            </button>
          </div>
        </Card>
      )}

      {/* ── STEP 4: Result ── */}
      {step === 4 && result && (
        <Card>
          <div style={{ textAlign: 'center', padding: '12px 0 20px' }}>
            <div style={{ fontSize: 52 }}>🎉</div>
            <div style={{ fontWeight: 800, fontSize: 20, color: TEXT_MAIN, marginTop: 8 }}>Import Complete!</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Rows', value: result.total, color: TEXT_MAIN },
              { label: 'Imported', value: result.imported, color: '#22c55e' },
              { label: 'Skipped', value: result.skipped, color: '#f59e0b' },
            ].map(stat => (
              <div key={stat.label} style={{ textAlign: 'center', padding: '16px 8px', background: '#fafafa', borderRadius: 10, border: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 28, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: TEXT_MUTED, marginTop: 2 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {result.errors?.length > 0 && (
            <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 12, color: '#c2410c', marginBottom: 6 }}>⚠ {result.errors.length} rows had errors</div>
              {result.errors.slice(0, 5).map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: '#9a3412' }}>Row {e.row}: {e.reason}</div>
              ))}
              {result.errors.length > 5 && <div style={{ fontSize: 12, color: TEXT_MUTED }}>…and {result.errors.length - 5} more</div>}
            </div>
          )}

          {selectedCampaign && (
            <div style={{ padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, marginBottom: 12, fontSize: 13, color: '#166534' }}>
              ✅ Leads added to campaign: <strong>{campaigns.find(c => c._id === selectedCampaign)?.name}</strong>
            </div>
          )}
          {selectedCaller && (
            <div style={{ padding: '10px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#1e40af' }}>
              ✅ Leads assigned to caller: <strong>{callers.find(u => u._id === selectedCaller)?.name}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={reset} style={{ flex: 1, padding: '10px', border: `1.5px solid ${BORDER}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer', background: '#fff', color: TEXT_MAIN }}>
              Import Another File
            </button>
            <button onClick={() => navigate('/leads')} style={{ flex: 1, padding: '10px', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: PURPLE, color: '#fff' }}>
              View Leads →
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}