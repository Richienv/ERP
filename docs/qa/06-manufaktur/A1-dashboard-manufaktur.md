# QA: Dashboard Manufaktur

> Checklist ref: **A1 + A2 + A3**
> Last reviewed: 2026-03-27

---

## 1. Page Info

| Field | Value |
|-------|-------|
| Nama | Dashboard Manufaktur |
| Route | `/manufacturing` |
| Breadcrumb | Manufaktur > Dashboard |
| Entry file | `app/manufacturing/page.tsx` |
| Client component | `app/manufacturing/manufacturing-dashboard-client.tsx` |
| Error boundary | `app/manufacturing/error.tsx` |

---

## 2. Purpose

Menampilkan ringkasan real-time kondisi pabrik: OEE, status mesin, work orders terbaru, quality control, dan timeline beban kerja per stasiun produksi.

---

## 3. UI Elements

### 3.1 Page Header

| Element | Detail |
|---------|--------|
| Icon | `Factory` (lucide), biru, kiri |
| Title | "DASHBOARD MANUFAKTUR" (h1, uppercase, font-black) |
| Subtitle | "Overview produksi & status pabrik real-time" |
| Accent | Left border 6px, `border-l-blue-400` |
| Style | NB card: `border-2 border-black shadow-[4px_4px...]` |

### 3.2 Header Buttons (kanan atas)

| # | Label | Icon | Type | Target |
|---|-------|------|------|--------|
| 1 | WORK ORDERS | `Package` | outline, link | `/manufacturing/orders` |
| 2 | WORK CENTERS | `Settings` | outline, link | `/manufacturing/work-centers` |
| 3 | (refresh, no label) | `RefreshCw` | outline, onClick | fetches `/api/manufacturing/dashboard` |
| 4 | BUAT ORDER | `Plus` | primary (blue), link | `/manufacturing/orders` |

- Refresh button: `animate-spin` on icon while `refreshing === true`; disabled during fetch.
- All buttons: `h-10`, `text-[10px] font-bold uppercase tracking-wide`

### 3.3 Alerts Section

- **Visibility**: Only rendered when `data.alerts.length > 0`
- **Layout**: Vertical stack of NB alert cards
- **Alert types**:

| Type | Left border | Background | Icon |
|------|-------------|------------|------|
| `error` | `border-l-red-500` | `bg-red-50` | `AlertCircle` (red) |
| `warning` | `border-l-amber-500` | `bg-amber-50` | `AlertTriangle` (amber) |
| `info` | `border-l-blue-500` | `bg-blue-50` | `AlertTriangle` (amber) — **Note: info uses amber icon, not blue** |

- Each alert shows: **title** (uppercase bold) + **message** (small text)
- Generated server-side based on thresholds (see Section 6)

### 3.4 OEE + KPI Cards (4 cards, grid row)

| # | Card | Data field | Visual | Color logic |
|---|------|-----------|--------|-------------|
| 1 | **Overall OEE** | `productionHealth.oee` | SVG donut chart (r=32, stroke=6) + percentage in center | >= 85% green, >= 60% amber, < 60% red |
| 2 | **Availability** | `productionHealth.availability` | Large percentage text | Same threshold coloring |
| 3 | **Performance** | `productionHealth.performance` | Large percentage text | Same threshold coloring |
| 4 | **Quality** | `productionHealth.quality` | Large percentage text | Same threshold coloring |

- Grid: `grid-cols-2 lg:grid-cols-4`
- OEE card has dark background (`bg-zinc-900`), others white
- OEE shows "Target: 85%" below donut
- Availability subtitle: "Machine uptime"
- Performance subtitle: "Kecepatan produksi"
- Quality subtitle: "First pass yield"

### 3.5 Stats Row (5 small KPI cards)

| # | Label | Data field | Icon | Color |
|---|-------|-----------|------|-------|
| 1 | Total Orders | `workOrders.total` | `Package` | neutral |
| 2 | In Progress | `workOrders.inProgress` | `Factory` | amber-600 |
| 3 | Selesai | `workOrders.completedThisMonth` | `CheckCircle` | emerald-600 |
| 4 | Mesin Aktif | `machines.running / machines.total` | `Settings` | neutral (format: "X/Y") |
| 5 | Pass Rate | `quality.passRate` | `ClipboardCheck` | blue-600 |

