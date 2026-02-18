# 0s Architecture Gaps — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining ~45% of the zero-second architecture by fixing client-side cache config, adding bundle optimization, replacing router.refresh() anti-pattern, and adding critical database indexes.

**Architecture:** Fix query-client config bugs + add keepPreviousData, add optimizePackageImports to next.config.ts, systematically replace router.refresh() with queryClient.invalidateQueries() across 39 files, and add @@index to high-traffic models missing them.

**Tech Stack:** TanStack Query v5, Next.js 16, Prisma 6, Tailwind CSS v4

---

## Task 1: Fix query-client.tsx bugs and add keepPreviousData

**Files:**
- Modify: `lib/query-client.tsx`

**Context:** The file has TWO bugs:
1. Line 11-12: Duplicate `staleTime` key — second one (5min) overwrites first (2min). The second should be `gcTime`.
2. Line 33: `const query [queryClient]` — syntax error, should be `const [queryClient]`.
3. Missing: `placeholderData` default for smoother pagination transitions.

**Step 1: Fix the bugs and add keepPreviousData default**

Replace the entire `makeQueryClient()` function:

```typescript
import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query"

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 2 * 60 * 1000,   // 2 minutes — revisits within this window are instant
                gcTime: 5 * 60 * 1000,       // 5 minutes — cache kept in memory
                retry: 1,
                refetchOnWindowFocus: false,  // ERP data doesn't change that fast
                placeholderData: keepPreviousData, // show old data while new loads (no flash)
            },
        },
    })
}
```

Fix the useState line:
```typescript
const [queryClient] = useState(getQueryClient)
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No new errors from query-client.tsx

**Step 3: Commit**

```bash
git add lib/query-client.tsx
git commit -m "fix: fix query-client bugs (duplicate staleTime, syntax) + add keepPreviousData default"
```

---

## Task 2: Add bundle optimization to next.config.ts

**Files:**
- Modify: `next.config.ts`

**Context:** No `optimizePackageImports` configured. Heavy icon/UI libraries ship entire modules to client.

**Step 1: Add experimental.optimizePackageImports**

Add to the nextConfig object:

```typescript
const nextConfig: NextConfig = {
  output: "standalone",

  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // Bundle optimization — tree-shake heavy libraries
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@tabler/icons-react",
      "@tanstack/react-table",
      "date-fns",
      "recharts",
      "framer-motion",
      "@radix-ui/react-icons",
    ],
  },

  outputFileTracingIncludes: {
    "/api/documents/purchase-order/[id]": ["./bin/**/*", "./templates/**/*"],
    "/api/documents/payroll/[period]": ["./bin/**/*", "./templates/**/*"],
    "/api/documents/payslip/[period]/[employeeId]": ["./bin/**/*", "./templates/**/*"],
  },
};
```

**Step 2: Verify dev server still starts**

Run: `npm run dev` — verify no crash in first 10 seconds, then kill.

**Step 3: Commit**

```bash
git add next.config.ts
git commit -m "perf: add optimizePackageImports for heavy icon/UI libraries"
```

---

## Task 3: Add critical database indexes to high-traffic models

**Files:**
- Modify: `prisma/schema.prisma`

**Context:** 48 models have NO @@index. Focus on the models hit by list pages and dashboard queries — the ones users navigate to constantly.

**Step 1: Add indexes to high-traffic models**

Add `@@index` declarations to these models (add BEFORE the closing `}` of each model):

```prisma
model Product {
  // ... existing fields ...
  @@index([status])
  @@index([categoryId])
  @@index([sku])
  @@index([updatedAt])
}

model Customer {
  // ... existing fields ...
  @@index([type])
  @@index([updatedAt])
}

model SalesOrder {
  // ... existing fields ...
  @@index([status])
  @@index([customerId])
  @@index([orderDate])
  @@index([updatedAt])
}

model SalesOrderItem {
  // ... existing fields ...
  @@index([salesOrderId])
  @@index([productId])
}

model PurchaseOrder {
  // ... existing fields ...
  @@index([status])
  @@index([supplierId])
  @@index([updatedAt])
}

model PurchaseOrderItem {
  // ... existing fields ...
  @@index([productId])
}

model PurchaseRequest {
  // ... existing fields ...
  @@index([status])
  @@index([updatedAt])
}

model Quotation {
  // ... existing fields ...
  @@index([status])
  @@index([customerId])
  @@index([updatedAt])
}

model Lead {
  // ... existing fields ...
  @@index([stage])
  @@index([updatedAt])
}

model Employee {
  // ... existing fields ...
  @@index([status])
  @@index([department])
}

model StockLevel {
  // ... existing fields ...
  @@index([productId])
  @@index([warehouseId])
  @@index([productId, warehouseId])
}

model Machine {
  // ... existing fields ...
  @@index([status])
}

model BillOfMaterials {
  // ... existing fields ...
  @@index([productId])
}

