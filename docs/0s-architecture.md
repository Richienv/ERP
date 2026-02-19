# Zero-Second ERP — What's Next After Core 5

> You've implemented: TanStack Query + Persist, Prefetch after login, Service Worker, Incremental sync, Prefetch on hover.
> This guide covers **everything commonly missed** that breaks the zero-second experience.

---

## Current State Assessment

```
✅ Done                          ❓ Likely Missing
─────────────────────────────    ─────────────────────────────
TanStack Query + IndexedDB       Skeleton UI / Suspense boundaries
Prefetch all data after login    Optimistic mutations
Service Worker caching           Virtualized tables
Incremental sync endpoint        Pagination cache strategy
Prefetch on sidebar hover        Offline-ready error handling
                                 Bundle splitting done RIGHT
                                 Database query optimization
                                 Connection pooling
                                 WebSocket real-time sync
                                 Loading state choreography
```

---

## Part 1: Client-Side Gaps (What Users Actually Feel)

### 1.1 Skeleton UI — Kill the White Flash

**Problem:** Even with cached data, React needs ~50-100ms to hydrate. During that time users see a white flash or layout shift. This FEELS like loading even though it's fast.

**Fix:** Every page needs a skeleton that matches the exact layout.

```tsx
// components/skeletons/TableSkeleton.tsx
export function TableSkeleton({ rows = 10, columns = 5 }) {
  return (
    <div className="animate-pulse">
      {/* Header */}
      <div className="flex gap-4 mb-4">
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-4 bg-gray-200 rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 py-3 border-b">
          {Array.from({ length: columns }).map((_, j) => (
            <div key={j} className="h-4 bg-gray-100 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
```

```tsx
// app/inventory/products/page.tsx
import { Suspense } from 'react'

export default function ProductsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={15} columns={6} />}>
      <ProductsTable />
    </Suspense>
  )
}
```

**Rule:** Skeleton should appear for MAX 100ms. If it shows longer, something is wrong with your cache.

---

### 1.2 Optimistic Mutations — Every Write Must Be Instant

**Problem:** User clicks "Tambah Produk", fills form, clicks Save → waits 500ms-2s for server response. This is the #1 thing that makes ERPs feel slow.

**Fix:** Update UI BEFORE server responds. Every mutation needs this pattern.

```tsx
// hooks/mutations/useCreateProduct.ts
export function useCreateProduct() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateProductInput) => api.post('/products', data),

    onMutate: async (newProduct) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['products'] })

      // Snapshot current data for rollback
      const previous = queryClient.getQueryData<Product[]>(['products'])

      // Optimistically add to cache with temp ID
      const optimisticProduct: Product = {
        ...newProduct,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        _status: 'saving', // UI can show subtle indicator
      }

      queryClient.setQueryData<Product[]>(['products'], (old = []) => [
        optimisticProduct,
        ...old,
      ])

      return { previous }
    },

    onSuccess: (serverProduct) => {
      // Replace optimistic entry with real server data
      queryClient.setQueryData<Product[]>(['products'], (old = []) =>
        old.map((p) => (p._status === 'saving' ? serverProduct : p))
      )
    },

    onError: (_err, _vars, context) => {
      // Rollback on failure
      if (context?.previous) {
        queryClient.setQueryData(['products'], context.previous)
      }
      toast.error('Gagal menyimpan. Coba lagi.')
    },
  })
}
```

**Apply this to ALL mutations:**
- Create product, customer, supplier, order, journal entry
- Update status (draft → confirmed → completed)
- Delete / archive records
- Inline cell edits on tables

---

### 1.3 Virtualized Tables — Don't Render 1000 Rows

**Problem:** Inventory might have 5,000 products. Rendering all of them in a table freezes the browser for 200-500ms. Users feel this as "page jank".

**Fix:** Only render the ~20 rows visible on screen.

```bash
npm install @tanstack/react-virtual
```

