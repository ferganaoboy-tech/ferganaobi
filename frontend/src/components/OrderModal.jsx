import React, { useState, useEffect } from 'react';
import { X, Search, Plus, Trash2 } from 'lucide-react';
import { useWarehouses } from '../hooks/useWarehouses';
import { useCustomers } from '../hooks/useCustomers';
import { useProducts } from '../hooks/useProducts';
import { useCreateOrder } from '../hooks/useOrders';
import { useDebounce } from '../hooks/useDebounce';
import { formatUZS, formatQuantity } from '../utils/format';
import { BounceLoader } from 'react-spinners';
import CustomSelect from './CustomSelect';
import toast from 'react-hot-toast';

const OrderModal = ({ isOpen, onClose }) => {
  const [customerSearch, setCustomerSearch] = useState('');
  const debouncedCustSearch = useDebounce(customerSearch, 500);

  const [productSearch, setProductSearch] = useState('');
  const debouncedProdSearch = useDebounce(productSearch, 500);

  const { data: whRes } = useWarehouses();
  const { data: custRes } = useCustomers({ limit: 50, search: debouncedCustSearch });
  const { data: prodRes } = useProducts({ limit: 50, search: debouncedProdSearch });

  const warehouses = whRes?.data || [];
  const customers = custRes?.data || [];
  const allProducts = prodRes?.data || [];

  const createOrderMutation = useCreateOrder();

  const getTodayStr = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    customer: '', type: 'retail', warehouse: '', paymentType: 'naqd',
    items: [], paidAmount: '', deliveryAddress: '', deliveryDate: getTodayStr(), notes: '', useCashback: false,
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [itemConfig, setItemConfig] = useState({ unit: 'rulon', quantity: 1, discount: 0 });

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setSubmitting(false);
      setFormData({
        customer: '', type: 'retail', warehouse: warehouses[0]?._id || '', paymentType: 'naqd',
        items: [], paidAmount: '', deliveryAddress: '', deliveryDate: getTodayStr(), notes: '', useCashback: false,
      });
      setProductSearch('');
      setCustomerSearch('');
      setSelectedProduct(null);
    }
  }, [isOpen, warehouses]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const updated = { ...prev, [name]: type === 'checkbox' ? checked : value };
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
  const handleItemConfigChange = (e) => setItemConfig(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const filteredProducts = allProducts.filter(p => p.warehouse?._id === formData.warehouse);

  const getUnitPrice = (product, unit, orderType) => {
    if (!product) return 0;
    const basePrice = orderType === 'retail' ? product.wholesalePrice : (product.pricePerRoll || product.wholesalePrice);
    if (unit === 'rulon') return basePrice;
    if (unit === 'quti') return basePrice * product.rollsPerBox;
    if (unit === 'metr') return Math.round(basePrice / product.rollLength);
    return basePrice;
  };

  const currentUnitPrice = getUnitPrice(selectedProduct, itemConfig.unit, formData.type);
  const currentSubtotal = (currentUnitPrice * itemConfig.quantity) * (1 - itemConfig.discount / 100);

  const addItem = () => {
    if (!selectedProduct) return;
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, {
        product: selectedProduct._id, productName: selectedProduct.brand || selectedProduct.artikul, artikul: selectedProduct.artikul,
        unit: itemConfig.unit, quantity: Number(itemConfig.quantity), unitPrice: currentUnitPrice,
        discount: Number(itemConfig.discount), subtotal: currentSubtotal
      }]
    }));
    setSelectedProduct(null); setProductSearch(''); setItemConfig({ unit: 'rulon', quantity: 1, discount: 0 });
  };

  const removeItem = (index) => setFormData(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));

  const totalOrderAmount = formData.items.reduce((sum, item) => sum + item.subtotal, 0);
  
  const selectedCustomerDoc = customers.find(c => c._id === formData.customer);
  const maxCashback = selectedCustomerDoc?.cashbackBalance || 0;
  const cashbackUsed = formData.useCashback ? Math.min(maxCashback, totalOrderAmount) : 0;
  const amountToPay = totalOrderAmount - cashbackUsed;
  
  const debtAmount = amountToPay - (formData.paymentType === 'naqd' ? amountToPay : Number(formData.paidAmount || 0));

  const handleSubmit = (e) => {
    e.preventDefault();
    if (submitting) return;
    if (formData.items.length === 0) return toast.error("Kamida bitta mahsulot qo'shing");
    
    setSubmitting(true);
    const payload = {
      ...formData,
      paidAmount: formData.paymentType === 'naqd' ? amountToPay : (formData.paymentType === 'nasiya' ? 0 : Number(formData.paidAmount)),
      status: 'confirmed'
    };
    createOrderMutation.mutate(payload, { 
      onSuccess: () => {
        onClose();
      },
      onError: (err) => {
        setSubmitting(false);
        toast.error(err.response?.data?.message || "Buyurtma yaratishda xatolik yuz berdi");
      }
    });
  };

  const inputClass = "w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm";
  const labelClass = "block text-12 font-[500] text-secondary mb-1.5 tracking-[0.01em]";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="bg-overlay border border-default rounded-lg w-[760px] flex flex-col h-[600px] animate-in fade-in zoom-in-95 duration-150 ease-out">
        
        {/* Header */}
        <div className="h-14 px-6 border-b border-subtle flex items-center justify-between shrink-0">
          <h2 className="text-15 font-[600] text-primary">Yangi Buyurtma</h2>
          <div className="flex gap-1.5">
            {[1, 2, 3].map(s => (
              <div key={s} className={`w-8 h-1.5 rounded-full ${step >= s ? 'bg-accent' : 'bg-subtle'}`}></div>
            ))}
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors">
            <X className="w-[16px] h-[16px]" strokeWidth={1.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 bg-app">
          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-14 font-[500] text-primary border-b border-subtle pb-2">1. Asosiy ma'lumotlar</h3>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <div className="col-span-2">
                  <label className={labelClass}>Mijozni qidirish va tanlash *</label>
                  <input 
                    type="text" 
                    placeholder="Mijoz nomi yoki telefon raqami..." 
                    value={customerSearch} 
                    onChange={e => setCustomerSearch(e.target.value)} 
                    className={`${inputClass} mb-2`} 
                  />
                  <CustomSelect
                    value={formData.customer}
                    onChange={(val) => handleChange({ target: { name: 'customer', value: val } })}
                    options={[
                      { value: '', label: `Ro'yxatdan tanlang (Topilgan mijozlar: ${customers.length})` },
                      ...customers.map(c => ({ value: c._id, label: `${c.name} (${c.phone})` }))
                    ]}
                  />
                </div>
                <div>
                  <label className={labelClass}>Buyurtma turi</label>
                  <div className="flex h-9 bg-surface border border-default rounded-md overflow-hidden">
                    {['wholesale', 'retail'].map(t => (
                      <label key={t} className={`flex-1 flex items-center justify-center text-13 cursor-pointer transition-colors ${formData.type === t ? 'bg-subtle text-primary font-[500]' : 'text-secondary hover:bg-subtle'}`}>
                        <input type="radio" name="type" value={t} checked={formData.type === t} onChange={handleChange} className="hidden" />
                        {t === 'retail' ? 'Chakana' : 'Sotuv'}
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Sklad *</label>
                  <CustomSelect
                    value={formData.warehouse}
                    onChange={(val) => handleChange({ target: { name: 'warehouse', value: val } })}
                    options={[
                      { value: '', label: 'Tanlang...' },
                      ...warehouses.map(wh => ({ value: wh._id, label: wh.name }))
                    ]}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col h-full space-y-4">
              <h3 className="text-14 font-[500] text-primary border-b border-subtle pb-2 shrink-0">2. Mahsulotlar</h3>
              
              <div className="flex gap-4 min-h-0 h-[220px] shrink-0">
                {/* Search List */}
                <div className="w-1/2 flex flex-col border border-subtle bg-surface rounded-md">
                  <div className="p-2 border-b border-subtle shrink-0">
                    <div className="relative">
                      <Search className="w-[14px] h-[14px] text-tertiary absolute left-2 top-1/2 -translate-y-1/2" strokeWidth={1.5} />
                      <input 
                        value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Qidirish..." className="w-full h-8 pl-7 pr-2 text-13 border border-default rounded focus:border-focus outline-none"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto no-scrollbar">
                    {filteredProducts.map(p => (
                      <div key={p._id} onClick={() => { setSelectedProduct(p); setItemConfig({ unit: p.category === 'oboi' || !p.category ? 'rulon' : (p.unit || 'dona'), quantity: 1, discount: 0 }); }} className={`p-2 border-b border-subtle cursor-pointer transition-colors flex justify-between items-center ${selectedProduct?._id === p._id ? 'bg-subtle' : 'hover:bg-subtle'}`}>
                        <div className="min-w-0">
                          <div className="text-13 font-[500] text-primary truncate">{p.brand || p.artikul}</div>
                          <div className="text-11 text-secondary font-mono">{p.artikul}</div>
                        </div>
                        <div className={`text-11 font-[500] ${p.quantity > 0 ? 'text-secondary' : 'text-state-danger-text'}`}>{formatQuantity(p.quantity, p.rollLength)}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Configurator */}
                <div className="w-1/2 border border-subtle bg-surface rounded-md p-4 flex flex-col">
                  {selectedProduct ? (
                    <>
                      <div className="text-14 font-[500] text-primary mb-1 truncate">{selectedProduct.name}</div>
                      <div className="text-12 text-secondary font-mono mb-4">{selectedProduct.artikul}</div>
                      
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="col-span-2">
                          <div className="flex h-8 bg-subtle rounded p-0.5">
                            {(selectedProduct.category === 'oboi' || !selectedProduct.category ? ['rulon', 'metr', 'quti'] : [selectedProduct.unit || 'dona']).map(u => (
                              <button key={u} type="button" onClick={() => setItemConfig(prev=>({...prev, unit: u}))} className={`flex-1 text-12 capitalize rounded-sm ${itemConfig.unit === u ? 'bg-surface shadow-sm font-[500] text-primary' : 'text-secondary'}`}>{u}</button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-11 text-tertiary mb-1 block">Miqdor</label>
                          <input type="number" min="1" name="quantity" value={itemConfig.quantity} onChange={handleItemConfigChange} className="w-full h-8 border border-default rounded px-2 text-13 text-primary focus:border-focus outline-none" />
                        </div>
                        <div>
                          <label className="text-11 text-tertiary mb-1 block">Chegirma (%)</label>
                          <input type="number" min="0" max="100" name="discount" value={itemConfig.discount} onChange={handleItemConfigChange} className="w-full h-8 border border-default rounded px-2 text-13 text-primary focus:border-focus outline-none" />
                        </div>
                      </div>
                      
                      <div className="mt-auto flex justify-between items-center pt-3 border-t border-subtle">
                        <div className="text-14 font-mono font-[600] text-primary">{formatUZS(currentSubtotal)}</div>
                        <button type="button" onClick={addItem} className="h-8 px-3 bg-primary text-inverse rounded text-12 font-[500] hover:bg-accent-hover transition-colors">Qo'shish</button>
                      </div>
                    </>
                  ) : (
                     <div className="flex-1 flex items-center justify-center text-13 text-tertiary">Mahsulot tanlang</div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="flex-1 border border-subtle bg-surface rounded-md overflow-hidden flex flex-col min-h-0 mt-4">
                <table className="w-full text-left text-12">
                  <thead className="bg-subtle border-b border-subtle">
                    <tr className="text-tertiary font-[500]">
                      <th className="px-3 py-2">Mahsulot</th>
                      <th className="px-3 py-2 text-right">Miqdor</th>
                      <th className="px-3 py-2 text-right">Subtotal</th>
                      <th className="px-3 py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="overflow-y-auto block w-full h-[80px]" style={{ display: 'table-row-group' }}>
                    {formData.items.map((item, idx) => (
                      <tr key={idx} className="border-b border-subtle last:border-0">
                        <td className="px-3 py-2"><div className="font-[500] text-primary">{item.productName}</div><div className="text-11 text-secondary font-mono">{item.artikul}</div></td>
                        <td className="px-3 py-2 text-right">{item.quantity} {item.unit}</td>
                        <td className="px-3 py-2 text-right font-mono text-primary font-[500]">{formatUZS(item.subtotal)}</td>
                        <td className="px-3 py-2"><button type="button" onClick={() => removeItem(idx)} className="text-tertiary hover:text-state-danger-text"><Trash2 className="w-[14px] h-[14px]" strokeWidth={1.5} /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-14 font-[500] text-primary border-b border-subtle pb-2">3. To'lov va Yetkazib berish</h3>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                <div className="col-span-2">
                  <label className={labelClass}>To'lov usuli</label>
                  <div className="flex bg-subtle/50 p-1.5 rounded-[14px] border border-subtle shadow-inner mt-1">
                    {['naqd', 'nasiya', 'qisman'].map(pt => (
                      <label key={pt} className={`flex-1 h-[40px] flex items-center justify-center rounded-[10px] cursor-pointer transition-all duration-300 text-[14px] capitalize ${formData.paymentType === pt ? 'bg-surface shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.05)] border border-subtle/80 text-primary font-[600]' : 'text-secondary hover:text-primary hover:bg-surface/50 font-[500] border border-transparent'}`}>
                        <input type="radio" name="paymentType" value={pt} checked={formData.paymentType === pt} onChange={handleChange} className="hidden" />
                        {pt}
                      </label>
                    ))}
                  </div>
                </div>

                {formData.paymentType === 'qisman' && (
                  <div className="col-span-2">
                    <label className={labelClass}>To'lanayotgan summa (so'm)</label>
                    <input type="number" name="paidAmount" value={formData.paidAmount} onChange={handleChange} className={`${inputClass} font-mono`} />
                  </div>
                )}

                {maxCashback > 0 && (
                  <div className="col-span-2 flex items-center justify-between p-3 border border-state-success-border bg-state-success-bg rounded-md">
                    <div>
                      <div className="text-13 font-[600] text-state-success-text">Keshbek ishlatish</div>
                      <div className="text-11 text-state-success-text/80">Mavjud bonus: {formatUZS(maxCashback)}</div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" name="useCashback" checked={formData.useCashback} onChange={handleChange} className="sr-only peer" />
                      <div className="w-9 h-5 bg-subtle border border-default peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-state-success-text"></div>
                    </label>
                  </div>
                )}

                <div className="col-span-2 bg-subtle rounded-md p-4 border border-default">
                  <div className="flex justify-between text-13 mb-1"><span className="text-secondary">Jami summa:</span><span className="font-mono text-primary font-[500]">{formatUZS(totalOrderAmount)}</span></div>
                  {formData.useCashback && (
                    <div className="flex justify-between text-13 mb-1 text-state-success-text font-[500]"><span className="text-state-success-text/80">Ishlatilgan keshbek:</span><span className="font-mono">-{formatUZS(cashbackUsed)}</span></div>
                  )}
                  {['nasiya', 'qisman'].includes(formData.paymentType) && (
                    <div className="flex justify-between text-13 mt-2 pt-2 border-t border-default"><span className="text-secondary">Qarzga:</span><span className="font-mono text-state-danger-text font-[600]">{formatUZS(debtAmount)}</span></div>
                  )}
                </div>

                <div className="col-span-2 grid grid-cols-2 gap-4 border-t border-subtle pt-4">
                  <div>
                    <label className={labelClass}>Manzil</label>
                    <input name="deliveryAddress" value={formData.deliveryAddress} onChange={handleChange} className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Sana</label>
                    <input type="date" name="deliveryDate" value={formData.deliveryDate} onChange={handleChange} className={inputClass} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="min-h-[64px] pb-safe px-6 border-t border-subtle flex items-center justify-between shrink-0 bg-surface rounded-b-lg">
          <button type="button" onClick={() => step > 1 ? setStep(step - 1) : onClose()} className="h-9 px-4 rounded-md text-13 font-[500] text-primary border border-default hover:bg-subtle transition-colors">
            {step > 1 ? 'Orqaga' : 'Bekor qilish'}
          </button>
          
          {step < 3 ? (
            <button type="button" onClick={() => {
                if (step === 1 && (!formData.customer || !formData.warehouse)) return toast.error("Mijoz va skladni tanlang");
                if (step === 2 && formData.items.length === 0) return toast.error("Mahsulot qo'shing");
                setStep(step + 1);
              }} className="h-9 px-4 rounded-md text-13 font-[500] text-inverse bg-accent hover:bg-accent-hover transition-colors">
              Keyingisi
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={submitting || createOrderMutation.isLoading} className="h-9 px-4 rounded-md text-13 font-[500] text-inverse bg-accent hover:bg-accent-hover transition-colors disabled:opacity-50">
              {submitting || createOrderMutation.isLoading ? 'Saqlanmoqda...' : 'Tasdiqlash'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderModal;
