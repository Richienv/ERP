"use client"

import { use, useState, useCallback, useRef, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useProductionBOM } from "@/hooks/use-production-bom"
import { useProcessStations } from "@/hooks/use-process-stations"
import { queryKeys } from "@/lib/query-keys"
import { BOMCanvas } from "@/components/manufacturing/bom/bom-canvas"
import { calcAllStepTargets, calcStepTarget } from "@/components/manufacturing/bom/bom-step-helpers"
import { NodeContextMenu } from "@/components/manufacturing/bom/node-context-menu"
import { MaterialPanel } from "@/components/manufacturing/bom/material-panel"
import { DetailPanel } from "@/components/manufacturing/bom/detail-panel"
import { TimelineView } from "@/components/manufacturing/bom/timeline-view"
import { EditHistoryDrawer } from "@/components/manufacturing/bom/edit-history-drawer"
import { AddMaterialDialog } from "@/components/manufacturing/bom/add-material-dialog"
import { CreateStationDialog } from "@/components/manufacturing/bom/create-station-dialog"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatCurrency } from "@/lib/inventory-utils"
import { calcTotalMaterialCost, calcTotalLaborCost, calcTotalOverheadCost, type BOMItemWithCost } from "@/components/manufacturing/bom/bom-cost-helpers"
import { calcCriticalPathDuration } from "@/components/manufacturing/bom/bom-step-helpers"
import { toast } from "sonner"
import {
    ArrowLeft, Save, Loader2, Plus, Zap, Package, RotateCcw,
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, PackageIcon, Wrench, Cog, FileDown,
    Clock, Copy, LayoutTemplate, History, GitBranch, CheckCircle2, ChevronDown, Calculator,
} from "lucide-react"
import { BOMCostCard } from "@/components/manufacturing/bom/bom-cost-card"
import { getIconByName, getColorTheme } from "@/components/manufacturing/bom/station-config"
import { BOMCanvasProvider, useBOMCanvas } from "./bom-canvas-context"
import { useAutoSave, isDraftNewer } from "./hooks/use-auto-save"
import { usePriceDrift } from "./hooks/use-price-drift"
import { useCriticalPath } from "./hooks/use-critical-path"
import { TemplateManagerDialog } from "@/components/manufacturing/bom/template-manager-dialog"

