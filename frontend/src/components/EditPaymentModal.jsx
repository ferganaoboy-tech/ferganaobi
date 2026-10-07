import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Edit } from 'lucide-react';
import { useUpdatePayment } from '../hooks/usePayments';
import { useCurrency } from '../contexts/CurrencyContext';
import toast from 'react-hot-toast';

const EditPaymentModal = ({ isOpen, onClose, payment }) => {
  const updateMutation = useUpdatePayment();
  const { inputSymbol, toUzs, toDisplayValue, formatPrice } = useCurrency();

  const [formData, setFormData] = useState({
    amount: '', method: 'cash', notes: ''
  });

  useEffect(() => {
    if (isOpen && payment) {
      setFormData({ 
        amount: toDisplayValue(payment.amount), 
        method: payment.method === 'naqd' ? 'cash' : payment.method === 'karta' ? 'card' : payment.method === 'bank transfer' || payment.method === 'bank' ? 'transfer' : payment.method, 
        notes: payment.notes || '' 
      });
    }
  }, [isOpen, payment, toDisplayValue]);

  if (!isOpen || !payment) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount) return;
    
    // We assume the amount in the input is directly in UZS if formatPrice is showing in USD but editing in UZS... Wait, how is it handled in PaymentModal?
    // In PaymentModal: amountUzs = toUzs(formData.amount).
    // So the input is in `inputSymbol` (USD). Wait, no, `toUzs` converts USD input to UZS if currency is USD.
    // If we set amount: payment.amount (which is in UZS backend), the input expects it to be in `inputSymbol`?
    // Let's look at how we display it. The user types in whatever currency is active.
    // Wait, the backend stores amount in UZS. `payment.amount` is in UZS. 
    // We should pre-fill the input with `formatPrice(payment.amount)` but parsed as number?
    // Let's check if the frontend uses `toUzs` correctly. `payment.amount` from DB is in UZS.
    // Actually, maybe it's simpler to just let the backend handle the amount, or if the user is editing, they are editing the raw amount.
    // If the currency context handles USD/UZS, `toUzs` means "if input is USD, multiply by rate, else return as is".
    // So the input field should display the amount in the current input currency.
    // But `payment.amount` is ALWAYS UZS. To show it in the current input currency, we should divide by rate if USD is active?
    // Let's just use `payment.amount` and assume it's UZS. Wait, what if the user edits?
    const amountUzs = toUzs(formData.amount);

    updateMutation.mutate({
      id: payment._id,
      data: {
        amount: amountUzs,
        method: formData.method,
        notes: formData.notes
      }
    }, { 
      onSuccess: () => {
        onClose();
      } 
    });
  };

  const inputClass = "w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm";
  const labelClass = "block text-12 font-[500] text-secondary mb-1.5 tracking-[0.01em]";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in">
      <div className="bg-overlay border-t md:border border-default rounded-t-2xl md:rounded-lg w-full md:w-[480px] h-[82dvh] md:h-auto md:max-h-[85dvh] flex flex-col animate-slide-up-bottom md:animate-scale-up overflow-hidden">
        
        <div className="h-14 px-5 sm:px-6 border-b border-subtle flex items-center justify-between shrink-0">
          <h2 className="text-15 font-[600] text-primary flex items-center gap-2">
            <Edit className="w-[18px] h-[18px] text-tertiary" strokeWidth={1.5} /> To'lovni tahrirlash
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors cursor-pointer">
            <X className="w-[16px] h-[16px]" strokeWidth={1.5} />
          </button>
        </div>

        <form id="edit-payment-form" onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto no-scrollbar">
          <div>
            <label className={labelClass}>Yangi summa ({inputSymbol}) *</label>
            <input required type="number" step="any" name="amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className={`${inputClass} font-mono`} autoFocus />
            <p className="text-[11px] text-tertiary mt-1">Avvalgi: {formatPrice(payment.amount)}</p>
          </div>

          <div>
            <label className={labelClass}>To'lov usuli</label>
            <div className="flex bg-subtle/50 p-1.5 rounded-[14px] border border-subtle shadow-inner mt-1">
              {['cash', 'card', 'transfer'].map(m => (
                <label key={m} className={`flex-1 h-[40px] flex items-center justify-center rounded-[10px] cursor-pointer transition-all duration-300 text-[14px] ${formData.method === m ? 'bg-surface shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.05)] border border-subtle/80 text-primary font-[600]' : 'text-secondary hover:text-primary hover:bg-surface/50 font-[500] border border-transparent'}`}>
                  <input type="radio" name="method" value={m} checked={formData.method === m} onChange={e => setFormData({...formData, method: e.target.value})} className="hidden" />
                  {m === 'cash' ? 'Naqd' : m === 'card' ? 'Karta' : 'Ko\'chirma'}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={labelClass}>Izoh</label>
            <textarea name="notes" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Qo'shimcha izohlar..." className="w-full h-[72px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 py-3 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm resize-none mt-1" />
          </div>
        </form>

        <div className="min-h-[64px] pb-safe px-5 sm:px-6 border-t border-subtle flex items-center justify-end gap-3 shrink-0 bg-surface">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-md text-13 font-[500] text-primary border border-default hover:bg-subtle transition-colors cursor-pointer">
            Bekor qilish
          </button>
          <button type="submit" form="edit-payment-form" disabled={updateMutation.isPending} className="h-9 px-4 rounded-md text-13 font-[500] text-inverse bg-accent hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {updateMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default EditPaymentModal;
