import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutGrid, 
  Grid3X3, 
  ShoppingBag, 
  FileText, 
  Contact,
  RefreshCcw
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';

const BottomNavigation = () => {
  const { totalCount, setCartOpen } = useCart();
  const { user } = useAuth();

  const navItems = [
    { to: "/dashboard", icon: LayoutGrid, label: "Asosiy", restrictedTo: ['superadmin', 'admin'] },
    { to: "/products", icon: Grid3X3, label: "Katalog" },
    { to: "cart", icon: ShoppingBag, label: "Savat", isCart: true },
    { to: "/orders", icon: FileText, label: "Buyurtmalar" },
    { to: "/quick-return", icon: RefreshCcw, label: "Vozvrat" }
  ].filter(item => !item.restrictedTo || item.restrictedTo.includes(user?.role));

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-md border-t border-subtle z-40 flex items-center justify-around px-2 shadow-lg h-[calc(4rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)]">
      {navItems.map((item, index) => {
        if (item.isCart) {
          return (
            <button
              key={index}
              onClick={() => setCartOpen(true)}
              className="tour-mobile-cart flex flex-col items-center justify-center flex-1 h-full text-secondary hover:text-primary relative transition-all active:scale-95"
              type="button"
            >
              <div className="relative">
                <item.icon className="w-[20px] h-[20px]" strokeWidth={1.5} />
                {totalCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-accent text-inverse text-[9px] font-[600] h-4 min-w-[16px] px-1.5 rounded-full flex items-center justify-center shadow-sm">
                    {totalCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] mt-1 font-[500] tracking-tight">{item.label}</span>
            </button>
          );
        }

        return (
          <NavLink
            key={index}
            to={item.to}
            className={({ isActive }) =>
              `tour-mobile-${item.to.replace('/', '')} flex flex-col items-center justify-center flex-1 h-full transition-all active:scale-95 ${
                isActive ? 'text-accent' : 'text-secondary hover:text-primary'
              }`
            }
          >
            <item.icon className="w-[20px] h-[20px]" strokeWidth={1.5} />
            <span className="text-[10px] mt-1 font-[500] tracking-tight">{item.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
};

export default BottomNavigation;
