/**
 * Shared skeleton primitives for loading states (Integra Pro).
 *
 * The real pages use ONE white card (`NB.pageCard`: hairline border, rounded-lg,
 * shadow-sm) with header / KPI / filter rows, then a table. Skeletons preview the
 * same layout so the swap feels seamless, and every full skeleton says what it is
 * waiting for: "Memuat data…" by default, or the `label` you pass
 * (e.g. `<TablePageSkeleton label="Memuat daftar pembelian…" />`).
 *
 * `accentColor` is still accepted for existing callers but no longer drawn:
 * the page cards have no accent bar any more.
 */
import type { CSSProperties } from "react"
import { LoadingLine } from "@/components/ui/inline-pending"

const CARD = "relative overflow-hidden rounded-lg border border-border bg-card shadow-sm"
const ROW_BORDER = "border-b border-slate-100 dark:border-zinc-800"

/* ─── Bone Primitive ────────────────────────────────────── */
function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
    return <div className={`rounded bg-slate-200/80 dark:bg-zinc-700/60 ${className}`} style={style} />
}

/* ─── "What are we waiting for" tag, floated over the skeleton ── */
function SkeletonStatus({ label }: { label?: string }) {
    return (
        <div className="pointer-events-none absolute inset-x-0 top-12 z-10 flex justify-center px-4">
            <LoadingLine
                label={label}
                className="rounded-full border border-border bg-card px-4 py-2 font-medium shadow-sm"
            />
        </div>
    )
}

/* ─── Page Header Skeleton ──────────────────────────────── */
export function PageHeaderSkeleton(_props: { accentColor?: string } = {}) {
    return (
        <div className={CARD} aria-hidden>
            <div className="px-5 py-4 flex items-center justify-between gap-4 animate-pulse">
                <div className="flex items-center gap-3">
                    <Bone className="w-10 h-10 rounded-md" />
                    <div className="space-y-2">
                        <Bone className="h-4 w-44" />
                        <Bone className="h-3 w-60 max-w-[40vw]" />
                    </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                    <Bone className="h-10 w-24 rounded-md" />
                    <Bone className="h-10 w-28 rounded-md bg-blue-100 dark:bg-blue-900/30" />
                </div>
            </div>
        </div>
    )
}

