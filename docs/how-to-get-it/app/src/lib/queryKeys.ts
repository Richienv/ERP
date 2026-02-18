// ============================================
// QUERY KEY FACTORY
// ============================================
// Centralized, type-safe query key management
// This ensures consistent cache keys across the app
// and makes invalidation predictable
// ============================================

export const queryKeys = {
  // Products namespace
  products: {
    all: ['products'] as const,
    lists: (filters?: { search?: string; category?: string; page?: number }) =>
      [...queryKeys.products.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.products.all, 'detail', id] as const,
  },
  
  // Sales orders namespace
  salesOrders: {
    all: ['sales-orders'] as const,
    lists: (filters?: { status?: string; page?: number }) =>
      [...queryKeys.salesOrders.all, 'list', filters] as const,
    detail: (id: string) => [...queryKeys.salesOrders.all, 'detail', id] as const,
  },
  
  // Customers namespace
  customers: {
    all: ['customers'] as const,
    lists: (page?: number) => [...queryKeys.customers.all, 'list', page] as const,
    detail: (id: string) => [...queryKeys.customers.all, 'detail', id] as const,
  },
  
  // Stats namespace
  stats: {
    all: ['stats'] as const,
    dashboard: () => [...queryKeys.stats.all, 'dashboard'] as const,
  },
} as const;

// Type helper for query keys
export type QueryKeys = typeof queryKeys;
