# Manufacturing — Bugs & UI Fixes (Part 3 of 5)

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 6 bugs in the manufacturing BOM canvas: wrong allocation ratios, wrong duration display, UI overlap in work center distribution, broken template application, dead buttons, and missing validation feedback.

**Architecture:** All bugs are in the frontend BOM canvas editor (`app/manufacturing/bom/[id]/page.tsx`) and its child components under `components/manufacturing/bom/`. The core issue is a shared `calcStepTarget()` function that's duplicated in 3 places with the wrong denominator logic. We'll extract it into a shared helper, fix the logic, then address the remaining UI bugs.

**Tech Stack:** React 19, TypeScript, React Flow (`@xyflow/react`), Sonner (toasts), shadcn/ui, TanStack Query

---

## Bug Map

| Bug ID | Title | Priority | Task |
|--------|-------|----------|------|
| MTG-013 + MTG-025 | Progress ratio denominator wrong (3/3 instead of 3/6) | P1 | Task 1 |
| MTG-014 | Duration per piece calculation wrong (shows 90min) | P1 | Task 2 |
| MTG-015 | Overlap in work center distribution UI | P1 | Task 3 |
| MTG-017 | Template click → blank + no overwrite confirmation | P1 | Task 4 |
| MTG-016 | No error message for duplicate WC allocation | P2 | Task 5 |
| MTG-022 | Remove non-functional "delete for new" button | P2 | Task 6 |

---

## Task 1: Fix Allocation Ratio Denominator (MTG-013 + MTG-025)

**Problem:** The progress ratio on station nodes shows `3/3` when the target is 6 and 3 are allocated. The denominator uses `allocTotal` (sum of allocations) instead of the BOM's `totalProductionQty`. For parallel siblings, it auto-splits, producing unexpected denominators like `3/4`.

**Root cause:** `stepTargets` logic in 3 places uses `allocTotal` as the denominator when allocations exist. But `allocTotal` represents "how much has been distributed to work centers," NOT the step's target. The target should always be `totalProductionQty` for single steps, or evenly split for parallel siblings of the same type WITHOUT explicit allocations.

**Files:**
- Create: `components/manufacturing/bom/bom-step-helpers.ts`
- Modify: `components/manufacturing/bom/bom-canvas.tsx:98-118`
- Modify: `app/manufacturing/bom/[id]/page.tsx:128-146` (costSummary)
- Modify: `app/manufacturing/bom/[id]/page.tsx:588-608` (handleMarkCompleted)
- Test: `__tests__/manufacturing/bom-step-helpers.test.ts`

### Step 1: Write failing tests for `calcStepTarget()`

Create `__tests__/manufacturing/bom-step-helpers.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { calcStepTarget, calcAllStepTargets } from "@/components/manufacturing/bom/bom-step-helpers"

describe("calcStepTarget", () => {
    it("single step with no allocations → target = totalQty", () => {
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(600)
    })

    it("single step WITH allocations → target still = totalQty (not allocTotal)", () => {
        const steps = [
            {
                id: "s1",
                station: { stationType: "CUTTING" },
                allocations: [
                    { stationId: "wc-a", quantity: 300 },
                ],
            },
        ]
        // MTG-013 fix: denominator = 600, NOT 300
        expect(calcStepTarget(steps[0], steps, 600)).toBe(600)
    })

    it("two parallel siblings of same type, no allocations → split evenly", () => {
        const steps = [
            { id: "s1", station: { stationType: "SEWING" }, allocations: [] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(300)
        expect(calcStepTarget(steps[1], steps, 600)).toBe(300)
    })

    it("two parallel siblings, odd totalQty → remainder goes to first", () => {
        const steps = [
            { id: "s1", station: { stationType: "SEWING" }, allocations: [] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 7)).toBe(4)
        expect(calcStepTarget(steps[1], steps, 7)).toBe(3)
    })

    it("parallel siblings WITH allocations → each step target = its own allocTotal", () => {
        const steps = [
            {
                id: "s1",
                station: { stationType: "SEWING" },
                allocations: [{ stationId: "wc-a", quantity: 400 }],
            },
            {
                id: "s2",
                station: { stationType: "SEWING" },
                allocations: [{ stationId: "wc-b", quantity: 200 }],
            },
        ]
        // When parallel siblings have explicit allocations, each sibling's target = its allocTotal
        expect(calcStepTarget(steps[0], steps, 600)).toBe(400)
        expect(calcStepTarget(steps[1], steps, 600)).toBe(200)
    })

    it("different stationTypes are not treated as siblings", () => {
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, allocations: [] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(600)
        expect(calcStepTarget(steps[1], steps, 600)).toBe(600)
    })
})

describe("calcAllStepTargets", () => {
    it("returns a Map of step.id → target", () => {
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, allocations: [] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        const targets = calcAllStepTargets(steps, 600)
        expect(targets.get("s1")).toBe(600)
        expect(targets.get("s2")).toBe(600)
    })
})
```