model Attendance {
  // ... existing fields ...
  @@index([employeeId])
  @@index([date])
  @@index([employeeId, date])
}

model GLAccount {
  // ... existing fields ...
  @@index([type])
  @@index([code])
}

model Payment {
  // ... existing fields ...
  @@index([invoiceId])
  @@index([status])
}

model QualityInspection {
  // ... existing fields ...
  @@index([workOrderId])
  @@index([status])
}

model Supplier {
  // ... existing fields ...
  @@index([updatedAt])
}

model Warehouse {
  // ... existing fields ...
  @@index([type])
}
```

**Step 2: Validate schema**

Run: `npx prisma validate`
Expected: "The schema is valid."

**Step 3: Generate migration**

Run: `npx prisma migrate dev --name add_performance_indexes`
Expected: Migration created and applied successfully.

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "perf: add @@index to 20 high-traffic models for query optimization"
```

---

## Task 4: Replace router.refresh() with queryClient.invalidateQueries() — Inventory module (8 files)

**Files:**
- Modify: `components/inventory/adjustment-form.tsx`
- Modify: `components/inventory/inventory-kanban-board.tsx`
- Modify: `components/inventory/inventory-products-tabs.tsx`
- Modify: `components/inventory/manual-movement-dialog.tsx`
- Modify: `components/inventory/product-create-dialog.tsx`
- Modify: `components/inventory/product-quick-view.tsx`
- Modify: `components/inventory/warehouse-edit-dialog.tsx`
- Modify: `components/inventory/warehouse-form-dialog.tsx`
- Modify: `components/inventory/warehouse-staff-dialog.tsx`

**Context:** Each file calls `router.refresh()` after a mutation. Replace with `queryClient.invalidateQueries()` using the appropriate query key from `lib/query-keys.ts`.

**Step 1: Read each file, find router.refresh() calls**

For each file, identify:
- What data is being mutated (product create/edit, stock adjustment, warehouse CRUD, etc.)
- Which queryKey corresponds to that data

**Step 2: Replace pattern in each file**

The replacement pattern for each file:

1. Add import: `import { useQueryClient } from "@tanstack/react-query"`
2. Add import: `import { queryKeys } from "@/lib/query-keys"`
3. Add hook: `const queryClient = useQueryClient()` (inside the component)
4. Replace: `router.refresh()` → `queryClient.invalidateQueries({ queryKey: queryKeys.<module>.all })`
5. Remove `useRouter` import/hook if router is ONLY used for refresh (keep if used for push/replace)

**Mapping:**
- `adjustment-form.tsx` → `queryKeys.products.all` + `queryKeys.inventoryDashboard.all`
- `inventory-kanban-board.tsx` → `queryKeys.products.all`
- `inventory-products-tabs.tsx` → `queryKeys.products.all`
- `manual-movement-dialog.tsx` → `queryKeys.products.all` + `queryKeys.inventoryDashboard.all`
- `product-create-dialog.tsx` → `queryKeys.products.all`
- `product-quick-view.tsx` → `queryKeys.products.all`
- `warehouse-edit-dialog.tsx` → `queryKeys.warehouses.all`
- `warehouse-form-dialog.tsx` → `queryKeys.warehouses.all`
- `warehouse-staff-dialog.tsx` → `queryKeys.warehouses.all`

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "inventory" | head -20`
Expected: No new errors from modified files.

**Step 4: Commit**

```bash
git add components/inventory/
git commit -m "perf: replace router.refresh() with queryClient.invalidateQueries() in inventory"
```

---

## Task 5: Replace router.refresh() — Procurement module (10 files)

**Files:**
- Modify: `components/procurement/create-grn-dialog.tsx`
- Modify: `components/procurement/create-request-form.tsx`
- Modify: `components/procurement/grn-details-sheet.tsx`
- Modify: `components/procurement/inline-approval-list.tsx`
- Modify: `components/procurement/new-po-dialog.tsx`
- Modify: `components/procurement/new-vendor-dialog.tsx`
- Modify: `components/procurement/po-details-sheet.tsx`
- Modify: `components/procurement/po-finalize-dialog.tsx`
- Modify: `components/procurement/request-list.tsx`
- Modify: `components/procurement/vendor-list.tsx`
- Modify: `app/procurement/orders/orders-view.tsx`

**Step 1: Same pattern as Task 4**

**Mapping:**
- `create-grn-dialog.tsx` → `queryKeys.receiving?.all` or `["receiving", "list"]`
- `create-request-form.tsx` → `queryKeys.purchaseRequests.all`
- `grn-details-sheet.tsx` → `["receiving", "list"]`
- `inline-approval-list.tsx` → `queryKeys.purchaseOrders.all` + `queryKeys.approvals.all`
- `new-po-dialog.tsx` → `queryKeys.purchaseOrders.all`
- `new-vendor-dialog.tsx` → `queryKeys.vendors.all`
- `po-details-sheet.tsx` → `queryKeys.purchaseOrders.all`
- `po-finalize-dialog.tsx` → `queryKeys.purchaseOrders.all`
- `request-list.tsx` → `queryKeys.purchaseRequests.all`
- `vendor-list.tsx` → `queryKeys.vendors.all`
- `orders-view.tsx` → `queryKeys.purchaseOrders.all`

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "procurement" | head -20`

