"use client"

import { useMemo, useState, useEffect, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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

type RowStatus = "CRITICAL" | "STOCKOUT" | "LOW" | "HEALTHY" | "INCOMING" | "PLANNING"
type RowAction = "PO_DARURAT" | "STOCKOUT" | "BUAT_PR" | "PR_AKTIF" | "LACAK" | "LIHAT" | "REVIEW_PR"
type FilterTab = "all" | "critical" | "low" | "healthy" | "incoming" | "planning"

type ReplenishRow = {
    id: string
    sku: string
    title: string
    subRef: string
    category: string
    stock: number
    safety: number
    rop: number
    coverageHours: number | null
    leadHours: number
    supplier: string | null
    valueIdrJt: number
    status: RowStatus
    action: RowAction
}

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
// Replenishment table — row builder
// ─────────────────────────────────────────────────────────────────

function buildReplenishRows(
    products: any[],
    lanes: ReturnType<typeof assignLanes>,
): ReplenishRow[] {
    const rows: ReplenishRow[] = []
    // Build lookup of card by id for status mapping
    const idToStatus = new Map<string, RowStatus>()
    for (const c of lanes.critical) {
        idToStatus.set(c.id, c.isStockout ? "STOCKOUT" : "CRITICAL")
    }
    for (const c of lanes.low) idToStatus.set(c.id, "LOW")
    for (const c of lanes.healthy) idToStatus.set(c.id, "HEALTHY")
    // Mark a few healthy ones as INCOMING/PLANNING to mirror lane counts (demo data)
    const incomingMark = new Set(lanes.incoming.slice(0, lanes.incoming.length).map((c) => c.id))
    const planningMark = new Set(lanes.planning.slice(0, lanes.planning.length).map((c) => c.id))

    for (const p of products) {
        const id = String(p.id ?? p.code ?? Math.random())
        const stock = Number(p.currentStock ?? 0)
        const safety = Number(p.minStock ?? 0)
        const rop = safety > 0 ? Math.round(safety * 1.5) : 0
        const cost = Number(p.costPrice ?? 0)
        const valueIdr = stock * cost
        const valueJt = valueIdr / 1_000_000
        const supplier = p.supplier?.name ?? getSupplierForProduct(p)
        const leadDays = getLeadForProduct(p)
        const leadHours = leadDays * 24
        const cov = safety > 0 || stock > 0 ? getCoverageHours(p, stock, safety) : null
        const variantCount = Number(p.variantCount ?? 0)
        const subRef = variantCount > 1
            ? `${variantCount} varian · ${(p.code ?? "PRD").slice(0, 7).toUpperCase()}`
            : (p.code ?? "PRD").slice(0, 12).toUpperCase()
        const category = p.category?.name
            ? (p.subcategory?.name ? `${p.category.name} · ${p.subcategory.name}` : p.category.name)
            : "—"

        // Status precedence: STOCKOUT > CRITICAL > INCOMING > PLANNING > LOW > HEALTHY
        let status: RowStatus = idToStatus.get(id) ?? "HEALTHY"
        if (incomingMark.has(id) && status === "HEALTHY") status = "INCOMING"
        if (planningMark.has(id) && status === "HEALTHY") status = "PLANNING"

        const action: RowAction = (() => {
            if (status === "STOCKOUT") return "STOCKOUT"
            if (status === "CRITICAL") return "PO_DARURAT"
            if (status === "LOW") {
                // 30% chance of "PR_AKTIF" mock
                return deterministicHash(id) % 10 < 3 ? "PR_AKTIF" : "BUAT_PR"
            }
            if (status === "INCOMING") return "LACAK"
            if (status === "PLANNING") return "REVIEW_PR"
            return "LIHAT"
        })()

        rows.push({
            id,
            sku: p.code || `SKU-${String(p.id ?? "").slice(0, 5)}`,
            title: p.name || "Produk Tanpa Nama",
            subRef,
            category,
            stock,
            safety,
            rop,
            coverageHours: cov,
            leadHours,
            supplier,
            valueIdrJt: valueJt,
            status,
            action,
        })
    }
    return rows
}

function rowStatusLabel(s: RowStatus): string {
    return s === "CRITICAL" ? "Critical"
        : s === "STOCKOUT" ? "Stockout"
            : s === "LOW" ? "Low"
                : s === "HEALTHY" ? "Healthy"
                    : s === "INCOMING" ? "Incoming"
                        : "Planning"
}

function rowActionLabel(a: RowAction): string {
    if (a === "PO_DARURAT") return "PO Darurat"
    if (a === "STOCKOUT") return "Stockout"
    if (a === "BUAT_PR") return "Buat PR"
    if (a === "PR_AKTIF") return "PR Aktif"
    if (a === "LACAK") return "Lacak"
    if (a === "LIHAT") return "Lihat"
    return "Review PR"
}

function fmtCoverageNum(h: number): string {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(h)
}

function fmtJt(n: number): string {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(n)
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
// Replenishment Table View — corporate, light, structured grid
// ─────────────────────────────────────────────────────────────────

const TOOL_BTN = "inline-flex items-center gap-1.5 h-[26px] px-2.5 bg-transparent border-0 rounded-[3px] text-[12px] text-[var(--integra-ink-soft)] hover:bg-[#FAF9F5] hover:text-[var(--integra-ink)] transition-colors"
const TOOL_ICO = "w-[13px] h-[13px] opacity-75"

function ToolbarIcon({ children }: { children: React.ReactNode }) {
    return (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" className={TOOL_ICO}>
            {children}
        </svg>
    )
}

function ReplenishToolbar({
    filterTab,
    setFilterTab,
    counts,
}: {
    filterTab: FilterTab
    setFilterTab: (t: FilterTab) => void
    counts: { all: number; critical: number; low: number; healthy: number; incoming: number; planning: number }
}) {
    const tabBase = "h-[22px] px-[9px] bg-transparent border-0 rounded-[2px] text-[11.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)] transition-colors"
    const tabOn = "bg-[var(--integra-canvas-pure)] text-[var(--integra-ink)] font-medium shadow-[0_0_0_0.5px_var(--integra-hairline-strong)]"
    const isOn = (k: FilterTab) => filterTab === k

    return (
        <div
            className="flex items-center gap-1 flex-wrap bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] px-2 py-1.5 mb-2.5"
        >
            <button type="button" className={TOOL_BTN}>
                <ToolbarIcon>
                    <rect x="2" y="3" width="5" height="4" />
                    <rect x="9" y="3" width="5" height="4" />
                    <rect x="2" y="9" width="5" height="4" />
                    <rect x="9" y="9" width="5" height="4" />
                </ToolbarIcon>
                Grup
            </button>
            <button type="button" className={TOOL_BTN}>
                <ToolbarIcon>
                    <path d="M2 8s2-4 6-4 6 4 6 4-2 4-6 4-6-4-6-4z" />
                    <circle cx="8" cy="8" r="1.6" />
                    <path d="M3 13L13 3" />
                </ToolbarIcon>
                Sembunyikan
            </button>
            <button type="button" className={TOOL_BTN}>
                <ToolbarIcon>
                    <path d="M2 4h12L10 9v4l-4 1V9z" />
                </ToolbarIcon>
                Filter
                <span className="font-mono text-[10.5px] bg-[var(--integra-liren-blue-soft)] text-[var(--integra-liren-blue)] px-[5px] rounded-[2px] leading-[16px]">
                    2
                </span>
            </button>
            <button type="button" className={TOOL_BTN}>
                <ToolbarIcon>
                    <path d="M3 5h10M3 8h7M3 11h4" />
                    <path d="M11 9l2 2 2-2M13 6v5" />
                </ToolbarIcon>
                Urutkan
            </button>
            <span className="w-px h-4 bg-[var(--integra-hairline)] mx-1" />
            <button type="button" className={TOOL_BTN}>
                <ToolbarIcon>
                    <path d="M3 9v3h10V9M8 2v8M5 5l3-3 3 3" />
                </ToolbarIcon>
                Bagikan
            </button>
            <button type="button" className={TOOL_BTN}>
                <ToolbarIcon>
                    <rect x="3" y="3" width="10" height="10" />
                    <path d="M8 6v4M6 8h4" />
                </ToolbarIcon>
                Catatan Baru
            </button>
            <button type="button" className={TOOL_BTN}>
                <ToolbarIcon>
                    <rect x="2" y="3" width="12" height="10" />
                    <path d="M2 7h12" />
                    <path d="M9 5v6" />
                </ToolbarIcon>
                Kolom Baru
            </button>
            <div className="flex-1 min-w-2" />
            {/* Segmented filter tabs */}
            <div className="inline-flex items-center bg-[var(--integra-canvas)] rounded-[3px] p-[2px] gap-0">
                <button type="button" onClick={() => setFilterTab("all")} className={cn(tabBase, isOn("all") && tabOn)}>
                    Semua · <span className="font-mono text-[11px]">{counts.all}</span>
                </button>
                <button type="button" onClick={() => setFilterTab("critical")} className={cn(tabBase, isOn("critical") && tabOn)}>
                    Critical · <span className="font-mono text-[11px] text-[var(--integra-red)]">{counts.critical}</span>
                </button>
                <button type="button" onClick={() => setFilterTab("low")} className={cn(tabBase, isOn("low") && tabOn)}>
                    Low · <span className="font-mono text-[11px] text-[var(--integra-amber)]">{counts.low}</span>
                </button>
                <button type="button" onClick={() => setFilterTab("healthy")} className={cn(tabBase, isOn("healthy") && tabOn)}>
                    Healthy · <span className="font-mono text-[11px]">{counts.healthy}</span>
                </button>
                <button type="button" onClick={() => setFilterTab("incoming")} className={cn(tabBase, isOn("incoming") && tabOn)}>
                    Incoming · <span className="font-mono text-[11px]">{counts.incoming}</span>
                </button>
                <button type="button" onClick={() => setFilterTab("planning")} className={cn(tabBase, isOn("planning") && tabOn)}>
                    Planning · <span className="font-mono text-[11px]">{counts.planning}</span>
                </button>
            </div>
        </div>
    )
}

function StatusCellPill({ status }: { status: RowStatus }) {
    if (status === "PLANNING") {
        return (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-[2px] bg-[#E8E5F6] text-[#4B3A7A]">
                <span className="inline-block w-[5px] h-[5px] rounded-full bg-[#4B3A7A]" />
                Planning
            </span>
        )
    }
    const kind: "ok" | "warn" | "err" | "info" =
        status === "CRITICAL" || status === "STOCKOUT" ? "err"
            : status === "LOW" ? "warn"
                : status === "HEALTHY" ? "ok"
                    : "info"
    return <StatusPill kind={kind}>{rowStatusLabel(status)}</StatusPill>
}

function ActionCellPill({ action }: { action: RowAction }) {
    const label = rowActionLabel(action)
    let cls = "inline-flex items-center justify-center h-[26px] px-2.5 text-[11px] font-medium rounded-[2px] border bg-transparent transition-colors"
    if (action === "PO_DARURAT" || action === "STOCKOUT") {
        cls = cn(cls, "border-[var(--integra-red)] text-[var(--integra-red)] hover:bg-[var(--integra-red-bg)]")
    } else if (action === "PR_AKTIF") {
        cls = cn(cls, "border-[var(--integra-liren-blue)] text-[var(--integra-liren-blue)] hover:bg-[var(--integra-liren-blue-soft)]")
    } else {
        cls = cn(cls, "border-[var(--integra-hairline-strong)] text-[var(--integra-ink-soft)] hover:border-[var(--integra-ink)] hover:text-[var(--integra-ink)]")
    }
    return <button type="button" className={cls}>{label}</button>
}

function ReplenishTableView({
    rows,
    totalRows,
    rangeStart,
    rangeEnd,
    page,
    totalPages,
    onPrevPage,
    onNextPage,
    filterTab,
    setFilterTab,
    filterCounts,
    totalValueJt,
    outstandingPoJt,
}: {
    rows: ReplenishRow[]
    totalRows: number
    rangeStart: number
    rangeEnd: number
    page: number
    totalPages: number
    onPrevPage: () => void
    onNextPage: () => void
    filterTab: FilterTab
    setFilterTab: (t: FilterTab) => void
    filterCounts: { all: number; critical: number; low: number; healthy: number; incoming: number; planning: number }
    totalValueJt: number
    outstandingPoJt: number
}) {
    // Header glyph indicator
    const Th = ({ glyph, label, num = false }: { glyph: string; label: string; num?: boolean }) => (
        <th
            className={cn(
                "h-[36px] px-3 text-[11px] font-medium text-[var(--integra-muted)] whitespace-nowrap bg-[var(--integra-canvas)] border-b border-[var(--integra-hairline)]",
                num ? "text-right" : "text-left",
            )}
            style={{ borderLeft: "1px solid var(--integra-hairline)" }}
        >
            <span className="inline-block w-[13px] mr-1.5 font-mono text-[10.5px] text-[var(--integra-muted)] opacity-70 text-center">
                {glyph}
            </span>
            {label}
        </th>
    )

    // Body cell with vertical hairline (omitted on first cell)
    const cellBase = "h-[44px] px-3 align-middle text-[12.5px] text-[var(--integra-ink)]"
    const cellBorder = { borderLeft: "1px solid var(--integra-hairline)" }

    const coverageColor = (h: number | null) => {
        if (h === null) return "text-[var(--integra-muted)]"
        if (h < 6) return "text-[var(--integra-red)]"
        if (h < 24) return "text-[var(--integra-amber)]"
        return "text-[var(--integra-green-ok)]"
    }

    if (totalRows === 0) {
        return (
            <>
                <ReplenishToolbar filterTab={filterTab} setFilterTab={setFilterTab} counts={filterCounts} />
                <div
                    className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] px-6 py-10 flex items-center justify-center"
                    style={{ minHeight: "240px" }}
                >
                    <EmptyState title="Tidak ada produk" />
                </div>
            </>
        )
    }

    return (
        <>
            <ReplenishToolbar filterTab={filterTab} setFilterTab={setFilterTab} counts={filterCounts} />

            <div className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-[12.5px] text-[var(--integra-ink)]">
                        <colgroup>
                            <col style={{ width: "36px" }} />
                            <col style={{ width: "48px" }} />
                            <col style={{ width: "120px" }} />
                            <col style={{ width: "240px" }} />
                            <col style={{ width: "160px" }} />
                            <col style={{ width: "78px" }} />
                            <col style={{ width: "78px" }} />
                            <col style={{ width: "78px" }} />
                            <col style={{ width: "96px" }} />
                            <col style={{ width: "72px" }} />
                            <col style={{ width: "160px" }} />
                            <col style={{ width: "110px" }} />
                            <col style={{ width: "120px" }} />
                            <col style={{ width: "120px" }} />
                        </colgroup>
                        <thead>
                            <tr>
                                <th className="h-[36px] px-3 text-left bg-[var(--integra-canvas)] border-b border-[var(--integra-hairline)]">
                                    <input type="checkbox" aria-label="Pilih semua" />
                                </th>
                                <th
                                    className="h-[36px] px-3 text-right text-[11px] font-medium text-[var(--integra-muted)] bg-[var(--integra-canvas)] border-b border-[var(--integra-hairline)]"
                                    style={{ borderLeft: "1px solid var(--integra-hairline)" }}
                                >
                                    #
                                </th>
                                <Th glyph="⌗" label="SKU" />
                                <Th glyph="A" label="Produk" />
                                <Th glyph="A" label="Kategori" />
                                <Th glyph="#" label="Stok" num />
                                <Th glyph="#" label="Safety" num />
                                <Th glyph="#" label="ROP" num />
                                <Th glyph="⏱" label="Coverage" num />
                                <Th glyph="#" label="Lead" num />
                                <Th glyph="◎" label="Pemasok" />
                                <Th glyph="#" label="Nilai (jt)" num />
                                <Th glyph="●" label="Status" />
                                <Th glyph="→" label="Aksi" />
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, idx) => {
                                const rowNum = rangeStart + idx
                                const stockColor = (r.status === "STOCKOUT" || r.status === "CRITICAL")
                                    ? "text-[var(--integra-red)]"
                                    : r.status === "LOW"
                                        ? "text-[var(--integra-amber)]"
                                        : "text-[var(--integra-ink)]"
                                return (
                                    <tr key={r.id} className="hover:bg-[#FBFAF5] transition-colors">
                                        <td className={cn(cellBase, "border-b border-[var(--integra-hairline)]")}>
                                            <input type="checkbox" aria-label={`Pilih ${r.sku}`} />
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)] font-mono text-[11px] text-[var(--integra-muted)] text-center")}
                                            style={cellBorder}
                                        >
                                            {rowNum}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)] font-mono")}
                                            style={cellBorder}
                                        >
                                            {r.sku}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)]")}
                                            style={cellBorder}
                                        >
                                            <div className="font-medium text-[12.5px] text-[var(--integra-ink)] leading-[1.3]">
                                                {r.title}
                                            </div>
                                            <div className="text-[10.5px] font-mono text-[var(--integra-muted)] mt-0.5">
                                                {r.subRef}
                                            </div>
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)]")}
                                            style={cellBorder}
                                        >
                                            {r.category}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)] text-right font-mono tabular-nums", stockColor)}
                                            style={cellBorder}
                                        >
                                            {r.stock.toLocaleString("id-ID")}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)] text-right font-mono tabular-nums")}
                                            style={cellBorder}
                                        >
                                            {r.safety.toLocaleString("id-ID")}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)] text-right font-mono tabular-nums")}
                                            style={cellBorder}
                                        >
                                            {r.rop.toLocaleString("id-ID")}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)] text-right font-mono tabular-nums", coverageColor(r.coverageHours))}
                                            style={cellBorder}
                                        >
                                            {r.coverageHours === null ? "—" : `${fmtCoverageNum(r.coverageHours)} h`}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)] text-right font-mono tabular-nums")}
                                            style={cellBorder}
                                        >
                                            {r.leadHours} h
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)]", !r.supplier && "text-[var(--integra-muted)]")}
                                            style={cellBorder}
                                        >
                                            {r.supplier ?? "—"}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)] text-right font-mono tabular-nums")}
                                            style={cellBorder}
                                        >
                                            {fmtJt(r.valueIdrJt)}
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)]")}
                                            style={cellBorder}
                                        >
                                            <StatusCellPill status={r.status} />
                                        </td>
                                        <td
                                            className={cn(cellBase, "border-b border-[var(--integra-hairline)]")}
                                            style={cellBorder}
                                        >
                                            <ActionCellPill action={r.action} />
                                        </td>
                                    </tr>
                                )
                            })}
                            {/* + Tambah baris */}
                            <tr
                                className="cursor-pointer group hover:bg-[#FBFAF5]"
                                onClick={() => { /* stub */ }}
                            >
                                <td
                                    colSpan={14}
                                    className="h-[36px] text-[12px] text-[var(--integra-muted)] group-hover:text-[var(--integra-liren-blue)]"
                                    style={{ paddingLeft: "96px" }}
                                >
                                    + Tambah baris
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between px-3.5 py-2.5 border-t border-[var(--integra-hairline)] bg-[var(--integra-canvas)] text-[11.5px] text-[var(--integra-muted)]">
                    <div>
                        {rangeStart}–{rangeEnd} dari{" "}
                        <span className="font-mono text-[var(--integra-ink)]">{totalRows}</span>{" "}
                        produk
                    </div>
                    <div className="flex items-center gap-[22px]">
                        <span>
                            Total nilai{" "}
                            <span className="font-mono text-[var(--integra-ink)]">
                                Rp {fmtJt(totalValueJt)} jt
                            </span>
                        </span>
                        <span>
                            Outstanding PO{" "}
                            <span className="font-mono text-[var(--integra-ink)]">
                                Rp {fmtJt(outstandingPoJt)} jt
                            </span>
                        </span>
                        <span>
                            Akurasi <span className="font-mono text-[var(--integra-ink)]">98,2%</span>
                        </span>
                        <span className="inline-flex items-center gap-2 ml-2">
                            <button
                                type="button"
                                onClick={onPrevPage}
                                disabled={page <= 1}
                                className="w-[22px] h-[22px] border border-[var(--integra-hairline)] rounded-[2px] bg-[var(--integra-canvas-pure)] text-[var(--integra-ink)] text-[12px] hover:bg-[var(--integra-canvas)] disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Halaman sebelumnya"
                            >
                                ‹
                            </button>
                            <span>
                                Hal <span className="font-mono text-[var(--integra-ink)]">{page}</span> /{" "}
                                {totalPages}
                            </span>
                            <button
                                type="button"
                                onClick={onNextPage}
                                disabled={page >= totalPages}
                                className="w-[22px] h-[22px] border border-[var(--integra-hairline)] rounded-[2px] bg-[var(--integra-canvas-pure)] text-[var(--integra-ink)] text-[12px] hover:bg-[var(--integra-canvas)] disabled:opacity-40 disabled:cursor-not-allowed"
                                aria-label="Halaman berikutnya"
                            >
                                ›
                            </button>
                        </span>
                    </div>
                </div>
            </div>
        </>
    )
}

