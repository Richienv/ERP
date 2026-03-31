# QA Documentation: Logistik Command Center (Inventory Dashboard)

## 1. Page Info

| Field | Value |
|-------|-------|
| **Name** | Logistik Command Center |
| **File** | `app/inventory/page.tsx` |
| **Route** | `/inventory` |
| **Breadcrumb** | Sidebar → Inventori → (main page) |
| **Directive** | `"use client"` — fully client-rendered |

---

## 2. Purpose

Real-time dashboard for monitoring warehouse status, inventory KPIs, material gap analysis, and procurement insights — the central command page for all inventory operations.

---

## 3. UI Elements

### 3.1 Header Row

| Element | Description |
|---------|-------------|
| Title | "Logistik Command Center" — `h1`, uppercase, font-black |
| Subtitle | "Real-time warehouse & inventory monitoring" |
| **[+ Tambah Material]** button | Emerald CTA, opens `MaterialInputForm` dialog |

### 3.2 KPI Pulse Bar (`GlobalKPIs`)

5 clickable metric cards in a horizontal grid (`grid-cols-5` on desktop, `grid-cols-2` on mobile):

| # | Metric | Data Field | Links To | Trend Logic |
|---|--------|-----------|----------|-------------|
| 1 | TOTAL INVENTORI | `kpis.totalValue` (compact IDR) | `/inventory/stock` | up if value > 0 |
| 2 | LOW STOCK | `kpis.lowStock` (count) | `/inventory/stock` | down if > 0, up if 0 |
| 3 | STOCK OPNAME | `kpis.inventoryAccuracy` (%) | `/inventory/audit` | up >=95%, neutral >=80%, down <80% |
| 4 | INBOUND | `kpis.inboundToday` (count) | `/inventory/movements` | always neutral |
| 5 | OUTBOUND | `kpis.outboundToday` (count) | `/inventory/movements` | always neutral |

Each card has a colored accent bar at top, icon, big number, and trend label.

### 3.3 Material Gap Analysis Table (`DetailedMaterialTable`)

Main workspace (9/12 columns on desktop). A full-width table with filter tabs and 6 data columns.

**Filter tabs** (top-right of table header):

| Tab | Filter Logic | Badge Color |
|-----|-------------|-------------|
| Alert | `manualAlert` OR (`gap > 0` AND not pending AND no open POs) | Red |
| Requested | Not manual alert AND (`isPendingRequest` OR optimistic pending) | Amber |
| Approved | Not manual alert AND (has `openPOs` OR optimistic POs) | Blue |
| Rejected | `isRejectedRequest === true` | Red |
| Completed | Not manual alert AND `gap <= 0` AND not pending AND no open POs | Emerald |

**Table columns:**

| Column | Content |
|--------|---------|
| Material Info | Name, SKU, category, manual alert badge, alternative material badge |
| Stock & Demand | Current stock / needed (colored red/green), incoming PO qty, warehouse breakdown, WO demand sources |
| Planning | Safety stock, reorder point, lead time, burn rate, "Stock ends in X days" badge |
| Supply Chain | Preferred vendor name, active incoming PO card (with PO number, qty, ETA) |
| Financial Impact | Unit cost, budget needed (gap cost), deficit qty — or "HEALTHY" badge |
| Action | Context-sensitive button (see User Actions below) |

### 3.4 Warehouse Cards Sidebar

Right sidebar (3/12 columns). Shows up to **3** active warehouses. Each `WarehouseCard` displays:

| Field | Source |
|-------|--------|
| Name | `warehouse.code - warehouse.name` |
| Manager | `warehouse.manager` or "Unassigned" |
| Dock Status Badge | CONGESTED (>=90% util), BUSY (>=60%), IDLE (<60%) |
| Inventory Value | IDR compact format |
| Staff / PO / Task counts | 3-column mini stat grid |
| Capacity bar | Colored progress bar (red >=90%, amber >=60%, green <60%) |
| **[Detail →]** button | Links to `/inventory/warehouses/:id` |

**Empty state:** "Belum ada gudang aktif." in dashed border box.

### 3.5 Quick Actions Bar (Bottom-Left)

6 navigation buttons in a flex-wrap layout:

