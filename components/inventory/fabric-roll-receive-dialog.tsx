"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { Plus } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { receiveFabricRoll } from "@/lib/actions/fabric-rolls"

interface FabricRollReceiveDialogProps {
    products: { id: string; name: string; code: string }[]
    warehouses: { id: string; name: string; code: string }[]
    trigger?: React.ReactNode
}

export function FabricRollReceiveDialog({ products, warehouses, trigger }: FabricRollReceiveDialogProps) {
    const queryClient = useQueryClient()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const [rollNumber, setRollNumber] = useState("")
    const [productId, setProductId] = useState("")
    const [warehouseId, setWarehouseId] = useState("")
    const [lengthMeters, setLengthMeters] = useState("")
    const [widthCm, setWidthCm] = useState("")
    const [weight, setWeight] = useState("")
    const [dyeLot, setDyeLot] = useState("")
    const [grade, setGrade] = useState("")
    const [locationBin, setLocationBin] = useState("")
    const [reference, setReference] = useState("")

    const resetForm = () => {
        setRollNumber("")
        setProductId("")
        setWarehouseId("")
        setLengthMeters("")
        setWidthCm("")
        setWeight("")
        setDyeLot("")
        setGrade("")
        setLocationBin("")
        setReference("")
    }

    const handleSubmit = async () => {
        if (!rollNumber || !productId || !warehouseId || !lengthMeters) {
            toast.error("Lengkapi semua field wajib")
            return
        }

        const meters = parseFloat(lengthMeters)
        if (isNaN(meters) || meters <= 0) {
            toast.error("Panjang harus > 0")
            return
        }

        setLoading(true)
        const result = await receiveFabricRoll({
            rollNumber,
            productId,
            warehouseId,
            lengthMeters: meters,
            widthCm: widthCm ? parseFloat(widthCm) : undefined,
            weight: weight ? parseFloat(weight) : undefined,
            dyeLot: dyeLot || undefined,
            grade: grade || undefined,
            locationBin: locationBin || undefined,
            reference: reference || undefined,
        })
        setLoading(false)

        if (result.success) {
            toast.success(`Roll ${rollNumber} berhasil diterima`)
            queryClient.invalidateQueries({ queryKey: ["fabricRolls", "list"] })
            resetForm()
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal menerima roll")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className={NB.triggerBtn}>
                        <Plus className="mr-2 h-4 w-4" /> Terima Roll Baru
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Plus className="h-5 w-5" /> Terima Fabric Roll
                    </DialogTitle>
                    <p className={NB.subtitle}>Daftarkan roll kain baru ke inventory</p>
                </DialogHeader>

                <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
                    {/* Basic */}
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Data Roll</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={NB.label}>Nomor Roll <span className={NB.labelRequired}>*</span></label>
                                    <Input className={NB.inputMono} value={rollNumber} onChange={(e) => setRollNumber(e.target.value)} placeholder="ROLL-001" />
                                </div>
                                <div>
                                    <label className={NB.label}>Panjang (meter) <span className={NB.labelRequired}>*</span></label>
                                    <Input className={NB.inputMono} type="number" step="0.1" value={lengthMeters} onChange={(e) => setLengthMeters(e.target.value)} placeholder="100.0" />
                                </div>
                                <div>
                                    <label className={NB.label}>Produk Kain <span className={NB.labelRequired}>*</span></label>
                                    <select className={NB.select} value={productId} onChange={(e) => setProductId(e.target.value)}>
                                        <option value="">Pilih kain...</option>
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id}>{p.code} — {p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className={NB.label}>Gudang <span className={NB.labelRequired}>*</span></label>
                                    <select className={NB.select} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                                        <option value="">Pilih gudang...</option>
                                        {warehouses.map((w) => (
                                            <option key={w.id} value={w.id}>{w.code} — {w.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Details */}
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Detail Tambahan</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={NB.label}>Lebar (cm)</label>
                                    <Input className={NB.inputMono} type="number" step="0.1" value={widthCm} onChange={(e) => setWidthCm(e.target.value)} placeholder="150.0" />
                                </div>
                                <div>
                                    <label className={NB.label}>Berat (kg)</label>
                                    <Input className={NB.inputMono} type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="25.0" />
                                </div>
                                <div>
                                    <label className={NB.label}>Dye Lot</label>
                                    <Input className={NB.input} value={dyeLot} onChange={(e) => setDyeLot(e.target.value)} placeholder="LOT-2024-01" />
                                </div>
                                <div>
                                    <label className={NB.label}>Grade</label>
                                    <select className={NB.select} value={grade} onChange={(e) => setGrade(e.target.value)}>
                                        <option value="">—</option>
                                        <option value="A">A — Premium</option>
                                        <option value="B">B — Standar</option>
                                        <option value="C">C — Inferior</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={NB.label}>Lokasi Bin</label>
                                    <Input className={NB.input} value={locationBin} onChange={(e) => setLocationBin(e.target.value)} placeholder="R1-S2-B3" />
                                </div>
                                <div>
                                    <label className={NB.label}>Referensi</label>
                                    <Input className={NB.input} value={reference} onChange={(e) => setReference(e.target.value)} placeholder="PO-001" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className={NB.footer}>
                        <Button variant="outline" onClick={() => setOpen(false)} className={NB.cancelBtn}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={loading} className={NB.submitBtn}>
                            {loading ? "Menyimpan..." : "Terima Roll"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
