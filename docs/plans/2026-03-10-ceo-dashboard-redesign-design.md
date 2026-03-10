# CEO Dashboard Redesign — "Pusat Komando"

**Goal:** Replace the current dead-end dashboard with a command-center layout where every module gets a horizontal strip showing 4 key metrics + 1 action link. No more "Belum ada data" — show real numbers (even 0).

**Architecture:** 6 module strips (Keuangan, Penjualan, Pengadaan, Inventori, Manufaktur, SDM) + greeting bar + bottom tasks/activity section. Reuse existing `/api/dashboard` data — minimal new queries.

**Tech Stack:** React 19, TanStack Query (existing `useExecutiveDashboard` hook), Tailwind CSS, Framer Motion for staggered reveals.

---

## Layout Structure

```
Row 0: Greeting Bar (name + date + 3 global KPIs)
Row 1: Keuangan Strip
Row 2: Penjualan Strip
Row 3: Pengadaan Strip
Row 4: Inventori Strip
Row 5: Manufaktur Strip
Row 6: SDM Strip
Row 7: Tugas Hari Ini (left) + Aktivitas Terbaru (right)
```

## Module Strip Metrics

### Keuangan
| Revenue MTD | Piutang (AR) | Hutang (AP) | Invoice Overdue |
- Source: `getFinancialMetrics()` → revenue, receivables, payables, overdueInvoices
- Action: Invoice Overdue count → `/finance/invoices`
- No GL dependency — all from Invoice table

### Penjualan
| Pesanan Aktif | Revenue Bulan Ini | Order Baru Bulan Ini | Fulfillment Rate |
- Source: `getSalesStats()` → activeOrders, totalRevenue, totalOrders
- New: fulfillment rate = delivered / total orders (%)
- Action: → `/sales/orders`

### Pengadaan
| Total PR | Total PO | Nilai PO | Pending Approval |
- Source: `fetchProcurementMetrics()` → already returns all of this
- Action: Pending Approval count → `/procurement/orders`

### Inventori
| Nilai Stok | Produk Stok Rendah | Total SKU Aktif | Gudang Aktif |
- Source: `fetchTotalInventoryValue()` + `fetchMaterialStatus()` (existing)
- New: product count + warehouse count (2 COUNT queries)
- Action: Stok Rendah → `/inventory/stock`

### Manufaktur
| WO Aktif | Efisiensi | Mesin Berjalan | Quality Pass Rate |
- Source: `fetchProductionMetrics()` + `fetchQualityStatus()` + `fetchProductionStatus()`
- Action: → `/manufacturing/orders`

### SDM
| Total Karyawan | Hadir Hari Ini | Terlambat | Estimasi Gaji |
- Source: `fetchWorkforceStatus()` + `fetchHRMetrics()`
- Action: → `/hcm/attendance`

## Greeting Bar
- Left: "Selamat [pagi/siang/sore], [Nama]" + formatted date
- Right: 3 global highlights as small badges:
  - Pending Approvals count (red if > 0)
  - Revenue MTD
  - Total AR

## Bottom Section
- Left (7 cols): Tugas Hari Ini — keep existing `todays-tasks.tsx`
- Right (5 cols): Aktivitas Terbaru — keep existing `compact-activity-feed.tsx`

## Design Rules
1. **Kill "Belum ada data"** — show `Rp 0` or `0` with `text-zinc-300` muted styling
2. **Kill**: Burn Rate, Gudang overview card, Revenue Stream chart, Net Margin, PPN card
3. **Keep**: Today's Tasks + Activity Feed (already working well)
4. **Every strip header** is a clickable link to the module's main page
5. **4th metric** in each strip doubles as action when attention needed (badge + link)
6. **Neo-brutalist styling**: `border-2 border-black`, `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
7. **Responsive**: strips stack on mobile, 4-column grid on desktop

## Data Changes Required
- **Remove**: `burnRate`, `netMargin` from pulse bar
- **New query**: `getInventorySummary()` — COUNT of active products + COUNT of active warehouses
- **New query**: `getSalesFulfillmentRate()` — COUNT delivered / COUNT total SalesOrders this month
- **Modify**: `getFinancialMetrics()` — ensure `overdueInvoices` returns count (already does)
- **No new API endpoints** — add new queries to existing `getDashboardOperations()` group

## Components to Create
1. `components/dashboard/greeting-bar.tsx` — name + date + 3 global KPIs
2. `components/dashboard/module-strip.tsx` — reusable strip component (header + 4 metric cards + action link)
3. `components/dashboard/metric-card.tsx` — single KPI card with value, label, optional badge

## Components to Remove/Replace
- `components/dashboard/company-pulse-bar.tsx` → replaced by greeting-bar
- `components/dashboard/kpi-summary-cards.tsx` → replaced by module strips
- `components/dashboard/financial-health-card.tsx` → replaced by Keuangan strip
- `components/dashboard/warehouse-overview.tsx` → replaced by Inventori strip
- `components/dashboard/staff-today.tsx` → replaced by SDM strip
- `components/dashboard/ceo-action-center.tsx` → approval moved into Pengadaan strip action

## Files to Modify
- `app/dashboard/page.tsx` — new layout orchestration
- `components/dashboard/dashboard-view.tsx` — new strip-based layout
- `app/actions/dashboard.ts` — add inventory summary + sales fulfillment queries
- `app/api/dashboard/route.ts` — include new data in response
