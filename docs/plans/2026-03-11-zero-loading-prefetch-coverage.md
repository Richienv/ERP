# Zero-Loading Prefetch Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make every page in the ERP open with 0ms loading by ensuring all data is prefetched during the "Mempersiapkan Sistem" splash screen or on sidebar hover — no skeleton/spinner should ever appear during normal navigation.

**Architecture:** The app already has a two-phase prefetch system: `CacheWarmingOverlay` (splash screen) → `WarmCache` (invisible). Both pull from `routePrefetchMap` in `hooks/use-nav-prefetch.ts`. The fix is to add all missing routes to that map + add master data prefetch for forms/dialogs. No new architecture needed — just filling gaps.

**Tech Stack:** TanStack Query, existing hooks, existing server actions + API routes.

**Key files:**
- `hooks/use-nav-prefetch.ts` — THE central map (add entries here = auto-prefetched everywhere)
- `components/cache-warming-overlay.tsx` — splash screen (may need priority list update)
- `components/warm-cache.tsx` — invisible background warmer (reads from same map)
- `lib/query-keys.ts` — query key factory (already complete)

---

## Gap Summary

### Missing page routes (17 routes not in `routePrefetchMap`):

| # | Route | Hook | QueryFn Source |
|---|-------|------|----------------|
| 1 | `/inventory/movements` | `useStockMovements()` | `getStockMovements(100)` + `fetch("/api/inventory/page-data")` |
| 2 | `/inventory/adjustments` | `useAdjustmentsData()` | `getStockMovements(50)` + `fetch("/api/inventory/page-data")` |
| 3 | `/inventory/alerts` | `useProductsPage()` | `fetch("/api/inventory/page-data")` — already prefetched via `/inventory/products` |
| 4 | `/inventory/audit` | inline `useQuery` | `getRecentAudits()` + `getProductsForKanban()` + `getWarehouses()` |
| 5 | `/inventory/cycle-counts` | `useCycleCounts()` | `getCycleCountSessions()` |
| 6 | `/inventory/opening-stock` | `useOpeningStock()` | `fetch("/api/inventory/opening-stock")` |
| 7 | `/inventory/settings` | `useInventorySettings()` | `fetch("/api/inventory/settings")` |
| 8 | `/inventory/reports` | `useProductsPage()` | Already prefetched via `/inventory/products` — skip |
| 9 | `/finance/invoices` | `useInvoiceKanban()` | `getInvoiceKanbanData()` |
| 10 | `/finance/petty-cash` | `usePettyCash()` | `getPettyCashTransactions()` |
| 11 | `/finance/transactions` | `useAccountTransactions()` | `fetch("/api/finance/transactions?limit=500")` |
| 12 | `/finance/expenses` | `useExpenses()` | `getExpenses()` + `getExpenseAccounts()` |
| 13 | `/hcm/payroll` | `usePayrollRun()` | `getPayrollRun(currentPeriod)` |
| 14 | `/settings/numbering` | `useDocumentNumbering()` | `getDocumentNumbering()` |
| 15 | `/settings/permissions` | `usePermissionMatrix()` | `getPermissionMatrix()` |
| 16 | `/accountant/coa` | inline `useQuery` | `getGLAccounts()` — shares key with `/finance/chart-accounts` |

### Missing master data (for forms/dialogs — 8 data sources):

| # | Data | Hook | QueryFn |
|---|------|------|---------|
| M1 | Units | `useUnits()` | `getUnits()` from `@/lib/actions/master-data` |
| M2 | Brands | `useBrands()` | `getBrands()` from `@/lib/actions/master-data` |
| M3 | Colors | `useColors()` | `getColors()` from `@/lib/actions/master-data` |
| M4 | Master Categories | `useMasterCategories()` | `getCategories()` from `@/lib/actions/master-data` |
| M5 | Suppliers | `useSuppliers()` | `getSuppliers()` from `@/lib/actions/master-data` |
| M6 | UOM Conversions | `useUomConversions()` | `getUomConversions()` from `@/lib/actions/master-data` |
| M7 | GL Accounts | `useGLAccounts()` | `getGLAccountsList()` from `@/lib/actions/finance` |
| M8 | Bank Accounts | `useBankAccounts()` | `getBankAccounts()` from `@/lib/actions/finance-petty-cash` + filter 10xx |
| M9 | Sales Options | `useSalesOptions()` | `fetch("/api/sales/options")` |

### Missing sidebar data:

| # | Data | Hook | QueryFn |
|---|------|------|---------|
| S1 | Action counts | `useSidebarActions()` | `fetch("/api/sidebar/action-counts")` |

---

## Task 1: Add missing inventory routes to `routePrefetchMap`

**Files:**
- Modify: `hooks/use-nav-prefetch.ts`

