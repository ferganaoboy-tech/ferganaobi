import React, { useState, useRef, useEffect } from 'react';
import { Search, Plus, Minus, Trash2, RefreshCcw, Package, User, ShoppingBag, Check, ChevronDown } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useCustomers } from '../hooks/useCustomers';
import { useOrders } from '../hooks/useOrders';
import { useCreateQuickReturn } from '../hooks/useReturns';
import { useCurrency } from '../contexts/CurrencyContext';
import toast from 'react-hot-toast';
import { haptics } from '../utils/haptics';
import ConfirmModal from '../components/ConfirmModal';

const QuickReturnPage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);

  // Customer & Order state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const orderDropdownRef = useRef(null);

  const { formatPrice, inputSymbol, toUzs } = useCurrency();

  // Debounced searches
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 350);
    return () => clearTimeout(handler);
  }, [customerSearch]);

  const { data: prodRes, isLoading: isProductsLoading } = useProducts({ search: debouncedSearch, limit: 10 });
  const searchResults = prodRes?.data || [];

  const { data: custRes } = useCustomers({ search: debouncedCustomerSearch, limit: 20 });
  const customerList = custRes?.data || [];

  const { data: ordersRes } = useOrders(
    selectedCustomer ? { customer: selectedCustomer._id, limit: 15 } : { limit: 10 }
  );
  const customerOrders = ordersRes?.data || [];

  const [returnItems, setReturnItems] = useState([]);
  const [refundAmountStr, setRefundAmountStr] = useState('');
  
  const createQuickReturnMutation = useCreateQuickReturn();
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
      }
      if (orderDropdownRef.current && !orderDropdownRef.current.contains(e.target)) {
        setIsOrderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const addProductToReturn = (product, unitPrice = null, maxQty = null) => {
    haptics.light();
    setReturnItems(prev => {
      const existing = prev.find(i => i.product._id === product._id);
      const price = unitPrice !== null ? unitPrice : product.pricePerRoll;
      if (existing) {
        if (maxQty !== null && existing.quantity >= maxQty) {
          toast.error(`Ushbu buyurtmada bu mahsulotdan ko'pi bilan ${maxQty} ta qaytarish mumkin`);
          return prev;
        }
        return prev.map(i => i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i);
      } else {
        return [...prev, { product, quantity: 1, unit: product.unit || 'rulon', unitPrice: price, maxQuantity: maxQty }];
      }
    });
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  const addFromOrder = (orderItem) => {
    const max = orderItem.quantity - (orderItem.returnedQuantity || 0) - (orderItem.defectQuantity || 0);
    if (max <= 0) {
      return toast.error("Bu mahsulot buyurtmadan allaqachon to'liq qaytarilgan");
    }
    addProductToReturn(orderItem.product, orderItem.unitPrice, max);
  };

  const updateQuantity = (productId, newQty) => {
    haptics.light();
    if (newQty < 1) return;
    setReturnItems(prev => prev.map(i => {
      if (i.product._id === productId) {
        if (i.maxQuantity !== null && newQty > i.maxQuantity) {
          toast.error(`Ko'pi bilan ${i.maxQuantity} ta qaytarish mumkin`);
          return { ...i, quantity: i.maxQuantity };
        }
        return { ...i, quantity: newQty };
      }
      return i;
    }));
  };

  const removeProduct = (productId) => {
    haptics.light();
    setReturnItems(prev => prev.filter(i => i.product._id !== productId));
  };

  const totalCalculatedRefundUzs = returnItems.reduce((acc, item) => {
    return acc + (item.quantity * (item.unitPrice || item.product.pricePerRoll));
  }, 0);

  const handleSubmit = () => {
    if (returnItems.length === 0) return toast.error("Qaytarish uchun mahsulot tanlanmagan");
    setConfirmSubmit(true);
  };

  const confirmReturn = () => {
    haptics.success();
    const primaryWarehouse = selectedOrder?.warehouse?._id || selectedOrder?.warehouse || returnItems[0]?.product.warehouse?._id || returnItems[0]?.product.warehouse;

    const payload = {
      warehouse: primaryWarehouse,
      order: selectedOrder?._id || null,
      customer: selectedCustomer?._id || null,
      items: returnItems.map(i => ({
        product: i.product._id,
        unit: i.unit,
        quantity: i.quantity,
        unitPrice: i.unitPrice || i.product.pricePerRoll,
      })),
      totalRefundAmount: refundAmountStr ? toUzs(refundAmountStr) : 0,
      reason: selectedOrder 
        ? `Tezkor vozvrat (${selectedOrder.orderNumber})` 
        : (selectedCustomer ? `Tezkor vozvrat: ${selectedCustomer.name}` : 'Tezkor vozvrat')
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
        <h1 className="text-16 font-[700] text-primary">Tezkor Vozvrat</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-2 sm:p-4 space-y-4 no-scrollbar pb-[120px]">
        
        {/* Customer & Order Selector */}
        <div className="bg-surface border border-subtle rounded-2xl p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-12 font-[700] text-primary flex items-center gap-1.5 uppercase tracking-wider">
              <User className="w-3.5 h-3.5 text-accent" />
              Mijoz va Buyurtma (Ixtiyoriy)
            </span>
            {(selectedCustomer || selectedOrder) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedCustomer(null);
                  setSelectedOrder(null);
                  setCustomerSearch('');
                }}
                className="text-11 text-tertiary hover:text-state-danger-text underline transition-colors"
              >
                Tozalash
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Customer dropdown */}
            <div className="relative" ref={customerDropdownRef}>
              <label className="block text-11 font-[600] text-secondary mb-1">Mijoz</label>
              <button
                type="button"
                onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                className="w-full h-11 px-3 bg-app border border-subtle hover:border-default rounded-xl flex items-center justify-between text-13 text-primary transition-all text-left"
              >
                <span className="truncate font-[500]">
                  {selectedCustomer ? `${selectedCustomer.name}` : "Mijozni tanlang..."}
                </span>
                <ChevronDown className="w-4 h-4 text-tertiary shrink-0" />
              </button>

              {isCustomerDropdownOpen && (
                <div className="absolute top-[72px] left-0 right-0 z-40 bg-surface border border-subtle rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-[260px] flex flex-col">
                  <div className="p-2 border-b border-subtle bg-app">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-tertiary absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        placeholder="Mijoz qidirish..."
                        className="w-full h-8 pl-8 pr-2 text-12 bg-surface border border-subtle rounded-lg outline-none focus:border-focus"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto p-1 max-h-[200px]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setSelectedOrder(null);
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-12 text-secondary hover:bg-subtle rounded-lg flex items-center justify-between"
                    >
                      <span>— Noma'lum / Naqd xaridor —</span>
                      {!selectedCustomer && <Check className="w-3.5 h-3.5 text-accent" />}
                    </button>
                    {customerList.map((c) => (
                      <button
                        key={c._id}
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(c);
                          setSelectedOrder(null);
                          setIsCustomerDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-12 rounded-lg flex items-center justify-between transition-colors ${
                          selectedCustomer?._id === c._id ? 'bg-accent/10 text-accent font-[600]' : 'text-primary hover:bg-subtle'
                        }`}
                      >
                        <div className="truncate">
                          <div className="font-[600]">{c.name}</div>
                          <div className="text-11 text-tertiary font-mono">{c.phone}</div>
                        </div>
                        {selectedCustomer?._id === c._id && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Order dropdown */}
            <div className="relative" ref={orderDropdownRef}>
              <label className="block text-11 font-[600] text-secondary mb-1">Buyurtma (Chek)</label>
              <button
                type="button"
                onClick={() => setIsOrderDropdownOpen(!isOrderDropdownOpen)}
                disabled={!selectedCustomer && customerOrders.length === 0}
                className="w-full h-11 px-3 bg-app border border-subtle hover:border-default rounded-xl flex items-center justify-between text-13 text-primary transition-all text-left disabled:opacity-50 cursor-pointer"
              >
                <span className="truncate font-[500]">
                  {selectedOrder ? selectedOrder.orderNumber : "Buyurtmani tanlang..."}
                </span>
                <ChevronDown className="w-4 h-4 text-tertiary shrink-0" />
              </button>

              {isOrderDropdownOpen && (
                <div className="absolute top-[72px] left-0 right-0 z-40 bg-surface border border-subtle rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-[240px] overflow-y-auto p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedOrder(null);
                      setIsOrderDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-12 text-secondary hover:bg-subtle rounded-lg flex items-center justify-between"
                  >
                    <span>— Buyurtmasiz (Erkin vozvrat) —</span>
                    {!selectedOrder && <Check className="w-3.5 h-3.5 text-accent" />}
                  </button>
                  {customerOrders.length === 0 ? (
                    <div className="p-3 text-center text-12 text-tertiary">Buyurtmalar topilmadi</div>
                  ) : (
                    customerOrders.map((ord) => (
                      <button
                        key={ord._id}
                        type="button"
                        onClick={() => {
                          setSelectedOrder(ord);
                          setIsOrderDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-12 rounded-lg flex items-center justify-between transition-colors ${
                          selectedOrder?._id === ord._id ? 'bg-accent/10 text-accent font-[600]' : 'text-primary hover:bg-subtle'
                        }`}
                      >
                        <div>
                          <div className="font-mono font-[700]">{ord.orderNumber}</div>
                          <div className="text-11 text-tertiary">{formatPrice(ord.totalAmount)}</div>
                        </div>
                        {selectedOrder?._id === ord._id && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Selected order products preview */}
          {selectedOrder && (
            <div className="mt-3 pt-3 border-t border-subtle">
              <p className="text-12 font-[600] text-secondary mb-2 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-accent" />
                {selectedOrder.orderNumber} dagi mahsulotlar (Bosish orqali qo'shing):
              </p>
              <div className="space-y-2 max-h-[160px] overflow-y-auto no-scrollbar">
                {selectedOrder.items?.map((item, idx) => {
                  const available = item.quantity - (item.returnedQuantity || 0) - (item.defectQuantity || 0);
                  return (
                    <div
                      key={idx}
                      onClick={() => addFromOrder(item)}
                      className="px-3 py-2 bg-app hover:bg-subtle border border-subtle rounded-xl flex items-center justify-between cursor-pointer transition-colors text-13"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-[600] text-primary truncate block">{item.product?.name || item.product?.brand || item.product?.artikul}</span>
                        <span className="text-11 text-tertiary">Olingan: {item.quantity} {item.unit} | Qolgan: <strong className="text-accent">{available}</strong> ta</span>
                      </div>
                      <button
                        type="button"
                        disabled={available <= 0}
                        className="px-2.5 py-1 bg-accent text-inverse rounded-lg text-11 font-[600] shrink-0 disabled:opacity-40"
                      >
                        + Qo'shish
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* General Product Search */}
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
              {isProductsLoading ? (
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
                        <div className="text-12 text-tertiary font-mono">{p.artikul} • {formatPrice(p.pricePerRoll)}/rl</div>
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
                  <div className="text-12 text-tertiary font-mono mt-0.5">{item.product.artikul} • {formatPrice(item.unitPrice || item.product.pricePerRoll)}</div>
                  {item.maxQuantity !== null && (
                    <div className="text-11 text-accent font-[500]">Chek bo'yicha limit: {item.maxQuantity} {item.unit}</div>
                  )}
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
              <span className="text-secondary font-[500]">Hisoblangan qiymat:</span>
              <span className="font-mono font-[600] text-primary">{formatPrice(totalCalculatedRefundUzs)}</span>
            </div>
            
            <div className="border-t border-subtle pt-3">
              <label className="block text-11 font-[600] text-secondary mb-1.5 uppercase">Mijozga berilgan summa ({inputSymbol})</label>
              <input 
                type="number"
                step="any"
                placeholder="0"
                value={refundAmountStr}
                onChange={(e) => setRefundAmountStr(e.target.value)}
                className="w-full h-11 bg-app border border-subtle rounded-lg px-4 font-mono text-14 focus:border-focus outline-none"
              />
              <p className="text-[11px] text-tertiary mt-1.5">Pul qaytarilmasa bo'sh qoldiring (qarzdan kamayadi).</p>
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
        message={`${selectedCustomer ? selectedCustomer.name + ' mijozidan ' : ''}${selectedOrder ? selectedOrder.orderNumber + ' buyurtmasi bo\'yicha ' : ''}${returnItems.length} xil mahsulot qaytariladi. Sklad miqdori avtomatik ko'payadi.`}
        confirmText="Tasdiqlash"
        isDanger={false}
      />
    </div>
  );
};

export default QuickReturnPage;
