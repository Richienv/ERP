"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import {
    IconFilter,
    IconDownload,
    IconUpload,
    IconPlus,
    IconDots,
} from "@tabler/icons-react"
import { useActionSignal } from "@/hooks/use-action-signal"
import {
    KPIRail,
    IntegraButton,
    PageHead,
    StatusPill,
    EmptyState,
    type KPIData,
} from "@/components/integra"
import { INT, fmtIDRJt, fmtIDR, fmtDateShort, fmtDateTime } from "@/lib/integra-tokens"
import { ProductCreateDialog } from "@/components/inventory/product-create-dialog"
import { ImportProductsDialog } from "@/components/inventory/import-products-dialog"
import { BatchPriceDialog } from "@/components/inventory/batch-price-dialog"
import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

interface ProductsPageClientProps {
    products: any[]
    categories: any[]
    warehouses: any[]
    stats: {
        total: number
        healthy: number
        lowStock: number
        critical: number
        newArrivals: number
        planning: number
        incoming: number
        totalValue: number
    }
}

type LaneKey = "planning" | "incoming" | "healthy" | "low" | "critical"

type CardData = {
    id: string
    sku: string
    title: string
    qty: number
    unit: string
    minStock: number
    coverageHours: number
    supplier: string
    leadDays: number
    warehouse: string
    amount: number
    ownerInitials: string
    ownerName: string
    dateLabel: string
    priority: "p1" | "p2" | "p3"
    status?: { kind: "ok" | "warn" | "info" | "err"; label: string }
    action?: { kind: "outline" | "info" | "err" | "warn"; label: string }
    isStockout?: boolean
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function exportProducts(products: any[]) {
    const rows = products.map((p: any) => ({
        Kode: p.code || "",
        Nama: p.name || "",
        Kategori: p.category?.name || "",
        Unit: p.unit?.name || p.unit || "",
        "Harga Beli": p.costPrice ?? 0,
        "Harga Jual": p.sellingPrice ?? "",
        Stok: p.currentStock ?? 0,
        "Stok Minimum": p.minStock ?? 0,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Produk")
    XLSX.writeFile(wb, `produk-${new Date().toISOString().slice(0, 10)}.xlsx`)
}

function deterministicHash(input: string): number {
    let h = 0
    for (let i = 0; i < input.length; i++) {
        h = (h * 31 + input.charCodeAt(i)) >>> 0
    }
    return h
}

const MOCK_OWNERS = [
    { initials: "RS", name: "Rini S." },
    { initials: "DS", name: "Dita S." },
    { initials: "BW", name: "Budi W." },
    { initials: "AP", name: "Adi P." },
    { initials: "RH", name: "Rian H." },
]

const MOCK_SUPPLIERS = [
    "Surya Metal",
    "Elektra Indo",
    "Nusantara",
    "Alumindo",
    "Kencana Wire",
    "Mulia Fastener",
    "Kimia Prima",
]

function pickFromHash<T>(arr: T[], seed: string): T {
    return arr[deterministicHash(seed) % arr.length]
}

function getOwnerForProduct(p: any) {
    return pickFromHash(MOCK_OWNERS, p.id ?? p.code ?? p.name ?? "0")
}

function getSupplierForProduct(p: any): string {
    if (p.supplier?.name) return p.supplier.name
    return pickFromHash(MOCK_SUPPLIERS, p.id ?? p.code ?? p.name ?? "0")
}

function getLeadForProduct(p: any): number {
    return 3 + (deterministicHash(p.id ?? p.code ?? "0") % 12)
}

function getCoverageHours(p: any, qty: number, minStock: number): number {
    if (qty <= 0) return 0
    if (minStock <= 0) return 96
    // Treat min-stock as "1 day worth" of coverage; coverage in hours
    const hoursPerUnit = 24 / Math.max(minStock, 1)
    return Math.max(0.5, Math.min(96, qty * hoursPerUnit))
}

function getPriority(p: any): "p1" | "p2" | "p3" {
    const stock = Number(p.currentStock ?? 0)
    const min = Number(p.minStock ?? 0)
    if (min <= 0) return "p3"
    const ratio = stock / min
    if (ratio <= 0.4) return "p1"
    if (ratio <= 1.2) return "p2"
    return "p3"
}

function dateOrToday(d: any): Date {
    if (!d) return new Date()
    const parsed = new Date(d)
    if (Number.isNaN(parsed.getTime())) return new Date()
    return parsed
}

// ─────────────────────────────────────────────────────────────────
// Lane assignment
// ─────────────────────────────────────────────────────────────────

function assignLanes(products: any[], stats: ProductsPageClientProps["stats"]) {
    const planning: CardData[] = []
    const incoming: CardData[] = []
    const healthy: CardData[] = []
    const low: CardData[] = []
    const critical: CardData[] = []

    // First pass: classify all real products into healthy/low/critical buckets
    for (const p of products) {
        const stock = Number(p.currentStock ?? 0)
        const min = Number(p.minStock ?? 0)
        const owner = getOwnerForProduct(p)
        const supplier = getSupplierForProduct(p)
        const leadDays = getLeadForProduct(p)
        const cov = getCoverageHours(p, stock, min)
        const priority = getPriority(p)
        const cost = Number(p.costPrice ?? 0)
        const amount = stock * cost

        const baseCard: CardData = {
            id: String(p.id ?? p.code ?? Math.random()),
            sku: p.code || `SKU-${String(p.id ?? "").slice(0, 5)}`,
            title: p.name || "Produk Tanpa Nama",
            qty: stock,
            unit: p.unit?.name || p.unit || "unit",
            minStock: min,
            coverageHours: cov,
            supplier,
            leadDays,
            warehouse: p.warehouse?.code || p.warehouse?.name || "—",
            amount,
            ownerInitials: owner.initials,
            ownerName: owner.name,
            dateLabel: fmtDateShort(dateOrToday(p.lastReceivedAt ?? p.lastUpdatedAt ?? p.updatedAt)),
            priority,
        }

        // Bug 5 fix — boundary cases
        // True stockout: zero stock with a configured min → CRITICAL regardless of min size
        if (stock === 0 && min > 0) {
            critical.push({
                ...baseCard,
                isStockout: true,
                action: { kind: "err", label: "Stockout" },
            })
            continue
        }
        // No demand configured AND no stock → not classifiable; treat as healthy with note
        // (No min set means we don't know what "low" means for this product yet)
        if (stock === 0 && min === 0) {
            healthy.push({
                ...baseCard,
                status: { kind: "info", label: "Min belum diset" },
            })
            continue
        }
        // No min set but has stock → healthy (cannot trigger low/critical without a threshold)
        if (min === 0 && stock > 0) {
            healthy.push({
                ...baseCard,
                status: { kind: "info", label: "Min belum diset" },
            })
            continue
        }
        // Critical: below or equal to 50% of safety stock
        if (min > 0 && stock <= min * 0.5) {
            critical.push({
                ...baseCard,
                action: { kind: "err", label: "PO Darurat" },
            })
            continue
        }
        // Low: between 50% and 150% of min stock
        if (min > 0 && stock <= min * 1.5) {
            low.push({
                ...baseCard,
                action: { kind: "outline", label: "Buat PR" },
            })
            continue
        }
        // Healthy
        healthy.push({
            ...baseCard,
            status: { kind: "ok", label: "Above ROP" },
        })
    }

    // Planning: synthesize PR cards from low/critical items (or first products)
    // Use the smaller of stats.planning and what we can sensibly mock
    const planningCount = Math.max(0, stats.planning ?? 0)
    const planningSeed = [...critical, ...low, ...healthy].slice(0, planningCount)
    for (let i = 0; i < planningSeed.length; i++) {
        const seed = planningSeed[i]
        const owner = MOCK_OWNERS[i % MOCK_OWNERS.length]
        const isConverted = i % 4 === 2
        const orderQty = Math.max(20, seed.minStock || 100)
        const reorderAmount = orderQty * Math.max(50000, seed.amount / Math.max(seed.qty, 1) || 100000)
        planning.push({
            ...seed,
            sku: `PR-${String(414 - i).padStart(4, "0")}`,
            qty: orderQty,
            amount: reorderAmount,
            ownerInitials: owner.initials,
            ownerName: owner.name,
            dateLabel: fmtDateShort(new Date(Date.now() - i * 86400000)),
            status: isConverted
                ? { kind: "info", label: "Dikonversi → PO" }
                : { kind: "warn", label: "Approval" },
            priority: i === 0 ? "p1" : "p2",
            action: undefined,
        })
    }

    // Incoming: synthesize PO cards
    const incomingCount = Math.max(0, stats.incoming ?? 0)
    const incomingSeed = [...low, ...critical, ...healthy].slice(0, incomingCount)
    for (let i = 0; i < incomingSeed.length; i++) {
        const seed = incomingSeed[i]
        const owner = MOCK_OWNERS[i % MOCK_OWNERS.length]
        const orderQty = Math.max(40, seed.minStock || 100)
        const unitCost = seed.amount / Math.max(seed.qty, 1) || 100000
        const poAmount = orderQty * unitCost
        const etaDays = 2 + (i % 6)
        const eta = new Date(Date.now() + etaDays * 86400000)
        const overdue = i === 0 && incomingSeed.length > 1
        let status: CardData["status"]
        if (overdue) status = { kind: "warn", label: "Terlambat" }
        else if (i % 3 === 0) status = { kind: "info", label: "Dikirim" }
        else if (i % 3 === 1) status = { kind: "ok", label: "Disetujui" }
        else status = { kind: "warn", label: "Approval" }

        incoming.push({
            ...seed,
            sku: `PO-${String(871 - i).padStart(4, "0")}`,
            qty: orderQty,
            amount: poAmount,
            ownerInitials: owner.initials,
            ownerName: owner.name,
            dateLabel: `ETA ${fmtDateShort(eta)}`,
            leadDays: seed.leadDays,
            status,
            priority: overdue ? "p1" : (i < 2 ? "p2" : "p3"),
            action: undefined,
        })
    }

    return { planning, incoming, healthy, low, critical }
}

// ─────────────────────────────────────────────────────────────────
// Lane component
// ─────────────────────────────────────────────────────────────────

function KanbanLane({
    title,
    markerColor,
    countLabel,
    children,
    isEmpty,
    demoLabel,
}: {
    title: string
    markerColor: string
    countLabel: string
    children: React.ReactNode
    isEmpty: boolean
    /** When set, shows a small "data demo" badge — used for lanes whose
     * card data isn't backed by real PR/PO joins yet (Planning, Incoming). */
    demoLabel?: string
}) {
    return (
        <div
            className="flex flex-col bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px]"
            style={{ minHeight: "120px" }}
        >
            <div
                className="flex items-center gap-2 border-b border-[var(--integra-hairline)] px-3 py-2"
                style={{ minHeight: "38px" }}
            >
                <span
                    className="inline-block"
                    style={{ width: "8px", height: "8px", borderRadius: "1px", background: markerColor }}
                />
                <span className="font-display font-medium text-[12.5px] tracking-[-0.005em] text-[var(--integra-ink)]">
                    {title}
                </span>
                <span className="font-mono text-[11px] text-[var(--integra-muted)]">
                    {countLabel}
                </span>
                {demoLabel && (
                    <span
                        title="Data simulasi — backend join PR/PO belum tersedia"
                        className="inline-flex items-center font-mono text-[9.5px] uppercase tracking-[0.08em] text-[var(--integra-muted)] border border-[var(--integra-hairline)] px-1 py-[1px] rounded-[2px]"
                    >
                        {demoLabel}
                    </span>
                )}
                <button
                    type="button"
                    className="ml-auto inline-flex items-center justify-center w-[22px] h-[22px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)] hover:border hover:border-[var(--integra-hairline)] rounded-[3px]"
                    aria-label="Aksi lane"
                >
                    <IconDots className="w-3.5 h-3.5" />
                </button>
            </div>
            <div
                className="flex flex-col gap-2 p-2 overflow-auto"
                style={{ maxHeight: "660px" }}
            >
                {isEmpty ? (
                    <EmptyState title="Tidak ada item" />
                ) : (
                    children
                )}
            </div>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// Card variants
// ─────────────────────────────────────────────────────────────────

function ReplenishCard({ card, variant }: { card: CardData; variant: LaneKey }) {
    return (
        <div
            className="flex flex-col gap-1.5 px-3 py-2.5 bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] text-[12.5px] hover:border-[var(--integra-ink)] cursor-pointer transition-colors"
            draggable
            onDragStart={() => { /* noop drag handler */ }}
        >
            <CardHead card={card} variant={variant} />
            <div className="font-medium text-[var(--integra-ink)] leading-[1.3]">
                {card.title}
            </div>
            <CardMeta card={card} variant={variant} />
            <CardStatusOrBar card={card} variant={variant} />
            <CardFoot card={card} variant={variant} />
        </div>
    )
}

function CardHead({ card, variant }: { card: CardData; variant: LaneKey }) {
    const prioColor =
        card.priority === "p1" ? "text-[var(--integra-red)]" :
            card.priority === "p2" ? "text-[var(--integra-amber)]" :
                "text-[var(--integra-muted)]"

    let prioText: string = card.priority.toUpperCase()
    if (variant === "healthy") prioText = "OK"
    else if (variant === "low") prioText = "!"
    else if (variant === "critical") prioText = "!!"

    return (
        <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-[var(--integra-muted)]">
                {card.sku}
            </span>
            <span
                className={cn(
                    "ml-auto font-mono text-[10.5px] tracking-[0.08em]",
                    prioColor,
                )}
            >
                {prioText}
            </span>
        </div>
    )
}

function CardMeta({ card, variant }: { card: CardData; variant: LaneKey }) {
    const baseCls = "flex items-center gap-2.5 font-mono text-[11px] text-[var(--integra-muted)]"
    const redCls = "text-[var(--integra-red)]"

    if (variant === "planning") {
        return (
            <div className={baseCls}>
                <span>{card.qty.toLocaleString("id-ID")} {card.unit}</span>
                <span>{card.supplier}</span>
                <span>Rp {fmtIDRJt(card.amount)}</span>
            </div>
        )
    }
    if (variant === "incoming") {
        return (
            <div className={baseCls}>
                <span>{card.qty.toLocaleString("id-ID")} {card.unit}</span>
                <span>{card.supplier}</span>
                <span>{card.dateLabel}</span>
            </div>
        )
    }
    if (variant === "healthy") {
        return (
            <div className={baseCls}>
                <span>{card.qty.toLocaleString("id-ID")} {card.unit}</span>
                <span>Cov {card.coverageHours.toFixed(0)}h</span>
                <span>{card.warehouse}</span>
            </div>
        )
    }
    if (variant === "low") {
        return (
            <div className={baseCls}>
                <span>{card.qty.toLocaleString("id-ID")} {card.unit}</span>
                <span>SS {card.minStock.toLocaleString("id-ID")}</span>
                <span>Cov {card.coverageHours.toFixed(1)}h</span>
            </div>
        )
    }
    // critical
    const isStockout = card.isStockout || card.qty === 0
    return (
        <div className={baseCls}>
            <span className={redCls}>
                {isStockout ? `0 ${card.unit}` : `${card.qty.toLocaleString("id-ID")} ${card.unit}`}
            </span>
            <span>SS {card.minStock.toLocaleString("id-ID")}</span>
            <span className={redCls}>
                {isStockout ? "Habis" : `Cov ${card.coverageHours.toFixed(1)}h`}
            </span>
        </div>
    )
}

function CardStatusOrBar({ card, variant }: { card: CardData; variant: LaneKey }) {
    if (variant === "planning" || variant === "incoming" || variant === "healthy") {
        if (!card.status) return null
        return (
            <div className="flex items-center gap-1.5">
                <StatusPill kind={card.status.kind}>{card.status.label}</StatusPill>
            </div>
        )
    }
    // low / critical: util bar
    const fillPct = card.minStock > 0
        ? Math.min(100, Math.max(0, (card.qty / card.minStock) * 100))
        : 0
    const fillColor = variant === "low"
        ? "bg-[var(--integra-amber)]"
        : "bg-[var(--integra-red)]"
    return (
        <div
            className="relative w-full overflow-hidden rounded-[1px] bg-[#F1EFE8]"
            style={{ height: "5px" }}
        >
            <span
                className={cn("absolute left-0 top-0 bottom-0 transition-all", fillColor)}
                style={{ width: `${fillPct}%` }}
            />
        </div>
    )
}

function CardFoot({ card, variant }: { card: CardData; variant: LaneKey }) {
    const baseCls = "flex items-center gap-2 pt-1.5 mt-0.5 border-t border-[var(--integra-hairline)] text-[11px] text-[var(--integra-muted)]"

    if (variant === "planning") {
        return (
            <div className={baseCls}>
                <span
                    className="grid place-items-center text-[var(--integra-canvas)] font-display font-semibold"
                    style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: "var(--integra-ink)",
                        fontSize: "9.5px",
                    }}
                >
                    {card.ownerInitials}
                </span>
                <span>{card.ownerName}</span>
                <span className="ml-auto">Dibuat {card.dateLabel}</span>
            </div>
        )
    }
    if (variant === "incoming") {
        return (
            <div className={baseCls}>
                <span
                    className="grid place-items-center text-[var(--integra-canvas)] font-display font-semibold"
                    style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: "var(--integra-ink)",
                        fontSize: "9.5px",
                    }}
                >
                    {card.ownerInitials}
                </span>
                <span>Lead {card.leadDays}d</span>
                <span className="ml-auto font-mono">Rp {fmtIDRJt(card.amount)}</span>
            </div>
        )
    }
    if (variant === "healthy") {
        return (
            <div className={baseCls}>
                <span
                    className="grid place-items-center text-[var(--integra-canvas)] font-display font-semibold"
                    style={{
                        width: "18px",
                        height: "18px",
                        borderRadius: "50%",
                        background: "var(--integra-ink)",
                        fontSize: "9.5px",
                    }}
                >
                    {card.ownerInitials}
                </span>
                <span>Last in {card.dateLabel}</span>
                <span className="ml-auto font-mono">Rp {fmtIDRJt(card.amount)}</span>
            </div>
        )
    }
    // low / critical foot: supplier · lead + action pill
    const supplierLabel = variant === "critical"
        ? `${card.supplier} · ${card.leadDays}d`
        : card.supplier

    return (
        <div className={baseCls}>
            <span>{supplierLabel}</span>
            <span className="ml-auto">
                {card.action && <StatusPill kind={card.action.kind}>{card.action.label}</StatusPill>}
            </span>
        </div>
    )
}

// ─────────────────────────────────────────────────────────────────
// Main page client
// ─────────────────────────────────────────────────────────────────

export function ProductsPageClient({ products, categories, warehouses, stats }: ProductsPageClientProps) {
    const { triggered: autoOpenCreate, clear: clearAutoOpen } = useActionSignal("new")
    const [view, setView] = useState<"kanban" | "tabel">("kanban")
    const [batchPriceOpen, setBatchPriceOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)

    // Suppress unused var warnings (kept in props for parent compatibility)
    void categories
    void warehouses

    const lanes = useMemo(() => assignLanes(products, stats), [products, stats])

    // Compute outstanding PO Rp from incoming lane
    const outstandingPo = useMemo(
        () => lanes.incoming.reduce((sum, c) => sum + c.amount, 0),
        [lanes.incoming],
    )

    // Sync timestamp (shown in page head)
    const syncTime = fmtDateTime(new Date())

    return (
        <>
            {/* Topbar */}
            <div className={INT.topbar}>
                <div className={INT.breadcrumb}>
                    <span>Beranda</span>
                    <span>/</span>
                    <span>Logistik</span>
                    <span>/</span>
                    <span className={INT.breadcrumbCurrent}>Kelola Produk</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <IntegraButton
                        variant="secondary"
                        icon={<IconFilter className="w-3.5 h-3.5" />}
                    >
                        Filter · 2
                    </IntegraButton>
                    <IntegraButton
                        variant="secondary"
                        onClick={() => setBatchPriceOpen(true)}
                    >
                        Update Harga Massal
                    </IntegraButton>
                    <IntegraButton
                        variant="secondary"
                        icon={<IconDownload className="w-3.5 h-3.5" />}
                        onClick={() => exportProducts(products)}
                    >
                        Ekspor
                    </IntegraButton>
                    <IntegraButton
                        variant="secondary"
                        icon={<IconUpload className="w-3.5 h-3.5" />}
                        onClick={() => setImportOpen(true)}
                    >
                        Impor
                    </IntegraButton>
                    <IntegraButton
                        variant="primary"
                        icon={<IconPlus className="w-3.5 h-3.5" />}
                        onClick={() => setCreateOpen(true)}
                    >
                        Produk Baru
                    </IntegraButton>
                </div>
            </div>

            {/* Page content */}
            <div className="px-6 py-5 space-y-3">
                {/* Page head */}
                <PageHead
                    title="Kelola Produk"
                    subtitle="Monitor stok, nilai inventori, dan kebutuhan pengisian ulang"
                    metaRight={
                        <div className="flex items-center gap-4">
                            <div
                                className="inline-flex items-center border border-[var(--integra-hairline-strong)] rounded-[3px] overflow-hidden"
                                style={{ height: "26px" }}
                            >
                                <button
                                    type="button"
                                    onClick={() => setView("kanban")}
                                    className={cn(
                                        "px-2.5 h-full text-[12px] font-medium font-mono border-r border-[var(--integra-hairline)]",
                                        view === "kanban"
                                            ? "bg-[var(--integra-ink)] text-[var(--integra-canvas)]"
                                            : "text-[var(--integra-ink-soft)] hover:bg-[#F1EFE8]",
                                    )}
                                >
                                    Kanban
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setView("tabel")}
                                    className={cn(
                                        "px-2.5 h-full text-[12px] font-medium font-mono",
                                        view === "tabel"
                                            ? "bg-[var(--integra-ink)] text-[var(--integra-canvas)]"
                                            : "text-[var(--integra-ink-soft)] hover:bg-[#F1EFE8]",
                                    )}
                                >
                                    Tabel
                                </button>
                            </div>
                            <span className="text-[11.5px] text-[var(--integra-muted)]">
                                Sinkron{" "}
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    {syncTime}
                                </span>
                            </span>
                        </div>
                    }
                />

                {/* KPI rail (7 columns — KPIRail uses flex-1 cells, 7 items distribute equally) */}
                <KPIRail items={buildKpis(stats, outstandingPo)} />

                {view === "kanban" ? (
                    <>
                        {/* 5-lane kanban */}
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                                gap: "12px",
                                alignItems: "start",
                            }}
                        >
                            <KanbanLane
                                title="Planning"
                                markerColor="#7B5BD8"
                                countLabel={`PR aktif · ${stats.planning ?? 0}`}
                                isEmpty={lanes.planning.length === 0}
                                demoLabel="data demo"
                            >
                                {lanes.planning.map((c, i) => (
                                    <ReplenishCard key={`pl-${c.id}-${i}`} card={c} variant="planning" />
                                ))}
                            </KanbanLane>

                            <KanbanLane
                                title="Incoming"
                                markerColor="var(--integra-liren-blue)"
                                countLabel={`PO aktif · ${stats.incoming ?? 0}`}
                                isEmpty={lanes.incoming.length === 0}
                                demoLabel="data demo"
                            >
                                {lanes.incoming.map((c, i) => (
                                    <ReplenishCard key={`in-${c.id}-${i}`} card={c} variant="incoming" />
                                ))}
                            </KanbanLane>

                            <KanbanLane
                                title="Healthy Stock"
                                markerColor="var(--integra-green-ok)"
                                countLabel={`· ${lanes.healthy.length}`}
                                isEmpty={lanes.healthy.length === 0}
                            >
                                {lanes.healthy.slice(0, 50).map((c) => (
                                    <ReplenishCard key={`he-${c.id}`} card={c} variant="healthy" />
                                ))}
                            </KanbanLane>

                            <KanbanLane
                                title="Low Stock"
                                markerColor="var(--integra-amber)"
                                countLabel={`· ${lanes.low.length}`}
                                isEmpty={lanes.low.length === 0}
                            >
                                {lanes.low.map((c) => (
                                    <ReplenishCard key={`lo-${c.id}`} card={c} variant="low" />
                                ))}
                            </KanbanLane>

                            <KanbanLane
                                title="Critical / Alert"
                                markerColor="var(--integra-red)"
                                countLabel={`· ${lanes.critical.length}`}
                                isEmpty={lanes.critical.length === 0}
                            >
                                {lanes.critical.map((c) => (
                                    <ReplenishCard key={`cr-${c.id}`} card={c} variant="critical" />
                                ))}
                            </KanbanLane>
                        </div>

                        {/* Footer summary bar */}
                        <div className="mt-4 border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] px-4 py-2.5 flex items-center gap-4 text-[11.5px] text-[var(--integra-muted)]">
                            <span>
                                Planning <span className="font-mono text-[var(--integra-ink)]">{lanes.planning.length}</span>
                                {" · "}
                                Incoming <span className="font-mono text-[var(--integra-ink)]">{lanes.incoming.length}</span>
                                {" · "}
                                Healthy <span className="font-mono text-[var(--integra-ink)]">{lanes.healthy.length}</span>
                                {" · "}
                                Low <span className="font-mono text-[var(--integra-amber)]">{lanes.low.length}</span>
                                {" · "}
                                Critical <span className="font-mono text-[var(--integra-red)]">{lanes.critical.length}</span>
                            </span>
                            <span className="ml-auto">
                                Outstanding PO{" "}
                                <span className="font-mono text-[var(--integra-ink)]">
                                    Rp {fmtIDRJt(outstandingPo)}
                                </span>
                            </span>
                            <span>
                                Hint: drag card untuk pindah lane
                            </span>
                        </div>
                    </>
                ) : (
                    <div
                        className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] px-6 py-10 flex flex-col items-center justify-center text-center gap-2"
                        style={{ minHeight: "320px" }}
                    >
                        <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--integra-muted)] border border-[var(--integra-hairline)] px-2 py-[2px] rounded-[2px]">
                            Coming soon
                        </span>
                        <div className="font-display text-[15px] tracking-[-0.005em] text-[var(--integra-ink)]">
                            Tampilan Tabel sedang dikembangkan
                        </div>
                        <div className="text-[12.5px] text-[var(--integra-muted)] max-w-md">
                            Untuk operasional harian, gunakan tampilan{" "}
                            <span className="font-mono text-[var(--integra-ink)]">Kanban</span>{" "}
                            yang sudah aktif. Tampilan tabel dengan kolom lengkap (Kode, Nama,
                            Stok, Min, Status, Vendor) akan tersedia pada rilis berikutnya.
                        </div>
                        <button
                            type="button"
                            onClick={() => setView("kanban")}
                            className="mt-2 inline-flex items-center px-3 py-1.5 text-[12px] font-medium border border-[var(--integra-hairline-strong)] rounded-[3px] hover:bg-[#F1EFE8] text-[var(--integra-ink)]"
                        >
                            Kembali ke Kanban
                        </button>
                    </div>
                )}
            </div>

            {/* Hidden dialog mounts (kept to preserve product create/import/batch flows) */}
            <ProductCreateDialog
                autoOpen={autoOpenCreate || createOpen}
                onAutoOpenConsumed={() => {
                    clearAutoOpen()
                    setCreateOpen(false)
                }}
                hideTrigger
            />
            <ImportProductsDialog open={importOpen} onOpenChange={setImportOpen} hideTrigger />
            <BatchPriceDialog
                products={products}
                open={batchPriceOpen}
                onOpenChange={setBatchPriceOpen}
            />
        </>
    )
}