const STATION_TYPE_CONFIG = [
    { type: "CUTTING", label: "Potong", icon: Scissors, color: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100" },
    { type: "SEWING", label: "Jahit", icon: Shirt, color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100" },
    { type: "WASHING", label: "Cuci", icon: Droplets, color: "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100" },
    { type: "PRINTING", label: "Sablon", icon: Printer, color: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100" },
    { type: "EMBROIDERY", label: "Bordir", icon: Sparkles, color: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100" },
    { type: "QC", label: "QC", icon: ShieldCheck, color: "bg-green-50 text-green-600 border-green-200 hover:bg-green-100" },
    { type: "PACKING", label: "Packing", icon: PackageIcon, color: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" },
    { type: "FINISHING", label: "Finishing", icon: Wrench, color: "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100" },
] as const

const PROCESS_TEMPLATES = [
    { label: "Garmen Lengkap", types: ["CUTTING", "SEWING", "QC", "PACKING"] },
    { label: "CMT", types: ["CUTTING", "SEWING", "FINISHING"] },
    { label: "Sablon + Jahit", types: ["PRINTING", "SEWING", "QC", "PACKING"] },
] as const

export const dynamic = "force-dynamic"

export default function BOMCanvasPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    return (
        <BOMCanvasProvider bomId={id}>
            <BOMCanvasPageInner id={id} />
        </BOMCanvasProvider>
    )
}

function BOMCanvasPageInner({ id }: { id: string }) {
    const router = useRouter()
    const queryClient = useQueryClient()
    // Canvas state from context
    const {
        items, steps, totalQty, isDirty, selectedStepId, viewMode,
        hasSPK, setHasSPK,
        setItems: ctxSetItems, setSteps: ctxSetSteps, setTotalQty: ctxSetTotalQty,
        setSelectedStepId, setViewMode, setDirty,
        initFromServer,
    } = useBOMCanvas()

    const { data: bom, isLoading } = useProductionBOM(id, { refetchInterval: hasSPK ? 60_000 : false })
    const { data: allStations } = useProcessStations()

    // Keep refs to current items/steps for use inside async doSave callback
    const itemsRef = useRef(items)
    const stepsRef = useRef(steps)
    itemsRef.current = items
    stepsRef.current = steps

    const initialized = useRef(false)

    const [saving, setSaving] = useState(false)
    const [savingAs, setSavingAs] = useState(false)
    const [generating, setGenerating] = useState(false)
    const [spkProgress, setSpkProgress] = useState<string | null>(null)
    const [spkResult, setSpkResult] = useState<{ workOrders: any[]; bomId: string } | null>(null)

    // Dialogs
    const [addMaterialOpen, setAddMaterialOpen] = useState(false)
    const [addStationDialogOpen, setAddStationDialogOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)

    // Cost breakdown panel
    const [costCardOpen, setCostCardOpen] = useState(false)

    // Context menu
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; stepId: string } | null>(null)

    // Draft restore banner
    const [hasDraft, setHasDraft] = useState(false)

    // Price drift detection
    const driftedItems = usePriceDrift(items)

    // Critical path
    const criticalStepIds = useCriticalPath(steps)

    // Auto-save hook
    const { loadLocalDraft, clearLocalDraft } = useAutoSave({ bomId: id, items, steps, totalQty, isDirty })

    // Check for recoverable draft on first load
    useEffect(() => {
        if (!bom?.updatedAt) return
        const draft = loadLocalDraft()
        if (draft && isDraftNewer(draft.savedAt, new Date(bom.updatedAt))) {
            setHasDraft(true)
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bom?.updatedAt])

    // Initialize local state from fetched BOM data
    if (bom && !initialized.current) {
        initialized.current = true
        initFromServer({
            product: bom.product,
            items: bom.items || [],
            steps: bom.steps || [],
            totalProductionQty: bom.totalProductionQty || 0,
        })
    }

    // Dirty-tracking wrappers — use context's setters (they mark dirty automatically)
    const dirtySetItems = useCallback((v: any) => {
        if (typeof v === "function") {
            ctxSetItems(v(itemsRef.current))
        } else {
            ctxSetItems(v)
        }
    }, [ctxSetItems])

    const dirtySetSteps = useCallback((v: any) => {
        if (typeof v === "function") {
            ctxSetSteps(v(stepsRef.current))
        } else {
            ctxSetSteps(v)
        }
    }, [ctxSetSteps])

    const dirtySetTotalQty = useCallback((v: number) => {
        ctxSetTotalQty(v)
    }, [ctxSetTotalQty])

    const selectedStep = steps.find((s) => s.id === selectedStepId) || null

    const costSummary = useMemo(() => {
        const totalMaterial = calcTotalMaterialCost(items as BOMItemWithCost[], totalQty)
        const totalLabor = calcTotalLaborCost(steps as any[], totalQty)
        const totalOverhead = calcTotalOverheadCost(steps as any[], totalQty)
        const grandTotal = totalMaterial + totalLabor + totalOverhead
        const perUnit = totalQty > 0 ? grandTotal / totalQty : 0
        const durationPerPiece = calcCriticalPathDuration(steps)
        const totalDuration = durationPerPiece
        // Time estimates — durationPerPiece is per-piece along critical path, multiply by totalQty for total
        const estTimeTotalMin = durationPerPiece * totalQty
        const estTimeHours = Math.floor(estTimeTotalMin / 60)
        const estTimeMinutes = Math.round(estTimeTotalMin % 60)
        const estTimeLabel = estTimeTotalMin > 0
            ? `${estTimeHours > 0 ? `${estTimeHours} jam ` : ""}${estTimeMinutes} menit`
            : null
        // Progress — per step, using step-specific targets
        // Compute step targets
        const stepTargets = calcAllStepTargets(steps, totalQty)
        // Group by stationType, sum progress per group capped at 100%
        const actionGroups: Record<string, any[]> = {}
        for (const s of steps) {
            const type = s.station?.stationType || "OTHER"
            if (!actionGroups[type]) actionGroups[type] = []
            actionGroups[type].push(s)
        }
        const actionTypes = Object.keys(actionGroups)
        let progressPct = 0
        if (actionTypes.length > 0 && totalQty > 0) {
            let totalActionProgress = 0
            for (const type of actionTypes) {
                const group = actionGroups[type]
                const groupTarget = group.reduce((sum: number, s: any) => sum + (stepTargets.get(s.id) || 0), 0)
                const groupCompleted = group.reduce((sum: number, s: any) => sum + (s.completedQty || 0), 0)
                totalActionProgress += groupTarget > 0 ? Math.min(1, groupCompleted / groupTarget) : 0
            }
            progressPct = Math.round((totalActionProgress / actionTypes.length) * 100)
        }
        return { totalMaterial, totalLabor, totalOverhead, grandTotal, perUnit, totalDuration, durationPerPiece, estTimeLabel, progressPct }
    }, [steps, items, totalQty])

    // --- SPK READINESS CHECK ---
    const NON_MATERIAL_TYPES = ['QC', 'PACKING']
    const spkReadiness = useMemo(() => {
        const issues: string[] = []
        if (totalQty <= 0) issues.push("Target produksi harus > 0")
        if (steps.length === 0) issues.push("Belum ada langkah proses")
        const emptySteps = steps.filter(s => {
            const stationType = s.station?.stationType || ''
            return (s.materials || []).length === 0 && !NON_MATERIAL_TYPES.includes(stationType)
        })
        if (emptySteps.length > 0) {
            issues.push(`${emptySteps.length} proses belum ada material: ${emptySteps.map(s => s.station?.name || `Step ${s.sequence}`).join(', ')}`)
        }
        // Duration required for all steps
        const noDurationSteps = steps.filter(s => !s.durationMinutes || s.durationMinutes <= 0)
        if (noDurationSteps.length > 0) {
            issues.push(`${noDurationSteps.length} proses belum ada durasi: ${noDurationSteps.map(s => s.station?.name || `Step ${s.sequence}`).join(', ')}`)
        }
        // Validate work center group assignment for in-house steps
        const unassignedWC = steps.filter(s => {
            const isStepSubkon = s.useSubkon ?? s.station?.operationType === 'SUBCONTRACTOR'
            return !isStepSubkon && !s.station?.group && !(s.station as any)?.groupId
        })
        if (unassignedWC.length > 0) {
            issues.push(`${unassignedWC.length} proses belum di-assign ke work center: ${unassignedWC.map(s => s.station?.name || `Step ${s.sequence}`).join(', ')}`)
        }
        // Validate allocations for both subkon and in-house steps
        for (const s of steps) {
            const isStepSubkon = s.useSubkon ?? s.station?.operationType === 'SUBCONTRACTOR'
            const allocs = s.allocations || []
            if (isStepSubkon) {
                // Subkon steps MUST have allocations
                if (allocs.length === 0) {
                    issues.push(`${s.station?.name}: belum ada alokasi subkon`)
                } else {
                    const allocTotal = allocs.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0)
                    if (allocTotal !== totalQty) {
                        issues.push(`${s.station?.name}: alokasi subkon ${allocTotal}/${totalQty} pcs (kurang ${totalQty - allocTotal})`)
                    }
                }
            } else if (allocs.length > 0) {
                // In-house steps with allocations must also total correctly
                const allocTotal = allocs.reduce((sum: number, a: any) => sum + (a.quantity || 0), 0)
                if (allocTotal !== totalQty) {
                    issues.push(`${s.station?.name}: alokasi in-house ${allocTotal}/${totalQty} pcs (kurang ${totalQty - allocTotal})`)
                }
            }
        }
        return { ready: issues.length === 0, issues }
    }, [steps, totalQty])

    // --- MATERIAL HANDLERS ---
    const handleAddMaterial = useCallback((newItem: any) => {
        const tempId = `temp-${Date.now()}`
        dirtySetItems((prev: any[]) => [...prev, { id: tempId, ...newItem }])
    }, [dirtySetItems])

    const handleRemoveItem = useCallback((itemId: string) => {
        dirtySetItems((prev: any[]) => prev.filter((i: any) => i.id !== itemId))
        // Also remove from all steps
        dirtySetSteps((prev: any[]) => prev.map((step: any) => ({
            ...step,
            materials: (step.materials || []).filter((m: any) => m.bomItemId !== itemId),
        })))
    }, [dirtySetItems, dirtySetSteps])

    // --- STEP HANDLERS ---
    const handleAddStationToCanvas = useCallback((stationId: string) => {
        const station = (allStations || []).find((s: any) => s.id === stationId)
        if (!station) return

        const tempId = `step-${Date.now()}`
        const newSequence = steps.length + 1

        dirtySetSteps((prev: any[]) => {
            const lastStep = prev[prev.length - 1]
            return [...prev, {
                id: tempId,
                stationId: station.id,
                station,
                sequence: newSequence,
                durationMinutes: null,
                notes: null,
                parentStepIds: lastStep ? [lastStep.id] : [],
                materials: [],
                allocations: [],
                attachments: [],
            }]
        })
    }, [allStations, steps.length, dirtySetSteps])

    // Quick-add station by type: if >1 station of same type exists, show picker
    const [creatingStationType, setCreatingStationType] = useState<string | null>(null)
    const [stationPickerType, setStationPickerType] = useState<string | null>(null)

    // Build dynamic process types: fixed types + custom OTHER types from allStations
    const dynamicProcessTypes = useMemo(() => {
        const fixed = [...STATION_TYPE_CONFIG].map(cfg => {
            // Check if any station of this type has a custom icon/color override
            const repStation = (allStations || []).find((s: any) =>
                s.stationType === cfg.type && s.operationType !== "SUBCONTRACTOR" && (s.iconName || s.colorTheme)
            )
            return {
                ...cfg,
                icon: repStation?.iconName ? getIconByName(repStation.iconName) : cfg.icon,
                color: repStation?.colorTheme ? getColorTheme(repStation.colorTheme).toolbar : cfg.color,
                isCustom: false,
                description: null as string | null,
            }
        })

        // Find unique custom (OTHER) process types from allStations
        const otherStations = (allStations || []).filter((s: any) =>
            s.stationType === "OTHER" && s.operationType !== "SUBCONTRACTOR" && s.isActive !== false
        )
        const customDescriptions = [...new Set(otherStations.map((s: any) => s.description).filter(Boolean))] as string[]

        const custom = customDescriptions.map(desc => {
            const repStation = otherStations.find((s: any) => s.description === desc)
            const theme = getColorTheme(repStation?.colorTheme)
            const IconComp = getIconByName(repStation?.iconName)
            return {
                type: `OTHER:${desc}`,
                label: desc,
                icon: IconComp,
                color: theme.toolbar,
                isCustom: true,
                description: desc,
            }
        })

        return [...fixed, ...custom]
    }, [allStations])

    const handleQuickAddByType = useCallback(async (typeKey: string, description?: string | null) => {
        // For custom types, typeKey is "OTHER:Description" — extract actual stationType
        const isCustom = typeKey.startsWith("OTHER:")
        const stationType = isCustom ? "OTHER" : typeKey
        const customDesc = isCustom ? typeKey.substring(6) : description

        // Find all active IN_HOUSE stations of this type (+ matching description for custom)
        const candidates = (allStations || []).filter((s: any) => {
            if (s.operationType === "SUBCONTRACTOR" || s.isActive === false) return false
            if (isCustom) return s.stationType === "OTHER" && s.description === customDesc
            return s.stationType === stationType
        })

        if (candidates.length === 1) {
            handleAddStationToCanvas(candidates[0].id)
            return
        }

        if (candidates.length > 1) {
            // Multiple → show picker
            setStationPickerType(typeKey)
            return
        }

        // None exist → auto-create default station
        setCreatingStationType(typeKey)
        const config = STATION_TYPE_CONFIG.find((c) => c.type === stationType)
        const label = customDesc || config?.label || stationType
        const code = `STN-${stationType.substring(0, 3)}-${String(Date.now()).slice(-4)}`
        try {
            const res = await fetch("/api/manufacturing/process-stations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    code, name: label, stationType, operationType: "IN_HOUSE", costPerUnit: 0,
                    ...(isCustom ? { description: customDesc } : {}),
                }),
            })
            const result = await res.json()
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                const station = result.data
                const tempId = `step-${Date.now()}`
                dirtySetSteps((prev: any[]) => {
                    const lastStep = prev[prev.length - 1]
                    return [...prev, {
                        id: tempId, stationId: station.id, station,
                        sequence: prev.length + 1, durationMinutes: null, notes: null,
                        parentStepIds: lastStep ? [lastStep.id] : [],
                        materials: [], allocations: [], attachments: [],
                    }]
                })
                toast.success(`Work center "${label}" dibuat & ditambahkan`)
            } else {
                toast.error(result.error || "Gagal membuat work center")
            }
        } catch {
            toast.error("Gagal membuat work center")
        } finally {
            setCreatingStationType(null)
        }
    }, [allStations, handleAddStationToCanvas, queryClient, dirtySetSteps])

    // Apply a process template (adds multiple connected stations)
    const [applyingTemplate, setApplyingTemplate] = useState(false)
    const [pendingTemplate, setPendingTemplate] = useState<readonly string[] | null>(null)
    const [showTemplateManager, setShowTemplateManager] = useState(false)
    const handleApplyTemplate = useCallback(async (types: readonly string[]) => {
        // If steps exist, show confirmation dialog instead of window.confirm
        if (steps.length > 0) {
            setPendingTemplate(types)
            return
        }
        applyTemplateNow(types)
    }, [steps.length])

    const applyTemplateNow = useCallback(async (types: readonly string[]) => {
        setPendingTemplate(null)
        setApplyingTemplate(true)
        try {
            const newStations: any[] = []
            const errors: string[] = []
            for (const stationType of types) {
                let station = (allStations || []).find((s: any) =>
                    s.stationType === stationType && s.operationType !== "SUBCONTRACTOR" && s.isActive !== false
                )
                if (!station) {
                    const config = STATION_TYPE_CONFIG.find((c) => c.type === stationType)
                    const label = config?.label || stationType
                    const code = `STN-${stationType.substring(0, 3)}-${String(Date.now()).slice(-4)}`
                    const res = await fetch("/api/manufacturing/process-stations", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ code, name: label, stationType, operationType: "IN_HOUSE", costPerUnit: 0 }),
                    })
                    const result = await res.json()
                    if (result.success) {
                        station = result.data
                        queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                    } else {
                        errors.push(`Gagal membuat station ${label}: ${result.error || "Unknown error"}`)
                        continue
                    }
                }
                newStations.push(station)
            }

            if (errors.length > 0) {
                toast.error(errors.join("; "), { duration: 5000 })
            }

            if (newStations.length === 0) {
                toast.error("Tidak ada proses yang berhasil dibuat dari template")
                return
            }

            // REPLACE existing steps (not append)
            dirtySetSteps(() => {
                let prevStepId: string | null = null
                return newStations.map((station, i) => {
                    const tempId = `step-tmpl-${Date.now()}-${i}`
                    const step = {
                        id: tempId, stationId: station.id, station,
                        sequence: i + 1, durationMinutes: null, notes: null,
                        parentStepIds: prevStepId ? [prevStepId] : [],
                        materials: [], allocations: [], attachments: [],
                    }
                    prevStepId = tempId
                    return step
                })
            })
            setSelectedStepId(null)
            toast.success(`Template diterapkan: ${newStations.length} proses`)
        } catch {
            toast.error("Gagal menerapkan template")
        } finally {
            setApplyingTemplate(false)
        }
    }, [allStations, queryClient, dirtySetSteps, setSelectedStepId])

    const handleRemoveStep = useCallback((stepId: string) => {
        dirtySetSteps((prev: any[]) => {
            const filtered = prev.filter((s: any) => s.id !== stepId)
            // Re-sequence + remove deleted step from parentStepIds
            return filtered.map((s: any, i: number) => ({
                ...s,
                sequence: i + 1,
                parentStepIds: (s.parentStepIds || []).filter((id: string) => id !== stepId),
            }))
        })
        if (selectedStepId === stepId) setSelectedStepId(null)
    }, [selectedStepId, dirtySetSteps, setSelectedStepId])

    const handleDropMaterial = useCallback((stepId: string, bomItemId: string) => {
        dirtySetSteps((prev: any[]) => prev.map((step: any) => {
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
    }, [items, dirtySetSteps])

    const handleRemoveMaterial = useCallback((stepId: string, bomItemId: string) => {
        dirtySetSteps((prev: any[]) => prev.map((step: any) => {
            if (step.id !== stepId) return step
            return {
                ...step,
                materials: (step.materials || []).filter((m: any) => m.bomItemId !== bomItemId),
            }
        }))
    }, [dirtySetSteps])

    const handleUpdateStep = useCallback((field: string, value: any) => {
        if (!selectedStepId) return
        dirtySetSteps((prev: any[]) => prev.map((step: any) =>
            step.id === selectedStepId ? { ...step, [field]: value } : step
        ))
    }, [selectedStepId, dirtySetSteps])

    const handleChangeStation = useCallback((stationId: string, station: any) => {
        if (!selectedStepId) return
        dirtySetSteps((prev: any[]) => prev.map((step: any) =>
            step.id === selectedStepId ? { ...step, stationId, station } : step
        ))
    }, [selectedStepId, dirtySetSteps])

    const handleUpdateAllocations = useCallback((allocations: any[]) => {
        if (!selectedStepId) return
        dirtySetSteps((prev: any[]) => prev.map((step: any) =>
            step.id === selectedStepId ? { ...step, allocations } : step
        ))
    }, [selectedStepId, dirtySetSteps])

    const handleToggleSubkon = useCallback((useSubkon: boolean) => {
        if (!selectedStepId) return
        dirtySetSteps((prev: any[]) => prev.map((step: any) =>
            step.id === selectedStepId
                ? { ...step, useSubkon, allocations: useSubkon ? (step.allocations || []) : [] }
                : step
        ))
    }, [selectedStepId, dirtySetSteps])

    // --- DAG EDGE HANDLERS ---
    const handleConnectSteps = useCallback((sourceId: string, targetId: string) => {
        dirtySetSteps((prev: any[]) => prev.map((step: any) =>
            step.id === targetId
                ? { ...step, parentStepIds: [...new Set([...(step.parentStepIds || []), sourceId])] }
                : step
        ))
    }, [dirtySetSteps])

    const handleDisconnectSteps = useCallback((sourceId: string, targetId: string) => {
        dirtySetSteps((prev: any[]) => prev.map((step: any) =>
            step.id === targetId
                ? { ...step, parentStepIds: (step.parentStepIds || []).filter((id: string) => id !== sourceId) }
                : step
        ))
    }, [dirtySetSteps])

    // --- CONTEXT MENU HANDLERS ---
    const handleNodeContextMenu = useCallback((stepId: string, pos: { clientX: number; clientY: number }) => {
        setContextMenu({ x: pos.clientX, y: pos.clientY, stepId })
    }, [])

    const handleDuplicateStep = useCallback((stepId: string) => {
        const source = steps.find((s) => s.id === stepId)
        if (!source) return

        const tempId = `step-${Date.now()}`
        dirtySetSteps((prev: any[]) => {
            const newSequence = prev.length + 1
            return [...prev, {
                ...source,
                id: tempId,
                sequence: newSequence,
                parentStepIds: [stepId],
                completedQty: 0,
                startedAt: null,
                completedAt: null,
                materials: [...(source.materials || [])],
                allocations: [...(source.allocations || [])],
                attachments: [],
            }]
        })
        toast.success("Work center berhasil diduplikat")
    }, [steps, dirtySetSteps])

    // Add a parallel step — same parents as the clicked step (sibling, not child)
    // Auto-splits quantity evenly when siblings share the same stationType
    const handleAddParallel = useCallback((stepId: string) => {
        const source = steps.find((s) => s.id === stepId)
        if (!source) return

        const tempId = `step-par-${Date.now()}`
        const stationType = source.station?.stationType

        dirtySetSteps((prev: any[]) => {
            const newSequence = prev.length + 1
            const newStep = {
                id: tempId,
                stationId: source.stationId,
                station: source.station,
                sequence: newSequence,
                durationMinutes: source.durationMinutes,
                notes: null,
                parentStepIds: [...(source.parentStepIds || [])],
                materials: [] as any[],
                allocations: [] as any[],
                attachments: [] as any[],
            }

            const withNew = [...prev, newStep]

            // Auto-split if siblings share same stationType
            if (stationType && totalQty > 0) {
                const parentKey = [...(source.parentStepIds || [])].sort().join(",")
                const siblings = withNew.filter((s: any) => {
                    const sKey = [...(s.parentStepIds || [])].sort().join(",")
                    return s.station?.stationType === stationType && sKey === parentKey
                })

                if (siblings.length >= 2) {
                    const base = Math.floor(totalQty / siblings.length)
                    const remainder = totalQty % siblings.length

                    return withNew.map((s: any) => {
                        const sibIdx = siblings.findIndex((sib: any) => sib.id === s.id)
                        if (sibIdx === -1) return s
                        const qty = base + (sibIdx < remainder ? 1 : 0)
                        return {
                            ...s,
                            allocations: [{ id: `alloc-${s.id}-auto`, stepId: s.id, stationId: s.stationId, quantity: qty }],
                        }
                    })
                }
            }

            return withNew
        })
        toast.success("Proses paralel ditambahkan — kuantitas dibagi rata")
    }, [steps, totalQty, dirtySetSteps])

    // Handle percentage change from split group badge click
    const handlePctChange = useCallback((stepId: string, newPct: number) => {
        if (!totalQty) return

        dirtySetSteps((prev: any[]) => {
            const step = prev.find((s: any) => s.id === stepId)
            if (!step) return prev

            const stationType = step.station?.stationType
            const parentKey = [...(step.parentStepIds || [])].sort().join(",")
            const siblings = prev.filter((s: any) => {
                const sKey = [...(s.parentStepIds || [])].sort().join(",")
                return s.station?.stationType === stationType && sKey === parentKey
            })

            if (siblings.length < 2) return prev

            const clamped = Math.max(1, Math.min(100 - (siblings.length - 1), newPct))
            const remaining = 100 - clamped
            const otherSiblings = siblings.filter((s: any) => s.id !== stepId)

            // Distribute remaining proportionally among others
            const otherTotal = otherSiblings.reduce((sum: number, s: any) => {
                const allocQty = (s.allocations || []).reduce((a: number, b: any) => a + (b.quantity || 0), 0)
                return sum + (allocQty || Math.floor(totalQty / siblings.length))
            }, 0)

            const otherPcts = new Map<string, number>()
            let usedPct = 0
            otherSiblings.forEach((s: any, i: number) => {
                if (i < otherSiblings.length - 1) {
                    const allocQty = (s.allocations || []).reduce((a: number, b: any) => a + (b.quantity || 0), 0)
                    const oldPct = otherTotal > 0 ? allocQty / otherTotal : 1 / otherSiblings.length
                    const pct = Math.max(1, Math.round(remaining * oldPct))
                    otherPcts.set(s.id, pct)
                    usedPct += pct
                } else {
                    otherPcts.set(s.id, Math.max(1, remaining - usedPct))
                }
            })

            return prev.map((s: any) => {
                if (s.id === stepId) {
                    const qty = Math.round((clamped / 100) * totalQty)
                    return { ...s, allocations: [{ id: `alloc-${s.id}-auto`, stepId: s.id, stationId: s.stationId, quantity: qty }] }
                }
                const pct = otherPcts.get(s.id)
                if (pct != null) {
                    const qty = Math.round((pct / 100) * totalQty)
                    return { ...s, allocations: [{ id: `alloc-${s.id}-auto`, stepId: s.id, stationId: s.stationId, quantity: qty }] }
                }
                return s
            })
        })
    }, [totalQty, dirtySetSteps])

    const handleAddSequential = useCallback((stepId: string) => {
        const source = steps.find((s) => s.id === stepId)
        if (!source) return

        const tempId = `step-seq-${Date.now()}`
        dirtySetSteps((prev: any[]) => {
            const newSequence = prev.length + 1
            return [...prev, {
                id: tempId,
                stationId: source.stationId,
                station: source.station,
                sequence: newSequence,
                durationMinutes: source.durationMinutes,
                notes: null,
                // Child of this step
                parentStepIds: [stepId],
                materials: [],
                allocations: [],
                attachments: [],
            }]
        })
        toast.success("Proses berikutnya ditambahkan — ganti work center di panel detail")
    }, [steps, dirtySetSteps])

    // --- CANVAS POSITION HANDLER ---
    const handleNodePositionChange = useCallback((stepId: string, x: number, y: number) => {
        dirtySetSteps((prev: any[]) => prev.map((s: any) =>
            s.id === stepId ? { ...s, positionX: x, positionY: y } : s
        ))
    }, [dirtySetSteps])

    // --- TIMELINE DRAG HANDLERS ---
    // Move block on timeline: sets startOffsetMinutes + lane without destroying DAG edges
    const handleMoveStep = useCallback((stepId: string, startOffsetMinutes: number, lane?: number) => {
        dirtySetSteps((prev: any[]) => prev.map((s: any) =>
            s.id === stepId ? { ...s, startOffsetMinutes, ...(lane != null ? { manualLane: lane } : {}) } : s
        ))
    }, [dirtySetSteps])

    const handleMarkStarted = useCallback((stepId: string) => {
        dirtySetSteps((prev: any[]) => prev.map((step: any) =>
            step.id === stepId ? { ...step, startedAt: new Date().toISOString() } : step
        ))
        toast.success("Work center ditandai mulai")
    }, [dirtySetSteps])

    const handleMarkCompleted = useCallback((stepId: string) => {
        dirtySetSteps((prev: any[]) => {
            const step = prev.find((s: any) => s.id === stepId)
            if (!step) return prev
            const target = calcStepTarget(step, prev, totalQty)
            return prev.map((s: any) => s.id === stepId
                ? { ...s, completedAt: new Date().toISOString(), completedQty: target }
                : s
            )
        })
        toast.success("Work center ditandai selesai")
    }, [totalQty, dirtySetSteps])

    // --- ATTACHMENT HANDLERS ---
    const handleUploadAttachment = useCallback(async () => {
        if (!selectedStepId) return

        // C4: Prevent upload on unsaved steps
        if (selectedStepId.startsWith('step-') || selectedStepId.startsWith('temp-')) {
            toast.error("Simpan BOM terlebih dahulu sebelum upload lampiran")
            return
        }

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
                    dirtySetSteps((prev: any[]) => prev.map((step: any) =>
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
    }, [selectedStepId, id, dirtySetSteps])

    const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
        try {
            const res = await fetch(`/api/manufacturing/production-bom-attachments/${attachmentId}`, { method: "DELETE" })
            const result = await res.json()
            if (result.success) {
                dirtySetSteps((prev: any[]) => prev.map((step: any) => ({
                    ...step,
                    attachments: (step.attachments || []).filter((a: any) => a.id !== attachmentId),
                })))
                toast.success("Lampiran dihapus")
            }
        } catch {
            toast.error("Gagal menghapus lampiran")
        }
    }, [dirtySetSteps])

    // --- SAVE (returns success boolean so generateSPK can chain) ---
    const doSave = async (): Promise<boolean> => {
        const payload = {
            totalProductionQty: totalQty,
            items: items.map((item) => ({
                id: item.id, // For ID mapping on server
                materialId: item.materialId || (item as any).material?.id,
                quantityPerUnit: Number(item.quantityPerUnit),
                unit: item.unit || (item as any).material?.unit || null,
                wastePct: Number(item.wastePct || 0),
                notes: item.notes || null,
            })),
            // C1 fix: normalize sequences to 1..N to prevent collisions
            steps: steps.map((step, idx) => ({
                id: step.id, // Used for parentStepIds mapping on server
                stationId: step.stationId || (step as any).station?.id,
                sequence: idx + 1,
                durationMinutes: step.durationMinutes || null,
                notes: step.notes || null,
                parentStepIds: step.parentStepIds || [],
                startOffsetMinutes: step.startOffsetMinutes ?? 0,
                useSubkon: step.useSubkon ?? null,
                subkonProcessType: step.subkonProcessType || null,
                operatorName: step.operatorName || null,
                laborMonthlySalary: step.laborMonthlySalary ?? null,
                estimatedTimePerUnit: (step as any).estimatedTimePerUnit ?? null,
                actualTimeTotal: (step as any).actualTimeTotal ?? null,
                completedQty: step.completedQty ?? 0,
                startedAt: (step as any).startedAt || null,
                completedAt: (step as any).completedAt || null,
                positionX: step.positionX ?? null,
                positionY: step.positionY ?? null,
                materialProductIds: (step.materials || []).map((m: any) => {
                    const item = items.find((i) => i.id === m.bomItemId)
                    return (item as any)?.materialId || item?.material?.id
                }).filter(Boolean),
                allocations: (step.allocations || []).map((a: any) => ({
                    stationId: a.stationId || a.station?.id,
                    quantity: a.quantity,
                    pricePerPcs: a.pricePerPcs ?? null,
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

        if (!res.ok) {
            console.error("BOM save failed:", res.status, result)
        }

        if (result.success) {
            // C2 fix: update local state with server-assigned IDs so subsequent saves work
            const mapping = result.idMapping as { stepIdMap?: Record<string, string>; itemIdMap?: Record<string, string> } | undefined
            if (mapping) {
                if (mapping.itemIdMap && Object.keys(mapping.itemIdMap).length > 0) {
                    ctxSetItems(itemsRef.current.map((item: any) => ({
                        ...item,
                        id: mapping.itemIdMap![item.id] || item.id,
                    })))
                }
                if (mapping.stepIdMap && Object.keys(mapping.stepIdMap).length > 0) {
                    ctxSetSteps(stepsRef.current.map((step: any) => ({
                        ...step,
                        id: mapping.stepIdMap![step.id] || step.id,
                        parentStepIds: (step.parentStepIds || []).map(
                            (pid: string) => mapping.stepIdMap![pid] || pid
                        ),
                        materials: (step.materials || []).map((m: any) => ({
                            ...m,
                            bomItemId: mapping.itemIdMap?.[m.bomItemId] || m.bomItemId,
                        })),
                    })))
                }
            }
            setDirty(false)
            // Invalidate caches so next page load gets fresh data.
            // Don't reset initialized.current — keep local state for THIS session.
            queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })
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
            if (ok) {
                toast.success("BOM berhasil disimpan")
                clearLocalDraft()
                setHasDraft(false)
            }
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setSaving(false)
        }
    }

    // --- SAVE AS NEW VERSION ---
    const handleSaveAsNewVersion = async () => {
        setSavingAs(true)
        try {
            // First save current changes
            const saved = await doSave()
            if (!saved) { setSavingAs(false); return }

            // Clone BOM as new version
            const res = await fetch("/api/manufacturing/production-bom", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cloneFromId: id }),
            })
            const result = await res.json()
            if (result.success) {
                toast.success(`Versi baru ${result.data.version} berhasil dibuat`)
                queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.all })
                router.push(`/manufacturing/bom/${result.data.id}`)
            } else {
                toast.error(result.error || "Gagal membuat versi baru")
            }
        } catch {
            toast.error("Terjadi kesalahan")
        } finally {
            setSavingAs(false)
        }
    }

    // --- GENERATE SPK (pre-validates, auto-saves, then generates) ---
    const handleGenerateSPK = async () => {
        // Pre-validate client-side before even saving
        if (!spkReadiness.ready) {
            toast.error(
                `Belum siap generate SPK:\n• ${spkReadiness.issues.join('\n• ')}`,
                { duration: 6000 }
            )
            return
        }

        setGenerating(true)
        try {
            // Step 1: Save BOM so DB has latest data
            setSpkProgress("Menyimpan BOM...")
            const saved = await doSave()
            if (!saved) {
                setSpkProgress(null)
                return
            }

            // Step 2: Create work order records for production tracking
            setSpkProgress("Membuat Work Order...")
            const res = await fetch(`/api/manufacturing/production-bom/${id}/generate-spk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({}),
            })
            const result = await res.json()

            if (!result.success) {
                setSpkProgress(null)
                toast.error(result.error || "Gagal membuat SPK")
                return
            }

            // Step 3: Generate PDF document
            setSpkProgress("Membuat dokumen PDF...")
            // Verify PDF is accessible (pre-check)
            await fetch(`/api/documents/spk/${id}`, { method: "HEAD" }).catch(() => null)

            setSpkProgress(null)
            setSpkResult({ workOrders: result.data || [], bomId: id })
            setHasSPK(true)
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.spkOrders.all })
        } catch {
            setSpkProgress(null)
            toast.error("Terjadi kesalahan")
        } finally {
            setGenerating(false)
        }
    }

    // --- RESET SPK (delete linked work orders so user can re-generate) ---
    const [resettingSPK, setResettingSPK] = useState(false)
    const handleResetSPK = async () => {
        if (!confirm("Reset SPK akan menghapus semua work order yang belum berjalan untuk BOM ini. Lanjutkan?")) return
        setResettingSPK(true)
        try {
            const res = await fetch(`/api/manufacturing/production-bom/${id}/work-orders`, { method: "DELETE" })
            const result = await res.json()
            if (!res.ok) {
                toast.error(result.error || "Gagal mereset SPK")
                return
            }
            toast.success(`SPK direset — ${result.deleted} work order dihapus`)
            setHasSPK(false)
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.spkOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.detail(id) })
        } catch {
            toast.error("Terjadi kesalahan saat mereset SPK")
        } finally {
            setResettingSPK(false)
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
            {/* ═══ TOOLBAR — Row 1: Command Bar ═══ */}
            <div className="border-b-2 border-black bg-white px-6 py-3 flex items-center justify-between shrink-0 gap-6">
                {/* Left: Back + Product info + Version + Target */}
                <div className="flex items-center gap-4 min-w-0">
                    <button
                        onClick={() => {
                            if (isDirty) {
                                if (!window.confirm("Ada perubahan yang belum disimpan. Yakin ingin keluar tanpa menyimpan?")) return
                            }
                            router.push("/manufacturing/bom")
                        }}
                        className="p-2 border-2 border-black hover:bg-zinc-100 transition-colors shrink-0"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2.5">
                            <Package className="h-4 w-4 text-orange-500 shrink-0" />
                            <span className="font-black text-sm uppercase truncate">{bom.product?.name}</span>
                            <span className="bg-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 shrink-0 border border-orange-600">{bom.version}</span>
                            {isDirty && <span className="w-2 h-2 bg-amber-400 rounded-full shrink-0" title="Ada perubahan belum disimpan" />}
                        </div>
                        <p className="text-[10px] font-mono text-zinc-400 truncate mt-0.5">{bom.product?.code}</p>
                    </div>

                    <div className="border-l-2 border-zinc-200 pl-4 flex items-center gap-2.5 shrink-0">
                        <span className="text-[10px] font-black uppercase text-zinc-400">Target</span>
                        <Input
                            type="number"
                            value={totalQty}
                            onChange={(e) => dirtySetTotalQty(parseInt(e.target.value) || 0)}
                            className="h-8 w-24 text-xs font-mono font-bold border-2 border-zinc-300 rounded-none hover:border-black transition-colors focus:border-black"
                        />
                        <span className="text-[10px] font-bold text-zinc-400">pcs</span>
                    </div>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2.5 shrink-0">
                    {/* View Toggle */}
                    <div className="flex border-2 border-black overflow-hidden">
                        <button
                            onClick={() => setViewMode("canvas")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase transition-colors ${viewMode === "canvas" ? "bg-black text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"}`}
                        >
                            Canvas
                        </button>
                        <button
                            onClick={() => setViewMode("timeline")}
                            className={`px-3 py-1.5 text-[10px] font-black uppercase border-l-2 border-black transition-colors ${viewMode === "timeline" ? "bg-black text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"}`}
                        >
                            Timeline
                        </button>
                    </div>

                    <button
                        onClick={() => setHistoryOpen(true)}
                        className="h-9 px-3 border-2 border-black text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-zinc-50 transition-colors"
                        title="Riwayat Edit"
                    >
                        <History className="h-3.5 w-3.5" />
                    </button>

                    <button
                        onClick={() => setAddStationDialogOpen(true)}
                        className="h-9 px-3 border-2 border-black text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-zinc-50 transition-colors"
                    >
                        <Plus className="h-3.5 w-3.5" /> Kustom
                    </button>

                    <button
                        onClick={() => window.open(`/api/manufacturing/production-bom/${id}/pdf`, "_blank")}
                        className="h-9 px-3 border-2 border-black text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-zinc-50 transition-colors"
                    >
                        <FileDown className="h-3.5 w-3.5" /> PDF
                    </button>

                    {hasSPK ? (
                        <button
                            onClick={handleResetSPK}
                            disabled={resettingSPK}
                            title="Hapus work order yang belum berjalan dan buat ulang SPK"
                            className="h-9 px-4 border-2 border-amber-500 text-amber-600 text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-amber-50 transition-colors disabled:opacity-40"
                        >
                            {resettingSPK ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            Reset SPK
                        </button>
                    ) : (
                        <button
                            onClick={handleGenerateSPK}
                            disabled={generating || !spkReadiness.ready}
                            title={spkReadiness.ready ? "Semua siap — klik untuk generate SPK" : `Belum siap:\n${spkReadiness.issues.join('\n')}`}
                            className={`h-9 px-4 border-2 text-[10px] font-black uppercase flex items-center gap-1.5 transition-colors disabled:opacity-40 ${spkReadiness.ready
                                    ? "border-orange-500 text-orange-600 hover:bg-orange-50"
                                    : "border-zinc-300 text-zinc-400"
                                }`}
                        >
                            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                            SPK
                            {!spkReadiness.ready && steps.length > 0 && (
                                <span className="bg-red-500 text-white text-[8px] font-black rounded-full h-4 w-4 flex items-center justify-center">
                                    {spkReadiness.issues.length}
                                </span>
                            )}
                        </button>
                    )}

                    {/* Save + Save As group */}
                    <div className="flex border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] overflow-hidden ml-1">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="h-9 px-5 bg-black text-white text-[10px] font-black uppercase flex items-center gap-1.5 hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                            Simpan
                            {isDirty && !saving && <span className="w-2 h-2 rounded-full bg-orange-400 ml-0.5" />}
                        </button>
                        <button
                            onClick={handleSaveAsNewVersion}
                            disabled={savingAs}
                            className="h-9 px-3 bg-zinc-800 text-white text-[10px] font-black uppercase flex items-center gap-1.5 border-l border-zinc-600 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                            title="Simpan sebagai versi baru"
                        >
                            {savingAs ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* ═══ TOOLBAR — Row 2: Process Palette ═══ */}
            <div className="border-b border-zinc-200 bg-zinc-50 px-6 py-2.5 flex items-center gap-2 shrink-0 overflow-x-auto">
                <span className="text-[10px] font-black uppercase text-zinc-400 mr-2 shrink-0">Proses</span>
                {dynamicProcessTypes.filter(cfg => !cfg.isCustom).map((cfg) => {
                    const Icon = cfg.icon
                    const isCreating = creatingStationType === cfg.type
                    const isPicking = stationPickerType === cfg.type
                    const candidates = (allStations || []).filter((s: any) => {
                        if (s.operationType === "SUBCONTRACTOR" || s.isActive === false) return false
                        return s.stationType === cfg.type
                    })
                    const hasMultiple = candidates.length > 1

                    return (
                        <Popover key={cfg.type} open={isPicking} onOpenChange={(open) => { if (!open) setStationPickerType(null) }}>
                            <PopoverTrigger asChild>
                                <button
                                    disabled={isCreating}
                                    onClick={() => handleQuickAddByType(cfg.type, cfg.description)}
                                    className={`h-8 px-3 text-[10px] font-black uppercase flex items-center gap-1.5 border-2 border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-40 shrink-0 ${cfg.color}`}
                                >
                                    {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                                    {cfg.label}
                                    {hasMultiple && <span className="text-[8px] opacity-60">({candidates.length})</span>}
                                </button>
                            </PopoverTrigger>
                            {isPicking && (
                                <PopoverContent className="w-60 p-0 border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" align="start" sideOffset={4}>
                                    <div className="px-3 py-2 bg-zinc-50 border-b-2 border-black">
                                        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                            Pilih Work Center {cfg.label}
                                        </p>
                                    </div>
                                    <div className="py-1 max-h-48 overflow-y-auto">
                                        {candidates.map((station: any) => (
                                            <button
                                                key={station.id}
                                                onClick={() => {
                                                    handleAddStationToCanvas(station.id)
                                                    setStationPickerType(null)
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-zinc-100 transition-colors flex items-center justify-between"
                                            >
                                                <div>
                                                    <p className="text-xs font-bold">{station.name}</p>
                                                    <p className="text-[9px] font-mono text-zinc-400">{station.code}</p>
                                                </div>
                                                {Number(station.costPerUnit) > 0 && (
                                                    <span className="text-[9px] font-bold text-emerald-600">
                                                        Rp {Number(station.costPerUnit).toLocaleString("id-ID")}
                                                    </span>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </PopoverContent>
                            )}
                        </Popover>
                    )
                })}

                {/* Custom process types */}
                {dynamicProcessTypes.some(cfg => cfg.isCustom) && (
                    <>
                        <div className="border-l-2 border-zinc-300 mx-2 h-5 shrink-0" />
                        {dynamicProcessTypes.filter(cfg => cfg.isCustom).map((cfg) => {
                            const Icon = cfg.icon
                            const isCreating = creatingStationType === cfg.type
                            const isPicking = stationPickerType === cfg.type
                            const candidates = (allStations || []).filter((s: any) => {
                                if (s.operationType === "SUBCONTRACTOR" || s.isActive === false) return false
                                return s.stationType === "OTHER" && s.description === cfg.description
                            })
                            const hasMultiple = candidates.length > 1

                            return (
                                <Popover key={cfg.type} open={isPicking} onOpenChange={(open) => { if (!open) setStationPickerType(null) }}>
                                    <PopoverTrigger asChild>
                                        <button
                                            disabled={isCreating}
                                            onClick={() => handleQuickAddByType(cfg.type, cfg.description)}
                                            className={`h-8 px-3 text-[10px] font-black uppercase flex items-center gap-1.5 border-2 border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all disabled:opacity-40 shrink-0 ${cfg.color}`}
                                        >
                                            {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
                                            {cfg.label}
                                            {hasMultiple && <span className="text-[8px] opacity-60">({candidates.length})</span>}
                                        </button>
                                    </PopoverTrigger>
                                    {isPicking && (
                                        <PopoverContent className="w-60 p-0 border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" align="start" sideOffset={4}>
                                            <div className="px-3 py-2 bg-zinc-50 border-b-2 border-black">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                                                    Pilih Work Center {cfg.label}
                                                </p>
                                            </div>
                                            <div className="py-1 max-h-48 overflow-y-auto">
                                                {candidates.map((station: any) => (
                                                    <button
                                                        key={station.id}
                                                        onClick={() => {
                                                            handleAddStationToCanvas(station.id)
                                                            setStationPickerType(null)
                                                        }}
                                                        className="w-full text-left px-3 py-2 hover:bg-zinc-100 transition-colors flex items-center justify-between"
                                                    >
                                                        <div>
                                                            <p className="text-xs font-bold">{station.name}</p>
                                                            <p className="text-[9px] font-mono text-zinc-400">{station.code}</p>
                                                        </div>
                                                        {Number(station.costPerUnit) > 0 && (
                                                            <span className="text-[9px] font-bold text-emerald-600">
                                                                Rp {Number(station.costPerUnit).toLocaleString("id-ID")}
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </PopoverContent>
                                    )}
                                </Popover>
                            )
                        })}
                    </>
                )}

                <div className="border-l-2 border-zinc-300 mx-2 h-5 shrink-0" />

                {/* Template Manager */}
                <button
                    disabled={applyingTemplate}
                    onClick={() => setShowTemplateManager(true)}
                    className="h-8 px-3 text-[10px] font-bold flex items-center gap-1.5 bg-orange-50 text-orange-600 border-2 border-orange-300 hover:bg-orange-100 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.1)] transition-all disabled:opacity-40 shrink-0"
                >
                    {applyingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <LayoutTemplate className="h-3.5 w-3.5" />}
                    Templates
                </button>
            </div>

            {/* ═══ TOOLBAR — Row 3: Cost Summary Strip ═══ */}
            <div className="border-b border-zinc-200 bg-white px-6 py-2 flex items-center gap-5 lg:gap-8 shrink-0 overflow-x-auto text-[10px]">
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-black uppercase text-zinc-400">Material</span>
                    <span className="font-bold text-black">{formatCurrency(costSummary.totalMaterial)}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-black uppercase text-zinc-400">Labor</span>
                    <span className="font-bold text-black">{formatCurrency(costSummary.totalLabor)}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-black uppercase text-zinc-400">Overhead</span>
                    <span className="font-bold text-orange-700">{formatCurrency(costSummary.totalOverhead)}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-black uppercase text-zinc-400">HPP/Unit</span>
                    <span className="font-bold text-black">{formatCurrency(costSummary.perUnit)}</span>
                </div>
                {costSummary.durationPerPiece > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                        <span className="font-bold text-blue-600">
                            {costSummary.durationPerPiece} menit/pcs
                        </span>
                        {costSummary.estTimeLabel && (
                            <span className="text-zinc-400 font-normal">
                                ({costSummary.estTimeLabel})
                            </span>
                        )}
                    </div>
                )}
                {costSummary.progressPct > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-black uppercase text-zinc-400">Progress</span>
                        <div className="h-1.5 w-16 bg-zinc-200 overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${costSummary.progressPct}%` }} />
                        </div>
                        <span className="font-mono font-bold text-emerald-700">{costSummary.progressPct}%</span>
                    </div>
                )}
                <div className="border-l-2 border-black pl-5 flex items-center gap-2 shrink-0">
                    <span className="font-black uppercase text-zinc-400">Total ({totalQty} pcs)</span>
                    <span className="text-sm font-black text-emerald-700">{formatCurrency(costSummary.grandTotal)}</span>
                </div>
                <button
                    onClick={() => setCostCardOpen(!costCardOpen)}
                    className="ml-auto flex items-center gap-1.5 shrink-0 font-black uppercase text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                    <Calculator className="h-3.5 w-3.5" />
                    Detail HPP
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${costCardOpen ? "rotate-180" : ""}`} />
                </button>
            </div>

            {/* HPP/COGS Cost Breakdown Panel */}
            {costCardOpen && bom && (
                <div className="border-b-2 border-black shrink-0 max-h-[400px] overflow-y-auto">
                    <BOMCostCard
                        mode="inline"
                        bomId={id}
                        productId={bom.productId || ""}
                        productName={bom.product?.name || ""}
                        productUnit={bom.product?.unit || "pcs"}
                        currentCostPrice={Number(bom.product?.costPrice || 0)}
                        items={items as any[]}
                    />
                </div>
            )}

            {/* Draft restore banner */}
            {hasDraft && (
                <div className="border-b border-amber-300 bg-amber-50 px-6 py-2 flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-black uppercase text-amber-700">Draft tersimpan ditemukan</span>
                    <button
                        className="px-3 py-1 bg-amber-500 text-white font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-px hover:translate-y-px transition-transform"
                        onClick={() => {
                            const d = loadLocalDraft()
                            if (d) {
                                ctxSetItems(d.items)
                                ctxSetSteps(d.steps)
                                ctxSetTotalQty(d.totalQty)
                            }
                            setHasDraft(false)
                        }}
                    >Pulihkan</button>
                    <button
                        className="text-[10px] font-bold text-amber-700 underline"
                        onClick={() => { clearLocalDraft(); setHasDraft(false) }}
                    >Buang</button>
                </div>
            )}

            {/* Price drift warning banner */}
            {driftedItems.length > 0 && (
                <div className="border-b border-yellow-300 bg-yellow-50 px-6 py-2 flex items-center gap-3 shrink-0 overflow-x-auto">
                    <span className="text-[11px] font-black uppercase text-yellow-700 shrink-0">
                        {driftedItems.length} material berubah harga
                    </span>
                    <span className="text-[10px] text-yellow-600 font-bold shrink-0">
                        {driftedItems.map((d) => `${d.materialName} ${d.direction === "naik" ? "↑" : "↓"}${d.changePct.toFixed(0)}%`).join(" · ")}
                    </span>
                    <button
                        className="px-3 py-1 bg-yellow-500 text-white font-black text-[10px] uppercase border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] shrink-0"
                        onClick={() => setDirty(true)}
                    >Hitung Ulang HPP</button>
                </div>
            )}

            {/* SPK Readiness — compact inline banner */}
            {steps.length > 0 && !spkReadiness.ready && (
                <div className="border-b border-amber-200 bg-amber-50/60 px-6 py-1.5 flex items-center gap-3 shrink-0 overflow-x-auto">
                    <div className="flex items-center gap-1.5 shrink-0">
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-[10px] font-black uppercase text-amber-600">{spkReadiness.issues.length} hal perlu dilengkapi</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-amber-600 font-bold">
                        {spkReadiness.issues.slice(0, 3).map((issue, i) => (
                            <span key={i} className="flex items-center gap-1 shrink-0">
                                <span className="w-1 h-1 bg-amber-400 rounded-full" />
                                {issue}
                            </span>
                        ))}
                        {spkReadiness.issues.length > 3 && (
                            <span className="text-amber-400 shrink-0">+{spkReadiness.issues.length - 3} lainnya</span>
                        )}
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Material Panel */}
                <MaterialPanel
                    onAddItem={() => setAddMaterialOpen(true)}
                    onRemoveItem={handleRemoveItem}
                />

                {/* Center: Canvas or Timeline */}
                <div className="flex-1 flex flex-col">
                    {viewMode === "canvas" ? (
                        <BOMCanvas
                            steps={steps}
                            items={items}
                            totalProductionQty={totalQty}
                            onStepSelect={setSelectedStepId}
                            onDropMaterial={handleDropMaterial}
                            onRemoveMaterial={handleRemoveMaterial}
                            onRemoveStep={handleRemoveStep}
                            selectedStepId={selectedStepId}
                            onConnectSteps={handleConnectSteps}
                            onDisconnectSteps={handleDisconnectSteps}
                            onNodeContextMenu={handleNodeContextMenu}
                            onAddParallel={handleAddParallel}
                            onAddSequential={handleAddSequential}
                            onNodePositionChange={handleNodePositionChange}
                            onPctChange={handlePctChange}
                            criticalStepIds={criticalStepIds}
                        />
                    ) : (
                        <TimelineView
                            steps={steps}
                            totalQty={totalQty}
                            selectedStepId={selectedStepId}
                            onStepSelect={setSelectedStepId}
                            onMoveStep={handleMoveStep}
                            criticalStepIds={criticalStepIds}
                        />
                    )}

                    {/* Bottom: Detail Panel */}
                    {selectedStep && (
                        <DetailPanel
                            step={selectedStep}
                            totalQty={totalQty}
                            allItems={items}
                            allStations={allStations || []}
                            onUpdateStep={handleUpdateStep}
                            onChangeStation={handleChangeStation}
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
                existingMaterialIds={items.map((i) => (i as any).materialId || (i as any).material?.id).filter(Boolean)}
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

            {/* Edit History Drawer */}
            <EditHistoryDrawer
                bomId={id}
                open={historyOpen}
                onClose={() => setHistoryOpen(false)}
            />

            {/* Node Context Menu */}
            {contextMenu && (
                <NodeContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    stepId={contextMenu.stepId}
                    onClose={() => setContextMenu(null)}
                    onDeleteStep={(stepId) => { handleRemoveStep(stepId); setContextMenu(null) }}
                    onDuplicateStep={(stepId) => { handleDuplicateStep(stepId); setContextMenu(null) }}
                    onAddParallel={(stepId) => { handleAddParallel(stepId); setContextMenu(null) }}
                    onMarkStarted={(stepId) => { handleMarkStarted(stepId); setContextMenu(null) }}
                    onMarkCompleted={(stepId) => { handleMarkCompleted(stepId); setContextMenu(null) }}
                />
            )}

            {/* Template overwrite confirmation dialog */}
            <Dialog open={!!pendingTemplate} onOpenChange={(open) => { if (!open) setPendingTemplate(null) }}>
                <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-none sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="font-black text-base">Ganti Proses dengan Template?</DialogTitle>
                        <DialogDescription className="text-zinc-500 text-sm">
                            Sudah ada {steps.length} proses di canvas. Menggunakan template akan <span className="font-bold text-red-600">menghapus semua proses saat ini</span> dan menggantinya dengan template baru.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex gap-2 sm:gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setPendingTemplate(null)}
                            className="border-2 border-black rounded-none font-bold"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={() => pendingTemplate && applyTemplateNow(pendingTemplate)}
                            className="bg-black text-white rounded-none font-bold hover:bg-zinc-800"
                        >
                            Ya, Ganti Semua
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Template Manager Dialog */}
            <TemplateManagerDialog
                open={showTemplateManager}
                onClose={() => setShowTemplateManager(false)}
                onApply={(types) => handleApplyTemplate(types as any)}
            />

            {/* SPK Progress / Result Dialog */}
            <Dialog open={!!spkProgress || !!spkResult} onOpenChange={(open) => { if (!open && !spkProgress) setSpkResult(null) }}>
                <DialogContent className="border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] rounded-none sm:max-w-lg">
                    {spkProgress ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="font-black text-lg">Membuat SPK...</DialogTitle>
                                <DialogDescription className="text-zinc-500 text-sm">Mohon tunggu, sedang memproses</DialogDescription>
                            </DialogHeader>
                            <div className="flex flex-col items-center py-8 gap-4">
                                <div className="relative">
                                    <div className="h-16 w-16 border-4 border-zinc-200 border-t-orange-500 rounded-full animate-spin" />
                                    <Zap className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-6 w-6 text-orange-500" />
                                </div>
                                <p className="font-bold text-sm text-zinc-700 animate-pulse">{spkProgress}</p>
                            </div>
                        </>
                    ) : spkResult ? (
                        <>
                            <DialogHeader>
                                <DialogTitle className="font-black text-lg flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    SPK Berhasil Dibuat
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 text-sm">
                                    Surat Perintah Kerja siap diunduh ({spkResult.workOrders.length} proses)
                                </DialogDescription>
                            </DialogHeader>

                            {/* PDF Preview / Download Section */}
                            <div className="border-2 border-black bg-orange-50 p-4 flex items-center gap-4">
                                <div className="bg-orange-500 text-white p-3 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                                    <FileDown className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-black text-sm">Dokumen SPK (PDF)</p>
                                    <p className="text-[10px] text-zinc-500 font-mono truncate">
                                        SPK-{bom?.product?.code}-{bom?.version}.pdf
                                    </p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="border-2 border-black rounded-none font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        onClick={() => window.open(`/api/documents/spk/${spkResult.bomId}?disposition=inline`, '_blank')}
                                    >
                                        Lihat
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-orange-500 hover:bg-orange-600 text-white border-2 border-black rounded-none font-bold text-xs shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                        onClick={() => {
                                            const a = document.createElement('a')
                                            a.href = `/api/documents/spk/${spkResult.bomId}`
                                            a.download = `SPK-${bom?.product?.code}-${bom?.version}.pdf`
                                            a.click()
                                        }}
                                    >
                                        <FileDown className="h-3.5 w-3.5 mr-1" />
                                        Unduh
                                    </Button>
                                </div>
                            </div>

                            {/* Work Orders Summary */}
                            <div className="space-y-1">
                                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Work Orders ({spkResult.workOrders.length})</p>
                                <div className="max-h-[200px] overflow-y-auto space-y-1">
                                    {spkResult.workOrders.map((wo: any, i: number) => (
                                        <div key={wo.id || i} className="flex items-center gap-3 px-3 py-1.5 bg-zinc-50 border border-zinc-200">
                                            <span className="bg-black text-white text-[9px] font-black px-1.5 py-0.5 shrink-0">{wo.stepSequence}</span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[11px] font-bold truncate">
                                                    {wo.stationName}
                                                    {wo.allocStationName && wo.allocStationName !== wo.stationName && (
                                                        <span className="text-zinc-400 font-normal ml-1">
                                                            &rarr; {wo.allocStationName}
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-[9px] text-zinc-400 font-mono">{wo.number}</p>
                                            </div>
                                            <span className="text-[11px] font-bold text-emerald-600">{wo.plannedQty} pcs</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <DialogFooter className="flex gap-2 sm:gap-2">
                                <Button
                                    onClick={() => setSpkResult(null)}
                                    variant="outline"
                                    className="font-bold border-2 border-black rounded-none"
                                >
                                    Tutup
                                </Button>
                                <Button
                                    onClick={() => {
                                        setSpkResult(null)
                                        router.push("/manufacturing/orders")
                                    }}
                                    className="bg-black hover:bg-zinc-800 text-white font-bold border-2 border-black rounded-none shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                                >
                                    Lihat Perintah Kerja
                                </Button>
                            </DialogFooter>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>

        </div>
    )
}
