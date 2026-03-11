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
                            ? "text-orange-500"
                            : "text-zinc-300 hover:text-orange-500 opacity-0 group-hover:opacity-100"
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
                className="w-72 p-0 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-700">
                    <p className="text-[11px] font-black uppercase tracking-wider text-zinc-500">Flag ke Tim</p>
                    <p className="text-[12px] font-semibold text-zinc-900 dark:text-zinc-100 mt-0.5 truncate">{title}</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{sourceLabel}</p>
                </div>
                <div className="p-3 space-y-2">
                    <textarea
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="Catatan (opsional)..."
                        className="w-full h-16 text-[12px] border-2 border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1.5 resize-none focus:outline-none focus:border-black dark:focus:border-zinc-500 placeholder:text-zinc-300"
                    />
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={createFlag.isPending}
                        className="w-full flex items-center justify-center gap-1.5 py-2 bg-orange-500 border-2 border-black text-white text-[11px] font-black uppercase tracking-wider hover:bg-orange-600 transition-colors shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50"
                    >
                        <IconSend className="w-3.5 h-3.5" />
                        {createFlag.isPending ? "Mengirim..." : "Kirim Flag"}
                    </button>
                </div>
            </PopoverContent>
        </Popover>
    )
}
