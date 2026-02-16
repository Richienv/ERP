"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DollarSign, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
    getSubcontractorRates,
    upsertSubcontractorRate,
} from "@/lib/actions/subcontract"
import type { SubcontractorRateData } from "@/lib/actions/subcontract"

const OPERATIONS = [
    { value: "CUT", label: "Potong" },
    { value: "SEW", label: "Jahit" },
    { value: "WASH", label: "Cuci" },
    { value: "PRINT", label: "Cetak" },
    { value: "EMBROIDERY", label: "Bordir" },
    { value: "FINISHING", label: "Finishing" },
]

interface RateManagementDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    subcontractorId: string
    subcontractorName: string
}

export function RateManagementDialog({
    open,
    onOpenChange,
    subcontractorId,
    subcontractorName,
}: RateManagementDialogProps) {
    const [rates, setRates] = useState<SubcontractorRateData[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)

    // New rate form
    const [newRate, setNewRate] = useState({
        operation: "",
        productType: "",
        ratePerUnit: "",
        validFrom: new Date().toISOString().split("T")[0],
        validTo: "",
    })

    useEffect(() => {
        if (open) {
            loadRates()
        }
    }, [open, subcontractorId])

    const loadRates = async () => {
        setLoading(true)
        const data = await getSubcontractorRates(subcontractorId)
        setRates(data)
        setLoading(false)
    }

    const handleAddRate = async () => {
        if (!newRate.operation) {
            toast.error("Pilih operasi")
            return
        }
        if (!newRate.ratePerUnit || parseFloat(newRate.ratePerUnit) <= 0) {
            toast.error("Masukkan tarif yang valid")
            return
        }

        setSaving(true)
        const result = await upsertSubcontractorRate({
            subcontractorId,
            operation: newRate.operation,
            productType: newRate.productType || undefined,
            ratePerUnit: parseFloat(newRate.ratePerUnit),
            validFrom: newRate.validFrom,
            validTo: newRate.validTo || undefined,
        })
        setSaving(false)

        if (result.success) {
            toast.success("Tarif berhasil ditambahkan")
            setNewRate({
                operation: "",
                productType: "",
                ratePerUnit: "",
                validFrom: new Date().toISOString().split("T")[0],
                validTo: "",
            })
            loadRates()
        } else {
            toast.error(result.error || "Gagal menambahkan tarif")
        }
    }

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("id-ID", {
            style: "currency",
            currency: "IDR",
            minimumFractionDigits: 0,
        }).format(value)
    }

    const getOperationLabel = (value: string) =>
        OPERATIONS.find((o) => o.value === value)?.label || value

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <DollarSign className="h-5 w-5" />
                        Kelola Tarif
                    </DialogTitle>
                    <p className={NB.subtitle}>{subcontractorName}</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-6">
                        {/* Existing rates */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Tarif Aktif</span>
                            </div>
                            <div className={NB.sectionBody}>
                                {loading ? (
                                    <div className="text-[10px] font-bold text-zinc-400 text-center py-4">
                                        Memuat tarif...
                                    </div>
                                ) : rates.length === 0 ? (
                                    <div className="text-[10px] font-bold text-zinc-400 text-center py-4">
                                        Belum ada tarif
                                    </div>
                                ) : (
                                    <div className={NB.tableWrap}>
                                        <table className="w-full">
                                            <thead className={NB.tableHead}>
                                                <tr>
                                                    <th className={`${NB.tableHeadCell} text-left`}>
                                                        Operasi
                                                    </th>
                                                    <th className={`${NB.tableHeadCell} text-left`}>
                                                        Tipe Produk
                                                    </th>
                                                    <th className={`${NB.tableHeadCell} text-right`}>
                                                        Tarif/Unit
                                                    </th>
                                                    <th className={`${NB.tableHeadCell} text-left`}>
                                                        Berlaku
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {rates.map((rate) => (
                                                    <tr key={rate.id} className={NB.tableRow}>
                                                        <td className={NB.tableCell}>
                                                            <span className="text-xs font-black">
                                                                {getOperationLabel(rate.operation)}
                                                            </span>
                                                        </td>
                                                        <td className={NB.tableCell}>
                                                            <span className="text-xs font-bold text-zinc-500">
                                                                {rate.productType || "—"}
                                                            </span>
                                                        </td>
                                                        <td className={`${NB.tableCell} text-right`}>
                                                            <span className="text-xs font-mono font-bold">
                                                                {formatCurrency(rate.ratePerUnit)}
                                                            </span>
                                                        </td>
                                                        <td className={NB.tableCell}>
                                                            <span className="text-[10px] font-bold text-zinc-500">
                                                                {new Date(rate.validFrom).toLocaleDateString("id-ID")}
                                                                {rate.validTo
                                                                    ? ` — ${new Date(rate.validTo).toLocaleDateString("id-ID")}`
                                                                    : " — Sekarang"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Add new rate */}
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Tambah Tarif Baru</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>
                                            Operasi <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <select
                                            className={NB.select}
                                            value={newRate.operation}
                                            onChange={(e) =>
                                                setNewRate((f) => ({
                                                    ...f,
                                                    operation: e.target.value,
                                                }))
                                            }
                                        >
                                            <option value="">Pilih operasi...</option>
                                            {OPERATIONS.map((op) => (
                                                <option key={op.value} value={op.value}>
                                                    {op.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className={NB.label}>Tipe Produk</label>
                                        <Input
                                            className={NB.input}
                                            value={newRate.productType}
                                            onChange={(e) =>
                                                setNewRate((f) => ({
                                                    ...f,
                                                    productType: e.target.value,
                                                }))
                                            }
                                            placeholder="Opsional"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className={NB.label}>
                                        Tarif per Unit (IDR){" "}
                                        <span className={NB.labelRequired}>*</span>
                                    </label>
                                    <Input
                                        className={NB.inputMono}
                                        type="number"
                                        value={newRate.ratePerUnit}
                                        onChange={(e) =>
                                            setNewRate((f) => ({
                                                ...f,
                                                ratePerUnit: e.target.value,
                                            }))
                                        }
                                        placeholder="5000"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>
                                            Berlaku Dari{" "}
                                            <span className={NB.labelRequired}>*</span>
                                        </label>
                                        <Input
                                            className={NB.input}
                                            type="date"
                                            value={newRate.validFrom}
                                            onChange={(e) =>
                                                setNewRate((f) => ({
                                                    ...f,
                                                    validFrom: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Berlaku Sampai</label>
                                        <Input
                                            className={NB.input}
                                            type="date"
                                            value={newRate.validTo}
                                            onChange={(e) =>
                                                setNewRate((f) => ({
                                                    ...f,
                                                    validTo: e.target.value,
                                                }))
                                            }
                                        />
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddRate}
                                    disabled={saving}
                                    className="flex items-center gap-1.5 bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    {saving ? "Menyimpan..." : "Tambah Tarif"}
                                </button>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className={NB.footer}>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className={NB.cancelBtn}
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
