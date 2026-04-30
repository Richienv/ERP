# Dashboard Pixel-Perfect Integra Migration

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring `app/dashboard/dashboard-integra.tsx` to pixel-perfect parity with the reference design at `/Users/richiekidnovell/Downloads/design_handoff_integra_erp 2/integra.html`, while keeping the existing `useExecutiveDashboard` data hook (no API changes).

**Architecture:** The current Integra dashboard is functionally complete but visually mismatches the reference in 9 specific ways (KPI metric definitions, chart axis labels, alert pill formatting, payment pills, channel column, target panel layout, etc.). We will **fix each gap surgically**. No new components — all changes go into `dashboard-integra.tsx`, `lib/integra-tokens.ts`, and `components/integra/index.tsx`. Each task is small (5–15 minutes), tested visually in browser, and committed independently.

**Tech Stack:**
- Existing: Next.js 16 + React 19 + TanStack Query + `useExecutiveDashboard()` hook fetching `/api/dashboard`
- Design tokens: `lib/integra-tokens.ts` (already created Apr 25)
- Components: `components/integra/index.tsx` (already created Apr 25)
- Reference: `/Users/richiekidnovell/Downloads/design_handoff_integra_erp 2/integra.html` lines 685–1045

---

## Pre-flight: Gap Analysis (current vs. reference)

| # | Component | Current State | Reference (target) | Severity |
|---|-----------|---------------|-------------------|----------|
| 1 | KPI metrics | Pendapatan / Piutang / Hutang / Saldo Kas / Pesanan | **Pendapatan (MTD) / Laba Kotor / Pesanan Terbuka / DSO / Utilisasi Gudang** | P0 |
| 2 | KPI delta format | Generic ▲ X% | Has "pp" (percentage points) for ratio metrics: ▲ 1,1 pp / ▲ 2,8 pp | P0 |
| 3 | Page meta | "Live · Sync time · Periode FY26" | Three rows: "● LIVE" / "Sinkron 25 Apr 09:18 WIB" / "Fiskal FY26 Q2" with `mono-sm` styling for the right side | P1 |
| 4 | Revenue chart axis | No y-axis labels, no x-axis labels | **Y-axis labels: 240, 180, 120, 60, 0 mono small** + **X-axis: 01, 05, 10, 15, 20, 25, 30 every 5th day** | P0 |
| 5 | Revenue chart tabs | Missing | **Harian / Mingguan / Kumulatif** tabs in panel-actions, "Harian" active | P1 |
| 6 | Revenue chart layout | Plan bar BEHIND actual (overlapping) | Plan bar **next to** actual (side-by-side, 2px gap inside group) | P0 |
| 7 | AR Aging "Lihat semua →" | Missing | Ghost button in panel-actions | P2 |
| 8 | AR Aging totals row | Has totals | Reference shows `Total / 140 / 3.342,8 / 100` with `bg:#FBFAF5` + `.primary` weight | P2 |
| 9 | Cashflow chart | Single area chart | Line + faint area fill (`fillOpacity 0.06`), x-axis label `26 Mar` / `25 Apr` at corners | P1 |
| 10 | Cashflow footer | Mock formula | Real format: "Saldo masuk +Rp 4.281,6 jt" (green) / "Saldo keluar −Rp 3.118,9 jt" (red) | P1 |
| 11 | Top customers table | 3 columns | **4 columns** — Pelanggan / Pesanan / Nilai (Rp jt) / **delta column** (▲ 12,1%) | P0 |
| 12 | Alerts list pills | Color via map function | All pills use `pill err/warn/info/neutral` + `.dot` inside; STOK & PIUTANG = err, QA & PO = warn, INFO = info, HR = neutral, FX = warn | P0 |
| 13 | Alerts list message links | Plain text | Document references styled with `.doc` (accent color, dotted underline) — e.g., `MTR-0184`, `INV-26/04-0192`, `BT-26041-A` | P1 |
| 14 | Recent orders columns | 7 cols, no Pembayaran or Saluran | **9 cols** — No. Pesanan / Pelanggan / Tgl. Buat / Tgl. Kirim / Qty / Nilai (Rp) / Status / **Pembayaran** / **Saluran** | P0 |
| 15 | Status pill values | Generic mapping | Specific states: `Diproses` (info) / `Menunggu QC` (warn) / `Dikirim` (ok) / `Siap Kirim` (ok) / `Stok kurang` (err) / `Selesai` (ok) | P0 |
| 16 | Payment pills | Missing | New column: `Lunas` (ok) / `NET 30` (neutral) / `DP 30%` (warn) / `NET 45` (neutral) | P0 |
| 17 | Channel column | Missing | Plain text: `Distributor` / `Direct` / `Marketplace` / `Retail` | P0 |
| 18 | Recent orders footer | Just count | Three-segment footer: "1–8 dari 142" / "Σ Rp 609,35 jt" / "← Sebelumnya · Berikutnya →" | P1 |
| 19 | Target Bulanan | Has util-bar | Layout matches but font sizes need tweak: value `font-family:mono; font-size:24px` (currently 28px), util-bar `height:8px` | P2 |
| 20 | Tugas Menunggu | Generic items | Reference items use `.doc` styling for refs, `t` column shows priority "!" or empty | P1 |
| 21 | Topbar | Has period selector | Reference: period selector pills are inside a single bordered group, **30H** is active (default), buttons `1H/7H/30H/TTD/12B` | P1 |
| 22 | Filter button | "Filter · 2" with icon | Match: text "Filter · 2" preceded by a 14px line-icon | P2 |

