"use client"

import { useState, type ReactNode } from "react"
import { useExecutiveDashboard } from "@/hooks/use-executive-dashboard"
import {
    Panel, KPIRail, StatusPill, IntegraButton,
    PageHead, LiveDot, SegmentedButtons, DataTable, EmptyState,
    type ColumnDef, type KPIData,
} from "@/components/integra"
import { INT, fmtIDRJt, fmtIDR, fmtDateShort, fmtDateTime } from "@/lib/integra-tokens"
import { IconFilter, IconDownload } from "@tabler/icons-react"
import Link from "next/link"

type Period = "1H" | "7H" | "30H" | "TTD" | "12B"

export function DashboardIntegra() {
    const [period, setPeriod] = useState<Period>("30H")
    const { data, isLoading, dataUpdatedAt } = useExecutiveDashboard()

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

    // Fix 1 — Laba Kotor: read margin directly from API (operations.profitability.marginPct, 0–100)
    const marginPctReal: number = Number(operations?.profitability?.marginPct ?? 0)
    const targetMargin = 0.36 // 36% target — could come from settings later
    // Bug 11 — show margin if there was sales activity, even if margin is negative (loss months are real).
    // Previously hid all negative margins under "Belum ada data".
    const profitabilityRevenue = Number(operations?.profitability?.revenue ?? 0)
    const hasMargin = profitabilityRevenue > 0
    const grossMargin = marginPctReal / 100
    const marginPp = marginPctReal - targetMargin * 100  // delta vs target in pp

    // Fix 2 — DSO: null fallback (API tidak set field)
    const dso: number | null = financials?.dso ?? null
    const targetDso = 40

    // Fix 3 — Utilisasi Gudang: null fallback
    const utilizationPct: number | null = operations?.inventoryValue?.avgUtilization ?? null

    // Fix 4 — warehouseCount: gunakan || (bukan ??) supaya 0 tidak di-coalesce
    const warehouseList: any[] = operations?.inventoryValue?.warehouses ?? []
    const warehouseCount = warehouseList.length || (operations?.inventorySummary?.warehouseCount ?? 0)

    // Fix 5 — Pesanan Terbuka: source dari sales fulfillment (bukan vendor PO)
    // Bug 12 — totalOrders is ALL orders (delivered + open). Compute true open = total - delivered.
    const totalOrders = operations?.salesFulfillment?.totalOrders ?? 0
    const deliveredOrders = operations?.salesFulfillment?.deliveredOrders ?? 0
    const openOrders = Math.max(0, totalOrders - deliveredOrders)

    // Bug 9 — keep magnitude suffix (jt / M) so "Rp 5,0" isn't ambiguous.
    // fmtIDRJt returns e.g. "Rp 5,0 jt" or "Rp 1,2 M"; strip "Rp " prefix and let `unit` show "Rp".
    const revenueFormatted = fmtIDRJt(totalRevenue).replace(/^Rp\s?/, "")
    const kpis: KPIData[] = [
        {
            label: "Pendapatan (MTD)",
            value: revenueFormatted,
            unit: "Rp",
            foot: "MTD",
        },
        {
            label: "Laba Kotor",
            value: hasMargin
                ? (grossMargin * 100).toFixed(1).replace(".", ",")
                : "—",
            unit: hasMargin ? "%" : undefined,
            ...(hasMargin
                ? {
                    deltaText: `${marginPp >= 0 ? "▲" : "▼"} ${Math.abs(marginPp).toFixed(1).replace(".", ",")} pp`,
                    deltaKind: (marginPp >= 0 ? "up" : "down") as "up" | "down",
                    foot: `target ${(targetMargin * 100).toFixed(1).replace(".", ",")}%`,
                }
                : { foot: "Belum ada data" }),
        },
        {
            label: "Pesanan Terbuka",
            value: String(openOrders),
            foot: totalOrders > 0 ? `${deliveredOrders}/${totalOrders} terkirim` : undefined,
        },
        {
            label: "DSO",
            value: dso !== null ? dso.toFixed(1).replace(".", ",") : "—",
            unit: dso !== null ? "hari" : undefined,
            ...(dso !== null
                ? { foot: `target ≤ ${targetDso}` }
                : {}),
        },
        {
            label: "Utilisasi Gudang",
            value: utilizationPct !== null
                ? (utilizationPct * 100).toFixed(1).replace(".", ",")
                : "—",
            unit: utilizationPct !== null ? "%" : undefined,
            foot: warehouseCount > 0 ? `${warehouseCount} lokasi` : undefined,
        },
    ]

    const recentInvoices = financials?.recentInvoices ?? []
    const executiveAlerts = activity?.executiveAlerts ?? []

    // AR Aging buckets — derive from overdue + receivables data
    const arAging = computeArAging(financials)

    return (
        <>
            {/* Topbar */}
            <div className={INT.topbar}>
                <div className={INT.breadcrumb}>
                    <span>Beranda</span>
                    <span>/</span>
                    <span className={INT.breadcrumbCurrent}>Dasbor</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {/*
                      Bug 16 — period selector is currently cosmetic; setPeriod doesn't refetch.
                      TODO: pass `period` to useExecutiveDashboard(period) once the API supports
                      a date-range query param. For now, mark as preview so users aren't misled.
                    */}
                    <span
                        className="text-[10.5px] uppercase tracking-wider text-[var(--integra-muted)] italic"
                        title="Pemilihan periode belum aktif — backend belum mendukung filter rentang tanggal."
                    >
                        periode (preview)
                    </span>
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
                    <IntegraButton variant="primary" href="/finance/invoices">
                        Lihat Pesanan
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
                                Sinkron <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">{dataUpdatedAt ? fmtDateTime(new Date(dataUpdatedAt)) : "—"}</span>
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
        </>
    )
}

