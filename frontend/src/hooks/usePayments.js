import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '../api';
import toast from 'react-hot-toast';
import { playNotificationSound } from '../utils/sound';

export const usePayments = (filters) => {
  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => api.fetchPayments(filters),
    keepPreviousData: true,
  });
};

// Bitta mijozning to'lov tarixini olish (DebtPage drawer uchun)
export const useCustomerPaymentHistory = (customerId) => {
  return useQuery({
    queryKey: ['customer-payments', customerId],
    queryFn: () => api.fetchCustomerPayments(customerId),
    enabled: !!customerId,
    staleTime: 30_000, // 30s — to'lov qilinmasa tez-tez o'zgarmaydi
  });
};

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createPayment,
    onSuccess: () => {
      playNotificationSound();
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customer-payments'] }); // Drawer yangilansin
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['orderStats'] });
      queryClient.invalidateQueries({ queryKey: ['debtors'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Xatolik yuz berdi");
    }
  });
};