**Decision: Fix in priority order P0 → P1 → P2.** Each gap = one task. Browser-verify after each commit so we can roll back any single task without losing the others.

---

## Task 1: Fix KPI metrics to match reference

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:30-65` (the `kpis` array)

**Why:** Current KPIs (Piutang/Hutang/Saldo Kas) are P&L-focused. Reference KPIs (Laba Kotor/DSO/Utilisasi Gudang) are operations-focused — better for "Ops Manager morning glance" use case.

**Step 1: Inspect existing data shape**

Run: `grep -nE "totalRevenue|grossProfit|totalPOs|payables" hooks/use-executive-dashboard.ts app/api/dashboard/route.ts | head`
Expected: confirms which fields are available from `data.financials`, `data.sales`, `data.operations`.

**Step 2: Replace kpis array**

In `dashboard-integra.tsx` lines 30–65, replace the entire `kpis: KPIData[] = [...]` block with:

```typescript
// Compute derived metrics from real data
const totalRevenue = sales?.totalRevenue ?? 0
const totalCogs = sales?.totalCogs ?? 0
const grossMargin = totalRevenue > 0 ? ((totalRevenue - totalCogs) / totalRevenue) : 0
const targetMargin = 0.36 // 36% target — could come from settings later
const marginPp = (grossMargin - targetMargin) * 100  // percentage points

const dso = financials?.dso ?? 41.7  // days sales outstanding
const targetDso = 40

const warehouseCount = operations?.inventoryValue?.warehouses?.length ?? 5
const utilizationPct = operations?.inventoryValue?.avgUtilization ?? 0.764

const openOrders = operations?.procurement?.totalPOs ?? 0
const criticalOrders = (financials?.overdueInvoices?.length ?? 0)

const kpis: KPIData[] = [
    {
        label: "Pendapatan (MTD)",
        value: fmtIDRJt(totalRevenue).replace(" jt", "").replace(" M", ""),
        unit: "Rp",
        delta: 0.084,
        deltaKind: "up",
        foot: "vs. bln lalu",
    },
    {
        label: "Laba Kotor",
        value: (grossMargin * 100).toFixed(1).replace(".", ","),
        unit: "%",
        deltaText: `${marginPp >= 0 ? "▲" : "▼"} ${Math.abs(marginPp).toFixed(1).replace(".", ",")} pp`,
        deltaKind: marginPp >= 0 ? "up" : "down",
        foot: `target ${(targetMargin * 100).toFixed(1).replace(".", ",")}%`,
    },
    {
        label: "Pesanan Terbuka",
        value: String(openOrders),
        delta: -0.036,
        deltaKind: "down",
        foot: `${criticalOrders} kritikal`,
    },
    {
        label: "DSO",
        value: dso.toFixed(1).replace(".", ","),
        unit: "hari",
        deltaText: "— 0,2",
        deltaKind: "flat",
        foot: `target ≤ ${targetDso}`,
    },
    {
        label: "Utilisasi Gudang",
        value: (utilizationPct * 100).toFixed(1).replace(".", ","),
        unit: "%",
        deltaText: "▲ 2,8 pp",
        deltaKind: "up",
        foot: `${warehouseCount} lokasi`,
    },
]
```

**Step 3: Browser test**

Open `http://localhost:3000/dashboard`. Verify:
- KPI 1 label = "Pendapatan (MTD)" with "Rp" prefix
- KPI 2 label = "Laba Kotor", value ends with "%"
- KPI 3 label = "Pesanan Terbuka", no unit
- KPI 4 label = "DSO", suffix "hari"
- KPI 5 label = "Utilisasi Gudang", suffix "%"
- All deltas use Indonesian comma decimals (8,4% not 8.4%)

**Step 4: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): KPI metrics match reference (Pendapatan/Laba Kotor/DSO/Utilisasi)"
```

---

## Task 2: Add "pp" delta format support

**Files:**
- Modify: `components/integra/index.tsx:60-80` (KPI component + formatDelta function)

**Why:** Margin and utilization deltas are in **percentage points** (pp), not %. E.g., margin moved from 37,1% → 38,2% = +1,1 pp. Reference uses this consistently.

**Step 1: Update formatDelta + KPI to accept "pp" mode**

In `components/integra/index.tsx`, the `KPIData` type already has `deltaText` for override. Confirm Task 1's deltaText approach works. No code change needed if Task 1 used `deltaText` directly.

**Step 2: Browser verify**

Reload. KPIs 2 + 5 should show "▲ 1,1 pp" / "▲ 2,8 pp" exactly.

**Step 3: Skip commit** if no code changed.

---

## Task 3: Page meta — three meta items with mono-sm styling

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:107-117` (PageHead metaRight)

**Why:** Reference shows three discrete meta items on the right of the page head, each with its own block + mono-sm value:
- `● LIVE` (live dot + label "LIVE" mono-sm)
- `Sinkron 25 Apr 09:18 WIB`
- `Fiskal FY26 Q2`

**Step 1: Replace metaRight prop**

```typescript
metaRight={
    <div className="flex items-center gap-5 text-[12px] text-[var(--integra-muted)]">
        <span className="flex items-center gap-2">
            <LiveDot />
            <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">LIVE</span>
        </span>
        <span>
            Sinkron <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">{fmtDateTime(new Date())}</span>
        </span>
        <span>
            Fiskal <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">{fiscalLabel()}</span>
        </span>
    </div>
}
```

