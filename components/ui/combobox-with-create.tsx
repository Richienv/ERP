"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Plus, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

export interface ComboboxOption {
    value: string
    label: string
    subtitle?: string
}

interface ComboboxWithCreateProps {
    options: ComboboxOption[]
    value: string
    onChange: (value: string) => void
    placeholder?: string
    searchPlaceholder?: string
    emptyMessage?: string
    createLabel?: string
    onCreate?: (name: string) => Promise<string>
    isLoading?: boolean
    disabled?: boolean
    className?: string
}

export function ComboboxWithCreate({
    options,
    value,
    onChange,
    placeholder = "Pilih...",
    searchPlaceholder = "Cari...",
    emptyMessage = "Tidak ditemukan.",
    createLabel = "+ Buat Baru",
    onCreate,
    isLoading = false,
    disabled = false,
    className,
}: ComboboxWithCreateProps) {
    const [open, setOpen] = React.useState(false)
    const [creating, setCreating] = React.useState(false)
    const [newName, setNewName] = React.useState("")
    const [isCreating, setIsCreating] = React.useState(false)
    const inputRef = React.useRef<HTMLInputElement>(null)

    const selectedOption = options.find(o => o.value === value)

    const handleCreate = async () => {
        if (!onCreate || !newName.trim()) return
        setIsCreating(true)
        try {
            const newId = await onCreate(newName.trim())
            onChange(newId)
            setCreating(false)
            setNewName("")
            setOpen(false)
        } catch {
            // toast handled by caller
        } finally {
            setIsCreating(false)
        }
    }

    if (creating && onCreate) {
        return (
            <div className={cn("flex gap-2", className)}>
                <Input
                    ref={inputRef}
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="Nama baru..."
                    className="border-2 border-black font-bold h-9 flex-1 rounded-none"
                    onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); handleCreate() }
                        if (e.key === "Escape") { setCreating(false); setNewName("") }
                    }}
                    autoFocus
                    disabled={isCreating}
                />
                <Button
                    type="button"
                    size="sm"
                    onClick={handleCreate}
                    disabled={isCreating || !newName.trim()}
                    className="bg-black text-white border-2 border-black font-black text-[10px] uppercase h-9 px-3 rounded-none"
                >
                    {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => { setCreating(false); setNewName("") }}
                    disabled={isCreating}
                    className="border-2 border-black font-black text-[10px] uppercase h-9 px-3 rounded-none"
                >
                    Batal
                </Button>
            </div>
        )
    }

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled || isLoading}
                    className={cn(
                        "w-full justify-between border-2 border-black font-bold h-9 rounded-none text-left",
                        !value && "text-muted-foreground",
                        className
                    )}
                >
                    {isLoading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span className="text-xs">Memuat...</span>
                        </span>
                    ) : selectedOption ? (
                        <span className="truncate">
                            {selectedOption.subtitle ? (
                                <><span className="font-mono font-bold">{selectedOption.subtitle}</span>{" "}<span className="text-zinc-500">{selectedOption.label}</span></>
                            ) : (
                                selectedOption.label
                            )}
                        </span>
                    ) : (
                        <span className="text-xs">{placeholder}</span>
                    )}
                    <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 border border-zinc-300 dark:border-zinc-600 rounded-none shadow-md" align="start">
                <Command className="rounded-none">
                    <CommandInput placeholder={searchPlaceholder} className="h-7 text-[11px]" />
                    <CommandList className="max-h-[200px] overscroll-contain">
                        <CommandEmpty className="py-3 text-center text-[10px] text-zinc-400 font-medium">
                            {emptyMessage}
                        </CommandEmpty>
                        <CommandGroup className="p-0.5">
                            {options.map(option => {
                                const isSelected = value === option.value
                                return (
                                    <CommandItem
                                        key={option.value}
                                        value={option.subtitle ? `${option.subtitle} ${option.label}` : option.label}
                                        onSelect={() => {
                                            onChange(option.value === value ? "" : option.value)
                                            setOpen(false)
                                        }}
                                        className={cn(
                                            "text-[11px] py-1.5 px-2 rounded-none gap-1.5 cursor-pointer",
                                            isSelected && "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-400"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-3.5 h-3.5 flex items-center justify-center shrink-0",
                                            isSelected ? "text-orange-500" : "text-transparent"
                                        )}>
                                            <Check className="h-3 w-3" />
                                        </div>
                                        {option.subtitle ? (
                                            <span className="truncate">
                                                <span className={cn("font-mono font-bold mr-1.5 text-[11px]", isSelected ? "text-orange-600 dark:text-orange-400" : "text-zinc-700 dark:text-zinc-300")}>{option.subtitle}</span>
                                                <span className={cn("text-[11px]", isSelected ? "text-orange-600/70 dark:text-orange-400/70" : "text-zinc-400 dark:text-zinc-500")}>{option.label}</span>
                                            </span>
                                        ) : (
                                            <span className="truncate">{option.label}</span>
                                        )}
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                        {onCreate && (
                            <>
                                <CommandSeparator />
                                <CommandGroup className="p-0.5">
                                    <CommandItem
                                        value="__create_new__"
                                        onSelect={() => {
                                            setCreating(true)
                                            setOpen(false)
                                            setTimeout(() => inputRef.current?.focus(), 50)
                                        }}
                                        className="text-[11px] py-1.5 px-2 rounded-none font-bold text-emerald-700 dark:text-emerald-400 cursor-pointer"
                                    >
                                        <Plus className="mr-1 h-3 w-3" />
                                        {createLabel}
                                    </CommandItem>
                                </CommandGroup>
                            </>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
