"use client"

import { useState } from "react"
import Link from "next/link"
import {
    Panel,
    KPIRail,
    IntegraButton,
    PageHead,
    LiveDot,
    SegmentedButtons,
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

type Period = "1H" | "7H" | "30H" | "TTD" | "12B"

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
    code: string
    stockOnHand: number
    requiredQty: number
    gapQty: number
    urgencyDays: number
}

export default function InventoryPage() {
    const [period, setPeriod] = useState<Period>("30H")
    const { data, isLoading } = useInventoryDashboard()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-blue-400" />
    }

    const { warehouses = [], kpis, materialGap = [], procurement } = data as {
        warehouses: Warehouse[]
        kpis: {
            totalValue: number
            totalProducts: number
            lowStock: number
            accuracy: number
            pendingMovements: number
            recentMovements: number
            avgTurnover: number
        }
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

    const accuracy = kpis?.accuracy ?? 0
    const avgTurnover = kpis?.avgTurnover ?? 0

    const kpiItems: KPIData[] = [
        {
            label: "Nilai Inventori",
            value: fmtIDR(kpis?.totalValue ?? 0),
            unit: "Rp",
            foot: `${(kpis?.totalProducts ?? 0).toLocaleString("id-ID")} produk`,
        },
        {
            label: "Akurasi Stok",
            value: accuracy.toFixed(1).replace(".", ","),
            unit: "%",
            deltaKind: accuracy >= 95 ? "up" : "down",
            deltaText: accuracy >= 95 ? "▲ on target" : "▼ under target",
            foot: "target ≥ 95%",
        },
        {
            label: "Stok Menipis",
            value: String(kpis?.lowStock ?? 0),
            foot: "perlu restock",
        },
        {
            label: "Avg Turnover",
            value: avgTurnover.toFixed(1).replace(".", ","),
            unit: "x",
            foot: "vs target 6,0x",
        },
        {
            label: "Pergerakan 7H",
            value: String(kpis?.recentMovements ?? 0),
            foot: `${kpis?.pendingMovements ?? 0} pending`,
        },
    ]

    const materialCols: ColumnDef<MaterialGapRow>[] = [
        {
            key: "code",
            header: "Kode",
            type: "code",
            render: (r) => r.code,
        },
        {
            key: "name",
            header: "Nama",
            type: "primary",
            render: (r) => r.name,
        },
        {
            key: "stockOnHand",
            header: "Stok On-Hand",
            type: "num",
            render: (r) => Math.round(r.stockOnHand).toLocaleString("id-ID"),
        },
        {
            key: "requiredQty",
            header: "Dibutuhkan",
            type: "num",
            render: (r) => Math.round(r.requiredQty).toLocaleString("id-ID"),
        },
        {
            key: "gapQty",
            header: "Gap",
            type: "num",
            render: (r) => (
                <span className={r.gapQty > 0 ? "text-[var(--integra-red)]" : ""}>
                    {Math.round(r.gapQty).toLocaleString("id-ID")}
                </span>
            ),
        },
        {
            key: "urgencyDays",
            header: "Urgensi",
            type: "muted",
            render: (r) => `${r.urgencyDays} hari`,
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