### Step 2: Run tests to verify they fail

Run: `npx vitest run __tests__/manufacturing/bom-step-helpers.test.ts`
Expected: FAIL — module not found

### Step 3: Implement `bom-step-helpers.ts`

Create `components/manufacturing/bom/bom-step-helpers.ts`:

```ts
/**
 * Calculate the production target for a single BOM step.
 *
 * Rules:
 * 1. Single step (only one of its stationType) with NO allocations → totalQty
 * 2. Single step WITH allocations → totalQty (allocations show distribution, not target)
 * 3. Multiple parallel siblings of same stationType, NONE have allocations → split evenly
 * 4. Multiple parallel siblings, EACH has allocations → each step target = its own allocTotal
 */
export function calcStepTarget(
    step: { id: string; station?: { stationType?: string } | null; allocations?: { quantity: number }[] },
    allSteps: typeof step[],
    totalQty: number,
): number {
    const stationType = step.station?.stationType
    const siblings = stationType
        ? allSteps.filter((s) => s.station?.stationType === stationType)
        : [step]

    if (siblings.length <= 1) {
        // Only one step of this type → full totalQty
        return totalQty
    }

    // Multiple siblings — check if they have explicit allocations
    const siblingsWithAllocs = siblings.filter(
        (s) => (s.allocations || []).reduce((sum, a) => sum + (a.quantity || 0), 0) > 0
    )

    if (siblingsWithAllocs.length > 0) {
        // At least some siblings have allocations → each sibling's target = its own allocTotal
        const allocTotal = (step.allocations || []).reduce((sum, a) => sum + (a.quantity || 0), 0)
        if (allocTotal > 0) return allocTotal
        // Sibling without allocations gets even share of what's left
        const allocatedTotal = siblingsWithAllocs.reduce(
            (sum, s) => sum + (s.allocations || []).reduce((a, b) => a + (b.quantity || 0), 0),
            0
        )
        const unallocatedSiblings = siblings.length - siblingsWithAllocs.length
        const leftover = Math.max(0, totalQty - allocatedTotal)
        return unallocatedSiblings > 0 ? Math.floor(leftover / unallocatedSiblings) : totalQty
    }

    // No siblings have allocations → split evenly
    const idx = siblings.indexOf(step)
    const share = Math.floor(totalQty / siblings.length)
    const remainder = totalQty % siblings.length
    return share + (idx < remainder ? 1 : 0)
}

/** Calculate targets for all steps at once (returns Map<stepId, target>) */
export function calcAllStepTargets(
    steps: { id: string; station?: { stationType?: string } | null; allocations?: { quantity: number }[] }[],
    totalQty: number,
): Map<string, number> {
    const targets = new Map<string, number>()
    for (const step of steps) {
        targets.set(step.id, calcStepTarget(step, steps, totalQty))
    }
    return targets
}
```

### Step 4: Run tests to verify they pass

Run: `npx vitest run __tests__/manufacturing/bom-step-helpers.test.ts`
Expected: ALL PASS

### Step 5: Replace duplicated logic in `bom-canvas.tsx`

In `components/manufacturing/bom/bom-canvas.tsx`, replace lines 98-118:

**Old code (lines 98-118):**
```ts
        // Compute per-step production target (split among parallel siblings)
        const stepTargets = new Map<string, number>()
        for (const step of steps) {
            const allocs = step.allocations || []
            const allocTotal = allocs.reduce((s: number, a: any) => s + (a.quantity || 0), 0)
            if (allocTotal > 0) {
                stepTargets.set(step.id, allocTotal)
            } else {
                const stationType = step.station?.stationType
                const siblings = stationType ? steps.filter((s: any) => s.station?.stationType === stationType) : [step]
                if (siblings.length > 1) {
                    const qty = totalProductionQty || 0
                    const idx = siblings.indexOf(step)
                    const share = Math.floor(qty / siblings.length)
                    const remainder = qty % siblings.length
                    stepTargets.set(step.id, share + (idx < remainder ? 1 : 0))
                } else {
                    stepTargets.set(step.id, totalProductionQty || 0)
                }
            }
        }
```

**New code:**
```ts
        // Compute per-step production target
        const stepTargets = calcAllStepTargets(steps, totalProductionQty || 0)
```

Add import at top of file:
```ts
import { calcAllStepTargets } from "./bom-step-helpers"
```

### Step 6: Replace duplicated logic in `page.tsx` costSummary

In `app/manufacturing/bom/[id]/page.tsx`, replace the `stepTargets` block inside `costSummary` useMemo (lines ~128-146):

**Old code:**
```ts
        const stepTargets = new Map<string, number>()
        for (const step of steps) {
            const allocs = (step as any).allocations || []
            const allocTotal = allocs.reduce((s: number, a: any) => s + (a.quantity || 0), 0)
            if (allocTotal > 0) {
                stepTargets.set(step.id, allocTotal)
            } else {
                const stationType = step.station?.stationType
                const siblings = stationType ? steps.filter((s: any) => s.station?.stationType === stationType) : [step]
                if (siblings.length > 1) {
                    const idx = siblings.indexOf(step)
                    const share = Math.floor(totalQty / siblings.length)
                    const remainder = totalQty % siblings.length
                    stepTargets.set(step.id, share + (idx < remainder ? 1 : 0))
                } else {
                    stepTargets.set(step.id, totalQty)
                }
            }
        }
```

**New code:**
```ts
        const stepTargets = calcAllStepTargets(steps, totalQty)
```

Add import at top of file:
```ts
import { calcAllStepTargets } from "@/components/manufacturing/bom/bom-step-helpers"
```

### Step 7: Fix `handleMarkCompleted` in `page.tsx`

In `app/manufacturing/bom/[id]/page.tsx`, replace the target calculation in `handleMarkCompleted` (lines ~588-601):

**Old code:**
```ts
            const allocs = step.allocations || []
            const allocTotal = allocs.reduce((s: number, a: any) => s + (a.quantity || 0), 0)
            let target = totalQty
            if (allocTotal > 0) {
                target = allocTotal
            } else {
                const siblings = prev.filter(s => s.station?.stationType === step.station?.stationType)
                if (siblings.length > 1) {
                    const idx = siblings.indexOf(step)
                    const share = Math.floor(totalQty / siblings.length)
                    const remainder = totalQty % siblings.length
                    target = share + (idx < remainder ? 1 : 0)
                }
            }
```

**New code:**
```ts
            const target = calcStepTarget(step, prev, totalQty)
```

Add `calcStepTarget` to the existing import:
```ts
import { calcAllStepTargets, calcStepTarget } from "@/components/manufacturing/bom/bom-step-helpers"
```

### Step 8: Run full test suite

Run: `npx vitest run __tests__/manufacturing/`
Expected: ALL PASS

### Step 9: Commit

```bash
git add components/manufacturing/bom/bom-step-helpers.ts __tests__/manufacturing/bom-step-helpers.test.ts components/manufacturing/bom/bom-canvas.tsx app/manufacturing/bom/\[id\]/page.tsx
git commit -m "fix(mfg): allocation ratio denominator — always use target, not allocTotal (MTG-013, MTG-025)"
```

---

## Task 2: Fix Duration Per Piece Display (MTG-014)

**Problem:** Duration per piece shows 90 minutes instead of expected 19 minutes (12+3+4). The per-step `durationMinutes` is a manual input field, so the issue is likely in:
1. The **total estimated time** display in the toolbar (sums `durationMinutes × totalQty` across ALL steps), which users may be confusing for per-piece time
2. OR legacy data where `durationMinutes` contains a batch total instead of per-piece value

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` (toolbar time display, lines ~118-125)
- Modify: `components/manufacturing/bom/station-node.tsx:130-134` (duration display)

### Step 1: Add per-piece total duration to toolbar

In `app/manufacturing/bom/[id]/page.tsx`, the `costSummary` already calculates `estTimeTotalMin` as `sum(durationMinutes) × totalQty`. This is the **total production time**, not per-piece.

Add a `durationPerPiece` field to the costSummary return value. Find the return statement in `costSummary` useMemo (~line 166):

**Old code:**
```ts
        return { totalMaterial, totalLabor, grandTotal, perUnit, totalDuration, estTimeLabel, progressPct }