- Grid: `grid-cols-2 md:grid-cols-5`

### 3.6 Machine Status Card (left column)

| Element | Detail |
|---------|--------|
| Header | "STATUS MESIN", icon `Settings`, bg blue-50, "Lihat Semua" button -> `/manufacturing/work-centers` |
| Content | 4 status boxes in `grid-cols-4`: Running (green), Idle (grey), Maint. (amber), Down (red) |
| Footer | "Average Health" progress bar with percentage |

- Health bar color: >= 80% green, >= 60% amber, < 60% red
- "Down" box: brighter red border/bg if `breakdown > 0`

### 3.7 Recent Work Orders Card (right column)

| Element | Detail |
|---------|--------|
| Header | "WORK ORDERS TERBARU", icon `Package`, "Lihat Semua" button -> `/manufacturing/orders` |
| Empty state | "Tidak ada work order" (centered, muted text) |
| Items | Max 5 orders, alternating row backgrounds |

Each order row shows:
- **Left**: Order number (monospace bold) + status badge + product name (truncated)
- **Right**: Progress bar (thin, 16px wide) + percentage text

Status badge mapping:

| Status | Label | Dot color | Badge color |
|--------|-------|-----------|-------------|
| PLANNED | Planned | `bg-zinc-400` | zinc bg/border |
| IN_PROGRESS | In Progress | `bg-amber-500` | amber bg/border |
| COMPLETED | Completed | `bg-emerald-500` | emerald bg/border |
| ON_HOLD | On Hold | `bg-orange-500` | orange bg/border |
| CANCELLED | Cancelled | `bg-zinc-400` | zinc bg/border (dimmed) |

### 3.8 Quality Control Card (full width)

| Element | Detail |
|---------|--------|
| Header | "QUALITY CONTROL", icon `ClipboardCheck`, "Lihat Semua" -> `/manufacturing/quality` |
| Content | 4 metric boxes in `grid-cols-2 md:grid-cols-4` |

| # | Metric | Color | Note |
|---|--------|-------|------|
| 1 | Pass Rate (%) | emerald | |
| 2 | Total Inspeksi | neutral | |
| 3 | Lolos | emerald | |
| 4 | Gagal | red (brighter if > 0) | |

### 3.9 Station Workload Timeline (embedded component)

Separate component: `StationWorkloadTimeline` from `components/manufacturing/dashboard/station-workload-timeline.tsx`

**Header:**
- Title: "TIMELINE WORK CENTER"
- Subtitle: "Visualisasi beban kerja semua stasiun dari X BOM aktif"
- Accent: `border-l-emerald-400`

**KPI Strip (below header):**

| KPI | Icon | Color |
|-----|------|-------|
| BOM Aktif | `Layers` | indigo |
| Stasiun Aktif | `Building2` | blue |
| Total Waktu | `Clock` | emerald |
| Proses | `ArrowRight` | amber (+ "X berjalan" badge if in-progress) |

**BOM Filter Chips:**
- "Semua (N)" chip — active when no filter applied (black bg)
- Per-BOM chips with product name, step count, qty, and green dot if has active work order
- Click to toggle filter; multi-select supported
- Color-coded per product (8 rotating color palette)

**Timeline Chart (scrollable):**

| Element | Detail |
|---------|--------|
| Left sidebar | Station labels (160px fixed width), icon + name + process count + "SUB" badge if subcontractor |
| Time ruler | Top axis with dynamic tick intervals (5m/15m/30m/1h/8h depending on total time) |
| Bars | Color-coded by product, 3px left border accent, shows: product name, duration, qty |
| Progress fill | Semi-transparent overlay showing completed percentage |
| In-progress indicator | Green pulsing dot (top-right of bar) |
| End marker | Green vertical line at total duration with time label |
| Row backgrounds | Alternating white/zinc-50 |
| Grid lines | Vertical lines at each tick |

**Bar Click -> Detail Panel:**
- Appears below chart (border-t-2 border-black)
- Left side: Product name, station name, subcontractor name, operator name
- Right side: Duration, qty, progress (completed/total), status badge ("Sedang Berjalan" or "Direncanakan")

### 3.10 Quick Links (bottom, 5 cards)

