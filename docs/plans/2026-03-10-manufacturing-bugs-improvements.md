# Manufacturing Bugs & Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all P1/P2 bugs in the manufacturing module (work center allocation ratios, duration calculation, template behavior, UI overlap) and implement UX improvements (SPK notification, process grouping, remove unnecessary creation UI, salary field relocation).

**Architecture:** All changes are in the BOM canvas editor and its component tree. The core data model (`ProductionBOMStep`, `ProductionBOMAllocation`, `ProcessStation`) remains unchanged. Fixes are in client-side calculation helpers, node data mapping, and UI components.

**Tech Stack:** React 19, TypeScript, TanStack Query, ReactFlow (`@xyflow/react`), shadcn/ui, Tailwind CSS, Framer Motion, Prisma (read-only for this plan).

**Source:** `docs/dev_backlog_part3_manufacturing_bugs.json` (7 tasks) + `docs/dev_backlog_part4_manufacturing_improvements.json` (6 tasks)

---

## Task 1: Fix progress ratio denominator — MTG-013 + MTG-025 (P1)

**Root Cause:** In `bom-canvas.tsx:128`, `totalProductionQty` passed to `StationNode` uses `stepTargets.get(step.id)` (allocation sum) instead of the BOM's overall target. When a step has 3 pcs allocated out of 6 total, node shows `3/3` instead of `3/6`.

**Files:**
- Modify: `components/manufacturing/bom/bom-canvas.tsx:128`
- Modify: `components/manufacturing/bom/station-node.tsx:138-153`

**Step 1: Fix node data mapping in bom-canvas.tsx**

In `bom-canvas.tsx:128`, change the `totalProductionQty` passed to nodes to always use the BOM's overall target:

```typescript
// BEFORE (line 128):
totalProductionQty: stepTargets.get(step.id) || totalProductionQty || 0,

// AFTER:
totalProductionQty: totalProductionQty || 0,
stepTarget: stepTargets.get(step.id) || totalProductionQty || 0,
```

**Step 2: Update StationNode to show both target and step allocation**

In `station-node.tsx`, update the `StationNodeData` interface to include `stepTarget`, and update the progress display:

```typescript
// In StationNodeData interface, add:
stepTarget?: number

// At line 138-153, update progress section:
{((data.completedQty ?? 0) > 0 || data.startedAt) && (data.totalProductionQty ?? 0) > 0 && (
    <div className="px-2 pb-1.5">
        <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider">Progress</span>
            <span className="text-[9px] font-mono font-bold text-zinc-600">
                {data.completedQty || 0}/{data.totalProductionQty}
            </span>
        </div>
        <div className="h-1.5 bg-zinc-200 rounded-full overflow-hidden">
            <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((data.completedQty || 0) / (data.totalProductionQty!)) * 100)}%` }}
            />
        </div>
    </div>
)}
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No new errors introduced

**Step 4: Commit**

```bash
git add components/manufacturing/bom/bom-canvas.tsx components/manufacturing/bom/station-node.tsx
git commit -m "fix(mfg): progress ratio denominator always uses BOM target qty (MTG-013, MTG-025)"
```

**How to verify:**
1. Open a BOM with target=6
2. Allocate 3 pcs to one work center
3. Progress should show `0/6`, not `0/3`
4. Complete 3 → shows `3/6` (50%), not `3/3` (100%)

---

## Task 2: Fix duration per piece calculation — MTG-014 (P1)

**Root Cause:** In `app/manufacturing/bom/[id]/page.tsx:150`, `durationPerPiece` sums ALL steps' durations including parallel siblings. For parallel steps (same stationType), only the maximum should count since they run simultaneously.

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx:149-151` (costSummary computation)
- Modify: `components/manufacturing/bom/bom-step-helpers.ts` (add critical path helper)

**Step 1: Add critical-path duration helper to bom-step-helpers.ts**

Add a new function that computes the sequential (critical path) duration, grouping parallel siblings by stationType and taking max:

```typescript
/**
 * Calculate per-piece duration along the critical path.
 * Parallel siblings (same stationType) run simultaneously → take max, not sum.
 */
