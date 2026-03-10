# CEO Dashboard "Pusat Komando" Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current dead-end CEO dashboard with a command-center layout: greeting bar + 6 module strips (Keuangan, Penjualan, Pengadaan, Inventori, Manufaktur, SDM) + tasks/activity bottom section. Kill all "Belum ada data" — show real numbers even when 0.

**Architecture:** Reuse existing `/api/dashboard` endpoint and `useExecutiveDashboard()` hook. Add 2 new lightweight queries to existing `getDashboardOperations()`. Create 3 new reusable components (greeting-bar, module-strip, metric-card). Replace 6 old dashboard components in `page.tsx` + `dashboard-view.tsx`. Keep TodaysTasks and CompactActivityFeed as-is.

**Tech Stack:** React 19, TanStack Query (existing hook), Tailwind CSS, Framer Motion, Tabler Icons

---

## Task 1: Add New Queries to Dashboard API

**Files:**
- Modify: `app/actions/dashboard.ts` (add 2 new fetch functions)
- Modify: `app/api/dashboard/route.ts` (add new data to response)

**Context:** We need 2 new pieces of data not currently fetched:
1. Inventory summary: active product count + active warehouse count
2. Sales fulfillment rate: percentage of orders this month that are DELIVERED or COMPLETED

**Step 1: Add `fetchInventorySummary` to dashboard server actions**

Add after `fetchTotalInventoryValue` (around line 768) in `app/actions/dashboard.ts`:

```typescript
async function fetchInventorySummary(prisma: PrismaClient) {
    const [productCount, warehouseCount] = await Promise.all([
        prisma.product.count({ where: { isActive: true } }),
        prisma.warehouse.count({ where: { isActive: true } }),
    ])
    return { productCount, warehouseCount }
}
```

**Step 2: Add `fetchSalesFulfillment` to dashboard server actions**

Add right after `fetchInventorySummary`:

```typescript
async function fetchSalesFulfillment(prisma: PrismaClient) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [totalOrders, deliveredOrders] = await Promise.all([
        prisma.salesOrder.count({
            where: { orderDate: { gte: startOfMonth }, status: { not: 'CANCELLED' } }
        }),
        prisma.salesOrder.count({
            where: {
                orderDate: { gte: startOfMonth },
                status: { in: ['DELIVERED', 'COMPLETED', 'INVOICED'] }
            }
        }),
    ])

    return {
        totalOrders,
        deliveredOrders,
        fulfillmentRate: totalOrders > 0 ? Math.round((deliveredOrders / totalOrders) * 100) : 0
    }
}
```

**Step 3: Wire new queries into `getDashboardOperations()`**

In `getDashboardOperations()` (line ~935), add the 2 new fetchers to the existing `Promise.all()`:

```typescript
// Add to the Promise.all array:
fetchInventorySummary(prisma).catch(() => ({ productCount: 0, warehouseCount: 0 })),
fetchSalesFulfillment(prisma).catch(() => ({ totalOrders: 0, deliveredOrders: 0, fulfillmentRate: 0 })),
```

Destructure them:
```typescript
const [...existing, inventorySummary, salesFulfillment] = await Promise.all([...])
```

Add to return object:
```typescript
return { ...existing, inventorySummary, salesFulfillment }
```

Also update the error fallback to include:
```typescript
inventorySummary: { productCount: 0, warehouseCount: 0 },
salesFulfillment: { totalOrders: 0, deliveredOrders: 0, fulfillmentRate: 0 },
```

**Step 4: Update API route fallback**

In `app/api/dashboard/route.ts`, add to `FALLBACK_OPERATIONS`:

```typescript
inventorySummary: { productCount: 0, warehouseCount: 0 },
salesFulfillment: { totalOrders: 0, deliveredOrders: 0, fulfillmentRate: 0 },
```

**Step 5: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep -E "dashboard|route" | head -10`
Expected: No NEW errors (pre-existing errors are fine)

**Step 6: Commit**

```bash
git add app/actions/dashboard.ts app/api/dashboard/route.ts
git commit -m "feat(dashboard): add inventory summary and sales fulfillment queries"
```

---

## Task 2: Create Reusable MetricCard Component

**Files:**
- Create: `components/dashboard/metric-card.tsx`

**Context:** Each module strip shows 4 metric cards. This is a reusable card component that shows: a label, a value (formatted), an optional badge count, and an optional link.

**Step 1: Create the component**

Create `components/dashboard/metric-card.tsx`:

```tsx
"use client"

import Link from "next/link"
import { formatCurrency } from "@/lib/utils"

