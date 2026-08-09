import React, { useState } from 'react';
import { Package, Send, Download, Check, X, Search, Clock, RefreshCw, ArrowRight, Info } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';
import { haptics } from '../utils/haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useWarehouses } from '../hooks/useWarehouses';
import CustomSelect from '../components/CustomSelect';

const TransfersPage = () => {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('received');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  
  const { data: warehousesRes } = useWarehouses();
  const warehouses = warehousesRes?.data || [];

  const { data: transfersData, isLoading, refetch } = useQuery({
    queryKey: ['transfers', activeTab, selectedWarehouseId],
    queryFn: async () => {
      let url = `/transfers?type=${activeTab}`;
      if (isSuperAdmin && selectedWarehouseId && selectedWarehouseId !== 'all') {
        url += `&warehouseId=${selectedWarehouseId}`;
      }
      const res = await api.get(url);
      return res.data;
    },
    refetchOnWindowFocus: false,
  });

  const transfers = transfersData?.transfers || [];

  const handleAction = async (id, action) => {
    try {
      setIsSubmitting(true);
      haptics.light();
      await api.put(`/transfers/${id}/${action}`);
      toast.success(action === 'accept' ? "Qabul qilindi" : action === 'reject' ? "Rad etildi" : "Bekor qilindi");
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
    } catch (error) {
      toast.error(error.response?.data?.message || "Xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'requested':
        return <span className="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20 px-2 py-0.5 rounded text-[11px] font-[500] flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> So'rov</span>;
      case 'pending':
        return <span className="bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/20 px-2 py-0.5 rounded text-[11px] font-[500] flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Kutilmoqda</span>;
      case 'completed':
        return <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded text-[11px] font-[500] flex items-center gap-1.5"><Check className="w-3.5 h-3.5" /> Qabul qilingan</span>;
      case 'rejected':
      case 'cancelled':
        return <span className="bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/20 px-2 py-0.5 rounded text-[11px] font-[500] flex items-center gap-1.5"><X className="w-3.5 h-3.5" /> {status === 'rejected' ? 'Rad etilgan' : 'Bekor qilingan'}</span>;
      default:
        return null;
    }
  };

  const handleSync = async () => {
    try {
      haptics.light();
      await refetch();
      toast.success("O'tkazmalar yangilandi");
    } catch (error) {
      toast.error("Xatolik yuz berdi");
    }
  };

  return (
    <div className="h-full flex flex-col bg-app p-3 sm:p-6 lg:p-8 overflow-hidden max-w-full mx-auto w-full animate-fade-in">
      {/* Enterprise Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-[600] text-primary tracking-tight">O'tkazmalar</h1>
          <p className="text-[13px] text-secondary mt-1">Filiallar o'rtasida tovar harakatini boshqarish tizimi</p>
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {isSuperAdmin && (
            <CustomSelect
              value={selectedWarehouseId || 'all'}
              onChange={(val) => setSelectedWarehouseId(val === 'all' ? '' : val)}
              options={[
                { value: 'all', label: 'Barcha filiallar' },
                ...warehouses.filter(w => w.isActive !== false).map(w => ({ value: w._id, label: w.name }))
              ]}
              className="w-full sm:w-[220px] shrink-0"
            />
          )}
          <button
            onClick={handleSync}
            disabled={isLoading}
            className="h-[38px] w-[38px] flex items-center justify-center bg-surface border border-subtle rounded-lg text-secondary hover:text-primary hover:bg-subtle/50 active:scale-95 transition-all shadow-sm shrink-0"
            title="Yangilash"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Segmented Control */}
      <div className="bg-subtle/30 dark:bg-black/20 p-1 rounded-xl border border-subtle mb-6 shrink-0 w-full sm:w-[320px] flex shadow-sm">
        <button
          onClick={() => setActiveTab('received')}
          className={`flex-1 py-1.5 rounded-lg text-[13px] font-[500] transition-all flex items-center justify-center gap-2 ${activeTab === 'received' ? 'bg-surface shadow-sm text-primary border border-subtle' : 'text-secondary hover:text-primary hover:bg-subtle/50 border border-transparent'}`}
        >
          Kiruvchi
        </button>
        <button
          onClick={() => setActiveTab('sent')}
          className={`flex-1 py-1.5 rounded-lg text-[13px] font-[500] transition-all flex items-center justify-center gap-2 ${activeTab === 'sent' ? 'bg-surface shadow-sm text-primary border border-subtle' : 'text-secondary hover:text-primary hover:bg-subtle/50 border border-transparent'}`}
        >
          Chiquvchi
        </button>
      </div>

      {/* Grid Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-20">
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 w-full bg-surface border border-subtle rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-surface border border-dashed border-subtle rounded-xl">
            <Package className="w-8 h-8 text-tertiary mb-4" strokeWidth={1.5} />
            <h2 className="text-[14px] font-[600] text-primary mb-1">O'tkazmalar topilmadi</h2>
            <p className="text-[13px] text-secondary">
              {activeTab === 'received' ? 'Sizga yuborilgan tovarlar ro\'yxati bo\'sh.' : 'Siz yuborgan tovarlar ro\'yxati bo\'sh.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {transfers.map(transfer => (
              <div key={transfer._id} className="bg-surface border border-subtle rounded-xl flex flex-col hover:border-default transition-colors shadow-sm overflow-hidden">
                
                {/* Structured Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-subtle bg-subtle/10 dark:bg-subtle/5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface border border-subtle flex items-center justify-center shrink-0 text-tertiary">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-[600] text-primary leading-none">{transfer.transferNumber}</span>
                      </div>
                      <div className="text-[12px] font-[400] text-secondary mt-1 leading-none">
                        {new Date(transfer.createdAt).toLocaleString('uz-UZ', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(transfer.status)}
                </div>

                {/* Path Segment */}
                <div className="p-3 sm:p-4 border-b border-subtle flex items-center justify-between gap-4 bg-surface">
                  <div className="flex-1 flex flex-col">
                    <span className="text-[10px] font-[500] text-tertiary uppercase tracking-wider mb-1">Kimdan</span>
                    <span className="text-[14px] font-[500] text-primary truncate">{transfer.fromWarehouse?.name}</span>
                  </div>
                  <div className="shrink-0 px-2">
                    <ArrowRight className="w-4 h-4 text-tertiary" />
                  </div>
                  <div className="flex-1 flex flex-col items-end text-right">
                    <span className="text-[10px] font-[500] text-tertiary uppercase tracking-wider mb-1">Kimga</span>
                    <span className="text-[14px] font-[500] text-primary truncate">{transfer.toWarehouse?.name}</span>
                  </div>
                </div>

                {/* Notes */}
                {transfer.notes && (
                  <div className="px-3 sm:px-4 pt-4 pb-0">
                    <div className="bg-surface border border-subtle border-l-[3px] border-l-amber-500 rounded-xl p-3 flex items-start gap-2.5 shadow-sm">
                      <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                      <span className="text-[13px] font-[500] text-primary leading-relaxed break-words">{transfer.notes}</span>
                    </div>
                  </div>
                )}

                {/* Items List */}
                <div className="p-3 sm:p-4 flex-1 flex flex-col">
                  <div className="text-[12px] font-[500] text-primary mb-3">Mahsulotlar ({transfer.items.length})</div>
                  <div className="border border-subtle rounded-lg divide-y divide-subtle bg-surface flex-1">
                    {transfer.items.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded border border-subtle overflow-hidden flex items-center justify-center shrink-0 bg-app">
                            {item.product?.images?.[0]?.url ? (
                              <img src={item.product.images[0].url.replace('/upload/', '/upload/c_limit,w_100,q_auto,f_auto/')} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <Package className="w-4 h-4 text-tertiary opacity-50" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-[13px] font-[500] text-primary truncate leading-tight mb-0.5">{item.artikul}</div>
                            <div className="text-[11px] text-secondary truncate">{item.product?.brand || 'Brendsiz'}</div>
                          </div>
                        </div>
                        <div className="text-[12px] font-[600] text-primary px-2 py-1 bg-subtle/50 rounded border border-subtle/50 shrink-0 ml-2">
                          {item.quantity} <span className="font-[400] text-secondary">{item.unit || 'ta'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Structured Actions */}
                {(transfer.status === 'pending' || transfer.status === 'requested') && (
                  <div className="p-3 sm:p-4 pt-0 mt-auto flex flex-row gap-2">
                    {transfer.type !== 'request' && transfer.status === 'pending' && (
                      activeTab === 'received' && (user.role === 'superadmin' || String(transfer.toWarehouse?._id) === String(user.warehouse?._id || user.warehouse)) ? (
                        <>
                          <button 
                            disabled={isSubmitting}
                            onClick={() => handleAction(transfer._id, 'reject')}
                            className="flex-1 h-[36px] rounded-full border border-transparent text-[13px] font-[500] text-white bg-red-600 hover:bg-red-700 dark:bg-red-600/90 dark:hover:bg-red-500 transition-colors shadow-sm disabled:opacity-50"
                          >
                            Rad etish
                          </button>
                          <button 
                            disabled={isSubmitting}
                            onClick={() => handleAction(transfer._id, 'accept')}
                            className="flex-1 h-[36px] rounded-full border border-transparent text-[13px] font-[500] text-white bg-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-500 shadow-sm transition-colors disabled:opacity-50"
                          >
                            Qabul qilish
                          </button>
                        </>
                      ) : activeTab === 'sent' && (user.role === 'superadmin' || String(transfer.fromWarehouse?._id) === String(user.warehouse?._id || user.warehouse)) ? (
                        <button 
                          disabled={isSubmitting}
                          onClick={() => handleAction(transfer._id, 'cancel')}
                          className="w-full h-[36px] rounded-full border border-subtle text-[13px] font-[500] text-primary bg-surface hover:bg-subtle/50 transition-colors shadow-sm disabled:opacity-50"
                        >
                          Bekor qilish
                        </button>
                      ) : null
                    )}

                    {transfer.type === 'request' && transfer.status === 'requested' && (
                      activeTab === 'received' && (user.role === 'superadmin' || String(transfer.fromWarehouse?._id) === String(user.warehouse?._id || user.warehouse)) ? (
                        <>
                          <button 
                            disabled={isSubmitting}
                            onClick={() => handleAction(transfer._id, 'reject-request')}
                            className="flex-1 h-[36px] rounded-full border border-transparent text-[13px] font-[500] text-white bg-red-600 hover:bg-red-700 dark:bg-red-600/90 dark:hover:bg-red-500 transition-colors shadow-sm disabled:opacity-50"
                          >
                            Rad etish
                          </button>
                          <button 
                            disabled={isSubmitting}
                            onClick={() => handleAction(transfer._id, 'approve-request')}
                            style={{ backgroundColor: '#000000', color: '#ffffff', borderColor: '#000000' }}
                            className="flex-1 h-[36px] rounded-full border text-[13px] font-[500] transition-opacity hover:opacity-80 shadow-sm disabled:opacity-50"
                          >
                            Tasdiqlash
                          </button>
                        </>
                      ) : null
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TransfersPage;
