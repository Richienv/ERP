# BOM Detail Panel Enhancement + Cost Breakdown

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the BOM detail page with cost summary strip, material cost breakdown per step, and In-House/Subkontrak toggle with allocation editor.

**Architecture:** All cost calculations are client-side using material `costPrice` from the Product model (already returned by API). The detail panel is expanded with 3 sections. A new cost summary strip is added as toolbar row 3. The station card cost footer is updated to show calculated material costs. No schema changes — subkon state is derived from allocations.

**Tech Stack:** React, TypeScript, TanStack Query (existing), `formatCurrency` from `lib/inventory-utils.ts`

---

### Task 1: Fix API — Include `costPrice` in step material responses

**Files:**
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts:44-49`

**Step 1: Update the step materials include to add costPrice**

In the GET handler, the `steps.materials.bomItem.material` select only has `id, code, name, unit`. Add `costPrice`.

```typescript
// Line 48 — change material select inside steps → materials → bomItem
material: { select: { id: true, code: true, name: true, unit: true, costPrice: true } },
```

**Step 2: Verify dev server still works**

Run: `npm run dev` (should compile without errors)

**Step 3: Commit**

```bash
git add app/api/manufacturing/production-bom/\[id\]/route.ts
git commit -m "fix(bom): include costPrice in step material API response"
```

---

### Task 2: Add cost calculation helpers

**Files:**
- Create: `components/manufacturing/bom/bom-cost-helpers.ts`

**Step 1: Create the helpers file**

```typescript
/**
 * BOM cost calculation helpers — all client-side.
 * Material prices come from Product.costPrice (fetched via API).
 */

export interface BOMItemWithCost {
    id: string
    materialId?: string
    material?: { id: string; costPrice?: number | string; name?: string; unit?: string; code?: string }
    quantityPerUnit: number | string
    wastePct?: number | string
    unit?: string
}

/** Get the cost price of a BOM item's material as a number */
export function getMaterialCostPrice(item: BOMItemWithCost): number {
    return Number(item.material?.costPrice || 0)
}

/** Calculate material cost per unit (qty × price, with waste) */
export function calcItemCostPerUnit(item: BOMItemWithCost): number {
    const qty = Number(item.quantityPerUnit || 0)
    const price = getMaterialCostPrice(item)
    const wastePct = Number(item.wastePct || 0)
    const wasteMultiplier = 1 + wastePct / 100
    return qty * price * wasteMultiplier
}

/** Calculate total material cost for a step (sum of its assigned items × target qty) */
export function calcStepMaterialCost(
    step: { materials?: { bomItemId: string }[] },
    allItems: BOMItemWithCost[],
    targetQty: number,
): number {
    if (!step.materials?.length) return 0
    let total = 0
    for (const sm of step.materials) {
        const item = allItems.find((i) => i.id === sm.bomItemId)
        if (item) total += calcItemCostPerUnit(item)
    }
    return total * targetQty
}

/** Calculate total labor/station cost for a step */
export function calcStepLaborCost(
    step: { station?: { costPerUnit?: number | string } },
    targetQty: number,
): number {
    return Number(step.station?.costPerUnit || 0) * targetQty
}

/** Calculate grand total material cost across all steps */
export function calcTotalMaterialCost(
    steps: { materials?: { bomItemId: string }[] }[],
    allItems: BOMItemWithCost[],
    targetQty: number,
): number {
    // Sum unique materials across all steps (avoid double-counting same material in multiple steps)
    const uniqueMaterialIds = new Set<string>()
    for (const step of steps) {
        for (const sm of step.materials || []) {
            uniqueMaterialIds.add(sm.bomItemId)
        }
    }
    let total = 0
    for (const bomItemId of uniqueMaterialIds) {
        const item = allItems.find((i) => i.id === bomItemId)
        if (item) total += calcItemCostPerUnit(item)
    }
    return total * targetQty
}

/** Calculate grand total labor cost across all steps */
export function calcTotalLaborCost(
    steps: { station?: { costPerUnit?: number | string } }[],
    targetQty: number,
): number {
    let total = 0
    for (const step of steps) {
        total += Number(step.station?.costPerUnit || 0)
    }
    return total * targetQty
}
```

**Step 2: Commit**

```bash
git add components/manufacturing/bom/bom-cost-helpers.ts
git commit -m "feat(bom): add client-side cost calculation helpers"
```

---

### Task 3: Add cost summary strip (toolbar row 3)

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx`

**Step 1: Add imports**

