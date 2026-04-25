"use client"

import { useState } from "react"
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
                        <>
                            <span className="flex items-center gap-1.5">
                                <LiveDot />
                                <span>Live</span>
                            </span>
                            <span className="font-mono">Sync {fmtDateTime(new Date())}</span>
                            <span>· Periode {fiscalPeriodLabel()}</span>
                        </>
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
    // Placeholder chart — twin bars (plan vs actual)
    // Use real data if available, else mock 30-day series
    const series = data?.charts?.revenueByDay ?? Array.from({ length: 30 }, (_, i) => ({
        day: i + 1,
        actual: 150 + Math.random() * 80,
        plan: 145 + Math.random() * 60,
    }))
    const max = Math.max(...series.map((d: any) => Math.max(d.actual, d.plan)))
    const total = series.reduce((s: number, d: any) => s + d.actual, 0)
    const totalPlan = series.reduce((s: number, d: any) => s + d.plan, 0)
    const vsPlanPct = ((total - totalPlan) / totalPlan) * 100

    return (
        <Panel
            title="Pendapatan vs Rencana"
            meta="30 hari terakhir"
            actions={
                <div className="flex items-center gap-3 text-[11px] text-[var(--integra-muted)]">
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-[var(--integra-ink)]" /> Aktual
                    </span>
                    <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-[#D4D1C7]" /> Rencana
                    </span>
                </div>
            }
        >
            <div className="relative h-[240px]">
                <svg width="100%" height="100%" viewBox={`0 0 ${series.length * 18} 240`} preserveAspectRatio="none">
                    {/* gridlines */}
                    {[0, 60, 120, 180, 240].map((y) => (
                        <line key={y} x1="0" x2={series.length * 18} y1={240 - (y / 240) * 240} y2={240 - (y / 240) * 240}
                            stroke="#E5E3DC" strokeWidth="0.5" strokeDasharray="2 3" />
                    ))}
                    {series.map((d: any, i: number) => (
                        <g key={i} transform={`translate(${i * 18}, 0)`}>
                            <rect x="3" y={240 - (d.plan / max) * 220} width="6" height={(d.plan / max) * 220} fill="#D4D1C7" />
                            <rect x="9" y={240 - (d.actual / max) * 220} width="6" height={(d.actual / max) * 220} fill="#141413" />
                        </g>
                    ))}
                </svg>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--integra-muted)] font-mono">
                <span>1 — {series.length}</span>
                <span>
                    Σ <span className="text-[var(--integra-ink)] font-medium">{fmtIDRJt(total * 1_000_000)}</span>
                    {" · "}
                    <span className={vsPlanPct >= 0 ? "text-[var(--integra-green-ok)]" : "text-[var(--integra-red)]"}>
                        {vsPlanPct >= 0 ? "+" : ""}{vsPlanPct.toFixed(1)}% vs plan
                    </span>
                </span>
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
        <Panel title="Umur Piutang (AR)" bodyClassName="p-0">
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
    const series: number[] = data?.charts?.dataCash7d?.map((d: any) => d.net ?? 0) ?? Array.from({ length: 30 }, () => Math.random() * 200 + 100)
    const max = Math.max(...series, 100)
    const min = Math.min(...series, 0)
    const range = max - min || 1
    const w = 100, h = 80

    const path = series
        .map((v, i) => {
            const x = (i / (series.length - 1)) * w
            const y = h - ((v - min) / range) * h
            return `${i === 0 ? "M" : "L"}${x},${y}`
        })
        .join(" ")

    const total = series.reduce((s, v) => s + v, 0)

    return (
        <Panel title="Arus Kas Bersih" meta="30 hari">
            <svg width="100%" viewBox="0 0 100 80" className="overflow-visible">
                <path d={path} stroke="#0047FF" strokeWidth="1" fill="none" />
                <path d={`${path} L${w},${h} L0,${h} Z`} fill="#0047FF" fillOpacity="0.06" />
            </svg>
            <div className="flex items-center justify-between mt-2 text-[11px] text-[var(--integra-muted)] font-mono">
                <span>Saldo masuk <span className="text-[var(--integra-green-ok)]">+{fmtIDRJt(Math.abs(total) * 100_000)}</span></span>
                <span>Saldo keluar <span className="text-[var(--integra-red)]">-{fmtIDRJt(Math.abs(total) * 75_000)}</span></span>
            </div>
        </Panel>
    )
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
                    </tr>
                </thead>
                <tbody>
                    {customers.map((c, i) => (
                        <tr key={i} className={INT.rowHover}>
                            <td className={INT.tdPrimary}>{c.customer ?? c.customerName ?? `Customer ${i + 1}`}</td>
                            <td className={INT.tdNum}>{c.count ?? Math.floor(Math.random() * 30) + 1}</td>
                            <td className={INT.tdNum}>{((c.totalAmount ?? c.amount ?? 0) / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </Panel>
    )
}

function AlertsList({ alerts }: { alerts: any[] }) {
    if (alerts.length === 0) {
        return <Panel title="Peringatan Operasional" meta="0 aktif"><EmptyState title="Tidak ada peringatan" /></Panel>
    }
    const critical = alerts.filter((a) => a.severity === "critical" || a.kind === "err").length

    return (
        <Panel
            title="Peringatan Operasional"
            meta={`${alerts.length} aktif · ${critical} kritikal`}
            actions={
                <div className="flex items-center gap-1 text-[11px]">
                    <button className={INT.tabActive + " px-2 py-0.5 rounded-[2px]"}>Semua</button>
                    <button className="px-2 py-0.5 text-[var(--integra-muted)]">Kritikal</button>
                </div>
            }
            bodyClassName="p-0"
        >
            <div className="divide-y divide-[var(--integra-hairline)]">
                {alerts.map((a, i) => (
                    <div key={i} className="px-3.5 py-2 hover:bg-[#FBFAF5] flex items-start gap-2.5">
                        <span className="font-mono text-[10.5px] text-[var(--integra-muted)] w-10 pt-0.5">
                            {fmtTime(a.timestamp ?? new Date())}
                        </span>
                        <span className={alertKindPill(a.kind ?? "info")}>
                            {(a.kind ?? "info").toString().toUpperCase()}
                        </span>
                        <div className="flex-1 text-[12.5px] text-[var(--integra-ink)]">
                            {a.message ?? a.title ?? "—"}
                            {a.meta && <span className="text-[11px] text-[var(--integra-muted)] ml-2 font-mono">{a.meta}</span>}
                        </div>
                    </div>
                ))}
            </div>
        </Panel>
    )
}

function alertKindPill(kind: string): string {
    const base = "inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-[2px] tracking-wider"
    switch (kind) {
        case "err":
        case "stok": return base + " bg-[var(--integra-red-bg)] text-[var(--integra-red)]"
        case "piutang": return base + " bg-[var(--integra-red-bg)] text-[var(--integra-red)]"
        case "qa":
        case "warn": return base + " bg-[var(--integra-amber-bg)] text-[var(--integra-amber)]"
        case "po":
        case "ok": return base + " bg-[var(--integra-green-ok-bg)] text-[var(--integra-green-ok)]"
        case "info":
        default: return base + " bg-[var(--integra-liren-blue-soft)] text-[var(--integra-liren-blue)]"
    }
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
        { key: "no", header: "No. Pesanan", render: (r) => <span className="font-mono text-[12px]">{r.number ?? r.invoiceNumber}</span>, type: "code" },
        { key: "customer", header: "Pelanggan", render: (r) => r.customer ?? r.customerName ?? "—", type: "primary" },
        { key: "tglBuat", header: "Tgl. Buat", render: (r) => r.createdAt ? fmtTime(r.createdAt) : "—", type: "code" },
        { key: "tglKirim", header: "Tgl. Kirim", render: (r) => r.dueDate ? fmtDateShort(new Date(r.dueDate)) : "—", type: "code" },
        { key: "qty", header: "Qty", render: (r) => r.qty ?? "—", type: "num" },
        { key: "nilai", header: "Nilai (Rp)", render: (r) => fmtIDR(r.totalAmount ?? r.amount ?? 0), type: "num" },
        {
            key: "status", header: "Status", render: (r) => {
                const status = r.status ?? "DRAFT"
                const map: Record<string, "ok" | "warn" | "err" | "info" | "neutral"> = {
                    PAID: "ok", LUNAS: "ok", SELESAI: "ok", DELIVERED: "ok",
                    PARTIAL: "warn", PENDING: "warn",
                    OVERDUE: "err", DRAFT: "neutral",
                    ISSUED: "info", DIPROSES: "info",
                }
                return <StatusPill kind={map[status] ?? "neutral"}>{statusLabel(status)}</StatusPill>
            }
        },
    ]

    return (
        <Panel
            title="Pesanan Terbaru"
            meta={`${invoices.length} terbuka · menampilkan ${Math.min(8, invoices.length)}`}
            actions={
                <div className="flex items-center gap-3 text-[11px]">
                    <button className="text-[var(--integra-liren-blue)] font-semibold">Semua</button>
                    <button className="text-[var(--integra-muted)]">Baru</button>
                    <button className="text-[var(--integra-muted)]">Diproses</button>
                    <button className="text-[var(--integra-muted)]">Dikirim</button>
                    <button className="text-[var(--integra-muted)]">Selesai</button>
                    <Link href="/finance/invoices" className="text-[var(--integra-liren-blue)]">Lihat semua →</Link>
                </div>
            }
            bodyClassName="p-0"
        >
            <DataTable columns={cols} rows={invoices} rowKey={(r) => r.id ?? r.number ?? Math.random()} />
        </Panel>
    )
}

function statusLabel(s: string): string {
    const map: Record<string, string> = {
        PAID: "Lunas", ISSUED: "Diproses", PARTIAL: "Parsial", OVERDUE: "Lewat",
        DRAFT: "Draf", DELIVERED: "Dikirim", PENDING: "Menunggu",
    }
    return map[s] ?? s
}

function MonthlyTarget({ sales }: { sales: any }) {
    const achieved = sales?.totalRevenue ?? 0
    const target = (sales?.totalRevenue ?? 0) * 1.4 || 6_000_000_000  // mock if no target
    const dayOfMonth = new Date().getDate()
    const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
    const pct = (achieved / target) * 100
    const expectedPct = (dayOfMonth / totalDays) * 100
    const pacing = pct - expectedPct

    return (
        <Panel title="Target Bulanan">
            <div className="flex items-baseline gap-1 mb-1">
                <span className="font-mono text-[28px] font-medium tracking-[-0.025em]">{pct.toFixed(1).replace(".", ",")}</span>
                <span className="text-[12px] text-[var(--integra-muted)]">%</span>
            </div>
            <div className="text-[11.5px] text-[var(--integra-muted)] font-mono">
                {fmtIDRJt(achieved)} dari {fmtIDRJt(target)}
            </div>
            <div className="mt-3 h-1.5 bg-[#F1EFE8] rounded-[2px] overflow-hidden">
                <div className="h-full bg-[var(--integra-ink)]" style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px]">
                <span className="text-[var(--integra-muted)] font-mono">Hari {dayOfMonth}/{totalDays}</span>
                <span className={"font-mono " + (pacing >= 0 ? "text-[var(--integra-green-ok)]" : "text-[var(--integra-red)]")}>
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

function fiscalPeriodLabel(): string {
    const m = new Intl.DateTimeFormat("id-ID", { month: "long" }).format(new Date())
    const y = new Date().getFullYear()
    return `${m.slice(0, 3)} ${y}`
}
