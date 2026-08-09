import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchCurrentShift, startShift, closeShift } from '../api';

/**
 * useCurrentShift — joriy ochiq smenani qaytaradi.
 * 
 * @param {Object} options - react-query options (masalan, { enabled: false })
 */
export const useCurrentShift = (options = {}) => {
  return useQuery({
    queryKey: ['currentShift'],
    queryFn: fetchCurrentShift,
    ...options, // enabled, staleTime va boshqa optionlarni qabul qiladi
  });
};

export const useStartShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentShift'] });
    },
  });
};

export const useCloseShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: closeShift,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['currentShift'] });
    },
  });
};
