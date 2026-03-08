# Cross-Module Integration: Manufacturing ↔ Inventory ↔ Procurement

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect BOM materials to inventory stock levels and procurement purchase status so users can track material demand, shortages, and costs across all modules in one connected system.

**Architecture:** Five features built incrementally. Each feature adds a data connection layer between Manufacturing (WorkOrder/BOM), Inventory (StockLevel/Product), and Procurement (PurchaseRequest/PurchaseOrder). Stock Reservation (Task 4) is the foundational model — built before features that depend on `reservedQty` accuracy.

**Tech Stack:** Next.js App Router, Prisma (PostgreSQL), TanStack Query, Server Actions, shadcn/ui, Bahasa Indonesia UI

**Build order:** Task 1 (schema) → Tasks 2-6 can be parallelized (they share the schema but touch different files)

**Verify command:** `npx vitest run && npx tsc --noEmit`

---

## Task 1: StockReservation Schema + Helpers

**Files:**
- Modify: `prisma/schema.prisma:3206` (end of file — add new model + enum)
- Modify: `prisma/schema.prisma:1666` (WorkOrder — add `reservations` relation)
- Modify: `prisma/schema.prisma:210` (Product — add `stockReservations` relation)
- Modify: `prisma/schema.prisma:349` (StockLevel — no change, already has reservedQty/availableQty)
- Create: `lib/reservation-helpers.ts`
- Create: `__tests__/reservation-helpers.test.ts`

**Step 1: Add StockReservation model and ReservationStatus enum to schema.prisma**

At end of file (~line 3206), add:

```prisma
enum ReservationStatus {
  ACTIVE
  CONSUMED
  RELEASED
}

model StockReservation {
  id           String            @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  workOrderId  String            @db.Uuid
  productId    String            @db.Uuid
  warehouseId  String            @db.Uuid
  reservedQty  Int
  consumedQty  Int               @default(0)
  releasedQty  Int               @default(0)
  status       ReservationStatus @default(ACTIVE)
  workOrder    WorkOrder         @relation(fields: [workOrderId], references: [id])
  product      Product           @relation(fields: [productId], references: [id])
  warehouse    Warehouse         @relation(fields: [warehouseId], references: [id])
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@unique([workOrderId, productId, warehouseId])
  @@index([workOrderId])
  @@index([productId, warehouseId])
  @@map("stock_reservations")
}
```

Add `reservations StockReservation[]` relation to WorkOrder, Product, and Warehouse models.

**Step 2: Push schema**

Run: `npx prisma db push && npx prisma generate`

**Step 3: Write reservation helper tests**

Create `__tests__/reservation-helpers.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { calculateBOMRequirements, calculateReservationDelta } from "@/lib/reservation-helpers"

describe("calculateBOMRequirements", () => {
  it("calculates required qty with waste percentage", () => {
    const items = [
      { materialId: "m1", quantityPerUnit: 2, wastePct: 5, unit: "meter" },
      { materialId: "m2", quantityPerUnit: 10, wastePct: 0, unit: "pcs" },
    ]
    const result = calculateBOMRequirements(items, 100)
    expect(result[0].requiredQty).toBe(Math.ceil(2 * 100 * 1.05)) // 210
    expect(result[1].requiredQty).toBe(1000) // no waste
  })

  it("handles zero planned qty", () => {
    const items = [{ materialId: "m1", quantityPerUnit: 5, wastePct: 10, unit: "kg" }]
    const result = calculateBOMRequirements(items, 0)
    expect(result[0].requiredQty).toBe(0)
  })
})

describe("calculateReservationDelta", () => {
  it("returns positive shortfall when stock insufficient", () => {
    const result = calculateReservationDelta(500, 200, 100) // need 500, have 200, 100 on order
    expect(result.shortfall).toBe(200) // 500 - 200 - 100
    expect(result.canReserve).toBe(200) // only 200 available
  })

  it("returns zero shortfall when stock sufficient", () => {
    const result = calculateReservationDelta(100, 500, 0)
    expect(result.shortfall).toBe(0)
    expect(result.canReserve).toBe(100)
  })
})
```

