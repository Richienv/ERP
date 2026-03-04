# BOM Timeline & Canvas Improvements

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 4 issues in the BOM timeline/canvas: show station type on canvas cards, enable free drag in timeline, multiply duration by qty for timeline bars, and split progress across parallel steps.

**Architecture:** All changes are frontend-only across 3 existing components + 1 page file. No schema/API changes needed.

**Tech Stack:** React, @xyflow/react (canvas), custom SVG timeline

---

## Context

**Current problems (from user screenshots):**
1. Canvas cards don't show station type icon clearly enough to distinguish "Potong" vs "Potong A"
2. Timeline bars are locked to station rows — can't freely drag/reposition for parallel scheduling
3. Timeline bar width = `durationMinutes` per pcs, but should be `durationMinutes × totalQty` (e.g., 3pcs × 3min = 9min bar)
4. Two parallel steps (e.g., Potong + Potong A) both show progress "6/6" — should split qty proportionally (e.g., "2/6" and "4/6")

**Key files:**
- `components/manufacturing/bom/station-node.tsx` — Canvas card component (163 lines)
- `components/manufacturing/bom/timeline-view.tsx` — Timeline view (287 lines)
- `components/manufacturing/bom/bom-canvas.tsx` — Canvas wrapper (~200 lines)
- `app/manufacturing/bom/[id]/page.tsx` — Main BOM page (~1000 lines)

---

### Task 1: Show station type badge on canvas cards

**Files:**
- Modify: `components/manufacturing/bom/station-node.tsx:60-68`

**What:** Add a small colored badge showing the station type (CUTTING, SEWING, etc.) below the station name on each card header, so users can visually distinguish stations of the same type.

**Step 1: Add stationType badge to card header**

In `station-node.tsx`, in the header section (line 60-68), add the station type as a small colored tag after the In-House/Subkon label:

```tsx
// After line 65 (the isSubcon label), add station type badge:
{station?.stationType && (
    <span className="text-[7px] font-black uppercase px-1 py-0.5 rounded bg-zinc-200 text-zinc-600 mt-0.5">
        {station.stationType}
    </span>
)}
```

The header `<div className="min-w-0 flex-1">` section should show:
- Line 1: Station name (bold, uppercase) — already exists
- Line 2: "In-House" or "Subkon: ..." — already exists
- Line 3: Station type badge (CUTTING, SEWING, etc.) — NEW

---

### Task 2: Enable free drag on timeline bars

**Files:**
- Modify: `components/manufacturing/bom/timeline-view.tsx` (full rework of interaction)

**What:** Re-add drag-to-move functionality so bars can be freely positioned horizontally. Keep station rows (one row per unique station), but allow dragging bars left/right to adjust timing. This enables parallel scheduling within station view.

**Step 1: Re-add drag state and handlers**

Add back `useState`, `useEffect` imports and drag state to `TimelineView`:

```tsx
import { useMemo, useState, useCallback, useRef, useEffect } from "react"
```

Add `SNAP_MINUTES = 5` constant back.

Add `DragState` interface:
```tsx
interface DragState {
    stepId: string
    startX: number
    currentX: number
    barLayout: BarLayout
    active: boolean
}
```

**Step 2: Add pointer handlers for horizontal-only drag**

In the component body, add:
```tsx
const [drag, setDrag] = useState<DragState | null>(null)

const ghostStartMin = useMemo(() => {
    if (!drag?.active) return -1
    const dx = drag.currentX - drag.startX
    const rawMin = drag.barLayout.startMin + dx / PIXELS_PER_MINUTE
    return Math.max(0, Math.round(rawMin / SNAP_MINUTES) * SNAP_MINUTES)
}, [drag])

const onPointerDown = useCallback((e: React.PointerEvent, stepId: string) => {
    e.preventDefault()
    e.stopPropagation()
    const bar = bars.find(b => b.step.id === stepId)
    if (!bar) return
    setDrag({ stepId, barLayout: bar, startX: e.clientX, currentX: e.clientX, active: false })
}, [bars])
```

Add `useEffect` for pointermove/pointerup that:
- On move: updates `currentX`, sets `active` if dx > 4
- On up: if not active → click-to-select. If active → call `onMoveStep(stepId, snappedMin)` (horizontal only, no lane change)

**Step 3: Restore `onMoveStep` in destructured props**

Change component signature to destructure `onMoveStep` again:
```tsx
export function TimelineView({ steps, totalQty, selectedStepId, onStepSelect, onMoveStep }: TimelineViewProps)
```

**Step 4: Update bar rendering**

- Change cursor from `cursor-pointer` to `cursor-grab active:cursor-grabbing`
- Add ghost bar during drag (semi-transparent copy at ghost position)
- Add snap guide vertical line during drag
- Fade original bar while dragging (`opacity-20`)

---

### Task 3: Timeline bar width = duration × totalQty

**Files:**
- Modify: `components/manufacturing/bom/timeline-view.tsx:54-97` (scheduleByStation function)

**What:** Currently `durationMin = step.durationMinutes` (per piece). The bar width should represent total time: `durationMinutes × totalQty`. The label should still show "Xm/pcs" but the bar should be wider.

**Step 1: Update scheduleByStation to accept totalQty**

Change function signature:
```tsx
function scheduleByStation(steps: any[], totalQty: number): { ... }
```

**Step 2: Multiply duration by totalQty**

