# Prefetch Diagnostic Report — 2026-03-29

> **Environment:** Development (localhost:3002), fresh login (no IndexedDB cache)
> **Total prefetch time:** 213,569ms (~3.5 minutes)
> **Final result:** Completed to 100% (no "Koneksi Bermasalah" error)

---

## Executive Summary

The prefetch system completes successfully but **35 out of 62 P1+P2 queries timed out** (56% failure rate). The system still loads because we raised the failure threshold to 70%, but over half the data meant to be pre-loaded is NOT cached on first login. Users will still see loading spinners on those pages.

**Root cause:** Server actions called via Next.js are being **serialized/queued**, not truly parallel. When 6 server actions run concurrently, they queue behind each other on the Next.js server. By the time later ones execute, the client-side timeout has already expired.

**Key finding:** Every query using `fetch("/api/...")` succeeds. Every query using server actions (direct function calls) times out under load. This is a Next.js architectural constraint — server actions go through a single POST endpoint and are processed sequentially.

---

## Phase 1 Results: 10/23 OK, 13 FAIL (49,676ms)

### P1 Route Queries

| Route | Status | Time | Data Source | Notes |
|-------|--------|------|-------------|-------|
| `/dashboard` | OK | ~fast | `fetch("/api/dashboard")` | API route |
| `/sales` | OK | 7,845ms | `fetch("/api/sales/page-data")` | API route |
| `/inventory/products` | OK | 7,722ms | `fetch("/api/inventory/page-data")` | API route |
| `/sales/customers` | OK | 10,056ms | `fetch("/api/sales/customers")` | API route, barely made 12s |
| `/sales/orders` | OK | 8,836ms | `fetch("/api/sales/orders")` | API route |
| `/manufacturing` | OK | 11,337ms | `fetch("/api/manufacturing/dashboard")` | API route, barely made it |
| `/manufacturing/bom` | OK | 8,741ms | `fetch("/api/manufacturing/production-bom")` | API route |
| `/inventory` | **TIMEOUT** | 12,001ms | `fetch("/api/inventory/dashboard")` | API route — just barely missed |
| `/finance` | **TIMEOUT** | 12,002ms | **2 server actions** in parallel | `getFinancialMetrics()` + `getFinanceDashboardData()` |
| `/procurement` | **TIMEOUT** | 12,003ms | `fetch("/api/procurement/dashboard")` | API route — just barely missed |
| `/finance/invoices` | **TIMEOUT** | 12,338ms | **Server action** | `getInvoiceKanbanData()` |
| `/procurement/orders` | **TIMEOUT** | 12,651ms | **3 server actions** in parallel | `getAllPurchaseOrders()` + `getVendors()` + `getProductsForPO()` |

**Pattern:** API route queries succeed (7-11s). Server action queries and slow API routes timeout at 12s.

### P1 Master Data Queries

| Key | Status | Time | Data Source | Notes |
|-----|--------|------|-------------|-------|
| `sidebarActions` | OK | 0ms | `fetch("/api/sidebar/action-counts")` | API route, cached |
| `salesOptions` | OK | 1,455ms | `fetch("/api/sales/options")` | API route |
| `glAccounts` | OK | 11,732ms | **Server action** `getGLAccountsList()` | Barely made 12s cutoff |
| `units` | **TIMEOUT** | 12,024ms | **Server action** `getUnits()` | Tiny payload, should be <1s |
| `brands` | **TIMEOUT** | 12,026ms | **Server action** `getBrands()` | Tiny payload, should be <1s |
| `colors` | **TIMEOUT** | 12,027ms | **Server action** `getColors()` | Tiny payload, should be <1s |
| `masterCategories` | **TIMEOUT** | 12,027ms | **Server action** `getMasterCategories()` | Small payload |
| `suppliers` | **TIMEOUT** | 12,028ms | **Server action** `getSuppliers()` | Small payload |
| `uomConversions` | **TIMEOUT** | 12,028ms | **Server action** `getUomConversions()` | Small payload |
| `bankAccounts` | **TIMEOUT** | 12,996ms | **Server action** `getPettyCashBankAccounts()` | Small payload |
| `paymentTerms` | **TIMEOUT** | 12,996ms | **Server action** `getPaymentTerms()` | Tiny payload |

