import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import * as api from '../api';
import toast from 'react-hot-toast';

export const useCustomers = (filters) => {
  return useQuery({
    queryKey: ['customers', filters],
    queryFn: () => api.fetchCustomers(filters),
    keepPreviousData: true,
  });
};

export const useCustomersInfinite = (filters) => {
  return useInfiniteQuery({
    queryKey: ['customers-infinite', filters],
    queryFn: ({ pageParam = 1 }) => api.fetchCustomers({ ...filters, page: pageParam }),
    getNextPageParam: (lastPage) => {
      if (lastPage.pagination && lastPage.pagination.page < lastPage.pagination.pages) {
        return lastPage.pagination.page + 1;
      }
      return undefined;
    },
    keepPreviousData: true,
  });
};

export const useDebtors = () => {
  return useQuery({
    queryKey: ['debtors'],
    queryFn: api.fetchDebtors,
    staleTime: 0,
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.createCustomer,
    onSuccess: () => {
      toast.success("Mijoz qo'shildi");
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-infinite'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Xatolik yuz berdi");
    }
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.updateCustomer,
    onSuccess: () => {
      toast.success("Mijoz yangilandi");
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-infinite'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Xatolik yuz berdi");
    }
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: api.deleteCustomer,
    onSuccess: () => {
      toast.success("Mijoz o'chirildi");
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers-infinite'] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Xatolik yuz berdi");
    }
  });
};
