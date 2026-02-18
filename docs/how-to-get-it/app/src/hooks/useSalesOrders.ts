import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { salesOrdersApi, type SalesOrder } from '@/lib/api';

// ============================================
// SALES ORDERS HOOKS
// ============================================

interface UseSalesOrdersOptions {
  page?: number;
  limit?: number;
  status?: string;
}

export function useSalesOrders(options: UseSalesOrdersOptions = {}) {
  const { page = 1, limit = 20, status } = options;

  return useQuery({
    queryKey: queryKeys.salesOrders.lists({ page, status }),
    queryFn: () => salesOrdersApi.getAll({ page, limit, status }),
    // Orders change frequently, keep fresh for 1 minute
    staleTime: 1 * 60 * 1000,
  });
}

export function usePrefetchSalesOrders() {
  const queryClient = useQueryClient();

  return {
    prefetchSalesOrders: (options: UseSalesOrdersOptions = {}) => {
      const { page = 1, limit = 20, status } = options;
      
      queryClient.prefetchQuery({
        queryKey: queryKeys.salesOrders.lists({ page, status }),
        queryFn: () => salesOrdersApi.getAll({ page, limit, status }),
        staleTime: 1 * 60 * 1000,
      });
    },
  };
}

export function useCreateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: salesOrdersApi.create,

    onMutate: async (newOrder) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.salesOrders.all });

      const previousOrders = queryClient.getQueryData(
        queryKeys.salesOrders.lists({ page: 1 })
      );

      // Optimistically add the new order
      queryClient.setQueryData(
        queryKeys.salesOrders.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;

          const optimisticOrder = {
            data: {
              id: `temp-${Date.now()}`,
              ...newOrder,
              createdAt: new Date().toISOString(),
              _optimistic: true,
            },
          };

          return {
            ...old,
            data: [optimisticOrder.data, ...old.data.slice(0, 19)],
            total: old.total + 1,
          };
        }
      );

      // Also invalidate stats since new order affects them
      queryClient.invalidateQueries({ queryKey: queryKeys.stats.all });

      return { previousOrders };
    },

    onSuccess: (result) => {
      queryClient.setQueryData(
        queryKeys.salesOrders.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            data: old.data.map((o: SalesOrder & { _optimistic?: boolean }) =>
              o._optimistic ? result.data : o
            ),
          };
        }
      );
      
      queryClient.invalidateQueries({ queryKey: queryKeys.salesOrders.all });
    },

    onError: (_err, _variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(
          queryKeys.salesOrders.lists({ page: 1 }),
          context.previousOrders
        );
      }
    },
  });
}

export function useUpdateSalesOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<SalesOrder> }) =>
      salesOrdersApi.update(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.salesOrders.all });

      const previousData = queryClient.getQueryData(
        queryKeys.salesOrders.lists({ page: 1 })
      );

      queryClient.setQueryData(
        queryKeys.salesOrders.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            data: old.data.map((o: SalesOrder) =>
              o.id === id ? { ...o, ...data, _optimistic: true } : o
            ),
          };
        }
      );

      return { previousData };
    },

    onSuccess: (result) => {
      queryClient.setQueryData(
        queryKeys.salesOrders.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((o: SalesOrder & { _optimistic?: boolean }) =>
              o.id === result.data.id ? result.data : o
            ),
          };
        }
      );
    },

    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.salesOrders.lists({ page: 1 }),
          context.previousData
        );
      }
    },
  });
}