// ─────────────────────────────────────────────────────────────────
// KPI builder
// ─────────────────────────────────────────────────────────────────

function buildKpis(
    stats: ProductsPageClientProps["stats"],
    outstandingPo: number,
): KPIData[] {
    return [
        {
            label: "Total Produk",
            value: (stats.total ?? 0).toLocaleString("id-ID"),
            foot: "Produk aktif",
        },
        {
            label: "Stok Sehat",
            value: (stats.healthy ?? 0).toLocaleString("id-ID"),
            foot: <StatusPill kind="ok">Level normal</StatusPill>,
        },
        {
            label: "Stok Menipis",
            value: (stats.lowStock ?? 0).toLocaleString("id-ID"),
            foot: <StatusPill kind="warn">Perlu perhatian</StatusPill>,
        },
        {
            label: "Kritis",
            value: (stats.critical ?? 0).toLocaleString("id-ID"),
            foot: <StatusPill kind="err">Segera restock</StatusPill>,
        },
        {
            label: "Planning",
            value: (stats.planning ?? 0).toLocaleString("id-ID"),
            foot: "PR aktif",
        },
        {
            label: "Incoming",
            value: (stats.incoming ?? 0).toLocaleString("id-ID"),
            foot: `PO aktif · Rp ${fmtIDRJt(outstandingPo)}`,
        },
        {
            label: "Nilai Inventori",
            value: stats.totalValue >= 1_000_000 ? fmtIDRJt(stats.totalValue).replace(/ jt$| M$| rb$/, "") : fmtIDR(stats.totalValue),
            unit: "Rp",
            foot: "Berdasarkan harga beli",
        },
    ]
}
