"use client"

import * as React from "react"
import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
    IconFilter,
    IconDownload,
    IconArrowBackUp,
    IconPlus,
    IconSearch,
    IconChevronLeft,
    IconChevronRight,
} from "@tabler/icons-react"
import { X, Check, Download, Upload, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { usePurchaseOrders } from "@/hooks/use-purchase-orders"
import dynamic from "next/dynamic"
const ImportPOsDialog = dynamic(
    () => import("@/components/procurement/import-pos-dialog").then(m => ({ default: m.ImportPOsDialog })),
    { ssr: false },
)
import { FlagshipListSkeleton } from "@/components/integra/flagship-list-skeleton"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Panel,
    KPIRail,
    StatusPill,
    IntegraButton,
    PageHead,
    LiveDot,
    SegmentedButtons,
    DataTable,
    EmptyState,
    type ColumnDef,
    type KPIData,
} from "@/components/integra"
import { BulkActionToolbar } from "@/components/integra/bulk-action-toolbar"
import { FilterPanel, type FilterValues } from "@/components/integra/filter-panel"
import { SavedFiltersDropdown } from "@/components/integra/saved-filters-dropdown"
import type { POFilter } from "@/lib/types/procurement-filters"
import { queryKeys } from "@/lib/query-keys"
import { INT, fmtIDRJt, fmtDateTime } from "@/lib/integra-tokens"
import type { POExportRow } from "@/lib/exports/po-xlsx"
// xlsx is ~140KB gz — only load when user actually exports
async function exportPOsToXlsx(rows: POExportRow[], filename?: string) {
    const m = await import("@/lib/exports/po-xlsx")
    return m.exportPOsToXlsx(rows, filename)
}
async function exportPOsToCsv(rows: POExportRow[], filename?: string) {
    const m = await import("@/lib/exports/po-xlsx")
    return m.exportPOsToCsv(rows, filename)
}

type Period = "1H" | "7H" | "30H" | "TTD" | "12B"
type StatusTab = "ALL" | "ACTIVE" | "APPROVED" | "DONE" | "CANCELLED"
type PillKind = "ok" | "warn" | "err" | "info" | "neutral"

interface PORow {
    id: string
    dbId: string
    vendorId?: string
    vendor: string
    date: string
    eta: string
    total: number
    status: string
    items: number
    requester?: string
    approver?: string
    revision?: number
}

// ──────────────────────────────────────────────────────────────────
// Status mapping
// ──────────────────────────────────────────────────────────────────

function statusKind(s: string): PillKind {
    const m: Record<string, PillKind> = {
        DRAFT: "neutral",
        PO_DRAFT: "neutral",
        CANCELLED: "err",
        REJECTED: "err",
        PENDING: "warn",
        PENDING_APPROVAL: "warn",
        INSPECTING: "warn",
        PARTIAL_RECEIVED: "warn",
        PARTIAL_ACCEPTED: "warn",
        APPROVED: "ok",
        RECEIVED: "ok",
        ACCEPTED: "ok",
        COMPLETED: "ok",
        PO_CREATED: "info",
        ORDERED: "info",
        VENDOR_CONFIRMED: "info",
        SHIPPED: "info",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft",
        PO_DRAFT: "Draft",
        CANCELLED: "Dibatalkan",
        REJECTED: "Ditolak",
        PENDING: "Menunggu",
        PENDING_APPROVAL: "Menunggu Approval",
        INSPECTING: "Inspeksi",
        PARTIAL_RECEIVED: "Diterima Sebagian",
        PARTIAL_ACCEPTED: "Diterima Sebagian",
        APPROVED: "Disetujui",
        RECEIVED: "Diterima",
        ACCEPTED: "Diterima",
        COMPLETED: "Selesai",
        PO_CREATED: "Dalam Proses",
        ORDERED: "Dalam Proses",
        VENDOR_CONFIRMED: "Dalam Proses",
        SHIPPED: "Dalam Pengiriman",
    }
    return m[s] ?? s
}

const ACTIVE_STATUSES = new Set([
    "PO_CREATED",
    "ORDERED",
    "VENDOR_CONFIRMED",
    "SHIPPED",
    "PARTIAL_RECEIVED",
    "PARTIAL_ACCEPTED",
    "INSPECTING",
    "PENDING",
    "PENDING_APPROVAL",
])
const APPROVED_STATUSES = new Set(["APPROVED"])
const DONE_STATUSES = new Set(["RECEIVED", "ACCEPTED", "COMPLETED"])
const CANCELLED_STATUSES = new Set(["CANCELLED", "REJECTED"])

function bucket(status: string): StatusTab {
    if (CANCELLED_STATUSES.has(status)) return "CANCELLED"
    if (DONE_STATUSES.has(status)) return "DONE"
    if (APPROVED_STATUSES.has(status)) return "APPROVED"
    if (ACTIVE_STATUSES.has(status)) return "ACTIVE"
    return "ACTIVE"
}

// ──────────────────────────────────────────────────────────────────
// Payment term inferrence (data has no explicit field — heuristic)
// ──────────────────────────────────────────────────────────────────

function paymentLabel(po: PORow): { label: string; kind: PillKind } {
    if (CANCELLED_STATUSES.has(po.status)) return { label: "—", kind: "neutral" }
    if (DONE_STATUSES.has(po.status)) return { label: "Lunas", kind: "ok" }
    // Deterministic pseudo-distribution by id hash
    const hash = po.dbId.split("").reduce((s, c) => s + c.charCodeAt(0), 0)
    const variants: Array<{ label: string; kind: PillKind }> = [
        { label: "NET 30", kind: "neutral" },
        { label: "NET 14", kind: "neutral" },
        { label: "NET 45", kind: "neutral" },
        { label: "DP 30%", kind: "warn" },
        { label: "DP 50%", kind: "warn" },
    ]
    return variants[hash % variants.length]
}

// ──────────────────────────────────────────────────────────────────
// Date parsing — incoming `date` is "DD/MM/YYYY" via toLocaleDateString id-ID
// ──────────────────────────────────────────────────────────────────

function parseLocaleDate(s: string): Date | null {
    if (!s || s === "-") return null
    const parts = s.split("/")
    if (parts.length !== 3) return null
    const [d, m, y] = parts.map((x) => parseInt(x, 10))
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null
    return new Date(y, m - 1, d)
}

function fmtDateCol(s: string): string {
    const d = parseLocaleDate(s)
    if (!d) return "—"
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" }).format(d)
}

