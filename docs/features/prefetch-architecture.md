# Prefetch + Cache Architecture — "Native App" Model

**Design date:** 2026-03-27
**Status:** ARCHITECTURE SPEC — not yet implemented

---

## Mental Model

| Scenario | Native App Analogy | ERP Behavior |
|----------|-------------------|--------------|
| First login | App install | Download ALL data, show progress, NO skip |
| Return visit (same day) | App open | Everything cached, 0 loading screens, background delta sync |
| Return visit (next day) | App open after overnight | Show cached data instantly, refetch stale data silently |
| Logout + login as different user | Switch accounts | Wipe cache, full re-download |
| New deployment | App update | Cache buster invalidates old data, one-time re-download |

---

## 1. Cache Layer Design

### Layer 1: Service Worker + Cache API (Shell Caching)

**Purpose:** Eliminate the white screen on app load. Cache all static assets so the app shell renders from disk in <200ms.

**Current state:** `public/sw.js` exists with basic stale-while-revalidate for static assets. No API caching. No versioning strategy.

**Target state:**

```
┌─ Service Worker (public/sw.js) ──────────────────────────────┐
│                                                                │
│  Strategy 1: PRECACHE (install-time)                          │
│  ├── / (app shell HTML)                                       │
│  ├── /dashboard, /inventory, /sales, /finance, /procurement   │
│  └── /manufacturing (navigation shells)                       │
│                                                                │
│  Strategy 2: CACHE-FIRST (immutable)                          │
│  ├── /_next/static/**/*.js                                    │
│  ├── /_next/static/**/*.css                                   │
│  └── /fonts/**, /images/**                                    │
│                                                                │
│  Strategy 3: STALE-WHILE-REVALIDATE (static assets)          │
│  └── *.woff2, *.ttf, *.png, *.jpg, *.svg, *.ico, *.webp     │
│                                                                │
│  Strategy 4: NETWORK-ONLY (never cache)                       │
│  ├── /api/**                                                  │
│  └── /auth/**                                                 │
│                                                                │
│  Background update: on new SW detected →                      │
│  ├── skipWaiting() + clients.claim()                          │
│  └── Notify app via postMessage("SW_UPDATED")                 │
│      → app shows "Pembaruan tersedia" toast                   │
│                                                                │
│  Versioning: CACHE_VERSION derived from build hash            │
│  ├── On activate: delete old caches !== CACHE_VERSION         │
│  └── On deploy: new SW auto-installs, old cache purged        │
└────────────────────────────────────────────────────────────────┘
```

**What NOT to change:** Keep the current hand-rolled approach. No `next-pwa` or `workbox` — they add complexity and build-time config that we don't need. Our SW is 65 lines and does exactly what we need.

**Key improvement:** Add `CACHE_VERSION` tied to build hash (inject via `next.config.ts` `env` or inline in `sw.js`). On activate, purge stale cache names. Currently the cache name is hardcoded `erp-static-v1` with no auto-invalidation.

---

### Layer 2: TanStack Query + IndexedDB Persister (Data Caching)

**Purpose:** Cache ALL query data in IndexedDB so pages render from cache on return visits. Different data types get different freshness windows.

**Current state:** Single global `staleTime: 30min` for everything. Works but suboptimal — master data could be cached longer, transactional data needs faster invalidation.

**Target state:** Per-category `staleTime` via query defaults + per-query overrides.

#### staleTime Tiers

| Tier | Category | staleTime | gcTime | refetchOnFocus | Examples |
|------|----------|-----------|--------|---------------|----------|
| **T1: Config** | System settings, almost never changes | 24 hours | 7 days | No | Fiscal periods, permissions, document numbering, inventory settings |
| **T2: Master** | Reference data, changes weekly | 30 minutes | 7 days | No | Units, brands, colors, categories, warehouses, GL account list (structure only), onboarding templates |
| **T3: Master+** | Reference data, changes more often | 10 minutes | 7 days | No | Products, customers, vendors/suppliers, employees, BOMs, machines, routings, price lists, salespersons |
| **T4: Dashboard** | Aggregated stats, changes on every transaction | 3 minutes | 1 day | Yes | Executive dashboard, module dashboards, sidebar action counts, finance reports, costing/cutting dashboards |
| **T5: Transactional** | Live operational records | 60 seconds | 1 day | Yes | Invoices, payments, POs, PRs, sales orders, journal entries, stock movements, GRNs, work orders, quality inspections |
| **T6: Realtime** | Critical approval/alert data | 30 seconds | 1 hour | Yes | Pending approvals, attendance snapshot, machine breakdown alerts |

#### Implementation approach

Keep the global default at `staleTime: 5 * 60 * 1000` (5 min) as a safe middle ground. Override per-query in `routePrefetchMap` and in individual `useQuery` calls via a helper:

```ts
// lib/cache-tiers.ts
export const CACHE_TIERS = {
  CONFIG:       { staleTime: 24 * 60 * 60 * 1000, gcTime: 7 * 24 * 60 * 60 * 1000 },
  MASTER:       { staleTime: 30 * 60 * 1000,      gcTime: 7 * 24 * 60 * 60 * 1000 },
  MASTER_PLUS:  { staleTime: 10 * 60 * 1000,      gcTime: 7 * 24 * 60 * 60 * 1000 },
  DASHBOARD:    { staleTime: 3 * 60 * 1000,        gcTime: 24 * 60 * 60 * 1000 },
  TRANSACTIONAL:{ staleTime: 60 * 1000,            gcTime: 24 * 60 * 60 * 1000 },
  REALTIME:     { staleTime: 30 * 1000,            gcTime: 60 * 60 * 1000 },
} as const
```

#### IndexedDB Persister (keep current approach)

The current `idb-keyval` + `@tanstack/query-async-storage-persister` setup is correct. No changes needed except:

- Keep `maxAge: 7 days`
- Keep `CACHE_BUSTER = "v1"` — bump on breaking schema changes
- Keep `throttleTime: 2000` for write batching
- Add: on logout, also clear `sessionStorage` keys (already done)

---

### Layer 3: Supabase Realtime (Live Updates) — FUTURE

**Current state:** Zero realtime subscriptions. All data is pull-based.

**Target state (Phase 2, not in initial implementation):**

Subscribe to high-value tables and push changes directly into TanStack Query cache. This eliminates the need for short `staleTime` polling on the most critical data.

```
┌─ Supabase Realtime Channels ─────────────────────────────────┐
│                                                                │
│  Channel: "approvals"                                         │
│  ├── Table: PurchaseOrder (filter: status = PENDING_APPROVAL) │
│  └── On change → invalidate queryKeys.approvals.*             │
│                                                                │
│  Channel: "invoices"                                          │
│  ├── Table: Invoice (INSERT, UPDATE)                          │
│  └── On change → invalidate queryKeys.invoices.*              │
│                                                                │
│  Channel: "payments"                                          │
│  ├── Table: Payment (INSERT)                                  │
│  └── On change → invalidate queryKeys.arPayments.*,           │
│                              queryKeys.bills.*                 │
│                                                                │
│  Channel: "inventory"                                         │
│  ├── Table: InventoryTransaction (INSERT)                     │
│  └── On change → invalidate queryKeys.stockMovements.*,       │
│                              queryKeys.inventoryDashboard.*    │
│                                                                │
│  When to subscribe: After auth, inside CacheWarmingOverlay    │
│  When to unsubscribe: On logout (before clearPersistedCache)  │
└────────────────────────────────────────────────────────────────┘
```

