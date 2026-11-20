"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { cn } from "@/lib/utils"

type Option = { id: string; label: string; sub?: string }

/** Searchable picker that stays fast with thousands of options (renders at most 50 matches). */
export function SearchPicker({
    value,
    options,
    placeholder,
    emptyLabel,
    onPick,
    onCreate,
    createLabel,
    trigger,
    className,
}: {
    value: string | null
    options: Option[]
    placeholder: string
    emptyLabel: string
    onPick: (id: string) => void
    onCreate?: () => void
    createLabel?: string
    trigger: React.ReactNode
    className?: string
}) {
    const [open, setOpen] = useState(false)
    const [q, setQ] = useState("")
    const matches = useMemo(() => {
        const needle = q.trim().toLowerCase()
        const list = needle
            ? options.filter((o) => o.label.toLowerCase().includes(needle) || (o.sub || "").toLowerCase().includes(needle))
            : options
        return list.slice(0, 50)
    }, [options, q])

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" className={cn("group inline-flex items-center gap-1 text-left", className)}>
                    {trigger}
                    <ChevronsUpDown className="h-3 w-3 shrink-0 text-zinc-400 group-hover:text-zinc-600" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-0 rounded-md border border-border shadow-sm" align="start">
                <Command shouldFilter={false}>
                    <CommandInput placeholder={placeholder} value={q} onValueChange={setQ} className="h-9 text-sm" />
                    <CommandList className="max-h-72">
                        <CommandEmpty className="py-4 text-center text-xs text-zinc-500">{emptyLabel}</CommandEmpty>
                        <CommandGroup>
                            {matches.map((o) => (
                                <CommandItem
                                    key={o.id}
                                    value={o.id}
                                    onSelect={() => {
                                        onPick(o.id)
                                        setOpen(false)
                                    }}
                                    className="rounded-md text-sm"
                                >
                                    <Check className={cn("mr-2 h-3.5 w-3.5", value === o.id ? "opacity-100 text-blue-500" : "opacity-0")} />
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">{o.label}</div>
                                        {o.sub && <div className="truncate text-xs text-zinc-500 font-mono">{o.sub}</div>}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {onCreate && (
                            <CommandGroup>
                                <CommandItem
                                    value="__create"
                                    onSelect={() => {
                                        onCreate()
                                        setOpen(false)
                                    }}
                                    className="rounded-md text-sm font-bold text-blue-600"
                                >
                                    <Plus className="mr-2 h-3.5 w-3.5" /> {createLabel}
                                </CommandItem>
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