**Step 4: Implement reservation helpers**

Create `lib/reservation-helpers.ts`:

```typescript
export interface BOMRequirement {
  materialId: string
  unit: string
  requiredQty: number
}

export function calculateBOMRequirements(
  items: Array<{ materialId: string; quantityPerUnit: number; wastePct: number; unit: string }>,
  plannedQty: number
): BOMRequirement[] {
  return items.map((item) => ({
    materialId: item.materialId,
    unit: item.unit,
    requiredQty: Math.ceil(item.quantityPerUnit * plannedQty * (1 + item.wastePct / 100)),
  }))
}

export function calculateReservationDelta(
  requiredQty: number,
  availableQty: number,
  onOrderQty: number
) {
  const shortfall = Math.max(0, requiredQty - availableQty - onOrderQty)
  const canReserve = Math.min(requiredQty, availableQty)
  return { shortfall, canReserve }
}
```

**Step 5: Run tests**

Run: `npx vitest run __tests__/reservation-helpers.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add prisma/schema.prisma lib/reservation-helpers.ts __tests__/reservation-helpers.test.ts
git commit -m "feat: add StockReservation model and BOM requirement helpers"
```

---

## Task 2: Material Demand Dashboard

**Files:**
- Create: `app/api/manufacturing/material-demand/route.ts`
- Create: `app/manufacturing/material-demand/page.tsx`
- Create: `hooks/use-material-demand.ts`
- Modify: `lib/query-keys.ts:362` (add materialDemand key)
- Modify: `hooks/use-nav-prefetch.ts` (add prefetch entry)
- Modify: `components/app-sidebar.tsx:244` (add sidebar link after Perencanaan)

**Step 1: Add query key to lib/query-keys.ts**

Before closing `} as const`, add:

```typescript
materialDemand: {
    all: ["materialDemand"] as const,
    list: (filters?: Record<string, unknown>) => [...["materialDemand"], "list", filters ?? {}] as const,
},
```

**Step 2: Create API route**

Create `app/api/manufacturing/material-demand/route.ts`:

- `GET` handler that:
  1. Queries `WorkOrder` where status IN (PLANNED, IN_PROGRESS), includes `product`, `productionBom.items.material`
  2. For WOs without `productionBomId`, falls back to `BillOfMaterials` where productId matches and isActive=true
  3. For each BOM item: `requiredQty = Math.ceil(quantityPerUnit * plannedQty * (1 + wastePct/100))`
  4. Aggregates by materialId across all WOs
  5. Queries `StockLevel` grouped by productId — SUM(availableQty)
  6. Queries `PurchaseOrderItem` where PO status IN (ORDERED, VENDOR_CONFIRMED, SHIPPED, PARTIAL_RECEIVED) — SUM(quantity - receivedQty)
  7. Computes shortfall = max(0, required - inStock - onOrder)
  8. Returns `{ summary: { totalMaterials, materialsReady, materialsShort, materialsPartial, pendingPOCount }, data: MaterialDemandRow[] }`
  9. Each row includes `workOrders[]` breakdown for expandable rows

**Step 3: Create TanStack Query hook**

Create `hooks/use-material-demand.ts`:

```typescript
"use client"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useMaterialDemand(filters?: { status?: string }) {
    return useQuery({
        queryKey: queryKeys.materialDemand.list(filters),
        queryFn: async () => {
            const params = new URLSearchParams()
            if (filters?.status) params.set("status", filters.status)
            const res = await fetch(`/api/manufacturing/material-demand?${params}`)
            const json = await res.json()
            return json
        },
    })
}
```

**Step 4: Create the page**

Create `app/manufacturing/material-demand/page.tsx` — "use client" page with:

- `className="mf-page"` on outer div
- KPI strip (4 cards): Total Material Dibutuhkan, Material Siap (green), Material Kurang (red), PO Dalam Proses (amber)
- Filter bar: Status select (Semua/Siap/Sebagian/Kurang), search input
- TanStack Table with columns: Kode, Nama Material, Satuan, Dibutuhkan, Stok Tersedia, Dalam PO, Kekurangan, Status badge, Aksi ("Buat PR" button)
- Expandable rows showing which WOs need each material
- Neo-brutalist style (border-2 border-black, shadow)
- All labels in Bahasa Indonesia
- "Buat PR" button calls `createPurchaseRequest` from `lib/actions/procurement.ts` with pre-filled shortfall data

**Step 5: Add sidebar link and prefetch**

In `components/app-sidebar.tsx`, add under Manufaktur items after "Perencanaan (MPS)":
```typescript
{ title: "Kebutuhan Material", url: "/manufacturing/material-demand" },
```

In `hooks/use-nav-prefetch.ts`, add:
```typescript
"/manufacturing/material-demand": {
    queryKey: queryKeys.materialDemand.list(),
    queryFn: () => fetch("/api/manufacturing/material-demand").then(r => r.json()),
},
```

**Step 6: Run verify**

Run: `npx vitest run && npx tsc --noEmit`

**Step 7: Commit**

```bash
git commit -m "feat: add material demand dashboard with cross-module data aggregation"
```

---

## Task 3: Auto-PR from Work Order

**Files:**
- Create: `lib/actions/manufacturing-procurement.ts`
- Create: `components/manufacturing/material-shortage-dialog.tsx`
- Modify: `app/manufacturing/orders/orders-client.tsx:825` (add button + auto-check)

**Step 1: Create server actions**

Create `lib/actions/manufacturing-procurement.ts`:

```typescript
"use server"

// Action 1: detectWorkOrderShortages(workOrderId)
// - Loads WO → ProductionBOM (or fallback BOM) → items
// - For each material: required = quantityPerUnit × plannedQty × (1 + wastePct/100)
// - Queries StockLevel.availableQty per material (SUM across warehouses)
// - Queries existing PurchaseRequest/PurchaseOrder pipeline for same material (avoid duplicates)
// - Queries SupplierProduct for preferred supplier per material
// - Returns only materials where shortfall > 0
// Return type: { success, data: { workOrder info, totalBomItems, shortages[] } }

// Action 2: createPRFromWorkOrder(data)
// - Takes workOrderId + items[{materialId, quantity}] + optional notes
// - Creates PurchaseRequest via prisma.$transaction
// - Sets department = "Produksi", priority from WO
// - Notes pre-filled with WO reference: "[WO:WO-2026-XXX] Kekurangan material..."
// - Creates PurchaseRequestItem per shortage
// Return type: { success, prNumber }
```

**Step 2: Create shortage dialog component**

Create `components/manufacturing/material-shortage-dialog.tsx`:

- Props: `workOrderId, workOrderNumber, productName, plannedQty, open, onOpenChange`
- On open: calls `detectWorkOrderShortages(workOrderId)`
- Shows table: Material | Butuh | Tersedia | On Order | Kurang (editable input) | Supplier (from SupplierProduct)
- Checkbox per row (select/deselect materials)
- "Buat Purchase Request (N item)" button
- After success: toast + invalidate `queryKeys.materialDemand.all` and `queryKeys.procurement.all`
- Neo-brutalist style, all Bahasa Indonesia

**Step 3: Add button to work order detail**

In `app/manufacturing/orders/orders-client.tsx` around line 825 (before "Retur Produksi"):

- Add "Cek Kebutuhan Material" button (Package icon, variant="outline")
- Visible when WO status is PLANNED or IN_PROGRESS
- Opens `MaterialShortageDialog`

**Step 4: Add auto-check on IN_PROGRESS transition**

In `orders-client.tsx`, modify the `runTransition` function:
- After successful transition to IN_PROGRESS, call `detectWorkOrderShortages`
- If shortages exist, show toast: `"X material kekurangan terdeteksi"` with action button to open dialog
- Non-blocking — transition succeeds regardless

