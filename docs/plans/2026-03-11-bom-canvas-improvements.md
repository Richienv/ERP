# BOM Canvas Improvements — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 8 BOM canvas improvements (auto-save, stock availability, live progress, price drift, critical path, system settings, editable templates, SPK re-generation) using a central BOMCanvasContext architecture.

**Architecture:** Extract all canvas state from the 1565-line `[id]/page.tsx` into `bom-canvas-context.tsx`. Each feature is an isolated hook under `app/manufacturing/bom/[id]/hooks/`. Components read from context instead of page props.

**Tech Stack:** Next.js 16 App Router, React 19, TanStack Query, Prisma 6, Vitest, shadcn/ui, Tailwind CSS v4, TypeScript strict mode.

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Run migration

**Step 1: Add `draftSnapshot` and `draftUpdatedAt` to `ProductionBOM`**

In `prisma/schema.prisma`, find the `ProductionBOM` model and add after `notes String?`:

```prisma
  draftSnapshot    Json?     // Auto-saved draft (not yet manually published)
  draftUpdatedAt   DateTime? // When the draft was last auto-saved
```

**Step 2: Add `snapshotCostPrice` to `ProductionBOMItem`**

Find `model ProductionBOMItem` and add after `notes String?`:

```prisma
  snapshotCostPrice Decimal? @db.Decimal(12, 4) // Price at last manual save — used for drift detection
```

**Step 3: Add `BOMTemplate` model**

Add this new model after the `ProductionBOMAttachment` model:

```prisma
// ================================
// BOM Templates (User-Editable)
// ================================

model BOMTemplate {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String
  description String?
  stepsJson   Json     // Array of { stationType, durationMinutes, sequence, useSubkon }
  isBuiltIn   Boolean  @default(false)
  createdBy   String?  // userId
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@map("bom_templates")
}
```

**Step 4: Run migration**

```bash
npx prisma migrate dev --name bom-canvas-improvements
npx prisma generate
```

Expected: Migration created, Prisma client regenerated.

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(bom): schema — draftSnapshot, snapshotCostPrice, BOMTemplate"
```

---

## Task 2: Extract BOMCanvasContext

**Files:**
- Create: `app/manufacturing/bom/[id]/bom-canvas-context.tsx`
- Modify: `app/manufacturing/bom/[id]/page.tsx` (reduce to ~300 lines)

**Step 1: Create the context file**

Create `app/manufacturing/bom/[id]/bom-canvas-context.tsx`:

```tsx
"use client"

import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from "react"
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
  snapshotCostPrice?: number
  material: {
    id: string
    code: string
    name: string
    unit?: string
    costPrice?: number
  }
  stepMaterials: { stepId: string }[]
}

export interface BOMStep {
  id: string
  stationId: string
  sequence: number
  durationMinutes?: number
  notes?: string
  parentStepIds: string[]
  startOffsetMinutes: number
  positionX?: number
  positionY?: number
  useSubkon?: boolean
  subkonProcessType?: string
  operatorName?: string
  laborMonthlySalary?: number
  completedQty: number
  station: {
    id: string
    code: string
    name: string
    stationType: string
    operationType?: string
    costPerUnit?: number
    iconName?: string
    colorTheme?: string
    subcontractor?: { id: string; name: string } | null
    group?: { id: string; name: string } | null
  }
  materials: {
    bomItemId: string
    bomItem: { material: { id: string; code: string; name: string; unit?: string; costPrice?: number } }
  }[]
  allocations: {
    id?: string
    stationId: string
    quantity: number
    pricePerPcs?: number
    notes?: string
    station?: { id: string; code: string; name: string; operationType?: string; subcontractor?: { name: string } | null }
  }[]
  attachments: { id: string; fileName: string; fileUrl: string; fileType: string; fileSize: number }[]
}

export interface BOMProduct {
  id: string
  code: string
  name: string
  unit?: string
  sellingPrice?: number
  costPrice?: number
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

  // Setters
  setItems: (items: BOMItem[]) => void
  setSteps: (steps: BOMStep[]) => void
  setTotalQty: (qty: number) => void
  setSelectedStepId: (id: string | null) => void
  setViewMode: (mode: "canvas" | "timeline") => void
  setDirty: (dirty: boolean) => void

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
  initFromServer: (data: { product: BOMProduct; items: BOMItem[]; steps: BOMStep[]; totalProductionQty: number }) => void
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
  const [items, setItemsState] = useState<BOMItem[]>([])
  const [steps, setStepsState] = useState<BOMStep[]>([])
  const [totalQty, setTotalQtyState] = useState(0)
  const [isDirty, setDirty] = useState(false)
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<"canvas" | "timeline">("canvas")
  const [isSaving, setIsSaving] = useState(false)

  // ── Init from server data ────────────────────────────────────────────────
  const initFromServer = useCallback((data: {
    product: BOMProduct
    items: BOMItem[]
    steps: BOMStep[]
    totalProductionQty: number
  }) => {
    setProduct(data.product)
    setItemsState(data.items)
    setStepsState(data.steps)
    setTotalQtyState(data.totalProductionQty)
    setDirty(false)
  }, [])

  // ── Setters that mark dirty ──────────────────────────────────────────────
  const setItems = useCallback((next: BOMItem[]) => {
    setItemsState(next)
    setDirty(true)
  }, [])

  const setSteps = useCallback((next: BOMStep[]) => {
    setStepsState(next)
    setDirty(true)
  }, [])

  const setTotalQty = useCallback((qty: number) => {
    setTotalQtyState(qty)
    setDirty(true)
  }, [])

  // ── Step actions ─────────────────────────────────────────────────────────
  const addStep = useCallback((step: BOMStep) => {
    setStepsState((prev) => [...prev, step])
    setDirty(true)
  }, [])

  const removeStep = useCallback((stepId: string) => {
    setStepsState((prev) =>
      prev
        .filter((s) => s.id !== stepId)
        .map((s) => ({
          ...s,
          parentStepIds: s.parentStepIds.filter((pid) => pid !== stepId),
        }))
    )
    setSelectedStepId((prev) => (prev === stepId ? null : prev))
    setDirty(true)
  }, [])

