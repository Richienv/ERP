"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

export type BulkAction = {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: "primary" | "danger" | "default"
    confirm?: string
}

export function BulkActionToolbar({
    selectedCount,
    totalCount,
    onSelectAll,
    onClearSelection,
    actions,
}: {
    selectedCount: number
    totalCount: number
    onSelectAll: () => void
    onClearSelection: () => void
    actions: BulkAction[]
}) {
    const [confirmAction, setConfirmAction] = React.useState<BulkAction | null>(null)
    const confirmTitleId = React.useId()

    React.useEffect(() => {
        if (selectedCount === 0) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            if (confirmAction) {
                setConfirmAction(null)
            } else {
                onClearSelection()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [selectedCount, confirmAction, onClearSelection])

    if (selectedCount === 0) return null

    return (
        <>
            <div
                data-bulk-toolbar
                role="toolbar"
                aria-label="Aksi terpilih"
                className="sticky top-0 z-30 bg-[var(--integra-ink)] text-[var(--integra-canvas)] px-4 py-2 flex items-center gap-3 text-[12px]"
            >
                <span className="font-mono">
                    {selectedCount} dipilih dari {totalCount}
                </span>
                <span className="opacity-50" aria-hidden="true">
                    ·
                </span>
                <button
                    type="button"
                    onClick={onSelectAll}
                    className="opacity-80 hover:opacity-100"
                >
                    Pilih semua
                </button>
                <span className="opacity-50" aria-hidden="true">
                    |
                </span>
                <button
                    type="button"
                    onClick={onClearSelection}
                    className="opacity-80 hover:opacity-100"
                >
                    Batal
                </button>
                <span className="opacity-50" aria-hidden="true">
                    ·
                </span>
                <div className="flex gap-1.5 ml-auto">
                    {actions.map((a) => (
                        <button
                            key={a.label}
                            type="button"
                            onClick={() =>
                                a.confirm ? setConfirmAction(a) : a.onClick()
                            }
                            className={cn(
                                "h-7 px-3 rounded-[3px] text-[12px] flex items-center gap-1.5",
                                a.variant === "primary" &&
                                    "bg-[var(--integra-canvas)] text-[var(--integra-ink)]",
                                a.variant === "danger" &&
                                    "bg-[var(--integra-red)] text-white",
                                (!a.variant || a.variant === "default") &&
                                    "border border-[var(--integra-canvas)]/40 hover:bg-white/10",
                            )}
                        >
                            {a.icon}
                            {a.label}
                        </button>
                    ))}
                </div>
            </div>
            {confirmAction && (
                <div
                    className="fixed inset-0 bg-black/40 z-50 grid place-items-center"
                    onClick={() => setConfirmAction(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={confirmTitleId}
                        className="bg-[var(--integra-canvas-pure)] p-5 rounded-[3px] max-w-sm"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <p
                            id={confirmTitleId}
                            className="text-[13px] text-[var(--integra-ink)]"
                        >
                            {confirmAction.confirm}
                        </p>
                        <div className="flex gap-2 mt-4 justify-end">
                            <button
                                type="button"
                                onClick={() => setConfirmAction(null)}
                                className="h-7 px-3 text-[12px] text-[var(--integra-muted)]"
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    confirmAction.onClick()
                                    setConfirmAction(null)
                                }}
                                className={cn(
                                    "h-7 px-3 text-[12px] rounded-[3px]",
                                    confirmAction.variant === "danger"
                                        ? "bg-[var(--integra-red)] text-white"
                                        : "bg-[var(--integra-ink)] text-[var(--integra-canvas)]",
                                )}
                            >
                                {confirmAction.label}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
