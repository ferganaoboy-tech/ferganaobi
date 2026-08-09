import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, RefreshCcw, Package } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useCreateQuickReturn } from '../hooks/useReturns';
import { formatUZS } from '../utils/format';
import toast from 'react-hot-toast';
import { haptics } from '../utils/haptics';
import ConfirmModal from '../components/ConfirmModal';

const QuickReturnPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const { data: prodRes, isLoading } = useProducts({ search: debouncedSearch, limit: 10 });
  const searchResults = prodRes?.data || [];

  const [returnItems, setReturnItems] = useState([]);
  const [refundAmountStr, setRefundAmountStr] = useState('');
  
  const createQuickReturnMutation = useCreateQuickReturn();
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addProductToReturn = (product) => {
    haptics.light();
    setReturnItems(prev => {
      const existing = prev.find(i => i.product._id === product._id);
      if (existing) {
        return prev.map(i => i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        return [...prev, { product, quantity: 1, unit: product.unit || 'rulon' }]; // dynamic unit
      }
    });
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const updateQuantity = (productId, newQty) => {
    haptics.light();
    if (newQty < 1) return;
    setReturnItems(prev => prev.map(i => i.product._id === productId ? { ...i, quantity: newQty } : i));
  };

  const removeProduct = (productId) => {
    haptics.light();
    setReturnItems(prev => prev.filter(i => i.product._id !== productId));
  };

  const totalCalculatedRefund = returnItems.reduce((acc, item) => {
    return acc + (item.quantity * item.product.pricePerRoll);
  }, 0);

  const handleSubmit = () => {
    if (returnItems.length === 0) return toast.error("Qaytarish uchun mahsulot tanlanmagan");
    setConfirmSubmit(true);
  };

  const confirmReturn = () => {
    haptics.success();
    // Assuming all returned products go back to their own respective warehouse
    // But backend expects `warehouse`. We can just pass the first item's warehouse for the Return document.
    const primaryWarehouse = returnItems[0].product.warehouse?._id || returnItems[0].product.warehouse;

    const payload = {
      warehouse: primaryWarehouse,
      items: returnItems.map(i => ({
        product: i.product._id,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.product.pricePerRoll,
      })),
      totalRefundAmount: Number(refundAmountStr) || 0,
      reason: 'Tezkor vozvrat'
    };

    createQuickReturnMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Vozvrat muvaffaqiyatli saqlandi!");
        setReturnItems([]);
        setRefundAmountStr('');
        setConfirmSubmit(false);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || "Xatolik yuz berdi");
        setConfirmSubmit(false);
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-app">
      {/* Header */}
      <div className="h-14 px-4 border-b border-subtle bg-surface flex items-center shrink-0">
        <RefreshCcw className="w-5 h-5 text-accent mr-2" />
        <h1 className="text-16 font-[600] text-primary">Tezkor Vozvrat</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4 no-scrollbar pb-[100px]">
        {/* Search */}
        <div className="relative" ref={searchRef}>
          <div className="relative z-20">
            <Search className="w-5 h-5 text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Artikul yoki nom yozing..."
              className="w-full h-12 bg-surface hover:bg-raised border border-subtle focus:border-focus rounded-xl pl-10 pr-4 text-14 text-primary outline-none transition-all shadow-sm"
            />
          </div>

          {/* Search Dropdown */}
          {isSearchFocused && searchQuery.length > 0 && (
            <div className="absolute top-[56px] left-0 right-0 bg-surface border border-subtle rounded-xl shadow-2xl z-30 max-h-[300px] overflow-y-auto overflow-hidden animate-fade-in">
              {isLoading ? (
                <div className="p-4 text-center text-13 text-tertiary">Qidirilmoqda...</div>
              ) : searchResults.length > 0 ? (
                <div className="py-1">
                  {searchResults.map(p => (
                    <div 
                      key={p._id}
                      onClick={() => addProductToReturn(p)}
                      className="px-4 py-3 flex items-center justify-between border-b border-subtle/50 last:border-b-0 hover:bg-subtle active:bg-raised cursor-pointer transition-colors"
                    >
                      <div>
                        <div className="text-14 font-[600] text-primary">{p.brand || p.artikul}</div>
                        <div className="text-12 text-tertiary font-mono">{p.artikul} • {formatUZS(p.pricePerRoll)}/rl</div>
                      </div>
                      <button className="w-8 h-8 rounded-full bg-accent/10 text-accent flex items-center justify-center pointer-events-none">
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-13 text-tertiary">Mahsulot topilmadi</div>
              )}
            </div>
          )}
        </div>

        {/* Return List */}
        <div className="space-y-3">
          <h2 className="text-12 font-[600] text-secondary uppercase tracking-wider">Qaytarilayotgan mahsulotlar</h2>
          
          {returnItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 border border-dashed border-subtle rounded-xl bg-surface/50 text-tertiary">
              <Package className="w-12 h-12 mb-2 opacity-50" strokeWidth={1} />
              <p className="text-13">Hozircha hech narsa qo'shilmadi</p>
            </div>
          ) : (
            returnItems.map((item, idx) => (
              <div key={idx} className="bg-surface border border-subtle rounded-xl p-3 flex justify-between items-center gap-3 shadow-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-[600] text-primary truncate text-14">{item.product.brand || item.product.artikul}</div>
                  <div className="text-12 text-tertiary font-mono mt-0.5">{item.product.artikul}</div>
                </div>
                
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center bg-subtle/50 border border-subtle rounded-[8px] h-8 p-1">
                    <button
                      onClick={() => updateQuantity(item.product._id, item.quantity - 1)}
                      className="w-6 h-full rounded flex items-center justify-center text-secondary active:scale-95"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.product._id, parseInt(e.target.value) || 1)}
                      className="w-8 h-full text-center text-[13px] bg-transparent border-0 outline-none font-[600]"
                    />
                    <button
                      onClick={() => updateQuantity(item.product._id, item.quantity + 1)}
                      className="w-6 h-full rounded flex items-center justify-center text-secondary active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeProduct(item.product._id)}
                    className="w-8 h-8 rounded-full bg-state-danger-bg text-state-danger-text flex items-center justify-center active:scale-95"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Refund Details */}
        {returnItems.length > 0 && (
          <div className="bg-surface border border-subtle rounded-xl p-4 mt-4 shadow-sm space-y-4">
            <div className="flex justify-between items-center text-13">
              <span className="text-secondary font-[500]">Hisoblangan qiymat (tavsiya):</span>
              <span className="font-mono font-[600] text-primary">{formatUZS(totalCalculatedRefund)}</span>
            </div>
            
            <div className="border-t border-subtle pt-3">
              <label className="block text-11 font-[600] text-secondary mb-1.5 uppercase">Mijozga berilgan summa (so'm)</label>
              <input 
                type="number"
                placeholder="Masalan: 0 yoki 150000"
                value={refundAmountStr}
                onChange={(e) => setRefundAmountStr(e.target.value)}
                className="w-full h-11 bg-app border border-subtle rounded-lg px-4 font-mono text-14 focus:border-focus outline-none"
              />
              <p className="text-[11px] text-tertiary mt-1.5">Agar pul qaytarilmagan bo'lsa, xohlasangiz bo'sh qoldiring.</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Action */}
      {returnItems.length > 0 && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 p-3 bg-surface border-t border-subtle z-30 pb-4 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] md:pb-3 md:bottom-0">
           <button 
             onClick={handleSubmit}
             disabled={createQuickReturnMutation.isPending}
             className="w-full h-12 bg-accent text-inverse rounded-xl font-[600] text-15 hover:bg-accent-hover active:scale-[0.98] transition-all flex justify-center items-center gap-2 shadow-sm"
           >
             {createQuickReturnMutation.isPending ? 'Saqlanmoqda...' : 'Vozvrat qilish'}
           </button>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={confirmReturn}
        title="Vozvratni tasdiqlash"
        message={`Rostdan ham ${returnItems.length} xil mahsulotni ${refundAmountStr ? formatUZS(Number(refundAmountStr)) : '0 so\'m'} evaziga qaytarib olmoqchimisiz? Sklad miqdori avtomatik ko'payadi.`}
        confirmText="Tasdiqlash"
        isDanger={false}
      />
    </div>
  );
};

export default QuickReturnPage;
