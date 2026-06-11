import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsAPI, usersAPI, blocklistAPI } from '../services/api';
import StatusBadge from '../components/common/StatusBadge';
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Search, Plus, RefreshCw, Download, Star, Trash2, Ban,
  BarChart2, ChevronLeft, ChevronRight, Filter, X, TrendingUp,
  Users, Phone, CheckCircle
} from 'lucide-react';

const PURPLE = '#5b3fc7';
const PURPLE_LIGHT = '#f0ecff';
const COLORS = ['#5b3fc7','#10B981','#F59E0B','#EF4444','#8B5CF6','#3B82F6','#EC4899','#14B8A6','#F97316','#6366F1'];

const STATUSES = ['All', 'Fresh', 'Connected', 'Call Not Responding', 'Call Back Later', 'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost', 'Blocked'];
const SOURCES = ['All', 'Manual', 'Facebook', 'WhatsApp', 'Website', 'Excel'];

const STATUS_COLORS = {
  Fresh: 'bg-blue-100 text-blue-700',
  Connected: 'bg-green-100 text-green-700',
  'Call Not Responding': 'bg-gray-100 text-gray-600',
  'Call Back Later': 'bg-yellow-100 text-yellow-700',
  'Not interested': 'bg-red-100 text-red-600',
  'Demo Scheduled': 'bg-purple-100 text-purple-700',
  'Demo Done': 'bg-indigo-100 text-indigo-700',
  Won: 'bg-emerald-100 text-emerald-700',
  Lost: 'bg-rose-100 text-rose-700',
  Blocked: 'bg-slate-100 text-slate-600',
};

const STATUS_DOT = {
  Fresh: '#3B82F6',
  Connected: '#10B981',
  'Call Not Responding': '#9CA3AF',
  'Call Back Later': '#F59E0B',
  'Not interested': '#EF4444',
  'Demo Scheduled': '#8B5CF6',
  'Demo Done': '#6366F1',
  Won: '#10B981',
  Lost: '#F43F5E',
  Blocked: '#64748B',
};

function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-xs text-gray-400 font-medium">{label}</div>
        <div className="text-xl font-bold text-gray-800">{value}</div>
      </div>
    </div>
  );
}