// ─────────────────────────────────────────────────────────────────
// Main page client
// ─────────────────────────────────────────────────────────────────

export function ProductsPageClient({ products, categories, warehouses, stats }: ProductsPageClientProps) {
    const { triggered: autoOpenCreate, clear: clearAutoOpen } = useActionSignal("new")
    const router = useRouter()
    const searchParams = useSearchParams()
    const initialView = searchParams.get("view") === "tabel" ? "tabel" : "kanban"
    const [view, setView] = useState<"kanban" | "tabel">(initialView)
    const [batchPriceOpen, setBatchPriceOpen] = useState(false)
    const [importOpen, setImportOpen] = useState(false)
    const [createOpen, setCreateOpen] = useState(false)
    const [filterTab, setFilterTab] = useState<FilterTab>("all")
    const [tablePage, setTablePage] = useState(1)
    const PAGE_SIZE = 10

    // Suppress unused var warnings (kept in props for parent compatibility)
    void categories
    void warehouses

    // Sync view → URL (?view=kanban|tabel) without reload
    const updateView = useCallback((next: "kanban" | "tabel") => {
        setView(next)
        const params = new URLSearchParams(searchParams.toString())
        params.set("view", next)
        router.replace(`?${params.toString()}`, { scroll: false })
    }, [router, searchParams])

    // Reset paginator when filter changes
    useEffect(() => { setTablePage(1) }, [filterTab])

    const lanes = useMemo(() => assignLanes(products, stats), [products, stats])
    const tableRows = useMemo(() => buildReplenishRows(products, lanes), [products, lanes])

    // Filter counts for segmented tabs
    const filterCounts = useMemo(() => {
        const c = { all: tableRows.length, critical: 0, low: 0, healthy: 0, incoming: 0, planning: 0 }
        for (const r of tableRows) {
            if (r.status === "CRITICAL" || r.status === "STOCKOUT") c.critical++
            else if (r.status === "LOW") c.low++
            else if (r.status === "HEALTHY") c.healthy++
            else if (r.status === "INCOMING") c.incoming++
            else if (r.status === "PLANNING") c.planning++
        }
        return c
    }, [tableRows])

    const filteredRows = useMemo(() => {
        if (filterTab === "all") return tableRows
        if (filterTab === "critical") return tableRows.filter((r) => r.status === "CRITICAL" || r.status === "STOCKOUT")
        if (filterTab === "low") return tableRows.filter((r) => r.status === "LOW")
        if (filterTab === "healthy") return tableRows.filter((r) => r.status === "HEALTHY")
        if (filterTab === "incoming") return tableRows.filter((r) => r.status === "INCOMING")
        return tableRows.filter((r) => r.status === "PLANNING")
    }, [tableRows, filterTab])

    const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE))
    const safePage = Math.min(tablePage, totalPages)
    const pageRows = filteredRows.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)
    const rangeStart = filteredRows.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1
    const rangeEnd = Math.min(safePage * PAGE_SIZE, filteredRows.length)
    const totalValueJt = useMemo(() => tableRows.reduce((s, r) => s + r.valueIdrJt, 0), [tableRows])

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
                                    onClick={() => updateView("kanban")}
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
                                    onClick={() => updateView("tabel")}
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
                    </>
                ) : (
                    <ReplenishTableView
                        rows={pageRows}
                        totalRows={filteredRows.length}
                        rangeStart={rangeStart}
                        rangeEnd={rangeEnd}
                        page={safePage}
                        totalPages={totalPages}
                        onPrevPage={() => setTablePage((p) => Math.max(1, p - 1))}
                        onNextPage={() => setTablePage((p) => Math.min(totalPages, p + 1))}
                        filterTab={filterTab}
                        setFilterTab={setFilterTab}
                        filterCounts={filterCounts}
                        totalValueJt={totalValueJt}
                        outstandingPoJt={outstandingPo / 1_000_000}
                    />
                )}

                {/* Footer summary — visible in BOTH views (Ringkasan Replenishment) */}
                <div className="mt-4 border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] px-4 py-2.5 flex items-center gap-4 text-[11.5px] text-[var(--integra-muted)]">
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[var(--integra-muted)]">
                        Ringkasan Replenishment
                    </span>
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
                    {view === "kanban" && (
                        <span>Hint: drag card untuk pindah lane</span>
                    )}
                </div>
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
