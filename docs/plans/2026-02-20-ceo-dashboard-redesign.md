# CEO Dashboard Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the CEO dashboard so all KPIs show real data from the database, add missing widgets (PR/PO totals, payroll, tax, warehouses, staff), and remove unused sections.

**Architecture:** Fix data pipeline bugs (wrong Supabase client, withPrismaAuth misuse), add missing fetchers (HR, tax, PR value), redesign layout to 6 focused rows. All data flows through `/api/dashboard` → TanStack Query hook → components.

**Tech Stack:** Next.js App Router, Prisma, TanStack Query, shadcn/ui, Tailwind CSS, Recharts

---

### Task 1: Fix `getFinancialMetrics()` — Replace Supabase with Prisma

**Files:**
- Modify: `lib/actions/finance.ts` (lines 1-6 imports, lines 41-end of `getFinancialMetrics`)

**Why:** Currently imports `supabase` from `lib/supabase.ts` (non-SSR singleton). Supabase RLS blocks all queries from this client → all financial data returns 0.

**Step 1: Rewrite `getFinancialMetrics()` to use Prisma**

Replace the Supabase queries with equivalent Prisma queries using `basePrisma` from `@/lib/db`. The function queries:
- Receivables: `Invoice` where type=INV_OUT, status in [ISSUED, PARTIAL, OVERDUE], sum balanceDue
- Overdue invoices: `Invoice` where type=INV_OUT, dueDate < now, status in [ISSUED, PARTIAL, OVERDUE]
- Payables: `Invoice` where type=INV_IN, status in [ISSUED, PARTIAL, OVERDUE], sum balanceDue
- Upcoming payables: `Invoice` where type=INV_IN, dueDate in next 30 days
- Cash balance: `GLAccount` where type=ASSET, code starts with '1', sum balance
- Burn rate: `JournalLine` for EXPENSE accounts last 30 days, or fallback to INV_IN invoices
- Revenue: `Invoice` where type=INV_OUT, this month, not cancelled/void, sum totalAmount
- Expense: from EXPENSE journal lines this month

Replace import from `import { supabase } from "@/lib/supabase"` to `import { prisma as basePrisma } from "@/lib/db"` and rewrite all queries.

**Step 2: Run type check**

```bash
npx tsc --noEmit
```
Expected: No new errors

**Step 3: Commit**

```bash
git add lib/actions/finance.ts
git commit -m "fix: replace Supabase client with Prisma in getFinancialMetrics"
```

---

### Task 2: Fix `getSalesStats()` — Replace `withPrismaAuth` with direct Prisma

**Files:**
- Modify: `lib/actions/sales.ts` (lines 15-72, the `getSalesStats` function)

**Why:** `withPrismaAuth` wraps in a transaction, fails silently in API route context → returns fallback zeros.

**Step 1: Rewrite to use `requireAuth()` + direct Prisma**

```typescript
export async function getSalesStats(): Promise<SalesStats> {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) throw new Error("Unauthorized")

        const startOfMonth = new Date()
        startOfMonth.setDate(1)
        startOfMonth.setHours(0, 0, 0, 0)

        const [revenueAgg, activeOrdersCount, totalOrdersCount, recentOrders] = await Promise.all([
            basePrisma.invoice.aggregate({
                _sum: { totalAmount: true },
                where: {
                    type: 'INV_OUT',
                    issueDate: { gte: startOfMonth },
                    status: { notIn: ['CANCELLED', 'VOID'] }
                }
            }),
            basePrisma.salesOrder.count({
                where: { status: { in: ['CONFIRMED', 'IN_PROGRESS', 'DELIVERED'] } }
            }),
            basePrisma.salesOrder.count({
                where: { orderDate: { gte: startOfMonth } }
            }),
            basePrisma.salesOrder.findMany({
                take: 5,
                orderBy: { orderDate: 'desc' },
                include: { customer: { select: { name: true } } }
            }),
        ])

        return {
            totalRevenue: revenueAgg._sum.totalAmount?.toNumber() || 0,
            totalOrders: totalOrdersCount,
            activeOrders: activeOrdersCount,
            recentOrders: recentOrders.map(o => ({
                id: o.id,
                customer: o.customer.name,
                amount: o.total.toNumber(),
                status: o.status,
                date: o.orderDate
            }))
        }
    } catch (error) {
        console.error("Failed to fetch sales stats", error)
        return { totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] }
    }
}
```

Add required imports: `import { createClient } from "@/lib/supabase/server"` and `import { prisma as basePrisma } from "@/lib/db"`.

**Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add lib/actions/sales.ts
git commit -m "fix: replace withPrismaAuth with direct Prisma in getSalesStats"
```

---

### Task 3: Add missing fetchers — HR metrics, Tax metrics, PR value

**Files:**
- Modify: `app/actions/dashboard.ts` — add `fetchTaxMetrics()`, add `totalPRValue` to `fetchProcurementMetrics()`, connect `fetchHRMetrics()` to `getDashboardOperations()`
- Modify: `app/api/dashboard/route.ts` — pass `hr` and `tax` in response

**Step 1: Add `fetchTaxMetrics()` to `app/actions/dashboard.ts`**

```typescript
async function fetchTaxMetrics(prisma: PrismaClient) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [ppnOutAgg, ppnInAgg] = await Promise.all([
        prisma.invoice.aggregate({
            _sum: { taxAmount: true },
            where: { type: 'INV_OUT', issueDate: { gte: startOfMonth }, status: { notIn: ['CANCELLED', 'VOID'] } }
        }),
        prisma.invoice.aggregate({
            _sum: { taxAmount: true },
            where: { type: 'INV_IN', issueDate: { gte: startOfMonth }, status: { notIn: ['CANCELLED', 'VOID'] } }
        }),
    ])

    return {
        ppnOut: ppnOutAgg._sum?.taxAmount?.toNumber() || 0,
        ppnIn: ppnInAgg._sum?.taxAmount?.toNumber() || 0,
        ppnNet: (ppnOutAgg._sum?.taxAmount?.toNumber() || 0) - (ppnInAgg._sum?.taxAmount?.toNumber() || 0),
    }
}
```

**Step 2: Add `totalPRValue` to `fetchProcurementMetrics()`**

Add to the existing `Promise.all` in `fetchProcurementMetrics()`:

```typescript
// PR estimated value (quantity × product costPrice)
prisma.purchaseRequestItem.findMany({
    where: { purchaseRequest: { status: { notIn: ['CANCELLED'] } } },
    select: { quantity: true, product: { select: { costPrice: true } } }
})
```

Then calculate: `const totalPRValue = prItems.reduce((sum, item) => sum + item.quantity * Number(item.product.costPrice), 0)`

Add `totalPRValue` to the return object.

**Step 3: Connect HR + Tax to `getDashboardOperations()`**

In `getDashboardOperations()`, add to the Promise.all:
```typescript
fetchHRMetrics(prisma).catch(() => ({ totalSalary: 0, lateEmployees: [] })),
fetchTaxMetrics(prisma).catch(() => ({ ppnOut: 0, ppnIn: 0, ppnNet: 0 })),
```

Add `hr` and `tax` to the return object.

**Step 4: Update API route**

In `app/api/dashboard/route.ts`, the `getDashboardOperations()` response now includes `hr` and `tax`. Pass them through in the JSON response as top-level keys:

```typescript
const operations = await withTimeout(getDashboardOperations()..., 8000, ...)

return NextResponse.json({
    financials,
    operations: operations.operations ?? operations, // backwards compat
    activity,
    charts,
    sales,
    hr: operations.hr ?? { totalSalary: 0, lateEmployees: [] },
    tax: operations.tax ?? { ppnOut: 0, ppnIn: 0, ppnNet: 0 },
})
```

Update FALLBACK constants to include `hr` and `tax`.

**Step 5: Verify**

```bash
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add app/actions/dashboard.ts app/api/dashboard/route.ts
git commit -m "feat: add tax metrics, PR value, and HR data to dashboard API"
```

---

### Task 4: Update TanStack Query hook

**Files:**
- Modify: `hooks/use-executive-dashboard.ts`

**Step 1: Update hook to include new fields**

The hook fetches from `/api/dashboard`. Update the return type/destructuring to include `hr` and `tax` fields from the response.

**Step 2: Commit**

```bash
git add hooks/use-executive-dashboard.ts
git commit -m "feat: add hr and tax to executive dashboard hook"
```

---

### Task 5: Create new components — KPI Summary Cards

**Files:**
- Create: `components/dashboard/kpi-summary-cards.tsx`

**Step 1: Build the component**

4 cards in a row showing: Total PR (Rp), Total PO (Rp), Gaji Bulan Ini (Rp), PPN Bulan Ini (Rp).

Props:
```typescript
interface KpiSummaryCardsProps {
    totalPRValue: number
    totalPOValue: number
    totalSalary: number
    ppnNet: number
    totalPRs: number
    totalPOs: number
}
```

Use neo-brutalist style: `border-2 border-black`, `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`.
Grid: `grid-cols-2 md:grid-cols-4`.
Each card shows: label (small uppercase), value (large Rp formatted), count subtitle.
Link each card to its module page.

**Step 2: Commit**

```bash
git add components/dashboard/kpi-summary-cards.tsx
git commit -m "feat: add KPI summary cards component for dashboard"
```

---

### Task 6: Create new components — Warehouse Overview

**Files:**
- Create: `components/dashboard/warehouse-overview.tsx`

**Step 1: Build the component**

Grid of warehouse cards. Each card shows warehouse name, code, item count, product count, total value (Rp).

Props:
```typescript
interface WarehouseOverviewProps {
    warehouses: Array<{
        name: string
        code: string
        value: number
        itemCount: number
        productCount: number
    }>
}
```

Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4`.
Neo-brutalist card style. Each card links to `/inventory/warehouses`.
Show "Tidak ada gudang" empty state if array is empty.

**Step 2: Commit**

```bash
git add components/dashboard/warehouse-overview.tsx
git commit -m "feat: add warehouse overview cards for dashboard"
```

---

### Task 7: Create new components — Staff Today

**Files:**
- Create: `components/dashboard/staff-today.tsx`