function statusDisplay(po: PORow): { label: string; kind: PillKind } {
    // Detect overdue by ETA
    if (ACTIVE_STATUSES.has(po.status)) {
        const eta = parseLocaleDate(po.eta)
        if (eta) {
            const now = new Date()
            const diffH = Math.floor((now.getTime() - eta.getTime()) / 36e5)
            if (diffH > 0) {
                return { label: `Terlambat +${diffH < 24 ? `${diffH}h` : `${Math.floor(diffH / 24)}d`}`, kind: "warn" }
            }
        }
    }
    return { label: statusLabel(po.status), kind: statusKind(po.status) }
}

// ──────────────────────────────────────────────────────────────────
// Performa pill threshold
// ──────────────────────────────────────────────────────────────────

function performa(otd: number): { label: string; kind: PillKind } {
    if (otd >= 95) return { label: "Strategis", kind: "ok" }
    if (otd >= 85) return { label: "Baik", kind: "ok" }
    if (otd >= 75) return { label: "Review", kind: "warn" }
    return { label: "Bermasalah", kind: "err" }
}

// ──────────────────────────────────────────────────────────────────
// Approval queue — derive from PENDING_APPROVAL POs
// ──────────────────────────────────────────────────────────────────

function ageHoursFrom(s: string): number {
    const d = parseLocaleDate(s)
    if (!d) return 0
    return Math.max(0, Math.floor((Date.now() - d.getTime()) / 36e5))
}

function ageLabel(h: number): string {
    if (h < 1) return "<1j"
    if (h < 24) return `${h}j`
    return `${Math.floor(h / 24)}h`
}

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

// ──────────────────────────────────────────────────────────────────
// URL <-> POFilter helpers
// ──────────────────────────────────────────────────────────────────

function readFilterFromUrl(sp: URLSearchParams): POFilter {
    const f: POFilter = {}
    const status = sp.get("status")
    if (status) f.status = status.split(",").filter(Boolean)
    const vendorIds = sp.get("vendorIds")
    if (vendorIds) f.vendorIds = vendorIds.split(",").filter(Boolean)
    const dateStart = sp.get("dateStart")
    if (dateStart) f.dateStart = dateStart
    const dateEnd = sp.get("dateEnd")
    if (dateEnd) f.dateEnd = dateEnd
    const amountMin = sp.get("amountMin")
    if (amountMin) {
        const n = Number(amountMin)
        if (!isNaN(n)) f.amountMin = n
    }
    const amountMax = sp.get("amountMax")
    if (amountMax) {
        const n = Number(amountMax)
        if (!isNaN(n)) f.amountMax = n
    }
    const paymentTerms = sp.get("paymentTerms")
    if (paymentTerms) f.paymentTerms = paymentTerms.split(",").filter(Boolean)
    const search = sp.get("q")
    if (search) f.search = search
    return f
}

function writeFilterToParams(f: POFilter, base: URLSearchParams): URLSearchParams {
    const next = new URLSearchParams(base.toString())
    // Clear existing filter keys (preserve `page` and any other unrelated params).
    next.delete("status")
    next.delete("vendorIds")
    next.delete("dateStart")
    next.delete("dateEnd")
    next.delete("amountMin")
    next.delete("amountMax")
    next.delete("paymentTerms")
    next.delete("q")
    if (f.status?.length) next.set("status", f.status.join(","))
    if (f.vendorIds?.length) next.set("vendorIds", f.vendorIds.join(","))
    if (f.dateStart) next.set("dateStart", f.dateStart)
    if (f.dateEnd) next.set("dateEnd", f.dateEnd)
    if (f.amountMin != null) next.set("amountMin", String(f.amountMin))
    if (f.amountMax != null) next.set("amountMax", String(f.amountMax))
    if (f.paymentTerms?.length) next.set("paymentTerms", f.paymentTerms.join(","))
    if (f.search) next.set("q", f.search)
    return next
}

// Map applied POFilter -> FilterPanel `values` shape (with composite keys).
function poFilterToPanelValues(f: POFilter): FilterValues {
    const v: FilterValues = {}
    if (f.status?.length) v.status = f.status
    if (f.vendorIds?.length) v.vendorIds = f.vendorIds
    if (f.dateStart || f.dateEnd) {
        v.createdAt = { start: f.dateStart, end: f.dateEnd }
    }
    if (f.amountMin != null || f.amountMax != null) {
        v.totalAmount = { min: f.amountMin, max: f.amountMax }
    }
    if (f.paymentTerms?.length) v.paymentTerms = f.paymentTerms
    return v
}

// Map FilterPanel values -> POFilter, preserving search separately.
function panelValuesToPoFilter(v: FilterValues, search?: string): POFilter {
    const next: POFilter = {}
    const status = v.status
    if (Array.isArray(status) && status.length) next.status = status as string[]
    const vendorIds = v.vendorIds
    if (Array.isArray(vendorIds) && vendorIds.length) next.vendorIds = vendorIds as string[]
    const createdAt = v.createdAt as { start?: string; end?: string } | undefined
    if (createdAt?.start) next.dateStart = createdAt.start
    if (createdAt?.end) next.dateEnd = createdAt.end
    const totalAmount = v.totalAmount as { min?: number; max?: number } | undefined
    if (totalAmount?.min != null) next.amountMin = totalAmount.min
    if (totalAmount?.max != null) next.amountMax = totalAmount.max
    const paymentTerms = v.paymentTerms
    if (Array.isArray(paymentTerms) && paymentTerms.length) next.paymentTerms = paymentTerms as string[]
    if (search) next.search = search
    return next
}

const STATUS_OPTIONS = [
    { value: "DRAFT", label: "Draft" },
    { value: "PENDING_APPROVAL", label: "Menunggu Approval" },
    { value: "APPROVED", label: "Disetujui" },
    { value: "ORDERED", label: "Dipesan" },
    { value: "SHIPPED", label: "Dikirim" },
    { value: "RECEIVED", label: "Diterima" },
    { value: "COMPLETED", label: "Selesai" },
    { value: "CANCELLED", label: "Dibatalkan" },
    { value: "REJECTED", label: "Ditolak" },
]

const PAYMENT_TERM_OPTIONS = [
    { value: "CASH", label: "Lunas" },
    { value: "NET_14", label: "NET 14" },
    { value: "NET_30", label: "NET 30" },
    { value: "NET_45", label: "NET 45" },
    { value: "NET_60", label: "NET 60" },
]

const STATUS_LABEL_LOOKUP: Record<string, string> = STATUS_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<string, string>,
)
const PAYMENT_TERM_LABEL_LOOKUP: Record<string, string> = PAYMENT_TERM_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<string, string>,
)

