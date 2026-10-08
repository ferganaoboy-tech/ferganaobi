import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, Minus, Trash2, RefreshCcw, Package } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useCreateQuickReturn } from '../hooks/useReturns';
import { useCurrency } from '../contexts/CurrencyContext';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

const QuickReturnModal = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const { formatPrice, inputSymbol, toUzs } = useCurrency();

  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(h);
  }, [searchQuery]);

  const { data: prodRes, isLoading } = useProducts(
    { search: debouncedSearch, limit: 10 },
    { enabled: isOpen && debouncedSearch.length > 0 }
  );
  const searchResults = prodRes?.data || [];

  const [returnItems, setReturnItems] = useState([]);
  const [refundAmountStr, setRefundAmountStr] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const createMutation = useCreateQuickReturn();

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setReturnItems([]);
      setRefundAmountStr('');
      setSearchQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!isOpen) return null;

  const addProduct = (product) => {
    setReturnItems(prev => {
      const existing = prev.find(i => i.product._id === product._id);
      if (existing) {
        return prev.map(i => i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, unit: product.unit || 'rulon' }];
    });
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const updateQty = (id, qty) => {
    if (qty < 1) return;
    setReturnItems(prev => prev.map(i => i.product._id === id ? { ...i, quantity: qty } : i));
  };

  const removeItem = (id) => setReturnItems(prev => prev.filter(i => i.product._id !== id));

  const totalCalc = returnItems.reduce((acc, i) => acc + i.quantity * i.product.pricePerRoll, 0);

  const confirmReturn = () => {
    const primaryWarehouse = returnItems[0]?.product.warehouse?._id || returnItems[0]?.product.warehouse;
    createMutation.mutate({
      warehouse: primaryWarehouse,
      items: returnItems.map(i => ({
        product: i.product._id,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.product.pricePerRoll,
      })),
      totalRefundAmount: refundAmountStr ? toUzs(refundAmountStr) : 0,
      reason: 'Tezkor vozvrat'
    }, {
      onSuccess: () => {
        toast.success('Vozvrat muvaffaqiyatli saqlandi!');
        setReturnItems([]);
        setRefundAmountStr('');
        setConfirmSubmit(false);
        onClose();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Xatolik yuz berdi');
        setConfirmSubmit(false);
      }
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-overlay w-full sm:max-w-[580px] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88dvh] border border-subtle">

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-subtle/80 rounded-full" />
        </div>

        {/* Header */}
        <div className="h-14 px-5 border-b border-subtle flex items-center justify-between shrink-0">
          <h2 className="text-15 font-[600] text-primary flex items-center gap-2">
            <RefreshCcw className="w-[18px] h-[18px] text-accent" strokeWidth={2} />
            Tezkor Vozvrat
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded-lg transition-colors cursor-pointer">
            <X className="w-[16px] h-[16px]" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">

          {/* Search */}
          <div className="relative" ref={searchRef}>
            <Search className="w-4 h-4 text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Artikul yoki nom yozing..."
              className="w-full h-11 bg-surface border border-subtle hover:border-default focus:border-focus rounded-xl pl-10 pr-4 text-14 text-primary outline-none transition-all"
            />
            {isSearchFocused && searchQuery.length > 0 && (
              <div className="absolute top-[48px] left-0 right-0 bg-surface border border-subtle rounded-xl shadow-2xl z-30 max-h-[280px] overflow-y-auto animate-fade-in">
                {isLoading ? (
                  <div className="p-4 text-center text-13 text-tertiary">Qidirilmoqda...</div>
                ) : searchResults.length > 0 ? (
                  <div className="py-1">
                    {searchResults.map(p => (
                      <div
                        key={p._id}
                        onClick={() => addProduct(p)}
                        className="px-4 py-3 flex items-center justify-between hover:bg-subtle cursor-pointer border-b border-subtle/50 last:border-b-0 transition-colors"
                      >
                        <div>
                          <div className="text-14 font-[600] text-primary">{p.brand || p.artikul}</div>
                          <div className="text-12 text-tertiary font-mono">{p.artikul} • {formatPrice(p.pricePerRoll)}/rl</div>
                        </div>
                        <div className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center">
                          <Plus className="w-4 h-4" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-13 text-tertiary">Mahsulot topilmadi</div>
                )}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="space-y-2">
            <p className="text-11 font-[600] text-secondary uppercase tracking-wider">Qaytarilayotgan mahsulotlar</p>
            {returnItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 border border-dashed border-subtle rounded-xl text-tertiary">
                <Package className="w-10 h-10 mb-2 opacity-40" strokeWidth={1} />
                <p className="text-13">Hozircha hech narsa qo'shilmadi</p>
              </div>
            ) : (
              returnItems.map((item, idx) => (
                <div key={idx} className="bg-surface border border-subtle rounded-xl p-3 flex justify-between items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-[600] text-14 text-primary truncate">{item.product.brand || item.product.artikul}</div>
                    <div className="text-12 text-tertiary font-mono">{item.product.artikul}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-subtle/50 border border-subtle rounded-[8px] h-8 p-1">
                      <button onClick={() => updateQty(item.product._id, item.quantity - 1)} className="w-6 h-full rounded flex items-center justify-center text-secondary hover:text-primary">
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={e => updateQty(item.product._id, parseInt(e.target.value) || 1)}
                        className="w-9 h-full text-center text-[13px] bg-transparent outline-none font-[600]"
                      />
                      <button onClick={() => updateQty(item.product._id, item.quantity + 1)} className="w-6 h-full rounded flex items-center justify-center text-secondary hover:text-primary">
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button onClick={() => removeItem(item.product._id)} className="w-8 h-8 rounded-full bg-state-danger-bg text-state-danger-text flex items-center justify-center">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Refund */}
          {returnItems.length > 0 && (
            <div className="bg-surface border border-subtle rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center text-13">
                <span className="text-secondary">Hisoblangan qiymat:</span>
                <span className="font-mono font-[600] text-primary">{formatPrice(totalCalc)}</span>
              </div>
              <div className="border-t border-subtle pt-3">
                <label className="block text-11 font-[600] text-secondary mb-1.5 uppercase">Mijozga berilgan summa ({inputSymbol})</label>
                <input
                  type="number"
                  step="any"
                  placeholder="0"
                  value={refundAmountStr}
                  onChange={e => setRefundAmountStr(e.target.value)}
                  className="w-full h-10 bg-app border border-subtle rounded-lg px-4 font-mono text-14 focus:border-focus outline-none"
                />
                <p className="text-11 text-tertiary mt-1">Pul qaytarilmasa bo'sh qoldiring</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-5 bg-surface border-t border-subtle shrink-0 rounded-b-3xl sm:rounded-b-2xl flex gap-3">
          <button onClick={onClose} className="flex-1 h-11 border border-default rounded-xl text-14 font-[500] text-secondary hover:bg-subtle transition-all cursor-pointer">
            Bekor qilish
          </button>
          <button
            onClick={() => {
              if (returnItems.length === 0) return toast.error('Mahsulot tanlanmagan');
              setConfirmSubmit(true);
            }}
            disabled={returnItems.length === 0 || createMutation.isPending}
            className="flex-1 h-11 bg-accent text-inverse rounded-xl text-14 font-[600] disabled:opacity-40 transition-all flex items-center justify-center gap-2 cursor-pointer hover:bg-accent-hover"
          >
            <RefreshCcw className="w-4 h-4" />
            Vozvrat qilish
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={confirmSubmit}
        onClose={() => setConfirmSubmit(false)}
        onConfirm={confirmReturn}
        title="Vozvratni tasdiqlash"
        message={`${returnItems.length} xil mahsulot qaytariladi. Sklad miqdori avtomatik ko'payadi.`}
        confirmText="Tasdiqlash"
        isDanger={false}
      />
    </div>,
    document.body
  );
};

export default QuickReturnModal;
