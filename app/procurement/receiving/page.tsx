"use client"

import * as React from "react"
import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import {
    IconFilter,
    IconDownload,
    IconPlus,
    IconSearch,
    IconChevronLeft,
    IconChevronRight,
} from "@tabler/icons-react"
import { X, Check, Download, Upload, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { useReceiving } from "@/hooks/use-receiving"
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
import type { GRNFilter } from "@/lib/types/grn-filters"
import { queryKeys } from "@/lib/query-keys"
import { INT, fmtDateTime } from "@/lib/integra-tokens"
import { exportGRNsToXlsx, exportGRNsToCsv, type GRNExportRow } from "@/lib/exports/grn-xlsx"
import { ImportGRNsDialog } from "@/components/procurement/import-grns-dialog"

type Period = "1H" | "7H" | "30H" | "TTD" | "12B"
type StatusTab = "ALL" | "INSPECTING" | "PARTIAL_ACCEPTED" | "ACCEPTED" | "REJECTED"
type PillKind = "ok" | "warn" | "err" | "info" | "neutral"

interface GRNRow {
    id: string
    number: string
    purchaseOrderId: string | null
    poNumber: string
    vendorId: string
    vendorName: string
    warehouseId: string
    warehouseName: string
    receivedById: string | null
    receivedBy: string
    receivedDate: Date | string
    status: string
    notes: string | null
    itemCount: number
    totalAccepted: number
    totalRejected: number
}

interface PendingPORow {
    id: string
    number: string
    vendorName: string
    vendorId: string
    orderDate: Date | string
    expectedDate: Date | string | null
    status: string
    totalAmount: number
    items: Array<{
        id: string
        productName: string
        productCode: string
        unit: string
        orderedQty: number
        receivedQty: number
        remainingQty: number
        unitPrice: number
    }>
    hasRemainingItems: boolean
}

// ──────────────────────────────────────────────────────────────────
// Status mapping
// ──────────────────────────────────────────────────────────────────

function statusKind(s: string): PillKind {
    const m: Record<string, PillKind> = {
        DRAFT: "neutral",
        INSPECTING: "warn",
        PARTIAL_ACCEPTED: "warn",
        ACCEPTED: "ok",
        REJECTED: "err",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft",
        INSPECTING: "Inspeksi",
        PARTIAL_ACCEPTED: "Diterima Sebagian",
        ACCEPTED: "Diterima",
        REJECTED: "Ditolak",
    }
    return m[s] ?? s
}

function bucket(status: string): StatusTab {
    if (status === "INSPECTING" || status === "DRAFT") return "INSPECTING"
    if (status === "PARTIAL_ACCEPTED") return "PARTIAL_ACCEPTED"
    if (status === "ACCEPTED") return "ACCEPTED"
    if (status === "REJECTED") return "REJECTED"
    return "INSPECTING"
}

// ──────────────────────────────────────────────────────────────────
// Date helpers
// ──────────────────────────────────────────────────────────────────

function fmtDateCol(d: Date | string): string {
    const date = typeof d === "string" ? new Date(d) : d
    if (isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(date)
}

function ageHoursFrom(d: Date | string): number {
    const date = typeof d === "string" ? new Date(d) : d
    if (isNaN(date.getTime())) return 0
    return Math.max(0, Math.floor((Date.now() - date.getTime()) / 36e5))
}

function ageLabel(h: number): string {
    if (h < 1) return "<1j"
    if (h < 24) return `${h}j`
    return `${Math.floor(h / 24)}h`
}

function truncate(s: string | null | undefined, n: number): string {
    if (!s) return "—"
    if (s.length <= n) return s
    return s.slice(0, n - 1) + "…"
}

// ──────────────────────────────────────────────────────────────────
// Page constants
// ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
    { value: "DRAFT", label: "Draft" },
    { value: "INSPECTING", label: "Inspeksi" },
    { value: "PARTIAL_ACCEPTED", label: "Diterima Sebagian" },
    { value: "ACCEPTED", label: "Diterima" },
    { value: "REJECTED", label: "Ditolak" },
]

const STATUS_LABEL_LOOKUP: Record<string, string> = STATUS_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<string, string>,
)

