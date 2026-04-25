"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
    IconFilter,
    IconDownload,
    IconPlus,
    IconSearch,
    IconBoxSeam,
    IconPackages,
    IconArrowsExchange,
    IconClipboardList,
    IconAlertTriangle,
    IconReportAnalytics,
    IconShoppingCart,
    IconArrowDownToArc,
} from "@tabler/icons-react"
import {
    Panel,
    KPI,
    IntegraButton,
    PageHead,
    LiveDot,
    SegmentedButtons,
    UtilBar,
    StatusPill,
} from "@/components/integra"
import { INT, fmtIDR, fmtIDRJt, fmtPct } from "@/lib/integra-tokens"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { cn } from "@/lib/utils"
import {
    useMaterialGap,
    type MaterialGapRow,
    type MaterialGapFilterStatus,
    type MaterialGapStatus,
    type MaterialGapWarehouse,
} from "@/hooks/use-material-gap"

type Period = "1H" | "7H" | "30H" | "TTD"

// ─── helpers ─────────────────────────────────────────────────────────

function fmtNum(n: number, fractionDigits = 0): string {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(n)
}

/** Always render a Rupiah amount in juta (thousands grouping, no suffix). */
function fmtJtPlain(n: number): string {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(Math.round(Math.abs(n) / 1_000_000))
}

const STATUS_LABEL: Record<MaterialGapStatus, string> = {
    ALERT: "Alert",
    REQUESTED: "Requested",
    APPROVED: "Approved",
    COMPLETED: "Completed",
    HEALTHY: "Healthy",
    REJECTED: "Rejected",
}

const STATUS_PILL_KIND: Record<MaterialGapStatus, "ok" | "warn" | "err" | "neutral"> = {
    ALERT: "err",
    REQUESTED: "warn",
    APPROVED: "ok",
    COMPLETED: "ok",
    HEALTHY: "neutral",
    REJECTED: "err",
}

function actionLabel(status: MaterialGapStatus): string {
    switch (status) {
        case "ALERT":
            return "Buat PR"
        case "REQUESTED":
            return "Lacak"
        case "APPROVED":
            return "Setujui"
        default:
            return "Lihat"
    }
}

const WAREHOUSE_PILL: Record<MaterialGapWarehouse["status"], { kind: "ok" | "warn" | "err" | "neutral"; label: string }> = {
    NORMAL: { kind: "ok", label: "Normal" },
    RAMAI: { kind: "warn", label: "Ramai" },
    PENUH: { kind: "err", label: "Penuh" },
    IDLE: { kind: "neutral", label: "Idle" },
}

// ─── page ────────────────────────────────────────────────────────────

