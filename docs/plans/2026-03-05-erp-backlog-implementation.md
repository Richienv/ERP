# ERP Backlog Implementation Plan — Phases 1-3

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all HIGH bugs, apply all HIGH fixes, and implement HIGH features so the OIC ERP is stable for internal testing (March 30) and production trial (April 1).

**Architecture:** All changes follow existing patterns — TanStack Query for reads, server actions/API routes for writes, Prisma for DB, cache invalidation via `queryClient.invalidateQueries()`. Every mutation must propagate across all connected pages. All UI in Bahasa Indonesia.

**Tech Stack:** Next.js 16 App Router, React 19, Prisma 6, TanStack Query, shadcn/ui, Supabase Auth, PostgreSQL

**Execution order:** BOM cluster (B-004→B-001→B-002→B-006) → Timeline (B-003→B-011) → SPK (B-005→F-001→F-013) → Invoice/Finance (B-009→F-009→F-010→F-011→F-012→B-010) → Work Centers (F-004→N-003) → Features (N-001→N-002→N-004→N-005→N-022) → Production (B-008→F-007) → Inventory (N-009→N-010→N-011→N-021) → Dashboard (N-007) → Reports (N-020) → System (N-023)

---

## PHASE 1 — BUGS (ship by March 28)

---

### Task 1: B-004 — Duration field uses total instead of per-piece

**Problem:** Duration is stored/displayed as total duration. Should be per-piece in minutes. Total = duration_per_piece × target_quantity.

**Files:**
- Modify: `components/manufacturing/bom/station-node.tsx` — label already shows `{durationMinutes}m/pcs` ✓ (correct)
- Modify: `app/manufacturing/bom/[id]/page.tsx:108-120` — cost summary calculates `estTimeTotalMin` by summing raw `durationMinutes` — must multiply by totalQty
- Modify: `components/manufacturing/bom/detail-panel.tsx` — verify duration input is labeled "per pcs"
- Verify: `app/api/manufacturing/production-bom/[id]/route.ts:184` — `durationMinutes` saved correctly as per-piece value

**Step 1:** In `app/manufacturing/bom/[id]/page.tsx`, fix the cost summary calculation:
```typescript
// BEFORE (line ~113-114):
const estTimeTotalMin = steps.reduce((sum, s) => sum + (Number(s.durationMinutes) || 0), 0)

// AFTER:
const estTimeTotalMin = steps.reduce((sum, s) => sum + ((Number(s.durationMinutes) || 0) * totalQty), 0)
```

**Step 2:** In detail-panel.tsx, ensure duration input label says "Durasi (menit/pcs)" and tooltip explains it's per piece.

**Step 3:** Verify timeline-view.tsx line 62 already multiplies correctly: `getDuration = (step) => Math.max((step.durationMinutes || 0) * qty, MIN_BAR_MINUTES)` ✓

**Cache invalidation:** None needed (client-side calculation only).

**How to verify:** Open BOM detail page → set duration to 15 min/pcs with target qty 100 → cost summary should show "1500 menit" (25 jam) total, not "15 menit".

---

### Task 2: B-001 — Progress shows 300% for sewing

**Problem:** Progress accumulates per-step instead of per-action-type. 3 sewing steps each showing 100% = 300%.

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx:121-138` — progress calculation in `costSummary` memo
- Modify: `components/manufacturing/bom/timeline-view.tsx:223-237` — `stepTargets` memo already splits among parallel siblings ✓

**Current logic (broken):**
```typescript
// Groups by stationType, sums completedQty per group, divides by totalQty
// Bug: if 3 sewing stations each complete 100 pcs (target 100), groupCompleted = 300
// Math.min(1, 300/100) = 1 → correct per action, BUT the bug is that each station
// is tracking completedQty = totalQty instead of its share
```

**Root cause:** When steps are distributed (3 cut stations for 100 pcs), each station's completedQty should reflect its share (e.g., 33+33+34=100), not repeat the full target. The progress calc needs to sum completedQty across the group and compare against totalQty.

**Step 1:** Fix progress in `app/manufacturing/bom/[id]/page.tsx`:
```typescript
// Current code (line ~123-138) is actually correct IF completedQty per step
// represents that step's actual completion. The bug is that the display
// shows per-step progress as step.completedQty/totalQty instead of
// step.completedQty/stepTarget.