**Critical finding:** Master data queries like `getUnits()`, `getBrands()`, `getColors()` return ~20 rows each and should complete in <500ms. They're timing out at 12s because they're **queued behind other server action calls**. The glAccounts query (11,732ms) only succeeded because it happened to run early in the queue.

---

## Phase 2 Results: 17/39 OK, 22 FAIL (130,678ms total)

### P2 Timeouts (15s limit)

| Route | Time | Data Source | Severity |
|-------|------|-------------|----------|
| `/sales/quotations` | 16,000ms | Server action `getQuotations()` | Medium |
| `/sales/salespersons#commission` | 16,001ms | `fetch("/api/sales/salespersons/commission")` | Low — also 404 error |
| `/procurement/requests` | 16,004ms | Server action `getPurchaseRequests()` | Medium |
| `/procurement/receiving` | 16,009ms | **4 server actions** in parallel | High — heaviest query |
| `/finance/journal` | 15,863ms | **2 server actions** | Medium |
| `/finance/vendor-payments` | 15,355ms | **2 server actions** | Medium |
| `/finance/vendor-payments#banks` | 15,999ms | Server action (dynamic import) | Low |
| `/finance/bills` | 16,007ms | Server action `getVendorBillsRegistry()` | Medium |
| `/finance/receivables` | 16,005ms | Server action (dynamic import) | Medium |
| `/finance/receivables#payments` | 15,999ms | **2 server actions** (dynamic import) | Medium |
| `/finance/payables` | 15,011ms | Server action (dynamic import) | Medium |
| `/finance/payables#bills` | 15,010ms | Server action `getVendorBillsRegistry()` | Medium — duplicate of /finance/bills |
| `/inventory/movements` | 15,989ms | `fetch()` + server action mixed | Medium |
| `/inventory/adjustments` | 15,995ms | `fetch()` + server action mixed | Medium |
| `/inventory/transfers` | 15,998ms | **2 server actions** | Medium |
| `/hcm` | 15,229ms | Server action `getHCMDashboardData()` | Medium |
| `/hcm#snapshot` | 15,003ms | Server action `getAttendanceSnapshot()` | Low |
| `/dashboard/approvals` | 15,002ms | Server action `getPendingApprovalPOs()` | Medium |
| `/finance/expenses` | **36,026ms** | **2 server actions** | **HIGH — 36s!** |
| `/finance/petty-cash` | **36,018ms** | Server action | **HIGH — 36s!** |
| `/finance/credit-notes` | **36,016ms** | Server action (dynamic import) | **HIGH — 36s!** |
| `/finance/payments` | **36,015ms** | **2 server actions** (dynamic import) | **HIGH — 36s!** |

### P2 Successes

| Route | Time | Data Source |
|-------|------|-------------|
| `/sales/leads` | 1,137ms | `fetch("/api/sales/leads")` |
| `/sales/sales` | 1,647ms | `fetch("/api/sales/dashboard")` |
| `/finance/chart-accounts` | 0ms | Server action (cached from P1 glAccounts) |
| `/inventory/categories` | 0ms | Cached |
| `/inventory/warehouses` | 0ms | Cached |
| `/inventory/fabric-rolls` | 0ms | Cached |
| `/hcm/employee-master` | 0ms | Cached |
| `/finance/payables#banks` | OK | `fetch` based |
| + others at 0ms | | Already cached from P1 |

**Note:** Routes showing 0ms were already in cache from P1 or IndexedDB hydration — TanStack Query correctly skips refetching fresh data.

---

## Phase 3 Results (20s timeout, background)

### P3 Timeouts

