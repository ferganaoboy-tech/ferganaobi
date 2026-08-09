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

export const useCreatePayment = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createPayment,
    onSuccess: () => {
      playNotificationSound();
      // toast is handled in socket listener usually, but we can have it here too
      // toast.success("To'lov qabul qilindi"); 
      queryClient.invalidateQueries({ queryKey: ['payments'] });
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
