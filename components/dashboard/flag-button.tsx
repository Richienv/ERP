"use client"

import { useState } from "react"
import { IconFlag, IconFlagFilled, IconSend } from "@tabler/icons-react"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useCreateFlag } from "@/hooks/use-ceo-flags"
import { toast } from "sonner"

interface FlagButtonProps {
    title: string
    sourceType: string
    sourceId: string
    sourceLabel: string
}

export function FlagButton({ title, sourceType, sourceId, sourceLabel }: FlagButtonProps) {
    const [open, setOpen] = useState(false)
    const [note, setNote] = useState("")
    const [flagged, setFlagged] = useState(false)
    const createFlag = useCreateFlag()

    const handleSend = async () => {
        try {
            await createFlag.mutateAsync({
                title,
                note: note.trim() || undefined,
                sourceType,
                sourceId,
                sourceLabel,
            })
            setFlagged(true)
            setOpen(false)
            setNote("")
            toast.success("Flag terkirim ke tim terkait")
        } catch {
            toast.error("Gagal mengirim flag")
        }
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={`p-0.5 transition-colors shrink-0 ${
                        flagged
                            ? "text-blue-500"
                            : "text-zinc-300 hover:text-blue-500 opacity-0 group-hover:opacity-100"
                    }`}
                    aria-label="Flag item"
                    onClick={(e) => e.stopPropagation()}
                >
                    {flagged
                        ? <IconFlagFilled className="w-3.5 h-3.5" />
                        : <IconFlag className="w-3.5 h-3.5" />}
                </button>
            </PopoverTrigger>
            <PopoverContent
                side="left"
                align="start"
                sideOffset={8}
                className="w-72 p-0 rounded-md border border-border shadow-sm"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
                    <p className="text-xs font-semibold text-zinc-500">Flag ke Tim</p>
                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate">{title}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{sourceLabel}</p>
                </div>
                <div className="p-3 space-y-2">
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Catatan (opsional)..."
                        className="w-full h-16 text-[12px] border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 resize-none focus:outline-none focus:border-border dark:focus:border-zinc-500 placeholder:text-zinc-300"
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={createFlag.isPending}
                        className="w-full flex items-center justify-center gap-1.5 py-2 bg-blue-500 border border-border text-white text-xs font-semibold hover:bg-blue-600 transition-colors shadow-sm disabled:opacity-50"
                    >
                        <IconSend className="w-3.5 h-3.5" />
                        {createFlag.isPending ? "Mengirim..." : "Kirim Flag"}
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