// Fix: for the overall BOM progress bar, the calc is correct.
// The per-step progress in station-node.tsx must use the step's share, not totalQty.
```

**Step 2:** In `station-node.tsx:125-140`, progress bar uses `data.completedQty / data.totalProductionQty`:
```typescript
// BEFORE:
style={{ width: `${Math.min(100, ((data.completedQty || 0) / (data.totalProductionQty!)) * 100)}%` }}

// AFTER: Use step-specific target (passed as new prop)
style={{ width: `${Math.min(100, ((data.completedQty || 0) / (data.stepTarget || data.totalProductionQty || 1)) * 100)}%` }}
```

**Step 3:** In `bom-canvas.tsx`, when building node data, compute `stepTarget` for each step:
- If step has allocations: sum allocation quantities
- If step has siblings (same stationType): divide totalQty by sibling count
- Otherwise: totalQty

**Step 4:** Pass `stepTarget` to both `StationNode` and `TimelineView` bars.

**Cache invalidation:** None (client-side rendering).

**How to verify:** Create BOM with 3 sewing stations, target 100 pcs, distribute 33/33/34. Each station should show its own progress (e.g., 33/33 = 100%, not 33/100 = 33%).

---

### Task 3: B-002 — CVA label showing for subcon processes

**Problem:** Subcon processes display 'CVA' instead of correct process name/label.

**Files:**
- Modify: `components/manufacturing/bom/station-node.tsx:60-74` — header section

**Current code:**
```typescript
<p className={`text-[9px] font-bold ${isSubcon ? "text-amber-600" : "text-emerald-600"}`}>
    {isSubcon ? `Subkon: ${station?.subcontractor?.name || "-"}` : "In-House"}
</p>
```

The label "In-House" is correct. For subcon, it shows "Subkon: [name]". The issue is likely that `station?.subcontractor?.name` is empty, showing "Subkon: -".

**Step 1:** Check if subcontractor relation is loaded in the BOM detail API response. In `production-bom/[id]/route.ts:39-43`:
```typescript
station: {
    select: {
        id: true, code: true, name: true, stationType: true,
        operationType: true, costPerUnit: true,
        subcontractor: { select: { id: true, name: true } },
    },
},
```
This loads it ✓. But for steps where `useSubkon=true` but station.operationType is "IN_HOUSE", the subcontractor field may be null.

**Step 2:** Fix: when `useSubkon=true`, show the subkon CV from allocations, not from the station's subcontractor:
```typescript
// AFTER:
const subkonName = (() => {
    if (!isSubcon) return null
    // Try allocations first (the actual assigned subcon)
    const allocs = data.allocations || []
    if (allocs.length > 0) {
        const names = allocs.map((a: any) => a.station?.subcontractor?.name || a.station?.name).filter(Boolean)
        return names.length > 0 ? names.join(', ') : null
    }
    // Fallback to station's subcontractor
    return station?.subcontractor?.name || null
})()

// In JSX:
{isSubcon ? `Subkon: ${subkonName || "-"}` : "In-House"}
```

**Step 3:** Add `allocations` to `StationNodeData` interface.

**Cache invalidation:** None (rendering fix).

**How to verify:** In BOM, toggle a step to subkon → allocate to a CV → card header should show "Subkon: [CV Name]" instead of "CVA" or "-".

---

### Task 4: B-006 — Process distribution percentage incorrect

**Problem:** When distributing across 3 cut stations, percentages should reflect piece distribution but total target must equal original.

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` — progress calculation (partially fixed in B-001)
- Modify: `components/manufacturing/bom/timeline-view.tsx:223-237` — `stepTargets` memo

**Current `stepTargets` logic:**
```typescript
const siblings = steps.filter((s: any) => s.station?.stationType === stationType)
targets.set(step.id, siblings.length > 1 ? Math.ceil(totalQty / siblings.length) : totalQty)
```

**Bug:** `Math.ceil` causes total to exceed target (e.g., ceil(100/3) = 34 × 3 = 102 > 100).

**Step 1:** Fix distribution to use exact allocation:
```typescript
// If step has allocations, use those (most accurate)
// Otherwise, distribute evenly with remainder going to first sibling
const siblings = steps.filter((s: any) => s.station?.stationType === stationType)
const idx = siblings.indexOf(step)
const share = Math.floor(totalQty / siblings.length)
const remainder = totalQty % siblings.length
targets.set(step.id, share + (idx < remainder ? 1 : 0))
```