**Why deferred:** Supabase Realtime requires enabling replication on the Supabase project dashboard for each table. It also requires Row Level Security (RLS) to be configured properly, which is currently not set up for most tables (the app uses `DATABASE_URL` direct connection, not the PostgREST API). This is a separate infrastructure task.

**Interim solution:** Use `refetchOnWindowFocus: true` for T5/T6 tier queries + mutation-based invalidation (already partially done via `queryClient.invalidateQueries()` in server actions).

---

## 2. Prefetch Manifest — Complete List

### Priority 0 — Instant (must complete before app shell renders)

These are loaded from IndexedDB cache on return visits. On first login, they are part of Phase 1.

| # | Query | Source | Tier | Notes |
|---|-------|--------|------|-------|
| 0.1 | User profile + role | `supabase.auth.getSession()` | Session | Already handled by AuthProvider |
| 0.2 | Sidebar action counts | `/api/sidebar/action-counts` | T4 | Badge counts on nav items |

### Priority 1 — Critical (blocks "Mempersiapkan Sistem" progress bar)

Must complete before the overlay dismisses. These are the landing pages + master data needed for any form interaction.

| # | Query | Route / Key | Tier | queryKey |
|---|-------|------------|------|----------|
| **Landing pages (6)** | | | | |
| 1.1 | Executive dashboard | `/dashboard` | T4 | `executiveDashboard.list()` |
| 1.2 | Inventory dashboard | `/inventory` | T4 | `inventoryDashboard.list()` |
| 1.3 | Sales page data | `/sales` | T4 | `salesPage.list()` |
| 1.4 | Finance dashboard | `/finance` | T4 | `financeDashboard.list()` |
| 1.5 | Procurement dashboard | `/procurement` | T4 | `procurementDashboard.list()` |
| 1.6 | Manufacturing dashboard | `/manufacturing` | T4 | `mfgDashboard.list()` |
| **Most-visited sub-pages (6)** | | | | |
| 1.7 | Product list | `/inventory/products` | T3 | `products.list()` |
| 1.8 | Customer list | `/sales/customers` | T3 | `customers.list()` |
| 1.9 | Sales orders | `/sales/orders` | T5 | `salesOrders.list()` |
| 1.10 | Invoice kanban | `/finance/invoices` | T5 | `invoices.kanban()` |
| 1.11 | Purchase orders | `/procurement/orders` | T5 | `purchaseOrders.list()` |
| 1.12 | BOM list | `/manufacturing/bom` | T3 | `productionBom.list()` |
| **Master data for forms (10)** | | | | |
| 1.13 | Units of measure | `masterData:units` | T2 | `units.list()` |
| 1.14 | Brands | `masterData:brands` | T2 | `brands.list()` |
| 1.15 | Colors | `masterData:colors` | T2 | `colors.list()` |
| 1.16 | Product categories | `masterData:masterCategories` | T2 | `categories.master()` |
| 1.17 | Suppliers | `masterData:suppliers` | T3 | `suppliers.list()` |
| 1.18 | UoM conversions | `masterData:uomConversions` | T2 | `uomConversions.list()` |
| 1.19 | GL accounts (list) | `masterData:glAccounts` | T2 | `glAccounts.list()` |
| 1.20 | Bank accounts | `masterData:bankAccounts` | T2 | `glAccounts.bankAccounts()` |
| 1.21 | Sales options | `masterData:salesOptions` | T3 | `salesOptions.list()` |
| 1.22 | Sidebar actions | `masterData:sidebarActions` | T4 | `sidebarActions.list()` |

**Total Phase 1: 22 items** (currently 12 + 10 master data hidden from counter → show all 22 in progress bar)

### Priority 2 — Important (prefetch immediately after overlay dismisses, batch of 6)

These are the "second click" pages — what the user navigates to within 30 seconds of landing.

| # | Query | Route | Tier |
|---|-------|-------|------|
| **Sales module** | | | |
| 2.1 | Leads | `/sales/leads` | T5 |
| 2.2 | Quotations | `/sales/quotations` | T5 |
| 2.3 | Discounts | `/sales/discounts` | T3 |
| 2.4 | Salespersons | `/sales/salespersons` | T3 |
| 2.5 | Price lists | `/sales/pricelists` | T3 |
| 2.6 | Sales dashboard | `/sales/sales` | T4 |
| **Procurement module** | | | |
| 2.7 | Purchase requests | `/procurement/requests` | T5 |
| 2.8 | Vendors | `/procurement/vendors` | T3 |
| 2.9 | Receiving/GRN | `/procurement/receiving` | T5 |
| **Finance module** | | | |
| 2.10 | Journal entries | `/finance/journal` | T5 |
| 2.11 | Chart of accounts | `/finance/chart-accounts` | T2 |
| 2.12 | Vendor payments | `/finance/vendor-payments` | T5 |
| 2.13 | Bills | `/finance/bills` | T5 |
| 2.14 | Receivables (AR) | `/finance/receivables` | T5 |
| 2.15 | Payables (AP) | `/finance/payables` | T5 |
| 2.16 | Expenses | `/finance/expenses` | T5 |
| 2.17 | Petty cash | `/finance/petty-cash` | T5 |
| 2.18 | Credit notes | `/finance/credit-notes` | T5 |
| **Inventory module** | | | |
| 2.19 | Categories | `/inventory/categories` | T2 |
| 2.20 | Warehouses | `/inventory/warehouses` | T2 |
| 2.21 | Stock movements | `/inventory/movements` | T5 |
| 2.22 | Adjustments | `/inventory/adjustments` | T5 |
| 2.23 | Fabric rolls | `/inventory/fabric-rolls` | T3 |
| 2.24 | Transfers | `/inventory/transfers` | T5 |
| **Manufacturing module** | | | |
| 2.25 | Work centers/machines | `/manufacturing/work-centers` | T3 |
| 2.26 | Manufacturing orders | `/manufacturing/orders` | T5 |
| 2.27 | Quality inspections | `/manufacturing/quality` | T5 |
| 2.28 | Groups | `/manufacturing/groups` | T2 |
| 2.29 | Routing | `/manufacturing/routing` | T2 |
| **HCM module** | | | |
| 2.30 | Employee master | `/hcm/employee-master` | T3 |
| 2.31 | HCM dashboard | `/hcm` | T4 |
| **Approvals** | | | |
| 2.32 | Pending approvals | `/dashboard/approvals` | T6 |

### Priority 3 — Background (prefetch after Priority 2, with 150ms gaps between batches of 4)

Everything else. User may never visit these pages in a session, but if they do, data is ready.

