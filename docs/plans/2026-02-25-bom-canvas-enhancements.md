# BOM Canvas Enhancements — Branching Flow, Time, Subkon Details

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the BOM canvas from linear chain to branching DAG flow, add estimated time display, enhance subcontractor panel with vendor details, and show material assignment badges.

**Architecture:** React Flow handles already support multi-edge connections. We add edge creation via handle drag, store parent-child relationships per step, auto-layout nodes using BFS-based tree positioning. Subcontractor panel replaces the simple AllocationEditor dropdown with a rich vendor card list. No schema migration needed — we use the existing step sequence + a new `parentStepIds` field in the save payload (stored as step dependencies via the existing allocation/dependency system).

**Tech Stack:** @xyflow/react (React Flow), existing Prisma models, TanStack Query

---

### Task 1: Schema — Add step dependency support

**Files:**
- Modify: `prisma/schema.prisma` (ProductionBOMStep model)
- Run: migration

**Step 1: Add parentStepIds field to ProductionBOMStep**

Add a JSON field to store parent step references (avoids a join table):

```prisma
model ProductionBOMStep {
  // ... existing fields ...
  durationMinutes Int?
  notes           String?
  parentStepIds   String[]  @default([])  // IDs of parent steps (DAG edges)
  // ... rest ...
}
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_step_parent_ids
npx prisma generate
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(bom): add parentStepIds to ProductionBOMStep for DAG flow"
```

---

### Task 2: Schema — Add capacity/leadTime to Supplier

**Files:**
- Modify: `prisma/schema.prisma` (Supplier model, around line 994)

**Step 1: Add fields after the Performance section**

```prisma
  // Capacity
  maxCapacityPerMonth Int?     // Max pcs per month
  leadTimeDays        Int?     // Default lead time in days
```

**Step 2: Run migration**

```bash
npx prisma migrate dev --name add_supplier_capacity
npx prisma generate
```

**Step 3: Commit**

```bash
git add prisma/
git commit -m "feat(bom): add maxCapacityPerMonth and leadTimeDays to Supplier"
```

---

### Task 3: API — Update process-stations to return supplier details

**Files:**
- Modify: `app/api/manufacturing/process-stations/route.ts`

**Step 1: Expand the subcontractor include to return capacity/rating fields**

In the GET handler, find the `include` for subcontractor and expand:

```typescript
subcontractor: {
    select: {
        id: true, name: true, code: true, phone: true,
        costPerUnit: true,  // if exists on Supplier
        rating: true, onTimeRate: true, qualityScore: true,
        maxCapacityPerMonth: true, leadTimeDays: true,
    },
},
```

**Step 2: Commit**

```bash
git add app/api/manufacturing/process-stations/route.ts
git commit -m "feat(bom): return supplier capacity details in process-stations API"
```

---

### Task 4: API — Update PATCH to save parentStepIds

**Files:**
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts`

**Step 1: In the PATCH handler step creation, save parentStepIds**

Find the step creation block and add `parentStepIds`:

```typescript
const createdStep = await tx.productionBOMStep.create({
    data: {
        bomId: id,
        stationId: step.stationId,
        sequence: step.sequence,
        durationMinutes: step.durationMinutes || null,
        notes: step.notes || null,
        parentStepIds: step.parentStepIds || [],
    },
})
```

**Step 2: In the GET handler, ensure parentStepIds is returned**

It will be returned automatically since it's a scalar field on the model.

**Step 3: Commit**

```bash
git add app/api/manufacturing/production-bom/\[id\]/route.ts
git commit -m "feat(bom): save/load parentStepIds in BOM PATCH/GET"
```

---

### Task 5: API — Update generate-spk to use DAG dependencies

**Files:**
- Modify: `app/api/manufacturing/production-bom/[id]/generate-spk/route.ts`

**Step 1: Replace sequential dependency with DAG-based dependency**

Currently the code tracks `prevStepWOIds` for linear chaining. Replace with a map from stepId → workOrderId, and for each step, look up its `parentStepIds` to find the dependency WO IDs.

```typescript
const stepToWOIds = new Map<string, string[]>()