export function calcCriticalPathDuration(
    steps: { id: string; station?: { stationType?: string } | null; durationMinutes?: number | null }[]
): number {
    // Group steps by stationType
    const groups: Record<string, number[]> = {}
    for (const step of steps) {
        const type = step.station?.stationType || step.id // unique fallback
        if (!groups[type]) groups[type] = []
        groups[type].push(Number(step.durationMinutes) || 0)
    }
    // For each group (parallel siblings), take max. Then sum across groups (sequential).
    let total = 0
    for (const durations of Object.values(groups)) {
        total += Math.max(...durations, 0)
    }
    return total
}
```

**Step 2: Use the new helper in the canvas page**

In `app/manufacturing/bom/[id]/page.tsx`, replace line 150:

```typescript
// BEFORE:
const durationPerPiece = steps.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0)

// AFTER:
const durationPerPiece = calcCriticalPathDuration(steps)
```

Add the import at the top:
```typescript
import { calcAllStepTargets, calcStepTarget, calcCriticalPathDuration } from "@/components/manufacturing/bom/bom-step-helpers"
```

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add components/manufacturing/bom/bom-step-helpers.ts app/manufacturing/bom/\\[id\\]/page.tsx
git commit -m "fix(mfg): duration per piece uses critical path (max of parallels), not sum (MTG-014)"
```

**How to verify:**
1. Create BOM with 3 processes: Cutting (12min), Sewing (3min), Finishing (4min)
2. Cost summary strip should show `19 menit/pcs` (12+3+4)
3. Add a parallel Cutting step (12min) → still `19 menit/pcs` (max(12,12)+3+4), NOT 31

---

## Task 3: Fix template overwrite behavior — MTG-017 (P1)

**Root Cause:** `handleApplyTemplate` in `app/manufacturing/bom/[id]/page.tsx:333-380` always APPENDS steps (`[...prev, ...added]`). No confirmation dialog if steps exist. Template should REPLACE all steps, with confirmation if there's existing data.

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx:333-380` (handleApplyTemplate)

**Step 1: Add confirmation dialog before template application**

Modify `handleApplyTemplate` to check for existing steps and confirm:

```typescript
const handleApplyTemplate = useCallback(async (types: readonly string[]) => {
    // If steps exist, confirm before replacing
    if (steps.length > 0) {
        const confirmed = window.confirm(
            `Sudah ada ${steps.length} proses di canvas.\n\nApakah Anda yakin ingin menghapus semua proses saat ini dan menggunakan template ini?`
        )
        if (!confirmed) return
    }

    setApplyingTemplate(true)
    try {
        const newStations: any[] = []
        for (const stationType of types) {
            let station = (allStations || []).find((s: any) =>
                s.stationType === stationType && s.operationType !== "SUBCONTRACTOR" && s.isActive !== false
            )
            if (!station) {
                // ... (auto-create logic stays the same)
            }
            newStations.push(station)
        }

        // REPLACE instead of APPEND
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
        // Clear selection since old steps are gone
        setSelectedStepId(null)
        toast.success(`Template diterapkan: ${newStations.length} proses`)
    } catch {
        toast.error("Gagal menerapkan template")
    } finally {
        setApplyingTemplate(false)
    }
}, [allStations, queryClient, steps.length])
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/manufacturing/bom/\\[id\\]/page.tsx
git commit -m "fix(mfg): template replaces steps with confirmation dialog (MTG-017)"
```

**How to verify:**
1. Create BOM → add 4 manual processes → click template "Garmen Lengkap"
2. Confirmation dialog appears: "Sudah ada 4 proses. Yakin ingin menghapus...?"
3. Click "Batal" → 4 manual processes still there
4. Click "OK" → replaced with 4 template processes (Potong → Jahit → QC → Packing)
5. Empty BOM → click template → no confirmation, directly applied

---

## Task 4: Fix UI overlap in work center distribution — MTG-015 (P1)

**Root Cause:** In `inhouse-allocator.tsx`, each station row has the station name and allocation input on the same line, but the layout doesn't clearly show the relationship. The summary bar at top shows `X/Y pcs teralokasi` separately from each station's individual quantity input.

**Files:**
- Modify: `components/manufacturing/bom/inhouse-allocator.tsx:126-184`

**Step 1: Redesign station list to single clean row**

Each row should show: `[Station Name (Code)] — [Qty Input] / [Total] pcs — [Remove]`

Replace the station list section (lines 126-184) with a cleaner layout:

```tsx
{/* Allocated stations FIRST — clean single-row layout */}
<ScrollArea className="max-h-[200px]">
    <div className="space-y-1.5">
        {/* Show allocated stations at top */}
        {allocations.map((alloc) => {
            const station = filtered.find((s: any) => s.id === alloc.stationId) ||
                (allStations || []).find((s: any) => s.id === alloc.stationId)
            if (!station) return null
            return (
                <div
                    key={station.id}
                    className="flex items-center gap-2 p-2 border border-emerald-400 bg-emerald-50 text-[10px]"
                >
                    <p className="font-black truncate min-w-0 flex-1">
                        {station.name}
                        {station.code && (
                            <span className="text-zinc-400 font-mono ml-1">({station.code})</span>
                        )}
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                        <Input
                            type="number"
                            value={alloc.quantity}
                            onChange={(e) => updateQty(station.id, parseInt(e.target.value) || 0)}
                            className="h-6 w-16 text-[10px] font-mono border-emerald-300 rounded-none text-right"
                        />
                        <span className="text-[9px] text-zinc-400 font-mono">/{totalQty}</span>
                        <button onClick={() => removeAllocation(station.id)}>
                            <X className="h-3 w-3 text-zinc-400 hover:text-red-500" />
                        </button>
                    </div>
                </div>
            )
        })}
        {/* Unallocated stations below */}
        {filtered.filter((s: any) => !allocations.some(a => a.stationId === s.id)).map((station: any) => (
            <div
                key={station.id}
                className="flex items-center gap-2 p-2 border border-zinc-200 hover:border-black hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-[10px] transition-all"
            >
                <p className="font-black truncate min-w-0 flex-1">
                    {station.name}
                    {station.code && (
                        <span className="text-zinc-400 font-mono ml-1">({station.code})</span>
                    )}
                </p>
                <Button
                    variant="outline" size="sm"
                    onClick={() => addAllocation(station.id)}
                    className="h-6 text-[9px] font-bold rounded-none shrink-0 px-2"
                >
                    <Plus className="h-3 w-3" /> Alokasi
                </Button>
            </div>
        ))}
        {filtered.length === 0 && (
            <p className="text-[10px] text-zinc-300 font-bold py-3 text-center">
                Belum ada work center untuk tipe ini
            </p>
        )}
    </div>
