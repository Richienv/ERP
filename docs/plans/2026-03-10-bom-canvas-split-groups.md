# BOM Canvas Split Groups — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When 2+ parallel stations share the same `stationType`, visually group them with a bracket connector, show editable percentage badges, fix progress bars to use `stepTarget`, and auto-split quantities when adding parallel stations.

**Architecture:** Client-side split group detection in `bom-step-helpers.ts`. UI changes in `station-node.tsx` (% badge, progress fix) and `bom-canvas.tsx` (bracket edges, % change callback). Auto-allocation in page.tsx on parallel add. No DB schema changes — uses existing `ProductionBOMAllocation`.

**Tech Stack:** React 19, ReactFlow (@xyflow/react), TypeScript, Prisma (existing model)

---

### Task 1: Add `detectSplitGroups()` helper

**Files:**
- Modify: `components/manufacturing/bom/bom-step-helpers.ts`

**Step 1: Add the `detectSplitGroups` function**

Append after `calcCriticalPathDuration`:

```typescript
export interface SplitGroup {
    stationType: string
    stepIds: string[]
    percentages: Map<string, number> // stepId → percentage (0-100)
}

/**
 * Detect split groups: parallel siblings (same parentStepIds) with same stationType.
 * Returns array of groups, each with 2+ members.
 */
export function detectSplitGroups(
    steps: { id: string; parentStepIds?: string[]; station?: { stationType?: string; operationType?: string } | null; allocations?: { quantity: number }[] }[],
    totalQty: number,
): SplitGroup[] {
    // Key: "parentHash|stationType" → stepIds
    const buckets = new Map<string, typeof steps>()

    for (const step of steps) {
        const stationType = step.station?.stationType
        if (!stationType) continue
        // Only in-house steps
        if (step.station?.operationType === "SUBCONTRACTOR") continue

        const parentKey = [...(step.parentStepIds || [])].sort().join(",") || "__root__"
        const key = `${parentKey}|${stationType}`
        const bucket = buckets.get(key) || []
        bucket.push(step)
        buckets.set(key, bucket)
    }

    const groups: SplitGroup[] = []

    for (const [key, members] of buckets) {
        if (members.length < 2) continue

        const stationType = key.split("|").pop()!
        const percentages = new Map<string, number>()

        // Check if any member has allocations
        const totalAllocated = members.reduce(
            (sum, m) => sum + (m.allocations || []).reduce((a, b) => a + (b.quantity || 0), 0),
            0
        )

        if (totalAllocated > 0 && totalQty > 0) {
            // Derive percentages from allocations
            let usedPct = 0
            members.forEach((m, i) => {
                const allocQty = (m.allocations || []).reduce((a, b) => a + (b.quantity || 0), 0)
                if (i < members.length - 1) {
                    const pct = Math.round((allocQty / totalQty) * 100)
                    percentages.set(m.id, pct)
                    usedPct += pct
                } else {
                    // Last member absorbs remainder
                    percentages.set(m.id, 100 - usedPct)
                }
            })
        } else {
            // Even split
            const base = Math.floor(100 / members.length)
            const remainder = 100 % members.length
            members.forEach((m, i) => {
                percentages.set(m.id, base + (i < remainder ? 1 : 0))
            })
        }

        groups.push({ stationType, stepIds: members.map(m => m.id), percentages })
    }

    return groups
}
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep bom-step-helpers || echo "OK"`

**Step 3: Commit**

```bash
git add components/manufacturing/bom/bom-step-helpers.ts
git commit -m "feat(bom): add detectSplitGroups helper for parallel station grouping"
```

---

### Task 2: Fix progress bar to use `stepTarget` + add percentage badge

**Files:**
- Modify: `components/manufacturing/bom/station-node.tsx`

**Step 1: Add `splitPct` and `onPctChange` to StationNodeData**

In the `StationNodeData` interface, add:

```typescript
    splitPct?: number        // percentage in split group (e.g. 50), undefined = no group
    onPctChange?: (newPct: number) => void
```

**Step 2: Fix progress bar to use stepTarget instead of totalProductionQty**

Replace the progress section (lines 139-154). Change:
- `{data.completedQty || 0}/{data.totalProductionQty}` → `{data.completedQty || 0}/{data.stepTarget || data.totalProductionQty}`
- Width calc: use `(data.stepTarget || data.totalProductionQty!)` as denominator
- Show condition: use `(data.stepTarget ?? data.totalProductionQty ?? 0) > 0`

New progress section:

