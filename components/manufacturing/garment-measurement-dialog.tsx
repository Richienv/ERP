"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Ruler, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
} from "@/components/ui/nb-dialog"

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
        <>
            {trigger ? (
                <span onClick={() => setOpen(true)}>{trigger}</span>
            ) : (
                <Button
                    className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider px-4 h-8 rounded-none"
                    onClick={() => setOpen(true)}
                >
                    <Ruler className="mr-2 h-4 w-4" /> Ukur Garment
                </Button>
            )}

            <NBDialog open={open} onOpenChange={setOpen} size="wide">
                <NBDialogHeader
                    icon={Ruler}
                    title="Pengukuran Garment"
                    subtitle="Masukkan spec dan aktual setiap titik ukur"
                />

                <NBDialogBody>
                    {/* Measurement table - complex, stays as-is */}
                    <NBSection icon={Ruler} title="Titik Ukur">
                        <div className="border border-zinc-200 overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-zinc-800 text-white">
                                    <tr>
                                        <th className="text-[10px] font-black uppercase tracking-widest p-2 text-left">Titik Ukur</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest p-2 text-center w-24">Spec (cm)</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest p-2 text-center w-24">Aktual (cm)</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest p-2 text-center w-20">Tol. (±cm)</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest p-2 text-center w-16">Status</th>
                                        <th className="text-[10px] font-black uppercase tracking-widest p-2 w-10"></th>
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
                                            <tr key={idx} className="border-b border-zinc-200 last:border-b-0">
                                                <td className="p-2">
                                                    <Input
                                                        className="border border-zinc-300 font-bold h-8 rounded-none text-xs"
                                                        value={entry.measurePoint}
                                                        onChange={(e) => updateEntry(idx, 'measurePoint', e.target.value)}
                                                        placeholder="Titik ukur"
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <Input
                                                        className="border border-zinc-300 font-mono font-bold h-8 rounded-none text-xs text-center"
                                                        type="number"
                                                        step="0.1"
                                                        value={entry.specValue}
                                                        onChange={(e) => updateEntry(idx, 'specValue', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <Input
                                                        className="border border-zinc-300 font-mono font-bold h-8 rounded-none text-xs text-center"
                                                        type="number"
                                                        step="0.1"
                                                        value={entry.actualValue}
                                                        onChange={(e) => updateEntry(idx, 'actualValue', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2">
                                                    <Input
                                                        className="border border-zinc-300 font-mono font-bold h-8 rounded-none text-xs text-center"
                                                        type="number"
                                                        step="0.1"
                                                        value={entry.tolerance}
                                                        onChange={(e) => updateEntry(idx, 'tolerance', e.target.value)}
                                                    />
                                                </td>
                                                <td className="p-2 text-center">
                                                    {hasValues && (
                                                        <span className={`inline-block px-1.5 py-0.5 text-[9px] font-black border ${
                                                            withinSpec ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-red-100 text-red-700 border-red-300'
                                                        }`}>
                                                            {withinSpec ? 'OK' : 'NG'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="p-2">
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

                        <Button
                            variant="outline"
                            onClick={addEntry}
                            className="border border-zinc-300 text-zinc-500 font-bold uppercase text-[10px] tracking-wider px-4 h-8 rounded-none w-full"
                        >
                            <Plus className="mr-2 h-4 w-4" /> Tambah Titik Ukur
                        </Button>
                    </NBSection>
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSubmit}
                    submitting={loading}
                    submitLabel="Simpan Pengukuran"
                />
            </NBDialog>
        </>
    )
}
