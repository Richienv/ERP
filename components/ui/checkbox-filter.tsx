"use client"

import { useState } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { ChevronDown } from "lucide-react"

interface CheckboxFilterOption {
    value: string
    label: string
}

interface CheckboxFilterProps {
    label: string
    options: CheckboxFilterOption[]
    selected: string[]
    onChange: (selected: string[]) => void
}

export function CheckboxFilter({ label, options, selected, onChange }: CheckboxFilterProps) {
    const [open, setOpen] = useState(false)

    const allSelected = selected.length === options.length || selected.length === 0
    const displayText = allSelected
        ? "Semua"
        : selected.length === 1
            ? options.find(o => o.value === selected[0])?.label || selected[0]
            : `${selected.length} dipilih`

    const toggleValue = (value: string) => {
        if (selected.includes(value)) {
            onChange(selected.filter(v => v !== value))
        } else {
            onChange([...selected, value])
        }
    }

    const selectAll = () => onChange(options.map(o => o.value))
    const clearAll = () => onChange([])

    return (
        <div>
            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">{label}</label>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 border-2 border-black h-9 px-3 bg-white text-xs font-medium min-w-[160px] justify-between hover:bg-zinc-50 transition-colors">
                        <span className="truncate">{displayText}</span>
                        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-0 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] rounded-none" align="start">
                    <div className="flex items-center justify-between px-3 py-2 border-b-2 border-zinc-100">
                        <button onClick={selectAll} className="text-[10px] font-bold text-blue-600 hover:underline">Pilih Semua</button>
                        <button onClick={clearAll} className="text-[10px] font-bold text-zinc-400 hover:underline">Hapus</button>
                    </div>
                    <div className="p-2 space-y-1 max-h-[240px] overflow-y-auto">
                        {options.map(opt => (
                            <label key={opt.value} className="flex items-center gap-2.5 px-2 py-1.5 hover:bg-zinc-50 cursor-pointer">
                                <Checkbox
                                    checked={allSelected || selected.includes(opt.value)}
                                    onCheckedChange={() => {
                                        if (allSelected) {
                                            onChange([opt.value])
                                        } else {
                                            toggleValue(opt.value)
                                        }
                                    }}
                                />
                                <span className="text-xs font-medium">{opt.label}</span>
                            </label>
                        ))}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    )
}