**Step 3: Commit**

```bash
git add components/procurement/ app/procurement/
git commit -m "perf: replace router.refresh() with queryClient.invalidateQueries() in procurement"
```

---

## Task 6: Replace router.refresh() — Finance module (5 files)

**Files:**
- Modify: `components/finance/accounting-module-actions.tsx`
- Modify: `components/finance/create-invoice-dialog.tsx`
- Modify: `app/finance/payments/payments-view.tsx`

**Mapping:**
- `accounting-module-actions.tsx` → `queryKeys.financeDashboard.all`
- `create-invoice-dialog.tsx` → `queryKeys.invoices.all`
- `payments-view.tsx` → `queryKeys.invoices.all` + `queryKeys.vendorPayments.all`

**Step 1-3: Same pattern as Tasks 4-5**

**Step 4: Commit**

```bash
git add components/finance/ app/finance/
git commit -m "perf: replace router.refresh() with queryClient.invalidateQueries() in finance"
```

---

## Task 7: Replace router.refresh() — Sales, Dashboard, Cutting, Subcontract, HCM, Documents (remaining ~15 files)

**Files:**
- Modify: `components/sales/pricelists/price-book-gallery.tsx` → `queryKeys.priceLists.all`
- Modify: `components/sales/quick-order-dialog.tsx` → `queryKeys.salesOrders.all`
- Modify: `components/dashboard/ceo-action-center.tsx` → `queryKeys.executiveDashboard.all`
- Modify: `components/dashboard/pengadaan-card.tsx` → `queryKeys.procurementDashboard.all`
- Modify: `components/cutting/cut-plan-status-actions.tsx` → `queryKeys.cutPlans.all`
- Modify: `components/subcontract/subcontractor-rates-table.tsx` → `queryKeys.subcontractRegistry.all`
- Modify: `components/hcm/shift-calendar.tsx` → `queryKeys.hcmShifts.all`
- Modify: `components/manager/task-board.tsx` → `queryKeys.managerDashboard.all`
- Modify: `components/documents/document-system-control-center.tsx` → `queryKeys.documents.all`
- Modify: `components/workflow/workflow-import-dialog.tsx` → relevant key
- Modify: `app/costing/sheets/[id]/sheet-detail-client.tsx` → `queryKeys.costSheets.all`
- Modify: `app/dashboard/approvals/approvals-view.tsx` → `queryKeys.approvals.all`
- Modify: `app/hcm/attendance/attendance-client.tsx` → `queryKeys.hcmAttendance.all`
- Modify: `app/staff/staff-tasks-client.tsx` → `queryKeys.staffTasks.all`

**Step 1-3: Same pattern as previous tasks**

**NOTE:** Do NOT touch `app/login/page.tsx` or `lib/auth-context.tsx` — router.refresh() is correct there for auth state changes.

**Step 4: Commit**

```bash
git add components/ app/
git commit -m "perf: replace router.refresh() with queryClient.invalidateQueries() across remaining modules"
```

---

## Task 8: Add lean select to remaining API routes without it

**Files:**
- Modify: `app/api/inventory/dashboard/route.ts`
- Modify: `app/api/manufacturing/machines/route.ts`
- Modify: `app/api/manufacturing/machines/[id]/route.ts`
- Modify: `app/api/sales/quotations/[id]/route.ts`
- Modify: `app/api/dashboard/route.ts`

**Context:** 5 data-serving API routes (excluding document generation, xendit, and system routes which are fine without select) still return full Prisma records.

**Step 1: Read each route, identify which fields the consuming hook/page actually uses**

Cross-reference with the corresponding hook to see which fields are accessed.

**Step 2: Add `select:` to each findMany/findUnique call**

Only include fields that the frontend actually uses. Keep relations that are displayed.

**Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | grep -i "api" | head -20`

**Step 4: Commit**

```bash
git add app/api/
git commit -m "perf: add Prisma select to remaining API routes for lean payloads"
```

---

## Summary — Expected Impact

| Change | Before | After |
|--------|--------|-------|
| Query client bugs | Duplicate staleTime, syntax error | Fixed, gcTime correct |
| Pagination UX | Skeleton flash on every page change | Old data shown while new loads |
| Bundle size | Full icon libraries shipped | Tree-shaken imports |
| DB queries | Full table scans on 48 models | Indexed lookups on 20 key models |
| Mutation refresh | 39 files do full page reload | Cache-targeted invalidation |
| API payloads | 13 routes return everything | 5 more routes use select |

**Total: 8 tasks, ~50 files modified**
