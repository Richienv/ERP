"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ComboboxWithCreate } from "@/components/ui/combobox-with-create"
import { Plus, Trash2, Search, CheckCircle2, XCircle } from "lucide-react"
import { createFabricInspection } from "@/lib/actions/fabric-inspection"
import { calculate4PointScore, type FabricDefectEntry, type FabricInspectionResult } from "@/lib/fabric-inspection-helpers"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    NBDialog,
    NBDialogHeader,
    NBDialogBody,
    NBDialogFooter,
    NBSection,
    NBInput,
    NBTextarea,
} from "@/components/ui/nb-dialog"

interface FabricInspectionDialogProps {
    products: { id: string; name: string; code: string }[]
    inspectors: { id: string; name: string }[]
    trigger?: React.ReactNode
}

export function FabricInspectionDialog({ products, inspectors, trigger }: FabricInspectionDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<FabricInspectionResult | null>(null)
    const queryClient = useQueryClient()

    const productOptions = useMemo(
        () => products.map((p) => ({ value: p.id, label: p.name, subtitle: p.code })),
        [products]
    )
    const inspectorOptions = useMemo(
        () => inspectors.map((i) => ({ value: i.id, label: i.name })),
        [inspectors]
    )

    // Form fields
    const [batchNumber, setBatchNumber] = useState("")
    const [productId, setProductId] = useState("")
    const [inspectorId, setInspectorId] = useState("")
    const [metersInspected, setMetersInspected] = useState("")
    const [notes, setNotes] = useState("")
    const [defects, setDefects] = useState<FabricDefectEntry[]>([])

    // Defect entry
    const [defLocation, setDefLocation] = useState("")
    const [defType, setDefType] = useState("")
    const [defPoints, setDefPoints] = useState<1 | 2 | 3 | 4>(1)

    const addDefect = () => {
        if (!defLocation.trim() || !defType.trim()) return
        const newDefects = [...defects, { location: defLocation, type: defType, points: defPoints }]
        setDefects(newDefects)
        setDefLocation("")
        setDefType("")
        setDefPoints(1)

        const meters = parseFloat(metersInspected) || 0
        if (meters > 0) setPreview(calculate4PointScore(meters, newDefects))
    }

    const removeDefect = (idx: number) => {
        const newDefects = defects.filter((_, i) => i !== idx)
        setDefects(newDefects)
        const meters = parseFloat(metersInspected) || 0
        if (meters > 0) setPreview(calculate4PointScore(meters, newDefects))
    }

    const updatePreview = (meters: string) => {
        setMetersInspected(meters)
        const m = parseFloat(meters) || 0
        if (m > 0 && defects.length >= 0) {
            setPreview(calculate4PointScore(m, defects))
        }
    }

    const handleSubmit = async () => {
        if (!batchNumber || !productId || !inspectorId || !metersInspected) {
            toast.error("Lengkapi semua field wajib")
            return
        }

        setLoading(true)
        const result = await createFabricInspection({
            batchNumber,
            productId,
            inspectorId,
            metersInspected: parseFloat(metersInspected),
            defects,
            notes: notes || undefined,
        })
        setLoading(false)

        if (result.success && result.result) {
            toast.success(`Inspeksi selesai — Grade ${result.result.grade} (${result.result.pointsPer100Yards} pts/100yd)`)
            queryClient.invalidateQueries({ queryKey: queryKeys.mfgQuality.all })
            setOpen(false)
            resetForm()
        } else {
            toast.error(result.error || "Gagal")
        }
    }

    const resetForm = () => {
        setBatchNumber("")
        setProductId("")
        setInspectorId("")
        setMetersInspected("")
        setNotes("")
        setDefects([])
        setPreview(null)
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
                    <Search className="mr-2 h-4 w-4" /> Inspeksi 4-Point
                </Button>
            )}

            <NBDialog open={open} onOpenChange={setOpen} size="wide">
                <NBDialogHeader
                    icon={Search}
                    title="Inspeksi Kain 4-Point"
                    subtitle="Catat defect dan hitung skor per 100 yard"
                />

                <NBDialogBody>
                    {/* Basic Info */}
                    <NBSection icon={Search} title="Info Dasar">
                        <div className="grid grid-cols-2 gap-3">
                            <NBInput
                                label="Nomor Batch"
                                required
                                value={batchNumber}
                                onChange={setBatchNumber}
                                placeholder="BTH-001"
                            />
                            <NBInput
                                label="Meter Inspeksi"
                                required
                                type="number"
                                value={metersInspected}
                                onChange={updatePreview}
                                placeholder="100"
                            />
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">
                                    Produk Kain <span className="text-red-500">*</span>
                                </label>
                                <ComboboxWithCreate
                                    options={productOptions}
                                    value={productId}
                                    onChange={setProductId}
                                    placeholder="Pilih kain..."
                                    searchPlaceholder="Cari produk kain..."
                                    emptyMessage="Produk kain tidak ditemukan."
                                />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">
                                    Inspektor <span className="text-red-500">*</span>
                                </label>
                                <ComboboxWithCreate
                                    options={inspectorOptions}
                                    value={inspectorId}
                                    onChange={setInspectorId}
                                    placeholder="Pilih inspektor..."
                                    searchPlaceholder="Cari inspektor..."
                                    emptyMessage="Inspektor tidak ditemukan."
                                />
                            </div>
                        </div>
                    </NBSection>

                    {/* Defect Entry - complex, stays as-is */}
                    <NBSection icon={Search} title="Catat Defect" optional>
                        <div className="flex gap-2 items-end">
                            <div className="flex-1">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Lokasi</label>
                                <Input className="h-8 text-sm rounded-none border border-zinc-300" value={defLocation} onChange={(e) => setDefLocation(e.target.value)} placeholder="3.5m dari tepi" />
                            </div>
                            <div className="flex-1">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Jenis Defect</label>
                                <Input className="h-8 text-sm rounded-none border border-zinc-300" value={defType} onChange={(e) => setDefType(e.target.value)} placeholder="Lubang, Noda, dll" />
                            </div>
                            <div className="w-28">
                                <label className="text-[11px] font-bold uppercase tracking-wider text-zinc-600 mb-1 block">Poin</label>
                                <Select value={String(defPoints)} onValueChange={(v) => setDefPoints(Number(v) as 1 | 2 | 3 | 4)}>
                                    <SelectTrigger className="h-8 text-sm rounded-none border border-zinc-300">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="1">1 - Minor</SelectItem>
                                        <SelectItem value="2">2 - Sedang</SelectItem>
                                        <SelectItem value="3">3 - Major</SelectItem>
                                        <SelectItem value="4">4 - Kritis</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={addDefect} className="bg-black text-white border border-black hover:bg-zinc-800 font-black uppercase text-[10px] tracking-wider h-8 px-3 rounded-none">
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>

                        {/* Defect Table */}
                        {defects.length > 0 && (
                            <div className="border border-zinc-200 mt-3 overflow-hidden">
                                <table className="w-full">
                                    <thead className="bg-zinc-800 text-white">
                                        <tr>
                                            <th className="text-[10px] font-black uppercase tracking-widest p-2 text-left">Lokasi</th>
                                            <th className="text-[10px] font-black uppercase tracking-widest p-2 text-left">Jenis</th>
                                            <th className="text-[10px] font-black uppercase tracking-widest p-2 text-center">Poin</th>
                                            <th className="text-[10px] font-black uppercase tracking-widest p-2 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {defects.map((d, idx) => (
                                            <tr key={idx} className="border-b border-zinc-200 last:border-b-0">
                                                <td className="p-2 text-xs">{d.location}</td>
                                                <td className="p-2 text-xs">{d.type}</td>
                                                <td className="p-2 text-center">
                                                    <span className={`inline-block px-2 py-0.5 text-[10px] font-black border border-zinc-300 ${
                                                        d.points >= 3 ? 'bg-red-100 text-red-700' : d.points >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                    }`}>
                                                        {d.points}
                                                    </span>
                                                </td>
                                                <td className="p-2">
                                                    <button onClick={() => removeDefect(idx)} className="text-red-400 hover:text-red-600">
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </NBSection>

                    {/* Live Preview */}
                    {preview && (
                        <div className={`border border-zinc-200 p-4 ${preview.passed ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {preview.passed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                                    <span className="text-sm font-black uppercase tracking-wider">
                                        {preview.passed ? 'LULUS' : 'TIDAK LULUS'}
                                    </span>
                                </div>
                                <span className={`text-lg font-black px-3 py-1 border border-zinc-300 ${
                                    preview.grade === 'A' ? 'bg-emerald-200 text-emerald-800' :
                                    preview.grade === 'B' ? 'bg-blue-200 text-blue-800' :
                                    preview.grade === 'C' ? 'bg-amber-200 text-amber-800' :
                                    'bg-red-200 text-red-800'
                                }`}>
                                    Grade {preview.grade}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Total Poin</span>
                                    <span className="text-xl font-black">{preview.totalPoints}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Poin/100yd</span>
                                    <span className="text-xl font-black">{preview.pointsPer100Yards}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Defect</span>
                                    <span className="text-xl font-black">{preview.defectCount}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    <NBTextarea
                        label="Catatan"
                        value={notes}
                        onChange={setNotes}
                        placeholder="Catatan tambahan..."
                    />
                </NBDialogBody>

                <NBDialogFooter
                    onCancel={() => setOpen(false)}
                    onSubmit={handleSubmit}
                    submitting={loading}
                    submitLabel="Simpan Inspeksi"
                />
            </NBDialog>
        </>
    )
}