// ─────────────────────────────────────────────────────────────────
// SECTIONS
// ─────────────────────────────────────────────────────────────────

function RevenueChart({ data }: { data: any }) {
    const raw: Array<{ day: number; actual: number; plan: number }> | undefined =
        data?.charts?.revenueByDay
    // Bug 15 — keep mock fallback for visual continuity, but flag it as demo data so users
    // don't mistake fabricated sine-wave numbers for real revenue.
    const isDemo = !raw || raw.length === 0
    const series: Array<{ day: number; actual: number; plan: number }> =
        !isDemo
            ? raw!
            : Array.from({ length: 30 }, (_, i) => ({
                day: i + 1,
                actual: 150 + Math.sin(i / 3) * 30 + Math.random() * 30,
                plan: 175 + Math.cos(i / 4) * 15,
            }))

    // Fix 13 — derive max from data with floor 240, round up to clean tick of 60
    const peak = Math.max(...series.flatMap((d) => [d.actual, d.plan]), 240)
    const max = Math.ceil(peak / 60) * 60
    const total = series.reduce((s, d) => s + d.actual, 0)
    const totalPlan = series.reduce((s, d) => s + d.plan, 0)
    const vsPlanPct = (total / totalPlan - 1) * 100

    const yLabels = [max, max * 0.75, max * 0.5, max * 0.25, 0]
    const xLabels = [1, 5, 10, 15, 20, 25, 30]

    return (
        <Panel
            title="Pendapatan vs Rencana"
            meta={isDemo ? "dalam Rp juta · 30 hari · data demo" : "dalam Rp juta · 30 hari"}
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
                    {/* Bug 15 — only show real totals; mock data → label clearly as preview */}
                    {isDemo ? (
                        <span className="ml-auto font-mono italic">preview · belum ada data harian</span>
                    ) : (
                        <span className="ml-auto font-mono">
                            Σ <span className="text-[var(--integra-ink)]">{fmtIDRJt(total * 1_000_000)}</span>
                            {" · "}
                            <span className={vsPlanPct >= 0 ? "text-[var(--integra-green-ok)]" : "text-[var(--integra-red)]"}>
                                {vsPlanPct.toFixed(1).replace(".", ",")}% vs plan
                            </span>
                        </span>
                    )}
                </div>
            </div>
        </Panel>
    )
}

type AgingBucket = { bucket: string; invoices: number; valueIdr: number; pct: number; kind: "ok" | "neutral" | "warn" | "err" }