**Step 5: Run verify**

Run: `npx vitest run && npx tsc --noEmit`

**Step 6: Commit**

```bash
git commit -m "feat: add auto-PR from work order with material shortage detection"
```

---

## Task 4: Stock Reservation Logic

**Files:**
- Create: `lib/actions/stock-reservation.ts`
- Create: `__tests__/stock-reservation.test.ts`
- Modify: `app/api/manufacturing/work-orders/[id]/route.ts:586` (integrate reservation into status transitions)

**Step 1: Write reservation tests**

Create `__tests__/stock-reservation.test.ts`:

Test the pure logic functions from `lib/reservation-helpers.ts`:
- Reserve: correct qty calculation from BOM
- Consume: partial consumption reduces reserved, decreases quantity
- Release: releases unreserved back to available
- Edge: zero waste, 100% consumption, partial completion

**Step 2: Create stock reservation server actions**

Create `lib/actions/stock-reservation.ts` ("use server"):

```typescript
// reserveMaterialsForWorkOrder(workOrderId, warehouseId)
// - Loads WO's BOM, calculates requirements via calculateBOMRequirements()
// - For each material: checks StockLevel.availableQty via checkStockAvailability()
// - If allowNegativeStock=false and insufficient: returns error with details
// - Creates StockReservation records (ACTIVE)
// - Updates StockLevel: reservedQty += X, availableQty -= X
// - All in prisma.$transaction

// consumeReservation(workOrderId, qtyProduced, warehouseId)
// - Loads ACTIVE reservations for this WO
// - Calculates consumption per material for qtyProduced batch
// - Updates StockReservation: consumedQty += consumed
// - Updates StockLevel: quantity -= consumed, reservedQty -= consumed
// - If fully consumed: status = CONSUMED
// - All in prisma.$transaction

// releaseReservation(workOrderId, reason)
// - Loads ACTIVE reservations for this WO
// - For each: releaseQty = reservedQty - consumedQty
// - Updates StockLevel: reservedQty -= release, availableQty += release
// - Sets StockReservation status = RELEASED
// - All in prisma.$transaction

// getReservationsForProduct(productId) — read-only, for UI
// getReservationsForWorkOrder(workOrderId) — read-only, for UI
```

**Step 3: Integrate into work order status transitions**

Modify `app/api/manufacturing/work-orders/[id]/route.ts`:

- At line ~586 (status transitions):
  - `PLANNED → IN_PROGRESS`: call `reserveMaterialsForWorkOrder(workOrderId, warehouseId)`
  - `IN_PROGRESS → ON_HOLD`: call `releaseReservation(workOrderId, 'ON_HOLD')`
  - `IN_PROGRESS → CANCELLED`: call `releaseReservation(workOrderId, 'CANCELLED')`
  - `ON_HOLD → IN_PROGRESS`: call `reserveMaterialsForWorkOrder(workOrderId, warehouseId)`
- At line ~504 (REPORT_PRODUCTION): call `consumeReservation(workOrderId, qtyProduced, warehouseId)` inside `executeProductionPosting`
- At line ~591 (COMPLETED): call `releaseReservation(workOrderId, 'PARTIAL_COMPLETE')` for any surplus

**Step 4: Run verify**

Run: `npx vitest run && npx tsc --noEmit`

**Step 5: Commit**

```bash
git commit -m "feat: add stock reservation system for work orders"
```

---

## Task 5: Product Manufacturing Usage Tab

**Files:**
- Create: `app/api/products/[id]/manufacturing-usage/route.ts`
- Create: `hooks/use-product-manufacturing.ts`
- Modify: `app/inventory/products/[id]/page.tsx:230` (add "Manufaktur" tab)
- Modify: `lib/query-keys.ts` (add manufacturingUsage key)

**Step 1: Add query key**

In `lib/query-keys.ts`, add under `products`:
```typescript
manufacturingUsage: (id: string) => [...["products"], id, "manufacturing"] as const,
```

