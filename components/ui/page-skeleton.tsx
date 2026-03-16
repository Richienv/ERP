/**
 * Shared skeleton primitives for loading states.
 * Neo-brutalist (NB v2) — aligned with the unified header card system.
 *
 * Key design: The real pages use ONE card with accent bar, 3 internal rows
 * (header / KPI / filter), then table below. Skeletons must preview that
 * same layout so the transition feels seamless.
 */
import type { CSSProperties } from "react"

/* ─── Bone Primitive ────────────────────────────────────── */
function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
    return <div className={`bg-zinc-200/80 dark:bg-zinc-700/60 rounded-[1px] ${className}`} style={style} />
}

/* ─── NB v2 Page Header Skeleton ────────────────────────── */
export function PageHeaderSkeleton({ accentColor = "bg-zinc-400" }: { accentColor?: string }) {
    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
            {/* Real accent bar — immediate brand identity */}
            <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
            <div className="px-5 py-3.5 flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                    <Bone className="w-9 h-9" />
                    <div className="space-y-1.5">
                        <Bone className="h-4 w-40" />
                        <Bone className="h-2.5 w-56" />
                    </div>
                </div>
                <div className="flex items-center">
                    <Bone className="h-9 w-[72px]" />
                    <Bone className="h-9 w-[88px] border-l border-zinc-100 dark:border-zinc-700" />
                    <Bone className="h-9 w-[100px] ml-2 bg-orange-100 dark:bg-orange-900/30" />
                </div>
            </div>
        </div>
    )
}

/* ─── NB v2 KPI Strip Skeleton ──────────────────────────── */
export function KpiStripSkeleton({ cells = 4 }: { cells?: number }) {
    return (
        <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-700 animate-pulse">
            {Array.from({ length: cells }).map((_, i) => (
                <div key={i} className="flex-1 px-4 py-2.5 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                        <Bone className="w-1.5 h-1.5" />
                        <Bone className="h-2.5 w-16" />
                    </div>
                    <div className="flex items-center gap-2">
                        <Bone className="h-5 w-8" />
                        {i === 0 && <Bone className="h-2.5 w-20" />}
                    </div>
                </div>
            ))}
        </div>
    )
}

/* ─── NB v2 Filter Bar Skeleton ─────────────────────────── */
function FilterBarSkeleton() {
    return (
        <div className="px-5 py-2.5 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30 animate-pulse">
            <div className="flex items-center">
                <Bone className="h-9 w-[240px]" />
                <Bone className="h-9 w-[100px] border-l border-zinc-100 dark:border-zinc-700" />
                <Bone className="h-9 w-[72px] border-l border-zinc-100 dark:border-zinc-700" />
            </div>
            <Bone className="h-3 w-16" />
        </div>
    )
}

/* ─── Table Rows + Pagination Skeleton ──────────────────── */
function TableRowsSkeleton({ rows = 8 }: { rows?: number }) {
    const widths = [100, 140, 72, 100, 76, 88, 56]
    return (
        <div className="animate-pulse">
            {/* Column headers */}
            <div className="px-5 py-2 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-700 flex gap-4">
                {widths.map((w, i) => (
                    <Bone key={i} className="h-2.5" style={{ width: w }} />
                ))}
            </div>
            {/* Data rows — subtle fade for depth */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="px-5 py-3 flex gap-4 items-center" style={{ opacity: 1 - i * 0.035 }}>
                        {widths.map((w, j) => (
                            <Bone key={j} className={j === 4 ? "h-5" : j === 6 ? "h-6" : "h-3.5"} style={{ width: w }} />
                        ))}
                    </div>
                ))}
            </div>
            {/* Pagination */}
            <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                <Bone className="h-2.5 w-20" />
                <div className="flex gap-1.5">
                    <Bone className="h-7 w-7" />
                    <Bone className="h-7 w-10" />
                    <Bone className="h-7 w-7" />
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
export function TabContentSkeleton({ kpiCells = 3, rows = 8 }: { kpiCells?: number; rows?: number }) {
    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8 pt-6 w-full">
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                {/* Row 1: Sub-toolbar (label + count + CTA) */}
                <div className="px-5 py-2.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 animate-pulse">
                    <div className="flex items-center gap-3">
                        <Bone className="h-3 w-24" />
                        <Bone className="h-4 w-8 bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                    <Bone className="h-9 w-28 bg-orange-100 dark:bg-orange-900/30" />
                </div>
                {/* Row 2: KPI cells */}
                <div className="border-b border-zinc-200 dark:border-zinc-800">
                    <KpiStripSkeleton cells={kpiCells} />
                </div>
                {/* Row 3: Filter bar */}
                <div className="border-b border-zinc-200 dark:border-zinc-800">
                    <FilterBarSkeleton />
                </div>
                {/* Table rows */}
                <TableRowsSkeleton rows={rows} />
            </div>
        </div>
    )
}

