# Production Costing & Cashflow Forecast Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add complete production costing (material + labor + overhead with actual vs standard variance on work orders) and a 6-month cross-module cashflow forecast page that reuses the existing cashflow infrastructure.

**Architecture:** Feature A adds overhead calculation to the existing `bom-cost-helpers.ts`, adds 3 cost fields to WorkOrder, and builds a variance analysis section. Feature B extends the existing `finance-cashflow.ts` (which already has 11 auto-pull sources) with a WO cost source and builds a multi-month forecast page with Recharts visualization.

**Tech Stack:** Next.js App Router, Prisma 6, TanStack Query, Recharts, Vitest, server actions.

---

## Task 1: Schema Migration — WorkOrder cost fields + ProcessStation overheadPct

**Files:**
- Modify: `prisma/schema.prisma:1693` (WorkOrder model, after `status` field)
- Modify: `prisma/schema.prisma:2791` (ProcessStation model, after `costPerUnit` field)

**Step 1: Add fields to WorkOrder model**

In `prisma/schema.prisma`, inside the `WorkOrder` model (around line 1693), add after the `status` field:

```prisma
estimatedCostTotal  Decimal?  @db.Decimal(15, 2)
actualCostTotal     Decimal?  @db.Decimal(15, 2)
costVariancePct     Decimal?  @db.Decimal(8, 2)
```

**Step 2: Add overheadPct to ProcessStation model**

In `prisma/schema.prisma`, inside the `ProcessStation` model (around line 2791), add after `costPerUnit`:

```prisma
overheadPct  Decimal?  @db.Decimal(5, 2)  // overhead % applied on labor cost
```

**Step 3: Run migration**

```bash
npx prisma migrate dev --name add_wo_cost_fields_station_overhead
```

**Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

**Step 5: Verify build**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add WorkOrder cost fields and ProcessStation overheadPct"
```

---

## Task 2: Overhead Cost Calculation Helper (TDD)

**Files:**
- Modify: `components/manufacturing/bom/bom-cost-helpers.ts`
- Create: `__tests__/manufacturing/bom-cost-helpers.test.ts`

**Step 1: Write failing tests for overhead calculation**

Create `__tests__/manufacturing/bom-cost-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import {
    calcOverheadCostPerPcs,
    calcTotalOverheadCost,
    calcHPPPerPcs,
    calcLaborCostPerPcs,
    calcItemCostPerUnit,
} from "@/components/manufacturing/bom/bom-cost-helpers"

describe("calcOverheadCostPerPcs", () => {
    it("returns 0 when station has no overheadPct", () => {
        expect(calcOverheadCostPerPcs(1000, null, null)).toBe(0)
    })

    it("calculates overhead as percentage of labor cost", () => {
        // Labor cost = 1000/pcs, overhead = 15%
        expect(calcOverheadCostPerPcs(1000, 15, null)).toBe(150)
    })

    it("adds machine overhead when provided", () => {
        // Labor cost = 1000/pcs, overhead = 10%, machine overhead = 200/hr, duration = 30min
        // Station overhead: 1000 × 0.10 = 100
        // Machine overhead: 200 × (30/60) = 100
        // Total: 200
        expect(calcOverheadCostPerPcs(1000, 10, { overheadMaterialCostPerHour: 200, durationMinutes: 30 })).toBe(200)
    })

    it("handles machine overhead alone (no station overhead)", () => {
        expect(calcOverheadCostPerPcs(1000, null, { overheadMaterialCostPerHour: 600, durationMinutes: 10 })).toBe(100)
    })
})

describe("calcTotalOverheadCost", () => {
    it("sums overhead across all in-house steps", () => {
        const steps = [
            {
                laborMonthlySalary: 5160000, // salary that yields 500/min at 172hrs
                durationMinutes: 2,
                station: { overheadPct: 10, operationType: "INTERNAL" },
                useSubkon: false,
                allocations: [],
            },
            {
                laborMonthlySalary: 5160000,
                durationMinutes: 3,
                station: { overheadPct: 20, operationType: "INTERNAL" },
                useSubkon: false,
                allocations: [],
            },
        ]
        const result = calcTotalOverheadCost(steps, 100)
        expect(result).toBeGreaterThan(0)
    })

    it("skips subkon steps", () => {
        const steps = [
            {
                laborMonthlySalary: 5160000,
                durationMinutes: 2,
                station: { overheadPct: 10, operationType: "SUBCONTRACTOR" },
                useSubkon: true,
                allocations: [],
            },
        ]
        expect(calcTotalOverheadCost(steps, 100)).toBe(0)
    })
})

describe("calcHPPPerPcs", () => {
    it("sums material + labor + overhead per piece", () => {
        const result = calcHPPPerPcs(5000, 2000, 500)
        expect(result).toBe(7500)
    })
})