**Step 1: Add imports**

Add these imports at the top of `hooks/use-nav-prefetch.ts`:

```typescript
import { getStockMovements, getRecentAudits, getProductsForKanban } from "@/app/actions/inventory"
import { getCycleCountSessions } from "@/app/actions/cycle-count"
```

**Step 2: Add route entries**

Add these entries inside `routePrefetchMap`:

```typescript
"/inventory/movements": {
    queryKey: queryKeys.stockMovements.list(),
    queryFn: async () => {
        const [pageData, movements] = await Promise.all([
            fetch("/api/inventory/page-data").then(r => r.json()),
            getStockMovements(100),
        ])
        return { movements, products: pageData.products ?? [], warehouses: pageData.warehouses ?? [] }
    },
},
"/inventory/adjustments": {
    queryKey: queryKeys.adjustments.list(),
    queryFn: async () => {
        const [pageData, movements] = await Promise.all([
            fetch("/api/inventory/page-data").then(r => r.json()),
            getStockMovements(50),
        ])
        return { products: pageData.products ?? [], warehouses: pageData.warehouses ?? [], movements }
    },
},
"/inventory/audit": {
    queryKey: queryKeys.inventoryAudit.list(),
    queryFn: async () => {
        const [auditLogs, products, warehouses] = await Promise.all([
            getRecentAudits().catch(() => []),
            getProductsForKanban().catch(() => []),
            getWarehouses().catch(() => []),
        ])
        return { auditLogs, products, warehouses }
    },
},
"/inventory/cycle-counts": {
    queryKey: queryKeys.cycleCounts.list(),
    queryFn: getCycleCountSessions,
},
"/inventory/opening-stock": {
    queryKey: queryKeys.openingStock.list(),
    queryFn: async () => {
        const res = await fetch("/api/inventory/opening-stock")
        const json = await res.json()
        return { products: json.products ?? [], warehouses: json.warehouses ?? [], existingTransactions: json.existingTransactions ?? [] }
    },
},
"/inventory/settings": {
    queryKey: queryKeys.inventorySettings.list(),
    queryFn: async () => {
        const res = await fetch("/api/inventory/settings")
        if (!res.ok) return { allowNegativeStock: false }
        return res.json()
    },
},
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`
Expected: No new errors related to use-nav-prefetch.ts

**Step 4: Commit**

```bash
git add hooks/use-nav-prefetch.ts
git commit -m "feat(prefetch): add missing inventory routes to prefetch map"
```

---

## Task 2: Add missing finance routes to `routePrefetchMap`

**Files:**
- Modify: `hooks/use-nav-prefetch.ts`

**Step 1: Add imports**

```typescript
import { getInvoiceKanbanData } from "@/lib/actions/finance-invoices"
import { getPettyCashTransactions } from "@/lib/actions/finance-petty-cash"
import { getExpenses, getExpenseAccounts } from "@/lib/actions/finance"
```

**Step 2: Add route entries**

```typescript
"/finance/invoices": {
    queryKey: queryKeys.invoices.kanban(),
    queryFn: async () => {
        const kanban = await getInvoiceKanbanData({ q: null, type: "ALL" })
        return kanban || { draft: [], sent: [], overdue: [], paid: [] }
    },
},
"/finance/petty-cash": {
    queryKey: queryKeys.pettyCash.list(),
    queryFn: async () => {
        const result = await getPettyCashTransactions()
        if (!result || !result.success) return { transactions: [], currentBalance: 0, totalTopup: 0, totalDisbursement: 0 }
        return result
    },
},
"/finance/transactions": {
    queryKey: queryKeys.accountTransactions.list(),
    queryFn: async () => {
        const res = await fetch("/api/finance/transactions?limit=500")
        const json = await res.json()
        return { entries: json.entries ?? [], accounts: json.accounts ?? [] }
    },
},
"/finance/expenses": {
    queryKey: ["expenses", "list"],
    queryFn: async () => {
        const [expenses, accounts] = await Promise.all([
            getExpenses(),
            getExpenseAccounts(),
        ])
        return { expenses, ...accounts }
    },
},
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add hooks/use-nav-prefetch.ts
git commit -m "feat(prefetch): add missing finance routes to prefetch map"
```

---

## Task 3: Add missing HCM + settings routes to `routePrefetchMap`

**Files:**
- Modify: `hooks/use-nav-prefetch.ts`

**Step 1: Add imports**

```typescript
import { getPayrollRun } from "@/app/actions/hcm"
import { getDocumentNumbering } from "@/lib/actions/settings"
import { getPermissionMatrix } from "@/lib/actions/settings"
```

**Step 2: Add route entries**

