"use client"

import { useState, useCallback } from "react"
import { useProcessStations } from "@/hooks/use-process-stations"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, Package, Wrench, Cog,
    Plus, Pencil, Trash2, Power, PowerOff,
} from "lucide-react"

const STATION_TYPE_CONFIG: { type: string; label: string; icon: any }[] = [
    { type: "CUTTING", label: "Potong", icon: Scissors },
    { type: "SEWING", label: "Jahit", icon: Shirt },
    { type: "WASHING", label: "Cuci", icon: Droplets },
    { type: "PRINTING", label: "Sablon", icon: Printer },
    { type: "EMBROIDERY", label: "Bordir", icon: Sparkles },
    { type: "QC", label: "Quality Control", icon: ShieldCheck },
    { type: "PACKING", label: "Packing", icon: Package },
    { type: "FINISHING", label: "Finishing", icon: Wrench },
    { type: "OTHER", label: "Lainnya", icon: Cog },
]

function getTypeConfig(stationType: string) {
    return STATION_TYPE_CONFIG.find(c => c.type === stationType) || STATION_TYPE_CONFIG[STATION_TYPE_CONFIG.length - 1]
}

export default function ProcessesPage() {
    const { data: stations, isLoading } = useProcessStations({ includeInactive: true })
    const queryClient = useQueryClient()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingStation, setEditingStation] = useState<any>(null)
    const [formName, setFormName] = useState("")
    const [formType, setFormType] = useState("CUTTING")
    const [formCost, setFormCost] = useState("")
    const [saving, setSaving] = useState(false)

    // Group stations by stationType (only IN_HOUSE)
    const inHouseStations = (stations || []).filter((s: any) => s.operationType !== "SUBCONTRACTOR")

    const grouped: Record<string, any[]> = {}
    for (const s of inHouseStations) {
        const type = s.stationType || "OTHER"
        if (!grouped[type]) grouped[type] = []
        grouped[type].push(s)
    }

    // Sort by STATION_TYPE_CONFIG order
    const sortedTypes = STATION_TYPE_CONFIG.map(c => c.type).filter(t => grouped[t])
    // Add any types not in config
    for (const t of Object.keys(grouped)) {
        if (!sortedTypes.includes(t)) sortedTypes.push(t)
    }

    const openCreate = () => {
        setEditingStation(null)
        setFormName("")
        setFormType("CUTTING")
        setFormCost("")
        setDialogOpen(true)
    }

    const openEdit = (station: any) => {
        setEditingStation(station)
        setFormName(station.name)
        setFormType(station.stationType)
        setFormCost(String(Number(station.costPerUnit || 0)))
        setDialogOpen(true)
    }

    const handleSave = useCallback(async () => {
        if (!formName.trim()) {
            toast.error("Nama proses wajib diisi")
            return
        }
        setSaving(true)
        try {
            if (editingStation) {
                // Update
                const res = await fetch(`/api/manufacturing/process-stations/${editingStation.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: formName.trim(),
                        stationType: formType,
                        costPerUnit: Number(formCost) || 0,
                    }),
                })
                const result = await res.json()
                if (!result.success) {
                    toast.error(result.error || "Gagal memperbarui proses")
                    return
                }
                toast.success(`Proses "${formName}" diperbarui`)
            } else {
                // Create
                const code = `STN-${formType.substring(0, 3)}-${String(Date.now()).slice(-4)}`
                const res = await fetch("/api/manufacturing/process-stations", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        code,
                        name: formName.trim(),
                        stationType: formType,
                        operationType: "IN_HOUSE",
                        costPerUnit: Number(formCost) || 0,
                    }),
                })
                const result = await res.json()
                if (!result.success) {
                    toast.error(result.error || "Gagal membuat proses")
                    return
                }
                toast.success(`Proses "${formName}" dibuat`)
            }
            queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
            setDialogOpen(false)
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSaving(false)
        }
    }, [editingStation, formName, formType, formCost, queryClient])

    const handleToggleActive = useCallback(async (station: any) => {
        try {
            const res = await fetch(`/api/manufacturing/process-stations/${station.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !station.isActive }),
            })
            const result = await res.json()
            if (result.success) {
                toast.success(`Proses "${station.name}" ${station.isActive ? "dinonaktifkan" : "diaktifkan"}`)
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
            }
        } catch {
            toast.error("Gagal mengubah status")
        }
    }, [queryClient])

    const handleDelete = useCallback(async (station: any) => {
        if (!confirm(`Hapus proses "${station.name}"? Proses yang sedang digunakan di BOM tidak bisa dihapus.`)) return
        try {
            const res = await fetch(`/api/manufacturing/process-stations/${station.id}`, { method: "DELETE" })
            const result = await res.json()
            if (result.success) {
                toast.success(`Proses "${station.name}" dihapus`)
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
            } else {
                toast.error(result.error || "Gagal menghapus")
            }
        } catch {
            toast.error("Gagal menghapus")
        }
    }, [queryClient])

    if (isLoading) return <TablePageSkeleton accentColor="bg-violet-400" />

    return (
        <div className="mf-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-lg font-black uppercase tracking-widest flex items-center gap-2">
                        <Cog className="h-6 w-6" /> Proses Produksi
                    </h1>
                    <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                        Kelola daftar proses yang tersedia di BOM Canvas (Potong, Jahit, Cuci, dll)
                    </p>
                </div>
                <Button
                    onClick={openCreate}
                    className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all uppercase font-black tracking-widest text-xs rounded-none px-6"
                >
                    <Plus className="mr-2 h-4 w-4" /> Tambah Proses
                </Button>
            </div>

            {/* Process groups */}
            {sortedTypes.length === 0 ? (
                <div className="border-2 border-dashed border-zinc-300 min-h-[200px] flex flex-col items-center justify-center text-center p-8">
                    <Cog className="h-10 w-10 text-zinc-300 mb-3" />
                    <p className="text-sm font-black text-zinc-400">Belum ada proses</p>
                    <p className="text-xs text-zinc-400 mt-1">Tambah proses pertama untuk digunakan di BOM Canvas</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {sortedTypes.map(type => {
                        const config = getTypeConfig(type)
                        const Icon = config.icon
                        const typeStations = grouped[type]!

                        return (
                            <div key={type} className="border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                {/* Type header */}
                                <div className="flex items-center gap-3 px-4 py-3 bg-zinc-50 border-b-2 border-black">
                                    <div className="bg-black text-white p-1.5">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <h2 className="text-sm font-black uppercase tracking-widest">{config.label}</h2>
                                        <p className="text-[9px] font-bold text-zinc-400 uppercase">{type} · {typeStations.length} stasiun</p>
                                    </div>
                                </div>

                                {/* Stations list */}
                                <div className="divide-y divide-zinc-100">
                                    {typeStations.map((station: any) => (
                                        <div
                                            key={station.id}
                                            className={`flex items-center gap-4 px-4 py-3 group hover:bg-zinc-50 transition-colors ${
                                                !station.isActive ? "opacity-50" : ""
                                            }`}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold truncate">{station.name}</p>
                                                    {!station.isActive && (
                                                        <span className="text-[8px] font-black uppercase bg-zinc-200 text-zinc-500 px-1.5 py-0.5">Nonaktif</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] font-mono text-zinc-400">{station.code}</p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs font-bold text-emerald-600">
                                                    {Number(station.costPerUnit) > 0
                                                        ? `Rp ${Number(station.costPerUnit).toLocaleString("id-ID")}/unit`
                                                        : "-"
                                                    }
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                <button
                                                    onClick={() => openEdit(station)}
                                                    className="p-1.5 hover:bg-zinc-200 transition-colors"
                                                    title="Edit"
                                                >
                                                    <Pencil className="h-3.5 w-3.5 text-zinc-500" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleActive(station)}
                                                    className="p-1.5 hover:bg-zinc-200 transition-colors"
                                                    title={station.isActive ? "Nonaktifkan" : "Aktifkan"}
                                                >
                                                    {station.isActive
                                                        ? <PowerOff className="h-3.5 w-3.5 text-amber-500" />
                                                        : <Power className="h-3.5 w-3.5 text-emerald-500" />
                                                    }
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(station)}
                                                    className="p-1.5 hover:bg-red-100 transition-colors"
                                                    title="Hapus"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5 text-red-400" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="border-2 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 bg-white max-w-md">
                    <div className="bg-black text-white px-6 py-4 border-b-2 border-black">
                        <DialogHeader>
                            <DialogTitle className="uppercase font-black tracking-tight text-lg text-white">
                                {editingStation ? "Edit Proses" : "Tambah Proses Baru"}
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 text-xs">
                                {editingStation ? "Ubah detail proses produksi" : "Proses baru akan muncul di toolbar BOM Canvas"}
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nama Proses</label>
                            <Input
                                value={formName}
                                onChange={(e) => setFormName(e.target.value)}
                                placeholder="cth: Potong, Jahit Overlock"
                                className="border-2 border-black rounded-none h-10 font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipe Proses</label>
                            <Select value={formType} onValueChange={setFormType}>
                                <SelectTrigger className="border-2 border-black rounded-none h-10 font-bold">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-none border-2 border-black">
                                    {STATION_TYPE_CONFIG.map(c => (
                                        <SelectItem key={c.type} value={c.type} className="rounded-none font-medium">
                                            {c.label} ({c.type})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Biaya per Unit (Rp)</label>
                            <Input
                                type="number"
                                min={0}
                                value={formCost}
                                onChange={(e) => setFormCost(e.target.value)}
                                placeholder="0"
                                className="border-2 border-black rounded-none h-10 font-bold font-mono"
                            />
                        </div>
                    </div>
                    <DialogFooter className="px-6 pb-6">
                        <Button
                            onClick={handleSave}
                            disabled={saving}
                            className="w-full bg-black text-white rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-black uppercase h-10"
                        >
                            {saving ? "Menyimpan..." : editingStation ? "Simpan Perubahan" : "Buat Proses"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