for (const step of bom.steps) {
    const currentStepWOIds: string[] = []

    // Find parent WO IDs from DAG edges
    const parentWOIds: string[] = []
    for (const parentId of (step.parentStepIds || [])) {
        const parentWOs = stepToWOIds.get(parentId) || []
        parentWOIds.push(...parentWOs)
    }
    // For linear fallback: if no parentStepIds, use previous step
    const dependsOnId = parentWOIds.length === 1 ? parentWOIds[0] : null

    // ... rest of WO creation uses dependsOnId ...

    stepToWOIds.set(step.id, currentStepWOIds)
}
```

**Step 2: Commit**

```bash
git add app/api/manufacturing/production-bom/\[id\]/generate-spk/route.ts
git commit -m "feat(bom): generate-spk uses DAG dependencies instead of linear"
```

---

### Task 6: Canvas — Enable interactive edge creation (branching)

**Files:**
- Modify: `components/manufacturing/bom/bom-canvas.tsx`
- Modify: `app/manufacturing/bom/[id]/page.tsx`

**Step 1: Enable React Flow onConnect for edge creation**

In `bom-canvas.tsx`, add `onConnect` prop to ReactFlow:

```typescript
interface BOMCanvasProps {
    // ... existing ...
    onConnectSteps?: (sourceStepId: string, targetStepId: string) => void
    onDisconnectSteps?: (sourceStepId: string, targetStepId: string) => void
}
```

Add the `onConnect` callback:

```typescript
const handleConnect = useCallback((connection: Connection) => {
    if (connection.source && connection.target && onConnectSteps) {
        onConnectSteps(connection.source, connection.target)
    }
}, [onConnectSteps])
```

Pass to ReactFlow: `<ReactFlow onConnect={handleConnect} ... />`

**Step 2: Build edges from parentStepIds instead of sequential order**

Replace `buildEdges` to read from each step's `parentStepIds`:

```typescript
const buildEdges = useCallback((): Edge[] => {
    const edges: Edge[] = []
    for (const step of steps) {
        const parentIds = step.parentStepIds || []
        if (parentIds.length > 0) {
            for (const parentId of parentIds) {
                edges.push({
                    id: `e-${parentId}-${step.id}`,
                    source: parentId,
                    target: step.id,
                    style: { strokeWidth: 2, stroke: "#000" },
                    animated: true,
                    deletable: true,
                })
            }
        }
    }
    // Fallback: if no step has parentStepIds, use sequential
    if (edges.length === 0 && steps.length > 1) {
        for (let i = 1; i < steps.length; i++) {
            edges.push({
                id: `e-${steps[i-1].id}-${steps[i].id}`,
                source: steps[i-1].id,
                target: steps[i].id,
                style: { strokeWidth: 2, stroke: "#000" },
                animated: true,
            })
        }
    }
    return edges
}, [steps])
```

**Step 3: Auto-layout nodes using BFS tree positioning**

Replace the linear `x: 80 + index * 300, y: 100` with a tree layout:

```typescript
function layoutNodes(steps: any[]): Map<string, { x: number; y: number }> {
    const positions = new Map<string, { x: number; y: number }>()
    const childrenMap = new Map<string, string[]>()
    const parentMap = new Map<string, string[]>()

    for (const step of steps) {
        parentMap.set(step.id, step.parentStepIds || [])
        for (const pid of (step.parentStepIds || [])) {
            const children = childrenMap.get(pid) || []
            children.push(step.id)
            childrenMap.set(pid, children)
        }
    }

    // Find roots (no parents)
    const roots = steps.filter(s => !(s.parentStepIds?.length > 0))

    // BFS to assign columns (x) and spread within columns (y)
    const visited = new Set<string>()
    const queue: { id: string; col: number }[] = roots.map((r, i) => ({ id: r.id, col: 0 }))
    const columns = new Map<number, string[]>()

    while (queue.length > 0) {
        const { id, col } = queue.shift()!
        if (visited.has(id)) continue
        visited.add(id)

        const colItems = columns.get(col) || []
        colItems.push(id)
        columns.set(col, colItems)

        for (const childId of (childrenMap.get(id) || [])) {
            if (!visited.has(childId)) {
                queue.push({ id: childId, col: col + 1 })
            }
        }
    }

    // Handle orphans (no parents, no children — unconnected steps)
    for (const step of steps) {
        if (!visited.has(step.id)) {
            const maxCol = Math.max(0, ...columns.keys()) + 1
            const colItems = columns.get(maxCol) || []
            colItems.push(step.id)
            columns.set(maxCol, colItems)
        }
    }

    // Position: 300px per column, spread vertically with 200px spacing
    for (const [col, ids] of columns) {
        const totalHeight = (ids.length - 1) * 200
        const startY = 100 - totalHeight / 2
        ids.forEach((id, i) => {
            positions.set(id, { x: 80 + col * 300, y: Math.max(20, startY + i * 200) })
        })
    }

    return positions
}
```

Use in `buildNodes`:
```typescript
const positions = layoutNodes(steps)
return steps.map((step) => ({
    id: step.id,
    type: "station",
    position: positions.get(step.id) || { x: 80, y: 100 },
    data: { ... },
}))
```

**Step 4: Add edge deletion**

Add `onEdgesDelete` callback to handle disconnecting steps:

```typescript
const handleEdgesDelete = useCallback((deletedEdges: Edge[]) => {
    for (const edge of deletedEdges) {
        if (edge.source && edge.target && onDisconnectSteps) {
            onDisconnectSteps(edge.source, edge.target)
        }
    }
}, [onDisconnectSteps])
```

**Step 5: In page.tsx, add connect/disconnect handlers**

```typescript
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
```

Pass to BOMCanvas:
```tsx
<BOMCanvas
    ...existing props...
    onConnectSteps={handleConnectSteps}
    onDisconnectSteps={handleDisconnectSteps}
