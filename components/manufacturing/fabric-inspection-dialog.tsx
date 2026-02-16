"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { NB } from "@/lib/dialog-styles"
import { Plus, Trash2, Search, CheckCircle2, XCircle } from "lucide-react"
import { createFabricInspection } from "@/lib/actions/fabric-inspection"
import { calculate4PointScore, type FabricDefectEntry, type FabricInspectionResult } from "@/lib/fabric-inspection-helpers"
import { toast } from "sonner"

interface FabricInspectionDialogProps {
    products: { id: string; name: string; code: string }[]
    inspectors: { id: string; name: string }[]
    trigger?: React.ReactNode
}

export function FabricInspectionDialog({ products, inspectors, trigger }: FabricInspectionDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<FabricInspectionResult | null>(null)

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

        // Update preview
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
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className={NB.triggerBtn}>
                        <Search className="mr-2 h-4 w-4" /> Inspeksi 4-Point
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className={NB.contentWide}>
                <DialogHeader className={NB.header}>
                    <DialogTitle className={NB.title}>
                        <Search className="h-5 w-5" /> Inspeksi Kain 4-Point
                    </DialogTitle>
                    <p className={NB.subtitle}>Catat defect dan hitung skor per 100 yard</p>
                </DialogHeader>

                <div className="p-6 space-y-4 max-h-[72vh] overflow-y-auto">
                    {/* Basic Info */}
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Info Dasar</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={NB.label}>Nomor Batch <span className={NB.labelRequired}>*</span></label>
                                    <Input className={NB.input} value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} placeholder="BTH-001" />
                                </div>
                                <div>
                                    <label className={NB.label}>Meter Inspeksi <span className={NB.labelRequired}>*</span></label>
                                    <Input className={NB.input} type="number" value={metersInspected} onChange={(e) => updatePreview(e.target.value)} placeholder="100" />
                                </div>
                                <div>
                                    <label className={NB.label}>Produk Kain <span className={NB.labelRequired}>*</span></label>
                                    <select className={NB.select} value={productId} onChange={(e) => setProductId(e.target.value)}>
                                        <option value="">Pilih kain...</option>
                                        {products.map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={NB.label}>Inspektor <span className={NB.labelRequired}>*</span></label>
                                    <select className={NB.select} value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}>
                                        <option value="">Pilih inspektor...</option>
                                        {inspectors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Defect Entry */}
                    <div className={NB.section}>
                        <div className={NB.sectionHead}>
                            <span className={NB.sectionTitle}>Catat Defect</span>
                        </div>
                        <div className={NB.sectionBody}>
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className={NB.label}>Lokasi</label>
                                    <Input className={NB.input} value={defLocation} onChange={(e) => setDefLocation(e.target.value)} placeholder="3.5m dari tepi" />
                                </div>
                                <div className="flex-1">
                                    <label className={NB.label}>Jenis Defect</label>
                                    <Input className={NB.input} value={defType} onChange={(e) => setDefType(e.target.value)} placeholder="Lubang, Noda, dll" />
                                </div>
                                <div className="w-24">
                                    <label className={NB.label}>Poin</label>
                                    <select className={NB.select} value={defPoints} onChange={(e) => setDefPoints(Number(e.target.value) as 1 | 2 | 3 | 4)}>
                                        <option value={1}>1 - Minor</option>
                                        <option value={2}>2 - Sedang</option>
                                        <option value={3}>3 - Major</option>
                                        <option value={4}>4 - Kritis</option>
                                    </select>
                                </div>
                                <Button onClick={addDefect} className={NB.submitBtn + " h-10"}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>

                            {/* Defect Table */}
                            {defects.length > 0 && (
                                <div className={NB.tableWrap + " mt-3"}>
                                    <table className="w-full">
                                        <thead className={NB.tableHead}>
                                            <tr>
                                                <th className={NB.tableHeadCell}>Lokasi</th>
                                                <th className={NB.tableHeadCell}>Jenis</th>
                                                <th className={NB.tableHeadCell + " text-center"}>Poin</th>
                                                <th className={NB.tableHeadCell + " w-10"}></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {defects.map((d, idx) => (
                                                <tr key={idx} className={NB.tableRow}>
                                                    <td className={NB.tableCell}>{d.location}</td>
                                                    <td className={NB.tableCell}>{d.type}</td>
                                                    <td className={NB.tableCell + " text-center"}>
                                                        <span className={`inline-block px-2 py-0.5 text-[10px] font-black border-2 border-black ${
                                                            d.points >= 3 ? 'bg-red-100 text-red-700' : d.points >= 2 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                                        }`}>
                                                            {d.points}
                                                        </span>
                                                    </td>
                                                    <td className={NB.tableCell}>
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
                        </div>
                    </div>

                    {/* Live Preview */}
                    {preview && (
                        <div className={`border-2 border-black p-4 ${preview.passed ? 'bg-emerald-50' : 'bg-red-50'}`}>
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    {preview.passed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-red-600" />}
                                    <span className="text-sm font-black uppercase tracking-wider">
                                        {preview.passed ? 'LULUS' : 'TIDAK LULUS'}
                                    </span>
                                </div>
                                <span className={`text-lg font-black px-3 py-1 border-2 border-black ${
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

                    {/* Notes */}
                    <div>
                        <label className={NB.label}>Catatan</label>
                        <Textarea className={NB.textarea} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tambahan..." />
                    </div>

                    {/* Footer */}
                    <div className={NB.footer}>
                        <Button variant="outline" onClick={() => setOpen(false)} className={NB.cancelBtn}>Batal</Button>
                        <Button onClick={handleSubmit} disabled={loading} className={NB.submitBtn}>
                            {loading ? "Menyimpan..." : "Simpan Inspeksi"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
