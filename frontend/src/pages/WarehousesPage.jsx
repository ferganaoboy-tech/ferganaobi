import React, { useState } from 'react';
import { Layers, Hash, Tag, AlertTriangle, Building2, X, Search, Package, Plus, Edit2, Trash2, MapPin, Send, Banknote, TrendingUp } from 'lucide-react';
import { useWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse } from '../hooks/useWarehouses';
import { useProducts } from '../hooks/useProducts';
import { formatUZS, formatShort } from '../utils/format';
import toast from 'react-hot-toast';
import ConfirmModal from '../components/ConfirmModal';

/* ─────────────────────────────────────
   Reusable Bottom-Sheet Modal wrapper
───────────────────────────────────── */
const WarehouseModal = ({ isOpen, onClose, title, icon: Icon, children }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative bg-overlay border-t md:border border-default rounded-t-2xl md:rounded-lg w-full md:w-[480px] flex flex-col animate-slide-up-bottom md:animate-scale-up overflow-hidden shadow-2xl pb-safe">
        {/* Mobile drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0">
          <div className="w-9 h-1 bg-subtle/80 rounded-full" />
        </div>

        {/* Header */}
        <div className="h-14 px-5 sm:px-6 border-b border-subtle flex items-center justify-between shrink-0 bg-surface">
          <h2 className="text-15 font-[600] text-primary flex items-center gap-2">
            {Icon && <Icon className="w-[18px] h-[18px] text-accent" strokeWidth={1.5} />}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors cursor-pointer"
          >
            <X className="w-[16px] h-[16px]" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
};

/* ─────────────────────────────────────
   Shared form field styles
───────────────────────────────────── */
const inputClass = "w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm";
const labelClass = "block text-11 font-[600] text-secondary mb-1.5 uppercase tracking-[0.05em]";

