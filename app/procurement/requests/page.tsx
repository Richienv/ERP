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

import { usePurchaseRequests } from "@/hooks/use-purchase-requests"
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
import type { PRFilter } from "@/lib/types/procurement-filters"
import { queryKeys } from "@/lib/query-keys"
import { INT, fmtIDRJt, fmtDateTime } from "@/lib/integra-tokens"
import { exportPRsToXlsx, exportPRsToCsv, type PRExportRow } from "@/lib/exports/pr-xlsx"
import dynamic from "next/dynamic"
const ImportPRsDialog = dynamic(
    () => import("@/components/procurement/import-prs-dialog").then(m => ({ default: m.ImportPRsDialog })),
    { ssr: false },
)

type Period = "1H" | "7H" | "30H" | "TTD" | "12B"
type StatusTab = "ALL" | "PENDING" | "APPROVED" | "PO_CREATED" | "REJECTED"
type PillKind = "ok" | "warn" | "err" | "info" | "neutral"

interface PRRow {
    id: string
    number: string
    department: string
    requester: string
    requesterFirstName: string
    requesterLastName: string
    status: string
    priority: string
    notes: string | null
    date: Date
    approver: string | null
    estimatedTotal: number | null
    hasMissingPrice?: boolean
    itemCount: number
}

// ──────────────────────────────────────────────────────────────────
// Status mapping
// ──────────────────────────────────────────────────────────────────

function statusKind(s: string): PillKind {
    const m: Record<string, PillKind> = {
        DRAFT: "neutral",
        PENDING: "warn",
        APPROVED: "ok",
        PO_CREATED: "info",
        REJECTED: "err",
        CANCELLED: "err",
    }
    return m[s] ?? "neutral"
}

function statusLabel(s: string): string {
    const m: Record<string, string> = {
        DRAFT: "Draft",
        PENDING: "Menunggu",
        APPROVED: "Disetujui",
        PO_CREATED: "Dikonversi PO",
        REJECTED: "Ditolak",
        CANCELLED: "Dibatalkan",
    }
    return m[s] ?? s
}

function priorityKind(p: string): PillKind {
    const m: Record<string, PillKind> = {
        LOW: "neutral",
        NORMAL: "neutral",
        MEDIUM: "info",
        HIGH: "warn",
        URGENT: "err",
    }
    return m[p?.toUpperCase()] ?? "neutral"
}

function priorityLabel(p: string): string {
    const m: Record<string, string> = {
        LOW: "Rendah",
        NORMAL: "Normal",
        MEDIUM: "Sedang",
        HIGH: "Tinggi",
        URGENT: "Mendesak",
    }
    return m[p?.toUpperCase()] ?? p
}

function bucket(status: string): StatusTab {
    if (status === "PENDING" || status === "DRAFT") return "PENDING"
    if (status === "APPROVED") return "APPROVED"
    if (status === "PO_CREATED") return "PO_CREATED"
    if (status === "REJECTED" || status === "CANCELLED") return "REJECTED"
    return "PENDING"
}

// ──────────────────────────────────────────────────────────────────
// Date helpers
// ──────────────────────────────────────────────────────────────────

function fmtDateCol(d: Date | string): string {
    const date = typeof d === "string" ? new Date(d) : d
    if (isNaN(date.getTime())) return "—"
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date)
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

// ──────────────────────────────────────────────────────────────────
// Page constants
// ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 10

const STATUS_OPTIONS = [
    { value: "DRAFT", label: "Draft" },
    { value: "PENDING", label: "Menunggu" },
    { value: "APPROVED", label: "Disetujui" },
    { value: "PO_CREATED", label: "Dikonversi PO" },
    { value: "REJECTED", label: "Ditolak" },
    { value: "CANCELLED", label: "Dibatalkan" },
]

const PRIORITY_OPTIONS = [
    { value: "LOW", label: "Rendah" },
    { value: "NORMAL", label: "Normal" },
    { value: "MEDIUM", label: "Sedang" },
    { value: "HIGH", label: "Tinggi" },
    { value: "URGENT", label: "Mendesak" },
]

const STATUS_LABEL_LOOKUP: Record<string, string> = STATUS_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<string, string>,
)
const PRIORITY_LABEL_LOOKUP: Record<string, string> = PRIORITY_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<string, string>,
)

