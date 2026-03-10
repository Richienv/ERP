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
import { calcTotalMaterialCost, calcTotalLaborCost, type BOMItemWithCost } from "@/components/manufacturing/bom/bom-cost-helpers"
import { toast } from "sonner"
import {
    ArrowLeft, Save, Loader2, Plus, Zap, Package,
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, PackageIcon, Wrench, Cog, FileDown,
    Clock, Copy, LayoutTemplate, History, GitBranch, CheckCircle2, ChevronDown, Calculator,
} from "lucide-react"
import { BOMCostCard } from "@/components/manufacturing/bom/bom-cost-card"
import { getIconByName, getColorTheme } from "@/components/manufacturing/bom/station-config"

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
    const [spkProgress, setSpkProgress] = useState<string | null>(null)
    const [spkResult, setSpkResult] = useState<{ workOrders: any[]; bomId: string } | null>(null)
    const initialized = useRef(false)
    const [isDirty, setIsDirty] = useState(false)

    // Unsaved changes warning — browser close/refresh
    useEffect(() => {
        if (!isDirty) return
        const handler = (e: BeforeUnloadEvent) => {
            e.preventDefault()
            return ""
        }
        window.addEventListener("beforeunload", handler)
        return () => window.removeEventListener("beforeunload", handler)
    }, [isDirty])

    // Dialogs
    const [addMaterialOpen, setAddMaterialOpen] = useState(false)
    const [addStationDialogOpen, setAddStationDialogOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)

    // Cost breakdown panel
    const [costCardOpen, setCostCardOpen] = useState(false)

    // View mode: canvas or timeline
    const [viewMode, setViewMode] = useState<"canvas" | "timeline">("canvas")

    // Context menu
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; stepId: string } | null>(null)

    // Initialize local state from fetched BOM data
    if (bom && !initialized.current) {
        initialized.current = true
        setItems(bom.items || [])
        setSteps(bom.steps || []) // init only — not dirty
        setTotalQty(bom.totalProductionQty || 0)
        setIsDirty(false)
    }

    // Dirty-tracking wrappers
    const dirtySetItems: typeof setItems = useCallback((v) => { setItems(v); setIsDirty(true) }, [])
    const dirtySetSteps: typeof setSteps = useCallback((v) => { setSteps(v); setIsDirty(true) }, [])
    const dirtySetTotalQty = useCallback((v: number) => { setTotalQty(v); setIsDirty(true) }, [])

    const selectedStep = steps.find((s) => s.id === selectedStepId) || null

    const costSummary = useMemo(() => {
        const totalMaterial = calcTotalMaterialCost(items as BOMItemWithCost[], totalQty)
        const totalLabor = calcTotalLaborCost(steps, totalQty)
        const grandTotal = totalMaterial + totalLabor
        const perUnit = totalQty > 0 ? grandTotal / totalQty : 0
        const totalDuration = steps.reduce((sum, s) => sum + ((s.durationMinutes || 0) * totalQty), 0)
        // Time estimates — durationMinutes is per-piece, multiply by totalQty for total
        const estTimeTotalMin = steps.reduce((sum, s) => sum + ((Number(s.durationMinutes) || 0) * totalQty), 0)
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
        // Per-piece total = sum of all step durations (each step's durationMinutes is already per-piece)
        const durationPerPiece = steps.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0)
        return { totalMaterial, totalLabor, grandTotal, perUnit, totalDuration, durationPerPiece, estTimeLabel, progressPct }
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
        dirtySetItems((prev) => [...prev, { id: tempId, ...newItem }])
    }, [dirtySetItems])

    const handleRemoveItem = useCallback((itemId: string) => {
        dirtySetItems((prev) => prev.filter((i) => i.id !== itemId))
        // Also remove from all steps
        dirtySetSteps((prev) => prev.map((step) => ({
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

        dirtySetSteps((prev) => {
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
    }, [allStations, steps.length])

    // Quick-add station by type: if >1 station of same type exists, show picker
    const [creatingStationType, setCreatingStationType] = useState<string | null>(null)
    const [stationPickerType, setStationPickerType] = useState<string | null>(null)

    // Build dynamic process types: fixed types + custom OTHER types from allStations
    const dynamicProcessTypes = useMemo(() => {
        const fixed = [...STATION_TYPE_CONFIG].map(cfg => ({ ...cfg, isCustom: false, description: null as string | null }))

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
                dirtySetSteps((prev) => {
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
    }, [allStations, handleAddStationToCanvas, queryClient])

    // Apply a process template (adds multiple connected stations)
    const [applyingTemplate, setApplyingTemplate] = useState(false)
    const [templateConfirm, setTemplateConfirm] = useState<{ types: readonly string[] } | null>(null)
    const handleApplyTemplate = useCallback(async (types: readonly string[]) => {
        // If steps already exist, ask for confirmation first
        if (steps.length > 0 && !templateConfirm) {
            setTemplateConfirm({ types })
            return
        }
        setTemplateConfirm(null)
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
    }, [allStations, queryClient, steps.length, templateConfirm])

    const handleRemoveStep = useCallback((stepId: string) => {
        dirtySetSteps((prev) => {
            const filtered = prev.filter((s) => s.id !== stepId)
            // Re-sequence + remove deleted step from parentStepIds
            return filtered.map((s, i) => ({
                ...s,
                sequence: i + 1,
                parentStepIds: (s.parentStepIds || []).filter((id: string) => id !== stepId),
            }))
        })
        if (selectedStepId === stepId) setSelectedStepId(null)
    }, [selectedStepId])

    const handleDropMaterial = useCallback((stepId: string, bomItemId: string) => {
        dirtySetSteps((prev) => prev.map((step) => {
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
        dirtySetSteps((prev) => prev.map((step) => {
            if (step.id !== stepId) return step
            return {
                ...step,
                materials: (step.materials || []).filter((m: any) => m.bomItemId !== bomItemId),
            }
        }))
    }, [])

    const handleUpdateStep = useCallback((field: string, value: any) => {
        if (!selectedStepId) return
        dirtySetSteps((prev) => prev.map((step) =>
            step.id === selectedStepId ? { ...step, [field]: value } : step
        ))
    }, [selectedStepId])

    const handleChangeStation = useCallback((stationId: string, station: any) => {
        if (!selectedStepId) return
        dirtySetSteps((prev) => prev.map((step) =>
            step.id === selectedStepId ? { ...step, stationId, station } : step
        ))
    }, [selectedStepId])

    const handleUpdateAllocations = useCallback((allocations: any[]) => {
        if (!selectedStepId) return
        dirtySetSteps((prev) => prev.map((step) =>
            step.id === selectedStepId ? { ...step, allocations } : step
        ))
    }, [selectedStepId])

    const handleToggleSubkon = useCallback((useSubkon: boolean) => {
        if (!selectedStepId) return
        dirtySetSteps((prev) => prev.map((step) =>
            step.id === selectedStepId
                ? { ...step, useSubkon, allocations: useSubkon ? (step.allocations || []) : [] }
                : step
        ))
    }, [selectedStepId])

    // --- DAG EDGE HANDLERS ---
    const handleConnectSteps = useCallback((sourceId: string, targetId: string) => {
        dirtySetSteps(prev => prev.map(step =>
            step.id === targetId
                ? { ...step, parentStepIds: [...new Set([...(step.parentStepIds || []), sourceId])] }
                : step
        ))
    }, [])

    const handleDisconnectSteps = useCallback((sourceId: string, targetId: string) => {
        dirtySetSteps(prev => prev.map(step =>
            step.id === targetId
                ? { ...step, parentStepIds: (step.parentStepIds || []).filter((id: string) => id !== sourceId) }
                : step
        ))
    }, [])

    // --- CONTEXT MENU HANDLERS ---
    const handleNodeContextMenu = useCallback((stepId: string, pos: { clientX: number; clientY: number }) => {
        setContextMenu({ x: pos.clientX, y: pos.clientY, stepId })
    }, [])

    const handleDuplicateStep = useCallback((stepId: string) => {
        const source = steps.find((s) => s.id === stepId)
        if (!source) return

        const tempId = `step-${Date.now()}`
        dirtySetSteps((prev) => {
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
    }, [steps])

    // Add a parallel step — same parents as the clicked step (sibling, not child)
    const handleAddParallel = useCallback((stepId: string) => {
        const source = steps.find((s) => s.id === stepId)
        if (!source) return

        const tempId = `step-par-${Date.now()}`
        dirtySetSteps((prev) => {
            const newSequence = prev.length + 1
            return [...prev, {
                id: tempId,
                stationId: source.stationId,
                station: source.station,
                sequence: newSequence,
                durationMinutes: source.durationMinutes,
                notes: null,
                // Same parents = parallel sibling
                parentStepIds: [...(source.parentStepIds || [])],
                materials: [],
                allocations: [],
                attachments: [],
            }]
        })
        toast.success("Proses paralel ditambahkan — ganti work center di panel detail")
    }, [steps])

    const handleAddSequential = useCallback((stepId: string) => {
        const source = steps.find((s) => s.id === stepId)
        if (!source) return

        const tempId = `step-seq-${Date.now()}`
        dirtySetSteps((prev) => {
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
    }, [steps])

    // --- CANVAS POSITION HANDLER ---
    const handleNodePositionChange = useCallback((stepId: string, x: number, y: number) => {
        dirtySetSteps(prev => prev.map(s =>
            s.id === stepId ? { ...s, positionX: x, positionY: y } : s
        ))
    }, [])

    // --- TIMELINE DRAG HANDLERS ---
    // Move block on timeline: sets startOffsetMinutes + lane without destroying DAG edges
    const handleMoveStep = useCallback((stepId: string, startOffsetMinutes: number, lane?: number) => {
        dirtySetSteps(prev => prev.map(s =>
            s.id === stepId ? { ...s, startOffsetMinutes, ...(lane != null ? { manualLane: lane } : {}) } : s
        ))
    }, [])

    const handleMarkStarted = useCallback((stepId: string) => {
        dirtySetSteps((prev) => prev.map((step) =>
            step.id === stepId ? { ...step, startedAt: new Date().toISOString() } : step
        ))
        toast.success("Work center ditandai mulai")
    }, [])

    const handleMarkCompleted = useCallback((stepId: string) => {
        dirtySetSteps((prev) => {
            const step = prev.find(s => s.id === stepId)
            if (!step) return prev
            const target = calcStepTarget(step, prev, totalQty)
            return prev.map(s => s.id === stepId
                ? { ...s, completedAt: new Date().toISOString(), completedQty: target }
                : s
            )
        })
        toast.success("Work center ditandai selesai")
    }, [totalQty])

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
                    dirtySetSteps((prev) => prev.map((step) =>
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
                dirtySetSteps((prev) => prev.map((step) => ({
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
                id: item.id, // For ID mapping on server
                materialId: item.materialId || item.material?.id,
                quantityPerUnit: Number(item.quantityPerUnit),
                unit: item.unit || item.material?.unit || null,
                wastePct: Number(item.wastePct || 0),
                notes: item.notes || null,
            })),
            // C1 fix: normalize sequences to 1..N to prevent collisions
            steps: steps.map((step, idx) => ({
                id: step.id, // Used for parentStepIds mapping on server
                stationId: step.stationId || step.station?.id,
                sequence: idx + 1,
                durationMinutes: step.durationMinutes || null,
                notes: step.notes || null,
                parentStepIds: step.parentStepIds || [],
                startOffsetMinutes: step.startOffsetMinutes ?? 0,
                useSubkon: step.useSubkon ?? null,
                subkonProcessType: step.subkonProcessType || null,
                operatorName: step.operatorName || null,
                laborMonthlySalary: step.laborMonthlySalary ?? null,
                estimatedTimePerUnit: step.estimatedTimePerUnit ?? null,
                actualTimeTotal: step.actualTimeTotal ?? null,
                completedQty: step.completedQty ?? 0,
                startedAt: step.startedAt || null,
                completedAt: step.completedAt || null,
                positionX: step.positionX ?? null,
                positionY: step.positionY ?? null,
                materialProductIds: (step.materials || []).map((m: any) => {
                    const item = items.find((i) => i.id === m.bomItemId)
                    return item?.materialId || item?.material?.id
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
                    setItems(prev => prev.map(item => ({
                        ...item,
                        id: mapping.itemIdMap![item.id] || item.id,
                    })))
                }
                if (mapping.stepIdMap && Object.keys(mapping.stepIdMap).length > 0) {
                    setSteps(prev => prev.map(step => ({
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
            setIsDirty(false)
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
            if (ok) toast.success("BOM berhasil disimpan")
        } catch {
            toast.error("Terjadi kesalahan saat menyimpan")
        } finally {
            setSaving(false)
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
            const pdfCheck = await fetch(`/api/documents/spk/${id}`, { method: "HEAD" }).catch(() => null)

            setSpkProgress(null)
            setSpkResult({ workOrders: result.data || [], bomId: id })
            queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all })
            queryClient.invalidateQueries({ queryKey: queryKeys.spkOrders.all })
        } catch {
            setSpkProgress(null)
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
                        onClick={() => {
                            if (isDirty) {
                                if (!window.confirm("Ada perubahan yang belum disimpan. Yakin ingin keluar tanpa menyimpan?")) return
                            }
                            router.push("/manufacturing/bom")
                        }}
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
                            onChange={(e) => dirtySetTotalQty(parseInt(e.target.value) || 0)}
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
                        <Plus className="mr-1 h-3.5 w-3.5" /> Work Center Kustom
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/api/manufacturing/production-bom/${id}/pdf`, "_blank")}
                        className="h-8 font-bold text-[10px] uppercase border-2 border-black rounded-none"
                    >
                        <FileDown className="mr-1 h-3.5 w-3.5" /> PDF
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateSPK}
                        disabled={generating || !spkReadiness.ready}
                        title={spkReadiness.ready ? "Semua siap — klik untuk generate SPK" : `Belum siap:\n${spkReadiness.issues.join('\n')}`}
                        className={`h-8 font-black text-[10px] uppercase border-2 rounded-none ${spkReadiness.ready
                                ? "border-orange-500 text-orange-600 hover:bg-orange-50"
                                : "border-zinc-300 text-zinc-400 hover:bg-zinc-50"
                            }`}
                    >
                        {generating ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Zap className="mr-1 h-3.5 w-3.5" />}
                        Generate SPK
                        {!spkReadiness.ready && steps.length > 0 && (
                            <span className="ml-1.5 bg-red-500 text-white text-[8px] font-black rounded-full h-4 w-4 flex items-center justify-center">
                                {spkReadiness.issues.length}
                            </span>
                        )}
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

            {/* TOOLBAR — Row 2: Quick-Add + Templates + View Toggle */}
            <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-1 flex items-center gap-1.5 shrink-0 overflow-x-auto">
                <span className="text-[9px] font-black uppercase text-zinc-400 mr-1 shrink-0">Tambah Proses:</span>
                {dynamicProcessTypes.map((cfg) => {
                    const Icon = cfg.icon
                    const isCreating = creatingStationType === cfg.type
                    const isPicking = stationPickerType === cfg.type
                    const isCustom = cfg.isCustom
                    const candidates = (allStations || []).filter((s: any) => {
                        if (s.operationType === "SUBCONTRACTOR" || s.isActive === false) return false
                        if (isCustom) return s.stationType === "OTHER" && s.description === cfg.description
                        return s.stationType === cfg.type
                    })
                    const hasMultiple = candidates.length > 1

                    return (
                        <Popover key={cfg.type} open={isPicking} onOpenChange={(open) => { if (!open) setStationPickerType(null) }}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isCreating}
                                    onClick={() => handleQuickAddByType(cfg.type, cfg.description)}
                                    className={`h-7 text-[10px] font-bold border rounded-none shrink-0 px-2.5 gap-1 ${cfg.color}`}
                                >
                                    {isCreating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" />}
                                    {cfg.label}
                                    {hasMultiple && <span className="text-[8px] opacity-60">({candidates.length})</span>}
                                </Button>
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

                <div className="border-l border-zinc-300 mx-1 h-5 shrink-0" />

                {/* Template Presets */}
                <span className="text-[9px] font-black uppercase text-zinc-400 shrink-0">Template:</span>
                {PROCESS_TEMPLATES.map((tmpl) => (
                    <Button
                        key={tmpl.label}
                        variant="outline"
                        size="sm"
                        disabled={applyingTemplate}
                        onClick={() => handleApplyTemplate(tmpl.types)}
                        className="h-7 text-[10px] font-bold border border-indigo-200 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-none shrink-0 px-2.5 gap-1"
                    >
                        {applyingTemplate ? <Loader2 className="h-3 w-3 animate-spin" /> : <LayoutTemplate className="h-3 w-3" />}
                        {tmpl.label}
                    </Button>
                ))}

                <div className="ml-auto flex items-center gap-1 shrink-0">
                    {/* History button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setHistoryOpen(true)}
                        className="h-7 text-[10px] font-bold rounded-none px-2"
                        title="Riwayat Edit"
                    >
                        <History className="h-3.5 w-3.5" />
                    </Button>

                    {/* View Toggle */}
                    <div className="flex border border-zinc-300 overflow-hidden">
                        <button
                            onClick={() => setViewMode("canvas")}
                            className={`px-2 py-1 text-[9px] font-black uppercase ${viewMode === "canvas" ? "bg-black text-white" : "bg-white text-zinc-500 hover:bg-zinc-100"}`}
                        >
                            Canvas
                        </button>
                        <button
                            onClick={() => setViewMode("timeline")}
                            className={`px-2 py-1 text-[9px] font-black uppercase ${viewMode === "timeline" ? "bg-black text-white" : "bg-white text-zinc-500 hover:bg-zinc-100"}`}
                        >
                            Timeline
                        </button>
                    </div>
                </div>
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
                {costSummary.durationPerPiece > 0 && (
                    <div className="border-l border-zinc-200 pl-3 lg:pl-6 flex items-center gap-1.5 shrink-0">
                        <Clock className="h-3.5 w-3.5 text-blue-500" />
                        <span className="text-[10px] font-bold text-blue-600">
                            {costSummary.durationPerPiece} menit/pcs
                        </span>
                        {costSummary.estTimeLabel && (
                            <span className="text-[9px] text-zinc-400 font-normal ml-1">
                                (Total: {costSummary.estTimeLabel})
                            </span>
                        )}
                    </div>
                )}
                {costSummary.progressPct > 0 && (
                    <div className="border-l border-zinc-200 pl-3 lg:pl-6 flex items-center gap-1.5 shrink-0">
                        <span className="text-[9px] font-black uppercase text-zinc-400">Progress:</span>
                        <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-16 bg-zinc-200 rounded-full overflow-hidden">
                                <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${costSummary.progressPct}%` }} />
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-700">{costSummary.progressPct}%</span>
                        </div>
                    </div>
                )}
                <div className="border-l-2 border-black pl-3 lg:pl-6 flex items-center gap-1.5 shrink-0">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Total ({totalQty} pcs):</span>
                    <span className="text-sm font-black text-emerald-700">{formatCurrency(costSummary.grandTotal)}</span>
                </div>
                <button
                    onClick={() => setCostCardOpen(!costCardOpen)}
                    className="border-l border-zinc-200 pl-3 lg:pl-6 flex items-center gap-1 shrink-0 text-[9px] font-black uppercase text-emerald-600 hover:text-emerald-800 transition-colors"
                >
                    <Calculator className="h-3 w-3" />
                    Detail HPP
                    <ChevronDown className={`h-3 w-3 transition-transform ${costCardOpen ? "rotate-180" : ""}`} />
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
                        items={items}
                    />
                </div>
            )}

            {/* SPK READINESS WARNING */}
            {!spkReadiness.ready && steps.length > 0 && (
                <div className="border-b border-red-200 bg-red-50 px-4 py-1.5 flex items-center gap-2 shrink-0">
                    <span className="bg-red-500 text-white text-[8px] font-black rounded-full h-4 w-4 flex items-center justify-center shrink-0">!</span>
                    <span className="text-[10px] font-bold text-red-700">
                        SPK belum siap: {spkReadiness.issues.join(' · ')}
                    </span>
                </div>
            )}

            {/* MAIN CONTENT */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Material Panel */}
                <MaterialPanel
                    items={items}
                    steps={steps}
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
                        />
                    ) : (
                        <TimelineView
                            steps={steps}
                            totalQty={totalQty}
                            selectedStepId={selectedStepId}
                            onStepSelect={setSelectedStepId}
                            onMoveStep={handleMoveStep}
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

            {/* Template overwrite confirmation */}
            <Dialog open={!!templateConfirm} onOpenChange={(open) => { if (!open) setTemplateConfirm(null) }}>
                <DialogContent className="sm:max-w-[420px] rounded-none border-2 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
                    <DialogHeader>
                        <DialogTitle className="font-black uppercase">Ganti Proses?</DialogTitle>
                        <DialogDescription className="text-sm">
                            Form sudah berisi {steps.length} proses. Menerapkan template akan <strong>menghapus semua proses saat ini</strong> dan menggantinya dengan template baru.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            variant="outline"
                            onClick={() => setTemplateConfirm(null)}
                            className="rounded-none border-2 border-black font-bold"
                        >
                            Batal
                        </Button>
                        <Button
                            onClick={() => {
                                if (templateConfirm) handleApplyTemplate(templateConfirm.types)
                            }}
                            className="rounded-none border-2 border-black bg-orange-500 hover:bg-orange-600 text-white font-black"
                        >
                            Ya, Ganti Semua
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