</ScrollArea>
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add components/manufacturing/bom/inhouse-allocator.tsx
git commit -m "fix(mfg): clean single-row layout for WC distribution, no overlap (MTG-015)"
```

**How to verify:**
1. Open BOM detail → select in-house step → open Distribution
2. Each work center shows in ONE clean row: Name — Qty/Total — Remove
3. No overlapping or duplicated elements
4. Allocated stations grouped at top (green), unallocated below

---

## Task 5: Duplicate allocation error message — MTG-016 (P2)

**Root Cause:** `inhouse-allocator.tsx:49-51` already blocks duplicates with `toast.info("Work center ini sudah dialokasikan")`, but the message is too subtle (info level, generic text).

**Files:**
- Modify: `components/manufacturing/bom/inhouse-allocator.tsx:49-51`

**Step 1: Improve error message**

```typescript
// BEFORE:
if (allocations.some(a => a.stationId === stationId)) {
    toast.info("Work center ini sudah dialokasikan")
    return
}

// AFTER:
if (allocations.some(a => a.stationId === stationId)) {
    const station = inhouseStations.find((s: any) => s.id === stationId)
    toast.warning(`${station?.name || "Work center"} sudah dialokasikan ke proses ini. Tidak bisa dialokasikan dua kali.`)
    return
}
```

**Step 2: Commit**

```bash
git add components/manufacturing/bom/inhouse-allocator.tsx
git commit -m "fix(mfg): clearer warning for duplicate WC allocation (MTG-016)"
```

---

## Task 6: Remove "delete for new" button — MTG-022 (P2)

**Root Cause:** Based on codebase search, no explicit "delete for new" button was found. This may have already been removed, or it could be the BOM-level delete in `bom-client.tsx`. Verify with user — skip if not found.

**Files:**
- Search: `components/manufacturing/bom/bom-client.tsx` for any delete-related buttons
- Search: `app/manufacturing/orders/orders-client.tsx` for any "delete" + "new" buttons

**Step 1: Search for the button**

Run: `grep -rn "delete.*new\|hapus.*baru\|delete for new" components/manufacturing/ app/manufacturing/`

If found → remove the button and any associated handler.
If not found → document that it was already removed or doesn't exist. Ask user to clarify.

**Step 2: Commit (if changes made)**

```bash
git commit -m "fix(mfg): remove non-functional delete-for-new button (MTG-022)"
```

---

## Task 7: SPK generation notification — MTG-018 (P1 improvement)

**Root Cause:** SPK button already has `disabled` state + native `title` tooltip, but tooltip is not visible enough. Need a prominent inline banner showing exactly what's missing.

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` — add readiness banner below toolbar row 2