```

**New code:**
```ts
        // Per-piece total = sum of all step durations (each step's durationMinutes is already per-piece)
        const durationPerPiece = steps.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0)
        return { totalMaterial, totalLabor, grandTotal, perUnit, totalDuration, estTimeLabel, progressPct, durationPerPiece }
```

### Step 2: Display per-piece duration clearly in the toolbar

Find where `estTimeLabel` is displayed in the toolbar. Search for `estTimeLabel` in the JSX. Add a "per pcs" label next to it or replace the ambiguous display.

Find the toolbar section that shows time (search for `Clock` icon near `estTimeLabel` in the JSX, around line ~870-880). Add clarity:

Where the time estimate is shown, ensure it displays like:
```
⏱ 19 menit/pcs | Total: 3 jam 10 menit (× 10 pcs)
```

Locate the exact rendering and update to show both values clearly. If only `estTimeLabel` (total time) is shown, prepend per-piece:

```tsx
{costSummary.durationPerPiece > 0 && (
    <span className="text-[10px] font-bold text-blue-600 flex items-center gap-1 shrink-0">
        <Clock className="h-3.5 w-3.5" />
        {costSummary.durationPerPiece} menit/pcs
        {costSummary.estTimeLabel && (
            <span className="text-zinc-400 font-normal ml-1">
                (Total: {costSummary.estTimeLabel})
            </span>
        )}
    </span>
)}
```

### Step 3: Run type check

Run: `npx tsc --noEmit`
Expected: No new errors

### Step 4: Commit

```bash
git add app/manufacturing/bom/\[id\]/page.tsx
git commit -m "fix(mfg): clarify duration display — show per-piece + total separately (MTG-014)"
```

---

## Task 3: Fix Overlap in Work Center Distribution UI (MTG-015)

**Problem:** `InHouseAllocator` has two sections: (1) a station picker list showing ALL available stations, and (2) an "Alokasi Aktif" section below it showing already-allocated stations with qty inputs. This creates visual duplication — allocated stations appear twice (once highlighted green in the picker, once in the active section).

**Fix:** Merge the two sections into a single unified list. Each station row shows: Name — Qty Input (if allocated) or "+ Alokasi" button (if not). Remove the separate "Alokasi Aktif" section.

**Files:**
- Modify: `components/manufacturing/bom/inhouse-allocator.tsx`

### Step 1: Rewrite `InHouseAllocator` to unified layout

Replace the content of `components/manufacturing/bom/inhouse-allocator.tsx` with a unified layout:

```tsx
"use client"

import { useState } from "react"
import { useProcessStations } from "@/hooks/use-process-stations"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CreateStationDialog } from "./create-station-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Search, Plus, X, Building2, Shuffle } from "lucide-react"
import { toast } from "sonner"

interface Allocation {
    stationId: string
    quantity: number
    pricePerPcs: number
    notes: string
}

interface InHouseAllocatorProps {
    stationType: string
    allocations: Allocation[]
    totalQty: number
    onChange: (allocations: Allocation[]) => void
}