```tsx
// components/VirtualTable.tsx
import { useVirtualizer } from '@tanstack/react-virtual'

export function VirtualTable<T>({
  data,
  columns,
  rowHeight = 48,
}: {
  data: T[]
  columns: ColumnDef<T>[]
  rowHeight?: number
}) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10, // render 10 extra rows above/below viewport
  })

  return (
    <div ref={parentRef} className="h-[600px] overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = data[virtualRow.index]
          return (
            <div
              key={virtualRow.index}
              className="absolute w-full flex items-center border-b"
              style={{
                height: `${rowHeight}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {columns.map((col) => (
                <div key={col.id} className="flex-1 px-3">
                  {col.cell(row)}
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

**Impact:** Rendering 5,000 rows → from 400ms to 5ms. Scrolling stays at 60fps.

---

### 1.4 Pagination Cache Strategy

**Problem:** You cached page 1 of sales orders. User goes to page 2 → loading spinner. Goes back to page 1 → another loading spinner (even though you had it).

**Fix:** Cache each page separately AND prefetch the next page.

```tsx
// hooks/usePaginatedData.ts
export function usePaginatedOrders(page: number) {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: ['sales-orders', { page }],
    queryFn: () => api.get(`/sales-orders?page=${page}&limit=50`),
    placeholderData: keepPreviousData, // Show old page while new loads
  })

  // Prefetch next page in background
  useEffect(() => {
    if (query.data?.hasNextPage) {
      queryClient.prefetchQuery({
        queryKey: ['sales-orders', { page: page + 1 }],
        queryFn: () => api.get(`/sales-orders?page=${page + 1}&limit=50`),
      })
    }
  }, [page, query.data])

  return query
}
```

**Key option:** `placeholderData: keepPreviousData` — this shows the current page data while the next page loads, so there's never a blank table.

---

### 1.5 Route Transition Animation

**Problem:** Even when navigation is instant, an abrupt content swap feels jarring. Users need visual feedback that something changed.

**Fix:** Add a subtle fade/slide transition between pages.

```tsx
// components/PageTransition.tsx
'use client'
import { motion, AnimatePresence } from 'framer-motion'
import { usePathname } from 'next/navigation'

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }} // 150ms — fast enough to feel instant
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

// Use in layout.tsx
<main>
  <PageTransition>
    {children}
  </PageTransition>
</main>
```

---

## Part 2: Server-Side Gaps (What Makes API Calls Slow)

### 2.1 Database Indexes — The #1 Server Performance Fix

**Problem:** Your Prisma queries hit full table scans. A simple `SELECT * FROM "Product" WHERE "tenantId" = '...'` on 10,000 rows takes 200ms without index.

**Fix:** Add indexes to EVERY column you filter/sort by.

```prisma
// schema.prisma — Add these indexes

model Product {
  id         String   @id @default(cuid())
  sku        String
  name       String
  categoryId String?
  status     String   @default("ACTIVE")
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // CRITICAL INDEXES
  @@index([status])               // filter by active/inactive
  @@index([categoryId])           // filter by category
  @@index([sku])                  // search by SKU
  @@index([updatedAt])            // incremental sync queries
  @@index([name])                 // search/sort by name
}

model SalesOrder {
  id         String   @id @default(cuid())
  orderNo    String
  customerId String
  status     String   @default("DRAFT")
  orderDate  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([status])
  @@index([customerId])
  @@index([orderDate])
  @@index([updatedAt])            // incremental sync
  @@index([status, orderDate])    // compound: "all confirmed orders this month"
}

model StockMovement {
  id          String   @id @default(cuid())
  productId   String
  warehouseId String
  type        String   // IN, OUT, TRANSFER
  quantity    Int
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([productId])
  @@index([warehouseId])
  @@index([productId, warehouseId])  // compound: stock per product per warehouse
  @@index([type, createdAt])         // compound: recent movements by type
  @@index([updatedAt])
}

// IMPORTANT: Every table that uses incremental sync MUST have
// @@index([updatedAt])
```

```bash
# Apply indexes
npx prisma migrate dev --name add_performance_indexes
```

**Impact:** Queries drop from 200-500ms → 1-10ms.

---

### 2.2 API Response Shape — Send Only What the Client Needs

**Problem:** Your `/products` endpoint returns EVERYTHING including relations, blobs, and fields the table doesn't show. 50 products × 40 fields = huge payload.

**Fix:** Use `select` in Prisma and create lean API responses.

```typescript
// BAD — returns everything
const products = await prisma.product.findMany()

// GOOD — returns only what the table needs
const products = await prisma.product.findMany({
  select: {
    id: true,
    sku: true,
    name: true,
    status: true,
    category: { select: { name: true } },
    _count: { select: { stockMovements: true } },
    updatedAt: true,
  },
  orderBy: { updatedAt: 'desc' },
  take: 100,
})
```

**For detail views:** Fetch full data only when user clicks into a specific record.

```tsx
// List view: lean data (cached)
useQuery({ queryKey: ['products'], queryFn: fetchProductList })

// Detail view: full data (fetched on demand)
useQuery({ queryKey: ['product', productId], queryFn: () => fetchProductDetail(productId) })
```

---

### 2.3 Connection Pooling (PgBouncer)

**Problem:** Each Next.js container opens multiple PostgreSQL connections. With 10 tenants × 5 connections = 50 connections. PostgreSQL default max is 100. You'll hit limits fast.

**Fix:** Add PgBouncer to your Docker Compose.

```yaml
# docker-compose.yml
services:
  pgbouncer:
    image: edoburu/pgbouncer:latest
    environment:
      DATABASE_URL: postgresql://erp_admin:PASSWORD@postgres:5432
      MAX_CLIENT_CONN: 300
      DEFAULT_POOL_SIZE: 20
      POOL_MODE: transaction
    ports:
      - "6432:6432"
    depends_on:
      - postgres

# Then each tenant connects through PgBouncer:
# DATABASE_URL=postgresql://erp_admin:PASSWORD@pgbouncer:6432/erp_client_xxx
```

---

### 2.4 Incremental Sync Optimization

Your sync endpoint needs to be FAST since it runs on every refresh. Common mistakes:

```typescript
// BAD — queries every table separately
const products = await prisma.product.findMany({ where: { updatedAt: { gt: since } } })
const orders = await prisma.salesOrder.findMany({ where: { updatedAt: { gt: since } } })
const customers = await prisma.customer.findMany({ where: { updatedAt: { gt: since } } })
// 10 separate queries = 10 round trips

// GOOD — single transaction, parallel execution
const [products, orders, customers] = await prisma.$transaction([
  prisma.product.findMany({ where: { updatedAt: { gt: since } }, select: leanSelect }),
  prisma.salesOrder.findMany({ where: { updatedAt: { gt: since } }, select: leanSelect }),
  prisma.customer.findMany({ where: { updatedAt: { gt: since } }, select: leanSelect }),
])

// BETTER — also include count so client knows if full sync is needed
const changeCount = await prisma.$transaction([
  prisma.product.count({ where: { updatedAt: { gt: since } } }),
  prisma.salesOrder.count({ where: { updatedAt: { gt: since } } }),
])

// If too many changes (e.g., after migration), tell client to do full refetch
const totalChanges = changeCount.reduce((a, b) => a + b, 0)
if (totalChanges > 500) {
  return { fullSync: true, reason: 'too_many_changes' }
}
```

---

## Part 3: Common Killers People Forget

### 3.1 Bundle Size — Your JS Might Be Too Big

**Problem:** Even with Service Worker, the initial parse/execute of JavaScript can take 1-3 seconds on mobile if your bundle is 2MB+.

**Check your bundle:**
```bash
npx next build
npx @next/bundle-analyzer
```

**Fix:**

```typescript
// next.config.js
module.exports = {
  // Enable bundle analyzer
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@tanstack/react-table',
      'date-fns',
      'lodash',
    ],
  },
}
```

```tsx
// Lazy load heavy components
const ReportChart = dynamic(() => import('@/components/ReportChart'), {
  loading: () => <ChartSkeleton />,
  ssr: false,
})

const PDFExport = dynamic(() => import('@/components/PDFExport'), {
  ssr: false, // don't include in initial bundle at all
})
```

**Target:** Main bundle < 200KB gzipped. Each route chunk < 50KB.

---

### 3.2 Image/Asset Optimization

**Problem:** Product images, company logos, document attachments load slowly and aren't cached properly.

**Fix:**
```tsx
// Use next/image for all images (auto-optimizes)
import Image from 'next/image'

<Image
  src={product.imageUrl}
  width={80}
  height={80}
  loading="lazy"            // don't block page load
  placeholder="blur"        // show blur while loading
  blurDataURL={product.thumbnailBase64} // tiny base64 preview
/>
```

```typescript
// For product images, generate tiny thumbnails server-side
// Store both original and 10x10 blur hash in database
model Product {
  imageUrl       String?
  imageBlurhash  String?  // tiny ~50 byte base64 placeholder
}
```

---

### 3.3 Stale-While-Revalidate Strategy

**Problem:** After 5 minutes, TanStack Query marks data as "stale" and refetches. During refetch, users might see a loading spinner AGAIN.

**Fix:** Configure to ALWAYS show cached data, refetch silently in background.

```typescript
// lib/query-client.ts
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,      // fresh for 5 min
      gcTime: 24 * 60 * 60 * 1000,   // keep 24 hours

      // THE KEY SETTINGS:
      refetchOnWindowFocus: 'always',  // sync when user comes back to tab
      refetchOnMount: true,            // re-sync on navigate
      placeholderData: keepPreviousData, // never show empty state

      // Custom: always show cached, update silently
      networkMode: 'offlineFirst',     // use cache first, even offline
    },
  },
})
```

---

### 3.4 Handle Deletions in Sync

**Problem:** Your sync endpoint sends updated records, but what about DELETED records? The client cache still has them.

**Fix:** Use soft deletes and include them in sync.

```prisma
model Product {
  // ... other fields
  deletedAt DateTime?  // null = active, timestamp = soft deleted

  @@index([deletedAt])
  @@index([updatedAt])
}
```

```typescript
// Sync endpoint includes soft-deleted records
const changes = await prisma.product.findMany({
  where: { updatedAt: { gt: since } }, // includes soft-deleted ones
  select: { id: true, deletedAt: true, ...otherFields },
})

// Client-side: filter out deleted records
queryClient.setQueryData<Product[]>(['products'], (old = []) => {
  const map = new Map(old.map((p) => [p.id, p]))
  for (const change of changes.products) {
    if (change.deletedAt) {
      map.delete(change.id) // remove from cache
    } else {
      map.set(change.id, change) // update/add
    }
  }
  return Array.from(map.values())
})
```

---

### 3.5 Auth Token Refresh — Silent and Non-Blocking

**Problem:** Supabase JWT expires (default 1 hour). If refresh fails or is slow, user suddenly can't make API calls. Feels like the app "broke".

**Fix:**

```typescript
// lib/auth.ts
export function setupAuthRefresh() {
  const supabase = createClient()

  // Supabase handles refresh automatically, but set up error handling
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED') {
      // Update API client headers silently
      api.defaults.headers['Authorization'] = `Bearer ${session?.access_token}`
    }

    if (event === 'SIGNED_OUT') {
      // Clear all caches and redirect
      queryClient.clear()
      indexedDBClear()
      window.location.href = '/login'
    }
  })

  // Proactive refresh: refresh 5 minutes before expiry
  setInterval(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      const expiresAt = session.expires_at! * 1000
      const fiveMinutes = 5 * 60 * 1000
      if (Date.now() > expiresAt - fiveMinutes) {
        await supabase.auth.refreshSession()
      }
    }
  }, 60 * 1000) // check every minute
}
```

---

### 3.6 Error Recovery — Don't Break the Flow

**Problem:** Network blip during a mutation → error toast → user has to redo the entire action. Breaks the "instant" illusion.

**Fix:** Auto-retry mutations and queue them when offline.

```typescript
// lib/query-client.ts — Global mutation retry
export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),

      // If mutation fails and user goes offline, retry when online
      networkMode: 'offlineFirst',
    },
  },
})
```

```tsx
// components/OfflineIndicator.tsx
export function OfflineIndicator() {
  const [online, setOnline] = useState(navigator.onLine)

  useEffect(() => {
    const goOnline = () => setOnline(true)
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  if (online) return null

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50">
      Anda sedang offline. Perubahan akan disimpan saat koneksi kembali.
    </div>
  )
}
```

---

## Part 4: Performance Monitoring

### Set Up Metrics to Prove Zero-Second

```typescript
// lib/performance.ts
export function trackPageMetrics() {
  if (typeof window === 'undefined') return

  // Track route change duration
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.entryType === 'navigation') {
        console.log(`[Perf] Page load: ${entry.duration}ms`)
      }
    }
  })
  observer.observe({ entryTypes: ['navigation', 'paint'] })

  // Track Time to Interactive for each page
  window.addEventListener('load', () => {
    const [paint] = performance.getEntriesByType('paint')
    if (paint) {
      console.log(`[Perf] First Paint: ${paint.startTime}ms`)
    }
  })
}

// Track cache hit rates
export function trackCacheMetrics(queryClient: QueryClient) {
  const cache = queryClient.getQueryCache()

  cache.subscribe((event) => {
    if (event.type === 'updated' && event.query.state.status === 'success') {
      const fromCache = event.query.state.dataUpdatedAt < Date.now() - 100
      console.log(
        `[Cache] ${event.query.queryKey}: ${fromCache ? 'HIT' : 'FETCH'}`
      )
    }
  })
}
```

### Target Metrics

| Metric | Target | Acceptable | Needs Fix |
|--------|--------|------------|-----------|
| Route change (cached) | < 50ms | < 150ms | > 300ms |
| Route change (first visit) | < 200ms | < 500ms | > 1s |
| Table render (100 rows) | < 30ms | < 100ms | > 200ms |
| Table render (5000 rows virtualized) | < 50ms | < 100ms | > 200ms |
| Mutation (optimistic) | < 10ms | < 50ms | > 100ms |
| Page refresh (from cache) | < 300ms | < 800ms | > 1.5s |
| Sync check (delta) | < 100ms | < 300ms | > 500ms |
| Initial load (first login) | < 5s | < 8s | > 12s |

---

## Implementation Priority Checklist

### Tier 1 — Do This Week (Biggest Impact)

- [ ] **Optimistic mutations** on all create/update/delete operations
- [ ] **Database indexes** on all `updatedAt`, foreign keys, and filter columns
- [ ] **Skeleton UI** on every page (match exact layout)
- [ ] **Lean API responses** — use Prisma `select`, don't return entire records
- [ ] **`placeholderData: keepPreviousData`** on all paginated queries

### Tier 2 — Do Next Week (Polish)

- [ ] **Virtualized tables** for products, stock movements, journal entries
- [ ] **Prefetch next pagination page** automatically
- [ ] **Soft deletes** + include in sync endpoint
- [ ] **Route transition animation** (150ms fade)
- [ ] **Auth token proactive refresh**

### Tier 3 — Do Before Launch (Reliability)

- [ ] **PgBouncer** connection pooling in Docker Compose
- [ ] **Bundle analysis** — ensure < 200KB gzipped main bundle
- [ ] **Offline indicator** + mutation retry queue
- [ ] **Performance monitoring** — track all metrics above
- [ ] **Service Worker versioning** — bust cache on deploy

### Tier 4 — Do After First Client (Scale)

- [ ] **WebSocket real-time sync** (for multi-user editing)
- [ ] **CDN for static assets** (Cloudflare)
- [ ] **Database read replicas** (when >20 tenants)
- [ ] **Redis cache layer** for frequently accessed data
- [ ] **Load testing** with realistic data volumes

---

## Quick Reference: The Zero-Second Stack

```
Browser Layer:
├── Service Worker          → pages load without network
├── IndexedDB (TanStack)    → data survives refresh
├── Optimistic Mutations    → writes feel instant
├── Virtual Tables          → large lists render fast
├── Skeleton UI             → no white flash ever
├── Prefetch on Hover       → data ready before click
└── Route Transitions       → smooth visual feedback

API Layer:
├── Lean SELECT queries     → small payloads
├── Incremental sync        → only fetch changes
├── Soft deletes in sync    → cache stays accurate
└── Auth proactive refresh  → no auth interruptions

Database Layer:
├── Indexes on everything   → queries < 10ms
├── PgBouncer pooling       → handle many connections
└── $transaction for sync   → single round trip
``` 