| # | Query | Route | Tier |
|---|-------|-------|------|
| **Inventory (remaining)** | | | |
| 3.1 | Audit logs | `/inventory/audit` | T5 |
| 3.2 | Cycle counts | `/inventory/cycle-counts` | T5 |
| 3.3 | Opening stock | `/inventory/opening-stock` | T3 |
| 3.4 | Inventory settings | `/inventory/settings` | T1 |
| 3.5 | Stock page *(NEW)* | `/inventory/stock` | T4 |
| 3.6 | Inventory reports *(NEW)* | `/inventory/reports` | T4 |
| 3.7 | Inventory alerts *(NEW)* | `/inventory/alerts` | T4 |
| **Finance (remaining)** | | | |
| 3.8 | Transactions ledger | `/finance/transactions` | T5 |
| 3.9 | Finance reports | `/finance/reports` | T4 |
| 3.10 | Reconciliation | `/finance/reconciliation` | T5 |
| 3.11 | Currencies | `/finance/currencies` | T1 |
| 3.12 | Fiscal periods | `/finance/fiscal-periods` | T1 |
| 3.13 | Opening balances | `/finance/opening-balances` | T3 |
| 3.14 | Cashflow forecast | `/finance/cashflow-forecast` | T4 |
| 3.15 | Cashflow planning | `/finance/planning` | T4 |
| 3.16 | Cashflow simulasi | `/finance/planning/simulasi` | T4 |
| 3.17 | Cashflow aktual | `/finance/planning/aktual` | T4 |
| 3.18 | Fixed assets | `/finance/fixed-assets` | T3 |
| 3.19 | Fixed asset categories *(NEW)* | `/finance/fixed-assets/categories` | T2 |
| 3.20 | Depreciation runs *(NEW)* | `/finance/fixed-assets/depreciation` | T5 |
| 3.21 | Fixed asset reports *(NEW)* | `/finance/fixed-assets/reports` | T4 |
| 3.22 | Payments (AR) *(NEW)* | `/finance/payments` | T5 |
| **Manufacturing (remaining)** | | | |
| 3.23 | Material demand | `/manufacturing/material-demand` | T5 |
| 3.24 | Planning (4-week) | `/manufacturing/planning` | T5 |
| 3.25 | SPK work orders | `/manufacturing/work-orders` | T5 |
| 3.26 | Schedule | `/manufacturing/schedule` | T5 |
| 3.27 | Process stations | `/manufacturing/processes` | T2 |
| **HCM (remaining)** | | | |
| 3.28 | Attendance | `/hcm/attendance` | T6 |
| 3.29 | Shifts | `/hcm/shifts` | T3 |
| 3.30 | Onboarding | `/hcm/onboarding` | T2 |
| 3.31 | Payroll | `/hcm/payroll` | T5 |
| **Subcontract** | | | |
| 3.32 | Subcontract dashboard | `/subcontract` | T4 |
| 3.33 | Subcontract orders | `/subcontract/orders` | T5 |
| 3.34 | Subcontractor registry | `/subcontract/registry` | T3 |
| **Costing** | | | |
| 3.35 | Costing dashboard | `/costing` | T4 |
| 3.36 | Cost sheets | `/costing/sheets` | T3 |
| **Cutting** | | | |
| 3.37 | Cutting dashboard | `/cutting` | T4 |
| 3.38 | Cut plans | `/cutting/plans` | T5 |
| **Documents** | | | |
| 3.39 | Document system | `/documents` | T3 |
| 3.40 | Documents - docs *(NEW)* | `/documents/docs` | T3 |
| 3.41 | Documents - master *(NEW)* | `/documents/master` | T3 |
| 3.42 | Documents - reports *(NEW)* | `/documents/reports` | T3 |
| **Staff/Manager** | | | |
| 3.43 | Staff tasks | `/staff` | T5 |
| 3.44 | Manager dashboard | `/manager` | T5 |
| **Settings** | | | |
| 3.45 | Document numbering | `/settings/numbering` | T1 |
| 3.46 | Permission matrix | `/settings/permissions` | T1 |
| 3.47 | Settings root *(NEW)* | `/settings` | T1 |
| **Accountant** | | | |
| 3.48 | Accountant dashboard *(NEW)* | `/accountant` | T4 |
| 3.49 | Accountant COA *(NEW)* | `/accountant/coa` | T2 |

**Total across all priorities:**

| Priority | Count | When |
|----------|-------|------|
| P0 (instant) | 2 | Before overlay |
| P1 (critical) | 22 | During overlay (progress bar shows 22/22) |
| P2 (important) | 32 | Immediately after overlay dismisses, batch 6 |
| P3 (background) | 49 | Silent background, batch 4, 150ms gaps |
| **TOTAL** | **105** | |

### Items to ADD to routePrefetchMap (currently missing)

| Route | queryFn needed | Tier |
|-------|---------------|------|
| `/inventory/stock` | `useProductsPage()` data | T4 |
| `/inventory/reports` | `useProductsPage()` data | T4 |
| `/inventory/alerts` | `useProductsPage()` data | T4 |
| `/finance/payments` | `useARPayments()` data | T5 |
| `/finance/fixed-assets/categories` | `getFixedAssetCategories()` | T2 |
| `/finance/fixed-assets/depreciation` | `getDepreciationRuns()` | T5 |
| `/finance/fixed-assets/reports` | Multiple report hooks | T4 |
| `/accountant` | Command center data | T4 |
| `/accountant/coa` | `getChartOfAccountsTree()` | T2 |
| `/settings` | `getWorkingHours()` | T1 |
| `/documents/docs` | `getDocuments()` | T3 |
| `/documents/master` | `getDocuments()` | T3 |
| `/documents/reports` | `getDocuments()` | T3 |

### Item to FIX in routePrefetchMap

| Current Key | Should Be | Why |
|-------------|-----------|-----|
| `/manufacturing/process-stations` | `/manufacturing/processes` | Route was renamed, map key not updated. Prefetch data goes to wrong cache key. |

---

## 3. Loading Flow Redesign

### First Login (Cold Start — No Cache Exists)

```
Login
  → Auth validated
  → Show "Mempersiapkan Sistem" screen
  → Download Priority 1 (progress 0–60%)  ─── MANDATORY, no skip
  → Download Priority 2 (progress 60–90%) ─── MANDATORY, no skip
  → App becomes interactive (progress 90%)
  → Download Priority 3 in background (progress 90–100%)
  → Loading screen disappears
  → NO "LEWATI" BUTTON AT ALL
```

**Detailed flow:**

