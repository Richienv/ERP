import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { productsApi, type Product } from '@/lib/api';

// ============================================
// PRODUCTS HOOKS
// ============================================
// These hooks implement:
// - Automatic caching with query keys
// - Prefetching for instant navigation
// - Optimistic updates for mutations
// ============================================

interface UseProductsOptions {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
}

// Hook for fetching products list
export function useProducts(options: UseProductsOptions = {}) {
  const { page = 1, limit = 20, search, category } = options;

  return useQuery({
    queryKey: queryKeys.products.lists({ page, search, category }),
    queryFn: () => productsApi.getAll({ page, limit, search, category }),
    // Keep data fresh for 2 minutes (products change frequently)
    staleTime: 2 * 60 * 1000,
  });
}

// Hook for fetching single product
export function useProduct(id: string) {
  return useQuery({
    queryKey: queryKeys.products.detail(id),
    queryFn: () => productsApi.getById(id),
    // Only fetch if we have an ID
    enabled: !!id,
  });
}

// ============================================
// PREFETCHING FUNCTIONS
// ============================================
// Call these on hover to load data BEFORE user clicks
// This is the key to instant page transitions
// ============================================

export function usePrefetchProducts() {
  const queryClient = useQueryClient();

  return {
    prefetchProducts: (options: UseProductsOptions = {}) => {
      const { page = 1, limit = 20, search, category } = options;
      
      // Prefetch the products list
      queryClient.prefetchQuery({
        queryKey: queryKeys.products.lists({ page, search, category }),
        queryFn: () => productsApi.getAll({ page, limit, search, category }),
        // Prefetch stays fresh for 1 minute
        staleTime: 1 * 60 * 1000,
      });
    },

    prefetchProduct: (id: string) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.products.detail(id),
        queryFn: () => productsApi.getById(id),
        staleTime: 1 * 60 * 1000,
      });
    },
  };
}

// ============================================
// MUTATIONS WITH OPTIMISTIC UPDATES
// ============================================
// These update the UI INSTANTLY before server confirms
// If server fails, we roll back automatically
// ============================================

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: productsApi.create,
    
    // ==========================================
    // OPTIMISTIC UPDATE - UI updates instantly!
    // ==========================================
    onMutate: async (newProduct) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });

      // Snapshot previous value for rollback
      const previousProducts = queryClient.getQueryData(
        queryKeys.products.lists({ page: 1 })
      );

      // Optimistically add the new product to the cache
      queryClient.setQueryData(
        queryKeys.products.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;
          
          const optimisticProduct = {
            data: {
              id: `temp-${Date.now()}`,
              ...newProduct,
              lastUpdated: new Date().toISOString(),
              _optimistic: true, // Mark as optimistic
            },
          };

          return {
            ...old,
            data: [optimisticProduct.data, ...old.data.slice(0, 19)],
            total: old.total + 1,
          };
        }
      );

      // Return context for rollback
      return { previousProducts };
    },

    // On success, replace optimistic with real data
    onSuccess: (result) => {
      queryClient.setQueryData(
        queryKeys.products.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            data: old.data.map((p: Product & { _optimistic?: boolean }) =>
              p._optimistic ? result.data : p
            ),
          };
        }
      );
      
      // Also invalidate to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },

    // On error, rollback to previous state
    onError: (_err, _variables, context) => {
      if (context?.previousProducts) {
        queryClient.setQueryData(
          queryKeys.products.lists({ page: 1 }),
          context.previousProducts
        );
      }
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) =>
      productsApi.update(id, data),

    // Optimistic update
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });

      const previousData = queryClient.getQueryData(
        queryKeys.products.lists({ page: 1 })
      );

      // Update in list cache
      queryClient.setQueryData(
        queryKeys.products.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            data: old.data.map((p: Product) =>
              p.id === id ? { ...p, ...data, _optimistic: true } : p
            ),
          };
        }
      );

      // Update in detail cache
      queryClient.setQueryData(
        queryKeys.products.detail(id),
        (old: any) => {
          if (!old) return old;
          return {
            data: { ...old.data, ...data, _optimistic: true },
          };
        }
      );

      return { previousData };
    },

    onSuccess: (result) => {
      // Replace optimistic with real data
      queryClient.setQueryData(
        queryKeys.products.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;
          return {
            ...old,
            data: old.data.map((p: Product & { _optimistic?: boolean }) =>
              p.id === result.data.id ? result.data : p
            ),
          };
        }
      );
      
      queryClient.setQueryData(
        queryKeys.products.detail(result.data.id),
        result
      );
    },

    onError: (_err, _variables, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.products.lists({ page: 1 }),
          context.previousData
        );
      }
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: productsApi.delete,

    // Optimistic delete
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });

      const previousData = queryClient.getQueryData(
        queryKeys.products.lists({ page: 1 })
      );

      queryClient.setQueryData(
        queryKeys.products.lists({ page: 1 }),
        (old: any) => {
          if (!old) return old;
          
          return {
            ...old,
            data: old.data.filter((p: Product) => p.id !== id),
            total: old.total - 1,
          };
        }
      );

      return { previousData };
    },

    onError: (_err, _id, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(
          queryKeys.products.lists({ page: 1 }),
          context.previousData
        );
      }
    },

    onSettled: () => {
      // Always refetch after error or success to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}
