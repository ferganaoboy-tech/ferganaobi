import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingBag, Trash2, Plus, Minus, CreditCard, User, MapPin, Calendar, FileText, Search, ChevronDown } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useCustomers, useCreateCustomer } from '../hooks/useCustomers';
import { useWarehouses } from '../hooks/useWarehouses';
import { useCreateOrder } from '../hooks/useOrders';
import { useSettings } from '../hooks/useSettings';
import { formatUZS } from '../utils/format';
import toast from 'react-hot-toast';
import { haptics } from '../utils/haptics';
import ConfirmModal from './ConfirmModal';
import CheckViewModal from './CheckViewModal';

const CartDrawer = () => {
  const navigate = useNavigate();
  const { 
    cartItems, 
    cartWarehouse, 
    orderType, 
    cartOpen, 
    setCartOpen, 
    setOrderType, 
    removeFromCart, 
    updateCartQuantity, 
    updateCartItemPrice,
    clearCart, 
    totalAmount 
  } = useCart();

  const { data: custRes } = useCustomers({ limit: 1000 });
  const { data: whRes } = useWarehouses();
  const { data: settingsRes } = useSettings();
  const createOrderMutation = useCreateOrder();
  const createCustomerMutation = useCreateCustomer();

  const customers = custRes?.data || [];
  const warehouses = whRes?.data || [];

  const cartFields = settingsRes?.data?.cartFields || {
    showCustomer: true,
    showAddress: true,
    showDate: true,
    showNotes: true
  };

  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState(null);
  const [checkOrder, setCheckOrder] = useState(null);
  const [checkoutData, setCheckoutData] = useState({
    customer: '',
    paymentType: 'naqd',
    paidAmount: '',
    deliveryAddress: '',
    deliveryDate: '',
    notes: ''
  });

  const [customTotal, setCustomTotal] = useState('');

  const [customerSearch, setCustomerSearch] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const customerDropdownRef = React.useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target)) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getTodayStr = () => {
    const today = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tashkent', year: 'numeric', month: 'numeric', day: 'numeric' });
    const parts = formatter.formatToParts(today);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value.padStart(2, '0');
    const day = parts.find(p => p.type === 'day').value.padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (cartOpen) {
      setCheckoutData(prev => ({
        ...prev,
        deliveryDate: getTodayStr()
      }));
      setSubmitting(false);
      setCustomTotal('');
    }
  }, [cartOpen]);

  useEffect(() => {
    setCustomTotal('');
  }, [totalAmount]);

  if (!cartOpen) return null;

  const selectedWarehouse = warehouses.find(w => w._id === cartWarehouse);
  const warehouseName = selectedWarehouse ? selectedWarehouse.name : 'Tanlanmagan';

  const handleCheckoutChange = (e) => {
    const { name, value } = e.target;
    haptics.light();
    setCheckoutData(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'customer') {
        if (value) {
          const selectedCust = customers.find(c => c._id === value);
          updated.deliveryAddress = selectedCust?.address || '';
        } else {
          updated.deliveryAddress = '';
        }
      }
      return updated;
    });
  };

  const finalTotal = customTotal !== '' ? Number(customTotal) : totalAmount;
  const debtAmount = finalTotal - (checkoutData.paymentType === 'naqd' ? finalTotal : Number(checkoutData.paidAmount || 0));

  const submitOrder = (customerId) => {
    const orderItems = cartItems.map(item => ({
      product: item.product,
      unit: item.unit,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal
    }));

    const payload = {
      customer: customerId,
      warehouse: cartWarehouse,
      type: orderType,
      items: orderItems,
      paymentType: checkoutData.paymentType,
      paidAmount: checkoutData.paymentType === 'naqd' ? finalTotal : (checkoutData.paymentType === 'nasiya' ? 0 : Number(checkoutData.paidAmount)),
      overrideTotalAmount: customTotal !== '' ? Number(customTotal) : undefined,
      deliveryAddress: checkoutData.deliveryAddress,
      deliveryDate: checkoutData.deliveryDate,
      notes: checkoutData.notes,
      status: 'confirmed'
    };

    createOrderMutation.mutate(payload, {
      onSuccess: (res) => {
        haptics.success();
        clearCart();
        // Set the order data to show the receipt
        setCheckOrder(res?.data || res); 
        setSubmitting(false);
        // We do NOT close the drawer immediately, let CheckView overlay it,
        // and when CheckView closes, it will close the drawer.
      },
      onError: () => {
        haptics.warning();
        setSubmitting(false);
      }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (cartItems.length === 0) {
      haptics.warning();
      return toast.error("Savat bo'sh!");
    }
    if (!cartWarehouse) {
      haptics.warning();
      return toast.error("Ombor topilmadi!");
    }

    if (checkoutData.paymentType === 'qisman') {
      const pAmt = Number(checkoutData.paidAmount || 0);
      if (pAmt <= 0) {
        haptics.warning();
        return toast.error("Qisman to'lov summasi musbat bo'lishi kerak!");
      }
      if (pAmt > finalTotal) {
        haptics.warning();
        return toast.error("Qisman to'lov summasi jami summadan oshib ketmasligi kerak!");
      }
    }

    if (submitting) return;

    setSubmitting(true);

    if (checkoutData.customer) {
      submitOrder(checkoutData.customer);
    } else {
      // Find or create 'Bir martalik mijoz'
      let oneTimeCust = customers.find(c => c.name.toLowerCase() === 'bir martalik mijoz');
      if (oneTimeCust) {
        submitOrder(oneTimeCust._id);
      } else {
        createCustomerMutation.mutate({ name: 'Bir martalik mijoz', phone: '+998000000000', type: 'retail' }, {
          onSuccess: (res) => {
            const customerId = res.data?._id || res.data || res._id;
            submitOrder(customerId);
          },
          onError: () => {
            haptics.warning();
            toast.error("Mijoz yaratishda xatolik yuz berdi!");
            setSubmitting(false);
          }
        });
      }
    }
  };

  const inputClass = "w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm";
  const labelClass = "block text-11 font-[600] text-secondary mb-1.5 uppercase tracking-[0.05em]";

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[2px] animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={() => setCartOpen(false)} />
      
      {/* Content drawer */}
      <div className="relative w-full max-w-lg bg-surface h-full flex flex-col shadow-2xl z-10 border-l border-subtle animate-slide-in-right pb-safe pr-safe">
        
        {/* Header */}
        <div className="px-4 sm:px-6 pb-4 pt-safe border-b border-subtle flex items-center justify-between shrink-0 bg-surface">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-accent" />
            <h2 className="text-15 font-[600] text-primary">Savat & Rasmiylashtirish</h2>
          </div>
          <button 
            onClick={() => setCartOpen(false)} 
            className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors"
            type="button"
          >
            <X className="w-[16px] h-[16px]" strokeWidth={1.5} />
          </button>
        </div>

        {/* Scrollable middle */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6 bg-app no-scrollbar">
          {cartItems.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6">
              <ShoppingBag className="w-12 h-12 text-tertiary mb-3 animate-bounce" strokeWidth={1.2} />
              <h3 className="text-15 font-[500] text-secondary">Savat bo'sh</h3>
              <p className="text-13 text-tertiary mt-1">Katalog bo'limidan mahsulot qo'shing.</p>
              <button 
                onClick={() => {
                  setCartOpen(false);
                  navigate('/products');
                }}
                className="mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-inverse rounded-md text-13 font-[500] transition-colors"
                type="button"
              >
                Katalogga qaytish
              </button>
            </div>
          ) : (
            <>
              {/* Warehouse info & Order Type Selector */}
              <div className="bg-surface border border-subtle rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4">
                <div className="flex justify-between items-center text-13">
                  <span className="text-secondary font-[500]">Ombor:</span>
                  <span className="font-[500] text-primary bg-surface px-2.5 py-1 rounded-md border border-subtle flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full" style={{backgroundColor: selectedWarehouse?.color || '#ccc'}}></span>
                    {warehouseName}
                  </span>
                </div>
                
                <div className="border-t border-subtle pt-3">
                  <label className={labelClass}>Savdo turi</label>
                  <div className="flex bg-subtle/50 p-1 rounded-[10px] border border-subtle shadow-inner w-full mt-1">
                    {['wholesale', 'retail'].map(t => (
                      <button 
                        key={t}
                        type="button"
                        onClick={() => setOrderType(t)}
                        className={`flex-1 h-8 text-[13px] rounded-md transition-all duration-200 ${
                          orderType === t 
                            ? 'bg-surface shadow-sm border border-subtle/60 text-primary font-[600]' 
                            : 'text-secondary hover:text-primary border border-transparent font-[500]'
                        }`}
                      >
                        {t === 'retail' ? 'Chakana' : 'Sotuv'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="space-y-3">
                <h3 className="text-12 font-[600] text-secondary uppercase tracking-[0.05em]">Savatdagi mahsulotlar</h3>
                <div className="space-y-2">
                  {cartItems.map((item, idx) => (
                    <div key={idx} className="bg-surface border border-subtle rounded-lg p-2.5 sm:p-3 flex justify-between items-center gap-2 sm:gap-4">
                      <div className="min-w-0 flex-1 flex flex-col justify-center">
                        <div className="text-[16px] font-[700] text-primary tracking-tight leading-none mb-1">
                          {item.brand ? <span className="text-gray-500 text-[12px] uppercase mr-1.5">{item.brand}</span> : null}
                          {item.artikul}
                        </div>
                        <div className="font-[500] text-gray-400 text-[11px] uppercase tracking-widest truncate">{item.productName || 'Brendsiz'}</div>
                        <div className="mt-2 flex items-baseline gap-1">
                          <input
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateCartItemPrice(item.product, item.unit, e.target.value)}
                            className="text-[15px] font-[700] text-primary tracking-tight bg-transparent border-b border-dashed border-subtle outline-none w-[90px] px-0.5 focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                          <span className="text-[10px] font-[500] text-gray-500">UZS</span>
                          <span className="text-[11px] font-[500] text-gray-400 ml-1">/ {item.unit}</span>
                        </div>
                      </div>
                      
                      {/* Stepper and Delete */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="flex items-center bg-subtle/50 border border-subtle rounded-[10px] h-[34px] p-1 shadow-sm select-none">
                          <button
                            type="button"
                            onClick={() => {
                              if (item.quantity === 1) {
                                setConfirmAction({
                                  title: "Mahsulotni savatdan o'chirish",
                                  message: "Rostdan o'chirishni istaysizmi?",
                                  confirmText: "O'chirish",
                                  isDanger: true,
                                  onConfirm: () => {
                                    removeFromCart(item.product, item.unit);
                                    toast.success("Mahsulot savatdan o'chirildi");
                                  }
                                });
                              } else {
                                updateCartQuantity(item.product, item.unit, item.quantity - 1);
                              }
                            }}
                            className="w-7 h-full rounded-md flex items-center justify-center text-secondary hover:text-primary hover:bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-95 transition-all cursor-pointer bg-surface/50 border border-transparent hover:border-subtle"
                          >
                            <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateCartQuantity(item.product, item.unit, parseInt(e.target.value) || 1)}
                            className="w-10 h-full text-center text-[15px] bg-transparent border-0 outline-none text-primary font-[700] focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => updateCartQuantity(item.product, item.unit, item.quantity + 1)}
                            className="w-7 h-full rounded-md flex items-center justify-center text-secondary hover:text-primary hover:bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.05)] active:scale-95 transition-all cursor-pointer bg-surface/50 border border-transparent hover:border-subtle"
                          >
                            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setConfirmAction({
                              title: "Mahsulotni savatdan o'chirish",
                              message: "Rostdan o'chirishni istaysizmi?",
                              confirmText: "O'chirish",
                              isDanger: true,
                              onConfirm: () => {
                                removeFromCart(item.product, item.unit);
                                toast.success("Mahsulot savatdan o'chirildi");
                              }
                            });
                          }}
                          className="text-tertiary hover:text-state-danger-text w-7 h-7 flex items-center justify-center hover:bg-state-danger-bg rounded transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Checkout Form */}
              <div className="space-y-3 sm:space-y-4 bg-surface border border-subtle rounded-lg p-3 sm:p-4">
                <h3 className="text-12 font-[600] text-secondary uppercase border-b border-subtle pb-2 tracking-[0.05em]">Buyurtma Tafsilotlari</h3>
                
                {/* Customer Combobox */}
                {cartFields.showCustomer && (
                <div ref={customerDropdownRef} className="relative">
                  <label className="flex items-center gap-1.5 text-11 font-[600] text-secondary mb-1.5 uppercase tracking-[0.05em]">
                    <User className="w-3.5 h-3.5" /> Mijoz
                  </label>
                  
                  <div 
                    className={`${inputClass} flex items-center justify-between cursor-pointer relative`}
                    onClick={() => setIsCustomerDropdownOpen(!isCustomerDropdownOpen)}
                  >
                    <span className={`truncate ${checkoutData.customer ? 'text-primary' : 'text-tertiary'}`}>
                      {checkoutData.customer 
                        ? customers.find(c => c._id === checkoutData.customer)?.name || 'Mijoz tanlandi'
                        : 'Mijozni tanlang (ixtiyoriy)...'}
                    </span>
                    <ChevronDown className={`w-4 h-4 text-tertiary transition-transform shrink-0 ${isCustomerDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>

                  {isCustomerDropdownOpen && (
                    <div className="absolute top-[66px] left-0 w-full bg-surface border border-subtle shadow-2xl rounded-xl z-50 overflow-hidden animate-fade-in flex flex-col max-h-[320px]">
                      <div className="p-2 border-b border-subtle bg-app shrink-0">
                        <div className="relative">
                          <Search className="w-4 h-4 text-tertiary absolute left-3 top-1/2 -translate-y-1/2" />
                          <input 
                            type="text"
                            placeholder="Ism yoki telefon bo'yicha qidirish..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                            className="w-full h-10 bg-surface border border-subtle rounded-lg pl-9 pr-3 text-13 outline-none focus:border-focus transition-colors shadow-sm"
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                          />
                        </div>
                      </div>
                      
                      <div className="overflow-y-auto no-scrollbar flex-1 p-1.5">
                        <div 
                          className="px-3 py-2.5 text-13 font-[600] text-accent hover:bg-accent/10 rounded-lg cursor-pointer flex items-center gap-2.5 mb-1.5 transition-colors border border-transparent hover:border-accent/20"
                          onClick={() => {
                            let oneTimeCust = customers.find(c => c.name.toLowerCase() === 'bir martalik mijoz');
                            if (oneTimeCust) {
                              handleCheckoutChange({ target: { name: 'customer', value: oneTimeCust._id } });
                              setIsCustomerDropdownOpen(false);
                            } else {
                              createCustomerMutation.mutate({ name: 'Bir martalik mijoz', phone: '+998000000000', type: 'retail' }, {
                                onSuccess: (res) => {
                                  handleCheckoutChange({ target: { name: 'customer', value: res.data._id } });
                                  setIsCustomerDropdownOpen(false);
                                }
                              });
                            }
                          }}
                        >
                          <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                            <User className="w-3.5 h-3.5 text-accent" />
                          </div>
                          Bir martalik mijoz
                        </div>
                        
                        <div className="space-y-0.5">
                          {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)).map(c => (
                            <div 
                              key={c._id}
                              className={`px-3 py-2 text-13 rounded-lg cursor-pointer flex flex-col transition-colors ${checkoutData.customer === c._id ? 'bg-accent text-inverse shadow-md' : 'text-primary hover:bg-subtle border border-transparent hover:border-subtle'}`}
                              onClick={() => {
                                handleCheckoutChange({ target: { name: 'customer', value: c._id } });
                                setIsCustomerDropdownOpen(false);
                              }}
                            >
                              <span className="font-[500]">{c.name}</span>
                              <span className={`text-11 mt-0.5 ${checkoutData.customer === c._id ? 'text-inverse/80' : 'text-tertiary'}`}>{c.phone}</span>
                            </div>
                          ))}
                          {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase()) || c.phone?.includes(customerSearch)).length === 0 && (
                            <div className="text-center py-4 text-12 text-tertiary">
                              Mijoz topilmadi
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                )}

                {/* Delivery Address & Date */}
                {(cartFields.showAddress || cartFields.showDate) && (
                <div className={`grid ${cartFields.showAddress && cartFields.showDate ? 'grid-cols-2' : 'grid-cols-1'} gap-3`}>
                  {cartFields.showAddress && (
                  <div>
                    <label className="flex items-center gap-1.5 text-11 font-[600] text-secondary mb-1.5 uppercase tracking-[0.05em]">
                      <MapPin className="w-3.5 h-3.5" /> Manzil
                    </label>
                    <input
                      name="deliveryAddress"
                      value={checkoutData.deliveryAddress}
                      onChange={handleCheckoutChange}
                      placeholder="Yetkazish manzili"
                      className={inputClass}
                    />
                  </div>
                  )}
                  {cartFields.showDate && (
                  <div>
                    <label className="flex items-center gap-1.5 text-11 font-[600] text-secondary mb-1.5 uppercase tracking-[0.05em]">
                      <Calendar className="w-3.5 h-3.5" /> Sana
                    </label>
                    <input
                      type="date"
                      name="deliveryDate"
                      value={checkoutData.deliveryDate}
                      onChange={handleCheckoutChange}
                      className={inputClass}
                    />
                  </div>
                  )}
                </div>
                )}

                {/* Notes */}
                {cartFields.showNotes && (
                <div>
                  <label className="flex items-center gap-1.5 text-11 font-[600] text-secondary mb-1.5 uppercase tracking-[0.05em]">
                    <FileText className="w-3.5 h-3.5" /> Izoh
                  </label>
                  <textarea
                    name="notes"
                    value={checkoutData.notes}
                    onChange={handleCheckoutChange}
                    placeholder="Qo'shimcha izohlar..."
                    className="w-full h-[72px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 py-3 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm resize-none"
                  />
                </div>
                )}

                {/* Payment Methods */}
                <div>
                  <label className="flex items-center gap-1.5 text-11 font-[600] text-secondary mb-1.5 uppercase tracking-[0.05em]">
                    <CreditCard className="w-3.5 h-3.5" /> To'lov Usuli
                  </label>
                  <div className="flex bg-subtle/50 p-1.5 rounded-[14px] border border-subtle shadow-inner mt-1">
                    {['naqd', 'nasiya', 'qisman'].map(pt => (
                      <label 
                        key={pt} 
                        className={`flex-1 h-[40px] flex items-center justify-center rounded-[10px] cursor-pointer transition-all duration-300 text-[14px] capitalize ${
                          checkoutData.paymentType === pt 
                            ? 'bg-surface shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.05)] border border-subtle/80 text-primary font-[600]' 
                            : 'text-secondary hover:text-primary hover:bg-surface/50 font-[500] border border-transparent'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentType"
                          value={pt}
                          checked={checkoutData.paymentType === pt}
                          onChange={handleCheckoutChange}
                          className="hidden"
                        />
                        {pt}
                      </label>
                    ))}
                  </div>
                </div>

                {checkoutData.paymentType === 'qisman' && (
                  <div>
                    <label className={labelClass}>To'lanayotgan summa (so'm)</label>
                    <input
                      type="number"
                      name="paidAmount"
                      value={checkoutData.paidAmount}
                      onChange={handleCheckoutChange}
                      className={`${inputClass} font-mono`}
                      placeholder="Masalan: 500 000"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {cartItems.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-subtle flex flex-col justify-center bg-surface shrink-0 shadow-[0_-4px_12px_rgba(0,0,0,0.03)] z-10">
            {/* Price Calculations */}
            <div className="flex justify-between items-center mb-3">
              <div className="flex flex-col">
                <span className="text-[11px] font-[500] text-secondary uppercase tracking-[0.05em] mb-1">Jami Summa:</span>
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center shadow-sm">
                    <input
                      type="number"
                      value={customTotal !== '' ? customTotal : totalAmount}
                      onChange={(e) => setCustomTotal(e.target.value)}
                      className="w-[150px] h-10 pl-3 pr-12 bg-surface border border-subtle focus:border-primary focus:ring-0 rounded-md text-[18px] font-[700] text-primary outline-none transition-all shadow-sm"
                    />
                    <span className="absolute right-3 text-[11px] font-[600] text-gray-500 uppercase tracking-widest pointer-events-none">UZS</span>
                  </div>
                  {customTotal !== '' && Number(customTotal) !== totalAmount && (
                    <button 
                      type="button" 
                      onClick={() => setCustomTotal('')}
                      className="text-[11px] text-tertiary hover:text-state-danger-text underline"
                    >
                      Qaytarish
                    </button>
                  )}
                </div>
              </div>
              {['nasiya', 'qisman'].includes(checkoutData.paymentType) && (
                <div className="flex flex-col items-end">
                  <span className="text-[11px] font-[600] text-state-danger-text uppercase tracking-[0.05em] mb-1">Qarzga:</span>
                  <span className="text-14 font-mono font-[600] text-state-danger-text bg-state-danger-bg border border-state-danger-border px-2.5 py-1 rounded-lg shadow-sm">
                    {formatUZS(debtAmount).replace(" so'm", "")} <span className="text-[10px] text-state-danger-text/70 uppercase tracking-wide">so'm</span>
                  </span>
                </div>
              )}
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  setConfirmAction({
                    title: "Savatni tozalash",
                    message: "Rostdan o'chirishni istaysizmi?",
                    confirmText: "Tozalash",
                    isDanger: true,
                    onConfirm: () => {
                      clearCart();
                      toast.success("Savat bo'shatildi");
                    }
                  });
                }}
                className="h-9 px-4 rounded-md text-13 font-[500] text-state-danger-text border border-state-danger-border bg-state-danger-bg hover:opacity-90 active:scale-95 transition-all"
                type="button"
                disabled={submitting}
              >
                Tozalash
              </button>
              
              <button 
                onClick={handleSubmit} 
                disabled={submitting || createOrderMutation.isPending}
                className="flex-1 h-9 rounded-md text-13 font-[500] text-inverse bg-accent hover:bg-accent-hover active:scale-[0.98] transition-all flex items-center justify-center disabled:opacity-50"
                type="submit"
              >
                {submitting || createOrderMutation.isPending ? 'Saqlanmoqda...' : 'Buyurtmani Tasdiqlash'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={confirmAction?.onConfirm || (() => {})}
        title={confirmAction?.title}
        message={confirmAction?.message}
        confirmText={confirmAction?.confirmText}
        cancelText="Bekor qilish"
        isDanger={confirmAction?.isDanger ?? true}
      />

      <CheckViewModal 
        isOpen={!!checkOrder} 
        order={checkOrder} 
        onClose={() => {
          setCheckOrder(null);
          setCartOpen(false);
          setCheckoutData({
            customer: '',
            paymentType: 'naqd',
            paidAmount: '',
            deliveryAddress: '',
            deliveryDate: getTodayStr(),
            notes: ''
          });
        }} 
      />
    </div>
  );
};

export default CartDrawer;