At the top of the file, add:
```typescript
import { formatCurrency } from "@/lib/inventory-utils"
import {
    calcTotalMaterialCost, calcTotalLaborCost,
    calcItemCostPerUnit, BOMItemWithCost,
} from "@/components/manufacturing/bom/bom-cost-helpers"
```

**Step 2: Add cost summary strip after toolbar row 2 (after line 432)**

Insert between the toolbar row 2 closing `</div>` and the `{/* MAIN CONTENT */}` comment:

```tsx
{/* TOOLBAR — Row 3: Cost Summary Strip */}
<div className="border-b border-zinc-200 bg-white px-4 py-1.5 flex items-center gap-6 shrink-0">
    {(() => {
        const totalMaterial = calcTotalMaterialCost(steps, items as BOMItemWithCost[], targetQty)
        const totalLabor = calcTotalLaborCost(steps, targetQty)
        const grandTotal = totalMaterial + totalLabor
        const perUnit = targetQty > 0 ? grandTotal / targetQty : 0
        const targetQty = totalQty // alias for clarity
        return (
            <>
                <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Material:</span>
                    <span className="text-xs font-bold text-black">{formatCurrency(totalMaterial)}</span>
                </div>
                <div className="border-l border-zinc-200 pl-6 flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Labor:</span>
                    <span className="text-xs font-bold text-black">{formatCurrency(totalLabor)}</span>
                </div>
                <div className="border-l border-zinc-200 pl-6 flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Total/Unit:</span>
                    <span className="text-xs font-bold text-black">{formatCurrency(perUnit)}</span>
                </div>
                <div className="border-l-2 border-black pl-6 flex items-center gap-1.5">
                    <span className="text-[9px] font-black uppercase text-zinc-400">Total ({totalQty} pcs):</span>
                    <span className="text-sm font-black text-emerald-700">{formatCurrency(grandTotal)}</span>
                </div>
            </>
        )
    })()}
</div>
```

Note: Use `totalQty` directly (the state variable), not a local `targetQty` alias — the IIFE was just for illustration. Actually, compute these values as `useMemo` instead of an IIFE for better performance:

```typescript
// Add near the top of the component, after state declarations
const costSummary = useMemo(() => {
    const totalMaterial = calcTotalMaterialCost(steps, items as BOMItemWithCost[], totalQty)
    const totalLabor = calcTotalLaborCost(steps, totalQty)
    const grandTotal = totalMaterial + totalLabor
    const perUnit = totalQty > 0 ? grandTotal / totalQty : 0
    return { totalMaterial, totalLabor, grandTotal, perUnit }
}, [steps, items, totalQty])
```

Add `useMemo` to the React import at line 3.

Then the strip JSX uses `costSummary.totalMaterial`, etc.

**Step 3: Verify in browser**

Navigate to `/manufacturing/bom/[id]` — cost strip should appear below process buttons showing Rp 0 initially, and update as materials have costPrice values.

**Step 4: Commit**

```bash
git add app/manufacturing/bom/\[id\]/page.tsx
git commit -m "feat(bom): add cost summary strip in toolbar"
```

---

### Task 4: Enhance detail-panel with In-House/Subkon toggle + material cost breakdown

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx`

This is the largest task. The detail panel needs 3 sections:

**Step 1: Update the DetailPanel props and imports**

```typescript
import { AllocationEditor } from "./allocation-editor"
import { calcItemCostPerUnit, calcStepMaterialCost, BOMItemWithCost } from "./bom-cost-helpers"
import { formatCurrency } from "@/lib/inventory-utils"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Paperclip, Upload, X, Clock, Cog, Building2, Truck } from "lucide-react"