export default function MaterialGapPage() {
    const [period, setPeriod] = useState<Period>("7H")
    const [statusFilter, setStatusFilter] = useState<MaterialGapFilterStatus>("ALL")
    const [query, setQuery] = useState("")
    const { data, isLoading } = useMaterialGap()

    const filteredRows = useMemo(() => {
        if (!data) return []
        const q = query.trim().toLowerCase()
        return data.rows.filter((r) => {
            if (statusFilter !== "ALL" && r.status !== statusFilter) return false
            if (!q) return true
            return (
                r.sku.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q) ||
                r.vendor.name.toLowerCase().includes(q)
            )
        })
    }, [data, statusFilter, query])

    const counts = useMemo(() => {
        const all = data?.rows.length ?? 0
        const by = (s: MaterialGapStatus) => data?.rows.filter((r) => r.status === s).length ?? 0
        return {
            ALL: all,
            ALERT: by("ALERT"),
            REQUESTED: by("REQUESTED"),
            APPROVED: by("APPROVED"),
            REJECTED: by("REJECTED"),
            COMPLETED: by("COMPLETED"),
        }
    }, [data])

    const totalGap = useMemo(
        () =>
            (data?.rows ?? [])
                .filter((r) => r.status === "ALERT")
                .reduce((sum, r) => sum + r.budgetNeededIdr, 0),
        [data],
    )
    const outstandingPrCount = useMemo(
        () => (data?.rows ?? []).filter((r) => r.status === "REQUESTED" || r.status === "APPROVED").length,
        [data],
    )

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-blue-400" />
    }

    return (
        <>
            {/* ─── Topbar ─────────────────────────────────────────── */}
            <div className={INT.topbar}>
                <div className={INT.breadcrumb}>
                    <span>Beranda</span>
                    <span>/</span>
                    <span>Logistik</span>
                    <span>/</span>
                    <span className={INT.breadcrumbCurrent}>Material Gap Analysis</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <SegmentedButtons<Period>
                        options={[
                            { value: "1H", label: "1H" },
                            { value: "7H", label: "7H" },
                            { value: "30H", label: "30H" },
                            { value: "TTD", label: "TTD" },
                        ]}
                        value={period}
                        onChange={setPeriod}
                    />
                    <IntegraButton variant="secondary" icon={<IconFilter className="w-3.5 h-3.5" />}>
                        Filter · 2
                    </IntegraButton>
                    <IntegraButton variant="secondary" icon={<IconDownload className="w-3.5 h-3.5" />}>
                        Ekspor CSV
                    </IntegraButton>
                    <IntegraButton variant="secondary">Buat PR Massal</IntegraButton>
                    <IntegraButton
                        variant="primary"
                        icon={<IconPlus className="w-3.5 h-3.5" />}
                        href="/inventory/products/new"
                    >
                        Tambah Material
                    </IntegraButton>
                </div>
            </div>

            {/* ─── Page content ───────────────────────────────────── */}
            <div className="px-6 py-5 space-y-3">
                <PageHead
                    title="Material Gap Analysis"
                    subtitle="Safety stock, reorder point, dan gap pengadaan secara real-time"
                    metaRight={
                        <div className="flex items-center gap-5 text-[12px] text-[var(--integra-muted)]">
                            <span className="flex items-center gap-2">
                                <LiveDot />
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    LIVE · Gudang Pusat
                                </span>
                            </span>
                            <span>
                                Sinkron{" "}
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    25 Apr 09:24
                                </span>
                            </span>
                            <span>
                                Periode{" "}
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    FY26 · Apr
                                </span>
                            </span>
                        </div>
                    }
                />

                {/* ─── KPI rail (6 cells) ─────────────────────────── */}
                <div className={INT.kpiRail}>
                    <KPI
                        label="Total Inventori"
                        value={
                            <>
                                {fmtJtPlain(data.kpis.totalInventoryIdr)}
                                <span className="text-[12px] text-[var(--integra-muted)] ml-1">jt</span>
                            </>
                        }
                        unit="Rp"
                        foot={<span>{fmtNum(data.rows.length)} SKU dipantau</span>}
                    />
                    <KPI
                        label="Low Stock"
                        value={fmtNum(data.kpis.lowStockCount)}
                        foot={<StatusPill kind="warn">Perlu restock</StatusPill>}
                    />
                    <KPI
                        label="Akurasi Opname"
                        value={data.kpis.opnameAccuracyPct.toFixed(1).replace(".", ",")}
                        unit="%"
                    />
                    <KPI
                        label="Inbound (Hari Ini)"
                        value={fmtNum(data.kpis.inboundToday)}
                        foot={<span>PO tiba</span>}
                    />
                    <KPI
                        label="Outbound (Hari Ini)"
                        value={fmtNum(data.kpis.outboundToday)}
                        foot={<span>pengiriman</span>}
                    />
                    <div className={INT.kpiCell}>
                        <div className={INT.kpiLabel}>Gap Budget</div>
                        <div>
                            <div className={INT.kpiValueRow}>
                                <span className="text-[12px] text-[var(--integra-red)]">Rp</span>
                                <span className="font-mono text-[22px] font-medium tracking-[-0.025em] text-[var(--integra-red)]">
                                    {fmtJtPlain(data.kpis.gapBudgetIdr)}
                                </span>
                                <span className="text-[12px] text-[var(--integra-red)] ml-0.5">jt</span>
                            </div>
                            <div className={cn(INT.kpiFoot, "mt-1")}>
                                <StatusPill kind="err">defisit · {data.kpis.gapItemCount} item</StatusPill>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── Material Gap Panel ─────────────────────────── */}
                <Panel
                    bodyClassName="p-0"
                >
                    {/* Custom header (search + filter tabs) */}
                    <div className={cn(INT.panelHead, "flex-wrap gap-3")}>
                        <div className="flex items-center gap-2.5">
                            <h3 className={INT.panelTitle}>Analisis Gap Material</h3>
                            <span className={INT.panelMeta}>
                                Material yang membutuhkan restock berdasarkan safety stock
                            </span>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                            <div className="relative" style={{ width: 300 }}>
                                <IconSearch className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--integra-muted)]" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Cari SKU, material, atau vendor…"
                                    className="w-full h-[26px] pl-7 pr-2 text-[12.5px] bg-[var(--integra-canvas-pure)] text-[var(--integra-ink)] border border-[var(--integra-hairline-strong)] rounded-[3px] outline-none focus:border-[var(--integra-liren-blue)] placeholder:text-[var(--integra-muted)]"
                                />
                            </div>
                            <FilterTabs
                                value={statusFilter}
                                onChange={setStatusFilter}
                                counts={counts}
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className={INT.tableWrap}>
                        <table className={INT.table}>
                            <thead>
                                <tr>
                                    <th className={INT.th} style={{ width: 28 }}>
                                        <input type="checkbox" />
                                    </th>
                                    <th className={INT.th} style={{ width: 220 }}>Material</th>
                                    <th className={INT.thNum} style={{ width: 130 }}>Stok / Kebutuhan</th>
                                    <th className={INT.thNum} style={{ width: 80 }}>Safety</th>
                                    <th className={INT.thNum} style={{ width: 80 }}>ROP</th>
                                    <th className={INT.thNum} style={{ width: 80 }}>Lead</th>
                                    <th className={INT.thNum} style={{ width: 80 }}>Burn /h</th>
                                    <th className={INT.thNum} style={{ width: 100 }}>Cover</th>
                                    <th className={INT.th} style={{ width: 160 }}>Vendor</th>
                                    <th className={INT.thNum} style={{ width: 110 }}>Harga Sat.</th>
                                    <th className={INT.thNum} style={{ width: 130 }}>Budget Needed</th>
                                    <th className={INT.th} style={{ width: 90 }}>Status</th>
                                    <th className={INT.th} style={{ width: 110 }}>Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRows.length === 0 ? (
                                    <tr>
                                        <td
                                            colSpan={13}
                                            className="text-center py-10 text-[12.5px] text-[var(--integra-muted)]"
                                        >
                                            Tidak ada material yang cocok dengan filter
                                        </td>
                                    </tr>
                                ) : (
                                    filteredRows.map((row) => <MaterialRow key={row.sku} row={row} />)
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[var(--integra-hairline)] text-[12px] text-[var(--integra-muted)]">
                        <div>
                            {filteredRows.length === 0
                                ? "0 dari 0 material"
                                : `1 – ${filteredRows.length} dari ${data.rows.length} material`}
                        </div>
                        <div className="flex gap-6 items-center">
                            <span>
                                Total gap{" "}
                                <span className="font-mono text-[var(--integra-red)]">{fmtIDR(totalGap)}</span>
                            </span>
                            <span>
                                Outstanding PR{" "}
                                <span className="font-mono text-[var(--integra-ink)]">{outstandingPrCount}</span>
                            </span>
                            <span>
                                Akurasi opname{" "}
                                <span className="font-mono text-[var(--integra-ink)]">
                                    {data.kpis.opnameAccuracyPct.toFixed(1).replace(".", ",")}%
                                </span>
                            </span>
                        </div>
                    </div>
                </Panel>

                {/* ─── Bottom row: Gudang + Aksi Cepat + Pengadaan ─ */}
                <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-3">
                    {/* A. Gudang Aktif */}
                    <Panel
                        title="Gudang Aktif"
                        meta={`${data.warehouses.length} lokasi · alokasi per material`}
                        bodyClassName="p-0"
                        actions={
                            <Link
                                href="/inventory/warehouses"
                                className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                            >
                                Kelola →
                            </Link>
                        }
                    >
                        <div className={INT.tableWrap}>
                            <table className={INT.table}>
                                <thead>
                                    <tr>
                                        <th className={INT.th} style={{ width: 180 }}>Gudang</th>
                                        <th className={INT.thNum}>SKU</th>
                                        <th className={INT.thNum}>Nilai (Rp jt)</th>
                                        <th className={INT.thNum} style={{ width: 180 }}>Utilisasi</th>
                                        <th className={INT.th}>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.warehouses.map((w) => (
                                        <WarehouseRow key={w.code} w={w} />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Panel>

                    {/* B. Aksi Cepat */}
                    <Panel title="Aksi Cepat" meta="Alur operasional inventaris" bodyClassName="p-0">
                        {/* Hairline-divider grid: bg = hairline, gap = 1px → cells appear separated */}
                        <div
                            className="grid grid-cols-2 bg-[var(--integra-hairline)]"
                            style={{ gap: 1 }}
                        >
                            <QuickAction
                                icon={<IconBoxSeam className="w-4 h-4" />}
                                label="Produk"
                                sub="Kelola katalog"
                                href="/inventory/products"
                            />
                            <QuickAction
                                icon={<IconPackages className="w-4 h-4" />}
                                label="Stok"
                                sub="Lihat posisi"
                                href="/inventory"
                            />
                            <QuickAction
                                icon={<IconArrowsExchange className="w-4 h-4" />}
                                label="Pergerakan"
                                sub="Transfer & mutasi"
                                href="/inventory/movements"
                            />
                            <QuickAction
                                icon={<IconClipboardList className="w-4 h-4" />}
                                label="Opname"
                                sub="Audit stok"
                                href="/inventory/audit"
                            />
                            <QuickAction
                                icon={<IconAlertTriangle className="w-4 h-4" />}
                                label="Peringatan"
                                sub={`${data.kpis.lowStockCount} alert aktif`}
                                href="/inventory/alerts"
                            />
                            <QuickAction
                                icon={<IconReportAnalytics className="w-4 h-4" />}
                                label="Laporan"
                                sub="Unduh rekap"
                                href="/reports"
                            />
                        </div>
                    </Panel>

                    {/* C. Ringkasan Pengadaan */}
                    <Panel title="Ringkasan Pengadaan" meta="PR aktif dan PO masuk">
                        <div className="flex flex-col gap-2.5">
                            {/* Restock Diperlukan */}
                            <div className="flex justify-between items-end px-3 py-2.5 border border-[var(--integra-hairline)] rounded-[3px]">
                                <div>
                                    <div className={INT.kpiLabel} style={{ marginBottom: 4 }}>
                                        Restock Diperlukan
                                    </div>
                                    <div className="font-mono text-[18px] font-semibold text-[var(--integra-red)]">
                                        {fmtIDRJt(data.procurement.restockNeededIdr)}
                                    </div>
                                    <div className="font-mono text-[11px] text-[var(--integra-muted)] mt-0.5">
                                        {data.procurement.restockItemCount} item kritis
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 px-3 h-7 text-[12px] font-medium font-display border border-[var(--integra-red)] text-[var(--integra-red)] bg-[var(--integra-canvas-pure)] rounded-[3px] hover:bg-[var(--integra-red-bg)] transition-colors"
                                >
                                    <IconArrowDownToArc className="w-3.5 h-3.5" />
                                    Restock
                                </button>
                            </div>

                            {/* Incoming */}
                            <div className="flex justify-between items-end px-3 py-2.5 border border-[var(--integra-hairline)] rounded-[3px]">
                                <div>
                                    <div className={INT.kpiLabel} style={{ marginBottom: 4 }}>
                                        Incoming PO
                                    </div>
                                    <div className="font-mono text-[18px] font-semibold text-[var(--integra-ink)]">
                                        {data.procurement.incomingPoCount} PO
                                    </div>
                                    <div className="font-mono text-[11px] text-[var(--integra-muted)] mt-0.5">
                                        {data.procurement.incomingVendorNote}
                                    </div>
                                </div>
                                <IntegraButton
                                    variant="secondary"
                                    href="/procurement/orders"
                                    icon={<IconShoppingCart className="w-3.5 h-3.5" />}
                                >
                                    Procurement
                                </IntegraButton>
                            </div>

                            {/* Pending Approval */}
                            <div className="flex justify-between items-center px-3 py-2.5 border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas)]">
                                <div className="text-[12px] text-[var(--integra-muted)]">Pending Approval</div>
                                <div className="font-mono text-[12.5px] text-[var(--integra-ink)]">
                                    {data.procurement.pendingApproval.count} PR ·{" "}
                                    <span className="text-[var(--integra-muted)]">
                                        ({fmtIDRJt(data.procurement.pendingApproval.totalIdr)})
                                    </span>
                                </div>
                            </div>

                            {/* OTD */}
                            <div className="flex justify-between items-center px-3 py-2.5 border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas)]">
                                <div className="text-[12px] text-[var(--integra-muted)]">
                                    On-Time Delivery (30h)
                                </div>
                                <div className="font-mono text-[12.5px] text-[var(--integra-green-ok)]">
                                    {fmtPct(data.procurement.onTimeDeliveryPct / 100, 1)}
                                </div>
                            </div>
                        </div>
                    </Panel>
                </div>
            </div>
        </>
    )
}

// ─── Material row ─────────────────────────────────────────────────────

function MaterialRow({ row }: { row: MaterialGapRow }) {
    const stockColor = row.stock === 0 ? "text-[var(--integra-red)]" : "text-[var(--integra-ink)]"
    const ropAmber = row.stock <= row.rop * 1.2
    const coverColor =
        row.coverageHours === null
            ? null
            : row.coverageHours < 6
                ? "text-[var(--integra-red)]"
                : row.coverageHours <= 24
                    ? "text-[var(--integra-amber)]"
                    : "text-[var(--integra-green-ok)]"
    const isAlert = row.status === "ALERT"

    return (
        <tr className="hover:bg-[#FBFAF5] transition-colors">
            <td className={INT.td}>
                <input type="checkbox" />
            </td>
            <td className={INT.td}>
                <div className="text-[12.5px] font-medium text-[var(--integra-ink)]">{row.name}</div>
                <div className="font-mono text-[11px] text-[var(--integra-muted)]">
                    {row.grade} · {row.sku} · {row.unit}
                </div>
            </td>
            <td className={INT.tdNum}>
                <span className={cn("font-mono", stockColor)}>{fmtNum(row.stock)}</span>
                <span className="font-mono text-[var(--integra-muted)]">/{fmtNum(row.demand)}</span>
            </td>
            <td className={INT.tdNum}>{fmtNum(row.safety)}</td>
            <td className={cn(INT.tdNum, ropAmber && "text-[var(--integra-amber)]")}>
                {fmtNum(row.rop)}
            </td>
            <td className={INT.tdNum}>{row.leadHours}h</td>
            <td className={INT.tdNum}>
                {row.burnPerHour.toLocaleString("id-ID", { maximumFractionDigits: 1 })}
                <span className="text-[var(--integra-muted)]">/h</span>
            </td>
            <td className={INT.tdNum}>
                {row.coverageHours === null ? (
                    <StatusPill kind="err">Stockout</StatusPill>
                ) : (
                    <span className={cn("font-mono", coverColor)}>
                        {row.coverageHours.toLocaleString("id-ID", { maximumFractionDigits: 1 })}h
                    </span>
                )}
            </td>
            <td className={INT.td}>
                <div className="text-[12.5px] font-medium text-[var(--integra-ink)]">{row.vendor.name}</div>
                <div className="font-mono text-[11px] text-[var(--integra-muted)]">
                    {row.vendor.poRef ?? "Belum ada PO aktif"}
                </div>
            </td>
            <td className={INT.tdNum}>{fmtIDR(row.unitPriceIdr)}</td>
            <td className={INT.tdNum}>
                {isAlert ? (
                    <>
                        <div className="font-mono font-medium text-[var(--integra-red)]">
                            {fmtIDR(row.budgetNeededIdr)}
                        </div>
                        {row.deficitQty !== undefined && row.deficitQty > 0 && (
                            <div className="font-mono text-[10.5px] text-[var(--integra-red)]">
                                −{fmtNum(row.deficitQty)} {row.unit} defisit
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="font-mono font-medium text-[var(--integra-ink)]">
                            {fmtIDR(row.budgetNeededIdr)}
                        </div>
                        {row.deficitQty !== undefined && row.deficitQty > 0 && (
                            <div className="font-mono text-[10.5px] text-[var(--integra-muted)]">
                                {fmtNum(row.deficitQty)} {row.unit}
                            </div>
                        )}
                    </>
                )}
            </td>
            <td className={INT.td}>
                <StatusPill kind={STATUS_PILL_KIND[row.status]}>{STATUS_LABEL[row.status]}</StatusPill>
            </td>
            <td className={INT.td}>
                <button
                    type="button"
                    className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-[2px] border border-[var(--integra-hairline-strong)] text-[var(--integra-ink-soft)] hover:border-[var(--integra-ink)] hover:text-[var(--integra-ink)] transition-colors"
                >
                    {actionLabel(row.status)}
                </button>
            </td>
        </tr>
    )
}

// ─── Warehouse row ────────────────────────────────────────────────────

function WarehouseRow({ w }: { w: MaterialGapWarehouse }) {
    const utilColor =
        w.status === "IDLE"
            ? "text-[var(--integra-muted)]"
            : w.utilPct >= 90
                ? "text-[var(--integra-red)]"
                : w.utilPct >= 70
                    ? "text-[var(--integra-amber)]"
                    : "text-[var(--integra-ink)]"
    const pill = WAREHOUSE_PILL[w.status]
    return (
        <tr className="hover:bg-[#FBFAF5] transition-colors">
            <td className={INT.td}>
                <div className="text-[12.5px] font-medium text-[var(--integra-ink)]">{w.name}</div>
                <div className="font-mono text-[11px] text-[var(--integra-muted)]">{w.code}</div>
            </td>
            <td className={INT.tdNum}>{fmtNum(w.skuCount)}</td>
            <td className={INT.tdNum}>{fmtNum(w.valueIdrJt)}</td>
            <td className={INT.td}>
                <UtilBar
                    value={w.utilPct}
                    rightText={
                        <span className={utilColor}>
                            {w.utilPct}%
                        </span>
                    }
                    thresholds={{ red: 90, amber: 70 }}
                />
            </td>
            <td className={INT.td}>
                <StatusPill kind={pill.kind}>{pill.label}</StatusPill>
            </td>
        </tr>
    )
}

// ─── Filter tabs ──────────────────────────────────────────────────────

function FilterTabs({
    value,
    onChange,
    counts,
}: {
    value: MaterialGapFilterStatus
    onChange: (v: MaterialGapFilterStatus) => void
    counts: Record<"ALL" | "ALERT" | "REQUESTED" | "APPROVED" | "REJECTED" | "COMPLETED", number>
}) {
    const items: Array<{ key: MaterialGapFilterStatus; label: string; countColor?: string }> = [
        { key: "ALL", label: "Semua" },
        { key: "ALERT", label: "Alert", countColor: "text-[var(--integra-red)]" },
        { key: "REQUESTED", label: "Requested" },
        { key: "APPROVED", label: "Approved" },
        { key: "REJECTED", label: "Rejected", countColor: "text-[var(--integra-red)]" },
        { key: "COMPLETED", label: "Completed" },
    ]
    return (
        <div className="inline-flex items-center border border-[var(--integra-hairline-strong)] rounded-[3px] overflow-hidden h-[26px]">
            {items.map((it) => {
                const active = it.key === value
                const count = counts[it.key as keyof typeof counts] ?? 0
                return (
                    <button
                        key={it.key}
                        type="button"
                        onClick={() => onChange(it.key)}
                        className={cn(
                            "px-2 h-full text-[12px] font-medium font-mono border-r border-[var(--integra-hairline)] last:border-r-0 transition-colors flex items-center gap-1",
                            active
                                ? "bg-[var(--integra-ink)] text-[var(--integra-canvas)]"
                                : "text-[var(--integra-ink-soft)] hover:bg-[#F1EFE8]",
                        )}
                    >
                        <span className="font-display">{it.label}</span>
                        <span
                            className={cn(
                                "font-mono text-[11px]",
                                active
                                    ? "text-[var(--integra-canvas)] opacity-70"
                                    : it.countColor ?? "text-[var(--integra-muted)]",
                            )}
                        >
                            {count}
                        </span>
                    </button>
                )
            })}
        </div>
    )
}

// ─── Quick action cell ────────────────────────────────────────────────

function QuickAction({
    icon,
    label,
    sub,
    href,
}: {
    icon: React.ReactNode
    label: string
    sub: string
    href: string
}) {
    return (
        <Link
            href={href}
            className="flex items-center gap-2.5 px-3 py-3.5 bg-[var(--integra-canvas-pure)] hover:bg-[#F1EFE8] transition-colors"
        >
            <span className="text-[var(--integra-ink)] flex-shrink-0">{icon}</span>
            <span className="flex flex-col">
                <span className="text-[12.5px] font-medium text-[var(--integra-ink)] leading-tight">
                    {label}
                </span>
                <span className="text-[11px] text-[var(--integra-muted)] mt-0.5">{sub}</span>
            </span>
        </Link>
    )
}