| # | Label | Icon | Target |
|---|-------|------|--------|
| 1 | Work Centers | `Settings` | `/manufacturing/work-centers` |
| 2 | Work Orders | `Package` | `/manufacturing/orders` |
| 3 | Planning | `Factory` | `/manufacturing/planning` |
| 4 | Bill of Materials | `Wrench` | `/manufacturing/bom` |
| 5 | Quality | `ClipboardCheck` | `/manufacturing/quality` |

- Grid: `grid-cols-2 md:grid-cols-5`
- Hover effect: shadow removed + translate (NB interactive shift)

---

## 4. User Actions

### 4.1 Refresh Dashboard

| Field | Detail |
|-------|--------|
| Trigger | Click refresh button (RefreshCw icon, header area) |
| Behavior | Sets `refreshing=true`, calls `GET /api/manufacturing/dashboard`, updates state |
| Success | All dashboard data refreshes in-place; `refreshing=false` |
| Failure | `console.error` only — no user-visible error toast or message |
| Loading indicator | RefreshCw icon spins (`animate-spin`); button disabled |

### 4.2 Navigate to Work Orders

| Trigger | Target |
|---------|--------|
| "WORK ORDERS" header button | `/manufacturing/orders` |
| "BUAT ORDER" header button | `/manufacturing/orders` |
| "Lihat Semua" in Recent Orders card | `/manufacturing/orders` |

### 4.3 Navigate to Work Centers

| Trigger | Target |
|---------|--------|
| "WORK CENTERS" header button | `/manufacturing/work-centers` |
| "Lihat Semua" in Machine Status card | `/manufacturing/work-centers` |

### 4.4 Navigate to Quality

| Trigger | Target |
|---------|--------|
| "Lihat Semua" in Quality Control card | `/manufacturing/quality` |
| Quick link "Quality" | `/manufacturing/quality` |

### 4.5 Quick Link Navigation

All 5 quick link cards navigate via `<Link>`. No confirmation dialogs.

### 4.6 Filter BOM in Timeline

| Field | Detail |
|-------|--------|
| Trigger | Click any BOM chip in filter bar |
| Behavior | Toggles BOM in `selectedBomIds` Set; timeline re-renders with filtered steps |
| "Semua" chip | Clears filter, shows all BOMs |
| Multi-select | Yes — can select multiple BOMs simultaneously |
| Side effect | Clears selected bar detail panel on filter toggle |

### 4.7 Click Timeline Bar

| Field | Detail |
|-------|--------|
| Trigger | Click any bar in station workload timeline |
| Behavior | Opens detail panel below chart |
| Toggle | Clicking same bar again closes detail panel |
| Panel content | Product name, station, subcontractor, operator, duration, qty, progress, status |

### 4.8 Collapse/Expand Station Row

| Field | Detail |
|-------|--------|
| Trigger | Click station label in left sidebar |
| Behavior | Toggles row in `collapsedRows` Set |
| Visual effect | **Bug: toggle state is tracked but no visual difference is rendered — collapsed rows still display at full height** |

---

## 5. Form Validations

No forms on this page. Dashboard is read-only.

---

## 6. API Calls

### 6.1 GET /api/manufacturing/dashboard

| Field | Detail |
|-------|--------|
| Called by | `useMfgDashboard()` hook (TanStack Query) on mount + manual refresh via `fetchDashboard()` |
| Auth | **No auth check in API route** — differs from station-workload which requires Supabase auth |
| File | `app/api/manufacturing/dashboard/route.ts` |

**Query logic (Prisma, parallel via `Promise.all`):**

| Query | Purpose |
|-------|---------|
| `machine.findMany({ isActive: true })` | All active machines for status counts + health |
| `workOrder.count()` | Total WO count |
| `workOrder.count({ status: 'IN_PROGRESS' })` | In-progress count |
| `workOrder.count({ status: 'COMPLETED', updatedAt >= startOfMonth })` | Completed this month |
| `workOrder.findMany({ createdAt >= startOfMonth, take: 10 })` | Recent 10 orders this month |
| `qualityInspection.groupBy(['status'])` | Pass/fail counts this month |
| `qualityInspection.findMany({ take: 5 })` | Last 5 inspections (not used on dashboard UI) |

**OEE calculation (simplified):**
```
availability = (running + idle) / total_machines
performance  = (actual_production / planned_production)
quality      = pass_rate / 100
OEE          = availability * performance * quality * 100
```

