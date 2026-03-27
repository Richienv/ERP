# Mandatory Cache Warming — Remove "Lewati" Skip Button

**Date:** 2026-03-27
**Status:** Approved
**Approach:** A — Mandatory Overlay + Fill Gaps

## Problem

The ERP has a two-phase cache warming system (`CacheWarmingOverlay`) that prefetches all route data after login so pages open instantly. However, a "Lewati" (skip) button lets users bypass this process, resulting in slow page loads and skeleton screens on every navigation — the opposite of the Xero/SAP-like experience we want.

**Sebelumnya (Before):** User clicks "Lewati", then every page they visit takes 1-3s to load data from the server. The skip button defeats the entire prefetch architecture.

**Sekarang (Now):** No skip button. Fresh logins wait 3-5s for priority data, then everything is instant. Returning users (IndexedDB cache) see the overlay for ~300ms then instant app.

**Kenapa penting:** A snappy ERP builds user trust. Indonesian SME users on variable connections need data pre-loaded, not fetched on-demand. Xero and SAP both use mandatory initial loads for this reason.

## Design

### 1. Remove "Lewati" Button from CacheWarmingOverlay

**File:** `components/cache-warming-overlay.tsx`

Remove the skip button element (lines 191-196) and the `dismiss` callback's association with any user-initiated action. Keep the `dismiss` function itself — it's still called by the auto-dismiss logic when Phase 1 completes.

The overlay behavior becomes:
- Fresh login (no IndexedDB cache): Overlay shows 3-5s with progress bar → auto-dismisses when priority routes cached → Phase 2 continues silently
- Returning user (IndexedDB cache): TanStack resolves `prefetchQuery` from cache instantly → overlay shows ~300ms → auto-dismisses
- Tab refresh (same session): `sessionStorage` flag `erp_cache_warmed` skips overlay entirely (existing behavior, unchanged)

### 2. Add Missing Prefetch Entries

**File:** `hooks/use-nav-prefetch.ts`

Add 4 new entries to `routePrefetchMap`:

#### `/accountant`
- **queryKey:** `queryKeys.financeDashboard.list()`
- **queryFn:** Same as `/finance` entry — the accountant landing page's child components (FinancialCommandCenter, InvoiceAging, BankReconciliation) pull from finance dashboard data
- **Note:** TanStack deduplicates this with the `/finance` entry since they share the same queryKey

#### `/finance/fixed-assets/categories`
- **queryKey:** `queryKeys.fixedAssetCategories.list()`
- **queryFn:** `getFixedAssetCategories()` from `@/lib/actions/finance-fixed-assets`
- **Also prefetch:** `getGLAccountsForFixedAssets()` with key `[...queryKeys.glAccounts.all, "forFA"]`

#### `/finance/fixed-assets/depreciation`
- **queryKey:** `queryKeys.depreciationRuns.list()`
- **queryFn:** `getDepreciationRuns()` from `@/lib/actions/finance-fixed-assets`

#### `/finance/fixed-assets/reports`
- **queryKey:** `queryKeys.fixedAssetReports.register()`
- **queryFn:** Parallel fetch of `getAssetRegisterReport()` + `getNetBookValueSummary()` from `@/lib/actions/finance-fixed-assets`
- **Note:** Only prefetch the two default-tab reports (register + NBV summary). The schedule and movement reports require parameters (assetId, date range) so they can't be meaningfully prefetched.

### 3. Fix Orphaned Route

**File:** `hooks/use-nav-prefetch.ts`

Rename the key `/manufacturing/process-stations` → `/manufacturing/processes` in `routePrefetchMap`. The route was renamed but the prefetch map key wasn't updated, so this route's data is never prefetched on hover or during cache warming.

### 4. Routes Intentionally Not Added

These 13 routes share queryKeys with existing entries (TanStack serves from same cache) or have no server data:

| Route | Reason |
|---|---|
| `/accountant/coa` | Same queryKey as `/finance/chart-accounts` |
| `/finance/payments` | Same queryKey as `/finance/receivables` |
| `/inventory/alerts` | Same queryKey as `/inventory/products` |
| `/inventory/stock` | Same queryKey as `/inventory/products` |
| `/inventory/reports` | Same queryKey as `/inventory/products` |
| `/documents/docs` | Same queryKey as `/documents` |
| `/documents/master` | Same queryKey as `/documents` |
| `/documents/reports` | Same queryKey as `/documents` |
| `/finance/fixed-assets/settings` | Static content, no server data |
| `/dashboard/pos` | "Coming soon" placeholder |
| `/dashboard/ecommerce` | Hardcoded mock data |
| `/settings/users` | Mock data |
| `/admin/workflows` | File upload only, no initial fetch |

## Files Changed

| File | Lines Changed | Change |
|---|---|---|
| `components/cache-warming-overlay.tsx` | ~6 lines removed | Remove "Lewati" button element |
| `hooks/use-nav-prefetch.ts` | ~30 lines added, ~2 lines renamed | Add 4 prefetch entries, fix 1 orphaned route |

## Verification

After implementation:
1. Fresh login (clear IndexedDB + sessionStorage): Overlay must appear, no skip button visible, auto-dismiss after priority routes load
2. Navigate to `/finance/fixed-assets/categories`, `/finance/fixed-assets/depreciation`, `/finance/fixed-assets/reports` — data should be pre-loaded (no loading spinner)
3. Navigate to `/manufacturing/processes` — data should be pre-loaded (was broken before due to orphaned key)
4. Returning user (keep IndexedDB, clear sessionStorage): Overlay appears briefly (~300ms) then dismisses
5. Same-session refresh: No overlay (sessionStorage flag)