| Button | Link | Color |
|--------|------|-------|
| Produk | `/inventory/products` | Emerald |
| Stok | `/inventory/stock` | Blue |
| Pergerakan | `/inventory/movements` | Violet |
| Opname | `/inventory/audit` | Amber |
| Peringatan | `/inventory/alerts` | Rose |
| Laporan | `/inventory/reports` | Cyan |

### 3.6 Procurement Insights Bar (Bottom-Right)

Shown only when `procurement?.summary` exists. Displays:

| Metric | Icon | Color |
|--------|------|-------|
| Restock cost + critical item count | AlertCircle | Red |
| Incoming PO count | Truck | Cyan |
| Pending PR count (conditional, shown only if > 0) | ShoppingCart | Violet |
| **[Procurement →]** button | Links to `/procurement` | Black |
| **[Restock]** button (conditional, shown only if critical items > 0) | Links to `/procurement/requests/create?type=bulk_restock` | Red |

### 3.7 Dialogs

#### MaterialInputForm Dialog

Triggered by **[+ Tambah Material]** header button. Full material creation form with:

- **Code Builder** section: 4 dropdowns (Kategori, Tipe, Brand, Warna) with live code preview and barcode preview
- **Basic Info** section: Name input (required), Unit combobox (required, create-on-fly), Supplier combobox (optional, create-on-fly)
- **Stock** section: Initial stock (number), Min stock alert (number, default 10)
- **Pricing** section: HPP per unit (number with "Rp" prefix)
- **Notes** section: Textarea
- Footer: [Batal] + [Simpan Material] buttons

#### PurchaseRequestDialog

Triggered from Material Gap table action column. Contains:

- Product info display (name, SKU, category, unit price)
- Recommendation banner (if `pendingRestockQty > 0`, with "Gunakan Rekomendasi" button)
- Quantity input (number, required, default = gap or reorderPoint)
- Notes textarea (optional)
- Footer: [Cancel] + [Confirm Request] buttons

#### GoodsReceiptDialog

Triggered from Material Gap table action column. Contains:

- Item detail display (name, unit)
- PO selector dropdown (required)
- Selected PO summary (supplier, ordered qty, remaining qty)
- Warehouse selector dropdown (required, uses all warehouses)
- Received quantity input (number, required, default = remaining qty)
- Footer: [Cancel] + [Confirm Receipt] buttons

---

## 4. User Actions

### 4.1 Navigation

| Action | Trigger | Destination |
|--------|---------|-------------|
| Click KPI card | Any of 5 KPI cards | `/inventory/stock`, `/inventory/audit`, or `/inventory/movements` |
| Click warehouse Detail | [Detail →] button on WarehouseCard | `/inventory/warehouses/:id` |
| Click quick action | 6 buttons in bottom-left | Various `/inventory/*` pages |
| Click Procurement | Button in Procurement Insights | `/procurement` |
| Click Restock | Red button in Procurement Insights | `/procurement/requests/create?type=bulk_restock` |

### 4.2 Create Material (MaterialInputForm)

| Step | Detail |
|------|--------|
| Trigger | Click [+ Tambah Material] button |
| Form fill | Select code segments, enter name/unit/stock/price |
| Inline creation | Brand, Color, Unit, Supplier can be created on-the-fly via ComboboxWithCreate |
| Submit | Click [Simpan Material] |
| Success | Toast "Material berhasil ditambahkan" with code, dialog closes, form resets, queries invalidated (`products`, `inventoryDashboard`, `categories`) |
| Failure | Toast error message ("Gagal menyimpan material" or server error) |
| Cancel | Click [Batal] or close dialog — form resets |

### 4.3 Request Purchase (PurchaseRequestDialog)

| Step | Detail |
|------|--------|
| Trigger | Click [Request Purchase] on a material row with gap > 0, no open POs, and not already pending |
| Also triggers for | Manual alert items (always shows regardless of PO status) |
| Form fill | Quantity (pre-filled with gap or reorderPoint), notes (optional) |
| Submit | Calls `requestPurchase({ itemId, quantity, notes })` |
| Success | Toast "Purchase Request Sent", queries invalidated (`purchaseRequests`, `procurementDashboard`, `inventoryDashboard`, `products`), optimistic UI updates row to "Pending Request" |
| Failure | Toast error message |

