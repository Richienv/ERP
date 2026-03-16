/**
 * Custom skeletons for the Perencanaan Arus Kas pages.
 * Mirrors the actual board layouts instead of using generic table skeletons.
 */

import type { CSSProperties } from "react"

function Bone({ className = "", style }: { className?: string; style?: CSSProperties }) {
    return <div className={`bg-zinc-200 dark:bg-zinc-700 animate-pulse ${className}`} style={style} />
}

// ─── Landing Page Skeleton (cashflow-planning-board) ────────────────────────

export function CashflowBoardSkeleton() {
    return (
        <div className="mf-page space-y-6 animate-pulse">
            {/* ═══ TOP STRIP ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="h-1 bg-gradient-to-r from-orange-500/30 via-amber-400/30 to-orange-500/30" />

                {/* Header row */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center gap-3">
                        <Bone className="w-9 h-9 rounded-none" />
                        <div className="space-y-1.5">
                            <Bone className="h-4 w-44" />
                            <Bone className="h-3 w-56" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Bone className="h-9 w-9" />
                        <Bone className="h-9 w-[140px]" />
                        <Bone className="h-9 w-9" />
                        <Bone className="h-9 w-20 ml-2" />
                        <Bone className="h-9 w-16" />
                        <Bone className="h-9 w-24 ml-2" />
                        <Bone className="h-9 w-28 ml-2" />
                    </div>
                </div>

                {/* Cash position + runway + banks row */}
                <div className="flex flex-col lg:flex-row gap-0 divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
                    {/* Posisi Kas */}
                    <div className="p-5 lg:w-[280px]">
                        <div className="flex items-center gap-2 mb-2">
                            <Bone className="h-4 w-4" />
                            <Bone className="h-3 w-20" />
                        </div>
                        <Bone className="h-8 w-48 mb-1" />
                        <Bone className="h-3 w-32" />
                    </div>
                    {/* Cash Runway */}
                    <div className="p-5 lg:w-[240px]">
                        <div className="flex items-center gap-2 mb-2">
                            <Bone className="h-4 w-4" />
                            <Bone className="h-3 w-24" />
                        </div>
                        <Bone className="h-5 w-36 mb-2" />
                        <Bone className="h-2 w-full" />
                    </div>
                    {/* Bank pills */}
                    <div className="p-5 flex-1">
                        <div className="flex items-center gap-2 mb-3">
                            <Bone className="h-4 w-4" />
                            <Bone className="h-3 w-20" />
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Bone className="h-8 w-16" />
                            <Bone className="h-8 w-28" />
                            <Bone className="h-8 w-24" />
                            <Bone className="h-8 w-32" />
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ OBLIGATION SUMMARY CARDS ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div
                        key={i}
                        className="border-2 border-black border-l-4 p-4 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] bg-white dark:bg-zinc-900"
                        style={{ borderLeftColor: ["#10b981", "#ef4444", "#6366f1", "#f97316", "#d946ef", "#71717a"][i] }}
                    >
                        <div className="flex items-center justify-between mb-2">
                            <Bone className="h-3 w-16" />
                            <Bone className="h-5 w-5 rounded-full" />
                        </div>
                        <Bone className="h-6 w-20 mb-2" />
                        <div className="flex items-center justify-between">
                            <Bone className="h-3 w-24" />
                            <Bone className="h-3 w-12" />
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══ WEEKLY SWIM-LANE COLUMNS ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, weekIdx) => (
                    <div
                        key={weekIdx}
                        className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col"
                    >
                        {/* Week header */}
                        <div className={`px-4 py-3 border-b-2 border-black flex items-center justify-between ${weekIdx === 2 ? "bg-emerald-100" : "bg-zinc-100"}`}>
                            <div className="space-y-1">
                                <Bone className="h-4 w-14" />
                                <Bone className="h-3 w-24" />
                            </div>
                            <Bone className="h-4 w-12" />
                        </div>

                        {/* Items zone */}
                        <div className="flex-1 min-h-[120px] p-3 space-y-2">
                            <Bone className="h-3 w-16 mb-2" />
                            {Array.from({ length: 2 + (weekIdx % 2) }).map((_, j) => (
                                <div key={j} className="border-l-4 border-zinc-200 pl-2 py-1 space-y-1">
                                    <Bone className="h-3 w-3/4" />
                                    <Bone className="h-4 w-20" />
                                </div>
                            ))}
                            {weekIdx < 3 && (
                                <>
                                    <div className="border-t border-dashed border-zinc-200 my-2" />
                                    <Bone className="h-3 w-16 mb-2" />
                                    {Array.from({ length: 1 + (weekIdx % 2) }).map((_, j) => (
                                        <div key={j} className="border-l-4 border-zinc-200 pl-2 py-1 space-y-1">
                                            <Bone className="h-3 w-2/3" />
                                            <Bone className="h-4 w-20" />
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>

                        {/* Week footer */}
                        <div className="border-t-2 border-black bg-zinc-50 p-3 space-y-2">
                            <div className="flex justify-between">
                                <Bone className="h-4 w-14" />
                                <Bone className="h-4 w-14" />
                                <Bone className="h-4 w-16" />
                            </div>
                            <div className="flex items-center justify-between">
                                <Bone className="h-3 w-10" />
                                <Bone className="h-4 w-28" />
                            </div>
                            <Bone className="h-1.5 w-full" />
                        </div>
                    </div>
                ))}
            </div>

            {/* ═══ SUMMARY CARD ═══ */}
            <div className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900">
                <div className="h-1 bg-gradient-to-r from-orange-500/30 via-amber-400/30 to-orange-500/30" />
                <div className="flex items-center divide-x divide-zinc-200 dark:divide-zinc-800">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex-1 px-4 py-3 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                                <Bone className="w-2 h-2 rounded-full" />
                                <Bone className="h-3 w-16" />
                            </div>
                            <Bone className="h-5 w-24" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

// ─── Simulasi / Aktual Sub-page Skeleton ────────────────────────────────────

export function CashflowSubpageSkeleton({ variant = "simulasi" }: { variant?: "simulasi" | "aktual" }) {
    const isSimulasi = variant === "simulasi"

    return (
        <div className={`animate-pulse ${isSimulasi ? "flex gap-0 border-2 border-black rounded-xl overflow-hidden mt-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" : "mt-4 border-2 border-black rounded-xl overflow-hidden bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"}`} style={isSimulasi ? { minHeight: "70vh" } : undefined}>
            {/* Sidebar (simulasi only) */}
            {isSimulasi && (
                <div className="w-[280px] border-r-2 border-black bg-zinc-50 dark:bg-zinc-900 flex flex-col">
                    {/* Sidebar header */}
                    <div className="p-4 border-b-2 border-black">
                        <Bone className="h-5 w-28 mb-3" />
                        <Bone className="h-9 w-full" />
                    </div>
                    {/* Scenario list */}
                    <div className="p-3 space-y-2 flex-1">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                                <Bone className="h-4 w-32" />
                                <Bone className="h-3 w-20" />
                            </div>
                        ))}
                    </div>
                    {/* Source toggles */}
                    <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 space-y-2">
                        <Bone className="h-3 w-24 mb-2" />
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Bone className="h-4 w-4 rounded" />
                                <Bone className="h-3 w-20" />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Main content */}
            <div className="flex-1 bg-white">
                {/* KPI Strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 border-b-2 border-black">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`p-4 ${i < 3 ? "border-r border-zinc-200" : ""}`}>
                            <div className="flex items-center gap-1.5 mb-2">
                                <Bone className="h-3.5 w-3.5" />
                                <Bone className="h-3 w-20" />
                            </div>
                            <Bone className="h-5 w-24 mb-1" />
                            {i < 3 ? (
                                i === 1 ? <Bone className="h-1.5 w-full mt-1" /> : <Bone className="h-3 w-16 mt-0.5" />
                            ) : (
                                <div className="flex gap-2 mt-1">
                                    <Bone className="h-8 w-20" />
                                    {isSimulasi && <Bone className="h-8 w-20" />}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Week Cards */}
                <div className="p-4 space-y-4">
                    {Array.from({ length: 4 }).map((_, weekIdx) => (
                        <div key={weekIdx} className="border-2 border-black rounded-lg overflow-hidden">
                            {/* Week header */}
                            <div className="flex items-center justify-between px-3 py-2 bg-zinc-50 border-b border-zinc-200">
                                <div className="flex items-center gap-2">
                                    <Bone className="h-3.5 w-3.5" />
                                    <Bone className="h-3 w-28" />
                                    {weekIdx === 2 && <Bone className="h-4 w-16 rounded-sm" />}
                                </div>
                                <div className="flex items-center gap-3">
                                    <Bone className="h-3 w-12" />
                                    <Bone className="h-3 w-12" />
                                    {isSimulasi && <Bone className="h-3 w-16" />}
                                </div>
                            </div>
                            {/* Items */}
                            <div className="divide-y divide-zinc-100">
                                {Array.from({ length: 2 + (weekIdx % 3) }).map((_, j) => (
                                    <div key={j} className="px-3 py-2.5 flex items-center justify-between">
                                        <div className="flex items-center gap-2 flex-1">
                                            {isSimulasi && <Bone className="h-4 w-4 rounded" />}
                                            <Bone className="h-3 w-4/5 max-w-[300px]" />
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <Bone className="h-4 w-16" />
                                            <Bone className="h-5 w-12" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Summary Bar */}
                <div className="border-t-2 border-black bg-zinc-50 px-4 py-3">
                    <div className="grid grid-cols-5 gap-4 text-center">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="space-y-1">
                                <Bone className="h-3 w-16 mx-auto" />
                                <Bone className="h-4 w-24 mx-auto" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
