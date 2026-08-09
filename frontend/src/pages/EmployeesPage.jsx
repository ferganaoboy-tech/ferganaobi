import React, { useState } from 'react';
import { useUsers, useCreateUser, useUpdateUser, useDeleteUser } from '../hooks/useUsers';
import { useWarehouses } from '../hooks/useWarehouses';
import { useAuth } from '../contexts/AuthContext';
import { Users, Plus, Edit2, Trash2, Shield, X, Building2, Download, Search, Filter } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createPortal } from 'react-dom';
import CustomSelect from '../components/CustomSelect';

const ALL_PERMISSIONS = [
  { id: 'manage_products', label: 'Maxsulotlarni boshqarish' },
  { id: 'manage_orders', label: 'Buyurtmalarni boshqarish' },
  { id: 'manage_customers', label: 'Mijozlarni boshqarish' },
  { id: 'manage_returns', label: 'Vozvrat qilish' },
  { id: 'manage_finances', label: 'Moliya va hisobotlar' }
];

const ROLE_META = {
  superadmin: { label: 'Super Admin', short: 'SA' },
  admin:       { label: 'Admin',       short: 'AD' },
  manager:     { label: 'Menejer',     short: 'MN' },
  cashier:     { label: 'Kassir',      short: 'KS' },
  warehouse:   { label: 'Skladchi',    short: 'SK' },
};

/* ── Role Badge ── */
const RoleBadge = ({ role }) => {
  const meta = ROLE_META[role] || { label: role };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-[600] tracking-wide bg-raised text-secondary border border-default uppercase">
      {meta.label}
    </span>
  );
};

/* ── Avatar ── */
const Avatar = ({ name, role }) => {
  const initials = name
    ? name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  return (
    <div className="w-10 h-10 rounded-lg bg-raised border border-default flex items-center justify-center text-[13px] font-[700] text-secondary tracking-wide shrink-0 select-none">
      {initials}
    </div>
  );
};