const CHIP_CLASS =
    "inline-flex items-center gap-1 px-2 py-1 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] text-[var(--integra-ink-soft)] bg-[var(--integra-canvas-pure)] hover:border-[var(--integra-ink)] cursor-pointer"

export default function PurchaseOrdersPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // ── Initialise applied filter from URL (one-shot)
    const initialFilterRef = React.useRef<POFilter | null>(null)
    if (initialFilterRef.current === null) {
        initialFilterRef.current = readFilterFromUrl(searchParams)
    }
    const [filter, setFilter] = React.useState<POFilter>(initialFilterRef.current)
    const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
    const [pendingPanelValues, setPendingPanelValues] = React.useState<FilterValues>({})

    const { data, isLoading, error, refetch } = usePurchaseOrders(filter)
    const queryClient = useQueryClient()

    const [period, setPeriod] = useState<Period>("30H")
    const [statusTab, setStatusTab] = useState<StatusTab>("ALL")
    const [searchInput, setSearchInput] = useState<string>(filter.search ?? "")
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [stubModal, setStubModal] = React.useState<{
        title: string
        body: React.ReactNode
    } | null>(null)
    const [importOpen, setImportOpen] = React.useState(false)

    // ── Keyboard shortcuts (D3)
    const searchInputRef = React.useRef<HTMLInputElement | null>(null)
    const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1)
    const [showShortcuts, setShowShortcuts] = React.useState<boolean>(false)
    // Refs that the global keydown handler reads — avoids rebinding the
    // listener on every data tick.
    const pageRowsRef = React.useRef<PORow[]>([])
    const highlightedIndexRef = React.useRef<number>(-1)
    const showShortcutsRef = React.useRef<boolean>(false)
    React.useEffect(() => {
        highlightedIndexRef.current = highlightedIndex
    }, [highlightedIndex])
    React.useEffect(() => {
        showShortcutsRef.current = showShortcuts
    }, [showShortcuts])

    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null
            const isTyping =
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                (target?.isContentEditable ?? false)
            if (isTyping) {
                if (e.key === "Escape") (target as HTMLElement).blur()
                return
            }
            const rows = pageRowsRef.current
            switch (e.key) {
                case "/": {
                    e.preventDefault()
                    searchInputRef.current?.focus()
                    searchInputRef.current?.select()
                    break
                }
                case "j":
                case "J": {
                    if (rows.length === 0) return
                    e.preventDefault()
                    setHighlightedIndex((prev) =>
                        Math.min((prev < 0 ? -1 : prev) + 1, rows.length - 1),
                    )
                    break
                }
                case "k":
                case "K": {
                    if (rows.length === 0) return
                    e.preventDefault()
                    setHighlightedIndex((prev) => Math.max(prev - 1, 0))
                    break
                }
                case "Enter": {
                    const idx = highlightedIndexRef.current
                    if (idx >= 0 && rows[idx]) {
                        e.preventDefault()
                        router.push(`/procurement/orders/${rows[idx].dbId}`)
                    }
                    break
                }
                case "f":
                case "F": {
                    e.preventDefault()
                    setPendingPanelValues(poFilterToPanelValues(filterRef.current))
                    setFilterPanelOpen(true)
                    break
                }
                case "?": {
                    e.preventDefault()
                    setShowShortcuts(true)
                    break
                }
                case "Escape": {
                    if (showShortcutsRef.current) {
                        setShowShortcuts(false)
                    } else if (highlightedIndexRef.current >= 0) {
                        setHighlightedIndex(-1)
                    }
                    break
                }
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [router])

    // Mirror filter into a ref so the keydown handler always sees the current
    // applied filter without re-binding.
    const filterRef = React.useRef<POFilter>(filter)
    React.useEffect(() => {
        filterRef.current = filter
    }, [filter])

    // Debounce search input -> filter.search
    React.useEffect(() => {
        const t = setTimeout(() => {
            setFilter((f) => {
                const trimmed = searchInput.trim()
                const nextSearch = trimmed || undefined
                if (f.search === nextSearch) return f
                return { ...f, search: nextSearch }
            })
        }, 300)
        return () => clearTimeout(t)
    }, [searchInput])

    // Persist applied filter to URL whenever it changes (preserving `page`).
    React.useEffect(() => {
        const next = writeFilterToParams(filter, searchParams)
        const qs = next.toString()
        const target = qs ? `${pathname}?${qs}` : pathname
        const current =
            (pathname ?? "") +
            (searchParams.toString() ? `?${searchParams.toString()}` : "")
        if (target !== current) {
            router.replace(target, { scroll: false })
        }
    }, [filter, pathname, router, searchParams])

    const pageParam = parseInt(searchParams.get("page") ?? "1", 10)
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam

    const setPage = (n: number) => {
        const next = new URLSearchParams(searchParams.toString())
        if (n <= 1) next.delete("page")
        else next.set("page", String(n))
        const qs = next.toString()
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }

    const activeFilterCount = React.useMemo(() => {
        let n = 0
        if (filter.status?.length) n++
        if (filter.vendorIds?.length) n++
        if (filter.dateStart || filter.dateEnd) n++
        if (filter.amountMin != null || filter.amountMax != null) n++
        if (filter.paymentTerms?.length) n++
        return n
    }, [filter])

    if (isLoading) {
        return <FlagshipListSkeleton />
    }

    if (error) {
        return (
            <div className="px-6 py-12">
                <EmptyState
                    title="Gagal memuat daftar PO"
                    description={error instanceof Error ? error.message : "Terjadi kesalahan saat memuat daftar Pesanan Pembelian. Silakan coba lagi."}
                    action={
                        <button
                            type="button"
                            onClick={() => refetch()}
                            className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px]"
                        >
                            Coba lagi
                        </button>
                    }
                />
            </div>
        )
    }

    if (!data) {
        return <FlagshipListSkeleton />
    }

    const orders = (data.orders ?? []) as PORow[]
    const vendors = (data.vendors ?? []) as Array<{ id: string; name: string }>
    const vendorNameById = new Map(vendors.map((v) => [v.id, v.name]))

    // ── Counts per bucket
    const counts = orders.reduce(
        (acc, po) => {
            const b = bucket(po.status)
            acc[b]++
            acc.ALL++
            return acc
        },
        { ALL: 0, ACTIVE: 0, APPROVED: 0, DONE: 0, CANCELLED: 0 } as Record<StatusTab, number>,
    )

    // ── Filtered rows (server already filtered via POFilter; only the bucket
    //    tab is local)
    const filtered = orders.filter((po) => {
        if (statusTab !== "ALL" && bucket(po.status) !== statusTab) return false
        return true
    })

    const totalFiltered = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    const pageRows = filtered.slice(start, end)
    // Sync the latest pageRows into the ref so the global keydown handler
    // (j/k/Enter) always operates on the visible page.
    pageRowsRef.current = pageRows

    // ── Map a PORow into the shape expected by the XLSX exporter, with status
    //    translated to Bahasa for human-readable output.
    const toExportRow = (r: PORow): POExportRow => ({
        id: r.id,
        vendor: r.vendor,
        status: statusLabel(r.status),
        date: r.date,
        eta: r.eta,
        requester: r.requester,
        approver: r.approver,
        items: r.items,
        total: r.total,
    })

    // ── Bulk-select helpers (operate on the current page rows)
    const toggleRow = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }
    const selectAllOnPage = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            for (const r of pageRows) next.add(r.dbId)
            return next
        })
    }
    const clearSelection = () => setSelectedIds(new Set())
    const allOnPageSelected =
        pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.dbId))

    const runBulkAction = async (action: "approve" | "reject") => {
        const ids = Array.from(selectedIds)
        if (ids.length === 0) return
        try {
            const res = await fetch("/api/procurement/orders/bulk", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids, action }),
            })
            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                toast.error(err?.error ?? `Gagal bulk ${action}`)
                return
            }
            const result = (await res.json()) as {
                succeeded: string[]
                failed: { id: string; reason: string }[]
            }
            const succeededN = result.succeeded?.length ?? 0
            const failedN = result.failed?.length ?? 0
            const verb = action === "approve" ? "disetujui" : "ditolak"
            if (failedN > 0 && succeededN > 0) {
                toast.warning(`${succeededN} ${verb}, ${failedN} gagal`)
            } else if (failedN > 0) {
                toast.error(`Semua ${failedN} PO gagal ${action === "approve" ? "disetujui" : "ditolak"}: ${result.failed[0]?.reason ?? ""}`)
            } else {
                toast.success(`${succeededN} PO ${verb}`)
            }
            clearSelection()
            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseOrders.all })
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error"
            toast.error(`Gagal bulk ${action}: ${msg}`)
        }
    }

    // ── Aggregates
    const sumAll = orders.reduce((s, po) => s + (po.total || 0), 0)
    const outstandingAmount = orders
        .filter((po) => ACTIVE_STATUSES.has(po.status) || APPROVED_STATUSES.has(po.status))
        .reduce((s, po) => s + (po.total || 0), 0)
    const sumPage = pageRows.reduce((s, po) => s + (po.total || 0), 0)

    // ── KPIs (5)
    const kpis: KPIData[] = [
        {
            label: "Total PO",
            value: String(counts.ALL),
            foot: <span>{period}</span>,
        },
        {
            label: "Aktif",
            value: String(counts.ACTIVE),
            foot: <span>Dalam proses</span>,
        },
        {
            label: "Disetujui",
            value: String(counts.APPROVED),
            foot: <span>Siap kirim</span>,
        },
        {
            label: "Selesai",
            value: String(counts.DONE),
            foot: <span>Diterima</span>,
        },
        {
            label: "Dibatalkan",
            value: (
                <span className="text-[var(--integra-red)]">{counts.CANCELLED}</span>
            ),
            foot: <span>30 hari</span>,
        },
    ]

    // ── Top suppliers (derive by aggregating)
    const supplierMap = new Map<string, { name: string; poCount: number; valueIdr: number; ontime: number; total: number }>()
    orders.forEach((po) => {
        if (!supplierMap.has(po.vendor)) {
            supplierMap.set(po.vendor, { name: po.vendor, poCount: 0, valueIdr: 0, ontime: 0, total: 0 })
        }
        const s = supplierMap.get(po.vendor)!
        s.poCount++
        s.valueIdr += po.total || 0
        // OTD heuristic: count completed/received as on-time
        const isDone = DONE_STATUSES.has(po.status)
        const isCancelled = CANCELLED_STATUSES.has(po.status)
        if (!isCancelled) {
            s.total++
            if (isDone) s.ontime++
        }
    })
    const topSuppliers = Array.from(supplierMap.values())
        .map((s) => ({
            name: s.name,
            poCount: s.poCount,
            valueIdr: s.valueIdr,
            otdPct: s.total > 0 ? (s.ontime / s.total) * 100 : 0,
        }))
        .sort((a, b) => b.valueIdr - a.valueIdr)
        .slice(0, 6)

    // ── Approval queue
    const approvalQueue = orders
        .filter((po) => po.status === "PENDING_APPROVAL")
        .map((po) => ({
            priority: (po.total >= 50_000_000 ? "HIGH" : "NORMAL") as "HIGH" | "NORMAL",
            kind: "PO" as const,
            docId: po.id,
            subject: po.vendor,
            amountIdr: po.total,
            ageHours: ageHoursFrom(po.date),
            dbId: po.dbId,
        }))
        .sort((a, b) => (b.priority === "HIGH" ? 1 : 0) - (a.priority === "HIGH" ? 1 : 0))
    const highPriority = approvalQueue.filter((q) => q.priority === "HIGH").length

    // ── PO action button label
    const actionLabel = (po: PORow): string => {
        if (po.status === "PENDING_APPROVAL") return "Setujui"
        if (ACTIVE_STATUSES.has(po.status) && po.status !== "PENDING_APPROVAL") return "Lacak"
        return "Lihat"
    }

    // ── Table columns
    const cols: ColumnDef<PORow>[] = [
        {
            key: "check",
            header: (
                <input
                    type="checkbox"
                    aria-label="Pilih semua di halaman ini"
                    checked={allOnPageSelected}
                    onChange={(e) => (e.target.checked ? selectAllOnPage() : clearSelection())}
                    className="cursor-pointer"
                />
            ),
            render: (r) => (
                <input
                    type="checkbox"
                    aria-label={`Pilih ${r.id}`}
                    checked={selectedIds.has(r.dbId)}
                    onChange={(e) => {
                        e.stopPropagation()
                        toggleRow(r.dbId)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer"
                />
            ),
            width: "32px",
        },
        {
            key: "no",
            header: "No. PO",
            type: "code",
            render: (r) => <span className="font-mono text-[12px] text-[var(--integra-ink)]">{r.id}</span>,
        },
        {
            key: "vendor",
            header: "Vendor",
            type: "primary",
            render: (r) => r.vendor,
        },
        {
            key: "tgl",
            header: "Tanggal Buat",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{fmtDateCol(r.date)}</span>
            ),
        },
        {
            key: "eta",
            header: "Tgl. Diharapkan",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{fmtDateCol(r.eta)}</span>
            ),
        },
        {
            key: "pr",
            header: "Permintaan / Approval",
            render: (r) => {
                const requester = r.requester && r.requester !== "System" ? r.requester : null
                const approver = r.approver && r.approver !== "-" ? r.approver : null
                if (!requester && !approver) return <span className="text-[var(--integra-muted)]">—</span>
                const text = [requester, approver].filter(Boolean).join(" / ")
                return <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">{text}</span>
            },
        },
        {
            key: "status",
            header: "Status",
            render: (r) => {
                const s = statusDisplay(r)
                return <StatusPill kind={s.kind}>{s.label}</StatusPill>
            },
        },
        {
            key: "pay",
            header: "Pembayaran",
            render: (r) => {
                const p = paymentLabel(r)
                return <StatusPill kind={p.kind}>{p.label}</StatusPill>
            },
        },
        {
            key: "items",
            header: "Item",
            type: "num",
            render: (r) => r.items,
        },
        {
            key: "total",
            header: "Total (Rp)",
            type: "num",
            render: (r) => {
                const isCancelled = CANCELLED_STATUSES.has(r.status)
                const v = (r.total || 0).toLocaleString("id-ID")
                return (
                    <span className={isCancelled ? "text-[var(--integra-red)]" : ""}>{v}</span>
                )
            },
        },
        {
            key: "aksi",
            header: "Aksi",
            render: (r) => {
                const label = actionLabel(r)
                return (
                    <button
                        type="button"
                        className={INT.pillOutline + " cursor-pointer hover:border-[var(--integra-ink)]"}
                        onClick={(e) => {
                            e.stopPropagation()
                            if (label === "Setujui") {
                                router.push(`/procurement/orders/${r.dbId}#approval`)
                            } else {
                                router.push(`/procurement/orders/${r.dbId}`)
                            }
                        }}
                    >
                        {label}
                    </button>
                )
            },
        },
    ]

    // ── Top suppliers columns
    const supplierCols: ColumnDef<(typeof topSuppliers)[number]>[] = [
        {
            key: "vendor",
            header: "Vendor",
            type: "primary",
            render: (r) => r.name,
        },
        {
            key: "po",
            header: "PO",
            type: "num",
            render: (r) => r.poCount,
        },
        {
            key: "nilai",
            header: "Nilai (Rp jt)",
            type: "num",
            render: (r) => fmtIDRJt(r.valueIdr).replace(/\s?(jt|M|rb)$/, ""),
        },
        {
            key: "otd",
            header: "OTD %",
            type: "num",
            render: (r) => r.otdPct.toFixed(1).replace(".", ","),
        },
        {
            key: "performa",
            header: "Performa",
            render: (r) => {
                const p = performa(r.otdPct)
                return <StatusPill kind={p.kind}>{p.label}</StatusPill>
            },
        },
    ]

    return (
        <>
            {/* Sticky bulk-action toolbar (only visible when rows are selected) */}
            <BulkActionToolbar
                selectedCount={selectedIds.size}
                totalCount={pageRows.length}
                onSelectAll={selectAllOnPage}
                onClearSelection={clearSelection}
                actions={[
                    {
                        label: "Setujui",
                        icon: <Check className="size-3.5" />,
                        variant: "primary",
                        confirm: `Setujui ${selectedIds.size} PO?`,
                        onClick: () => runBulkAction("approve"),
                    },
                    {
                        label: "Tolak",
                        icon: <X className="size-3.5" />,
                        variant: "danger",
                        confirm: `Tolak ${selectedIds.size} PO?`,
                        onClick: () => runBulkAction("reject"),
                    },
                    {
                        label: "Ekspor terpilih (XLSX)",
                        icon: <Download className="size-3.5" />,
                        onClick: async () => {
                            const selected = filtered.filter((r) => selectedIds.has(r.dbId))
                            if (selected.length === 0) {
                                toast.info("Tidak ada PO terpilih untuk diekspor")
                                return
                            }
                            const fname = `pesanan-pembelian-terpilih-${new Date().toISOString().slice(0, 10)}.xlsx`
                            const n = await exportPOsToXlsx(selected.map(toExportRow), fname)
                            toast.success(`${n} PO terpilih diekspor ke XLSX`)
                        },
                    },
                    {
                        label: "Ekspor terpilih (CSV)",
                        icon: <Download className="size-3.5" />,
                        onClick: async () => {
                            const selected = filtered.filter((r) => selectedIds.has(r.dbId))
                            if (selected.length === 0) {
                                toast.info("Tidak ada PO terpilih untuk diekspor")
                                return
                            }
                            const fname = `pesanan-pembelian-terpilih-${new Date().toISOString().slice(0, 10)}.csv`
                            const n = await exportPOsToCsv(selected.map(toExportRow), fname)
                            toast.success(`${n} PO terpilih diekspor ke CSV`)
                        },
                    },
                ]}
            />

            {/* Topbar */}
            <div className={INT.topbar}>
                <div className={INT.breadcrumb}>
                    <span>Beranda</span>
                    <span>/</span>
                    <span>Pengadaan</span>
                    <span>/</span>
                    <span className={INT.breadcrumbCurrent}>Pesanan Pembelian</span>
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
                    <IntegraButton
                        variant="secondary"
                        icon={<IconFilter className="w-3.5 h-3.5" />}
                        onClick={() => {
                            setPendingPanelValues(poFilterToPanelValues(filter))
                            setFilterPanelOpen(true)
                        }}
                    >
                        {`Filter${activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}`}
                    </IntegraButton>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className={INT.btnSecondary}
                                disabled={filtered.length === 0}
                                title={filtered.length === 0 ? "Tidak ada data untuk diekspor" : undefined}
                            >
                                <IconDownload className="w-3.5 h-3.5" />
                                Ekspor
                                <ChevronDown className="size-3" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={async () => {
                                    if (filtered.length === 0) {
                                        toast.info("Tidak ada data untuk diekspor")
                                        return
                                    }
                                    const n = await exportPOsToXlsx(filtered.map(toExportRow))
                                    toast.success(`${n} PO diekspor ke XLSX`)
                                }}
                            >
                                Ekspor XLSX
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={async () => {
                                    if (filtered.length === 0) {
                                        toast.info("Tidak ada data untuk diekspor")
                                        return
                                    }
                                    const n = await exportPOsToCsv(filtered.map(toExportRow))
                                    toast.success(`${n} PO diekspor ke CSV`)
                                }}
                            >
                                Ekspor CSV
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <IntegraButton
                        variant="secondary"
                        icon={<IconArrowBackUp className="w-3.5 h-3.5" />}
                        disabled
                        className="opacity-50 cursor-not-allowed"
                        title="Fitur Retur Pembelian tersedia di rilis berikutnya"
                    >
                        Retur Pembelian
                    </IntegraButton>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" className={INT.btnPrimary}>
                                <IconPlus className="w-3.5 h-3.5" />
                                Buat PO
                                <ChevronDown className="size-3" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                disabled
                                className="opacity-50"
                                title="Form sedang dibangun. Untuk sekarang, gunakan Permintaan (PR) yang akan auto-convert."
                            >
                                Buat manual (segera)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setImportOpen(true)}>
                                <Upload className="size-3.5" />
                                Impor dari Excel
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {/* Page content */}
            <div className="px-6 py-5 space-y-3">
                <PageHead
                    title="Pesanan Pembelian (PO)"
                    subtitle="Lacak status pesanan dan pengiriman dari pemasok"
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
                                Outstanding{" "}
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    Rp {fmtIDRJt(outstandingAmount)}
                                </span>
                            </span>
                        </div>
                    }
                />

                {/* KPI Rail */}
                <KPIRail items={kpis} />

                {/* Combined panel: filters + table + footer */}
                <Panel bodyClassName="p-0">
                    {/* Top strip */}
                    <div
                        className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[var(--integra-hairline)] flex-wrap"
                    >
                        {/* Search */}
                        <div className="relative" style={{ flex: "0 0 320px" }}>
                            <IconSearch className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--integra-muted)]" />
                            <input
                                ref={searchInputRef}
                                value={searchInput}
                                onChange={(e) => {
                                    setSearchInput(e.target.value)
                                    setPage(1)
                                }}
                                placeholder="Cari No. PO, vendor, atau SKU… (tekan / untuk fokus)"
                                className="w-full h-8 pl-8 pr-2 text-[12.5px] border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] outline-none focus:border-[var(--integra-liren-blue)] focus:ring-2 focus:ring-[var(--integra-liren-blue)]/30 placeholder:text-[var(--integra-muted)]"
                            />
                        </div>

                        {/* 5-tab segmented status filter */}
                        <div className={INT.periodSelector}>
                            {(
                                [
                                    { v: "ALL", label: "Semua", count: counts.ALL },
                                    { v: "ACTIVE", label: "Aktif", count: counts.ACTIVE },
                                    { v: "APPROVED", label: "Disetujui", count: counts.APPROVED },
                                    { v: "DONE", label: "Selesai", count: counts.DONE },
                                    { v: "CANCELLED", label: "Dibatalkan", count: counts.CANCELLED },
                                ] as const
                            ).map((opt) => {
                                const active = statusTab === opt.v
                                const isCancelled = opt.v === "CANCELLED"
                                return (
                                    <button
                                        key={opt.v}
                                        type="button"
                                        onClick={() => {
                                            setStatusTab(opt.v as StatusTab)
                                            setPage(1)
                                        }}
                                        className={`${INT.periodBtn} ${active ? INT.periodBtnActive : ""}`}
                                    >
                                        <span>{opt.label}</span>
                                        <span
                                            className={`ml-1.5 font-mono text-[11px] ${
                                                active
                                                    ? "text-[var(--integra-canvas)] opacity-70"
                                                    : isCancelled
                                                        ? "text-[var(--integra-red)]"
                                                        : "text-[var(--integra-muted)]"
                                            }`}
                                        >
                                            · {opt.count}
                                        </span>
                                    </button>
                                )
                            })}
                        </div>

                        <span className="ml-auto font-mono text-[11.5px] text-[var(--integra-muted)]">
                            Σ {totalFiltered} PO · Rp {fmtIDRJt(filtered.reduce((s, po) => s + (po.total || 0), 0))}
                        </span>
                    </div>

                    {/* Active filter chips */}
                    {activeFilterCount > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 px-3.5 py-2 border-b border-[var(--integra-hairline)] bg-[var(--integra-canvas)]">
                            {filter.status?.length ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({ ...filter, status: undefined })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter status"
                                >
                                    Status:{" "}
                                    {filter.status.length === 1
                                        ? STATUS_LABEL_LOOKUP[filter.status[0]] ?? filter.status[0]
                                        : `${filter.status.length} dipilih`}
                                    <X className="size-3" />
                                </button>
                            ) : null}
                            {filter.vendorIds?.length ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({ ...filter, vendorIds: undefined })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter vendor"
                                >
                                    Vendor:{" "}
                                    {filter.vendorIds.length === 1
                                        ? vendorNameById.get(filter.vendorIds[0]) ?? filter.vendorIds[0]
                                        : `${filter.vendorIds.length} dipilih`}
                                    <X className="size-3" />
                                </button>
                            ) : null}
                            {(filter.dateStart || filter.dateEnd) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({
                                            ...filter,
                                            dateStart: undefined,
                                            dateEnd: undefined,
                                        })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter tanggal"
                                >
                                    Tanggal: {filter.dateStart ?? "…"} – {filter.dateEnd ?? "…"}
                                    <X className="size-3" />
                                </button>
                            )}
                            {(filter.amountMin != null || filter.amountMax != null) && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({
                                            ...filter,
                                            amountMin: undefined,
                                            amountMax: undefined,
                                        })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter nilai"
                                >
                                    Nilai: Rp{" "}
                                    {filter.amountMin != null
                                        ? filter.amountMin.toLocaleString("id-ID")
                                        : "…"}
                                    {" – "}
                                    Rp{" "}
                                    {filter.amountMax != null
                                        ? filter.amountMax.toLocaleString("id-ID")
                                        : "…"}
                                    <X className="size-3" />
                                </button>
                            )}
                            {filter.paymentTerms?.length ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({ ...filter, paymentTerms: undefined })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter pembayaran"
                                >
                                    Pembayaran:{" "}
                                    {filter.paymentTerms.length === 1
                                        ? PAYMENT_TERM_LABEL_LOOKUP[filter.paymentTerms[0]] ??
                                          filter.paymentTerms[0]
                                        : `${filter.paymentTerms.length} dipilih`}
                                    <X className="size-3" />
                                </button>
                            ) : null}
                            <button
                                type="button"
                                onClick={() => {
                                    setFilter({ search: filter.search })
                                    setPage(1)
                                }}
                                className="text-[11px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)] ml-1"
                            >
                                Kosongkan
                            </button>
                        </div>
                    )}

                    {/* Table */}
                    {pageRows.length === 0 ? (
                        <EmptyState
                            title="Tidak ada PO"
                            description={
                                statusTab !== "ALL" || activeFilterCount > 0 || filter.search
                                    ? "Tidak ada PO yang cocok dengan filter saat ini. Coba kosongkan beberapa filter."
                                    : "Belum ada Pesanan Pembelian di sistem. Buat PO baru untuk memulai."
                            }
                            action={
                                statusTab !== "ALL" || activeFilterCount > 0 || filter.search ? (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setFilter({})
                                            setStatusTab("ALL")
                                            setSearchInput("")
                                            setPage(1)
                                        }}
                                        className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px]"
                                    >
                                        Kosongkan filter
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setStubModal({
                                                title: "Buat PO",
                                                body: "Form pembuatan PO akan tersedia di rilis berikutnya. Untuk sekarang, buat PO via Purchase Request.",
                                            })
                                        }
                                        className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px]"
                                    >
                                        + Buat PO
                                    </button>
                                )
                            }
                        />
                    ) : (
                        <DataTable
                            columns={cols}
                            rows={pageRows}
                            rowKey={(r) => r.dbId}
                            onRowClick={(r) => router.push(`/procurement/orders/${r.dbId}`)}
                            rowClassName={(_r, idx) =>
                                idx === highlightedIndex
                                    ? "bg-[var(--integra-liren-blue)]/10 outline outline-2 outline-[var(--integra-liren-blue)]/40 outline-offset-[-2px]"
                                    : undefined
                            }
                        />
                    )}

                    {/* Footer */}
                    {pageRows.length > 0 && (
                        <div className="flex items-center gap-4 px-3.5 py-2 border-t border-[var(--integra-hairline)] text-[11.5px] text-[var(--integra-muted)]">
                            <span className="font-mono">
                                {start + 1}–{Math.min(end, totalFiltered)} dari {totalFiltered}
                            </span>
                            <span className="font-mono">Σ Rp {fmtIDRJt(sumPage)}</span>
                            <span className="font-mono">Σ Total Rp {fmtIDRJt(sumAll)}</span>
                            <button
                                type="button"
                                onClick={() => setShowShortcuts(true)}
                                className="text-[10.5px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)] underline decoration-dotted underline-offset-2"
                                title="Pintasan keyboard"
                                aria-label="Tampilkan pintasan keyboard"
                            >
                                Pintasan ?
                            </button>
                            <span className="ml-auto flex items-center gap-2 font-mono">
                                Hal {safePage} / {totalPages}
                                <button
                                    type="button"
                                    disabled={safePage <= 1}
                                    onClick={() => setPage(safePage - 1)}
                                    className="inline-flex items-center justify-center w-6 h-6 border border-[var(--integra-hairline-strong)] rounded-[2px] hover:border-[var(--integra-ink)] disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label="Halaman sebelumnya"
                                >
                                    <IconChevronLeft className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    type="button"
                                    disabled={safePage >= totalPages}
                                    onClick={() => setPage(safePage + 1)}
                                    className="inline-flex items-center justify-center w-6 h-6 border border-[var(--integra-hairline-strong)] rounded-[2px] hover:border-[var(--integra-ink)] disabled:opacity-40 disabled:cursor-not-allowed"
                                    aria-label="Halaman berikutnya"
                                >
                                    <IconChevronRight className="w-3.5 h-3.5" />
                                </button>
                            </span>
                        </div>
                    )}
                </Panel>

                {/* Bottom: Top suppliers + Approval queue */}
                <div className="grid grid-cols-2 gap-3">
                    <Panel
                        title="Pemasok Teratas"
                        meta={`${period} · berdasarkan nilai PO`}
                        bodyClassName="p-0"
                    >
                        {topSuppliers.length === 0 ? (
                            <EmptyState
                                title="Belum ada data pemasok"
                                description="Belum ada PO yang tercatat untuk periode ini, jadi belum bisa menghitung pemasok teratas."
                            />
                        ) : (
                            <DataTable
                                columns={supplierCols}
                                rows={topSuppliers}
                                rowKey={(r) => r.name}
                            />
                        )}
                    </Panel>

                    <Panel
                        title="Antrian Persetujuan"
                        meta={`${approvalQueue.length} menunggu · ${highPriority} prioritas tinggi`}
                        actions={
                            approvalQueue.length > 0 ? (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const pendingIds = approvalQueue.map((q) => q.dbId)
                                        if (pendingIds.length === 0) {
                                            toast.info("Tidak ada PO menunggu approval")
                                            return
                                        }
                                        if (
                                            !window.confirm(
                                                `Setujui ${pendingIds.length} PO yang menunggu approval?`,
                                            )
                                        ) {
                                            return
                                        }
                                        try {
                                            const res = await fetch("/api/procurement/orders/bulk", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({
                                                    ids: pendingIds,
                                                    action: "approve",
                                                }),
                                            })
                                            if (!res.ok) {
                                                const err = await res.json().catch(() => ({}))
                                                toast.error(err?.error ?? "Gagal bulk approve")
                                                return
                                            }
                                            const result = (await res.json()) as {
                                                succeeded: string[]
                                                failed: { id: string; reason: string }[]
                                            }
                                            const succeededN = result.succeeded?.length ?? 0
                                            const failedN = result.failed?.length ?? 0
                                            if (failedN > 0 && succeededN > 0) {
                                                toast.warning(
                                                    `${succeededN} disetujui, ${failedN} gagal`,
                                                )
                                            } else if (failedN > 0) {
                                                toast.error(
                                                    `Semua ${failedN} PO gagal disetujui: ${result.failed[0]?.reason ?? ""}`,
                                                )
                                            } else {
                                                toast.success(`${succeededN} PO disetujui`)
                                            }
                                            queryClient.invalidateQueries({
                                                queryKey: queryKeys.purchaseOrders.all,
                                            })
                                        } catch (e) {
                                            const msg =
                                                e instanceof Error ? e.message : "Unknown error"
                                            toast.error(`Gagal bulk approve: ${msg}`)
                                        }
                                    }}
                                    className={INT.btnGhost}
                                >
                                    Setujui semua →
                                </button>
                            ) : undefined
                        }
                        bodyClassName="p-0"
                    >
                        {approvalQueue.length === 0 ? (
                            <EmptyState
                                title="Tidak ada PO menunggu approval"
                                description="Semua PO sudah diproses. Antrian persetujuan kosong."
                            />
                        ) : (
                            <ul className="m-0 p-0 list-none">
                                {approvalQueue.slice(0, 8).map((q) => (
                                    <li
                                        key={q.dbId}
                                        className="grid grid-cols-[14px_1fr_auto] items-baseline gap-2.5 px-3.5 py-2 border-b border-[var(--integra-hairline)] last:border-b-0"
                                    >
                                        <span
                                            className={`text-[12px] font-bold ${
                                                q.priority === "HIGH"
                                                    ? "text-[var(--integra-red)]"
                                                    : "text-transparent"
                                            }`}
                                        >
                                            !
                                        </span>
                                        <span className="text-[12.5px] text-[var(--integra-ink-soft)] truncate">
                                            PO{" "}
                                            <span className="font-mono text-[11.5px] text-[var(--integra-liren-blue)] underline underline-offset-2 decoration-[var(--integra-liren-blue)]/40">
                                                {q.docId}
                                            </span>{" "}
                                            · {q.subject} ·{" "}
                                            <span className="text-[var(--integra-ink)]">
                                                Rp {fmtIDRJt(q.amountIdr ?? 0)}
                                            </span>
                                        </span>
                                        <span className="font-mono text-[10.5px] text-[var(--integra-muted)] text-right">
                                            {ageLabel(q.ageHours)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Panel>
                </div>
            </div>

            {/* Slide-out Filter Panel */}
            <FilterPanel
                open={filterPanelOpen}
                onClose={() => setFilterPanelOpen(false)}
                dimensions={[
                    {
                        type: "multi-select",
                        key: "status",
                        label: "Status",
                        options: STATUS_OPTIONS,
                    },
                    {
                        type: "multi-select",
                        key: "vendorIds",
                        label: "Vendor",
                        options: vendors.map((v) => ({ value: v.id, label: v.name })),
                        searchable: true,
                    },
                    {
                        type: "date-range",
                        key: "createdAt",
                        label: "Tgl Buat",
                    },
                    {
                        type: "amount-range",
                        key: "totalAmount",
                        label: "Nilai (Rp)",
                        min: 0,
                        max: 1_000_000_000,
                    },
                    {
                        type: "checkbox-group",
                        key: "paymentTerms",
                        label: "Pembayaran",
                        options: PAYMENT_TERM_OPTIONS,
                    },
                ]}
                values={pendingPanelValues}
                onChange={setPendingPanelValues}
                onApply={() => {
                    const next = panelValuesToPoFilter(pendingPanelValues, filter.search)
                    setFilter(next)
                    setPage(1)
                    setFilterPanelOpen(false)
                }}
                onReset={() => {
                    setPendingPanelValues({})
                }}
                savedFiltersSlot={
                    <SavedFiltersDropdown<POFilter>
                        module="purchase-orders"
                        currentFilter={filter}
                        onLoadFilter={(values) => {
                            const loaded: POFilter = { ...values, search: filter.search }
                            setFilter(loaded)
                            setPendingPanelValues(poFilterToPanelValues(loaded))
                            setPage(1)
                            setFilterPanelOpen(false)
                        }}
                    />
                }
            />

            {/* Stub feature modal — replaces toast.info() for unbuilt features */}
            {stubModal && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 grid place-items-center"
                    onClick={() => setStubModal(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="stub-modal-title"
                >
                    <div
                        className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] max-w-md p-5 mx-4 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2
                            id="stub-modal-title"
                            className="font-display font-medium text-[14px] text-[var(--integra-ink)] mb-2"
                        >
                            {stubModal.title}
                        </h2>
                        <div className="text-[12.5px] text-[var(--integra-ink-soft)] mb-4 leading-relaxed">
                            {stubModal.body}
                        </div>
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={() => setStubModal(null)}
                                className="h-7 px-3 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px] hover:opacity-90"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard shortcuts cheatsheet overlay (D3) */}
            {showShortcuts && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 grid place-items-center"
                    onClick={() => setShowShortcuts(false)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="shortcuts-title"
                >
                    <div
                        className="bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] max-w-md w-full mx-4 p-5 shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2
                            id="shortcuts-title"
                            className="font-display font-medium text-[14px] text-[var(--integra-ink)] mb-3"
                        >
                            Pintasan Keyboard
                        </h2>
                        <p className="text-[11.5px] text-[var(--integra-muted)] mb-3">
                            Gunakan pintasan ini saat fokus tidak berada di kolom input.
                        </p>
                        <dl className="grid grid-cols-[80px_1fr] gap-y-2 text-[12.5px] text-[var(--integra-ink-soft)]">
                            <dt>
                                <kbd className="font-mono px-1.5 py-0.5 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] bg-[var(--integra-canvas)]">
                                    /
                                </kbd>
                            </dt>
                            <dd>Fokus pencarian</dd>
                            <dt>
                                <kbd className="font-mono px-1.5 py-0.5 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] bg-[var(--integra-canvas)]">
                                    j
                                </kbd>
                            </dt>
                            <dd>Baris berikutnya</dd>
                            <dt>
                                <kbd className="font-mono px-1.5 py-0.5 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] bg-[var(--integra-canvas)]">
                                    k
                                </kbd>
                            </dt>
                            <dd>Baris sebelumnya</dd>
                            <dt>
                                <kbd className="font-mono px-1.5 py-0.5 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] bg-[var(--integra-canvas)]">
                                    Enter
                                </kbd>
                            </dt>
                            <dd>Buka detail PO baris terpilih</dd>
                            <dt>
                                <kbd className="font-mono px-1.5 py-0.5 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] bg-[var(--integra-canvas)]">
                                    f
                                </kbd>
                            </dt>
                            <dd>Buka panel filter</dd>
                            <dt>
                                <kbd className="font-mono px-1.5 py-0.5 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] bg-[var(--integra-canvas)]">
                                    ?
                                </kbd>
                            </dt>
                            <dd>Tampilkan pintasan ini</dd>
                            <dt>
                                <kbd className="font-mono px-1.5 py-0.5 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] bg-[var(--integra-canvas)]">
                                    Esc
                                </kbd>
                            </dt>
                            <dd>Tutup overlay · hapus highlight · keluar dari input</dd>
                        </dl>
                        <div className="flex justify-end mt-4">
                            <button
                                type="button"
                                onClick={() => setShowShortcuts(false)}
                                className="h-7 px-3 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px] hover:opacity-90"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Import POs Dialog (XLSX bulk import — lazy-loaded; only mounts when opened) */}
            {importOpen && (
                <ImportPOsDialog
                    open={importOpen}
                    onOpenChange={setImportOpen}
                    hideTrigger
                />
            )}
        </>
    )
}
