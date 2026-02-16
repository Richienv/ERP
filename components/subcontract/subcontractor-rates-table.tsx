"use client"

import { useState } from "react"
import { Pencil, Trash2, Loader2, X, Check } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { upsertSubcontractorRate, deleteSubcontractorRate } from "@/lib/actions/subcontract"

const OPERATION_LABELS: Record<string, string> = {
    CUT: "Potong", SEW: "Jahit", WASH: "Cuci",
    PRINT: "Cetak", EMBROIDERY: "Bordir", FINISHING: "Finishing",
}

interface Rate {
    id: string
    operation: string
    productType: string | null
    ratePerUnit: number
    validFrom: Date | string
    validTo: Date | string | null
}

interface SubcontractorRatesTableProps {
    rates: Rate[]
    subcontractorId: string
}

export function SubcontractorRatesTable({ rates, subcontractorId }: SubcontractorRatesTableProps) {
    const router = useRouter()
    const [editingId, setEditingId] = useState<string | null>(null)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [processing, setProcessing] = useState(false)

    // Edit form state
    const [editRate, setEditRate] = useState(0)
    const [editProductType, setEditProductType] = useState("")
    const [editValidFrom, setEditValidFrom] = useState("")
    const [editValidTo, setEditValidTo] = useState("")
    const [editOperation, setEditOperation] = useState("")

    const formatCurrency = (value: number) =>
        new Intl.NumberFormat("id-ID", {
            style: "currency", currency: "IDR", minimumFractionDigits: 0,
        }).format(value)

    const startEdit = (rate: Rate) => {
        setEditingId(rate.id)
        setEditRate(rate.ratePerUnit)
        setEditProductType(rate.productType || "")
        setEditOperation(rate.operation)
        setEditValidFrom(new Date(rate.validFrom).toISOString().split("T")[0])
        setEditValidTo(rate.validTo ? new Date(rate.validTo).toISOString().split("T")[0] : "")
    }

    const cancelEdit = () => {
        setEditingId(null)
    }

    const handleSave = async (rateId: string) => {
        if (!editRate || editRate <= 0) {
            toast.error("Tarif harus lebih dari 0")
            return
        }
        setProcessing(true)
        try {
            const result = await upsertSubcontractorRate({
                id: rateId,
                subcontractorId,
                operation: editOperation,
                productType: editProductType || undefined,
                ratePerUnit: editRate,
                validFrom: editValidFrom,
                validTo: editValidTo || undefined,
            })
            if (result.success) {
                toast.success("Tarif berhasil diperbarui")
                setEditingId(null)
                router.refresh()
            } else {
                toast.error(result.error || "Gagal memperbarui tarif")
            }
        } catch {
            toast.error("Gagal memperbarui tarif")
        } finally {
            setProcessing(false)
        }
    }

    const handleDelete = async (rateId: string) => {
        setProcessing(true)
        setDeletingId(rateId)
        try {
            const result = await deleteSubcontractorRate(rateId)
            if (result.success) {
                toast.success("Tarif berhasil dihapus")
                router.refresh()
            } else {
                toast.error(result.error || "Gagal menghapus tarif")
            }
        } catch {
            toast.error("Gagal menghapus tarif")
        } finally {
            setProcessing(false)
            setDeletingId(null)
        }
    }

    return (
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="px-4 py-2.5 border-b-2 border-black bg-zinc-50 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tarif</span>
                <span className="text-[9px] font-bold text-zinc-400">{rates.length} tarif</span>
            </div>
            <table className="w-full">
                <thead className="bg-zinc-50 border-b border-zinc-200">
                    <tr>
                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Operasi</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Tipe Produk</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right">Tarif/Unit</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-left">Berlaku</th>
                        <th className="text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2 text-right w-24">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    {rates.map((rate) => (
                        <tr key={rate.id} className="border-b border-zinc-200 last:border-b-0">
                            {editingId === rate.id ? (
                                <>
                                    <td className="px-3 py-2 text-xs font-black">
                                        {OPERATION_LABELS[rate.operation] || rate.operation}
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <Input
                                            className="h-7 text-xs border-2 border-black font-bold"
                                            value={editProductType}
                                            onChange={(e) => setEditProductType(e.target.value)}
                                            placeholder="Tipe produk"
                                        />
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <Input
                                            className="h-7 text-xs border-2 border-black font-mono font-bold text-right"
                                            type="number"
                                            value={editRate}
                                            onChange={(e) => setEditRate(parseFloat(e.target.value) || 0)}
                                        />
                                    </td>
                                    <td className="px-2 py-1.5">
                                        <div className="flex gap-1">
                                            <Input
                                                className="h-7 text-[10px] border-2 border-black font-bold"
                                                type="date"
                                                value={editValidFrom}
                                                onChange={(e) => setEditValidFrom(e.target.value)}
                                            />
                                            <Input
                                                className="h-7 text-[10px] border-2 border-black font-bold"
                                                type="date"
                                                value={editValidTo}
                                                onChange={(e) => setEditValidTo(e.target.value)}
                                                placeholder="Sampai"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-emerald-600 hover:bg-emerald-50"
                                                onClick={() => handleSave(rate.id)}
                                                disabled={processing}
                                            >
                                                {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-zinc-400 hover:bg-zinc-100"
                                                onClick={cancelEdit}
                                                disabled={processing}
                                            >
                                                <X className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </td>
                                </>
                            ) : (
                                <>
                                    <td className="px-3 py-2 text-xs font-black">{OPERATION_LABELS[rate.operation] || rate.operation}</td>
                                    <td className="px-3 py-2 text-xs font-bold text-zinc-500">{rate.productType || "—"}</td>
                                    <td className="px-3 py-2 text-xs font-mono font-bold text-right">{formatCurrency(rate.ratePerUnit)}</td>
                                    <td className="px-3 py-2 text-[10px] font-bold text-zinc-500">
                                        {new Date(rate.validFrom).toLocaleDateString("id-ID")}
                                        {rate.validTo ? ` — ${new Date(rate.validTo).toLocaleDateString("id-ID")}` : " — Sekarang"}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        <div className="flex items-center gap-1 justify-end">
                                            <button
                                                onClick={() => startEdit(rate)}
                                                disabled={!!editingId || processing}
                                                className="h-7 w-7 flex items-center justify-center border border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:border-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-30"
                                                title="Edit tarif"
                                            >
                                                <Pencil className="h-3 w-3" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(rate.id)}
                                                disabled={!!editingId || processing}
                                                className="h-7 w-7 flex items-center justify-center border border-zinc-200 text-zinc-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-30"
                                                title="Hapus tarif"
                                            >
                                                {deletingId === rate.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                                            </button>
                                        </div>
                                    </td>
                                </>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
