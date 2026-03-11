# CEO Dashboard Expansion: 6 → 10 Cards

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add 4 new ModuleCards to the CEO dashboard: Arus Kas, Profitabilitas, Pelanggan, Dokumen & Kepatuhan.

**Architecture:** Add new Prisma fetchers in `app/actions/dashboard.ts`, pipe data through `/api/dashboard` route, render 4 new cards in `app/dashboard/page.tsx` using existing `ModuleCard` primitives. The `charts` data (dataCash7d, dataProfit) is already fetched but unused in UI — we'll leverage it.

**Tech Stack:** Prisma queries, Next.js API route, React client components, Recharts (sparkline), existing ModuleCard/CardMetric/SectionDivider primitives.

---

## Task 1: Add Backend Fetchers

**Files:**
- Modify: `app/actions/dashboard.ts`

**Step 1: Add `fetchCashFlowSummary` fetcher**

Add after `fetchSalesFulfillment` (around line 822):

```typescript
async function fetchCashFlowSummary(prisma: PrismaClient) {
    const today = startOfDay(new Date())
    const start7d = addDays(today, -6)

    const journalLines = await prisma.journalLine.findMany({
        where: {
            entry: {
                status: 'POSTED',
                date: { gte: start7d, lte: addDays(today, 1) }
            }
        },
        select: {
            debit: true,
            credit: true,
            account: { select: { code: true, type: true, name: true } },
            entry: { select: { date: true, description: true } }
        }
    })

    let kasMasuk = 0
    let kasKeluar = 0
    const topExpenses: Array<{ name: string; amount: number }> = []
    const expenseMap = new Map<string, number>()

    for (const jl of journalLines) {
        // Cash/bank accounts (code starts with '1')
        if (jl.account.code.startsWith('1')) {
            const delta = Number(jl.debit) - Number(jl.credit)
            if (delta > 0) kasMasuk += delta
            else kasKeluar += Math.abs(delta)
        }
        // Track expense categories
        if (jl.account.type === 'EXPENSE') {
            const amount = Number(jl.debit) - Number(jl.credit)
            if (amount > 0) {
                const key = jl.account.name
                expenseMap.set(key, (expenseMap.get(key) || 0) + amount)
            }
        }
    }

    // Top 3 expenses
    const sorted = Array.from(expenseMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3)
    for (const [name, amount] of sorted) {
        topExpenses.push({ name, amount })
    }

    return { kasMasuk, kasKeluar, netCashFlow: kasMasuk - kasKeluar, topExpenses }
}
```

**Step 2: Add `fetchProfitability` fetcher**

```typescript
async function fetchProfitability(prisma: PrismaClient) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const prevMonthStart = new Date(startOfMonth)
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1)

    const [currentLines, prevLines, topProducts] = await Promise.all([
        prisma.journalLine.findMany({
            where: {
                entry: { status: 'POSTED', date: { gte: startOfMonth } },
                account: { type: { in: ['REVENUE', 'EXPENSE'] } }
            },
            select: {
                debit: true, credit: true,
                account: { select: { type: true } }
            }
        }),
        prisma.journalLine.findMany({
            where: {
                entry: { status: 'POSTED', date: { gte: prevMonthStart, lt: startOfMonth } },
                account: { type: { in: ['REVENUE', 'EXPENSE'] } }
            },
            select: {
                debit: true, credit: true,
                account: { select: { type: true } }
            }
        }),
        // Top products by sales value
        prisma.salesOrderItem.findMany({
            where: {
                salesOrder: { orderDate: { gte: startOfMonth }, status: { not: 'CANCELLED' } }
            },
            select: {
                quantity: true, unitPrice: true,
                product: { select: { name: true, costPrice: true } }
            }
        }),
    ])

    const calcTotals = (lines: typeof currentLines) => {
        let revenue = 0, expense = 0
        for (const jl of lines) {
            if (jl.account.type === 'REVENUE') revenue += Number(jl.credit) - Number(jl.debit)
            else if (jl.account.type === 'EXPENSE') expense += Number(jl.debit) - Number(jl.credit)
        }
        return { revenue, expense, profit: revenue - expense }
    }

    const current = calcTotals(currentLines)
    const prev = calcTotals(prevLines)
    const marginPct = current.revenue > 0 ? Math.round((current.profit / current.revenue) * 100) : 0
    const prevMarginPct = prev.revenue > 0 ? Math.round((prev.profit / prev.revenue) * 100) : 0
    const marginTrend = marginPct - prevMarginPct // positive = improving

    // Aggregate product profitability
    const productMap = new Map<string, { name: string; revenue: number; cost: number }>()
    for (const item of topProducts) {
        const key = item.product.name
        const rev = item.quantity * Number(item.unitPrice)
        const cost = item.quantity * Number(item.product.costPrice)
        const existing = productMap.get(key)
        if (existing) {
            existing.revenue += rev
            existing.cost += cost
        } else {
            productMap.set(key, { name: key, revenue: rev, cost: cost })
        }
    }

    const topByMargin = Array.from(productMap.values())
        .map(p => ({ name: p.name, margin: p.revenue > 0 ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0, revenue: p.revenue }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 3)

    return {
        grossProfit: current.profit,
        revenue: current.revenue,
        marginPct,
        marginTrend,
        topProducts: topByMargin
    }
}
```

