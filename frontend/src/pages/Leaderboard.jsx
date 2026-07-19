import { useState, useEffect, useRef, useCallback } from 'react';

const PURPLE = 'var(--theme-primary)';
const PURPLE_LIGHT = 'var(--theme-surface-tint2)';
const PURPLE_MID = 'var(--theme-primary-mid)';
const TEXT_MAIN = 'var(--theme-text-strongest)';
const TEXT_MUTED = '#6b7280';
const GREEN = '#059669';
const GOLD = '#d97706';
const SILVER = '#6b7280';
const BRONZE = '#b45309';
const BG = 'var(--theme-surface-faint8)';

const TABS = ['DAY', 'WEEK', 'MONTH', 'YEAR'];
const METRICS = [
  { key: 'Calls', label: 'Calls', apiKey: 'calls', dataKey: 'totalCalls' },
  { key: 'Duration', label: 'Duration', apiKey: 'duration', dataKey: 'totalDuration' },
  { key: 'Sales', label: 'Sales', apiKey: 'sales', dataKey: 'sales' },
];

function fmtDuration(sec) {
  if (!sec) return '0s';
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
function fmtMoney(n) {
  if (!n) return '0';
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n}`;
}
function fmtDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function toISODate(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function displayDate(dateStr) {
  const [y, m, day] = dateStr.split('-');
  return `${day}/${m}/${y}`;
}

const MEDAL = { 1: { bg: '#fef3c7', color: GOLD, label: '#1' }, 2: { bg: '#f1f5f9', color: SILVER, label: '#2' }, 3: { bg: '#fef0e6', color: BRONZE, label: '#3' } };
function RankBadge({ rank }) {
  const m = MEDAL[rank];
  if (m) return <span style={{ background: m.bg, color: m.color, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>{m.label}</span>;
  return <span style={{ background: '#f3f4f6', color: TEXT_MUTED, fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>#{rank}</span>;
}

// Mini sparkline bar chart
function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 4;
  return (
    <div style={{ width: 80, height: 8, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
    </div>
  );
}

// Bar chart component
function BarChart({ data, metric }) {
  const maxVal = Math.max(...data.map(d =>
    metric === 'Duration' ? d.totalDuration : metric === 'Sales' ? d.sales : d.totalCalls
  ), 1);

  const getValue = (d) => metric === 'Duration' ? d.totalDuration : metric === 'Sales' ? d.sales : d.totalCalls;
  const formatVal = (v) => metric === 'Duration' ? fmtDuration(v) : metric === 'Sales' ? fmtMoney(v) : v;

  const colors = [
    'var(--theme-primary)', 'var(--theme-primary-mid)', 'var(--theme-primary-light)', 'var(--theme-primary-pale)', 'var(--theme-primary-pale)',
    'var(--theme-surface-tint)', 'var(--theme-surface-tint2)', 'var(--theme-surface-tint)', 'var(--theme-surface-faint)', 'var(--theme-surface-faint)'
  ];

  return (
    <div style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 16, padding: '20px 24px', marginBottom: 20, maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: TEXT_MAIN, marginBottom: 16 }}>
        📊 {metric} Comparison
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160, paddingBottom: 28 }}>
        {data.slice(0, 10).map((d, i) => {
          const val = getValue(d);
          const pct = maxVal > 0 ? (val / maxVal) * 100 : 0;
          const initials = d.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
          return (
            <div key={d._id || i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: colors[0], marginBottom: 2 }}>{formatVal(val)}</div>
              <div style={{
                width: '100%', height: `${Math.max(pct, 4)}%`,
                background: `linear-gradient(180deg, ${colors[Math.min(i, 4)]}, ${colors[Math.min(i + 2, 9)]})`,
                borderRadius: '6px 6px 0 0', position: 'relative', cursor: 'default',
                transition: 'height 0.6s ease',
                minHeight: 6,
              }} title={`${d.name}: ${formatVal(val)}`} />
              <div style={{ fontSize: 9, color: TEXT_MUTED, textAlign: 'center', marginTop: 4, maxWidth: 40, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{initials}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
        {data.slice(0, 10).map((d, i) => (
          <div key={d._id || i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[Math.min(i, 4)] }} />
            <span style={{ fontSize: 10, color: TEXT_MUTED }}>{d.name?.split(' ')[0]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallerCard({ caller, rank, metric, maxVals }) {
  const initials = caller.name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';
  const isTop = rank <= 3;
  const topColors = ['linear-gradient(135deg,#fef3c7,#fff)', 'linear-gradient(135deg,#f1f5f9,#fff)', 'linear-gradient(135deg,#fef0e6,#fff)'];

  return (
    <div style={{
      background: isTop ? topColors[rank - 1] : '#fff',
      border: `1px solid ${isTop ? (rank === 1 ? '#f59e0b44' : rank === 2 ? '#cbd5e144' : '#f59e0b33') : 'var(--theme-border-tint)'}`,
      borderRadius: 14,
      padding: '14px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'box-shadow 0.15s, transform 0.15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(var(--theme-primary-rgb), 0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'none'; }}
    >
      {/* Rank number */}
      <div style={{ width: 28, textAlign: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: 16, fontWeight: 800, color: rank <= 3 ? [GOLD, SILVER, BRONZE][rank - 1] : '#d1d5db' }}>{rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : rank}</span>
      </div>

      {/* Avatar */}
      <div style={{
        width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
        background: `linear-gradient(135deg, ${PURPLE_LIGHT}, ${PURPLE_MID}22)`,
        border: `2px solid ${rank === 1 ? '#f59e0b' : rank === 2 ? '#cbd5e1' : rank === 3 ? '#f59e0b88' : 'var(--theme-border-tint)'}`,
        color: PURPLE, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700
      }}>{initials}</div>

      {/* Name + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: TEXT_MAIN }}>{caller.name}</div>
        <div style={{ fontSize: 11, color: TEXT_MUTED, marginTop: 1 }}>Caller</div>
        {caller.lastCall && (
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 3 }}>Last call: {fmtDate(caller.lastCall)}</div>
        )}
        {/* Progress bar */}
        <div style={{ marginTop: 8 }}>
          <MiniBar
            value={metric === 'Duration' ? caller.totalDuration : metric === 'Sales' ? caller.sales : caller.totalCalls}
            max={metric === 'Duration' ? maxVals.duration : metric === 'Sales' ? maxVals.sales : maxVals.calls}
            color={rank === 1 ? GOLD : rank <= 3 ? PURPLE_MID : PURPLE_LIGHT.replace('ff', '99')}
          />
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexShrink: 0 }}>
        <div style={{ textAlign: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: TEXT_MAIN, lineHeight: 1 }}>{caller.totalCalls}</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>Calls</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 60 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: TEXT_MAIN, lineHeight: 1 }}>{fmtDuration(caller.totalDuration)}</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>Duration</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: caller.sales > 0 ? GREEN : TEXT_MAIN, lineHeight: 1 }}>{caller.sales}</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>Sales</div>
        </div>
        <div style={{ textAlign: 'center', minWidth: 44 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: PURPLE, lineHeight: 1 }}>{caller.totalCalls > 0 ? `${Math.round((caller.connectedCalls / caller.totalCalls) * 100)}%` : '0%'}</div>
          <div style={{ fontSize: 10, color: TEXT_MUTED, marginTop: 2 }}>Connect</div>
        </div>
        <RankBadge rank={rank} />
      </div>
    </div>
  );
}

// Custom Date Picker Modal
function DatePickerModal({ onClose, onApply, initial }) {
  const [from, setFrom] = useState(initial?.from || toISODate(new Date()));
  const [to, setTo] = useState(initial?.to || toISODate(new Date()));
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#00000040', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, minWidth: 320, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, marginBottom: 20 }}>Custom Date Range</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 600 }}>From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--theme-border-tint)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 600 }}>To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              style={{ display: 'block', width: '100%', marginTop: 6, border: '1px solid var(--theme-border-tint)', borderRadius: 8, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', border: '1px solid var(--theme-border-tint)', borderRadius: 8, cursor: 'pointer', background: '#fff', fontSize: 13, color: TEXT_MUTED }}>Cancel</button>
          <button onClick={() => onApply(from, to)} style={{ flex: 1, padding: '9px 0', border: 'none', borderRadius: 8, cursor: 'pointer', background: 'var(--btn-gradient)', color: '#fff', fontSize: 13, fontWeight: 700 }}>Apply</button>
        </div>
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('DAY');
  const [metric, setMetric] = useState('Calls');
  const [search, setSearch] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBarChart, setShowBarChart] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customRange, setCustomRange] = useState(null);
  const [showMetricDrop, setShowMetricDrop] = useState(false);
  const metricRef = useRef(null);

  const getDateRange = useCallback(() => {
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const fmt = d => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    if (activeTab === 'CUSTOM' && customRange) return `${displayDate(customRange.from)} – ${displayDate(customRange.to)}`;
    if (activeTab === 'DAY') return fmt(now);
    if (activeTab === 'WEEK') {
      const s = new Date(now); s.setDate(now.getDate() - now.getDay());
      const e = new Date(s); e.setDate(s.getDate() + 6);
      return `${fmt(s)} – ${fmt(e)}`;
    }
    if (activeTab === 'MONTH') {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return `${fmt(s)} – ${fmt(e)}`;
    }
    return `01/01/${now.getFullYear()} – 31/12/${now.getFullYear()}`;
  }, [activeTab, customRange]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { reportsAPI } = await import('../services/api');
      const periodMap = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year', CUSTOM: 'custom' };
      const params = { period: periodMap[activeTab] || 'day', sortBy: METRICS.find(m2 => m2.key === metric)?.apiKey || 'calls' };
      if (activeTab === 'CUSTOM' && customRange) {
        params.startDate = customRange.from;
        params.endDate = customRange.to;
      }
      const res = await reportsAPI.leaderboard(params);
      const raw = res.data?.leaderboard || [];
      const normalized = raw.map(item => ({
        _id: item.user?._id || item._id,
        name: item.user?.name || item.name || 'Unknown',
        totalCalls: item.totalCalls || 0,
        totalDuration: item.totalDuration || 0,
        sales: item.sales || 0,
        connectedCalls: item.connectedCalls || 0,
        firstCall: item.firstCall || null,
        lastCall: item.lastCall || null,
      }));
      setData(normalized);
    } catch (err) {
      console.error('Leaderboard fetch error:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, metric, customRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Close metric dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (metricRef.current && !metricRef.current.contains(e.target)) setShowMetricDrop(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = data.filter(d => d.name?.toLowerCase().includes(search.toLowerCase()));

  const maxVals = {
    calls: Math.max(...filtered.map(d => d.totalCalls), 1),
    duration: Math.max(...filtered.map(d => d.totalDuration), 1),
    sales: Math.max(...filtered.map(d => d.sales), 1),
  };

  // Summary stats
  const totalCalls = filtered.reduce((s, d) => s + d.totalCalls, 0);
  const totalDuration = filtered.reduce((s, d) => s + d.totalDuration, 0);
  const totalSales = filtered.reduce((s, d) => s + d.sales, 0);

  const downloadCSV = () => {
    const headers = ['Rank', 'Name', 'Calls', 'Duration (sec)', 'Duration (formatted)', 'Connected Calls', 'Connect Rate', 'Sales', 'Last Call'];
    const rows = filtered.map((d, i) => [
      i + 1, d.name, d.totalCalls, d.totalDuration, fmtDuration(d.totalDuration),
      d.connectedCalls, d.totalCalls > 0 ? `${Math.round((d.connectedCalls / d.totalCalls) * 100)}%` : '0%',
      d.sales, d.lastCall ? new Date(d.lastCall).toLocaleString('en-IN') : ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `leaderboard_${activeTab.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const allTabs = [...TABS, 'CUSTOM'];

  return (
    <div className="lb-shell" style={{ padding: 24, background: BG, minHeight: '100vh', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box' }}>
      <style>{`
        @media (max-width: 640px) {
          .lb-shell { padding: 14px !important; }
        }
      `}</style>
      {showDatePicker && (
        <DatePickerModal
          initial={customRange}
          onClose={() => setShowDatePicker(false)}
          onApply={(from, to) => { setCustomRange({ from, to }); setActiveTab('CUSTOM'); setShowDatePicker(false); }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: TEXT_MAIN }}>🏆 Leaderboard</span>
          <button onClick={fetchData} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }} title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2.5">
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-5"/>
            </svg>
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Date range label */}
          <div style={{ fontSize: 12, color: TEXT_MUTED, fontWeight: 600, background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 8, padding: '6px 12px' }}>
            📅 {getDateRange()}
          </div>
          {/* Bar chart toggle */}
          <button onClick={() => setShowBarChart(v => !v)}
            style={{ background: showBarChart ? PURPLE : '#fff', border: `1px solid ${showBarChart ? PURPLE : 'var(--theme-border-tint)'}`, borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex', transition: 'all 0.2s' }}
            title="Toggle bar chart">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={showBarChart ? '#fff' : PURPLE} strokeWidth="2">
              <polyline points="18 20 18 10"/><polyline points="12 20 12 4"/><polyline points="6 20 6 14"/>
            </svg>
          </button>
          {/* Download CSV */}
          <button onClick={downloadCSV}
            style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 8, padding: '7px 10px', cursor: 'pointer', display: 'flex' }}
            title="Download CSV">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={TEXT_MUTED} strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Summary cards */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
          {[
            { icon: '📞', label: 'Total Calls', value: totalCalls, color: PURPLE },
            { icon: '⏱️', label: 'Total Duration', value: fmtDuration(totalDuration), color: '#0891b2' },
            { icon: '💰', label: 'Total Sales', value: totalSales, color: GREEN },
            { icon: '👥', label: 'Active Callers', value: filtered.length, color: 'var(--theme-primary)' },
          ].map(s => (
            <div key={s.label} style={{ flex: '1 1 120px', background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: 11, color: TEXT_MUTED, fontWeight: 500 }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--theme-border-tint)', background: '#fff', borderRadius: '12px 12px 0 0', padding: '0 8px', overflowX: 'auto' }}>
        {allTabs.map(tab => (
          <button key={tab} onClick={() => tab === 'CUSTOM' ? setShowDatePicker(true) : setActiveTab(tab)}
            style={{
              padding: '10px 20px', border: 'none', background: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              color: activeTab === tab ? PURPLE : TEXT_MUTED,
              borderBottom: activeTab === tab ? `2px solid ${PURPLE}` : '2px solid transparent',
              marginBottom: -2, transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', flexShrink: 0,
            }}>
            {tab === 'CUSTOM' && '📅 '}
            {tab}
          </button>
        ))}
      </div>

      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap', background: '#fff', padding: '12px 16px', borderRadius: 12, border: '1px solid var(--theme-border-tint)' }}>
        {/* Metric dropdown */}
        <div ref={metricRef} style={{ position: 'relative' }}>
          <button onClick={() => setShowMetricDrop(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${showMetricDrop ? PURPLE : 'var(--theme-border-tint)'}`, borderRadius: 8, padding: '7px 14px', cursor: 'pointer', background: showMetricDrop ? PURPLE_LIGHT : '#fff', fontSize: 12, color: TEXT_MAIN, fontWeight: 600, transition: 'all 0.15s' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={PURPLE} strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
              <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
            </svg>
            Sort by: <span style={{ color: PURPLE }}>{metric}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          {showMetricDrop && (
            <div style={{ position: 'absolute', top: '110%', left: 0, background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, minWidth: 140, overflow: 'hidden' }}>
              {METRICS.map(m2 => (
                <button key={m2.key}
                  onClick={() => { setMetric(m2.key); setShowMetricDrop(false); }}
                  style={{ display: 'block', width: '100%', padding: '10px 16px', border: 'none', background: metric === m2.key ? PURPLE_LIGHT : '#fff', cursor: 'pointer', fontSize: 13, color: metric === m2.key ? PURPLE : TEXT_MAIN, fontWeight: metric === m2.key ? 700 : 400, textAlign: 'left' }}>
                  {m2.label} {metric === m2.key && '✓'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 180, maxWidth: 320, display: 'flex', alignItems: 'center', gap: 8, background: BG, border: '1px solid var(--theme-border-tint)', borderRadius: 8, padding: '7px 12px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by team member name"
            style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: TEXT_MAIN, width: '100%' }} />
          {search && <button onClick={() => setSearch('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: TEXT_MUTED, fontSize: 14 }}>×</button>}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 12, color: TEXT_MUTED, fontWeight: 600 }}>
          {filtered.length} member{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Bar Chart */}
      {showBarChart && !loading && filtered.length > 0 && (
        <BarChart data={filtered} metric={metric} />
      )}

      {/* Content */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: 200, gap: 12, background: '#fff', borderRadius: 16, border: '1px solid var(--theme-border-tint)' }}>
          <div style={{ width: 36, height: 36, border: `4px solid ${PURPLE_LIGHT}`, borderTopColor: PURPLE, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 13, color: TEXT_MUTED }}>Loading leaderboard...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 16, padding: '60px 24px', textAlign: 'center', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏆</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT_MAIN, marginBottom: 8 }}>No data yet</div>
          <div style={{ fontSize: 13, color: TEXT_MUTED }}>
            {search ? `No team members match "${search}"` : `No calls recorded for this ${activeTab.toLowerCase()} period`}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filtered.map((caller, i) => (
            <CallerCard key={caller._id || caller.name || i} caller={caller} rank={i + 1} metric={metric} maxVals={maxVals} />
          ))}
        </div>
      )}
    </div>
  );
}