### 4.4 Receive Goods (GoodsReceiptDialog)

| Step | Detail |
|------|--------|
| Trigger | Click [Receive Goods] on a material row with open POs |
| Form fill | Select PO, select warehouse, enter received quantity |
| Submit | Calls `receiveGoodsFromPO({ itemId, poId, warehouseId, receivedQty })` |
| Success | Toast "Stock Received Successfully!", queries invalidated (6 query keys), optimistic UI clears PO from row |
| Failure | Toast error message |

### 4.5 Filter Material Table

| Action | Trigger | Effect |
|--------|---------|--------|
| Switch filter tab | Click Alert/Requested/Approved/Rejected/Completed tab | Filters `materialGap` data by status criteria, each tab shows count badge |

### 4.6 Inline Master Data Creation

From within the MaterialInputForm dialog:

| Action | Server Action | Invalidates |
|--------|--------------|-------------|
| Create Brand | `createBrand(code, name)` | `brands` query |
| Create Color | `createColor(code, name)` | `colors` query |
| Create Unit | `createUnit(code, name)` | `units` query |
| Create Supplier | `createSupplier(code, name)` | `suppliers` + `vendors` queries |

---

## 5. Form Validations

### MaterialInputForm

| Field | Required | Type | Validation | Default |
|-------|----------|------|------------|---------|
| Nama Material | Yes | text | `name.trim()` must be non-empty (checked at submit) | `""` |
| Kategori (code) | Yes | select | Pre-selected | `"RAW"` |
| Tipe (code) | Yes | select | Auto-adjusts when category changes | `"YRN"` |
| Brand (code) | Yes | combobox | Pre-selected | `"XX"` |
| Warna (code) | Yes | combobox | Pre-selected | `"NAT"` |
| Satuan (Unit) | Yes* | combobox | Falls back to `"pcs"` if empty | `""` |
| Supplier | No | combobox | Optional | `""` |
| Stok Awal | No | number | Parsed via `Number()`, defaults 0 | `""` |
| Min Stock Alert | No | number | Parsed via `Number()`, defaults 10 | `"10"` |
| HPP | No | number | Parsed via `Number()`, defaults 0 | `""` |
| Catatan | No | textarea | No validation | `""` |

*Note: Unit is marked required in the UI label but falls back to "pcs" silently if empty.

### GoodsReceiptDialog (Zod schema)

| Field | Required | Type | Validation | Error Message |
|-------|----------|------|------------|---------------|
| poId | Yes | string | `.min(1)` | "Purchase Order is required" |
| warehouseId | Yes | string | `.min(1)` | "Gudang tujuan harus dipilih" |
| receivedQty | Yes | number | `.min(1)` via `z.coerce.number()` | "Quantity must be at least 1" |

### PurchaseRequestDialog (Zod schema)

| Field | Required | Type | Validation | Error Message |
|-------|----------|------|------------|---------------|
| quantity | Yes | number | `.min(1)` via `z.coerce.number()` | "Quantity must be at least 1" |
| notes | No | string | Optional | — |

---

## 6. API Calls

### Primary Data Fetch

| Endpoint | Method | Auth | Response Shape |
|----------|--------|------|----------------|
| `GET /api/inventory/dashboard` | GET | Supabase cookie session (401 if missing) | `{ warehouses, kpis, materialGap, procurement }` |

**Underlying server actions** (called in `Promise.all` inside the API route):

| Action | Returns |
|--------|---------|
| `getWarehouses()` | Array of warehouse objects (id, code, name, manager, staff, totalValue, utilization, activePOs, pendingTasks) |
| `getInventoryKPIs()` | `{ totalValue, totalProducts, lowStock, inventoryAccuracy, inboundToday, outboundToday }` |
| `getMaterialGapAnalysis()` | Array of `GapData` objects (see DetailedMaterialTable interface) |
| `getProcurementInsights()` | `{ summary: { totalRestockCost, itemsCriticalCount, totalIncoming, totalPending, pendingApproval } }` |

**Fallback on error:** Each action has a `.catch()` that returns safe defaults (empty arrays / zero objects). The top-level catch also returns a complete fallback response — the page never 500s.

### Mutation Actions

