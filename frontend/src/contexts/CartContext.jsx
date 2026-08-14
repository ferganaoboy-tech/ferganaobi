import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { haptics } from '../utils/haptics';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';
import { socket } from '../socket';

const CartContext = createContext();

export const useCart = () => useContext(CartContext);

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
// Faqat minimal ma'lumot saqlanadi (productDetail serialize qilinmaydi)
const CART_KEY = 'oboi_crm_cart';
const CART_WH_KEY = 'oboi_crm_cart_warehouse';
const CART_TYPE_KEY = 'oboi_crm_cart_ordertype';

const loadCartFromStorage = () => {
  try {
    const saved = localStorage.getItem(CART_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const saveCartToStorage = (items) => {
  // ✅ FIX #9: productDetail serialize qilinmaydi, lekin narx hisoblash uchun kerakli maydonlar saqlanadi
  const minimal = items.map(({ product, productName, artikul, unit, quantity, unitPrice, discount, isCustomPrice, warehouse, wholesalePrice, pricePerRoll, rollsPerBox, rollLength }) => ({
    product, productName, artikul, unit, quantity, unitPrice, discount: discount || 0, isCustomPrice: isCustomPrice || false,
    warehouse: warehouse ? String(warehouse) : null,
    wholesalePrice, pricePerRoll, rollsPerBox, rollLength
  }));
  localStorage.setItem(CART_KEY, JSON.stringify(minimal));
};

export const CartProvider = ({ children }) => {
  const { user } = useAuth();

  // State — productDetail faqat runtime'da, localStorage'da yo'q
  // ✅ Lazy State Initialization: Ilk renderdayoq ma'lumotlar bilan to'ladi
  const [cartItems, setCartItems] = useState(() => loadCartFromStorage());
  const [productDetails, setProductDetails] = useState({}); // { productId: productDoc }
  
  // ✅ Auto-Recovery Fallback Engine
  const [cartWarehouse, setCartWarehouse] = useState(() => {
    const savedWh = localStorage.getItem(CART_WH_KEY);
    if (savedWh) return savedWh;
    // Agar xotira tozalangan bo'lsa, savatdagi birinchi mahsulotdan tiklaymiz
    const savedItems = loadCartFromStorage();
    if (savedItems.length > 0 && savedItems[0].warehouse) {
      return savedItems[0].warehouse;
    }
    return null;
  });
  
  const [orderType, setOrderType] = useState(() => localStorage.getItem(CART_TYPE_KEY) || 'wholesale');
  const [cartOpen, setCartOpen] = useState(false);

  // ─── localStorage saqlash (har o'zgarishda) ───
  useEffect(() => {
    saveCartToStorage(cartItems);
    if (cartItems.length === 0) {
      setCartWarehouse(null);
      localStorage.removeItem(CART_WH_KEY);
    } else if (cartWarehouse) {
      localStorage.setItem(CART_WH_KEY, cartWarehouse);
    }
  }, [cartItems, cartWarehouse]);

  useEffect(() => {
    localStorage.setItem(CART_TYPE_KEY, orderType);
  }, [orderType]);

  // ✅ FIX #9: Tab cross-sync — boshqa tab'dagi o'zgarishlarni real-time olamiz
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === CART_KEY) {
        try {
          const newCart = e.newValue ? JSON.parse(e.newValue) : [];
          setCartItems(newCart);
        } catch { /* ignore parse errors */ }
      }
      if (e.key === CART_WH_KEY) {
        setCartWarehouse(e.newValue || null);
      }
      if (e.key === CART_TYPE_KEY) {
        setOrderType(e.newValue || 'retail');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // orderType o'zgarganda narxlarni qayta hisoblash
  useEffect(() => {
    setCartItems(prevItems =>
      prevItems.map(item => {
        const detail = productDetails[item.product] || item; // Fallback to item itself if page reloaded
        if (!detail || detail.wholesalePrice === undefined) return item;
        const unitPrice = item.isCustomPrice ? item.unitPrice : getUnitPrice(detail, item.unit, orderType);
        return { ...item, unitPrice, isCustomPrice: item.isCustomPrice || false };
      })
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderType]);

  // ✅ FIX #4 + product:updated — faqat CartContext uchun named callback
  useEffect(() => {
    const handleProductUpdated = (updatedProduct) => {
      // productDetails cache'ni yangilash
      setProductDetails(prev => ({ ...prev, [updatedProduct._id]: updatedProduct }));

      // cartItems narxlarini yangilash
      setCartItems(prevItems =>
        prevItems.map(item => {
          if (item.product === updatedProduct._id) {
            const unitPrice = item.isCustomPrice ? item.unitPrice : getUnitPrice(updatedProduct, item.unit, orderType);
            return {
              ...item,
              unitPrice,
              productName: updatedProduct.brand || updatedProduct.artikul,
              artikul: updatedProduct.artikul
            };
          }
          return item;
        })
      );
    };

    socket.on('product:updated', handleProductUpdated);
    // ✅ FIX #4: Cleanup — named callback reference → faqat bu handler o'chiriladi
    return () => {
      socket.off('product:updated', handleProductUpdated);
    };
  }, [orderType]);

  // ─── getUnitPrice helper ───────────────────────────────────────────────────
  const getUnitPrice = (product, unit, type) => {
    if (!product) return 0;
    const basePrice = type === 'retail'
      ? product.wholesalePrice
      : (product.pricePerRoll || product.wholesalePrice);
    if (['rulon', 'dona', 'kv.m'].includes(unit)) return basePrice;
    if (unit === 'quti') return basePrice * (product.rollsPerBox || 1);
    if (unit === 'metr') return basePrice / (product.rollLength || 10);
    return basePrice;
  };

  // ─── calculateRolls helper ────────────────────────────────────────────────
  const calculateRolls = (unit, quantity, product) => {
    if (!product) return quantity;
    if (unit === 'quti') return quantity * (product.rollsPerBox || 1);
    if (unit === 'metr') return quantity / (product.rollLength || 10);
    return quantity;
  };

  // ─── addToCart ────────────────────────────────────────────────────────────
  // ✅ FIX #5: Stale closure bartaraf — stock tekshiruvi state'dan tashqarida
  const addToCart = useCallback((product, quantity, unit, forceWarehouseSwitch = false) => {
    const productWarehouseId = product.warehouse?._id || product.warehouse;

    // Permission check
    if (user && user.role !== 'superadmin' && user.role !== 'admin') {
      const userWhId = user.warehouse ? String(user.warehouse._id || user.warehouse) : null;
      const prodWhId = String(productWarehouseId);
      if (!userWhId || prodWhId !== userWhId) {
        haptics.warning();
        toast.error("Siz faqat o'z omboringizdagi mahsulotlarni sota olasiz!");
        return 'permission_denied';
      }
    }

    // Warehouse mismatch
    if (cartWarehouse && String(cartWarehouse) !== String(productWarehouseId)) {
      if (forceWarehouseSwitch) {
        const price = getUnitPrice(product, unit, orderType);
        const newItem = {
          product: product._id,
          productName: product.brand || product.artikul,
          artikul: product.artikul,
          unit,
          quantity: Number(quantity),
          unitPrice: price,
          discount: 0,
          isCustomPrice: false,
          warehouse: String(productWarehouseId),
          wholesalePrice: product.wholesalePrice,
          pricePerRoll: product.pricePerRoll,
          rollsPerBox: product.rollsPerBox,
          rollLength: product.rollLength
        };
        setProductDetails(prev => ({ ...prev, [product._id]: product }));
        setCartItems([newItem]);
        setCartWarehouse(productWarehouseId);
        haptics.success();
        toast.success("Savat tozalandi va yangi skladdan mahsulot qo'shildi!");
        return true;
      }
      haptics.light();
      return 'warehouse_mismatch';
    }

    // ✅ FIX #5: Stock tekshiruvini setCartItems TASHQARISIDA bajaramiz
    let existingRolls = 0;
    cartItems.forEach(item => {
      if (item.product !== product._id) return;
      const detail = productDetails[item.product] || product;
      existingRolls += calculateRolls(item.unit, item.quantity, detail);
    });

    const rollsToAdd = calculateRolls(unit, Number(quantity), product);
    const totalNewRolls = existingRolls + rollsToAdd;

    if (totalNewRolls > product.quantity) {
      haptics.warning();
      toast.error(`Omborda yetarli tovar yo'q! Maksimal qoldiq: ${product.quantity} ${product.unit || 'birlik'}`);
      return false;
    }

    setCartItems(prev => {
      const price = getUnitPrice(product, unit, orderType);
      const existingIdx = prev.findIndex(
        item => item.product === product._id && item.unit === unit
      );

      if (existingIdx > -1) {
        return prev.map((item, idx) =>
          idx === existingIdx
            ? { ...item, quantity: item.quantity + Number(quantity), unitPrice: price }
            : item
        );
      } else {
        return [
          ...prev,
          {
            product: product._id,
            productName: product.brand || product.artikul,
            artikul: product.artikul,
            unit,
            quantity: Number(quantity),
            unitPrice: price,
            discount: 0,
            isCustomPrice: false,
            warehouse: String(productWarehouseId),
            wholesalePrice: product.wholesalePrice,
            pricePerRoll: product.pricePerRoll,
            rollsPerBox: product.rollsPerBox,
            rollLength: product.rollLength
          }
        ];
      }
    });

    // productDetails cache yangilash
    setProductDetails(prev => ({ ...prev, [product._id]: product }));

    if (!cartWarehouse) {
      setCartWarehouse(productWarehouseId);
    }

    haptics.success();
    return true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartWarehouse, orderType, productDetails, user, cartItems]);

  // ─── removeFromCart ───────────────────────────────────────────────────────
  const removeFromCart = useCallback((productId, unit) => {
    haptics.delete();
    setCartItems(prev => prev.filter(item => !(item.product === productId && item.unit === unit)));
  }, []);

  // ─── updateCartQuantity ───────────────────────────────────────────────────
  const updateCartQuantity = useCallback((productId, unit, quantity) => {
    const updatingItem = cartItems.find(item => item.product === productId && item.unit === unit);
    if (!updatingItem) return;

    const detail = productDetails[productId];
    if (!detail) return;

    // Boshqa unit'lardagi miqdorlar
    let otherRolls = 0;
    cartItems.forEach(item => {
      if (item.product === productId && item.unit !== unit) {
        const d = productDetails[item.product] || detail;
        otherRolls += calculateRolls(item.unit, item.quantity, d);
      }
    });

    const qty = quantity === '' ? '' : Number(quantity);
    const numericQty = qty === '' ? 0 : qty;
    const newQtyInRolls = calculateRolls(unit, numericQty, detail);
    const totalNewRolls = otherRolls + newQtyInRolls;

    if (totalNewRolls > detail.quantity) {
      haptics.warning();
      toast.error(`Omborda yetarli tovar yo'q! Maksimal qoldiq: ${detail.quantity} ${detail.unit || 'birlik'}`);
      return;
    }

    haptics.light();
    setCartItems(prev => prev.map(item => {
      if (item.product === productId && item.unit === unit) {
        return { ...item, quantity: qty };
      }
      return item;
    }));
  }, [productDetails, cartItems]);

  // ─── updateCartItemPrice ──────────────────────────────────────────────────
  const updateCartItemPrice = useCallback((productId, unit, price) => {
    haptics.light();
    setCartItems(prev => prev.map(item => {
      if (item.product === productId && item.unit === unit) {
        return { ...item, unitPrice: Number(price), isCustomPrice: true };
      }
      return item;
    }));
  }, []);

  // ─── clearCart ────────────────────────────────────────────────────────────
  const clearCart = useCallback(() => {
    setCartItems([]);
    setProductDetails({});
    setCartWarehouse(null);
  }, []);

  // ─── Computed values ──────────────────────────────────────────────────────
  // Subtotal — productDetails cache'dan yoki saqlangan unitPrice'dan hisoblanadi
  const enrichedCartItems = cartItems.map(item => {
    const detail = productDetails[item.product];
    const subtotal = item.unitPrice * item.quantity;
    return { ...item, subtotal, productDetail: detail || null };
  });

  const totalAmount = enrichedCartItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider value={{
      cartItems: enrichedCartItems,
      cartWarehouse,
      orderType,
      cartOpen,
      setCartOpen,
      setOrderType,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      updateCartItemPrice,
      clearCart,
      totalAmount,
      totalCount
    }}>
      {children}
    </CartContext.Provider>
  );
};
