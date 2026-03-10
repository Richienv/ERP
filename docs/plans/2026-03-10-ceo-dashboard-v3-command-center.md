# CEO Dashboard v3 — Command Center Design

**Status:** Implemented (base), needs enrichment pass
**Date:** 2026-03-10

## Current Layout

### Hero Section
- Time-of-day greeting with user name (green accent)
- LIVE indicator badge (top-right)
- 5 KPI cards in a row: Revenue MTD, Piutang (AR), Hutang (AP), Invoice Overdue, Perlu Approval
- Each KPI has colored icon badge + tinted background

### Alert Ticker
- Red-bordered bar when executive alerts exist (machine breakdowns, QC failures)
- Shows up to 4 alerts inline

### 3-Column Bento Grid

**Column 1: Penjualan + Inventori**
- Penjualan: 3 hero StatBlocks (Pesanan Aktif, Revenue, Fulfillment%) + ProgressBar + Recent Orders list
- Inventori: 2×2 metric grid + low stock items with restock warnings

**Column 2: Pengadaan + Manufaktur**
- Pengadaan: 2×2 metrics + inline PO approval (Setujui/Tolak buttons)
- Manufaktur: 3 hero StatBlocks (WO Aktif, Efisiensi, Produksi) + Quality Rate progress bar + Recent QC

**Column 3: SDM + Overdue Invoices + Tasks + Activity**
- SDM: 2×2 metrics + attendance progress bar
- Overdue Invoices card (conditional, red-accented)
- Tugas Hari Ini (from useSidebarActions)
- Aktivitas Terbaru (CompactActivityFeed)

## Design System
- Neo-brutalist: `border-2 border-black`, `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`
- Colored card headers (full accent bg, white text + icons)
- Progress bars for fulfillment, quality, attendance
- StatBlock hero numbers for key metrics
- Dashed divider metric rows
- SectionDivider within cards
- Framer Motion fade-up on load

## Components
- `components/dashboard/dashboard-view.tsx` — 3-slot layout (hero, alert, grid)
- `components/dashboard/greeting-bar.tsx` — greeting + 5 KPI cards
- `components/dashboard/module-card.tsx` — ModuleCard, CardMetric, StatBlock, ProgressBar, SectionDivider
- `components/dashboard/todays-tasks.tsx` — task list from useSidebarActions
- `components/dashboard/compact-activity-feed.tsx` — activity feed

## Data Sources
- `useExecutiveDashboard()` → `/api/dashboard` → 5 parallel fetches:
  - `getDashboardFinancials()` — revenue, AR, AP, overdue invoices, upcoming payables
  - `getDashboardOperations()` — procurement, production, inventory, workforce, quality
  - `getDashboardActivity()` — activity feed, executive alerts
  - `getDashboardCharts()` — 7-day cash flow, receivables, payables, profit
  - `getSalesStats()` — sales revenue, orders, recent orders

## v3.1 Enrichment (Implemented)

### New: Keuangan Card (Column 3)
- Cash balance, Net Cash In, PPN Out/In
- Recent invoices with status badges (PAID/ISSUED/PARTIAL/OVERDUE)
- Overdue invoices with customer names + amounts
- Upcoming payables (tagihan mendatang)

### Enriched: SDM Card
- Pending leave requests with action link
- Top employees by attendance
- Late employees list (names + time)

### Enriched: Inventori Card
- Per-warehouse breakdown (name, SKU count, value)

### Enriched: Pengadaan Card
- PO status distribution tags (DRAFT 2, APPROVED 1, etc.)

### Layout Fix: Symmetric 3-Column
- Column 1: Penjualan + Inventori (both data-rich)
- Column 2: Pengadaan + Manufaktur (both data-rich)
- Column 3: Keuangan + SDM + Tugas (balanced with new finance card)
- Activity Feed: Full-width bottom row (spans all 3 columns)

## Data Sources Used (Complete)
From `getDashboardFinancials()`:
- cashBalance, revenue, receivables, payables, netCashIn
- overdueInvoices (customer, amount)
- upcomingPayables (supplier, amount)
- recentInvoices (number, customer, total, status)

From `getDashboardOperations()`:
- procurement: totalPOs, totalPRs, values, pendingApproval, poByStatus
- prodMetrics: activeWorkOrders, efficiency, totalProduction
- qualityStatus: passRate, recentInspections
- materialStatus: low stock items
- workforceStatus: totalStaff, presentCount, lateCount, topEmployees
- inventoryValue: value, warehouses (name, productCount, value)
- inventorySummary: productCount, warehouseCount
- salesFulfillment: totalOrders, deliveredOrders, fulfillmentRate
- leaves: pending leave count
- tax: ppnOut, ppnIn, ppnNet
- hr: totalSalary, lateEmployees

From `getDashboardActivity()`:
- activityFeed (type, title, description, timestamp)
- executiveAlerts (machine breakdowns, QC failures)

From `getSalesStats()`:
- totalRevenue, activeOrders, recentOrders (customer, amount)

## Future Ideas
- Mini sparkline charts for revenue/cash trend (7-day data available)
- Inline leave approval from dashboard
- Machine status indicators (idle/running/maintenance)
