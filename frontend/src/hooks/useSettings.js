import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSettings, updateSettings } from '../api';

export const useSettings = () => {
  return useQuery({
    queryKey: ['settings'],
    queryFn: fetchSettings,
    staleTime: 60 * 1000, // 1 daqiqa — settings tez-tez o'zgarmaydi
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      // Invalidate products because their UZS prices might have changed
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
};

/**
 * useShiftEnabled — smena tizimi yoqilganmi yoki yo'qligini qaytaradi.
 * 
 * Settings'dan features.shiftEnabled flag'ini o'qiydi.
 * Default: false — smena tizimi o'chirilgan.
 */
export const useShiftEnabled = () => {
  const { data, isLoading } = useSettings();
  const shiftEnabled = data?.data?.features?.shiftEnabled ?? false;
  return { shiftEnabled, isLoading };
};