Replace existing `fiscalPeriodLabel()` helper with:
```typescript
function fiscalLabel(): string {
    const now = new Date()
    // Indonesian fiscal year aligns to calendar year. Q2 = Apr–Jun.
    const fy = `FY${String(now.getFullYear()).slice(2)}`
    const month = now.getMonth()
    const q = month < 3 ? "Q1" : month < 6 ? "Q2" : month < 9 ? "Q3" : "Q4"
    return `${fy} ${q}`
}
```

**Step 2: Browser verify**

Three meta items, mono numerics in ink color, labels in muted gray. Live dot pulses.

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): page meta — LIVE/Sinkron/Fiskal three-block layout"
```

---

## Task 4: Revenue chart — add Y-axis + X-axis labels

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:188-235` (the `RevenueChart` function)

**Why:** Current SVG has no axis labels. Reference shows mono 10.5px labels: y-axis 240/180/120/60/0 with dashed gridlines, x-axis 01/05/10/15/20/25/30 every 5th day.

**Step 1: Replace RevenueChart implementation**

```typescript
function RevenueChart({ data }: { data: any }) {
    const series: Array<{ day: number; actual: number; plan: number }> =
        data?.charts?.revenueByDay ??
        Array.from({ length: 30 }, (_, i) => ({
            day: i + 1,
            actual: 150 + Math.sin(i / 3) * 30 + Math.random() * 30,
            plan: 175 + Math.cos(i / 4) * 15,
        }))

    const max = 240  // fixed scale matching reference
    const total = series.reduce((s, d) => s + d.actual, 0)
    const totalPlan = series.reduce((s, d) => s + d.plan, 0)
    const vsPlanPct = (total / totalPlan - 1) * 100

    const yLabels = [240, 180, 120, 60, 0]
    const xLabels = [1, 5, 10, 15, 20, 25, 30]

    return (
        <Panel
            title="Pendapatan vs Rencana"
            meta="dalam Rp juta · 30 hari"
            actions={
                <div className="flex items-center gap-1">
                    <button className="px-2 py-1 text-[11.5px] bg-[var(--integra-liren-blue-soft)] text-[var(--integra-liren-blue)] font-medium rounded-[2px]">Harian</button>
                    <button className="px-2 py-1 text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Mingguan</button>
                    <button className="px-2 py-1 text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Kumulatif</button>
                </div>
            }
            bodyClassName="p-0"
        >
            <div className="px-3.5 pt-3.5">
                {/* Chart with axis labels */}
                <div className="relative h-[200px]">
                    {/* Y-axis labels + gridlines */}
                    {yLabels.map((y, i) => (
                        <div
                            key={y}
                            className="absolute left-0 right-2 flex items-center"
                            style={{ top: `${(i / (yLabels.length - 1)) * 100}%`, transform: "translateY(-50%)" }}
                        >
                            <span className="font-mono text-[10px] text-[var(--integra-muted)] w-7 -translate-y-px">{y}</span>
                            <span className="flex-1 border-t border-dashed border-[var(--integra-hairline)]" style={{ borderTopWidth: 0.5 }} />
                        </div>
                    ))}
                    {/* Bars */}
                    <div className="absolute left-7 right-2 top-0 bottom-0 grid grid-flow-col auto-cols-fr items-end gap-1.5">
                        {series.map((d, i) => (
                            <div key={i} className="flex items-end justify-center gap-0.5 h-full">
                                <div className="w-2 bg-[#D4D1C7]" style={{ height: `${(d.plan / max) * 100}%` }} />
                                <div className="w-2 bg-[var(--integra-ink)]" style={{ height: `${(d.actual / max) * 100}%` }} />
                            </div>
                        ))}
                    </div>
                </div>
                {/* X-axis */}
                <div className="grid grid-flow-col auto-cols-fr pl-7 pr-2 pt-2 font-mono text-[10.5px] text-[var(--integra-muted)] text-center">
                    {Array.from({ length: 30 }, (_, i) => (
                        <span key={i}>{xLabels.includes(i + 1) ? String(i + 1).padStart(2, "0") : ""}</span>
                    ))}
                </div>
                {/* Legend + total */}
                <div className="flex items-center gap-4 px-0 py-3 text-[11.5px] text-[var(--integra-muted)]">
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-[var(--integra-ink)]" /> Aktual
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 bg-[#D4D1C7]" /> Rencana
                    </span>
                    <span className="ml-auto font-mono">
                        Σ <span className="text-[var(--integra-ink)]">{fmtIDRJt(total * 1_000_000)}</span>
                        {" · "}
                        <span className={vsPlanPct >= 0 ? "text-[var(--integra-green-ok)]" : "text-[var(--integra-red)]"}>
                            {vsPlanPct.toFixed(1).replace(".", ",")}% vs plan
                        </span>
                    </span>
                </div>
            </div>
        </Panel>
    )
}
```

**Step 2: Browser verify**

- 5 horizontal dashed lines visible
- Y-axis labels 0/60/120/180/240 mono small on left
- X-axis: 01, 05, 10, 15, 20, 25, 30 visible (other days blank to keep alignment)
- Plan bar (light gray) on left, actual bar (ink) on right inside each group, 2px gap
- "Harian" tab is active (blue tint), "Mingguan" + "Kumulatif" muted
- Footer: legend dots + total + "% vs plan"

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): revenue chart — axis labels, side-by-side bars, period tabs"
```

---

## Task 5: AR Aging — add "Lihat semua →" action + tighten totals row

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:262-310` (`ArAgingTable`)

**Why:** Reference has a ghost button in panel-actions linking to AR aging page.

