import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone, Users, CalendarCheck, RefreshCcw, XCircle, CalendarClock,
  Search, ChevronLeft, ChevronRight, RotateCw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { aiCallReportsAPI, campaignsAPI } from '../services/api';
import { formatISTDate, formatISTDateTime } from '../utils/dateFormat';

const INTEREST_COLORS = {
  'Interested': '#10B981',
  'Follow-up': '#F59E0B',
  'Not Interested': '#EF4444',
};

const BAR_COLORS = ['var(--theme-primary)', 'var(--theme-primary-accent2)', '#10B981', '#F59E0B', '#EC4899', '#3B82F6', '#14B8A6', '#F97316'];

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    cyan:   { bg: 'bg-[var(--theme-surface-faint)]', text: 'text-[var(--theme-primary)]', ring: 'ring-[var(--theme-surface-tint2)]' },
    green:  { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    blue:   { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', ring: 'ring-orange-100' },
    red:    { bg: 'bg-red-50', text: 'text-red-600', ring: 'ring-red-100' },
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', ring: 'ring-purple-100' },
  };
  const c = colors[color] || colors.cyan;
  return (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow ring-1 ${c.ring}`}>
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${c.text}`} />
        </div>
      </div>
      <div className="mt-3">
        <div className="text-2xl font-bold text-gray-800">{value}</div>
        <div className="text-xs text-gray-400 mt-0.5">{label}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, right }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

const INTEREST_BADGE = {
  'Interested': 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  'Follow-up': 'bg-amber-50 text-amber-700 ring-amber-100',
  'Not Interested': 'bg-red-50 text-red-700 ring-red-100',
};

