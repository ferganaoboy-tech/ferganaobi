import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Upload, Trash2, CheckCircle2,
  Package, DollarSign, Image, Building2, Plus
} from 'lucide-react';
import { useWarehouses } from '../hooks/useWarehouses';
import { useCreateProduct, useUpdateProduct, useFilters } from '../hooks/useProducts';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';

import imageCompression from 'browser-image-compression';
import CustomSelect from './CustomSelect';

/* ─── Shared styles ─── */
const inputClass =
  "w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm";
const labelClass =
  "block text-11 font-[600] text-secondary mb-1.5 uppercase tracking-[0.05em]";
const selectClass = `${inputClass} appearance-none`;

/* ─── Main Component ─── */
const ProductModal = ({ isOpen, onClose, product = null }) => {
  const { user } = useAuth();
  const { data: whRes } = useWarehouses();
  const allWarehouses = whRes?.data || [];

  const isRestrictedUser = user?.role !== 'superadmin' && user?.role !== 'admin';
  const userWarehouseId = user?.warehouse?._id || user?.warehouse;

  const warehouses = isRestrictedUser 
    ? allWarehouses.filter(w => w._id === userWarehouseId)
    : allWarehouses;

  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct();
  const { data: settingsRes } = useSettings();
  const { data: filterOptionsRes } = useFilters();
  const usdRate = settingsRes?.data?.usdExchangeRate || 12500;
  
  const filterOptions = filterOptionsRes?.data || { brands: [] };

  const [formData, setFormData] = useState({
    brand: '', artikul: '', collection: '', warehouse: '',
    category: 'oboi',
    material: 'vinyl', design: 'geometric', polka: '',
    costPriceUsd: '', wholesalePriceUsd: '', pricePerRollUsd: '',
    costPrice: '', wholesalePrice: '', pricePerRoll: '',
    quantity: 0, minStock: 4,
  });

  const [images, setImages] = useState([]);
  const [existingImages, setExistingImages] = useState([]);
  const [deletedImages, setDeletedImages] = useState([]);

  const [costPriceCurrency, setCostPriceCurrency] = useState('USD');
  const [wholesalePriceCurrency, setWholesalePriceCurrency] = useState('USD');
  const [pricePerRollCurrency, setPricePerRollCurrency] = useState('USD');
  const [isCompressing, setIsCompressing] = useState(false);

  const defaultWarehouseId = warehouses.length > 0 ? warehouses[0]._id : '';

  const [brandSearchFocused, setBrandSearchFocused] = useState(false);
  const [customBrands, setCustomBrands] = useState([]);
  const brandRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (brandRef.current && !brandRef.current.contains(e.target)) {
        setBrandSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    setCostPriceCurrency('USD');
    setWholesalePriceCurrency('USD');
    setPricePerRollCurrency('UZS');
    setIsCompressing(false);
    if (product) {
      setFormData({
        brand: product.brand || '',
        artikul: product.artikul || '',
        collection: product.collection || '',
        warehouse: product.warehouse?._id || product.warehouse || '',
        category: product.category || 'oboi',
        material: product.material || 'vinyl',
        design: product.design || 'geometric',
        polka: product.polka || '',
        costPriceUsd: product.costPriceUsd || '',
        wholesalePriceUsd: product.wholesalePriceUsd || '',
        pricePerRollUsd: product.pricePerRollUsd || '',
        costPrice: product.costPrice || '',
        wholesalePrice: product.wholesalePrice || '',
        pricePerRoll: product.pricePerRoll || '',
        quantity: product.quantity || 0,
        minStock: product.minStock || 4,
      });
      setExistingImages(product.images || []);
      setDeletedImages([]);
    } else {
      setFormData({
        brand: '', artikul: '', collection: '', warehouse: defaultWarehouseId,
        category: 'oboi',
        material: 'vinyl', design: 'geometric', polka: '',
        costPriceUsd: '10', wholesalePriceUsd: '11', pricePerRollUsd: '',
        costPrice: '', wholesalePrice: '', pricePerRoll: '150000',
        quantity: '', minStock: 4,
      });
      setExistingImages([]);
      setDeletedImages([]);
    }
    setImages([]);
  }, [product, isOpen, defaultWarehouseId]);

  /* ── Validation ── */
  const validateForm = useCallback(() => {
    if (!formData.artikul?.trim()) { toast.error("Artikul kiritilishi shart!"); return false; }
    if (!formData.warehouse)       { toast.error("Sklad tanlanishi shart!");    return false; }
    if (!formData.costPriceUsd)    { toast.error("Kelgan narx kiritilishi shart!"); return false; }
    if (!formData.wholesalePriceUsd) { toast.error("Chakana narx kiritilishi shart!"); return false; }
    if (!formData.pricePerRollUsd && !formData.pricePerRoll) { toast.error("Sotuv narxi kiritilishi shart!"); return false; }

    const cost = Number(formData.costPriceUsd) || 0;
    const retail = Number(formData.wholesalePriceUsd) || 0;
    
    if (retail < cost) {
      toast.error("Mantiqiy xato: Chakana narx Kelgan narxdan kam bo'lishi mumkin emas!");
      return false;
    }

    const sale = Number(formData.pricePerRollUsd) || (Number(formData.pricePerRoll) / usdRate) || 0;
    
    if (sale < cost) {
      toast.error("Mantiqiy xato: Sotuv narxi Kelgan narxdan kam bo'lishi mumkin emas!");
      return false;
    }
    if (sale < retail) {
      toast.error("Mantiqiy xato: Sotuv narxi Chakana narxdan kam bo'lishi mumkin emas!");
      return false;
    }

    return true;
  }, [formData]);

  const renderPriceField = (label, usdName, uzsName, currency, setCurrency, required = false) => {
    const isUsd = currency === 'USD';
    const activeName = isUsd ? usdName : uzsName;
    
    // Dynamic on-the-fly conversion based on active input
    const rawVal = formData[activeName];
    let convertedText = '';
    if (rawVal && !isNaN(Number(rawVal))) {
      if (isUsd) {
        const asUzs = Math.round(Number(rawVal) * usdRate);
        convertedText = `≈ ${asUzs.toLocaleString('ru-RU')} so'm`;
      } else {
        const asUsd = (Number(rawVal) / usdRate).toFixed(2);
        convertedText = `≈ ${asUsd} USD`;
      }
    }

    // Determine sublabel based on the db field name to clarify the backwards terminology
    let subLabel = '';
    if (uzsName === 'wholesalePrice') subLabel = "(Optom narxi)";
    if (uzsName === 'pricePerRoll') subLabel = "(Standart narxi)";

    return (
      <div className="flex flex-col">
        <label className={labelClass}>
          {label} {required && '*'} 
          {subLabel && <span className="text-[9px] text-accent font-bold ml-1.5 normal-case tracking-normal">{subLabel}</span>}
        </label>
        <div className="relative flex items-center">
          <input
            type="number"
            step={isUsd ? "0.01" : "1"}
            name={activeName}
            value={formData[activeName] || ''}
            onChange={handlePriceChange}
            className={`${inputClass} pr-24 font-mono`}
            placeholder={isUsd ? "0.00" : "0"}
          />
          <div className="absolute right-1 top-1 bottom-1 flex bg-subtle border border-default rounded-lg overflow-hidden p-0.5 z-10">
            <button
              type="button"
              onClick={() => setCurrency('USD')}
              className={`px-2.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                isUsd
                  ? 'bg-accent text-inverse shadow-xs'
                  : 'text-tertiary hover:text-secondary'
              }`}
            >
              USD
            </button>
            <button
              type="button"
              onClick={() => setCurrency('UZS')}
              className={`px-2.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                !isUsd
                  ? 'bg-accent text-inverse shadow-xs'
                  : 'text-tertiary hover:text-secondary'
              }`}
            >
              UZS
            </button>
          </div>
        </div>
        <div className="h-6 mt-1.5 flex items-center">
          {convertedText && (
            <div className="text-[12px] font-[700] text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-md flex items-center gap-1.5 shadow-sm border border-emerald-100 dark:border-emerald-800/50">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
              {convertedText}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (name === 'category') {
      if (value === 'oboi') {
        setCostPriceCurrency('USD');
        setPricePerRollCurrency('USD');
        setWholesalePriceCurrency('UZS');
      } else {
        setWholesalePriceCurrency('UZS');
      }
    }

    setFormData(prev => {
      let newState = { ...prev, [name]: type === 'checkbox' ? checked : value };
      
      if (name === 'category') {
        if (value === 'oboi') {
          newState.costPriceUsd = '10';
          newState.costPrice = Math.round(10 * usdRate);
          newState.wholesalePriceUsd = '11';
          newState.wholesalePrice = Math.round(11 * usdRate);
          newState.pricePerRollUsd = '';
          newState.pricePerRoll = '150000';
        } else {
          newState.costPriceUsd = '';
          newState.costPrice = '';
          newState.wholesalePriceUsd = '';
          newState.wholesalePrice = '';
          newState.pricePerRollUsd = '';
          newState.pricePerRoll = '';
        }
      }
      return newState;
    });
  };

  const handlePriceChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      if (name === 'costPriceUsd') newData.costPrice = value ? Math.round(Number(value) * usdRate) : '';
      if (name === 'costPrice') newData.costPriceUsd = value ? (Number(value) / usdRate).toFixed(2) : '';
      if (name === 'wholesalePriceUsd') newData.wholesalePrice = value ? Math.round(Number(value) * usdRate) : '';
      if (name === 'wholesalePrice') newData.wholesalePriceUsd = value ? (Number(value) / usdRate).toFixed(2) : '';
      if (name === 'pricePerRollUsd') newData.pricePerRoll = value ? Math.round(Number(value) * usdRate) : '';
      if (name === 'pricePerRoll') newData.pricePerRollUsd = value ? (Number(value) / usdRate).toFixed(2) : '';
      return newData;
    });
  };

  const handleImageChange = (e) => {
    if (e.target.files) {
      const fileArray = Array.from(e.target.files);
      if (images.length + existingImages.length + fileArray.length > 8) {
        toast.error('Maksimal 8 ta rasm yuklanishi mumkin');
        return;
      }
      setImages(prev => [...prev, ...fileArray]);
    }
  };

  const removeNewImage = (index) => setImages(prev => prev.filter((_, i) => i !== index));
  const removeExistingImage = (publicId) => {
    setExistingImages(prev => prev.filter(img => img.publicId !== publicId));
    setDeletedImages(prev => [...prev, publicId]);
  };

  /* ── Submit ── */
  const handleSubmit = async () => {
    if (!validateForm()) return;

    const data = new FormData();
    const payloadData = { ...formData };

    // Set dynamic unit based on category
    if (payloadData.category === 'oboi') payloadData.unit = 'rulon';
    else if (payloadData.category === 'laminat') payloadData.unit = 'kv.m';
    else if (payloadData.category === 'lyustra') payloadData.unit = 'dona';
    else payloadData.unit = 'dona';
    
    // Calculate UZS prices if missing but USD is present
    if (payloadData.costPriceUsd && !payloadData.costPrice) {
      payloadData.costPrice = Math.round(Number(payloadData.costPriceUsd) * usdRate);
    } else if (payloadData.costPrice && !payloadData.costPriceUsd) {
      payloadData.costPriceUsd = (Number(payloadData.costPrice) / usdRate).toFixed(2);
    }

    if (payloadData.pricePerRollUsd && !payloadData.pricePerRoll) {
      payloadData.pricePerRoll = Math.round(Number(payloadData.pricePerRollUsd) * usdRate);
    } else if (payloadData.pricePerRoll && !payloadData.pricePerRollUsd) {
      payloadData.pricePerRollUsd = (Number(payloadData.pricePerRoll) / usdRate).toFixed(2);
    }

    if (payloadData.wholesalePriceUsd && !payloadData.wholesalePrice) {
      payloadData.wholesalePrice = Math.round(Number(payloadData.wholesalePriceUsd) * usdRate);
    } else if (payloadData.wholesalePrice && !payloadData.wholesalePriceUsd) {
      payloadData.wholesalePriceUsd = (Number(payloadData.wholesalePrice) / usdRate).toFixed(2);
    }

    if (payloadData.quantity === '') {
      payloadData.quantity = 0;
    }

    Object.keys(payloadData).forEach(key => data.append(key, payloadData[key]));
    
    if (images.length > 0) {
      setIsCompressing(true);
      try {
        const compressedImages = await Promise.all(images.map(async (file) => {
          try {
            const options = {
              maxSizeMB: 5,
              maxWidthOrHeight: 2500,
              useWebWorker: true,
              fileType: 'image/webp',
              initialQuality: 0.95
            };
            const compressedFile = await imageCompression(file, options);
            return new File([compressedFile], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: "image/webp" });
          } catch (err) {
            console.error("Compression error:", err);
            return file;
          }
        }));
        compressedImages.forEach(img => data.append('images', img));
      } finally {
        setIsCompressing(false);
      }
    }

    if (product) {
      deletedImages.forEach(id => data.append('deletedImages', id));
      updateMutation.mutate({ id: product._id, data }, {
        onSuccess: () => { toast.success("Mahsulot yangilandi!"); onClose(); },
        onError: (err) => toast.error(err.response?.data?.message || "Yangilashda xatolik!"),
      });
    } else {
      createMutation.mutate(data, {
        onSuccess: () => { toast.success("Mahsulot qo'shildi!"); onClose(); },
        onError: (err) => toast.error(err.response?.data?.message || "Qo'shishda xatolik!"),
      });
    }
  };

  const isLoading  = createMutation.isPending || updateMutation.isPending || isCompressing;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in p-0 md:p-4">
      {/* Increased width to 800px for a more spacious grid layout */}
      <div className="bg-overlay border-t md:border border-default rounded-t-2xl md:rounded-2xl w-full md:w-[800px] h-[92dvh] md:h-auto md:max-h-[90dvh] flex flex-col animate-slide-up-bottom md:animate-scale-up overflow-hidden shadow-2xl relative">

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0 absolute top-0 w-full z-10">
          <div className="w-9 h-1 bg-subtle/80 rounded-full" />
        </div>

        {/* ── Header ── */}
        <div className="px-4 sm:px-5 md:px-6 py-3.5 sm:py-4 md:py-5 shrink-0 border-b border-subtle bg-surface sticky top-0 z-10 flex items-center justify-between mt-3 md:mt-0">
          <div>
            <h2 className="text-16 sm:text-18 font-[700] text-primary leading-tight">
              {product ? 'Mahsulotni tahrirlash' : "Yangi mahsulot qo'shish"}
            </h2>
            <p className="text-12 sm:text-13 text-tertiary mt-0.5 sm:mt-1">Barcha ma'lumotlarni bitta oynada to'ldiring</p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded-xl transition-colors shrink-0 bg-app border border-subtle"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 no-scrollbar bg-app">
          <div className="space-y-4 sm:space-y-6 md:space-y-8 max-w-none">

            {/* 1. Asosiy ma'lumotlar */}
            <section className="bg-surface p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-subtle shadow-sm">
              <div className="flex items-center gap-2.5 mb-4 sm:mb-5 border-b border-subtle pb-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
                  <Package className="w-4 h-4" strokeWidth={2} />
                </div>
                <h3 className="text-15 font-[600] text-primary">1. Asosiy ma'lumotlar</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                <div>
                  <label className={labelClass}>Mahsulot Turkumi *</label>
                  <CustomSelect
                    value={formData.category}
                    onChange={(val) => handleChange({ target: { name: 'category', value: val } })}
                    options={[
                      { value: 'oboi', label: 'Oboi (rulon)' },
                      { value: 'lyustra', label: 'Lyustra (dona)' },
                      { value: 'laminat', label: 'Laminat (kv.m)' },
                      { value: 'other', label: 'Boshqa' }
                    ]}
                  />
                </div>
                
                <div className="col-span-1 sm:col-span-1 relative" ref={brandRef}>
                  <label className={labelClass}>Brend nomi</label>
                  <input
                    name="brand"
                    value={formData.brand}
                    onChange={handleChange}
                    onFocus={() => setBrandSearchFocused(true)}
                    className={inputClass}
                    placeholder="Masalan: Oboi Milano Premium"
                    autoComplete="off"
                  />
                  {brandSearchFocused && (() => {
                    const allBrands = Array.from(new Set([...(filterOptions.brands || []), ...customBrands]));
                    const filteredBrands = allBrands.filter(b => b.toLowerCase().includes(formData.brand.toLowerCase()));
                    const exactMatch = allBrands.some(b => b.toLowerCase() === formData.brand.trim().toLowerCase());
                    const showAdd = !exactMatch && formData.brand.trim() !== '';

                    if (filteredBrands.length === 0 && !showAdd) return null;

                    return (
                    <div className="absolute top-[68px] left-0 w-full bg-overlay border border-subtle shadow-2xl rounded-xl z-50 max-h-[240px] overflow-y-auto animate-fade-in no-scrollbar py-2">
                      {filteredBrands.map((brandOption, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              setFormData(prev => ({ ...prev, brand: brandOption }));
                              setBrandSearchFocused(false);
                            }}
                            className="px-4 py-2.5 text-14 text-primary hover:bg-subtle cursor-pointer transition-colors border-b border-subtle last:border-b-0"
                          >
                            {brandOption}
                          </div>
                      ))}
                      {showAdd && (
                        <div 
                          onClick={() => {
                             setCustomBrands(prev => [...prev, formData.brand.trim()]);
                             setBrandSearchFocused(false);
                          }}
                          className={`px-4 py-3 text-13 text-accent font-[600] hover:bg-subtle cursor-pointer transition-colors flex items-center gap-2 ${filteredBrands.length > 0 ? 'border-t border-subtle' : ''}`}
                        >
                          <Plus className="w-4 h-4" strokeWidth={2.5} />
                          "{formData.brand.trim()}" brendini saqlab qo'shish
                        </div>
                      )}
                    </div>
                  )})()}
                </div>

                <div>
                  <label className={labelClass}>Artikul *</label>
                  <input
                    name="artikul"
                    value={formData.artikul}
                    onChange={handleChange}
                    className={`${inputClass} uppercase font-mono tracking-wider`}
                    placeholder="WP-123"
                  />
                </div>

                <div>
                  <label className={labelClass}>Sklad *</label>
                  <CustomSelect
                    value={formData.warehouse}
                    onChange={(val) => handleChange({ target: { name: 'warehouse', value: val } })}
                    disabled={isRestrictedUser}
                    options={[
                      ...(isRestrictedUser ? [] : [{ value: '', label: 'Tanlang...' }]),
                      ...warehouses.map(wh => ({ value: wh._id, label: wh.name }))
                    ]}
                  />
                </div>

                <div>
                  <label className={labelClass}>Polka (javon)</label>
                  <input
                    name="polka"
                    value={formData.polka}
                    onChange={handleChange}
                    className={inputClass}
                    placeholder="Masalan: A-12"
                  />
                </div>
              </div>
            </section>

            {/* 2. Narx va Zaxira */}
            <section className="bg-surface p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-subtle shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5 border-b border-subtle pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <DollarSign className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <h3 className="text-15 font-[600] text-primary">2. Narx va Zaxira</h3>
                </div>
                <span className="text-12 bg-app px-3 py-1.5 rounded-lg border border-subtle text-secondary font-[500] flex items-center gap-2">
                  <span>Kurs:</span>
                  <span className="font-mono text-primary">1 USD = {usdRate.toLocaleString()} so'm</span>
                </span>
              </div>

              <div className="space-y-6">
                <div className={`grid grid-cols-1 ${isRestrictedUser ? 'sm:grid-cols-2' : 'sm:grid-cols-3'} gap-5`}>
                  {!isRestrictedUser && renderPriceField("Kelgan narxi", "costPriceUsd", "costPrice", costPriceCurrency, setCostPriceCurrency, true)}
                  {renderPriceField("Chakana narxi", "wholesalePriceUsd", "wholesalePrice", wholesalePriceCurrency, setWholesalePriceCurrency, true)}
                  {renderPriceField("Sotuv narxi", "pricePerRollUsd", "pricePerRoll", pricePerRollCurrency, setPricePerRollCurrency, true)}
                </div>

                <div className="border-t border-default border-dashed pt-5 mt-2" />

                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="w-4 h-4 text-tertiary" strokeWidth={1.5} />
                    <span className="text-13 font-[600] text-secondary tracking-wide">Zaxira ma'lumotlari</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className={labelClass}>
                        Hozirgi zaxira ({formData.category === 'oboi' ? 'rulon' : formData.category === 'laminat' ? 'kv.m' : formData.category === 'lyustra' ? 'dona' : 'dona'})
                      </label>
                      <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} placeholder="0" className={`${inputClass} font-mono`} />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Min zaxira signali ({formData.category === 'oboi' ? 'rulon' : formData.category === 'laminat' ? 'kv.m' : formData.category === 'lyustra' ? 'dona' : 'dona'})
                      </label>
                      <input type="number" name="minStock" value={formData.minStock} onChange={handleChange} className={`${inputClass} font-mono`} />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. Rasmlar */}
            <section className="bg-surface p-4 sm:p-5 md:p-6 rounded-xl sm:rounded-2xl border border-subtle shadow-sm">
              <div className="flex items-center gap-2.5 mb-4 sm:mb-5 border-b border-subtle pb-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Image className="w-4 h-4" strokeWidth={2} />
                </div>
                <h3 className="text-15 font-[600] text-primary">3. Mahsulot rasmlari</h3>
              </div>

              <div className="space-y-5">
                {/* Upload zone */}
                <label className="block border-2 border-dashed border-default rounded-xl p-8 flex flex-col items-center justify-center bg-app hover:bg-subtle hover:border-strong transition-all cursor-pointer group relative">
                  <input type="file" multiple accept="image/*" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                  <div className="w-12 h-12 bg-subtle border border-default rounded-xl flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-sm">
                    <Upload className="w-5 h-5 text-tertiary" strokeWidth={1.5} />
                  </div>
                  <p className="text-14 font-[600] text-primary">Rasm yuklash uchun bosing</p>
                  <p className="text-12 text-tertiary mt-1">PNG, JPG, WEBP · Maksimal 8 ta rasm</p>
                  <div className="mt-4 px-4 py-1.5 bg-subtle border border-default rounded-full text-12 font-[600] text-secondary">
                    {existingImages.length + images.length} / 8 ta yuklangan
                  </div>
                </label>

                {/* Previews */}
                {(existingImages.length + images.length) > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                    {existingImages.map(img => (
                      <div key={img.publicId} className="relative aspect-square rounded-xl border border-subtle overflow-hidden group shadow-sm bg-app">
                        <img src={img.url} alt="Product" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                          <button type="button" onClick={() => removeExistingImage(img.publicId)}
                            className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-lg cursor-pointer">
                            <Trash2 className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {images.map((file, idx) => (
                      <div key={idx} className="relative aspect-square rounded-xl border-2 border-accent/60 overflow-hidden group shadow-sm bg-app">
                        <img src={URL.createObjectURL(file)} alt="New" className="w-full h-full object-cover" />
                        <div className="absolute top-1.5 right-1.5 bg-accent text-inverse text-[10px] font-[700] px-2 py-0.5 rounded-full leading-tight shadow-sm z-10 backdrop-blur-sm">Yangi</div>
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center z-20">
                          <button type="button" onClick={() => removeNewImage(idx)}
                            className="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100 shadow-lg cursor-pointer">
                            <Trash2 className="w-4 h-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="shrink-0 border-t border-subtle bg-surface px-4 sm:px-5 md:px-6 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pt-5 sm:pb-[calc(1.25rem+env(safe-area-inset-bottom))] md:pb-5 flex items-center justify-end gap-2 sm:gap-3 z-10 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] rounded-b-2xl">
          <button type="button" onClick={onClose}
            className="h-10 px-5 rounded-xl text-14 font-[600] text-secondary bg-app border border-subtle hover:bg-subtle hover:text-primary active:scale-[0.98] transition-all cursor-pointer">
            Bekor qilish
          </button>

          <button type="button" onClick={handleSubmit} disabled={isLoading}
            className="h-10 px-6 rounded-xl text-14 font-[600] text-inverse bg-accent hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50 flex items-center gap-2 cursor-pointer shadow-md shadow-accent/20">
            {isLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-inverse/30 border-t-inverse rounded-full animate-spin" />
                {isCompressing ? 'Rasmlar tayyorlanmoqda...' : 'Saqlanmoqda...'}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4.5 h-4.5" strokeWidth={2.5} />
                Saqlash
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ProductModal;
