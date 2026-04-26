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
import { X, Check, Download, CircleSlash } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { useVendorsList } from "@/hooks/use-vendors"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import {
    Panel,
    KPIRail,
    StatusPill,
    IntegraButton,
    PageHead,
    LiveDot,
    DataTable,
    EmptyState,
    type ColumnDef,
    type KPIData,
} from "@/components/integra"
import { BulkActionToolbar } from "@/components/integra/bulk-action-toolbar"
import { FilterPanel, type FilterValues } from "@/components/integra/filter-panel"
import { SavedFiltersDropdown } from "@/components/integra/saved-filters-dropdown"
import type { VendorFilter } from "@/lib/types/vendor-filters"
import { queryKeys } from "@/lib/query-keys"
import { INT, fmtDateTime } from "@/lib/integra-tokens"
import { exportVendorsToXlsx, type VendorExportRow } from "@/lib/exports/vendor-xlsx"

// ──────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────

type StatusTab = "ALL" | "ACTIVE" | "INACTIVE" | "STRATEGIC" | "RISKY"
type PillKind = "ok" | "warn" | "err" | "info" | "neutral"

interface VendorRow {
    id: string
    code: string
    name: string
    contactName: string | null
    contactTitle: string | null
    email: string | null
    phone: string | null
    picPhone: string | null
    officePhone: string | null
    address: string | null
    npwp: string | null
    paymentTerm: string | null
    rating: number
    onTimeRate: number
    isActive: boolean
    totalOrders: number
    activeOrders: number
    categories: { id: string; code: string; name: string }[]
}

// ──────────────────────────────────────────────────────────────────
// Bahasa labels & helpers
// ──────────────────────────────────────────────────────────────────

const PAYMENT_TERM_OPTIONS = [
    { value: "CASH", label: "Tunai" },
    { value: "COD", label: "COD" },
    { value: "NET_15", label: "NET 15" },
    { value: "NET_30", label: "NET 30" },
    { value: "NET_45", label: "NET 45" },
    { value: "NET_60", label: "NET 60" },
    { value: "NET_90", label: "NET 90" },
]

const STATUS_OPTIONS = [
    { value: "ACTIVE", label: "Aktif" },
    { value: "INACTIVE", label: "Nonaktif" },
]

const RATING_OPTIONS = [
    { value: "1", label: "1 ★" },
    { value: "2", label: "2 ★" },
    { value: "3", label: "3 ★" },
    { value: "4", label: "4 ★" },
    { value: "5", label: "5 ★" },
]

const PAYMENT_TERM_LABEL: Record<string, string> = PAYMENT_TERM_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<string, string>,
)
const STATUS_LABEL: Record<string, string> = STATUS_OPTIONS.reduce(
    (acc, o) => ({ ...acc, [o.value]: o.label }),
    {} as Record<string, string>,
)

function paymentTermLabel(v: string | null): string {
    if (!v) return "—"
    return PAYMENT_TERM_LABEL[v] ?? v
}

function ratingStars(n: number): string {
    if (!n || n <= 0) return "—"
    const safe = Math.max(0, Math.min(5, Math.round(n)))
    return "★".repeat(safe) + "☆".repeat(5 - safe)
}

function otdKind(otd: number): PillKind {
    if (otd >= 95) return "ok"
    if (otd >= 85) return "ok"
    if (otd >= 75) return "warn"
    return "err"
}

function maskNPWP(s: string | null): string {
    if (!s) return "—"
    // Display NPWP as-is for now (it's not a secret), with monospace styling
    return s
}

// ──────────────────────────────────────────────────────────────────
// URL <-> VendorFilter helpers
// ──────────────────────────────────────────────────────────────────