**Alert generation rules:**

| Condition | Type | Title | Message |
|-----------|------|-------|---------|
| `breakdown > 0` | error | Machine Breakdown | "X machine(s) currently down" |
| `passRate < 95` | warning | Quality Alert | "Pass rate at X%, below 95% target" |
| `avgHealth < 70` | warning | Maintenance Required | "Average machine health at X%" |

**Response shape:**
```json
{
  "success": true,
  "data": {
    "productionHealth": { "oee", "availability", "performance", "quality" },
    "workOrders": { "total", "inProgress", "completedThisMonth", "productionThisMonth", "plannedThisMonth" },
    "machines": { "total", "running", "idle", "maintenance", "breakdown", "avgHealth", "totalCapacity" },
    "quality": { "passRate", "totalInspections", "passCount", "failCount", "recentInspections": [...] },
    "recentOrders": [{ "id", "number", "product", "plannedQty", "actualQty", "status", "progress" }],
    "alerts": [{ "type", "title", "message" }]
  }
}
```

**Error response:** `{ "success": false, "error": "Failed to fetch dashboard data" }` (500)

### 6.2 GET /api/manufacturing/station-workload

| Field | Detail |
|-------|--------|
| Called by | `StationWorkloadTimeline` via TanStack Query (`queryKeys.manufacturing.stationWorkload()`) |
| Auth | **Yes** — Supabase `getUser()` check; returns 401 if unauthenticated |
| File | `app/api/manufacturing/station-workload/route.ts` |

**Query logic:**
1. Fetch all active `ProductionBOM` with steps, stations, allocations, and active work orders (PLANNED/IN_PROGRESS)
2. Fetch all active `ProcessStation` for complete station list
3. Enrich steps with BOM/product context, work order status

**Response shape:**
```json
{
  "success": true,
  "data": {
    "steps": [{ "id", "bomId", "productName", "stationId", "station", "sequence", "durationMinutes", "parentStepIds", "completedQty", "allocations", ... }],
    "stations": [{ "id", "code", "name", "stationType", "operationType", "subcontractor" }],
    "boms": [{ "id", "productName", "productCode", "version", "totalQty", "stepCount", "hasActiveWO" }],
    "bomCount": 0,
    "totalSteps": 0
  }
}
```

---

## 7. State & Dependencies

### Data Loading

| Hook / Query | Source | Fallback |
|-------------|--------|----------|
| `useMfgDashboard()` | `GET /api/manufacturing/dashboard` | `emptyData` object (all zeros, empty arrays) |
| TanStack Query (station workload) | `GET /api/manufacturing/station-workload` | Error/loading states |

### Component Dependencies

| Component | File | Purpose |
|-----------|------|---------|
| `CardPageSkeleton` | `components/ui/page-skeleton.tsx` | Loading skeleton (indigo accent) |
| `StationWorkloadTimeline` | `components/manufacturing/dashboard/station-workload-timeline.tsx` | Timeline chart |
| `ErrorFallback` | `components/ui/error-fallback.tsx` | Module error boundary |
| `Button` | `components/ui/button.tsx` | shadcn button |

### Client State

| State | Type | Default | Purpose |
|-------|------|---------|---------|
| `data` | DashboardData | `initialData` | Main dashboard data |
| `refreshing` | boolean | false | Refresh button loading |
| `selectedBomIds` | Set\<string\> | empty Set | BOM filter in timeline |
| `selectedBar` | BarLayout \| null | null | Selected bar detail panel |
| `collapsedRows` | Set\<number\> | empty Set | Row collapse (unused visually) |

### Database Models Queried

- `Machine` (status, healthScore, capacityPerHour)
- `WorkOrder` (status, plannedQty, actualQty, product)
- `QualityInspection` (status, score, inspector, material)
- `ProductionBOM` (steps, stations, workOrders)
- `ProcessStation` (stationType, operationType, subcontractor)

---

## 8. Edge Cases & States

### 8.1 Loading State

| Area | Behavior |
|------|----------|
| Main page | `CardPageSkeleton` with indigo accent — full page skeleton while `useMfgDashboard` loads |
| Station timeline | Inline spinner: `Loader2` icon + "Memuat beban kerja stasiun..." text |

### 8.2 Empty State

