"use client"

import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import {
    Plus,
    Search,
    Trash2,
    Settings,
    Scissors,
    Shirt,
    Droplets,
    Printer,
    Sparkles,
    ShieldCheck,
    Package,
    Wrench,
    Cog,
    Zap,
    ZapOff,
    Factory,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

const STATION_TYPE_CONFIG: { type: string; label: string; icon: any; color: string }[] = [
    { type: "CUTTING", label: "Potong", icon: Scissors, color: "bg-rose-100 text-rose-700 border-rose-300" },
    { type: "SEWING", label: "Jahit", icon: Shirt, color: "bg-blue-100 text-blue-700 border-blue-300" },
    { type: "WASHING", label: "Cuci", icon: Droplets, color: "bg-cyan-100 text-cyan-700 border-cyan-300" },
    { type: "PRINTING", label: "Sablon", icon: Printer, color: "bg-purple-100 text-purple-700 border-purple-300" },
    { type: "EMBROIDERY", label: "Bordir", icon: Sparkles, color: "bg-pink-100 text-pink-700 border-pink-300" },
    { type: "QC", label: "Quality Control", icon: ShieldCheck, color: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    { type: "PACKING", label: "Packing", icon: Package, color: "bg-amber-100 text-amber-700 border-amber-300" },
    { type: "FINISHING", label: "Finishing", icon: Wrench, color: "bg-orange-100 text-orange-700 border-orange-300" },
    { type: "OTHER", label: "Lainnya", icon: Cog, color: "bg-zinc-100 text-zinc-700 border-zinc-300" },
]

function getTypeConfig(stationType: string) {
    return STATION_TYPE_CONFIG.find((c) => c.type === stationType) || STATION_TYPE_CONFIG[STATION_TYPE_CONFIG.length - 1]
}

interface Props {
    stations: any[]
}

export function StasiunClient({ stations: initialStations }: Props) {
    const queryClient = useQueryClient()
    const [searchQuery, setSearchQuery] = useState("")
    const [typeFilter, setTypeFilter] = useState<string | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingStation, setEditingStation] = useState<any>(null)
    const [formName, setFormName] = useState("")
    const [formType, setFormType] = useState("CUTTING")
    const [formCost, setFormCost] = useState("")
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState<string | null>(null)
    const [toggling, setToggling] = useState<string | null>(null)

    // Filter stations (only IN_HOUSE for this page)
    const inHouseStations = initialStations.filter((s: any) => s.operationType !== "SUBCONTRACTOR")

    const filtered = inHouseStations.filter((s: any) => {
        const matchSearch = !searchQuery ||
            s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.code?.toLowerCase().includes(searchQuery.toLowerCase())
        const matchType = !typeFilter || s.stationType === typeFilter
        return matchSearch && matchType
    })

    // Group by stationType
    const grouped: Record<string, any[]> = {}
    for (const s of filtered) {
        const type = s.stationType || "OTHER"
        if (!grouped[type]) grouped[type] = []
        grouped[type].push(s)
    }

    // Sort by config order
    const sortedTypes = STATION_TYPE_CONFIG.map((c) => c.type).filter((t) => grouped[t])
    for (const t of Object.keys(grouped)) {
        if (!sortedTypes.includes(t)) sortedTypes.push(t)
    }

    // KPI calculations
    const totalStations = inHouseStations.length
    const activeStations = inHouseStations.filter((s: any) => s.isActive !== false).length
    const inactiveStations = totalStations - activeStations
    const uniqueTypes = new Set(inHouseStations.map((s: any) => s.stationType)).size

    const kpis = [
        { label: "Total Stasiun", value: String(totalStations), detail: "Stasiun terdaftar", icon: Factory, color: "text-zinc-900" },
        { label: "Aktif", value: String(activeStations), detail: "Stasiun beroperasi", icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50" },
        { label: "Nonaktif", value: String(inactiveStations), detail: "Stasiun nonaktif", icon: ZapOff, color: inactiveStations > 0 ? "text-red-600" : "text-zinc-400", bg: inactiveStations > 0 ? "bg-red-50" : "" },
        { label: "Tipe Proses", value: String(uniqueTypes), detail: "Kategori proses", icon: Settings, color: "text-blue-600", bg: "bg-blue-50" },
    ]

    // Dialog handlers
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

    const handleSave = async () => {
        if (!formName.trim()) {
            toast.error("Nama stasiun wajib diisi")
            return
        }
        setSaving(true)
        try {
            const code = editingStation
                ? editingStation.code
                : `STN-${formType.substring(0, 3)}-${String(Date.now()).slice(-4)}`

            const body = {
                code,
                name: formName.trim(),
                stationType: formType,
                operationType: "IN_HOUSE",
                costPerUnit: Number(formCost) || 0,
            }

            const url = editingStation
                ? `/api/manufacturing/process-stations/${editingStation.id}`
                : "/api/manufacturing/process-stations"

            const res = await fetch(url, {
                method: editingStation ? "PATCH" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            const result = await res.json()

            if (result.success) {
                toast.success(editingStation ? "Stasiun berhasil diperbarui" : "Stasiun berhasil ditambahkan")
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                setDialogOpen(false)
            } else {
                toast.error(result.error || "Gagal menyimpan stasiun")
            }
        } catch {
            toast.error("Gagal menyimpan stasiun")
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (e: React.MouseEvent, station: any) => {
        e.stopPropagation()
        const confirmed = window.confirm(`Hapus stasiun "${station.name}" (${station.code})?\n\nData stasiun akan dihapus permanen.`)
        if (!confirmed) return

        setDeleting(station.id)
        try {
            const res = await fetch(`/api/manufacturing/process-stations/${station.id}`, { method: "DELETE" })
            const result = await res.json()
            if (result.success) {
                toast.success("Stasiun berhasil dihapus")
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
            } else {
                toast.error(result.error || "Gagal menghapus stasiun")
            }
        } catch {
            toast.error("Gagal menghapus stasiun")
        } finally {
            setDeleting(null)
        }
    }

    const handleToggleActive = async (e: React.MouseEvent, station: any) => {
        e.stopPropagation()
        setToggling(station.id)
        try {
            const res = await fetch(`/api/manufacturing/process-stations/${station.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !station.isActive }),
            })
            const result = await res.json()
            if (result.success) {
                toast.success(station.isActive ? "Stasiun dinonaktifkan" : "Stasiun diaktifkan")
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
            } else {
                toast.error(result.error || "Gagal mengubah status")
            }
        } catch {
            toast.error("Gagal mengubah status")
        } finally {
            setToggling(null)
        }
    }

    return (
        <div className="w-full bg-zinc-50 dark:bg-black font-sans min-h-[calc(100svh-theme(spacing.16))]">
            <div className="mf-page">

                {/* Header */}
                <div className="flex-none flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-black uppercase tracking-widest text-zinc-900 dark:text-white flex items-center gap-2">
                            <Factory className="h-6 w-6" />
                            Stasiun Produksi
                        </h1>
                        <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mt-1">
                            Kelola stasiun kerja per tipe proses — muncul di BOM Canvas
                        </p>
                    </div>
                    <Button
                        className="h-10 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] active:scale-[0.98] transition-all uppercase font-black tracking-widest text-xs rounded-none px-6"
                        onClick={openCreate}
                    >
                        <Plus className="mr-2 h-4 w-4" /> Tambah Stasiun
                    </Button>
                </div>

                {/* KPI Strip */}
                <div className="flex-none bg-white dark:bg-zinc-900 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-x-2 divide-black divide-y-2 md:divide-y-0">
                        {kpis.map((kpi) => (
                            <div
                                key={kpi.label}
                                className={cn(
                                    "group relative p-4 transition-all hover:bg-zinc-50 dark:hover:bg-zinc-800/50",
                                    kpi.bg
                                )}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <span className={cn("text-zinc-400", kpi.color)}>
                                        <kpi.icon className="h-5 w-5" />
                                    </span>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        {kpi.label}
                                    </span>
                                </div>
                                <p className={cn("text-2xl font-black tracking-tighter", kpi.color)}>
                                    {kpi.value}
                                </p>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 mt-1">
                                    {kpi.detail}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Search + Type Filter */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                            <Search className="h-4 w-4" />
                        </div>
                        <Input
                            placeholder="Cari stasiun atau kode..."
                            className="pl-10 h-10 border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,0.3)] focus-visible:ring-0 focus-visible:translate-x-[1px] focus-visible:translate-y-[1px] focus-visible:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)] transition-all bg-white dark:bg-zinc-900 rounded-none font-medium"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            className={cn(
                                "border-2 border-black rounded-none text-[10px] font-black uppercase tracking-widest h-8 transition-all hover:bg-black hover:text-white",
                                !typeFilter
                                    ? "bg-black text-white shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]"
                                    : "bg-white text-zinc-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)]"
                            )}
                            onClick={() => setTypeFilter(null)}
                        >
                            Semua
                        </Button>
                        {STATION_TYPE_CONFIG.map((cfg) => {
                            const count = inHouseStations.filter((s: any) => s.stationType === cfg.type).length
                            if (count === 0) return null
                            return (
                                <Button
                                    key={cfg.type}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "border-2 border-black rounded-none text-[10px] font-black uppercase tracking-widest h-8 transition-all hover:bg-black hover:text-white",
                                        typeFilter === cfg.type
                                            ? "bg-black text-white shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]"
                                            : "bg-white text-zinc-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.3)]"
                                    )}
                                    onClick={() => setTypeFilter(cfg.type)}
                                >
                                    {cfg.label} ({count})
                                </Button>
                            )
                        })}
                    </div>
                </div>

                {/* Empty State */}
                {filtered.length === 0 && (
                    <div className="border-2 border-dashed border-zinc-300 min-h-[300px] flex flex-col items-center justify-center text-center bg-zinc-50/50 p-8">
                        <div className="h-16 w-16 bg-zinc-100 border-2 border-zinc-200 flex items-center justify-center mb-4 rounded-full">
                            <Factory className="h-8 w-8 text-zinc-300" />
                        </div>
                        <h3 className="text-lg font-black uppercase tracking-widest text-zinc-400">Tidak ada stasiun ditemukan</h3>
                        <p className="text-xs font-bold text-zinc-400 mt-2 max-w-xs">
                            {searchQuery || typeFilter
                                ? "Coba sesuaikan kata kunci pencarian atau filter tipe proses."
                                : "Mulai dengan menambahkan stasiun baru ke dalam sistem."}
                        </p>
                        {!searchQuery && !typeFilter && (
                            <Button
                                className="mt-6 bg-black text-white rounded-none font-black uppercase tracking-wider text-xs px-6 py-5 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px] transition-all"
                                onClick={openCreate}
                            >
                                <Plus className="mr-2 h-4 w-4" /> Tambah Stasiun
                            </Button>
                        )}
                    </div>
                )}

                {/* Station Grid — Grouped by Type */}
                {sortedTypes.map((type) => {
                    const typeStations = grouped[type]
                    const config = getTypeConfig(type)
                    const TypeIcon = config.icon
                    const groupLabel = type === "OTHER"
                        ? (typeStations.find((s: any) => s.description)?.description || config.label)
                        : config.label
                    const activeCount = typeStations.filter((s: any) => s.isActive !== false).length

                    return (
                        <div key={type} className="space-y-3">
                            {/* Type Group Header */}
                            <div className="flex items-center gap-3">
                                <div className={cn("flex items-center gap-1.5 px-3 py-1.5 border text-xs font-black uppercase tracking-widest", config.color)}>
                                    <TypeIcon className="h-3.5 w-3.5" />
                                    {groupLabel}
                                </div>
                                <p className="text-[9px] font-bold text-zinc-400 uppercase">
                                    {typeStations.length} stasiun
                                    {activeCount < typeStations.length && ` (${activeCount} aktif)`}
                                </p>
                            </div>

                            {/* Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {typeStations.map((station: any) => {
                                    const isActive = station.isActive !== false
                                    return (
                                        <Card
                                            key={station.id}
                                            className={cn(
                                                "group relative border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all rounded-none overflow-hidden flex flex-col",
                                                isActive ? "bg-white dark:bg-zinc-900" : "bg-zinc-100 dark:bg-zinc-800 opacity-60"
                                            )}
                                        >
                                            {/* Card Header */}
                                            <div className="flex justify-between items-center p-3 border-b-2 border-black bg-zinc-50 dark:bg-zinc-800">
                                                <div className="flex items-center gap-2">
                                                    <div className={cn("h-7 w-7 flex items-center justify-center border", config.color)}>
                                                        <TypeIcon className="h-3.5 w-3.5" />
                                                    </div>
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                        {station.code}
                                                    </span>
                                                </div>
                                                <div className={cn(
                                                    "px-2 py-0.5 text-[9px] font-black uppercase tracking-widest border",
                                                    isActive
                                                        ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                                                        : "bg-zinc-200 text-zinc-500 border-zinc-300"
                                                )}>
                                                    {isActive ? "AKTIF" : "NONAKTIF"}
                                                </div>
                                            </div>

                                            {/* Main Content */}
                                            <div className="p-4 flex-1 flex flex-col gap-3">
                                                <h3 className="text-sm font-black uppercase tracking-wide leading-tight">
                                                    {station.name}
                                                </h3>

                                                <div className="grid grid-cols-2 gap-2 mt-auto">
                                                    <div className="border border-zinc-200 bg-zinc-50/50 p-2">
                                                        <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Tipe</p>
                                                        <div className={cn("text-xs font-black uppercase px-1.5 py-0.5 inline-block border", config.color)}>
                                                            {config.label}
                                                        </div>
                                                    </div>
                                                    <div className="border border-zinc-200 bg-zinc-50/50 p-2">
                                                        <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest mb-0.5">Biaya/Unit</p>
                                                        <div className="font-bold text-sm text-zinc-900">
                                                            {Number(station.costPerUnit) > 0
                                                                ? `Rp ${Number(station.costPerUnit).toLocaleString("id-ID")}`
                                                                : "-"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Footer / Actions */}
                                            <div className="border-t-2 border-black p-2 flex items-center justify-between bg-zinc-50 dark:bg-zinc-800">
                                                <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider px-2">
                                                    In-House
                                                </p>
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-none hover:bg-black hover:text-white border border-transparent hover:border-black transition-all"
                                                        onClick={() => openEdit(station)}
                                                        title="Edit Stasiun"
                                                    >
                                                        <Settings className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className={cn(
                                                            "h-7 w-7 rounded-none border border-transparent transition-all",
                                                            isActive
                                                                ? "text-amber-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200"
                                                                : "text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200"
                                                        )}
                                                        onClick={(e) => handleToggleActive(e, station)}
                                                        disabled={toggling === station.id}
                                                        title={isActive ? "Nonaktifkan" : "Aktifkan"}
                                                    >
                                                        {isActive ? <ZapOff className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 rounded-none text-red-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-transparent transition-all"
                                                        onClick={(e) => handleDelete(e, station)}
                                                        disabled={deleting === station.id}
                                                        title="Hapus Stasiun"
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}

                {/* Add Station Dialog */}
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent className="border-2 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md">
                        <DialogHeader>
                            <DialogTitle className="text-sm font-black uppercase tracking-widest">
                                {editingStation ? "Edit Stasiun" : "Tambah Stasiun Baru"}
                            </DialogTitle>
                            <DialogDescription className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                                Stasiun baru akan tersedia di BOM Canvas
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 mt-2">
                            {/* Nama Stasiun */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Nama Stasiun
                                </label>
                                <Input
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="cth: Potong A, Jahit Line 1, Sewing B"
                                    className="border-2 border-black rounded-none h-10 font-bold"
                                />
                            </div>

                            {/* Tipe Proses */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Tipe Proses
                                </label>
                                <Select value={formType} onValueChange={setFormType}>
                                    <SelectTrigger className="border-2 border-black rounded-none h-10 font-bold">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                                        {STATION_TYPE_CONFIG.map((c) => (
                                            <SelectItem key={c.type} value={c.type} className="rounded-none font-medium">
                                                {c.label} ({c.type})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Biaya per Unit */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                    Biaya per Unit (Rp)
                                </label>
                                <Input
                                    type="number"
                                    value={formCost}
                                    onChange={(e) => setFormCost(e.target.value)}
                                    placeholder="0"
                                    className="border-2 border-black rounded-none h-10 font-bold"
                                />
                            </div>

                            {/* Save Button */}
                            <Button
                                className="w-full h-10 bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all uppercase font-black tracking-widest text-xs rounded-none"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? "Menyimpan..." : editingStation ? "Simpan Perubahan" : "Tambah Stasiun"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
