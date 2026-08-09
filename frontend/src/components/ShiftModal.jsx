import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStartShift, useCloseShift } from '../hooks/useShifts';
import { formatUZS } from '../utils/format';
import { LogIn, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';

const ShiftModal = ({ isOpen, mode = 'start', currentShift, onClose }) => {
  const startMutation = useStartShift();
  const closeMutation = useCloseShift();

  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (amount === '' || isNaN(amount)) {
      return toast.error("Iltimos, summani kiriting");
    }

    if (mode === 'start') {
      startMutation.mutate({ startingCash: Number(amount) }, {
        onSuccess: () => {
          toast.success("Smena muvaffaqiyatli ochildi!");
          onClose && onClose();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || "Xatolik yuz berdi");
        }
      });
    } else {
      closeMutation.mutate({ actualCash: Number(amount), notes }, {
        onSuccess: (res) => {
          const { difference } = res.data;
          if (difference === 0) {
            toast.success("Smena yopildi. Kamomad yo'q!");
          } else if (difference < 0) {
            toast.error(`Smena yopildi. Kamomad: ${formatUZS(Math.abs(difference))}`);
          } else {
            toast.success(`Smena yopildi. Ortiqcha pul: ${formatUZS(difference)}`);
          }
          onClose && onClose();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || "Xatolik yuz berdi");
        }
      });
    }
  };

  const isLoading = startMutation.isPending || closeMutation.isPending;
  const isStart = mode === 'start';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface w-full sm:max-w-[400px] rounded-t-[28px] sm:rounded-[24px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in duration-400 ring-1 ring-white/10 max-h-[95dvh] flex flex-col relative">
        
        {/* Decorative Glow */}
        <div className={`absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${isStart ? 'bg-emerald-500' : 'bg-red-500'}`}></div>

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden shrink-0 relative z-10">
          <div className="w-10 h-1.5 bg-subtle/80 rounded-full" />
        </div>

        <div className="p-5 pb-2 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className={`w-12 h-12 rounded-[14px] flex items-center justify-center shadow-lg ${isStart ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-emerald-500/30' : 'bg-gradient-to-br from-red-500 to-red-600 text-white shadow-red-500/30'}`}>
              {isStart ? <LogIn className="w-6 h-6" strokeWidth={2} /> : <LogOut className="w-6 h-6" strokeWidth={2} />}
            </div>
            <div>
              <h2 className="text-18 font-[700] text-primary tracking-tight">{isStart ? 'Smenani ochish' : 'Smenani yopish'}</h2>
              <p className="text-12 text-secondary mt-0.5 font-[500]">{isStart ? 'Yangi ish kuningizni boshlang' : 'Kassadagi pullarni topshiring'}</p>
            </div>
          </div>
        </div>

        <form id="shift-form" onSubmit={handleSubmit} className="p-5 space-y-5 flex-1 overflow-y-auto no-scrollbar relative z-10">
          {!isStart && currentShift && (
            <div className="bg-raised/40 rounded-[16px] p-4 border border-subtle/60 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-subtle to-transparent group-hover:via-red-500/30 transition-all duration-500"></div>
              
              <div className="text-[10px] font-[700] text-tertiary uppercase tracking-widest mb-3">Smena Xulosasi</div>
              
              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-13 font-[500] text-secondary">Boshlang'ich kassa</span>
                  <span className="font-mono text-13 font-[600] text-primary">{formatUZS(currentShift.startingCash)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-13 font-[500] text-secondary">Naqd savdolar</span>
                  <span className="font-mono text-13 font-[600] text-emerald-500">+{formatUZS(currentShift.cashSales || 0)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-13 font-[500] text-secondary">Qaytarilgan (Vozvrat)</span>
                  <span className="font-mono text-13 font-[600] text-red-500">-{formatUZS(currentShift.cashReturns || 0)}</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-dashed border-subtle/80 flex justify-between items-center">
                <span className="text-13 font-[600] text-primary">Kutilayotgan kassa:</span>
                <span className="font-mono text-16 font-[700] text-primary bg-surface px-2.5 py-1 rounded-md border border-subtle shadow-sm">
                  {formatUZS((currentShift.startingCash || 0) + (currentShift.cashSales || 0) - (currentShift.cashReturns || 0))}
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-12 font-[600] text-secondary">
              {isStart ? 'Boshlang\'ich naqd pul (so\'m)' : 'Kassadagi naqd pulni kiriting (so\'m) *'}
            </label>
            <div className="relative group">
              <input 
                type="number" 
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
                className="w-full h-12 bg-surface hover:bg-raised border border-subtle focus:border-accent/50 rounded-xl px-4 text-18 font-mono font-[700] text-primary outline-none transition-all shadow-sm focus:shadow-[0_4px_20px_rgb(0,0,0,0.08)] pr-14 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-14 font-[600] text-tertiary group-focus-within:text-accent transition-colors pointer-events-none">UZS</span>
            </div>
          </div>

          {!isStart && (
            <div className="space-y-2">
              <label className="block text-12 font-[600] text-secondary">Qo'shimcha izoh (ixtiyoriy)</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Kamomad yoki boshqa sabablar haqida..."
                className="w-full bg-surface hover:bg-raised border border-subtle focus:border-accent/50 rounded-xl p-3 text-13 text-primary outline-none transition-all shadow-sm resize-none h-[80px] focus:shadow-[0_4px_20px_rgb(0,0,0,0.08)]"
              />
            </div>
          )}

          <div className="pt-2 flex gap-3 pb-safe">
            {onClose && (
              <button 
                type="button"
                onClick={onClose}
                className="flex-1 h-12 rounded-full text-13 font-[600] text-primary bg-surface border hover:bg-subtle transition-all"
              >
                Bekor qilish
              </button>
            )}
            <button 
              type="submit"
              disabled={isLoading}
              className={`flex-[2] h-12 rounded-full text-14 font-[600] text-inverse transition-all flex items-center justify-center gap-2 ${
                isStart ? 'bg-accent' : 'bg-state-danger-text text-white'
              } disabled:opacity-50`}
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (isStart ? 'Smenani ochish' : 'Smenani yopish')}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

export default ShiftModal;
