import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutGrid,
  Layers,
  Grid3X3,
  FileText,
  Contact,
  Scale,
  Sun,
  Moon,
  Sparkles,
  Settings,
  X,
  History,
  BrainCircuit,
  Users,
  ShoppingBag,
  Package,
  RefreshCcw,
  LogOut,
  BarChart2
} from "lucide-react";
import { useDebtors } from "../hooks/useCustomers";
import { useAuth } from "../contexts/AuthContext";
import { useCurrentShift } from "../hooks/useShifts";
import { useShiftEnabled } from "../hooks/useSettings";
import { useCart } from "../contexts/CartContext";
import ShiftModal from "./ShiftModal";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import api from "../api";

const Sidebar = ({ isOpen, onClose }) => {
  const { data: debtorsRes } = useDebtors();
  const debtorsCount = debtorsRes?.data?.length || 0;

  const { user, logout } = useAuth();
  const { shiftEnabled } = useShiftEnabled();
  // Shift query faqat shiftEnabled bo'lsa yuboriladi
  const { data: shiftRes } = useCurrentShift({ enabled: shiftEnabled });
  const currentShift = shiftEnabled ? shiftRes?.data : null;
  const { totalCount, setCartOpen } = useCart();

  const [isShiftModalOpen, setIsShiftModalOpen] = React.useState(false);

  const { data: transfersCountRes } = useQuery({
    queryKey: ['transfers-count'],
    queryFn: async () => {
      const res = await api.get('/transfers/pending-count');
      return res.data;
    },
    enabled: !!user,
  });
  const pendingTransfersCount = transfersCountRes?.count || 0;

  const handleLogout = () => {
    logout();
    toast.success("Tizimdan chiqdingiz");
  };

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    if (isDark) {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("oboi-crm-theme", "light");
    } else {
      document.documentElement.classList.add("dark");
      localStorage.setItem("oboi-crm-theme", "dark");
    }
  };

  const navGroups = [
    {
      label: "WORKSPACE",
      items: [
        { to: "/dashboard", icon: LayoutGrid, label: "Dashboard", restrictedTo: ['superadmin', 'admin'] },
        { to: "/warehouses", icon: Layers, label: "Skladlar", restrictedTo: ['superadmin', 'admin', 'manager'] },
        { to: "/products", icon: Grid3X3, label: "Mahsulotlar" },
        { to: "/replenishment", icon: RefreshCcw, label: "Ta'minot" },
        { icon: ShoppingBag, label: "Savat", isCart: true, badge: totalCount > 0 ? totalCount : null },
      ],
    },
    {
      label: "MANAGEMENT",
      items: [
        { to: "/orders", icon: FileText, label: "Buyurtmalar" },
        { to: "/customers", icon: Contact, label: "Mijozlar" },
        { 
          to: "/transfers", 
          icon: Package, 
          label: "O'tkazmalar",
          badge: pendingTransfersCount > 0 ? pendingTransfersCount : null
        },
        {
          to: "/debts",
          icon: Scale,
          label: "Qarzlar",
          badge: debtorsCount > 0 ? debtorsCount : null,
        },
      ],
    },
    {
      label: "INTELLIGENCE",
      restrictedTo: ['superadmin', 'admin', 'manager'],
      items: [
        { to: "/ai-analytics", icon: Sparkles, label: "AI Tahlil" },
        { to: "/reports", icon: BarChart2, label: "Hisobotlar", restrictedTo: ['superadmin', 'admin'] },
      ],
    },
    {
      label: "SYSTEM",
      restrictedTo: ['superadmin', 'admin'],
      items: [
        { to: "/settings", icon: Settings, label: "Sozlamalar" },
      ],
    },
  ].filter(group => !group.restrictedTo || group.restrictedTo.includes(user?.role)).map(group => ({
    ...group,
    items: group.items.filter(item => !item.restrictedTo || item.restrictedTo.includes(user?.role))
  }));

  if (user?.role === 'superadmin' || user?.role === 'admin') {
    navGroups[2].items.unshift({ to: "/audit-logs", icon: History, label: "Audit (Tarix)" });
    navGroups[3].items.unshift({ to: "/employees", icon: Users, label: "Xodimlar" });
  }


  return (
    <>
      <aside className={`bg-surface border-r border-subtle flex flex-col h-full shrink-0 sidebar-transition
        fixed inset-y-0 left-0 z-50 w-[250px] md:relative md:translate-x-0 md:w-[220px] shadow-2xl md:shadow-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} pt-safe pb-safe
      `}>
        {/* Logo Section */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-subtle shrink-0">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Logo" className="w-[20px] h-[20px] object-contain" />
          <h1 className="text-[15px] font-[600] tracking-tight text-primary">
            FERGANA OBOI</h1>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={toggleTheme}
            className="w-9 h-9 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded-xl transition-all duration-200 active:scale-95"
            title="Toggle theme"
          >
            <Sun
              className="w-[18px] h-[18px] hidden dark:block"
              strokeWidth={1.5}
            />
            <Moon
              className="w-[18px] h-[18px] block dark:hidden"
              strokeWidth={1.5}
            />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 flex md:hidden items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded-xl transition-all duration-200 active:scale-95"
            title="Yopish"
          >
            <X className="w-[18px] h-[18px]" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 no-scrollbar">
        {navGroups.map((group, groupIdx) => (
          <div key={groupIdx} className="mb-4">
            <div className="px-4 pt-6 pb-2 text-[10px] font-[500] text-tertiary uppercase tracking-wider">
              {group.label}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                if (item.isCart) {
                  return (
                    <button
                      key="sidebar-cart"
                      onClick={() => {
                        setCartOpen(true);
                        onClose();
                      }}
                      className="w-full flex items-center justify-between px-3 h-9 transition-colors group text-secondary hover:bg-subtle hover:text-primary border-l-2 border-transparent cursor-pointer text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <item.icon
                          className="w-[16px] h-[16px]"
                          strokeWidth={1.5}
                        />
                        <span className="text-[13px] font-[500]">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span className="bg-accent text-inverse h-5 px-2 rounded font-[500] text-[11px] flex items-center justify-center min-w-[20px] shadow-sm">
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `tour-${item.to.replace('/', '')} flex items-center justify-between px-3 h-9 transition-colors group ${
                        isActive
                          ? "bg-subtle text-primary border-l-2 border-accent"
                          : "text-secondary hover:bg-subtle hover:text-primary border-l-2 border-transparent"
                      }`
                    }
                  >
                    <div className="flex items-center gap-2.5">
                      <item.icon
                        className="w-[16px] h-[16px]"
                        strokeWidth={1.5}
                      />
                      <span className="text-[13px] font-[500]">{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="bg-state-danger-bg text-state-danger-text border border-state-danger-border h-5 px-2 rounded font-[500] text-[11px] flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer Status & User */}
      <div className="p-3 border-t border-subtle shrink-0">
        <div className="flex items-center gap-2 mb-2 bg-subtle/30 hover:bg-subtle p-1.5 rounded-[12px] border border-transparent hover:border-subtle transition-all">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent shrink-0 relative">
            <span className="text-[13px] font-[600]">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </span>
            {/* Smena holati ko'rsatkichi — faqat smena tizimi yoqilganda avatar ustida */}
            {shiftEnabled && (
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${currentShift ? 'bg-state-success-text' : 'bg-state-danger-text'}`}></span>
                <span className={`relative inline-flex rounded-full h-3 w-3 border-2 border-surface ${currentShift ? 'bg-state-success-text' : 'bg-state-danger-text'}`}></span>
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-[13px] font-[600] text-primary truncate leading-tight">
              {user?.name || 'Admin'}
            </h4>
            <p className="text-[11px] font-[500] text-tertiary truncate capitalize leading-tight mt-0.5">
              {user?.role || 'Admin'}
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-8 h-8 rounded-[8px] flex items-center justify-center text-tertiary hover:text-state-danger-text hover:bg-state-danger-bg transition-colors shrink-0"
            title="Tizimdan chiqish"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
        
        {/* Smena tugmalari — faqat shiftEnabled bo'lsa ko'rinadi */}
        {shiftEnabled && (
          currentShift ? (
            <button 
              onClick={() => setIsShiftModalOpen(true)}
              className="w-full h-8 rounded-[8px] text-[12px] font-[500] text-state-danger-text border border-state-danger-border hover:bg-state-danger-bg transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-state-danger-text"></div>
              Smenani yopish
            </button>
          ) : (
            <div className="text-center text-[11px] font-[500] text-tertiary py-1.5 rounded-[8px] bg-subtle border border-subtle">
              Smena yopiq
            </div>
          )
        )}
      </div>
      </aside>

      <ShiftModal 
        isOpen={isShiftModalOpen} 
        mode="close" 
        currentShift={currentShift}
        onClose={() => setIsShiftModalOpen(false)} 
      />
    </>
  );
};

export default Sidebar;
