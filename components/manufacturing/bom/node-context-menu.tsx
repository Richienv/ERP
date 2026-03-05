"use client"

import { useEffect, useRef } from "react"
import { Trash2, Copy, Play, CheckCircle2, GitBranch } from "lucide-react"

interface NodeContextMenuProps {
    x: number
    y: number
    stepId: string
    onClose: () => void
    onDeleteStep: (stepId: string) => void
    onDuplicateStep: (stepId: string) => void
    onAddParallel: (stepId: string) => void
    onMarkStarted: (stepId: string) => void
    onMarkCompleted: (stepId: string) => void
}

export function NodeContextMenu({
    x, y, stepId, onClose,
    onDeleteStep, onDuplicateStep, onAddParallel, onMarkStarted, onMarkCompleted,
}: NodeContextMenuProps) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose()
        }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [onClose])

    type MenuItem = { kind: "action"; icon: typeof Copy; label: string; action: () => void; color: string }
    type DividerItem = { kind: "divider" }

    const items: (MenuItem | DividerItem)[] = [
        { kind: "action", icon: Copy, label: "Duplikat Work Center", action: () => onDuplicateStep(stepId), color: "text-blue-600" },
        { kind: "action", icon: GitBranch, label: "Tambah Paralel", action: () => onAddParallel(stepId), color: "text-purple-600" },
        { kind: "action", icon: Play, label: "Tandai Mulai", action: () => onMarkStarted(stepId), color: "text-emerald-600" },
        { kind: "action", icon: CheckCircle2, label: "Tandai Selesai", action: () => onMarkCompleted(stepId), color: "text-emerald-600" },
        { kind: "divider" },
        { kind: "action", icon: Trash2, label: "Hapus Work Center", action: () => onDeleteStep(stepId), color: "text-red-600" },
    ]

    return (
        <div
            ref={ref}
            className="fixed z-[9999] bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] min-w-[180px] py-1"
            style={{ left: x, top: y }}
        >
            {items.map((item, i) => {
                if (item.kind === "divider") {
                    return <div key={i} className="border-t border-zinc-200 my-1" />
                }
                const Icon = item.icon
                return (
                    <button
                        key={i}
                        onClick={() => { item.action(); onClose() }}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs font-bold hover:bg-zinc-100 ${item.color}`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                    </button>
                )
            })}
        </div>
    )
}
