# CEO Dashboard Redesign — Design Doc

**Date:** 2026-02-20
**Status:** Approved

## Problem

The CEO dashboard shows all zeros ("Rp 0", "Belum ada data") because:

1. `getFinancialMetrics()` in `lib/actions/finance.ts` uses non-SSR Supabase client (`lib/supabase.ts`) — RLS blocks all queries → empty arrays → zeros
2. `getSalesStats()` in `lib/actions/sales.ts` uses `withPrismaAuth` transaction wrapper — fails silently in API route context → returns fallback zeros
3. Payroll totals (`fetchHRMetrics()`) exist in `app/actions/dashboard.ts` but are not connected to `getDashboardOperations()` — never sent to frontend
4. Missing entirely: tax (PPN) widget, per-warehouse inventory cards, staff attendance view

## Solution

### Data Pipeline Fixes

| Fix | File | Change |
|-----|------|--------|
| Financial metrics | `lib/actions/finance.ts` → `getFinancialMetrics()` | Replace Supabase client queries with Prisma queries using `basePrisma` singleton |
| Sales stats | `lib/actions/sales.ts` → `getSalesStats()` | Replace `withPrismaAuth` with direct Prisma + `requireAuth()` pattern |
| HR metrics | `app/actions/dashboard.ts` → `getDashboardOperations()` | Add `fetchHRMetrics()` to the parallel Promise.all |
| Tax (PPN) | `app/actions/dashboard.ts` | New `fetchTaxMetrics()` — sum PPN from invoices this month |
| API route | `app/api/dashboard/route.ts` | Pass `hr` and `tax` data in response JSON |

### New Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  PULSE BAR: KAS | REVENUE MTD | NET MARGIN | INVENTORI | BURN RATE  │
├─────────┬─────────┬──────────┬──────────┤
│ Total PR│ Total PO│ Gaji     │ PPN      │
│ Rp XXjt │ Rp XXjt │ Rp XXjt  │ Rp XXjt  │
├─────────────────┬───────────────────────┤
│ ACTION CENTER   │ FINANCIAL HEALTH      │
│ PO approvals    │ Cash flow chart       │
│ Quick actions   │ AR/AP + invoices      │
├─────────┬───────┬───────┬───────────────┤
│ Gudang A│Gudang B│Gudang C│ ...          │
│ 150 item│ 80 item│ 45 item│              │
│ Rp 2.1M │ Rp 800K│ Rp 400K│              │
├─────────────────────────────────────────┤
│ TIM HARI INI                            │
│ Name | Position | Status | Check-in     │
├─────────────────────────────────────────┤
│ ACTIVITY FEED                           │
│ Recent invoices, POs, movements, hires  │
└─────────────────────────────────────────┘
```

### Sections Removed
- AI Search Card (not functional)
- Textile Strip (OEE Gauge, Shift Handover, Machine Downtime) → belongs in /manufacturing
- Operations Strip → data merged into Pulse Bar + KPI cards
- Trending Widget → data merged into KPI cards

### Components

| Component | Status | Action |
|-----------|--------|--------|
| `company-pulse-bar.tsx` | Keep | Fix data — will show real numbers after pipeline fix |
| `ceo-action-center.tsx` | Keep | Fix data — PO approvals + PR/PO counts |
| `financial-health-card.tsx` | Keep | Fix data — cash flow chart + invoices |
| `dashboard-view.tsx` | Rewrite | New layout with 6 rows instead of current slot system |
| NEW: `kpi-summary-cards.tsx` | Create | 4 cards: Total PR, Total PO, Gaji, PPN |
| NEW: `warehouse-overview.tsx` | Create | Grid of warehouse cards with inventory value |
| NEW: `staff-today.tsx` | Create | Table of employees with today's attendance |
| `compact-activity-feed.tsx` | Keep | Already works if activity data flows correctly |
| `ai-search-card.tsx` | Remove | Not used |
| `oee-gauge.tsx` | Remove from dashboard | Stays in codebase for /manufacturing |
| `shift-handover-widget.tsx` | Remove from dashboard | Stays in codebase for /manufacturing |
| `machine-downtime-widget.tsx` | Remove from dashboard | Stays in codebase for /manufacturing |
| `operations-strip.tsx` | Remove | Data merged into pulse bar + KPI cards |
| `trending-widget.tsx` | Remove | Data merged into KPI cards |

### Data Shape (API Response)

```typescript
{
  financials: {
    cashBalance: number,
    revenue: number,
    netMargin: number,
    burnRate: number,
    receivables: number,
    payables: number,
    overdueInvoices: Invoice[],
    upcomingPayables: Invoice[],
    recentInvoices: Invoice[],
    netCashIn: number,
  },
  operations: {
    procurement: {
      activeCount: number,
      totalPRs: number,
      pendingPRs: number,
      totalPOs: number,
      totalPOValue: number,
      totalPRValue: number,  // NEW
      poByStatus: Record<string, number>,
      pendingApproval: PO[],
      delays: PO[],
    },
    workforceStatus: { attendanceRate, presentCount, lateCount, totalStaff, topEmployees },
    inventoryValue: { value, itemCount, warehouses: Warehouse[] },
    leaves: number,
    // Existing fields preserved...
  },
  hr: {          // NEW — from fetchHRMetrics()
    totalSalary: number,
    lateEmployees: Employee[],
  },
  tax: {         // NEW — from fetchTaxMetrics()
    ppnOut: number,   // PPN dari penjualan (INV_OUT)
    ppnIn: number,    // PPN dari pembelian (INV_IN)
    ppnNet: number,   // ppnOut - ppnIn
  },
  sales: {
    totalRevenue: number,
    totalOrders: number,
    activeOrders: number,
    recentOrders: Order[],
  },
  activity: {
    activityFeed: Activity[],
    executiveAlerts: Alert[],
  },
  charts: {
    dataCash7d: ChartPoint[],
    dataReceivables: ChartPoint[],
    dataPayables: ChartPoint[],
    dataProfit: ChartPoint[],
  },
}
```

### PR Value Calculation (NEW)

Currently `fetchProcurementMetrics()` aggregates PO total but not PR total. Need to add:
```typescript
const prSummary = await prisma.purchaseRequest.aggregate({
  _sum: { estimatedCost: true },  // Check if field exists in schema
  where: { status: { notIn: ['CANCELLED'] } }
})
```
If `estimatedCost` doesn't exist on PurchaseRequest, sum from PurchaseRequestItem.

### Tax Calculation (NEW)

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

  const ppnOut = ppnOutAgg._sum?.taxAmount?.toNumber() || 0
  const ppnIn = ppnInAgg._sum?.taxAmount?.toNumber() || 0

  return { ppnOut, ppnIn, ppnNet: ppnOut - ppnIn }
}
```

## Non-Goals

- No real-time WebSocket updates (poll via TanStack Query staleTime)
- No chart redesign (keep existing Recharts components)
- No new Prisma models — all data from existing tables
