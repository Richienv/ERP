"use client"

import * as React from "react"
import { X } from "lucide-react"
import { toast } from "sonner"
import { useSavedFilters } from "@/hooks/use-saved-filters"

export function SavedFiltersDropdown<T = unknown>({
    module,
    currentFilter,
    onLoadFilter,
}: {
    module: string
    currentFilter: T
    onLoadFilter: (values: T) => void
}) {
    const { filters, save, remove } = useSavedFilters<T>(module)
    const [showSaveDialog, setShowSaveDialog] = React.useState(false)
    const [newName, setNewName] = React.useState("")

    const handleSave = () => {
        const name = newName.trim()
        if (!name) return
        const err = save(name, currentFilter)
        if (err) {
            toast.error("Gagal menyimpan filter — quota habis")
            return
        }
        setShowSaveDialog(false)
        setNewName("")
    }

    return (
        <div data-saved-filters-dropdown>
            <div className="text-[10.5px] font-medium uppercase tracking-wider text-[var(--integra-muted)] mb-1.5">
                Filter Tersimpan
            </div>
            {filters.length === 0 ? (
                <div className="text-[11.5px] text-[var(--integra-muted)] mb-2">
                    Belum ada filter tersimpan
                </div>
            ) : (
                <ul className="space-y-1 mb-2">
                    {filters.map((f) => (
                        <li
                            key={f.id}
                            className="flex items-center gap-2 group text-[12px]"
                        >
                            <button
                                type="button"
                                onClick={() => onLoadFilter(f.values)}
                                className="flex-1 text-left text-[var(--integra-ink-soft)] hover:text-[var(--integra-ink)] truncate"
                            >
                                {f.name}
                            </button>
                            <button
                                type="button"
                                onClick={() => remove(f.id)}
                                aria-label="Hapus filter"
                                className="opacity-0 group-hover:opacity-100 text-[var(--integra-red)] hover:text-[var(--integra-red)] focus:opacity-100"
                            >
                                <X className="size-3" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {!showSaveDialog ? (
                <button
                    type="button"
                    onClick={() => setShowSaveDialog(true)}
                    className="text-[11px] text-[var(--integra-liren-blue)] hover:underline"
                >
                    + Simpan filter saat ini
                </button>
            ) : (
                <div className="flex gap-1.5">
                    <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                e.preventDefault()
                                handleSave()
                            } else if (e.key === "Escape") {
                                setShowSaveDialog(false)
                                setNewName("")
                            }
                        }}
                        placeholder="Nama filter"
                        aria-label="Nama filter"
                        className="flex-1 border border-[var(--integra-hairline)] px-2 py-1 text-[11.5px] rounded-[2px]"
                    />
                    <button
                        type="button"
                        onClick={handleSave}
                        className="h-7 px-2 bg-[var(--integra-ink)] text-[var(--integra-canvas)] text-[11px] rounded-[2px]"
                    >
                        Simpan
                    </button>
                </div>
            )}
        </div>
    )
}
