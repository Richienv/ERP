"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBCurrencyInput,
    NBSelect,
} from "@/components/ui/nb-dialog"
import { Ship, Package } from "lucide-react"
import { toast } from "sonner"
import { NB } from "@/lib/dialog-styles"

// ==============================================================================
// Types
// ==============================================================================

interface POItemForLandedCost {
    id: string
    productName: string
    productCode: string
    quantity: number
    unitPrice: number
    totalPrice: number
    weight?: number
}

interface LandedCostDialogProps {
    poId: string
    poNumber: string
    items: POItemForLandedCost[]
    currentLandedCost: number
    onSave: (
        poId: string,
        landedCostTotal: number,
        allocations: { poItemId: string; allocated: number; landedUnitCost: number }[],
    ) => Promise<{ success: boolean; error?: string; revaluationDelta?: number }>
}

type AllocationMethod = 'BY_VALUE' | 'BY_QUANTITY' | 'BY_WEIGHT' | 'EQUAL'

// ==============================================================================
// Pure Functions (exported for potential testing)
// ==============================================================================

export function allocateLandedCost(
    items: POItemForLandedCost[],
    totalCost: number,
    method: AllocationMethod
): { itemId: string; allocated: number; landedUnitCost: number }[] {
    if (items.length === 0 || totalCost <= 0) {
        return items.map((i) => ({ itemId: i.id, allocated: 0, landedUnitCost: i.unitPrice }))
    }

    switch (method) {
        case 'BY_VALUE': {
            const totalValue = items.reduce((s, i) => s + i.totalPrice, 0)
            if (totalValue === 0) {
                // Fallback to equal split
                const perItem = totalCost / items.length
                return items.map((i) => ({
                    itemId: i.id,
                    allocated: Math.round(perItem * 100) / 100,
                    landedUnitCost: i.quantity > 0
                        ? Math.round(((i.totalPrice + perItem) / i.quantity) * 100) / 100
                        : i.unitPrice,
                }))
            }
            return items.map((i) => {
                const ratio = i.totalPrice / totalValue
                const allocated = Math.round(ratio * totalCost * 100) / 100
                return {
                    itemId: i.id,
                    allocated,
                    landedUnitCost: i.quantity > 0
                        ? Math.round(((i.totalPrice + allocated) / i.quantity) * 100) / 100
                        : i.unitPrice,
                }
            })
        }

        case 'BY_QUANTITY': {
            const totalQty = items.reduce((s, i) => s + i.quantity, 0)
            if (totalQty === 0) {
                return items.map((i) => ({ itemId: i.id, allocated: 0, landedUnitCost: i.unitPrice }))
            }
            return items.map((i) => {
                const ratio = i.quantity / totalQty
                const allocated = Math.round(ratio * totalCost * 100) / 100
                return {
                    itemId: i.id,
                    allocated,
                    landedUnitCost: i.quantity > 0
                        ? Math.round((i.unitPrice + allocated / i.quantity) * 100) / 100
                        : i.unitPrice,
                }
            })
        }

        case 'BY_WEIGHT': {
            const totalWeight = items.reduce((s, i) => s + (i.weight ?? 0), 0)
            if (totalWeight === 0) {
                // Fallback to equal if no weights
                const perItem = totalCost / items.length
                return items.map((i) => ({
                    itemId: i.id,
                    allocated: Math.round(perItem * 100) / 100,
                    landedUnitCost: i.quantity > 0
                        ? Math.round(((i.totalPrice + perItem) / i.quantity) * 100) / 100
                        : i.unitPrice,
                }))
            }
            return items.map((i) => {
                const ratio = (i.weight ?? 0) / totalWeight
                const allocated = Math.round(ratio * totalCost * 100) / 100
                return {
                    itemId: i.id,
                    allocated,
                    landedUnitCost: i.quantity > 0
                        ? Math.round(((i.totalPrice + allocated) / i.quantity) * 100) / 100
                        : i.unitPrice,
                }
            })
        }

        case 'EQUAL': {
            const perItem = totalCost / items.length
            return items.map((i) => ({
                itemId: i.id,
                allocated: Math.round(perItem * 100) / 100,
                landedUnitCost: i.quantity > 0
                    ? Math.round(((i.totalPrice + perItem) / i.quantity) * 100) / 100
                    : i.unitPrice,
            }))
        }
    }
}

// ==============================================================================
// Component
// ==============================================================================