const CHIP_CLASS =
    "inline-flex items-center gap-1 px-2 py-1 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] text-[var(--integra-ink-soft)] bg-[var(--integra-canvas-pure)] hover:border-[var(--integra-ink)] cursor-pointer"

// ──────────────────────────────────────────────────────────────────
// URL <-> PRFilter helpers
// ──────────────────────────────────────────────────────────────────

function readFilterFromUrl(sp: URLSearchParams): PRFilter {
    const f: PRFilter = {}
    const status = sp.get("status")
    if (status) f.status = status.split(",").filter(Boolean)
    const departments = sp.get("departments")
    if (departments) f.departments = departments.split(",").filter(Boolean)
    const priority = sp.get("priority")
    if (priority) f.priority = priority.split(",").filter(Boolean)
    const dateStart = sp.get("dateStart")
    if (dateStart) f.dateStart = dateStart
    const dateEnd = sp.get("dateEnd")
    if (dateEnd) f.dateEnd = dateEnd
    const search = sp.get("q")
    if (search) f.search = search
    return f
}

function writeFilterToParams(f: PRFilter, base: URLSearchParams): URLSearchParams {
    const next = new URLSearchParams(base.toString())
    next.delete("status")
    next.delete("departments")
    next.delete("priority")
    next.delete("dateStart")
    next.delete("dateEnd")
    next.delete("q")
    if (f.status?.length) next.set("status", f.status.join(","))
    if (f.departments?.length) next.set("departments", f.departments.join(","))
    if (f.priority?.length) next.set("priority", f.priority.join(","))
    if (f.dateStart) next.set("dateStart", f.dateStart)
    if (f.dateEnd) next.set("dateEnd", f.dateEnd)
    if (f.search) next.set("q", f.search)
    return next
}

function prFilterToPanelValues(f: PRFilter): FilterValues {
    const v: FilterValues = {}
    if (f.status?.length) v.status = f.status
    if (f.departments?.length) v.departments = f.departments
    if (f.priority?.length) v.priority = f.priority
    if (f.dateStart || f.dateEnd) {
        v.createdAt = { start: f.dateStart, end: f.dateEnd }
    }
    return v
}

function panelValuesToPrFilter(v: FilterValues, search?: string): PRFilter {
    const next: PRFilter = {}
    const status = v.status
    if (Array.isArray(status) && status.length) next.status = status as string[]
    const departments = v.departments
    if (Array.isArray(departments) && departments.length) next.departments = departments as string[]
    const priority = v.priority
    if (Array.isArray(priority) && priority.length) next.priority = priority as string[]
    const createdAt = v.createdAt as { start?: string; end?: string } | undefined
    if (createdAt?.start) next.dateStart = createdAt.start
    if (createdAt?.end) next.dateEnd = createdAt.end
    if (search) next.search = search
    return next
}

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────

