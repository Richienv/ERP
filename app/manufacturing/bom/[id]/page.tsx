"use client"

import { use, useState, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useProductionBOM } from "@/hooks/use-production-bom"
import { useProcessStations } from "@/hooks/use-process-stations"
import { queryKeys } from "@/lib/query-keys"
import { BOMCanvas } from "@/components/manufacturing/bom/bom-canvas"
import { MaterialPanel } from "@/components/manufacturing/bom/material-panel"
import { DetailPanel } from "@/components/manufacturing/bom/detail-panel"
import { AddMaterialDialog } from "@/components/manufacturing/bom/add-material-dialog"
import { CreateStationDialog } from "@/components/manufacturing/bom/create-station-dialog"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
// Select removed — toolbar now uses quick-add buttons
import { formatCurrency } from "@/lib/inventory-utils"
import { calcTotalMaterialCost, calcTotalLaborCost, type BOMItemWithCost } from "@/components/manufacturing/bom/bom-cost-helpers"
import { toast } from "sonner"
import {
    ArrowLeft, Save, Loader2, Plus, Zap, Package,
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, PackageIcon, Wrench, Cog,
} from "lucide-react"

const STATION_TYPE_CONFIG = [
    { type: "CUTTING", label: "Potong", icon: Scissors, color: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" },
    { type: "SEWING", label: "Jahit", icon: Shirt, color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" },
    { type: "WASHING", label: "Cuci", icon: Droplets, color: "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100" },
    { type: "PRINTING", label: "Sablon", icon: Printer, color: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100" },
    { type: "EMBROIDERY", label: "Bordir", icon: Sparkles, color: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100" },
    { type: "QC", label: "QC", icon: ShieldCheck, color: "bg-green-50 text-green-600 border-green-200 hover:bg-green-100" },
    { type: "PACKING", label: "Packing", icon: PackageIcon, color: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" },
    { type: "FINISHING", label: "Finishing", icon: Wrench, color: "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100" },
    { type: "OTHER", label: "Lainnya", icon: Cog, color: "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100" },
] as const

export const dynamic = "force-dynamic"

export default function BOMCanvasPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const queryClient = useQueryClient()
    const { data: bom, isLoading } = useProductionBOM(id)
    const { data: allStations } = useProcessStations()

    // Local canvas state (editable copy of BOM data)
    const [items, setItems] = useState<any[]>([])
    const [steps, setSteps] = useState<any[]>([])
    const [totalQty, setTotalQty] = useState(0)
    const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [generating, setGenerating] = useState(false)
    const initialized = useRef(false)

    // Dialogs
    const [addMaterialOpen, setAddMaterialOpen] = useState(false)
    const [addStationDialogOpen, setAddStationDialogOpen] = useState(false)

    // Initialize local state from fetched BOM data
    if (bom && !initialized.current) {
        initialized.current = true
        setItems(bom.items || [])
        setSteps(bom.steps || [])
        setTotalQty(bom.totalProductionQty || 0)
    }

    const selectedStep = steps.find((s) => s.id === selectedStepId) || null

    const costSummary = useMemo(() => {
        const totalMaterial = calcTotalMaterialCost(items as BOMItemWithCost[], totalQty)
        const totalLabor = calcTotalLaborCost(steps, totalQty)
        const grandTotal = totalMaterial + totalLabor
        const perUnit = totalQty > 0 ? grandTotal / totalQty : 0
        const totalDuration = steps.reduce((sum, s) => sum + (s.durationMinutes || 0), 0)
        return { totalMaterial, totalLabor, grandTotal, perUnit, totalDuration }
    }, [steps, items, totalQty])

    // --- MATERIAL HANDLERS ---
    const handleAddMaterial = useCallback((newItem: any) => {
        const tempId = `temp-${Date.now()}`
        setItems((prev) => [...prev, { id: tempId, ...newItem }])
    }, [])

    const handleRemoveItem = useCallback((itemId: string) => {
        setItems((prev) => prev.filter((i) => i.id !== itemId))
        // Also remove from all steps
        setSteps((prev) => prev.map((step) => ({
            ...step,
            materials: (step.materials || []).filter((m: any) => m.bomItemId !== itemId),
        })))
    }, [])

    // --- STEP HANDLERS ---
    const handleAddStationToCanvas = useCallback((stationId: string) => {
        const station = (allStations || []).find((s: any) => s.id === stationId)
        if (!station) return

        const tempId = `step-${Date.now()}`
        const newSequence = steps.length + 1

        setSteps((prev) => [...prev, {
            id: tempId,
            stationId: station.id,
            station,
            sequence: newSequence,
            durationMinutes: null,
            notes: null,
            materials: [],
            allocations: [],
            attachments: [],
        }])
    }, [allStations, steps.length])

    // Quick-add station by type: finds existing station or auto-creates one
    const [creatingStationType, setCreatingStationType] = useState<string | null>(null)
    const handleQuickAddByType = useCallback(async (stationType: string) => {
        // Find an existing station of this type
        const existing = (allStations || []).find((s: any) => s.stationType === stationType)
        if (existing) {
            handleAddStationToCanvas(existing.id)
            return
        }

        // Auto-create a default station of this type
        setCreatingStationType(stationType)
        const config = STATION_TYPE_CONFIG.find((c) => c.type === stationType)
        const label = config?.label || stationType
        const code = `STN-${stationType.substring(0, 3)}-${String(Date.now()).slice(-4)}`
        try {
            const res = await fetch("/api/manufacturing/process-stations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code,
                    name: label,
                    stationType,
                    operationType: "IN_HOUSE",
                    costPerUnit: 0,
                }),
            })
            const result = await res.json()
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                // Add to canvas immediately
                const station = result.data
                const tempId = `step-${Date.now()}`
                setSteps((prev) => [...prev, {
                    id: tempId,
                    stationId: station.id,
                    station,
                    sequence: prev.length + 1,
                    durationMinutes: null,
                    notes: null,
                    materials: [],
                    allocations: [],
                    attachments: [],
                }])
                toast.success(`Stasiun "${label}" dibuat & ditambahkan`)
            } else {
                toast.error(result.error || "Gagal membuat stasiun")
            }
        } catch {
            toast.error("Gagal membuat stasiun")
        } finally {
            setCreatingStationType(null)
        }
    }, [allStations, handleAddStationToCanvas, queryClient])

    const handleRemoveStep = useCallback((stepId: string) => {
        setSteps((prev) => {
            const filtered = prev.filter((s) => s.id !== stepId)
            // Re-sequence
            return filtered.map((s, i) => ({ ...s, sequence: i + 1 }))
        })
        if (selectedStepId === stepId) setSelectedStepId(null)
    }, [selectedStepId])

    const handleDropMaterial = useCallback((stepId: string, bomItemId: string) => {
        setSteps((prev) => prev.map((step) => {
            if (step.id !== stepId) return step
            // Check if already assigned
            if ((step.materials || []).some((m: any) => m.bomItemId === bomItemId)) return step

            const item = items.find((i) => i.id === bomItemId)
            return {
                ...step,
                materials: [...(step.materials || []), {
                    id: `sm-${Date.now()}`,
                    bomItemId,
                    bomItem: item ? { material: item.material } : { material: { name: "Unknown" } },
                }],
            }
        }))
    }, [items])

    const handleRemoveMaterial = useCallback((stepId: string, bomItemId: string) => {
        setSteps((prev) => prev.map((step) => {
            if (step.id !== stepId) return step
            return {
                ...step,
                materials: (step.materials || []).filter((m: any) => m.bomItemId !== bomItemId),
            }
        }))
    }, [])

    const handleUpdateStep = useCallback((field: string, value: any) => {
        if (!selectedStepId) return
        setSteps((prev) => prev.map((step) =>
            step.id === selectedStepId ? { ...step, [field]: value } : step
        ))
    }, [selectedStepId])

    const handleUpdateAllocations = useCallback((allocations: any[]) => {
        if (!selectedStepId) return
        setSteps((prev) => prev.map((step) =>
            step.id === selectedStepId ? { ...step, allocations } : step
        ))
    }, [selectedStepId])

    const handleToggleSubkon = useCallback((useSubkon: boolean) => {
        if (!selectedStepId) return
        setSteps((prev) => prev.map((step) =>
            step.id === selectedStepId
                ? { ...step, useSubkon, allocations: useSubkon ? (step.allocations || []) : [] }
                : step
        ))
    }, [selectedStepId])

    // --- DAG EDGE HANDLERS ---
    const handleConnectSteps = useCallback((sourceId: string, targetId: string) => {
        setSteps(prev => prev.map(step =>
            step.id === targetId
                ? { ...step, parentStepIds: [...new Set([...(step.parentStepIds || []), sourceId])] }
                : step
        ))
    }, [])

    const handleDisconnectSteps = useCallback((sourceId: string, targetId: string) => {
        setSteps(prev => prev.map(step =>
            step.id === targetId
                ? { ...step, parentStepIds: (step.parentStepIds || []).filter((id: string) => id !== sourceId) }
                : step
        ))
    }, [])

    // --- ATTACHMENT HANDLERS ---
    const handleUploadAttachment = useCallback(async () => {
        if (!selectedStepId) return

        const input = document.createElement("input")
        input.type = "file"
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0]
            if (!file) return

            const formData = new FormData()
            formData.append("file", file)
            formData.append("stepId", selectedStepId)

            try {
                const res = await fetch(`/api/manufacturing/production-bom/${id}/attachments`, {
                    method: "POST",
                    body: formData,
                })
                const result = await res.json()
                if (result.success) {
                    toast.success(`File ${file.name} berhasil diupload`)
                    // Add to local state
                    setSteps((prev) => prev.map((step) =>
                        step.id === selectedStepId
                            ? { ...step, attachments: [...(step.attachments || []), result.data] }
                            : step
                    ))
                } else {
                    toast.error(result.error || "Upload gagal")
                }
            } catch {
                toast.error("Upload gagal")
            }
        }
        input.click()
    }, [selectedStepId, id])

    const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
        try {
            const res = await fetch(`/api/manufacturing/production-bom-attachments/${attachmentId}`, { method: "DELETE" })
            const result = await res.json()
            if (result.success) {
                setSteps((prev) => prev.map((step) => ({
                    ...step,
                    attachments: (step.attachments || []).filter((a: any) => a.id !== attachmentId),
                })))
                toast.success("Lampiran dihapus")
            }
        } catch {
            toast.error("Gagal menghapus lampiran")
        }
    }, [])

    // --- SAVE (returns success boolean so generateSPK can chain) ---
    const doSave = async (): Promise<boolean> => {
        const payload = {
            totalProductionQty: totalQty,
            items: items.map((item) => ({
                materialId: item.materialId || item.material?.id,
                quantityPerUnit: Number(item.quantityPerUnit),
                unit: item.unit || item.material?.unit || null,
                wastePct: Number(item.wastePct || 0),
                notes: item.notes || null,
            })),
            steps: steps.map((step) => ({
                id: step.id, // Used for parentStepIds mapping on server
                stationId: step.stationId || step.station?.id,
                sequence: step.sequence,
                durationMinutes: step.durationMinutes || null,
                notes: step.notes || null,
                parentStepIds: step.parentStepIds || [],
                materialProductIds: (step.materials || []).map((m: any) => {
                    const item = items.find((i) => i.id === m.bomItemId)
                    return item?.materialId || item?.material?.id
                }).filter(Boolean),
                allocations: (step.allocations || []).map((a: any) => ({
                    stationId: a.stationId || a.station?.id,
                    quantity: a.quantity,
                    notes: a.notes || null,
                })),
            })),
        }

        const res = await fetch(`/api/manufacturing/production-bom/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        })
        const result = await res.json()

        if (result.success) {
            queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.detail(id) })
            initialized.current = false
            return true
        } else {
            toast.error(result.error || "Gagal menyimpan")
            return false
        }
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            const ok = await doSave()
            if (ok) toast.success("BOM berhasil disimpan")
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setSaving(false)
        }
    }

    // --- GENERATE SPK (auto-saves first) ---
    const handleGenerateSPK = async () => {
        setGenerating(true)
        try {
            // Save first so DB has latest totalQty, steps, materials
            const saved = await doSave()
            if (!saved) {
                toast.error("Gagal menyimpan BOM sebelum generate SPK")
                return
            }

            const res = await fetch(`/api/manufacturing/production-bom/${id}/generate-spk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
            const result = await res.json()

            if (result.success) {
                toast.success(result.message || `${result.data?.length} SPK berhasil dibuat`)
                queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all })
                queryClient.invalidateQueries({ queryKey: queryKeys.spkOrders.all })
            } else {
                toast.error(result.error || "Gagal membuat SPK")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setGenerating(false)
        }
    }

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-orange-400" />
    }

    if (!bom) {
        return <div className="p-10 text-center font-bold text-zinc-400">BOM tidak ditemukan</div>
    }

    return (
        <div className="flex flex-col overflow-hidden -mx-4 -mb-4 h-[calc(100svh-4rem)]">
            {/* TOOLBAR — Row 1: Product info + actions */}
            <div className="border-b-2 border-black bg-white px-3 lg:px-4 py-1.5 flex items-center justify-between shrink-0 gap-2">
                <div className="flex items-center gap-2 lg:gap-4 min-w-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/manufacturing/bom")}
                        className="h-8 rounded-none font-bold shrink-0"
                    >
                        <ArrowLeft className="mr-1 h-4 w-4" /> Kembali
                    </Button>
                    <div className="border-l-2 border-zinc-200 pl-2 lg:pl-4 min-w-0">
                        <div className="flex items-center gap-2">
                            <Package className="h-4 w-4 text-orange-500 shrink-0" />
                            <span className="font-black text-sm uppercase truncate">{bom.product?.name}</span>
                            <span className="bg-black text-white text-[9px] font-black px-2 py-0.5 shrink-0">{bom.version}</span>
                        </div>
                        <p className="text-[10px] font-mono text-zinc-400 truncate">{bom.product?.code}</p>
                    </div>
                    <div className="border-l-2 border-zinc-200 pl-2 lg:pl-4 flex items-center gap-2 shrink-0">
                        <label className="text-[9px] font-black uppercase text-zinc-400">Target:</label>
                        <Input
                            type="number"
                            value={totalQty}
                            onChange={(e) => setTotalQty(parseInt(e.target.value) || 0)}
                            className="h-7 w-20 text-xs font-mono border-zinc-200 rounded-none"
                        />
                        <span className="text-[10px] font-bold text-zinc-400">pcs</span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddStationDialogOpen(true)}
                        className="h-8 font-bold text-[10px] uppercase border-2 border-black rounded-none"
                    >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Stasiun Kustom
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateSPK}
                        disabled={generating || steps.length === 0}
                        className="h-8 font-black text-[10px] uppercase border-2 border-orange-500 text-orange-600 rounded-none hover:bg-orange-50"
                    >
                        {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1 h-3.5 w-3.5" />}
                        Generate SPK
                    </Button>

                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="h-8 bg-black text-white font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[1px] hover:shadow-none rounded-none px-6"
                    >
                        {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                        Simpan
                    </Button>
                </div>
            </div>

            {/* TOOLBAR — Row 2: Work Center Type Quick-Add Buttons */}
            <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-1 flex items-center gap-1.5 shrink-0 overflow-x-auto">
                <span className="text-[9px] font-black uppercase text-zinc-400 mr-1 shrink-0">Tambah Proses:</span>
                {STATION_TYPE_CONFIG.map((cfg) => {
                    const Icon = cfg.icon
                    const isCreating = creatingStationType === cfg.type
                    return (
                        <Button
                            key={cfg.type}
                            variant="outline"
                            size="sm"
                            disabled={isCreating}
                            onClick={() => handleQuickAddByType(cfg.type)}
                            className={`h-7 text-[10px] font-bold border rounded-none shrink-0 px-2.5 gap-1 ${cfg.color}`}
                        >
                            {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                            {cfg.label}
                        </Button>
                    )
                })}
            </div>

            {/* TOOLBAR — Row 3: Cost Summary Strip */}
            <div className="border-b border-zinc-200 bg-white px-4 py-1.5 flex items-center gap-3 lg:gap-6 shrink-0 overflow-x-auto">
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Material:</span>
                    <span className="text-xs font-bold text-black">{formatCurrency(costSummary.totalMaterial)}</span>
                </div>
                <div className="border-l border-zinc-200 pl-3 lg:pl-6 flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Labor:</span>
                    <span className="text-xs font-bold text-black">{formatCurrency(costSummary.totalLabor)}</span>
                </div>
                <div className="border-l border-zinc-200 pl-3 lg:pl-6 flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-black uppercase text-zinc-400">HPP/Unit:</span>
                    <span className="text-xs font-bold text-black">{formatCurrency(costSummary.perUnit)}</span>
                </div>
                <div className="border-l border-zinc-200 pl-3 lg:pl-6 flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Estimasi:</span>
                    <span className="text-xs font-bold text-blue-600">
                        {costSummary.totalDuration > 0 ? `${costSummary.totalDuration} min` : "—"}
                    </span>
                </div>
                <div className="border-l-2 border-black pl-3 lg:pl-6 flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Total ({totalQty} pcs):</span>
                    <span className="text-sm font-black text-emerald-700">{formatCurrency(costSummary.grandTotal)}</span>
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Material Panel */}
                <MaterialPanel
                    items={items}
                    steps={steps}
                    onAddItem={() => setAddMaterialOpen(true)}
                    onRemoveItem={handleRemoveItem}
                />

                {/* Center: Canvas */}
                <div className="flex-1 flex flex-col">
                    <BOMCanvas
                        steps={steps}
                        items={items}
                        onStepSelect={setSelectedStepId}
                        onDropMaterial={handleDropMaterial}
                        onRemoveMaterial={handleRemoveMaterial}
                        onRemoveStep={handleRemoveStep}
                        selectedStepId={selectedStepId}
                        onConnectSteps={handleConnectSteps}
                        onDisconnectSteps={handleDisconnectSteps}
                    />

                    {/* Bottom: Detail Panel */}
                    {selectedStep && (
                        <DetailPanel
                            step={selectedStep}
                            totalQty={totalQty}
                            allItems={items}
                            onUpdateStep={handleUpdateStep}
                            onUpdateAllocations={handleUpdateAllocations}
                            onUploadAttachment={handleUploadAttachment}
                            onDeleteAttachment={handleDeleteAttachment}
                            onToggleSubkon={handleToggleSubkon}
                        />
                    )}
                </div>
            </div>

            {/* Footer */}
            <div className="border-t-2 border-black bg-zinc-50 px-6 py-1.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6 text-[10px] font-bold text-zinc-500">
                    <span>Material: <span className="text-black">{items.length}</span></span>
                    <span>Proses: <span className="text-black">{steps.length}</span></span>
                    <span>Target: <span className="text-black">{totalQty} pcs</span></span>
                </div>
            </div>

            {/* Dialogs */}
            <AddMaterialDialog
                open={addMaterialOpen}
                onOpenChange={setAddMaterialOpen}
                existingMaterialIds={items.map((i) => i.materialId || i.material?.id).filter(Boolean)}
                onAdd={handleAddMaterial}
            />

            <CreateStationDialog
                open={addStationDialogOpen}
                onOpenChange={setAddStationDialogOpen}
                onCreated={(station) => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                    handleAddStationToCanvas(station.id)
                }}
            />
        </div>
    )
}