**Step 2:** Add percentage display in station-node footer showing "{share}/{totalQty} ({pct}%)".

**Cache invalidation:** None.

**How to verify:** 3 cut stations, target 100 → should show 34+33+33=100 (not 34+34+34=102).

---

### Task 5: B-003 — Drag creates duplicate entries on timeline

**Problem:** Dragging items on timeline creates double entries.

**Files:**
- Modify: `components/manufacturing/bom/timeline-view.tsx:170-220` — pointer handlers
- Modify: `app/manufacturing/bom/[id]/page.tsx` — `onMoveStep` handler

**Root cause:** The `onMoveStep` callback in the BOM page likely adds a new step instead of updating the existing one, or the drag handler fires multiple times.

**Step 1:** Read `onMoveStep` in `bom/[id]/page.tsx` to find the bug.

**Step 2:** Ensure `onMoveStep` only updates `startOffsetMinutes` on the existing step:
```typescript
const handleMoveStep = useCallback((stepId: string, startOffsetMinutes: number) => {
    dirtySetSteps((prev) => prev.map((s) =>
        s.id === stepId ? { ...s, startOffsetMinutes } : s
    ))
}, [dirtySetSteps])
```

**Step 3:** In timeline-view, ensure `onPointerUp` only fires once by checking `prev.active` guard.

**Cache invalidation:** None (client state only).

**How to verify:** Drag a bar on timeline → should move position, not create duplicate.

---

### Task 6: B-011 — Timeline station view needs debugging

**Problem:** Timeline has general bugs needing a debugging pass.

**Files:**
- Modify: `components/manufacturing/bom/timeline-view.tsx`

**Known issues from code review:**
1. Duration calculation correct (perPcs × qty) ✓
2. Drag handlers exist and work ✓
3. Station grouping works ✓
4. Progress uses `stepTargets` which needs B-006 fix

**Step 1:** After B-003 and B-006 are fixed, do a full test:
- Add 4+ steps with different station types
- Verify bars don't overlap incorrectly
- Verify drag snaps to 5-minute grid
- Verify progress percentages are correct per-step
- Verify subcon steps show "SUB" badge

**Step 2:** Fix any remaining issues found during test.

---

### Task 7: B-009 — Invoice auto-finalized on creation

**Problem:** Invoice immediately set to 'finalized' upon creation. Should default to 'draft'.

**Files:**
- Verify: `lib/actions/finance-invoices.ts` — `createCustomerInvoice` and `createInvoiceFromSalesOrder`

**Current code analysis:** Both functions already set `status: 'DRAFT'` ✓ (confirmed from grep).

**Possible real bug:** The `moveInvoiceToSent` function (line ~764) sets status to `ISSUED` — but it's only called explicitly. Check if there's an auto-call after creation.

**Step 1:** Search for any code that auto-calls `moveInvoiceToSent` or changes status after creation.

**Step 2:** In the invoices page, verify that newly created invoices appear in the DRAFT column, not SENT.

**Step 3:** If the bug is in the Kanban view misclassifying DRAFT as ISSUED, fix the column assignment logic.

**Cache invalidation:** `queryKeys.invoices.all`

**How to verify:** Create invoice from sales order → should appear in DRAFT column, editable.

---

### Task 8: B-005 — SPK generation allowed with missing data

**Problem:** SPK can be generated without material or subcon CV assigned.

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx:142-171` — `spkReadiness` check
- Verify: `app/api/manufacturing/production-bom/[id]/generate-spk/route.ts:51-75` — server-side validation

**Current client-side validation (spkReadiness):**
- ✓ totalQty > 0
- ✓ steps.length > 0
- ✓ Checks empty materials (excluding QC/PACKING)
- ✓ Checks duration exists
- ✓ Checks subkon allocation totals

**Server-side validation also exists ✓**

**Step 1:** Verify the "Generate SPK" button actually uses `spkReadiness.ready` to disable:
```typescript
<Button disabled={!spkReadiness.ready || generating} onClick={handleGenerateSPK}>
```

**Step 2:** If button is not disabled, add the guard. Show `spkReadiness.issues` in a tooltip on hover.

**Step 3:** Add validation for subkon steps that have no CV selected (allocations with no stationId).

**Cache invalidation:** After SPK generation: `queryKeys.productionBom.all`, `queryKeys.workOrders.all`

**How to verify:** Remove material from a step → Generate SPK button should be disabled with tooltip showing "2 proses belum ada material".

---

### Task 9: B-008 — Production schedule not linking to SPK status (MEDIUM)

**Files:**
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts:268-309` — WO sync logic in PATCH
- Modify: SPK/work order status update flow

