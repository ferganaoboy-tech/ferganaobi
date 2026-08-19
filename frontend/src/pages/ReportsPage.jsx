import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  FileSpreadsheet, RefreshCw, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, ShoppingCart, Package,
  RotateCcw, CreditCard, BarChart3, Search, ArrowUpDown,
  CalendarRange, Wallet, Activity, AlertCircle, Users, Tag, CalendarDays
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell,
  Legend, ScatterChart, Scatter, ZAxis
} from 'recharts';
import api from '../api';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS & UTILS
// ─────────────────────────────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Bugun',    value: 'today'     },
  { label: 'Kecha',    value: 'yesterday' },
  { label: '7 kun',   value: 'last7'     },
  { label: '30 kun',  value: 'last30'    },
  { label: 'Shu oy',  value: 'thisMonth' },
  { label: 'Barchasi', value: 'all'      },
  { label: 'Maxsus',  value: 'custom'    },
];

const ITEMS_PER_PAGE = 10;
const PAY_COLORS = { Naqd: '#10b981', Nasiya: '#f59e0b', Qisman: '#6366f1' };
const TYPE_COLORS = { 'Chakana (Retail)': '#ec4899', 'Ulgurji (Wholesale)': '#3b82f6' };
const BRAND_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#14b8a6', '#6366f1'];

const fmt = (val) => new Intl.NumberFormat('ru-RU').format(Math.round(val || 0)) + ' UZS';
const fmtCompact = (val) => {
  const n = val || 0;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + ' mlrd';
  if (abs >= 1_000_000)     return (n / 1_000_000).toFixed(1) + ' mln';
  if (abs >= 1_000)         return (n / 1_000).toFixed(0) + ' ming';
  return n.toString();
};