```
┌─ Login Success ──────────────────────────────────────────────┐
│                                                                │
│  1. AuthProvider sets isAuthenticated = true                   │
│  2. CacheWarmingOverlay detects: no IndexedDB cache            │
│     no sessionStorage flag → FULL DOWNLOAD MODE               │
│                                                                │
└───────────────────────┬────────────────────────────────────────┘
                        ▼
┌─ "Mempersiapkan Sistem" Overlay ─────────────────────────────┐
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              [E] (logo)                                   │ │
│  │                                                           │ │
│  │         Mempersiapkan Sistem                              │ │
│  │    Mengunduh data untuk pertama kali                      │ │
│  │                                                           │ │
│  │  ████████████████████░░░░░░  78%                         │ │
│  │                                                           │ │
│  │  ✓ Dashboard          ✓ Produk                           │ │
│  │  ✓ Inventori          ✓ Pelanggan                        │ │
│  │  ✓ Penjualan          ◌ Pesanan Penjualan                │ │
│  │  ✓ Keuangan           ◌ Invoice                          │ │
│  │  ✓ Pengadaan          ◌ Purchase Order                   │ │
│  │  ✓ Manufaktur         ◌ Bill of Materials                │ │
│  │                                                           │ │
│  │         (NO SKIP BUTTON — ABSOLUTELY NONE)                │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  PROGRESS BAR MAPPING:                                        │
│  ├── 0–60%:  P1 Critical (22 items, batch 6)                 │
│  │   └── Each P1 item = 60/22 = ~2.7% of progress bar       │
│  ├── 60–90%: P2 Important (32 items, batch 6)                │
│  │   └── Each P2 item = 30/32 = ~0.9% of progress bar       │
│  ├── At 90%: Overlay FADES OUT, app becomes interactive      │
│  │   └── User can start using the app immediately            │
│  └── 90–100%: P3 Background (49 items, batch 4, 150ms gaps) │
│      └── Invisible — no overlay, no progress indicator       │
│      └── Sets sessionStorage("erp_cache_warmed", "true")     │
│                                                                │
│  ERROR HANDLING (per item):                                   │
│  ├── Item timeout: 15 seconds max per item                   │
│  ├── On failure: retry 2x with 1s backoff                    │
│  ├── After 2 retries: skip item, log warning, continue       │
│  ├── Failed items marked with ✕ (not ✓) in checklist         │
│  └── Individual failure does NOT block the entire prefetch    │
│                                                                │
│  TOTAL FAILURE (network down):                                │
│  ├── If >50% of P1 items fail → show retry button            │
│  │   "Koneksi bermasalah. [Coba Lagi]"                       │
│  ├── NOT a skip button — user must retry or fix connection   │
│  └── Retry restarts from the first failed item, not from 0   │
│                                                                │
│  Estimated time: 5-8 seconds on 4G, 3-5s on WiFi             │
└────────────────────────────────────────────────────────────────┘
```

**Key design decisions:**
1. **No "Lewati" button** — the skip button is deleted entirely from the codebase
2. **Progress bar is weighted** — P1 takes 60% of the bar (critical), P2 takes 30% (important), P3 is invisible (background)
3. **App becomes interactive at 90%** — user doesn't wait for P3 background items
4. **Item-level checkmarks** — user sees exactly what's loading and what succeeded/failed
5. **Graceful degradation** — individual failures don't block; only catastrophic network failure shows retry
6. **Subtitle context** — "Mengunduh data untuk pertama kali" (first time) vs "Memperbarui data..." (return visit quick refresh)

### Subsequent Visit (Cache Exists — Warm Start)

```
Open app
  → Hydrate from IndexedDB cache (instant, <200ms)
  → App is immediately interactive with cached data
  → Background: validate cache freshness against server
  → Background: refetch any stale data silently
  → User sees NO loading screen at all
```

**Detailed flow — Same Session (tab refresh, SPA navigation):**

```
┌─ App Load ───────────────────────────────────────────────────┐
│                                                                │
│  1. Service Worker serves app shell from Cache API             │
│     └── HTML + JS + CSS load from disk — no network needed    │
│     └── App shell renders in <200ms                           │
│                                                                │
│  2. PersistQueryClientProvider restores cache from IndexedDB   │
│     └── All 105 queries available in memory instantly          │
│     └── React components mount with cached data — no loading  │
│                                                                │
│  3. sessionStorage("erp_cache_warmed") === "true"              │
│     └── Skip overlay entirely — NO loading screen              │
│                                                                │
│  4. User sees dashboard immediately with cached data           │
│                                                                │
│  5. Background: stale queries refetch on mount (silent)        │
│     ├── T6 data (approvals, alerts) refetch within 30s        │
│     ├── T5 data (invoices, POs) refetch within 60s            │
│     ├── T4 data (dashboards) refetch within 3min              │
│     ├── T3 data (products, customers) within 10min            │
│     └── T2/T1 data (master, config) stays fresh for hours     │
│                                                                │
│  6. Refetched data replaces cached data seamlessly             │
│     └── TanStack Query's placeholderData: keepPreviousData    │
│     └── No loading spinners — old data shown until new arrives│
│     └── Updated data auto-persists to IndexedDB               │
│                                                                │
│  Result: 0ms to interactive. No loading screens anywhere.      │
└────────────────────────────────────────────────────────────────┘
```

**Detailed flow — New Browser Session (next day, browser was closed):**

```
┌─ App Load ───────────────────────────────────────────────────┐
│                                                                │
│  1. Service Worker serves app shell from Cache API             │
│     └── Even if offline, the app shell renders                │
│                                                                │
│  2. PersistQueryClientProvider restores from IndexedDB         │
│     └── Data is present but stale (>staleTime since last use) │
│     └── React components mount with stale-but-valid data      │
│                                                                │
│  3. sessionStorage("erp_cache_warmed") is GONE (new session)   │
│     └── Overlay would trigger, BUT...                          │
│                                                                │
│  4. NEW CHECK: does IndexedDB have cached data? (age < 7 days)│
│     ├── YES → "Quick Refresh" mode                            │
│     └── NO  → Full download mode (same as first login)        │
│                                                                │
│  "Quick Refresh" mode:                                         │
│  ├── Show minimal overlay: "Memperbarui data..." (spinner)    │
│  ├── NO progress bar, NO item checklist — just a brief splash │
│  ├── Batch-refetch only P1 items (22 queries, parallel-6)     │
│  ├── Most resolve instantly (data is cached, just revalidating)│
│  ├── Auto-dismiss after 1-2 seconds                           │
│  ├── Set sessionStorage("erp_cache_warmed", "true")           │
│  └── P2 + P3 refetch silently in background                   │
│                                                                │
│  Result: <2s to interactive. Cached data visible immediately.  │
└────────────────────────────────────────────────────────────────┘
```

### Cache Invalidation — When Does Cache Get Cleared?