export function InHouseAllocator({ stationType, allocations, totalQty, onChange }: InHouseAllocatorProps) {
    const { data: allStations } = useProcessStations()
    const queryClient = useQueryClient()
    const [search, setSearch] = useState("")
    const [createOpen, setCreateOpen] = useState(false)

    const inhouseStations = (allStations || []).filter((s: any) =>
        s.operationType !== "SUBCONTRACTOR" &&
        (s.stationType === stationType || !stationType) &&
        s.isActive !== false
    )

    const filtered = inhouseStations.filter((s: any) =>
        s.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.code?.toLowerCase().includes(search.toLowerCase())
    )

    const allocated = allocations.reduce((sum, a) => sum + a.quantity, 0)
    const remaining = totalQty - allocated

    const addAllocation = (stationId: string) => {
        if (allocations.some(a => a.stationId === stationId)) {
            toast.info("Work center ini sudah dialokasikan")
            return
        }
        onChange([...allocations, { stationId, quantity: 0, pricePerPcs: 0, notes: "" }])
    }

    const updateQty = (stationId: string, qty: number) => {
        onChange(allocations.map(a => a.stationId === stationId ? { ...a, quantity: qty } : a))
    }

    const removeAllocation = (stationId: string) => {
        onChange(allocations.filter(a => a.stationId !== stationId))
    }

    const getStationInfo = (stationId: string) =>
        inhouseStations.find((s: any) => s.id === stationId)

    const autoDistribute = () => {
        if (allocations.length === 0) return
        const share = Math.floor(totalQty / allocations.length)
        const remainder = totalQty % allocations.length
        onChange(allocations.map((a, i) => ({
            ...a,
            quantity: share + (i < remainder ? 1 : 0),
        })))
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    <Building2 className="h-3 w-3 inline mr-1" />
                    Distribusi Work Center
                </h4>
                <div className="flex items-center gap-2">
                    {allocations.length >= 2 && (
                        <button
                            onClick={autoDistribute}
                            className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-0.5"
                        >
                            <Shuffle className="h-3 w-3" /> Bagi Rata
                        </button>
                    )}
                    <Button
                        variant="outline" size="sm"
                        onClick={() => setCreateOpen(true)}
                        className="h-6 text-[9px] font-bold rounded-none border-dashed px-2"
                    >
                        <Plus className="h-3 w-3 mr-1" /> Buat Baru
                    </Button>
                </div>
            </div>

            {/* Summary bar */}
            {allocations.length > 0 && (
                <div className={`flex items-center justify-between px-2 py-1.5 border-2 text-[10px] font-black ${
                    remaining === 0 ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                        : remaining < 0 ? "border-red-400 bg-red-50 text-red-700"
                        : "border-amber-400 bg-amber-50 text-amber-700"
                }`}>
                    <span>{allocated}/{totalQty} pcs teralokasi</span>
                    {remaining > 0 && <span>{remaining} sisa</span>}
                    {remaining < 0 && <span>{Math.abs(remaining)} kelebihan!</span>}
                    {remaining === 0 && <span>Lengkap</span>}
                </div>
            )}

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
                <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari..."
                    className="h-7 text-[10px] pl-7 border-zinc-200 rounded-none placeholder:text-zinc-300"
                />
            </div>

            {/* Unified station list */}
            <ScrollArea className="max-h-[200px]">
                <div className="space-y-1.5">
                    {filtered.map((station: any) => {
                        const alloc = allocations.find(a => a.stationId === station.id)
                        const isAllocated = !!alloc

                        return (
                            <div
                                key={station.id}
                                className={`p-2 border text-[10px] transition-all ${
                                    isAllocated
                                        ? "border-emerald-400 bg-emerald-50"
                                        : "border-zinc-200 hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-black truncate">
                                            {station.name}
                                            {station.code && (
                                                <span className="text-zinc-400 font-mono ml-1">({station.code})</span>
                                            )}
                                        </p>
                                    </div>

                                    {isAllocated ? (
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <Input
                                                type="number"
                                                value={alloc.quantity}
                                                onChange={(e) => updateQty(station.id, parseInt(e.target.value) || 0)}
                                                className="h-6 w-20 text-[10px] font-mono border-emerald-300 rounded-none"
                                            />
                                            <span className="text-[9px] text-zinc-400">pcs</span>
                                            <button onClick={() => removeAllocation(station.id)}>
                                                <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                                            </button>
                                        </div>
                                    ) : (
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
                            Belum ada work center untuk tipe ini
                        </p>
                    )}
                </div>
            </ScrollArea>

            <CreateStationDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                defaultStationType={stationType}
                defaultOperationType="IN_HOUSE"
                onCreated={(station: any) => {
                    queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
                    addAllocation(station.id)
                }}
            />
        </div>
    )
}
```

### Step 2: Run type check

Run: `npx tsc --noEmit`
Expected: No new errors

### Step 3: Commit

```bash
git add components/manufacturing/bom/inhouse-allocator.tsx
git commit -m "fix(mfg): unified work center distribution UI — one row per station, no overlap (MTG-015)"
```

---

## Task 4: Fix Template Application — Blank Result + No Overwrite Confirmation (MTG-017)

**Problem:** Two bugs:
1. Clicking a template when ProcessStation auto-create fails → silent `continue` → empty result → appears blank
2. Template APPENDS to existing steps instead of REPLACING. No confirmation dialog when steps already exist.

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` (lines ~346-395, `handleApplyTemplate`, and add state for confirmation dialog)

### Step 1: Add template overwrite confirmation dialog state

In `app/manufacturing/bom/[id]/page.tsx`, after the existing `applyingTemplate` state (~line 347), add:

```ts
const [templateConfirm, setTemplateConfirm] = useState<{ types: readonly string[] } | null>(null)
```

### Step 2: Modify `handleApplyTemplate` to replace instead of append

Replace the `handleApplyTemplate` function (~lines 348-395):

```ts
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
```

### Step 3: Add confirmation dialog in JSX

Find a good spot in the JSX return — right after other dialogs (search for `</Dialog>` near the end of the file, or after the SPK result dialog). Add:

```tsx
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
```

### Step 4: Run type check

Run: `npx tsc --noEmit`
Expected: No new errors

### Step 5: Commit

```bash
git add app/manufacturing/bom/\[id\]/page.tsx
git commit -m "fix(mfg): template replaces steps (not appends) + confirmation dialog (MTG-017)"
```

---

## Task 5: Add Error Message for Duplicate WC Allocation (MTG-016)

**Problem:** Attempting to allocate a process to the same work center twice silently fails. The button is hidden but there's no feedback if triggered programmatically.

**Already handled in Task 3.** The new `InHouseAllocator` from Task 3 includes `toast.info("Work center ini sudah dialokasikan")` in the `addAllocation` function. The button is also hidden for allocated stations (replaced with qty input).

**No additional work needed** — this is covered by the Task 3 rewrite.

### Step 1: Verify

After Task 3 is implemented, visually verify in the browser:
1. Open a BOM → select a step → click "Distribusi ke multi work center"
2. Allocate WC-A → qty input appears inline
3. The "+ Alokasi" button for WC-A is gone (replaced with qty input)
4. Programmatic duplicate (if possible) → toast appears

### Step 2: Commit

No separate commit needed — included in Task 3.

---

## Task 6: Remove Non-Functional "Delete for New" Button (MTG-022)

**Status: Needs clarification.** Exhaustive search found zero instances of "delete for new" or similar text in the manufacturing codebase. The button may:
1. Have already been removed
2. Be in a different module
3. Be dynamically generated from database content
4. Be a translation/localization issue (different label in Indonesian)

### Step 1: Ask Raymond for the exact page URL

Ask: "Raymond, di halaman mana tombol 'delete for new' muncul? Bisa kasih URL atau screenshot?"

### Step 2: Once located, remove the button

After getting the exact location:
- Remove the button JSX
- Remove any associated handler function
- If the handler calls an API, check if the API endpoint is used elsewhere before removing

### Step 3: Commit

```bash
git add <identified-file>
git commit -m "fix(mfg): remove non-functional 'delete for new' button (MTG-022)"
```

---

## Verification Checklist

After all tasks are complete, verify each bug fix:

| Bug | Halaman | Cara Test | Expected |
|-----|---------|-----------|----------|
| MTG-013/025 | `/manufacturing/bom/[id]` | Create BOM, target=6, allocate 3 to WC-A | Progress shows **3/6**, not 3/3 |
| MTG-014 | `/manufacturing/bom/[id]` | Add 3 steps: 12min, 3min, 4min | Toolbar shows **19 menit/pcs** |
| MTG-015 | `/manufacturing/bom/[id]` → click step → Distribusi | Open distribution panel | One row per WC, no overlap |
| MTG-017 | `/manufacturing/bom/[id]` → click template with steps | Click template when form has data | Confirmation dialog appears |
| MTG-016 | `/manufacturing/bom/[id]` → Distribusi panel | Already-allocated WC shows qty input, not button | No duplicate possible |
| MTG-022 | TBD | TBD | TBD |

### Final verification command

```bash
npx vitest run && npx tsc --noEmit && npm run lint
```