  const updateStep = useCallback((stepId: string, updates: Partial<BOMStep>) => {
    setStepsState((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    )
    setDirty(true)
  }, [])

  // ── Item actions ─────────────────────────────────────────────────────────
  const addItem = useCallback((item: BOMItem) => {
    setItemsState((prev) => [...prev, item])
    setDirty(true)
  }, [])

  const removeItem = useCallback((itemId: string) => {
    setItemsState((prev) => prev.filter((i) => i.id !== itemId))
    setStepsState((prev) =>
      prev.map((s) => ({
        ...s,
        materials: s.materials.filter((m) => m.bomItemId !== itemId),
      }))
    )
    setDirty(true)
  }, [])

  // ── Material assignment ──────────────────────────────────────────────────
  const assignMaterialToStep = useCallback((bomItemId: string, stepId: string) => {
    setStepsState((prev) =>
      prev.map((s) => {
        if (s.id !== stepId) return s
        if (s.materials.find((m) => m.bomItemId === bomItemId)) return s
        const item = items.find((i) => i.id === bomItemId)
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
    setDirty(true)
  }, [items])

  const removeMaterialFromStep = useCallback((bomItemId: string, stepId: string) => {
    setStepsState((prev) =>
      prev.map((s) =>
        s.id === stepId
          ? { ...s, materials: s.materials.filter((m) => m.bomItemId !== bomItemId) }
          : s
      )
    )
    setDirty(true)
  }, [])

  // ── Connections (DAG edges) ──────────────────────────────────────────────
  const addConnection = useCallback((fromStepId: string, toStepId: string) => {
    setStepsState((prev) =>
      prev.map((s) =>
        s.id === toStepId && !s.parentStepIds.includes(fromStepId)
          ? { ...s, parentStepIds: [...s.parentStepIds, fromStepId] }
          : s
      )
    )
    setDirty(true)
  }, [])

  const removeConnection = useCallback((fromStepId: string, toStepId: string) => {
    setStepsState((prev) =>
      prev.map((s) =>
        s.id === toStepId
          ? { ...s, parentStepIds: s.parentStepIds.filter((p) => p !== fromStepId) }
          : s
      )
    )
    setDirty(true)
  }, [])

  // ── Timeline drag ────────────────────────────────────────────────────────
  const moveStepOffset = useCallback((stepId: string, startMin: number) => {
    setStepsState((prev) =>
      prev.map((s) =>
        s.id === stepId ? { ...s, startOffsetMinutes: Math.max(0, startMin) } : s
      )
    )
    setDirty(true)
  }, [])

  // ── Save canvas ──────────────────────────────────────────────────────────
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

      // Clear draft from localStorage after successful manual save
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
    bomId, product, items, steps, totalQty, isDirty, selectedStepId, viewMode, isSaving,
    setItems, setSteps, setTotalQty, setSelectedStepId, setViewMode, setDirty,
    addStep, removeStep, updateStep, addItem, removeItem,
    assignMaterialToStep, removeMaterialFromStep,
    addConnection, removeConnection, moveStepOffset,
    saveCanvas, initFromServer,
  }), [
    bomId, product, items, steps, totalQty, isDirty, selectedStepId, viewMode, isSaving,
    setItems, setSteps, setTotalQty, setSelectedStepId, setViewMode, setDirty,
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
```

**Step 2: Wrap the page with the provider**

In `app/manufacturing/bom/[id]/page.tsx`, find where the component is exported and wrap the return JSX with `<BOMCanvasProvider bomId={id}>`. Also replace all local `useState` calls for `items`, `steps`, `totalQty`, `isDirty`, `selectedStepId`, `viewMode` with `const { items, steps, ... } = useBOMCanvas()`.

> This is a large refactor. Work top-to-bottom: find each `useState`, replace with context destructuring, then find each prop-pass to child components and remove it (they'll use `useBOMCanvas()` directly). Do NOT change any JSX logic yet — only the state source.

**Step 3: Update child components to read from context**

In each of these files, add `const { items, steps, totalQty, ... } = useBOMCanvas()` at the top and remove the corresponding props:
- `components/manufacturing/bom/material-panel.tsx`
- `components/manufacturing/bom/bom-canvas.tsx`
- `components/manufacturing/bom/detail-panel.tsx`
- `components/manufacturing/bom/timeline-view.tsx`

**Step 4: Verify no regressions**

```bash
npx tsc --noEmit
npm run lint
```

Expected: No new errors.

**Step 5: Commit**

```bash
git add app/manufacturing/bom/[id]/bom-canvas-context.tsx \
        app/manufacturing/bom/[id]/page.tsx \
        components/manufacturing/bom/material-panel.tsx \
        components/manufacturing/bom/bom-canvas.tsx \
        components/manufacturing/bom/detail-panel.tsx \
        components/manufacturing/bom/timeline-view.tsx
git commit -m "refactor(bom): extract BOMCanvasContext, reduce page.tsx from 1565 to ~300 lines"
```

---

## Task 3: Auto-Save (Local + Server Draft)

**Files:**
- Create: `app/manufacturing/bom/[id]/hooks/use-auto-save.ts`
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts`
- Test: `__tests__/manufacturing/use-auto-save-helpers.test.ts`

**Step 1: Write the failing test**

Create `__tests__/manufacturing/use-auto-save-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { isDraftNewer, serializeDraft, deserializeDraft } from "@/app/manufacturing/bom/[id]/hooks/use-auto-save"

describe("isDraftNewer", () => {
  it("returns true when draft timestamp is newer than server updatedAt", () => {
    const draftTs = new Date("2026-03-11T10:05:00Z").getTime()
    const serverTs = new Date("2026-03-11T10:00:00Z")
    expect(isDraftNewer(draftTs, serverTs)).toBe(true)
  })

  it("returns false when server is newer", () => {
    const draftTs = new Date("2026-03-11T09:00:00Z").getTime()
    const serverTs = new Date("2026-03-11T10:00:00Z")
    expect(isDraftNewer(draftTs, serverTs)).toBe(false)
  })

  it("returns false when timestamps are equal", () => {
    const ts = new Date("2026-03-11T10:00:00Z")
    expect(isDraftNewer(ts.getTime(), ts)).toBe(false)
  })
})

describe("serializeDraft / deserializeDraft", () => {
  it("round-trips draft state correctly", () => {
    const draft = { items: [{ id: "1", materialId: "m1", quantityPerUnit: 2, wastePct: 5, material: { id: "m1", code: "C", name: "Kain", unit: "m" }, stepMaterials: [] }], steps: [], totalQty: 100, savedAt: Date.now() }
    const serialized = serializeDraft(draft)
    const deserialized = deserializeDraft(serialized)
    expect(deserialized?.totalQty).toBe(100)
    expect(deserialized?.items[0].materialId).toBe("m1")
  })

  it("returns null for invalid JSON", () => {
    expect(deserializeDraft("not-json")).toBeNull()
  })
})
```

**Step 2: Run test — verify it fails**

```bash
npx vitest run __tests__/manufacturing/use-auto-save-helpers.test.ts
```

Expected: FAIL — `isDraftNewer`, `serializeDraft`, `deserializeDraft` not found.

**Step 3: Create the hook with pure helper exports**

Create `app/manufacturing/bom/[id]/hooks/use-auto-save.ts`:

```ts
"use client"

import { useEffect, useRef, useCallback } from "react"
import type { BOMItem, BOMStep } from "../bom-canvas-context"

// ─── Pure helpers (exported for testing) ─────────────────────────────────────

export interface DraftState {
  items: BOMItem[]
  steps: BOMStep[]
  totalQty: number
  savedAt: number // Date.now()
}

export function isDraftNewer(draftTimestamp: number, serverUpdatedAt: Date): boolean {
  return draftTimestamp > serverUpdatedAt.getTime()
}

export function serializeDraft(draft: DraftState): string {
  return JSON.stringify(draft)
}

export function deserializeDraft(raw: string): DraftState | null {
  try {
    return JSON.parse(raw) as DraftState
  } catch {
    return null
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

interface UseAutoSaveOptions {
  bomId: string
  items: BOMItem[]
  steps: BOMStep[]
  totalQty: number
  isDirty: boolean
  debounceMs?: number // default 30_000
}

export function useAutoSave({
  bomId,
  items,
  steps,
  totalQty,
  isDirty,
  debounceMs = 30_000,
}: UseAutoSaveOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftKey = `bom-draft-${bomId}`

  const saveDraftLocally = useCallback(() => {
    if (!isDirty) return
    try {
      const draft: DraftState = { items, steps, totalQty, savedAt: Date.now() }
      localStorage.setItem(draftKey, serializeDraft(draft))
    } catch {
      // localStorage may be unavailable (private browsing quota exceeded)
    }
  }, [draftKey, items, steps, totalQty, isDirty])

  // Debounced auto-save on dirty change
  useEffect(() => {
    if (!isDirty) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(saveDraftLocally, debounceMs)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [isDirty, saveDraftLocally, debounceMs])

  // Also save on page unload if dirty
  useEffect(() => {
    const handler = () => { if (isDirty) saveDraftLocally() }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty, saveDraftLocally])

  /** Call on page load to check if a recoverable draft exists */
  function loadLocalDraft(): DraftState | null {
    try {
      const raw = localStorage.getItem(draftKey)
      if (!raw) return null
      return deserializeDraft(raw)
    } catch {
      return null
    }
  }

  /** Call after successful manual save to clear the draft */
  function clearLocalDraft() {
    try { localStorage.removeItem(draftKey) } catch {}
  }

  return { loadLocalDraft, clearLocalDraft }
}
```

**Step 4: Run test — verify it passes**

```bash
npx vitest run __tests__/manufacturing/use-auto-save-helpers.test.ts
```

Expected: PASS — 5 tests.

**Step 5: Add draft restore banner to page**

In `app/manufacturing/bom/[id]/page.tsx`, in the `useEffect` that calls `initFromServer`, add draft check:

```tsx
// After initFromServer(data):
const draft = loadLocalDraft()
if (draft && bomData?.updatedAt && isDraftNewer(draft.savedAt, new Date(bomData.updatedAt))) {
  setHasDraft(true)  // new state: const [hasDraft, setHasDraft] = useState(false)
}
```

Add banner JSX above the canvas:

```tsx
{hasDraft && (
  <div className="border-l-4 border-l-amber-500 bg-amber-50 px-4 py-2 flex items-center gap-3 text-sm">
    <span className="font-bold text-amber-700">Draft tersimpan ditemukan</span>
    <button
      className="px-3 py-1 bg-amber-500 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-px hover:translate-y-px"
      onClick={() => {
        const d = loadLocalDraft()
        if (d) { setItems(d.items); setSteps(d.steps); setTotalQty(d.totalQty) }
        setHasDraft(false)
      }}
    >Pulihkan</button>
    <button
      className="px-3 py-1 text-amber-700 font-bold text-xs underline"
      onClick={() => { clearLocalDraft(); setHasDraft(false) }}
    >Buang</button>
  </div>
)}
```

**Step 6: Add orange dot to SIMPAN button when dirty**

Find the SIMPAN button in `page.tsx` and update:

```tsx
<Button onClick={saveCanvas} disabled={isSaving}>
  {isDirty && <span className="w-2 h-2 rounded-full bg-orange-500 mr-1" />}
  {isSaving ? "Menyimpan..." : "SIMPAN"}
</Button>
```

**Step 7: Commit**

```bash
git add app/manufacturing/bom/[id]/hooks/use-auto-save.ts \
        app/manufacturing/bom/[id]/page.tsx \
        __tests__/manufacturing/use-auto-save-helpers.test.ts
git commit -m "feat(bom): auto-save draft to localStorage with 30s debounce + restore banner"
```

---

## Task 4: Material Stock Availability

**Files:**
- Create: `app/api/inventory/stock-check/route.ts`
- Create: `app/manufacturing/bom/[id]/hooks/use-stock-availability.ts`
- Modify: `components/manufacturing/bom/material-panel.tsx`
- Test: `__tests__/manufacturing/stock-availability.test.ts`

**Step 1: Write failing test**

Create `__tests__/manufacturing/stock-availability.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { getStockStatus, type StockCheckResult } from "@/app/manufacturing/bom/[id]/hooks/use-stock-availability"

describe("getStockStatus", () => {
  it("returns 'cukup' when available stock >= required", () => {
    expect(getStockStatus(300, 250)).toBe("cukup")
  })

  it("returns 'hampir-habis' when available is 50-99% of required", () => {
    expect(getStockStatus(300, 180)).toBe("hampir-habis")  // 60%
  })

  it("returns 'kurang' when available < 50% of required", () => {
    expect(getStockStatus(300, 100)).toBe("kurang")  // 33%
  })

  it("returns 'kurang' when available is 0", () => {
    expect(getStockStatus(300, 0)).toBe("kurang")
  })

  it("returns 'cukup' when required is 0 (no quantity needed)", () => {
    expect(getStockStatus(0, 500)).toBe("cukup")
  })
})
```

**Step 2: Run test — verify it fails**

```bash
npx vitest run __tests__/manufacturing/stock-availability.test.ts
```

Expected: FAIL.

**Step 3: Create the API route**

Create `app/api/inventory/stock-check/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/inventory/stock-check?productIds=id1,id2&requiredQtys=300,150
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ success: false }, { status: 401 })

    const { searchParams } = request.nextUrl
    const productIds = (searchParams.get("productIds") ?? "").split(",").filter(Boolean)
    const requiredQtys = (searchParams.get("requiredQtys") ?? "").split(",").map(Number)

    if (productIds.length === 0) return NextResponse.json({ success: true, data: [] })

    const stockLevels = await prisma.stockLevel.groupBy({
      by: ["productId"],
      where: { productId: { in: productIds } },
      _sum: { quantity: true },
    })

    const stockMap = new Map(stockLevels.map((s) => [s.productId, Number(s._sum.quantity ?? 0)]))

    const result = productIds.map((productId, i) => ({
      productId,
      available: stockMap.get(productId) ?? 0,
      required: requiredQtys[i] ?? 0,
    }))

    return NextResponse.json({ success: true, data: result })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
```

**Step 4: Create the hook with exported pure helper**

Create `app/manufacturing/bom/[id]/hooks/use-stock-availability.ts`:

```ts
"use client"

import { useQuery } from "@tanstack/react-query"
import type { BOMItem } from "../bom-canvas-context"

// ─── Pure helper (exported for testing) ──────────────────────────────────────

export type StockStatus = "cukup" | "hampir-habis" | "kurang"

export function getStockStatus(required: number, available: number): StockStatus {
  if (required === 0) return "cukup"
  const pct = available / required
  if (pct >= 1) return "cukup"
  if (pct >= 0.5) return "hampir-habis"
  return "kurang"
}

export interface StockCheckResult {
  productId: string
  available: number
  required: number
  status: StockStatus
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useStockAvailability(items: BOMItem[], totalQty: number) {
  const productIds = items.map((i) => i.materialId)
  // required qty = quantityPerUnit × totalQty × (1 + wastePct/100)
  const requiredQtys = items.map((i) =>
    Math.ceil(Number(i.quantityPerUnit) * totalQty * (1 + Number(i.wastePct) / 100))
  )

  return useQuery<StockCheckResult[]>({
    queryKey: ["stock-check", productIds, requiredQtys],
    queryFn: async () => {
      if (productIds.length === 0) return []
      const res = await fetch(
        `/api/inventory/stock-check?productIds=${productIds.join(",")}&requiredQtys=${requiredQtys.join(",")}`
      )
      const json = await res.json()
      return (json.data as { productId: string; available: number; required: number }[]).map((d) => ({
        ...d,
        status: getStockStatus(d.required, d.available),
      }))
    },
    enabled: productIds.length > 0 && totalQty > 0,
    staleTime: 60_000, // re-check stock every 1 min
  })
}
```

**Step 5: Run test — verify it passes**

```bash
npx vitest run __tests__/manufacturing/stock-availability.test.ts
```

Expected: PASS — 5 tests.

**Step 6: Update material panel**

In `components/manufacturing/bom/material-panel.tsx`, add:

```tsx
import { useStockAvailability } from "@/app/manufacturing/bom/[id]/hooks/use-stock-availability"

// Inside component, after reading from context:
const { items, totalQty } = useBOMCanvas()
const { data: stockData } = useStockAvailability(items, totalQty)
const stockMap = new Map(stockData?.map((s) => [s.productId, s]) ?? [])

// Inside each item row, add before the item name:
const stock = stockMap.get(item.materialId)
const dotColor = !stock ? "bg-zinc-300" : stock.status === "cukup" ? "bg-green-500" : stock.status === "hampir-habis" ? "bg-yellow-400" : "bg-red-500"
const tooltipText = stock ? `Stok: ${stock.available} — Butuh: ${stock.required}${stock.status === "kurang" ? ` — Kurang ${stock.required - stock.available}` : ""}` : "Memuat..."

// Add dot with title tooltip:
<span className={`w-2 h-2 rounded-full ${dotColor} shrink-0`} title={tooltipText} />
```

**Step 7: Commit**

```bash
git add app/api/inventory/stock-check/route.ts \
        app/manufacturing/bom/[id]/hooks/use-stock-availability.ts \
        components/manufacturing/bom/material-panel.tsx \
        __tests__/manufacturing/stock-availability.test.ts
git commit -m "feat(bom): stock availability indicator in material panel"
```

---

## Task 5: Progress Bars → Real WorkOrder.completedQty

**Files:**
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts`
- Modify: `app/manufacturing/bom/[id]/bom-canvas-context.tsx`

**Step 1: Extend GET route to include WorkOrder completedQty**

In `app/api/manufacturing/production-bom/[id]/route.ts`, inside the `steps` include block, add after `attachments: true`:

```ts
workOrders: {
  select: {
    id: true,
    plannedQty: true,
    actualQty: true,
    completedQty: true,
    status: true,
  },
},
```

Then, after fetching the BOM, transform the steps to include aggregated completedQty:

```ts
// After: const bom = await prisma.productionBOM.findUnique(...)
// Replace the return with:
const enrichedSteps = bom.steps.map((step) => {
  const woCompletedQty = (step as any).workOrders?.reduce(
    (sum: number, wo: any) => sum + (wo.completedQty ?? 0), 0
  ) ?? step.completedQty
  return { ...step, completedQty: woCompletedQty }
})

return NextResponse.json({ success: true, data: { ...bom, steps: enrichedSteps } })
```

**Step 2: Add polling in context when SPK exists**

In `app/manufacturing/bom/[id]/bom-canvas-context.tsx`, track whether SPK has been generated:

```tsx
// Add to context state:
const [hasSPK, setHasSPK] = useState(false)
```

Export `setHasSPK` and `hasSPK` from the context.

**Step 3: Add polling to page**

In `app/manufacturing/bom/[id]/page.tsx`, after SPK is generated successfully:

```tsx
setHasSPK(true)
```

In the `useProductionBOM` hook call, add `refetchInterval`:

```tsx
const { data: bomData } = useProductionBOM(id, {
  refetchInterval: hasSPK ? 60_000 : false,
})
```

Update `hooks/use-production-bom.ts` to accept options:

```ts
export function useProductionBOM(id: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: queryKeys.productionBom.detail(id),
    queryFn: async () => { ... },
    refetchInterval: options?.refetchInterval,
  })
}
```

**Step 4: Verify progress bars show real data**

The `StationNode` component already reads `data.completedQty` and `data.stepTarget`. Since the GET route now returns aggregated `completedQty` from WorkOrders, and `initFromServer` copies this into context steps, no further changes needed.

**Step 5: Commit**

```bash
git add app/api/manufacturing/production-bom/\[id\]/route.ts \
        app/manufacturing/bom/[id]/bom-canvas-context.tsx \
        app/manufacturing/bom/[id]/page.tsx \
        hooks/use-production-bom.ts
git commit -m "feat(bom): progress bars show real completedQty from WorkOrders, polls every 60s"
```

---

## Task 6: Material Price Drift Warning

**Files:**
- Create: `app/manufacturing/bom/[id]/hooks/use-price-drift.ts`
- Test: `__tests__/manufacturing/price-drift.test.ts`

**Step 1: Write failing test**

Create `__tests__/manufacturing/price-drift.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { detectPriceDrift, type PriceDriftResult } from "@/app/manufacturing/bom/[id]/hooks/use-price-drift"

describe("detectPriceDrift", () => {
  it("returns empty array when no prices changed", () => {
    const items = [
      { id: "i1", materialId: "m1", snapshotCostPrice: 10000, material: { id: "m1", name: "Kain", costPrice: 10000 } },
    ] as any
    expect(detectPriceDrift(items)).toHaveLength(0)
  })

  it("detects price increase", () => {
    const items = [
      { id: "i1", materialId: "m1", snapshotCostPrice: 10000, material: { id: "m1", name: "Kain", costPrice: 12000 } },
    ] as any
    const result = detectPriceDrift(items)
    expect(result).toHaveLength(1)
    expect(result[0].direction).toBe("naik")
    expect(result[0].changePct).toBeCloseTo(20)
  })

  it("detects price decrease", () => {
    const items = [
      { id: "i1", materialId: "m1", snapshotCostPrice: 10000, material: { id: "m1", name: "Kain", costPrice: 8000 } },
    ] as any
    const result = detectPriceDrift(items)
    expect(result[0].direction).toBe("turun")
    expect(result[0].changePct).toBeCloseTo(20)
  })

  it("ignores items with no snapshot price", () => {
    const items = [
      { id: "i1", materialId: "m1", snapshotCostPrice: null, material: { id: "m1", name: "Kain", costPrice: 12000 } },
    ] as any
    expect(detectPriceDrift(items)).toHaveLength(0)
  })
})
```

**Step 2: Run test — verify it fails**

```bash
npx vitest run __tests__/manufacturing/price-drift.test.ts
```

Expected: FAIL.

**Step 3: Create the hook**

Create `app/manufacturing/bom/[id]/hooks/use-price-drift.ts`:

```ts
"use client"

import { useMemo } from "react"
import type { BOMItem } from "../bom-canvas-context"

// ─── Pure helper ──────────────────────────────────────────────────────────────

export interface PriceDriftResult {
  itemId: string
  materialName: string
  oldPrice: number
  newPrice: number
  changePct: number
  direction: "naik" | "turun"
}

export function detectPriceDrift(items: BOMItem[]): PriceDriftResult[] {
  const drifted: PriceDriftResult[] = []
  for (const item of items) {
    const snapshot = item.snapshotCostPrice
    const current = item.material.costPrice
    if (snapshot == null || current == null) continue
    const snapshotNum = Number(snapshot)
    const currentNum = Number(current)
    if (snapshotNum === 0) continue
    if (Math.abs(currentNum - snapshotNum) < 0.01) continue
    drifted.push({
      itemId: item.id,
      materialName: item.material.name,
      oldPrice: snapshotNum,
      newPrice: currentNum,
      changePct: Math.abs(((currentNum - snapshotNum) / snapshotNum) * 100),
      direction: currentNum > snapshotNum ? "naik" : "turun",
    })
  }
  return drifted
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePriceDrift(items: BOMItem[]) {
  return useMemo(() => detectPriceDrift(items), [items])
}
```

**Step 4: Run test — verify it passes**

```bash
npx vitest run __tests__/manufacturing/price-drift.test.ts
```

Expected: PASS — 4 tests.

**Step 5: Add banner to page**

In `app/manufacturing/bom/[id]/page.tsx`, add above the material panel:

```tsx
import { usePriceDrift } from "./hooks/use-price-drift"

const driftedItems = usePriceDrift(items)

{driftedItems.length > 0 && (
  <div className="border-l-4 border-l-yellow-500 bg-yellow-50 px-4 py-2 flex items-center gap-3 text-sm">
    <span className="font-bold text-yellow-700">
      {driftedItems.length} material berubah harga sejak terakhir disimpan
    </span>
    <span className="text-yellow-600 text-xs">
      {driftedItems.map((d) => `${d.materialName} ${d.direction === "naik" ? "↑" : "↓"}${d.changePct.toFixed(0)}%`).join(" · ")}
    </span>
    <button
      className="px-3 py-1 bg-yellow-500 text-white font-bold text-xs border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
      onClick={() => setDirty(true)}  // forces recalculate on next render
    >
      Hitung Ulang HPP
    </button>
  </div>
)}
```

**Step 6: Update PATCH route to persist snapshotCostPrice**

In `app/api/manufacturing/production-bom/[id]/route.ts`, inside the PATCH handler when creating/updating `ProductionBOMItem` records, add:

```ts
// Inside items upsert:
snapshotCostPrice: item.material?.costPrice ?? null,
```

This requires fetching current material prices during the save — add a `materialPrices` lookup before the transaction:

```ts
const materialIds = payload.items.map((i: any) => i.materialId)
const materials = await prisma.product.findMany({
  where: { id: { in: materialIds } },
  select: { id: true, costPrice: true },
})
const priceMap = new Map(materials.map((m) => [m.id, m.costPrice]))
// Then in item creation: snapshotCostPrice: priceMap.get(item.materialId) ?? null
```

**Step 7: Commit**

```bash
git add app/manufacturing/bom/[id]/hooks/use-price-drift.ts \
        app/manufacturing/bom/[id]/page.tsx \
        app/api/manufacturing/production-bom/\[id\]/route.ts \
        __tests__/manufacturing/price-drift.test.ts
git commit -m "feat(bom): price drift warning banner + persist snapshotCostPrice on save"
```

---

## Task 7: Critical Path Highlight

**Files:**
- Create: `app/manufacturing/bom/[id]/hooks/use-critical-path.ts`
- Modify: `components/manufacturing/bom/station-node.tsx`
- Modify: `components/manufacturing/bom/timeline-view.tsx`
- Test: `__tests__/manufacturing/critical-path.test.ts`

**Step 1: Write failing test**

Create `__tests__/manufacturing/critical-path.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { findCriticalPathStepIds } from "@/app/manufacturing/bom/[id]/hooks/use-critical-path"

describe("findCriticalPathStepIds", () => {
  it("returns all steps for a linear chain", () => {
    const steps = [
      { id: "a", durationMinutes: 10, parentStepIds: [] },
      { id: "b", durationMinutes: 20, parentStepIds: ["a"] },
      { id: "c", durationMinutes: 5,  parentStepIds: ["b"] },
    ] as any
    const result = findCriticalPathStepIds(steps)
    expect(result.has("a")).toBe(true)
    expect(result.has("b")).toBe(true)
    expect(result.has("c")).toBe(true)
  })

  it("returns only the longer branch for a diamond DAG", () => {
    //   a → b (20) ──┐
    //       └─ c(5) ─→ d
    const steps = [
      { id: "a", durationMinutes: 10, parentStepIds: [] },
      { id: "b", durationMinutes: 20, parentStepIds: ["a"] },
      { id: "c", durationMinutes: 5,  parentStepIds: ["a"] },
      { id: "d", durationMinutes: 10, parentStepIds: ["b", "c"] },
    ] as any
    const result = findCriticalPathStepIds(steps)
    expect(result.has("a")).toBe(true)
    expect(result.has("b")).toBe(true)  // on critical path (longer branch)
    expect(result.has("c")).toBe(false) // not on critical path
    expect(result.has("d")).toBe(true)
  })

  it("handles empty steps array", () => {
    expect(findCriticalPathStepIds([])).toEqual(new Set())
  })
})
```

**Step 2: Run test — verify it fails**

```bash
npx vitest run __tests__/manufacturing/critical-path.test.ts
```

Expected: FAIL.

**Step 3: Create the hook**

Create `app/manufacturing/bom/[id]/hooks/use-critical-path.ts`:

```ts
"use client"

import { useMemo } from "react"
import type { BOMStep } from "../bom-canvas-context"

// ─── Pure helper ──────────────────────────────────────────────────────────────

export function findCriticalPathStepIds(steps: Pick<BOMStep, "id" | "durationMinutes" | "parentStepIds">[]): Set<string> {
  if (steps.length === 0) return new Set()

  // Forward pass: compute earliest end time for each step
  const endTime = new Map<string, number>()
  const stepMap = new Map(steps.map((s) => [s.id, s]))

  // Topological order (simple: process in array order, which is by sequence)
  for (const step of steps) {
    const parentMax = step.parentStepIds.length === 0
      ? 0
      : Math.max(...step.parentStepIds.map((pid) => endTime.get(pid) ?? 0))
    endTime.set(step.id, parentMax + (step.durationMinutes ?? 0))
  }

  const maxEnd = Math.max(...endTime.values())

  // Backward pass: a step is on the critical path if removing it reduces maxEnd
  const criticalSteps = new Set<string>()

  // Find terminal steps (steps that are not a parent of any other step)
  const parentedStepIds = new Set(steps.flatMap((s) => s.parentStepIds))
  const terminalSteps = steps.filter((s) => !parentedStepIds.has(s.id))

  // Trace back from terminal steps with max end time
  const criticalTerminals = terminalSteps.filter((s) => endTime.get(s.id) === maxEnd)

  function traceBack(stepId: string) {
    if (criticalSteps.has(stepId)) return
    criticalSteps.add(stepId)
    const step = stepMap.get(stepId)
    if (!step || step.parentStepIds.length === 0) return
    // The critical parent is the one whose endTime + current duration = current endTime
    const currentEnd = endTime.get(stepId) ?? 0
    const currentDuration = step.durationMinutes ?? 0
    const criticalStartTime = currentEnd - currentDuration
    for (const pid of step.parentStepIds) {
      if ((endTime.get(pid) ?? 0) === criticalStartTime) {
        traceBack(pid)
      }
    }
  }

  for (const terminal of criticalTerminals) {
    traceBack(terminal.id)
  }

  return criticalSteps
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCriticalPath(steps: BOMStep[]): Set<string> {
  return useMemo(() => findCriticalPathStepIds(steps), [steps])
}
```

**Step 4: Run test — verify it passes**

```bash
npx vitest run __tests__/manufacturing/critical-path.test.ts
```

Expected: PASS — 3 tests.

**Step 5: Pass criticalStepIds to StationNode**

In `app/manufacturing/bom/[id]/page.tsx`, compute critical path and pass to canvas:

```tsx
const criticalStepIds = useCriticalPath(steps)
// Pass to BOMCanvas as prop:
<BOMCanvas criticalStepIds={criticalStepIds} ... />
```

**Step 6: Update StationNode to show critical path badge**

In `components/manufacturing/bom/station-node.tsx`, add `isCritical` prop and render badge:

```tsx
// Add to props:
isCritical?: boolean

// In header area, after sequence badge:
{isCritical && (
  <span title="Jalur kritis" className="text-amber-500 text-xs font-black">⚡</span>
)}

// Add amber border when critical:
className={`border-2 ${isCritical ? "border-amber-500" : "border-black"} ...`}
```

**Step 7: Update TimelineView to show striped fill for non-critical bars**

In `components/manufacturing/bom/timeline-view.tsx`, pass `criticalStepIds` as prop and update bar fill:

```tsx
// Critical bar: solid fill
// Non-critical bar: use repeating-linear-gradient for striped fill
const barStyle = criticalStepIds.has(bar.step.id)
  ? { background: stationColor }
  : { background: `repeating-linear-gradient(45deg, ${stationColor}, ${stationColor} 4px, transparent 4px, transparent 8px)` }
```

**Step 8: Commit**

```bash
git add app/manufacturing/bom/[id]/hooks/use-critical-path.ts \
        app/manufacturing/bom/[id]/page.tsx \
        components/manufacturing/bom/station-node.tsx \
        components/manufacturing/bom/timeline-view.tsx \
        __tests__/manufacturing/critical-path.test.ts
git commit -m "feat(bom): critical path highlighting — amber border + ⚡ badge + striped timeline bars"
```

---

## Task 8: Working Hours System Setting

**Files:**
- Create: `app/api/system/settings/route.ts`
- Modify: `components/manufacturing/bom/bom-cost-helpers.ts`
- Modify: `app/settings/page.tsx` (or create `app/settings/manufacturing/page.tsx`)
- Test: `__tests__/manufacturing/bom-costing-settings.test.ts`

**Step 1: Write failing test**

Add to `__tests__/manufacturing/bom-costing-settings.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { calcLaborCostPerPcsWithHours } from "@/components/manufacturing/bom/bom-cost-helpers"

describe("calcLaborCostPerPcsWithHours", () => {
  it("uses provided working hours instead of hardcoded 172", () => {
    // Salary 5,200,000 / month, 10 min duration, 160h/month
    const result = calcLaborCostPerPcsWithHours(5_200_000, 10, 160)
    // Expected: 5_200_000 × 10 / (160 × 60) = 5416.67
    expect(result).toBeCloseTo(5416.67, 1)
  })

  it("matches old behavior at 172h/month", () => {
    const result = calcLaborCostPerPcsWithHours(5_200_000, 10, 172)
    // 5_200_000 × 10 / (172 × 60) = 5038.76
    expect(result).toBeCloseTo(5038.76, 1)
  })
})
```

**Step 2: Run test — verify it fails**

```bash
npx vitest run __tests__/manufacturing/bom-costing-settings.test.ts
```

Expected: FAIL.

**Step 3: Add new function to bom-cost-helpers.ts**

In `components/manufacturing/bom/bom-cost-helpers.ts`, add new exported function:

```ts
// New function that accepts workingHours as parameter
export function calcLaborCostPerPcsWithHours(
  laborMonthlySalary: number,
  durationMinutes: number,
  workingHoursPerMonth: number
): number {
  if (!laborMonthlySalary || !durationMinutes || !workingHoursPerMonth) return 0
  return laborMonthlySalary * durationMinutes / (workingHoursPerMonth * 60)
}
```

Keep the existing `calcLaborCostPerPcs` function unchanged (for backward compatibility). The BOM canvas will switch to calling `calcLaborCostPerPcsWithHours` once the setting is available.

**Step 4: Run test — verify it passes**

```bash
npx vitest run __tests__/manufacturing/bom-costing-settings.test.ts
```

Expected: PASS.

**Step 5: Create system settings API route**

Create `app/api/system/settings/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/system/settings?keys=workingHoursPerMonth,overheadPct
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const keys = (searchParams.get("keys") ?? "").split(",").filter(Boolean)

  const settings = keys.length > 0
    ? await prisma.systemSetting.findMany({ where: { key: { in: keys } } })
    : await prisma.systemSetting.findMany()

  const result = Object.fromEntries(settings.map((s) => [s.key, s.value]))

  // Fill defaults for missing keys
  const defaults: Record<string, string> = {
    workingHoursPerMonth: "172",
  }
  for (const key of keys) {
    if (!(key in result)) result[key] = defaults[key] ?? ""
  }

  return NextResponse.json({ success: true, data: result })
}

// PATCH /api/system/settings — { key: string, value: string }[]
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ success: false }, { status: 401 })

