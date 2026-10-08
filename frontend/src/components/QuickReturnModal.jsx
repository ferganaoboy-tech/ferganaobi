import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Search, Plus, Minus, Trash2, RefreshCcw, Package, User, ShoppingBag, Check, ChevronDown } from 'lucide-react';
import { useProducts } from '../hooks/useProducts';
import { useCustomers } from '../hooks/useCustomers';
import { useOrders } from '../hooks/useOrders';
import { useCreateQuickReturn } from '../hooks/useReturns';
import { useCurrency } from '../contexts/CurrencyContext';
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';

const QuickReturnModal = ({ isOpen, onClose }) => {
  // Search state for products
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);

  // Customer & Order selection state
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = useRef(null);

  const [selectedOrder, setSelectedOrder] = useState(null);
  const [isOrderDropdownOpen, setIsOrderDropdownOpen] = useState(false);
  const orderDropdownRef = useRef(null);

  const { formatPrice, inputSymbol, toUzs } = useCurrency();

  // Debounced search for products
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(h);
  }, [searchQuery]);

  // Debounced search for customers
  const [debouncedCustomerSearch, setDebouncedCustomerSearch] = useState('');
  useEffect(() => {
    const h = setTimeout(() => setDebouncedCustomerSearch(customerSearch), 350);
    return () => clearTimeout(h);
  }, [customerSearch]);

  // Query products
  const { data: prodRes, isLoading: isProductsLoading } = useProducts(
    { search: debouncedSearch, limit: 10 },
    { enabled: isOpen && debouncedSearch.length > 0 }
  );
  const searchResults = prodRes?.data || [];

  // Query customers
  const { data: custRes, isLoading: isCustomersLoading } = useCustomers(
    { search: debouncedCustomerSearch, limit: 20 },
    { enabled: isOpen }
  );
  const customerList = custRes?.data || [];

  // Query orders for selected customer
  const { data: ordersRes, isLoading: isOrdersLoading } = useOrders(
    selectedCustomer ? { customer: selectedCustomer._id, limit: 15 } : { limit: 10 }
  );
  const customerOrders = ordersRes?.data || [];

  const [returnItems, setReturnItems] = useState([]);
  const [refundAmountStr, setRefundAmountStr] = useState('');
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const createMutation = useCreateQuickReturn();

  // Reset state on close
  useEffect(() => {
    if (!isOpen) {
      setReturnItems([]);
      setRefundAmountStr('');
      setSearchQuery('');
      setSelectedCustomer(null);
      setCustomerSearch('');
      setSelectedOrder(null);
      setIsCustomerDropdownOpen(false);
      setIsOrderDropdownOpen(false);
    }
  }, [isOpen]);

  // Handle outside clicks
  useEffect(() => {
    const handleOutside = (e) => {
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
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  if (!isOpen) return null;

  // Add product from general search
  const addProduct = (product, unitPrice = null, maxQty = null) => {
    setReturnItems(prev => {
      const existing = prev.find(i => i.product._id === product._id);
      const price = unitPrice !== null ? unitPrice : product.pricePerRoll;
      if (existing) {
        if (maxQty !== null && existing.quantity >= maxQty) {
          toast.error(`Ushbu buyurtmada bu mahsulotdan ko'pi bilan ${maxQty} ta qaytarish mumkin`);
          return prev;
        }
        return prev.map(i => i.product._id === product._id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { product, quantity: 1, unit: product.unit || 'rulon', unitPrice: price, maxQuantity: maxQty }];
    });
    setSearchQuery('');
    setIsSearchFocused(false);
  };

  // Add product directly from selected order
  const addFromOrder = (orderItem) => {
    const max = orderItem.quantity - (orderItem.returnedQuantity || 0) - (orderItem.defectQuantity || 0);
    if (max <= 0) {
      return toast.error("Bu mahsulot buyurtmadan allaqachon to'liq qaytarilgan");
    }
    addProduct(orderItem.product, orderItem.unitPrice, max);
  };

  const updateQty = (id, qty) => {
    if (qty < 1) return;
    setReturnItems(prev => prev.map(i => {
      if (i.product._id === id) {
        if (i.maxQuantity !== null && qty > i.maxQuantity) {
          toast.error(`Ko'pi bilan ${i.maxQuantity} ta qaytarish mumkin`);
          return { ...i, quantity: i.maxQuantity };
        }
        return { ...i, quantity: qty };
      }
      return i;
    }));
  };

  const removeItem = (id) => setReturnItems(prev => prev.filter(i => i.product._id !== id));

  const totalCalc = returnItems.reduce((acc, i) => acc + i.quantity * (i.unitPrice || i.product.pricePerRoll), 0);

  const confirmReturn = () => {
    const primaryWarehouse = selectedOrder?.warehouse?._id || selectedOrder?.warehouse || returnItems[0]?.product.warehouse?._id || returnItems[0]?.product.warehouse;
    
    createMutation.mutate({
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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-overlay w-full sm:max-w-[620px] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[88dvh] border border-subtle">

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden shrink-0">
          <div className="w-10 h-1 bg-subtle/80 rounded-full" />
        </div>

        {/* Header */}
        <div className="h-14 px-5 border-b border-subtle flex items-center justify-between shrink-0">
          <h2 className="text-15 font-[700] text-primary flex items-center gap-2">
            <RefreshCcw className="w-[18px] h-[18px] text-accent" strokeWidth={2} />
            Tezkor Vozvrat
          </h2>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded-lg transition-colors cursor-pointer">
            <X className="w-[16px] h-[16px]" strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">

          {/* ─── 1. MIJOZ VA BUYURTMANI TANLASH SECTION ─── */}
          <div className="bg-surface border border-subtle rounded-2xl p-3.5 space-y-3 shadow-sm">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Customer Selector */}
              <div className="relative" ref={customerDropdownRef}>
                <label className="block text-11 font-[600] text-secondary mb-1">Mijoz</label>
                <button
                  type="button"
                  onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  className="w-full h-10 px-3 bg-app border border-subtle hover:border-default rounded-xl flex items-center justify-between text-13 text-primary transition-all text-left"
                >
                  <span className="truncate font-[500]">
                    {selectedCustomer ? `${selectedCustomer.name}` : "Mijozni tanlang..."}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-tertiary shrink-0" />
                </button>

                {isCustomerDropdownOpen && (
                  <div className="absolute top-[68px] left-0 right-0 z-40 bg-surface border border-subtle rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-[260px] flex flex-col">
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

              {/* Order Selector */}
              <div className="relative" ref={orderDropdownRef}>
                <label className="block text-11 font-[600] text-secondary mb-1">Buyurtma (Chek)</label>
                <button
                  type="button"
                  onClick={() => setIsOrderDropdownOpen(!isOrderDropdownOpen)}
                  disabled={!selectedCustomer && customerOrders.length === 0}
                  className="w-full h-10 px-3 bg-app border border-subtle hover:border-default rounded-xl flex items-center justify-between text-13 text-primary transition-all text-left disabled:opacity-50 cursor-pointer"
                >
                  <span className="truncate font-[500]">
                    {selectedOrder ? selectedOrder.orderNumber : "Buyurtmani tanlang..."}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-tertiary shrink-0" />
                </button>

                {isOrderDropdownOpen && (
                  <div className="absolute top-[68px] left-0 right-0 z-40 bg-surface border border-subtle rounded-xl shadow-2xl overflow-hidden animate-fade-in max-h-[240px] overflow-y-auto p-1">
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
              <div className="mt-2 pt-2 border-t border-subtle">
                <p className="text-11 font-[600] text-secondary mb-1.5 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-accent" />
                  {selectedOrder.orderNumber} dagi mahsulotlar (Bosish orqali qo'shing):
                </p>
                <div className="space-y-1.5 max-h-[140px] overflow-y-auto no-scrollbar">
                  {selectedOrder.items?.map((item, idx) => {
                    const available = item.quantity - (item.returnedQuantity || 0) - (item.defectQuantity || 0);
                    return (
                      <div
                        key={idx}
                        onClick={() => addFromOrder(item)}
                        className="px-2.5 py-1.5 bg-app hover:bg-subtle border border-subtle rounded-lg flex items-center justify-between cursor-pointer transition-colors text-12"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-[600] text-primary truncate block">{item.product?.name || item.product?.brand || item.product?.artikul}</span>
                          <span className="text-11 text-tertiary">Olingan: {item.quantity} {item.unit} | Qolgan: <strong className="text-accent">{available}</strong> ta</span>
                        </div>
                        <button
                          type="button"
                          disabled={available <= 0}
                          className="px-2 py-1 bg-accent text-inverse rounded-md text-11 font-[600] shrink-0 disabled:opacity-40"
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

          {/* ─── 2. GENERAL PRODUCT SEARCH ─── */}
          <div className="relative" ref={searchRef}>
            <Search className="w-4 h-4 text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              placeholder="Artikul yoki nom yozing..."
              className="w-full h-11 bg-surface border border-subtle hover:border-default focus:border-focus rounded-xl pl-10 pr-4 text-14 text-primary outline-none transition-all shadow-sm"
            />
            {isSearchFocused && searchQuery.length > 0 && (
              <div className="absolute top-[48px] left-0 right-0 bg-surface border border-subtle rounded-xl shadow-2xl z-30 max-h-[280px] overflow-y-auto animate-fade-in">
                {isProductsLoading ? (
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

          {/* ─── 3. RETURN ITEMS LIST ─── */}
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
                    <div className="text-12 text-tertiary font-mono">{item.product.artikul} • {formatPrice(item.unitPrice || item.product.pricePerRoll)}</div>
                    {item.maxQuantity !== null && (
                      <div className="text-11 text-accent font-[500]">Chek bo'yicha limit: {item.maxQuantity} {item.unit}</div>
                    )}
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

          {/* ─── 4. REFUND CALCULATION ─── */}
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
                <p className="text-11 text-tertiary mt-1">Pul qaytarilmasa bo'sh qoldiring (qarzdan ayiriladi)</p>
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
        message={`${selectedCustomer ? selectedCustomer.name + ' mijozidan ' : ''}${selectedOrder ? selectedOrder.orderNumber + ' buyurtmasi bo\'yicha ' : ''}${returnItems.length} xil mahsulot qaytariladi. Sklad miqdori avtomatik ko'payadi.`}
        confirmText="Tasdiqlash"
        isDanger={false}
      />
    </div>,
    document.body
  );
};

export default QuickReturnModal;