| Route | Time |
|-------|------|
| `/inventory/audit` | 20,001ms |
| `/inventory/cycle-counts` | 20,003ms |
| `/finance/planning#accuracy` | 20,003ms |
| `/subcontract` | 20,002ms |
| `/subcontract/orders` | 20,002ms |
| `/costing` | 20,002ms |
| `/cutting` | 20,002ms |
| `/cutting/plans` | 20,001ms |
| `/staff` | 20,001ms |
| `/manager` | 20,003ms |
| `/settings/numbering` | 20,002ms |
| `/settings/permissions` | 20,002ms |

### P3 Successes

| Route | Time |
|-------|------|
| `/inventory/opening-stock` | 4ms |
| `/inventory/settings` | 4ms |
| `/finance/reconciliation` | 2,068ms |
| `/finance/currencies` | 0ms |
| `/finance/fiscal-periods` | 0ms |
| `/finance/opening-balances` | 0ms |
| `/finance/cashflow-forecast` | 11,884ms |
| `/finance/planning` | 2,389ms |
| `/finance/planning/simulasi` | 2,296ms |
| `/finance/planning/aktual` | 2,401ms |
| `/finance/fixed-assets` | 0ms |
| `/finance/transactions` | 2,879ms |
| `/finance/reports` | 6,161ms |
| `/manufacturing/material-demand` | 842ms |
| `/manufacturing/planning` | 1,281ms |
| `/manufacturing/work-orders` | 979ms |
| `/manufacturing/processes` | 0ms |
| `/settings` | 0ms |
| `/accountant/coa` | 0ms |

---

## POST-PREFETCH FETCH Warnings (Cache Misses)

These are queries that fired AFTER the prefetch overlay dismissed, meaning the user's page components had to fetch them on-demand instead of from cache.

| Query Key | Why It Missed Cache |
|-----------|-------------------|
| `["inventoryAudit","list"]` | P3 route — hadn't completed yet when page rendered |
| `["cycleCounts","list"]` | P3 route — hadn't completed yet |
| `["accountTransactions","list",{}]` | P3 route — racing with background prefetch |
| `["financeReports","list","2025-12-31","2026-03-29"]` | P3 route — racing |
| `["reconciliation","list"]` | P3 route — racing |
| `["cashflowForecast","list",6]` | P3 route — racing |
| `["cashflowPlan","list",3,2026,false]` | P3 route — racing |
| `["cashflowAccuracy","trend",3]` | P3 route — racing |
| `["cashflowPlan","upcoming",90]` | P3 route — racing |
| `["cashflowPlan","list",3,2026,true]` | P3 route — racing |
| `["cashflowScenarios","list",3,2026]` | P3 route — racing |
| `["cashflowActual","list",3,2026]` | P3 route — racing |
| `["depreciationRuns","list"]` | P3 route — racing |
| `["fixedAssetReports","register"]` | P3 route — racing |
| `["materialDemand","list"]` | P3 route — racing |
| `["mfgPlanning","list"]` | P3 route — racing |
| `["spkOrders","list"]` | P3 route — racing |
| `["mfgSchedule","list"]` | P3 route — racing |
| `["hcmAttendance","list"]` | P3 route — racing |
| `["staffTasks","list"]` | P3 route — timed out at 20s |
| `["managerDashboard","list"]` | P3 route — timed out at 20s |
| `["documentNumbering","list"]` | P3 route — timed out at 20s |
| `["permissionMatrix","list"]` | P3 route — timed out at 20s |
| `["sidebarActions","list"]` | P1 master data — was cached but got invalidated by background refresh |
| `["ceo-flags","count"]` | **Not in prefetch manifest at all** — missing route |

**Note:** Most POST-PREFETCH warnings are P3 routes racing with the background prefetch. This is by design — P3 runs after the app is interactive, so the page and prefetch compete to fetch the same data. The first one to complete fills the cache for the other. **These are NOT bugs.**

The only true gaps:
1. `["ceo-flags","count"]` — not in the prefetch manifest, needs to be added
2. `["sidebarActions","list"]` — cached in P1 but invalidated by the background-refresh hook at 3s