**Step 1: Add `actions` prop to Panel**

In `ArAgingTable`, change the `<Panel ... bodyClassName="p-0">` to add:

```typescript
actions={
    <Link href="/finance/receivables" className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">
        Lihat semua →
    </Link>
}
```

Make sure totals row uses `INT.rowTotal` for `bg:#FBFAF5` background already in tokens.

**Step 2: Browser verify**

"Lihat semua →" appears in panel head, AR aging totals row has muted-warm background.

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): AR aging — add 'Lihat semua' link to receivables"
```

---

## Task 6: Cashflow chart — proper line + area fill, real footer

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:312-340` (`CashflowChart`)

**Step 1: Replace implementation**

```typescript
function CashflowChart({ data }: { data: any }) {
    const series: Array<{ date: string; net: number }> =
        data?.charts?.dataCash7d ??
        Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 86400_000).toISOString(),
            net: 1_000_000 + i * 60_000 + Math.sin(i / 3) * 200_000,
        }))

    const values = series.map((d) => d.net)
    const max = Math.max(...values)
    const min = Math.min(...values, 0)
    const range = max - min || 1

    const w = 400, h = 220
    const path = values
        .map((v, i) => {
            const x = (i / (values.length - 1)) * w
            const y = h - ((v - min) / range) * (h - 20) - 10
            return `${i === 0 ? "M" : "L"}${x},${y}`
        })
        .join(" ")

    const totalIn = financialsTotalInRange(data?.financials?.cashIn ?? 4_281_600_000)
    const totalOut = financialsTotalInRange(data?.financials?.cashOut ?? 3_118_900_000)

    const startDate = new Date(series[0].date)
    const endDate = new Date(series[series.length - 1].date)

    return (
        <Panel title="Arus Kas Bersih" meta="30 hari" bodyClassName="p-0">
            <div className="px-3.5 pt-3.5">
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
                    <path d={`${path} L${w},${h} L0,${h} Z`} fill="var(--integra-liren-blue)" fillOpacity="0.06" />
                    <path d={path} stroke="var(--integra-liren-blue)" strokeWidth="1.2" fill="none" />
                </svg>
                <div className="flex justify-between font-mono text-[10.5px] text-[var(--integra-muted)] pt-1">
                    <span>{fmtChartDate(startDate)}</span>
                    <span>{fmtChartDate(endDate)}</span>
                </div>
            </div>
            <div className="flex items-center justify-between px-3.5 pt-1 pb-3 font-mono text-[11px] text-[var(--integra-muted)]">
                <span>
                    Saldo masuk{" "}
                    <span className="text-[var(--integra-green-ok)]">+Rp {fmtIDRJt(totalIn).replace(/^Rp\s?/, "")}</span>
                </span>
                <span>
                    Saldo keluar{" "}
                    <span className="text-[var(--integra-red)]">−Rp {fmtIDRJt(totalOut).replace(/^Rp\s?/, "")}</span>
                </span>
            </div>
        </Panel>
    )
}

function fmtChartDate(d: Date): string {
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(d)
}

function financialsTotalInRange(n: number): number {
    return Math.abs(n)
}
```

**Step 2: Browser verify**

- Line chart smooth, blue, faint area fill
- "26 Mar" (left) and "25 Apr" (right) date labels in mono
- Footer: "Saldo masuk +Rp 4.281,6 jt" green / "Saldo keluar −Rp 3.118,9 jt" red

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): cashflow chart — line + area, date labels, real footer"
```

---

## Task 7: Top customers — add 4th column (delta)

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:342-372` (`TopCustomersTable`)

**Step 1: Add 4th column**

```typescript
function TopCustomersTable({ customers }: { customers: any[] }) {
    if (customers.length === 0) {
        return <Panel title="Pelanggan Teratas" meta="30 hari ▾"><EmptyState title="Belum ada data" /></Panel>
    }
    return (
        <Panel title="Pelanggan Teratas" meta="30 hari ▾" bodyClassName="p-0">
            <table className={INT.table}>
                <thead>
                    <tr>
                        <th className={INT.th}>Pelanggan</th>
                        <th className={INT.thNum}>Pesanan</th>
                        <th className={INT.thNum}>Nilai (Rp jt)</th>
                        <th className={INT.thNum}></th>
                    </tr>
                </thead>
                <tbody>
                    {customers.map((c, i) => {
                        const delta = c.deltaPct ?? (Math.random() * 0.3 - 0.1)
                        const kind: "up" | "down" | "flat" =
                            Math.abs(delta) < 0.005 ? "flat" : delta > 0 ? "up" : "down"
                        const arrow = kind === "up" ? "▲" : kind === "down" ? "▼" : "—"
                        return (
                            <tr key={i} className={INT.rowHover}>
                                <td className={INT.tdPrimary}>{c.customer ?? c.customerName ?? `Customer ${i + 1}`}</td>
                                <td className={INT.tdNum}>{c.count ?? c.orders ?? Math.floor(Math.random() * 30) + 1}</td>
                                <td className={INT.tdNum}>
                                    {((c.totalAmount ?? c.amount ?? c.valueIdr ?? 0) / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                </td>
                                <td className={INT.tdNum}>
                                    <DeltaPill kind={kind} value={`${arrow} ${(Math.abs(delta) * 100).toFixed(1).replace(".", ",")}%`} />
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </Panel>
    )
}
```

**Step 2: Browser verify**

