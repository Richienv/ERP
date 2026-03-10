"use client"

import { useState } from "react"
import { useProcessStations } from "@/hooks/use-process-stations"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import {
    Cog, Plus, CheckCircle2, XCircle, Palette, Check, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import {
    Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { ICON_OPTIONS, COLOR_THEMES, STATION_TYPE_DEFAULTS, getIconByName, getColorTheme } from "@/components/manufacturing/bom/station-config"

const STATION_TYPE_CONFIG: { type: string; label: string; defaultIcon: string; defaultColor: string }[] = [
    { type: "CUTTING", label: "Potong", defaultIcon: "Scissors", defaultColor: "red" },
    { type: "SEWING", label: "Jahit", defaultIcon: "Shirt", defaultColor: "blue" },
    { type: "WASHING", label: "Cuci", defaultIcon: "Droplets", defaultColor: "cyan" },
    { type: "PRINTING", label: "Sablon", defaultIcon: "Printer", defaultColor: "purple" },
    { type: "EMBROIDERY", label: "Bordir", defaultIcon: "Sparkles", defaultColor: "pink" },
    { type: "QC", label: "Quality Control", defaultIcon: "ShieldCheck", defaultColor: "green" },
    { type: "PACKING", label: "Packing", defaultIcon: "Package", defaultColor: "amber" },
    { type: "FINISHING", label: "Finishing", defaultIcon: "Wrench", defaultColor: "zinc" },
]

export default function ProcessesPage() {
    const { data: stations, isLoading } = useProcessStations({ includeInactive: true })
    const queryClient = useQueryClient()

    const [dialogOpen, setDialogOpen] = useState(false)
    const [formLabel, setFormLabel] = useState("")
    const [saving, setSaving] = useState(false)
    const [editingType, setEditingType] = useState<string | null>(null)
    const [savingAppearance, setSavingAppearance] = useState(false)

    // Count stations per type + detect custom icon/color overrides
    const inHouseStations = (stations || []).filter((s: any) => s.operationType !== "SUBCONTRACTOR")
    const countByType: Record<string, { total: number; active: number }> = {}
    const overridesByType: Record<string, { iconName?: string; colorTheme?: string }> = {}
    for (const s of inHouseStations) {
        const type = s.stationType || "OTHER"
        if (!countByType[type]) countByType[type] = { total: 0, active: 0 }
        countByType[type].total++
        if (s.isActive !== false) countByType[type].active++
        // Pick up the first non-null override per type
        if (s.iconName && !overridesByType[type]?.iconName) {
            overridesByType[type] = { ...overridesByType[type], iconName: s.iconName }
        }
        if (s.colorTheme && !overridesByType[type]?.colorTheme) {
            overridesByType[type] = { ...overridesByType[type], colorTheme: s.colorTheme }
        }
    }

    // Custom OTHER types (from description field)
    const otherStations = inHouseStations.filter((s: any) => s.stationType === "OTHER")
    const customLabels = [...new Set(otherStations.map((s: any) => s.description).filter(Boolean))]

    // Resolve icon + color for a type (override > default)
    function resolveIconColor(type: string, description?: string) {
        // For OTHER types, check per-description override
        if (type === "OTHER" && description) {
            const match = otherStations.find((s: any) => s.description === description && (s.iconName || s.colorTheme))
            const iconName = match?.iconName || "Cog"
            const colorKey = match?.colorTheme || "zinc"
            return { icon: getIconByName(iconName), iconName, colorKey }
        }
        const override = overridesByType[type]
        const defaults = STATION_TYPE_DEFAULTS[type]
        const iconName = override?.iconName || defaults?.icon?.name || STATION_TYPE_CONFIG.find(c => c.type === type)?.defaultIcon || "Cog"
        const colorKey = override?.colorTheme || defaults?.colorKey || "zinc"
        return { icon: getIconByName(iconName), iconName, colorKey }
    }

    // Build combined list: fixed types + custom OTHER types
    const allTypes = [
        ...STATION_TYPE_CONFIG.map((cfg) => {
            const resolved = resolveIconColor(cfg.type)
            const theme = getColorTheme(resolved.colorKey)
            return {
                type: cfg.type,
                label: cfg.label,
                icon: resolved.icon,
                iconName: resolved.iconName,
                colorKey: resolved.colorKey,
                bg: theme.toolbar.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("border-")).join(" "),
                stationCount: countByType[cfg.type]?.total || 0,
                activeCount: countByType[cfg.type]?.active || 0,
                isCustom: false,
                description: undefined as string | undefined,
            }
        }),
        ...customLabels.map((label) => {
            const matching = otherStations.filter((s: any) => s.description === label)
            const resolved = resolveIconColor("OTHER", label as string)
            const theme = getColorTheme(resolved.colorKey)
            return {
                type: "OTHER",
                label: label as string,
                icon: resolved.icon,
                iconName: resolved.iconName,
                colorKey: resolved.colorKey,
                bg: theme.toolbar.split(" ").filter(c => c.startsWith("bg-") || c.startsWith("border-")).join(" "),
                stationCount: matching.length,
                activeCount: matching.filter((s: any) => s.isActive !== false).length,
                isCustom: true,
                description: label as string,
            }
        }),
    ]

    // Handle icon/color save
    const handleSaveAppearance = async (stationType: string, iconName: string, colorTheme: string, description?: string) => {
        setSavingAppearance(true)
        try {
            const res = await fetch("/api/manufacturing/process-stations", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stationType, iconName, colorTheme, description }),
            })
            const result = await res.json()
            if (result.success) {
                toast.success(`Tampilan berhasil diperbarui (${result.updated} stasiun)`)
                await queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                setEditingType(null)
            } else {
                toast.error(result.error || "Gagal memperbarui tampilan")
            }
        } catch (err) {
            console.error("Save appearance error:", err)
            toast.error("Gagal memperbarui tampilan")
        } finally {
            setSavingAppearance(false)
        }
    }

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
                        Tipe proses yang tersedia di BOM Canvas — klik kartu untuk ubah ikon & warna — tambah work center di halaman{" "}
                        <Link href="/manufacturing/work-centers" className="underline text-black hover:text-zinc-600 transition-colors">
                            Work Center
                        </Link>
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
                    const editKey = item.isCustom ? `OTHER:${item.description}` : item.type
                    return (
                        <Popover key={`${item.type}-${item.label}-${i}`} open={editingType === editKey} onOpenChange={(open) => { if (!savingAppearance) setEditingType(open ? editKey : null) }}>
                            <PopoverTrigger asChild>
                                <button
                                    className={cn(
                                        "border-2 border-black bg-white shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all overflow-hidden text-left cursor-pointer",
                                    )}
                                >
                                    {/* Card Header */}
                                    <div className={cn("flex items-center gap-3 px-4 py-3 border-b-2 border-black", item.bg)}>
                                        <div className="bg-black text-white p-2 relative">
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
                                        <Palette className="h-4 w-4 text-zinc-300" />
                                    </div>

                                    {/* Card Body */}
                                    <div className="px-4 py-3 space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                Work Center
                                            </span>
                                            <span className="text-sm font-black">
                                                {item.stationCount}
                                            </span>
                                        </div>
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
                                                    Belum ada work center
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                className="w-72 p-0 border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                                align="start"
                                sideOffset={8}
                            >
                                <AppearanceEditor
                                    currentIcon={item.iconName}
                                    currentColor={item.colorKey}
                                    saving={savingAppearance}
                                    onSave={(iconName, colorKey) => {
                                        handleSaveAppearance(item.type, iconName, colorKey, item.description)
                                    }}
                                />
                            </PopoverContent>
                        </Popover>
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
                                placeholder="Nama..."
                                className="border-2 border-black rounded-none h-10 font-bold placeholder:text-zinc-300 placeholder:font-normal"
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

// ── Inline appearance editor (icon + color picker) ──
function AppearanceEditor({
    currentIcon,
    currentColor,
    saving,
    onSave,
}: {
    currentIcon: string
    currentColor: string
    saving?: boolean
    onSave: (iconName: string, colorKey: string) => void
}) {
    const [selectedIcon, setSelectedIcon] = useState(currentIcon)
    const [selectedColor, setSelectedColor] = useState(currentColor)

    const PreviewIcon = getIconByName(selectedIcon)
    const previewTheme = getColorTheme(selectedColor)

    return (
        <div>
            {/* Preview */}
            <div className={cn("px-4 py-3 border-b-2 border-black flex items-center gap-3", previewTheme.toolbar.split(" ").filter(c => c.startsWith("bg-")).join(" "))}>
                <div className="bg-black text-white p-2">
                    <PreviewIcon className="h-5 w-5" />
                </div>
                <span className="text-xs font-black uppercase">Preview</span>
            </div>

            {/* Color picker */}
            <div className="px-4 py-3 border-b border-zinc-200">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Warna</p>
                <div className="grid grid-cols-6 gap-1.5">
                    {Object.entries(COLOR_THEMES).map(([key, theme]) => (
                        <button
                            key={key}
                            onClick={() => setSelectedColor(key)}
                            className={cn(
                                "w-8 h-8 border-2 flex items-center justify-center transition-all",
                                selectedColor === key ? "border-black scale-110 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "border-zinc-200 hover:border-zinc-400",
                            )}
                            style={{ backgroundColor: theme.hex.bg }}
                            title={key}
                        >
                            {selectedColor === key && <Check className="h-3 w-3" style={{ color: theme.hex.text }} />}
                        </button>
                    ))}
                </div>
            </div>

            {/* Icon picker */}
            <div className="px-4 py-3 border-b border-zinc-200">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">Ikon</p>
                <div className="grid grid-cols-6 gap-1.5 max-h-40 overflow-y-auto">
                    {ICON_OPTIONS.map((opt) => {
                        const OptIcon = opt.icon
                        return (
                            <button
                                key={opt.name}
                                onClick={() => setSelectedIcon(opt.name)}
                                className={cn(
                                    "w-8 h-8 border-2 flex items-center justify-center transition-all",
                                    selectedIcon === opt.name ? "border-black bg-black text-white" : "border-zinc-200 hover:border-zinc-400 text-zinc-600",
                                )}
                                title={opt.label}
                            >
                                <OptIcon className="h-4 w-4" />
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Save button */}
            <div className="px-4 py-3">
                <button
                    onClick={() => onSave(selectedIcon, selectedColor)}
                    disabled={saving}
                    className="w-full h-8 bg-black text-white text-[10px] font-black uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                    {saving ? <><Loader2 className="h-3 w-3 animate-spin" /> Menyimpan...</> : "Simpan Tampilan"}
                </button>
            </div>
        </div>
    )
}