interface MetricCardProps {
    label: string
    value: number
    format?: "currency" | "number" | "percent"
    suffix?: string
    href?: string
    badge?: number
    badgeColor?: string
    muted?: boolean
}

export function MetricCard({
    label,
    value,
    format = "number",
    suffix,
    href,
    badge,
    badgeColor = "bg-red-500",
    muted = false,
}: MetricCardProps) {
    const displayValue = format === "currency"
        ? formatCurrency(value)
        : format === "percent"
            ? `${value}%`
            : value.toLocaleString("id-ID")

    const isZero = value === 0
    const valueClass = isZero && muted
        ? "text-zinc-300 dark:text-zinc-600"
        : "text-zinc-900 dark:text-zinc-100"

    const content = (
        <div className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 truncate">
                {label}
            </span>
            <div className="flex items-baseline gap-1.5">
                <span className={`text-lg font-black tracking-tight leading-none ${valueClass}`}>
                    {displayValue}
                </span>
                {suffix && (
                    <span className="text-[10px] font-medium text-zinc-400">{suffix}</span>
                )}
                {badge !== undefined && badge > 0 && (
                    <span className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full ${badgeColor} px-1 text-[9px] font-black text-white tabular-nums`}>
                        {badge > 99 ? "99+" : badge}
                    </span>
                )}
            </div>
        </div>
    )

    if (href) {
        return (
            <Link href={href} className="block p-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors rounded">
                {content}
            </Link>
        )
    }

    return <div className="p-3">{content}</div>
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "metric-card" | head -5`
Expected: No errors

**Step 3: Commit**

```bash
git add components/dashboard/metric-card.tsx
git commit -m "feat(dashboard): create reusable MetricCard component"
```

---

## Task 3: Create ModuleStrip Component

**Files:**
- Create: `components/dashboard/module-strip.tsx`

**Context:** Reusable horizontal strip for each module. Shows: colored accent bar, icon + title (clickable → module page), 4 metric cards in a responsive grid, and a "Lihat Semua →" link.

**Step 1: Create the component**

Create `components/dashboard/module-strip.tsx`:

```tsx
"use client"

import { ReactNode } from "react"
import Link from "next/link"
import { IconArrowRight } from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"

interface ModuleStripProps {
    title: string
    icon: Icon
    href: string
    accentColor: string
    children: ReactNode
}

export function ModuleStrip({ title, icon: IconComponent, href, accentColor, children }: ModuleStripProps) {
    return (
        <div className="border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            {/* Accent bar */}
            <div className={`h-1 ${accentColor}`} />

            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <IconComponent className="w-4 h-4 text-zinc-500" />
                <Link href={href} className="text-[11px] font-black uppercase tracking-widest text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
                    {title}
                </Link>
                <Link
                    href={href}
                    className="ml-auto flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
                >
                    Lihat Semua <IconArrowRight className="w-3 h-3" />
                </Link>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-100 dark:divide-zinc-800">
                {children}
            </div>
        </div>
    )
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "module-strip" | head -5`
Expected: No errors

**Step 3: Commit**

```bash
git add components/dashboard/module-strip.tsx
git commit -m "feat(dashboard): create reusable ModuleStrip component"
```

---

## Task 4: Create GreetingBar Component

**Files:**
- Create: `components/dashboard/greeting-bar.tsx`

**Context:** Top bar showing personalized greeting with time-of-day, date, and 3 global highlight KPIs (pending approvals, revenue, AR).

**Step 1: Create the component**

Create `components/dashboard/greeting-bar.tsx`:

```tsx
"use client"

import { useAuth } from "@/lib/auth-context"
import { formatCurrency } from "@/lib/utils"
import { IconAlertCircle, IconCash, IconReceipt } from "@tabler/icons-react"

interface GreetingBarProps {
    pendingApprovals: number
    revenueMTD: number
    receivables: number
}

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 11) return "Selamat pagi"
    if (hour < 15) return "Selamat siang"
    if (hour < 18) return "Selamat sore"
    return "Selamat malam"
}

function formatDate(): string {
    return new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    })
}

export function GreetingBar({ pendingApprovals, revenueMTD, receivables }: GreetingBarProps) {
    const { user } = useAuth()
    const name = user?.name?.split(" ")[0] || "Boss"

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
            {/* Left: Greeting */}
            <div>
                <h1 className="text-lg font-black text-zinc-900 dark:text-zinc-100">
                    {getGreeting()}, {name}
                </h1>
                <p className="text-xs text-zinc-400 font-medium">{formatDate()}</p>
            </div>

            {/* Right: 3 global highlights */}
            <div className="flex items-center gap-4 md:gap-6">
                {pendingApprovals > 0 && (
                    <div className="flex items-center gap-1.5">
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white tabular-nums">
                            {pendingApprovals}
                        </span>
                        <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Perlu Persetujuan</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5">
                    <IconReceipt className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        Revenue {formatCurrency(revenueMTD)}
                    </span>
                </div>
                <div className="flex items-center gap-1.5">
                    <IconCash className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        AR {formatCurrency(receivables)}
                    </span>
                </div>
            </div>
        </div>
    )
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "greeting-bar" | head -5`
Expected: No errors

**Step 3: Commit**

```bash
git add components/dashboard/greeting-bar.tsx
git commit -m "feat(dashboard): create GreetingBar component with time-of-day greeting"
```

---

## Task 5: Rewrite DashboardView Layout

**Files:**
- Modify: `components/dashboard/dashboard-view.tsx`

**Context:** Replace the current slot-based layout with the new module-strip layout. The new DashboardView accepts raw data and renders: greeting bar → 6 module strips → tasks + activity bottom.

**Step 1: Rewrite the component**

Replace the entire content of `components/dashboard/dashboard-view.tsx`:

```tsx
"use client"

import { ReactNode } from "react"
import { motion } from "framer-motion"

interface DashboardViewProps {
    greetingSlot: ReactNode
    strips: ReactNode
    todaysTasksSlot: ReactNode
    activityFeedSlot: ReactNode
}

const fadeIn = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
}

export function DashboardView({
    greetingSlot,
    strips,
    todaysTasksSlot,
    activityFeedSlot,
}: DashboardViewProps) {
    return (
        <div className="mf-page">
            {/* Greeting Bar */}
            <motion.div
                className="flex-none"
                {...fadeIn}
                transition={{ duration: 0.3 }}
            >
                {greetingSlot}
            </motion.div>

            {/* Module Strips */}
            <motion.div
                className="flex flex-col gap-4"
                {...fadeIn}
                transition={{ duration: 0.3, delay: 0.05 }}
            >
                {strips}
            </motion.div>

            {/* Bottom: Tasks + Activity */}
            <motion.div
                className="grid grid-cols-1 md:grid-cols-12 gap-4"
                {...fadeIn}
                transition={{ duration: 0.3, delay: 0.1 }}
            >
                <div className="md:col-span-7">
                    {todaysTasksSlot}
                </div>
                <div className="md:col-span-5">
                    {activityFeedSlot}
                </div>
            </motion.div>
        </div>
    )
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "dashboard-view\|dashboard/page" | head -10`
Expected: Errors in `page.tsx` (expected — old props no longer match). We fix this in Task 6.

**Step 3: Commit**

```bash
git add components/dashboard/dashboard-view.tsx
git commit -m "refactor(dashboard): rewrite DashboardView with module-strip layout"
```

---

## Task 6: Rewrite Dashboard Page

**Files:**
- Modify: `app/dashboard/page.tsx`

**Context:** This is the main orchestrator. Replace the old component imports and slot assignments with the new GreetingBar + ModuleStrip + MetricCard components. Wire up all data from `useExecutiveDashboard()`.

**Step 1: Rewrite the page**

Replace the entire content of `app/dashboard/page.tsx`:

```tsx
"use client"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import { GreetingBar } from "@/components/dashboard/greeting-bar"
import { ModuleStrip } from "@/components/dashboard/module-strip"
import { MetricCard } from "@/components/dashboard/metric-card"
import { TodaysTasks } from "@/components/dashboard/todays-tasks"
import { CompactActivityFeed } from "@/components/dashboard/compact-activity-feed"
import { useExecutiveDashboard } from "@/hooks/use-executive-dashboard"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"
import {
    IconCash,
    IconShoppingCart,
    IconTruck,
    IconPackage,
    IconTool,
    IconUsers,
} from "@tabler/icons-react"

export default function DashboardPage() {
    const { data, isLoading } = useExecutiveDashboard()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-zinc-700" />
    }

    const { financials, operations, sales, hr } = data

    // Activity feed mapping
    const activities = (data.activity?.activityFeed ?? []).map((a: any, i: number) => ({
        id: a.id ?? `activity-${i}`,
        type: a.type ?? "general",
        title: a.title ?? "",
        description: a.description ?? "",
        timestamp: a.timestamp ?? new Date().toISOString(),
    }))

    // Derive counts
    const pendingApprovals = (operations?.procurement?.pendingApproval?.length ?? 0) + (operations?.procurement?.pendingPRs ?? 0)
    const lowStockCount = operations?.materialStatus?.length ?? 0
    const overdueCount = financials?.overdueInvoices?.length ?? 0
    const machineRunning = operations?.prodMetrics ? (operations.prodMetrics as any).activeWorkOrders ?? 0 : 0

    return (
        <DashboardView
            greetingSlot={
                <GreetingBar
                    pendingApprovals={pendingApprovals}
                    revenueMTD={sales?.totalRevenue ?? 0}
                    receivables={financials?.receivables ?? 0}
                />
            }
            strips={
                <>
                    {/* KEUANGAN */}
                    <ModuleStrip
                        title="Keuangan"
                        icon={IconCash}
                        href="/finance"
                        accentColor="bg-emerald-500"
                    >
                        <MetricCard
                            label="Revenue MTD"
                            value={sales?.totalRevenue ?? 0}
                            format="currency"
                            muted
                        />
                        <MetricCard
                            label="Piutang (AR)"
                            value={financials?.receivables ?? 0}
                            format="currency"
                            muted
                        />
                        <MetricCard
                            label="Hutang (AP)"
                            value={financials?.payables ?? 0}
                            format="currency"
                            muted
                        />
                        <MetricCard
                            label="Invoice Overdue"
                            value={overdueCount}
                            href="/finance/invoices"
                            badge={overdueCount > 0 ? overdueCount : undefined}
                            badgeColor="bg-red-500"
                            muted
                        />
                    </ModuleStrip>

                    {/* PENJUALAN */}
                    <ModuleStrip
                        title="Penjualan"
                        icon={IconShoppingCart}
                        href="/sales/orders"
                        accentColor="bg-cyan-500"
                    >
                        <MetricCard
                            label="Pesanan Aktif"
                            value={sales?.activeOrders ?? 0}
                            muted
                        />
                        <MetricCard
                            label="Revenue Bulan Ini"
                            value={sales?.totalRevenue ?? 0}
                            format="currency"
                            muted
                        />
                        <MetricCard
                            label="Order Bulan Ini"
                            value={sales?.totalOrders ?? 0}
                            muted
                        />
                        <MetricCard
                            label="Fulfillment"
                            value={operations?.salesFulfillment?.fulfillmentRate ?? 0}
                            format="percent"
                            href="/sales/orders"
                            muted
                        />
                    </ModuleStrip>

                    {/* PENGADAAN */}
                    <ModuleStrip
                        title="Pengadaan"
                        icon={IconTruck}
                        href="/procurement"
                        accentColor="bg-amber-500"
                    >
                        <MetricCard
                            label="Total PR"
                            value={operations?.procurement?.totalPRs ?? 0}
                            suffix={`${operations?.procurement?.pendingPRs ?? 0} pending`}
                            muted
                        />
                        <MetricCard
                            label="Total PO"
                            value={operations?.procurement?.totalPOs ?? 0}
                            suffix={`${operations?.procurement?.activeCount ?? 0} aktif`}
                            muted
                        />
                        <MetricCard
                            label="Nilai PO"
                            value={operations?.procurement?.totalPOValue ?? 0}
                            format="currency"
                            muted
                        />
                        <MetricCard
                            label="Perlu Approval"
                            value={operations?.procurement?.pendingApproval?.length ?? 0}
                            href="/procurement/orders"
                            badge={operations?.procurement?.pendingApproval?.length > 0 ? operations.procurement.pendingApproval.length : undefined}
                            badgeColor="bg-orange-500"
                            muted
                        />
                    </ModuleStrip>

                    {/* INVENTORI */}
                    <ModuleStrip
                        title="Inventori"
                        icon={IconPackage}
                        href="/inventory"
                        accentColor="bg-violet-500"
                    >
                        <MetricCard
                            label="Nilai Stok"
                            value={operations?.inventoryValue?.value ?? 0}
                            format="currency"
                            muted
                        />
                        <MetricCard
                            label="Stok Rendah"
                            value={lowStockCount}
                            href="/inventory/alerts"
                            badge={lowStockCount > 0 ? lowStockCount : undefined}
                            badgeColor="bg-red-500"
                            muted
                        />
                        <MetricCard
                            label="Total SKU"
                            value={operations?.inventorySummary?.productCount ?? 0}
                            muted
                        />
                        <MetricCard
                            label="Gudang Aktif"
                            value={operations?.inventorySummary?.warehouseCount ?? 0}
                            href="/inventory/warehouses"
                            muted
                        />
                    </ModuleStrip>

                    {/* MANUFAKTUR */}
                    <ModuleStrip
                        title="Manufaktur"
                        icon={IconTool}
                        href="/manufacturing"
                        accentColor="bg-orange-500"
                    >
                        <MetricCard
                            label="WO Aktif"
                            value={operations?.prodMetrics?.activeWorkOrders ?? 0}
                            href="/manufacturing/orders"
                            muted
                        />
                        <MetricCard
                            label="Efisiensi"
                            value={operations?.prodMetrics?.efficiency ?? 0}
                            format="percent"
                            muted
                        />
                        <MetricCard
                            label="Mesin Berjalan"
                            value={machineRunning}
                            muted
                        />
                        <MetricCard
                            label="Quality Rate"
                            value={operations?.qualityStatus?.passRate === -1 ? 0 : (operations?.qualityStatus?.passRate ?? 0)}
                            format="percent"
                            muted
                        />
                    </ModuleStrip>

                    {/* SDM */}
                    <ModuleStrip
                        title="SDM"
                        icon={IconUsers}
                        href="/hcm"
                        accentColor="bg-blue-500"
                    >
                        <MetricCard
                            label="Total Karyawan"
                            value={operations?.workforceStatus?.totalStaff ?? 0}
                            muted
                        />
                        <MetricCard
                            label="Hadir Hari Ini"
                            value={operations?.workforceStatus?.presentCount ?? 0}
                            muted
                        />
                        <MetricCard
                            label="Terlambat"
                            value={operations?.workforceStatus?.lateCount ?? 0}
                            badge={operations?.workforceStatus?.lateCount > 0 ? operations.workforceStatus.lateCount : undefined}
                            badgeColor="bg-amber-500"
                            href="/hcm/attendance"
                            muted
                        />
                        <MetricCard
                            label="Estimasi Gaji"
                            value={hr?.totalSalary ?? 0}
                            format="currency"
                            muted
                        />
                    </ModuleStrip>
                </>
            }
            todaysTasksSlot={<TodaysTasks />}
            activityFeedSlot={<CompactActivityFeed activities={activities} />}
        />
    )
}
```

**Step 2: Verify compilation**

Run: `npx tsc --noEmit 2>&1 | grep "dashboard" | head -10`
Expected: No NEW errors from dashboard files

**Step 3: Run dev server quick check**

Run: `npm run dev` (check that `/dashboard` loads without crashing)

**Step 4: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat(dashboard): rewrite CEO dashboard with module-strip command center layout"
```

---

## Task 7: Verify and Polish

**Files:**
- Potentially tweak: `components/dashboard/metric-card.tsx`, `components/dashboard/module-strip.tsx`

**Step 1: Run full type check**

Run: `npx tsc --noEmit 2>&1 | grep -v "liloapp\|test-dashboard\|kpi-wrapper\|inventory.test\|hcm\|documents-system\|vendor" | head -20`
Expected: No NEW errors from files we modified

**Step 2: Run tests**

Run: `npx vitest run 2>&1 | tail -20`
Expected: Same baseline pass/fail as before (no regressions)

**Step 3: Visual check**

Open `http://localhost:3002/dashboard` in browser and verify:
- Greeting bar shows name + date + global highlights
- 6 module strips render with correct accent colors
- Metrics show `Rp 0` or `0` instead of "Belum ada data"
- Links work (strip headers → module pages, metric badges → detail pages)
- Today's Tasks + Activity Feed render at bottom
- Responsive: strips stack on mobile, 4-col grid on desktop

**Step 4: Final commit**

```bash
git add -A
git commit -m "polish(dashboard): fix any remaining type/styling issues"
```

---

## Summary of Changes

| File | Action | Purpose |
|------|--------|---------|
| `app/actions/dashboard.ts` | Modify | Add `fetchInventorySummary` + `fetchSalesFulfillment` |
| `app/api/dashboard/route.ts` | Modify | Add new fields to fallback |
| `components/dashboard/metric-card.tsx` | Create | Reusable KPI card with currency/number/percent formatting |
| `components/dashboard/module-strip.tsx` | Create | Horizontal module strip with accent bar + header + metrics grid |
| `components/dashboard/greeting-bar.tsx` | Create | Time-of-day greeting + 3 global KPIs |
| `components/dashboard/dashboard-view.tsx` | Rewrite | New slot layout: greeting → strips → tasks/activity |
| `app/dashboard/page.tsx` | Rewrite | Wire all data into new components |

**Components no longer imported by page.tsx** (can be cleaned up later):
- `company-pulse-bar.tsx`
- `kpi-summary-cards.tsx`
- `ceo-action-center.tsx`
- `financial-health-card.tsx`
- `warehouse-overview.tsx`
- `staff-today.tsx`