```typescript
"/hcm/payroll": {
    queryKey: queryKeys.payroll.run(new Date().toISOString().slice(0, 7)),
    queryFn: async () => {
        const period = new Date().toISOString().slice(0, 7) // "2026-03"
        return getPayrollRun(period)
    },
},
"/settings/numbering": {
    queryKey: queryKeys.documentNumbering.list(),
    queryFn: async () => {
        const result = await getDocumentNumbering()
        if (result.success && result.data) return result.data
        return []
    },
},
"/settings/permissions": {
    queryKey: queryKeys.permissionMatrix.list(),
    queryFn: async () => {
        const result = await getPermissionMatrix()
        if (result.success && result.data) return result.data
        return []
    },
},
```

**Step 3: Run type check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add hooks/use-nav-prefetch.ts
git commit -m "feat(prefetch): add missing HCM and settings routes to prefetch map"
```

---

## Task 4: Add master data prefetch for forms/dialogs

This is the key change that makes form dialogs instant. Master data (units, brands, colors, etc.) is needed by create/edit dialogs across the entire app, but it's never prefetched.

**Files:**
- Modify: `hooks/use-nav-prefetch.ts` (add master data section)
- Modify: `components/cache-warming-overlay.tsx` (add master data to warm-up)

**Step 1: Add master data imports to `use-nav-prefetch.ts`**

```typescript
import { getUnits, getBrands, getColors, getCategories as getMasterCategories, getSuppliers, getUomConversions } from "@/lib/actions/master-data"
import { getGLAccountsList } from "@/lib/actions/finance"
import { getBankAccounts } from "@/lib/actions/finance-petty-cash"
```

**Step 2: Export a separate `masterDataPrefetchMap` in `use-nav-prefetch.ts`**

Add AFTER the `routePrefetchMap` export:

```typescript
/**
 * Master data used by create/edit dialogs across the entire app.
 * Prefetched during cache warming so form opens are instant.
 */