const getPresetDates = (preset) => {
  const today = new Date();
  const pad = (d) => {
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().split('T')[0];
  };
  let s = new Date(today), e = new Date(today);
  if (preset === 'yesterday') { s.setDate(today.getDate() - 1); e.setDate(today.getDate() - 1); }
  else if (preset === 'last7') { s.setDate(today.getDate() - 6); }
  else if (preset === 'last30') { s.setDate(today.getDate() - 29); }
  else if (preset === 'thisMonth') { s = new Date(today.getFullYear(), today.getMonth(), 1); }
  return { start: pad(s), end: pad(e) };
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const Skeleton = ({ className = '' }) => <div className={`animate-shimmer rounded-xl ${className}`} />;

const KpiCard = ({ icon: Icon, label, value, sub, color = 'default', loading }) => {
  const c = {
    default: { bg: 'bg-[var(--bg-surface)]', icon: 'text-[var(--text-secondary)]', val: 'text-[var(--text-primary)]' },
    green:   { bg: 'bg-[var(--bg-surface)]', icon: 'text-emerald-500', val: 'text-emerald-600' },
    red:     { bg: 'bg-[var(--bg-surface)]', icon: 'text-rose-500',    val: 'text-rose-600' },
    amber:   { bg: 'bg-[var(--bg-surface)]', icon: 'text-amber-500',   val: 'text-amber-600' },
    indigo:  { bg: 'bg-[var(--bg-surface)]', icon: 'text-indigo-500',  val: 'text-indigo-600' },
  }[color] || { bg: 'bg-[var(--bg-surface)]', icon: 'text-[var(--text-secondary)]', val: 'text-[var(--text-primary)]' };

  if (loading) return (
    <div className={`${c.bg} rounded-2xl p-5 border border-[var(--border-subtle)] shadow-sm`}>
      <Skeleton className="h-3 w-24 mb-3" /><Skeleton className="h-7 w-32 mb-2" /><Skeleton className="h-3 w-16" />
    </div>
  );

  return (
    <div className={`${c.bg} rounded-2xl p-5 border border-[var(--border-subtle)] shadow-sm hover:shadow-md transition-all group`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-[11px] font-[700] text-[var(--text-tertiary)] uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-[var(--bg-subtle)] ${c.icon} group-hover:scale-110 transition-transform`}><Icon className="w-4 h-4" /></div>
      </div>
      <div className={`text-[22px] md:text-[24px] font-[800] ${c.val} tracking-tight leading-none mb-2`}>{value}</div>
      {sub && <p className="text-[12px] text-[var(--text-tertiary)] font-[500]">{sub}</p>}
    </div>
  );
};

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-xl shadow-xl p-3 min-w-[160px] z-50">
      <p className="text-[11px] font-[700] text-[var(--text-tertiary)] uppercase mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
            <span className="text-[12px] text-[var(--text-secondary)] font-[500]">{entry.name}</span>
          </div>
          <span className="text-[13px] font-[700] text-[var(--text-primary)]">{fmtCompact(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const DonutLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
  if (percent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  return (
    <text x={cx + radius * Math.cos(-midAngle * RADIAN)} y={cy + radius * Math.sin(-midAngle * RADIAN)} fill="white" textAnchor="middle" dominantBaseline="central" style={{ fontSize: 11, fontWeight: 700 }}>
      {(percent * 100).toFixed(0)}%
    </text>
  );
};

const AbcBadge = ({ val }) => {
  if (val === 'A') return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[11px] font-[800] rounded-md">A</span>;
  if (val === 'B') return <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[11px] font-[800] rounded-md">B</span>;
  return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-[800] rounded-md">C</span>;
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

const ReportsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [preset, setPreset] = useState('last30');
  
  // Tabs: main, products, customers, trends
  const [activeTab, setActiveTab] = useState('main'); 
  const abortRef = useRef(null);

  // Table State
  const [searchQuery, setSearch] = useState('');
  const [currentPage, setPage] = useState(1);
  const [sortBy, setSortBy] = useState('revenue');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    if (preset === 'custom') return;
    if (preset === 'all') { setDateRange({ start: '', end: '' }); return; }
    setDateRange(getPresetDates(preset));
  }, [preset]);

  const fetchData = useCallback(async () => {
    if (preset === 'custom' && (!dateRange.start || !dateRange.end)) return;
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    try {
      const params = {};
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;
      const res = await api.get('/reports/sales', { params, signal: controller.signal });
      if (res.data.success) { setData(res.data.data); setPage(1); }
      else toast.error(res.data.message || 'Xatolik');
    } catch (err) {
      if (err.name !== 'CanceledError' && err.name !== 'AbortError') toast.error('Yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  }, [dateRange.start, dateRange.end, preset]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (dateRange.start) params.startDate = dateRange.start;
      if (dateRange.end) params.endDate = dateRange.end;
      const res = await api.get('/reports/export-excel', { params, responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = `Deep_Analytics_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      toast.success('Excel yuklab olindi!');
    } catch { toast.error('Export xatolik'); }
    finally { setExporting(false); }
  };

  const kpi = data?.kpi || {};
  const allProducts = data?.products || [];

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = allProducts.filter(p => !q || `${p.name} ${p.artikul} ${p.brand}`.toLowerCase().includes(q));
    return [...list].sort((a, b) => (sortDir === 'desc' ? (b[sortBy] || 0) - (a[sortBy] || 0) : (a[sortBy] || 0) - (b[sortBy] || 0)));
  }, [allProducts, searchQuery, sortBy, sortDir]);

  const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
  const pageProducts = filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const TABS = [
    { id: 'main', icon: Activity, label: 'Umumiy' },
    { id: 'products', icon: Package, label: 'Mahsulotlar (ABC)' },
    { id: 'customers', icon: Users, label: 'Mijozlar' },
    { id: 'trends', icon: CalendarDays, label: 'Trendlar' },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--bg-app)] overflow-auto">
      <div className="w-full mx-auto px-4 md:px-8 py-6 space-y-6 max-w-[1600px]">

        {/* ── Header ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[24px] md:text-[28px] font-[800] text-[var(--text-primary)] leading-tight tracking-tight">
              Chuqur Tahlil (Deep Analytics)
            </h1>
            <p className="text-[13px] text-[var(--text-tertiary)] mt-1 font-[500]">
              Biznesingizning barcha qirralari bo'yicha mukammal moliyaviy hisobot
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={fetchData} disabled={loading} className="h-[40px] px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-default)] text-[var(--text-primary)] text-[13px] font-[600] flex items-center gap-2 hover:bg-[var(--bg-raised)] transition-all">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
            <button onClick={handleExport} disabled={exporting || loading} className="h-[40px] px-5 rounded-xl bg-indigo-600 text-white text-[13px] font-[600] flex items-center gap-2 hover:bg-indigo-500 shadow-lg shadow-indigo-500/20 transition-all">
              <FileSpreadsheet className="w-4 h-4" />
              {exporting ? '...' : 'Excel Yuklash'}
            </button>
          </div>
        </div>

        {/* ── Filter & Tabs ── */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 bg-[var(--bg-surface)] p-2 rounded-2xl border border-[var(--border-subtle)] shadow-sm">
          
          {/* Tabs */}
          <div className="flex p-1 bg-[var(--bg-subtle)] rounded-xl overflow-x-auto no-scrollbar border border-[var(--border-default)]">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[13px] font-[600] whitespace-nowrap transition-all ${
                  activeTab === t.id ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-raised)]'
                }`}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>

          {/* Dates */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
            {PRESETS.map(p => (
              <button key={p.value} onClick={() => setPreset(p.value)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-[600] transition-all ${
                  preset === p.value ? 'bg-indigo-600 text-white shadow-md' : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--border-default)] hover:text-[var(--text-primary)]'
                }`}>
                {p.label}
              </button>
            ))}
            {preset === 'custom' && (
              <div className="flex items-center gap-1 px-2 py-1 bg-[var(--bg-subtle)] rounded-lg">
                <input type="date" value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} className="h-6 px-1 text-[12px] bg-transparent outline-none text-[var(--text-primary)] [color-scheme:dark]" />
                <span className="text-[var(--text-tertiary)]">-</span>
                <input type="date" value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} className="h-6 px-1 text-[12px] bg-transparent outline-none text-[var(--text-primary)] [color-scheme:dark]" />
              </div>
            )}
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        
        {/* TAB: MAIN */}
        {activeTab === 'main' && (
          <div className="space-y-6 animate-fade-in">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard icon={Wallet} label="Sof Tushum" color="green" loading={loading} value={fmt(kpi.netRevenue)} sub={`Umumiy: ${fmtCompact(kpi.revenue)}`} />
              <KpiCard icon={TrendingUp} label="Sof Foyda" color="indigo" loading={loading} value={fmt(kpi.profit)} sub={`Marja: ${kpi.marginPercent?.toFixed(1)}%`} />
              <KpiCard icon={RotateCcw} label="Vozvrat Summasi" color="red" loading={loading} value={fmt(kpi.returnAmount)} sub={`${kpi.returnCount} ta operatsiya`} />
              <KpiCard icon={AlertCircle} label="Nasiya / Qarz" color="amber" loading={loading} value={fmt(kpi.debt)} sub="Tasdiqlangan buyurtmalardan" />
              
              <KpiCard icon={Package} label="Sotilgan Hajm" loading={loading} value={`${(kpi.netQty || 0).toLocaleString('ru')} dona`} sub={`Brak qaytgan: ${kpi.returnedQty || 0}`} />
              <KpiCard icon={ShoppingCart} label="Buyurtmalar" loading={loading} value={kpi.orders || 0} sub={`O'rtacha chek: ${fmtCompact(kpi.avgCheck)}`} />
              
              {/* Payment Pie & Type Pie inline as cards */}
              <div className="col-span-2 grid grid-cols-2 gap-4">
                <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-subtle)] shadow-sm flex flex-col items-center justify-center">
                  <h4 className="text-[11px] font-[700] text-[var(--text-tertiary)] uppercase w-full text-left mb-2">To'lov Usullari</h4>
                  {loading ? <Skeleton className="h-[100px] w-full" /> : (
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={data?.paymentChartData} dataKey="value" innerRadius="50%" outerRadius="80%" paddingAngle={2} label={DonutLabel} labelLine={false} stroke="var(--bg-surface)" strokeWidth={2}>
                          {data?.paymentChartData?.map(d => <Cell key={d.name} fill={PAY_COLORS[d.name] || '#888'} />)}
                        </Pie>
                        <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="bg-[var(--bg-surface)] rounded-2xl p-4 border border-[var(--border-subtle)] shadow-sm flex flex-col items-center justify-center">
                  <h4 className="text-[11px] font-[700] text-[var(--text-tertiary)] uppercase w-full text-left mb-2">Savdo Turi</h4>
                  {loading ? <Skeleton className="h-[100px] w-full" /> : (
                    <ResponsiveContainer width="100%" height={120}>
                      <PieChart>
                        <Pie data={data?.typeChartData} dataKey="value" innerRadius="50%" outerRadius="80%" paddingAngle={2} label={DonutLabel} labelLine={false} stroke="var(--bg-surface)" strokeWidth={2}>
                          {data?.typeChartData?.map(d => <Cell key={d.name} fill={TYPE_COLORS[d.name] || '#888'} />)}
                        </Pie>
                        <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>

            {/* Daily Trend Chart */}
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
              <h3 className="text-[15px] font-[700] text-[var(--text-primary)] mb-6">Kunlik Daromad va Foyda Dinamikasi</h3>
              {loading ? <Skeleton className="h-[300px] w-full" /> : (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/><stop offset="95%" stopColor="#6366f1" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gProf" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                      <XAxis dataKey="displayDate" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={v => `${(v/1_000_000).toFixed(1)}M`} dx={-5} />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border-default)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                      <Area type="monotone" dataKey="savdo" name="Tushum" stroke="#6366f1" strokeWidth={3} fill="url(#gRev)" activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }} />
                      <Area type="monotone" dataKey="foyda" name="Foyda" stroke="#10b981" strokeWidth={2} fill="url(#gProf)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: PRODUCTS (ABC) */}
        {activeTab === 'products' && (
          <div className="space-y-6 animate-fade-in">
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Brand Breakdown */}
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
                <h3 className="text-[14px] font-[700] text-[var(--text-primary)] mb-4">Brendlar Ulushi</h3>
                {loading ? <Skeleton className="h-[200px] w-full" /> : (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data?.brands?.slice(0, 8)} dataKey="revenue" nameKey="name" cx="50%" cy="50%" innerRadius="40%" outerRadius="75%" paddingAngle={2} labelLine={false} stroke="var(--bg-surface)" strokeWidth={2}>
                          {data?.brands?.slice(0,8).map((b, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={v => fmt(v)} contentStyle={{ borderRadius: 8, fontSize: 12, border: '1px solid var(--border-subtle)', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }} itemStyle={{ color: 'var(--text-primary)' }} />
                        <Legend iconSize={8} iconType="circle" wrapperStyle={{ fontSize: 11, color: 'var(--text-secondary)' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Top 5 Products Bar */}
              <div className="lg:col-span-2 bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
                <h3 className="text-[14px] font-[700] text-[var(--text-primary)] mb-4">Top 5 Mahsulot (Foyda vs Tushum)</h3>
                {loading ? <Skeleton className="h-[200px] w-full" /> : (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data?.top5Products} margin={{ top: 10, right: 0, left: 10, bottom: 0 }} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-subtle)" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} width={120} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-subtle)' }} />
                        <Bar dataKey="revenue" name="Tushum" fill="#6366f1" radius={[0, 4, 4, 0]} barSize={12} />
                        <Bar dataKey="margin" name="Marja (%)" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Deep Product Table */}
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-subtle)] flex flex-col sm:flex-row justify-between items-center gap-4">
                <h2 className="text-[15px] font-[700] text-[var(--text-primary)]">ABC Tahlil & Mahsulot Metrikalari</h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
                  <input type="text" placeholder="Qidiruv..." value={searchQuery} onChange={e => { setSearch(e.target.value); setPage(1); }} className="h-9 w-64 pl-9 pr-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-subtle)] text-[13px] outline-none focus:border-[var(--border-focus)] transition-colors" />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[1000px]">
                  <thead>
                    <tr className="bg-[var(--bg-subtle)] border-b border-[var(--border-subtle)]">
                      <th className="px-4 py-3 text-[11px] font-[700] text-[var(--text-tertiary)] uppercase w-10">#</th>
                      <th className="px-4 py-3 text-[11px] font-[700] text-[var(--text-tertiary)] uppercase w-12">ABC</th>
                      <th className="px-4 py-3 text-[11px] font-[700] text-[var(--text-tertiary)] uppercase">Mahsulot</th>
                      <th className="px-4 py-3 text-[11px] font-[700] text-[var(--text-tertiary)] uppercase cursor-pointer hover:text-[var(--text-primary)]" onClick={() => setSortBy('netQty')}>Sof Sotuv</th>
                      <th className="px-4 py-3 text-[11px] font-[700] text-[var(--text-tertiary)] uppercase cursor-pointer hover:text-[var(--text-primary)] text-right" onClick={() => setSortBy('returnRate')}>Vozvrat (%)</th>
                      <th className="px-4 py-3 text-[11px] font-[700] text-[var(--text-tertiary)] uppercase cursor-pointer hover:text-[var(--text-primary)] text-right" onClick={() => setSortBy('revenue')}>Tushum</th>
                      <th className="px-4 py-3 text-[11px] font-[700] text-[var(--text-tertiary)] uppercase cursor-pointer hover:text-[var(--text-primary)] text-right" onClick={() => setSortBy('profit')}>Foyda</th>
                      <th className="px-4 py-3 text-[11px] font-[700] text-[var(--text-tertiary)] uppercase cursor-pointer hover:text-[var(--text-primary)] text-right" onClick={() => setSortBy('margin')}>Marja</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {loading ? [...Array(5)].map((_, i) => <tr key={i}><td colSpan={8} className="p-4"><Skeleton className="h-4 w-full" /></td></tr>) :
                      pageProducts.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-[var(--bg-subtle)] transition-colors">
                          <td className="px-4 py-3 text-[12px] font-[600] text-[var(--text-tertiary)]">{(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}</td>
                          <td className="px-4 py-3"><AbcBadge val={p.abc} /></td>
                          <td className="px-4 py-3 flex items-center gap-3">
                            {p.image ? <img src={p.image} className="w-8 h-8 rounded border object-cover" /> : <div className="w-8 h-8 rounded bg-[var(--border-subtle)] flex items-center justify-center"><Package className="w-4 h-4 text-[var(--text-tertiary)]"/></div>}
                            <div>
                              <p className="text-[13px] font-[700] text-[var(--text-primary)] leading-tight">{p.name}</p>
                              <p className="text-[11px] font-[500] text-[var(--text-secondary)]">{p.artikul}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-[13px] font-[600] text-[var(--text-secondary)]">{p.netQty} <span className="text-[10px]">ta</span></td>
                          <td className="px-4 py-3 text-[13px] font-[600] text-right text-rose-500">{p.returnRate?.toFixed(1)}%</td>
                          <td className="px-4 py-3 text-[13px] font-[800] text-[var(--text-primary)] text-right">{fmt(p.revenue)}</td>
                          <td className="px-4 py-3 text-[13px] font-[700] text-indigo-500 text-right">{fmt(p.profit)}</td>
                          <td className="px-4 py-3 text-[13px] font-[800] text-emerald-500 text-right">{p.margin?.toFixed(1)}%</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
              {/* Simple Pagination */}
              {!loading && totalPages > 1 && (
                <div className="p-4 border-t border-[var(--border-subtle)] flex justify-between items-center">
                  <span className="text-[12px] text-[var(--text-tertiary)]">{filteredProducts.length} tadan sahifa {currentPage}/{totalPages}</span>
                  <div className="flex gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={currentPage===1} className="px-3 py-1 bg-[var(--bg-subtle)] rounded-lg text-[12px] font-[600] disabled:opacity-50">Oldingi</button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={currentPage===totalPages} className="px-3 py-1 bg-[var(--bg-subtle)] rounded-lg text-[12px] font-[600] disabled:opacity-50">Keyingi</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB: CUSTOMERS */}
        {activeTab === 'customers' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-sm p-6">
              <h3 className="text-[15px] font-[700] text-[var(--text-primary)] mb-4">Top 10 Faol Mijozlar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? <Skeleton className="h-[200px] w-full" /> : data?.topCustomers?.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-subtle)] hover:bg-[var(--bg-surface)] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)] text-white flex items-center justify-center font-[700] text-[14px]">
                        {i + 1}
                      </div>
                      <div>
                        <p className="text-[14px] font-[700] text-[var(--text-primary)]">{c.name}</p>
                        <p className="text-[12px] font-[500] text-[var(--text-tertiary)]">{c.phone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-[800] text-[var(--text-primary)]">{fmtCompact(c.revenue)}</p>
                      <p className="text-[11px] font-[600] text-indigo-500">{c.ordersCount} ta xarid</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB: TRENDS */}
        {activeTab === 'trends' && (
          <div className="space-y-6 animate-fade-in">
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-subtle)] p-6 shadow-sm">
              <h3 className="text-[15px] font-[700] text-[var(--text-primary)] mb-6">Hafta Kunlari Bo'yicha Faollik</h3>
              {loading ? <Skeleton className="h-[350px] w-full" /> : (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data?.weekTrendData} margin={{ top: 10, right: 0, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-subtle)" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-secondary)', fontWeight: 600 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--text-tertiary)' }} tickFormatter={v => `${(v/1_000_000).toFixed(0)}M`} dx={-5} />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-subtle)' }} />
                      <Bar dataKey="value" name="Tushum" fill="#f59e0b" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ReportsPage;
