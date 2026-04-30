"use client"

/**
 * FlagshipListSkeleton — loading state for Integra flagship list pages.
 *
 * Mirrors the structure of the Pengadaan list pages (PO/PR/Vendor/GRN):
 *   - Sticky topbar (breadcrumb + period selector + buttons)
 *   - Page head (title + meta)
 *   - 5-cell KPI rail with hairline dividers
 *   - Combined panel: search + segmented filter tabs + 10-col table
 *   - Bottom 2-col panel row
 *
 * Goal: avoid layout shift when real data arrives. Uses Integra hairline
 * tokens for shimmer so the skeleton feels native (no off-brand greys
 * or NB borders/shadows).
 */
export function FlagshipListSkeleton() {
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
                    <div className="h-7 w-20 bg-[var(--integra-hairline)] rounded animate-pulse" />
                    <div className="h-7 w-28 bg-[var(--integra-hairline)] rounded animate-pulse" />
                </div>
            </div>

            <div className="px-6 py-5 space-y-3">
                {/* Page head */}
                <div className="flex items-end justify-between border-b border-[var(--integra-hairline)] pb-3.5">
                    <div className="space-y-2">
                        <div className="h-5 w-56 bg-[var(--integra-hairline)] rounded animate-pulse" />
                        <div className="h-3 w-72 bg-[var(--integra-hairline)] rounded animate-pulse" />
                    </div>
                    <div className="flex gap-3">
                        {[80, 100, 80].map((w, i) => (
                            <div
                                key={i}
                                className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse"
                                style={{ width: w }}
                            />
                        ))}
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

                {/* Combined panel */}
                <div className="border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] overflow-hidden">
                    {/* Top strip: search + filter tabs */}
                    <div className="px-3.5 py-2.5 border-b border-[var(--integra-hairline)] flex items-center gap-3">
                        <div className="h-7 w-[320px] bg-[var(--integra-hairline)] rounded-[2px] animate-pulse" />
                        <div className="flex gap-2">
                            {[70, 60, 70, 70, 80].map((w, i) => (
                                <div
                                    key={i}
                                    className="h-6 bg-[var(--integra-hairline)] rounded animate-pulse"
                                    style={{ width: w }}
                                />
                            ))}
                        </div>
                        <div className="ml-auto h-3 w-32 bg-[var(--integra-hairline)] rounded animate-pulse" />
                    </div>

                    {/* Table header */}
                    <div
                        className="grid border-b border-[var(--integra-hairline)] px-3.5 py-2"
                        style={{ gridTemplateColumns: "32px repeat(9, 1fr)" }}
                    >
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div
                                key={i}
                                className="h-2.5 bg-[var(--integra-hairline)] rounded animate-pulse mr-3"
                            />
                        ))}
                    </div>

                    {/* Table rows */}
                    {Array.from({ length: 7 }).map((_, rowIdx) => (
                        <div
                            key={rowIdx}
                            className="grid border-b border-[var(--integra-hairline)] last:border-b-0 px-3.5 py-3"
                            style={{ gridTemplateColumns: "32px repeat(9, 1fr)" }}
                        >
                            {Array.from({ length: 10 }).map((_, colIdx) => (
                                <div
                                    key={colIdx}
                                    className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse mr-3"
                                    style={{ opacity: 0.5 + (Math.sin(rowIdx + colIdx) + 1) / 4 }}
                                />
                            ))}
                        </div>
                    ))}

                    {/* Footer */}
                    <div className="px-3.5 py-2 flex items-center justify-between border-t border-[var(--integra-hairline)]">
                        <div className="h-2.5 w-40 bg-[var(--integra-hairline)] rounded animate-pulse" />
                        <div className="h-2.5 w-28 bg-[var(--integra-hairline)] rounded animate-pulse" />
                    </div>
                </div>

                {/* Bottom row 2-col */}
                <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: 2 }).map((_, i) => (
                        <div
                            key={i}
                            className="border border-[var(--integra-hairline)] rounded-[3px] bg-[var(--integra-canvas-pure)] p-3.5 space-y-3"
                        >
                            <div className="h-3 w-32 bg-[var(--integra-hairline)] rounded animate-pulse" />
                            {Array.from({ length: 4 }).map((_, j) => (
                                <div key={j} className="grid grid-cols-[1fr_60px] gap-2">
                                    <div className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse" />
                                    <div className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
