"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { createAssetMovement } from "@/lib/actions/finance-fixed-assets"
import { toast } from "sonner"
import { ArrowRightLeft, DollarSign, MapPin, FileText } from "lucide-react"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBCurrencyInput,
    NBSelect,
    NBTextarea,
} from "@/components/ui/nb-dialog"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    asset: { id: string; assetCode: string; name: string; netBookValue: number; location?: string | null; department?: string | null } | null
}

const typeLabels: Record<string, string> = {
    DISPOSAL: "Penghapusan Aset",
    SALE: "Penjualan Aset",
    WRITE_OFF: "Hapus Buku",
    TRANSFER: "Transfer Lokasi/Departemen",
}

const typeOptions = [
    { value: "TRANSFER", label: "Transfer Lokasi" },
    { value: "SALE", label: "Penjualan" },
    { value: "DISPOSAL", label: "Penghapusan" },
    { value: "WRITE_OFF", label: "Hapus Buku" },
]

export function AssetMovementDialog({ open, onOpenChange, asset }: Props) {
    const queryClient = useQueryClient()
    const [saving, setSaving] = useState(false)
    const [type, setType] = useState<"DISPOSAL" | "SALE" | "WRITE_OFF" | "TRANSFER">("TRANSFER")
    const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
    const [proceeds, setProceeds] = useState("")
    const [toLocation, setToLocation] = useState("")
    const [toDepartment, setToDepartment] = useState("")
    const [notes, setNotes] = useState("")

    if (!asset) return null

    const handleSubmit = async () => {
        if (!date) { toast.error("Tanggal wajib diisi"); return }
        setSaving(true)
        try {
            const result = await createAssetMovement({
                assetId: asset.id,
                type,
                date,
                proceeds: proceeds ? Number(proceeds) : undefined,
                fromLocation: asset.location || undefined,
                fromDepartment: asset.department || undefined,
                toLocation: toLocation || undefined,
                toDepartment: toDepartment || undefined,
                notes: notes || undefined,
            })
            if (result.success) {
                toast.success(`${typeLabels[type]} berhasil dicatat`)
                queryClient.invalidateQueries({ queryKey: queryKeys.fixedAssets.all })
                onOpenChange(false)
            } else {
                toast.error(result.error || "Gagal mencatat pergerakan")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }

    const isFinancial = type !== "TRANSFER"
    const gainLoss = isFinancial ? (Number(proceeds || 0) - asset.netBookValue) : null

    return (
        <NBDialog open={open} onOpenChange={onOpenChange}>
            <NBDialogHeader
                icon={ArrowRightLeft}
                title="Pergerakan Aset"
                subtitle={`${asset.assetCode} — ${asset.name}`}
            />

            <NBDialogBody>
                <NBSection icon={FileText} title="Detail Pergerakan">
                    <div className="grid grid-cols-2 gap-4">
                        <NBSelect
                            label="Tipe Pergerakan"
                            required
                            value={type}
                            onValueChange={(v) => setType(v as typeof type)}
                            options={typeOptions}
                        />
                        <NBInput
                            label="Tanggal"
                            required
                            type="date"
                            value={date}
                            onChange={setDate}
                        />
                    </div>

                    {isFinancial && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block">
                                    Nilai Buku Bersih
                                </label>
                                <div className="border font-mono font-bold h-8 flex items-center px-3 text-sm bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                                    {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(asset.netBookValue)}
                                </div>
                            </div>
                            {type === "SALE" && (
                                <NBCurrencyInput
                                    label="Hasil Penjualan"
                                    value={proceeds}
                                    onChange={setProceeds}
                                />
                            )}
                        </div>
                    )}

                    {isFinancial && gainLoss !== null && (
                        <div className={`p-3 border-2 ${gainLoss >= 0 ? "border-emerald-500 bg-emerald-50" : "border-red-500 bg-red-50"}`}>
                            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                                {gainLoss >= 0 ? "Keuntungan" : "Kerugian"} {type === "SALE" ? "Penjualan" : "Penghapusan"}
                            </span>
                            <div className={`text-lg font-black ${gainLoss >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                                {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(Math.abs(gainLoss))}
                            </div>
                        </div>
                    )}
                </NBSection>

                {type === "TRANSFER" && (
                    <NBSection icon={MapPin} title="Lokasi Tujuan">
                        <div className="grid grid-cols-2 gap-4">
                            <NBInput
                                label="Lokasi Baru"
                                value={toLocation}
                                onChange={setToLocation}
                                placeholder={asset.location || "Lokasi tujuan"}
                            />
                            <NBInput
                                label="Departemen Baru"
                                value={toDepartment}
                                onChange={setToDepartment}
                                placeholder={asset.department || "Departemen tujuan"}
                            />
                        </div>
                    </NBSection>
                )}

                <NBSection icon={DollarSign} title="Catatan" optional>
                    <NBTextarea
                        label="Catatan"
                        value={notes}
                        onChange={setNotes}
                        placeholder="Alasan pergerakan..."
                        rows={2}
                    />
                </NBSection>
            </NBDialogBody>

            <NBDialogFooter
                onCancel={() => onOpenChange(false)}
                onSubmit={handleSubmit}
                submitting={saving}
                submitLabel="Simpan"
            />
        </NBDialog>
    )
}
