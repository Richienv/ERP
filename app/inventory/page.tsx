"use client"

import Link from "next/link"
import {
    Panel,
    KPIRail,
    IntegraButton,
    PageHead,
    LiveDot,
    DataTable,
    UtilBar,
    EmptyState,
    type ColumnDef,
    type KPIData,
} from "@/components/integra"
import { INT, fmtIDR, fmtIDRJt, fmtDateTime } from "@/lib/integra-tokens"
import {
    IconFilter,
    IconDownload,
    IconPlus,
    IconAdjustments,
    IconClipboardList,
    IconArrowsLeftRight,
    IconBox,
} from "@tabler/icons-react"
import { useInventoryDashboard } from "@/hooks/use-inventory-dashboard"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

type Warehouse = {
    id: string
    code: string
    name: string
    manager: string | null
    staff: number
    totalValue: number
    activePOs: number
    pendingTasks: number
    utilization: number
}

type MaterialGapRow = {
    id: string
    name: string
    // API may return either `code` (newer) or `sku` (legacy from getMaterialGapAnalysis)
    code?: string
    sku?: string
    // API may return either `stockOnHand` (newer) or `currentStock` (legacy)
    stockOnHand?: number
    currentStock?: number
    // API may return either `requiredQty` (newer) or `reorderPoint` (legacy)
    requiredQty?: number
    reorderPoint?: number
    // API may return either `gapQty` (newer) or `gap` (legacy)
    gapQty?: number
    gap?: number
    // API may return either `urgencyDays` (newer) or `stockEndsInDays` (legacy)
    urgencyDays?: number
    stockEndsInDays?: number
}

// Field-resolver helpers: tolerate both naming conventions from the API
function getRowCode(r: MaterialGapRow): string {
    return r.code ?? r.sku ?? "—"
}
function getRowStockOnHand(r: MaterialGapRow): number {
    return Number(r.stockOnHand ?? r.currentStock ?? 0)
}
function getRowRequiredQty(r: MaterialGapRow): number {
    return Number(r.requiredQty ?? r.reorderPoint ?? 0)
}
function getRowGapQty(r: MaterialGapRow): number {
    return Number(r.gapQty ?? r.gap ?? 0)
}
function getRowUrgencyDays(r: MaterialGapRow): number | null {
    const v = r.urgencyDays ?? r.stockEndsInDays
    if (typeof v !== "number" || !Number.isFinite(v)) return null
    return v
}

