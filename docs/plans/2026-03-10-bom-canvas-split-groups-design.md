# BOM Canvas Split Groups — Design

**Date:** 2026-03-10
**Status:** Approved

## Problem

When 2+ stations of the same process type (e.g., POTONG) exist as parallel steps on the BOM canvas, each currently shows the full `totalProductionQty` in progress (e.g., 3/6). They should split the quantity between them and display as a visually connected group with configurable percentages.

## Solution

### Auto-Detection of Split Groups

Parallel sibling steps (same `parentStepIds`) sharing the same `stationType` form a "split group." Detection is client-side — no new DB concept needed.

```
Split group criteria:
- steps share at least one common parent (or both are roots)
- steps have the same stationType (e.g., both CUTTING)
- steps are NOT sequential (not parent→child of each other)
```

### Visual Design

Each split group member shows:
- **Percentage badge** on the station node header (e.g., "50%")
- **Dashed bracket/connector** linking group members (SVG overlay or custom ReactFlow edge)
- **Corrected progress**: `completedQty / stepTarget` where `stepTarget = pct × totalQty`

### Inline Percentage Edit

- Click the `%` badge → editable input
- On change: auto-adjust sibling percentages to maintain 100% total
- Adjustment strategy: distribute remainder proportionally among other siblings
- Example: 3 stations at 33/33/34. User changes first to 50% → remaining 50% splits to 25/25

### Auto-Split on Add

When adding a parallel station of the same type:
- Detect existing siblings of same `stationType`
- Auto-split evenly: 2 stations → 50/50, 3 → 33/33/34
- Create `ProductionBOMAllocation` entries with calculated quantities

## Data Model

No schema changes. Uses existing `ProductionBOMAllocation`:

```
ProductionBOMAllocation {
  stepId    → the BOM step
  stationId → the work center
  quantity  → absolute pieces (derived from percentage × totalQty)
}
```

Percentage is always derived: `allocation.quantity / totalQty × 100`
Write-back: `Math.round(pct / 100 × totalQty)`

## File Changes

| File | Change |
|------|--------|
| `components/manufacturing/bom/station-node.tsx` | Add % badge, click-to-edit, use `stepTarget` for progress |
| `components/manufacturing/bom/bom-canvas.tsx` | Detect split groups, render bracket connectors between members |
| `components/manufacturing/bom/bom-step-helpers.ts` | Add `detectSplitGroups()` helper, ensure `calcStepTarget` uses allocations |
| `app/manufacturing/bom/[id]/page.tsx` | Auto-create allocations on parallel add, handle % change callback |

## Edge Cases

- **Single station of a type**: No badge, no bracket — behaves exactly as today
- **User removes a station from split group**: Remaining station(s) absorb its percentage (redistribute evenly)
- **0% allocation**: Not allowed — minimum 1% or 1 piece
- **Rounding**: Last sibling absorbs rounding remainder to ensure total = 100%
- **Subkon steps**: Split groups only apply to in-house parallel steps of same type

## YAGNI — Explicitly Out of Scope

- No drag-to-resize percentage
- No min/max percentage constraints
- No "lock percentage" feature
- No multi-facility support
- No percentage field in DB schema (always derived from allocation quantity)