export function LandedCostDialog({
    poId,
    poNumber,
    items,
    currentLandedCost,
    onSave,
}: LandedCostDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [freight, setFreight] = useState("0")
    const [customs, setCustoms] = useState("0")
    const [insurance, setInsurance] = useState("0")
    const [otherCost, setOtherCost] = useState("0")
    const [method, setMethod] = useState<AllocationMethod>('BY_VALUE')

    const freightNum = Number(freight) || 0
    const customsNum = Number(customs) || 0
    const insuranceNum = Number(insurance) || 0
    const otherCostNum = Number(otherCost) || 0

    const totalLandedCost = freightNum + customsNum + insuranceNum + otherCostNum
    const itemSubtotal = items.reduce((s, i) => s + i.totalPrice, 0)

    const allocation = useMemo(
        () => allocateLandedCost(items, totalLandedCost, method),
        [items, totalLandedCost, method]
    )

    const handleSave = async () => {
        if (totalLandedCost <= 0) {
            toast.error("Total biaya landed harus > 0")
            return
        }
        setLoading(true)
        const allocations = allocation.map((a) => ({
            poItemId: a.itemId,
            allocated: a.allocated,
            landedUnitCost: a.landedUnitCost,
        }))
        const result = await onSave(poId, totalLandedCost, allocations)
        setLoading(false)

        if (result.success) {
            const reval = result.revaluationDelta
            const msg = reval && reval !== 0
                ? `Biaya landed disimpan. Revaluasi inventory: ${reval > 0 ? '+' : ''}${reval.toLocaleString('id-ID')}`
                : "Biaya landed berhasil disimpan"
            toast.success(msg)
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal menyimpan biaya landed")
        }
    }

    const formatIDR = (n: number) => n.toLocaleString('id-ID')
    const landedPct = itemSubtotal > 0 ? ((totalLandedCost / itemSubtotal) * 100).toFixed(1) : '0'

    return (
        <>
            <Button
                variant="outline"
                className="h-8 px-3 text-[9px] font-black uppercase border-2 border-black rounded-none gap-1"
                onClick={() => setOpen(true)}
            >
                <Ship className="h-3.5 w-3.5" />
                Landed Cost
                {currentLandedCost > 0 && (
                    <span className="bg-black text-white text-[8px] px-1 py-0.5 ml-1">
                        Rp {formatIDR(currentLandedCost)}
                    </span>
                )}
            </Button>

            <NBDialog open={open} onOpenChange={setOpen} size="wide">
                <NBDialogHeader
                    icon={Ship}
                    title="Alokasi Landed Cost"
                    subtitle={`${poNumber} — Biaya pengiriman, bea cukai, dan asuransi`}
                />

                <NBDialogBody>
                    {/* Cost inputs */}
                    <NBSection icon={Ship} title="Komponen Biaya">
                        <div className="grid grid-cols-2 gap-4">
                            <NBCurrencyInput
                                label="Freight / Ongkir"
                                value={freight}
                                onChange={setFreight}
                            />
                            <NBCurrencyInput
                                label="Bea Cukai / Customs"
                                value={customs}
                                onChange={setCustoms}
                            />
                            <NBCurrencyInput
                                label="Asuransi / Insurance"
                                value={insurance}
                                onChange={setInsurance}
                            />
                            <NBCurrencyInput
                                label="Biaya Lain-lain"
                                value={otherCost}
                                onChange={setOtherCost}
                            />
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t-2 border-black">
                            <span className="text-xs font-black uppercase">Total Landed Cost</span>
                            <div className="text-right">
                                <span className="text-lg font-black font-mono">
                                    Rp {formatIDR(totalLandedCost)}
                                </span>
                                <span className="text-[10px] text-zinc-400 font-bold ml-2">
                                    ({landedPct}% dari subtotal)
                                </span>
                            </div>
                        </div>
                    </NBSection>

                    {/* Allocation method */}
                    <NBSection icon={Package} title="Metode Alokasi">
                        <NBSelect
                            label="Metode"
                            value={method}
                            onValueChange={(v) => setMethod(v as AllocationMethod)}
                            options={[
                                { value: "BY_VALUE", label: "Proporsi Nilai (Rp)" },
                                { value: "BY_QUANTITY", label: "Proporsi Jumlah (Qty)" },
                                { value: "BY_WEIGHT", label: "Proporsi Berat (Kg)" },
                                { value: "EQUAL", label: "Rata-rata (Equal Split)" },
                            ]}
                        />
                    </NBSection>

                    {/* Allocation preview table */}
                    {totalLandedCost > 0 && (
                        <div className={NB.tableWrap}>
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className={NB.tableHead}>
                                        <th className={`${NB.tableHeadCell} text-left`}>Produk</th>
                                        <th className={`${NB.tableHeadCell} text-right`}>Qty</th>
                                        <th className={`${NB.tableHeadCell} text-right`}>Harga Asli</th>
                                        <th className={`${NB.tableHeadCell} text-right`}>Alokasi</th>
                                        <th className={`${NB.tableHeadCell} text-right`}>Landed /unit</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((item, idx) => {
                                        const alloc = allocation[idx]
                                        return (
                                            <tr key={item.id} className={NB.tableRow}>
                                                <td className={NB.tableCell}>
                                                    <div className="font-bold">{item.productName}</div>
                                                    <div className="text-[9px] text-zinc-400 font-mono">{item.productCode}</div>
                                                </td>
                                                <td className={`${NB.tableCell} text-right font-mono`}>{item.quantity}</td>
                                                <td className={`${NB.tableCell} text-right font-mono`}>
                                                    Rp {formatIDR(item.unitPrice)}
                                                </td>
                                                <td className={`${NB.tableCell} text-right font-mono font-bold text-blue-600`}>
                                                    +Rp {formatIDR(alloc.allocated)}
                                                </td>
                                                <td className={`${NB.tableCell} text-right font-mono font-black`}>
                                                    Rp {formatIDR(alloc.landedUnitCost)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-zinc-100 border-t-2 border-black">
                                        <td className={`${NB.tableCell} font-black`} colSpan={3}>
                                            Total
                                        </td>
                                        <td className={`${NB.tableCell} text-right font-mono font-black text-blue-600`}>
                                            Rp {formatIDR(totalLandedCost)}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSave}
                    submitting={loading}
                    submitLabel="Simpan Landed Cost"
                    disabled={totalLandedCost <= 0}
                />
            </NBDialog>
        </>
    )
}