export default function InventoryPage() {
    const { data, isLoading } = useInventoryDashboard()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-blue-400" />
    }

    const { warehouses = [], kpis, materialGap = [], procurement } = data as {
        warehouses: Warehouse[]
        kpis: Partial<{
            totalValue: number
            totalProducts: number
            lowStock: number
            accuracy: number
            inventoryAccuracy: number
            pendingMovements: number
            recentMovements: number
            avgTurnover: number
        }>
        materialGap: MaterialGapRow[]
        procurement: {
            summary: {
                totalRestockCost: number
                itemsCriticalCount: number
                totalIncoming: number
                totalPending: number
                pendingApproval: number
            }
        }
    }

    const liveWarehouses = (warehouses ?? []).slice(0, 3)

    // Null-safe KPI values: show "—" when field is undefined OR zero (no real data)
    // Tolerate both naming conventions: `accuracy` (API fallback) and `inventoryAccuracy` (server action)
    const rawAccuracy =
        typeof kpis?.accuracy === "number" ? kpis.accuracy
            : typeof kpis?.inventoryAccuracy === "number" ? kpis.inventoryAccuracy
                : null
    const accuracy = rawAccuracy !== null && rawAccuracy > 0 ? rawAccuracy : null

    const rawTurnover = typeof kpis?.avgTurnover === "number" ? kpis.avgTurnover : null
    const avgTurnover = rawTurnover !== null && rawTurnover > 0 ? rawTurnover : null

    const rawRecent = typeof kpis?.recentMovements === "number" ? kpis.recentMovements : null
    const recentMovements = rawRecent !== null && rawRecent > 0 ? rawRecent : null

    const rawPending = typeof kpis?.pendingMovements === "number" ? kpis.pendingMovements : null
    const pendingMovements = rawPending !== null && rawPending > 0 ? rawPending : null

    const fmtAccuracy = accuracy !== null ? accuracy.toFixed(1).replace(".", ",") : "—"
    const fmtTurnover = avgTurnover !== null ? avgTurnover.toFixed(1).replace(".", ",") : "—"

    const kpiItems: KPIData[] = [
        {
            label: "Nilai Inventori",
            value: fmtIDR(kpis?.totalValue ?? 0),
            unit: "Rp",
            foot: `${(kpis?.totalProducts ?? 0).toLocaleString("id-ID")} produk`,
        },
        {
            label: "Akurasi Stok",
            value: fmtAccuracy,
            unit: accuracy !== null ? "%" : undefined,
            deltaKind: accuracy !== null ? (accuracy >= 95 ? "up" : "down") : undefined,
            deltaText: accuracy !== null ? (accuracy >= 95 ? "▲ on target" : "▼ under target") : undefined,
            foot: "target ≥ 95%",
        },
        {
            label: "Stok Menipis",
            value: String(kpis?.lowStock ?? 0),
            foot: "perlu restock",
        },
        {
            label: "Avg Turnover",
            value: fmtTurnover,
            unit: avgTurnover !== null ? "x" : undefined,
            foot: "vs target 6,0x",
        },
        {
            label: "Pergerakan 7H",
            value: recentMovements !== null ? String(recentMovements) : "—",
            foot: pendingMovements !== null ? `${pendingMovements} pending` : "data belum tersedia",
        },
    ]

    const materialCols: ColumnDef<MaterialGapRow>[] = [
        {
            key: "code",
            header: "Kode",
            type: "code",
            render: (r) => getRowCode(r),
        },
        {
            key: "name",
            header: "Nama",
            type: "primary",
            render: (r) => r.name ?? "—",
        },
        {
            key: "stockOnHand",
            header: "Stok On-Hand",
            type: "num",
            render: (r) => Math.round(getRowStockOnHand(r)).toLocaleString("id-ID"),
        },
        {
            key: "requiredQty",
            header: "Dibutuhkan",
            type: "num",
            render: (r) => Math.round(getRowRequiredQty(r)).toLocaleString("id-ID"),
        },
        {
            key: "gapQty",
            header: "Gap",
            type: "num",
            render: (r) => {
                const g = getRowGapQty(r)
                return (
                    <span className={g > 0 ? "text-[var(--integra-red)]" : ""}>
                        {Math.round(g).toLocaleString("id-ID")}
                    </span>
                )
            },
        },
        {
            key: "urgencyDays",
            header: "Urgensi",
            type: "muted",
            render: (r) => {
                const d = getRowUrgencyDays(r)
                if (d === null) return "—"
                if (d >= 365) return "≥ 1 thn"
                return `${d} hari`
            },
        },
    ]

    return (
        <>
            {/* Topbar */}
            <div className={INT.topbar}>
                <div className={INT.breadcrumb}>
                    <span>Beranda</span>
                    <span>/</span>
                    <span className={INT.breadcrumbCurrent}>Inventori</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <IntegraButton variant="secondary" icon={<IconFilter className="w-3.5 h-3.5" />}>
                        Filter
                    </IntegraButton>
                    <IntegraButton variant="secondary" icon={<IconDownload className="w-3.5 h-3.5" />}>
                        Ekspor
                    </IntegraButton>
                    <IntegraButton
                        variant="primary"
                        icon={<IconPlus className="w-3.5 h-3.5" />}
                        href="/inventory/adjustments"
                    >
                        Stok Masuk
                    </IntegraButton>
                </div>
            </div>

            {/* Page content */}
            <div className="px-6 py-5 space-y-3">
                {/* Page head */}
                <PageHead
                    title="Pusat Komando Logistik"
                    subtitle="Monitoring gudang & material real-time"
                    metaRight={
                        <div className="flex items-center gap-5 text-[12px] text-[var(--integra-muted)]">
                            <span className="flex items-center gap-2">
                                <LiveDot />
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">LIVE</span>
                            </span>
                            <span>
                                Sinkron{" "}
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    {fmtDateTime(new Date())}
                                </span>
                            </span>
                            <span>
                                Fiskal{" "}
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    {fiscalLabel()}
                                </span>
                            </span>
                        </div>
                    }
                />

                {/* Section 1: KPI Rail */}
                <KPIRail items={kpiItems} />

                {/* Section 2: Material Gap (2/3) + Gudang Aktif (1/3) */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                        <Panel
                            title="Material Gap Analysis"
                            meta={`${materialGap.length} item`}
                            actions={
                                <Link
                                    href="/inventory/alerts"
                                    className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                                >
                                    Lihat semua →
                                </Link>
                            }
                            bodyClassName="p-0"
                        >
                            {materialGap.length === 0 ? (
                                <EmptyState title="Tidak ada gap material" />
                            ) : (
                                <DataTable
                                    columns={materialCols}
                                    rows={materialGap.slice(0, 8)}
                                    rowKey={(r) => r.id}
                                />
                            )}
                        </Panel>
                    </div>
                    <Panel
                        title="Gudang Aktif"
                        meta={`${liveWarehouses.length}/${warehouses.length}`}
                        actions={
                            <Link
                                href="/inventory/warehouses"
                                className="text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                            >
                                Lihat semua →
                            </Link>
                        }
                        bodyClassName="p-0"
                    >
                        {liveWarehouses.length === 0 ? (
                            <EmptyState title="Belum ada gudang aktif" />
                        ) : (
                            <ul className="m-0 p-0 list-none">
                                {liveWarehouses.map((w, i) => (
                                    <li
                                        key={w.id}
                                        className={`px-3.5 py-2.5 ${i < liveWarehouses.length - 1 ? "border-b border-[var(--integra-hairline)]" : ""}`}
                                    >
                                        <div className="flex items-baseline justify-between gap-2">
                                            <span className="text-[13px] text-[var(--integra-ink)]">
                                                {w.code} · {w.name}
                                            </span>
                                            <span className="text-[11px] text-[var(--integra-muted)] text-right">
                                                {w.manager ?? "—"}
                                            </span>
                                        </div>
                                        <div className="text-[11.5px] text-[var(--integra-muted)] mt-0.5">
                                            {w.staff} staf · {w.activePOs} PO aktif · {w.pendingTasks} tugas
                                        </div>
                                        <div className="mt-2">
                                            <UtilBar
                                                value={w.utilization}
                                                rightText={`${w.utilization}%`}
                                                thresholds={{ red: 90, amber: 70 }}
                                            />
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>

                {/* Section 3: Insight Pengadaan + Aksi Cepat (2 col equal) */}
                <div className="grid grid-cols-2 gap-3">
                    <Panel title="Insight Pengadaan" bodyClassName="p-0">
                        <ul className="m-0 p-0 list-none">
                            <ProcurementRow
                                label="Items Kritikal"
                                value={String(procurement?.summary?.itemsCriticalCount ?? 0)}
                            />
                            <ProcurementRow
                                label="Restock Cost"
                                value={fmtIDRJt(procurement?.summary?.totalRestockCost ?? 0)}
                            />
                            <ProcurementRow
                                label="Inbound"
                                value={String(procurement?.summary?.totalIncoming ?? 0)}
                            />
                            <ProcurementRow
                                label="Pending Approval"
                                value={String(procurement?.summary?.pendingApproval ?? 0)}
                                isLast
                            />
                        </ul>
                    </Panel>

                    <Panel title="Aksi Cepat" bodyClassName="p-3.5">
                        <div className="grid grid-cols-2 gap-2">
                            <IntegraButton
                                variant="secondary"
                                icon={<IconAdjustments className="w-3.5 h-3.5" />}
                                href="/inventory/adjustments"
                            >
                                Adjustment Stok
                            </IntegraButton>
                            <IntegraButton
                                variant="secondary"
                                icon={<IconClipboardList className="w-3.5 h-3.5" />}
                                href="/inventory/audit"
                            >
                                Stock Opname
                            </IntegraButton>
                            <IntegraButton
                                variant="secondary"
                                icon={<IconArrowsLeftRight className="w-3.5 h-3.5" />}
                                href="/inventory/transfers"
                            >
                                Transfer Stok
                            </IntegraButton>
                            <IntegraButton
                                variant="secondary"
                                icon={<IconBox className="w-3.5 h-3.5" />}
                                href="/inventory/products/new"
                            >
                                Tambah Produk
                            </IntegraButton>
                        </div>
                    </Panel>
                </div>
            </div>
        </>
    )
}

function ProcurementRow({
    label,
    value,
    isLast,
}: {
    label: string
    value: string
    isLast?: boolean
}) {
    return (
        <li
            className={`flex items-baseline justify-between px-3.5 py-2.5 ${isLast ? "" : "border-b border-[var(--integra-hairline)]"}`}
        >
            <span className="text-[12.5px] text-[var(--integra-muted)]">{label}</span>
            <span className="font-mono text-[18px] tracking-[-0.02em] text-[var(--integra-ink)]">
                {value}
            </span>
        </li>
    )
}

function fiscalLabel(): string {
    const now = new Date()
    const fy = `FY${String(now.getFullYear()).slice(2)}`
    const month = now.getMonth()
    const q = month < 3 ? "Q1" : month < 6 ? "Q2" : month < 9 ? "Q3" : "Q4"
    return `${fy} ${q}`
}