**Step 1:** The PATCH handler already syncs completedQty → WO status. Verify the logic:
```typescript
const newStatus = completedQty >= wo.plannedQty ? 'COMPLETED'
    : completedQty > 0 ? 'IN_PROGRESS' : wo.status
```

**Step 2:** Add a trigger: when a WorkOrder status changes to IN_PROGRESS, update the ProductionBOM step's `startedAt` if null.

**Step 3:** When all WOs for a BOM are COMPLETED, optionally mark BOM as completed.

**Cache invalidation:** `queryKeys.workOrders.all`, `queryKeys.productionBom.detail(id)`

---

### Task 10: B-010 — Bank reconciliation button misaligned (LOW)

**Files:**
- Modify: `components/finance/bank-reconciliation-view.tsx`

**Step 1:** Inspect the layout and fix CSS alignment of the reconciliation action button.

---

### Task 11: B-007 — Overlapping UI elements (LOW)

**Files:** Various — requires visual inspection.

**Step 1:** Run through main pages, identify overlaps, fix z-index/positioning.

---

## PHASE 2 — FIXES (ship by March 30)

---

### Task 12: F-001 — Make duration a required field

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx` — add required indicator
- Modify: `app/manufacturing/bom/[id]/page.tsx:144-171` — spkReadiness already checks for missing duration ✓
- Modify: `app/api/manufacturing/production-bom/[id]/generate-spk/route.ts` — add server-side duration validation

**Step 1:** Add server-side check in generate-spk:
```typescript
const noDuration = bom.steps.filter(s => !s.durationMinutes || s.durationMinutes <= 0)
if (noDuration.length > 0) {
    return NextResponse.json({
        success: false,
        error: `Step ${noDuration.map(s => s.sequence).join(', ')} belum ada durasi (wajib diisi)`,
    }, { status: 400 })
}
```

**Step 2:** In detail-panel, add red asterisk next to "Durasi" label and show validation error if empty on blur.

---

### Task 13: F-004 — Replace 'Station' with Work Center group

**Files:**
- Modify: `app/manufacturing/work-centers/page.tsx` — rename UI labels
- Modify: `components/manufacturing/bom/station-node.tsx` — label changes
- Modify: `components/manufacturing/bom/timeline-view.tsx` — "Stasiun" → "Work Center"

**Step 1:** Global find/replace in manufacturing UI: "Stasiun" → "Work Center" where contextually appropriate. Keep "Stasiun" for individual machines within a work center group.

**Step 2:** This is a cosmetic/labeling fix for now. N-003 (work center grouping feature) adds the actual group data model.

---

### Task 14: F-009 — Simplify account transactions view

**Files:**
- Modify: `app/finance/transactions/page.tsx`

**Step 1:** The page currently uses DUMMY_ENTRIES (hardcoded demo data). Replace with real data from `getAccountTransactions()`.

**Step 2:** Simplify view to focus on AR/AP:
- Default filter: show only Piutang (code 1200) and Hutang (code 2000) accounts
- Add "Semua Akun" toggle to show everything
- Remove clutter columns, keep: Date, Description, Source, Debit, Credit, Balance

---

### Task 15: F-010 — Remove gross and tax columns

**Files:**
- Modify: `app/finance/transactions/page.tsx` — remove Gross and Tax columns from the table

**Step 1:** Remove the columns from the table header and body. Tax info can live in the detail view if needed.

---

### Task 16: F-011 — Fix debit/credit notation display

**Files:**
- Modify: `app/finance/transactions/page.tsx`

**Step 1:** Standardize: amounts without brackets = debit, amounts in (brackets) = credit.
```typescript
// Debit column:
{line.debit > 0 ? formatIDR(line.debit) : "-"}
// Credit column:
{line.credit > 0 ? `(${formatIDR(line.credit)})` : "-"}
```

---

### Task 17: F-012 — Ensure invoice-to-account transaction link

**Files:**
- Verify: `lib/actions/finance-invoices.ts` — `moveInvoiceToSent()` and `recordInvoicePayment()`
- Verify: `lib/actions/finance-gl.ts` — `postJournalEntry()`

**Step 1:** Verify flow: Invoice DRAFT → ISSUED (moveInvoiceToSent posts GL: DR AR, CR Revenue) → Payment recorded (posts GL: DR Cash, CR AR).

**Step 2:** Test: create invoice → send → record payment → check Account Transactions shows both GL entries.

**Step 3:** If `moveInvoiceToSent` doesn't post GL, add it:
```typescript
// When invoice is issued, post AR recognition:
// DR 1200 Piutang Usaha (totalAmount)
// CR 4000 Pendapatan (subtotal)
// CR 2100 PPN Keluaran (taxAmount)
```

**Cache invalidation:** `queryKeys.invoices.all`, `queryKeys.financeReports.all`

---

### Task 18: F-013 — SPK and subcon adjustments only

**Meta task:** No new SPK/subcon features. Only fix existing bugs (B-003, B-005) and polish. This is a stabilization directive.

---

### Task 19: F-007 — Combine production schedule with SPK generation

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` — SPK generation section
- Modify: `app/api/manufacturing/production-bom/[id]/generate-spk/route.ts`