// Existing functions — regression tests
describe("calcLaborCostPerPcs", () => {
    it("calculates correctly with standard formula", () => {
        // 5,160,000 IDR / (172 × 60) = 500 IDR per minute
        // 500 × 2 minutes = 1000 IDR per piece
        expect(calcLaborCostPerPcs(5160000, 2)).toBeCloseTo(1000, 0)
    })

    it("returns 0 for zero salary", () => {
        expect(calcLaborCostPerPcs(0, 5)).toBe(0)
    })
})

describe("calcItemCostPerUnit", () => {
    it("calculates with waste percentage", () => {
        const item = {
            id: "1",
            quantityPerUnit: 2,
            material: { id: "m1", costPrice: 1000 },
            wastePct: 10,
        }
        // 2 × 1000 × 1.10 = 2200
        expect(calcItemCostPerUnit(item)).toBe(2200)
    })
})
```

**Step 2: Run tests to verify they fail**

```bash
npx vitest run __tests__/manufacturing/bom-cost-helpers.test.ts
```

Expected: FAIL — `calcOverheadCostPerPcs`, `calcTotalOverheadCost`, `calcHPPPerPcs` not exported.

**Step 3: Implement overhead functions in bom-cost-helpers.ts**

Add to `components/manufacturing/bom/bom-cost-helpers.ts` (after `calcLaborCostPerPcs` function, around line 60):

```typescript
/**
 * Calculate overhead cost per piece for a single step.
 * Two sources: (1) station overheadPct applied on labor cost, (2) machine overhead per hour.
 */
export function calcOverheadCostPerPcs(
    laborCostPerPcs: number,
    overheadPct: number | string | null | undefined,
    machineOverhead: { overheadMaterialCostPerHour?: number | string; durationMinutes?: number | null } | null | undefined,
): number {
    let total = 0
    const pct = Number(overheadPct || 0)
    if (pct > 0) {
        total += laborCostPerPcs * pct / 100
    }
    if (machineOverhead) {
        const costPerHour = Number(machineOverhead.overheadMaterialCostPerHour || 0)
        const minutes = Number(machineOverhead.durationMinutes || 0)
        if (costPerHour > 0 && minutes > 0) {
            total += costPerHour * (minutes / 60)
        }
    }
    return total
}

/**
 * Calculate total overhead cost across all in-house steps × target quantity.
 */
export function calcTotalOverheadCost(
    steps: {
        laborMonthlySalary?: number | string | null
        durationMinutes?: number | null
        station?: { overheadPct?: number | string | null; operationType?: string; machine?: { overheadMaterialCostPerHour?: number | string } | null } | null
        useSubkon?: boolean | null
        allocations?: unknown[]
    }[],
    targetQty: number,
): number {
    let total = 0
    for (const step of steps) {
        const isSubkon = step.useSubkon ?? step.station?.operationType === "SUBCONTRACTOR"
        if (isSubkon) continue
        const laborPerPcs = calcLaborCostPerPcs(step.laborMonthlySalary, step.durationMinutes)
        const overheadPerPcs = calcOverheadCostPerPcs(
            laborPerPcs,
            step.station?.overheadPct,
            step.station?.machine
                ? { overheadMaterialCostPerHour: step.station.machine.overheadMaterialCostPerHour, durationMinutes: step.durationMinutes }
                : null,
        )
        total += overheadPerPcs * targetQty
    }
    return total
}

/** Simple HPP per piece = material + labor + overhead */
export function calcHPPPerPcs(materialPerPcs: number, laborPerPcs: number, overheadPerPcs: number): number {
    return materialPerPcs + laborPerPcs + overheadPerPcs
}
```

**Step 4: Run tests to verify they pass**

```bash
npx vitest run __tests__/manufacturing/bom-cost-helpers.test.ts
```

Expected: ALL PASS

**Step 5: Commit**

```bash
git add components/manufacturing/bom/bom-cost-helpers.ts __tests__/manufacturing/bom-cost-helpers.test.ts
git commit -m "feat(bom): add overhead cost calculation with TDD tests"
```

---

## Task 3: BOM Detail Page — Enhanced Cost Summary with Overhead

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx:115-151` (costSummary useMemo)
- Modify: `app/manufacturing/bom/[id]/page.tsx:1096-1138` (cost display strip)

**Context:** The BOM detail page currently shows Material, Tenaga Kerja, and HPP/Unit in the toolbar. We add Overhead and update HPP to include all three components.

**Step 1: Update costSummary useMemo to include overhead**

In `app/manufacturing/bom/[id]/page.tsx`, find the `costSummary` useMemo (around line 115). Add import at top of file:

```typescript
import { calcTotalOverheadCost, calcHPPPerPcs } from "@/components/manufacturing/bom/bom-cost-helpers"
```

Then modify the costSummary useMemo to add overhead calculation. After `const totalLabor = calcTotalLaborCost(steps, totalQty)`, add:

```typescript
const totalOverhead = calcTotalOverheadCost(steps, totalQty)
```

Update `grandTotal`:
```typescript
const grandTotal = totalMaterial + totalLabor + totalOverhead
```

Add to the return object:
```typescript
return { totalMaterial, totalLabor, totalOverhead, grandTotal, perUnit, totalDuration, durationPerPiece, estTimeLabel, progressPct }
```

**Step 2: Update the cost display strip**

Find the cost display section (around line 1096-1138). Currently it shows Material, Tenaga Kerja, HPP/Unit. Add an Overhead card between Tenaga Kerja and HPP/Unit:

```tsx
{/* After Tenaga Kerja card, before HPP/Unit card */}
<div className="text-center">
    <div className="text-[10px] text-muted-foreground">Overhead</div>
    <div className="font-bold text-xs text-orange-700">
        {formatCurrency(costSummary.totalOverhead / (totalQty || 1))}/pcs
    </div>
</div>
```

**Step 3: Verify in browser**

Navigate to `/manufacturing/bom/[id]` — cost summary bar should now show 5 items: Material, Tenaga Kerja, Overhead, HPP/Unit, Total.

**Step 4: Commit**

```bash
git add app/manufacturing/bom/\[id\]/page.tsx
git commit -m "feat(bom): show overhead cost in BOM detail cost summary"
```

---

## Task 4: ProcessStation — Add Overhead Input in Station Form

**Files:**
- Find and modify: The station form dialog (search for `ProcessStation` form or `station-form` or `create-station`)
- Look in: `components/manufacturing/` for station creation/edit UI

**Context:** Users need a way to set `overheadPct` on a ProcessStation. Find the existing station form dialog and add the overhead percentage input field.

**Step 1: Find the station form**

```bash
grep -r "overheadPct\|costPerUnit\|station.*form\|StationForm" components/manufacturing/ --include="*.tsx" -l
```

Check these files to find where `costPerUnit` is displayed in a form — the overhead field should go next to it.

**Step 2: Add overheadPct input field**

Next to the existing `costPerUnit` field, add:

```tsx
<div className="space-y-2">
    <Label>Overhead (%)</Label>
    <Input
        type="number"
        step="0.01"
        min="0"
        max="100"
        placeholder="15"
        value={formData.overheadPct ?? ""}
        onChange={(e) => setFormData(prev => ({ ...prev, overheadPct: e.target.value ? Number(e.target.value) : null }))}
    />
    <p className="text-xs text-muted-foreground">Persen overhead yang dibebankan di atas biaya tenaga kerja</p>
</div>
```

**Step 3: Update the create/update server action or API call**

Ensure `overheadPct` is included in the payload sent to Prisma when creating/updating a ProcessStation.

**Step 4: Commit**

```bash
git add components/manufacturing/
git commit -m "feat(station): add overhead percentage input to station form"
```

---

## Task 5: Work Order — Calculate & Store Estimated Cost on Creation

**Files:**
- Modify: The server action or API route that creates work orders
- Search: `grep -r "workOrder.*create\|createWorkOrder" lib/actions/ app/api/ --include="*.ts" -l`
- Reference: `components/manufacturing/bom/bom-cost-helpers.ts` for cost functions

**Context:** When a WorkOrder is created (from a BOM), calculate HPP and store it as `estimatedCostTotal`.

**Step 1: Find the work order creation logic**

```bash
grep -rn "workOrder.*create\b" lib/actions/ app/api/ --include="*.ts" | head -20
```

**Step 2: After finding the WO creation code, add cost calculation**

Before the `prisma.workOrder.create()` call, add:

```typescript
// Calculate estimated cost from BOM
let estimatedCostTotal = null
if (bomId) {
    const bom = await tx.billOfMaterials.findUnique({
        where: { id: bomId },
        include: {
            items: { include: { material: { select: { costPrice: true } } } },
        },
    })
    const bomSteps = await tx.productionBOMStep.findMany({
        where: { bomId },
        include: {
            station: { select: { costPerUnit: true, overheadPct: true, operationType: true, machine: { select: { overheadMaterialCostPerHour: true } } } },
            allocations: { select: { pricePerPcs: true, quantity: true } },
        },
    })

    if (bom) {
        // Material cost per piece
        let materialPerPcs = 0
        for (const item of bom.items) {
            const qty = Number(item.quantity || 0)
            const price = Number(item.material?.costPrice || 0)
            const waste = Number(item.wastePct || 0)
            materialPerPcs += qty * price * (1 + waste / 100)
        }

        // Labor cost per piece
        let laborPerPcs = 0
        for (const step of bomSteps) {
            const salary = Number(step.laborMonthlySalary || 0)
            const duration = Number(step.durationMinutes || 0)
            if (salary > 0 && duration > 0) {
                laborPerPcs += salary * duration / (172 * 60)
            } else {
                laborPerPcs += Number(step.station?.costPerUnit || 0)
            }
        }

        // Overhead cost per piece
        let overheadPerPcs = 0
        for (const step of bomSteps) {
            const isSubkon = step.useSubkon ?? step.station?.operationType === "SUBCONTRACTOR"
            if (isSubkon) continue
            const salary = Number(step.laborMonthlySalary || 0)
            const duration = Number(step.durationMinutes || 0)
            const laborCost = salary > 0 && duration > 0 ? salary * duration / (172 * 60) : 0
            const pct = Number(step.station?.overheadPct || 0)
            if (pct > 0) overheadPerPcs += laborCost * pct / 100
            const machineOH = Number(step.station?.machine?.overheadMaterialCostPerHour || 0)
            if (machineOH > 0 && duration > 0) overheadPerPcs += machineOH * (duration / 60)
        }

        const hppPerPcs = materialPerPcs + laborPerPcs + overheadPerPcs
        estimatedCostTotal = hppPerPcs * plannedQty
    }
}
```

Then include `estimatedCostTotal` in the `create` data.

**Step 3: Verify by creating a WO from a BOM that has cost data**

**Step 4: Commit**

```bash
git add lib/actions/ app/api/
git commit -m "feat(wo): calculate estimatedCostTotal on work order creation"
```

---

## Task 6: Work Order — Actual Cost on Completion + Variance

**Files:**
- Modify: The server action or API route that completes/updates work orders
- Search: `grep -rn "COMPLETED\|completeWorkOrder\|workOrder.*update.*status" lib/actions/ app/api/ --include="*.ts" | head -20`

**Context:** When a WO status changes to COMPLETED, calculate actual cost from inventory transactions and actual time, then compute variance.

**Step 1: Find the WO completion logic**

```bash
grep -rn "COMPLETED\|status.*COMPLETED" app/api/manufacturing/ lib/actions/ --include="*.ts" | head -20
```

**Step 2: Add actual cost calculation when WO completes**

When status transitions to `COMPLETED`:

```typescript
if (newStatus === "COMPLETED") {
    // Actual material cost: sum of PRODUCTION_OUT inventory transactions
    const materialTxns = await tx.inventoryTransaction.findMany({
        where: { workOrderId: woId, type: "PRODUCTION_OUT" },
        select: { quantity: true, unitCost: true },
    })
    const actualMaterial = materialTxns.reduce((sum, t) => sum + Math.abs(Number(t.quantity || 0)) * Number(t.unitCost || 0), 0)

    // Actual labor cost: from BOM steps actualTimeTotal
    const steps = await tx.productionBOMStep.findMany({
        where: { bomId: workOrder.productionBomId },
        select: { laborMonthlySalary: true, actualTimeTotal: true, durationMinutes: true, station: { select: { overheadPct: true } } },
    })
    let actualLabor = 0
    let actualOverhead = 0
    for (const step of steps) {
        const salary = Number(step.laborMonthlySalary || 0)
        const actualTime = Number(step.actualTimeTotal || 0)
        if (salary > 0 && actualTime > 0) {
            const laborCost = salary * actualTime / (172 * 60)
            actualLabor += laborCost
            const pct = Number(step.station?.overheadPct || 0)
            if (pct > 0) actualOverhead += laborCost * pct / 100
        }
    }

    const actualCostTotal = actualMaterial + actualLabor + actualOverhead
    const estimated = Number(workOrder.estimatedCostTotal || 0)
    const variancePct = estimated > 0 ? ((actualCostTotal - estimated) / estimated) * 100 : null

    await tx.workOrder.update({
        where: { id: woId },
        data: {
            actualCostTotal,
            costVariancePct: variancePct,
        },
    })
}
```

**Step 3: Commit**

```bash
git add lib/actions/ app/api/
git commit -m "feat(wo): calculate actual cost and variance on WO completion"
```

---

## Task 7: Work Order List — Show Cost Columns

**Files:**
- Modify: `app/manufacturing/orders/orders-client.tsx` (or wherever the WO table is rendered)
- Modify: The WO API/hook to include cost fields in the response

**Step 1: Find the WO list component**

```bash
grep -rn "estimatedCost\|actualCost\|costVariance\|columns.*workOrder" app/manufacturing/orders/ components/manufacturing/orders/ --include="*.tsx" | head -20
```

**Step 2: Add cost columns to the WO table**

Add 3 columns:

```typescript
{
    accessorKey: "estimatedCostTotal",
    header: "Est. HPP",
    cell: ({ row }) => {
        const val = Number(row.original.estimatedCostTotal || 0)
        return val > 0 ? formatCurrency(val) : "—"
    },
},
{
    accessorKey: "actualCostTotal",
    header: "Aktual HPP",
    cell: ({ row }) => {
        const val = Number(row.original.actualCostTotal || 0)
        return val > 0 ? formatCurrency(val) : "—"
    },
},
{
    accessorKey: "costVariancePct",
    header: "Varians",
    cell: ({ row }) => {
        const pct = Number(row.original.costVariancePct)
        if (!pct && pct !== 0) return "—"
        const color = Math.abs(pct) <= 3 ? "text-green-600" : Math.abs(pct) <= 5 ? "text-yellow-600" : "text-red-600"
        const sign = pct > 0 ? "+" : ""
        return <span className={color}>{sign}{pct.toFixed(1)}%</span>
    },
},
```

**Step 3: Ensure WO API includes cost fields**

In the WO API route or server action, add `estimatedCostTotal`, `actualCostTotal`, `costVariancePct` to the Prisma `select`.

**Step 4: Commit**

```bash
git add app/manufacturing/orders/ components/manufacturing/orders/ app/api/manufacturing/
git commit -m "feat(wo): show cost estimate, actual, and variance in WO list"
```

---

## Task 8: Cashflow — Add WO Cost as Auto-Pull Source #12

**Files:**
- Modify: `lib/actions/finance-cashflow.ts:589-635` (add WO source to Promise.all)

**Context:** The existing `finance-cashflow.ts` has 11 auto-pull sources. We add source #12: active Work Orders with `estimatedCostTotal` as projected cash outflow.

**Step 1: Add getWOCostItems function**

In `lib/actions/finance-cashflow.ts`, add after the last auto-pull source function (around line 490):

```typescript
// ================================
// Auto-pull source #12: Work Order Production Costs
// ================================

async function getWOCostItems(monthStart: Date, monthEnd: Date): Promise<CashflowItem[]> {
    const workOrders = await prisma.workOrder.findMany({
        where: {
            status: { in: ["PLANNED", "IN_PROGRESS"] },
            estimatedCostTotal: { gt: 0 },
            OR: [
                { scheduledStart: { gte: monthStart, lte: monthEnd } },
                { startDate: { gte: monthStart, lte: monthEnd } },
            ],
        },
        include: { product: { select: { name: true } } },
    })

    return workOrders.map((wo) => ({
        id: `wo-${wo.id}`,
        date: toDateStr(wo.scheduledStart || wo.startDate || monthStart),
        description: `Produksi ${wo.number} — ${wo.product?.name || "Produk"}`,
        amount: toNum(wo.estimatedCostTotal),
        direction: "OUT" as const,
        category: "WO_COST",
        sourceId: wo.id,
        isRecurring: false,
        isManual: false,
    }))
}
```

**Step 2: Add WO_COST to CashflowCategory enum**

In `prisma/schema.prisma`, find the `CashflowCategory` enum and add `WO_COST` if not already present. Then run `npx prisma migrate dev --name add_wo_cost_category`.

**Step 3: Wire into the main data fetcher**

In `getCashflowPlanData()`, add `getWOCostItems(monthStart, monthEnd)` to the `Promise.all` array (around line 607), and spread `...woCostItems` into `autoItems`.

**Step 4: Run tests**

```bash
npx vitest run
```

**Step 5: Commit**

```bash
git add lib/actions/finance-cashflow.ts prisma/schema.prisma prisma/migrations/
git commit -m "feat(cashflow): add work order cost as auto-pull source #12"
```

---

## Task 9: Cashflow Forecast — Multi-Month Server Action

**Files:**
- Modify: `lib/actions/finance-cashflow.ts` (add new exported function)

**Context:** The existing `getCashflowPlanData()` fetches one month at a time. For the forecast page, we need a function that fetches 6 months of summaries efficiently.

**Step 1: Add multi-month forecast function**

At the bottom of `lib/actions/finance-cashflow.ts`, add:

```typescript
// ================================
// Exported: Multi-month forecast (6 months forward)
// ================================

export interface CashflowForecastMonth {
    month: number
    year: number
    label: string // "Mar 2026"
    totalIn: number
    totalOut: number
    netFlow: number
    runningBalance: number
    breakdown: {
        category: string
        direction: "IN" | "OUT"
        amount: number
        itemCount: number
    }[]
}

export interface CashflowForecastData {
    startingBalance: number
    months: CashflowForecastMonth[]
    totals: {
        totalIn: number
        totalOut: number
        netFlow: number
        endingBalance: number
    }
}

export async function getCashflowForecast(monthsAhead: number = 6): Promise<CashflowForecastData> {
    await requireAuth()

    const startingBalance = await getStartingBalance()
    const now = new Date()
    const months: CashflowForecastMonth[] = []
    let runningBalance = startingBalance

    for (let i = 0; i < monthsAhead; i++) {
        const targetDate = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const month = targetDate.getMonth() + 1
        const year = targetDate.getFullYear()

        const data = await getCashflowPlanData(month, year)
        const allItems = [...data.autoItems, ...data.manualItems]

        // Build category breakdown
        const categoryMap = new Map<string, { direction: "IN" | "OUT"; amount: number; count: number }>()
        for (const item of allItems) {
            const key = `${item.category}-${item.direction}`
            const existing = categoryMap.get(key) || { direction: item.direction, amount: 0, count: 0 }
            existing.amount += item.amount
            existing.count += 1
            categoryMap.set(key, existing)
        }

        const breakdown = Array.from(categoryMap.entries()).map(([key, val]) => ({
            category: key.split("-")[0],
            direction: val.direction,
            amount: val.amount,
            itemCount: val.count,
        }))

        runningBalance += data.summary.netFlow

        const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

        months.push({
            month,
            year,
            label: `${monthNames[month - 1]} ${year}`,
            totalIn: data.summary.totalIn,
            totalOut: data.summary.totalOut,
            netFlow: data.summary.netFlow,
            runningBalance,
            breakdown,
        })
    }

    const totalIn = months.reduce((s, m) => s + m.totalIn, 0)
    const totalOut = months.reduce((s, m) => s + m.totalOut, 0)

    return {
        startingBalance,
        months,
        totals: {
            totalIn,
            totalOut,
            netFlow: totalIn - totalOut,
            endingBalance: runningBalance,
        },
    }
}
```

**Step 2: Commit**

```bash
git add lib/actions/finance-cashflow.ts
git commit -m "feat(cashflow): add multi-month forecast server action"
```

---

## Task 10: Cashflow Forecast — API Route

**Files:**
- Create: `app/api/finance/cashflow-forecast/route.ts`

**Step 1: Create the API route**

```typescript
import { NextResponse } from "next/server"
import { getCashflowForecast } from "@/lib/actions/finance-cashflow"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const months = Number(searchParams.get("months") || 6)
        const data = await getCashflowForecast(Math.min(months, 12))
        return NextResponse.json(data)
    } catch (error: any) {
        return NextResponse.json(
            { error: error.message || "Failed to fetch forecast" },
            { status: error.message === "Unauthorized" ? 401 : 500 }
        )
    }
}
```

**Step 2: Commit**

```bash
git add app/api/finance/cashflow-forecast/
git commit -m "feat(api): add cashflow forecast endpoint"
```

---

## Task 11: Cashflow Forecast — Query Hook + Query Keys

**Files:**
- Create: `hooks/use-cashflow-forecast.ts`
- Modify: `lib/query-keys.ts:371-374` (add forecast key)

**Step 1: Add query key**

In `lib/query-keys.ts`, find the `cashflowPlan` section (around line 371) and add below it:

```typescript
cashflowForecast: {
    all: ["cashflowForecast"] as const,
    list: (months?: number) => [...queryKeys.cashflowForecast.all, "list", months] as const,
},
```

**Step 2: Create the hook**

Create `hooks/use-cashflow-forecast.ts`:

```typescript
"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import type { CashflowForecastData } from "@/lib/actions/finance-cashflow"

export function useCashflowForecast(months: number = 6) {
    return useQuery<CashflowForecastData>({
        queryKey: queryKeys.cashflowForecast.list(months),
        queryFn: async () => {
            const res = await fetch(`/api/finance/cashflow-forecast?months=${months}`)
            if (!res.ok) throw new Error("Failed to fetch cashflow forecast")
            return res.json()
        },
        staleTime: 2 * 60 * 1000,
    })
}
```

**Step 3: Commit**

```bash
git add hooks/use-cashflow-forecast.ts lib/query-keys.ts
git commit -m "feat(hooks): add useCashflowForecast hook with query keys"
```

---

## Task 12: Cashflow Forecast Page — Full UI

**Files:**
- Create: `app/finance/cashflow-forecast/page.tsx`
- Modify: `lib/sidebar-nav-data.ts:108` (add nav entry)
- Modify: `hooks/use-nav-prefetch.ts` (add prefetch)

**Step 1: Create the page**

Create `app/finance/cashflow-forecast/page.tsx`:

