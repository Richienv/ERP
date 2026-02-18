# SAP-Style Cache: Long TTL + Mutation Invalidation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate all skeleton flashes on page navigation by caching aggressively (30min/60min) and invalidating on every write operation.

**Architecture:** SAP pattern — cache master data for long TTL, bust cache immediately on mutations. Two complementary fixes: extend TTL so reads never show skeletons, add `invalidateQueries()` to every mutation so writes are reflected instantly.

**Tech Stack:** TanStack Query v5, Next.js App Router, existing queryKeys factory

---

### Task 1: Extend TTL + Fix Query Key Mismatches

**Files:**
- Modify: `lib/query-client.tsx`
- Modify: `hooks/use-procurement-dashboard.ts`
- Modify: `hooks/use-inventory-dashboard.ts`

**Step 1:** In `lib/query-client.tsx`, change:
- `staleTime: 2 * 60 * 1000` → `staleTime: 30 * 60 * 1000`
- `gcTime: 5 * 60 * 1000` → `gcTime: 60 * 60 * 1000`

**Step 2:** In `hooks/use-procurement-dashboard.ts`, fix query key to match prefetch map. Remove the `searchParams || ""` appended to the key, or change the prefetch map to include it.

**Step 3:** In `hooks/use-inventory-dashboard.ts`, fix response shape to match prefetch. The prefetch stores `p.data` (unwrapped), the hook stores the full envelope `res.json()`. Align them.

**Step 4:** Run `npx tsc --noEmit` — verify no errors from our changes.

**Step 5:** Commit: `fix: extend cache TTL to 30min and fix query key mismatches`

---

### Task 2: Add Invalidation to Subcontract Components (6 files)

**Files:**
- Modify: `components/subcontract/subcontract-order-detail.tsx` — add invalidation after `updateSubcontractOrderStatus`, `updateItemReturnQty` → `queryKeys.subcontractOrders.all`, `queryKeys.subcontractDashboard.all`
- Modify: `components/subcontract/subcontract-order-form.tsx` — add invalidation after `createSubcontractOrder` → `queryKeys.subcontractOrders.all`, `queryKeys.subcontractDashboard.all`
- Modify: `components/subcontract/create-subcontractor-dialog.tsx` — add invalidation after `createSubcontractor` → `queryKeys.subcontractRegistry.all`
- Modify: `components/subcontract/edit-subcontractor-dialog.tsx` — add invalidation after `updateSubcontractor` → `queryKeys.subcontractRegistry.all`
- Modify: `components/subcontract/rate-management-dialog.tsx` — add invalidation after `upsertSubcontractorRate`, `deleteSubcontractorRate` → `queryKeys.subcontractRegistry.all`
- Modify: `components/subcontract/shipment-tracking.tsx` — add invalidation after `recordShipment` → `queryKeys.subcontractOrders.all`

**Pattern for each file:**
1. Add `import { useQueryClient } from "@tanstack/react-query"` if not present
2. Add `import { queryKeys } from "@/lib/query-keys"` if not present
3. Add `const queryClient = useQueryClient()` in component body if not present
4. After the server action success (toast.success or similar), add: `queryClient.invalidateQueries({ queryKey: queryKeys.<module>.all })`

**Step 5:** Run `npx tsc --noEmit` — verify no errors.

**Step 6:** Commit: `fix: add cache invalidation to subcontract mutations`

---

### Task 3: Add Invalidation to Sales, Inventory, Manufacturing Components (5 files)

**Files:**
- Modify: `components/sales/quotation-kanban.tsx` — after `updateQuotationStatus` → `queryKeys.quotations.all`; after `convertQuotationToSalesOrder` → `queryKeys.quotations.all`, `queryKeys.salesOrders.all`, `queryKeys.salesDashboard.all`
- Modify: `components/inventory/goods-receipt-dialog.tsx` — after `receiveGoodsFromPO` → `queryKeys.purchaseOrders.all`, `queryKeys.inventoryDashboard.all`, `queryKeys.products.all`, `queryKeys.procurementDashboard.all`
- Modify: `components/inventory/create-transfer-dialog.tsx` — after `createStockTransfer` → `queryKeys.inventoryDashboard.all`, `queryKeys.products.all`
- Modify: `components/manufacturing/fabric-inspection-dialog.tsx` — after `createFabricInspection` → `queryKeys.mfgQuality.all`
- Modify: `components/hcm/leave-requests.tsx` — after `approveLeaveRequest`/`rejectLeaveRequest` → `queryKeys.hcmAttendance.all`