/>
```

**Step 6: Update doSave payload to include parentStepIds**

In the steps mapping of `doSave`:
```typescript
steps: steps.map((step) => ({
    ...existing fields...,
    parentStepIds: step.parentStepIds || [],
})),
```

**Step 7: Commit**

```bash
git add components/manufacturing/bom/bom-canvas.tsx app/manufacturing/bom/\[id\]/page.tsx
git commit -m "feat(bom): branching DAG flow with interactive edge creation"
```

---

### Task 7: Station card — Show duration on each card

**Files:**
- Modify: `components/manufacturing/bom/station-node.tsx`

**Step 1: Add durationMinutes to StationNodeData**

```typescript
export interface StationNodeData {
    // ... existing ...
    durationMinutes: number | null
    // ...
}
```

**Step 2: Add duration display below cost footer**

After the cost footer div, add:

```tsx
{data.durationMinutes && (
    <div className="px-3 py-1 border-t border-zinc-100 bg-zinc-50">
        <p className="text-[9px] font-bold text-blue-500">
            <Clock className="h-3 w-3 inline mr-1" />
            {data.durationMinutes} min
        </p>
    </div>
)}
```

Import `Clock` from lucide-react.

**Step 3: Pass durationMinutes in bom-canvas.tsx buildNodes**

```typescript
durationMinutes: step.durationMinutes || null,
```

**Step 4: Add total estimated time to cost summary strip in page.tsx**

```typescript
// In costSummary useMemo:
const totalDuration = steps.reduce((sum, s) => sum + (s.durationMinutes || 0), 0)
return { ...existing, totalDuration }
```

Add to the strip JSX:
```tsx
<div className="border-l border-zinc-200 pl-3 lg:pl-6 flex items-center gap-1.5 shrink-0">
    <span className="text-[9px] font-black uppercase text-zinc-400">Estimasi:</span>
    <span className="text-xs font-bold text-blue-600">
        {costSummary.totalDuration > 0 ? `${costSummary.totalDuration} min` : "—"}
    </span>
</div>
```

**Step 5: Commit**

```bash
git add components/manufacturing/bom/station-node.tsx components/manufacturing/bom/bom-canvas.tsx app/manufacturing/bom/\[id\]/page.tsx
git commit -m "feat(bom): show estimated duration on cards and cost strip"
```

---

### Task 8: Subcontractor details panel

**Files:**
- Create: `components/manufacturing/bom/subkon-selector.tsx`
- Modify: `components/manufacturing/bom/detail-panel.tsx`

**Step 1: Create SubkonSelector component**

This replaces the simple AllocationEditor when subkon is toggled. It shows a searchable list of subcontractor stations with details, plus an active allocations section.

```tsx
"use client"

import { useState } from "react"
import { useProcessStations } from "@/hooks/use-process-stations"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CreateStationDialog } from "./create-station-dialog"
import { formatCurrency } from "@/lib/inventory-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, Star, Clock, Package, Trash2, X } from "lucide-react"

interface Allocation {
    stationId: string
    quantity: number
    notes: string
}