```
┌─ Cache Invalidation Rules ───────────────────────────────────┐
│                                                                │
│  1. NEW DEPLOYMENT DETECTED (Service Worker update)           │
│     ├── SW detects new version via CACHE_VERSION mismatch     │
│     ├── Re-cache static assets (JS/CSS/HTML) only             │
│     ├── Data cache (IndexedDB) is NOT cleared                 │
│     ├── CACHE_BUSTER bump clears data only on schema changes  │
│     └── Show toast: "Pembaruan tersedia — muat ulang"         │
│                                                                │
│  2. USER LOGS OUT                                             │
│     ├── clearPersistedCache() wipes IndexedDB (all idb-keyval)│
│     ├── queryClient.clear() wipes in-memory cache             │
│     ├── sessionStorage.removeItem("erp_cache_warmed")         │
│     ├── SECURITY: prevents data leaking between users         │
│     └── Next login = full re-download (cold start)            │
│                                                                │
│  3. DATA EXCEEDS gcTime (automatic garbage collection)        │
│     ├── TanStack Query GC runs automatically                  │
│     ├── T1/T2/T3: gcTime = 7 days → GC after 7 days unused   │
│     ├── T4/T5: gcTime = 1 day → GC after 24h unused          │
│     ├── T6: gcTime = 1 hour → GC after 1h unused             │
│     └── No user action needed — fully automatic               │
│                                                                │
│  4. MANUAL CACHE CLEAR (debugging / support)                  │
│     ├── Settings page: "Bersihkan Cache" button               │
│     ├── Calls clearPersistedCache() + location.reload()       │
│     ├── For support staff debugging stale-data issues         │
│     └── Also available via browser DevTools → IndexedDB       │
│                                                                │
│  5. GLOBAL ERROR (app crash)                                  │
│     ├── global-error.tsx already nukes ALL IndexedDB databases│
│     ├── Also clears localStorage and sessionStorage           │
│     └── Nuclear reset — ensures clean recovery from corruption│
│                                                                │
│  WHAT DOES NOT CLEAR CACHE:                                   │
│  ├── Page refresh → IndexedDB survives                        │
│  ├── Browser close → IndexedDB survives (up to gcTime)       │
│  ├── Tab switch → no effect                                   │
│  └── Network offline → app uses cached data (read-only)      │
└────────────────────────────────────────────────────────────────┘
```

### Data Update During Active Use

```
┌─ User Performs Mutation (e.g., records payment) ─────────────┐
│                                                                │
│  Server action: recordInvoicePayment()                        │
│  ├── Updates Invoice (status, balanceDue)                     │
│  ├── Creates Payment record                                   │
│  ├── Posts JournalEntry (GL)                                  │
│  └── Returns success                                          │
│                                                                │
│  Client-side invalidation (in onSuccess callback):            │
│  ├── queryClient.invalidateQueries(queryKeys.invoices.*)      │
│  ├── queryClient.invalidateQueries(queryKeys.arPayments.*)    │
│  ├── queryClient.invalidateQueries(queryKeys.journal.*)       │
│  ├── queryClient.invalidateQueries(queryKeys.financeDashboard)│
│  └── queryClient.invalidateQueries(queryKeys.executiveDash)   │
│                                                                │
│  TanStack Query handles the rest:                              │
│  ├── Invalidated queries refetch in background                │
│  ├── UI updates seamlessly (no loading screen)                │
│  └── New data persists to IndexedDB via persister             │
│                                                                │
│  Other users (same data, different browser):                   │
│  ├── CURRENT: see stale data until staleTime expires          │
│  │   └── T5 = 60s → other user sees updated invoice in <60s  │
│  └── FUTURE (Supabase Realtime — Phase 2):                    │
│      ├── Other users' browsers receive websocket push         │
│      ├── Their TanStack cache is invalidated automatically    │
│      └── Their UI updates without manual refresh              │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Offline Resilience

### App Shell — Always Available

```
┌─ Offline Scenario ───────────────────────────────────────────┐
│                                                                │
│  User opens app with no internet connection                    │
│                                                                │
│  1. Service Worker intercepts navigation request               │
│     └── Serves cached app shell (HTML/JS/CSS) from Cache API  │
│     └── App renders in <200ms — no "dinosaur" error page      │
│                                                                │
│  2. PersistQueryClientProvider restores data from IndexedDB    │
│     └── networkMode: "offlineFirst" → use cached data as-is   │
│     └── No fetch attempts while offline                        │
│                                                                │
│  3. User can browse ALL cached pages in read-only mode         │
│     ├── Dashboard with last-known KPIs                        │
│     ├── Product catalog, customer list, vendor list           │
│     ├── Invoice history, PO history, journal entries          │
│     ├── Any page that was previously visited/prefetched        │
│     └── Data is stale but better than a blank screen          │
│                                                                │
│  4. Offline indicator banner (top of screen)                   │
│     └── "Anda sedang offline — data mungkin tidak terbaru"    │
│     └── Dismissable but re-appears on every navigation        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Write Operations While Offline

```
┌─ Offline Write Strategy ─────────────────────────────────────┐
│                                                                │
│  CURRENT APPROACH (Phase 1 — simple, safe):                   │
│  ├── Write operations (create invoice, record payment, etc.)  │
│  │   show error toast: "Tidak bisa menyimpan — periksa koneksi"│
│  ├── Form data is NOT lost — stays in form state              │
│  ├── User retries when connection returns                     │
│  └── No data loss, no conflict resolution needed              │
│                                                                │
│  FUTURE APPROACH (Phase 3+ — optional, flagged as complex):   │
│  ├── TanStack Query's mutation queue (networkMode: "offlineFirst")│
│  │   already pauses mutations when offline                    │
│  ├── queryClient.resumePausedMutations() on reconnect         │
│  │   (already called in PersistQueryClientProvider onSuccess) │
│  ├── COMPLEXITY WARNING:                                      │
│  │   ├── Conflict resolution: what if two users edit same PO? │
│  │   ├── Sequence dependency: payment needs invoice to exist  │
│  │   ├── Server validation: GL posting may fail on sync       │
│  │   └── Audit trail: when was the action actually taken?     │
│  └── RECOMMENDATION: Defer offline writes until Supabase      │
│      Realtime is implemented. The conflict resolution needed  │
│      for double-entry accounting makes this non-trivial.      │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Connection Recovery

```
┌─ Connection Recovery Flow ───────────────────────────────────┐
│                                                                │
│  Browser fires "online" event                                  │
│                                                                │
│  1. Remove offline indicator banner                            │
│  2. Show brief toast: "Koneksi kembali — memperbarui data..." │
│  3. Invalidate all T5/T6 queries (transactional + realtime)   │
│     └── These are most likely to have changed while offline   │
│  4. TanStack Query refetches invalidated queries in background│
│  5. Resume any paused mutations (if offline write is enabled) │
│  6. Toast: "Data diperbarui" (after refetch completes)        │
│                                                                │
│  No loading screen. No overlay. Silent background sync.       │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Remove the "Lewati" Button — Specification

### What to Delete

```
File: components/cache-warming-overlay.tsx

DELETE lines 191-196:
  <button
      onClick={dismiss}
      className="text-xs text-zinc-400 hover:text-black ..."
  >
      Lewati
  </button>

KEEP the dismiss() function — it is still used by:
  - Auto-dismiss after Phase 1 completes (line 129)
  - Quick Refresh mode auto-dismiss
  - Phase 2→interactive transition at 90% progress
```

### Error Handling (replaces skip button)

Instead of a skip button, failed items are handled gracefully:

```
┌─ Per-Item Error Handling ────────────────────────────────────┐
│                                                                │
│  For each prefetch item:                                       │
│                                                                │
│  try {                                                         │
│    await queryClient.prefetchQuery(config)  // attempt 1       │
│    setPriorityDone(prev => prev + 1)        // ✓ success      │
│  } catch {                                                     │
│    await delay(1000)                         // backoff        │
│    try {                                                       │
│      await queryClient.prefetchQuery(config) // attempt 2      │
│      setPriorityDone(prev => prev + 1)       // ✓ success     │
│    } catch {                                                   │
│      await delay(2000)                        // longer backoff│
│      try {                                                     │
│        await queryClient.prefetchQuery(config)// attempt 3     │
│        setPriorityDone(prev => prev + 1)      // ✓ success    │
│      } catch {                                                 │
│        logWarning(`Prefetch failed: ${route}`)                 │
│        setFailedItems(prev => [...prev, route])                │
│        setPriorityDone(prev => prev + 1)      // ✕ skip item  │
│        // DO NOT BLOCK — continue to next item                 │
│      }                                                         │
│    }                                                           │
│  }                                                             │
│                                                                │
│  Item timeout: AbortController with 15s timeout per item       │
│  └── If server is slow, abort and count as failure             │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ Catastrophic Failure (>50% of P1 items fail) ───────────────┐
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              [E] (logo)                                   │ │
│  │                                                           │ │
│  │         Koneksi Bermasalah                                │ │
│  │    Tidak dapat mengunduh data yang dibutuhkan              │ │
│  │                                                           │ │
│  │  ████████░░░░░░░░░░░░░░░░  35%                           │ │
│  │                                                           │ │
│  │  ✓ Dashboard          ✕ Produk                           │ │
│  │  ✓ Inventori          ✕ Pelanggan                        │ │
│  │  ✕ Penjualan          ✕ Pesanan                          │ │
│  │  ✕ Keuangan           ✕ Invoice                          │ │
│  │  ✕ Pengadaan          ✕ Purchase Order                   │ │
│  │  ✕ Manufaktur         ✕ Bill of Materials                │ │
│  │                                                           │ │
│  │           [ Coba Lagi ]   ← NOT a skip button             │ │
│  │                                                           │ │
│  │  Periksa koneksi internet Anda dan coba lagi.             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  "Coba Lagi" behavior:                                        │
│  ├── Restarts from the FIRST failed item (not from zero)     │
│  ├── Already-cached items are skipped (instant)              │
│  ├── Only failed items are re-attempted                       │
│  └── Progress bar continues from where it stopped            │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Visual States Per Item

| State | Icon | Color | Meaning |
|-------|------|-------|---------|
| Pending | `◌` (empty circle) | `text-zinc-300` | Not yet started |
| Loading | `⟳` (spinner) | `text-orange-500 animate-spin` | Currently fetching |
| Success | `✓` (checkmark) | `text-emerald-500` | Cached successfully |
| Failed | `✕` (cross) | `text-red-400` | Failed after 3 retries, skipped |
| Retrying | `⟳` (spinner) | `text-amber-500 animate-spin` | Retry attempt in progress |

---

## 6. Performance Budget

### Target Metrics

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| **First Login (cold, 4G)** | < 8 seconds | Time from auth success to overlay dismiss (90% progress) |
| **First Login (cold, WiFi)** | < 5 seconds | Same measurement |
| **Subsequent Visit (warm, cache exists)** | < 500ms to interactive | Time from navigation to first meaningful paint with data |
| **Quick Refresh (stale cache)** | < 2 seconds | Time from app load to overlay dismiss |
| **Data refresh (background)** | < 1 second per query | Time for individual refetch, invisible to user |
| **Page navigation (cached)** | 0ms perceived | TanStack cache hit — data already in memory |
| **Page navigation (not yet prefetched)** | < 200ms | Hover-prefetch via `useNavPrefetch()` fills cache on intent |
| **Offline app load** | < 200ms | Service Worker shell cache + IndexedDB hydration |

### Budget Breakdown — First Login (8s on 4G)

```
┌─ Time Budget ────────────────────────────────────────────────┐
│                                                                │
│  0.0s ─ Auth validated, overlay appears                        │
│                                                                │
│  0.0s ─ 3.5s: P1 Critical (22 items)                         │
│  ├── Batch 1 (6 items): ~600ms (parallel, server actions)    │
│  ├── Batch 2 (6 items): ~600ms                               │
│  ├── Batch 3 (6 items): ~600ms                               │
│  └── Batch 4 (4 items): ~400ms + master data ~300ms          │
│  Progress bar: 0% → 60%                                      │
│                                                                │
│  3.5s ─ 7.0s: P2 Important (32 items)                         │
│  ├── Batch 1-5 (6 items each): ~600ms each = 3.0s           │
│  └── Batch 6 (2 items): ~200ms                               │
│  Progress bar: 60% → 90%                                     │
│                                                                │
│  7.0s: OVERLAY DISMISSES — app is interactive                  │
│  Progress bar: at 90%                                          │
│                                                                │
│  7.0s ─ 15s: P3 Background (49 items, invisible)              │
│  ├── Batch 1-12 (4 items each, 150ms gaps): ~8s              │
│  └── Progress: 90% → 100% (not shown to user)               │
│  └── sessionStorage("erp_cache_warmed", "true")               │
│                                                                │
│  TOTAL BLOCKING TIME: ~7s on 4G, ~4s on WiFi                 │
│  TOTAL BACKGROUND TIME: ~8s additional (invisible)            │
└────────────────────────────────────────────────────────────────┘
```

### Per-Query Budget

| Query Type | Max Response Time | Action if Exceeded |
|-----------|------------------|-------------------|
| Server action (Prisma) | 3 seconds | Log warning, check query optimization |
| API route (fetch) | 5 seconds | Log warning, check endpoint |
| Master data (small tables) | 500ms | Should be near-instant |
| Dashboard aggregate | 5 seconds | Already has per-function timeouts |
| Any single item | 15 seconds (hard timeout) | AbortController abort, mark as failed |

### Monitoring

Track these metrics in production (via `performance.mark()` / `performance.measure()`):

```ts
// In CacheWarmingOverlay — track timing
performance.mark("prefetch-start")

// After P1 completes
performance.mark("prefetch-p1-done")
performance.measure("prefetch-p1", "prefetch-start", "prefetch-p1-done")

// After P2 completes (overlay dismisses)
performance.mark("prefetch-interactive")
performance.measure("prefetch-to-interactive", "prefetch-start", "prefetch-interactive")

// After P3 completes (all done)
performance.mark("prefetch-complete")
performance.measure("prefetch-total", "prefetch-start", "prefetch-complete")

