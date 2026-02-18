# Instant-Load ERP Installation Guide

How to add zero-loading navigation to your existing ERP.

---

## Step 1: Install Dependencies

```bash
npm install @tanstack/react-query
npm install zustand  # optional, for global state
```

---

## Step 2: Setup TanStack Query

**main.tsx**
```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // Data fresh for 5 min
      gcTime: 30 * 60 * 1000,        // Keep in cache 30 min
      refetchOnWindowFocus: true,
      refetchOnMount: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>,
);
```

---

## Step 3: Create Query Keys

**lib/queryKeys.ts**
```tsx
export const queryKeys = {
  products: {
    all: ['products'] as const,
    lists: (filters?: any) => ['products', 'list', filters],
    detail: (id: string) => ['products', 'detail', id],
  },
  sales: {
    all: ['sales'] as const,
    lists: (filters?: any) => ['sales', 'list', filters],
  },
};
```

---

## Step 4: Create Data Hooks

**hooks/useProducts.ts**
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';

// Fetch with caching
export function useProducts(filters?: any) {
  return useQuery({
    queryKey: queryKeys.products.lists(filters),
    queryFn: () => fetch('/api/products').then(r => r.json()),
    staleTime: 2 * 60 * 1000,
  });
}

// Prefetch for instant navigation
export function usePrefetchProducts() {
  const queryClient = useQueryClient();
  
  return {
    prefetch: (filters?: any) => {
      queryClient.prefetchQuery({
        queryKey: queryKeys.products.lists(filters),
        queryFn: () => fetch('/api/products').then(r => r.json()),
        staleTime: 1 * 60 * 1000,
      });
    },
  };
}

// Optimistic create
export function useCreateProduct() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data) => fetch('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(r => r.json()),
    
    onMutate: async (newProduct) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.products.all });
      const previous = queryClient.getQueryData(queryKeys.products.lists());
      
      // Optimistically add
      queryClient.setQueryData(
        queryKeys.products.lists(),
        (old: any) => ({
          ...old,
          data: [{ ...newProduct, id: 'temp', _optimistic: true }, ...old.data],
        })
      );
      
      return { previous };
    },
    
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(queryKeys.products.lists(), context?.previous);
    },
    
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all });
    },
  });
}
```

---

## Step 5: Add Prefetching to Navigation

**components/Sidebar.tsx**
```tsx
import { usePrefetchProducts } from '@/hooks/useProducts';
import { usePrefetchSales } from '@/hooks/useSales';

function Sidebar() {
  const { prefetch: prefetchProducts } = usePrefetchProducts();
  const { prefetch: prefetchSales } = usePrefetchSales();
  
  const navItems = [
    { label: 'Products', href: '/products', prefetch: prefetchProducts },
    { label: 'Sales', href: '/sales', prefetch: prefetchSales },
  ];
  
  return (
    <nav>
      {navItems.map((item) => (
        <Link
          key={item.href}
          to={item.href}
          onMouseEnter={item.prefetch}  // ← Prefetch on hover!
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

---

## Step 6: App Shell (Layout Never Reloads)

**App.tsx**
```tsx
function App() {
  return (
    <div className="flex h-screen">
      {/* Sidebar - always visible, never reloads */}
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        {/* Header - always visible, never reloads */}
        <Header />
        
        {/* Only this changes */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/products" element={<ProductsView />} />
            <Route path="/sales" element={<SalesView />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
```

---

## Step 7: Add WebSocket Real-Time Sync (Optional)

**hooks/useRealtimeSync.ts**
```tsx
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export function useRealtimeSync() {
  const queryClient = useQueryClient();
  
  useEffect(() => {
    const ws = new WebSocket('ws://your-api.com/ws');
    
    ws.onmessage = (event) => {
      const { type, table } = JSON.parse(event.data);
      
      if (type === 'DATA_CHANGED') {
        queryClient.invalidateQueries({ queryKey: [table] });
      }
    };
    
    return () => ws.close();
  }, []);
}
```

**In your App:**
```tsx
function App() {
  useRealtimeSync();  // Add this
  
  return (
    // ... your layout
  );
}
```

---

## Server-Side: WebSocket Broadcast

**server.js**
```javascript
const WebSocket = require('ws');
const wss = new WebSocket.Server({ server });

function broadcast(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

// When data changes, broadcast to all clients
app.post('/api/products', async (req, res) => {
  const product = await db.products.create(req.body);
  
  broadcast({
    type: 'DATA_CHANGED',
    table: 'products',
    data: product,
  });
  
  res.json(product);
});
```

---

## Quick Checklist

- [ ] Install `@tanstack/react-query`
- [ ] Create `QueryClient` with `staleTime: 5min`
- [ ] Create `queryKeys` factory
- [ ] Create data hooks with `useQuery`
- [ ] Add `usePrefetchXxx` hooks
- [ ] Add `onMouseEnter={prefetch}` to navigation
- [ ] Wrap app in App Shell (sidebar/header never reload)
- [ ] Add optimistic updates to mutations (optional)
- [ ] Add WebSocket sync (optional)

---

## Result

| Before | After |
|--------|-------|
| Click → Spinner (1-2s) → Page | Click → INSTANT (prefetched) |
| Save → Wait → UI updates | Save → UI updates → Server syncs |
| Refresh to see others' changes | Real-time automatic updates |
