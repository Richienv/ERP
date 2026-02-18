import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { customersApi } from '@/lib/api';

// ============================================
// CUSTOMERS HOOKS
// ============================================

interface UseCustomersOptions {
  page?: number;
  limit?: number;
}

export function useCustomers(options: UseCustomersOptions = {}) {
  const { page = 1, limit = 20 } = options;

  return useQuery({
    queryKey: queryKeys.customers.lists(page),
    queryFn: () => customersApi.getAll({ page, limit }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function usePrefetchCustomers() {
  const queryClient = useQueryClient();

  return {
    prefetchCustomers: (options: UseCustomersOptions = {}) => {
      const { page = 1, limit = 20 } = options;
      
      queryClient.prefetchQuery({
        queryKey: queryKeys.customers.lists(page),
        queryFn: () => customersApi.getAll({ page, limit }),
        staleTime: 2 * 60 * 1000,
      });
    },
  };
}