const CHIP_CLASS =
    "inline-flex items-center gap-1 px-2 py-1 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] text-[var(--integra-ink-soft)] bg-[var(--integra-canvas-pure)] hover:border-[var(--integra-ink)] cursor-pointer"

// ──────────────────────────────────────────────────────────────────
// URL <-> GRNFilter helpers
// ──────────────────────────────────────────────────────────────────

function readFilterFromUrl(sp: URLSearchParams): GRNFilter {
    const f: GRNFilter = {}
    const status = sp.get("status")
    if (status) f.status = status.split(",").filter(Boolean)
    const vendorIds = sp.get("vendorIds")
    if (vendorIds) f.vendorIds = vendorIds.split(",").filter(Boolean)
    const dateStart = sp.get("dateStart")
    if (dateStart) f.dateStart = dateStart
    const dateEnd = sp.get("dateEnd")
    if (dateEnd) f.dateEnd = dateEnd
    const poRef = sp.get("poRef")
    if (poRef) f.poRef = poRef
    const search = sp.get("q")
    if (search) f.search = search
    return f
}

function writeFilterToParams(f: GRNFilter, base: URLSearchParams): URLSearchParams {
    const next = new URLSearchParams(base.toString())
    next.delete("status")
    next.delete("vendorIds")
    next.delete("dateStart")
    next.delete("dateEnd")
    next.delete("poRef")
    next.delete("q")
    if (f.status?.length) next.set("status", f.status.join(","))
    if (f.vendorIds?.length) next.set("vendorIds", f.vendorIds.join(","))
    if (f.dateStart) next.set("dateStart", f.dateStart)
    if (f.dateEnd) next.set("dateEnd", f.dateEnd)
    if (f.poRef) next.set("poRef", f.poRef)
    if (f.search) next.set("q", f.search)
    return next
}

function grnFilterToPanelValues(f: GRNFilter): FilterValues {
    const v: FilterValues = {}
    if (f.status?.length) v.status = f.status
    if (f.vendorIds?.length) v.vendorIds = f.vendorIds
    if (f.dateStart || f.dateEnd) {
        v.receivedDate = { start: f.dateStart, end: f.dateEnd }
    }
    return v
}

function panelValuesToGrnFilter(
    v: FilterValues,
    base: { search?: string; poRef?: string },
): GRNFilter {
    const next: GRNFilter = {}
    const status = v.status
    if (Array.isArray(status) && status.length) next.status = status as string[]
    const vendorIds = v.vendorIds
    if (Array.isArray(vendorIds) && vendorIds.length) next.vendorIds = vendorIds as string[]
    const receivedDate = v.receivedDate as { start?: string; end?: string } | undefined
    if (receivedDate?.start) next.dateStart = receivedDate.start
    if (receivedDate?.end) next.dateEnd = receivedDate.end
    // Preserve poRef and search (not exposed via panel; managed via URL / search input)
    if (base.poRef) next.poRef = base.poRef
    if (base.search) next.search = base.search
    return next
}

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────

