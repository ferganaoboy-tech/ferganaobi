import React, { useState } from 'react';
import { X, Send, Trash2, Package, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useTransfer } from '../contexts/TransferContext';
import { useAuth } from '../contexts/AuthContext';
import { useWarehouses } from '../hooks/useWarehouses';
import CustomSelect from './CustomSelect';
import { formatUZS } from '../utils/format';
import { haptics } from '../utils/haptics';
import api from '../api';
import toast from 'react-hot-toast';

const TransferCartDrawer = () => {
  const { isTransferOpen, setIsTransferOpen, transferItems, removeFromTransfer, updateTransferQuantity, clearTransfer } = useTransfer();
  const { user } = useAuth();
  const { data: warehousesRes } = useWarehouses({ basic: true });
  const warehouses = warehousesRes?.data || [];
  
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isTransferOpen) {
    if (transferItems.length > 0) {
      return (
        <button
          onClick={() => setIsTransferOpen(true)}
          className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-[60] bg-accent text-inverse shadow-xl shadow-accent/30 rounded-2xl flex items-center justify-center gap-3 px-5 py-3.5 hover:bg-accent-hover hover:-translate-y-1 hover:shadow-accent/40 transition-all duration-300 animate-in zoom-in-50"
        >
          <div className="relative">
            <Package className="w-5 h-5 sm:w-6 sm:h-6" strokeWidth={2} />
            <span className="absolute -top-2.5 -right-2.5 bg-red-500 text-white text-[11px] font-[700] min-w-[20px] h-[20px] flex items-center justify-center rounded-full border-2 border-surface px-1 shadow-sm">
              {transferItems.length}
            </span>
          </div>
          <span className="font-[600] text-15 pr-1 tracking-wide">O'tkazish</span>
        </button>
      );
    }
    return null;
  }

  const isRequestTransfer = transferItems.length > 0 && user?.role !== 'superadmin' && 
    (transferItems[0].product.warehouse?._id || transferItems[0].product.warehouse) !== (user?.warehouse?._id || user?.warehouse);

  const handleSend = async () => {
    if (!isRequestTransfer && !selectedWarehouse) {
      toast.error('Qabul qiluvchi filialni tanlang');
      return;
    }
    if (transferItems.length === 0) {
      toast.error("Savatcha bo'sh");
      return;
    }

    try {
      setIsLoading(true);
      
      let payload;
      let endpoint = '/transfers';
      
      if (isRequestTransfer) {
        payload = {
          fromWarehouse: transferItems[0].product.warehouse?._id || transferItems[0].product.warehouse,
          toWarehouse: user.warehouse?._id || user.warehouse, // O'ziga so'rayapti
          notes,
          items: transferItems.map(i => ({
            product: i.product._id,
            quantity: i.quantity,
            unit: i.unit
          }))
        };
        endpoint = '/transfers/request';
      } else {
        payload = {
          fromWarehouse: transferItems[0].product.warehouse?._id || transferItems[0].product.warehouse,
          toWarehouse: selectedWarehouse,
          notes,
          items: transferItems.map(i => ({
            product: i.product._id,
            quantity: i.quantity,
            unit: i.unit
          }))
        };
      }

      await api.post(endpoint, payload);
      toast.success(isRequestTransfer ? "So'rov muvaffaqiyatli yuborildi!" : "O'tkazma muvaffaqiyatli yuborildi!");
      clearTransfer();
      setIsTransferOpen(false);
      setNotes('');
      setSelectedWarehouse('');
      haptics.success();
    } catch (error) {
      toast.error(error.response?.data?.message || "Xatolik yuz berdi");
      haptics.warning();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] animate-in fade-in duration-300"
        onClick={() => setIsTransferOpen(false)}
      />
      <div className={`fixed inset-y-0 right-0 w-full sm:w-[440px] bg-surface shadow-2xl z-[80] flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${isTransferOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-subtle bg-app/50 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3 text-primary">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-17 font-[700] tracking-tight">O'tkazish savatchasi</h2>
              <div className="text-13 text-secondary font-[500] mt-0.5">{transferItems.length} ta mahsulot</div>
            </div>
          </div>
          <button 
            onClick={() => setIsTransferOpen(false)} 
            className="w-9 h-9 flex items-center justify-center text-tertiary hover:text-primary hover:bg-subtle rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 no-scrollbar bg-app/20">
          {transferItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
              <Package className="w-16 h-16 mb-4 text-tertiary" strokeWidth={1.5} />
              <p className="text-15 text-primary font-[600]">Savatcha bo'sh</p>
              <p className="text-13 text-secondary mt-1">Ko'chirish uchun mahsulot qo'shing</p>
            </div>
          ) : (
            transferItems.map((item) => (
              <div key={item.product._id} className="bg-surface border border-subtle rounded-2xl p-3 flex gap-3 relative shadow-sm group hover:border-default transition-all duration-300">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-app shrink-0 border border-subtle">
                  {item.product.images?.[0]?.url ? (
                    <img src={item.product.images[0].url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-tertiary">
                       <Package className="w-6 h-6 opacity-30" />
                    </div>
                  )}
                </div>
                
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                  <div className="pr-8">
                    <div className="text-14 font-[600] text-primary truncate leading-tight">
                      {item.product.brand || 'Boshqa'} <span className="text-tertiary font-normal mx-1">•</span> {item.product.artikul}
                    </div>
                    <div className="text-[11px] text-secondary mt-1 font-[500]">
                      Omborda: <span className="text-primary font-[600]">{item.product.quantity}</span> {item.product.unit || 'rulon'}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex items-center border border-subtle rounded-lg bg-app h-8 overflow-hidden shadow-sm">
                      <button 
                        onClick={() => updateTransferQuantity(item.product._id, item.unit, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-9 h-full flex items-center justify-center text-secondary hover:bg-subtle hover:text-primary disabled:opacity-30 transition-colors"
                      >
                        -
                      </button>
                      <input 
                        type="number"
                        value={item.quantity || ''}
                        onChange={(e) => updateTransferQuantity(item.product._id, item.unit, parseFloat(e.target.value) || 0)}
                        className="w-12 text-center text-13 font-[600] text-primary bg-transparent outline-none"
                      />
                      <button 
                        onClick={() => updateTransferQuantity(item.product._id, item.unit, item.quantity + 1)}
                        className="w-9 h-full flex items-center justify-center text-secondary hover:bg-subtle hover:text-primary transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-[11px] font-[600] text-accent bg-accent/10 px-2.5 py-1 rounded-md uppercase tracking-wider">
                      {item.unit || 'rulon'}
                    </span>
                  </div>
                </div>

                <button 
                  onClick={() => removeFromTransfer(item.product._id, item.unit)}
                  className="absolute top-3 right-3 text-tertiary hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer Actions */}
        {transferItems.length > 0 && (
          <div className="p-4 sm:p-6 border-t border-subtle bg-surface shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-10 space-y-4">
            
            {!isRequestTransfer && (
              <div className="space-y-1.5">
                <label className="text-13 font-[600] text-primary flex items-center gap-2">
                  Kimga o'tkazilmoqda? <ArrowRight className="w-3.5 h-3.5 text-secondary" />
                </label>
                <CustomSelect
                  value={selectedWarehouse || ''}
                  onChange={(val) => setSelectedWarehouse(val)}
                  placeholder="Filialni tanlang..."
                  options={warehouses
                    .filter(w => w._id !== (user?.warehouse?._id || user?.warehouse))
                    .map(w => ({ value: w._id, label: w.name }))}
                />
              </div>
            )}
            
            {isRequestTransfer && (
              <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 flex gap-3">
                <div className="mt-0.5"><CheckCircle2 className="w-5 h-5 text-blue-500" /></div>
                <div>
                  <div className="text-13 font-[600] text-blue-700 tracking-tight">So'rov shakllantirilmoqda</div>
                  <div className="text-12 text-blue-600/80 mt-0.5 leading-snug">Ushbu mahsulotlarni boshqa filialdan o'zingizning filialingizga chaqiryapsiz.</div>
                </div>
              </div>
            )}
            
            <div className="space-y-1.5">
              <label className="text-13 font-[600] text-primary">Izoh (ixtiyoriy)</label>
              <input 
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Masalan: Mashina raqami, haydovchi ismi..."
                className="w-full bg-app border border-subtle rounded-xl px-4 py-3 text-14 text-primary font-[500] placeholder:text-secondary/60 focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all"
              />
            </div>

            <button 
              onClick={handleSend}
              disabled={isLoading || (!isRequestTransfer && !selectedWarehouse)}
              className="w-full bg-accent hover:bg-accent-hover text-inverse py-3.5 rounded-xl font-[600] text-15 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/25 active:scale-[0.98]"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-inverse/30 border-t-inverse rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {isLoading ? "Yuborilmoqda..." : (isRequestTransfer ? "So'rov Yuborish" : "O'tkazmani Yuborish")}
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default TransferCartDrawer;
