# 0s Architecture Phase 2 — Remaining Gaps to 100%

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the final ~20% of the zero-second architecture: route transitions, offline indicator, service worker, performance monitoring, and virtualized tables.

**Architecture:** Add PageTransition (framer-motion) wrapping route children, OfflineIndicator fixed-position component, Service Worker for static asset caching, performance tracking via Web Vitals, and @tanstack/react-virtual for large tables.

**Tech Stack:** framer-motion 12.x (already installed), @tanstack/react-virtual (to install), Next.js 16 Service Worker, Web Vitals API

---

## Task 1: Create PageTransition component + integrate into global layout

**Files:**
- Create: `components/page-transition.tsx`
- Modify: `components/global-layout.tsx`

**Step 1: Create the PageTransition component**

Create `components/page-transition.tsx`:

```tsx
"use client"

import { motion, AnimatePresence } from "framer-motion"
import { usePathname } from "next/navigation"
import { type ReactNode } from "react"

export function PageTransition({ children }: { children: ReactNode }) {
    const pathname = usePathname()

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={pathname}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                className="flex-1 flex flex-col"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}
```

**Step 2: Integrate into global-layout.tsx**

In `components/global-layout.tsx`, wrap the `{children}` inside the main content area with `<PageTransition>`:

Find the div that wraps children:
```tsx
<div className="flex-1 overflow-auto p-4 pt-0 gap-4 flex flex-col">
    {children}
</div>
```

Replace with:
```tsx
<div className="flex-1 overflow-auto p-4 pt-0 gap-4 flex flex-col">
    <PageTransition>
        {children}
    </PageTransition>
</div>
```

Add import at top:
```tsx
import { PageTransition } from "@/components/page-transition"
```

**Step 3: Verify dev server works**

Run: `npm run dev` — navigate between 2-3 pages, confirm smooth fade transition.

**Step 4: Commit**

```bash
git add components/page-transition.tsx components/global-layout.tsx
git commit -m "feat: add PageTransition with framer-motion fade for route changes"
```

---

## Task 2: Create OfflineIndicator component + integrate into global layout

**Files:**
- Create: `components/offline-indicator.tsx`
- Modify: `components/global-layout.tsx`

**Step 1: Create the OfflineIndicator component**

Create `components/offline-indicator.tsx`:

```tsx
"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { IconWifiOff } from "@tabler/icons-react"

export function OfflineIndicator() {
    const [isOffline, setIsOffline] = useState(false)

    useEffect(() => {
        const goOffline = () => setIsOffline(true)
        const goOnline = () => setIsOffline(false)

        // Check initial state
        setIsOffline(!navigator.onLine)

        window.addEventListener("offline", goOffline)
        window.addEventListener("online", goOnline)
        return () => {
            window.removeEventListener("offline", goOffline)
            window.removeEventListener("online", goOnline)
        }
    }, [])

    return (
        <AnimatePresence>
            {isOffline && (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg border-2 border-black bg-yellow-400 px-4 py-2.5 font-sans text-sm font-medium text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                    <IconWifiOff size={18} />
                    <span>Anda sedang offline. Perubahan akan disimpan saat koneksi kembali.</span>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
```

**Step 2: Add to global-layout.tsx**

In `components/global-layout.tsx`, add `<OfflineIndicator />` right before `<CacheWarmingOverlay />`:

```tsx
import { OfflineIndicator } from "@/components/offline-indicator"
```

Inside the component, add after `</RouteGuard>` and before `<CacheWarmingOverlay />`:
```tsx
        </RouteGuard>
        <OfflineIndicator />
        <CacheWarmingOverlay />
```

**Step 3: Commit**

```bash
git add components/offline-indicator.tsx components/global-layout.tsx
git commit -m "feat: add OfflineIndicator with neo-brutalist styling"
```

---

## Task 3: Create Service Worker for static asset caching

**Files:**
- Create: `public/sw.js`
- Create: `components/service-worker-register.tsx`
- Modify: `components/global-layout.tsx`

**Step 1: Create the Service Worker**

Create `public/sw.js`:

