import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { statsApi } from '@/lib/api';

// ============================================
// STATS HOOKS
// ============================================
// Dashboard stats with prefetching
// ============================================

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats.dashboard(),
    queryFn: statsApi.getDashboard,
    // Stats can be cached longer (5 minutes)
    staleTime: 5 * 60 * 1000,
    // Refetch every 30 seconds in background
    refetchInterval: 30 * 1000,
  });
}

export function usePrefetchStats() {
  const queryClient = useQueryClient();

  return {
    prefetchStats: () => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.stats.dashboard(),
        queryFn: statsApi.getDashboard,
        staleTime: 2 * 60 * 1000,
      });
    },
  };
}
