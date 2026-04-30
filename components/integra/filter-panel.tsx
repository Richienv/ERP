"use client"

import * as React from "react"
import { X } from "lucide-react"

export type FilterDimension =
    | {
          type: "multi-select"
          key: string
          label: string
          options: { value: string; label: string }[]
          searchable?: boolean
      }
    | { type: "date-range"; key: string; label: string }
    | { type: "amount-range"; key: string; label: string; min: number; max: number }
    | {
          type: "checkbox-group"
          key: string
          label: string
          options: { value: string; label: string }[]
      }

export type DateRangeValue = { start?: string; end?: string }
export type AmountRangeValue = { min?: number; max?: number }
export type FilterValue = string[] | DateRangeValue | AmountRangeValue
export type FilterValues = Record<string, FilterValue | undefined>

function isFilled(v: FilterValue | undefined): boolean {
    if (v == null) return false
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === "object") return Object.values(v).some((x) => x != null && x !== "")
    return true
}

export function FilterPanel({
    open,
    onClose,
    dimensions,
    values,
    onChange,
    onApply,
    onReset,
    savedFiltersSlot,
}: {
    open: boolean
    onClose: () => void
    dimensions: FilterDimension[]
    values: FilterValues
    onChange: (next: FilterValues) => void
    onApply: () => void
    onReset: () => void
    savedFiltersSlot?: React.ReactNode
}) {
    const closeButtonRef = React.useRef<HTMLButtonElement | null>(null)
    const previousFocusRef = React.useRef<HTMLElement | null>(null)

    React.useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, onClose])

    // Focus management: store previous focus on open, restore on close
    React.useEffect(() => {
        if (open) {
            previousFocusRef.current =
                typeof document !== "undefined"
                    ? (document.activeElement as HTMLElement | null)
                    : null
            // Move focus to close button after the panel mounts
            const id = window.setTimeout(() => {
                closeButtonRef.current?.focus()
            }, 0)
            return () => {
                window.clearTimeout(id)
            }
        }
        // When panel closes, restore focus to whatever had it before opening
        const prev = previousFocusRef.current
        if (prev && typeof prev.focus === "function") {
            prev.focus()
        }
        return undefined
    }, [open])

    if (!open) return null

    const activeCount = Object.keys(values).filter((k) => isFilled(values[k])).length

    return (
        <>
            <div
                className="fixed inset-0 bg-black/20 z-40"
                onClick={onClose}
                data-filter-backdrop
            />
            <aside
                data-filter-panel
                role="dialog"
                aria-modal="true"
                aria-labelledby="filter-panel-title"
                className="fixed right-0 top-0 h-screen w-[320px] bg-[var(--integra-canvas-pure)] border-l border-[var(--integra-hairline)] z-50 flex flex-col"
            >
                <div className="px-4 py-3 border-b border-[var(--integra-hairline)] flex items-center justify-between">
                    <span
                        id="filter-panel-title"
                        className="font-display font-semibold text-[14px]"
                    >
                        Filter
                    </span>
                    <button
                        ref={closeButtonRef}
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup filter"
                        className="text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                    >
                        <X className="size-3.5" />
                    </button>
                </div>
                {savedFiltersSlot && (
                    <div className="px-4 py-2 border-b border-[var(--integra-hairline)]">
                        {savedFiltersSlot}
                    </div>
                )}
                <div className="flex-1 overflow-auto">
                    {dimensions.map((d) => (
                        <DimensionField
                            key={d.key}
                            dim={d}
                            value={values[d.key]}
                            onChange={(v) => {
                                const next = { ...values }
                                if (v === undefined) {
                                    delete next[d.key]
                                } else {
                                    next[d.key] = v
                                }
                                onChange(next)
                            }}
                        />
                    ))}
                </div>
                <div className="px-4 py-3 border-t border-[var(--integra-hairline)] flex gap-2">
                    <button
                        type="button"
                        onClick={onReset}
                        className="flex-1 text-[12px] text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onApply}
                        className="flex-1 h-7 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[12px] rounded-[3px]"
                    >
                        Terapkan{activeCount > 0 ? ` (${activeCount})` : ""}
                    </button>
                </div>
            </aside>
        </>
    )
}