export default function AiCallReports() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [dailyRange, setDailyRange] = useState(7);

  const [campaigns, setCampaigns] = useState([]);
  const [reports, setReports] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const [search, setSearch] = useState('');
  const [campaignFilter, setCampaignFilter] = useState('');
  const [interestFilter, setInterestFilter] = useState('');

  const [loadingTop, setLoadingTop] = useState(true);
  const [loadingTable, setLoadingTable] = useState(true);

  const loadDashboardAndAnalytics = useCallback(async () => {
    setLoadingTop(true);
    try {
      const [dashRes, analyticsRes] = await Promise.all([
        aiCallReportsAPI.dashboard(),
        aiCallReportsAPI.analytics({ days: dailyRange }),
      ]);
      setDashboard(dashRes.data);
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTop(false);
    }
  }, [dailyRange]);

  const loadTable = useCallback(async () => {
    setLoadingTable(true);
    try {
      const params = { page, limit: 25 };
      if (search.trim()) params.search = search.trim();
      if (campaignFilter) params.campaign = campaignFilter;
      if (interestFilter) params.interestStatus = interestFilter;
      const res = await aiCallReportsAPI.getAll(params);
      setReports(res.data.reports || []);
      setTotal(res.data.total || 0);
      setPages(res.data.pages || 1);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingTable(false);
    }
  }, [page, search, campaignFilter, interestFilter]);

  useEffect(() => { loadDashboardAndAnalytics(); }, [loadDashboardAndAnalytics]);
  useEffect(() => { loadTable(); }, [loadTable]);

  useEffect(() => {
    campaignsAPI.getAll().then(res => setCampaigns(res.data?.campaigns || [])).catch(() => setCampaigns([]));
  }, []);

  const refreshAll = () => { loadDashboardAndAnalytics(); loadTable(); };

  const pieData = (analytics?.pieDistribution || []).map(d => ({
    name: d.status,
    value: d.count,
  }));

  const dailyChartData = (analytics?.dailyCalls || []).map(d => ({
    date: formatISTDate(d.date, { day: '2-digit', month: 'short', year: undefined }),
    count: d.count,
  }));

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-800">AI Call Reports</h1>
          <p className="text-xs text-gray-400 mt-0.5">Demo bookings and interest signals extracted automatically from AI calling conversations</p>
        </div>
        <button
          onClick={refreshAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Dashboard stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Phone} label="Overall AI Calls" value={loadingTop ? '—' : (dashboard?.overallCalls ?? 0)} color="cyan" />
        <StatCard icon={Users} label="Interested Students" value={loadingTop ? '—' : (dashboard?.interested ?? 0)} color="green" />
        <StatCard icon={CalendarCheck} label="Demo Scheduled" value={loadingTop ? '—' : (dashboard?.demoScheduled ?? 0)} color="blue" />
        <StatCard icon={RefreshCcw} label="Follow-up Required" value={loadingTop ? '—' : (dashboard?.followUp ?? 0)} color="orange" />
        <StatCard icon={XCircle} label="Not Interested" value={loadingTop ? '—' : (dashboard?.notInterested ?? 0)} color="red" />
        <StatCard icon={CalendarClock} label="Today's Demo Count" value={loadingTop ? '—' : (dashboard?.todayDemoCount ?? 0)} color="purple" />
      </div>

      {/* Analytics charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Campaign vs Interested Students">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analytics?.campaignVsInterested || []} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="campaign" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-25} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" name="Interested" fill="#10B981" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Campaign vs Demo Scheduled">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={analytics?.campaignVsDemo || []} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="campaign" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-25} textAnchor="end" interval={0} height={60} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" name="Demo Scheduled" fill="var(--theme-primary)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Daily AI Calls"
          right={
            <div className="flex gap-1">
              {[7, 30].map(d => (
                <button
                  key={d}
                  onClick={() => setDailyRange(d)}
                  style={dailyRange === d ? { background: 'var(--btn-gradient)' } : undefined}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${dailyRange === d ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {d}D
                </button>
              ))}
            </div>
          }
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }} />
              <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Bar dataKey="count" name="AI Calls" fill="var(--theme-primary-accent2)" radius={[5, 5, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Interested / Follow-up / Not Interested">
          {pieData.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-sm text-gray-400">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {pieData.map((entry, i) => (
                    <Cell key={i} fill={INTEREST_COLORS[entry.name] || BAR_COLORS[i % BAR_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Reports table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-800">Reports</h3>
            <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-lg">{total.toLocaleString()} records</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Search student / phone..."
                className="text-xs border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 bg-gray-50 text-gray-600 focus:outline-none focus:border-[var(--theme-primary-light)] w-48"
              />
            </div>
            <select
              value={campaignFilter}
              onChange={e => { setCampaignFilter(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600 focus:outline-none focus:border-[var(--theme-primary-light)]"
            >
              <option value="">All Campaigns</option>
              {campaigns.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
            <select
              value={interestFilter}
              onChange={e => { setInterestFilter(e.target.value); setPage(1); }}
              className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-gray-50 text-gray-600 focus:outline-none focus:border-[var(--theme-primary-light)]"
            >
              <option value="">All Statuses</option>
              <option value="Interested">Interested</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Not Interested">Not Interested</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-3 font-medium">Campaign</th>
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">Interest Status</th>
                <th className="px-4 py-3 font-medium">Demo Date</th>
                <th className="px-4 py-3 font-medium">Demo Time</th>
                <th className="px-4 py-3 font-medium">Demo Day</th>
                <th className="px-4 py-3 font-medium">AI Summary</th>
                <th className="px-4 py-3 font-medium">Call Date &amp; Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loadingTable ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400"><div className="w-6 h-6 spinner-gradient mx-auto" /></td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-400 text-sm">No AI call reports yet</td></tr>
              ) : reports.map(r => (
                <tr
                  key={r._id}
                  onClick={() => r.lead?._id && navigate(`/leads/${r.lead._id}`)}
                  className="hover:bg-[var(--theme-surface-faint)]/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-gray-700">{r.campaignName || '—'}</td>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.studentName || r.lead?.name || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.mobileNumber || r.lead?.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-lg text-xs font-medium ring-1 ${INTEREST_BADGE[r.interestStatus] || 'bg-gray-50 text-gray-600 ring-gray-100'}`}>
                      {r.interestStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.demoDate ? formatISTDate(r.demoDate) : '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.demoTime || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.demoDay || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate" title={r.aiSummary}>{r.aiSummary || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatISTDateTime(r.lastCallAt || r.updatedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">Page {page} of {pages}</span>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                disabled={page >= pages}
                onClick={() => setPage(p => Math.min(pages, p + 1))}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 disabled:opacity-40 hover:bg-gray-50"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}