function readFilterFromUrl(sp: URLSearchParams): VendorFilter {
    const f: VendorFilter = {}
    const status = sp.get("status")
    if (status) {
        const parts = status.split(",").filter(Boolean)
        const valid = parts.filter((x): x is "ACTIVE" | "INACTIVE" => x === "ACTIVE" || x === "INACTIVE")
        if (valid.length) f.status = valid
    }
    const ratings = sp.get("ratings")
    if (ratings) {
        const nums = ratings
            .split(",")
            .map((x) => parseInt(x, 10))
            .filter((n) => !isNaN(n) && n >= 1 && n <= 5)
        if (nums.length) f.ratings = nums
    }
    const paymentTerms = sp.get("paymentTerms")
    if (paymentTerms) f.paymentTerms = paymentTerms.split(",").filter(Boolean)
    const search = sp.get("q")
    if (search) f.search = search
    return f
}

function writeFilterToParams(f: VendorFilter, base: URLSearchParams): URLSearchParams {
    const next = new URLSearchParams(base.toString())
    next.delete("status")
    next.delete("ratings")
    next.delete("paymentTerms")
    next.delete("q")
    if (f.status?.length) next.set("status", f.status.join(","))
    if (f.ratings?.length) next.set("ratings", f.ratings.join(","))
    if (f.paymentTerms?.length) next.set("paymentTerms", f.paymentTerms.join(","))
    if (f.search) next.set("q", f.search)
    return next
}

function vendorFilterToPanelValues(f: VendorFilter): FilterValues {
    const v: FilterValues = {}
    if (f.status?.length) v.status = f.status
    if (f.ratings?.length) v.ratings = f.ratings.map(String)
    if (f.paymentTerms?.length) v.paymentTerms = f.paymentTerms
    return v
}

function panelValuesToVendorFilter(v: FilterValues, search?: string): VendorFilter {
    const next: VendorFilter = {}
    const status = v.status
    if (Array.isArray(status) && status.length) {
        next.status = status.filter((x): x is "ACTIVE" | "INACTIVE" => x === "ACTIVE" || x === "INACTIVE")
    }
    const ratings = v.ratings
    if (Array.isArray(ratings) && ratings.length) {
        next.ratings = ratings
            .map((x) => parseInt(String(x), 10))
            .filter((n) => !isNaN(n) && n >= 1 && n <= 5)
    }
    const paymentTerms = v.paymentTerms
    if (Array.isArray(paymentTerms) && paymentTerms.length) {
        next.paymentTerms = paymentTerms.map(String)
    }
    if (search) next.search = search
    return next
}

const CHIP_CLASS =
    "inline-flex items-center gap-1 px-2 py-1 border border-[var(--integra-hairline-strong)] rounded-[2px] text-[11px] text-[var(--integra-ink-soft)] bg-[var(--integra-canvas-pure)] hover:border-[var(--integra-ink)] cursor-pointer"

const PAGE_SIZE = 10

// ──────────────────────────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────────────────────────

