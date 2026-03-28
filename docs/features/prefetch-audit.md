# Prefetch System Audit — "Mempersiapkan Sistem"

**Audit date:** 2026-03-27
**Status:** READ-ONLY AUDIT — no changes made

---

## A. Current Prefetch Inventory

### Phase 1: Priority Routes (Visible Overlay — 12 items)

These are fetched during the "Mempersiapkan Sistem" overlay with progress bar showing `{done}/12`:

| # | Route | What It Fetches | Cached Where | Survives Refresh? |
|---|-------|----------------|--------------|-------------------|
| 1 | `/dashboard` | Executive dashboard data via `/api/dashboard` | TanStack Query → IndexedDB | Yes (7 days) |
| 2 | `/inventory` | Inventory dashboard via `/api/inventory/dashboard` | TanStack Query → IndexedDB | Yes (7 days) |
| 3 | `/sales` | Sales page data via `/api/sales/page-data` | TanStack Query → IndexedDB | Yes (7 days) |
| 4 | `/finance` | `getFinancialMetrics()` + `getFinanceDashboardData()` | TanStack Query → IndexedDB | Yes (7 days) |
| 5 | `/procurement` | Procurement dashboard via `/api/procurement/dashboard` | TanStack Query → IndexedDB | Yes (7 days) |
| 6 | `/manufacturing` | Manufacturing dashboard via `/api/manufacturing/dashboard` | TanStack Query → IndexedDB | Yes (7 days) |
| 7 | `/inventory/products` | Products + categories + warehouses + stats via `/api/inventory/page-data` | TanStack Query → IndexedDB | Yes (7 days) |
| 8 | `/sales/customers` | Customer list + summary via `/api/sales/customers` | TanStack Query → IndexedDB | Yes (7 days) |
| 9 | `/sales/orders` | Sales orders + summary via `/api/sales/orders` | TanStack Query → IndexedDB | Yes (7 days) |
| 10 | `/finance/invoices` | Invoice kanban data via `getInvoiceKanbanData()` | TanStack Query → IndexedDB | Yes (7 days) |
| 11 | `/procurement/orders` | POs + vendors + products via server actions | TanStack Query → IndexedDB | Yes (7 days) |
| 12 | `/manufacturing/bom` | BOM list via `/api/manufacturing/production-bom` | TanStack Query → IndexedDB | Yes (7 days) |

**Also fetched during Phase 1 (not counted in progress bar):** 10 master data entries for form dialogs:

| # | Master Data | What It Fetches | Purpose |
|---|-------------|----------------|---------|
| M1 | units | `getUnits()` | UoM dropdowns |
| M2 | brands | `getBrands()` | Brand dropdowns |
| M3 | colors | `getColors()` | Color dropdowns |
| M4 | masterCategories | `getCategories()` | Category dropdowns |
| M5 | suppliers | `getSuppliers()` | Supplier dropdowns |
| M6 | uomConversions | `getUomConversions()` | Unit conversion logic |
| M7 | glAccounts | `getGLAccountsList()` | GL account pickers |
| M8 | bankAccounts | `getPettyCashBankAccounts()` filtered to `10xx` | Bank account pickers |
| M9 | salesOptions | `/api/sales/options` | Customer + user dropdowns |
| M10 | sidebarActions | `/api/sidebar/action-counts` | Sidebar badge counts |

### Phase 2: Background Routes (Silent — ~69 more routes)

After overlay dismisses, ALL remaining entries in `routePrefetchMap` are fetched in batches of 4, with 150ms gaps. Total map has **81 route entries**. These cover every major list page across all modules.

**Key file:** `hooks/use-nav-prefetch.ts` — `routePrefetchMap` (81 routes) + `masterDataPrefetchMap` (10 entries)

---

## B. Missing From Prefetch

### B1. Pages with NO prefetch entry (will show loading spinners)