**Step 1: Add readiness banner**

After the toolbar row 2 (line ~1005), add a conditional banner when SPK is not ready and steps exist:

```tsx
{/* SPK Readiness Banner — only when steps exist but not ready */}
{steps.length > 0 && !spkReadiness.ready && (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 flex items-start gap-2 shrink-0">
        <Zap className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
            <p className="text-[10px] font-black uppercase text-amber-700">
                Belum bisa Generate SPK — {spkReadiness.issues.length} hal perlu dilengkapi:
            </p>
            <ul className="mt-1 space-y-0.5">
                {spkReadiness.issues.map((issue, i) => (
                    <li key={i} className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                        <span className="w-1 h-1 bg-amber-500 rounded-full shrink-0" />
                        {issue}
                    </li>
                ))}
            </ul>
        </div>
    </div>
)}
```

**Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 3: Commit**

```bash
git add app/manufacturing/bom/\\[id\\]/page.tsx
git commit -m "feat(mfg): prominent SPK readiness banner with issue list (MTG-018)"
```

**How to verify:**
1. Create BOM without setting duration → amber banner shows "X proses belum ada durasi"
2. Add durations + materials + allocations → banner disappears, Generate SPK button enabled
3. Missing allocation → banner shows "alokasi subkon X/Y pcs"

---

## Task 8: Remove "Buat Baru" WC from allocation panels — MTG-021 (P2)

**Root Cause:** `inhouse-allocator.tsx:91-97` has a "Buat Baru" button + `CreateStationDialog`. Same in `subkon-selector.tsx`. These should be removed — WC creation belongs in master data only.

**Files:**
- Modify: `components/manufacturing/bom/inhouse-allocator.tsx` — remove Buat Baru button + CreateStationDialog
- Modify: `components/manufacturing/bom/subkon-selector.tsx` — remove Buat Baru button + CreateStationDialog

**Step 1: Remove from InHouseAllocator**

In `inhouse-allocator.tsx`:
- Remove import of `CreateStationDialog` (line 7)
- Remove `createOpen` state (line 32)
- Remove the "Buat Baru" Button (lines 91-97)
- Remove the `<CreateStationDialog>` render (lines 186-195)

**Step 2: Remove from SubkonSelector**

In `subkon-selector.tsx`:
- Find and remove the equivalent "Buat Baru" button and `CreateStationDialog`
- Keep the station search/select functionality

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add components/manufacturing/bom/inhouse-allocator.tsx components/manufacturing/bom/subkon-selector.tsx
git commit -m "feat(mfg): remove inline WC creation from allocation panels (MTG-021)"
```

**How to verify:**
1. Open BOM → select step → open Distribution
2. No "Buat Baru" button visible
3. Only existing work centers shown in dropdown
4. "Work Center Kustom" button in the main toolbar still works (that's separate)

---

## Task 9: Separate default/custom process types in toolbar — MTG-019 (P2)

**Root Cause:** In the BOM canvas toolbar row 2, `dynamicProcessTypes` mixes default (CUTTING, SEWING, etc.) and custom (OTHER) types in a single row. Need visual separation.

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` — toolbar row 2 rendering (around line 895-957)

**Step 1: Add visual separator between default and custom process types**

In the toolbar row 2, split the `dynamicProcessTypes.map(...)` into two sections:

```tsx
{/* Default process types */}
{dynamicProcessTypes.filter(cfg => !cfg.isCustom).map((cfg) => (
    // ... existing button rendering
))}

{/* Separator + Custom types — only if any exist */}
{dynamicProcessTypes.some(cfg => cfg.isCustom) && (
    <>
        <div className="border-l border-zinc-300 mx-1 h-5 shrink-0" />
        <span className="text-[9px] font-black uppercase text-zinc-400 shrink-0">Kustom:</span>
        {dynamicProcessTypes.filter(cfg => cfg.isCustom).map((cfg) => (
            // ... existing button rendering
        ))}
    </>
)}
```

**Step 2: Add in-house/subcon badge to process station creation dialog**

In `components/manufacturing/bom/create-station-dialog.tsx`, ensure the operation type (IN_HOUSE/SUBCONTRACTOR) selector is prominent and defaults correctly. This is likely already present — verify and adjust if needed.

