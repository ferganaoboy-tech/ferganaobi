import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CornerDownLeft, Minus, Plus } from 'lucide-react';
import { useCreateReturn } from '../hooks/useReturns';
import toast from 'react-hot-toast';

const ReturnModal = ({ isOpen, onClose, order }) => {
  const [returnItems, setReturnItems] = useState({});
  const [reason, setReason] = useState('');
  const createReturnMutation = useCreateReturn();

  useEffect(() => {
    if (isOpen && order) {
      const initialItems = {};
      order.items.forEach(item => {
        const max = item.quantity - (item.returnedQuantity || 0);
        if (max > 0) {
          initialItems[item.product._id] = {
            product: item.product._id,
            productName: item.product.brand || item.product.artikul,
            produktImage: item.product.images?.[0]?.url || null,
            unit: item.unit,
            maxQuantity: max,
            returnQuantity: 0,
          };
        }
      });
      setReturnItems(initialItems);
      setReason('');
    }
  }, [isOpen, order]);

  if (!isOpen || !order) return null;

  const handleQuantityChange = (productId, val) => {
    const max = returnItems[productId].maxQuantity;
    let newQty = parseInt(val) || 0;
    if (newQty > max) newQty = max;
    if (newQty < 0) newQty = 0;
    setReturnItems(prev => ({ ...prev, [productId]: { ...prev[productId], returnQuantity: newQty } }));
  };

  const increment = (productId) => {
    const item = returnItems[productId];
    if (item.returnQuantity < item.maxQuantity) {
      handleQuantityChange(productId, item.returnQuantity + 1);
    }
  };

  const decrement = (productId) => {
    const item = returnItems[productId];
    if (item.returnQuantity > 0) {
      handleQuantityChange(productId, item.returnQuantity - 1);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const itemsToReturn = Object.values(returnItems)
      .filter(item => item.returnQuantity > 0)
      .map(item => ({ product: item.product, unit: item.unit, quantity: item.returnQuantity }));

    if (itemsToReturn.length === 0) {
      return toast.error("Qaytarish uchun kamida bitta mahsulot miqdorini kiriting!");
    }

    createReturnMutation.mutate({ orderId: order._id, items: itemsToReturn, reason }, {
      onSuccess: () => { toast.success("Vozvrat muvaffaqiyatli amalga oshirildi!"); onClose(); },
      onError: (err) => { toast.error(err.response?.data?.message || "Xatolik yuz berdi"); }
    });
  };

  const hasItemsToReturn = Object.values(returnItems).some(i => i.returnQuantity > 0);
  const totalReturnCount = Object.values(returnItems).reduce((acc, i) => acc + i.returnQuantity, 0);
  const items = Object.values(returnItems);

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Bottom sheet on mobile, centered modal on desktop */}
      <div className="bg-surface w-full sm:max-w-[560px] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[85dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-subtle shrink-0">
          {/* Drag handle for mobile */}
          <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-default sm:hidden" />
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-state-warning-bg border border-state-warning-border flex items-center justify-center shrink-0">
              <CornerDownLeft className="w-4 h-4 text-state-warning-text" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-[15px] font-[700] text-primary leading-tight">Vozvrat (Qaytarish)</h2>
              <p className="text-11 text-tertiary mt-0.5">
                Buyurtma: <span className="font-mono text-secondary font-[500]">{order.orderNumber}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-subtle text-secondary hover:bg-raised hover:text-primary transition-all shrink-0"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-app space-y-3">

          {items.length === 0 ? (
            <div className="text-center py-10 text-secondary text-14">Qaytarish uchun mahsulot yo'q</div>
          ) : (
            items.map(item => (
              <div key={item.product} className="bg-surface rounded-2xl border border-subtle p-4 flex flex-col gap-3 shadow-sm">
                {/* Product info row */}
                <div className="flex items-center gap-3">
                  {item.produktImage ? (
                    <img src={item.produktImage} className="w-11 h-11 rounded-xl object-cover shrink-0 border border-subtle" alt={item.productName} />
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-raised shrink-0 flex items-center justify-center text-tertiary text-[10px] font-[600] border border-subtle">IMG</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-[600] text-14 text-primary truncate">{item.productName}</div>
                    <div className="text-12 text-secondary mt-0.5">Mavjud: <span className="font-mono font-[500] text-primary">{item.maxQuantity} {item.unit}</span></div>
                  </div>
                </div>

                {/* Stepper */}
                <div className="flex items-center gap-3">
                  <span className="text-12 text-secondary shrink-0">Qaytarish miqdori:</span>
                  <div className="flex items-center gap-0 ml-auto border border-[var(--border-default)] rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => decrement(item.product)}
                      disabled={item.returnQuantity <= 0}
                      className="w-10 h-10 flex items-center justify-center bg-[var(--bg-subtle)] text-primary hover:bg-[var(--bg-raised)] active:scale-90 transition-all disabled:opacity-30"
                    >
                      <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                    <input
                      type="number"
                      min="0"
                      max={item.maxQuantity}
                      value={item.returnQuantity === 0 ? '' : item.returnQuantity}
                      onChange={(e) => handleQuantityChange(item.product, e.target.value)}
                      className="w-14 h-10 text-center text-14 font-[700] font-mono bg-surface text-primary outline-none border-x border-[var(--border-default)]"
                      placeholder="0"
                    />
                    <button
                      type="button"
                      onClick={() => increment(item.product)}
                      disabled={item.returnQuantity >= item.maxQuantity}
                      className="w-10 h-10 flex items-center justify-center bg-[var(--bg-subtle)] text-primary hover:bg-[var(--bg-raised)] active:scale-90 transition-all disabled:opacity-30"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                    </button>
                  </div>
                  <span className="text-12 text-secondary shrink-0">{item.unit}</span>
                </div>

                {/* Progress bar */}
                {item.returnQuantity > 0 && (
                  <div className="h-1.5 w-full bg-subtle rounded-full overflow-hidden">
                    <div
                      className="h-full bg-state-warning-text rounded-full transition-all"
                      style={{ width: `${(item.returnQuantity / item.maxQuantity) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))
          )}

          {/* Reason input */}
          <div className="bg-surface rounded-2xl border border-subtle p-4 shadow-sm">
            <label className="block text-12 font-[600] text-secondary mb-2">Vozvrat sababi <span className="text-tertiary font-normal">(ixtiyoriy)</span></label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Masalan: Ortiqcha olingan, rangi mos kelmadi..."
              rows={2}
              className="w-full bg-app hover:bg-raised border border-subtle focus:border-focus rounded-xl px-4 py-3 text-14 text-primary outline-none transition-all resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pt-3 pb-6 bg-surface border-t border-subtle shrink-0 rounded-b-3xl sm:rounded-b-2xl">
          {hasItemsToReturn && (
            <div className="flex items-center justify-center mb-3 py-2 bg-state-warning-bg rounded-xl border border-state-warning-border">
              <span className="text-13 font-[600] text-state-warning-text">
                Jami {totalReturnCount} ta mahsulot qaytariladi
              </span>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 h-12 border border-[var(--border-default)] rounded-xl text-14 font-[500] text-secondary hover:bg-subtle active:scale-95 transition-all"
            >
              Bekor qilish
            </button>
            <button
              onClick={handleSubmit}
              disabled={!hasItemsToReturn || createReturnMutation.isLoading}
              className="flex-1 h-12 bg-state-warning-bg border border-state-warning-border text-state-warning-text rounded-xl text-14 font-[700] disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <CornerDownLeft className="w-4 h-4" strokeWidth={2} />
              {createReturnMutation.isLoading ? 'Bajarilmoqda...' : 'Tasdiqlash'}
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default ReturnModal;