| # | Route | What it needs | Has loading.tsx? | Impact |
|---|-------|-------------- |-----------------|--------|
| 1 | `/inventory/stock` | Products page data via `useProductsPage()` | Yes | Shows skeleton on navigation |
| 2 | `/finance/payments` | AR payments via `useARPayments()` | Yes | Shows skeleton on navigation |
| 3 | `/accountant/coa` | GL accounts via `useQuery` | No | Shows loading state inline |
| 4 | `/accountant` | Financial command center, invoice aging, bank reconciliation data | No | Components load independently |
| 5 | `/inventory/reports` | Products data via `useProductsPage()` | No | Shows loading state inline |
| 6 | `/inventory/alerts` | Products data via `useProductsPage()` | No | Shows loading state inline |
| 7 | `/finance/fixed-assets/categories` | Asset categories via `useFixedAssetCategories()` | No | Shows skeleton |
| 8 | `/finance/fixed-assets/depreciation` | Depreciation runs via `useDepreciationRuns()` | No | Shows skeleton |
| 9 | `/finance/fixed-assets/reports` | 4 report hooks (register, movement, NBV, depreciation schedule) | No | Shows skeleton |
| 10 | `/settings` | Working hours via `useWorkingHours()` | No | Shows loading |
| 11 | `/documents/docs` | Documents via `useDocuments()` | No | Root `/documents` is prefetched but sub-pages are not |
| 12 | `/documents/master` | Documents via `useDocuments()` | No | Same as above |
| 13 | `/documents/reports` | Documents via `useDocuments()` | No | Same as above |

### B2. Stale/Wrong Prefetch Entry (BUG)

| Route in Map | Actual Route | Issue |
|-------------|-------------|-------|
| `/manufacturing/process-stations` | `/manufacturing/processes` | Route was renamed, prefetch map key was NOT updated. Prefetch runs but data is never consumed by the actual page. |

### B3. Detail Pages (structurally excluded — by-ID data)

These are not prefetchable at login time because the ID is unknown. They will always show their own loading:

| Route | Fetches via |
|-------|-------------|
| `/inventory/products/[id]` | `useQuery` (product detail) |
| `/inventory/warehouses/[id]` | `useWarehouseDetail()` |
| `/sales/customers/[id]` | `useCustomerDetail()` |
| `/sales/orders/[id]` | `useSalesOrderDetail()` |
| `/sales/quotations/[id]` | `useQuotationDetail()` |
| `/manufacturing/bom/[id]` | `useProductionBOM()` |
| `/subcontract/orders/[id]` | `useSubcontractOrderDetail()` |
| `/subcontract/registry/[id]` | `useSubcontractorDetail()` |
| `/costing/sheets/[id]` | `useCostSheetDetail()` |
| `/cutting/plans/[id]` | `useCutPlanDetail()` |

---

## C. Current Cache Strategy

### Where is data stored after prefetch?

**Three-layer cache:**

| Layer | Technology | Lifetime | Notes |
|-------|-----------|----------|-------|
| 1. In-memory | TanStack Query `QueryClient` | Until page reload | Fastest access, lost on refresh |
| 2. IndexedDB | `idb-keyval` via `@tanstack/query-async-storage-persister` | 7 days (`maxAge`) | Restored on app load by `PersistQueryClientProvider` |
| 3. Session flag | `sessionStorage` key `erp_cache_warmed` | Until tab/browser close | Controls whether overlay shows — NOT the actual data |

**Key configuration** (`lib/query-client.tsx`):
- `staleTime`: 30 minutes — data is "fresh" (no refetch) for 30 min
- `gcTime`: 7 days — unused entries kept for IndexedDB persistence
- `refetchOnWindowFocus`: false — no surprise refetches
- `refetchOnMount`: true — will refetch stale data on component mount (but shows cached data instantly via `placeholderData: keepPreviousData`)
- `networkMode`: "offlineFirst" — works without network if cache exists
- `CACHE_BUSTER`: `"v1"` — bump to invalidate all persisted caches on deploy

### Does it persist across page refreshes?

**Yes.** IndexedDB survives page refresh. On next load, `PersistQueryClientProvider` restores the entire TanStack cache from IndexedDB before any component mounts. The overlay still shows briefly (~300ms) because `sessionStorage.erp_cache_warmed` also survives refresh within the same tab.

### Does it persist across browser sessions (close + reopen)?

**Yes.** IndexedDB is persistent storage — survives browser close/reopen. The data will be there for up to 7 days. However, `sessionStorage.erp_cache_warmed` does NOT survive browser close, so the overlay will show again (but will dismiss nearly instantly because `queryClient.prefetchQuery()` resolves immediately for fresh cached data).

### Does it persist across logins?

**No.** On logout, `clearPersistedCache()` in `lib/query-client.tsx` wipes both IndexedDB (`clear()`) and in-memory cache (`queryClient.clear()`). On the login page, `sessionStorage.removeItem("erp_cache_warmed")` is called. A fresh login triggers a full re-prefetch.

### How is stale data handled?

- Data older than 30 minutes is "stale" — TanStack shows it instantly but refetches in the background
- Data older than 7 days is garbage-collected — the persister ignores it
- `refetchOnMount: true` ensures fresh data replaces stale data when the page component mounts
- On global error (`app/global-error.tsx`), ALL IndexedDB databases are destroyed as a nuclear reset

