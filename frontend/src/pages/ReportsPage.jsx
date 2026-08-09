import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, Search, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import api from '../api';
import toast from 'react-hot-toast';

const PRESETS = [
  { label: 'Bugun', value: 'today' },
  { label: 'Kecha', value: 'yesterday' },
  { label: '7 kun', value: 'last7' },
  { label: '30 kun', value: 'last30' },
  { label: 'Shu oy', value: 'thisMonth' },
  { label: 'Barchasi', value: 'all' },
  { label: 'Maxsus', value: 'custom' }
];

const ReportsPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [preset, setPreset] = useState('last30');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (preset === 'custom') return;
    if (preset === 'all') {
      setDateRange({ start: '', end: '' });
      return;
    }
    
    const today = new Date();
    let start = new Date();
    let end = new Date();
    
    if (preset === 'yesterday') {
      start.setDate(today.getDate() - 1);
      end.setDate(today.getDate() - 1);
    } else if (preset === 'last7') {
      start.setDate(today.getDate() - 6);
    } else if (preset === 'last30') {
      start.setDate(today.getDate() - 29);
    } else if (preset === 'thisMonth') {
      start = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    
    const formatDate = (d) => {
       const tzOffset = d.getTimezoneOffset() * 60000;
       return new Date(d - tzOffset).toISOString().split('T')[0];
    };
    
    setDateRange({ start: formatDate(start), end: formatDate(end) });
  }, [preset]);

  useEffect(() => {
    if (preset === 'custom' && (!dateRange.start || !dateRange.end)) {
       return;
    }
    fetchReportData();
  }, [dateRange.start, dateRange.end, preset]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange.start && dateRange.end) {
        params.startDate = dateRange.start;
        params.endDate = dateRange.end;
      }
      const res = await api.get('/reports/sales', { params });
      if (res.data.success) {
        setData(res.data.data);
      } else {
        toast.error(res.data.message || 'Xatolik yuz berdi');
      }
    } catch (error) {
      console.error('Reports error:', error);
      toast.error('Hisobotlarni yuklashda xatolik');
    } finally {
      setLoading(false);
    }
  };

  const handleExportExcel = async () => {
    try {
      setExporting(true);
      const params = {};
      if (dateRange.start && dateRange.end) {
        params.startDate = dateRange.start;
        params.endDate = dateRange.end;
      }
      const res = await api.get('/reports/export-excel', { params, responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Analitika_${new Date().toISOString().split('T')[0]}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      toast.success('Excel fayl muvaffaqiyatli yuklab olindi!');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export qilishda xatolik');
    } finally {
      setExporting(false);
    }
  };

  const formatMoney = (val) => {
    return new Intl.NumberFormat('ru-RU').format(val || 0).replace(/,/g, ' ') + " UZS";
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-100 p-3 rounded-lg shadow-lg">
          <p className="text-[12px] font-[600] text-gray-500 mb-1">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 mb-1 last:mb-0">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></div>
              <p className="text-[14px] font-[700] text-gray-800">
                {formatMoney(entry.value)}
              </p>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const kpi = data?.kpi || { revenue: 0, orders: 0, quantity: 0 };
  const chartData = data?.chartData || [];
  const products = data?.products || [];

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const searchStr = (p.name + ' ' + p.artikul).toLowerCase();
      return searchStr.includes(searchQuery.toLowerCase());
    });
  }, [products, searchQuery]);

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage, 
    currentPage * itemsPerPage
  );

  return (
    <div className="flex flex-col h-full bg-[#f9fafb] overflow-auto">
      <div className="w-full mx-auto px-4 md:px-8 py-6 md:py-8 space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-[20px] md:text-[24px] font-[700] text-gray-900 leading-tight">Analitika va Hisobotlar</h1>
            <p className="text-[13px] font-[400] text-gray-400 mt-1">
              Moliyaviy ko'rsatkichlar va mahsulotlar reytingi
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchReportData}
              className="px-4 h-[40px] rounded-lg bg-white border border-gray-200 text-gray-600 text-[13px] font-[600] flex items-center gap-2 hover:bg-gray-50 transition-colors shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Yangilash
            </button>
            <button
              onClick={handleExportExcel}
              disabled={exporting}
              className="px-5 h-[40px] rounded-lg bg-gray-900 text-white text-[13px] font-[600] flex items-center gap-2 hover:bg-gray-800 transition-colors shadow-sm disabled:opacity-70"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel export
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-2 p-1 bg-gray-100/80 rounded-xl w-full md:w-max overflow-x-auto border border-gray-200/50">
          {PRESETS.map(p => (
            <button
              key={p.value}
              onClick={() => setPreset(p.value)}
              className={`shrink-0 px-4 py-2 rounded-lg text-[13px] font-[600] transition-all whitespace-nowrap ${
                preset === p.value 
                ? 'bg-white text-gray-900 shadow-sm' 
                : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center gap-2 px-2 shrink-0">
              <input 
                type="date" 
                value={dateRange.start} 
                onChange={e => setDateRange(p => ({ ...p, start: e.target.value }))}
                className="h-8 px-2 text-[12px] bg-white border border-gray-200 rounded-md outline-none"
              />
              <span className="text-gray-400">-</span>
              <input 
                type="date" 
                value={dateRange.end} 
                onChange={e => setDateRange(p => ({ ...p, end: e.target.value }))}
                className="h-8 px-2 text-[12px] bg-white border border-gray-200 rounded-md outline-none"
              />
            </div>
          )}
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
            <h4 className="text-[11px] font-[700] text-gray-400 uppercase tracking-wider mb-2">Jami Tushum</h4>
            <div>
              <div className="text-[22px] md:text-[28px] font-[700] text-gray-900 tracking-tight">{formatMoney(kpi.revenue)}</div>
              <p className="text-[13px] text-gray-400 mt-1">Barcha sotuvlar</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
            <h4 className="text-[11px] font-[700] text-gray-400 uppercase tracking-wider mb-2">Buyurtmalar Soni</h4>
            <div>
              <div className="text-[22px] md:text-[28px] font-[700] text-gray-900 tracking-tight">{kpi.orders} <span className="text-[16px] font-[500] text-gray-400">ta</span></div>
              <p className="text-[13px] text-gray-400 mt-1">Barcha buyurtmalar</p>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm flex flex-col justify-between">
            <h4 className="text-[11px] font-[700] text-gray-400 uppercase tracking-wider mb-2">Sotilgan Miqdor</h4>
            <div>
              <div className="text-[22px] md:text-[28px] font-[700] text-gray-900 tracking-tight">{kpi.quantity} <span className="text-[16px] font-[500] text-gray-400">rulon</span></div>
              <p className="text-[13px] text-gray-400 mt-1">Umumiy hajm</p>
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-[16px] font-[700] text-gray-900">Kunbay savdo dinamikasi</h2>
              <p className="text-[13px] text-gray-400 mt-1">Davr davomida moliyaviy o'sish</p>
            </div>
          </div>
          
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTushum" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#111827" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#111827" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis 
                  dataKey="displayDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  tickFormatter={(value) => `${(value / 1000000).toFixed(1)}M`}
                  dx={-10}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1, strokeDasharray: '4 4' }} />
                
                <Area 
                  type="monotone" 
                  dataKey="savdo" 
                  name="Tushum"
                  stroke="#111827" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorTushum)" 
                  activeDot={{ r: 4, strokeWidth: 0, fill: '#111827' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Products Table Card */}
        <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-[700] text-gray-900">Mahsulotlar kesimida savdo reytingi</h2>
              <p className="text-[13px] text-gray-400 mt-1">Jami {filteredProducts.length} pozitsiya</p>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  placeholder="Qidiruv (nomi, artikul)..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  className="w-full md:w-64 h-10 pl-9 pr-4 rounded-xl bg-gray-50 border border-gray-200 text-[13px] text-gray-800 outline-none focus:border-gray-300 placeholder:text-gray-400"
                />
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[800px]">
              <thead>
                <tr>
                  <th className="px-6 py-4 text-[11px] font-[700] text-gray-400 uppercase tracking-wider border-b border-gray-100 w-12">#</th>
                  <th className="px-6 py-4 text-[11px] font-[700] text-gray-400 uppercase tracking-wider border-b border-gray-100">Mahsulot</th>
                  <th className="px-6 py-4 text-[11px] font-[700] text-gray-400 uppercase tracking-wider border-b border-gray-100">Artikul</th>
                  <th className="px-6 py-4 text-[11px] font-[700] text-gray-400 uppercase tracking-wider border-b border-gray-100 text-right">Sotildi</th>
                  <th className="px-6 py-4 text-[11px] font-[700] text-gray-400 uppercase tracking-wider border-b border-gray-100 text-right">Tushum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {paginatedProducts.map((p, idx) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[13px] font-[600] text-gray-500">{(currentPage - 1) * itemsPerPage + idx + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[14px] font-[700] text-gray-900 uppercase block">{p.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-[13px] font-[600] text-gray-600">{p.artikul}</span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="text-[14px] font-[700] text-gray-800">{p.quantity}</span>
                      <span className="text-[11px] font-[500] text-gray-400 ml-1">rulon</span>
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <span className="text-[15px] font-[700] text-gray-900">{formatMoney(p.revenue)}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[13px] text-gray-500">
                Jami {filteredProducts.length} tadan {(currentPage - 1) * itemsPerPage + 1}-{Math.min(currentPage * itemsPerPage, filteredProducts.length)} ko'rsatilmoqda
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {[...Array(totalPages)].map((_, i) => {
                    const pageNum = i + 1;
                    if (pageNum === 1 || pageNum === totalPages || (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)) {
                       return (
                         <button
                           key={pageNum}
                           onClick={() => setCurrentPage(pageNum)}
                           className={`w-8 h-8 flex items-center justify-center rounded-lg text-[13px] font-[600] transition-colors ${
                             currentPage === pageNum 
                               ? 'bg-gray-900 text-white' 
                               : 'text-gray-600 hover:bg-gray-50 border border-transparent'
                           }`}
                         >
                           {pageNum}
                         </button>
                       );
                    } else if (pageNum === currentPage - 2 || pageNum === currentPage + 2) {
                       return <span key={`dots-${pageNum}`} className="text-gray-400 px-1">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:hover:bg-transparent transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ReportsPage;