/* ── User Modal ── */
const UserModal = ({ isOpen, onClose, user, onSubmit, isSubmitting }) => {
  const { data: whRes } = useWarehouses();
  const warehouses = whRes?.data || [];

  const [formData, setFormData] = useState({
    name: user?.name || '',
    username: user?.username || '',
    password: '',
    pin: user?.pin || '',
    role: user?.role || 'cashier',
    warehouse: user?.warehouse?._id || user?.warehouse || '',
    permissions: user?.permissions || []
  });

  const handleChange = (e) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const handlePermissionToggle = (permId) =>
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permId)
        ? prev.permissions.filter(p => p !== permId)
        : [...prev.permissions, permId]
    }));

  const handleSubmit = (e) => { e.preventDefault(); onSubmit(formData); };

  if (!isOpen) return null;

  const inputClass = "w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl px-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] outline-none transition-all duration-200 shadow-sm";
  const labelClass = 'block text-[11px] font-[600] text-secondary uppercase tracking-[0.05em] mb-1.5';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-overlay border-t md:border border-default rounded-t-[24px] md:rounded-[20px] shadow-2xl w-full md:w-[500px] h-[82vh] md:h-auto md:max-h-[85vh] flex flex-col overflow-hidden animate-slide-up-bottom md:animate-scale-up">

        {/* drag handle */}
        <div className="flex justify-center pt-2.5 pb-1 md:hidden shrink-0">
          <div className="w-8 h-1 bg-raised rounded-full" />
        </div>

        {/* header */}
        <div className="h-13 px-5 border-b border-subtle flex items-center justify-between shrink-0">
          <span className="text-[14px] font-[600] text-primary">
            {user ? 'Xodimni tahrirlash' : 'Yangi xodim'}
          </span>
          <button type="button" onClick={onClose}
            className="w-7 h-7 flex items-center justify-center text-tertiary hover:text-primary hover:bg-subtle rounded-md transition-colors">
            <X className="w-[15px] h-[15px]" strokeWidth={1.8} />
          </button>
        </div>

        {/* body */}
        <form id="user-form" onSubmit={handleSubmit} autoComplete="off"
          className="p-5 space-y-4 flex-1 overflow-y-auto no-scrollbar">

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelClass}>Ism-sharif *</label>
              <input type="text" name="name" required value={formData.name}
                onChange={handleChange} className={inputClass} placeholder="Alisher Odilov" />
            </div>
            <div>
              <label className={labelClass}>Login *</label>
              <input type="text" name="username" required value={formData.username}
                onChange={handleChange} className={inputClass} placeholder="alisher01"
                autoComplete="off" />
            </div>
            <div>
              <label className={labelClass}>Parol {user ? '(o\'zgartirish)' : '*'}</label>
              <input type="password" name="password" required={!user} minLength={3}
                value={formData.password} onChange={handleChange}
                className={inputClass} placeholder="••••••••"
                autoComplete="new-password" />
            </div>
            <div>
              <label className={labelClass}>Terminal PIN {user ? '(o\'z)' : '*'}</label>
              <div className="relative">
                <input type="text" name="pin" required={!user} minLength={4} maxLength={4}
                  value={formData.pin} onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({...formData, pin: val});
                  }}
                  className={`${inputClass} font-mono tracking-widest text-[16px] pr-20`} placeholder="1234"
                  autoComplete="off" />
                <button type="button" onClick={() => setFormData({...formData, pin: Math.floor(1000 + Math.random() * 9000).toString()})}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-subtle hover:bg-default rounded-lg text-[11px] font-[600] text-primary transition-all active:scale-95">
                  GEN
                </button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Lavozim *</label>
              <CustomSelect
                value={formData.role}
                onChange={(val) => handleChange({ target: { name: 'role', value: val } })}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'manager', label: 'Menejer' },
                  { value: 'cashier', label: 'Kassir' },
                  { value: 'warehouse', label: 'Skladchi' }
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Sklad</label>
              <CustomSelect
                value={formData.warehouse}
                onChange={(val) => handleChange({ target: { name: 'warehouse', value: val } })}
                disabled={formData.role === 'admin' || formData.role === 'superadmin'}
                options={[
                  { value: '', label: 'Tanlanmagan' },
                  ...warehouses.map(w => ({ value: w._id, label: w.name }))
                ]}
              />
            </div>
          </div>

          {/* permissions */}
          <div>
            <label className={`${labelClass} flex items-center gap-1.5 mb-3`}>
              <Shield className="w-3 h-3" /> Qo'shimcha huquqlar
            </label>
            <div className="space-y-2">
              {ALL_PERMISSIONS.map(perm => (
                <label key={perm.id}
                  className="flex items-center gap-3 px-4 py-3 rounded-[12px] border border-subtle bg-surface hover:bg-raised cursor-pointer transition-all duration-200">
                  <input type="checkbox"
                    checked={formData.permissions.includes(perm.id)}
                    onChange={() => handlePermissionToggle(perm.id)}
                    className="w-[18px] h-[18px] rounded-md border-default bg-surface cursor-pointer accent-accent" />
                  <span className="text-[13.5px] font-[500] text-primary">{perm.label}</span>
                </label>
              ))}
            </div>
          </div>
        </form>

        {/* footer */}
        <div className="min-h-[64px] pb-safe px-6 border-t border-subtle flex items-center justify-end gap-3 shrink-0">
          <button type="button" onClick={onClose}
            className="h-[40px] px-5 rounded-[10px] text-[13.5px] font-[500] text-secondary border border-default hover:bg-subtle transition-colors cursor-pointer">
            Bekor
          </button>
          <button type="submit" form="user-form" disabled={isSubmitting}
            className="h-[40px] px-6 rounded-[10px] text-[13.5px] font-[600] text-inverse bg-accent hover:bg-accent-hover transition-all disabled:opacity-40 cursor-pointer flex items-center gap-2 active:scale-95">
            {isSubmitting
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /><span>Saqlanmoqda...</span></>
              : 'Saqlash'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/* ── Skeleton ── */
const SkeletonCard = () => (
  <div className="bg-surface border border-subtle rounded-xl p-4 animate-pulse">
    <div className="flex items-center gap-3 mb-5">
      <div className="w-10 h-10 rounded-lg bg-raised" />
      <div className="space-y-2 flex-1">
        <div className="h-3.5 w-28 bg-raised rounded" />
        <div className="h-3 w-16 bg-raised rounded" />
      </div>
    </div>
    <div className="border-t border-subtle/50 pt-4 space-y-2.5">
      <div className="h-3 w-20 bg-raised rounded" />
      <div className="flex gap-1.5">
        <div className="h-5 w-16 bg-raised rounded" />
        <div className="h-5 w-20 bg-raised rounded" />
      </div>
    </div>
  </div>
);

/* ── Main Page ── */
const EmployeesPage = () => {
  const { user: currentUser } = useAuth();

  if (currentUser && !['superadmin', 'admin'].includes(currentUser.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: usersRes, isLoading } = useUsers();
  const { data: whRes } = useWarehouses();
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [modalState, setModalState] = useState({ isOpen: false, user: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('all');

  const users = usersRes?.data || [];
  const warehouses = whRes?.data || [];

  const filteredUsers = users.filter(u => {
    const matchesSearch = !searchQuery || 
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesWh = filterWarehouse === 'all' || (u.warehouse?._id === filterWarehouse);
    return matchesSearch && matchesWh;
  });

  const handleOpenModal  = (user = null) => setModalState({ isOpen: true, user });
  const handleCloseModal = ()            => setModalState({ isOpen: false, user: null });

  const handleSubmit = (data) => {
    if (modalState.user) {
      updateMutation.mutate({ id: modalState.user._id, data }, { onSuccess: handleCloseModal });
    } else {
      createMutation.mutate(data, { onSuccess: handleCloseModal });
    }
  };

  const handleDelete = (id, name) => {
    if (window.confirm(`${name} ismli xodimni o'chirishni tasdiqlaysizmi?`))
      deleteMutation.mutate(id);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Xodimlar tizimga kirish ma'lumotlari", 14, 20);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Maxfiy hujjat! Faqat o'z egasiga berilishi shart.", 14, 28);
    
    // Tumanlar bo'yicha guruhlash
    const grouped = {};
    users.forEach(u => {
      const whName = u.warehouse?.name || 'Tuman belgilanmagan (Bosh ofis)';
      if (!grouped[whName]) grouped[whName] = [];
      grouped[whName].push(u);
    });
    
    let currentY = 35;
    
    Object.keys(grouped).sort().forEach((whName, index) => {
      const whUsers = grouped[whName];
      
      // Agar sahifaning oxiriga kelib qolsa, yangi sahifa ochamiz (header sig'ishi uchun)
      if (currentY > 260) {
        doc.addPage();
        currentY = 20;
      }
      
      // Tuman nomi (Header)
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.setTextColor(37, 99, 235); // Accent rang
      doc.text(whName, 14, currentY + 5);
      
      const tableData = whUsers.map(u => [
        u.name,
        ROLE_META[u.role]?.label || u.role,
        u.username,
        u.pin || 'Kiritilmagan'
      ]);
      
      autoTable(doc, {
        startY: currentY + 10,
        head: [['Ism-sharif', 'Lavozimi', 'Login (username)', 'Terminal PIN']],
        body: tableData,
        theme: 'grid',
        headStyles: { fillColor: [243, 244, 246], textColor: [31, 41, 55], fontStyle: 'bold' },
        styles: { font: 'helvetica', fontSize: 10, cellPadding: 4, textColor: [31, 41, 55] },
        columnStyles: {
          3: { fontStyle: 'bold', textColor: [220, 38, 38] }
        },
        margin: { top: 15 }
      });
      
      currentY = doc.lastAutoTable.finalY + 10;
    });
    
    doc.save('Xodimlar_Login_Parollari.pdf');
  };

  return (
    <>
      <div className="flex flex-col h-full bg-app overflow-y-auto no-scrollbar">
        <div className="p-2 sm:p-[28px_36px] max-w-[1400px] mx-auto w-full">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
            <div>
              <h1 className="text-[22px] font-[700] tracking-tight text-primary">
                Xodimlar
              </h1>
              <p className="text-[13px] text-secondary mt-0.5">
                {users.length} ta xodim tizimda ro'yxatdan o'tgan
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportPDF}
                className="h-9 px-3 sm:px-4 bg-surface hover:bg-raised text-primary border border-default rounded-lg text-[13px] font-[600] flex items-center gap-2 transition-colors shrink-0 shadow-sm"
                title="Xodimlar parollarini PDF da yuklash"
              >
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">PDF Yuklash</span>
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="h-9 px-3 sm:px-4 bg-accent hover:bg-accent-hover text-inverse rounded-lg text-[13px] font-[600] flex items-center gap-2 transition-colors shrink-0">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Xodim qo'shish</span>
                <span className="sm:hidden">Qo'shish</span>
              </button>
            </div>
          </div>

          {/* ── Filters ── */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center shrink-0 w-full relative z-20 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
              <input
                type="text"
                placeholder="Ism yoki login bo'yicha qidirish..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full h-[40px] pl-9 pr-4 bg-surface border border-subtle hover:border-default focus:border-focus focus:shadow-[0_0_0_3px_var(--bg-subtle)] rounded-xl text-[13.5px] text-primary outline-none transition-all placeholder:text-disabled"
              />
            </div>
            <div className="relative sm:w-[240px] shrink-0">
              <CustomSelect
                value={filterWarehouse || 'all'}
                onChange={(val) => setFilterWarehouse(val)}
                options={[
                  { value: 'all', label: 'Barcha tumanlar' },
                  ...warehouses.map(w => ({ value: w._id, label: w.name }))
                ]}
              />
            </div>
          </div>

          {/* ── Grid ── */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 border border-dashed border-default rounded-xl text-center">
              <div className="w-12 h-12 bg-raised border border-default rounded-xl flex items-center justify-center mb-4">
                <Users className="w-5 h-5 text-tertiary" />
              </div>
              <p className="text-[14px] font-[600] text-primary mb-1">Xodimlar topilmadi</p>
              <p className="text-[13px] text-tertiary mb-5">
                {searchQuery || filterWarehouse !== 'all' 
                  ? 'Qidiruv bo\'yicha hech narsa topilmadi' 
                  : 'Birinchi xodimni qo\'shish uchun tugmani bosing'}
              </p>
              <button onClick={() => handleOpenModal()}
                className="h-8 px-4 border border-default rounded-lg text-[13px] font-[500] text-secondary hover:text-primary hover:border-default transition-colors">
                Xodim qo'shish
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredUsers.map(u => (
                <div key={u._id}
                  className="group bg-surface border border-subtle hover:border-default rounded-xl p-4 transition-all duration-200 flex flex-col">

                  {/* top: avatar + name + actions */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar name={u.name} role={u.role} />
                      <div className="min-w-0">
                        <p className="text-[14px] font-[600] text-primary truncate leading-tight">
                          {u.name}
                        </p>
                        <p className="text-[12px] text-tertiary mt-0.5 truncate">
                          @{u.username}
                        </p>
                      </div>
                    </div>

                    {/* action buttons — always visible on mobile, hover on desktop */}
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 ml-2">
                      <button onClick={() => handleOpenModal(u)}
                        className="w-7 h-7 flex items-center justify-center text-tertiary hover:text-primary hover:bg-raised rounded-md transition-colors"
                        title="Tahrirlash">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {u.role !== 'superadmin' && (
                        <button onClick={() => handleDelete(u._id, u.name)}
                          className="w-7 h-7 flex items-center justify-center text-tertiary hover:text-state-danger-text hover:bg-state-danger-bg/50 rounded-md transition-colors"
                          title="O'chirish">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* bottom: meta */}
                  <div className="mt-auto pt-4 border-t border-subtle/60 space-y-2.5">

                    {/* role row */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-[500] text-tertiary uppercase tracking-[0.05em]">
                        Lavozim
                      </span>
                      <RoleBadge role={u.role} />
                    </div>

                    {/* warehouse row */}
                    {u.warehouse && (
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-[500] text-tertiary uppercase tracking-[0.05em]">
                          Sklad
                        </span>
                        <span className="text-[12px] font-[500] text-primary flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-tertiary" />
                          {u.warehouse?.name || '—'}
                        </span>
                      </div>
                    )}

                    {/* permissions */}
                    {u.permissions?.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {u.permissions.slice(0, 3).map(p => (
                          <span key={p}
                            className="text-[10px] font-[500] px-2 py-0.5 rounded bg-raised text-tertiary border border-subtle">
                            {ALL_PERMISSIONS.find(ap => ap.id === p)?.label.split(' ')[0]}
                          </span>
                        ))}
                        {u.permissions.length > 3 && (
                          <span className="text-[10px] font-[500] px-2 py-0.5 rounded bg-raised text-tertiary border border-subtle">
                            +{u.permissions.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {modalState.isOpen && (
        <UserModal
          isOpen
          onClose={handleCloseModal}
          user={modalState.user}
          onSubmit={handleSubmit}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </>
  );
};

export default EmployeesPage;