**Step 1:** When generating SPK, allow user to set start date and auto-calculate schedule based on step durations.

**Step 2:** Add `startDate` and `endDate` fields to SPK generation dialog. Auto-compute endDate from total duration.

**Step 3:** Set `startDate`/`dueDate` on each WorkOrder based on cumulative step durations in the DAG.

---

### Task 20: F-005 — Remove Routing page (LOW)

**Files:**
- Modify: `components/app-sidebar.tsx` — remove or hide Routing nav item

---

### Task 21: F-002, F-003, F-006, F-008, F-014, F-015 (MEDIUM priority — implement after HIGH items)

Brief plans:
- **F-002** (Separate time study from PCC): Add `timeStudyMinutes` field to detail-panel, auto-calculate per-piece value
- **F-003** (HPP not in SPK): Hide cost/HPP section from SPK PDF view
- **F-006** (Move Add Process to Admin): Add process management toggle in settings
- **F-008** (Operator assignment): Add `operatorName` field to ProcessStation model + UI
- **F-014** (Station distribution viz): Polish after B-006 fix
- **F-015** (Push incomplete expenses): Data cleanup task for Darren

---

## PHASE 3 — FEATURES (ship by April 1, HIGH only)

---

### Task 22: N-001 + N-022 — Labor cost formula in BOM

**Problem:** Implement: monthly_salary / (monthly_hours / duration_per_piece_hours) = cost per piece.

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx` — add salary input, show calculated cost
- Modify: `components/manufacturing/bom/bom-cost-helpers.tsx` — add `calcLaborCostPerPiece()`
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts:186` — save `laborMonthlySalary`

**Step 1:** Create labor cost calculation helper:
```typescript
export function calcLaborCostPerPiece(monthlySalary: number, durationMinutes: number): number {
    if (!monthlySalary || !durationMinutes) return 0
    const MONTHLY_HOURS = 172
    const durationHours = durationMinutes / 60
    const piecesPerMonth = MONTHLY_HOURS / durationHours
    return Math.round(monthlySalary / piecesPerMonth)
}
// Example: 4,000,000 / (172 / 0.25) = 4,000,000 / 688 = Rp 5,814/pcs
```

**Step 2:** In detail-panel, when step is IN_HOUSE:
- Show "Gaji Bulanan (Rp)" input → saves to `laborMonthlySalary`
- Auto-display: "Biaya/pcs: Rp {calculated}" below
- Use `durationMinutes` from the same step