/* ─── Table Container Skeleton (standalone) ─────────────── */
export function TableContainerSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="border-b border-zinc-200 dark:border-zinc-800">
                <FilterBarSkeleton />
            </div>
            <TableRowsSkeleton rows={rows} />
        </div>
    )
}

/* ─── Card Grid Skeleton ────────────────────────────────── */
export function CardGridSkeleton({ cards = 8 }: { cards?: number }) {
    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden flex flex-col min-h-[500px] animate-pulse">
            <div className="p-6 bg-zinc-50/30 dark:bg-zinc-800/20 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6">
                    {Array.from({ length: cards }).map((_, i) => (
                        <div
                            key={i}
                            className="border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 space-y-3"
                        >
                            <div className="flex items-center justify-between">
                                <Bone className="h-4 w-20" />
                                <Bone className="h-5 w-16" />
                            </div>
                            <Bone className="h-5 w-3/4" />
                            <Bone className="h-3 w-full" />
                            <Bone className="h-3 w-2/3" />
                            <div className="flex items-center gap-2 pt-2">
                                <Bone className="h-6 w-6 rounded-full" />
                                <Bone className="h-3 w-24" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

/* ─── Kanban Board Skeleton ─────────────────────────────── */
export function KanbanBoardSkeleton({ columns = 6, cardsPerColumn = 3 }: { columns?: number; cardsPerColumn?: number }) {
    return (
        <div className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-zinc-100 dark:bg-zinc-900 overflow-hidden flex-1 min-h-0 animate-pulse">
            <div className="flex gap-3 p-4 overflow-x-auto h-full">
                {Array.from({ length: columns }).map((_, col) => (
                    <div key={col} className="min-w-[260px] w-[260px] bg-white dark:bg-zinc-800 border-2 border-zinc-200 dark:border-zinc-700 flex flex-col">
                        <div className="p-3 border-b-2 border-zinc-200 dark:border-zinc-700 flex items-center justify-between">
                            <Bone className="h-4 w-20" />
                            <Bone className="h-5 w-8 rounded-sm" />
                        </div>
                        <div className="p-2 space-y-2 flex-1">
                            {Array.from({ length: cardsPerColumn }).map((_, card) => (
                                <div key={card} className="border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                                    <Bone className="h-4 w-3/4" />
                                    <Bone className="h-3 w-full" />
                                    <Bone className="h-3 w-1/2" />
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

export function TablePageSkeleton({ accentColor = "bg-zinc-400" }: { accentColor?: string }) {
    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8 pt-6 w-full space-y-4">
            {/* Unified NB v2 card: accent + header + KPI + filter */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500" />
                {/* Row 1: Header */}
                <div className="px-5 py-3.5 flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 animate-pulse">
                    <div className="flex items-center gap-3">
                        <Bone className="w-9 h-9" />
                        <div className="space-y-1.5">
                            <Bone className="h-4 w-40" />
                            <Bone className="h-2.5 w-56" />
                        </div>
                    </div>
                    <div className="flex items-center">
                        <Bone className="h-9 w-[72px]" />
                        <Bone className="h-9 w-[88px] border-l border-zinc-100 dark:border-zinc-700" />
                        <Bone className="h-9 w-[100px] ml-2 bg-orange-100 dark:bg-orange-900/30" />
                    </div>
                </div>
                {/* Row 2: KPI Strip */}
                <div className="border-b border-zinc-200 dark:border-zinc-800">
                    <KpiStripSkeleton />
                </div>
                {/* Row 3: Filter Bar */}
                <FilterBarSkeleton />
            </div>
            {/* Table content */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden">
                <TableRowsSkeleton />
            </div>
        </div>
    )
}

export function CardPageSkeleton({ accentColor = "bg-zinc-400" }: { accentColor?: string }) {
    return (
        <div className="space-y-4 p-4 md:p-6 lg:p-8 pt-6 w-full min-h-screen">
            <PageHeaderSkeleton accentColor={accentColor} />
            <CardGridSkeleton />
        </div>
    )
}

export function KanbanPageSkeleton({ accentColor = "bg-zinc-400" }: { accentColor?: string }) {
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] space-y-4 p-4 md:p-6 lg:p-8 pt-6 bg-zinc-50/50 dark:bg-black w-full">
            <PageHeaderSkeleton accentColor={accentColor} />
            <Bone className="h-10 w-full max-w-md animate-pulse" />
            <KanbanBoardSkeleton />
        </div>
    )
}
