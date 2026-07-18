import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { leadsAPI, usersAPI, blocklistAPI, leadStagesAPI } from '../services/api';
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

const PURPLE = 'var(--theme-primary)';
const PURPLE_LIGHT = 'var(--theme-surface-tint)';
const COLORS = ['var(--theme-primary)','#10B981','#F59E0B','#EF4444','var(--theme-primary-accent2)','#3B82F6','#EC4899','#14B8A6','#F97316','var(--theme-primary-alt)'];

const FALLBACK_STATUSES = ['All', 'Fresh', 'Connected', 'Call Not Responding', 'Call Back Later', 'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost', 'Blocked'];
const SOURCES = ['All', 'Manual', 'Facebook', 'WhatsApp', 'Website', 'Excel'];



function StatCard({ icon: Icon, label, value, color }) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600',
    green: 'bg-emerald-50 text-emerald-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-[var(--theme-surface-faint)] text-[var(--theme-primary)]',
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
  const isAdmin = user?.role === 'manager' || user?.role === 'admin';
  const isCaller = user?.role === 'caller';

  // Determine available filter tabs based on role
  // Admin: My Leads, All Leads, Leads Assigned To Me
  // Caller: My Leads, Leads Assigned To Me (in "All Leads" section show only their leads)
  const filterOptions = isAdmin
    ? [
        { key: 'all', label: 'All Leads' },
        { key: 'mine', label: 'My Leads' },
        { key: 'last_week', label: 'Last Week' },
        { key: 'last_month', label: 'Last Month' },
      ]
    : [
        { key: 'mine', label: 'My Leads' },
        { key: 'last_week', label: 'Last Week' },
        { key: 'last_month', label: 'Last Month' },
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [statuses, setStatuses] = useState(FALLBACK_STATUSES);

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

  // Load configurable lead stage statuses (falls back to default list on error)
  useEffect(() => {
    leadStagesAPI.get().then(res => {
      const active = (res.data.config?.statuses || [])
        .filter(s => !s.archived)
        .sort((a, b) => a.order - b.order)
        .map(s => s.name);
      if (active.length) setStatuses(['All', ...active, 'Blocked']);
    }).catch(() => {});
  }, []);

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
      const params = { page, limit: 20 };
      // Date-based filters go as dateFilter; role/assignee filters go as filter
      if (filter === 'last_week' || filter === 'last_month') {
        params.filter = 'mine'; // callers always scoped to themselves
        params.dateFilter = filter;
      } else {
        params.filter = filter;
      }
      if (search) params.search = search;
      if (status !== 'All') params.status = status;
      if (source !== 'All') params.source = source;
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
    try {
      await leadsAPI.delete(id);
      fetchLeads();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete lead');
    }
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
    <div className="flex flex-col" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0 pb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">All Leads</h1>
          <p className="text-xs text-gray-400 mt-0.5">{total} total leads</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCharts(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border transition-all ${showCharts ? 'bg-[var(--theme-primary)] text-white border-[var(--theme-primary)]' : 'bg-white text-gray-600 border-gray-200 hover:border-[var(--theme-primary-pale)]'}`}
          >
            <BarChart2 className="w-4 h-4" />
            Charts
          </button>
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-xl border border-gray-200 bg-white text-gray-600 hover:border-gray-300 transition-all">
            <Download className="w-4 h-4" />
            Export
          </button>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowAddMenu(v => !v)}
              style={{ background: 'var(--btn-gradient)' }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl text-white transition-all shadow-sm hover:brightness-105"
            >
              <Plus className="w-4 h-4" />
              Add Lead
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showAddMenu && (
              <div style={{ position: 'absolute', right: 0, top: '110%', background: '#fff', border: '1px solid var(--theme-border-tint)', borderRadius: 10, boxShadow: '0 8px 24px rgba(var(--theme-primary-rgb),0.13)', minWidth: 200, zIndex: 300, overflow: 'hidden' }}
                onMouseLeave={() => setShowAddMenu(false)}>
                <div style={{ padding: '6px 14px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--theme-surface-faint5)' }}>Add Leads</div>
                {[
                  { label: 'Add Single Lead', to: '/leads/new', icon: '👤' },
                  { label: 'Add From Excel', to: '/bulk-import', icon: '📊' },
                  { label: 'Add From Integration', to: '/integrations', icon: '🔗' },
                ].map(item => (
                  <div key={item.to}
                    onClick={() => { setShowAddMenu(false); navigate(item.to); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer', fontSize: 14, color: '#374151' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--theme-surface-faint)'}
                    onMouseLeave={e => e.currentTarget.style.background = '#fff'}
                  >
                    <span>{item.icon}</span>{item.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Charts Panel */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in fade-in duration-300 flex-shrink-0 pb-4">
          {/* Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Lead Status Distribution</h3>
              <span className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded-lg">Bar Chart</span>
            </div>
            {statsLoading ? (
              <div className="flex justify-center items-center h-48">
                <div className="w-7 h-7 spinner-gradient" />
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
                <div className="w-7 h-7 spinner-gradient" />
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

      {/* Admin View and Leads table are now two independent, separately positioned cards */}
      <div className="flex flex-col md:flex-row items-stretch gap-4 md:gap-6 flex-1 min-h-0">
        {/* Admin View - separate standalone card, scrolls independently */}
        <div className="w-full md:w-52 flex-shrink-0 bg-white rounded-2xl border border-gray-100 shadow-sm p-3 space-y-1 overflow-y-auto max-h-56 md:max-h-none">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-2 mb-2">
              {isAdmin ? 'Admin View' : 'Caller View'}
            </div>
            {filterOptions.map(opt => (
              <button
                key={opt.key}
                onClick={() => setFilter(opt.key)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all text-left ${
                  filter === opt.key
                    ? 'text-white shadow-sm'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
                style={filter === opt.key ? { background: 'var(--btn-gradient)' } : undefined}
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
                        filter === c._id ? 'bg-[var(--theme-surface-faint)] text-[var(--theme-primary-dark)]' : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="w-6 h-6 rounded-full bg-[var(--theme-surface-tint2)] text-[var(--theme-primary-dark)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {c.name[0].toUpperCase()}
                      </div>
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* Leads table - separate standalone card, scrolls independently */}
        <div className="flex-1 min-w-0 bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
            {/* Search & Filters bar */}
            <div className="flex items-center gap-2 p-3 border-b border-gray-100 flex-shrink-0 flex-wrap">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[var(--theme-primary-light)] focus:ring-2 focus:ring-[var(--theme-surface-tint2)] bg-gray-50"
                />
              </div>

              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:border-[var(--theme-primary-light)] text-gray-600"
              >
                {statuses.map(s => <option key={s}>{s}</option>)}
              </select>

              <select
                value={source}
                onChange={e => setSource(e.target.value)}
                className="text-sm border border-gray-200 rounded-xl px-3 py-2 bg-gray-50 focus:outline-none focus:border-[var(--theme-primary-light)] text-gray-600"
              >
                {SOURCES.map(s => <option key={s}>{s}</option>)}
              </select>

              <button onClick={fetchLeads} className="p-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-gray-50/70">
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
                    {(isAdmin || isCaller) && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="px-4 py-16 text-center">
                        <div className="w-8 h-8 spinner-gradient mx-auto mb-2" />
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
                        <button onClick={() => navigate('/leads/new')} className="mt-3 text-xs text-[var(--theme-primary)] hover:underline">
                          + Add your first lead
                        </button>
                      </td>
                    </tr>
                  ) : (
                    leads.map(lead => (
                      <tr
                        key={lead._id}
                        onClick={() => navigate(`/leads/${lead._id}`)}
                        className="border-t border-gray-50 hover:bg-[var(--theme-surface-faint)]/30 cursor-pointer transition-colors group"
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
                              <div className="font-medium text-[var(--theme-primary-dark)] group-hover:text-[var(--theme-text-strongest)] text-sm">{lead.name}</div>
                              <div className="text-xs text-gray-400">{lead.phone}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={lead.status} />
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
                              <div className="w-6 h-6 rounded-full bg-[var(--theme-surface-tint2)] text-[var(--theme-primary-dark)] flex items-center justify-center text-xs font-bold flex-shrink-0">
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
                        {(isAdmin || isCaller) && (
                          <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              {isAdmin && (
                                <button
                                  onClick={e => handleBlock(lead, e)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:bg-orange-50 hover:text-orange-600 transition-colors"
                                  title="Block"
                                >
                                  <Ban className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={e => handleDelete(lead._id, e)}
                                  className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
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
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 flex-shrink-0">
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
                      className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${p === page ? 'bg-[var(--theme-primary)] text-white' : 'text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
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
  );
}