"use client"

import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BOMItem {
  id: string
  materialId: string
  quantityPerUnit: number
  unit?: string
  wastePct: number
  notes?: string
  snapshotCostPrice?: number | null
  material: {
    id: string
    code: string
    name: string
    unit?: string
    costPrice?: number | null
  }
  stepMaterials: { stepId: string }[]
}

export interface BOMStep {
  id: string
  stationId: string
  sequence: number
  durationMinutes?: number | null
  notes?: string | null
  parentStepIds: string[]
  startOffsetMinutes: number
  positionX?: number | null
  positionY?: number | null
  useSubkon?: boolean | null
  subkonProcessType?: string | null
  operatorName?: string | null
  laborMonthlySalary?: number | null
  completedQty: number
  station: {
    id: string
    code: string
    name: string
    stationType: string
    operationType?: string | null
    costPerUnit?: number | null
    iconName?: string | null
    colorTheme?: string | null
    subcontractor?: { id: string; name: string } | null
    group?: { id: string; name: string } | null
  }
  materials: {
    bomItemId: string
    bomItem: {
      material: {
        id: string
        code: string
        name: string
        unit?: string | null
        costPrice?: number | null
      }
    }
  }[]
  allocations: {
    id?: string
    stationId: string
    quantity: number
    pricePerPcs?: number | null
    notes?: string | null
    station?: {
      id: string
      code: string
      name: string
      operationType?: string | null
      subcontractor?: { name: string } | null
    } | null
  }[]
  attachments: {
    id: string
    fileName: string
    fileUrl: string
    fileType: string
    fileSize: number
  }[]
}

export interface BOMProduct {
  id: string
  code: string
  name: string
  unit?: string | null
  sellingPrice?: number | null
  costPrice?: number | null
}

interface BOMCanvasContextType {
  // Data
  bomId: string
  product: BOMProduct | null
  items: BOMItem[]
  steps: BOMStep[]
  totalQty: number
  isDirty: boolean
  selectedStepId: string | null
  viewMode: "canvas" | "timeline"
  isSaving: boolean
  hasSPK: boolean

  // Setters
  setItems: (items: BOMItem[]) => void
  setSteps: (steps: BOMStep[]) => void
  setTotalQty: (qty: number) => void
  setSelectedStepId: (id: string | null) => void
  setViewMode: (mode: "canvas" | "timeline") => void
  setDirty: (dirty: boolean) => void
  setHasSPK: (has: boolean) => void

  // Actions
  addStep: (step: BOMStep) => void
  removeStep: (stepId: string) => void
  updateStep: (stepId: string, updates: Partial<BOMStep>) => void
  addItem: (item: BOMItem) => void
  removeItem: (itemId: string) => void
  assignMaterialToStep: (bomItemId: string, stepId: string) => void
  removeMaterialFromStep: (bomItemId: string, stepId: string) => void
  addConnection: (fromStepId: string, toStepId: string) => void
  removeConnection: (fromStepId: string, toStepId: string) => void
  moveStepOffset: (stepId: string, startMin: number) => void
  saveCanvas: () => Promise<void>
  initFromServer: (data: {
    product: BOMProduct
    items: BOMItem[]
    steps: BOMStep[]
    totalProductionQty: number
  }) => void
}

const BOMCanvasContext = createContext<BOMCanvasContextType | undefined>(undefined)

