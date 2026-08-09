import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { socket } from '../socket';
import { formatUZS } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { playNotificationSound } from '../utils/sound';

// Helper function to apply deltas optimistically
const applySyncDeltas = (queryClient, syncDeltas) => {
  if (!syncDeltas) return;

  // Optimistic Product Update
  if (syncDeltas.products && syncDeltas.products.length > 0) {
    queryClient.setQueriesData({ queryKey: ['products'] }, (oldData) => {
      if (!oldData || !oldData.data) return oldData;
      let changed = false;
      const newData = { ...oldData, data: [...oldData.data] };

      syncDeltas.products.forEach(update => {
        const pIndex = newData.data.findIndex(p => p._id === update.id);
        if (pIndex !== -1) {
          newData.data[pIndex] = {
            ...newData.data[pIndex],
            quantity: Math.max(0, newData.data[pIndex].quantity + update.delta)
          };
          changed = true;
        }
      });
      return changed ? newData : oldData;
    });
  }

  // Optimistic Customer/Debt Update
  if (syncDeltas.customer) {
    const { id, debtDelta, purchasedDelta } = syncDeltas.customer;

    // Update customers list
    queryClient.setQueriesData({ queryKey: ['customers'] }, (oldData) => {
      if (!oldData || !oldData.data) return oldData;
      let changed = false;
      const newData = { ...oldData, data: [...oldData.data] };
      const cIndex = newData.data.findIndex(c => c._id === id);
      if (cIndex !== -1) {
        newData.data[cIndex] = {
          ...newData.data[cIndex],
          totalDebt: Math.max(0, newData.data[cIndex].totalDebt + debtDelta),
          totalPurchased: newData.data[cIndex].totalPurchased + (purchasedDelta || 0)
        };
        changed = true;
      }
      return changed ? newData : oldData;
    });

    // Update debtors list
    queryClient.setQueriesData({ queryKey: ['debtors'] }, (oldData) => {
      if (!oldData || !oldData.data) return oldData;
      let changed = false;
      const newData = { ...oldData, data: [...oldData.data] };
      const cIndex = newData.data.findIndex(c => c._id === id);
      if (cIndex !== -1) {
        newData.data[cIndex] = {
          ...newData.data[cIndex],
          totalDebt: Math.max(0, newData.data[cIndex].totalDebt + debtDelta)
        };
        changed = true;
      }
      return changed ? newData : oldData;
    });
  }
};

