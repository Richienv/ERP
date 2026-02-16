"use client"

import { ClipboardList, Sun, Sunset, Moon } from "lucide-react"
import type { ShiftType } from "@prisma/client"

interface ShiftNote {
    id: string
    shiftDate: string
    shiftType: ShiftType
    content: string
    creatorName: string
    createdAt: string
}

interface ShiftHandoverWidgetProps {
    notes: ShiftNote[]
}

function ShiftIcon({ type }: { type: ShiftType }) {
    switch (type) {
        case 'MORNING': return <Sun className="h-3 w-3 text-amber-500" />
        case 'AFTERNOON': return <Sunset className="h-3 w-3 text-orange-500" />
        case 'NIGHT': return <Moon className="h-3 w-3 text-indigo-500" />
    }
}

function shiftLabel(type: ShiftType): string {
    switch (type) {
        case 'MORNING': return 'Pagi'
        case 'AFTERNOON': return 'Siang'
        case 'NIGHT': return 'Malam'
    }
}

export function ShiftHandoverWidget({ notes }: ShiftHandoverWidgetProps) {
    return (
        <div className="bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Handover Shift</span>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 border-2 border-black bg-zinc-100 text-zinc-700">
                    {notes.length}
                </span>
            </div>

            {/* Notes list */}
            <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
                {notes.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                        <ClipboardList className="h-6 w-6 text-zinc-300 mb-2" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            Belum ada catatan shift
                        </span>
                    </div>
                )}
                {notes.map((note) => (
                    <div key={note.id} className="px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                                <ShiftIcon type={note.shiftType} />
                                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    {shiftLabel(note.shiftType)}
                                </span>
                            </div>
                            <span className="text-[9px] font-bold text-zinc-400">
                                {new Date(note.shiftDate).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
                            </span>
                        </div>
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 line-clamp-2 mb-1">
                            {note.content}
                        </p>
                        <span className="text-[9px] font-bold text-zinc-400">— {note.creatorName}</span>
                    </div>
                ))}
            </div>
        </div>
    )
}
