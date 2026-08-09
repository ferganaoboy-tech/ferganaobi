import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Database, RefreshCw, Trash2, ShieldAlert, X, Download, FileJson, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';
import { getDbStats, clearDomain, exportFullBackup, exportFullBackupJson, fetchUsers } from '../api';
import CustomSelect from './CustomSelect';

const inputClass = "w-full h-11 bg-surface border border-subtle focus:border-focus focus:shadow-[0_0_0_4px_var(--bg-subtle)] rounded-xl px-4 text-[15px] text-primary outline-none transition-all placeholder:text-tertiary";

const DatabaseManager = () => {
  const queryClient = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [password, setPassword] = useState('');

  const [isExporting, setIsExporting] = useState(false);
  const [isExportingJson, setIsExportingJson] = useState(false);

  const [dateTo, setDateTo] = useState('');
  const [employeeId, setEmployeeId] = useState('');

  const { data: statsRes, isLoading, refetch } = useQuery({
    queryKey: ['db-stats'],
    queryFn: getDbStats,
    staleTime: 60000, // 1 min
  });

  const { data: usersRes } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
    staleTime: 5 * 60 * 1000,
  });
  const users = usersRes?.data || [];

  const clearMutation = useMutation({
    mutationFn: clearDomain,
    onSuccess: (res) => {
      toast.success(res.message || "Muvaffaqiyatli tozalandi!");
      queryClient.invalidateQueries(); // Invalidate all
      setSelectedDomain(null);
      setPassword('');
      setDateTo('');
      setEmployeeId('');
      refetch();
      
      // If full reset, log out
      if (res.message?.includes("to'liq tozalandi")) {
        setTimeout(() => {
          localStorage.removeItem('crm_token');
          localStorage.removeItem('crm_user');
          window.location.href = '/login';
        }, 1500);
      }
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Xatolik yuz berdi");
    }
  });

  const handleClear = () => {
    if (!password) return toast.error("Parolni kiriting!");
    clearMutation.mutate({ action: selectedDomain.action, password, dateTo, employeeId });
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const res = await exportFullBackup();
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Oboi_Backup_${date}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("Excel muvaffaqiyatli yuklab olindi!");
    } catch (err) {
      toast.error("Excel yuklab olishda xatolik yuz berdi.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJson = async () => {
    try {
      setIsExportingJson(true);
      const res = await exportFullBackupJson();
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      const date = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `Oboi_Backup_${date}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success("JSON muvaffaqiyatli yuklab olindi!");
    } catch (err) {
      toast.error("JSON yuklab olishda xatolik yuz berdi.");
    } finally {
      setIsExportingJson(false);
    }
  };

  const getDomainStats = (statsArray, collectionNames) => {
    if (!statsArray) return { count: 0, size: 0 };
    return statsArray
      .filter(s => collectionNames.includes(s.name))
      .reduce((acc, curr) => ({ count: acc.count + curr.count, size: acc.size + curr.size }), { count: 0, size: 0 });
  };

  const statsArray = statsRes?.data || [];

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const domains = [
    {
      id: 1,
      title: "Savdo va Moliyaviy tarix",
      desc: "Buyurtmalar, to'lovlar, vozvratlar, o'tkazmalar",
      action: 'transactions',
      collections: ['orders', 'payments', 'returns', 'transfers', 'shifts'],
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      id: 2,
      title: "Mijozlar bazasi",
      desc: "Barcha mijozlarni o'chirish (savdolarga ta'sir qilmaydi, lekin xavfli)",
      action: 'customers',
      collections: ['customers'],
      color: 'text-orange-600',
      bg: 'bg-orange-50'
    },
    {
      id: 3,
      title: "Tizimni to'liq yangilash (Factory Reset)",
      desc: "Hamma narsani o'chiradi (Audit va Superadmindan tashqari)",
      action: 'full',
      collections: ['products', 'warehouses', 'orders', 'payments', 'customers', 'returns', 'transfers', 'shifts'],
      color: 'text-red-600',
      bg: 'bg-red-50'
    }
  ];

  const totalSize = statsArray.reduce((acc, curr) => acc + curr.size, 0);
  const totalLimit = 512 * 1024 * 1024; // 512 MB
  const usedPercent = Math.min((totalSize / totalLimit) * 100, 100).toFixed(1);
  const freeSize = totalLimit - totalSize;

  return (
    <div className="bg-surface border border-subtle rounded-xl shadow-sm mt-4 sm:mt-8 overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-subtle">
        <h2 className="text-16 sm:text-17 font-bold text-primary flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500 shrink-0" /> 
          <span className="truncate">Ma'lumotlar Bazasi</span>
        </h2>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <button 
            onClick={() => refetch()}
            disabled={isLoading}
            className="p-2 sm:p-2.5 h-[42px] sm:h-10 w-[42px] sm:w-10 flex items-center justify-center border border-subtle hover:bg-subtle rounded-lg text-secondary transition-colors shrink-0"
          >
            <RefreshCw className={`w-4 h-4 sm:w-5 sm:h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          
          <button 
            onClick={handleExportJson}
            disabled={isExportingJson}
            className="flex-1 sm:flex-none h-[42px] sm:h-10 px-4 bg-app border border-subtle text-primary rounded-lg text-13 sm:text-14 font-[600] hover:bg-subtle transition-colors flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap"
          >
            {isExportingJson ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> : <FileJson className="w-4 h-4 shrink-0 text-amber-500" />}
            JSON
          </button>

          <button 
            onClick={handleExport}
            disabled={isExporting}
            className="flex-1 sm:flex-none h-[42px] sm:h-10 px-4 bg-blue-600 text-white rounded-lg text-13 sm:text-14 font-[600] hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60 whitespace-nowrap"
          >
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin shrink-0" /> : <FileSpreadsheet className="w-4 h-4 shrink-0" />}
            Excel
          </button>
        </div>
      </div>

      <div className="px-4 sm:px-5 pb-4 sm:pb-5 mt-4 sm:mt-0">
        {/* Xotira Foydalanish Card */}
        <div className="border border-blue-500/20 bg-blue-500/5 rounded-xl p-4 sm:p-5 mb-5 sm:mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-13 sm:text-14 font-semibold text-primary">Xotira Foydalanish</span>
            <span className="text-13 sm:text-14 font-bold text-green-500">{usedPercent}%</span>
          </div>
          
          <div className="h-2 w-full bg-blue-500/20 rounded-full mb-4 overflow-hidden">
            <div 
              className="h-full bg-blue-500 rounded-full" 
              style={{ width: `${usedPercent}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div>
              <div className="text-11 sm:text-13 text-secondary mb-0.5 sm:mb-1">Ishlatilgan</div>
              <div className="text-13 sm:text-15 font-bold text-primary">{formatBytes(totalSize)}</div>
            </div>
            <div>
              <div className="text-11 sm:text-13 text-secondary mb-0.5 sm:mb-1">Bo'sh</div>
              <div className="text-13 sm:text-15 font-bold text-green-500">{formatBytes(freeSize)}</div>
            </div>
            <div>
              <div className="text-11 sm:text-13 text-secondary mb-0.5 sm:mb-1">Collections</div>
              <div className="text-13 sm:text-15 font-bold text-primary">{statsArray.length}</div>
            </div>
          </div>
        </div>

        {/* Collections Table Container */}
        <div className="border border-subtle rounded-xl overflow-hidden">
          <div className="bg-subtle/30 px-3 sm:px-4 py-2 sm:py-3 border-b border-subtle">
            <span className="text-11 sm:text-12 font-bold text-tertiary tracking-wider">DOMAINS (GURUHLAR)</span>
          </div>
          
          <div className="overflow-x-auto w-full custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead className="bg-surface">
                <tr className="border-b border-subtle text-12 sm:text-13 font-bold text-secondary">
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 font-semibold whitespace-nowrap">Nom</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-semibold whitespace-nowrap">Hujjatlar</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-right font-semibold whitespace-nowrap">Hajm</th>
                  <th className="py-2.5 sm:py-3 px-3 sm:px-4 text-center font-semibold whitespace-nowrap">Amallar</th>
                </tr>
              </thead>
              <tbody className="text-13 sm:text-14 text-primary">
                {domains.map((domain) => {
                  const { count, size } = getDomainStats(statsArray, domain.collections);
                  return (
                    <tr key={domain.id} className="border-b border-subtle last:border-0 hover:bg-subtle/50 transition-colors group">
                      <td className="py-3 sm:py-4 px-3 sm:px-4 w-[200px] sm:w-auto">
                        <div className={`font-semibold text-13 sm:text-14 ${domain.color}`}>{domain.title}</div>
                        <div className="text-11 sm:text-12 text-tertiary mt-1 sm:mt-0.5 leading-snug whitespace-normal line-clamp-2 sm:line-clamp-none">{domain.desc}</div>
                      </td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-center whitespace-nowrap font-medium">{count.toLocaleString()}</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-right whitespace-nowrap font-medium text-secondary">{formatBytes(size)}</td>
                      <td className="py-3 sm:py-4 px-3 sm:px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2 sm:gap-3">
                          <button 
                            className="p-1.5 text-blue-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                            onClick={() => refetch()}
                            title="Yangilash"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedDomain(domain)}
                            className="p-1.5 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Tozalash"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {selectedDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between p-4 border-b border-border bg-state-danger-bg">
              <div className="flex items-center gap-2 text-state-danger-text font-[600]">
                <ShieldAlert className="w-5 h-5" /> 
                Tozalashni tasdiqlang
              </div>
              <button 
                onClick={() => {
                  setSelectedDomain(null);
                  setPassword('');
                  setDateTo('');
                  setEmployeeId('');
                }}
                className="p-1 hover:bg-black/10 rounded-lg transition-colors text-state-danger-text"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5">
              <p className="text-14 text-secondary mb-4 leading-relaxed">
                Siz hozir <strong className="text-primary">{selectedDomain.title}</strong> bo'limini o'chirish arafasidasiz.
                Bu amalni orqaga qaytarib bo'lmaydi.
              </p>

              <div className="mb-6">
                {selectedDomain.action === 'transactions' && (
                  <div className="mb-4 p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-3">
                    <p className="text-12 sm:text-13 text-secondary leading-relaxed">
                      Ixtiyoriy: Agar faqat ma'lum vaqtgacha yoki ma'lum xodimning savdolarini o'chirmoqchi bo'lsangiz, filtrlarni tanlang.
                    </p>
                    <div>
                      <label className="block text-12 font-semibold text-primary mb-1">Qaysi sanagacha?</label>
                      <input 
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="w-full h-10 px-3 bg-app border border-subtle rounded-lg text-primary text-13 outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-12 font-semibold text-primary mb-1">Xodim</label>
                      <CustomSelect
                        value={employeeId || ''}
                        onChange={(val) => setEmployeeId(val)}
                        options={[
                          { value: '', label: 'Barchasi' },
                          ...users.map(u => ({ value: u._id, label: `${u.name} (${u.role})` }))
                        ]}
                      />
                    </div>
                  </div>
                )}

                <label className="block text-13 font-[600] text-primary mb-2">
                  Tasdiqlash uchun <span className="text-state-danger-text">Superadmin Parolini</span> kiriting:
                </label>
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 px-4 bg-app border border-border rounded-xl focus:border-blue-500 outline-none text-primary"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setSelectedDomain(null);
                    setPassword('');
                    setDateTo('');
                    setEmployeeId('');
                  }}
                  className="flex-1 h-11 bg-bg-tertiary text-primary rounded-xl font-[600] hover:bg-border transition-colors"
                >
                  Bekor qilish
                </button>
                <button 
                  onClick={handleClear}
                  disabled={clearMutation.isLoading || !password}
                  className="flex-1 h-11 bg-[#dc2626] text-white rounded-xl font-[600] hover:bg-[#b91c1c] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearMutation.isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  {clearMutation.isLoading ? "Bajarilmoqda..." : "O'chirish"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatabaseManager;