export const useSocketConnection = () => {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // ✅ FIX #4: useRef bilan callback reference'larni saqlaymiz
  // Bu cleanup'da aynan shu callbacklar o'chiriladi — boshqalar emas
  const handlersRef = useRef({});

  useEffect(() => {
    // ─── Named handler'lar — cleanup'da aynan shular o'chiriladi ───

    const onConnect = () => {
      console.log('Connected to socket server');
      if (user?.role === 'superadmin' || user?.role === 'admin') {
        socket.emit('join_all_warehouses');
      } else if (user?.warehouse) {
        socket.emit('join', user.warehouse._id || user.warehouse);
      }
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
    };

    const onProductInvalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    const onOrderCreated = (data) => {
      if (data?.syncDeltas) applySyncDeltas(queryClient, data.syncDeltas);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
    };

    const onOrderConfirmed = (data) => {
      playNotificationSound();
      if (data?.syncDeltas) applySyncDeltas(queryClient, data.syncDeltas);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
    };

    const onOrderCancelled = (data) => {
      if (data?.syncDeltas) applySyncDeltas(queryClient, data.syncDeltas);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
    };

    const onOrderUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    const onReturnCreated = (data) => {
      if (data?.syncDeltas) applySyncDeltas(queryClient, data.syncDeltas);
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
    };

    const onPaymentReceived = (data) => {
      playNotificationSound();
      if (data?.syncDeltas) applySyncDeltas(queryClient, data.syncDeltas);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      if (data?.customer?.name && data?.amount != null) {
        toast.success(`💰 To'lov qabul qilindi: ${data.customer.name} — ${formatUZS(data.amount)}`);
      }
    };

    const onStockLow = (data) => {
      toast.error(
        `⚠️ Kam qoldi: ${data.product?.brand || data.product?.artikul} — ${data.quantity} rulon`,
        { duration: 10000 }
      );
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    const onWarehouseInvalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['warehouses'] });
    };

    const onTelegramSubscribersUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-subscribers'] });
    };

    const onCustomerInvalidate = () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
    };

    const onTransferIncoming = (transfer) => {
      playNotificationSound();
      if (transfer.type === 'request') {
        toast(`🔔 Yangi so'rov keldi: ${transfer.transferNumber}`, {
          icon: '📥',
          duration: 8000
        });
      } else {
        toast(`📦 Yangi o'tkazma keldi: ${transfer.transferNumber}`, {
          icon: '🚛',
          duration: 8000
        });
      }
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-count'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
    };

    const onTransferUpdated = (transfer) => {
      const fromWarehouseId = transfer.fromWarehouse?._id || transfer.fromWarehouse;
      const toWarehouseId = transfer.toWarehouse?._id || transfer.toWarehouse;
      const userWarehouseId = user?.warehouse?._id || user?.warehouse;
      
      if (transfer.status === 'completed' && userWarehouseId && fromWarehouseId === userWarehouseId) {
        playNotificationSound();
        toast.success(`🎉 Siz yuborgan tovarlar qabul qilindi! (${transfer.transferNumber})`, { duration: 8000 });
      } else if (transfer.status === 'completed' && transfer.type === 'request' && userWarehouseId && toWarehouseId === userWarehouseId) {
        playNotificationSound();
        toast.success(`✅ So'rovingiz tasdiqlandi! (${transfer.transferNumber})`, { duration: 8000 });
      } else if (transfer.status === 'rejected' && transfer.type === 'request' && userWarehouseId && toWarehouseId === userWarehouseId) {
        playNotificationSound();
        toast.error(`❌ So'rovingiz rad etildi! (${transfer.transferNumber})`, { duration: 8000 });
      } else {
        toast.success(`✅ O'tkazma holati o'zgardi: ${transfer.status}`);
      }
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-count'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    };

    // ─── Referencelarni saqlab qo'yamiz (cleanup uchun) ───
    handlersRef.current = {
      onConnect,
      onProductInvalidate,
      onOrderCreated,
      onOrderConfirmed,
      onOrderCancelled,
      onOrderUpdated,
      onReturnCreated,
      onPaymentReceived,
      onStockLow,
      onWarehouseInvalidate,
      onCustomerInvalidate,
      onTransferIncoming,
      onTransferUpdated,
      onTelegramSubscribersUpdated,
    };

    // ─── Event'larga ulanamiz ───
    if (socket.connected) {
      onConnect();
    }
    socket.on('connect', onConnect);
    socket.on('product:created', onProductInvalidate);
    socket.on('product:updated', onProductInvalidate);
    socket.on('product:deleted', onProductInvalidate);
    socket.on('order:created', onOrderCreated);
    socket.on('order:confirmed', onOrderConfirmed);
    socket.on('order:cancelled', onOrderCancelled);
    socket.on('order:updated', onOrderUpdated);
    socket.on('return:created', onReturnCreated);
    socket.on('payment:received', onPaymentReceived);
    socket.on('stock:low', onStockLow);
    socket.on('warehouse:created', onWarehouseInvalidate);
    socket.on('warehouse:updated', onWarehouseInvalidate);
    socket.on('warehouse:deleted', onWarehouseInvalidate);
    socket.on('customer:created', onCustomerInvalidate);
    socket.on('customer:updated', onCustomerInvalidate);
    socket.on('customer:deleted', onCustomerInvalidate);
    socket.on('telegram-subscribers-updated', onTelegramSubscribersUpdated);
    
    const onTransferCreated = () => {
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      queryClient.invalidateQueries({ queryKey: ['transfers-count'] });
    };

    // Transfer events
    socket.on('transfer:created', onTransferCreated);
    socket.on('transfer:incoming', onTransferIncoming);
    socket.on('transfer:updated', onTransferUpdated);

    // ✅ FIX #4: Cleanup — faqat BU useEffect ichidagi callbacklarni o'chiradi
    // CartContext.jsx yoki boshqa komponentlardagi listenerlar ta'sirlanmaydi
    return () => {
      socket.off('connect', onConnect);
      socket.off('product:created', onProductInvalidate);
      socket.off('product:updated', onProductInvalidate);
      socket.off('product:deleted', onProductInvalidate);
      socket.off('order:created', onOrderCreated);
      socket.off('order:confirmed', onOrderConfirmed);
      socket.off('order:cancelled', onOrderCancelled);
      socket.off('order:updated', onOrderUpdated);
      socket.off('return:created', onReturnCreated);
      socket.off('payment:received', onPaymentReceived);
      socket.off('stock:low', onStockLow);
      socket.off('warehouse:created', onWarehouseInvalidate);
      socket.off('warehouse:updated', onWarehouseInvalidate);
      socket.off('warehouse:deleted', onWarehouseInvalidate);
      socket.off('customer:created', onCustomerInvalidate);
      socket.off('customer:updated', onCustomerInvalidate);
      socket.off('telegram-subscribers-updated', onTelegramSubscribersUpdated);
      socket.off('transfer:created', onTransferCreated);
      socket.off('transfer:incoming', onTransferIncoming);
      socket.off('transfer:updated', onTransferUpdated);
    };
  }, [queryClient, user]);
};
