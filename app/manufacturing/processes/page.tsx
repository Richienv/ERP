"use client"

import { useState } from "react"
import { useProcessStations } from "@/hooks/use-process-stations"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import {
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, Package, Wrench, Cog,
    Plus, CheckCircle2, XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"

const STATION_TYPE_CONFIG: { type: string; label: string; icon: any; color: string; bg: string }[] = [
    { type: "CUTTING", label: "Potong", icon: Scissors, color: "text-rose-700", bg: "bg-rose-50 border-rose-200" },
    { type: "SEWING", label: "Jahit", icon: Shirt, color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
    { type: "WASHING", label: "Cuci", icon: Droplets, color: "text-cyan-700", bg: "bg-cyan-50 border-cyan-200" },
    { type: "PRINTING", label: "Sablon", icon: Printer, color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
    { type: "EMBROIDERY", label: "Bordir", icon: Sparkles, color: "text-pink-700", bg: "bg-pink-50 border-pink-200" },
    { type: "QC", label: "Quality Control", icon: ShieldCheck, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200" },
    { type: "PACKING", label: "Packing", icon: Package, color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
    { type: "FINISHING", label: "Finishing", icon: Wrench, color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
]

export default function ProcessesPage() {
    const { data: stations, isLoading } = useProcessStations({ includeInactive: true })
    const queryClient = useQueryClient()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [formLabel, setFormLabel] = useState("")
    const [saving, setSaving] = useState(false)

    // Count stations per type
    const inHouseStations = (stations || []).filter((s: any) => s.operationType !== "SUBCONTRACTOR")
    const countByType: Record<string, { total: number; active: number }> = {}
    for (const s of inHouseStations) {
        const type = s.stationType || "OTHER"
        if (!countByType[type]) countByType[type] = { total: 0, active: 0 }
        countByType[type].total++
        if (s.isActive !== false) countByType[type].active++
    }

    // Custom OTHER types (from description field)
    const otherStations = inHouseStations.filter((s: any) => s.stationType === "OTHER")
    const customLabels = [...new Set(otherStations.map((s: any) => s.description).filter(Boolean))]

    // Build combined list: fixed types + custom OTHER types
    const allTypes = [
        ...STATION_TYPE_CONFIG.map((cfg) => ({
            type: cfg.type,
            label: cfg.label,
            icon: cfg.icon,
            color: cfg.color,
            bg: cfg.bg,
            stationCount: countByType[cfg.type]?.total || 0,
            activeCount: countByType[cfg.type]?.active || 0,
            isCustom: false,
        })),
        ...customLabels.map((label) => {
            const matching = otherStations.filter((s: any) => s.description === label)
            return {
                type: "OTHER",
                label: label as string,
                icon: Cog,
                color: "text-zinc-700",
                bg: "bg-zinc-50 border-zinc-200",
                stationCount: matching.length,
                activeCount: matching.filter((s: any) => s.isActive !== false).length,
                isCustom: true,
            }
        }),
    ]

    // Handle adding custom process type (OTHER with description)
    const handleAddCustom = async () => {
        if (!formLabel.trim()) {
            toast.error("Nama tipe proses wajib diisi")
            return
        }
        setSaving(true)
        try {
            const code = `STN-OTH-${String(Date.now()).slice(-4)}`
            const res = await fetch("/api/manufacturing/process-stations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    name: formLabel.trim(),
                    stationType: "OTHER",
                    operationType: "IN_HOUSE",
                    costPerUnit: 0,
                    description: formLabel.trim(),
                }),
            })
            const result = await res.json()
            if (result.success) {
                toast.success(`Tipe proses "${formLabel.trim()}" ditambahkan`)
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                setDialogOpen(false)
                setFormLabel("")
            } else {
                toast.error(result.error || "Gagal menambahkan tipe proses")
            }
        } catch {
            toast.error("Gagal menambahkan tipe proses")
        } finally {
            setSaving(false)
        }
    }

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
                        Tipe proses yang tersedia di BOM Canvas — tambah stasiun di halaman Stasiun
                    </p>
                </div>
                <Button
                    onClick={() => { setFormLabel(""); setDialogOpen(true) }}
                    className="bg-black text-white hover:bg-zinc-800 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)] transition-all uppercase font-black tracking-widest text-xs rounded-none px-6"
                >
                    <Plus className="mr-2 h-4 w-4" /> Tambah Proses
                </Button>
            </div>

            {/* Process Type Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allTypes.map((item, i) => {
                    const Icon = item.icon
                    const hasStations = item.stationCount > 0
                    return (
                        <div
                            key={`${item.type}-${item.label}-${i}`}
                            className={cn(
                                "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all overflow-hidden",
                            )}
                        >
                            {/* Card Header */}
                            <div className={cn("flex items-center gap-3 px-4 py-3 border-b-2 border-black", item.bg)}>
                                <div className="bg-black text-white p-2">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-black uppercase tracking-widest truncate">
                                        {item.label}
                                    </h3>
                                    <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                        {item.isCustom ? "CUSTOM" : item.type}
                                    </p>
                                </div>
                            </div>

                            {/* Card Body */}
                            <div className="px-4 py-3 space-y-2">
                                {/* Station count */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Stasiun
                                    </span>
                                    <span className="text-sm font-black">
                                        {item.stationCount}
                                    </span>
                                </div>

                                {/* Status */}
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                        Status
                                    </span>
                                    {hasStations ? (
                                        <div className="flex items-center gap-1 text-[10px] font-black text-emerald-600">
                                            <CheckCircle2 className="h-3 w-3" />
                                            {item.activeCount} aktif
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1 text-[10px] font-black text-zinc-400">
                                            <XCircle className="h-3 w-3" />
                                            Belum ada stasiun
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>

            {/* Add Custom Process Type Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="border-2 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] p-0 bg-white max-w-md">
                    <div className="bg-black text-white px-6 py-4 border-b-2 border-black">
                        <DialogHeader>
                            <DialogTitle className="uppercase font-black tracking-tight text-lg text-white">
                                Tambah Tipe Proses
                            </DialogTitle>
                            <DialogDescription className="text-zinc-400 text-xs">
                                Tambah tipe proses kustom (selain Potong, Jahit, dll yang sudah tersedia)
                            </DialogDescription>
                        </DialogHeader>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                Nama Tipe Proses
                            </label>
                            <Input
                                value={formLabel}
                                onChange={(e) => setFormLabel(e.target.value)}
                                placeholder="cth: Glazing, Embossing, Laser Cut"
                                className="border-2 border-black rounded-none h-10 font-bold"
                                onKeyDown={(e) => e.key === "Enter" && handleAddCustom()}
                            />
                            <p className="text-[9px] text-zinc-400">
                                Tipe baru akan muncul sebagai pilihan di BOM Canvas
                            </p>
                        </div>
                    </div>
                    <DialogFooter className="px-6 pb-6">
                        <Button
                            onClick={handleAddCustom}
                            disabled={saving}
                            className="w-full bg-black text-white rounded-none border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all font-black uppercase h-10"
                        >
                            {saving ? "Menyimpan..." : "Tambah Tipe Proses"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