export function BOMCanvasProvider({
  bomId,
  children,
}: {
  bomId: string
  children: ReactNode
}) {
  const queryClient = useQueryClient()

  const [product, setProduct] = useState<BOMProduct | null>(null)
  const [items, setItemsRaw] = useState<BOMItem[]>([])
  const [steps, setStepsRaw] = useState<BOMStep[]>([])
  const [totalQty, setTotalQtyRaw] = useState(0)
  const [isDirty, setDirty] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"canvas" | "timeline">("canvas")
  const [isSaving, setIsSaving] = useState(false)
  const [hasSPK, setHasSPK] = useState(false)

  // Warn on close if dirty
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  const initFromServer = useCallback((data: {
    product: BOMProduct
    items: BOMItem[]
    steps: BOMStep[]
    totalProductionQty: number
  }) => {
    setProduct(data.product)
    setItemsRaw(data.items)
    setStepsRaw(data.steps)
    setTotalQtyRaw(data.totalProductionQty)
    setDirty(false)
  }, [])

  const setItems = useCallback((next: BOMItem[]) => { setItemsRaw(next); setDirty(true) }, [])
  const setSteps = useCallback((next: BOMStep[]) => { setStepsRaw(next); setDirty(true) }, [])
  const setTotalQty = useCallback((qty: number) => { setTotalQtyRaw(qty); setDirty(true) }, [])

  const addStep = useCallback((step: BOMStep) => {
    setStepsRaw((prev) => [...prev, step])
    setDirty(true)
  }, [])

  const removeStep = useCallback((stepId: string) => {
    setStepsRaw((prev) =>
      prev
        .filter((s) => s.id !== stepId)
        .map((s) => ({ ...s, parentStepIds: s.parentStepIds.filter((p) => p !== stepId) }))
    )
    setSelectedStepId((prev) => (prev === stepId ? null : prev))
    setDirty(true)
  }, [])

  const updateStep = useCallback((stepId: string, updates: Partial<BOMStep>) => {
    setStepsRaw((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s)))
    setDirty(true)
  }, [])

  const addItem = useCallback((item: BOMItem) => {
    setItemsRaw((prev) => [...prev, item])
    setDirty(true)
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItemsRaw((prev) => prev.filter((i) => i.id !== itemId))
    setStepsRaw((prev) =>
      prev.map((s) => ({ ...s, materials: s.materials.filter((m) => m.bomItemId !== itemId) }))
    )
    setDirty(true)
  }, [])

  const assignMaterialToStep = useCallback((bomItemId: string, stepId: string) => {
    setItemsRaw((currentItems) => {
      setStepsRaw((prev) =>
        prev.map((s) => {
          if (s.id !== stepId) return s
          if (s.materials.find((m) => m.bomItemId === bomItemId)) return s
          const item = currentItems.find((i) => i.id === bomItemId)
          if (!item) return s
          return {
            ...s,
            materials: [
              ...s.materials,
              {
                bomItemId,
                bomItem: {
                  material: {
                    id: item.material.id,
                    code: item.material.code,
                    name: item.material.name,
                    unit: item.material.unit,
                    costPrice: item.material.costPrice,
                  },
                },
              },
            ],
          }
        })
      )
      return currentItems
    })
    setDirty(true)
  }, [])

  const removeMaterialFromStep = useCallback((bomItemId: string, stepId: string) => {
    setStepsRaw((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, materials: s.materials.filter((m) => m.bomItemId !== bomItemId) }
          : s
      )
    )
    setDirty(true)
  }, [])

  const addConnection = useCallback((fromStepId: string, toStepId: string) => {
    setStepsRaw((prev) =>
      prev.map((s) =>
        s.id === toStepId && !s.parentStepIds.includes(fromStepId)
          ? { ...s, parentStepIds: [...s.parentStepIds, fromStepId] }
          : s
      )
    )
    setDirty(true)
  }, [])

  const removeConnection = useCallback((fromStepId: string, toStepId: string) => {
    setStepsRaw((prev) =>
      prev.map((s) =>
        s.id === toStepId
          ? { ...s, parentStepIds: s.parentStepIds.filter((p) => p !== fromStepId) }
          : s
      )
    )
    setDirty(true)
  }, [])

  const moveStepOffset = useCallback((stepId: string, startMin: number) => {
    setStepsRaw((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, startOffsetMinutes: Math.max(0, startMin) } : s))
    )
    setDirty(true)
  }, [])

  const saveCanvas = useCallback(async () => {
    setIsSaving(true)
    try {
      const payload = {
        totalProductionQty: totalQty,
        items: items.map((item) => ({
          materialId: item.materialId,
          quantityPerUnit: item.quantityPerUnit,
          wastePct: item.wastePct,
          unit: item.unit,
          notes: item.notes,
        })),
        steps: steps.map((step) => ({
          stationId: step.stationId,
          sequence: step.sequence,
          durationMinutes: step.durationMinutes,
          notes: step.notes,
          parentStepIds: step.parentStepIds,
          startOffsetMinutes: step.startOffsetMinutes,
          positionX: step.positionX,
          positionY: step.positionY,
          useSubkon: step.useSubkon,
          subkonProcessType: step.subkonProcessType,
          operatorName: step.operatorName,
          laborMonthlySalary: step.laborMonthlySalary,
          materialProductIds: step.materials.map((m) => m.bomItemId),
          allocations: step.allocations.map((a) => ({
            stationId: a.stationId,
            quantity: a.quantity,
            pricePerPcs: a.pricePerPcs,
            notes: a.notes,
          })),
        })),
      }

      const res = await fetch(`/api/manufacturing/production-bom/${bomId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error("Gagal menyimpan")

      try { localStorage.removeItem(`bom-draft-${bomId}`) } catch {}

      setDirty(false)
      queryClient.invalidateQueries({ queryKey: queryKeys.productionBom.detail(bomId) })
      toast.success("BOM berhasil disimpan")
    } catch (err) {
      toast.error("Gagal menyimpan BOM")
      console.error(err)
    } finally {
      setIsSaving(false)
    }
  }, [bomId, items, steps, totalQty, queryClient])

  const value = useMemo<BOMCanvasContextType>(() => ({
    bomId, product, items, steps, totalQty, isDirty, selectedStepId, viewMode, isSaving, hasSPK,
    setItems, setSteps, setTotalQty, setSelectedStepId, setViewMode, setDirty, setHasSPK,
    addStep, removeStep, updateStep, addItem, removeItem,
    assignMaterialToStep, removeMaterialFromStep,
    addConnection, removeConnection, moveStepOffset,
    saveCanvas, initFromServer,
  }), [
    bomId, product, items, steps, totalQty, isDirty, selectedStepId, viewMode, isSaving, hasSPK,
    setItems, setSteps, setTotalQty, setSelectedStepId, setViewMode, setDirty, setHasSPK,
    addStep, removeStep, updateStep, addItem, removeItem,
    assignMaterialToStep, removeMaterialFromStep,
    addConnection, removeConnection, moveStepOffset,
    saveCanvas, initFromServer,
  ])

  return <BOMCanvasContext.Provider value={value}>{children}</BOMCanvasContext.Provider>
}

export function useBOMCanvas() {
  const ctx = useContext(BOMCanvasContext)
  if (!ctx) throw new Error("useBOMCanvas must be used within BOMCanvasProvider")
  return ctx
}