**Step 3: Add `fetchCustomerInsights` fetcher**

```typescript
async function fetchCustomerInsights(prisma: PrismaClient) {
    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const [totalActive, newThisMonth, topCustomers, repeatCustomers] = await Promise.all([
        prisma.customer.count({ where: { isActive: true } }),
        prisma.customer.count({ where: { createdAt: { gte: startOfMonth } } }),
        // Top 3 customers by sales order value this month
        prisma.salesOrder.findMany({
            where: { orderDate: { gte: startOfMonth }, status: { not: 'CANCELLED' } },
            select: {
                totalAmount: true,
                customer: { select: { id: true, name: true } }
            }
        }),
        // Customers with >1 order (repeat)
        prisma.salesOrder.groupBy({
            by: ['customerId'],
            _count: true,
            having: { customerId: { _count: { gt: 1 } } }
        }),
    ])

    // Aggregate top customers
    const customerMap = new Map<string, { name: string; total: number }>()
    for (const so of topCustomers) {
        const key = so.customer.id
        const existing = customerMap.get(key)
        if (existing) {
            existing.total += Number(so.totalAmount)
        } else {
            customerMap.set(key, { name: so.customer.name, total: Number(so.totalAmount) })
        }
    }
    const top3 = Array.from(customerMap.values()).sort((a, b) => b.total - a.total).slice(0, 3)

    const repeatRate = totalActive > 0 ? Math.round((repeatCustomers.length / totalActive) * 100) : 0

    return {
        totalActive,
        newThisMonth,
        top3Customers: top3,
        repeatRate
    }
}
```

**Step 4: Add `fetchComplianceStatus` fetcher**

```typescript
async function fetchComplianceStatus(prisma: PrismaClient) {
    const today = new Date()
    const in30Days = addDays(today, 30)

    const [pendingInvoices, draftJournals, overdueAP, missingTax] = await Promise.all([
        // Draft invoices not yet issued
        prisma.invoice.count({
            where: { status: 'DRAFT' }
        }),
        // Draft journal entries (unposted)
        prisma.journalEntry.count({
            where: { status: 'DRAFT' }
        }),
        // Overdue AP (bills past due)
        prisma.invoice.count({
            where: {
                type: 'INV_IN',
                status: { notIn: ['PAID', 'VOID', 'CANCELLED'] },
                dueDate: { lt: today }
            }
        }),
        // Invoices without tax (PPN should be > 0 for most)
        prisma.invoice.count({
            where: {
                type: 'INV_OUT',
                status: { notIn: ['CANCELLED', 'VOID'] },
                taxAmount: { equals: 0 },
                totalAmount: { gt: 0 }
            }
        }),
    ])

    const totalIssues = pendingInvoices + draftJournals + overdueAP
    const status: 'green' | 'yellow' | 'red' = totalIssues === 0 ? 'green' : totalIssues <= 3 ? 'yellow' : 'red'

    return {
        draftInvoices: pendingInvoices,
        draftJournals,
        overdueAP,
        missingTax,
        status,
        totalIssues
    }
}
```

**Step 5: Wire fetchers into `getDashboardOperations`**

Add the 4 new fetchers to the parallel Promise.all in `getDashboardOperations()` and include in return value. Also add fallbacks.

**Step 6: Wire into `/api/dashboard` route**

In `app/api/dashboard/route.ts`, pass the new fields from operations through to the response. Add fallback values to `FALLBACK_OPERATIONS`.

---

## Task 2: Add 4 New Cards to Dashboard Page

**Files:**
- Modify: `app/dashboard/page.tsx`

**Step 1: Add new icon imports**

```typescript
import {
    // ... existing imports ...
    IconChartLine,
    IconPercentage,
    IconUsersGroup,
    IconShieldCheck,
    IconTrendingUp,
    IconTrendingDown,
    IconArrowUpRight,
    IconArrowDownRight,
    IconCash,
    IconReportMoney,
} from "@tabler/icons-react"
```

**Step 2: Extract new data from hook**

After existing data extraction (around line 105), add:

