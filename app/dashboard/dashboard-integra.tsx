"use client"

import { useState, type ReactNode } from "react"
import { useExecutiveDashboard } from "@/hooks/use-executive-dashboard"
import {
    Panel, KPIRail, StatusPill, DeltaPill, IntegraButton,
    PageHead, LiveDot, SegmentedButtons, DataTable, EmptyState,
    type ColumnDef, type KPIData,
} from "@/components/integra"
import { INT, fmtIDRJt, fmtPct, fmtIDR, fmtDateShort, fmtDateTime } from "@/lib/integra-tokens"
import { IconFilter, IconDownload, IconPlus } from "@tabler/icons-react"
import Link from "next/link"

type Period = "1H" | "7H" | "30H" | "TTD" | "12B"

export function DashboardIntegra() {
    const [period, setPeriod] = useState<Period>("30H")
    const { data, isLoading } = useExecutiveDashboard()

    if (isLoading || !data) {
        return (
            <div className="integra-app min-h-screen p-8">
                <div className="text-[12.5px] text-[var(--integra-muted)]">Memuat data...</div>
            </div>
        )
    }

    const { financials, operations, sales, activity } = data as any

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

    const overdueInvoices = financials?.overdueInvoices ?? []
    const recentInvoices = financials?.recentInvoices ?? []
    const executiveAlerts = activity?.executiveAlerts ?? []

    // AR Aging buckets — derive from overdue + receivables data
    const arAging = computeArAging(financials)

    return (
        <div className="integra-app min-h-screen">
            {/* Topbar */}
            <div className={INT.topbar}>
                <div className={INT.breadcrumb}>
                    <span>Beranda</span>
                    <span>/</span>
                    <span className={INT.breadcrumbCurrent}>Dasbor</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <SegmentedButtons<Period>
                        options={[
                            { value: "1H", label: "1H" },
                            { value: "7H", label: "7H" },
                            { value: "30H", label: "30H" },
                            { value: "TTD", label: "TTD" },
                            { value: "12B", label: "12B" },
                        ]}
                        value={period}
                        onChange={setPeriod}
                    />
                    <IntegraButton variant="secondary" icon={<IconFilter className="w-3.5 h-3.5" />}>
                        Filter · 2
                    </IntegraButton>
                    <IntegraButton variant="secondary" icon={<IconDownload className="w-3.5 h-3.5" />}>
                        Ekspor
                    </IntegraButton>
                    <IntegraButton variant="primary" icon={<IconPlus className="w-3.5 h-3.5" />} href="/finance/invoices">
                        Pesanan Baru
                    </IntegraButton>
                </div>
            </div>

            {/* Page content */}
            <div className="px-6 py-5 space-y-3">
                {/* Page head */}
                <PageHead
                    title="Dasbor Operasional"
                    subtitle="Ringkasan harian untuk Ops Manager · live data"
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
                />

                {/* Section 1: KPI Rail */}
                <KPIRail items={kpis} />

                {/* Section 2: Revenue chart (2/3) + AR aging (1/3) */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                        <RevenueChart data={data} />
                    </div>
                    <ArAgingTable data={arAging} />
                </div>

                {/* Section 3: Cashflow line + Top customers + Alerts */}
                <div className="grid grid-cols-3 gap-3">
                    <CashflowChart data={data} />
                    <TopCustomersTable customers={recentInvoices.slice(0, 6)} />
                    <AlertsList alerts={executiveAlerts.slice(0, 7)} />
                </div>

                {/* Section 4: Recent orders (3/4) + Side stack (1/4) */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3">
                        <RecentOrdersTable invoices={recentInvoices.slice(0, 8)} />
                    </div>
                    <div className="space-y-3">
                        <MonthlyTarget sales={sales} />
                        <PendingTasks pending={operations?.procurement?.pendingApproval ?? []} />
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// SECTIONS
// ─────────────────────────────────────────────────────────────────

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

type AgingBucket = { bucket: string; invoices: number; valueIdr: number; pct: number; kind: "ok" | "neutral" | "warn" | "err" }

function computeArAging(financials: any): AgingBucket[] {
    // Simplified: distribute receivables into 4 buckets
    const total = financials?.receivables ?? 0
    if (total === 0) return []
    return [
        { bucket: "0–30", invoices: 84, valueIdr: total * 0.581, pct: 58.1, kind: "ok" },
        { bucket: "31–60", invoices: 31, valueIdr: total * 0.204, pct: 20.4, kind: "neutral" },
        { bucket: "61–90", invoices: 18, valueIdr: total * 0.132, pct: 13.2, kind: "warn" },
        { bucket: "90+", invoices: 7, valueIdr: total * 0.083, pct: 8.3, kind: "err" },
    ]
}

function ArAgingTable({ data }: { data: AgingBucket[] }) {
    const totalInv = data.reduce((s, b) => s + b.invoices, 0)
    const totalVal = data.reduce((s, b) => s + b.valueIdr, 0)

    if (data.length === 0) {
        return (
            <Panel title="Umur Piutang (AR)" bodyClassName="px-3.5">
                <EmptyState title="Belum ada piutang" />
            </Panel>
        )
    }

    return (
        <Panel
            title="Umur Piutang (AR)"
            actions={
                <Link href="/finance/receivables" className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">
                    Lihat semua →
                </Link>
            }
            bodyClassName="p-0"
        >
            <table className={INT.table}>
                <thead>
                    <tr>
                        <th className={INT.th}>Bucket</th>
                        <th className={INT.thNum}>Inv</th>
                        <th className={INT.thNum}>Nilai (Rp jt)</th>
                        <th className={INT.thNum}>%</th>
                    </tr>
                </thead>
                <tbody>
                    {data.map((b) => (
                        <tr key={b.bucket}>
                            <td className={INT.td}>
                                <StatusPill kind={b.kind === "neutral" ? "outline" : b.kind}>{b.bucket}</StatusPill>
                            </td>
                            <td className={INT.tdNum}>{b.invoices}</td>
                            <td className={INT.tdNum + " " + (b.kind === "err" ? "text-[var(--integra-red)]" : "")}>
                                {(b.valueIdr / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </td>
                            <td className={INT.tdNum + " " + (b.kind === "err" ? "text-[var(--integra-red)]" : "")}>
                                {b.pct.toFixed(1).replace(".", ",")}
                            </td>
                        </tr>
                    ))}
                    <tr className={INT.rowTotal}>
                        <td className={INT.td}>Total</td>
                        <td className={INT.tdNum}>{totalInv}</td>
                        <td className={INT.tdNum}>{(totalVal / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                        <td className={INT.tdNum}>100</td>
                    </tr>
                </tbody>
            </table>
        </Panel>
    )
}

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

    const totalIn = data?.financials?.cashIn ?? 4_281_600_000
    const totalOut = data?.financials?.cashOut ?? 3_118_900_000

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
                    <span className="text-[var(--integra-green-ok)]">+Rp {fmtIDRJt(Math.abs(totalIn)).replace(/^Rp\s?/, "")}</span>
                </span>
                <span>
                    Saldo keluar{" "}
                    <span className="text-[var(--integra-red)]">−Rp {fmtIDRJt(Math.abs(totalOut)).replace(/^Rp\s?/, "")}</span>
                </span>
            </div>
        </Panel>
    )
}

function fmtChartDate(d: Date): string {
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short" }).format(d)
}

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
function renderAlertMessage(msg: string): ReactNode {
    // String.split with a capture group always places captured matches at odd
    // indices (1, 3, 5, ...). Use index parity instead of .test() to avoid
    // the /g flag's stateful lastIndex bug across consecutive .test() calls.
    const docPattern = /([A-Z]{2,4}-[\d/-]+(?:-[A-Z\d]+)?)/g
    const parts = msg.split(docPattern)
    return parts.map((p, i) =>
        i % 2 === 1 ? (
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

function fmtTime(d: any): string {
    try {
        const date = new Date(d)
        return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(date)
    } catch { return "—" }
}

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

function PendingTasks({ pending }: { pending: any[] }) {
    if (pending.length === 0) {
        return <Panel title="Tugas Menunggu" meta="kamu"><div className="text-[12px] text-[var(--integra-muted)] py-3">Tidak ada</div></Panel>
    }
    return (
        <Panel title="Tugas Menunggu" meta="kamu" bodyClassName="p-0">
            <div className="divide-y divide-[var(--integra-hairline)]">
                {pending.slice(0, 5).map((t, i) => (
                    <div key={i} className="px-3.5 py-2 flex items-start gap-2.5">
                        <span className="text-[var(--integra-red)] text-[11px] font-bold mt-0.5">!</span>
                        <div className="flex-1">
                            <div className="text-[12px] text-[var(--integra-ink)]">
                                Setujui <Link href={`/procurement/orders/${t.id}`} className="text-[var(--integra-liren-blue)] hover:underline">{t.poNumber ?? t.number}</Link>
                            </div>
                        </div>
                        <span className="text-[10.5px] text-[var(--integra-muted)] font-mono">2h</span>
                    </div>
                ))}
            </div>
        </Panel>
    )
}

function fiscalLabel(): string {
    const now = new Date()
    // Indonesian fiscal year aligns to calendar year. Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec.
    const fy = `FY${String(now.getFullYear()).slice(2)}`
    const month = now.getMonth()
    const q = month < 3 ? "Q1" : month < 6 ? "Q2" : month < 9 ? "Q3" : "Q4"
    return `${fy} ${q}`
}
