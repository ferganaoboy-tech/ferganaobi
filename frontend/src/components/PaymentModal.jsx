import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Banknote } from 'lucide-react';
import { useCreatePayment } from '../hooks/usePayments';
import { useOrders } from '../hooks/useOrders';
import { formatUZS } from '../utils/format';
import toast from 'react-hot-toast';
import CustomSelect from './CustomSelect';

const PaymentModal = ({ isOpen, onClose, customerId = null, customerName = '', totalDebt = 0 }) => {
  const createMutation = useCreatePayment();
  const { data: ordersRes } = useOrders({ customer: customerId, limit: 100 }, { enabled: !!customerId && isOpen });
  const orders = ordersRes?.data || [];

  const [formData, setFormData] = useState({
    amount: '', method: 'cash', notes: '', orderId: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({ amount: '', method: 'cash', notes: '', orderId: '' });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const debtOrders = orders.filter(o => o.debtAmount > 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.amount) return;
    
    const amount = Number(formData.amount);
    let isFullyPaid = false;

    if (formData.orderId) {
      const order = debtOrders.find(o => o._id === formData.orderId);
      if (order && amount >= order.debtAmount) {
        isFullyPaid = true;
      }
    } else {
      if (amount >= totalDebt) {
        isFullyPaid = true;
      }
    }

    createMutation.mutate({
      customer: customerId,
      amount: amount,
      method: formData.method,
      order: formData.orderId || undefined,
      notes: formData.notes
    }, { 
      onSuccess: () => {
        if (isFullyPaid) {
          toast.success("Qarz to'liq qoplandi!");
        } else {
          toast.success("Qarz qisman qoplandi");
        }
        onClose();
      } 
    });
  };

  const inputClass = "w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm";
  const labelClass = "block text-12 font-[500] text-secondary mb-1.5 tracking-[0.01em]";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in">
      <div className="bg-overlay border-t md:border border-default rounded-t-2xl md:rounded-lg w-full md:w-[480px] h-[82dvh] md:h-auto md:max-h-[85dvh] flex flex-col animate-slide-up-bottom md:animate-scale-up overflow-hidden">
        
        {/* Mobile drag handle indicator */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0">
          <div className="w-9 h-1 bg-subtle/80 rounded-full" />
        </div>

        {/* Header */}
        <div className="h-14 px-5 sm:px-6 border-b border-subtle flex items-center justify-between shrink-0">
          <h2 className="text-15 font-[600] text-primary flex items-center gap-2">
            <Banknote className="w-[18px] h-[18px] text-tertiary" strokeWidth={1.5} /> To'lov qabul qilish
          </h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors cursor-pointer">
            <X className="w-[16px] h-[16px]" strokeWidth={1.5} />
          </button>
        </div>

        <form id="payment-form" onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto no-scrollbar">
          <div className="text-13 text-secondary mb-2">
            Mijoz: <span className="font-[500] text-primary">{customerName}</span>
          </div>

          <div>
            <label className={labelClass}>To'lov summasi (so'm) *</label>
            <input required type="number" name="amount" value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} className={`${inputClass} font-mono`} autoFocus />
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
            <label className={labelClass}>Qaysi buyurtma uchun (ixtiyoriy)</label>
            <CustomSelect
              value={formData.orderId}
              onChange={(val) => setFormData({...formData, orderId: val})}
              options={[
                { value: '', label: 'Umumiy qarzdan uzish' },
                ...debtOrders.map(o => ({ value: o._id, label: `Buyurtma ${o.orderNumber} - Qarz: ${formatUZS(o.debtAmount)}` }))
              ]}
            />
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
          <button type="submit" form="payment-form" disabled={createMutation.isPending} className="h-9 px-4 rounded-md text-13 font-[500] text-inverse bg-accent hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2">
            {createMutation.isPending ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Tasdiqlanmoqda...</span>
              </>
            ) : 'Tasdiqlash'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PaymentModal;
