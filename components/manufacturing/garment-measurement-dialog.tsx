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
import { Ruler, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface MeasurementEntry {
    measurePoint: string
    specValue: string
    actualValue: string
    tolerance: string
}

interface GarmentMeasurementDialogProps {
    inspectionId: string
    styleVariantId: string
    onSave: (data: {
        inspectionId: string
        styleVariantId: string
        measurements: { measurePoint: string; specValue: number; actualValue: number; tolerance: number }[]
    }) => Promise<{ success: boolean; error?: string }>
    trigger?: React.ReactNode
}

const DEFAULT_POINTS = [
    { measurePoint: "Lebar Dada", specValue: "", tolerance: "1.0" },
    { measurePoint: "Panjang Badan", specValue: "", tolerance: "1.5" },
    { measurePoint: "Lebar Bahu", specValue: "", tolerance: "0.5" },
    { measurePoint: "Panjang Lengan", specValue: "", tolerance: "1.0" },
    { measurePoint: "Lingkar Lengan", specValue: "", tolerance: "1.0" },
    { measurePoint: "Lebar Bawah", specValue: "", tolerance: "1.0" },
]

export function GarmentMeasurementDialog({ inspectionId, styleVariantId, onSave, trigger }: GarmentMeasurementDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [entries, setEntries] = useState<MeasurementEntry[]>(
        DEFAULT_POINTS.map((p) => ({ ...p, actualValue: "" }))
    )

    const updateEntry = (idx: number, field: keyof MeasurementEntry, value: string) => {
        const updated = [...entries]
        updated[idx] = { ...updated[idx], [field]: value }
        setEntries(updated)
    }

    const addEntry = () => {
        setEntries([...entries, { measurePoint: "", specValue: "", actualValue: "", tolerance: "1.0" }])
    }

    const removeEntry = (idx: number) => {
        setEntries(entries.filter((_, i) => i !== idx))
    }

    const handleSubmit = async () => {
        const valid = entries.filter((e) => e.measurePoint && e.specValue && e.actualValue && e.tolerance)
        if (valid.length === 0) {
            toast.error("Masukkan minimal 1 pengukuran")
            return
        }

        setLoading(true)
        const result = await onSave({
            inspectionId,
            styleVariantId,
            measurements: valid.map((e) => ({
                measurePoint: e.measurePoint,
                specValue: parseFloat(e.specValue),
                actualValue: parseFloat(e.actualValue),
                tolerance: parseFloat(e.tolerance),
            })),
        })
        setLoading(false)

        if (result.success) {
            toast.success("Pengukuran berhasil disimpan")
            setOpen(false)
        } else {
            toast.error(result.error || "Gagal menyimpan")
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className={NB.triggerBtn}>
                        <Ruler className="mr-2 h-4 w-4" /> Ukur Garment
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Ruler className="h-5 w-5" /> Pengukuran Garment
                    </DialogTitle>
                    <p className={NB.subtitle}>Masukkan spec dan aktual setiap titik ukur</p>
                </DialogHeader>

                <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
                    <div className={NB.tableWrap}>
                        <table className="w-full">
                            <thead className={NB.tableHead}>
                                <tr>
                                    <th className={NB.tableHeadCell}>Titik Ukur</th>
                                    <th className={NB.tableHeadCell + " text-center w-24"}>Spec (cm)</th>
                                    <th className={NB.tableHeadCell + " text-center w-24"}>Aktual (cm)</th>
                                    <th className={NB.tableHeadCell + " text-center w-20"}>Tol. (±cm)</th>
                                    <th className={NB.tableHeadCell + " text-center w-16"}>Status</th>
                                    <th className={NB.tableHeadCell + " w-10"}></th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, idx) => {
                                    const spec = parseFloat(entry.specValue)
                                    const actual = parseFloat(entry.actualValue)
                                    const tol = parseFloat(entry.tolerance)
                                    const hasValues = !isNaN(spec) && !isNaN(actual) && !isNaN(tol)
                                    const withinSpec = hasValues && Math.abs(actual - spec) <= tol

                                    return (
                                        <tr key={idx} className={NB.tableRow}>
                                            <td className={NB.tableCell}>
                                                <Input
                                                    className="border-2 border-black font-bold h-8 rounded-none text-xs"
                                                    value={entry.measurePoint}
                                                    onChange={(e) => updateEntry(idx, 'measurePoint', e.target.value)}
                                                    placeholder="Titik ukur"
                                                />
                                            </td>
                                            <td className={NB.tableCell}>
                                                <Input
                                                    className="border-2 border-black font-mono font-bold h-8 rounded-none text-xs text-center"
                                                    type="number"
                                                    step="0.1"
                                                    value={entry.specValue}
                                                    onChange={(e) => updateEntry(idx, 'specValue', e.target.value)}
                                                />
                                            </td>
                                            <td className={NB.tableCell}>
                                                <Input
                                                    className="border-2 border-black font-mono font-bold h-8 rounded-none text-xs text-center"
                                                    type="number"
                                                    step="0.1"
                                                    value={entry.actualValue}
                                                    onChange={(e) => updateEntry(idx, 'actualValue', e.target.value)}
                                                />
                                            </td>
                                            <td className={NB.tableCell}>
                                                <Input
                                                    className="border-2 border-black font-mono font-bold h-8 rounded-none text-xs text-center"
                                                    type="number"
                                                    step="0.1"
                                                    value={entry.tolerance}
                                                    onChange={(e) => updateEntry(idx, 'tolerance', e.target.value)}
                                                />
                                            </td>
                                            <td className={NB.tableCell + " text-center"}>
                                                {hasValues && (
                                                    <span className={`inline-block px-1.5 py-0.5 text-[9px] font-black border ${
                                                        withinSpec ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-red-100 text-red-700 border-red-300'
                                                    }`}>
                                                        {withinSpec ? 'OK' : 'NG'}
                                                    </span>
                                                )}
                                            </td>
                                            <td className={NB.tableCell}>
                                                <button onClick={() => removeEntry(idx)} className="text-red-400 hover:text-red-600">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>

                    <Button variant="outline" onClick={addEntry} className={NB.cancelBtn + " w-full"}>
                        <Plus className="mr-2 h-4 w-4" /> Tambah Titik Ukur
                    </Button>

                    <div className={NB.footer}>
                        <Button variant="outline" onClick={() => setOpen(false)} className={NB.cancelBtn}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={loading} className={NB.submitBtn}>
                            {loading ? "Menyimpan..." : "Simpan Pengukuran"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