function computeArAging(financials: any): AgingBucket[] {
    // Fix 6 — derive buckets from actual overdue invoices (real days-overdue calc)
    const overdue: any[] = financials?.overdueInvoices ?? []
    if (overdue.length === 0) return []

    const now = Date.now()
    const buckets: Array<{ key: string; bucket: string; min: number; max: number; kind: AgingBucket["kind"]; invoices: number; valueIdr: number }> = [
        { key: "0-30", bucket: "0–30", min: 0, max: 30, kind: "ok", invoices: 0, valueIdr: 0 },
        { key: "31-60", bucket: "31–60", min: 31, max: 60, kind: "neutral", invoices: 0, valueIdr: 0 },
        { key: "61-90", bucket: "61–90", min: 61, max: 90, kind: "warn", invoices: 0, valueIdr: 0 },
        { key: "90+", bucket: "90+", min: 91, max: Number.POSITIVE_INFINITY, kind: "err", invoices: 0, valueIdr: 0 },
    ]

    let totalValue = 0
    for (const inv of overdue) {
        const due = inv.dueDate ? new Date(inv.dueDate).getTime() : null
        if (!due) continue
        const daysOverdue = Math.max(0, Math.floor((now - due) / 86_400_000))
        const amount = Number(inv.balanceDue ?? inv.totalAmount ?? 0)
        const slot = buckets.find(b => daysOverdue >= b.min && daysOverdue <= b.max)
        if (!slot) continue
        slot.invoices += 1
        slot.valueIdr += amount
        totalValue += amount
    }

    if (totalValue === 0) return []

    return buckets.map(b => ({
        bucket: b.bucket,
        invoices: b.invoices,
        valueIdr: b.valueIdr,
        pct: (b.valueIdr / totalValue) * 100,
        kind: b.kind,
    }))
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
    // Fix 8 — API shape: { name: weekday-label, val: number }, NOT { date, net }
    const rawApi: Array<{ name: string; val: number }> | undefined = data?.charts?.dataCash7d
    const series: Array<{ label: string; net: number }> | null =
        rawApi && rawApi.length > 0
            ? rawApi.map(d => ({ label: d.name, net: Number(d.val) }))
            : null

    if (!series || series.length === 0) {
        return (
            <Panel title="Arus Kas Bersih" meta="7 hari">
                <EmptyState title="Belum ada data arus kas" />
            </Panel>
        )
    }

    const values = series.map((d) => d.net)
    const max = Math.max(...values)
    const min = Math.min(...values, 0)
    const range = max - min || 1

    const w = 400, h = 220
    const path = values
        .map((v, i) => {
            const x = values.length > 1 ? (i / (values.length - 1)) * w : w / 2
            const y = h - ((v - min) / range) * (h - 20) - 10
            return `${i === 0 ? "M" : "L"}${x},${y}`
        })
        .join(" ")

    const totalIn = data?.operations?.cashFlow?.kasMasuk ?? 0
    const totalOut = data?.operations?.cashFlow?.kasKeluar ?? 0

    const startLabel = series[0].label
    const endLabel = series[series.length - 1].label

    return (
        <Panel title="Arus Kas Bersih" meta="7 hari" bodyClassName="p-0">
            <div className="px-3.5 pt-3.5">
                <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
                    <path d={`${path} L${w},${h} L0,${h} Z`} fill="var(--integra-liren-blue)" fillOpacity="0.06" />
                    <path d={path} stroke="var(--integra-liren-blue)" strokeWidth="1.2" fill="none" />
                </svg>
                <div className="flex justify-between font-mono text-[10.5px] text-[var(--integra-muted)] pt-1">
                    <span>{startLabel}</span>
                    <span>{endLabel}</span>
                </div>
            </div>
            <div className="flex items-center justify-between px-3.5 pt-1 pb-3 font-mono text-[11px] text-[var(--integra-muted)]">
                <span>
                    Saldo masuk{" "}
                    {totalIn > 0
                        ? <span className="text-[var(--integra-green-ok)]">+Rp {fmtIDRJt(Math.abs(totalIn)).replace(/^Rp\s?/, "")}</span>
                        : <span>—</span>}
                </span>
                <span>
                    Saldo keluar{" "}
                    {totalOut > 0
                        ? <span className="text-[var(--integra-red)]">−Rp {fmtIDRJt(Math.abs(totalOut)).replace(/^Rp\s?/, "")}</span>
                        : <span>—</span>}
                </span>
            </div>
        </Panel>
    )
}

