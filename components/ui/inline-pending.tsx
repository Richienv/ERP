import { cn } from "@/lib/utils"

/**
 * In-page refetch indicator (isFetching while stale data stays visible).
 *
 * Other zones: place as the first child of an NB card
 * (`relative` + `overflow-hidden` already on `NB.pageCard`).
 *
 *   import { InlinePendingBar, InlineSpinner } from "@/components/ui/inline-pending"
 *   <div className={`${NB.pageCard} relative`}>
 *     <InlinePendingBar active={isFetching} />
 *     ...existing header / table...
 *   </div>
 */

export function InlinePendingBar({
    active = true,
    className,
}: {
    active?: boolean
    className?: string
}) {
    if (!active) return null

    return (
        <div
            className={cn(
                "pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-zinc-200 dark:bg-zinc-800",
                className,
            )}
            role="progressbar"
            aria-busy="true"
            aria-label="Memperbarui data"
        >
            <div className="absolute inset-y-0 w-1/3 bg-orange-500 animate-inline-pending" />
        </div>
    )
}

export function InlineSpinner({
    label,
    className,
}: {
    label?: string
    className?: string
}) {
    return (
        <span
            className={cn("inline-flex items-center gap-1.5 text-xs font-bold text-zinc-500", className)}
            role="status"
            aria-busy="true"
        >
            <span
                className="inline-block h-3.5 w-3.5 shrink-0 border-2 border-zinc-300 border-t-orange-500 dark:border-zinc-600 dark:border-t-orange-500 animate-spin"
                aria-hidden
            />
            {label ? <span>{label}</span> : <span className="sr-only">Memuat</span>}
        </span>
    )
}