**Step 3:** In bom-cost-helpers `calcTotalLaborCost`, use the new formula:
```typescript
export function calcTotalLaborCost(steps: any[], totalQty: number): number {
    return steps.reduce((total, step) => {
        const isSubkon = step.useSubkon ?? step.station?.operationType === 'SUBCONTRACTOR'
        if (isSubkon) {
            // Subcon: use direct price per piece from allocations
            const allocCost = (step.allocations || []).reduce(
                (s: number, a: any) => s + ((a.pricePerPcs || 0) * (a.quantity || 0)), 0
            )
            return total + allocCost
        }
        // In-house: use labor formula
        const costPerPiece = calcLaborCostPerPiece(step.laborMonthlySalary || 0, step.durationMinutes || 0)
        return total + (costPerPiece * totalQty)
    }, 0)
}
```

**Database:** `laborMonthlySalary` column already exists on `ProductionBOMStep` ✓

**Cache invalidation:** `queryKeys.productionBom.detail(id)`

---

### Task 23: N-002 — Subcon price per piece field

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx` — show price/pcs input when subkon
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts:229` — save `pricePerPcs` on allocation

**Step 1:** In detail-panel, when step `isSubcon`:
- Hide salary field
- Show "Harga/pcs (Rp)" input per allocation
- Save to `ProductionBOMAllocation.pricePerPcs`

**Step 2:** `pricePerPcs` column already exists on `ProductionBOMAllocation` ✓ (seen in PATCH route line 229).

---

### Task 24: N-003 — Work center grouping with process assignment

**Files:**
- **Schema change needed — present to user first**
- Modify: `app/manufacturing/work-centers/page.tsx` — add group management UI
- Modify: `app/api/manufacturing/process-stations/route.ts` — add group filter

**Schema migration:**
```sql
-- Add group concept to ProcessStation
ALTER TABLE "ProcessStation" ADD COLUMN "groupId" TEXT;
ALTER TABLE "ProcessStation" ADD CONSTRAINT "ProcessStation_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "WorkCenterGroup"("id") ON DELETE SET NULL;
```

Note: `WorkCenterGroup` model already exists in the schema with fields: id, name, description, processType, etc.

**Step 1:** Check existing `WorkCenterGroup` model and its usage.

**Step 2:** Add `groupId` to ProcessStation if not already there.

**Step 3:** UI: In work-centers page, allow grouping stations under WorkCenterGroups.

---

### Task 25: N-004 — Multi-station work distribution

**Already partially implemented** via `ProductionBOMAllocation`. The allocation editor allows distributing a step across multiple stations with per-station quantities.

**Step 1:** Verify allocation editor works for in-house steps (not just subkon).

**Step 2:** When a step has multiple allocations (in-house), treat each allocation as a sub-work-order in SPK generation.

---

### Task 26: N-005 — Per-action SPK generation from BOM

**Already implemented** in `generate-spk/route.ts`:
- Each BOM step generates its own WO
- Subkon steps with allocations generate one WO per allocation
- DAG-based dependencies respected

**Step 1:** Verify this works end-to-end. Test with 5-step BOM.

**Step 2:** In the SPK result dialog, show each WO with its step name, station, and quantity.

---

### Task 27: N-009 — WIP warehouse type

**Schema change needed:**
```sql
-- Add WarehouseType enum
CREATE TYPE "WarehouseType" AS ENUM ('RAW_MATERIAL', 'WORK_IN_PROGRESS', 'FINISHED_GOODS', 'GENERAL');
ALTER TABLE "Warehouse" ADD COLUMN "warehouseType" "WarehouseType" DEFAULT 'GENERAL';
```

**Files:**
- Modify: `prisma/schema.prisma` — add WarehouseType enum, add field to Warehouse
- Modify: `app/inventory/warehouses/page.tsx` — show type badge, filter by type
- Modify: warehouse forms — add type selector

**Step 1:** Present migration to user for approval.

**Step 2:** After schema update, add type to all warehouse CRUD operations.

**Step 3:** Add visual indicators: color-coded badges for each warehouse type.

---

### Task 28: N-010 — Warehouse notification on SPK creation

**Files:**
- Modify: `app/api/manufacturing/production-bom/[id]/generate-spk/route.ts`
- Create: notification system or use existing toast + dashboard alerts

**Step 1:** When SPK is generated, create `MaterialReleaseRequest` records for each material in each step.

**Step 2:** Warehouse page shows pending release requests with "Konfirmasi Release" button.

**Step 3:** On confirmation, create `InventoryTransaction` (type: PRODUCTION_OUT) moving material from Raw Material warehouse.

