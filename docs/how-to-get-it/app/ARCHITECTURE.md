# Instant-Load ERP Architecture

This document explains the architecture patterns used to achieve near-zero loading times in this ERP demo.

## Table of Contents

1. [The Core Principle](#the-core-principle)
2. [Architecture Overview](#architecture-overview)
3. [The 5 Key Techniques](#the-5-key-techniques)
   - [1. App Shell Pattern](#1-app-shell-pattern)
   - [2. Client-Side Data Caching](#2-client-side-data-caching)
   - [3. Prefetching](#3-prefetching)
   - [4. Optimistic Updates](#4-optimistic-updates)
   - [5. WebSocket Real-Time Sync](#5-websocket-real-time-sync)
4. [Performance Configuration](#performance-configuration)
5. [Running the Demo](#running-the-demo)

---

## The Core Principle

**Load Once, Never Reload**

The trick is your app should feel like a desktop application, not a website. Everything after the initial load should be instant.

### Traditional ERP vs Instant-Load ERP

```
Traditional ERP:
Click "Products" → white screen → loading spinner (1-2s) → page renders
                    ↑
            Layout reloads every time

Instant-Load ERP:
Click "Products" → content swaps INSTANTLY (data was prefetched on hover)
            ↑
    Layout NEVER reloads, only content changes
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Browser (Single Page Application)                      │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Module      │  │ Data Cache   │  │ WebSocket     │  │
│  │ Cache       │  │ (TanStack    │  │ (real-time    │  │
│  │ (lazy       │  │  Query)      │  │  updates)     │  │
│  │  loaded)    │  │              │  │               │  │
│  └──────┬──────┘  └──────┬───────┘  └───────┬───────┘  │
│         │                │                   │          │
│  ┌──────┴────────────────┴───────────────────┴───────┐  │
│  │              App Shell (always loaded)             │  │
│  │   Sidebar + Header + Layout = NEVER reloads       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────┬───────────────────────────────────┘
                      │ API calls + WebSocket
                      ▼
┌─────────────────────────────────────────────────────────┐
│  Server (Node.js + Express)                             │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ REST API    │  │ WebSocket    │  │ In-Memory     │  │
│  │ (tRPC/REST) │  │ Server       │  │ Database      │  │
│  └─────────────┘  └──────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## The 5 Key Techniques

### 1. App Shell Pattern

**The layout NEVER reloads on navigation.**

```tsx
// AppShell.tsx - This component loads once and stays forever
export function AppShell({ children, currentView, onViewChange }) {
  return (
    <div className="flex h-screen">
      {/* Sidebar - always visible, never reloads */}
      <Sidebar currentView={currentView} onViewChange={onViewChange} />
      
      <div className="flex-1 flex flex-col">
        {/* Header - always visible, never reloads */}
        <Header />
        
        {/* ONLY this part changes */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

**Why this matters:**
- No white flash between page transitions
- Sidebar state persists (collapsed/expanded)
- Header notifications stay visible
- Feels like a desktop app

---

### 2. Client-Side Data Caching

**Use TanStack Query to cache all API data.**

```tsx
// hooks/useProducts.ts
export function useProducts(options = {}) {
  return useQuery({
    queryKey: ['products', options],  // Unique key for this query
    queryFn: () => fetchProducts(options),
    
    // Data stays "fresh" for 2 minutes - no refetching needed
    staleTime: 2 * 60 * 1000,
    
    // Keep data in cache for 30 minutes even when not used
    gcTime: 30 * 60 * 1000,
    
    // Don't refetch on mount if data is fresh
    refetchOnMount: false,
  });
}
```

**What happens:**
```
1st visit to Products:  Fetch from server → show data → cache it
2nd visit to Products:  Read from cache → INSTANT, no network request!
```

**Cache invalidation strategies:**
```tsx
// Invalidate specific queries
queryClient.invalidateQueries({ queryKey: ['products'] });

// Invalidate multiple related queries
queryClient.invalidateQueries({ 
  queryKey: ['products'],
  exact: false  // Matches all product-related queries
});
```

---

### 3. Prefetching

**Load data BEFORE the user clicks.**

```tsx
// AppShell.tsx - Prefetch on hover
function NavLink({ href, module, children }) {
  const queryClient = useQueryClient();
  
  const handleMouseEnter = () => {
    // Start fetching data on HOVER
    if (module === 'products') {
      queryClient.prefetchQuery({
        queryKey: ['products', { page: 1 }],
        queryFn: () => fetchProducts({ page: 1 }),
        staleTime: 1 * 60 * 1000,
      });
    }
  };

  return (
    <Link 
      href={href} 
      onMouseEnter={handleMouseEnter}  // ← Magic happens here
    >
      {children}
    </Link>
  );
}
```

**The experience:**
```
User hovers over "Products" → data starts fetching
User clicks "Products"      → data already in cache → INSTANT load!
```

**Prefetching strategies:**
1. **On hover** - Start fetching when user hovers over link
2. **On viewport entry** - Prefetch when link scrolls into view
3. **After initial load** - Prefetch likely next pages
4. **On idle** - Use requestIdleCallback to prefetch when browser is idle

---

### 4. Optimistic Updates

**Update the UI INSTANTLY before server confirms.**

```tsx
// hooks/useProducts.ts
export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createProductAPI,
    
    // Called immediately when mutation starts
    onMutate: async (newProduct) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['products'] });
      
      // Snapshot previous value for rollback
      const previousProducts = queryClient.getQueryData(['products']);
      
      // Optimistically add to cache
      queryClient.setQueryData(['products'], (old) => ({
        ...old,
        data: [
          { 
            ...newProduct, 
            id: `temp-${Date.now()}`,  // Temporary ID
            _optimistic: true           // Mark as pending
          },
          ...old.data
        ]
      }));
      
      return { previousProducts };  // Context for rollback
    },
    
    // On success, replace temp with real data
    onSuccess: (serverData, variables, context) => {
      queryClient.setQueryData(['products'], (old) => ({
        ...old,
        data: old.data.map(p => 
          p._optimistic ? serverData : p
        )
      }));
    },
    
    // On error, rollback to previous state
    onError: (err, variables, context) => {
      queryClient.setQueryData(['products'], context.previousProducts);
      toast.error('Failed to create product');
    },
  });
}
```

**The experience:**
```
Without optimistic:
  Click Save → spinner 500ms → item appears in table

With optimistic:
  Click Save → item appears INSTANTLY → server syncs in background
```

---

### 5. WebSocket Real-Time Sync

**Data syncs automatically when other users make changes.**

```tsx
// hooks/useRealtimeSync.ts
export function useRealtimeSync() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const ws = new WebSocket('wss://your-erp.com/ws');
    
    ws.onmessage = (event) => {
      const { type, table, data } = JSON.parse(event.data);
      
      if (type === 'DATA_CHANGED') {
        // Invalidate the relevant cache
        queryClient.invalidateQueries({ 
          queryKey: [table],
          refetchType: 'active'  // Only refetch active queries
        });
      }
    };
    
    return () => ws.close();
  }, []);
}
```

**Server-side broadcast:**
```javascript
// server.js
app.post('/api/products', async (req, res) => {
  const newProduct = await db.products.create(req.body);
  
  // Broadcast to all connected clients
  broadcast({
    type: 'DATA_CHANGED',
    table: 'products',
    action: 'CREATE',
    data: newProduct
  });
  
  res.json(newProduct);
});
```

**The experience:**
```
User A adds a product    → Server broadcasts update
User B sees it instantly → No refresh needed!
```

---

## Performance Configuration

### TanStack Query Config

```tsx
// main.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data stays fresh for 5 minutes
      staleTime: 5 * 60 * 1000,
      
      // Keep in cache for 30 minutes
      gcTime: 30 * 60 * 1000,
      
      // Retry failed requests
      retry: 3,
      retryDelay: (attemptIndex) => 
        Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Refetch on window focus (keeps data fresh)
      refetchOnWindowFocus: true,
      
      // Don't refetch on mount if fresh
      refetchOnMount: false,
    },
  },
});
```

### Query Key Factory

```tsx
// lib/queryKeys.ts
export const queryKeys = {
  products: {
    all: ['products'] as const,
    lists: (filters) => ['products', 'list', filters] as const,
    detail: (id) => ['products', 'detail', id] as const,
  },
  salesOrders: {
    all: ['sales-orders'] as const,
    lists: (filters) => ['sales-orders', 'list', filters] as const,
  },
};
```

---

## Running the Demo

### 1. Start the Server

```bash
# Terminal 1
node server/index.js

# Server will start on http://localhost:3001
```

### 2. Start the Client

```bash
# Terminal 2
npm run dev

# Client will start on http://localhost:5173
```

### 3. Test the Features

1. **Zero-loading navigation:**
   - Hover over sidebar items
   - Click - page loads instantly!

2. **Optimistic updates:**
   - Add a new product
   - See it appear instantly with "Saving..." indicator

3. **Real-time sync:**
   - Open two browser windows
   - Add a product in one window
   - See it appear in the other window automatically

---

## Implementation Priority

For your own ERP, implement in this order for maximum impact:

1. **TanStack Query caching** - Eliminates 80% of loading, ~1 day to integrate
2. **App Shell pattern** - You probably already have this with layouts
3. **Prefetch on hover** - Add to sidebar links, ~2 hours
4. **Optimistic updates** - Implement per-mutation, ongoing as you build
5. **WebSocket real-time** - Add last, only needed for multi-user scenarios

---

## Additional Optimizations

### Virtualization for Large Lists

```tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function ProductList({ products }) {
  const parentRef = useRef();
  
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 50,
  });
  
  return (
    <div ref={parentRef} style={{ height: '500px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map((item) => (
          <div key={item.key} style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${item.size}px`,
            transform: `translateY(${item.start}px)`,
          }}>
            {products[item.index].name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Pagination with Infinite Scroll

```tsx
export function useInfiniteProducts() {
  return useInfiniteQuery({
    queryKey: ['products', 'infinite'],
    queryFn: ({ pageParam = 1 }) => 
      fetchProducts({ page: pageParam }),
    getNextPageParam: (lastPage) => 
      lastPage.hasMore ? lastPage.nextPage : undefined,
  });
}
```

---

## Conclusion

This architecture gives you:

- ✅ **Zero-loading navigation** - Pages load instantly from cache
- ✅ **Optimistic UI** - Actions feel immediate
- ✅ **Real-time sync** - Multi-user collaboration
- ✅ **Offline resilience** - Cache persists, retries automatically
- ✅ **Desktop app feel** - No page reloads ever

The key insight: **Treat your web app like a desktop app that happens to run in a browser.**