export default function Leads() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super admin';
  const isCaller = user?.role === 'caller';

  // Determine available filter tabs based on role
  // Admin: My Leads, All Leads, Leads Assigned To Me
  // Caller: My Leads, Leads Assigned To Me (in "All Leads" section show only their leads)
  const filterOptions = isAdmin
    ? [
        { key: 'all', label: 'All Leads' },
        { key: 'mine', label: 'My Leads' },
        { key: 'assigned', label: 'Leads Assigned To Me' },
      ]
    : [
        { key: 'mine', label: 'My Leads' },
        { key: 'assigned', label: 'Leads Assigned To Me' },
      ];

  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('All');
  const [source, setSource] = useState('All');
  const [filter, setFilter] = useState(isAdmin ? 'all' : 'mine');
  const [selected, setSelected] = useState([]);
  const [starred, setStarred] = useState({});
  const [callers, setCallers] = useState([]);
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [showCharts, setShowCharts] = useState(false);
  const [statusStats, setStatusStats] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Load callers list for admin
  useEffect(() => {
    if (isAdmin) {
      usersAPI.getAll()
        .then(res => {
          const list = (res.data.users || []).filter(u => u.role === 'caller');
          setCallers(list);
        })
        .catch(console.error);
    }
  }, [user]);

  // Fetch leads stats for charts
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await leadsAPI.getStats();
      const counts = res.data.statusCounts || [];
      setStatusStats(counts.map(s => ({ name: s._id, value: s.count })));
    } catch (e) { console.error(e); }
    finally { setStatsLoading(false); }
  }, []);

  useEffect(() => {
    if (showCharts) fetchStats();
  }, [showCharts, fetchStats]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20, filter };
      if (search) params.search = search;
      if (status !== 'All') params.status = status;
      if (source !== 'All') params.source = source;
      // For caller "all" filter — backend restricts to their assigned leads
      const res = await leadsAPI.getAll(params);
      setLeads(res.data.leads || []);
      setTotal(res.data.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [page, search, status, source, filter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [search, status, source, filter]);

  const toggleStar = async (lead, e) => {
    e.stopPropagation();
    try {
      await leadsAPI.update(lead._id, { isStarred: !lead.isStarred });
      setLeads(prev => prev.map(l => l._id === lead._id ? { ...l, isStarred: !l.isStarred } : l));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Delete this lead?')) return;
    await leadsAPI.delete(id);
    fetchLeads();
  };

  const handleBlock = async (lead, e) => {
    e.stopPropagation();
    const reason = prompt(`Enter reason for blocking ${lead.name} (optional):`, 'Spam Lead');
    if (reason === null) return;
    try {
      const cleanPhone = lead.phone.replace(/\D/g, '');
      await blocklistAPI.add({ phone: cleanPhone, name: lead.name, reason });
      await leadsAPI.updateStatus(lead._id, { status: 'Blocked' });
      fetchLeads();
    } catch (err) { alert('Error: ' + (err.response?.data?.message || err.message)); }
  };

  const handleExport = async () => {
    try {
      const params = { filter };
      if (status !== 'All') params.status = status;
      const res = await leadsAPI.exportCSV(params);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url; a.download = `leads-${Date.now()}.csv`; a.click();
    } catch (e) { alert('Export failed'); }
  };

  const pages = Math.ceil(total / 20);

  const filteredCallers = callers.filter(c =>
    !assigneeFilter || c.name.toLowerCase().includes(assigneeFilter.toLowerCase())
  );

  const activeFiltersCount = [
    status !== 'All' ? 1 : 0,
    source !== 'All' ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Leads</h1>
          <p className="text-xs text-gray-400 mt-0.5">{total} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCharts(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-all ${showCharts ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300'}`}
          >
            <BarChart2 className="w-4 h-4" />
            Charts
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-300 transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
          <button onClick={() => navigate('/leads/add')} className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl bg-purple-600 text-white hover:bg-purple-700 transition-all shadow-sm">
            <Plus className="w-4 h-4" />
            Add Lead
          </button>
        </div>
      </div>

      {/* Charts Panel */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-300">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Lead Status Distribution</h3>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">Bar Chart</span>
            </div>
            {statsLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : statusStats.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={statusStats} margin={{ top: 5, right: 5, left: -20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(val, name) => [val, 'Leads']}
                  />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]}>
                    {statusStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Status Overview</h3>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">Pie Chart</span>
            </div>
            {statsLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="w-7 h-7 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : statusStats.length === 0 ? (
              <div className="flex items-center justify-center h-48 text-gray-300 text-sm">No data available</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie
                      data={statusStats}
                      cx="50%" cy="50%"
                      outerRadius={70} innerRadius={38}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {statusStats.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-1.5 mt-3">
                  {statusStats.map((s, i) => (
                    <div key={s.name} className="flex items-center gap-2 text-xs">
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
      )}

      {/* Role-based filter tabs */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        {/* Sidebar-style filter tabs */}
        <div className="flex border-b border-gray-100">
          <div className="w-52 border-r border-gray-100 p-3 space-y-1 flex-shrink-0">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">
              {isAdmin ? 'Admin View' : 'Caller View'}
            </div>
            {filterOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${
                  filter === opt.key
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${filter === opt.key ? 'bg-white' : 'bg-gray-300'}`} />
                {opt.label}
              </button>
            ))}

            {/* Callers list for admin */}
            {isAdmin && callers.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">Callers</div>
                <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                  {callers.map(c => (
                    <button
                      key={c._id}
                      onClick={() => { setFilter(c._id); }}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-left ${
                        filter === c._id ? 'bg-purple-50 text-purple-700' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {c.name[0].toUpperCase()}
                      </div>
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main content area */}
          <div className="flex-1 min-w-0">
            {/* Search & Filters bar */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-100">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-gray-50"
                />
              </div>

              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:border-purple-400 text-gray-600"
              >
                {STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>

              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:border-purple-400 text-gray-600"
              >
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>

              <button onClick={fetchLeads} className="p-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50/70">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={selected.length === leads.length && leads.length > 0}
                        onChange={e => setSelected(e.target.checked ? leads.map(l => l._id) : [])}
                        className="rounded border-gray-300"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Assignee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created On</th>
                    {isAdmin && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-16 text-center">
                        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <div className="text-sm text-gray-400">Loading leads...</div>
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-16 text-center">
                        <div className="text-gray-300 mb-2">
                          <Users className="w-10 h-10 mx-auto" />
                        </div>
                        <div className="text-sm text-gray-400">No leads found</div>
                        <button onClick={() => navigate('/leads/add')} className="mt-3 text-xs text-purple-600 hover:underline">
                          + Add your first lead
                        </button>
                      </td>
                    </tr>
                  ) : (
                    leads.map(lead => (
                      <tr
                        key={lead._id}
                        onClick={() => navigate(`/leads/${lead._id}`)}
                        className="border-t border-gray-50 hover:bg-purple-50/30 cursor-pointer transition-colors group"
                      >
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.includes(lead._id)}
                            onChange={e => setSelected(prev =>
                              e.target.checked ? [...prev, lead._id] : prev.filter(id => id !== lead._id)
                            )}
                            className="rounded border-gray-300"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={e => toggleStar(lead, e)}
                              className={`transition-colors flex-shrink-0 ${lead.isStarred ? 'text-yellow-400' : 'text-gray-200 hover:text-yellow-300'}`}
                            >
                              <Star className="w-4 h-4" fill={lead.isStarred ? 'currentColor' : 'none'} />
                            </button>
                            <div>
                              <div className="font-medium text-purple-700 group-hover:text-purple-800 text-sm">{lead.name}</div>
                              <div className="text-xs text-gray-400">{lead.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${STATUS_COLORS[lead.status] || 'bg-gray-100 text-gray-600'}`}>
                            <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_DOT[lead.status] || '#9CA3AF' }} />
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-0.5">
                            {[1,2,3,4,5].map(s => (
                              <Star key={s} className={`w-3.5 h-3.5 ${s <= (lead.rating || 0) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {lead.assignedTo ? (
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {lead.assignedTo.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <span className="text-sm text-gray-600 truncate max-w-24">{lead.assignedTo.name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-300">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-400">
                          {lead.createdAt ? format(new Date(lead.createdAt), 'd MMM yyyy') : '—'}
                        </td>
                        {isAdmin && (
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={e => handleBlock(lead, e)}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                title="Block"
                              >
                                <Ban className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={e => handleDelete(lead._id, e)}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <span className="text-xs text-gray-400">
                {total > 0 ? `${(page - 1) * 20 + 1}–${Math.min(page * 20, total)} of ${total}` : '0 results'}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                  const p = pages <= 5 ? i + 1 : page <= 3 ? i + 1 : page >= pages - 2 ? pages - 4 + i : page - 2 + i;
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-purple-600 text-white' : 'text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
                    >
                      {p}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}