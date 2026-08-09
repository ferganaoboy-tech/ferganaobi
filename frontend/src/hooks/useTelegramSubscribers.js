import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api';

export const useTelegramSubscribers = () => {
  return useQuery({
    queryKey: ['telegram-subscribers'],
    queryFn: async () => {
      const { data } = await api.get('/telegram-subscribers');
      return data;
    }
  });
};

export const useApproveSubscriber = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.put(`/telegram-subscribers/${id}/approve`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-subscribers'] });
    }
  });
};

export const useRejectSubscriber = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.delete(`/telegram-subscribers/${id}/reject`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['telegram-subscribers'] });
    }
  });
};
