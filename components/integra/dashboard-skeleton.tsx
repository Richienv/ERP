"use client"

/**
 * DashboardSkeleton — loading state for Integra dashboard pages.
 *
 * Mirrors the structure of dashboard-style pages (procurement dashboard,
 * inventory dashboard, material gap):
 *   - Sticky topbar (breadcrumb + period + action buttons)
 *   - Page head (title + meta)
 *   - 5-cell KPI rail with hairline dividers
 *   - 2-col main panel row (wide chart/table + side rail)
 *   - 3-col bottom panel row (smaller widgets)
 *
 * Goal: avoid layout shift when real data arrives. Uses Integra hairline
 * tokens for shimmer so the skeleton feels native (no off-brand greys
 * or NB borders/shadows).
 */
export function DashboardSkeleton() {
    // Pre-computed widths so server/client renders match (no hydration drift).
    const bottomRowWidths = [
        [70, 55, 80, 65],
        [60, 75, 50, 80],
        [80, 60, 70, 55],
    ]

    return (
        <>
            {/* Topbar */}
            <div className="h-[52px] flex items-center gap-4 px-5 border-b border-[var(--integra-hairline)] bg-[var(--integra-canvas)]">
                <div className="flex items-center gap-1.5">
                    {[60, 80, 100].map((w, i) => (
                        <div
                            key={i}
                            className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse"
                            style={{ width: w }}
                        />
                    ))}
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <div className="h-7 w-32 bg-[var(--integra-hairline)] rounded animate-pulse" />
                    <div className="h-7 w-20 bg-[var(--integra-hairline)] rounded animate-pulse" />
                    <div className="h-7 w-28 bg-[var(--integra-hairline)] rounded animate-pulse" />
                </div>
            </div>

            <div className="px-6 py-5 space-y-3">
                {/* PageHead */}
                <div className="flex items-end justify-between border-b border-[var(--integra-hairline)] pb-3.5">
                    <div className="space-y-2">
                        <div className="h-5 w-56 bg-[var(--integra-hairline)] rounded animate-pulse" />
                        <div className="h-3 w-72 bg-[var(--integra-hairline)] rounded animate-pulse" />
                    </div>
                </div>

                {/* KPI rail (5 cells) */}
                <div className="grid grid-cols-5 border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)]">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div
                            key={i}
                            className="px-3.5 py-2.5 space-y-2 border-r border-[var(--integra-hairline)] last:border-r-0"
                        >
                            <div className="h-2.5 w-20 bg-[var(--integra-hairline)] rounded animate-pulse" />
                            <div className="h-6 w-16 bg-[var(--integra-hairline)] rounded animate-pulse" />
                            <div className="h-2 w-24 bg-[var(--integra-hairline)] rounded animate-pulse" />
                        </div>
                    ))}
                </div>

                {/* 2-col main panels */}
                <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2 border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] h-[280px] p-3.5 space-y-3">
                        <div className="h-3 w-40 bg-[var(--integra-hairline)] rounded animate-pulse" />
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div key={i} className="grid grid-cols-[100px_1fr_80px] gap-2">
                                <div className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse" />
                                <div className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse" />
                                <div className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                    <div className="border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] h-[280px] p-3.5 space-y-3">
                        <div className="h-3 w-32 bg-[var(--integra-hairline)] rounded animate-pulse" />
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-1.5">
                                <div className="h-3 w-full bg-[var(--integra-hairline)] rounded animate-pulse" />
                                <div className="h-2 w-2/3 bg-[var(--integra-hairline)] rounded animate-pulse" />
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3-col bottom panels */}
                <div className="grid grid-cols-3 gap-3">
                    {bottomRowWidths.map((widths, i) => (
                        <div
                            key={i}
                            className="border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] h-[200px] p-3.5 space-y-2"
                        >
                            <div className="h-3 w-24 bg-[var(--integra-hairline)] rounded animate-pulse" />
                            {widths.map((w, j) => (
                                <div
                                    key={j}
                                    className="h-2.5 bg-[var(--integra-hairline)] rounded animate-pulse"
                                    style={{ width: `${w}%` }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