Change `getDuration`:
```tsx
const qty = Math.max(totalQty, 1)
const getDuration = (step: any) => Math.max((step.durationMinutes || 0) * qty, MIN_BAR_MINUTES)
```

**Step 3: Store per-pcs duration in BarLayout**

Add `durationPerPcs` to `BarLayout`:
```tsx
interface BarLayout {
    step: any
    row: number
    startMin: number
    durationMin: number      // total (duration × qty)
    durationPerPcs: number   // original per-piece duration
}
```

Update bar creation:
```tsx
bars.push({ step, row, startMin: start, durationMin: duration, durationPerPcs: step.durationMinutes || 0 })
```

**Step 4: Update bar label to show per-pcs**

In bar rendering, change the duration label:
```tsx
<p className="text-[9px] font-mono opacity-60" style={{ color: c.text }}>
    {fmtDuration(bar.durationPerPcs)}/pcs × {totalQty} = {fmtDuration(bar.durationMin)}
</p>
```

**Step 5: Update useMemo call**

```tsx
const { bars, totalMinutes, totalRows, rowLabels } = useMemo(() => scheduleByStation(steps, totalQty), [steps, totalQty])
```

---

### Task 4: Split progress proportionally across parallel steps

**Files:**
- Modify: `components/manufacturing/bom/bom-canvas.tsx:124` (totalProductionQty per node)
- Modify: `components/manufacturing/bom/station-node.tsx:118-133` (progress display)
- Modify: `app/manufacturing/bom/[id]/page.tsx:519-526` (handleMarkCompleted)

**What:** When multiple steps share a station type (e.g., "Potong" + "Potong A"), the total production qty should be **split** across them based on allocations. If step has allocations, use the allocation sum as denominator. If no allocations, split totalQty evenly among parallel siblings.

**Step 1: Compute per-step target qty in bom-canvas.tsx**

In `buildNodes()` (bom-canvas.tsx line 95-136), before the `return steps.map(...)`, compute per-step target:

```tsx
// Compute per-step production target
const stepTargets = new Map<string, number>()
for (const step of steps) {
    const allocs = step.allocations || []
    const allocTotal = allocs.reduce((s: number, a: any) => s + (a.quantity || 0), 0)
    if (allocTotal > 0) {
        // Has allocations → use allocation total as this step's target
        stepTargets.set(step.id, allocTotal)
    } else {
        // No allocations → find siblings (same stationType) and split evenly
        const stationType = step.station?.stationType
        const siblings = steps.filter(s => s.station?.stationType === stationType)
        if (siblings.length > 1) {
            stepTargets.set(step.id, Math.ceil(totalProductionQty / siblings.length))
        } else {
            stepTargets.set(step.id, totalProductionQty)
        }
    }
}
```

Then change line 124:
```tsx
totalProductionQty: stepTargets.get(step.id) || totalProductionQty || 0,
```

**Step 2: Update handleMarkCompleted to use step target**

In `page.tsx` line 519-526, `handleMarkCompleted` currently sets `completedQty: totalQty`. It should use the step's own target:

```tsx
const handleMarkCompleted = useCallback((stepId: string) => {
    dirtySetSteps((prev) => {
        // Find this step's allocation total or split
        const step = prev.find(s => s.id === stepId)
        const allocs = step?.allocations || []
        const allocTotal = allocs.reduce((s: number, a: any) => s + (a.quantity || 0), 0)
        let target = totalQty
        if (allocTotal > 0) {
            target = allocTotal
        } else if (step) {
            const siblings = prev.filter(s => s.station?.stationType === step.station?.stationType)
            if (siblings.length > 1) target = Math.ceil(totalQty / siblings.length)
        }
        return prev.map(s => s.id === stepId
            ? { ...s, completedAt: new Date().toISOString(), completedQty: target }
            : s
        )
    })
    toast.success("Stasiun ditandai selesai")
}, [totalQty])
```

**Step 3: Update timeline progress to use per-step target**

In `timeline-view.tsx`, the progress calculation (line 233) should also use allocation-aware targets:

```tsx
// Before the bars.map(), compute step targets
const stepTargets = new Map<string, number>()
for (const step of steps) {
    const allocs = step.allocations || []
    const allocTotal = allocs.reduce((s: number, a: any) => s + (a.quantity || 0), 0)
    if (allocTotal > 0) {
        stepTargets.set(step.id, allocTotal)
    } else {
        const stationType = step.station?.stationType
        const siblings = steps.filter(s => s.station?.stationType === stationType)
        stepTargets.set(step.id, siblings.length > 1 ? Math.ceil(totalQty / siblings.length) : totalQty)
    }
}
```

Then in bar rendering:
```tsx
const stepTarget = stepTargets.get(bar.step.id) || totalQty
const progress = stepTarget > 0 ? Math.min(100, ((bar.step.completedQty || 0) / stepTarget) * 100) : 0
```

---

## Execution Order

Tasks 1, 3, and 4 are independent. Task 2 (drag) depends on Task 3 being done first (since drag positions depend on the new width calculation).

Recommended: Task 1 → Task 3 → Task 4 → Task 2

## Verification

After all tasks:
1. **Canvas cards**: Each card should show station type badge (CUTTING, SEWING, etc.)
2. **Timeline bar width**: A step with 20m/pcs and totalQty=6 should show a bar 120m wide
3. **Timeline drag**: Bars can be dragged left/right to adjust start time
4. **Progress split**: Two "Potong" steps with totalQty=6 should show "3/6" each (or allocation-based split)
