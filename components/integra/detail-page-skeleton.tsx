"use client"

/**
 * DetailPageSkeleton — tailored loading state for Integra DetailPage layouts.
 *
 * Mirrors the structure of <DetailPage>:
 *   - Sticky header (breadcrumb + title/subtitle + actions placeholder)
 *   - Sticky tab bar (6 tab placeholders)
 *   - 2-column content grid with row placeholders
 *
 * Goal: avoid layout shift when real data arrives. Uses Integra hairline
 * tokens for shimmer so the skeleton feels native (no off-brand greys).
 */
export function DetailPageSkeleton() {
    return (
        <>
            {/* Header skeleton */}
            <div className="sticky top-0 bg-[var(--integra-canvas)] z-20 border-b border-[var(--integra-hairline)] px-6 py-3">
                {/* Breadcrumb shimmer */}
                <div className="flex items-center gap-2 mb-2">
                    {[60, 80, 100, 120].map((w, i) => (
                        <div
                            key={i}
                            className="h-3 bg-[var(--integra-hairline)] rounded animate-pulse"
                            style={{ width: w }}
                        />
                    ))}
                </div>
                {/* Title row */}
                <div className="flex items-end justify-between gap-4">
                    <div>
                        <div className="h-6 w-48 bg-[var(--integra-hairline)] rounded animate-pulse mb-2" />
                        <div className="h-3 w-72 bg-[var(--integra-hairline)] rounded animate-pulse" />
                    </div>
                    <div className="h-7 w-24 bg-[var(--integra-hairline)] rounded animate-pulse" />
                </div>
            </div>

            {/* Tab bar skeleton */}
            <div className="sticky bg-[var(--integra-canvas)] z-10 border-b border-[var(--integra-hairline)] px-6">
                <div className="flex gap-2 py-2">
                    {[60, 70, 80, 60, 70, 90].map((w, i) => (
                        <div
                            key={i}
                            className="h-5 bg-[var(--integra-hairline)] rounded animate-pulse"
                            style={{ width: w }}
                        />
                    ))}
                </div>
            </div>

            {/* Content skeleton */}
            <div className="px-6 py-5">
                <div className="grid grid-cols-2 gap-x-12 gap-y-6">
                    {[0, 1].map((col) => (
                        <div key={col} className="space-y-3">
                            <div className="h-3 w-32 bg-[var(--integra-hairline)] rounded animate-pulse mb-3" />
                            {[0, 1, 2, 3, 4].map((i) => (
                                <div key={i} className="grid grid-cols-[120px_1fr] gap-3">
                                    <div className="h-3 w-20 bg-[var(--integra-hairline)] rounded animate-pulse" />
                                    <div className="h-3 w-32 bg-[var(--integra-hairline)] rounded animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}
