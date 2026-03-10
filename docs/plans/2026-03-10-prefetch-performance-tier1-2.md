# Prefetch Performance — Tier 1+2 Conversion + Quick Wins

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert ~18 read-only server actions from `withPrismaAuth` to `prisma` singleton + `requireAuth()`, deduplicate 5 redundant prefetch routes, remove the 8s-timeout audit route, and bump connection pool to 10.

**Architecture:** Each server action currently wrapped in `withPrismaAuth(async (prisma, user) => { ... })` will be converted to use the `prisma` singleton from `@/lib/db` directly, with `requireAuth()` for auth checks. This eliminates unnecessary transactions for read-only queries and frees connection pool slots during prefetch.

**Tech Stack:** Prisma 6.x, Supabase Auth, TanStack Query

---

### Task 1: Quick Wins — Deduplicate Prefetch Routes + Bump Pool

**Files:**
- Modify: `hooks/use-nav-prefetch.ts` — remove 5 duplicate/problematic routes
- Modify: `lib/db.ts` — bump connection_limit from 5 to 10

**Step 1: Remove duplicate routes from prefetch map**

In `hooks/use-nav-prefetch.ts`, delete these entries entirely:
- `/inventory/stock` (duplicates `/inventory/products` with same query key)
- `/inventory/alerts` (duplicates `/inventory/products` with same query key)
- `/inventory/reports` (duplicates `/inventory/products` with same query key)
- `/finance/payables` (duplicates `/finance/bills` with same query key)
- `/inventory/audit` (has 8s timeout fallbacks that block entire batch)

**Step 2: Bump connection pool**

In `lib/db.ts`, change `connection_limit=5` to `connection_limit=10`.

**Step 3: Commit**

```bash
git add hooks/use-nav-prefetch.ts lib/db.ts
git commit -m "perf: remove 5 duplicate prefetch routes, bump pool to 10"
```

---

### Task 2: Convert Tier 1 — Finance Dashboard Actions

**Files:**
- Modify: `lib/actions/finance.ts` — convert `getFinancialMetrics()` and `getFinanceDashboardData()`

**Pattern:** Replace `withPrismaAuth` wrapper with direct prisma + requireAuth:

Before:
```ts
export async function getFinancialMetrics() {
    return withPrismaAuth(async (prisma, user) => {
        // ... queries ...
    })
}
```

After:
```ts
export async function getFinancialMetrics() {
    await requireAuth()
    // ... queries using prisma singleton from @/lib/db ...
}
```

Where `requireAuth` is:
```ts
import { createClient } from "@/lib/supabase/server"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}
```

Convert both `getFinancialMetrics()` and `getFinanceDashboardData()` using this pattern. Keep all query logic identical — only change the wrapper.

---

### Task 3: Convert Tier 1 — Inventory Category Actions

**Files:**
- Modify: `app/actions/inventory.ts` — convert `getAllCategories()` and `getCategories()`

Same pattern as Task 2: replace `withPrismaAuth` with `prisma` singleton + `requireAuth()`.

---

### Task 4: Convert Tier 2 — Procurement Actions

**Files:**
- Modify: `lib/actions/procurement.ts` — convert `getAllPurchaseOrders()` and `getVendors()`
- Modify: `app/actions/purchase-order.ts` — convert `getProductsForPO()`

Same pattern. These 3 functions are called in parallel by `/procurement/orders` prefetch — converting them frees 3 pool slots per prefetch.

---

### Task 5: Convert Tier 2 — GRN Actions

**Files:**
- Modify: `lib/actions/grn.ts` — convert `getPendingPOsForReceiving()`, `getAllGRNs()`, `getWarehousesForGRN()`, `getEmployeesForGRN()`

These 4 functions are called in parallel by `/procurement/receiving` prefetch — converting them frees 4 pool slots.

---

### Task 6: Convert Tier 2 — Manager/Tasks Actions

**Files:**
- Modify: `lib/actions/tasks.ts` — convert `getManagerTasks()`, `getDepartmentEmployees()`, `getAssignableOrders()`, `getManagerDashboardStats()`

These 4 functions are called in parallel by `/manager` prefetch — converting them frees 4 pool slots.

---

### Task 7: Convert Tier 2 — Manufacturing Schedule Actions

**Files:**
- Modify: `lib/actions/manufacturing-garment.ts` — convert `getSchedulableWorkOrders()`, `getMachinesForScheduling()`, `getRoutingsForScheduling()`

These 3 functions are called in parallel by `/manufacturing/schedule` prefetch — converting them frees 3 pool slots.

---

## Reminder

After completing Tier 1+2, continue with **Tier 3**: convert remaining ~20 single-action server action reads to `prisma` + `requireAuth()`.