```tsx
"use client"

import { useCashflowForecast } from "@/hooks/use-cashflow-forecast"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils"
import { IconRefresh, IconChevronDown, IconChevronRight, IconTrendingUp, IconTrendingDown, IconWallet, IconCash } from "@tabler/icons-react"
import { useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { useState } from "react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Line, ComposedChart, CartesianGrid, Legend } from "recharts"

export const dynamic = "force-dynamic"

const CATEGORY_LABELS: Record<string, string> = {
    AR_INVOICE: "Piutang (AR Invoice)",
    AP_BILL: "Hutang (AP Bill)",
    PO_DIRECT: "Purchase Order",
    PAYROLL: "Gaji Karyawan",
    BPJS: "BPJS",
    WO_COST: "Biaya Produksi",
    PETTY_CASH: "Kas Kecil",
    RECURRING_JOURNAL: "Jurnal Berulang",
    BUDGET_ALLOCATION: "Anggaran",
    FUNDING_CAPITAL: "Modal Masuk",
    EQUITY_WITHDRAWAL: "Penarikan Ekuitas",
    LOAN_DISBURSEMENT: "Pencairan Pinjaman",
    LOAN_REPAYMENT: "Cicilan Pinjaman",
    MANUAL: "Manual",
    RECURRING_INCOME: "Pendapatan Berulang",
    RECURRING_EXPENSE: "Pengeluaran Berulang",
}

export default function CashflowForecastPage() {
    const { data, isLoading } = useCashflowForecast(6)
    const queryClient = useQueryClient()
    const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-purple-400" />

    const chartData = data.months.map((m) => ({
        name: m.label,
        "Kas Masuk": m.totalIn,
        "Kas Keluar": -m.totalOut,
        "Saldo": m.runningBalance,
    }))

    const handleRefresh = () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.cashflowForecast.all })
    }

    return (
        <div className="mf-page">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Proyeksi Arus Kas</h1>
                    <p className="text-sm text-muted-foreground">Proyeksi 6 bulan ke depan dari semua modul</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <IconRefresh className="h-4 w-4 mr-1" /> Refresh
                </Button>
            </div>

            {/* KPI Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconWallet className="h-4 w-4" /> Saldo Awal
                        </div>
                        <div className="text-xl font-bold mt-1">{formatCurrency(data.startingBalance)}</div>
                        <div className="text-xs text-muted-foreground">Bulan ini</div>
                    </CardContent>
                </Card>
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconTrendingUp className="h-4 w-4 text-green-600" /> Kas Masuk
                        </div>
                        <div className="text-xl font-bold mt-1 text-green-600">{formatCurrency(data.totals.totalIn)}</div>
                        <div className="text-xs text-muted-foreground">6 bulan proyeksi</div>
                    </CardContent>
                </Card>
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconTrendingDown className="h-4 w-4 text-red-600" /> Kas Keluar
                        </div>
                        <div className="text-xl font-bold mt-1 text-red-600">{formatCurrency(data.totals.totalOut)}</div>
                        <div className="text-xs text-muted-foreground">6 bulan proyeksi</div>
                    </CardContent>
                </Card>
                <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                    <CardContent className="p-4">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <IconCash className="h-4 w-4" /> Saldo Akhir
                        </div>
                        <div className="text-xl font-bold mt-1">{formatCurrency(data.totals.endingBalance)}</div>
                        <div className="text-xs text-muted-foreground">Proyeksi akhir</div>
                    </CardContent>
                </Card>
            </div>

            {/* Chart */}
            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader>
                    <CardTitle className="text-lg">Grafik Arus Kas</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="h-[350px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" fontSize={12} />
                                <YAxis fontSize={12} tickFormatter={(v) => `${(v / 1000000).toFixed(0)}M`} />
                                <Tooltip
                                    formatter={(value: number) => formatCurrency(Math.abs(value))}
                                    labelStyle={{ fontWeight: "bold" }}
                                />
                                <Legend />
                                <Bar dataKey="Kas Masuk" fill="#22c55e" stackId="flow" />
                                <Bar dataKey="Kas Keluar" fill="#ef4444" stackId="flow" />
                                <Line type="monotone" dataKey="Saldo" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Detail Table */}
            <Card className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader>
                    <CardTitle className="text-lg">Detail Bulanan</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b-2 border-black bg-muted/50">
                                    <th className="text-left p-3 font-semibold">Bulan</th>
                                    <th className="text-right p-3 font-semibold">Kas Masuk</th>
                                    <th className="text-right p-3 font-semibold">Kas Keluar</th>
                                    <th className="text-right p-3 font-semibold">Net</th>
                                    <th className="text-right p-3 font-semibold">Saldo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.months.map((m) => {
                                    const key = `${m.month}-${m.year}`
                                    const isExpanded = expandedMonth === key
                                    return (
                                        <>
                                            <tr
                                                key={key}
                                                className="border-b hover:bg-muted/30 cursor-pointer"
                                                onClick={() => setExpandedMonth(isExpanded ? null : key)}
                                            >
                                                <td className="p-3 font-medium flex items-center gap-1">
                                                    {isExpanded ? <IconChevronDown className="h-4 w-4" /> : <IconChevronRight className="h-4 w-4" />}
                                                    {m.label}
                                                </td>
                                                <td className="p-3 text-right text-green-600">{formatCurrency(m.totalIn)}</td>
                                                <td className="p-3 text-right text-red-600">{formatCurrency(m.totalOut)}</td>
                                                <td className={`p-3 text-right font-medium ${m.netFlow >= 0 ? "text-green-600" : "text-red-600"}`}>
                                                    {m.netFlow >= 0 ? "+" : ""}{formatCurrency(m.netFlow)}
                                                </td>
                                                <td className="p-3 text-right font-bold">{formatCurrency(m.runningBalance)}</td>
                                            </tr>
                                            {isExpanded && (
                                                <tr key={`${key}-detail`}>
                                                    <td colSpan={5} className="p-0">
                                                        <div className="bg-muted/20 px-8 py-3 space-y-2">
                                                            {m.breakdown.filter((b) => b.direction === "IN").length > 0 && (
                                                                <div>
                                                                    <div className="text-xs font-semibold text-green-700 mb-1">Kas Masuk:</div>
                                                                    {m.breakdown
                                                                        .filter((b) => b.direction === "IN")
                                                                        .sort((a, b) => b.amount - a.amount)
                                                                        .map((b) => (
                                                                            <div key={b.category} className="flex justify-between text-xs py-0.5">
                                                                                <span className="text-muted-foreground">
                                                                                    {CATEGORY_LABELS[b.category] || b.category}
                                                                                </span>
                                                                                <span className="text-green-600">
                                                                                    {formatCurrency(b.amount)} ({b.itemCount} item)
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            )}
                                                            {m.breakdown.filter((b) => b.direction === "OUT").length > 0 && (
                                                                <div>
                                                                    <div className="text-xs font-semibold text-red-700 mb-1">Kas Keluar:</div>
                                                                    {m.breakdown
                                                                        .filter((b) => b.direction === "OUT")
                                                                        .sort((a, b) => b.amount - a.amount)
                                                                        .map((b) => (
                                                                            <div key={b.category} className="flex justify-between text-xs py-0.5">
                                                                                <span className="text-muted-foreground">
                                                                                    {CATEGORY_LABELS[b.category] || b.category}
                                                                                </span>
                                                                                <span className="text-red-600">
                                                                                    {formatCurrency(b.amount)} ({b.itemCount} item)
                                                                                </span>
                                                                            </div>
                                                                        ))}
                                                                </div>
                                                            )}
                                                            {m.breakdown.length === 0 && (
                                                                <div className="text-xs text-muted-foreground italic">Tidak ada proyeksi untuk bulan ini</div>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
```

