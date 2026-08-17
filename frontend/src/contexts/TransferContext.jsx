import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext';

const TransferContext = createContext();

export const useTransfer = () => useContext(TransferContext);

export const TransferProvider = ({ children }) => {
  const { user } = useAuth();
  const [transferItems, setTransferItems] = useState([]);
  const [isTransferOpen, setIsTransferOpen] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    if (user?.warehouse) {
      const saved = localStorage.getItem(`transfer_cart_${user.warehouse}`);
      if (saved) {
        try {
          setTransferItems(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse transfer cart', e);
        }
      }
    } else {
      setTransferItems([]);
    }
  }, [user?.warehouse]);

  // Save to local storage on change
  useEffect(() => {
    if (user?.warehouse) {
      localStorage.setItem(`transfer_cart_${user.warehouse}`, JSON.stringify(transferItems, (key, value) => {
        return value === undefined ? null : value;
      }));
    }
  }, [transferItems, user?.warehouse]);

  const calculateRolls = (unit, quantity, product) => {
    if (!product) return quantity;
    if (unit === 'quti') return quantity * (product.rollsPerBox || 1);
    if (unit === 'metr') return quantity / (product.rollLength || 10);
    return quantity;
  };

  const addToTransfer = (product, quantity, unit = 'rulon') => {
    if (transferItems.length > 0) {
      const firstItemWarehouse = transferItems[0].product.warehouse?._id || transferItems[0].product.warehouse;
      const currentProductWarehouse = product.warehouse?._id || product.warehouse;
      
      if (firstItemWarehouse && currentProductWarehouse && String(firstItemWarehouse) !== String(currentProductWarehouse)) {
        toast.error("Bitta o'tkazmada faqat bitta filialdan mahsulot jo'natish mumkin! Iltimos, avval savatchani yuboring yoki tozalang.");
        return;
      }
    }

    const existing = transferItems.find(item => item.product._id === product._id && item.unit === unit);
    const checkQty = existing ? existing.quantity + quantity : quantity;
    const baseQty = calculateRolls(unit, checkQty, product);
    
    if (baseQty > product.quantity) {
      toast.error(`Skladda yetarli mahsulot yo'q. Maksimal qoldiq: ${product.quantity} ${product.unit || 'birlik'}`);
      return;
    }

    setTransferItems(prev => {
      const existIdx = prev.findIndex(item => item.product._id === product._id && item.unit === unit);
      if (existIdx > -1) {
        return prev.map((item, idx) => 
          idx === existIdx ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { product, quantity, unit }];
    });

    toast.success(`${product.artikul} ${existing ? "savatdagi miqdori yangilandi!" : "ko'chirish savatiga qo'shildi!"}`);
  };

  const updateTransferQuantity = (productId, unit, newQuantity) => {
    const updatingItem = transferItems.find(item => item.product._id === productId && item.unit === unit);
    if (!updatingItem) return;

    const baseQty = calculateRolls(unit, newQuantity, updatingItem.product);
    if (baseQty > updatingItem.product.quantity) {
      toast.error(`Skladda yetarli mahsulot yo'q. Maksimal qoldiq: ${updatingItem.product.quantity} ${updatingItem.product.unit || 'birlik'}`);
      return;
    }

    setTransferItems(prev => prev.map(item => {
      if (item.product._id === productId && item.unit === unit) {
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const removeFromTransfer = (productId, unit) => {
    setTransferItems(prev => prev.filter(item => !(item.product._id === productId && item.unit === unit)));
  };

  const clearTransfer = () => {
    setTransferItems([]);
  };

  return (
    <TransferContext.Provider value={{
      transferItems,
      addToTransfer,
      updateTransferQuantity,
      removeFromTransfer,
      clearTransfer,
      isTransferOpen,
      setIsTransferOpen
    }}>
      {children}
    </TransferContext.Provider>
  );
};