| Area | Behavior |
|------|----------|
| No alerts | Alerts section completely hidden (not rendered) |
| No recent orders | "Tidak ada work order" centered text in recent orders card |
| No BOMs (timeline) | "Belum ada BOM aktif dengan proses — buat BOM terlebih dahulu" |
| All KPIs zero | All cards show "0" or "0%"; OEE donut is empty circle |

### 8.3 Error State

| Area | Behavior |
|------|----------|
| Dashboard API error | `useMfgDashboard` returns `emptyData` fallback (no error shown to user, silent fallback) |
| Manual refresh error | `console.error` only — no toast, no error UI |
| Station workload error | Shows error card: "Gagal memuat data: {error.message}" (red accent) |
| Module-level error | `ErrorFallback` component with "Manufaktur" label and retry button |

### 8.4 Permission / Auth

| Area | Auth required? |
|------|---------------|
| Dashboard API (`/api/manufacturing/dashboard`) | **No** — no auth check; any caller gets data |
| Station workload API (`/api/manufacturing/station-workload`) | **Yes** — Supabase auth required; 401 on failure |
| Page route | Protected by middleware (Supabase session required) |

### 8.5 Large Dataset Behavior

| Area | Behavior |
|------|----------|
| Recent orders | Hardcoded `slice(0, 5)` on frontend + `take: 10` on API — max 5 displayed |
| Work orders this month | API returns up to 10 (`take: 10`) |
| Timeline bars | No pagination — all active BOM steps rendered; may cause slow rendering with many BOMs |
| Timeline scroll | `maxHeight: 500px` with overflow-auto container |
| Chart width | Dynamically calculated: `(totalMinutes + 30) * 3px`, minimum 600px |

---

## 9. Issues & Notes

### Bugs

1. **Collapsed rows have no visual effect** — `collapsedRows` state is maintained and `toggleRow` is wired to sidebar clicks, but no rendering logic uses the collapsed state. Rows always render at full height.

2. **Info alert uses wrong icon** — When `alert.type === 'info'`, the else branch renders `AlertTriangle` (amber icon) instead of a blue info icon. The `AlertCircle` is only used for `error`.

3. **Dashboard API has no authentication** — `GET /api/manufacturing/dashboard` performs no Supabase auth check, unlike most other manufacturing endpoints. Any unauthenticated request will receive full production data.

4. **Silent failure on manual refresh** — `fetchDashboard()` catches errors and only logs to console. User gets no visual feedback that the refresh failed.

5. **OEE includes idle machines in availability** — `availability = (running + idle) / total`. Including idle in the numerator inflates availability. Industry standard OEE typically measures only actual running time vs scheduled time.

### Inconsistencies

6. **Mixed language in labels** — Some labels are English ("In Progress", "Pass Rate", "Availability", "Performance", "Quality") while others are Bahasa ("Selesai", "Mesin Aktif", "Kecepatan produksi"). The CLAUDE.md states "Bahasa Indonesia first".

7. **Alert messages are in English** — "Machine Breakdown", "Quality Alert", "Maintenance Required" and their messages are all English despite being an Indonesian ERP.

8. **"Buat Order" links to orders list** — The primary CTA "BUAT ORDER" navigates to `/manufacturing/orders` (list page), not to a creation flow. This may confuse users expecting a create dialog.

9. **Two separate data flows** — The page uses both `useMfgDashboard` hook (for main data) and an inline `fetchDashboard` function (for refresh). Both hit the same endpoint but bypass each other's cache. The manual refresh updates local state but doesn't invalidate TanStack Query cache.

10. **`recentInspections` fetched but never displayed** — The dashboard API fetches 5 recent inspections, but the client component never renders inspection detail rows (only aggregate QC metrics).

### Missing Features

11. **No date range selector** — Dashboard always shows current month data. No way to view historical metrics.

12. **No drill-down from KPI cards** — Clicking OEE, Availability, Performance, or Quality cards does nothing. Expected: navigate to detailed view or filter.

13. **No auto-refresh** — Dashboard data is fetched once on mount. No polling interval for real-time monitoring despite the subtitle claiming "real-time".

14. **Timeline has no zoom controls** — Fixed `PIXELS_PER_MINUTE = 3`. Long production runs create very wide charts. No zoom in/out capability.
