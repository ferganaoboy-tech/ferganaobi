import { useQuery } from '@tanstack/react-query';
import { fetchAuditLogs } from '../api';

export const useAuditLogs = (params) => {
  return useQuery({
    queryKey: ['auditLogs', params],
    queryFn: () => fetchAuditLogs(params),
    keepPreviousData: true,
  });
};