interface SubkonSelectorProps {
    stationType: string // Filter by matching station type
    allocations: Allocation[]
    totalQty: number
    onChange: (allocations: Allocation[]) => void
}

export function SubkonSelector({ stationType, allocations, totalQty, onChange }: SubkonSelectorProps) {
    const { data: allStations } = useProcessStations()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)

    // Filter to subcontractor stations matching this step's type
    const subkonStations = (allStations || []).filter((s: any) =>
        s.operationType === "SUBCONTRACTOR" &&
        (s.stationType === stationType || !stationType) &&
        s.isActive !== false
    )

    const filtered = subkonStations.filter((s: any) =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.subcontractor?.name?.toLowerCase().includes(search.toLowerCase())
    )

    const allocated = allocations.reduce((sum, a) => sum + a.quantity, 0)
    const remaining = totalQty - allocated

    const addAllocation = (stationId: string) => {
        if (allocations.some(a => a.stationId === stationId)) return
        onChange([...allocations, { stationId, quantity: 0, notes: "" }])
    }

    const updateQty = (stationId: string, qty: number) => {
        onChange(allocations.map(a => a.stationId === stationId ? { ...a, quantity: qty } : a))
    }

    const removeAllocation = (stationId: string) => {
        onChange(allocations.filter(a => a.stationId !== stationId))
    }

    const getStationInfo = (stationId: string) =>
        subkonStations.find((s: any) => s.id === stationId)

    return (
        <div className="space-y-3">
            {/* Header + Search */}
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Pilih Subkontraktor
                </h4>
                <Button
                    variant="outline" size="sm"
                    onClick={() => setCreateOpen(true)}
                    className="h-6 text-[9px] font-bold rounded-none border-dashed px-2"
                >
                    <Plus className="h-3 w-3 mr-1" /> Buat Baru
                </Button>
            </div>

            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari subkon..."
                    className="h-7 text-[10px] pl-7 border-zinc-200 rounded-none"
                />
            </div>

            {/* Subkon list */}
            <ScrollArea className="max-h-[120px]">
                <div className="space-y-1.5">
                    {filtered.map((station: any) => {
                        const isAllocated = allocations.some(a => a.stationId === station.id)
                        const sub = station.subcontractor
                        return (
                            <div key={station.id}
                                className={`p-2 border text-[10px] transition-all ${
                                    isAllocated
                                        ? "border-amber-400 bg-amber-50"
                                        : "border-zinc-200 hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="font-black truncate">{sub?.name || station.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5 text-zinc-500">
                                            <span className="font-mono">{formatCurrency(Number(station.costPerUnit || 0))}/unit</span>
                                            {sub?.maxCapacityPerMonth && (
                                                <>
                                                    <span>·</span>
                                                    <span><Package className="h-3 w-3 inline" /> {sub.maxCapacityPerMonth.toLocaleString()} pcs/bln</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 text-zinc-400">
                                            {sub?.leadTimeDays && (
                                                <span><Clock className="h-3 w-3 inline" /> {sub.leadTimeDays} hari</span>
                                            )}
                                            {sub?.rating > 0 && (
                                                <span><Star className="h-3 w-3 inline text-amber-400" /> {sub.rating}/5</span>
                                            )}
                                            {sub?.onTimeRate > 0 && (
                                                <span>· OTD {sub.onTimeRate}%</span>
                                            )}
                                        </div>
                                    </div>
                                    {!isAllocated && (
                                        <Button
                                            variant="outline" size="sm"
                                            onClick={() => addAllocation(station.id)}
                                            className="h-6 text-[9px] font-bold rounded-none shrink-0 px-2"
                                        >
                                            <Plus className="h-3 w-3" /> Alokasi
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {filtered.length === 0 && (
                        <p className="text-[10px] text-zinc-300 font-bold py-3 text-center">
                            Belum ada subkontraktor
                        </p>
                    )}
                </div>
            </ScrollArea>

            {/* Active allocations */}
            {allocations.length > 0 && (
                <div className="border-t border-zinc-200 pt-2 space-y-1.5">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[9px] font-black uppercase text-zinc-400">Alokasi Aktif</h4>
                        <span className={`text-[10px] font-bold ${
                            remaining === 0 ? "text-emerald-600" : remaining < 0 ? "text-red-600" : "text-amber-600"
                        }`}>
                            {allocated}/{totalQty} pcs
                            {remaining > 0 && <span className="text-zinc-400 ml-1">({remaining} sisa)</span>}
                        </span>
                    </div>
                    {allocations.map((alloc) => {
                        const info = getStationInfo(alloc.stationId)
                        return (
                            <div key={alloc.stationId} className="flex items-center gap-2">
                                <span className="text-[10px] font-bold truncate flex-1">
                                    {info?.subcontractor?.name || info?.name || "—"}
                                </span>
                                <Input
                                    type="number"
                                    value={alloc.quantity}
                                    onChange={(e) => updateQty(alloc.stationId, parseInt(e.target.value) || 0)}
                                    className="h-6 w-16 text-[10px] font-mono border-zinc-200 rounded-none"
                                />
                                <span className="text-[9px] text-zinc-400">pcs</span>
                                <button onClick={() => removeAllocation(alloc.stationId)}>
                                    <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}

            <CreateStationDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                defaultStationType={stationType}
                defaultOperationType="SUBCONTRACTOR"
                onCreated={(station) => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                    addAllocation(station.id)
                }}
            />
        </div>
    )
}
```

**Step 2: Update detail-panel.tsx to use SubkonSelector**

Replace the AllocationEditor usage with SubkonSelector:

```typescript
import { SubkonSelector } from "./subkon-selector"

// In the RIGHT section, replace:
{isSubkon && (
    <SubkonSelector
        stationType={step.station?.stationType}
        allocations={step.allocations || []}
        totalQty={totalQty}
        onChange={onUpdateAllocations}
    />
)}
```

Remove the `AllocationEditor` import.

**Step 3: Update CreateStationDialog to accept defaults**

Add optional `defaultStationType` and `defaultOperationType` props to pre-fill the form when creating a subcontractor from the SubkonSelector.

**Step 4: Commit**

```bash
git add components/manufacturing/bom/subkon-selector.tsx components/manufacturing/bom/detail-panel.tsx components/manufacturing/bom/create-station-dialog.tsx
git commit -m "feat(bom): rich subcontractor selector with vendor details and inline creation"
```

---

### Task 9: Material badge count

**Files:**
- Modify: `components/manufacturing/bom/material-panel.tsx`

**Step 1: Add steps prop to MaterialPanel**

```typescript
interface MaterialPanelProps {
    items: any[]
    steps: any[]  // NEW — to count assignments
    onAddItem: () => void
    onRemoveItem: (id: string) => void
}
```

**Step 2: Compute assignment count and show badge**

```typescript
// Inside the component:
const getAssignmentCount = (itemId: string) => {
    let count = 0
    for (const step of steps) {
        if ((step.materials || []).some((m: any) => m.bomItemId === itemId)) {
            count++
        }
    }
    return count
}

// In the material card JSX, after the item info div:
{(() => {
    const count = getAssignmentCount(item.id)
    return count > 0 ? (
        <span className="bg-black text-white text-[9px] font-black w-5 h-5 flex items-center justify-center shrink-0">
            {count}
        </span>
    ) : null
})()}
```

**Step 3: Pass steps prop in page.tsx**

```tsx
<MaterialPanel
    items={items}
    steps={steps}
    onAddItem={() => setAddMaterialOpen(true)}
    onRemoveItem={handleRemoveItem}
/>
```

**Step 4: Commit**

```bash
git add components/manufacturing/bom/material-panel.tsx app/manufacturing/bom/\[id\]/page.tsx
git commit -m "feat(bom): show material assignment badge count in material panel"
```

---

### Task 10: Verify and clean up

**Step 1: Run TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "(bom|station-node|detail-panel|material-panel|canvas|subkon)" || echo "NO ERRORS"
```

**Step 2: Run lint**

```bash
npm run lint
```

**Step 3: Test in browser**

Navigate to `/manufacturing/bom/[id]` and verify:
1. **Branching flow**: Drag from a card's right handle to empty space or another card — edge created
2. **Tree layout**: Cards with branches spread vertically
3. **Duration on cards**: Set durationMinutes, see it on the card
4. **Estimated time in strip**: Total duration shows in the cost summary
5. **Subkon panel**: Toggle Subkon → rich vendor list with details, searchable
6. **Create subkon**: Click "+ Buat Baru" → dialog opens pre-filled with station type + SUBCONTRACTOR
7. **Material badges**: Materials show assignment count badge
8. **Save + reload**: All edges and connections persist after save

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(bom): complete canvas enhancements — branching, time, subkon, badges"
```