```typescript
// Cash Flow
const cashFlow = data?.cashFlow ?? { kasMasuk: 0, kasKeluar: 0, netCashFlow: 0, topExpenses: [] }
const dataCash7d = data?.charts?.dataCash7d ?? []

// Profitability
const profitability = data?.profitability ?? { grossProfit: 0, revenue: 0, marginPct: 0, marginTrend: 0, topProducts: [] }

// Customers
const customerInsights = data?.customerInsights ?? { totalActive: 0, newThisMonth: 0, top3Customers: [], repeatRate: 0 }

// Compliance
const compliance = data?.compliance ?? { draftInvoices: 0, draftJournals: 0, overdueAP: 0, missingTax: 0, status: 'green', totalIssues: 0 }
```

**Step 3: Add Arus Kas card (Column 3, after Keuangan)**

Uses a tiny Recharts `AreaChart` sparkline for 7-day cash trend.

```tsx
{/* ARUS KAS */}
<ModuleCard title="Arus Kas" icon={IconCash} href="/finance/reports" accentColor="bg-blue-600">
    <div className="grid grid-cols-2 gap-x-4">
        <CardMetric label="Kas Masuk (7h)" value={formatCurrency(cashFlow.kasMasuk)} />
        <CardMetric label="Kas Keluar (7h)" value={formatCurrency(cashFlow.kasKeluar)} />
    </div>
    <div className="mt-1 flex items-center gap-2 px-1 py-1.5">
        <span className="text-[11px] font-semibold text-zinc-500">Net Cash Flow</span>
        <span className={`text-[13px] font-black tabular-nums ${cashFlow.netCashFlow >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatCurrency(cashFlow.netCashFlow)}
        </span>
        {cashFlow.netCashFlow >= 0
            ? <IconTrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : <IconTrendingDown className="w-3.5 h-3.5 text-red-500" />}
    </div>

    {dataCash7d.length > 0 && (
        <>
            <SectionDivider label="Tren 7 Hari" />
            <div className="h-16">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dataCash7d}>
                        <Area type="monotone" dataKey="val" stroke="#3b82f6" fill="#dbeafe" strokeWidth={2} />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </>
    )}

    {cashFlow.topExpenses.length > 0 && (
        <>
            <SectionDivider label="Pengeluaran Terbesar" />
            <div className="space-y-1">
                {cashFlow.topExpenses.slice(0, 3).map((exp: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] px-1 py-1">
                        <span className="text-zinc-600 dark:text-zinc-400 truncate">{exp.name}</span>
                        <span className="font-bold text-red-600 tabular-nums">{formatCurrency(exp.amount)}</span>
                    </div>
                ))}
            </div>
        </>
    )}