**Step 2: Add to sidebar navigation**

In `lib/sidebar-nav-data.ts`, around line 108 (after "Laporan Keuangan"), add:

```typescript
{ title: "Proyeksi Arus Kas", url: "/finance/cashflow-forecast" },
```

**Step 3: Add to prefetch map**

In `hooks/use-nav-prefetch.ts`, add:

```typescript
"/finance/cashflow-forecast": {
    queryKey: queryKeys.cashflowForecast.list(6),
    queryFn: () => fetch("/api/finance/cashflow-forecast?months=6").then((r) => r.json()),
},
```

**Step 4: Verify in browser**

Navigate to `/finance/cashflow-forecast` — should show KPI strip, chart, and expandable table.

**Step 5: Commit**

```bash
git add app/finance/cashflow-forecast/ lib/sidebar-nav-data.ts hooks/use-nav-prefetch.ts
git commit -m "feat(cashflow): add 6-month cashflow forecast page with chart and expandable detail"
```

---

## Task 13: Final Verification

**Step 1: Run all tests**

```bash
npx vitest run
```

**Step 2: Type check**

```bash
npx tsc --noEmit
```

**Step 3: Lint**

```bash
npm run lint
```

**Step 4: Manual verification checklist**

- [ ] `/manufacturing/bom/[id]` — Cost summary shows Material, Tenaga Kerja, Overhead, HPP/Unit, Total
- [ ] Creating a WO from BOM populates `estimatedCostTotal`
- [ ] WO list shows Est. HPP, Aktual HPP, Varians columns
- [ ] `/finance/cashflow-forecast` — KPI strip, chart, expandable table all render
- [ ] Expanding a month in forecast shows categorized breakdown
- [ ] Sidebar shows "Proyeksi Arus Kas" under Keuangan

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: address test and lint issues from production costing + cashflow forecast"
```
