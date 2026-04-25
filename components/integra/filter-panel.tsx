"use client"

import * as React from "react"

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

export type FilterValues = Record<string, any>

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
    React.useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose()
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [open, onClose])

    if (!open) return null

    const activeCount = Object.keys(values).filter((k) => {
        const v = values[k]
        if (v == null) return false
        if (Array.isArray(v)) return v.length > 0
        if (typeof v === "object") return Object.values(v).some((x) => x != null && x !== "")
        return true
    }).length

    return (
        <>
            <div
                className="fixed inset-0 bg-black/20 z-40"
                onClick={onClose}
                data-filter-backdrop
            />
            <aside
                data-filter-panel
                className="fixed right-0 top-0 h-screen w-[320px] bg-[var(--integra-canvas-pure)] border-l border-[var(--integra-hairline)] z-50 flex flex-col"
            >
                <div className="px-4 py-3 border-b border-[var(--integra-hairline)] flex items-center justify-between">
                    <span className="font-display font-semibold text-[14px]">Filter</span>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Tutup filter"
                        className="text-[var(--integra-muted)] hover:text-[var(--integra-ink)]"
                    >
                        ×
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
    value: any
    onChange: (v: any) => void
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
                    {dim.type === "multi-select" && (
                        <div className="space-y-1.5">
                            {dim.options.map((opt) => {
                                const selected = Array.isArray(value) && value.includes(opt.value)
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
                                                    ? (value ?? []).filter(
                                                          (v: any) => v !== opt.value,
                                                      )
                                                    : [...(value ?? []), opt.value]
                                                onChange(next.length ? next : undefined)
                                            }}
                                        />
                                        {opt.label}
                                    </label>
                                )
                            })}
                        </div>
                    )}
                    {dim.type === "date-range" && (
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="date"
                                value={value?.start ?? ""}
                                onChange={(e) =>
                                    onChange({ ...value, start: e.target.value || undefined })
                                }
                                className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] rounded-[2px]"
                            />
                            <input
                                type="date"
                                value={value?.end ?? ""}
                                onChange={(e) =>
                                    onChange({ ...value, end: e.target.value || undefined })
                                }
                                className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] rounded-[2px]"
                            />
                        </div>
                    )}
                    {dim.type === "amount-range" && (
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="number"
                                placeholder={`Min ${dim.min}`}
                                value={value?.min ?? ""}
                                onChange={(e) =>
                                    onChange({
                                        ...value,
                                        min: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] font-mono rounded-[2px]"
                            />
                            <input
                                type="number"
                                placeholder={`Max ${dim.max}`}
                                value={value?.max ?? ""}
                                onChange={(e) =>
                                    onChange({
                                        ...value,
                                        max: e.target.value === "" ? undefined : Number(e.target.value),
                                    })
                                }
                                className="border border-[var(--integra-hairline)] px-2 py-1 text-[12px] font-mono rounded-[2px]"
                            />
                        </div>
                    )}
                    {dim.type === "checkbox-group" && (
                        <div className="space-y-1.5">
                            {dim.options.map((opt) => {
                                const selected = Array.isArray(value) && value.includes(opt.value)
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
                                                    ? (value ?? []).filter(
                                                          (v: any) => v !== opt.value,
                                                      )
                                                    : [...(value ?? []), opt.value]
                                                onChange(next.length ? next : undefined)
                                            }}
                                        />
                                        {opt.label}
                                    </label>
                                )
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