**Step 2: Create API route**

Create `app/api/products/[id]/manufacturing-usage/route.ts`:

- `GET` handler with 3 parallel queries:
  1. **BOM Usage**: `ProductionBOMItem WHERE materialId = productId` + `BOMItem WHERE materialId = productId`, include BOM → product (output product)
  2. **Active Demand**: WorkOrders (PLANNED/IN_PROGRESS) whose BOM contains this material. Calculate requiredQty per WO.
  3. **On Order**: `PurchaseOrderItem WHERE productId` with active PO statuses, SUM(quantity - receivedQty)
- Also fetch `StockLevel` SUM(quantity) and SUM(reservedQty) for this product
- Compute supply summary: currentStock, reservedForProduction (from active WO demand), onOrder, netAvailable, status (CUKUP/SEGERA_PESAN/KURANG)
- Return `{ hasUsage: boolean, bomUsage[], activeDemand[], supply: {...} }`

**Step 3: Create hook**

Create `hooks/use-product-manufacturing.ts`:
```typescript
"use client"
import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useProductManufacturing(productId: string, enabled: boolean) {
    return useQuery({
        queryKey: queryKeys.products.manufacturingUsage(productId),
        queryFn: () => fetch(`/api/products/${productId}/manufacturing-usage`).then(r => r.json()).then(j => j.data),
        enabled,
    })
}
```

**Step 4: Add "Manufaktur" tab to product detail page**

Modify `app/inventory/products/[id]/page.tsx`:

- At line ~230 (tab bar), add 4th tab: `<TabsTrigger value="manufacturing">Manufaktur</TabsTrigger>` — only render if product is used as BOM material (check via a count query or lazy-load)
- Add `<TabsContent value="manufacturing">` with:
  - **Supply Summary Card** (neo-brutalist): Stok Saat Ini | Kebutuhan Produksi | Dalam Pesanan (PO) | Nett Tersedia + status badge (Cukup/Segera Pesan/Kurang)
  - **"Digunakan di BOM" table**: BOM Name | Output Product | Qty per Unit | Waste % | Status
  - **"Kebutuhan Produksi Aktif" table**: WO # | Output Product | Required Qty | Status | Due Date + total footer row
- All labels in Bahasa Indonesia

**Step 5: Run verify**

Run: `npx vitest run && npx tsc --noEmit`

**Step 6: Commit**

```bash
git commit -m "feat: add manufacturing usage tab on product detail page"
```

---

## Task 6: Material Cost Variance

**Files:**
- Create: `lib/material-variance.ts`
- Create: `__tests__/material-variance.test.ts`
- Create: `components/manufacturing/material-variance-table.tsx`
- Modify: `app/api/manufacturing/work-orders/[id]/route.ts` (GET — add variance to response)
- Modify: `app/manufacturing/orders/orders-client.tsx` (add variance section to WO detail)

**Step 1: Write variance calculation tests**

Create `__tests__/material-variance.test.ts`:

```typescript
import { describe, it, expect } from "vitest"
import { calculateMaterialVariance } from "@/lib/material-variance"

describe("calculateMaterialVariance", () => {
  const bomItems = [
    { materialId: "m1", materialCode: "KC-001", materialName: "Kain Cotton", unit: "meter",
      quantityPerUnit: 2, wastePct: 5, currentCostPrice: 50000 },
  ]

  it("detects BOROS when actual exceeds planned", () => {
    const transactions = [
      { productId: "m1", quantity: -230, unitCost: 50000, totalValue: 11500000 },
    ]
    const result = calculateMaterialVariance(
      { id: "wo1", number: "WO-001", plannedQty: 100, actualQty: 100 },
      bomItems, transactions
    )
    expect(result.lines[0].qtyVariance).toBe(20) // 230 actual - 210 planned
    expect(result.lines[0].status).toBe("BOROS")
  })

  it("detects HEMAT when actual is under planned", () => {
    const transactions = [
      { productId: "m1", quantity: -195, unitCost: 48000, totalValue: 9360000 },
    ]
    const result = calculateMaterialVariance(
      { id: "wo1", number: "WO-001", plannedQty: 100, actualQty: 100 },
      bomItems, transactions
    )
    expect(result.lines[0].status).toBe("HEMAT")
  })

  it("handles SESUAI within ±2%", () => {
    const transactions = [
      { productId: "m1", quantity: -211, unitCost: 50000, totalValue: 10550000 },
    ]
    const result = calculateMaterialVariance(
      { id: "wo1", number: "WO-001", plannedQty: 100, actualQty: 100 },
      bomItems, transactions
    )
    expect(result.lines[0].status).toBe("SESUAI")
  })

  it("calculates totals correctly", () => {
    const transactions = [
      { productId: "m1", quantity: -210, unitCost: 50000, totalValue: 10500000 },
    ]
    const result = calculateMaterialVariance(
      { id: "wo1", number: "WO-001", plannedQty: 100, actualQty: 100 },
      bomItems, transactions
    )
    expect(result.totalPlannedCost).toBe(210 * 50000)
    expect(result.totalActualCost).toBe(10500000)
    expect(result.totalCostVariance).toBe(0)
  })
})
```

**Step 2: Implement variance calculation**

Create `lib/material-variance.ts` — pure function, no DB:

```typescript
export function calculateMaterialVariance(workOrder, bomItems, transactions): MaterialVarianceResult
```

- For each BOM item: `plannedQty = Math.ceil(quantityPerUnit * wo.actualQty * (1 + wastePct/100))`
- actualQty = `SUM(ABS(tx.quantity))` grouped by productId
- plannedCost = plannedQty × costPrice
- actualCost = SUM(tx.totalValue)
- qtyVariance = actual - planned, costVariance = actual - planned
- Status: HEMAT (<-2%), SESUAI (±2%), BOROS (>+2%)

**Step 3: Run tests**

Run: `npx vitest run __tests__/material-variance.test.ts`
Expected: PASS

**Step 4: Add variance to WO detail API**

Modify `app/api/manufacturing/work-orders/[id]/route.ts` GET handler:
- Include product info (code, name, costPrice, unit) on PRODUCTION_OUT transactions
- Call `calculateMaterialVariance()` with BOM items + filtered transactions
- Add `materialVariance` field to response

**Step 5: Create variance display component**

Create `components/manufacturing/material-variance-table.tsx`:

- Table columns: Material | Satuan | Qty Rencana | Qty Aktual | Selisih Qty | Biaya Rencana | Biaya Aktual | Selisih Biaya | Status
- Summary footer row with totals
- Status badges: HEMAT (green), SESUAI (gray), BOROS (red)
- Empty state: "Belum ada konsumsi material"
- Partial WO info banner when actualQty < plannedQty
- Neo-brutalist style, Bahasa Indonesia labels

**Step 6: Wire into WO detail**

In `app/manufacturing/orders/orders-client.tsx`, add `MaterialVarianceTable` section in the WO detail panel (after production info, before action buttons):

- Show when WO has PRODUCTION_OUT transactions (status IN_PROGRESS or COMPLETED)
- Pass variance data from the WO detail API response

**Step 7: Run verify**

Run: `npx vitest run && npx tsc --noEmit`

**Step 8: Commit**

```bash
git commit -m "feat: add material cost variance tracking on work order detail"
```

---

## Execution Notes

- **Task 1 must complete first** (schema migration needed by Tasks 2-6)
- **Tasks 2, 3, 5, 6 can run in parallel** (different files, no conflicts)
- **Task 4 modifies the same WO route as Task 6** — run Task 4 before Task 6, or merge carefully
- All tasks share `lib/query-keys.ts` and `components/app-sidebar.tsx` — minor merge conflicts expected, resolve by keeping all additions
- Reference the design doc at `docs/plans/2026-03-08-cross-module-integration-design.md` for full data flow details
