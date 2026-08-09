import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useCreateCustomer, useUpdateCustomer } from '../hooks/useCustomers';

const CustomerModal = ({ isOpen, onClose, customer = null }) => {
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  const [formData, setFormData] = useState({
    name: '', type: 'retail', phone: '', address: '', notes: '', cashbackPercent: 0
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        type: customer.type || 'retail',
        phone: customer.phone || '',
        address: customer.address || '',
        notes: customer.notes || '',
        cashbackPercent: customer.cashbackPercent || 0
      });
    } else {
      setFormData({ name: '', type: 'retail', phone: '', address: '', notes: '', cashbackPercent: 0 });
    }
  }, [customer, isOpen]);

  if (!isOpen) return null;

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (customer) {
      updateMutation.mutate({ id: customer._id, data: formData }, { onSuccess: () => onClose() });
    } else {
      createMutation.mutate(formData, { onSuccess: () => onClose() });
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;

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
          <h2 className="text-15 font-[600] text-primary">{customer ? 'Mijozni tahrirlash' : 'Yangi mijoz'}</h2>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors cursor-pointer">
            <X className="w-[16px] h-[16px]" strokeWidth={1.5} />
          </button>
        </div>

        <form id="customer-form" onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 flex-1 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Mijozning F.I.O. yoki korxona nomi *</label>
              <input required name="name" value={formData.name} onChange={handleChange} className={inputClass} />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Mijoz turi</label>
              <div className="flex h-9 bg-surface border border-default rounded-md overflow-hidden">
                {['wholesale', 'retail'].map(t => (
                  <label key={t} className={`flex-1 flex items-center justify-center text-13 cursor-pointer transition-colors ${formData.type === t ? 'bg-subtle text-primary font-[500]' : 'text-secondary hover:bg-subtle'}`}>
                    <input type="radio" name="type" value={t} checked={formData.type === t} onChange={handleChange} className="hidden" />
                    {t === 'retail' ? 'Chakana' : 'Sotuv (Usta / Magazin)'}
                  </label>
                ))}
              </div>
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Telefon *</label>
              <input required name="phone" value={formData.phone} onChange={handleChange} placeholder="+998 90 123 45 67" className={inputClass} />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>Manzil</label>
              <input name="address" value={formData.address} onChange={handleChange} className={inputClass} />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className={labelClass}>Keshbek foizi (%)</label>
              <input type="number" min="0" max="100" name="cashbackPercent" value={formData.cashbackPercent} onChange={handleChange} className={inputClass} placeholder="Masalan: 5" />
            </div>

            <div className="col-span-2">
              <label className={labelClass}>Qo'shimcha ma'lumot</label>
              <textarea name="notes" value={formData.notes} onChange={handleChange} rows="3" className={`${inputClass} h-auto py-2 resize-y`} />
            </div>
          </div>
        </form>

        <div className="min-h-[64px] pb-safe px-5 sm:px-6 border-t border-subtle flex items-center justify-end gap-3 shrink-0 bg-surface">
          <button type="button" onClick={onClose} className="h-9 px-4 rounded-md text-13 font-[500] text-primary border border-default hover:bg-subtle transition-colors cursor-pointer">
            Bekor qilish
          </button>
          <button type="submit" form="customer-form" disabled={isLoading} className="h-9 px-4 rounded-md text-13 font-[500] text-inverse bg-accent hover:bg-accent-hover transition-colors disabled:opacity-50 cursor-pointer">
            {isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CustomerModal;