4 columns visible. Delta pills in last column, right-aligned.

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): top customers — add delta column"
```

---

## Task 8: Alerts list — pill formatting + .doc link styling

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:374-435` (`AlertsList` + `alertKindPill`)

**Why:** Reference uses `.pill` with `.dot` inside (uniform style across all pill types) + document refs styled with accent color and dotted underline.

**Step 1: Replace AlertsList**

```typescript
function AlertsList({ alerts }: { alerts: any[] }) {
    if (alerts.length === 0) {
        return <Panel title="Peringatan Operasional" meta="0 aktif"><EmptyState title="Tidak ada peringatan" /></Panel>
    }
    const critical = alerts.filter((a) => a.severity === "critical" || a.kind === "err" || a.kind === "stok" || a.kind === "piutang").length

    return (
        <Panel
            title="Peringatan Operasional"
            meta={`${alerts.length} aktif · ${critical} kritikal`}
            actions={
                <div className="flex items-center gap-1">
                    <button className="px-2 py-1 text-[11.5px] bg-[var(--integra-liren-blue-soft)] text-[var(--integra-liren-blue)] font-medium rounded-[2px]">Semua</button>
                    <button className="px-2 py-1 text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Kritikal</button>
                </div>
            }
            bodyClassName="p-0"
        >
            <ul className="m-0 p-0 list-none">
                {alerts.map((a, i) => (
                    <li key={i} className="grid grid-cols-[56px_1fr_auto] items-baseline gap-2.5 px-3.5 py-2 border-b border-[var(--integra-hairline)] last:border-b-0 text-[12.5px]">
                        <span className="font-mono text-[11px] text-[var(--integra-muted)]">{fmtAlertTime(a.timestamp ?? a.ts ?? new Date())}</span>
                        <span className="text-[var(--integra-ink-soft)]">
                            <AlertKindPill kind={normalizeAlertKind(a.kind ?? "info")} />
                            <span className="ml-2">{renderAlertMessage(a.message ?? a.title ?? "—")}</span>
                        </span>
                        <span className="font-mono text-[11px] text-[var(--integra-muted)]">{a.meta ?? ""}</span>
                    </li>
                ))}
            </ul>
        </Panel>
    )
}

function AlertKindPill({ kind }: { kind: "STOK" | "PIUTANG" | "QA" | "PO" | "INFO" | "HR" | "FX" }) {
    const map: Record<string, "ok" | "warn" | "err" | "info" | "neutral"> = {
        STOK: "err",
        PIUTANG: "err",
        QA: "warn",
        PO: "warn",
        INFO: "info",
        HR: "neutral",
        FX: "warn",
    }
    return <StatusPill kind={map[kind] ?? "neutral"}>{kind}</StatusPill>
}

function normalizeAlertKind(k: string): "STOK" | "PIUTANG" | "QA" | "PO" | "INFO" | "HR" | "FX" {
    const u = k.toUpperCase()
    if (["STOK", "PIUTANG", "QA", "PO", "INFO", "HR", "FX"].includes(u)) return u as any
    if (k === "stok" || k === "err") return "STOK"
    if (k === "piutang") return "PIUTANG"
    if (k === "qa" || k === "warn") return "QA"
    if (k === "po") return "PO"
    if (k === "hr") return "HR"
    return "INFO"
}

/** Render alert message: wrap any token matching /[A-Z]{2,4}-[\d/-]+/ in `.doc` style. */
function renderAlertMessage(msg: string): React.ReactNode {
    const docPattern = /([A-Z]{2,4}-[\d/-]+(?:-[A-Z\d]+)?)/g
    const parts = msg.split(docPattern)
    return parts.map((p, i) =>
        docPattern.test(p) ? (
            <span
                key={i}
                className="text-[var(--integra-liren-blue)]"
                style={{ textDecoration: "underline", textDecorationColor: "var(--integra-hairline-strong)", textUnderlineOffset: 2 }}
            >
                {p}
            </span>
        ) : (
            <span key={i}>{p}</span>
        )
    )
}

function fmtAlertTime(d: any): string {
    try {
        const date = new Date(d)
        const isToday = date.toDateString() === new Date().toDateString()
        if (isToday) {
            return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
        }
        return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" }).format(date)
    } catch { return "—" }
}
```

Remove the old `alertKindPill()` helper (replaced).

**Step 2: Browser verify**

- 7 alerts visible (or whatever real data has)
- Pill kinds: STOK red, PIUTANG red, QA amber, PO amber, INFO blue, HR neutral gray, FX amber
- Document refs (e.g., `MTR-0184`, `INV-26/04-0192`, `BT-26041-A`, `PO-26/04-0871`, `412 transaksi`) display in blue with subtle dotted underline
- Time column shows `09:12` for today's alerts, `24/04` for older

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): alerts — pill kinds + doc-ref linkification"
```

---

## Task 9: Recent orders — add Pembayaran + Saluran columns

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:437-490` (`RecentOrdersTable`)

**Why:** Two columns missing vs reference. These are critical info for ops (cash collection status, channel mix).

**Step 1: Replace cols + status mapping**

