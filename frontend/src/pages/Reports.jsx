import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, Phone, Clock, TrendingUp, BarChart2, RefreshCw, Users, CheckCircle, XCircle, Calendar } from 'lucide-react';
import { reportsAPI, followupsAPI, leadsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, Area, AreaChart
} from 'recharts';

const COLORS = ['#5b3fc7', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#3B82F6', '#14B8A6', '#F97316', '#6366F1'];
<<<<<<< HEAD
const STATUS_COLORS = {
  'Fresh':               '#3B82F6',
  'Connected':           '#10B981',
  'Call Not Responding': '#EA580C',
  'Call Back Later':     '#F59E0B',
  'Not interested':      '#EF4444',
  'Demo Scheduled':      '#8B5CF6',
  'Demo Done':           '#14B8A6',
  'Won':                 '#16A34A',
  'Lost':                '#DC2626',
  'Wrong Number':        '#DC2626',
  'Blocked':             '#111827',
};
=======
>>>>>>> 1febdd1f01daeeb84ed488ec4179b1dd06c12367

// Tab structure matching TeleCRM source image
const CHART_TABS = ['Status', 'Lead source', 'Assignee', 'Rating', 'Call status', 'Number of calls placed', 'Created on'];
const REPORT_TABS = ['All', 'Tasks', 'Call Summarization', 'Bulk upload tasks', 'Leaderboard'];

function fmtDuration(sec) {
  if (!sec) return '0m';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = {
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-600', ring: 'ring-indigo-100' },
    green: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100' },
  };
  const c = colors[color] || colors.indigo;
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow ring-1 ${c.ring}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
        <span className="text-xs text-gray-400">{sub}</span>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function LeaderboardTab() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('week');

  useEffect(() => {
    setLoading(true);
    reportsAPI.leaderboard({ period })
      .then(res => {
        const raw = res.data?.leaderboard || [];
        setData(raw.map(item => ({
          _id: item.user?._id || item._id,
          name: item.user?.name || item.name || 'Unknown',
          calls: item.totalCalls || 0,
          duration: item.totalDuration || 0,
          connected: item.connectedCalls || 0,
          sales: item.sales || 0,
        })));
      })
      .catch(err => { console.error(err); setData([]); })
      .finally(() => setLoading(false));
  }, [period]);

  const fmtD = (s) => { if (!s) return '0s'; const m = Math.floor(s / 60), sec = s % 60; return m > 0 ? `${m}m ${sec}s` : `${sec}s`; };

  const chartData = data.map(d => ({ name: d.name.split(' ')[0], calls: d.calls, sales: d.sales }));

  return (
    <div className="space-y-5">
      {/* Period selector */}
      <div className="flex items-center gap-2 flex-wrap">
        {['day', 'week', 'month', 'year'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 text-xs font-semibold rounded-xl transition-colors ${period === p ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-2xl border border-gray-100">No calls recorded for this period</div>
      ) : (
        <>
          {/* Bar chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Calls by Caller</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="calls" name="Total Calls" fill="#5b3fc7" radius={[5, 5, 0, 0]} />
                <Bar dataKey="sales" name="Sales Won" fill="#10B981" radius={[5, 5, 0, 0]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Leaderboard table */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-800">Rankings</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {data.map((c, i) => (
                <div key={c._id || i} className="flex items-center gap-4 px-5 py-3 hover:bg-purple-50/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 text-sm">{c.name}</div>
                    <div className="text-xs text-gray-400">{c.calls} calls · {fmtD(c.duration)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-purple-700">{c.calls}</div>
                    <div className="text-xs text-gray-400">calls</div>
                  </div>
                  {c.sales > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-bold text-emerald-600">{c.sales}</div>
                      <div className="text-xs text-gray-400">won</div>
                    </div>
                  )}
                  {/* Progress bar */}
                  <div className="w-24 hidden md:block">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.min(100, (c.calls / (data[0]?.calls || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Lead View chart section — mirrors the TeleCRM chart UI
function LeadViewCharts({ summary }) {
  const navigate = useNavigate();
  const [chartTab, setChartTab] = useState('Status');
  const [chartType, setChartType] = useState('Bar');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [total, setTotal] = useState(0);
  const [assigneeId, setAssigneeId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [assignees, setAssignees] = useState([]);
  const [sources, setSources] = useState([]);

  // Load filter options once
  useEffect(() => {
    reportsAPI.leadViewFilters().then(res => {
      setAssignees(res.data.assignees || []);
      setSources(res.data.sources || []);
    }).catch(console.error);
  }, []);

  const fetchChartData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { tab: chartTab };
      if (assigneeId) params.assigneeId = assigneeId;
      if (statusFilter) params.status = statusFilter;
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;
      const res = await reportsAPI.leadView(params);
      setChartData(res.data.data || []);
      setTotal(res.data.total || 0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [chartTab, assigneeId, statusFilter, dateRange.start, dateRange.end]);

  useEffect(() => { fetchChartData(); }, [fetchChartData]);

  const handleExportChart = () => {
    if (!chartData.length) return;
    const csv = ['Label,Count', ...chartData.map(d => `"${d.name}",${d.value}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `lead-chart-${chartTab.toLowerCase().replace(/ /g, '-')}.csv`; a.click();
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
      {/* Header row */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800">Lead View</h3>
          <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{total.toLocaleString()} leads</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportChart} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export chart as CSV
          </button>
          <button onClick={handleExportChart} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors">
            Download
          </button>
        </div>
      </div>

      {/* Chart type tabs — matching source image */}
      <div className="border-b border-gray-100 px-5">
        <div className="flex gap-0 overflow-x-auto">
          {CHART_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setChartTab(tab)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${chartTab === tab ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Assignee</span>
          <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600 focus:outline-none focus:border-purple-400">
            <option value="">All Assignees</option>
            {assignees.map(a => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Status</span>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600 focus:outline-none focus:border-purple-400">
            <option value="">All</option>
            {['Fresh','Connected','Call Not Responding','Call Back Later','Not interested','Demo Scheduled','Demo Done','Won','Wrong Number','Lost','Blocked'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-500">Creation Date</span>
          <input type="date" value={dateRange.start} onChange={e => setDateRange(p => ({...p, start: e.target.value}))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:border-purple-400" />
          <span className="text-xs text-gray-400">–</span>
          <input type="date" value={dateRange.end} onChange={e => setDateRange(p => ({...p, end: e.target.value}))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 focus:outline-none focus:border-purple-400" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <select value={chartType} onChange={e => setChartType(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600 focus:outline-none">
            <option>Bar</option>
            <option>Pie</option>
            <option>Area</option>
          </select>
          <button onClick={fetchChartData} className="p-1.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      {/* Chart */}
      <div className="p-5">
        {loading ? (
          <div className="flex justify-center items-center h-56">
            <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-56 text-gray-300 text-sm">No data available</div>
        ) : (
          <>
            {chartType === 'Bar' && (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    formatter={(val) => [val, 'Leads Count']}
                  />
                  <Bar dataKey="value" name="Leads Count" radius={[5, 5, 0, 0]}>
                    {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            {chartType === 'Pie' && (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" outerRadius={90} innerRadius={45} paddingAngle={2} dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(1)}%`} labelLine={false}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </>
            )}
            {chartType === 'Area' && (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#5b3fc7" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#5b3fc7" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Area type="monotone" dataKey="value" name="Leads" stroke="#5b3fc7" strokeWidth={2} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            )}

            {/* Legend / summary row — matching source image bottom bar */}
            <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-gray-100">
              {chartData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-gray-500">{d.name}</span>
                  <span className="font-bold text-gray-800">{d.value.toLocaleString()}</span>
                  <span className="text-gray-400">{total > 0 ? `${((d.value / total) * 100).toFixed(2)}%` : '0%'}</span>
                </div>
              ))}
            </div>

            {/* View X leads button */}
            <div className="flex justify-end mt-4">
              <button onClick={() => navigate('/leads')} className="px-4 py-2 bg-purple-600 text-white text-xs font-semibold rounded-xl hover:bg-purple-700 transition-colors">
                View {total.toLocaleString()} leads
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Reports() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super admin';

  const [activeTab, setActiveTab] = useState('All');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusChartData, setStatusChartData] = useState([]);
  const [tasksData, setTasksData] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [callsList, setCallsList] = useState([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [uploadsList, setUploadsList] = useState(() => {
    try { return JSON.parse(localStorage.getItem('aotms_bulk_uploads') || '[]'); } catch { return []; }
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, statsRes] = await Promise.all([
        reportsAPI.callsSummary(),
        leadsAPI.getStats(),
      ]);
      setSummary(summaryRes.data);
      const counts = statsRes.data?.statusCounts || [];
      setStatusChartData(counts.map(s => ({ name: s._id, value: s.count })));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    if (activeTab === 'Tasks') {
      setTasksLoading(true);
      followupsAPI.getAll({ limit: 50 })
        .then(res => setTasksData(res.data.followups || []))
        .catch(console.error)
        .finally(() => setTasksLoading(false));
    }
    if (activeTab === 'Call Summarization') {
      setCallsLoading(true);
      reportsAPI.callsList()
        .then(res => setCallsList(res.data?.calls || []))
        .catch(console.error)
        .finally(() => setCallsLoading(false));
    }
  }, [activeTab]);

  const handleDeleteTask = async (id) => {
    if (!confirm('Delete this task?')) return;
    try {
      await followupsAPI.delete(id);
      setTasksData(prev => prev.filter(t => t._id !== id));
    } catch (e) { alert('Failed to delete task'); }
  };

  const handleExportLeads = async () => {
    try {
      const res = await leadsAPI.exportCSV({});
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    } catch (e) { alert('Export failed'); }
  };

  const handleExportLeaderboard = async () => {
    try {
      const res = await reportsAPI.leaderboard({ period: 'all' });
      const lb = res.data?.leaderboard || [];
      const csv = ['Rank,Name,Total Calls,Total Duration (min),Sales Won',
        ...lb.map((r, i) => `${i+1},"${r.user?.name || ''}",${r.totalCalls || 0},${Math.floor((r.totalDuration || 0) / 60)},${r.sales || 0}`)
      ].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'leaderboard.csv'; a.click();
    } catch (e) { alert('Export failed'); }
  };

  const today = summary?.today || {};
  const week = summary?.week || {};

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
            <BarChart2 className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-bold text-gray-900">Reports & Analytics</h2>
            <p className="text-xs text-gray-400">Real-time data from your database</p>
          </div>
        </div>
        <button onClick={fetchAll} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 overflow-x-auto">
          {REPORT_TABS.map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === tab ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* All tab */}
      {activeTab === 'All' && (
        <div className="space-y-6">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Phone} label="Calls Today" value={today.count || 0} sub={fmtDuration(today.duration)} color="indigo" />
            <StatCard icon={CheckCircle} label="Connected Today" value={today.connected || 0} sub="Answered calls" color="green" />
            <StatCard icon={Clock} label="Talk Time Today" value={fmtDuration(today.duration)} sub="Total duration" color="orange" />
            <StatCard icon={TrendingUp} label="Calls This Week" value={week.count || 0} sub={fmtDuration(week.duration)} color="purple" />
          </div>

          {/* Lead View Charts — matches TeleCRM source image */}
          <LeadViewCharts summary={summary} />

          {/* Status charts grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Status Distribution</h3>
              {statusChartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data</div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={statusChartData} margin={{ top: 5, right: 5, left: -20, bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" interval={0} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} formatter={v => [v, 'Leads']} />
                    <Bar dataKey="value" name="Leads" radius={[5, 5, 0, 0]}>
                      {statusChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h3 className="font-semibold text-gray-800 mb-4">Status Overview</h3>
              {statusChartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={statusChartData} cx="50%" cy="50%" outerRadius={75} innerRadius={38} paddingAngle={2} dataKey="value"
                        label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''} labelLine={false}>
                        {statusChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-1.5 mt-2">
                    {statusChartData.map((s, i) => (
                      <div key={s.name} className="flex items-center gap-1.5 text-xs">
                        <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-gray-500 truncate">{s.name}</span>
                        <span className="font-semibold text-gray-700 ml-auto">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Export section */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Export Reports</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { name: 'Leads Report', onClick: handleExportLeads, icon: Users },
                { name: 'Call Report', onClick: () => alert('Use Call Summarization tab'), icon: Phone },
                { name: 'Campaign Report', onClick: () => alert('Coming soon'), icon: TrendingUp },
                { name: 'Leaderboard', onClick: handleExportLeaderboard, icon: BarChart2 }
              ].map(r => (
                <button key={r.name} onClick={r.onClick}
                  className="flex items-center gap-2 p-3 border border-gray-200 rounded-xl hover:bg-purple-50 hover:border-purple-200 transition-all group">
                  <Download className="w-4 h-4 text-gray-400 group-hover:text-purple-600" />
                  <span className="text-sm text-gray-600 group-hover:text-purple-700">{r.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tasks tab */}
      {activeTab === 'Tasks' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Tasks</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Task', 'Lead', 'Assignee', 'Status', 'Due Date', 'Priority', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tasksLoading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center"><div className="w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : tasksData.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">No tasks found.</td></tr>
              ) : (
                tasksData.map((task, i) => (
                  <tr key={task._id || i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{task.note || task.title || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{task.lead?.name || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{task.assignedTo?.name || 'Me'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                        task.status === 'done' ? 'bg-green-50 text-green-700' :
                        task.status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                        new Date(task.scheduledAt) < new Date() ? 'bg-red-50 text-red-700' : 'bg-yellow-50 text-yellow-700'
                      }`}>
                        {task.status || 'upcoming'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{task.scheduledAt ? new Date(task.scheduledAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-gray-600 capitalize">{task.priority || 'medium'}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => handleDeleteTask(task._id)} className="text-red-400 hover:text-red-600 transition-colors p-1">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Call Summarization */}
      {activeTab === 'Call Summarization' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Call Summaries</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Lead', 'Date', 'Duration', 'Status', 'Summary'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {callsLoading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center"><div className="w-6 h-6 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" /></td></tr>
              ) : callsList.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400 text-sm">No call summaries available.</td></tr>
              ) : (
                callsList.map((call, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-800">{call.leadName}</div>
                      <div className="text-xs text-gray-400">{call.leadPhone}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {call.date ? new Date(call.date).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{fmtDuration(call.duration)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${call.status === 'connected' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {call.status || 'no answer'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate" title={call.summary}>{call.summary || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Bulk upload tasks */}
      {activeTab === 'Bulk upload tasks' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Bulk Upload Tasks</h3>
            <label className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-purple-600 text-white rounded-xl cursor-pointer hover:bg-purple-700 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Upload Excel / CSV
              <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                try {
                  const formData = new FormData();
                  formData.append('file', file);
                  const res = await followupsAPI.import(formData);
                  const newUpload = { fileName: file.name, uploadedAt: new Date().toISOString(), tasksCreated: `${res.data.count} / ${res.data.total}`, status: 'Completed' };
                  const existing = JSON.parse(localStorage.getItem('aotms_bulk_uploads') || '[]');
                  const updated = [newUpload, ...existing];
                  localStorage.setItem('aotms_bulk_uploads', JSON.stringify(updated));
                  setUploadsList(updated);
                  alert(`✅ Bulk upload complete: ${res.data.count} of ${res.data.total} tasks created.`);
                } catch (err) {
                  const newUpload = { fileName: file.name, uploadedAt: new Date().toISOString(), tasksCreated: '0', status: 'Failed' };
                  const existing = JSON.parse(localStorage.getItem('aotms_bulk_uploads') || '[]');
                  const updated = [newUpload, ...existing];
                  localStorage.setItem('aotms_bulk_uploads', JSON.stringify(updated));
                  setUploadsList(updated);
                  alert('Failed: ' + (err.response?.data?.message || err.message));
                }
                e.target.value = '';
              }} />
            </label>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['File Name', 'Uploaded At', 'Tasks Created', 'Status'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {uploadsList.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400 text-sm">No uploads yet.</td></tr>
              ) : (
                uploadsList.map((up, i) => (
                  <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{up.fileName}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{up.uploadedAt ? new Date(up.uploadedAt).toLocaleString('en-IN') : '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{up.tasksCreated}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${up.status === 'Completed' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                        {up.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Leaderboard tab */}
      {activeTab === 'Leaderboard' && <LeaderboardTab />}
    </div>
  );
}