```tsx
{((data.completedQty ?? 0) > 0 || data.startedAt) && (data.stepTarget ?? data.totalProductionQty ?? 0) > 0 && (
    <div className="px-2 pb-1.5">
        <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Progress</span>
            <span className="text-[9px] font-mono font-bold text-zinc-600">
                {data.completedQty || 0}/{data.stepTarget || data.totalProductionQty}
            </span>
        </div>
        <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((data.completedQty || 0) / (data.stepTarget || data.totalProductionQty || 1)) * 100)}%` }}
            />
        </div>
    </div>
)}
```

**Step 3: Add percentage badge to header**

In the header div (after the sequence badge `<span>...{sequence}</span>`), add before the trash button:

```tsx
{data.splitPct != null && (
    <button
        onClick={(e) => {
            e.stopPropagation()
            const input = prompt(`Persentase untuk ${station?.name} (1-99):`, String(data.splitPct))
            if (input != null) {
                const val = Math.max(1, Math.min(99, parseInt(input) || data.splitPct!))
                data.onPctChange?.(val)
            }
        }}
        className="bg-orange-500 text-white text-[9px] font-black px-1.5 py-0.5 shrink-0 hover:bg-orange-600 transition-colors cursor-pointer"
        title="Klik untuk ubah persentase"
    >
        {data.splitPct}%
    </button>
)}
```

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep station-node || echo "OK"`

**Step 5: Commit**

```bash
git add components/manufacturing/bom/station-node.tsx
git commit -m "feat(bom): fix progress bar to use stepTarget, add split percentage badge"
```

---

### Task 3: Detect split groups in canvas + render bracket connectors + wire % change

**Files:**
- Modify: `components/manufacturing/bom/bom-canvas.tsx`

**Step 1: Add `onPctChange` prop to BOMCanvasProps**

```typescript
onPctChange?: (stepId: string, newPct: number) => void
```

Add to destructured props.

**Step 2: Detect split groups and pass data to nodes**

In `buildNodes`, after `const stepTargets = calcAllStepTargets(...)`:

```typescript
import { detectSplitGroups, type SplitGroup } from "./bom-step-helpers"

// ... inside buildNodes:
const splitGroups = detectSplitGroups(steps, totalProductionQty || 0)
const stepPctMap = new Map<string, number>()
for (const g of splitGroups) {
    for (const [sid, pct] of g.percentages) {
        stepPctMap.set(sid, pct)
    }
}
```

Then in the node data, add:

```typescript
splitPct: stepPctMap.get(step.id),
onPctChange: onPctChange ? (newPct: number) => onPctChange(step.id, newPct) : undefined,
```

**Step 3: Render bracket connector edges between split group members**

In `buildEdges`, after the parent→child edges loop, add split group bracket edges:

```typescript
const splitGroups = detectSplitGroups(steps, totalProductionQty || 0)
for (const group of splitGroups) {
    for (let i = 0; i < group.stepIds.length - 1; i++) {
        edges.push({
            id: `split-${group.stepIds[i]}-${group.stepIds[i + 1]}`,
            source: group.stepIds[i],
            target: group.stepIds[i + 1],
            type: "straight",
            style: { strokeWidth: 2, stroke: "#f97316", strokeDasharray: "6 3" },
            animated: false,
            deletable: false,
            selectable: false,
        })
    }
}
```

**Step 4: Add `onPctChange` to useCallback deps and `totalProductionQty` to `buildEdges` deps**

Update deps:
- `buildNodes` deps: add `onPctChange`
- `buildEdges` deps: add `totalProductionQty` (needed for `detectSplitGroups`)

Also import `detectSplitGroups` at top of file:

```typescript
import { calcAllStepTargets, detectSplitGroups } from "./bom-step-helpers"
```

**Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep bom-canvas || echo "OK"`

**Step 6: Commit**

```bash
git add components/manufacturing/bom/bom-canvas.tsx
git commit -m "feat(bom): detect split groups, render bracket connectors, wire pct change"
```

---

### Task 4: Auto-split allocations on parallel add + handle percentage change

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx`

**Step 1: Modify `handleAddParallel` to auto-create even-split allocations**

In `handleAddParallel` (line 533), after creating the new step, also create/update allocations for even split. Replace the current function:

```typescript
const handleAddParallel = useCallback((stepId: string) => {
    const source = steps.find((s) => s.id === stepId)
    if (!source) return

    const tempId = `step-par-${Date.now()}`
    const stationType = source.station?.stationType

    dirtySetSteps((prev) => {
        const newSequence = prev.length + 1
        const newStep = {
            id: tempId,
            stationId: source.stationId,
            station: source.station,
            sequence: newSequence,
            durationMinutes: source.durationMinutes,
            notes: null,
            parentStepIds: [...(source.parentStepIds || [])],
            materials: [],
            allocations: [] as any[],
            attachments: [],
        }

        // Find all siblings of same stationType (including source and new step)
        const withNew = [...prev, newStep]
        const parentKey = [...(source.parentStepIds || [])].sort().join(",")
        const siblings = withNew.filter(s => {
            const sParentKey = [...(s.parentStepIds || [])].sort().join(",")
            return s.station?.stationType === stationType && sParentKey === parentKey
        })

        if (siblings.length >= 2 && bom?.totalProductionQty) {
            // Even split across all siblings
            const total = bom.totalProductionQty
            const base = Math.floor(total / siblings.length)
            const remainder = total % siblings.length

            return withNew.map((s, _idx) => {
                const sibIdx = siblings.findIndex(sib => sib.id === s.id)
                if (sibIdx === -1) return s
                const qty = base + (sibIdx < remainder ? 1 : 0)
                return {
                    ...s,
                    allocations: [{
                        id: `alloc-${s.id}-auto`,
                        stepId: s.id,
                        stationId: s.stationId,
                        quantity: qty,
                    }],
                }
            })
        }

        return withNew
    })
    toast.success("Proses paralel ditambahkan — kuantitas dibagi rata")
}, [steps, bom?.totalProductionQty])
```

**Step 2: Add `handlePctChange` callback**

Add after `handleAddParallel`:

```typescript
const handlePctChange = useCallback((stepId: string, newPct: number) => {
    if (!bom?.totalProductionQty) return
    const totalQty = bom.totalProductionQty

    dirtySetSteps(prev => {
        const step = prev.find(s => s.id === stepId)
        if (!step) return prev

        const stationType = step.station?.stationType
        const parentKey = [...(step.parentStepIds || [])].sort().join(",")
        const siblings = prev.filter(s => {
            const sKey = [...(s.parentStepIds || [])].sort().join(",")
            return s.station?.stationType === stationType && sKey === parentKey
        })

        if (siblings.length < 2) return prev

        // Clamp: min 1%, max (100 - (siblings.length - 1))%
        const clamped = Math.max(1, Math.min(100 - (siblings.length - 1), newPct))
        const remaining = 100 - clamped
        const otherSiblings = siblings.filter(s => s.id !== stepId)

        // Distribute remaining proportionally among others
        const otherTotal = otherSiblings.reduce((sum, s) => {
            const allocQty = (s.allocations || []).reduce((a: number, b: any) => a + (b.quantity || 0), 0)
            return sum + (allocQty || Math.floor(totalQty / siblings.length))
        }, 0)

        const otherPcts: Map<string, number> = new Map()
        let usedPct = 0
        otherSiblings.forEach((s, i) => {
            if (i < otherSiblings.length - 1) {
                const allocQty = (s.allocations || []).reduce((a: number, b: any) => a + (b.quantity || 0), 0)
                const oldPct = otherTotal > 0 ? allocQty / otherTotal : 1 / otherSiblings.length
                const pct = Math.max(1, Math.round(remaining * oldPct))
                otherPcts.set(s.id, pct)
                usedPct += pct
            } else {
                // Last absorbs remainder
                otherPcts.set(s.id, Math.max(1, remaining - usedPct))
            }
        })

        return prev.map(s => {
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
}, [bom?.totalProductionQty])
```

**Step 3: Pass `onPctChange` to BOMCanvas**

Find where `<BOMCanvas` is rendered and add:

```typescript
onPctChange={handlePctChange}
```

**Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep "bom/\[id\]" || echo "OK"`

**Step 5: Commit**

```bash
git add app/manufacturing/bom/[id]/page.tsx
git commit -m "feat(bom): auto-split allocations on parallel add, handle percentage change"
```

---

### Task 5: Verify and test manually

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors related to bom files

**Step 2: Run existing tests**

Run: `npx vitest run`
Expected: No regressions

**Step 3: Manual verification checklist**

- Open a BOM with 2+ parallel stations of same type → see dashed orange bracket connector + % badges
- Single stations → no badge, no bracket (unchanged)
- Click % badge → prompt for new value → siblings adjust proportionally
- Progress bar shows `completedQty/stepTarget` (not totalQty)
- Add parallel station via purple + button → auto-splits evenly, badge appears

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(bom): complete split groups — visual brackets, pct badges, auto-split"
```

---

Plan complete and saved to `docs/plans/2026-03-10-bom-canvas-split-groups.md`. Two execution options:

**1. Subagent-Driven (this session)** — I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** — Open new session with executing-plans, batch execution with checkpoints

Which approach?