/* ─────────────────────────────────────
   Main Page Component
───────────────────────────────────── */
const WarehousesPage = () => {
  const { data: whRes, isLoading } = useWarehouses();
  const createWarehouseMutation = useCreateWarehouse();
  const updateWarehouseMutation = useUpdateWarehouse();
  const deleteWarehouseMutation = useDeleteWarehouse();
  const warehouses = whRes?.data || [];

  const [selectedWarehouse, setSelectedWarehouse] = useState(null);
  const [confirmDeleteWarehouse, setConfirmDeleteWarehouse] = useState(null);

  const getRandomColor = () => '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  
  // Add Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [color, setColor] = useState(getRandomColor());
  const [telegramChatId, setTelegramChatId] = useState('');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [editTelegramChatId, setEditTelegramChatId] = useState('');

  const handleCreateWarehouse = async (e) => {
    e.preventDefault();
    if (!name.trim() || !location.trim()) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    try {
      await createWarehouseMutation.mutateAsync({
        name,
        location,
        color,
        telegramChatId: telegramChatId.trim() || null
      });
      toast.success("Yangi sklad muvaffaqiyatli qo'shildi!");
      setName('');
      setLocation('');
      setColor('#3b82f6');
      setTelegramChatId('');
      setIsAddModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || "Sklad qo'shishda xatolik yuz berdi");
    }
  };

  const handleUpdateWarehouse = async (e) => {
    e.preventDefault();
    if (!editName.trim() || !editLocation.trim()) {
      toast.error("Barcha maydonlarni to'ldiring");
      return;
    }
    try {
      await updateWarehouseMutation.mutateAsync({
        id: editId,
        data: {
          name: editName,
          location: editLocation,
          color: editColor,
          telegramChatId: editTelegramChatId.trim() || null
        }
      });
      toast.success('Sklad muvaffaqiyatli tahrirlandi!');
      if (selectedWarehouse?._id === editId) {
        setSelectedWarehouse({
          ...selectedWarehouse,
          name: editName,
          location: editLocation,
          color: editColor,
          telegramChatId: editTelegramChatId.trim() || null
        });
      }
      setIsEditModalOpen(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Skladni tahrirlashda xatolik yuz berdi');
    }
  };

  const handleDeleteWarehouse = (warehouse) => {
    if (warehouse.stats?.totalProducts > 0) {
      toast.error("Skladda mahsulotlar borligi sababli uni o'chirib bo'lmaydi!");
      return;
    }
    setConfirmDeleteWarehouse(warehouse);
  };

  const confirmWarehouseDelete = async () => {
    if (!confirmDeleteWarehouse) return;
    try {
      await deleteWarehouseMutation.mutateAsync(confirmDeleteWarehouse._id);
      toast.success("Sklad muvaffaqiyatli o'chirildi!");
      setSelectedWarehouse(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Skladni o'chirishda xatolik yuz berdi");
    }
  };

  const openEditModal = (warehouse) => {
    setEditId(warehouse._id);
    setEditName(warehouse.name);
    setEditLocation(warehouse.location || '');
    setEditColor(warehouse.color || '#3b82f6');
    setEditTelegramChatId(warehouse.telegramChatId || '');
    setIsEditModalOpen(true);
  };

  if (isLoading) {
    return (
      <div className="p-2 sm:p-[32px_40px] h-full flex flex-col gap-4">
        <div className="w-[300px] h-[40px] animate-shimmer mb-8 rounded-md" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-[200px] w-full animate-shimmer rounded-md" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full relative overflow-hidden">

      {/* ── Main Content ── */}
      <div className={`p-2 sm:p-[32px_40px] flex-1 flex flex-col h-full overflow-y-auto no-scrollbar transition-all duration-200 ease-out ${selectedWarehouse ? 'lg:pr-[400px]' : ''}`}>

        {/* Page Header */}
        <div className="flex items-center justify-between mb-6 sm:mb-8 shrink-0 gap-3">
          <div className="min-w-0">
            <h1 className="text-28 font-[600] tracking-[-0.03em] text-primary">Skladlar</h1>
            <p className="text-13 sm:text-14 text-secondary mt-1">Skladlardagi joriy holat va zaxiralar.</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="h-9 px-3 sm:px-4 bg-accent hover:bg-accent-hover text-inverse rounded-md text-13 font-[500] transition-all active:scale-[0.98] flex items-center gap-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Yangi Sklad</span>
            <span className="sm:hidden">Yangi</span>
          </button>
        </div>

        {/* Warehouse Cards Grid */}
        {warehouses.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <Building2 className="w-10 h-10 text-tertiary mb-3" strokeWidth={1.2} />
            <h3 className="text-15 font-[500] text-secondary">Hech qanday sklad yo'q</h3>
            <p className="text-13 text-tertiary mt-1">Birinchi skladni qo'shing.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 pb-8">
            {warehouses.map(warehouse => (
              <div
                key={warehouse._id}
                onClick={() => setSelectedWarehouse(warehouse)}
                className={`bg-surface border rounded-lg flex flex-col overflow-hidden cursor-pointer transition-all duration-200 hover:shadow-sm ${
                  selectedWarehouse?._id === warehouse._id
                    ? 'border-strong shadow-[0_0_0_2px_color-mix(in_srgb,var(--text-primary)_15%,transparent)]'
                    : 'border-subtle hover:border-default'
                }`}
              >
                {/* Card Header */}
                <div className="p-4 sm:p-5 border-b border-subtle flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-full border border-subtle flex items-center justify-center bg-subtle shrink-0">
                      <Building2 className="w-[16px] h-[16px]" style={{ color: warehouse.color }} strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-14 font-[600] text-primary truncate">{warehouse.name}</h3>
                      <p className="text-11 text-tertiary mt-0.5 truncate">{warehouse.location || 'Manzil kiritilmagan'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => openEditModal(warehouse)}
                      className="w-7 h-7 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors"
                      title="Tahrirlash"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteWarehouse(warehouse)}
                      className="w-7 h-7 flex items-center justify-center text-secondary hover:text-state-danger-text hover:bg-state-danger-bg rounded transition-colors"
                      title="O'chirish"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Card Stats */}
                <div className="p-4 sm:p-5 flex-1 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-13 text-secondary">
                      <Layers className="w-[14px] h-[14px] text-tertiary" strokeWidth={1.5} />
                      Mahsulot turlari
                    </div>
                    <div className="text-13 font-[600] text-primary font-mono">{warehouse.stats?.totalProducts || 0}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-13 text-secondary">
                      <Hash className="w-[14px] h-[14px] text-tertiary" strokeWidth={1.5} />
                      Jami rulon
                    </div>
                    <div className="text-13 font-[600] text-primary font-mono">{formatShort(warehouse.stats?.totalRolls || 0)}</div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-13 text-secondary">
                      <Tag className="w-[14px] h-[14px] text-tertiary" strokeWidth={1.5} />
                      Inventar qiymati
                    </div>
                    <div className="text-13 font-[600] text-primary font-mono">{formatShort(warehouse.stats?.totalValue || 0)} so'm</div>
                  </div>

                  {warehouse.stats?.lowStockCount > 0 && (
                    <div className="pt-3 border-t border-subtle flex items-start gap-2">
                      <AlertTriangle className="w-[14px] h-[14px] text-state-warning-text mt-0.5 shrink-0" strokeWidth={1.5} />
                      <div className="text-12 text-state-warning-text">
                        <span className="font-[500]">{warehouse.stats.lowStockCount} ta mahsulot</span> zaxirasi tugamoqda
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Side Panel ── */}
      <div
        className={`absolute top-0 right-0 h-full w-full sm:w-[400px] bg-surface border-l border-subtle shadow-[-4px_0_24px_rgba(0,0,0,0.04)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col z-30 ${selectedWarehouse ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedWarehouse && (
          <WarehouseSidePanel
            warehouse={selectedWarehouse}
            onClose={() => setSelectedWarehouse(null)}
            onEdit={() => openEditModal(selectedWarehouse)}
            onDelete={() => handleDeleteWarehouse(selectedWarehouse)}
          />
        )}
      </div>

      {/* ── Add Warehouse Modal (Bottom Sheet) ── */}
      <WarehouseModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Yangi Sklad Qo'shish"
        icon={Building2}
      >
        <form onSubmit={handleCreateWarehouse} className="space-y-4">
          <div>
            <label className={labelClass}>Sklad Nomi</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Masalan: Shimoliy filial"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Manzil</label>
            <input
              type="text"
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Masalan: Toshkent sh., Yunusobod"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Telegram Kanal / Guruh ID</label>
            <input
              type="text"
              value={telegramChatId}
              onChange={e => setTelegramChatId(e.target.value)}
              placeholder="Masalan: -1001234567890"
              className={inputClass}
            />
            <p className="text-11 text-tertiary mt-1.5 flex items-start gap-1">
              <Send className="w-3 h-3 mt-0.5 shrink-0 text-[#0088cc]" />
              Bu sklad operatsiyalari ushbu Telegram guruhga ham yuboriladi. Bo'sh qoldirsangiz, faqat global obunachilarga ketadi.
            </p>
          </div>

          <div>
            <label className={labelClass}>Rang (Sklad belgisi uchun)</label>
            <div className="flex items-center gap-3 mt-1">
              <label className="relative cursor-pointer group">
                <div
                  className="w-10 h-10 rounded-lg border-2 border-subtle shadow-sm transition-transform group-hover:scale-105"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
              <div className="flex-1">
                <div className="text-13 font-[500] text-primary uppercase font-mono">{color}</div>
                <div className="text-11 text-tertiary mt-0.5">Rangni bosib o'zgartiring</div>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2.5 border-t border-subtle">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="h-9 px-4 rounded-md text-13 font-[500] text-primary border border-default hover:bg-subtle active:scale-95 transition-all cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={createWarehouseMutation.isPending}
              className="h-9 px-4 rounded-md text-13 font-[500] text-inverse bg-accent hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {createWarehouseMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </WarehouseModal>

      {/* ── Edit Warehouse Modal (Bottom Sheet) ── */}
      <WarehouseModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Skladni Tahrirlash"
        icon={Building2}
      >
        <form onSubmit={handleUpdateWarehouse} className="space-y-4">
          <div>
            <label className={labelClass}>Sklad Nomi</label>
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Masalan: Shimoliy filial"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Manzil</label>
            <input
              type="text"
              value={editLocation}
              onChange={e => setEditLocation(e.target.value)}
              placeholder="Masalan: Toshkent sh., Yunusobod"
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className={labelClass}>Telegram Kanal / Guruh ID</label>
            <input
              type="text"
              value={editTelegramChatId}
              onChange={e => setEditTelegramChatId(e.target.value)}
              placeholder="Masalan: -1001234567890"
              className={inputClass}
            />
            <p className="text-11 text-tertiary mt-1.5 flex items-start gap-1">
              <Send className="w-3 h-3 mt-0.5 shrink-0 text-[#0088cc]" />
              Bu sklad operatsiyalari ushbu Telegram guruhga ham yuboriladi. Bo'sh qoldirsangiz, faqat global obunachilarga ketadi.
            </p>
          </div>

          <div>
            <label className={labelClass}>Rang</label>
            <div className="flex items-center gap-3 mt-1">
              <label className="relative cursor-pointer group">
                <div
                  className="w-10 h-10 rounded-lg border-2 border-subtle shadow-sm transition-transform group-hover:scale-105"
                  style={{ backgroundColor: editColor }}
                />
                <input
                  type="color"
                  value={editColor}
                  onChange={e => setEditColor(e.target.value)}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
              <div className="flex-1">
                <div className="text-13 font-[500] text-primary uppercase font-mono">{editColor}</div>
                <div className="text-11 text-tertiary mt-0.5">Rangni bosib o'zgartiring</div>
              </div>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2.5 border-t border-subtle">
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="h-9 px-4 rounded-md text-13 font-[500] text-primary border border-default hover:bg-subtle active:scale-95 transition-all cursor-pointer"
            >
              Bekor qilish
            </button>
            <button
              type="submit"
              disabled={updateWarehouseMutation.isPending}
              className="h-9 px-4 rounded-md text-13 font-[500] text-inverse bg-accent hover:bg-accent-hover active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {updateWarehouseMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
            </button>
          </div>
        </form>
      </WarehouseModal>

      {/* ── Confirm Delete Modal ── */}
      <ConfirmModal
        isOpen={!!confirmDeleteWarehouse}
        onClose={() => setConfirmDeleteWarehouse(null)}
        onConfirm={confirmWarehouseDelete}
        title="Skladni o'chirish"
        message={`Haqiqatan ham "${confirmDeleteWarehouse?.name}" skladini o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi.`}
        confirmText="O'chirish"
        cancelText="Bekor qilish"
        isDanger={true}
      />
    </div>
  );
};

/* ─────────────────────────────────────
   Side Panel Sub-component
───────────────────────────────────── */
const WarehouseSidePanel = ({ warehouse, onClose, onEdit, onDelete }) => {
  const [search, setSearch] = useState('');
  const { data: prodRes, isLoading } = useProducts({ warehouse: warehouse._id, search });
  const products = prodRes?.data || [];

  return (
    <>
      {/* Panel Header */}
      <div className="h-14 px-5 border-b border-subtle flex items-center justify-between shrink-0 bg-surface">
        <div className="flex items-center gap-2.5 min-w-0 pr-2">
          <div
            className="w-7 h-7 rounded-full border border-subtle flex items-center justify-center shrink-0"
            style={{ backgroundColor: `${warehouse.color}20` }}
          >
            <Building2 className="w-[14px] h-[14px]" style={{ color: warehouse.color }} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="text-14 font-[600] text-primary truncate">{warehouse.name}</div>
            {warehouse.location && (
              <div className="text-11 text-tertiary flex items-center gap-1 truncate">
                <MapPin className="w-2.5 h-2.5 shrink-0" />
                {warehouse.location}
              </div>
            )}
            {warehouse.telegramChatId && (
              <div className="text-11 text-[#0088cc] flex items-center gap-1 truncate mt-0.5">
                <Send className="w-2.5 h-2.5 shrink-0" />
                Telegram kanal ulangan
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={onEdit}
            className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors"
            title="Tahrirlash"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            className="w-8 h-8 flex items-center justify-center text-secondary hover:text-state-danger-text hover:bg-state-danger-bg rounded transition-colors"
            title="O'chirish"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors"
            title="Yopish"
          >
            <X className="w-[16px] h-[16px]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="p-4 sm:p-5 border-b border-subtle bg-surface shrink-0">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="p-3 bg-app border border-subtle rounded-md">
            <div className="text-11 text-secondary uppercase font-[500] tracking-[0.05em] mb-1">Jami Turlar</div>
            <div className="text-18 font-[700] text-primary font-mono">{warehouse.stats?.totalProducts || 0}</div>
          </div>
          <div className="p-3 bg-app border border-subtle rounded-md">
            <div className="text-11 text-secondary uppercase font-[500] tracking-[0.05em] mb-1">Jami Rulon</div>
            <div className="text-18 font-[700] text-primary font-mono">{formatShort(warehouse.stats?.totalRolls || 0)}</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-[13px] h-[13px] text-tertiary absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Mahsulot qidirish..."
            className="w-full h-9 bg-app border border-default rounded-md pl-8 pr-3 text-13 text-primary focus:border-strong outline-none placeholder:text-tertiary transition-colors"
          />
        </div>
      </div>

      {/* Products List */}
      <div className="flex-1 overflow-y-auto p-4 bg-app no-scrollbar">
        <h4 className="text-11 font-[600] text-secondary mb-3 uppercase tracking-[0.05em]">Skladdagi mahsulotlar</h4>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-[56px] animate-shimmer rounded-md" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center">
            <Package className="w-[22px] h-[22px] text-tertiary mb-2" strokeWidth={1.5} />
            <p className="text-13 text-tertiary">Mahsulot topilmadi</p>
          </div>
        ) : (
          <div className="space-y-2">
            {products.map(product => (
              <div key={product._id} className="bg-surface border border-subtle rounded-md p-3 flex items-center justify-between hover:border-default transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded border border-subtle bg-app overflow-hidden shrink-0 flex items-center justify-center">
                    {product.images?.[0] ? (
                      <img src={product.images[0].url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="w-[14px] h-[14px] text-tertiary" strokeWidth={1.5} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-13 font-[500] text-primary truncate" title={product.brand || product.artikul}>{product.brand || product.artikul}</div>
                    <div className="text-11 text-tertiary font-mono">{product.artikul}</div>
                  </div>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <div className={`text-13 font-[600] font-mono ${product.quantity <= product.minStock ? 'text-state-warning-text' : 'text-primary'}`}>
                    {product.quantity} rl
                  </div>
                  <div className="text-11 text-secondary font-mono">{formatUZS(product.pricePerRoll || product.wholesalePrice)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default WarehousesPage;
