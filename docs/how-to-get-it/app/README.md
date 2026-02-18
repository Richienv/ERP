# Instant-Load ERP Demo

A demonstration of modern ERP architecture patterns that achieve near-zero loading times.

## Features

- **Zero-loading navigation** - Pages load instantly from cache
- **Optimistic UI updates** - Actions feel immediate, no waiting
- **Real-time data sync** - WebSocket-powered multi-user collaboration
- **App Shell pattern** - Layout never reloads, only content changes
- **Intelligent prefetching** - Data loads before you click

## Quick Start

### Option 1: Run Server and Client Separately

```bash
# Terminal 1 - Start the backend server
npm run server

# Terminal 2 - Start the frontend dev server
npm run dev
```

### Option 2: Run Both Together (requires concurrently)

```bash
npm install -g concurrently
npm run dev:full
```

## Architecture

This demo implements the 5 key techniques for instant-load ERPs:

1. **App Shell Pattern** - Sidebar and header never reload
2. **Client-Side Caching** - TanStack Query caches all API data
3. **Prefetching** - Data loads on hover before you click
4. **Optimistic Updates** - UI updates instantly before server confirms
5. **WebSocket Sync** - Real-time updates across all clients

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed documentation.

## Project Structure

```
├── server/
│   └── index.js          # Express + WebSocket server
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   └── AppShell.tsx      # Never-reloading layout
│   │   ├── views/
│   │   │   ├── DashboardView.tsx
│   │   │   ├── ProductsView.tsx
│   │   │   ├── SalesOrdersView.tsx
│   │   │   └── CustomersView.tsx
│   │   ├── products/
│   │   │   └── ProductForm.tsx
│   │   └── sales/
│   │       └── SalesOrderForm.tsx
│   ├── hooks/
│   │   ├── useProducts.ts        # Products + optimistic mutations
│   │   ├── useSalesOrders.ts     # Sales orders + optimistic mutations
│   │   ├── useCustomers.ts       # Customers hook
│   │   ├── useStats.ts           # Dashboard stats
│   │   └── useRealtimeSync.ts    # WebSocket real-time sync
│   ├── lib/
│   │   ├── api.ts                # API client
│   │   └── queryKeys.ts          # Type-safe query keys
│   ├── App.tsx
│   └── main.tsx                  # QueryClient setup
└── ARCHITECTURE.md               # Detailed architecture docs
```

## Demo Flow

1. **Open the app** at http://localhost:5173
2. **Navigate between pages** - Notice instant loading (no spinners!)
3. **Hover over sidebar items** - Data prefetches in background
4. **Add a product** - See it appear instantly with "Saving..." indicator
5. **Open two browser windows** - Add a product in one, see it in the other

## Key Files to Study

### 1. App Shell Pattern
`src/components/layout/AppShell.tsx`
- Sidebar never reloads
- Prefetching on hover
- Connection status indicator

### 2. Data Caching
`src/hooks/useProducts.ts`
- Query configuration
- Prefetch functions
- Optimistic mutations

### 3. Real-Time Sync
`src/hooks/useRealtimeSync.ts`
- WebSocket connection
- Automatic reconnection
- Cache invalidation on updates

### 4. Optimistic UI
Look for `onMutate`, `onSuccess`, `onError` in mutation hooks
- Instant UI updates
- Rollback on error
- Server confirmation handling

## Technologies

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **State Management**: TanStack Query (React Query)
- **Real-Time**: WebSocket (native API)
- **Backend**: Express.js, WebSocket Server
- **Mock Data**: In-memory arrays (replace with real database)

## Performance Metrics

| Action | Traditional ERP | Instant-Load ERP |
|--------|-----------------|------------------|
| Page navigation | 1-2 seconds | 0ms (cached) |
| Add product | 500ms + spinner | Instant + background sync |
| Update status | 300ms + spinner | Instant + background sync |
| Multi-user sync | Manual refresh | Real-time |

## Next Steps for Production

1. **Add persistence layer** (PostgreSQL/MongoDB)
2. **Implement authentication** (JWT/OAuth)
3. **Add data virtualization** for large lists (@tanstack/react-virtual)
4. **Implement offline support** (service workers)
5. **Add optimistic UI for all mutations**
6. **Set up proper WebSocket scaling** (Redis adapter)

## License

MIT