| Action | Server Action | Parameters | Success Response |
|--------|--------------|------------|------------------|
| Create material | `createProduct(data)` from `app/actions/inventory` | `{ name, code, description, categoryId, productType, codeCategory, codeType, codeBrand, codeColor, unit, costPrice, sellingPrice, minStock, maxStock, reorderLevel, barcode }` | `{ success: true, data: { code } }` |
| Request purchase | `requestPurchase(data)` from `app/actions/inventory` | `{ itemId, quantity, notes }` | `{ success: true, pendingTask? }` or `{ success: true, newPO? }` |
| Receive goods | `receiveGoodsFromPO(data)` from `app/actions/inventory` | `{ itemId, poId, warehouseId, receivedQty }` | `{ success: true }` |
| Create brand | `createBrand(code, name)` from `lib/actions/master-data` | `(code: string, name: string)` | Brand object with `.code` |
| Create color | `createColor(code, name)` from `lib/actions/master-data` | `(code: string, name: string)` | Color object with `.code` |
| Create unit | `createUnit(code, name)` from `lib/actions/master-data` | `(code: string, name: string)` | Unit object with `.code` |
| Create supplier | `createSupplier(code, name)` from `lib/actions/master-data` | `(code: string, name: string)` | Supplier object with `.id` |

### Master Data Fetch Hooks (used inside MaterialInputForm)

| Hook | Source |
|------|--------|
| `useBrands()` | `hooks/use-master-data` |
| `useColors()` | `hooks/use-master-data` |
| `useUnits()` | `hooks/use-master-data` |
| `useSuppliers()` | `hooks/use-master-data` |
| `useWarehouses()` | `hooks/use-warehouses` (used in GoodsReceiptDialog) |

---

## 7. State & Dependencies

### Data Dependencies

| Data | Source | Query Key | Refetch Trigger |
|------|--------|-----------|-----------------|
| Dashboard bundle | `/api/inventory/dashboard` | `["inventoryDashboard", "list"]` | On mount, after mutations |
| Brands | Master data hook | `brands` | After `createBrand` |
| Colors | Master data hook | `colors` | After `createColor` |
| Units | Master data hook | `units` | After `createUnit` |
| Suppliers | Master data hook | `suppliers` | After `createSupplier` |
| Warehouses | Warehouses hook | `warehouses` | After goods receipt |

### Optimistic UI State (DetailedMaterialTable)

| State | Type | Purpose |
|-------|------|---------|
| `optimisticPOs` | `Record<string, any[]>` | Newly created POs shown before server revalidation |
| `optimisticResolvedItems` | `Set<string>` | Items just received, visually cleared before refresh |
| `optimisticPendingRequests` | `Set<string>` | Items just requested, shown as pending before refresh |

### Performance Provider

`InventoryPerformanceProvider` wraps the page and runs:
- `useInventoryPrefetch()` — general inventory prefetch
- `prefetchData(['inventory-kpis', 'material-gap-analysis', 'procurement-insights'])` — prefetches related data after 500ms delay

### Component Tree

```
InventoryPage
├── CardPageSkeleton (loading state)
└── InventoryPerformanceProvider
    └── InventoryDashboardView (slot-based layout)
        ├── Header: title + MaterialInputForm (dialog)
        ├── PulseBar: GlobalKPIs (5 clickable metric cards)
        ├── MainLeft: MaterialTableWrapper → DetailedMaterialTable
        │   ├── PurchaseRequestDialog (per row)
        │   └── GoodsReceiptDialog (per row)
        ├── MainRight: WarehouseCard[] (up to 3)
        ├── BottomLeft: InventoryQuickActions (6 nav buttons)
        └── BottomRight: ProcurementInsights (conditional)
```

---

## 8. Edge Cases

### Loading States

| Scenario | Behavior |
|----------|----------|
| Initial page load | `CardPageSkeleton` with emerald accent shown until `useInventoryDashboard` resolves |
| Dialog master data loading | `ComboboxWithCreate` shows loading state via `isLoading` prop |
| Form submission | Button shows `<Loader2 />` spinner + disabled state |

### Empty States

