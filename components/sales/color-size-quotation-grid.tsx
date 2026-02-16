"use client"

import { useState, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Grid3X3, Plus, Trash2 } from "lucide-react"

interface ColorSizeQty {
    colorCode: string
    colorName: string
    size: string
    qty: number
    unitPrice: number
}

interface ColorSizeQuotationGridProps {
    /** Current entries in the grid */
    entries: ColorSizeQty[]
    /** Called whenever entries change */
    onChange: (entries: ColorSizeQty[]) => void
    /** Default unit price for new cells */
    defaultUnitPrice?: number
    /** Whether the grid is read-only */
    readOnly?: boolean
}

export function ColorSizeQuotationGrid({
    entries,
    onChange,
    defaultUnitPrice = 0,
    readOnly = false,
}: ColorSizeQuotationGridProps) {
    const [newColor, setNewColor] = useState("")
    const [newColorName, setNewColorName] = useState("")
    const [newSize, setNewSize] = useState("")

    // Extract unique colors and sizes
    const { colors, sizes, cellMap, totalByColor, totalBySize, grandTotal, grandValue } = useMemo(() => {
        const colorSet = new Map<string, string>()
        const sizeSet = new Set<string>()
        const cellMap = new Map<string, { qty: number; unitPrice: number; idx: number }>()

        entries.forEach((e, idx) => {
            colorSet.set(e.colorCode, e.colorName)
            sizeSet.add(e.size)
            cellMap.set(`${e.colorCode}__${e.size}`, { qty: e.qty, unitPrice: e.unitPrice, idx })
        })

        const colors = Array.from(colorSet.entries()).map(([code, name]) => ({ code, name }))
        const sizes = Array.from(sizeSet)

        const totalByColor = new Map<string, number>()
        const totalBySize = new Map<string, number>()
        let grandTotal = 0
        let grandValue = 0

        for (const c of colors) {
            let sum = 0
            for (const s of sizes) {
                const cell = cellMap.get(`${c.code}__${s}`)
                const qty = cell?.qty ?? 0
                sum += qty
                totalBySize.set(s, (totalBySize.get(s) ?? 0) + qty)
                grandValue += qty * (cell?.unitPrice ?? 0)
            }
            totalByColor.set(c.code, sum)
            grandTotal += sum
        }

        return { colors, sizes, cellMap, totalByColor, totalBySize, grandTotal, grandValue }
    }, [entries])

    const updateCell = useCallback((colorCode: string, size: string, field: 'qty' | 'unitPrice', value: number) => {
        const updated = [...entries]
        const idx = updated.findIndex((e) => e.colorCode === colorCode && e.size === size)
        if (idx >= 0) {
            updated[idx] = { ...updated[idx], [field]: value }
        }
        onChange(updated)
    }, [entries, onChange])

    const addColor = () => {
        if (!newColor.trim()) return
        const code = newColor.trim().toUpperCase()
        const name = newColorName.trim() || code

        // Add this color for all existing sizes (with 0 qty)
        const newEntries = [...entries]
        for (const s of sizes) {
            if (!newEntries.find((e) => e.colorCode === code && e.size === s)) {
                newEntries.push({ colorCode: code, colorName: name, size: s, qty: 0, unitPrice: defaultUnitPrice })
            }
        }
        // If no sizes yet, just add a placeholder
        if (sizes.length === 0 && newSize.trim()) {
            newEntries.push({ colorCode: code, colorName: name, size: newSize.trim().toUpperCase(), qty: 0, unitPrice: defaultUnitPrice })
        }
        onChange(newEntries)
        setNewColor("")
        setNewColorName("")
    }

    const addSize = () => {
        if (!newSize.trim()) return
        const size = newSize.trim().toUpperCase()

        // Add this size for all existing colors (with 0 qty)
        const newEntries = [...entries]
        for (const c of colors) {
            if (!newEntries.find((e) => e.colorCode === c.code && e.size === size)) {
                newEntries.push({ colorCode: c.code, colorName: c.name, size, qty: 0, unitPrice: defaultUnitPrice })
            }
        }
        onChange(newEntries)
        setNewSize("")
    }

    const removeColor = (colorCode: string) => {
        onChange(entries.filter((e) => e.colorCode !== colorCode))
    }

    const removeSize = (size: string) => {
        onChange(entries.filter((e) => e.size !== size))
    }

    const formatIDR = (n: number) => n.toLocaleString('id-ID')

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Grid Warna × Ukuran
                    </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-bold text-zinc-400">
                    <span>{grandTotal} pcs</span>
                    <span>Rp {formatIDR(grandValue)}</span>
                </div>
            </div>

            {/* Add controls */}
            {!readOnly && (
                <div className="px-4 py-2 border-b border-zinc-200 flex items-center gap-2 flex-wrap">
                    <Input
                        className="border-2 border-black font-mono font-bold h-7 rounded-none w-20 text-xs"
                        placeholder="Kode"
                        value={newColor}
                        onChange={(e) => setNewColor(e.target.value)}
                    />
                    <Input
                        className="border-2 border-black font-bold h-7 rounded-none w-28 text-xs"
                        placeholder="Nama warna"
                        value={newColorName}
                        onChange={(e) => setNewColorName(e.target.value)}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[9px] font-black uppercase border-2 border-black rounded-none"
                        onClick={addColor}
                    >
                        <Plus className="h-3 w-3 mr-1" /> Warna
                    </Button>
                    <div className="w-px h-5 bg-zinc-300 mx-1" />
                    <Input
                        className="border-2 border-black font-mono font-bold h-7 rounded-none w-16 text-xs"
                        placeholder="Size"
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-[9px] font-black uppercase border-2 border-black rounded-none"
                        onClick={addSize}
                    >
                        <Plus className="h-3 w-3 mr-1" /> Ukuran
                    </Button>
                </div>
            )}

            {/* Matrix */}
            {colors.length === 0 || sizes.length === 0 ? (
                <div className="p-8 text-center">
                    <Grid3X3 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                        Tambahkan warna dan ukuran untuk mulai
                    </span>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="bg-zinc-100 border-b-2 border-black">
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left border-r-2 border-black min-w-[120px]">
                                    Warna
                                </th>
                                {sizes.map((s) => (
                                    <th key={s} className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-2 py-2 text-center min-w-[70px]">
                                        <div className="flex items-center justify-center gap-1">
                                            {s}
                                            {!readOnly && (
                                                <button onClick={() => removeSize(s)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                ))}
                                <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center border-l-2 border-black">
                                    Total
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {colors.map((c) => (
                                <tr key={c.code} className="border-b border-zinc-100">
                                    <td className="px-3 py-1.5 border-r-2 border-black">
                                        <div className="flex items-center gap-1">
                                            {!readOnly && (
                                                <button onClick={() => removeColor(c.code)} className="text-red-400 hover:text-red-600 shrink-0">
                                                    <Trash2 className="h-2.5 w-2.5" />
                                                </button>
                                            )}
                                            <span className="font-bold text-xs">{c.name}</span>
                                            <span className="text-[9px] text-zinc-400 font-mono">({c.code})</span>
                                        </div>
                                    </td>
                                    {sizes.map((s) => {
                                        const cell = cellMap.get(`${c.code}__${s}`)
                                        return (
                                            <td key={s} className="px-1 py-1 text-center">
                                                {readOnly ? (
                                                    <span className="font-mono font-bold">{cell?.qty ?? 0}</span>
                                                ) : (
                                                    <Input
                                                        className="border border-zinc-300 font-mono font-bold h-7 rounded-none text-center text-xs w-full"
                                                        type="number"
                                                        min={0}
                                                        value={cell?.qty ?? 0}
                                                        onChange={(e) => updateCell(c.code, s, 'qty', parseInt(e.target.value) || 0)}
                                                    />
                                                )}
                                            </td>
                                        )
                                    })}
                                    <td className="px-3 py-1.5 text-center border-l-2 border-black font-black">
                                        {totalByColor.get(c.code) ?? 0}
                                    </td>
                                </tr>
                            ))}

                            {/* Totals row */}
                            <tr className="bg-zinc-100 border-t-2 border-black">
                                <td className="px-3 py-2 border-r-2 border-black">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total</span>
                                </td>
                                {sizes.map((s) => (
                                    <td key={s} className="px-2 py-2 text-center font-black">
                                        {totalBySize.get(s) ?? 0}
                                    </td>
                                ))}
                                <td className="px-3 py-2 text-center border-l-2 border-black font-black text-sm">
                                    {grandTotal}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