</ModuleCard>
```

**Step 4: Add Profitabilitas card (Column 1, after Penjualan)**

```tsx
{/* PROFITABILITAS */}
<ModuleCard title="Profitabilitas" icon={IconReportMoney} href="/finance/reports" accentColor="bg-emerald-700">
    <div className="grid grid-cols-2 gap-x-4">
        <NonZeroMetric label="Laba Kotor" value={formatCurrency(profitability.grossProfit)} />
        <NonZeroMetric label="Revenue" value={formatCurrency(profitability.revenue)} />
    </div>

    {profitability.revenue > 0 && (
        <div className="mt-1.5">
            <ProgressBar
                value={profitability.marginPct}
                max={100}
                color={profitability.marginPct >= 30 ? 'bg-emerald-500' : profitability.marginPct >= 15 ? 'bg-amber-500' : 'bg-red-500'}
                label="Margin"
            />
            {profitability.marginTrend !== 0 && (
                <div className="flex items-center gap-1 mt-1 px-1">
                    {profitability.marginTrend > 0
                        ? <IconArrowUpRight className="w-3 h-3 text-emerald-500" />
                        : <IconArrowDownRight className="w-3 h-3 text-red-500" />}
                    <span className={`text-[10px] font-bold ${profitability.marginTrend > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {profitability.marginTrend > 0 ? '+' : ''}{profitability.marginTrend}% vs bulan lalu
                    </span>
                </div>
            )}
        </div>
    )}

    {profitability.topProducts.length > 0 && (
        <>
            <SectionDivider label="Produk Margin Tertinggi" />
            <div className="space-y-1">
                {profitability.topProducts.map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] px-1 py-1">
                        <span className="text-zinc-600 dark:text-zinc-400 truncate">{p.name}</span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] text-zinc-400">{formatCurrency(p.revenue)}</span>
                            <span className="font-black text-emerald-600 tabular-nums">{p.margin}%</span>
                        </div>
                    </div>
                ))}
            </div>
        </>
    )}
</ModuleCard>
```

**Step 5: Add Pelanggan card (Column 1, after Profitabilitas)**

```tsx
{/* PELANGGAN */}
<ModuleCard title="Pelanggan" icon={IconUsersGroup} href="/sales/customers" accentColor="bg-violet-700">
    <div className="grid grid-cols-2 gap-x-4">
        <CardMetric label="Pelanggan Aktif" value={String(customerInsights.totalActive)} />
        {customerInsights.newThisMonth > 0 && (
            <CardMetric label="Baru (Bulan Ini)" value={String(customerInsights.newThisMonth)} />
        )}
        {customerInsights.repeatRate > 0 && (
            <CardMetric label="Repeat Order" value={`${customerInsights.repeatRate}%`} />
        )}
    </div>

    {customerInsights.top3Customers.length > 0 && (
        <>
            <SectionDivider label="Top Pelanggan" />
            <div className="space-y-1">
                {customerInsights.top3Customers.map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between text-[11px] px-1 py-1">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="w-4 h-4 flex items-center justify-center bg-violet-100 dark:bg-violet-900/30 text-[9px] font-black text-violet-600">{i + 1}</span>
                            <span className="text-zinc-600 dark:text-zinc-400 truncate">{c.name}</span>
                        </div>
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">{formatCurrency(c.total)}</span>
                    </div>
                ))}
            </div>
        </>
    )}
</ModuleCard>
```

**Step 6: Add Dokumen & Kepatuhan card (Column 3, after SDM)**

```tsx
{/* DOKUMEN & KEPATUHAN */}
<ModuleCard
    title="Kepatuhan"
    icon={IconShieldCheck}
    href="/finance/journal"
    accentColor="bg-rose-600"
    badge={compliance.totalIssues > 0 ? compliance.totalIssues : undefined}
    badgeColor="bg-red-500"
>
    <div className="grid grid-cols-2 gap-x-4">
        {compliance.draftInvoices > 0 && <CardMetric label="Invoice Draft" value={String(compliance.draftInvoices)} alert />}
        {compliance.draftJournals > 0 && <CardMetric label="Jurnal Draft" value={String(compliance.draftJournals)} alert />}
        {compliance.overdueAP > 0 && <CardMetric label="AP Overdue" value={String(compliance.overdueAP)} alert />}
        {compliance.missingTax > 0 && <CardMetric label="Tanpa PPN" value={String(compliance.missingTax)} alert />}
    </div>

    <SectionDivider label="Status Kepatuhan" />
    <div className="flex items-center gap-2 px-1 py-1.5">
        <span className={`w-3 h-3 rounded-full ${
            compliance.status === 'green' ? 'bg-emerald-500' :
            compliance.status === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
        }`} />
        <span className={`text-[12px] font-black ${
            compliance.status === 'green' ? 'text-emerald-600' :
            compliance.status === 'yellow' ? 'text-amber-700' : 'text-red-600'
        }`}>
            {compliance.status === 'green' ? 'Semua Beres' :
             compliance.status === 'yellow' ? 'Perlu Perhatian' : 'Ada Masalah'}
        </span>
    </div>
</ModuleCard>
```

**Step 7: Rearrange column layout**

New layout:
- **Col 1:** Penjualan → Profitabilitas → Pelanggan → Inventori
- **Col 2:** Pengadaan → Manufaktur
- **Col 3:** Keuangan → Arus Kas → SDM → Kepatuhan → Tugas Hari Ini

---

## Task 3: Add Recharts Import for Sparkline

**Files:**
- Modify: `app/dashboard/page.tsx`

Add at top of file:
```typescript
import { AreaChart, Area, ResponsiveContainer } from "recharts"
```

Recharts is already in package.json, so no install needed.

---

## Task 4: Verify & Test

**Step 1:** Run `npm run dev` and open `/dashboard`
**Step 2:** Verify all 10 cards render without errors
**Step 3:** Verify graceful degradation when data is empty (cards should hide or show zero state)
**Step 4:** Run `npx tsc --noEmit` to check types
**Step 5:** Run `npx vitest` to ensure no regressions

---

## Column Layout Summary

```
┌─────────────────┬─────────────────┬─────────────────┐
│  PENJUALAN      │  PENGADAAN      │  KEUANGAN       │
│  (cyan)         │  (amber)        │  (emerald)      │
├─────────────────┤                 ├─────────────────┤
│  PROFITABILITAS │  MANUFAKTUR     │  ARUS KAS       │
│  (emerald-700)  │  (orange)       │  (blue)         │
├─────────────────┤                 ├─────────────────┤
│  PELANGGAN      │                 │  SDM            │
│  (violet-700)   │                 │  (blue)         │
├─────────────────┤                 ├─────────────────┤
│  INVENTORI      │                 │  KEPATUHAN      │
│  (violet)       │                 │  (rose)         │
│                 │                 ├─────────────────┤
│                 │                 │  TUGAS HARI INI │
└─────────────────┴─────────────────┴─────────────────┘
```