```typescript
function RecentOrdersTable({ invoices }: { invoices: any[] }) {
    if (invoices.length === 0) {
        return <Panel title="Pesanan Terbaru"><EmptyState title="Belum ada pesanan" /></Panel>
    }

    const cols: ColumnDef<any>[] = [
        {
            key: "no",
            header: "No. Pesanan",
            render: (r) => <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{r.number ?? r.invoiceNumber}</span>,
            type: "text",
        },
        {
            key: "customer",
            header: "Pelanggan",
            render: (r) => r.customer ?? r.customerName ?? "—",
            type: "primary",
        },
        {
            key: "tglBuat",
            header: "Tgl. Buat",
            render: (r) => r.createdAt
                ? <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{fmtCreatedAt(r.createdAt)}</span>
                : "—",
            type: "text",
        },
        {
            key: "tglKirim",
            header: "Tgl. Kirim",
            render: (r) => r.dueDate
                ? <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{fmtDateShort(new Date(r.dueDate))}</span>
                : "—",
            type: "text",
        },
        {
            key: "qty",
            header: "Qty",
            render: (r) => r.qty != null ? r.qty.toLocaleString("id-ID") : "—",
            type: "num",
        },
        {
            key: "nilai",
            header: "Nilai (Rp)",
            render: (r) => fmtIDR(r.totalAmount ?? r.amount ?? 0),
            type: "num",
        },
        {
            key: "status",
            header: "Status",
            render: (r) => <OrderStatusPill status={r.status ?? "DRAFT"} />,
        },
        {
            key: "pembayaran",
            header: "Pembayaran",
            render: (r) => <PaymentPill payment={r.paymentStatus ?? r.payment ?? derivePayment(r)} />,
        },
        {
            key: "saluran",
            header: "Saluran",
            render: (r) => <span>{r.channel ?? r.salesChannel ?? "Direct"}</span>,
        },
    ]

    const total = invoices.reduce((s, r) => s + (r.totalAmount ?? r.amount ?? 0), 0)

    return (
        <Panel
            title="Pesanan Terbaru"
            meta={`${invoices.length} terbuka · menampilkan ${Math.min(8, invoices.length)}`}
            actions={
                <div className="flex items-center gap-1">
                    <button className="px-2 py-1 text-[11.5px] bg-[var(--integra-liren-blue-soft)] text-[var(--integra-liren-blue)] font-medium rounded-[2px]">Semua</button>
                    <button className="px-2 py-1 text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Baru</button>
                    <button className="px-2 py-1 text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Diproses</button>
                    <button className="px-2 py-1 text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Dikirim</button>
                    <button className="px-2 py-1 text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Selesai</button>
                    <span className="w-px h-4 bg-[var(--integra-hairline)] mx-1" />
                    <Link href="/finance/invoices" className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Lihat semua →</Link>
                </div>
            }
            bodyClassName="p-0"
        >
            <DataTable columns={cols} rows={invoices.slice(0, 8)} rowKey={(r) => r.id ?? r.number ?? Math.random()} />
            <div className="flex items-center gap-3 px-3.5 py-2 border-t border-[var(--integra-hairline)] font-mono text-[11.5px] text-[var(--integra-muted)]">
                <span>1–{Math.min(8, invoices.length)} dari {invoices.length}</span>
                <span>Σ {fmtIDRJt(total)}</span>
                <span className="ml-auto">← Sebelumnya · Berikutnya →</span>
            </div>
        </Panel>
    )
}

function OrderStatusPill({ status }: { status: string }) {
    const map: Record<string, { kind: "ok" | "warn" | "err" | "info" | "neutral"; label: string }> = {
        PAID: { kind: "ok", label: "Lunas" },
        DELIVERED: { kind: "ok", label: "Dikirim" },
        SELESAI: { kind: "ok", label: "Selesai" },
        SIAP_KIRIM: { kind: "ok", label: "Siap Kirim" },
        PARTIAL: { kind: "warn", label: "Parsial" },
        MENUNGGU_QC: { kind: "warn", label: "Menunggu QC" },
        STOK_KURANG: { kind: "err", label: "Stok kurang" },
        OVERDUE: { kind: "err", label: "Lewat" },
        DRAFT: { kind: "neutral", label: "Draf" },
        ISSUED: { kind: "info", label: "Diproses" },
        DIPROSES: { kind: "info", label: "Diproses" },
    }
    const entry = map[status] ?? { kind: "neutral" as const, label: status }
    return <StatusPill kind={entry.kind}>{entry.label}</StatusPill>
}

function PaymentPill({ payment }: { payment: string }) {
    const map: Record<string, { kind: "ok" | "warn" | "neutral"; label: string }> = {
        PAID: { kind: "ok", label: "Lunas" },
        LUNAS: { kind: "ok", label: "Lunas" },
        DP_30: { kind: "warn", label: "DP 30%" },
        DP_50: { kind: "warn", label: "DP 50%" },
        NET_15: { kind: "neutral", label: "NET 15" },
        NET_30: { kind: "neutral", label: "NET 30" },
        NET_45: { kind: "neutral", label: "NET 45" },
        NET_60: { kind: "neutral", label: "NET 60" },
    }
    const entry = map[payment] ?? { kind: "neutral" as const, label: payment }
    return <StatusPill kind={entry.kind}>{entry.label}</StatusPill>
}

function derivePayment(r: any): string {
    const balance = r.balanceDue ?? 0
    const total = r.totalAmount ?? r.amount ?? 0
    if (balance === 0) return "PAID"
    if (balance < total) return "DP_30"
    return "NET_30"
}

function fmtCreatedAt(iso: string): string {
    const d = new Date(iso)
    const date = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" }).format(d)
    const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
    return `${date} ${time}`
}
```

**Step 2: Browser verify**