  const updates: { key: string; value: string }[] = await request.json()

  await Promise.all(
    updates.map((u) =>
      prisma.systemSetting.upsert({
        where: { key: u.key },
        update: { value: u.value },
        create: { key: u.key, value: u.value, description: null },
      })
    )
  )

  return NextResponse.json({ success: true })
}
```

**Step 6: Seed the default value**

In `prisma/seed-gl.ts` (or whichever seed file runs on `npm run seed`), add:

```ts
await prisma.systemSetting.upsert({
  where: { key: "workingHoursPerMonth" },
  update: {},
  create: { key: "workingHoursPerMonth", value: "172", description: "Jam kerja per bulan (standar Indonesia)" },
})
```

**Step 7: Add Manufacturing section to Settings page**

In `app/settings/page.tsx`, add a card with a numeric input for `workingHoursPerMonth`. Use TanStack Query to fetch and patch:

```tsx
// Fetch:
const { data: settings } = useQuery({
  queryKey: ["system-settings", "manufacturing"],
  queryFn: () => fetch("/api/system/settings?keys=workingHoursPerMonth").then(r => r.json()).then(j => j.data),
})

// Patch on blur/submit:
const mutation = useMutation({
  mutationFn: (updates: { key: string; value: string }[]) =>
    fetch("/api/system/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["system-settings"] })
    toast.success("Pengaturan disimpan")
  },
})
```

**Step 8: Wire into BOM cost helpers**

In `app/manufacturing/bom/[id]/page.tsx`, fetch the setting once and pass to cost calculations:

```tsx
const { data: sysSettings } = useQuery({
  queryKey: ["system-settings", "workingHoursPerMonth"],
  queryFn: () => fetch("/api/system/settings?keys=workingHoursPerMonth").then(r => r.json()).then(j => j.data),
  staleTime: 5 * 60 * 1000,
})
const workingHours = Number(sysSettings?.workingHoursPerMonth ?? 172)
```

Pass `workingHours` to `calcTotalLaborCost` and `calcLaborCostPerPcsWithHours` calls throughout the page.

**Step 9: Commit**

```bash
git add app/api/system/settings/route.ts \
        components/manufacturing/bom/bom-cost-helpers.ts \
        app/settings/page.tsx \
        prisma/seed-gl.ts \
        __tests__/manufacturing/bom-costing-settings.test.ts
