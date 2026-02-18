/**
 * Shared skeleton primitives for loading.tsx files.
 * Neo-brutalist style: border-2 border-black, shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]
 */
import type { CSSProperties } from "react"

function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
    return <div className={`bg-zinc-100 dark:bg-zinc-800 rounded ${className}`} style={style} />
}

/* ─── Page Header Skeleton ─────────────────────────────────── */
export function PageHeaderSkeleton({ accentColor = "bg-zinc-400" }: { accentColor?: string }) {
    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900 animate-pulse">
            <div className={`px-6 py-4 flex items-center justify-between border-l-[6px] ${accentColor}`}>
                <div className="flex items-center gap-3">
                    <Bone className="h-6 w-6" />
                    <div className="space-y-2">
                        <Bone className="h-5 w-48" />
                        <Bone className="h-3 w-72" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Bone className="h-9 w-24" />
                    <Bone className="h-9 w-32" />
                </div>
            </div>
        </div>
    )
}

/* ─── KPI Strip Skeleton (4 cells) ─────────────────────────── */
export function KpiStripSkeleton({ cells = 4 }: { cells?: number }) {
    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] overflow-hidden animate-pulse">
            <div className={`grid grid-cols-2 md:grid-cols-${cells}`}>
                {Array.from({ length: cells }).map((_, i) => (
                    <div
                        key={i}
                        className={`relative p-4 md:p-5 ${i < cells - 1 ? "md:border-r-2 border-b-2 md:border-b-0 border-zinc-100 dark:border-zinc-800" : ""}`}
                    >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-zinc-200 dark:bg-zinc-700" />
                        <div className="flex items-center gap-2 mb-2">
                            <Bone className="h-4 w-4" />
                            <Bone className="h-2.5 w-20" />
                        </div>
                        <Bone className="h-8 w-16 mb-2" />
                        <Bone className="h-2 w-24" />
                    </div>
                ))}
            </div>
        </div>
    )
}

/* ─── Table Container Skeleton ─────────────────────────────── */
export function TableContainerSkeleton({ rows = 8 }: { rows?: number }) {
    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden animate-pulse">
            {/* Toolbar */}
            <div className="p-4 border-b-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800">
                <div className="space-y-2">
                    <Bone className="h-5 w-40" />
                    <Bone className="h-3 w-56" />
                </div>
                <div className="flex items-center gap-2">
                    <Bone className="h-10 w-[200px]" />
                    <Bone className="h-10 w-20" />
                </div>
            </div>
            {/* Table header */}
            <div className="px-5 py-2.5 bg-zinc-50/50 dark:bg-zinc-800/30 border-b border-zinc-200 dark:border-zinc-700 flex gap-4">
                {[120, 160, 80, 100, 90, 100, 60].map((w, i) => (
                    <Bone key={i} className="h-3" style={{ width: w }} />
                ))}
            </div>
            {/* Rows */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {Array.from({ length: rows }).map((_, i) => (
                    <div key={i} className="px-5 py-3 flex gap-4 items-center">
                        <Bone className="h-4 w-[120px]" />
                        <Bone className="h-4 w-[160px]" />
                        <Bone className="h-4 w-[80px]" />
                        <Bone className="h-4 w-[100px]" />
                        <Bone className="h-5 w-[90px]" />
                        <Bone className="h-4 w-[100px]" />
                        <Bone className="h-7 w-[60px]" />
                    </div>
                ))}
            </div>
            {/* Pagination */}
            <div className="px-5 py-3 border-t-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/50">
                <Bone className="h-3 w-16" />
                <div className="flex gap-2">
                    <Bone className="h-8 w-8" />
                    <Bone className="h-8 w-12" />
                    <Bone className="h-8 w-8" />
                </div>
            </div>
        </div>
    )
}

/* ─── Card Grid Skeleton ───────────────────────────────────── */
export function CardGridSkeleton({ cards = 8 }: { cards?: number }) {
    return (
        <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900 overflow-hidden animate-pulse flex flex-col min-h-[500px]">
            {/* Toolbar */}
            <div className="p-4 border-b-2 border-black flex items-center justify-between bg-zinc-50 dark:bg-zinc-800">
                <div className="space-y-2">
                    <Bone className="h-5 w-40" />
                    <Bone className="h-3 w-56" />
                </div>
                <div className="flex items-center gap-2">
                    <Bone className="h-10 w-[200px]" />
                    <Bone className="h-10 w-20" />
                </div>
            </div>
            {/* Grid */}
            <div className="p-6 bg-zinc-100/30 flex-1">
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

/* ─── Kanban Board Skeleton ────────────────────────────────── */
export function KanbanBoardSkeleton({ columns = 6, cardsPerColumn = 3 }: { columns?: number; cardsPerColumn?: number }) {
    return (
        <div className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] bg-zinc-100 dark:bg-zinc-900 overflow-hidden animate-pulse flex-1 min-h-0">
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

/* ─── Full-page skeleton combos ────────────────────────────── */
export function TablePageSkeleton({ accentColor = "bg-zinc-400" }: { accentColor?: string }) {
    return (
        <div className="flex-1 p-4 md:p-6 lg:p-8 pt-6 w-full space-y-4">
            <PageHeaderSkeleton accentColor={accentColor} />
            <KpiStripSkeleton />
            <TableContainerSkeleton />
        </div>
    )
}

export function CardPageSkeleton({ accentColor = "bg-zinc-400" }: { accentColor?: string }) {
    return (
        <div className="space-y-6 p-4 md:p-6 lg:p-8 pt-6 w-full min-h-screen">
            <PageHeaderSkeleton accentColor={accentColor} />
            <KpiStripSkeleton />
            <CardGridSkeleton />
        </div>
    )
}

export function KanbanPageSkeleton({ accentColor = "bg-zinc-400" }: { accentColor?: string }) {
    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] space-y-4 p-4 md:p-6 lg:p-8 pt-6 bg-zinc-50/50 dark:bg-black w-full">
            <PageHeaderSkeleton accentColor={accentColor} />
            <KpiStripSkeleton />
            <Bone className="h-10 w-full max-w-md" />
            <KanbanBoardSkeleton />
        </div>
    )
}