```javascript
const CACHE_NAME = "erp-static-v1"

// Static assets to pre-cache on install
const PRECACHE_URLS = [
    "/",
]

// Install: pre-cache shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    )
    self.skipWaiting()
})

// Activate: clean old caches
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    )
    self.clients.claim()
})

// Fetch: network-first for API, cache-first for static assets
self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url)

    // Skip non-GET requests
    if (event.request.method !== "GET") return

    // Skip API routes and auth — always go to network
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return

    // For Next.js static assets (_next/static): cache-first
    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                    }
                    return response
                })
            })
        )
        return
    }

    // For page navigations: network-first with cache fallback
    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        )
        return
    }

    // For other static assets (fonts, images): stale-while-revalidate
    if (url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp)$/)) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                const networkFetch = fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                    }
                    return response
                })
                return cached || networkFetch
            })
        )
        return
    }
})
```

**Step 2: Create the registration component**

Create `components/service-worker-register.tsx`:

```tsx
"use client"

import { useEffect } from "react"

export function ServiceWorkerRegister() {
    useEffect(() => {
        if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
            navigator.serviceWorker.register("/sw.js").catch(() => {
                // Silent fail — SW is a progressive enhancement
            })
        }
    }, [])

    return null
}
```

**Step 3: Add to global-layout.tsx**

Add import and component in global-layout.tsx alongside OfflineIndicator:

```tsx
import { ServiceWorkerRegister } from "@/components/service-worker-register"
```

Place it after `<OfflineIndicator />`:
```tsx
        <OfflineIndicator />
        <ServiceWorkerRegister />
        <CacheWarmingOverlay />
```

**Step 4: Commit**

```bash
git add public/sw.js components/service-worker-register.tsx components/global-layout.tsx
git commit -m "feat: add Service Worker for static asset caching"
```

---

## Task 4: Add performance monitoring

**Files:**
- Create: `lib/performance.ts`
- Create: `components/performance-tracker.tsx`
- Modify: `components/global-layout.tsx`

**Step 1: Create performance tracking utilities**

Create `lib/performance.ts`:

```typescript
export function trackPageMetrics() {
    if (typeof window === "undefined") return

    // Track Largest Contentful Paint
    try {
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1]
            if (lastEntry) {
                console.log(`[Perf] LCP: ${Math.round(lastEntry.startTime)}ms`)
            }
        })
        lcpObserver.observe({ type: "largest-contentful-paint", buffered: true })
    } catch {
        // Not supported
    }

    // Track First Input Delay
    try {
        const fidObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const e = entry as PerformanceEventTiming
                console.log(`[Perf] FID: ${Math.round(e.processingStart - e.startTime)}ms`)
            }
        })
        fidObserver.observe({ type: "first-input", buffered: true })
    } catch {
        // Not supported
    }

    // Track Cumulative Layout Shift
    try {
        let clsScore = 0
        const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
                if (!e.hadRecentInput && e.value) {
                    clsScore += e.value
                }
            }
            console.log(`[Perf] CLS: ${clsScore.toFixed(4)}`)
        })
        clsObserver.observe({ type: "layout-shift", buffered: true })
    } catch {
        // Not supported
    }
}

export function trackRouteChange(pathname: string) {
    if (typeof window === "undefined") return
    const start = performance.now()
    // Use requestAnimationFrame to measure after paint
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const duration = performance.now() - start
            console.log(`[Perf] Route ${pathname}: ${Math.round(duration)}ms`)
        })
    })
}
```

**Step 2: Create the tracker component**

Create `components/performance-tracker.tsx`:

```tsx
"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { trackPageMetrics, trackRouteChange } from "@/lib/performance"

export function PerformanceTracker() {
    const pathname = usePathname()

    // Track Web Vitals on mount
    useEffect(() => {
        trackPageMetrics()
    }, [])

    // Track route changes
    useEffect(() => {
        trackRouteChange(pathname)
    }, [pathname])

    return null
}
```

**Step 3: Add to global-layout.tsx**

```tsx
import { PerformanceTracker } from "@/components/performance-tracker"
```

Place after ServiceWorkerRegister:
```tsx
        <ServiceWorkerRegister />
        <PerformanceTracker />
        <CacheWarmingOverlay />
```

**Step 4: Commit**

```bash
git add lib/performance.ts components/performance-tracker.tsx components/global-layout.tsx
git commit -m "feat: add performance monitoring with Web Vitals tracking"
```

---

## Task 5: Install @tanstack/react-virtual and create VirtualDataTable component

**Files:**
- Modify: `package.json` (via npm install)
- Create: `components/ui/virtual-data-table.tsx`

**Step 1: Install the package**

```bash
npm install @tanstack/react-virtual
```

**Step 2: Create the VirtualDataTable component**

Create `components/ui/virtual-data-table.tsx`:

```tsx
"use client"

import { useRef } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import {
    type ColumnDef,
    flexRender,
    getCoreRowModel,
    useReactTable,
    getSortedRowModel,
    getFilteredRowModel,
    type SortingState,
} from "@tanstack/react-table"
import { useState } from "react"

interface VirtualDataTableProps<TData> {
    data: TData[]
    columns: ColumnDef<TData, unknown>[]
    rowHeight?: number
    containerHeight?: number
    globalFilter?: string
}

export function VirtualDataTable<TData>({
    data,
    columns,
    rowHeight = 48,
    containerHeight = 600,
    globalFilter = "",
}: VirtualDataTableProps<TData>) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [sorting, setSorting] = useState<SortingState>([])

    const table = useReactTable({
        data,
        columns,
        state: { sorting, globalFilter },
        onSortingChange: setSorting,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
    })

    const { rows } = table.getRowModel()

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => rowHeight,
        overscan: 15,
    })

    return (
        <div className="rounded-lg border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="border-b-2 border-black">
                {table.getHeaderGroups().map((headerGroup) => (
                    <div key={headerGroup.id} className="flex">
                        {headerGroup.headers.map((header) => (
                            <div
                                key={header.id}
                                className="flex-1 px-3 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-600 cursor-pointer select-none hover:bg-zinc-50"
                                style={{ width: header.getSize() }}
                                onClick={header.column.getToggleSortingHandler()}
                            >
                                {header.isPlaceholder
                                    ? null
                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                {header.column.getIsSorted() === "asc" ? " ↑" : ""}
                                {header.column.getIsSorted() === "desc" ? " ↓" : ""}
                            </div>
                        ))}
                    </div>
                ))}
            </div>

            {/* Virtualized body */}
            <div
                ref={parentRef}
                className="overflow-auto"
                style={{ height: `${containerHeight}px` }}
            >
                <div
                    style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: "100%",
                        position: "relative",
                    }}
                >
                    {virtualizer.getVirtualItems().map((virtualRow) => {
                        const row = rows[virtualRow.index]
                        return (
                            <div
                                key={row.id}
                                className="absolute flex w-full items-center border-b border-zinc-200 hover:bg-zinc-50 transition-colors"
                                style={{
                                    height: `${rowHeight}px`,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <div
                                        key={cell.id}
                                        className="flex-1 px-3 text-sm truncate"
                                        style={{ width: cell.column.getSize() }}
                                    >
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black px-3 py-2 text-xs text-zinc-500">
                {rows.length.toLocaleString("id-ID")} baris
            </div>
        </div>
    )
}
```

**Step 3: Verify TypeScript**

Run: `npx tsc --noEmit --pretty 2>&1 | grep virtual-data-table`
Expected: No errors

**Step 4: Commit**

```bash
git add package.json package-lock.json components/ui/virtual-data-table.tsx
git commit -m "feat: add VirtualDataTable component with @tanstack/react-virtual"
```

---

## Task 6: Add stale-while-revalidate and networkMode to query client

**Files:**
- Modify: `lib/query-client.tsx`

**Context:** The 0s architecture doc specifies these additional QueryClient settings for true offline-first behavior.

**Step 1: Update makeQueryClient**

Add `networkMode: "offlineFirst"` and `refetchOnMount: true` to defaultOptions.queries:

```typescript
function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 2 * 60 * 1000,
                gcTime: 5 * 60 * 1000,
                retry: 1,
                refetchOnWindowFocus: false,
                placeholderData: keepPreviousData,
                refetchOnMount: true,
                networkMode: "offlineFirst",
            },
            mutations: {
                retry: 2,
                retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
                networkMode: "offlineFirst",
            },
        },
    })
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep query-client`

**Step 3: Commit**

```bash
git add lib/query-client.tsx
git commit -m "feat: add offlineFirst networkMode + mutation retry config"
```

---

## Summary — Expected Impact After Phase 2

| Change | Impact |
|--------|--------|
| PageTransition | Smooth 120ms fade between routes — no jarring content swap |
| OfflineIndicator | Users see clear feedback when offline (Bahasa Indonesia) |
| Service Worker | Static assets cached — pages load without network |
| Performance Monitoring | Console metrics for LCP, FID, CLS, route timing |
| VirtualDataTable | 5000+ rows render in <50ms, 60fps scroll |
| offlineFirst + mutation retry | Queries use cache first, mutations auto-retry |

**Total: 6 tasks, ~8 new/modified files**
**0s Architecture: ~80% → 100%**
