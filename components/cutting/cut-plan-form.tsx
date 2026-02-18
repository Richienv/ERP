"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { NB } from "@/lib/dialog-styles"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Scissors } from "lucide-react"
import { toast } from "sonner"
import { createCutPlan } from "@/lib/actions/cutting"
import { queryKeys } from "@/lib/query-keys"

interface CutPlanFormProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    fabricProducts: { id: string; name: string; code: string }[]
}

export function CutPlanForm({ open, onOpenChange, fabricProducts }: CutPlanFormProps) {
    const queryClient = useQueryClient()
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        fabricProductId: "",
        markerLength: "",
        markerEfficiency: "",
        totalLayers: "",
        totalFabricMeters: "",
        plannedDate: "",
    })

    const handleSubmit = async () => {
        if (!form.fabricProductId) {
            toast.error("Pilih produk kain")
            return
        }

        setLoading(true)
        const result = await createCutPlan({
            fabricProductId: form.fabricProductId,
            markerLength: form.markerLength ? parseFloat(form.markerLength) : undefined,
            markerEfficiency: form.markerEfficiency ? parseFloat(form.markerEfficiency) : undefined,
            totalLayers: form.totalLayers ? parseInt(form.totalLayers) : undefined,
            totalFabricMeters: form.totalFabricMeters ? parseFloat(form.totalFabricMeters) : undefined,
            plannedDate: form.plannedDate || undefined,
        })
        setLoading(false)

        if (result.success) {
            toast.success("Cut plan berhasil dibuat")
            queryClient.invalidateQueries({ queryKey: queryKeys.cutPlans.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.cuttingDashboard.all })
            onOpenChange(false)
            setForm({
                fabricProductId: "",
                markerLength: "",
                markerEfficiency: "",
                totalLayers: "",
                totalFabricMeters: "",
                plannedDate: "",
            })
        } else {
            toast.error(result.error || "Gagal membuat cut plan")
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className={NB.content}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Scissors className="h-5 w-5" />
                        Cut Plan Baru
                    </DialogTitle>
                    <p className={NB.subtitle}>Rencanakan pemotongan kain</p>
                </DialogHeader>

                <ScrollArea className={NB.scroll}>
                    <div className="p-6 space-y-6">
                        <div className={NB.section}>
                            <div className={NB.sectionHead}>
                                <span className={NB.sectionTitle}>Detail Pemotongan</span>
                            </div>
                            <div className={NB.sectionBody}>
                                <div>
                                    <label className={NB.label}>
                                        Produk Kain <span className={NB.labelRequired}>*</span>
                                    </label>
                                    <select
                                        className={NB.select}
                                        value={form.fabricProductId}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, fabricProductId: e.target.value }))
                                        }
                                    >
                                        <option value="">Pilih kain...</option>
                                        {fabricProducts.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                [{p.code}] {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Panjang Marker (m)</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            step="0.01"
                                            value={form.markerLength}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, markerLength: e.target.value }))
                                            }
                                            placeholder="12.50"
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Efisiensi Marker (%)</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            step="0.01"
                                            value={form.markerEfficiency}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, markerEfficiency: e.target.value }))
                                            }
                                            placeholder="85.00"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={NB.label}>Jumlah Layer</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            value={form.totalLayers}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, totalLayers: e.target.value }))
                                            }
                                            placeholder="50"
                                        />
                                    </div>
                                    <div>
                                        <label className={NB.label}>Total Kain (m)</label>
                                        <Input
                                            className={NB.inputMono}
                                            type="number"
                                            step="0.01"
                                            value={form.totalFabricMeters}
                                            onChange={(e) =>
                                                setForm((f) => ({ ...f, totalFabricMeters: e.target.value }))
                                            }
                                            placeholder="625.00"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className={NB.label}>Tanggal Rencana</label>
                                    <Input
                                        className={NB.input}
                                        type="date"
                                        value={form.plannedDate}
                                        onChange={(e) =>
                                            setForm((f) => ({ ...f, plannedDate: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>
                        </div>

                        <div className={NB.footer}>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                className={NB.cancelBtn}
                            >
                                Batal
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading}
                                className={NB.submitBtn}
                            >
                                {loading ? "Menyimpan..." : "Buat Cut Plan"}
                            </button>
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
