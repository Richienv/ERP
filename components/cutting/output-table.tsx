"use client"

import { useState } from "react"
import { Package } from "lucide-react"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import { setCutPlanOutput } from "@/lib/actions/cutting"

interface OutputRow {
    id: string
    styleVariantId: string
    sku: string
    colorName: string | null
    size: string | null
    plannedQty: number
    actualQty: number
    defectQty: number
}

interface OutputTableProps {
    cutPlanId: string
    outputs: OutputRow[]
    editable: boolean
}

export function OutputTable({ cutPlanId, outputs, editable }: OutputTableProps) {
    const totalPlanned = outputs.reduce((s, o) => s + o.plannedQty, 0)
    const totalActual = outputs.reduce((s, o) => s + o.actualQty, 0)
    const totalDefect = outputs.reduce((s, o) => s + o.defectQty, 0)
    const yieldPct = totalActual + totalDefect > 0
        ? Math.round((totalActual / (totalActual + totalDefect)) * 100)
        : 0

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-zinc-500" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        Output Pemotongan
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-[9px] font-bold text-zinc-400">
                        Yield: <span className="font-black">{yieldPct}%</span>
                    </span>
                </div>
            </div>

            {outputs.length === 0 ? (
                <div className="p-6 text-center">
                    <Package className="h-6 w-6 mx-auto text-zinc-200 mb-1" />
                    <span className="text-[9px] font-bold text-zinc-400">
                        Belum ada output
                    </span>
                </div>
            ) : (
                <div className={NB.tableWrap}>
                    <table className="w-full">
                        <thead className={NB.tableHead}>
                            <tr>
                                <th className={`${NB.tableHeadCell} text-left`}>SKU</th>
                                <th className={`${NB.tableHeadCell} text-left`}>Warna</th>
                                <th className={`${NB.tableHeadCell} text-left`}>Ukuran</th>
                                <th className={`${NB.tableHeadCell} text-right`}>Rencana</th>
                                <th className={`${NB.tableHeadCell} text-right`}>Aktual</th>
                                <th className={`${NB.tableHeadCell} text-right`}>Cacat</th>
                            </tr>
                        </thead>
                        <tbody>
                            {outputs.map((row) => (
                                <OutputRowView
                                    key={row.id}
                                    row={row}
                                    cutPlanId={cutPlanId}
                                    editable={editable}
                                />
                            ))}
                            {/* Totals */}
                            <tr className="bg-zinc-50 border-t-2 border-black">
                                <td colSpan={3} className="px-3 py-2 text-[10px] font-black uppercase">
                                    Total
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-black text-sm">
                                    {totalPlanned.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-black text-sm">
                                    {totalActual.toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right font-mono font-black text-sm text-red-600">
                                    {totalDefect.toLocaleString()}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}

function OutputRowView({
    row,
    cutPlanId,
    editable,
}: {
    row: OutputRow
    cutPlanId: string
    editable: boolean
}) {
    const [actualQty, setActualQty] = useState(row.actualQty)
    const [defectQty, setDefectQty] = useState(row.defectQty)
    const [dirty, setDirty] = useState(false)

    const handleBlur = async () => {
        if (!dirty) return
        const result = await setCutPlanOutput({
            id: row.id,
            cutPlanId,
            styleVariantId: row.styleVariantId,
            plannedQty: row.plannedQty,
            actualQty,
            defectQty,
        })
        setDirty(false)
        if (result.success) {
            toast.success("Output diperbarui")
        } else {
            toast.error(result.error || "Gagal memperbarui")
        }
    }

    return (
        <tr className={NB.tableRow}>
            <td className={`${NB.tableCell} font-mono text-xs`}>{row.sku}</td>
            <td className={NB.tableCell}>{row.colorName || '—'}</td>
            <td className={NB.tableCell}>{row.size || '—'}</td>
            <td className={`${NB.tableCell} text-right font-mono`}>
                {row.plannedQty.toLocaleString()}
            </td>
            <td className={`${NB.tableCell} text-right`}>
                {editable ? (
                    <Input
                        type="number"
                        className="border-2 border-black rounded-none h-7 w-20 text-right font-mono text-xs ml-auto"
                        value={actualQty}
                        onChange={(e) => {
                            setActualQty(parseInt(e.target.value) || 0)
                            setDirty(true)
                        }}
                        onBlur={handleBlur}
                    />
                ) : (
                    <span className="font-mono">{actualQty.toLocaleString()}</span>
                )}
            </td>
            <td className={`${NB.tableCell} text-right`}>
                {editable ? (
                    <Input
                        type="number"
                        className="border-2 border-black rounded-none h-7 w-20 text-right font-mono text-xs ml-auto"
                        value={defectQty}
                        onChange={(e) => {
                            setDefectQty(parseInt(e.target.value) || 0)
                            setDirty(true)
                        }}
                        onBlur={handleBlur}
                    />
                ) : (
                    <span className="font-mono text-red-600">{defectQty.toLocaleString()}</span>
                )}
            </td>
        </tr>
    )
}