// Log to console in dev, send to analytics in prod
const p1Time = performance.getEntriesByName("prefetch-p1")[0]?.duration
const interactiveTime = performance.getEntriesByName("prefetch-to-interactive")[0]?.duration
console.log(`[Prefetch] P1: ${p1Time}ms | Interactive: ${interactiveTime}ms`)
```

### What Happens If Budget Is Exceeded

| Situation | Response |
|-----------|----------|
| P1 takes > 8s | Log warning. Check for slow queries. Consider moving slow items to P2. |
| P2 takes > 10s | Move rarely-accessed items from P2 to P3. |
| Single query > 5s consistently | Add server-side caching or query optimization for that specific endpoint. |
| Total prefetch > 20s | Critical — audit database performance, check connection pooling. |
| IndexedDB restore > 1s | Check cache size. Consider limiting gcTime or pruning large entries. |

---

## 7. Mutation-Based Cache Invalidation Map

Every server action that mutates data MUST invalidate the affected query keys. This replaces short `staleTime` polling for the current user — they see their own changes instantly.

| Mutation | Invalidate These Query Keys |
|----------|---------------------------|
| `createCustomerInvoice` | `invoices.*`, `financeDashboard.*`, `executiveDashboard.*`, `arPayments.*` |
| `recordInvoicePayment` | `invoices.*`, `arPayments.*`, `journal.*`, `financeDashboard.*`, `executiveDashboard.*` |
| `recordVendorPayment` | `bills.*`, `vendorPayments.*`, `payables.*`, `journal.*`, `financeDashboard.*` |
| `createPurchaseOrder` | `purchaseOrders.*`, `procurementDashboard.*`, `approvals.*` |
| `approvePurchaseOrder` | `purchaseOrders.*`, `approvals.*`, `procurementDashboard.*` |
| `createPurchaseRequest` | `purchaseRequests.*`, `procurementDashboard.*` |
| `postJournalEntry` | `journal.*`, `chartAccounts.*`, `financeDashboard.*` |
| Stock movement (GRN, adjustment, transfer) | `stockMovements.*`, `products.*`, `inventoryDashboard.*`, `adjustments.*` |
| `createSalesOrder` | `salesOrders.*`, `salesPage.*`, `executiveDashboard.*` |
| Employee CRUD | `employees.*`, `hcmDashboard.*` |
| Product CRUD | `products.*`, `inventoryDashboard.*` |

**Implementation:** Wrap each server action's `onSuccess` callback with the appropriate `queryClient.invalidateQueries()` calls. Many are already done — audit and fill gaps.

---

## 8. Role-Based Prefetch Optimization (Optional)

Different roles land on different pages. We can prioritize what to prefetch first based on role:

| Role | Home Page | P1 Emphasis |
|------|-----------|-------------|
| `ROLE_CEO` / `ROLE_DIRECTOR` | `/dashboard` | Dashboard, finance, sales KPIs |
| `ROLE_MANAGER` | `/manager` | Manager tasks, department employees, work orders |
| `ROLE_ACCOUNTANT` | `/finance` | Finance dashboard, invoices, journal, COA |
| `ROLE_PURCHASING` | `/procurement` | POs, PRs, vendors, receiving |
| `ROLE_WAREHOUSE` | `/procurement/receiving` | GRN, stock movements, warehouses |
| `ROLE_STAFF` | `/staff` | Staff tasks only |
| `ROLE_SALES` | `/sales` | Sales orders, customers, leads, quotations |

**Implementation:** Reorder `PRIORITY_ROUTES` based on `user.role` so the user's home page and its dependencies load first. All data still loads eventually — just the order changes.

```ts
function getPriorityRoutes(role: UserRole): string[] {
  const roleRoutes: Record<string, string[]> = {
    ROLE_CEO: ["/dashboard", "/finance", "/sales", ...],
    ROLE_ACCOUNTANT: ["/finance", "/finance/invoices", "/finance/journal", ...],
    ROLE_PURCHASING: ["/procurement", "/procurement/orders", "/procurement/requests", ...],
    // ...
  }
  const rolePriority = roleRoutes[role] ?? roleRoutes.ROLE_STAFF
  // Merge with base PRIORITY_ROUTES, deduplicating
  return [...new Set([...rolePriority, ...BASE_PRIORITY_ROUTES])]
}
```

---

## 9. Implementation Phases

### Phase 1: Fix Current System (1-2 days)

1. **Remove "Lewati" button** from `cache-warming-overlay.tsx` (Section 5)
2. **Fix stale key**: rename `/manufacturing/process-stations` → `/manufacturing/processes` in `routePrefetchMap`
3. **Add 13 missing routes** to `routePrefetchMap` (Section 2)
4. **Redesign overlay UI** — weighted progress bar (0-60% P1, 60-90% P2, 90% = interactive)
5. **Add item-level checkmarks** with visual states (pending/loading/success/failed)
6. **Add per-item error handling** — 15s timeout, 3 retries, skip-and-continue (Section 5)
7. **Add catastrophic failure UI** — "Koneksi Bermasalah" + "Coba Lagi" retry button
8. **Add "Quick Refresh" mode** — detect existing IndexedDB cache, show lighter overlay

### Phase 2: Cache Tiers (1 day)

1. **Create `lib/cache-tiers.ts`** with tiered staleTime constants (Section 1, Layer 2)
2. **Update `routePrefetchMap`** entries to include tier metadata
3. **Update `lib/query-client.tsx`** — change global staleTime from 30min to 5min
4. **Add per-query staleTime overrides** in useQuery calls where needed
5. **Add performance timing** via `performance.mark()` / `performance.measure()` (Section 6)

### Phase 3: Service Worker + Offline (1 day)

1. **Add `CACHE_VERSION`** derived from build hash
2. **Add cache cleanup on activate** (delete old cache versions)
3. **Add "update available" notification** via `postMessage` → toast
4. **Add offline indicator banner** — "Anda sedang offline" (Section 4)
5. **Add connection recovery handler** — invalidate T5/T6 queries on "online" event
6. **Block write operations when offline** — error toast, preserve form state

### Phase 4: Mutation Invalidation Audit (1 day)

1. **Audit all server actions** for missing `queryClient.invalidateQueries()` calls
2. **Implement invalidation map** as documented in Section 7
3. **Test**: mutation → immediate UI update → no stale data

### Phase 5: Supabase Realtime (future, 2-3 days)

1. Enable Postgres replication for critical tables
2. Create realtime channel subscriptions
3. Wire channel events to TanStack Query invalidation
4. Remove short staleTime polling for realtime-covered tables

---

## 10. Dead Code to Remove

| File | Reason |
|------|--------|
| `components/warm-cache.tsx` | Superseded by `CacheWarmingOverlay`. Not mounted. |
| `app/api/cache-warm/route.ts` | Not used by current overlay. Only referenced by old prefetch hook. |
| `lib/performance/procurement-prefetch.ts` | Old MutationObserver-based prefetch. Superseded by `useNavPrefetch()`. |

---

## 11. Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| First login → interactive (4G) | 3-5s (with skip temptation) | < 8s (no skip, P1+P2 mandatory) |
| First login → interactive (WiFi) | 3-5s (with skip temptation) | < 5s (no skip, P1+P2 mandatory) |
| Return visit → interactive (warm cache) | 0-2s (IndexedDB restore) | < 500ms (SW shell + IndexedDB) |
| Return visit → interactive (stale cache) | 0-2s + overlay | < 2s (Quick Refresh mode) |
| Page navigation (cached) | 0ms | 0ms (no change) |
| Page navigation (uncached — 13 missing pages) | 1-3s (loading skeleton) | 0ms (all pages now in prefetch) |
| Stale data visibility | Up to 30min (flat for all data) | Tier-based: 30s (T6) to 24h (T1) |
| Current-user data freshness | Depends on staleTime | Instant (mutation-based invalidation) |
| Cross-user data freshness | Manual refresh required | Within staleTime (future: realtime push) |
| Offline app load | White screen / error | < 200ms (SW shell + cached data, read-only) |
| Offline data browsing | Partial (some pages work) | Full (all prefetched pages readable offline) |
| Skip button exists | Yes ("Lewati") | **No** — deleted entirely |
| Failed item handling | Blocks entire flow | Per-item retry (3x) then skip, continue others |
| Network failure UX | Overlay hangs indefinitely | "Koneksi Bermasalah" + "Coba Lagi" retry |

---

## 12. Implementation Status (as of 2026-03-28)

All phases from Section 9 are now implemented except Phase 4 (mutation invalidation audit) and Phase 5 (Supabase Realtime).

### Implemented Files

| File | Purpose | Status |
|------|---------|--------|
| `lib/cache-tiers.ts` | 6-tier staleTime/gcTime/refetchOnFocus system (T1–T6) | **Done** |
| `lib/prefetch-manifest.ts` | P1/P2/P3 route organization with progress weights | **Done** |
| `lib/query-client.tsx` | Global staleTime 5min, IndexedDB persister, session flag cleanup on logout | **Done** |
| `hooks/use-nav-prefetch.ts` | 86 routes + 10 master data entries, tier-aware hover prefetch | **Done** |
| `hooks/use-background-refresh.ts` | Post-hydration P1 refresh + window focus T4/T5/T6 invalidation | **Done** |
| `components/cache-warming-overlay.tsx` | 3-phase prefetch, no skip button, IndexedDB cache detection, retry on failure | **Done** |
| `components/background-refresh.tsx` | Mount point for useBackgroundRefresh hook | **Done** |
| `components/service-worker-register.tsx` | SW registration + update detection + "Update tersedia" toast | **Done** |
| `components/global-layout.tsx` | Mounts CacheWarmingOverlay + BackgroundRefresh | **Done** |
| `public/sw.js` | Cache-first for /_next/static, network-first for HTML, stale-while-revalidate for assets, versioned caches, update notification | **Done** |

### Bugs Found and Fixed (E2E Audit)

| # | Issue | Fix |
|---|-------|-----|
| 1 | Operator precedence ambiguity in `onAuthStateChange` — `SIGNED_OUT \|\| TOKEN_REFRESHED && !session` | Added explicit parentheses: `SIGNED_OUT \|\| (TOKEN_REFRESHED && !session)` |
| 2 | `clearPersistedCache()` silently swallowed IndexedDB errors — potential cross-user data leak | Added `console.error` logging + sessionStorage cleanup in same function |
| 3 | Dead code in `batchPrefetchRoutes` — `allSettled` rejection check unreachable after catch | Removed dead code |
| 4 | `hasStarted` ref not reset on logout via `router.push` — overlay couldn't re-trigger | Added `useEffect` that resets `hasStarted` when `isAuthenticated` becomes false |
| 5 | Routes in manifest but missing from `routePrefetchMap` would silently break progress bar | Added dev-mode warning + progress tick for missing routes |
| 6 | Stale route key `/manufacturing/process-stations` (route renamed to `/manufacturing/processes`) | Fixed in `routePrefetchMap` |

### Architecture Flow Summary

```
┌─ First Login (no cache) ─────────────────────────────────────┐
│                                                                │
│  Auth success                                                  │
│  → hasPersistedCache() = false                                │
│  → Show "Mempersiapkan Sistem" overlay                        │
│  → P1: 22 items (progress 0–60%) — 6 landing + 6 sub + 10 md │
│  → P2: 33 items (progress 60–90%) — all module sub-pages      │
│  → Dismiss at 90% — app interactive                           │
│  → P3: 41 items (background, invisible)                       │
│  → sessionStorage("erp_cache_warmed", "true")                 │
│  → Total: 86 routes + 10 master data = 96 queries             │
│                                                                │
│  3s later: BackgroundRefresh invalidates P1 queries            │
│  (picks up any changes since prefetch started)                 │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ Return Visit (cache exists) ────────────────────────────────┐
│                                                                │
│  SW serves app shell from cache (< 200ms)                     │
│  PersistQueryClientProvider hydrates from IndexedDB            │
│  hasPersistedCache() = true → skip overlay → instant           │
│  sessionStorage("erp_cache_warmed", "true")                   │
│                                                                │
│  3s later: BackgroundRefresh invalidates P1 queries            │
│  On tab focus: T4/T5/T6 queries invalidated (dashboards,      │
│               transactional, approvals)                        │
│  On navigate: refetchOnMount=true refetches stale data         │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ Logout → Re-Login ─────────────────────────────────────────┐
│                                                                │
│  logout() → clearPersistedCache()                             │
│    → IndexedDB clear() + queryClient.clear()                  │
│    → sessionStorage.removeItem("erp_cache_warmed")            │
│  hasStarted.current reset to false (useEffect on auth change) │
│  Login page → window.location.href (full reload)              │
│  hasPersistedCache() = false → full prefetch again             │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ New Deployment ─────────────────────────────────────────────┐
│                                                                │
│  SW detects new version (registration.update() every 30min)   │
│  New SW installs → skipWaiting → activate                     │
│  Old caches deleted (erp-static-v1, erp-pages-v1)             │
│  New caches created (erp-static-v2, erp-pages-v2)             │
│  postMessage("SW_UPDATED") → toast "Update tersedia"          │
│  User clicks "Muat Ulang" → full page reload                  │
│  IndexedDB data cache persists (CACHE_BUSTER unchanged)       │
│                                                                │
└────────────────────────────────────────────────────────────────┘

