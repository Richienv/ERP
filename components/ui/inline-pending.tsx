import { cn } from "@/lib/utils"

/**
 * Waiting states that say what they wait for.
 *
 * InlinePendingBar: in-page refetch indicator (isFetching while stale data stays visible).
 * Place it as the first child of a `relative` container, for example an NB card
 * (`relative` + `overflow-hidden` are already on `NB.pageCard`):
 *
 *   import { InlinePendingBar, InlineSpinner } from "@/components/ui/inline-pending"
 *   <div className={`${NB.pageCard} relative`}>
 *     <InlinePendingBar active={isFetching} />
 *     ...existing header / table...
 *   </div>
 *
 * Every indicator shows a short Indonesian line by default. Pass `label` to say
 * what is loading ("Memuat daftar pembelian…"), or `label=""` for the bare indicator.
 */

/** Small, calm ring spinner. Decorative: pair it with visible text. */
export function PendingSpinner({ className }: { className?: string }) {
    return (
        <span
            aria-hidden
            className={cn(
                "inline-block size-4 shrink-0 rounded-full border-2 border-slate-300 border-t-blue-600 animate-spin motion-reduce:animate-none dark:border-zinc-600 dark:border-t-blue-400",
                className,
            )}
        />
    )
}

/** One line of "what are we waiting for", with a spinner. Announced politely to screen readers. */
export function LoadingLine({
    label = "Memuat data…",
    className,
}: {
    label?: string
    className?: string
}) {
    return (
        <div
            role="status"
            aria-live="polite"
            className={cn("flex items-center gap-2.5 text-sm text-muted-foreground", className)}
        >
            <PendingSpinner />
            <span>{label}</span>
        </div>
    )
}

export function InlinePendingBar({
    active = true,
    label = "Memperbarui data…",
    className,
}: {
    active?: boolean
    /** Text on the small tag under the bar. Empty string hides the tag. */
    label?: string
    className?: string
}) {
    if (!active) return null

    return (
        <div
            className={cn(
                "pointer-events-none absolute inset-x-0 top-0 z-10",
                className,
            )}
            role="progressbar"
            aria-busy="true"
            aria-label={label || "Memperbarui data"}
        >
            <div className="relative h-0.5 overflow-hidden bg-blue-100 dark:bg-blue-950">
                <div className="absolute inset-y-0 w-1/3 bg-blue-600 animate-inline-pending motion-reduce:animate-none" />
            </div>
            {label ? (
                <div className="flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-b-md border border-t-0 border-border bg-card/95 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm animate-in fade-in-0 duration-300">
                        <PendingSpinner className="size-3.5 border-[1.5px]" />
                        {label}
                    </span>
                </div>
            ) : null}
        </div>
    )
}

export function InlineSpinner({
    label = "Memuat data…",
    className,
}: {
    /** Visible text next to the spinner. Empty string keeps only a screen-reader label. */
    label?: string
    className?: string
}) {
    return (
        <span
            className={cn("inline-flex items-center gap-2 text-sm text-muted-foreground", className)}
            role="status"
            aria-busy="true"
        >
            <PendingSpinner />
            {label ? <span>{label}</span> : <span className="sr-only">Memuat</span>}
        </span>
    )
}