interface DetailPanelProps {
    step: any
    totalQty: number
    stations: any[]
    allItems: BOMItemWithCost[] // NEW — all BOM items for cost lookup
    onUpdateStep: (field: string, value: any) => void
    onUpdateAllocations: (allocations: any[]) => void
    onUploadAttachment: () => void
    onDeleteAttachment: (id: string) => void
    onToggleSubkon: (useSubkon: boolean) => void // NEW — toggle handler
}
```

**Step 2: Rewrite the component body**

Replace the entire return JSX with the enhanced 3-section layout:

```tsx
export function DetailPanel({
    step, totalQty, stations, allItems,
    onUpdateStep, onUpdateAllocations,
    onUploadAttachment, onDeleteAttachment,
    onToggleSubkon,
}: DetailPanelProps) {
    if (!step) return null

    const isSubkon = step.useSubkon ?? step.station?.operationType === "SUBCONTRACTOR"

    // Get materials assigned to this step with their cost data
    const stepMaterials = (step.materials || []).map((sm: any) => {
        const item = allItems.find((i) => i.id === sm.bomItemId)
        return { ...sm, item }
    }).filter((sm: any) => sm.item)

    const stepMaterialTotal = calcStepMaterialCost(step, allItems, totalQty)
    const stepLaborTotal = Number(step.station?.costPerUnit || 0) * totalQty

    return (
        <div className="border-t-2 border-black bg-white px-5 py-3 shrink-0 max-h-[280px] overflow-y-auto">
            <div className="flex items-start gap-5">
                {/* LEFT — Step Config + Toggle */}
                <div className="w-[240px] shrink-0 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                        <Cog className="h-4 w-4" />
                        <h3 className="font-black text-sm uppercase">{step.station?.name}</h3>
                    </div>

                    {/* In-House / Subkon Toggle */}
                    <div className="flex border-2 border-black">
                        <button
                            onClick={() => onToggleSubkon(false)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase transition-colors ${
                                !isSubkon ? "bg-emerald-500 text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                            }`}
                        >
                            <Building2 className="h-3 w-3" /> In-House
                        </button>
                        <button
                            onClick={() => onToggleSubkon(true)}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-black uppercase border-l-2 border-black transition-colors ${
                                isSubkon ? "bg-amber-500 text-white" : "bg-white text-zinc-400 hover:bg-zinc-50"
                            }`}
                        >
                            <Truck className="h-3 w-3" /> Subkontrak
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">
                                <Clock className="h-3 w-3 inline mr-1" /> Durasi (menit)
                            </label>
                            <Input
                                type="number"
                                value={step.durationMinutes || ""}
                                onChange={(e) => onUpdateStep("durationMinutes", parseInt(e.target.value) || null)}
                                className="h-8 text-xs font-mono border-zinc-200 rounded-none"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Catatan</label>
                            <Textarea
                                value={step.notes || ""}
                                onChange={(e) => onUpdateStep("notes", e.target.value)}
                                className="text-xs border-zinc-200 rounded-none min-h-[32px] h-8"
                            />
                        </div>
                    </div>
                </div>

                {/* CENTER — Material Cost Breakdown */}
                <div className="flex-1 border-l-2 border-zinc-100 pl-5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Rincian Biaya Material</h4>
                    {stepMaterials.length === 0 ? (
                        <p className="text-[10px] text-zinc-300 font-bold py-4 text-center">Belum ada material di proses ini</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-[10px]">
                                <thead>
                                    <tr className="border-b border-zinc-200 text-zinc-400 font-black uppercase">
                                        <th className="text-left py-1 pr-3">Material</th>
                                        <th className="text-right py-1 px-2">Qty/Unit</th>
                                        <th className="text-right py-1 px-2">Harga</th>
                                        <th className="text-right py-1 px-2">× {totalQty} pcs</th>
                                        <th className="text-right py-1 pl-2">Subtotal</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stepMaterials.map((sm: any) => {
                                        const item = sm.item as BOMItemWithCost
                                        const costPerUnit = calcItemCostPerUnit(item)
                                        const totalForItem = costPerUnit * totalQty
                                        const qtyWithWaste = Number(item.quantityPerUnit) * (1 + Number(item.wastePct || 0) / 100)
                                        return (
                                            <tr key={sm.bomItemId} className="border-b border-zinc-50">
                                                <td className="py-1.5 pr-3 font-bold">{item.material?.name}</td>
                                                <td className="py-1.5 px-2 text-right font-mono">{Number(item.quantityPerUnit)} {item.unit || item.material?.unit}</td>
                                                <td className="py-1.5 px-2 text-right font-mono">{formatCurrency(Number(item.material?.costPrice || 0))}</td>
                                                <td className="py-1.5 px-2 text-right font-mono">{(qtyWithWaste * totalQty).toFixed(1)}</td>
                                                <td className="py-1.5 pl-2 text-right font-mono font-bold">{formatCurrency(totalForItem)}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="border-t-2 border-black font-black">
                                        <td colSpan={4} className="py-1.5 text-right pr-2 uppercase text-zinc-500">Total Material</td>
                                        <td className="py-1.5 pl-2 text-right">{formatCurrency(stepMaterialTotal)}</td>
                                    </tr>
                                    {stepLaborTotal > 0 && (
                                        <tr className="font-bold text-zinc-500">
                                            <td colSpan={4} className="py-1 text-right pr-2 uppercase">Labor/Proses</td>
                                            <td className="py-1 pl-2 text-right">{formatCurrency(stepLaborTotal)}</td>
                                        </tr>
                                    )}
                                    <tr className="font-black text-emerald-700">
                                        <td colSpan={4} className="py-1 text-right pr-2 uppercase">Total Proses</td>
                                        <td className="py-1 pl-2 text-right">{formatCurrency(stepMaterialTotal + stepLaborTotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* RIGHT — Allocations (if subkon) + Attachments */}
                <div className="w-[280px] shrink-0 border-l-2 border-zinc-100 pl-5 space-y-3">
                    {isSubkon && (
                        <AllocationEditor
                            allocations={step.allocations || []}
                            totalQty={totalQty}
                            stations={stations.filter((s) => s.operationType === "SUBCONTRACTOR")}
                            onChange={onUpdateAllocations}
                        />
                    )}

                    {/* Attachments */}
                    <div>
                        <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                            <Paperclip className="h-3 w-3 inline mr-1" /> Lampiran
                        </h4>
                        <div className="space-y-1.5">
                            {(step.attachments || []).map((att: any) => (
                                <div key={att.id} className="flex items-center gap-2 text-xs group">
                                    <Paperclip className="h-3 w-3 text-zinc-400 shrink-0" />
                                    <a href={att.fileUrl} target="_blank" rel="noreferrer" className="font-bold truncate flex-1 hover:underline">{att.fileName}</a>
                                    <span className="text-[9px] text-zinc-400">{(att.fileSize / 1024).toFixed(0)}KB</span>
                                    <button onClick={() => onDeleteAttachment(att.id)} className="opacity-0 group-hover:opacity-100">
                                        <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <Button onClick={onUploadAttachment} variant="outline" size="sm" className="h-7 text-[10px] font-bold rounded-none border-dashed w-full mt-2">
                            <Upload className="mr-1 h-3 w-3" /> Upload File
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
```

**Step 3: Commit**

```bash
git add components/manufacturing/bom/detail-panel.tsx
git commit -m "feat(bom): enhanced detail panel with cost breakdown and subkon toggle"
```

---

### Task 5: Update station card to show calculated material cost

**Files:**
- Modify: `components/manufacturing/bom/station-node.tsx`

**Step 1: Add `materialCost` to StationNodeData interface**

```typescript
export interface StationNodeData {
    station: any
    sequence: number
    materials: { bomItemId: string; materialName: string }[]
    isSelected: boolean
    materialCost: number // NEW — calculated material cost for display
    onRemoveMaterial: (bomItemId: string) => void
    onDrop: (bomItemId: string) => void
    onRemoveStep?: () => void
    [key: string]: unknown
}
```

**Step 2: Update the cost footer to use materialCost**

Replace the cost footer div (lines 92-95):

```tsx
{/* Cost footer */}
<div className="px-3 py-1.5 border-t border-zinc-100 bg-zinc-50">
    <p className="text-[9px] font-bold text-zinc-400">
        {data.materialCost > 0
            ? <span className="text-emerald-600">{`Rp ${data.materialCost.toLocaleString("id-ID")}/unit`}</span>
            : `Rp ${Number(station?.costPerUnit || 0).toLocaleString("id-ID")}/unit`
        }
    </p>
</div>
```

**Step 3: Commit**

```bash
git add components/manufacturing/bom/station-node.tsx
git commit -m "feat(bom): station card shows calculated material cost"
```

---

### Task 6: Wire everything together in the page component

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx`

**Step 1: Add `useMemo` import and cost helpers import**

Already done in Task 3. Ensure imports include:
```typescript
import { use, useState, useCallback, useRef, useMemo } from "react"
import { formatCurrency } from "@/lib/inventory-utils"
import {
    calcTotalMaterialCost, calcTotalLaborCost,
    calcItemCostPerUnit, calcStepMaterialCost,
    BOMItemWithCost,
} from "@/components/manufacturing/bom/bom-cost-helpers"
```

**Step 2: Add cost summary memo**

After the `initialized` ref (line 53), add:

```typescript
const costSummary = useMemo(() => {
    const totalMaterial = calcTotalMaterialCost(steps, items as BOMItemWithCost[], totalQty)
    const totalLabor = calcTotalLaborCost(steps, totalQty)
    const grandTotal = totalMaterial + totalLabor
    const perUnit = totalQty > 0 ? grandTotal / totalQty : 0
    return { totalMaterial, totalLabor, grandTotal, perUnit }
}, [steps, items, totalQty])
```

**Step 3: Add handleToggleSubkon handler**

After `handleUpdateAllocations` (line 210), add:

```typescript
const handleToggleSubkon = useCallback((useSubkon: boolean) => {
    if (!selectedStepId) return
    setSteps((prev) => prev.map((step) =>
        step.id === selectedStepId
            ? { ...step, useSubkon, allocations: useSubkon ? (step.allocations || []) : [] }
            : step
    ))
}, [selectedStepId])
```

**Step 4: Add cost summary strip JSX**

Between toolbar row 2 closing `</div>` and `{/* MAIN CONTENT */}`, add:

```tsx
{/* TOOLBAR — Row 3: Cost Summary Strip */}
<div className="border-b border-zinc-200 bg-white px-4 py-1.5 flex items-center gap-6 shrink-0">
    <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase text-zinc-400">Material:</span>
        <span className="text-xs font-bold text-black">{formatCurrency(costSummary.totalMaterial)}</span>
    </div>
    <div className="border-l border-zinc-200 pl-6 flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase text-zinc-400">Labor:</span>
        <span className="text-xs font-bold text-black">{formatCurrency(costSummary.totalLabor)}</span>
    </div>
    <div className="border-l border-zinc-200 pl-6 flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase text-zinc-400">HPP/Unit:</span>
        <span className="text-xs font-bold text-black">{formatCurrency(costSummary.perUnit)}</span>
    </div>
    <div className="border-l-2 border-black pl-6 flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase text-zinc-400">Total ({totalQty} pcs):</span>
        <span className="text-sm font-black text-emerald-700">{formatCurrency(costSummary.grandTotal)}</span>
    </div>
</div>
```

**Step 5: Update DetailPanel call to pass new props**

```tsx
<DetailPanel
    step={selectedStep}
    totalQty={totalQty}
    stations={allStations || []}
    allItems={items as BOMItemWithCost[]}
    onUpdateStep={handleUpdateStep}
    onUpdateAllocations={handleUpdateAllocations}
    onUploadAttachment={handleUploadAttachment}
    onDeleteAttachment={handleDeleteAttachment}
    onToggleSubkon={handleToggleSubkon}
/>
```

**Step 6: Pass materialCost to BOMCanvas → StationNode**

The BOMCanvas creates nodes from steps. We need to pass `materialCost` to each node's data. Check `bom-canvas.tsx` to find where node data is built — add `materialCost: calcItemCostPerUnit(...)` computation there.

In the page, update the `BOMCanvas` call to pass `allItems`:

```tsx
<BOMCanvas
    steps={steps}
    items={items}
    onStepSelect={setSelectedStepId}
    onDropMaterial={handleDropMaterial}
    onRemoveMaterial={handleRemoveMaterial}
    onRemoveStep={handleRemoveStep}
    selectedStepId={selectedStepId}
/>
```

Items are already passed. The BOMCanvas needs to calculate `materialCost` per node. Modify `bom-canvas.tsx` to compute this.

**Step 7: Commit**

```bash
git add app/manufacturing/bom/\[id\]/page.tsx
git commit -m "feat(bom): wire cost summary strip, subkon toggle, and cost props"
```

---

### Task 7: Update BOMCanvas to pass materialCost to StationNode

**Files:**
- Modify: `components/manufacturing/bom/bom-canvas.tsx`

**Step 1: Add cost helper import**

```typescript
import { calcItemCostPerUnit, BOMItemWithCost } from "./bom-cost-helpers"
```

**Step 2: In the node-building code, compute materialCost for each step**

Find where the nodes array is created (mapping steps → React Flow nodes). For each step, calculate:

```typescript
// For each step node data:
const stepMaterialCostPerUnit = (step.materials || []).reduce((sum: number, sm: any) => {
    const item = items.find((i: any) => i.id === sm.bomItemId)
    if (!item) return sum
    return sum + calcItemCostPerUnit(item as BOMItemWithCost)
}, 0)

// Add to node data:
materialCost: stepMaterialCostPerUnit + Number(step.station?.costPerUnit || 0),
```

**Step 3: Commit**

```bash
git add components/manufacturing/bom/bom-canvas.tsx
git commit -m "feat(bom): canvas passes calculated materialCost to station nodes"
```

---

### Task 8: Verify and test end-to-end

**Step 1: Run dev server**

```bash
npm run dev
```

**Step 2: Navigate to `/manufacturing/bom/[id]`**

Verify:
1. Cost summary strip shows below process buttons with Material / Labor / HPP/Unit / Total
2. Click a station card — detail panel shows:
   - In-House / Subkontrak toggle
   - Material cost breakdown table with qty × price × target
   - Allocations (if subkon toggled)
   - Attachments
3. Change target qty in toolbar — all costs recalculate live
4. Toggle In-House ↔ Subkontrak — allocation editor shows/hides
5. Station cards show calculated cost per unit (not just station.costPerUnit)

**Step 3: Run lint**

```bash
npm run lint
```

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(bom): complete cost breakdown, subkon toggle, cost summary strip"
```