┌─ Offline ────────────────────────────────────────────────────┐
│                                                                │
│  SW serves app shell from CACHE_PAGES                         │
│  SW serves JS/CSS from CACHE_STATIC                           │
│  TanStack Query serves data from IndexedDB (offlineFirst)     │
│  All pages render with last-known data (read-only)            │
│  Write operations fail with error toast                        │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Cache Layers (Complete Stack)

| Layer | Technology | What it caches | Lifetime | Offline? |
|-------|-----------|---------------|----------|----------|
| 1. Service Worker | Cache API (`erp-static-v2`, `erp-pages-v2`) | JS bundles, CSS, fonts, images, HTML shell | Until next deploy (SW_VERSION bump) | Yes |
| 2. IndexedDB | `idb-keyval` via TanStack persister | All 96 query responses | 7 days (maxAge), per-query gcTime | Yes |
| 3. TanStack Query | In-memory QueryClient | Active query data | Per-query staleTime (30s–24h) | Yes (offlineFirst) |
| 4. Session flag | `sessionStorage("erp_cache_warmed")` | Whether overlay has run | Until tab/browser close | N/A |

### Remaining Work

- [ ] **Phase 4: Mutation invalidation audit** — ensure all server actions call `queryClient.invalidateQueries()` for affected query keys (Section 7)
- [ ] **Phase 5: Supabase Realtime** — push updates for invoices, payments, approvals, stock movements
- [ ] **Performance monitoring** — add `performance.mark()`/`performance.measure()` to overlay (Section 6)
- [ ] **Role-based prefetch ordering** — prioritize user's home module in P1 (Section 8)