export default function ReceivingPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // Initialise applied filter from URL (one-shot)
    const initialFilterRef = React.useRef<GRNFilter | null>(null)
    if (initialFilterRef.current === null) {
        initialFilterRef.current = readFilterFromUrl(searchParams)
    }
    const [filter, setFilter] = React.useState<GRNFilter>(initialFilterRef.current)
    const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
    const [pendingPanelValues, setPendingPanelValues] = React.useState<FilterValues>({})

    const { data, isLoading, error, refetch } = useReceiving(filter)
    const queryClient = useQueryClient()

    const [period, setPeriod] = useState<Period>("30H")
    const [statusTab, setStatusTab] = useState<StatusTab>("ALL")
    const [searchInput, setSearchInput] = useState<string>(filter.search ?? "")
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [importOpen, setImportOpen] = React.useState(false)

    // Keyboard shortcuts
    const searchInputRef = React.useRef<HTMLInputElement | null>(null)
    const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1)
    const [showShortcuts, setShowShortcuts] = React.useState<boolean>(false)
    const pageRowsRef = React.useRef<GRNRow[]>([])
    const highlightedIndexRef = React.useRef<number>(-1)
    const showShortcutsRef = React.useRef<boolean>(false)
    React.useEffect(() => {
        highlightedIndexRef.current = highlightedIndex
    }, [highlightedIndex])
    React.useEffect(() => {
        showShortcutsRef.current = showShortcuts
    }, [showShortcuts])

    const filterRef = React.useRef<GRNFilter>(filter)
    React.useEffect(() => {
        filterRef.current = filter
    }, [filter])

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
                        router.push(`/procurement/receiving/${rows[idx].id}`)
                    }
                    break
                }
                case "f":
                case "F": {
                    e.preventDefault()
                    setPendingPanelValues(grnFilterToPanelValues(filterRef.current))
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

    // Persist applied filter to URL
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
        if (filter.poRef) n++
        if (filter.dateStart || filter.dateEnd) n++
        return n
    }, [filter])

    if (isLoading) {
        return <FlagshipListSkeleton />
    }

    if (error) {
        return (
            <div className="px-6 py-12">
                <EmptyState
                    title="Gagal memuat daftar GRN"
                    description={
                        error instanceof Error
                            ? error.message
                            : "Terjadi kesalahan saat memuat daftar Surat Jalan Masuk. Silakan coba lagi."
                    }
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

    const grns = (data.grns ?? []) as GRNRow[]
    const pendingPOs = (data.pendingPOs ?? []) as PendingPORow[]

    // Vendor options derived from GRN list
    const vendorMap = new Map<string, string>()
    grns.forEach((r) => {
        if (r.vendorId && r.vendorName) vendorMap.set(r.vendorId, r.vendorName)
    })
    const vendorOptions = Array.from(vendorMap.entries())
        .sort((a, b) => a[1].localeCompare(b[1]))
        .map(([value, label]) => ({ value, label }))

    // Counts per bucket
    const counts = grns.reduce(
        (acc, g) => {
            const b = bucket(g.status)
            acc[b]++
            acc.ALL++
            return acc
        },
        {
            ALL: 0,
            INSPECTING: 0,
            PARTIAL_ACCEPTED: 0,
            ACCEPTED: 0,
            REJECTED: 0,
        } as Record<StatusTab, number>,
    )

    // Filtered (server already applied GRNFilter; only the bucket tab is local)
    const filtered = grns.filter((g) => {
        if (statusTab !== "ALL" && bucket(g.status) !== statusTab) return false
        return true
    })

    const totalFiltered = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    const pageRows = filtered.slice(start, end)
    pageRowsRef.current = pageRows

    const toExportRow = (r: GRNRow): GRNExportRow => ({
        number: r.number,
        poNumber: r.poNumber,
        vendorName: r.vendorName,
        warehouseName: r.warehouseName,
        receivedBy: r.receivedBy,
        receivedDate: fmtDateCol(r.receivedDate),
        status: statusLabel(r.status),
        itemCount: r.itemCount,
        totalAccepted: r.totalAccepted,
        totalRejected: r.totalRejected,
        notes: r.notes,
    })

    // Bulk-select helpers
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
            for (const r of pageRows) next.add(r.id)
            return next
        })
    }
    const clearSelection = () => setSelectedIds(new Set())
    const allOnPageSelected =
        pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id))

    const runBulkAction = async (action: "accept" | "reject") => {
        const ids = Array.from(selectedIds)
        if (ids.length === 0) return
        try {
            const res = await fetch("/api/procurement/receiving/bulk", {
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
            const verb = action === "accept" ? "diterima" : "ditolak"
            if (failedN > 0 && succeededN > 0) {
                toast.warning(`${succeededN} ${verb}, ${failedN} gagal`)
            } else if (failedN > 0) {
                toast.error(
                    `Semua ${failedN} GRN gagal ${verb}: ${result.failed[0]?.reason ?? ""}`,
                )
            } else {
                toast.success(`${succeededN} GRN ${verb}`)
            }
            clearSelection()
            queryClient.invalidateQueries({ queryKey: queryKeys.receiving.all })
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error"
            toast.error(`Gagal bulk ${action}: ${msg}`)
        }
    }

    // KPIs (5)
    const kpis: KPIData[] = [
        {
            label: "Total GRN",
            value: String(counts.ALL),
            foot: <span>{period}</span>,
        },
        {
            label: "Inspeksi",
            value: String(counts.INSPECTING),
            foot: <span>Sedang diperiksa</span>,
        },
        {
            label: "Sebagian",
            value: String(counts.PARTIAL_ACCEPTED),
            foot: <span>Diterima sebagian</span>,
        },
        {
            label: "Diterima",
            value: String(counts.ACCEPTED),
            foot: <span>Lengkap diterima</span>,
        },
        {
            label: "Ditolak",
            value: (
                <span className={counts.REJECTED > 0 ? "text-[var(--integra-red)]" : undefined}>
                    {counts.REJECTED}
                </span>
            ),
            foot: <span>30 hari</span>,
        },
    ]

    // Buat GRN button: route to first pending PO if any, otherwise disabled
    const firstPendingPO = pendingPOs[0]
    const buatGrnHref = firstPendingPO
        ? `/procurement/orders/${firstPendingPO.id}#grn`
        : undefined
    const buatGrnDisabled = pendingPOs.length === 0
    const buatGrnTitle = buatGrnDisabled
        ? "Buat GRN dari PO yang dipesan"
        : `Buat GRN dari PO ${firstPendingPO?.number ?? ""}`

    // Action button label
    const actionLabel = (g: GRNRow): string => {
        if (g.status === "INSPECTING") return "Inspeksi"
        return "Lihat"
    }

    // Table columns
    const cols: ColumnDef<GRNRow>[] = [
        {
            key: "check",
            header: (
                <input
                    type="checkbox"
                    aria-label="Pilih semua di halaman ini"
                    checked={allOnPageSelected}
                    onChange={(e) =>
                        e.target.checked ? selectAllOnPage() : clearSelection()
                    }
                    className="cursor-pointer"
                />
            ),
            render: (r) => (
                <input
                    type="checkbox"
                    aria-label={`Pilih ${r.number}`}
                    checked={selectedIds.has(r.id)}
                    onChange={(e) => {
                        e.stopPropagation()
                        toggleRow(r.id)
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="cursor-pointer"
                />
            ),
            width: "32px",
        },
        {
            key: "no",
            header: "No GRN",
            type: "code",
            render: (r) => (
                <span className="font-mono text-[12px] text-[var(--integra-ink)]">
                    {r.number}
                </span>
            ),
        },
        {
            key: "po",
            header: "PO Ref",
            render: (r) =>
                r.purchaseOrderId ? (
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation()
                            router.push(`/procurement/orders/${r.purchaseOrderId}`)
                        }}
                        className="font-mono text-[11.5px] text-[var(--integra-liren-blue)] underline underline-offset-2 decoration-[var(--integra-liren-blue)]/40 hover:text-[var(--integra-ink)]"
                    >
                        {r.poNumber}
                    </button>
                ) : (
                    <span className="text-[var(--integra-muted)]">—</span>
                ),
        },
        {
            key: "vendor",
            header: "Vendor",
            type: "primary",
            render: (r) =>
                r.vendorName || <span className="text-[var(--integra-muted)]">—</span>,
        },
        {
            key: "receivedDate",
            header: "Tanggal Terima",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {fmtDateCol(r.receivedDate)}
                </span>
            ),
        },
        {
            key: "items",
            header: "Item",
            type: "num",
            render: (r) => r.itemCount,
        },
        {
            key: "status",
            header: "Status",
            render: (r) => (
                <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill>
            ),
        },
        {
            key: "warehouse",
            header: "Penerima",
            render: (r) =>
                r.warehouseName || <span className="text-[var(--integra-muted)]">—</span>,
        },
        {
            key: "notes",
            header: "Catatan",
            render: (r) => (
                <span
                    className="text-[12px] text-[var(--integra-ink-soft)]"
                    title={r.notes ?? undefined}
                >
                    {truncate(r.notes, 30)}
                </span>
            ),
        },
        {
            key: "aksi",
            header: "Aksi",
            render: (r) => {
                const label = actionLabel(r)
                return (
                    <button
                        type="button"
                        className={
                            INT.pillOutline + " cursor-pointer hover:border-[var(--integra-ink)]"
                        }
                        onClick={(e) => {
                            e.stopPropagation()
                            if (label === "Inspeksi") {
                                router.push(`/procurement/receiving/${r.id}#inspection`)
                            } else {
                                router.push(`/procurement/receiving/${r.id}`)
                            }
                        }}
                    >
                        {label}
                    </button>
                )
            },
        },
    ]

    return (
        <>
            {/* Sticky bulk-action toolbar */}
            <BulkActionToolbar
                selectedCount={selectedIds.size}
                totalCount={pageRows.length}
                onSelectAll={selectAllOnPage}
                onClearSelection={clearSelection}
                actions={[
                    {
                        label: "Terima semua",
                        icon: <Check className="size-3.5" />,
                        variant: "primary",
                        confirm: `Terima ${selectedIds.size} GRN?`,
                        onClick: () => runBulkAction("accept"),
                    },
                    {
                        label: "Tolak semua",
                        icon: <X className="size-3.5" />,
                        variant: "danger",
                        confirm: `Tolak ${selectedIds.size} GRN?`,
                        onClick: () => runBulkAction("reject"),
                    },
                    {
                        label: "Ekspor terpilih (XLSX)",
                        icon: <Download className="size-3.5" />,
                        onClick: () => {
                            const selected = filtered.filter((r) => selectedIds.has(r.id))
                            if (selected.length === 0) {
                                toast.info("Tidak ada GRN terpilih untuk diekspor")
                                return
                            }
                            const fname = `surat-jalan-masuk-terpilih-${new Date().toISOString().slice(0, 10)}.xlsx`
                            const n = exportGRNsToXlsx(selected.map(toExportRow), fname)
                            toast.success(`${n} GRN terpilih diekspor ke XLSX`)
                        },
                    },
                    {
                        label: "Ekspor terpilih (CSV)",
                        icon: <Download className="size-3.5" />,
                        onClick: () => {
                            const selected = filtered.filter((r) => selectedIds.has(r.id))
                            if (selected.length === 0) {
                                toast.info("Tidak ada GRN terpilih untuk diekspor")
                                return
                            }
                            const fname = `surat-jalan-masuk-terpilih-${new Date().toISOString().slice(0, 10)}.csv`
                            const n = exportGRNsToCsv(selected.map(toExportRow), fname)
                            toast.success(`${n} GRN terpilih diekspor ke CSV`)
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
                    <span className={INT.breadcrumbCurrent}>Surat Jalan Masuk</span>
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
                            setPendingPanelValues(grnFilterToPanelValues(filter))
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
                                onClick={() => {
                                    if (filtered.length === 0) {
                                        toast.info("Tidak ada data untuk diekspor")
                                        return
                                    }
                                    const n = exportGRNsToXlsx(filtered.map(toExportRow))
                                    toast.success(`${n} GRN diekspor ke XLSX`)
                                }}
                            >
                                Ekspor XLSX
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() => {
                                    if (filtered.length === 0) {
                                        toast.info("Tidak ada data untuk diekspor")
                                        return
                                    }
                                    const n = exportGRNsToCsv(filtered.map(toExportRow))
                                    toast.success(`${n} GRN diekspor ke CSV`)
                                }}
                            >
                                Ekspor CSV
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button type="button" className={INT.btnPrimary}>
                                <IconPlus className="w-3.5 h-3.5" />
                                Buat GRN
                                <ChevronDown className="size-3" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                disabled={buatGrnDisabled}
                                className={buatGrnDisabled ? "opacity-50" : undefined}
                                title={buatGrnTitle}
                                onClick={() => {
                                    if (buatGrnDisabled || !buatGrnHref) return
                                    router.push(buatGrnHref)
                                }}
                            >
                                <IconPlus className="size-3.5" />
                                Buat dari PO
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
                    title="Surat Jalan Masuk (GRN)"
                    subtitle="Penerimaan barang dari pemasok"
                    metaRight={
                        <div className="flex items-center gap-5 text-[12px] text-[var(--integra-muted)]">
                            <span className="flex items-center gap-2">
                                <LiveDot />
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    LIVE
                                </span>
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
                                    {new Date().getFullYear()}
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
                    <div className="flex items-center gap-3 px-3.5 py-2.5 border-b border-[var(--integra-hairline)] flex-wrap">
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
                                placeholder="Cari No GRN, No PO, vendor… (tekan / untuk fokus)"
                                className="w-full h-8 pl-8 pr-2 text-[12.5px] border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] outline-none focus:border-[var(--integra-liren-blue)] focus:ring-2 focus:ring-[var(--integra-liren-blue)]/30 placeholder:text-[var(--integra-muted)]"
                            />
                        </div>

                        {/* 5-tab segmented status filter */}
                        <div className={INT.periodSelector}>
                            {(
                                [
                                    { v: "ALL", label: "Semua", count: counts.ALL },
                                    {
                                        v: "INSPECTING",
                                        label: "Inspeksi",
                                        count: counts.INSPECTING,
                                    },
                                    {
                                        v: "PARTIAL_ACCEPTED",
                                        label: "Sebagian",
                                        count: counts.PARTIAL_ACCEPTED,
                                    },
                                    {
                                        v: "ACCEPTED",
                                        label: "Diterima",
                                        count: counts.ACCEPTED,
                                    },
                                    {
                                        v: "REJECTED",
                                        label: "Ditolak",
                                        count: counts.REJECTED,
                                    },
                                ] as const
                            ).map((opt) => {
                                const active = statusTab === opt.v
                                const isRejected = opt.v === "REJECTED"
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
                                                    : isRejected
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
                            Σ {totalFiltered} GRN
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
                                        ? vendorMap.get(filter.vendorIds[0]) ?? filter.vendorIds[0]
                                        : `${filter.vendorIds.length} dipilih`}
                                    <X className="size-3" />
                                </button>
                            ) : null}
                            {filter.poRef ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({ ...filter, poRef: undefined })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter PO Ref"
                                >
                                    PO: {filter.poRef}
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
                                    Tgl Terima: {filter.dateStart ?? "…"} – {filter.dateEnd ?? "…"}
                                    <X className="size-3" />
                                </button>
                            )}
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
                            title="Tidak ada GRN"
                            description={
                                statusTab !== "ALL" || activeFilterCount > 0 || filter.search
                                    ? "Tidak ada GRN yang cocok dengan filter saat ini. Coba kosongkan beberapa filter."
                                    : "Belum ada Surat Jalan Masuk di sistem. Buat GRN baru dari PO yang sudah dipesan."
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
                                    <IntegraButton
                                        variant="primary"
                                        icon={<IconPlus className="w-3.5 h-3.5" />}
                                        href={buatGrnHref}
                                        disabled={buatGrnDisabled}
                                        title={buatGrnTitle}
                                    >
                                        Buat GRN
                                    </IntegraButton>
                                )
                            }
                        />
                    ) : (
                        <DataTable
                            columns={cols}
                            rows={pageRows}
                            rowKey={(r) => r.id}
                            onRowClick={(r) => router.push(`/procurement/receiving/${r.id}`)}
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

                {/* Bottom: PO Pending Penerimaan */}
                <Panel
                    title="PO Pending Penerimaan"
                    meta={`${pendingPOs.length} PO menunggu GRN`}
                    bodyClassName="p-0"
                >
                    {pendingPOs.length === 0 ? (
                        <EmptyState
                            title="Tidak ada PO menunggu penerimaan"
                            description="Semua PO yang sudah dipesan sudah diterima lengkap."
                        />
                    ) : (
                        <ul className="m-0 p-0 list-none">
                            {pendingPOs.slice(0, 5).map((po) => {
                                const remainingItems = po.items.filter((i) => i.remainingQty > 0)
                                const remainingCount = remainingItems.length
                                const ageH = ageHoursFrom(po.orderDate)
                                return (
                                    <li
                                        key={po.id}
                                        className="grid grid-cols-[1fr_auto_auto] items-baseline gap-2.5 px-3.5 py-2 border-b border-[var(--integra-hairline)] last:border-b-0"
                                    >
                                        <span className="text-[12.5px] text-[var(--integra-ink-soft)] truncate flex items-center gap-2">
                                            <span>
                                                PO{" "}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.push(`/procurement/orders/${po.id}`)
                                                    }
                                                    className="font-mono text-[11.5px] text-[var(--integra-liren-blue)] underline underline-offset-2 decoration-[var(--integra-liren-blue)]/40 hover:text-[var(--integra-ink)]"
                                                >
                                                    {po.number}
                                                </button>{" "}
                                                ·{" "}
                                                <span className="text-[var(--integra-ink)]">
                                                    {po.vendorName}
                                                </span>{" "}
                                                · {remainingCount} item belum diterima
                                            </span>
                                            <StatusPill kind="info">{po.status}</StatusPill>
                                        </span>
                                        <span className="font-mono text-[10.5px] text-[var(--integra-muted)]">
                                            {ageLabel(ageH)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                router.push(`/procurement/orders/${po.id}#grn`)
                                            }
                                            className={
                                                INT.pillOutline +
                                                " cursor-pointer hover:border-[var(--integra-ink)]"
                                            }
                                        >
                                            Buat GRN
                                        </button>
                                    </li>
                                )
                            })}
                        </ul>
                    )}
                </Panel>
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
                        options: vendorOptions,
                        searchable: true,
                    },
                    {
                        type: "date-range",
                        key: "receivedDate",
                        label: "Tgl Terima",
                    },
                ]}
                values={pendingPanelValues}
                onChange={setPendingPanelValues}
                onApply={() => {
                    const next = panelValuesToGrnFilter(pendingPanelValues, {
                        search: filter.search,
                        poRef: filter.poRef,
                    })
                    setFilter(next)
                    setPage(1)
                    setFilterPanelOpen(false)
                }}
                onReset={() => {
                    setPendingPanelValues({})
                }}
                savedFiltersSlot={
                    <SavedFiltersDropdown<GRNFilter>
                        module="grn"
                        currentFilter={filter}
                        onLoadFilter={(values) => {
                            const loaded: GRNFilter = { ...values, search: filter.search }
                            setFilter(loaded)
                            setPendingPanelValues(grnFilterToPanelValues(loaded))
                            setPage(1)
                            setFilterPanelOpen(false)
                        }}
                    />
                }
            />

            {/* Import GRNs Dialog (XLSX bulk import — 2 sheets: Header + Items) */}
            <ImportGRNsDialog
                open={importOpen}
                onOpenChange={setImportOpen}
                hideTrigger
            />

            {/* Keyboard shortcuts cheatsheet */}
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
                            <dd>Buka detail GRN baris terpilih</dd>
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
        </>
    )
}