export const masterDataPrefetchMap: Record<string, { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }> = {
    units: {
        queryKey: queryKeys.units.list(),
        queryFn: getUnits,
    },
    brands: {
        queryKey: queryKeys.brands.list(),
        queryFn: getBrands,
    },
    colors: {
        queryKey: queryKeys.colors.list(),
        queryFn: getColors,
    },
    masterCategories: {
        queryKey: queryKeys.categories.master(),
        queryFn: getMasterCategories,
    },
    suppliers: {
        queryKey: queryKeys.suppliers.list(),
        queryFn: getSuppliers,
    },
    uomConversions: {
        queryKey: queryKeys.uomConversions.list(),
        queryFn: getUomConversions,
    },
    glAccounts: {
        queryKey: queryKeys.glAccounts.list(),
        queryFn: getGLAccountsList,
    },
    bankAccounts: {
        queryKey: queryKeys.glAccounts.bankAccounts(),
        queryFn: async () => {
            const accounts = await getBankAccounts()
            return accounts.filter((a: { code: string }) => /^10\d{2}$/.test(a.code))
        },
    },
    salesOptions: {
        queryKey: queryKeys.salesOptions.list(),
        queryFn: async () => {
            const res = await fetch("/api/sales/options")
            const payload = await res.json()
            return { customers: payload.data?.customers ?? [], users: payload.data?.users ?? [] }
        },
    },
    sidebarActions: {
        queryKey: queryKeys.sidebarActions.list(),
        queryFn: async () => {
            const res = await fetch("/api/sidebar/action-counts")
            if (!res.ok) return null
            return res.json()
        },
    },
}
```

**Step 3: Update `cache-warming-overlay.tsx` to prefetch master data**

In `components/cache-warming-overlay.tsx`, update the import:

```typescript
import { routePrefetchMap, masterDataPrefetchMap } from "@/hooks/use-nav-prefetch"
```

Add master data prefetch at the END of `warmPriority` (after page routes), before it resolves:

```typescript
// Also prefetch master data for forms/dialogs
await Promise.allSettled(
    Object.values(masterDataPrefetchMap).map(config =>
        queryClient.prefetchQuery({
            queryKey: config.queryKey,
            queryFn: config.queryFn,
        }).catch(() => {})
    )
)
```

**Step 4: Update `warm-cache.tsx` to also prefetch master data**

In `components/warm-cache.tsx`, update the import:

```typescript
import { routePrefetchMap, masterDataPrefetchMap } from "@/hooks/use-nav-prefetch"
```

Add master data prefetch inside the priority timer callback:

```typescript
// Also warm master data for form dialogs
Object.values(masterDataPrefetchMap).forEach(config => {
    queryClient.prefetchQuery({
        queryKey: config.queryKey,
        queryFn: config.queryFn,
    })
})
```

**Step 5: Run type check**

Run: `npx tsc --noEmit`

**Step 6: Commit**

```bash
git add hooks/use-nav-prefetch.ts components/cache-warming-overlay.tsx components/warm-cache.tsx
git commit -m "feat(prefetch): add master data prefetch for instant form/dialog opens"
```

---

## Task 5: Update priority routes in cache warming overlay

The current PRIORITY_ROUTES in `cache-warming-overlay.tsx` only has 9 items. We should reorganize to include the most commonly visited pages first.

**Files:**
- Modify: `components/cache-warming-overlay.tsx`

**Step 1: Update PRIORITY_ROUTES**

```typescript
const PRIORITY_ROUTES = [
    // Tier 1: Landing pages (what user sees first)
    "/dashboard",
    "/inventory",
    "/sales",
    "/finance",
    "/procurement",
    "/manufacturing",
    // Tier 2: Most-clicked sub-pages
    "/inventory/products",
    "/sales/customers",
    "/sales/orders",
    "/finance/invoices",
    "/procurement/orders",
    "/manufacturing/bom",
]
```

**Step 2: Run dev server and verify overlay shows correct count**

Run: `npm run dev`
Navigate to login, authenticate, verify:
- Overlay shows "1/12" initially
- Progress bar fills correctly
- After overlay dismisses, remaining routes load silently

**Step 3: Commit**

```bash
git add components/cache-warming-overlay.tsx
git commit -m "feat(prefetch): update priority routes to include most-visited pages"
```

---

## Task 6: Fix expenses hook to use queryKeys factory (cleanup)

The `useExpenses()` hook uses a raw `["expenses", "list"]` key instead of `queryKeys`. This means cache invalidation via `queryKeys.expenses.all` won't work.

**Files:**
- Check: `lib/query-keys.ts` — verify if `expenses` key exists
- Modify: `hooks/use-expenses.ts` if a key exists, or add one to `lib/query-keys.ts`

**Step 1: Check if `expenses` query key exists**

Search `lib/query-keys.ts` for "expenses". If it doesn't exist:

Add to `lib/query-keys.ts`:

```typescript
expenses: {
    all: ["expenses"] as const,
    list: () => [...queryKeys.expenses.all, "list"] as const,
},
```

**Step 2: Update `hooks/use-expenses.ts`**

```typescript
queryKey: queryKeys.expenses.list(),
```

**Step 3: Run type check + tests**

Run: `npx tsc --noEmit && npx vitest run`

**Step 4: Commit**

```bash
git add lib/query-keys.ts hooks/use-expenses.ts
git commit -m "fix(expenses): use queryKeys factory instead of raw array"
```

---

## Task 7: Verify and test full coverage

**Step 1: Count total prefetch entries**

Open `hooks/use-nav-prefetch.ts` and count entries in `routePrefetchMap` + `masterDataPrefetchMap`:
- Expected: ~71 route entries + 10 master data entries = ~81 total prefetch targets

**Step 2: Cross-reference with sidebar navigation**

Compare every route in `lib/sidebar-nav-data.ts` against `routePrefetchMap`. Every navigable route should be covered except:
- `/dashboard/pos` (LOCKED)
- `/help` (static page, no data)
- `/search` (static page)
- `/inventory/adjustments` hub page that links elsewhere — OK to skip if it has no data hook
- `/finance/payables` tab router — composites already-prefetched sub-pages
- `/settings/users` — uses mock data, no API call

**Step 3: Manual smoke test**

1. Clear browser localStorage/sessionStorage
2. Login to the app
3. Watch "Mempersiapkan Sistem" overlay complete
4. Click through EVERY sidebar link rapidly
5. Verify: NO skeleton/spinner should appear on any page
6. Open create dialogs (Tambah Produk, Buat PO, Buat Invoice)
7. Verify: dropdown selects (units, brands, colors, suppliers) load instantly

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(prefetch): complete zero-loading coverage for all pages and forms"
```

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| Routes in prefetch map | ~55 | ~71 |
| Master data prefetched | 0 | 10 (units, brands, colors, categories, suppliers, UOM, GL, bank, sales options, sidebar) |
| Pages with loading spinners | ~17 | 0 |
| Form dialogs with lazy data | All | 0 |
| Sidebar badges pop-in | Yes | No (prefetched) |

**Sebelumnya (Before):** Users saw loading skeletons on ~17 pages (inventory movements, audit, cycle-counts, finance invoices, petty cash, transactions, expenses, payroll, settings pages). Every create/edit dialog triggered fresh data fetches for units, brands, colors, suppliers.

**Sekarang (Now):** Every page and every dialog opens instantly with 0ms loading. All data is prefetched during the splash screen.

**Kenapa penting (Why it matters):** Indonesian SME users on slower connections will perceive the app as native-fast. Once past the splash screen, zero waiting = fewer abandoned workflows.
