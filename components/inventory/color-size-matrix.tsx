"use client"

import { useMemo } from "react"
import { Grid3X3 } from "lucide-react"

interface StyleVariantStock {
    id: string
    colorCode: string | null
    colorName: string | null
    size: string | null
    sku: string
    stock: number // available stock qty
}

interface ColorSizeMatrixProps {
    productName: string
    variants: StyleVariantStock[]
    /** Optional: highlight cells below this threshold */
    lowStockThreshold?: number
}

export function ColorSizeMatrix({ productName, variants, lowStockThreshold = 5 }: ColorSizeMatrixProps) {
    // Build matrix axes
    const { colors, sizes, matrix, totalByColor, totalBySize, grandTotal } = useMemo(() => {
        const colorSet = new Map<string, string>() // colorCode → colorName
        const sizeSet = new Set<string>()
        const cellMap = new Map<string, { stock: number; sku: string }>()

        for (const v of variants) {
            const colorKey = v.colorCode || '—'
            const sizeKey = v.size || '—'
            colorSet.set(colorKey, v.colorName || colorKey)
            sizeSet.add(sizeKey)
            cellMap.set(`${colorKey}__${sizeKey}`, { stock: v.stock, sku: v.sku })
        }

        const colors = Array.from(colorSet.entries()).map(([code, name]) => ({ code, name }))
        const sizes = Array.from(sizeSet)

        // Totals
        const totalByColor = new Map<string, number>()
        const totalBySize = new Map<string, number>()
        let grandTotal = 0

        for (const c of colors) {
            let sum = 0
            for (const s of sizes) {
                const cell = cellMap.get(`${c.code}__${s}`)
                const qty = cell?.stock ?? 0
                sum += qty
                totalBySize.set(s, (totalBySize.get(s) ?? 0) + qty)
            }
            totalByColor.set(c.code, sum)
            grandTotal += sum
        }

        return { colors, sizes, matrix: cellMap, totalByColor, totalBySize, grandTotal }
    }, [variants])

    if (variants.length === 0) {
        return (
            <div className="border-2 border-dashed border-zinc-300 p-8 text-center">
                <Grid3X3 className="h-8 w-8 mx-auto text-zinc-300 mb-2" />
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Belum ada style variant
                </span>
            </div>
        )
    }

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b-2 border-black bg-zinc-50">
                <div className="flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Matrix Warna × Ukuran
                    </span>
                </div>
                <span className="text-[10px] font-bold text-zinc-400">{productName}</span>
            </div>

            {/* Matrix Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr className="bg-zinc-100 border-b-2 border-black">
                            <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left border-r-2 border-black min-w-[120px]">
                                Warna
                            </th>
                            {sizes.map((s) => (
                                <th key={s} className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center min-w-[60px]">
                                    {s}
                                </th>
                            ))}
                            <th className="text-[9px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-center border-l-2 border-black min-w-[60px]">
                                Total
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {colors.map((c) => (
                            <tr key={c.code} className="border-b border-zinc-100 last:border-b-0 hover:bg-zinc-50">
                                <td className="px-3 py-2 border-r-2 border-black">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="w-3 h-3 border border-black shrink-0"
                                            style={{ backgroundColor: cssColor(c.code) }}
                                        />
                                        <div>
                                            <span className="font-bold block text-xs">{c.name}</span>
                                            <span className="text-[9px] text-zinc-400 font-mono">{c.code}</span>
                                        </div>
                                    </div>
                                </td>
                                {sizes.map((s) => {
                                    const cell = matrix.get(`${c.code}__${s}`)
                                    const stock = cell?.stock ?? 0
                                    const isLow = stock > 0 && stock < lowStockThreshold
                                    const isEmpty = stock === 0

                                    return (
                                        <td key={s} className="px-3 py-2 text-center">
                                            <span
                                                className={`inline-block min-w-[32px] px-1.5 py-0.5 font-mono font-bold text-xs ${
                                                    isEmpty
                                                        ? 'text-zinc-300'
                                                        : isLow
                                                        ? 'bg-red-100 text-red-700 border border-red-300'
                                                        : 'text-zinc-700'
                                                }`}
                                                title={cell?.sku}
                                            >
                                                {stock}
                                            </span>
                                        </td>
                                    )
                                })}
                                <td className="px-3 py-2 text-center border-l-2 border-black font-black">
                                    {totalByColor.get(c.code) ?? 0}
                                </td>
                            </tr>
                        ))}

                        {/* Total row */}
                        <tr className="bg-zinc-100 border-t-2 border-black">
                            <td className="px-3 py-2 border-r-2 border-black">
                                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total</span>
                            </td>
                            {sizes.map((s) => (
                                <td key={s} className="px-3 py-2 text-center font-black text-xs">
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
        </div>
    )
}

/**
 * Try to render a color swatch from the color code.
 * Falls back to gray if not a valid CSS color.
 */
function cssColor(code: string): string {
    // Common textile color codes
    const colorMap: Record<string, string> = {
        BLK: '#000000', WHT: '#ffffff', RED: '#ef4444', BLU: '#3b82f6',
        GRN: '#22c55e', YLW: '#eab308', PNK: '#ec4899', ORG: '#f97316',
        PRP: '#a855f7', BRN: '#92400e', GRY: '#6b7280', NVY: '#1e3a5f',
        CRM: '#fffdd0', BEG: '#f5f5dc', KHK: '#c3b091', OLV: '#808000',
    }
    if (colorMap[code.toUpperCase()]) return colorMap[code.toUpperCase()]
    // Try as raw CSS
    if (code.startsWith('#') || code.startsWith('rgb')) return code
    return '#d4d4d8' // zinc-300 fallback
}