function DimensionField({
    dim,
    value,
    onChange,
}: {
    dim: FilterDimension
    value: FilterValue | undefined
    onChange: (v: FilterValue | undefined) => void
}) {
    const [expanded, setExpanded] = React.useState(true)
    return (
        <div className="border-b border-[var(--integra-hairline)]">
            <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                className="w-full px-4 py-2.5 flex items-center justify-between text-[12px] font-medium text-[var(--integra-ink)]"
            >
                {dim.label}
                <span className="text-[var(--integra-muted)]">{expanded ? "−" : "+"}</span>
            </button>
            {expanded && (
                <div className="px-4 pb-3">
                    {dim.type === "multi-select" &&
                        renderCheckboxList(dim.options, value, onChange)}
                    {dim.type === "date-range" &&
                        renderDateRange(value as DateRangeValue | undefined, onChange)}
                    {dim.type === "amount-range" &&
                        renderAmountRange(
                            dim,
                            value as AmountRangeValue | undefined,
                            onChange,
                        )}
                    {dim.type === "checkbox-group" &&
                        renderCheckboxList(dim.options, value, onChange)}
                </div>
            )}
        </div>
    )
}

function renderCheckboxList(
    options: { value: string; label: string }[],
    value: FilterValue | undefined,
    onChange: (v: FilterValue | undefined) => void,
) {
    const current: string[] = Array.isArray(value) ? value : []
    return (
        <div className="space-y-1.5">
            {options.map((opt) => {
                const selected = current.includes(opt.value)
                return (
                    <label
                        key={opt.value}
                        className="flex items-center gap-2 text-[12px] cursor-pointer"
                    >
                        <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => {
                                const next = selected
                                    ? current.filter((v) => v !== opt.value)
                                    : [...current, opt.value]
                                onChange(next.length ? next : undefined)
                            }}
                        />
                        {opt.label}
                    </label>
                )
            })}
        </div>
    )
}

function renderDateRange(
    value: DateRangeValue | undefined,
    onChange: (v: FilterValue | undefined) => void,
) {
    const current: DateRangeValue = value ?? {}
    return (
        <div className="grid grid-cols-2 gap-2">
            <input
                type="date"
                value={current.start ?? ""}
                onChange={(e) => {
                    const next: DateRangeValue = {
                        ...current,
                        start: e.target.value || undefined,
                    }
                    onChange(isFilled(next) ? next : undefined)
                }}
                className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] rounded-[2px]"
            />
            <input
                type="date"
                value={current.end ?? ""}
                onChange={(e) => {
                    const next: DateRangeValue = {
                        ...current,
                        end: e.target.value || undefined,
                    }
                    onChange(isFilled(next) ? next : undefined)
                }}
                className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] rounded-[2px]"
            />
        </div>
    )
}

function renderAmountRange(
    dim: { min: number; max: number },
    value: AmountRangeValue | undefined,
    onChange: (v: FilterValue | undefined) => void,
) {
    const current: AmountRangeValue = value ?? {}
    return (
        <div className="grid grid-cols-2 gap-2">
            <input
                type="number"
                placeholder={`Min ${dim.min}`}
                value={current.min ?? ""}
                onChange={(e) => {
                    const next: AmountRangeValue = {
                        ...current,
                        min: e.target.value === "" ? undefined : Number(e.target.value),
                    }
                    onChange(isFilled(next) ? next : undefined)
                }}
                className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] font-mono rounded-[2px]"
            />
            <input
                type="number"
                placeholder={`Max ${dim.max}`}
                value={current.max ?? ""}
                onChange={(e) => {
                    const next: AmountRangeValue = {
                        ...current,
                        max: e.target.value === "" ? undefined : Number(e.target.value),
                    }
                    onChange(isFilled(next) ? next : undefined)
                }}
                className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] font-mono rounded-[2px]"
            />
        </div>
    )
}