**Schema change needed:**
```sql
CREATE TABLE "MaterialReleaseRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "workOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "requestedQty" DECIMAL(12,2) NOT NULL,
    "releasedQty" DECIMAL(12,2) DEFAULT 0,
    "status" TEXT DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY ("id")
);
```

---

### Task 29: N-011 — Finished goods warehouse confirmation

**Files:**
- Modify: inventory warehouse page — add "Terima Barang Jadi" action
- Create: finished goods receipt flow

**Step 1:** When WorkOrder status → COMPLETED, create a pending FG receipt.

**Step 2:** Warehouse keeper confirms receipt → creates `InventoryTransaction` (type: PRODUCTION_IN) in FG warehouse.

---

### Task 30: N-021 — Real-time inventory tracking (3 categories)

**Files:**
- Modify: `app/inventory/stock/page.tsx` — add WIP/FG/Delivery tabs
- Connect to BOM production status for live updates

**Step 1:** After N-009 (warehouse types), query stock levels grouped by warehouse type.

**Step 2:** Show 3 category cards: WIP count, FG count, In-Delivery count.

---

### Task 31: N-007 — Production Gantt chart

**Files:**
- Create: `app/manufacturing/planning/gantt/page.tsx`
- Create: `components/manufacturing/dashboard/production-gantt.tsx`

**Step 1:** Fetch all active WorkOrders with their BOM steps, durations, and dates.

**Step 2:** Render Gantt chart using SVG (similar to timeline-view pattern) with:
- X-axis: calendar days
- Y-axis: work centers / process lines
- Bars: work orders colored by status (PLANNED=gray, IN_PROGRESS=blue, COMPLETED=green)

---

### Task 32: N-020 — Complete financial statements

**Already largely implemented** in the recent `finance/reports/page.tsx` rewrite:
- ✓ P&L (Laba Rugi)
- ✓ Balance Sheet (Neraca)
- ✓ Cash Flow (Arus Kas)
- ✓ Trial Balance
- ✓ AR/AP Aging
- ✓ Equity Changes
- ✓ Tax Report (PPN)
- ✓ Budget vs Actual

**Step 1:** Verify all reports show real data (not dummy).

**Step 2:** Ensure Balance Sheet balances (Assets = Liabilities + Equity).

**Step 3:** Connect reports to actual GL entries from invoices/payments.

---

### Task 33: N-023 — CSA checklist applied to all features

**Meta task:** After all above items are complete, do a full CSA audit pass:
1. Every page has loading states
2. Every mutation has error handling
3. Every form validates required fields
4. Every list has empty state
5. Every action has confirmation dialog for destructive operations
6. Cache invalidation is correct across all modules
7. Indonesian labels are consistent
8. Currency formatting uses formatIDR consistently

---

## Dependency Graph

```
B-004 (duration per-piece) ──┐
B-006 (distribution %)  ─────┼──→ B-001 (progress 300%)
B-002 (CVA label)  ──────────┘
                              └──→ B-011 (timeline debug)
B-003 (drag duplicate) ─────────→ B-011 (timeline debug)

F-001 (duration required) ──→ B-005 (SPK missing data)

B-009 (invoice draft) ──→ F-012 (invoice→GL link)
F-009 + F-010 + F-011 (simplify transactions)

N-001 (labor formula) ──→ N-022 (integrate into BOM)
N-002 (subcon price) ──→ N-005 (per-action SPK)

N-003 (WC grouping) ──→ F-004 (replace station label)
N-009 (WIP warehouse) ──→ N-010 (warehouse notify) ──→ N-011 (FG confirm) ──→ N-021 (real-time tracking)

F-007 (schedule + SPK) ──→ B-008 (schedule→SPK status sync)
```

## Commit Strategy

Each task gets its own atomic commit:
```
fix(bom): B-004 — use per-piece duration in cost summary
fix(bom): B-001 — calculate progress per step target, not total
fix(bom): B-002 — show subkon CV name from allocations
fix(bom): B-006 — fix distribution percentage rounding
fix(timeline): B-003 — prevent duplicate entries on drag
fix(invoice): B-009 — verify draft status on creation
fix(spk): B-005 — disable generate button when data incomplete
feat(bom): N-001 — labor cost formula calculation
feat(bom): N-002 — subcon price per piece field
```