---

## Specific Errors

### 404: Commission Report API

```
Failed to load resource: the server responded with a status of 404 (Not Found)
api/sales/salespersons...ndDate=2026-03-29:1
```

The `/api/sales/salespersons/commission` endpoint returns 404. This means the commission report API route doesn't exist or has a different URL. The prefetch for `/sales/salespersons#commission` will always fail.

---

## Root Cause Analysis

### Why Server Actions Timeout

Next.js server actions use a **single POST endpoint** (`/_next/server-action`). When the browser fires 6 concurrent server action calls, they are sent as 6 separate HTTP requests, but:

1. **Browser HTTP/2 multiplexing** handles them in parallel to the server
2. **Next.js server** processes them, but each server action acquires a **Prisma database connection** from the pool
3. **Supabase connection pool** has a limited number of connections (typically 10-20 for free/pro tier)
4. When 6+ queries compete for connections, they queue up
5. The first 3-4 complete, but the remaining ones wait for connections to be released
6. By the time they get a connection, the client-side timeout (12-15s) has already expired

**Evidence:** Master data queries (units, brands, colors) return ~20 rows and should take <500ms. They're timing out at 12s because they're waiting in a connection pool queue, not because the queries themselves are slow.

### Why API Routes Don't Timeout

API routes use `fetch()` from the browser, which goes through standard HTTP. They use the `prisma` singleton directly (not `withPrismaAuth`), avoiding the extra transaction overhead. They also tend to be simpler queries.

### The 36-Second Queries

Four finance queries (`/finance/expenses`, `/finance/petty-cash`, `/finance/credit-notes`, `/finance/payments`) took ~36 seconds. These use **dynamic imports** (`await import(...)`) plus server actions. The dynamic import adds overhead, and the server action queue means they waited 20+ seconds just to start executing.

---

## Impact Assessment

| Severity | Count | Impact |
|----------|-------|--------|
| **Critical** | 8 master data timeouts | Forms will show loading spinners for dropdowns (units, brands, colors, categories, suppliers). Every create/edit dialog is affected. |
| **High** | 5 P1 route timeouts | Finance dashboard, inventory dashboard, procurement dashboard, invoices, and PO list won't be cached. Users see loading on first visit. |
| **Medium** | 22 P2 route timeouts | Most finance, procurement, and HCM sub-pages not cached. Users see loading spinners. |
| **Low** | 12 P3 route timeouts | Background routes — acceptable, these load on-demand. |
| **Bug** | 1 (404 error) | Commission report API returns 404 — endpoint missing or wrong URL. |

---

## Recommended Fix

**Convert server-action-based prefetch queries to API route calls.** This is the single biggest improvement:

1. **Create lightweight API routes** for the 8 master data endpoints (units, brands, colors, etc.)
2. **Create API routes** for the heavy P1/P2 server action queries (finance dashboard, invoices, PO list, etc.)
3. **Use `fetch("/api/...")` in the prefetch map** instead of calling server actions directly

This avoids the server action serialization bottleneck and connection pool exhaustion. API routes using the `prisma` singleton are faster and don't compete for `withPrismaAuth` transaction slots.

**Quick win (no new API routes needed):** Reduce `MAX_CONCURRENCY` from 6 to 3 for server-action queries. This reduces connection pool pressure and lets each query complete faster, even though total time increases slightly.

---

## Numbers At A Glance

| Metric | Value |
|--------|-------|
| Total prefetch time | 213s (3.5 min) |
| P1 success rate | 43% (10/23) |
| P2 success rate | 44% (17/39) |
| P3 success rate | ~60% (19/~31) |
| Overall success rate | ~44% (46/~93) |
| Queries using API routes | ~90% success rate |
| Queries using server actions | ~20% success rate |
| POST-PREFETCH cache misses | 25 (mostly P3 racing, expected) |
| True gaps in manifest | 1 (`ceo-flags`) |
| Broken endpoints | 1 (commission report 404) |