git commit -m "feat(bom): working hours system setting — replaces hardcoded 172h/month"
```

---

## Task 9: User-Editable Process Templates

**Files:**
- Create: `app/api/manufacturing/bom-templates/route.ts`
- Create: `components/manufacturing/bom/template-dialog.tsx`
- Modify: `app/manufacturing/bom/[id]/page.tsx`
- Modify: `lib/query-keys.ts`

**Step 1: Add query key**

In `lib/query-keys.ts`, add:

```ts
bomTemplates: {
  all: ["bomTemplates"] as const,
  list: () => [...queryKeys.bomTemplates.all, "list"] as const,
},
```

**Step 2: Create templates API route**

Create `app/api/manufacturing/bom-templates/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// GET /api/manufacturing/bom-templates
export async function GET() {
  const templates = await prisma.bOMTemplate.findMany({
    orderBy: [{ isBuiltIn: "desc" }, { createdAt: "asc" }],
  })
  return NextResponse.json({ success: true, data: templates })
}

// POST /api/manufacturing/bom-templates — { name, description, stepsJson }
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ success: false }, { status: 401 })

  const { name, description, stepsJson } = await request.json()
  if (!name || !stepsJson) return NextResponse.json({ success: false, error: "name and stepsJson required" }, { status: 400 })

  const template = await prisma.bOMTemplate.create({
    data: { name, description, stepsJson, isBuiltIn: false, createdBy: user.id },
  })

  return NextResponse.json({ success: true, data: template })
}