/* ─── KPI Strip Skeleton ────────────────────────────────── */
export function KpiStripSkeleton({ cells = 4 }: { cells?: number }) {
    return (
        <div className="flex items-stretch divide-x divide-slate-100 dark:divide-zinc-800 animate-pulse" aria-hidden>
            {Array.from({ length: cells }).map((_, i) => (
                <div key={i} className="flex-1 px-5 py-4 flex items-center justify-between gap-3">
                    <Bone className="h-3.5 w-20" />
                    <div className="flex items-center gap-2">
                        <Bone className="h-6 w-10" />
                        {i === 0 && <Bone className="hidden md:block h-3 w-20" />}
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ─── Filter Bar Skeleton ───────────────────────────────── */
function FilterBarSkeleton() {
    return (
        <div className="px-5 py-3 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-zinc-800/30 animate-pulse" aria-hidden>
            <div className="flex items-center gap-2">
                <Bone className="h-10 w-[240px] max-w-[45vw] rounded-md" />
                <Bone className="hidden md:block h-10 w-[120px] rounded-md" />
                <Bone className="hidden md:block h-10 w-[96px] rounded-md" />
            </div>
            <Bone className="h-3.5 w-16" />
        </div>
    )
}

/* ─── Table Rows + Pagination Skeleton ──────────────────── */
function TableRowsSkeleton({ rows = 8 }: { rows?: number }) {
    const widths = [100, 140, 72, 100, 76, 88, 56]
    return (
        <div className="animate-pulse overflow-hidden" aria-hidden>
            {/* Column headers */}
            <div className="px-5 py-3 bg-slate-50 dark:bg-zinc-800/40 border-b border-border flex gap-4">
                {widths.map((w, i) => (
                    <Bone key={i} className="h-3 shrink-0" style={{ width: w }} />
                ))}
            </div>
            {/* Data rows — subtle fade for depth */}
            <div className="divide-y divide-slate-100 dark:divide-zinc-800">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="px-5 py-3.5 flex gap-4 items-center" style={{ opacity: 1 - i * 0.05 }}>
                        {widths.map((w, j) => (
                            <Bone
                                key={j}
                                className={`shrink-0 ${j === 4 ? "h-5 rounded-full" : j === 6 ? "h-7 rounded-md" : "h-3.5"}`}
                                style={{ width: w }}
                            />
                        ))}
                    </div>
                ))}
            </div>
            {/* Pagination */}
            <div className="px-5 py-3 border-t border-border flex items-center justify-between">
                <Bone className="h-3 w-24" />
                <div className="flex gap-1.5">
                    <Bone className="h-8 w-8 rounded-md" />
                    <Bone className="h-8 w-10 rounded-md" />
                    <Bone className="h-8 w-8 rounded-md" />
                </div>
            </div>
        </div>
    )
}

/* ─── Tab Content Skeleton ──────────────────────────────── */
/*
 * Used as the loading fallback for dynamically-imported tab content
 * inside the Hutang (AP) / Piutang (AR) tabbed pages.
 *
 * Shows: sub-toolbar + KPI strip + filter bar + table rows
 * inside a single unified card — NO redundant page header,
 * since the parent tab page already displays the header.
 */
export function TabContentSkeleton({
    kpiCells = 3,
    rows = 8,
    label,
}: {
    kpiCells?: number
    rows?: number
    /** What is loading, e.g. "Memuat daftar tagihan…". Default "Memuat data…". */
    label?: string
}) {
    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8 pt-6 w-full">
            <div className={CARD}>
                {/* Row 1: Sub-toolbar (label + count + CTA) */}
                <div className={`px-5 py-3 flex items-center justify-between ${ROW_BORDER} animate-pulse`} aria-hidden>
                    <div className="flex items-center gap-3">
                        <Bone className="h-3.5 w-28" />
                        <Bone className="h-5 w-8 rounded-full bg-slate-100 dark:bg-zinc-800" />
                    </div>
                    <Bone className="h-10 w-32 rounded-md bg-blue-100 dark:bg-blue-900/30" />
                </div>
                {/* Row 2: KPI cells */}
                <div className={ROW_BORDER}>
                    <KpiStripSkeleton cells={kpiCells} />
                </div>
                {/* Row 3: Filter bar */}
                <div className={ROW_BORDER}>
                    <FilterBarSkeleton />
                </div>
                {/* Table rows */}
                <div className="relative">
                    <SkeletonStatus label={label} />
                    <TableRowsSkeleton rows={rows} />
                </div>
            </div>
        </div>
    )
}

/* ─── Table Container Skeleton (standalone) ─────────────── */
export function TableContainerSkeleton({ rows = 8, label }: { rows?: number; label?: string }) {
    return (
        <div className={CARD}>
            <div className={ROW_BORDER}>
                <FilterBarSkeleton />
            </div>
            <div className="relative">
                <SkeletonStatus label={label} />
                <TableRowsSkeleton rows={rows} />
            </div>
        </div>
    )
}

/* ─── Card Grid Skeleton ────────────────────────────────── */
export function CardGridSkeleton({ cards = 8, label }: { cards?: number; label?: string }) {
    return (
        <div className={`${CARD} flex flex-col min-h-[500px]`}>
            <SkeletonStatus label={label} />
            <div className="p-6 bg-slate-50/50 dark:bg-zinc-800/20 flex-1 animate-pulse" aria-hidden>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                    {Array.from({ length: cards }).map((_, i) => (
                        <div
                            key={i}
                            className="rounded-lg border border-border bg-card p-4 space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <Bone className="h-4 w-20" />
                                <Bone className="h-5 w-16 rounded-full" />
                            </div>
                            <Bone className="h-5 w-3/4" />
                            <Bone className="h-3.5 w-full" />
                            <Bone className="h-3.5 w-2/3" />
                            <div className="flex items-center gap-2 pt-2">
                                <Bone className="h-7 w-7 rounded-full" />
                                <Bone className="h-3.5 w-24" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ─── Kanban Board Skeleton ─────────────────────────────── */
export function KanbanBoardSkeleton({
    columns = 6,
    cardsPerColumn = 3,
    label,
}: {
    columns?: number
    cardsPerColumn?: number
    label?: string
}) {
    return (
        <div className={`${CARD} bg-slate-50 dark:bg-zinc-900 flex-1 min-h-0`}>
            <SkeletonStatus label={label} />
            <div className="flex gap-3 p-4 overflow-x-auto h-full animate-pulse" aria-hidden>
                {Array.from({ length: columns }).map((_, col) => (
                    <div key={col} className="min-w-[260px] w-[260px] rounded-lg bg-card border border-border flex flex-col">
                        <div className={`p-3 ${ROW_BORDER} flex items-center justify-between`}>
                            <Bone className="h-4 w-24" />
                            <Bone className="h-5 w-8 rounded-full" />
                        </div>
                        <div className="p-2 space-y-2 flex-1">
                            {Array.from({ length: cardsPerColumn }).map((_, card) => (
                                <div key={card} className="rounded-md border border-border p-3 space-y-2">
                                    <Bone className="h-4 w-3/4" />
                                    <Bone className="h-3.5 w-full" />
                                    <Bone className="h-3.5 w-1/2" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ═══ Full-Page Skeleton Combos ══════════════════════════ */

type PageSkeletonProps = {
    /** Kept for existing callers; no longer drawn. */
    accentColor?: string
    /** What is loading, e.g. "Memuat daftar pembelian…". Default "Memuat data…". */
    label?: string
}

export function TablePageSkeleton({ label }: PageSkeletonProps) {
    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8 pt-6 w-full space-y-4">
            {/* Unified page card: header + KPI + filter */}
            <div className={CARD} aria-hidden>
                {/* Row 1: Header */}
                <div className={`px-5 py-4 flex items-center justify-between gap-4 ${ROW_BORDER} animate-pulse`}>
                    <div className="flex items-center gap-3">
                        <Bone className="w-10 h-10 rounded-md" />
                        <div className="space-y-2">
                            <Bone className="h-4 w-44" />
                            <Bone className="h-3 w-60 max-w-[40vw]" />
                        </div>
                    </div>
                    <div className="hidden sm:flex items-center gap-2">
                        <Bone className="h-10 w-24 rounded-md" />
                        <Bone className="h-10 w-28 rounded-md bg-blue-100 dark:bg-blue-900/30" />
                    </div>
                </div>
                {/* Row 2: KPI Strip */}
                <div className={ROW_BORDER}>
                    <KpiStripSkeleton />
                </div>
                {/* Row 3: Filter Bar */}
                <FilterBarSkeleton />
            </div>
            {/* Table content */}
            <div className={CARD}>
                <SkeletonStatus label={label} />
                <TableRowsSkeleton />
            </div>
        </div>
    )
}

export function CardPageSkeleton({ label }: PageSkeletonProps) {
    return (
        <div className="space-y-4 p-4 md:p-6 lg:p-8 pt-6 w-full min-h-screen">
            <PageHeaderSkeleton />
            <CardGridSkeleton label={label} />
        </div>
    )
}

export function KanbanPageSkeleton({ label }: PageSkeletonProps) {
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] space-y-4 p-4 md:p-6 lg:p-8 pt-6 w-full">
            <PageHeaderSkeleton />
            <Bone className="h-10 w-full max-w-md rounded-md animate-pulse" />
            <KanbanBoardSkeleton label={label} />
        </div>
    )
}
