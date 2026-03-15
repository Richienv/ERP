"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { createAssetMovement } from "@/lib/actions/finance-fixed-assets"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NB } from "@/lib/dialog-styles"
import { toast } from "sonner"
import { Loader2, ArrowRightLeft } from "lucide-react"

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
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <ArrowRightLeft className="h-5 w-5" /> Pergerakan Aset
                    </DialogTitle>
                    <p className={NB.subtitle}>{asset.assetCode} — {asset.name}</p>
                </DialogHeader>

                <div className="p-6 space-y-0">
                    <section className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Detail Pergerakan</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={NB.label}>Tipe Pergerakan</label>
                                    <Select value={type} onValueChange={(v: any) => setType(v)}>
                                        <SelectTrigger className={NB.select}><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="TRANSFER">Transfer Lokasi</SelectItem>
                                            <SelectItem value="SALE">Penjualan</SelectItem>
                                            <SelectItem value="DISPOSAL">Penghapusan</SelectItem>
                                            <SelectItem value="WRITE_OFF">Hapus Buku</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className={NB.label}>Tanggal</label>
                                    <Input type="date" className={NB.input} value={date} onChange={e => setDate(e.target.value)} />
                                </div>
                            </div>

                            {isFinancial && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Nilai Buku Bersih</label>
                                        <div className="border-2 border-black h-10 flex items-center px-3 font-mono font-bold bg-zinc-50">
                                            {new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(asset.netBookValue)}
                                        </div>
                                    </div>
                                    {type === "SALE" && (
                                        <div>
                                            <label className={NB.label}>Hasil Penjualan (Rp)</label>
                                            <Input type="number" className={NB.inputMono} placeholder="0" value={proceeds} onChange={e => setProceeds(e.target.value)} />
                                        </div>
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

                            {type === "TRANSFER" && (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Lokasi Baru</label>
                                        <Input className={NB.input} placeholder={asset.location || "Lokasi tujuan"} value={toLocation} onChange={e => setToLocation(e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Departemen Baru</label>
                                        <Input className={NB.input} placeholder={asset.department || "Departemen tujuan"} value={toDepartment} onChange={e => setToDepartment(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label className={NB.label}>Catatan</label>
                                <textarea className={`w-full ${NB.textarea}`} rows={2} placeholder="Alasan pergerakan..." value={notes} onChange={e => setNotes(e.target.value)} />
                            </div>
                        </div>
                    </section>

                    <div className="flex items-center justify-end gap-3 pt-4">
                        <Button type="button" onClick={() => onOpenChange(false)} className={NB.cancelBtn}>Batal</Button>
                        <Button type="button" onClick={handleSubmit} disabled={saving} className={NB.submitBtn}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Simpan
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