// DELETE /api/manufacturing/bom-templates?id=...
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return NextResponse.json({ success: false }, { status: 401 })

  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 })

  const template = await prisma.bOMTemplate.findUnique({ where: { id } })
  if (!template) return NextResponse.json({ success: false, error: "not found" }, { status: 404 })
  if (template.isBuiltIn) return NextResponse.json({ success: false, error: "Cannot delete built-in template" }, { status: 403 })

  await prisma.bOMTemplate.delete({ where: { id } })
  return NextResponse.json({ success: true })
}
```

**Step 3: Seed built-in templates**

In `prisma/seed-gl.ts`, add:

```ts
const builtInTemplates = [
  {
    name: "Garmen Lengkap",
    description: "Potong → Jahit → QC → Packing",
    stepsJson: JSON.stringify([
      { stationType: "CUTTING", sequence: 1, durationMinutes: 4 },
      { stationType: "SEWING",  sequence: 2, durationMinutes: 15 },
      { stationType: "QC",      sequence: 3, durationMinutes: 2 },
      { stationType: "PACKING", sequence: 4, durationMinutes: 3 },
    ]),
    isBuiltIn: true,
  },
  {
    name: "CMT",
    description: "Potong → Jahit",
    stepsJson: JSON.stringify([
      { stationType: "CUTTING", sequence: 1, durationMinutes: 4 },
      { stationType: "SEWING",  sequence: 2, durationMinutes: 15 },
    ]),
    isBuiltIn: true,
  },
  {
    name: "Sablon + Jahit",
    description: "Sablon → Jahit → QC → Packing",
    stepsJson: JSON.stringify([
      { stationType: "PRINTING", sequence: 1, durationMinutes: 8 },
      { stationType: "SEWING",   sequence: 2, durationMinutes: 15 },
      { stationType: "QC",       sequence: 3, durationMinutes: 2 },
      { stationType: "PACKING",  sequence: 4, durationMinutes: 3 },
    ]),
    isBuiltIn: true,
  },
]