function TopCustomersTable({ customers }: { customers: any[] }) {
    if (customers.length === 0) {
        return <Panel title="Pelanggan Teratas" meta="invoice terbaru"><EmptyState title="Belum ada data" /></Panel>
    }
    // Source is recentInvoices: { id, number, customer, date, total, status }
    // No delta / order-count info available — render only what is real.
    return (
        <Panel title="Pelanggan Teratas" meta="invoice terbaru" bodyClassName="p-0">
            <table className={INT.table}>
                <thead>
                    <tr>
                        <th className={INT.th}>Pelanggan</th>
                        <th className={INT.th}>No. Invoice</th>
                        <th className={INT.thNum}>Nilai (Rp jt)</th>
                    </tr>
                </thead>
                <tbody>
                    {customers.map((c, i) => (
                        <tr key={c.id ?? i} className={INT.rowHover}>
                            <td className={INT.tdPrimary}>{c.customer ?? c.customerName ?? "—"}</td>
                            <td className={INT.td}>
                                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{c.number ?? "—"}</span>
                            </td>
                            <td className={INT.tdNum}>
                                {((Number(c.total ?? c.totalAmount ?? c.amount ?? 0)) / 1_000_000).toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            </td>
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

    return (
        <Panel
            title="Peringatan Operasional"
            meta={`${alerts.length} aktif`}
            actions={
                <div className="flex items-center gap-1">
                    <button className="px-2 py-1 text-[11.5px] bg-[var(--integra-liren-blue-soft)] text-[var(--integra-liren-blue)] font-medium rounded-[2px]">Semua</button>
                    <button className="px-2 py-1 text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]">Kritikal</button>
                </div>
            }
            bodyClassName="p-0"
        >
            <ul className="m-0 p-0 list-none">
                {alerts.map((a, i) => {
                    const kind = deriveAlertKind(a.type)
                    const machineMeta = a.machine || a.impact || ""
                    return (
                        <li key={a.id ?? i} className="grid grid-cols-[1fr_auto] items-baseline gap-2.5 px-3.5 py-2 border-b border-[var(--integra-hairline)] last:border-b-0 text-[12.5px]">
                            <span className="text-[var(--integra-ink-soft)]">
                                <AlertKindPill kind={kind} />
                                <span className="ml-2">{renderAlertMessage(a.title ? `${a.title} — ${a.message ?? ""}` : (a.message ?? "—"))}</span>
                            </span>
                            <span className="font-mono text-[11px] text-[var(--integra-muted)]">{machineMeta}</span>
                        </li>
                    )
                })}
            </ul>
        </Panel>
    )
}

function AlertKindPill({ kind }: { kind: "QA" | "PO" | "INFO" }) {
    const map: Record<string, "ok" | "warn" | "err" | "info" | "neutral"> = {
        QA: "warn",
        PO: "warn",
        INFO: "info",
    }
    return <StatusPill kind={map[kind] ?? "neutral"}>{kind}</StatusPill>
}

function deriveAlertKind(type: string | undefined): "QA" | "PO" | "INFO" {
    if (!type) return "INFO"
    const t = type.toLowerCase()
    if (t.includes("quality")) return "QA"
    if (t.includes("breakdown") || t.includes("machine")) return "PO"
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

function RecentOrdersTable({ invoices }: { invoices: any[] }) {
    if (invoices.length === 0) {
        return <Panel title="Pesanan Terbaru"><EmptyState title="Belum ada pesanan" /></Panel>
    }

    const cols: ColumnDef<any>[] = [
        {
            key: "no",
            header: "No. Pesanan",
            render: (r) => <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{r.number ?? r.invoiceNumber ?? "—"}</span>,
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
            // API returns date as preformatted string ('date'); fallback to createdAt if present
            render: (r) => {
                const raw = r.date ?? r.createdAt
                if (!raw) return "—"
                // If raw looks like ISO/parseable, format it; else render as-is (already formatted)
                const d = new Date(raw)
                const display = isNaN(d.getTime()) ? String(raw) : fmtCreatedAt(raw)
                return <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{display}</span>
            },
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
            render: (r) => r.qty != null ? Number(r.qty).toLocaleString("id-ID") : "—",
            type: "num",
        },
        {
            key: "nilai",
            header: "Nilai (Rp)",
            render: (r) => fmtIDR(Number(r.total ?? r.totalAmount ?? r.amount ?? 0)),
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
            render: (r) => <PaymentPill payment={deriveLunas(r)} />,
        },
    ]

    const total = invoices.reduce((s, r) => s + Number(r.total ?? r.totalAmount ?? r.amount ?? 0), 0)

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
            {/* Bug 14 — never use Math.random() as rowKey (causes full remount per render); use stable id/number */}
            <DataTable columns={cols} rows={invoices.slice(0, 8)} rowKey={(r) => r.id ?? r.number ?? `row-${invoices.indexOf(r)}`} />
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

function PaymentPill({ payment }: { payment: { kind: "ok" | "warn" | "err" | "neutral"; label: string } }) {
    return <StatusPill kind={payment.kind}>{payment.label}</StatusPill>
}

// Fix 7 — derive payment status from invoice status enum (no fabricated 'PAID' default)
function deriveLunas(r: any): { kind: "ok" | "warn" | "err" | "neutral"; label: string } {
    const status = String(r.status ?? "").toUpperCase()
    if (status === "PAID") return { kind: "ok", label: "Lunas" }
    if (status === "PARTIAL") return { kind: "warn", label: "Sebagian" }
    if (status === "OVERDUE") return { kind: "err", label: "Terlambat" }
    return { kind: "neutral", label: "—" }
}

function fmtCreatedAt(iso: string): string {
    const d = new Date(iso)
    const date = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" }).format(d)
    const time = new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", hour12: false }).format(d)
    return `${date} ${time}`
}

function MonthlyTarget({ sales }: { sales: any }) {
    const achieved = sales?.totalRevenue ?? 0
    const target: number | null = sales?.monthlyTarget ?? null
    const dayOfMonth = new Date().getDate()
    const totalDays = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()

    // No target set → show empty state instead of pretending against a fake 6M target
    if (target === null || target <= 0) {
        return (
            <Panel title="Target Bulanan" bodyClassName="p-3.5">
                <div className="font-mono text-[24px] tracking-[-0.02em] leading-none text-[var(--integra-muted)]">
                    —
                </div>
                <div className="text-[11.5px] text-[var(--integra-muted)] mt-1">
                    Belum ada target bulan ini
                </div>
                <div className="text-[10.5px] text-[var(--integra-muted)] mt-2">
                    Tetapkan target di Pengaturan → Penjualan
                </div>
            </Panel>
        )
    }

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
        return (
            <Panel title="Tugas Menunggu" meta={`0 pending`} bodyClassName="p-0">
                <div className="text-[12px] text-[var(--integra-muted)] py-3 text-center">Tidak ada tugas</div>
            </Panel>
        )
    }
    // Fix 10 — pendingApproval shape: { id, number, supplier, totalAmount, netAmount, itemCount, items }
    // Drop fake priority by index, drop fake due by index. Show real fields only.
    return (
        <Panel title="Tugas Menunggu" meta={`${pending.length} pending`} bodyClassName="p-0">
            <ul className="m-0 p-0 list-none">
                {pending.slice(0, 5).map((t, i) => {
                    const ref = t.ref ?? t.poNumber ?? t.number ?? `Item-${i + 1}`
                    // Bug 8 — supplier is { name } object on pendingApproval payload, not string
                    const supplier =
                        (typeof t.supplier === "object" && t.supplier !== null
                            ? t.supplier.name
                            : t.supplier) ??
                        t.supplierName ??
                        "—"
                    const itemCount = t.itemCount ?? (Array.isArray(t.items) ? t.items.length : null)
                    const meta = itemCount != null
                        ? `${itemCount} item · ${supplier}`
                        : supplier
                    return (
                        <li key={t.id ?? i} className="grid grid-cols-[1fr_auto] items-baseline gap-2 px-3.5 py-2 border-b border-[var(--integra-hairline)] last:border-b-0 text-[12.5px]">
                            <span className="text-[var(--integra-ink-soft)]">
                                {t.action ?? "Setujui"}{" "}
                                <Link
                                    // Bug 13 — /procurement/orders/[id] route doesn't exist; link to list page instead
                                    href={t.url ?? `/procurement/orders?focus=${encodeURIComponent(ref)}`}
                                    className="text-[var(--integra-liren-blue)]"
                                    style={{ textDecoration: "underline", textDecorationColor: "var(--integra-hairline-strong)", textUnderlineOffset: 2 }}
                                >
                                    {ref}
                                </Link>
                            </span>
                            <span className="font-mono text-[11px] text-[var(--integra-muted)] truncate max-w-[160px]">{meta}</span>
                        </li>
                    )
                })}
            </ul>
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