| Scenario | Behavior |
|----------|----------|
| No warehouses | "Belum ada gudang aktif." dashed-border placeholder |
| No material gap data | "No material data found." dashed-border centered message |
| No items in current filter tab | "No items found for this filter." italic centered message |
| No procurement summary | Bottom-right slot renders `null` (empty space) |
| No active PO for a material | "No active orders" italic text |

### Error States

| Scenario | Behavior |
|----------|----------|
| Dashboard API fails | Entire response returns safe defaults (empty arrays, zero values) — page renders with zero data, no error UI |
| Individual server action fails in API | `.catch(() => fallback)` per action — partial data still renders |
| Auth failure (no session) | API returns 401, `useQuery` throws, page stays on skeleton indefinitely |
| createProduct fails | Toast error "Gagal menyimpan material" or server error message |
| requestPurchase fails | Toast error message, dialog stays open |
| receiveGoodsFromPO fails | Toast error "Gagal menerima barang" or "An error occurred" |

### Data Constraints

| Constraint | Behavior |
|------------|----------|
| Warehouses capped at 3 | `(warehouses ?? []).slice(0, 3)` — only first 3 shown |
| Demand sources capped at 2 | `demandSources.slice(0, 2)` with "+N more" overflow |
| Vendor name truncated | `truncate w-[120px]` CSS — long names clipped |
| Depreciation value | Hardcoded as `totalValue * 0.03` (3%) — not from API |

### Permission / Visibility

| Condition | Effect |
|-----------|--------|
| No auth session | API returns 401, page skeleton stays forever (no redirect) |
| Procurement data missing | Bottom-right panel hidden entirely |
| No critical items | [Restock] button in Procurement Insights hidden |
| No pending PRs | Planning metric in Procurement Insights hidden |

---

## 9. Known Issues

| # | Issue | Severity | Location |
|---|-------|----------|----------|
| 1 | **Auth failure shows infinite skeleton** — If the user's session expires, the API returns 401 and `useQuery` will keep the page in loading state forever. No error message or redirect to login. | Medium | `app/inventory/page.tsx:17` |
| 2 | **Depreciation is hardcoded at 3%** — `depreciationValue` is calculated as `totalValue * 0.03` client-side, not from actual asset depreciation data. The value is passed to `WarehouseCard` but never displayed (prop exists but not rendered). | Low | `app/inventory/page.tsx:63` |
| 3 | **`sellingPrice` always 0** — `MaterialInputForm` sends `sellingPrice: 0` without any input field for it. Created materials will always have zero selling price. | Low | `components/inventory/material-input-form.tsx:104` |
| 4 | **Unit validation is silent** — The unit field is labeled as required (`*`) but if left empty it silently falls back to `"pcs"` instead of showing a validation error. | Low | `components/inventory/material-input-form.tsx:102` |
| 5 | **No pagination on Material Gap table** — All gap items are loaded and rendered at once. For large inventories this could cause performance issues. | Medium | `components/inventory/detailed-material-table.tsx` |
| 6 | **Optimistic state not cleared on refetch** — `optimisticPOs`, `optimisticResolvedItems`, and `optimisticPendingRequests` are never cleared when `useInventoryDashboard` refetches. Stale optimistic data could persist until page navigation. | Medium | `components/inventory/detailed-material-table.tsx:99-103` |
| 7 | **Console.log left in production code** — `handlePurchaseSuccess` and `handleReceiptSuccess` contain `console.log` debug statements. | Low | `components/inventory/detailed-material-table.tsx:117,140` |
| 8 | **GoodsReceiptDialog form default on multi-PO** — When `openPOs.length > 1`, `useEffect` always selects `openPOs[0]` on dialog open, but `defaultValues` sets `poId: ""` and `receivedQty: 0`, causing a brief flash before the effect runs. | Low | `components/inventory/goods-receipt-dialog.tsx:78-93` |
| 9 | **Brand code auto-generation is naive** — `handleCreateBrand` takes `name.substring(0, 2).toUpperCase()` which will collide for brands starting with the same 2 letters (e.g., "Adidas" and "Adikarya" both get "AD"). | Low | `components/inventory/material-input-form.tsx:130` |
| 10 | **`any` types throughout** — `WarehouseCard` maps use `warehouse: any`, `GapData` fields use `any`, reducing type safety. | Low | Multiple files |