for (const t of builtInTemplates) {
  await prisma.bOMTemplate.upsert({
    where: { id: t.name } as any, // will fail — use name-based upsert workaround:
    // Actually: findFirst + create if not exists
    update: {},
    create: t,
  })
}
```

> Note: `BOMTemplate` has no unique name constraint. Use `findFirst({ where: { name: t.name, isBuiltIn: true } })` then `create` if null.

**Step 4: Create template dialog component**

Create `components/manufacturing/bom/template-dialog.tsx` — a dialog with:
- List of templates (built-in tagged with "Bawaan" badge, user templates with delete button)
- "Terapkan" button per template that calls `onApply(stepsJson)`
- "Simpan sebagai Template" section at bottom (only shown when `steps.length >= 2`)

```tsx
"use client"

import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { queryKeys } from "@/lib/query-keys"
import { useBOMCanvas } from "@/app/manufacturing/bom/[id]/bom-canvas-context"

interface TemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onApply: (stepsJson: any[]) => void
}

export function TemplateDialog({ open, onOpenChange, onApply }: TemplateDialogProps) {
  const queryClient = useQueryClient()
  const { steps } = useBOMCanvas()
  const [newTemplateName, setNewTemplateName] = useState("")

  const { data: templates = [] } = useQuery({
    queryKey: queryKeys.bomTemplates.list(),
    queryFn: () => fetch("/api/manufacturing/bom-templates").then(r => r.json()).then(j => j.data ?? []),
    enabled: open,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/manufacturing/bom-templates?id=${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bomTemplates.all })
      toast.success("Template dihapus")
    },
  })

  const saveMutation = useMutation({
    mutationFn: (payload: { name: string; stepsJson: any[] }) =>
      fetch("/api/manufacturing/bom-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: payload.name, stepsJson: payload.stepsJson }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bomTemplates.all })
      toast.success("Template disimpan")
      setNewTemplateName("")
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <DialogHeader>
          <DialogTitle className="font-black uppercase">Template Proses</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {templates.map((t: any) => (
            <div key={t.id} className="flex items-center gap-2 border-2 border-black p-3">
              <div className="flex-1">
                <div className="font-bold text-sm flex items-center gap-2">
                  {t.name}
                  {t.isBuiltIn && <span className="text-[10px] bg-zinc-200 px-1 font-black">BAWAAN</span>}
                </div>
                {t.description && <div className="text-xs text-zinc-500">{t.description}</div>}
              </div>
              <Button size="sm" onClick={() => { onApply(JSON.parse(t.stepsJson ?? "[]")); onOpenChange(false) }}>
                Terapkan
              </Button>
              {!t.isBuiltIn && (
                <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(t.id)}>
                  Hapus
                </Button>
              )}
            </div>
          ))}
        </div>

        {steps.length >= 2 && (
          <div className="border-t-2 border-black pt-4 space-y-2">
            <p className="text-xs font-bold uppercase">Simpan Proses Saat Ini sebagai Template</p>
            <div className="flex gap-2">
              <Input
                placeholder="Nama template..."
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="border-2 border-black"
              />
              <Button
                disabled={!newTemplateName.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate({
                  name: newTemplateName.trim(),
                  stepsJson: steps.map((s) => ({
                    stationType: s.station.stationType,
                    sequence: s.sequence,
                    durationMinutes: s.durationMinutes,
                    useSubkon: s.useSubkon,
                  })),
                })}
              >
                Simpan
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

**Step 5: Add Templates button to page toolbar**

In `app/manufacturing/bom/[id]/page.tsx`, add to the toolbar:

```tsx
const [templateDialogOpen, setTemplateDialogOpen] = useState(false)

// In toolbar JSX:
<Button variant="outline" onClick={() => setTemplateDialogOpen(true)}>
  Template
</Button>

<TemplateDialog
  open={templateDialogOpen}
  onOpenChange={setTemplateDialogOpen}
  onApply={(stepsJson) => {
    // Apply template: add steps based on available process stations
    // For each template step, find a matching station or create a placeholder
    toast.info("Template diterapkan — sesuaikan work center untuk setiap proses")
    // Merge template steps with current steps (append, don't replace)
  }}
/>
```

**Step 6: Commit**

```bash
git add app/api/manufacturing/bom-templates/route.ts \
        components/manufacturing/bom/template-dialog.tsx \
        app/manufacturing/bom/[id]/page.tsx \
        lib/query-keys.ts \
        prisma/seed-gl.ts
git commit -m "feat(bom): user-editable process templates — save, apply, delete from canvas toolbar"
```

---

## Task 10: SPK Re-Generation

**Files:**
- Create: `app/api/manufacturing/production-bom/[id]/work-orders/route.ts`
- Modify: `app/manufacturing/bom/[id]/page.tsx`

**Step 1: Create the DELETE endpoint**

Create `app/api/manufacturing/production-bom/[id]/work-orders/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"

// DELETE /api/manufacturing/production-bom/[id]/work-orders
// Deletes all WorkOrders linked to this BOM (enables SPK re-generation)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ success: false }, { status: 401 })

    const { id } = await params

    // Count first so we can return meaningful info
    const count = await prisma.workOrder.count({ where: { productionBomId: id } })

    if (count === 0) return NextResponse.json({ success: true, data: { deletedCount: 0 } })

    // Delete in correct order (dependent records first)
    await prisma.$transaction(async (tx) => {
      // Clear dependsOnWorkOrderId references within this BOM's WOs
      await tx.workOrder.updateMany({
        where: { productionBomId: id },
        data: { dependsOnWorkOrderId: null },
      })

      await tx.workOrder.deleteMany({ where: { productionBomId: id } })
    })

    return NextResponse.json({ success: true, data: { deletedCount: count } })
  } catch (error: any) {
    console.error("Error deleting work orders:", error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// GET — count of existing work orders for this BOM
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const count = await prisma.workOrder.count({ where: { productionBomId: id } })
  return NextResponse.json({ success: true, data: { count } })
}
```

**Step 2: Add Reset SPK button to page**

In `app/manufacturing/bom/[id]/page.tsx`, after the SPK result is shown, add:

```tsx
const [woCount, setWoCount] = useState<number | null>(null)
const [resettingSPK, setResettingSPK] = useState(false)

// Fetch WO count on load (to know if Reset button should be shown):
useEffect(() => {
  fetch(`/api/manufacturing/production-bom/${id}/work-orders`)
    .then(r => r.json())
    .then(j => setWoCount(j.data?.count ?? 0))
}, [id])

const handleResetSPK = async () => {
  if (!window.confirm(`Ini akan menghapus ${woCount} SPK yang sudah dibuat. Lanjutkan?`)) return
  setResettingSPK(true)
  try {
    const res = await fetch(`/api/manufacturing/production-bom/${id}/work-orders`, { method: "DELETE" })
    const json = await res.json()
    if (json.success) {
      toast.success(`${json.data.deletedCount} SPK berhasil dihapus. Anda dapat generate ulang.`)
      setWoCount(0)
      setHasSPK(false)
      setSpkResult(null)
      queryClient.invalidateQueries({ queryKey: queryKeys.workOrders.all })
    }
  } catch {
    toast.error("Gagal mereset SPK")
  } finally {
    setResettingSPK(false)
  }
}
```

Add the button in the SPK toolbar area (visible only when `woCount > 0`):

```tsx
{(woCount ?? 0) > 0 && (
  <Button
    variant="outline"
    size="sm"
    onClick={handleResetSPK}
    disabled={resettingSPK}
    className="border-2 border-red-500 text-red-600 hover:bg-red-50"
  >
    {resettingSPK ? "Mereset..." : `Reset ${woCount} SPK`}
  </Button>
)}
```

**Step 3: Run all tests**

```bash
npx vitest run
```

Expected: All existing tests + new tests pass. Check the baseline: 296/301 pass (5 pre-existing failures are OK).

**Step 4: Type check**

```bash
npx tsc --noEmit
```

Expected: No new errors.

**Step 5: Final commit**

```bash
git add app/api/manufacturing/production-bom/\[id\]/work-orders/route.ts \
        app/manufacturing/bom/[id]/page.tsx
git commit -m "feat(bom): SPK re-generation — Reset SPK button deletes WOs and re-enables Generate"
```

---

## Final Verification Checklist

After all tasks are complete:

```bash
npx vitest run
npx tsc --noEmit
npm run lint
```

Then manually verify in browser:

| Feature | Page | What to Check |
|---|---|---|
| Auto-save | `/manufacturing/bom/[id]` | Make a change, wait 30s, check localStorage in DevTools → Application → Local Storage |
| Draft restore | `/manufacturing/bom/[id]` | Reload page without saving → banner appears → click Pulihkan |
| Stock dots | Material panel | 🟢🟡🔴 dots appear on materials, hover shows tooltip |
| Progress bars | Canvas nodes | Generate SPK → mark a WO as done → canvas reflects progress within 60s |
| Price drift | Canvas | Manually change a product's costPrice in Inventory → open BOM → yellow banner appears |
| Critical path | Canvas | ⚡ badge on critical steps, striped timeline bars on non-critical |
| Working hours | `/settings` | Change to 160 → open BOM → Labor cost recalculates |
| Templates | Canvas toolbar | "Template" button → apply built-in → "Simpan sebagai Template" appears when ≥2 steps |
| Reset SPK | Canvas toolbar | Generate SPK → "Reset N SPK" button appears → click → confirm → SPK button re-enables |
