import { useQuery } from '@tanstack/react-query';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api' : '/api');

const fetchSystemHealth = async (password) => {
  const { data } = await axios.get(`${API_URL}/system/health`, {
    headers: {
      'x-monitor-password': password
    }
  });
  return data.data;
};

const fetchSystemAiDiagnostics = async (password) => {
  const { data } = await axios.get(`${API_URL}/system/ai-diagnostics`, {
    headers: {
      'x-monitor-password': password
    }
  });
  return data.data.report;
};

export const useSystemHealth = (password, isUnlocked) => {
  return useQuery({
    queryKey: ['system-health', password],
    queryFn: () => fetchSystemHealth(password),
    enabled: isUnlocked && !!password,
    refetchInterval: 5000, // Har 5 soniyada yangilab turadi
  });
};

export const useSystemAiDiagnostics = (password, isUnlocked, isAiRequested) => {
  return useQuery({
    queryKey: ['system-ai-diagnostics', password],
    queryFn: () => fetchSystemAiDiagnostics(password),
    enabled: isUnlocked && !!password && isAiRequested,
    staleTime: 1000 * 60 * 5, // 5 daqiqa davomida qayta request qilmaydi (kешdan oladi)
  });
};