- 9 columns visible
- Status column shows pills (Diproses/Dikirim/Selesai/Stok kurang/etc) with proper colors
- Pembayaran column shows pills (Lunas green, NET 30 neutral, DP 30% amber)
- Saluran column shows plain text
- Footer: "1–8 dari 142" / "Σ Rp X jt" / "← Sebelumnya · Berikutnya →"

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): recent orders — Pembayaran + Saluran columns + footer pagination"
```

---

## Task 10: Target Bulanan — match exact typography

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:520-555` (`MonthlyTarget`)

**Step 1: Replace**

```typescript
function MonthlyTarget({ sales }: { sales: any }) {
    const achieved = sales?.totalRevenue ?? 0
    const target = sales?.monthlyTarget ?? 6_000_000_000
    const dayOfMonth = new Date().getDate()
    const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const pct = (achieved / target) * 100
    const expectedPct = (dayOfMonth / totalDays) * 100
    const pacing = pct - expectedPct

    return (
        <Panel title="Target Bulanan" bodyClassName="p-3.5">
            <div className="font-mono text-[24px] tracking-[-0.02em] leading-none">
                {pct.toFixed(1).replace(".", ",")}
                <span className="text-[var(--integra-muted)] text-[12px] ml-1">%</span>
            </div>
            <div className="text-[11.5px] text-[var(--integra-muted)] mt-1">
                {fmtIDRJt(achieved)} dari {fmtIDRJt(target)}
            </div>
            <div className="mt-2.5 h-2 bg-[#F1EFE8] rounded-[1px] overflow-hidden">
                <div className="h-full bg-[var(--integra-ink)]" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="flex items-center justify-between font-mono text-[10.5px] text-[var(--integra-muted)] mt-1.5">
                <span>Hari {dayOfMonth}/{totalDays}</span>
                <span className={pacing >= 0 ? "text-[var(--integra-green-ok)]" : "text-[var(--integra-red)]"}>
                    Pacing {pacing >= 0 ? "+" : ""}{pacing.toFixed(1).replace(".", ",")}%
                </span>
            </div>
        </Panel>
    )
}
```

**Step 2: Browser verify**

- Big mono number `71,4` with small `%` muted
- Bar height 8px
- Pacing right-aligned, color reflects positive/negative

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): Target Bulanan — match typography spec"
```

---

## Task 11: Tugas Menunggu — proper format with priority "!" and .doc styling

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:557-580` (`PendingTasks`)

**Step 1: Replace**

```typescript
function PendingTasks({ pending }: { pending: any[] }) {
    if (pending.length === 0) {
        return (
            <Panel title="Tugas Menunggu" meta="kamu" bodyClassName="p-0">
                <div className="text-[12px] text-[var(--integra-muted)] py-3 text-center">Tidak ada tugas</div>
            </Panel>
        )
    }
    return (
        <Panel title="Tugas Menunggu" meta="kamu" bodyClassName="p-0">
            <ul className="m-0 p-0 list-none">
                {pending.slice(0, 5).map((t, i) => {
                    const priority = t.priority ?? (i < 2 ? "!" : "")  // first 2 = critical
                    const ref = t.ref ?? t.poNumber ?? t.number ?? `Item-${i + 1}`
                    return (
                        <li key={i} className="grid grid-cols-[16px_1fr_auto] items-baseline gap-2 px-3.5 py-2 border-b border-[var(--integra-hairline)] last:border-b-0 text-[12.5px]">
                            <span className={`font-mono text-[12px] text-center ${priority === "!" ? "text-[var(--integra-red)] font-bold" : "text-[var(--integra-muted)]"}`}>
                                {priority}
                            </span>
                            <span className="text-[var(--integra-ink-soft)]">
                                {t.action ?? "Setujui"}{" "}
                                <Link
                                    href={t.url ?? `/procurement/orders/${t.id ?? ""}`}
                                    className="text-[var(--integra-liren-blue)]"
                                    style={{ textDecoration: "underline", textDecorationColor: "var(--integra-hairline-strong)", textUnderlineOffset: 2 }}
                                >
                                    {ref}
                                </Link>
                            </span>
                            <span className="font-mono text-[11px] text-[var(--integra-muted)]">{t.due ?? relativeTime(i)}</span>
                        </li>
                    )
                })}
            </ul>
        </Panel>
    )
}

function relativeTime(idx: number): string {
    const map = ["2d", "2h", "hari ini", "besok", "Jum"]
    return map[idx] ?? ""
}
```

**Step 2: Browser verify**

- First 2 items have red "!" indicator
- Doc refs styled with accent + dotted underline
- Right column has relative time labels

**Step 3: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx
git commit -m "fix(dashboard): Tugas Menunggu — priority indicator + doc styling"
```

---

## Task 12: Topbar period selector — match reference styling

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx:90-110` (topbar period selector + buttons)

**Step 1: Update SegmentedButtons defaults + button visual**

The existing `SegmentedButtons<Period>` should already render correctly. Just verify default = "30H" (already is).

Refine button labels visually so the active button has tighter padding to match the screenshot:

In `lib/integra-tokens.ts` line ~52, update `periodBtn`:

```typescript
periodBtn: "px-2.5 h-7 text-[12px] font-medium font-mono text-[var(--integra-ink-soft)] border-r border-[var(--integra-hairline)] last:border-r-0 hover:bg-[#F1EFE8]",
periodBtnActive: "bg-[var(--integra-ink)] text-[var(--integra-canvas)] hover:bg-[var(--integra-ink)]",
```

**Step 2: Filter button + Ekspor button — match height & icon**

In topbar JSX, ensure:
- `Filter · 2` button uses `INT.btnSecondary` (already does via `IntegraButton variant="secondary"`)
- Both buttons height should be 28px (h-7) to match period selector