---

## D. Skip Button Analysis

### What happens when user clicks "Lewati"?

**Code:** `components/cache-warming-overlay.tsx` lines 52-55, 191-196

```tsx
const dismiss = useCallback(() => {
    setFadeOut(true)                          // 1. Start fade-out animation
    setTimeout(() => setShow(false), 300)     // 2. Hide overlay after 300ms
}, [])
```

1. The overlay fades out and disappears (300ms animation)
2. **Phase 2 background warming CONTINUES** — `warmBackground()` was already launched in the async flow and keeps running silently
3. BUT — any Phase 1 priority routes that haven't finished yet are still in-flight as `Promise.allSettled` — they will resolve in background too

### What breaks or loads slowly as a result?

**If skipped early (< 50% progress):**
- Uncompleted priority routes (dashboard, inventory, sales, finance, procurement, manufacturing landing pages) will NOT have cached data
- Navigating to those pages immediately shows `loading.tsx` skeleton screens
- Those pages then fetch their own data via `useQuery`, adding 1-3 seconds of loading
- Master data for form dialogs (units, brands, colors, suppliers, GL accounts) may not be cached → first dialog open is slow

**If skipped late (> 80% progress):**
- Most priority routes already cached — minimal impact
- Background routes haven't started yet — those pages will load normally (not instant)

### Core problem with skip button

The skip button undermines the entire prefetch strategy. The system is designed to front-load all data fetching so every subsequent page opens instantly. Skipping means the user "wins" 2-3 seconds now but loses 1-3 seconds on EVERY page navigation afterward. Net negative UX.

---

## E. Architecture Summary

```
┌─ Login ──────────────────────────────────────────────────────┐
│ sessionStorage.removeItem("erp_cache_warmed")                │
│ clearPersistedCache() on logout                              │
└──────────────────────┬───────────────────────────────────────┘
                       │ auth success
                       ▼
┌─ CacheWarmingOverlay (components/cache-warming-overlay.tsx) ─┐
│                                                               │
│  ┌─ Phase 1: VISIBLE ──────────────────────────────────────┐ │
│  │ Batch 5 at a time from PRIORITY_ROUTES (12)             │ │
│  │ + masterDataPrefetchMap (10 entries)                     │ │
│  │ Progress bar: {done}/12                                  │ │
│  │ [Lewati] skip button (should be removed)                 │ │
│  └──────────────────────────┬──────────────────────────────┘ │
│                              │ auto-dismiss()                 │
│  ┌─ Phase 2: SILENT ───────┴──────────────────────────────┐ │
│  │ Remaining ~69 routes, batch 4, 150ms gaps               │ │
│  │ Sets sessionStorage("erp_cache_warmed", "true")         │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─ TanStack Query Cache ───────────────────────────────────────┐
│  In-memory QueryClient                                        │
│    ↕ sync via PersistQueryClientProvider                      │
│  IndexedDB (idb-keyval, prefix "v1:", 7-day maxAge)           │
└───────────────────────────────────────────────────────────────┘
                       │
                       ▼
┌─ Page Navigation ────────────────────────────────────────────┐
│  useQuery() → hits cache → instant render (0ms)               │
│  If stale (>30min) → show cached, refetch background          │
│  If miss → show loading.tsx skeleton, fetch fresh              │
└───────────────────────────────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `components/cache-warming-overlay.tsx` | Overlay UI, two-phase warming orchestration |
| `hooks/use-nav-prefetch.ts` | Central map of 81 routes + 10 master data entries |
| `lib/query-client.tsx` | TanStack Query config, IndexedDB persister, cache clear |
| `lib/query-keys.ts` | Canonical query key definitions |
| `components/global-layout.tsx` | Renders `<CacheWarmingOverlay />` at root level |
| `lib/auth-context.tsx` | Calls `clearPersistedCache()` on logout |
| `app/login/page.tsx` | Clears `sessionStorage.erp_cache_warmed` |

### Dead Code

| File | Status |
|------|--------|
| `components/warm-cache.tsx` | Superseded by `CacheWarmingOverlay`. Not mounted anywhere. Can be deleted. |
| `app/api/cache-warm/route.ts` | Only used by old `useDataPrefetch()` in `lib/performance/procurement-prefetch.ts`. Not used by current overlay. |
| `lib/performance/procurement-prefetch.ts` | Old DOM MutationObserver-based hover prefetch. Superseded by `useNavPrefetch()`. |