export default function VendorsPage() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    // ── Initialise applied filter from URL (one-shot)
    const initialFilterRef = React.useRef<VendorFilter | null>(null)
    if (initialFilterRef.current === null) {
        initialFilterRef.current = readFilterFromUrl(searchParams)
    }
    const [filter, setFilter] = React.useState<VendorFilter>(initialFilterRef.current)
    const [filterPanelOpen, setFilterPanelOpen] = React.useState(false)
    const [pendingPanelValues, setPendingPanelValues] = React.useState<FilterValues>({})

    const { data, isLoading, error, refetch } = useVendorsList(filter)
    const queryClient = useQueryClient()

    const [statusTab, setStatusTab] = useState<StatusTab>("ALL")
    const [searchInput, setSearchInput] = useState<string>(filter.search ?? "")
    const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
    const [stubModal, setStubModal] = React.useState<{
        title: string
        body: React.ReactNode
    } | null>(null)

    // ── Keyboard shortcuts
    const searchInputRef = React.useRef<HTMLInputElement | null>(null)
    const [highlightedIndex, setHighlightedIndex] = React.useState<number>(-1)
    const [showShortcuts, setShowShortcuts] = React.useState<boolean>(false)
    const pageRowsRef = React.useRef<VendorRow[]>([])
    const highlightedIndexRef = React.useRef<number>(-1)
    const showShortcutsRef = React.useRef<boolean>(false)
    React.useEffect(() => {
        highlightedIndexRef.current = highlightedIndex
    }, [highlightedIndex])
    React.useEffect(() => {
        showShortcutsRef.current = showShortcuts
    }, [showShortcuts])

    const filterRef = React.useRef<VendorFilter>(filter)
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
                        router.push(`/procurement/vendors/${rows[idx].id}`)
                    }
                    break
                }
                case "f":
                case "F": {
                    e.preventDefault()
                    setPendingPanelValues(vendorFilterToPanelValues(filterRef.current))
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
        if (filter.ratings?.length) n++
        if (filter.paymentTerms?.length) n++
        return n
    }, [filter])

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-indigo-400" />
    }

    if (error) {
        return (
            <div className="px-6 py-12">
                <EmptyState
                    title="Gagal memuat daftar vendor"
                    description={error instanceof Error ? error.message : "Terjadi kesalahan saat memuat daftar pemasok. Silakan coba lagi."}
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
        return <TablePageSkeleton accentColor="bg-indigo-400" />
    }

    const vendors = (data ?? []) as VendorRow[]

    // ── Counts per bucket
    const counts = vendors.reduce(
        (acc, v) => {
            acc.ALL++
            if (v.isActive) acc.ACTIVE++
            else acc.INACTIVE++
            if (v.rating >= 4) acc.STRATEGIC++
            if (v.onTimeRate < 85 && v.totalOrders > 0) acc.RISKY++
            return acc
        },
        { ALL: 0, ACTIVE: 0, INACTIVE: 0, STRATEGIC: 0, RISKY: 0 } as Record<StatusTab, number>,
    )

    // ── Filtered rows (server already filtered via VendorFilter; bucket tab is local)
    const filtered = vendors.filter((v) => {
        if (statusTab === "ACTIVE") return v.isActive
        if (statusTab === "INACTIVE") return !v.isActive
        if (statusTab === "STRATEGIC") return v.rating >= 4
        if (statusTab === "RISKY") return v.onTimeRate < 85 && v.totalOrders > 0
        return true
    })

    const totalFiltered = filtered.length
    const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))
    const safePage = Math.min(page, totalPages)
    const start = (safePage - 1) * PAGE_SIZE
    const end = start + PAGE_SIZE
    const pageRows = filtered.slice(start, end)
    pageRowsRef.current = pageRows

    // ── Map a VendorRow into the shape expected by the XLSX exporter
    const toExportRow = (r: VendorRow): VendorExportRow => ({
        code: r.code,
        name: r.name,
        contactName: r.contactName,
        email: r.email,
        phone: r.phone ?? r.picPhone ?? r.officePhone,
        npwp: r.npwp,
        paymentTerm: paymentTermLabel(r.paymentTerm),
        rating: r.rating,
        onTimeRate: r.onTimeRate,
        status: r.isActive ? "Aktif" : "Nonaktif",
        totalOrders: r.totalOrders,
    })

    // ── Bulk-select helpers
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

    const runBulkAction = async (action: "activate" | "deactivate") => {
        const ids = Array.from(selectedIds)
        if (ids.length === 0) return
        try {
            const res = await fetch("/api/procurement/vendors/bulk", {
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
            const verb = action === "activate" ? "diaktifkan" : "dinonaktifkan"
            if (failedN > 0 && succeededN > 0) {
                toast.warning(`${succeededN} ${verb}, ${failedN} gagal`)
            } else if (failedN > 0) {
                toast.error(`Semua ${failedN} vendor gagal ${verb}: ${result.failed[0]?.reason ?? ""}`)
            } else {
                toast.success(`${succeededN} vendor ${verb}`)
            }
            clearSelection()
            queryClient.invalidateQueries({ queryKey: queryKeys.vendors.all })
        } catch (e) {
            const msg = e instanceof Error ? e.message : "Unknown error"
            toast.error(`Gagal bulk ${action}: ${msg}`)
        }
    }

    // ── Aggregates
    const totalActiveOrders = vendors.reduce((s, v) => s + v.activeOrders, 0)
    const sumActivePOValue = 0 // Not available without joining PO totals — placeholder
    void sumActivePOValue

    // ── KPIs (5)
    const kpis: KPIData[] = [
        {
            label: "Total Vendor",
            value: String(counts.ALL),
            foot: <span>Semua pemasok terdaftar</span>,
        },
        {
            label: "Aktif",
            value: String(counts.ACTIVE),
            foot: <span>Bisa transaksi</span>,
        },
        {
            label: "Strategis",
            value: String(counts.STRATEGIC),
            foot: <span>Rating ≥ 4 ★</span>,
        },
        {
            label: "Bermasalah",
            value: (
                <span className={counts.RISKY > 0 ? "text-[var(--integra-red)]" : undefined}>
                    {counts.RISKY}
                </span>
            ),
            foot: <span>OTD &lt; 85%</span>,
        },
        {
            label: "PO Aktif",
            value: String(totalActiveOrders),
            foot: <span>Sedang berjalan</span>,
        },
    ]

    // ── Table columns
    const cols: ColumnDef<VendorRow>[] = [
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
                    aria-label={`Pilih ${r.name}`}
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
            key: "code",
            header: "Kode",
            type: "code",
            render: (r) => <span className="font-mono text-[12px] text-[var(--integra-ink)]">{r.code}</span>,
            width: "110px",
        },
        {
            key: "name",
            header: "Nama Vendor",
            type: "primary",
            render: (r) => r.name,
        },
        {
            key: "kontak",
            header: "Kontak (PIC)",
            render: (r) => {
                const pic = r.contactName
                const channel = r.email ?? r.phone ?? r.picPhone ?? r.officePhone
                if (!pic && !channel) return <span className="text-[var(--integra-muted)]">—</span>
                return (
                    <div className="flex flex-col leading-tight">
                        {pic ? (
                            <span className="text-[12.5px] text-[var(--integra-ink)]">{pic}</span>
                        ) : (
                            <span className="text-[var(--integra-muted)] text-[12px]">—</span>
                        )}
                        {channel ? (
                            <span className="font-mono text-[10.5px] text-[var(--integra-muted)] truncate max-w-[200px]">
                                {channel}
                            </span>
                        ) : null}
                    </div>
                )
            },
        },
        {
            key: "npwp",
            header: "NPWP",
            render: (r) => (
                <span className="font-mono text-[11.5px] text-[var(--integra-muted)]">
                    {maskNPWP(r.npwp)}
                </span>
            ),
            width: "150px",
        },
        {
            key: "pay",
            header: "Pembayaran",
            render: (r) => (
                <StatusPill kind="neutral">{paymentTermLabel(r.paymentTerm)}</StatusPill>
            ),
        },
        {
            key: "rating",
            header: "Rating",
            render: (r) =>
                r.rating > 0 ? (
                    <span className="text-[12.5px] text-[var(--integra-amber)] tracking-tight">
                        {ratingStars(r.rating)}
                    </span>
                ) : (
                    <span className="text-[var(--integra-muted)] text-[12px]">—</span>
                ),
        },
        {
            key: "otd",
            header: "OTD %",
            type: "num",
            render: (r) => {
                if (!r.totalOrders) return <span className="text-[var(--integra-muted)]">—</span>
                const k = otdKind(r.onTimeRate)
                const cls =
                    k === "ok"
                        ? "text-[var(--integra-green-ok)]"
                        : k === "warn"
                          ? "text-[var(--integra-amber)]"
                          : "text-[var(--integra-red)]"
                return <span className={cls}>{r.onTimeRate.toFixed(0)}%</span>
            },
        },
        {
            key: "status",
            header: "Status",
            render: (r) =>
                r.isActive ? (
                    <StatusPill kind="ok">Aktif</StatusPill>
                ) : (
                    <StatusPill kind="neutral">Nonaktif</StatusPill>
                ),
        },
        {
            key: "aksi",
            header: "Aksi",
            render: (r) => (
                <button
                    type="button"
                    className={INT.pillOutline + " cursor-pointer hover:border-[var(--integra-ink)]"}
                    onClick={(e) => {
                        e.stopPropagation()
                        router.push(`/procurement/vendors/${r.id}`)
                    }}
                >
                    Lihat
                </button>
            ),
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
                        label: "Aktifkan",
                        icon: <Check className="size-3.5" />,
                        variant: "primary",
                        confirm: `Aktifkan ${selectedIds.size} vendor?`,
                        onClick: () => runBulkAction("activate"),
                    },
                    {
                        label: "Nonaktifkan",
                        icon: <CircleSlash className="size-3.5" />,
                        variant: "danger",
                        confirm: `Nonaktifkan ${selectedIds.size} vendor?`,
                        onClick: () => runBulkAction("deactivate"),
                    },
                    {
                        label: "Ekspor terpilih",
                        icon: <Download className="size-3.5" />,
                        onClick: () => {
                            const selected = filtered.filter((r) => selectedIds.has(r.id))
                            if (selected.length === 0) {
                                toast.info("Tidak ada vendor terpilih untuk diekspor")
                                return
                            }
                            const fname = `pemasok-terpilih-${new Date().toISOString().slice(0, 10)}.xlsx`
                            const n = exportVendorsToXlsx(selected.map(toExportRow), fname)
                            toast.success(`${n} vendor terpilih diekspor`)
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
                    <span className={INT.breadcrumbCurrent}>Pemasok</span>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <IntegraButton
                        variant="secondary"
                        icon={<IconFilter className="w-3.5 h-3.5" />}
                        onClick={() => {
                            setPendingPanelValues(vendorFilterToPanelValues(filter))
                            setFilterPanelOpen(true)
                        }}
                    >
                        {`Filter${activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}`}
                    </IntegraButton>
                    <IntegraButton
                        variant="secondary"
                        icon={<IconDownload className="w-3.5 h-3.5" />}
                        onClick={() => {
                            if (filtered.length === 0) {
                                toast.info("Tidak ada data untuk diekspor")
                                return
                            }
                            const n = exportVendorsToXlsx(filtered.map(toExportRow))
                            toast.success(`${n} vendor diekspor`)
                        }}
                    >
                        Ekspor
                    </IntegraButton>
                    <IntegraButton
                        variant="primary"
                        icon={<IconPlus className="w-3.5 h-3.5" />}
                        onClick={() =>
                            setStubModal({
                                title: "Buat Vendor",
                                body: "Form pembuatan vendor akan tersedia di rilis berikutnya. Untuk sekarang gunakan dialog cepat dari halaman lama atau hubungi admin master data.",
                            })
                        }
                    >
                        Buat Vendor
                    </IntegraButton>
                </div>
            </div>

            {/* Page content */}
            <div className="px-6 py-5 space-y-3">
                <PageHead
                    title="Pemasok"
                    subtitle="Master data vendor + tracking performa"
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
                                Total{" "}
                                <span className="font-mono text-[11.5px] text-[var(--integra-ink)]">
                                    {counts.ALL} vendor
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
                                placeholder="Cari nama, kode, NPWP, atau PIC… (tekan / untuk fokus)"
                                className="w-full h-8 pl-8 pr-2 text-[12.5px] border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] outline-none focus:border-[var(--integra-liren-blue)] focus:ring-2 focus:ring-[var(--integra-liren-blue)]/30 placeholder:text-[var(--integra-muted)]"
                            />
                        </div>

                        {/* 5-tab segmented bucket filter */}
                        <div className={INT.periodSelector}>
                            {(
                                [
                                    { v: "ALL", label: "Semua", count: counts.ALL },
                                    { v: "ACTIVE", label: "Aktif", count: counts.ACTIVE },
                                    { v: "INACTIVE", label: "Nonaktif", count: counts.INACTIVE },
                                    { v: "STRATEGIC", label: "Strategis", count: counts.STRATEGIC },
                                    { v: "RISKY", label: "Bermasalah", count: counts.RISKY },
                                ] as const
                            ).map((opt) => {
                                const active = statusTab === opt.v
                                const isRisky = opt.v === "RISKY"
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
                                                    : isRisky && opt.count > 0
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
                            Σ {totalFiltered} vendor
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
                                        ? STATUS_LABEL[filter.status[0]] ?? filter.status[0]
                                        : `${filter.status.length} dipilih`}
                                    <X className="size-3" />
                                </button>
                            ) : null}
                            {filter.ratings?.length ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFilter({ ...filter, ratings: undefined })
                                        setPage(1)
                                    }}
                                    className={CHIP_CLASS}
                                    aria-label="Hapus filter rating"
                                >
                                    Rating:{" "}
                                    {filter.ratings.length === 1
                                        ? `${filter.ratings[0]} ★`
                                        : `${filter.ratings.length} dipilih`}
                                    <X className="size-3" />
                                </button>
                            ) : null}
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
                                        ? PAYMENT_TERM_LABEL[filter.paymentTerms[0]] ??
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
                            title="Tidak ada vendor"
                            description={
                                statusTab !== "ALL" || activeFilterCount > 0 || filter.search
                                    ? "Tidak ada vendor yang cocok dengan filter saat ini. Coba kosongkan beberapa filter."
                                    : "Belum ada pemasok di sistem. Tambahkan vendor baru untuk memulai."
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
                                                title: "Buat Vendor",
                                                body: "Form pembuatan vendor akan tersedia di rilis berikutnya.",
                                            })
                                        }
                                        className="h-8 px-4 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px]"
                                    >
                                        + Buat Vendor
                                    </button>
                                )
                            }
                        />
                    ) : (
                        <DataTable
                            columns={cols}
                            rows={pageRows}
                            rowKey={(r) => r.id}
                            onRowClick={(r) => router.push(`/procurement/vendors/${r.id}`)}
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
                            <span className="font-mono">
                                Σ {pageRows.reduce((s, v) => s + v.totalOrders, 0)} PO total halaman ini
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
                        type: "checkbox-group",
                        key: "ratings",
                        label: "Rating (★)",
                        options: RATING_OPTIONS,
                    },
                    {
                        type: "checkbox-group",
                        key: "paymentTerms",
                        label: "Termin Pembayaran",
                        options: PAYMENT_TERM_OPTIONS,
                    },
                ]}
                values={pendingPanelValues}
                onChange={setPendingPanelValues}
                onApply={() => {
                    const next = panelValuesToVendorFilter(pendingPanelValues, filter.search)
                    setFilter(next)
                    setPage(1)
                    setFilterPanelOpen(false)
                }}
                onReset={() => {
                    setPendingPanelValues({})
                }}
                savedFiltersSlot={
                    <SavedFiltersDropdown<VendorFilter>
                        module="vendors"
                        currentFilter={filter}
                        onLoadFilter={(values) => {
                            const loaded: VendorFilter = { ...values, search: filter.search }
                            setFilter(loaded)
                            setPendingPanelValues(vendorFilterToPanelValues(loaded))
                            setPage(1)
                            setFilterPanelOpen(false)
                        }}
                    />
                }
            />

            {/* Stub feature modal */}
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
                            <dd>Buka detail vendor baris terpilih</dd>
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