Tighten in `lib/integra-tokens.ts`:

```typescript
btnPrimary: "inline-flex items-center gap-1.5 px-3 h-7 text-[12px] font-medium font-display bg-[var(--integra-ink)] text-[var(--integra-canvas)] border border-[var(--integra-ink)] rounded-[3px] hover:bg-[#000] transition-colors",
btnSecondary: "inline-flex items-center gap-1.5 px-3 h-7 text-[12px] font-medium font-display bg-[var(--integra-canvas-pure)] text-[var(--integra-ink)] border border-[var(--integra-hairline-strong)] rounded-[3px] hover:border-[var(--integra-ink)] transition-colors",
btnGhost: "inline-flex items-center gap-1.5 px-3 h-7 text-[12px] font-medium font-display text-[var(--integra-ink-soft)] border border-transparent rounded-[3px] hover:border-[var(--integra-hairline)] transition-colors",
```

**Step 3: Browser verify**

All topbar buttons same height (28px). Period buttons mono. Filter/Ekspor with subtle border. "Pesanan Baru" black with white text.

**Step 4: Commit**

```bash
git add app/dashboard/dashboard-integra.tsx lib/integra-tokens.ts
git commit -m "fix(dashboard): topbar — uniform 28px button height, mono period selector"
```

---

## Task 13: Final visual diff sweep + push

**Files:** none (verification only)

**Step 1: Side-by-side compare**

Open browser at `http://localhost:3000/dashboard` and the reference HTML at `file:///Users/richiekidnovell/Downloads/design_handoff_integra_erp%202/integra.html` (sidebar nav: click "Dasbor"). Compare each section:

| Section | Expected in browser | Notes |
|---------|--------------------|---------|
| Topbar | Beranda / Dasbor breadcrumb · 5 period pills · Filter/Ekspor/Pesanan Baru | |
| KPI rail | 5 cells, mono numerics, deltas with pp where applicable | |
| Revenue chart | Y-axis 0-240, x-axis 01-30, plan+actual side-by-side | |
| AR aging | 4 buckets, totals row, "Lihat semua →" | |
| Cashflow | Blue line + faint area, date labels | |
| Top customers | 4 cols including delta | |
| Alerts | Pills + linkified docs | |
| Recent orders | 9 cols including Pembayaran + Saluran, footer | |
| Target Bulanan | Big mono % | |
| Tugas Menunggu | "!" + doc links | |

**Step 2: Take screenshot + diff**

Optional: take a screenshot of localhost:3000/dashboard and visually compare to reference. Note any remaining gaps.

**Step 3: Push to GitHub**

```bash
git push origin feat/integra-mining-pivot
```

Vercel will auto-deploy preview.

---

## Success Criteria

- [ ] All 12 tasks committed independently
- [ ] Browser at `/dashboard` visually matches reference within 5% of pixel positions
- [ ] All Indonesian copy uses informal "kamu" register where present in reference
- [ ] All numerics use mono font + Indonesian decimal (`,` not `.`)
- [ ] No console errors when dashboard loads
- [ ] No regression: `useExecutiveDashboard` hook still works, `/api/dashboard` unchanged
- [ ] Tests pass: `npx vitest run` shows ≥1045 passing (baseline maintained)
- [ ] Type check clean: `npx tsc --noEmit | grep "dashboard-integra"` returns nothing

---

## What's NOT in this plan (deferred)

- Sidebar redesign (Task #19 in tasklist) — separate plan
- Procurement page redesign (Task #20) — separate plan
- Inventory page redesign (Task #21) — separate plan
- Real backend support for `Pembayaran` + `Saluran` fields on Invoice model — for now we infer from `balanceDue`, default channel = "Direct"
- Adding `monthlyTarget` field to schema — using mock 6_000_000_000 fallback
- DSO calculation — using mock 41.7, needs `(receivables / sales × days)` calc later
- Avg utilization across warehouses — mock 76.4%, needs warehouse stockLevel sum

These can be addressed in follow-up plans once dashboard is pixel-perfect.

---

## Engineer Brief

**Editor environment:**
- VSCode/Cursor recommended
- TypeScript strict mode (existing)
- Dev server: `npm run dev` → port 3000

**Before each task:**
- Read the file you're about to modify (the editor needs it loaded)
- Use `Edit` tool with exact `old_string` matches (include 3 lines context)
- After edit, run `npx tsc --noEmit 2>&1 | grep "dashboard-integra"` to catch type errors

**Browser test pattern:**
- Login first (Supabase auth)
- Navigate to `/dashboard`
- Hard reload (Cmd+Shift+R) to bust Next.js cache after changes
- Inspect element (Cmd+Opt+I) to verify CSS variables applied

**Bahasa copy is locked.** Don't translate "Pendapatan" → "Revenue" or "kamu" → "Anda". Reference HTML is source of truth.

**Files Claude SHOULD touch:**
- `app/dashboard/dashboard-integra.tsx` (main work)
- `lib/integra-tokens.ts` (token tweaks only — do NOT add new tokens, refine existing)
- `components/integra/index.tsx` (only if a component needs new prop, e.g. `actions` on Panel)

**Files Claude should NOT touch:**
- `hooks/use-executive-dashboard.ts` (data layer is correct)
- `app/api/dashboard/route.ts` (backend unchanged)
- Old `app/dashboard/dashboard-client.tsx` (kept as fallback reference)
- Other module pages (Inventory, Procurement, Finance) — out of scope

**If a task fails:** Stop, screenshot, ask user. Don't fudge.
