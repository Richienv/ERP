# QA — Dashboard Pengadaan

## 1. Page Info

| Field | Value |
|-------|-------|
| **Name** | Dashboard Pengadaan |
| **Route** | `/procurement` |
| **File** | `app/procurement/page.tsx` |
| **Breadcrumb** | Pengadaan → Dashboard |
| **Type** | Client component (`"use client"`) |
| **Accent** | Violet (`border-l-violet-400`) |

---

## 2. Purpose

Command center for the entire procurement/supply-chain module — shows spend KPIs, pending approvals, PO/PR/GRN registries with pagination and filtering, recent activity, and quick-action buttons for creating requests and direct purchases.

---

## 3. UI Elements

### 3.1 Page Header

| Element | Detail |
|---------|--------|
| Icon | `Package` (violet, h-5 w-5) |
| Title | `DASHBOARD PENGADAAN` (h1, uppercase, font-black) |
| Subtitle | "Command center rantai pasok & manajemen vendor" (text-xs, zinc-400) |
| Left border | 6px violet accent (`border-l-[6px] border-l-violet-400`) |

### 3.2 Header Buttons (top-right)

| # | Label | Style | Icon | Target |
|---|-------|-------|------|--------|
| 1 | REQUESTS | Outline, border-2 zinc-300 | `FileText` | Link → `/procurement/requests` |
| 2 | VENDORS | Outline, border-2 zinc-300 | `Users` | Link → `/procurement/vendors` |
| 3 | PEMBELIAN LANGSUNG | Emerald bg, border-emerald-600, NB shadow | `ShoppingCart` | Opens `DirectPurchaseDialog` |
| 4 | BUAT REQUEST | Violet bg, border-violet-600, NB shadow | `Plus` | Link → `/procurement/requests/new` |

- Button 3 (Pembelian Langsung) lazy-loads data on hover via `useDirectPurchaseOptions(dpHovered)`.

### 3.3 KPI Cards (4 cards, grid 2×2 on mobile → 4×1 on desktop)

| # | Label | Icon | Data | Formatting |
|---|-------|------|------|------------|
| 1 | SPEND (BULAN) | `DollarSign` (emerald) | `spend.current` | `formatIDR()` — shows growth % vs previous month with up/down arrow. Up=red (spend increased), Down=emerald (spend decreased). |
| 2 | VENDOR HEALTH | `Activity` (blue) | `vendorHealth.rating` | Rating (X.X) + star icon. Subtext: `vendorHealth.onTime`% On-Time Delivery. |
| 3 | URGENT RESTOCK | `AlertCircle` (red/zinc) | `urgentNeeds` | Count + "Item". Subtext: "Di bawah stok minimum". Card bg turns `bg-red-50` when count > 0. |
| 4 | INCOMING | `Truck` (indigo) | `incomingCount` | Count + "Order". Subtext: "Open / partial delivery". |

### 3.4 Approval Center

| Element | Detail |
|---------|--------|
| Section header bg | `bg-amber-50`, left accent `border-l-amber-400` |
| Icon | `CheckSquare` (amber) |
| Title | "MENUNGGU PERSETUJUAN" |
| Badge | Amber pill showing `needsApproval` count |
| Action link | "Lihat Semua" button → `/procurement/requests` |
| Content | `InlineApprovalList` component (see section 3.5) |
| Empty state | CheckCircle icon + "Tidak ada yang perlu disetujui" |

### 3.5 InlineApprovalList (embedded component)

Each pending item row shows:

| Element | Detail |
|---------|--------|
| Type badge | `PO` (blue) or `PR` (purple) — 9px uppercase |
| Number | Mono font, e.g. `PO-202603-0012` |
| Priority badge | Shown only if not NORMAL — red badge (e.g. HIGH) |
| Label | Vendor name (PO) or requester name (PR) |
| Item count | "X item" |
| Department | Shown for PR items (not PO) |
| Amount | `formatIDR()` — only shown if > 0 (POs have amounts, PRs don't) |
| Approve button | Green border, `CheckCircle` icon, 8×8px |
| Reject button | Red border, `XCircle` icon, 8×8px |
| Detail button | Zinc border, `Eye` icon, 8×8px |

**Rows**: alternating bg (`bg-zinc-50/50` on odd rows)

### 3.6 Registry Tables (3 tables, side-by-side on XL → stacked on smaller)

Each registry table (PO, PR, GRN) has identical structure:

| Element | Detail |
|---------|--------|
| Header | Violet bg, left accent, icon + title |
| Summary chips | Status count badges (e.g., "Draft: 3", "Pending: 5") |
| Filter pills | Clickable status filters (manipulate URL search params) |
| Item rows | Number (mono font) + subtitle (vendor/requester/warehouse) + status badge |
| Empty state | "Tidak ada data ditemukan" (centered, uppercase) |
| Pagination footer | "X total" label + prev/next buttons with page indicator (e.g. "2/5") |

**Registry: Pesanan Pembelian (PO)**

| Column | Data |
|--------|------|
| Number | `po.number` (mono font) |
| Subtitle | `po.supplier` (vendor name) |
| Status badge | Color-coded dot + label |
| Summary chips | Draft, Pending, Approved, Active |
| Filters | Semua, Pending, Approved, Ordered, Received |

**Registry: Permintaan Pembelian (PR)**

| Column | Data |
|--------|------|
| Number | `pr.number` (mono font) |
| Subtitle | `pr.requester` (employee name) |
| Status badge | Color-coded dot + label |
| Summary chips | Draft, Pending, Approved, PO Created |
| Filters | Semua, Pending, Approved, PO Created, Draft |

**Registry: Penerimaan (Receiving)**

| Column | Data |
|--------|------|
| Number | `grn.number` (mono font) |
| Subtitle | `grn.poNumber • grn.warehouse` |
| Status badge | Color-coded dot + label |
| Summary chips | Draft, Inspecting, Partial, Accepted |
| Filters | Semua, Draft, Inspecting, Partial, Accepted |

### 3.7 Recent Activity

| Element | Detail |
|---------|--------|
| Section header | Violet bg, `Clock` icon, "AKTIVITAS TERBARU" |
| Rows | Supplier name (bold), date (Indonesian locale `id-ID`), status badge |
| Empty state | "Belum ada aktivitas" (centered, uppercase) |
| Data source | `recentActivity` = raw PO records from `recentPOs` (same as PO registry data) |

### 3.8 Status Badge System

17 statuses mapped by `statusLabel()`:

| Status | Label | Dot Color | Badge Colors |
|--------|-------|-----------|-------------|
| PO_DRAFT / DRAFT | Draft | zinc-400 | bg-zinc-100, text-zinc-700 |
| PENDING / PENDING_APPROVAL | Pending | amber-500 | bg-amber-50, text-amber-700 |
| APPROVED | Approved | emerald-500 | bg-emerald-50, text-emerald-700 |
| PO_CREATED / ORDERED / VENDOR_CONFIRMED | PO Created / Ordered / Confirmed | blue-500 | bg-blue-50, text-blue-700 |
| SHIPPED | Shipped | indigo-500 | bg-indigo-50, text-indigo-700 |
| PARTIAL_RECEIVED / PARTIAL_ACCEPTED / INSPECTING | Partial / Inspecting | amber-500 | bg-amber-50, text-amber-700 |
| RECEIVED / ACCEPTED | Received / Accepted | emerald-500 | bg-emerald-50, text-emerald-700 |
| COMPLETED | Completed | emerald-600 | bg-emerald-50, text-emerald-700 |
| REJECTED | Rejected | red-500 | bg-red-50, text-red-700 |
| CANCELLED | Cancelled | zinc-400 | bg-zinc-100, text-zinc-500 |

Unknown statuses fall back to zinc styling with the raw status string as label.

---

## 4. User Actions

### 4.1 Navigation Actions

| # | Action | Trigger | Target |
|---|--------|---------|--------|
| 1 | Go to Requests list | Click "REQUESTS" button | `/procurement/requests` |
| 2 | Go to Vendors list | Click "VENDORS" button | `/procurement/vendors` |
| 3 | Go to Create Request | Click "BUAT REQUEST" button | `/procurement/requests/new` |
| 4 | Go to all approvals | Click "Lihat Semua" in approval center | `/procurement/requests` |

### 4.2 Direct Purchase (Dialog)

| Step | Behavior |
|------|----------|
| **Trigger** | Click "PEMBELIAN LANGSUNG" green button |
| **Pre-load** | Data fetches on hover (`onMouseEnter` → `setDpHovered(true)`) |
| **Dialog fields** | Vendor (select, required), Gudang Tujuan (select, required), Items table, Notes (optional) |
| **Items table** | Produk (select), Qty (number input, min=1), Harga Satuan (number, min=0), Subtotal (calculated) |
| **Add item** | "TAMBAH" button adds row |
| **Remove item** | Trash icon per row (disabled if only 1 row) |
| **Auto-fill** | Selecting a product pre-fills `unitPrice` from product catalog price |
| **Totals** | Subtotal, PPN 11%, TOTAL shown at bottom |
| **Success** | Toast with PO/GRN/Bill numbers. Dialog closes. Caches invalidated (10+ query keys). |
| **Failure** | Toast error message. Dialog stays open. |
| **What gets created** | PO (COMPLETED) + GRN (ACCEPTED) + Bill (DRAFT) + inventory update + GL posting |

### 4.3 Inline Approval Actions

| # | Action | Trigger | Success | Failure |
|---|--------|---------|---------|---------|
| 1 | **Approve PO** | Click green ✓ on PO item | Toast "PO [number] disetujui". Item removed from list (optimistic). Cache invalidated. | Toast "Gagal menyetujui" or "Error saat menyetujui PO". |
| 2 | **Approve PR** (+ auto-create PO) | Click green ✓ on PR item | Toast "PR [number] disetujui & [N] PO dibuat". Item removed. Cache invalidated (incl. finance). | Toast error. |
| 3 | **Reject PO/PR** | Click red ✗ → opens reject dialog | Requires reason (textarea). Submit → toast "[type] [number] ditolak". Item removed. | Toast if empty reason: "Berikan alasan penolakan". |
| 4 | **View detail** | Click eye icon | Opens detail dialog showing vendor/requester, amount, department, item list. Can approve/reject from detail view. | — |

### 4.4 Reject Dialog

| Field | Detail |
|-------|--------|
| Title | "Tolak [PO/PR] [number]" |
| Description | "Berikan alasan penolakan." |
| Info box | Shows label, item count, amount |
| Textarea | "Alasan Penolakan *" — required, placeholder "Tulis alasan penolakan..." |
| Cancel | "Batal" button |
| Submit | "Konfirmasi Tolak" (red, disabled until reason is non-empty) |
| Loading | Spinner replaces XCircle icon during processing |

### 4.5 Detail Dialog

| Field | Detail |
|-------|--------|
| Title | "Detail [PO/PR] [number]" |
| Subtitle | "Pesanan Pembelian" or "Permintaan Pembelian" |
| Info grid | Vendor/Pemohon, Total (if >0), Departemen (if present) |
| Items list | Scrollable (max-h-48), shows product name, code, quantity (pcs) |
| Approve button | Green, full width ("Approve") — closes detail & approves |
| Reject button | Red outline, full width ("Reject") — closes detail & opens reject dialog |

### 4.6 Registry Filtering & Pagination

| Action | Mechanism |
|--------|-----------|
| **Filter by status** | Clicking a filter pill updates URL search params (e.g. `?po_status=APPROVED&po_page=1`). This triggers a refetch via `useProcurementDashboard(searchParams)`. |
| **Next page** | Click `ChevronRight` button → updates `po_page`/`pr_page`/`grn_page` param |
| **Previous page** | Click `ChevronLeft` button → updates page param (min 1) |
| **Disabled states** | Prev disabled on page 1; Next disabled on last page (opacity-40 + pointer-events-none) |

---

## 5. Form Validations

### 5.1 Direct Purchase Dialog

| Field | Required | Rules | Error Message |
|-------|----------|-------|---------------|
| Vendor | Yes | Must select from dropdown | Toast: "Pilih vendor terlebih dahulu" |
| Gudang Tujuan | Yes | Must select from dropdown | Toast: "Pilih gudang tujuan" |
| Items | Min 1 valid | Each item needs productId + quantity > 0 + unitPrice > 0 | Toast: "Tambahkan minimal 1 item dengan produk, kuantitas, dan harga" |
| Quantity | — | `min={1}`, parsed with `parseInt`, defaults to 0 if NaN | No inline error shown |
| Unit Price | — | `min={0}`, parsed with `parseFloat`, defaults to 0 if NaN | No inline error shown |
| Notes | No | Free text, optional | — |

**Submit button disabled when**: `saving` is true, or `supplierId` is empty, or `warehouseId` is empty, or all items have no `productId`.

### 5.2 Reject Reason

| Field | Required | Rules | Error Message |
|-------|----------|-------|---------------|
| Alasan Penolakan | Yes | Must be non-empty after `.trim()` | Toast: "Berikan alasan penolakan" |

---

## 6. API Calls

### 6.1 Dashboard Data

| Field | Value |
|-------|-------|
| **Hook** | `useProcurementDashboard(searchParams)` |
| **Library** | TanStack Query (`useQuery`) |
| **Method** | `GET` |
| **URL** | `/api/procurement/dashboard?{searchParams}` |
| **Query params** | `po_status`, `po_page`, `po_size`, `pr_status`, `pr_page`, `pr_size`, `grn_status`, `grn_page`, `grn_size` |
| **Query key** | `[...queryKeys.procurementDashboard.list(), searchParams]` |
| **Response shape** | See section 6.1.1 |
| **Loading state** | Full-page `TablePageSkeleton` (violet accent) |
| **Error handling** | API returns fallback zeroed object on server error (never throws HTTP error) |

#### 6.1.1 Response Shape

```typescript
{
  spend: { current: number, growth: number },
  needsApproval: number,
  urgentNeeds: number,
  vendorHealth: { rating: number, onTime: number },
  incomingCount: number,
  recentActivity: PurchaseOrder[],
  purchaseOrders: {
    summary: { draft, pendingApproval, approved, inProgress, received, completed, rejected, cancelled },
    recent: Array<{ id, number, status, supplier, total, date }>
  },
  purchaseRequests: {
    summary: { draft, pending, approved, poCreated, rejected, cancelled },
    recent: Array<{ id, number, status, requester, itemCount, priority, date }>
  },
  receiving: {
    summary: { draft, inspecting, partialAccepted, accepted, rejected },
    recent: Array<{ id, number, status, poNumber, warehouse, date }>
  },
  registryMeta: {
    purchaseOrders: { page, pageSize, total, totalPages },
    purchaseRequests: { page, pageSize, total, totalPages },
    receiving: { page, pageSize, total, totalPages }
  },
  pendingItemsForApproval: PendingItem[]
}
```

### 6.2 Direct Purchase Options (lazy-loaded)

| Query | Method | URL | Trigger |
|-------|--------|-----|---------|
| Vendors | Server action | `getVendors()` | Mouse hover on Direct Purchase button |
| Products | `GET` | `/api/products` | Mouse hover on Direct Purchase button |
| Warehouses | Server action | `getWarehousesForGRN()` | Mouse hover on Direct Purchase button |

All 3 use TanStack Query with `enabled: dpHovered`, `staleTime: 2min`.

### 6.3 Approval Server Actions

| Action | Server Action | File |
|--------|---------------|------|
| Approve PO | `approvePurchaseOrder(id)` | `lib/actions/procurement.ts` |
| Approve PR + create PO | `approveAndCreatePOFromPR(id)` | `lib/actions/procurement.ts` |
| Reject PO | `rejectPurchaseOrder(id, reason)` | `lib/actions/procurement.ts` |
| Reject PR | `rejectPurchaseRequest(id, reason)` | `lib/actions/procurement.ts` |
| Create Direct Purchase | `createDirectPurchase(input)` | `lib/actions/procurement.ts` |

### 6.4 Cache Invalidation (post-approval/rejection/direct-purchase)

Invalidated query keys after mutations:
- `purchaseOrders.all`
- `approvals.all`
- `purchaseRequests.all`
- `procurementDashboard.all`
- `bills.all`
- `financeDashboard.all`
- `vendorPayments.all`
- (Direct purchase also): `receiving.all`, `invoices.all`, `products.all`, `inventoryDashboard.all`, `stockMovements.all`, `journal.all`

---

## 7. State & Dependencies

### 7.1 Data Dependencies

| Dependency | Source | Required |
|------------|--------|----------|
| Dashboard data | `GET /api/procurement/dashboard` | Yes — page shows skeleton until loaded |
| Vendors list | `getVendors()` server action | Only if Direct Purchase hovered |
| Products list | `GET /api/products` | Only if Direct Purchase hovered |
| Warehouses list | `getWarehousesForGRN()` server action | Only if Direct Purchase hovered |

### 7.2 Component Dependencies

| Component | File | Purpose |
|-----------|------|---------|
| `ProcurementPerformanceProvider` | `components/procurement/procurement-performance-provider.tsx` | Wraps page; prefetches related data after 500ms delay |
| `InlineApprovalList` | `components/procurement/inline-approval-list.tsx` | Renders pending PO/PR approval items |
| `DirectPurchaseDialog` | `components/procurement/direct-purchase-dialog.tsx` | Full dialog for one-step purchasing |
| `TablePageSkeleton` | `components/ui/page-skeleton.tsx` | Loading state |
| `ErrorFallback` | `components/ui/error-fallback.tsx` | Error boundary (via `error.tsx`) |

### 7.3 Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useProcurementDashboard` | `hooks/use-procurement-dashboard.ts` | Fetches dashboard API |
| `useDirectPurchaseOptions` | `hooks/use-direct-purchase-options.ts` | Lazy-loads vendor/product/warehouse data |

### 7.4 URL State

Search params drive registry filtering and pagination:

```
/procurement?po_status=APPROVED&po_page=2&pr_status=PENDING&pr_page=1&grn_page=1
```

All params are optional. `buildHref()` merges new params with existing ones.

---

## 8. Edge Cases & States

### 8.1 Loading State

- **Full page**: `TablePageSkeleton` with `bg-violet-400` accent shown while `isLoading || !data`.
- **Direct Purchase dialog**: No loading skeleton inside dialog — data loaded via hover before opening.
- **Approval actions**: Individual buttons show `Loader2` spinner; disabled during processing.

### 8.2 Empty States

| Area | Empty State Text | Visual |
|------|------------------|--------|
| Approval center | "Tidak ada yang perlu disetujui" | CheckCircle icon (emerald) + text |
| Registry table (any) | "Tidak ada data ditemukan" | Centered uppercase text |
| Recent activity | "Belum ada aktivitas" | Centered uppercase text |
| Direct Purchase vendors/products/warehouses | Empty select dropdown, no placeholder | — |

### 8.3 Error State

- **API error**: The API endpoint (`/api/procurement/dashboard`) catches all errors and returns a zeroed fallback object — the page will render with all zeros/empty arrays, not crash.
- **Error boundary**: `app/procurement/error.tsx` wraps with `ErrorFallback` (module name "Pengadaan") for unhandled React errors. Provides a "reset" button to retry.
- **Server action errors**: Toast notifications for individual action failures (approve/reject/direct purchase).

### 8.4 Permission / Role-Based Visibility

- **Page access**: All users with procurement module access can view the dashboard.
- **Approval actions**: Server-side role checks:
  - PO approval: requires `ROLE_CEO`, `ROLE_DIRECTOR`, `ROLE_ADMIN`, or `ROLE_MANAGER`
  - PR approval: requires `ROLE_MANAGER`, `ROLE_CEO`, `ROLE_DIRECTOR`, `ROLE_PURCHASING`, or `ROLE_ADMIN`
- **UI visibility**: Approve/reject buttons are shown to all users, but server actions will fail if user lacks the required role. No client-side role filtering on the approval list.
- **Employee context**: Server actions call `getAuthzUser()` which validates the authenticated session.

### 8.5 Large Dataset Behavior

- **Registry tables**: Paginated server-side. Default page size: 6 (range: 4–50). Maximum page: 100,000.
- **Pending approvals**: Capped at 10 POs + 10 PRs (API `take: 10`).
- **Recent activity**: Same data as PO registry (same page-size limits apply).
- **Performance**: Dashboard API batches DB queries into 3 groups to avoid exhausting the connection pool. Individual segments use `safe()` wrapper that catches errors and returns fallbacks.

### 8.6 Optimistic Updates

- Approval/rejection uses optimistic UI: items are immediately removed from the visible list via `removedIds` set, before the server action response comes back. If the action fails, the item stays removed until next data refetch (which is triggered by cache invalidation).

### 8.7 Dark Mode

- All cards, headers, and text have dark mode variants (`dark:bg-zinc-900`, `dark:text-white`, `dark:divide-zinc-800`, etc.).

---

## 9. Issues & Notes

### 9.1 Hardcoded Tax Rate in DirectPurchaseDialog

**File**: `components/procurement/direct-purchase-dialog.tsx:114`
```typescript
const taxAmount = Math.round(subtotal * 0.11)
```
**Issue**: Tax rate `0.11` (11% PPN) is hardcoded. Per CLAUDE.md rules, this should use `TAX_RATES.PPN` from `lib/tax-rates.ts`. If the PPN rate changes, this dialog will calculate wrong amounts.

**Severity**: Medium — affects displayed totals in the dialog (though the server action may calculate independently).

### 9.2 Recent Activity Is Redundant With PO Registry

**File**: `lib/actions/procurement.ts:321`, `app/procurement/page.tsx:288`
**Issue**: `recentActivity` is set to the raw `recentPOs` Prisma result (the same data used for the PO registry table). This means:
1. It shows the same data as the PO registry table — redundant display.
2. When PO status filters are active (e.g. `?po_status=APPROVED`), "recent activity" also gets filtered — it's not a true independent activity log across all entity types.
3. It only shows PO activity — no PR or GRN activity is included.

Note: The supplier name access (`po.supplier?.name`) works correctly since `recentActivity` contains raw Prisma objects with `include: { supplier: { select: { name: true } } }`.

**Severity**: Medium — misleading section title "Aktivitas Terbaru" suggests cross-entity activity, but it only mirrors the PO registry.

### 9.3 No Client-Side Role Guard on Approval Buttons

**Issue**: The approve/reject buttons appear for all users regardless of role. Unauthorized users will see the buttons, click them, and get a server-side error toast. Consider hiding buttons for users without approval roles.

**Severity**: Low (UX only — security is enforced server-side).

### 9.4 Optimistic Removal Without Rollback

**File**: `components/procurement/inline-approval-list.tsx:49,86`
**Issue**: When approval/rejection fails, the item is already removed from the visible list (added to `removedIds`). The `removedIds` set is never cleared on failure. Items reappear only when TanStack Query refetches the dashboard data.

**Severity**: Low — cache invalidation triggers a refetch which restores the item.

### 9.5 ProcurementPerformanceProvider Console Logging

**File**: `lib/performance/procurement-prefetch.ts:53,72,74`
**Issue**: `console.log` calls with emoji (`🚀 Prefetched:`, `📱 Prefetched (mobile):`, `🔥 Cache warmed:`) are left in production code.

**Severity**: Low — cosmetic, but noisy in production console.

### 9.6 Registry Default Page Size = 6

**File**: `lib/actions/procurement.ts:46`
**Issue**: Default `pageSize: 6` means the registry tables show only 6 items per page by default. The UI has no user control to change page size. With the URL-based pagination, the `po_size`/`pr_size`/`grn_size` params can be set manually but there's no dropdown in the UI.

**Severity**: Low — functional but may feel limiting for users with many records.

### 9.7 MutationObserver on document.body

**File**: `lib/performance/procurement-prefetch.ts:82-89`
**Issue**: `useProcurementPrefetch()` sets up a `MutationObserver` on `document.body` with `childList: true, subtree: true`. This observes ALL DOM changes across the entire app, which could have performance implications on heavy pages.

**Severity**: Low — likely negligible but worth monitoring.

### 9.8 Detail Dialog Item Quantity Always Shows "pcs"

**File**: `components/procurement/inline-approval-list.tsx:289`
```tsx
<span className="...">{item.quantity} pcs</span>
```
**Issue**: Unit is hardcoded to "pcs" regardless of the product's actual unit (kg, meter, roll, etc.).

**Severity**: Low — cosmetic inaccuracy in the detail preview.

### 9.9 No Sorting on Registry Tables

**Issue**: Registry tables show data ordered by `createdAt desc` (PO/PR) or `receivedDate desc` (GRN) from the server. Users cannot sort by any other column (e.g., by amount, vendor name, status).

**Severity**: Low — acceptable for a dashboard overview. Full sorting is available on dedicated list pages.

### 9.10 Direct Purchase GL Posting Is Non-Blocking

**File**: `lib/actions/procurement.ts:2193-2224`
The `createDirectPurchase` server action DOES post GL entries (`DR Inventory Asset / CR AP`), confirming the info box claim. However, GL posting happens **outside** the database transaction. If GL posting fails (e.g., missing GL accounts, closed period), the PO/GRN/Bill are still created and the function returns `{ success: true, glWarning: "..." }`. The client shows `toast.warning()` instead of `toast.success()` in this case.

**Severity**: Medium — creates a possible state where documents exist without corresponding journal entries. The warning toast is easily missed.

### 9.11 Hardcoded Tax Rate in Server Action

**File**: `lib/actions/procurement.ts:2036`
```typescript
const taxAmount = Math.round(subtotal * 0.11)
```
Same hardcoded `0.11` as the client-side dialog (issue 9.1). Both client and server calculate tax independently — if they ever diverge, totals won't match.

**Severity**: Medium — should use `TAX_RATES.PPN` from `lib/tax-rates.ts` per project rules.