**Step 1: Build the component**

Table showing employees and their attendance status today.

Props:
```typescript
interface StaffTodayProps {
    totalStaff: number
    presentCount: number
    lateCount: number
    attendanceRate: number
    topEmployees: Array<{
        id: string
        name: string
        position: string
        department: string
        attendance: string  // "Present" | "Late" | "Absent" | "On Leave"
        currentTask: string
        checkIn: string
    }>
}
```

Header: "Tim Hari Ini" with attendance rate badge.
Stats row: Total Staf, Hadir, Terlambat, Absen.
Table: Name, Posisi, Status (color-coded badge), Check-in time, Tugas saat ini.
Neo-brutalist style.

**Step 2: Commit**

```bash
git add components/dashboard/staff-today.tsx
git commit -m "feat: add staff attendance component for dashboard"
```

---

### Task 8: Rewrite dashboard layout and page

**Files:**
- Modify: `components/dashboard/dashboard-view.tsx` — new layout with 6 rows
- Modify: `app/dashboard/page.tsx` — wire up new components + remove old ones

**Step 1: Rewrite `dashboard-view.tsx`**

New props:
```typescript
interface DashboardViewProps {
    pulseBarSlot: ReactNode
    kpiCardsSlot: ReactNode
    actionCenterSlot: ReactNode
    financialHealthSlot: ReactNode
    warehouseSlot: ReactNode
    staffSlot: ReactNode
    activityFeedSlot: ReactNode
}
```

Layout: 6 rows stacked vertically with `gap-4`. Each row is a `motion.div` with fade-in.
- Row 1: Pulse Bar (full width)
- Row 2: KPI Cards (full width)
- Row 3: Action Center (5/12) + Financial Health (7/12) — same as current
- Row 4: Warehouses (full width)
- Row 5: Staff Today (full width)
- Row 6: Activity Feed (full width)

**Step 2: Rewrite `app/dashboard/page.tsx`**

Import new components: `KpiSummaryCards`, `WarehouseOverview`, `StaffToday`.
Remove imports: `AiSearchCard`, `OEEGauge`, `ShiftHandoverWidget`, `MachineDowntimeWidget`, `OperationsStrip`, `TrendingWidget`.

Wire up data from `useExecutiveDashboard()`:
```typescript
const { financials, operations, activity, charts, sales, hr, tax } = data

// KPI cards
<KpiSummaryCards
    totalPRValue={operations?.procurement?.totalPRValue ?? 0}
    totalPOValue={operations?.procurement?.totalPOValue ?? 0}
    totalSalary={hr?.totalSalary ?? 0}
    ppnNet={tax?.ppnNet ?? 0}
    totalPRs={operations?.procurement?.totalPRs ?? 0}
    totalPOs={operations?.procurement?.totalPOs ?? 0}
/>

// Warehouse overview
<WarehouseOverview warehouses={operations?.inventoryValue?.warehouses ?? []} />

// Staff today
<StaffToday
    totalStaff={operations?.workforceStatus?.totalStaff ?? 0}
    presentCount={operations?.workforceStatus?.presentCount ?? 0}
    lateCount={operations?.workforceStatus?.lateCount ?? 0}
    attendanceRate={operations?.workforceStatus?.attendanceRate ?? 0}
    topEmployees={operations?.workforceStatus?.topEmployees ?? []}
/>
```

**Step 3: Verify build**

```bash
npx tsc --noEmit
```

**Step 4: Commit**

```bash
git add components/dashboard/dashboard-view.tsx app/dashboard/page.tsx
git commit -m "feat: redesign CEO dashboard layout with real data"
```

---

### Task 9: Clean up removed API calls

**Files:**
- Modify: `app/api/dashboard/route.ts` — remove OEE, shift notes, downtime log fetches (no longer needed by dashboard)

**Step 1: Remove unused fetchers from API route**

Remove imports and calls for: `getOEEMetrics`, `getRecentShiftNotes`, `getRecentDowntimeLogs`.
Remove their fallback constants.
Keep the data in `app/actions/dashboard.ts` and `lib/actions/dashboard-textile.ts` — they may be used by /manufacturing.

**Step 2: Commit**

```bash
git add app/api/dashboard/route.ts
git commit -m "refactor: remove textile/OEE fetchers from dashboard API route"
```

---

### Task 10: Verify and test

**Step 1: Run type check**

```bash
npx tsc --noEmit
```

**Step 2: Run tests**

```bash
npx vitest run
```

**Step 3: Manual verification**

Start dev server: `npm run dev`
Navigate to `http://localhost:3002/dashboard`

Verify:
- Pulse Bar shows real KAS, Revenue, Margin, Inventori, Burn Rate values
- KPI cards show Total PR (Rp), Total PO (Rp), Gaji, PPN with real numbers
- Action Center shows PO approvals and PR/PO counts
- Financial Health shows cash flow chart and invoice list
- Warehouse cards show each warehouse with item count and value
- Staff Today shows employee list with attendance status
- Activity Feed shows recent activity

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: CEO dashboard redesign — real data, new KPI/warehouse/staff widgets"
```
