"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
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
    onSave: (poId: string, landedCostTotal: number) => Promise<{ success: boolean; error?: string }>
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
    const [freight, setFreight] = useState(0)
    const [customs, setCustoms] = useState(0)
    const [insurance, setInsurance] = useState(0)
    const [otherCost, setOtherCost] = useState(0)
    const [method, setMethod] = useState<AllocationMethod>('BY_VALUE')

    const totalLandedCost = freight + customs + insurance + otherCost
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
        const result = await onSave(poId, totalLandedCost)
        setLoading(false)

        if (result.success) {
            toast.success("Biaya landed berhasil disimpan")
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal menyimpan biaya landed")
        }
    }

    const formatIDR = (n: number) => n.toLocaleString('id-ID')
    const landedPct = itemSubtotal > 0 ? ((totalLandedCost / itemSubtotal) * 100).toFixed(1) : '0'

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    className="h-8 px-3 text-[9px] font-black uppercase border-2 border-black rounded-none gap-1"
                >
                    <Ship className="h-3.5 w-3.5" />
                    Landed Cost
                    {currentLandedCost > 0 && (
                        <span className="bg-black text-white text-[8px] px-1 py-0.5 ml-1">
                            Rp {formatIDR(currentLandedCost)}
                        </span>
                    )}
                </Button>
            </DialogTrigger>

            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Ship className="h-5 w-5" /> Alokasi Landed Cost
                    </DialogTitle>
                    <p className={NB.subtitle}>{poNumber} — Biaya pengiriman, bea cukai, dan asuransi</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-6">
                        {/* Cost inputs */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <Ship className="h-3.5 w-3.5 text-zinc-500" />
                                <span className={NB.sectionTitle}>Komponen Biaya</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Freight / Ongkir</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            min={0}
                                            value={freight || ''}
                                            onChange={(e) => setFreight(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Bea Cukai / Customs</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            min={0}
                                            value={customs || ''}
                                            onChange={(e) => setCustoms(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Asuransi / Insurance</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            min={0}
                                            value={insurance || ''}
                                            onChange={(e) => setInsurance(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Biaya Lain-lain</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            min={0}
                                            value={otherCost || ''}
                                            onChange={(e) => setOtherCost(parseFloat(e.target.value) || 0)}
                                            placeholder="0"
                                        />
                                    </div>
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
                            </div>
                        </div>

                        {/* Allocation method */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <Package className="h-3.5 w-3.5 text-zinc-500" />
                                <span className={NB.sectionTitle}>Metode Alokasi</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <Select value={method} onValueChange={(v) => setMethod(v as AllocationMethod)}>
                                    <SelectTrigger className={NB.select}>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="BY_VALUE">Proporsi Nilai (Rp)</SelectItem>
                                        <SelectItem value="BY_QUANTITY">Proporsi Jumlah (Qty)</SelectItem>
                                        <SelectItem value="BY_WEIGHT">Proporsi Berat (Kg)</SelectItem>
                                        <SelectItem value="EQUAL">Rata-rata (Equal Split)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

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

                        {/* Actions */}
                        <div className={NB.footer}>
                            <Button
                                variant="outline"
                                className={NB.cancelBtn}
                                onClick={() => setOpen(false)}
                            >
                                Batal
                            </Button>
                            <Button
                                className={NB.submitBtn}
                                disabled={totalLandedCost <= 0 || loading}
                                onClick={handleSave}
                            >
                                {loading ? 'Menyimpan...' : 'Simpan Landed Cost'}
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