**Step 3: Run TypeScript check**

Run: `npx tsc --noEmit`

**Step 4: Commit**

```bash
git add app/manufacturing/bom/\\[id\\]/page.tsx
git commit -m "feat(mfg): separate default/custom process types in toolbar (MTG-019)"
```

---

## Task 10: Simplify subprocess display — MTG-020 (P2)

**Root Cause:** The meeting consensus was "hapus/sederhanakan" — subprocess concept is inherent to the selected process and doesn't need manual input. In the current codebase, there is NO explicit "subprocess" UI — the concept is already handled by the step/station model where each step IS a process. The "subprocess" confusion likely comes from the parallel step feature.

**Files:**
- No code changes required — the subprocess concept doesn't exist as a separate UI element.

**Step 1: Verify no subprocess UI exists**

Run: `grep -rn "subprocess\|sub.process\|sub_process" components/manufacturing/ app/manufacturing/`

If nothing found → document as resolved (no action needed).
If found → evaluate and simplify.

**Step 2: Commit (documentation only)**

No code changes — this task is resolved by the existing architecture where steps ARE the processes.

---

## Task 11: Move monthly salary field — MTG-023 (P2)

**Root Cause:** `laborMonthlySalary` is on `ProductionBOMStep` (per-step field in detail-panel.tsx:235-266). Meeting says it belongs in admin/HR settings. However, this is architecturally complex because:
- Each step can have a DIFFERENT operator (and thus different salary)
- The salary feeds into per-step labor cost calculation
- Moving to a global setting would lose per-step granularity

**Recommended approach:** Keep the field on the step but make it auto-populated from employee data when an operator is selected. The field should still be editable as an override. This gives the best of both worlds.

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx:220-266` — auto-populate salary from employee when operator selected
- This is a DEFERRED task pending discussion with the team about exact requirements

**Step 1: Document the decision**

For now, keep the field. A proper implementation requires:
1. Employee master data API endpoint that returns salary
2. Operator field changed from free-text to employee selector
3. Auto-populate `laborMonthlySalary` from selected employee's salary
4. Allow manual override

This is out of scope for this plan — create a follow-up task.

---

## Task 12: Time study evaluation — MTG-024 (P3)

**Status: INVESTIGATION ONLY — No implementation.**

The time study section exists in `detail-panel.tsx:459-533` as a collapsible section (defaultOpen=false). It has:
- `estimatedTimePerUnit` — planned time per piece from time study
- `actualTimeTotal` — actual total minutes spent
- Comparison vs PCC (Planned Cycle Time / durationMinutes)

**Decision needed from team:**
- If useful → connect to production reporting (actual vs estimated variance)
- If not useful → hide behind a feature flag or remove entirely

No code changes until decision is made.

---

## Execution Order

| Priority | Task | ID(s) | Type | Estimated Effort |
|----------|------|-------|------|-----------------|
| 1 | Fix progress ratio | MTG-013, 025 | Bug P1 | Small |
| 2 | Fix duration calc | MTG-014 | Bug P1 | Small |
| 3 | Fix template overwrite | MTG-017 | Bug P1 | Medium |
| 4 | Fix UI overlap | MTG-015 | Bug P1 | Medium |
| 5 | SPK readiness banner | MTG-018 | Improve P1 | Small |
| 6 | Duplicate alloc msg | MTG-016 | Bug P2 | Tiny |
| 7 | Remove "Buat Baru" WC | MTG-021 | Improve P2 | Small |
| 8 | Separate process types | MTG-019 | Improve P2 | Small |
| 9 | Delete for new button | MTG-022 | Bug P2 | Tiny/Skip |
| 10 | Subprocess simplify | MTG-020 | Improve P2 | None (resolved) |
| 11 | Salary field move | MTG-023 | Improve P2 | Deferred |
| 12 | Time study eval | MTG-024 | Investigation P3 | Deferred |

**Completion criteria (from backlog):**
Part 3: ✅ Ratio correct (X/target), ✅ Duration correct, ✅ UI overlap gone, ✅ Template works + confirmation, ✅ Dead buttons removed, ✅ Clear error messages
Part 4: ✅ SPK notification clear, ✅ Default/custom separated, ✅ Subprocess simplified, ✅ Create WC removed from WO page, ⏳ Salary deferred, ⏳ Time study pending