**Same pattern as Task 2.**

**Step 5:** Run `npx tsc --noEmit` — verify no errors.

**Step 6:** Commit: `fix: add cache invalidation to sales, inventory, manufacturing mutations`

---

### Task 4: Add Invalidation to Costing, Cutting, Pricelist Components (5 files)

**Files:**
- Modify: `components/costing/cost-sheet-form.tsx` — after `createCostSheet` → `queryKeys.costSheets.all`, `queryKeys.costingDashboard.all`
- Modify: `components/cutting/cut-plan-form.tsx` — after `createCutPlan` → `queryKeys.cutPlans.all`, `queryKeys.cuttingDashboard.all`
- Modify: `components/cutting/layer-builder.tsx` — after `addCutPlanLayer`/`removeCutPlanLayer` → `queryKeys.cutPlans.all`
- Modify: `components/cutting/output-table.tsx` — after `setCutPlanOutput` → `queryKeys.cutPlans.all`
- Modify: `app/sales/pricelists/new/page.tsx` — after `createPriceList` → `queryKeys.priceLists.all`

**Same pattern as Task 2.**

**Step 5:** Run `npx tsc --noEmit` — verify no errors.

**Step 6:** Commit: `fix: add cache invalidation to costing, cutting, pricelist mutations`

---

### Task 5: Remove Dead revalidatePath/revalidateTag from Server Actions

**Files (23 server action files):**
- `app/actions/hcm.ts`
- `app/actions/inventory.ts`
- `app/actions/purchase-order.ts`
- `app/actions/vendor.ts`
- `app/actions/documents-system.ts`
- `app/actions/system-roles.ts`
- `lib/actions/costing.ts`
- `lib/actions/cutting.ts`
- `lib/actions/dashboard-textile.ts`
- `lib/actions/fabric-inspection.ts`
- `lib/actions/fabric-rolls.ts`
- `lib/actions/finance-invoices.ts`
- `lib/actions/finance-reconciliation.ts`
- `lib/actions/grn.ts`
- `lib/actions/hcm-onboarding.ts`
- `lib/actions/hcm-shifts.ts`
- `lib/actions/manufacturing-garment.ts`
- `lib/actions/procurement-reorder.ts`
- `lib/actions/procurement.ts`
- `lib/actions/sales.ts`
- `lib/actions/stock-transfers.ts`
- `lib/actions/subcontract.ts`
- `lib/actions/tasks.ts`

**For each file:**
1. Remove all `revalidatePath(...)` calls
2. Remove all `revalidateTag(...)` calls
3. Remove the `import { revalidatePath } from "next/cache"` and `import { revalidateTag } from "next/cache"` if no longer used
4. Keep everything else unchanged

**Why:** All pages are `"use client"` with TanStack Query. `revalidatePath` only busts Next.js RSC server cache which is not used. Client-side invalidation via `queryClient.invalidateQueries()` is the correct mechanism.

**Step 5:** Run `npx tsc --noEmit` — verify no errors.

**Step 6:** Commit: `refactor: remove dead revalidatePath calls (client-side cache handles invalidation)`

---

### Task 6: Convert Old useEffect+fetch Pages to TanStack Query

**Files:**
- Modify: `app/hcm/page.tsx` — replace useEffect+fetch+setState with a TanStack Query hook
- Modify: `app/accountant/coa/page.tsx` — replace useEffect+fetch+setState with a TanStack Query hook
- Modify: `app/inventory/audit/page.tsx` — replace useEffect+fetch+setState with a TanStack Query hook
- Modify: `hooks/use-products.ts` — rewrite to use useQuery + useMutation with proper invalidation

**For each page:**
1. Create or use existing hook with `useQuery`
2. Replace `useState(loading)` + `useEffect` with hook's `isLoading`
3. Add to `routePrefetchMap` in `hooks/use-nav-prefetch.ts` if not already there
4. Add queryKey to `lib/query-keys.ts` if not already there

**Step 5:** Run `npx tsc --noEmit` — verify no errors.

**Step 6:** Run `npx vitest run` — verify tests still pass.

**Step 7:** Commit: `refactor: convert remaining useEffect pages to TanStack Query`