export default function PurchaseRequestsPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // Initialise applied filter from URL (one-shot)
    const initialFilterRef = React.useRef<PRFilter | null>(null)
    if (initialFilterRef.current === null) {
        initialFilterRef.current = readFilterFromUrl(searchParams)
    }
    const [filter, setFilter] = React.useState<PRFilter>(initialFilterRef.current)
    const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
    const [pendingPanelValues, setPendingPanelValues] = React.useState<FilterValues>({})

    const { data, isLoading, error, refetch } = usePurchaseRequests(filter)
    const queryClient = useQueryClient()

    const [period, setPeriod] = useState<Period>("30H")
    const [statusTab, setStatusTab] = useState<StatusTab>("ALL")
    const [searchInput, setSearchInput] = useState<string>(filter.search ?? "")
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [importOpen, setImportOpen] = useState(false)

    // Keyboard shortcuts
    const searchInputRef = React.useRef<HTMLInputElement | null>(null)
    const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1)
    const [showShortcuts, setShowShortcuts] = React.useState<boolean>(false)
    const pageRowsRef = React.useRef<PRRow[]>([])
    const highlightedIndexRef = React.useRef<number>(-1)
    const showShortcutsRef = React.useRef<boolean>(false)
    React.useEffect(() => {
        highlightedIndexRef.current = highlightedIndex
    }, [highlightedIndex])
    React.useEffect(() => {
        showShortcutsRef.current = showShortcuts
    }, [showShortcuts])

    const filterRef = React.useRef<PRFilter>(filter)
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
                        router.push(`/procurement/requests/${rows[idx].id}`)
                    }
                    break
                }
                case "f":
                case "F": {
                    e.preventDefault()
                    setPendingPanelValues(prFilterToPanelValues(filterRef.current))
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
        if (filter.departments?.length) n++
        if (filter.priority?.length) n++
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
                    title="Gagal memuat daftar PR"
                    description={error instanceof Error ? error.message : "Terjadi kesalahan saat memuat daftar Permintaan Pembelian. Silakan coba lagi."}
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

    const requests = data as PRRow[]

    // Department options derived from data
    const departmentSet = new Set<string>()
    requests.forEach((r) => {
        if (r.department) departmentSet.add(r.department)
    })
    const departmentOptions = Array.from(departmentSet)
        .sort()
        .map((d) => ({ value: d, label: d }))

    // Counts per bucket
    const counts = requests.reduce(
        (acc, pr) => {
            const b = bucket(pr.status)
            acc[b]++
            acc.ALL++
            return acc
        },
        { ALL: 0, PENDING: 0, APPROVED: 0, PO_CREATED: 0, REJECTED: 0 } as Record<StatusTab, number>,
    )

    // Filtered (server already applied PRFilter; only the bucket tab is local)
    const filtered = requests.filter((pr) => {
        if (statusTab !== "ALL" && bucket(pr.status) !== statusTab) return false
        return true
    })

    const totalFiltered = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    const pageRows = filtered.slice(start, end)
    pageRowsRef.current = pageRows

    const toExportRow = (r: PRRow): PRExportRow => ({
        id: r.number,
        department: r.department || "—",
        requester: r.requester || "—",
        priority: priorityLabel(r.priority),
        status: statusLabel(r.status),
        items: r.itemCount,
        estimatedTotal: r.estimatedTotal,
        approver: r.approver ?? "—",
        date: fmtDateCol(r.date),
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

    const runBulkAction = async (action: "approve" | "reject") => {
        const ids = Array.from(selectedIds)
        if (ids.length === 0) return
        try {
            const res = await fetch("/api/procurement/requests/bulk", {
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
                toast.error(`Semua ${failedN} PR gagal ${action === "approve" ? "disetujui" : "ditolak"}: ${result.failed[0]?.reason ?? ""}`)
            } else {
                toast.success(`${succeededN} PR ${verb}`)
            }
            clearSelection()
            queryClient.invalidateQueries({ queryKey: queryKeys.purchaseRequests.all })
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error"
            toast.error(`Gagal bulk ${action}: ${msg}`)
        }
    }

    // Aggregates
    const sumAllEstimated = requests.reduce((s, pr) => s + (pr.estimatedTotal || 0), 0)
    const pendingValue = requests
        .filter((pr) => pr.status === "PENDING")
        .reduce((s, pr) => s + (pr.estimatedTotal || 0), 0)
    const sumPage = pageRows.reduce((s, pr) => s + (pr.estimatedTotal || 0), 0)
    const sumFiltered = filtered.reduce((s, pr) => s + (pr.estimatedTotal || 0), 0)

    // KPIs (5)
    const kpis: KPIData[] = [
        {
            label: "Total PR",
            value: String(counts.ALL),
            foot: <span>{period}</span>,
        },
        {
            label: "Menunggu",
            value: String(counts.PENDING),
            foot: <span>Antrian approval</span>,
        },
        {
            label: "Disetujui",
            value: String(counts.APPROVED),
            foot: <span>Siap dikonversi</span>,
        },
        {
            label: "Dikonversi PO",
            value: String(counts.PO_CREATED),
            foot: <span>Sudah jadi PO</span>,
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

    // Approval queue (PENDING PRs sorted by priority)
    const PRIORITY_RANK: Record<string, number> = {
        URGENT: 4,
        HIGH: 3,
        MEDIUM: 2,
        NORMAL: 1,
        LOW: 0,
    }
    const approvalQueue = requests
        .filter((pr) => pr.status === "PENDING")
        .map((pr) => ({
            id: pr.id,
            number: pr.number,
            department: pr.department,
            requester: pr.requester,
            priority: pr.priority,
            estimatedTotal: pr.estimatedTotal,
            ageHours: ageHoursFrom(pr.date),
        }))
        .sort(
            (a, b) =>
                (PRIORITY_RANK[b.priority?.toUpperCase()] ?? 0) -
                (PRIORITY_RANK[a.priority?.toUpperCase()] ?? 0),
        )
    const highPriority = approvalQueue.filter(
        (q) => q.priority?.toUpperCase() === "URGENT" || q.priority?.toUpperCase() === "HIGH",
    ).length

    // Action button label
    const actionLabel = (pr: PRRow): string => {
        if (pr.status === "PENDING") return "Setujui"
        return "Lihat"
    }

    // Table columns
    const cols: ColumnDef<PRRow>[] = [
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
            header: "No. PR",
            type: "code",
            render: (r) => (
                <span className="font-mono text-[12px] text-[var(--integra-ink)]">{r.number}</span>
            ),
        },
        {
            key: "department",
            header: "Departemen",
            render: (r) => r.department || <span className="text-[var(--integra-muted)]">—</span>,
        },
        {
            key: "requester",
            header: "Pemohon",
            type: "primary",
            render: (r) => r.requester || <span className="text-[var(--integra-muted)]">—</span>,
        },
        {
            key: "priority",
            header: "Prioritas",
            render: (r) => (
                <StatusPill kind={priorityKind(r.priority)}>{priorityLabel(r.priority)}</StatusPill>
            ),
        },
        {
            key: "items",
            header: "Item",
            type: "num",
            render: (r) => r.itemCount,
        },
        {
            key: "estimated",
            header: "Nilai Estimasi (Rp)",
            type: "num",
            render: (r) => {
                if (r.estimatedTotal === null || r.estimatedTotal === undefined) {
                    return (
                        <span
                            className="text-[var(--integra-amber)]"
                            title="Sebagian item tidak punya harga pokok — estimasi belum bisa dihitung"
                        >
                            —
                        </span>
                    )
                }
                return r.estimatedTotal.toLocaleString("id-ID")
            },
        },
        {
            key: "status",
            header: "Status",
            render: (r) => <StatusPill kind={statusKind(r.status)}>{statusLabel(r.status)}</StatusPill>,
        },
        {
            key: "approver",
            header: "Approver",
            render: (r) =>
                r.approver ? (
                    <span className="text-[12px]">{r.approver}</span>
                ) : (
                    <span className="text-[var(--integra-muted)]">—</span>
                ),
        },
        {
            key: "date",
            header: "Tanggal Buat",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {fmtDateCol(r.date)}
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
                        className={INT.pillOutline + " cursor-pointer hover:border-[var(--integra-ink)]"}
                        onClick={(e) => {
                            e.stopPropagation()
                            if (label === "Setujui") {
                                router.push(`/procurement/requests/${r.id}#approval`)
                            } else {
                                router.push(`/procurement/requests/${r.id}`)
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
                        label: "Setujui",
                        icon: <Check className="size-3.5" />,
                        variant: "primary",
                        confirm: `Setujui ${selectedIds.size} PR?`,
                        onClick: () => runBulkAction("approve"),
                    },
                    {
                        label: "Tolak",
                        icon: <X className="size-3.5" />,
                        variant: "danger",
                        confirm: `Tolak ${selectedIds.size} PR?`,
                        onClick: () => runBulkAction("reject"),
                    },
                    {
                        label: "Ekspor terpilih (XLSX)",
                        icon: <Download className="size-3.5" />,
                        onClick: () => {
                            const selected = filtered.filter((r) => selectedIds.has(r.id))
                            if (selected.length === 0) {
                                toast.info("Tidak ada PR terpilih untuk diekspor")
                                return
                            }
                            const fname = `permintaan-pembelian-terpilih-${new Date().toISOString().slice(0, 10)}.xlsx`
                            const n = exportPRsToXlsx(selected.map(toExportRow), fname)
                            toast.success(`${n} PR terpilih diekspor ke XLSX`)
                        },
                    },
                    {
                        label: "Ekspor terpilih (CSV)",
                        icon: <Download className="size-3.5" />,
                        onClick: () => {
                            const selected = filtered.filter((r) => selectedIds.has(r.id))
                            if (selected.length === 0) {
                                toast.info("Tidak ada PR terpilih untuk diekspor")
                                return
                            }
                            const fname = `permintaan-pembelian-terpilih-${new Date().toISOString().slice(0, 10)}.csv`
                            const n = exportPRsToCsv(selected.map(toExportRow), fname)
                            toast.success(`${n} PR terpilih diekspor ke CSV`)
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
                    <span className={INT.breadcrumbCurrent}>Permintaan Pembelian</span>
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
                            setPendingPanelValues(prFilterToPanelValues(filter))
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
                                    const n = exportPRsToXlsx(filtered.map(toExportRow))
                                    toast.success(`${n} PR diekspor ke XLSX`)
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
                                    const n = exportPRsToCsv(filtered.map(toExportRow))
                                    toast.success(`${n} PR diekspor ke CSV`)
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
                                Buat PR
                                <ChevronDown className="size-3" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem
                                onClick={() => router.push("/procurement/requests/new")}
                            >
                                <IconPlus className="size-3.5" />
                                Buat manual (form)
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
                    title="Permintaan Pembelian (PR)"
                    subtitle="Inbox persetujuan pengadaan dari departemen internal"
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
                                Menunggu{" "}
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    Rp {fmtIDRJt(pendingValue)}
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
                                placeholder="Cari No. PR, pemohon, departemen… (tekan / untuk fokus)"
                                className="w-full h-8 pl-8 pr-2 text-[12.5px] border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] outline-none focus:border-[var(--integra-liren-blue)] focus:ring-2 focus:ring-[var(--integra-liren-blue)]/30 placeholder:text-[var(--integra-muted)]"
                            />
                        </div>

                        {/* 5-tab segmented status filter */}
                        <div className={INT.periodSelector}>
                            {(
                                [
                                    { v: "ALL", label: "Semua", count: counts.ALL },
                                    { v: "PENDING", label: "Menunggu", count: counts.PENDING },
                                    { v: "APPROVED", label: "Disetujui", count: counts.APPROVED },
                                    { v: "PO_CREATED", label: "Dikonversi PO", count: counts.PO_CREATED },
                                    { v: "REJECTED", label: "Ditolak", count: counts.REJECTED },
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
                            Σ {totalFiltered} PR · Rp {fmtIDRJt(sumFiltered)}
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
                            {filter.departments?.length ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({ ...filter, departments: undefined })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter departemen"
                                >
                                    Departemen:{" "}
                                    {filter.departments.length === 1
                                        ? filter.departments[0]
                                        : `${filter.departments.length} dipilih`}
                                    <X className="size-3" />
                                </button>
                            ) : null}
                            {filter.priority?.length ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({ ...filter, priority: undefined })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter prioritas"
                                >
                                    Prioritas:{" "}
                                    {filter.priority.length === 1
                                        ? PRIORITY_LABEL_LOOKUP[filter.priority[0]] ?? filter.priority[0]
                                        : `${filter.priority.length} dipilih`}
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
                            title="Tidak ada PR"
                            description={
                                statusTab !== "ALL" || activeFilterCount > 0 || filter.search
                                    ? "Tidak ada PR yang cocok dengan filter saat ini. Coba kosongkan beberapa filter."
                                    : "Belum ada Permintaan Pembelian di sistem. Buat PR baru untuk memulai."
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
                                        href="/procurement/requests/new"
                                    >
                                        Buat PR
                                    </IntegraButton>
                                )
                            }
                        />
                    ) : (
                        <DataTable
                            columns={cols}
                            rows={pageRows}
                            rowKey={(r) => r.id}
                            onRowClick={(r) => router.push(`/procurement/requests/${r.id}`)}
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
                            <span className="font-mono">Σ Total Rp {fmtIDRJt(sumAllEstimated)}</span>
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

                {/* Bottom: Approval queue */}
                <Panel
                    title="Antrian Persetujuan"
                    meta={`${approvalQueue.length} menunggu · ${highPriority} prioritas tinggi`}
                    actions={
                        approvalQueue.length > 0 ? (
                            <button
                                type="button"
                                onClick={async () => {
                                    const pendingIds = approvalQueue.map((q) => q.id)
                                    if (pendingIds.length === 0) {
                                        toast.info("Tidak ada PR menunggu approval")
                                        return
                                    }
                                    if (
                                        !window.confirm(
                                            `Setujui ${pendingIds.length} PR yang menunggu approval?`,
                                        )
                                    ) {
                                        return
                                    }
                                    try {
                                        const res = await fetch("/api/procurement/requests/bulk", {
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
                                                `Semua ${failedN} PR gagal disetujui: ${result.failed[0]?.reason ?? ""}`,
                                            )
                                        } else {
                                            toast.success(`${succeededN} PR disetujui`)
                                        }
                                        queryClient.invalidateQueries({
                                            queryKey: queryKeys.purchaseRequests.all,
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
                            title="Tidak ada PR menunggu approval"
                            description="Semua PR sudah diproses. Antrian persetujuan kosong."
                        />
                    ) : (
                        <ul className="m-0 p-0 list-none">
                            {approvalQueue.slice(0, 8).map((q) => {
                                const pKind = priorityKind(q.priority)
                                const isUrgent =
                                    q.priority?.toUpperCase() === "URGENT" ||
                                    q.priority?.toUpperCase() === "HIGH"
                                return (
                                    <li
                                        key={q.id}
                                        className="grid grid-cols-[14px_1fr_auto] items-baseline gap-2.5 px-3.5 py-2 border-b border-[var(--integra-hairline)] last:border-b-0"
                                    >
                                        <span
                                            className={`text-[12px] font-bold ${
                                                isUrgent
                                                    ? "text-[var(--integra-red)]"
                                                    : "text-transparent"
                                            }`}
                                            aria-hidden
                                        >
                                            !
                                        </span>
                                        <span className="text-[12.5px] text-[var(--integra-ink-soft)] truncate flex items-center gap-2">
                                            <span>
                                                PR{" "}
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        router.push(`/procurement/requests/${q.id}`)
                                                    }
                                                    className="font-mono text-[11.5px] text-[var(--integra-liren-blue)] underline underline-offset-2 decoration-[var(--integra-liren-blue)]/40 hover:text-[var(--integra-ink)]"
                                                >
                                                    {q.number}
                                                </button>{" "}
                                                · {q.department || "—"} ·{" "}
                                                <span className="text-[var(--integra-ink)]">
                                                    {q.requester || "—"}
                                                </span>
                                                {typeof q.estimatedTotal === "number" && q.estimatedTotal > 0 && (
                                                    <>
                                                        {" "}·{" "}
                                                        <span className="text-[var(--integra-ink)]">
                                                            Rp {fmtIDRJt(q.estimatedTotal)}
                                                        </span>
                                                    </>
                                                )}
                                            </span>
                                            <StatusPill kind={pKind}>
                                                {priorityLabel(q.priority)}
                                            </StatusPill>
                                        </span>
                                        <span className="font-mono text-[10.5px] text-[var(--integra-muted)] text-right">
                                            {ageLabel(q.ageHours)}
                                        </span>
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
                        key: "departments",
                        label: "Departemen",
                        options: departmentOptions,
                        searchable: true,
                    },
                    {
                        type: "checkbox-group",
                        key: "priority",
                        label: "Prioritas",
                        options: PRIORITY_OPTIONS,
                    },
                    {
                        type: "date-range",
                        key: "createdAt",
                        label: "Tgl Buat",
                    },
                ]}
                values={pendingPanelValues}
                onChange={setPendingPanelValues}
                onApply={() => {
                    const next = panelValuesToPrFilter(pendingPanelValues, filter.search)
                    setFilter(next)
                    setPage(1)
                    setFilterPanelOpen(false)
                }}
                onReset={() => {
                    setPendingPanelValues({})
                }}
                savedFiltersSlot={
                    <SavedFiltersDropdown<PRFilter>
                        module="purchase-requests"
                        currentFilter={filter}
                        onLoadFilter={(values) => {
                            const loaded: PRFilter = { ...values, search: filter.search }
                            setFilter(loaded)
                            setPendingPanelValues(prFilterToPanelValues(loaded))
                            setPage(1)
                            setFilterPanelOpen(false)
                        }}
                    />
                }
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
                            <dd>Buka detail PR baris terpilih</dd>
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

            {/* Import PRs Dialog (XLSX 2-sheet bulk import — lazy-loaded) */}
            {importOpen && (
                <ImportPRsDialog
                    open={importOpen}
                    onOpenChange={setImportOpen}
                    hideTrigger
                />
            )}
        </>
    )
}
