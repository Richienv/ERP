# Inventory Module — QA Module Summary

> **Generated:** 2026-03-27
> **Module path:** `app/inventory/`
> **Total subpages:** 18
> **Server actions:** 50+ functions across 4 files
> **API routes:** 7 endpoints under `/api/inventory/`
> **Test coverage:** 1 file, 7 test cases (covers `calculateProductStatus()` only)

---

## 1. Subpages Documented

| # | Subpage | Route | Type |
|---|---------|-------|------|
| 1 | Logistik Command Center | `/inventory` | Dashboard |
| 2 | Daftar Produk | `/inventory/products` | List (Kanban + Table) |
| 3 | Tambah Produk Baru | `/inventory/products/new` | Form |
| 4 | Detail Produk | `/inventory/products/:id` | Detail (4 tabs) |
| 5 | Level Stok | `/inventory/stock` | Table + KPIs |
| 6 | Daftar Gudang | `/inventory/warehouses` | Card Grid |
| 7 | Detail Gudang | `/inventory/warehouses/:id` | Detail + Locations |
| 8 | Pergerakan Stok | `/inventory/movements` | Activity Log Table |
| 9 | Penyesuaian Stok | `/inventory/adjustments` | Navigation Hub |
| 10 | Peringatan Stok | `/inventory/alerts` | Filtered Table |
| 11 | Stok Opname | `/inventory/audit` | Table + Input Dialog |
| 12 | Kategori Produk | `/inventory/categories` | Card Grid + Detail Dialog |
| 13 | Cycle Count (Batch Opname) | `/inventory/cycle-counts` | Session Table + Count Dialog |
| 14 | Fabric Rolls | `/inventory/fabric-rolls` | Grid/Table Toggle |
| 15 | Opening Stock (Saldo Awal) | `/inventory/opening-stock` | Bulk Entry Form |
| 16 | Laporan Inventori | `/inventory/reports` | KPI + Navigation Cards |
| 17 | Pengaturan Inventori | `/inventory/settings` | Settings Toggle |
| 18 | Stock Transfers | `/inventory/transfers` | Table + Workflow |

---

## 2. Key Findings

### 2.1 Materials Management

**Product lifecycle is well-covered:**
- Full CRUD via product list, create form, and detail page
- Structured code builder (Category-Type-Brand-Color-Sequence) with live barcode preview
- Inline master data creation (brands, colors, units, suppliers) from any product form
- Batch price update and bulk import (CSV/Excel) supported
- Kanban + table dual-view on product list with 7-metric KPI strip
- Product detail has 4 tabs: Overview, Stock Locations, Movement History, Manufacturing

**Material Gap Analysis is the crown jewel:**
- Real-time safety stock, reorder point, burn rate, and stock-ends-in-days calculation
- 5-tab filter (Alert / Requested / Approved / Rejected / Completed) maps to procurement pipeline
- Direct Purchase Request and Goods Receipt dialogs embedded in table rows
- Optimistic UI for PO creation and receipt confirmation
- Financial impact (budget needed, deficit cost) calculated per material

**Fabric Roll tracking is textile-specific:**
- Per-roll tracking with meter progress bars (received vs remaining)
- Receipt dialog with dye lot, grade, location bin
- Grid and table views with status filtering (Available / Reserved / In Use / Depleted)

### 2.2 Stock Tracking

**Multi-dimensional stock visibility:**
- Stock levels flattened per product-per-warehouse (one row each) on Level Stok page
- Status auto-calculated: Healthy / Low Stock / Critical / Empty / New
- Stock health KPI (% healthy items) on stock level page
- Movement history grouped by date with Jakarta timezone, typed by direction (In/Out/Internal)
- Export to Excel/CSV from both stock level and movements pages

**Auditing has two modes:**
- Spot audit via Stok Opname page — single product, immediate entry
- Batch audit via Cycle Count page — session-based, multi-product, finalize creates auto-adjustments
- Both create inventory transactions and can trigger GL journal entries

**Opening stock integrates with finance:**
- Bulk line-item entry (product + warehouse + qty + unit cost)
- Duplicate detection (same product-warehouse combo blocked)
- Creates `INITIAL` type InventoryTransaction
- Posts GL journal entry (DR Inventory Asset, CR Retained Earnings)
- Warning toast if GL accounts not found in COA

**Negative stock policy is configurable:**
- Single toggle in Inventory Settings
- Enforced by `checkStockAvailability()` in SO shipment, adjustment, production issue, transfer
- Default: disabled (negative stock blocked)

### 2.3 Warehouse Features

**Warehouse management is card-based:**
- Grid layout with capacity utilization bars, manager info, staff counts
- Type classification: Raw Material, WIP, Finished Goods, General
- CRUD with delete protection (blocked if active stock or pending transfers)
- Detail page shows category breakdown with per-category utilization

**Stock transfers have a full workflow:**
- State machine: Draft → Pending Approval → Approved → In Transit → Received (or Cancelled)
- `assertTransferTransition()` validates allowed transitions server-side
- Sequential numbering (TRF-00001, TRF-00002, ...)
- Source/destination warehouse validation (cannot be same)
- Invalidates 5 query keys on transition (broad cache bust)

**Warehouse locations management:**
- Nested under warehouse detail page via `WarehouseLocationsSection`
- CRUD for bin/rack/zone locations within each warehouse
- Location codes used in fabric roll tracking

---

## 3. All Issues Found (Prioritized)

### CRITICAL (4)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | **Auth failure shows infinite skeleton** — API returns 401, page stays on loading skeleton forever with no error message or login redirect | `app/inventory/page.tsx:17`, all pages using `useQuery` | User locked out with no feedback; applies to ALL 18 inventory pages |
| C2 | **No pagination on data-heavy tables** — Material Gap, Stock Level, Alerts, Movements, Transfers, Cycle Counts all load full datasets client-side | Multiple pages | Performance degradation / browser crash with 10k+ items; Stock level flattens products × warehouses making it worse |
| C3 | **Cycle count dialog loses data on close** — `counts` state is local React state only; closing the count dialog discards all entered quantities | `app/inventory/cycle-counts/page.tsx` | User loses manual counting work if dialog accidentally dismissed |
| C4 | **Race condition in audit timeout** — `withTimeout` uses `Promise.race` but losing promise continues executing; no abort controller | `app/inventory/audit/page.tsx` | Dangling promises could cause stale data or memory leaks |

### MEDIUM (18)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | **Optimistic state never cleared on refetch** — `optimisticPOs`, `optimisticResolvedItems`, `optimisticPendingRequests` persist until page navigation | `detailed-material-table.tsx:99-103` | Stale badges shown after server data refreshes |
| M2 | **Unit selection mismatch in product detail edit** — `SelectItem value={u.name}` but field stores code | `products/[id]/page.tsx:579` | Editing unit on existing product saves wrong value |
| M3 | **Warehouse manager avatar crashes on null** — `wh.manager.charAt(0)` without null check | `warehouses-client.tsx` | JS error if warehouse has no manager assigned |
| M4 | **No concurrency control on product edits** — Two users editing same product simultaneously; last write wins | `products/[id]/page.tsx` | Silent data loss on concurrent edits |
| M5 | **Stock level warehouse lookup can crash** — `.find()` returns undefined, then `.name` accessed | `stock-client.tsx:49` | Runtime error if warehouse ID not in array |
| M6 | **No confirmation dialogs for state transitions** — Transfer approve/ship/receive buttons fire immediately | `stock-transfer-list.tsx` | Accidental status changes with no undo |
| M7 | **Audit form doesn't reset on submission failure** — User must manually clear fields after error | `audit/page.tsx` | Confusing UX; double-submission risk |
| M8 | **Console.log debug statements in production** — `handlePurchaseSuccess` and `handleReceiptSuccess` log to console | `detailed-material-table.tsx:117,140` | Information leak in production console |
| M9 | **Category code uniqueness not validated on frontend** — Create dialog doesn't check for duplicate codes | `categories/client.tsx` | Server error only caught after submission |
| M10 | **Alerts page has no sort capability** — Items display in whatever order the hook returns | `alerts/page.tsx` | Critical alerts may not surface first |
| M11 | **No search/filter on warehouse grid** — All warehouses shown with no search by name or type filter | `warehouses-client.tsx` | Difficult to find warehouses at scale |
| M12 | **Transfer filter not persistent** — Status filter resets on page reload; not stored in URL params | `stock-transfer-list.tsx` | User loses filter context on refresh |
| M13 | **Negative stock toggle has no confirmation** — Single click immediately mutates server state | `settings/page.tsx` | Accidental policy change affects all modules |
| M14 | **GoodsReceiptDialog form flash on multi-PO** — `defaultValues` sets `poId: ""` / `receivedQty: 0`, then `useEffect` overwrites with first PO | `goods-receipt-dialog.tsx:78-93` | Brief incorrect form state visible to user |
| M15 | **Fabric roll onClick not implemented** — `FabricRollCard` accepts onClick prop but never receives it | `fabric-roll-list.tsx` | Grid cards are not clickable; no detail view accessible |
| M16 | **Opening stock allows quantity=0** — No min(1) validation on quantity field; API may accept zero | `opening-stock/page.tsx` | Meaningless zero-quantity entries created |
| M17 | **Depreciation hardcoded at 3%** — `depreciationValue = totalValue * 0.03` computed client-side, not from real data | `app/inventory/page.tsx:63` | Misleading financial number (though prop is passed but not rendered in WarehouseCard) |
| M18 | **Unit validation silent fallback** — Unit field labeled required (*) but silently defaults to "pcs" if empty | `material-input-form.tsx:102` | User thinks they selected a unit when they didn't |

### LOW (12)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| L1 | `sellingPrice` always 0 in MaterialInputForm — no input field for it | `material-input-form.tsx:104` | Products created from dashboard have no selling price |
| L2 | Brand code auto-generation collides — first 2 chars of name (e.g., "Adidas"/"Adikarya" both → "AD") | `material-input-form.tsx:130` | Duplicate brand codes possible |
| L3 | `any` types pervasive — `warehouse: any`, `product: any`, GapData fields loosely typed | Multiple files | Reduced type safety, harder to catch bugs |
| L4 | Adjustments page is a navigation hub — no actual functionality, just 3 links | `adjustments/page.tsx` | Redundant page; routes hard-coded |
| L5 | Reports page has no real reports — just KPI summary and 6 navigation cards | `reports/page.tsx` | No exportable reports; just links to other pages |
| L6 | Settings page has only 1 toggle — sparse single-setting page | `settings/page.tsx` | Underutilized page |
| L7 | No fabric roll detail view — `getFabricRollDetail()` exists but no page uses it | `fabric-rolls/page.tsx` | Can't view individual roll transaction history |
| L8 | No audit trail for settings changes — no record of who changed negative stock policy | `settings/page.tsx` | Compliance gap |
| L9 | Transaction history may be unbounded — "last 10" mentioned in comment but no actual limit in API | `products/[id]/page.tsx` | Potentially large response payloads |
| L10 | Safety stock and lead time not editable — shown read-only in product detail edit mode | `products/[id]/page.tsx` | User must edit via other means (or can't edit at all) |
| L11 | Stock level duplicate row keys possible — key is `{id}-{location}`, collides if location is "Unknown" | `stock-client.tsx` | React rendering warnings |
| L12 | Reports KPI average stock divides by 0 — if `totalProduk=0`, math breaks before coalesce | `reports/page.tsx` | NaN displayed briefly before fallback |

---

## 4. Missing Test Coverage

### Current Coverage

| Area | File | Tests | Functions Covered |
|------|------|-------|-------------------|
| Inventory Logic | `__tests__/inventory-logic.test.ts` | 7 cases | `calculateProductStatus()` only |

### Untested Areas (by priority)

#### P0 — Financial Integration (data corruption risk)
- [ ] Opening stock GL journal creation (DR Inventory / CR Retained Earnings)
- [ ] Cycle count finalization auto-adjustment + GL posting
- [ ] `checkStockAvailability()` enforcement with negative stock policy
- [ ] Goods receipt from PO — stock level upsert + transaction creation

#### P1 — Core CRUD & Workflows
- [ ] `createProduct()` — all 7 code builder permutations, validation, sequence generation
- [ ] `updateProduct()` — partial update, category/unit change
- [ ] `deleteProduct()` / `deleteWarehouse()` / `deleteCategory()` — cascade constraints
- [ ] Stock transfer state machine — all valid transitions + invalid transition rejection
- [ ] Purchase request creation from Material Gap table
- [ ] Bulk import products (CSV parsing, validation, duplicate handling)
- [ ] Bulk import movements

#### P2 — Queries & Aggregations
- [ ] `getInventoryKPIs()` — totalValue, lowStock, accuracy calculations
- [ ] `getMaterialGapAnalysis()` — gap, safety stock, burn rate, stock-ends-in-days
- [ ] `getProcurementInsights()` — restock cost, critical items, incoming POs
- [ ] `getStockMovements()` — filtering, grouping, date timezone handling
- [ ] `getRecentAudits()` — match/discrepancy counting

#### P3 — API Routes
- [ ] `GET /api/inventory/dashboard` — auth check, graceful fallbacks on partial failure
- [ ] `GET /api/inventory/page-data` — product status calculation, manual alert clearing
- [ ] `GET /api/inventory/stock-check` — multi-product availability check
- [ ] `GET/PUT /api/inventory/settings` — toggle persistence
- [ ] `GET/POST /api/inventory/opening-stock` — duplicate prevention, GL integration

#### P4 — Utilities
- [ ] `buildStructuredCode()` — all category/type/brand/color combos
- [ ] `generateBarcode()` — checksum correctness
- [ ] `convertUom()` — conversion factor chain
- [ ] `checkStockAvailability()` — boundary cases (exact min, zero, negative)

---

## 5. Recommended QA Test Cases for Stakeholder Demo

### Demo Scenario A: Product Lifecycle (Materials Management)

| Step | Action | Expected Result |
|------|--------|-----------------|
| A1 | Navigate to `/inventory` | Dashboard loads with KPIs, Material Gap table, warehouse cards |
| A2 | Click [+ Tambah Material] | Dialog opens with code builder |
| A3 | Select Kategori=RAW, Tipe=YRN, Brand=XX, Warna=NAT | Preview code updates live (e.g., `RAW-YRN-XX-NAT-001`) |
| A4 | Fill name "Benang Katun Putih", unit=kg, HPP=50000, min stock=100 | All fields populated |
| A5 | Click [Simpan Material] | Toast success, dialog closes, product appears in list |
| A6 | Navigate to `/inventory/products` | New product visible in kanban and table view |
| A7 | Click product row | Detail page loads with 4 tabs, stock = 0, status "Habis Stok" |
| A8 | Click [Penyesuaian Stok] on detail page | Adjustment dialog opens |
| A9 | Enter qty=500, warehouse=Gudang Utama | Stock updated, movement recorded |
| A10 | Check Riwayat Gerakan tab | ADJUSTMENT transaction visible with +500 |

### Demo Scenario B: Warehouse & Stock Operations

| Step | Action | Expected Result |
|------|--------|-----------------|
| B1 | Navigate to `/inventory/warehouses` | Warehouse cards with utilization bars |
| B2 | Click [Tambah Gudang] | Create dialog opens |
| B3 | Fill name="Gudang Baru", type=RAW_MATERIAL, capacity=1000 | Form validated |
| B4 | Submit | Toast success, new card appears in grid |
| B5 | Click [Detail Gudang] on new card | Detail page with 0% capacity, no categories |
| B6 | Navigate to `/inventory/transfers` | Transfer list page |
| B7 | Click [Transfer Baru] | Dialog with warehouse and product selectors |
| B8 | Select from=Gudang Utama, to=Gudang Baru, product=Benang Katun, qty=100 | Form validated (different warehouses) |
| B9 | Submit transfer | Status = Draft, row appears in table |
| B10 | Click [Approve] → [Ship] → [Receive] | Status transitions through pipeline; stock moves between warehouses |

### Demo Scenario C: Stock Audit & Compliance

| Step | Action | Expected Result |
|------|--------|-----------------|
| C1 | Navigate to `/inventory/audit` | Audit page with KPI strip |
| C2 | Click [Input Opname] | Dialog opens |
| C3 | Select warehouse + product, enter physical qty different from system | Qty field accepts number |
| C4 | Submit | Toast success, audit log shows SELISIH badge with variance |
| C5 | Navigate to `/inventory/cycle-counts` | Batch audit session page |
| C6 | Click [Buat Sesi Baru], select warehouse | Session created with all warehouse products |
| C7 | Click [Hitung] on session row | Count dialog opens with product list and system quantities |
| C8 | Enter actual quantities for all products | Variance calculated live per row |
| C9 | Click [Simpan Hitungan] | Counts saved, session status updates |
| C10 | Click [Finalisasi] | Confirmation, adjustments auto-created, stock levels corrected |

### Demo Scenario D: Opening Stock with GL Integration

| Step | Action | Expected Result |
|------|--------|-----------------|
| D1 | Navigate to `/inventory/opening-stock` | Bulk entry form with 1 empty line |
| D2 | Add 3 lines: different products, warehouses, quantities, unit costs | Grand total updates in real-time |
| D3 | Click [Simpan Semua] | Toast "Saldo awal stok berhasil disimpan" |
| D4 | Verify: check if toast mentions "Jurnal GL" | GL journal created (or warning if COA accounts missing) |
| D5 | Navigate to `/finance/journal` | Opening stock journal entry visible (DR Inventory / CR Equity) |
| D6 | Navigate to `/inventory/stock` | Stock levels reflect opening balances |

### Demo Scenario E: Alert-to-Procurement Pipeline

| Step | Action | Expected Result |
|------|--------|-----------------|
| E1 | Navigate to `/inventory` | Dashboard Material Gap table shows Alert tab |
| E2 | Identify material with gap > 0 and "Alert" status | Row shows red deficit, budget needed |
| E3 | Click [Request Purchase] on that row | Purchase Request dialog opens with pre-filled qty |
| E4 | Submit request | Toast success, row moves to "Requested" tab |
| E5 | (After approval in procurement) Return to dashboard | Row now in "Approved" tab with incoming PO details |
| E6 | Click [Receive Goods] | Goods Receipt dialog opens with PO info |
| E7 | Select PO, warehouse, enter received qty | Form validated |
| E8 | Submit receipt | Toast success, row moves to "Completed" tab; stock level updated |

### Demo Scenario F: Fabric Roll Tracking (Textile-Specific)

| Step | Action | Expected Result |
|------|--------|-----------------|
| F1 | Navigate to `/inventory/fabric-rolls` | Roll list (grid or table view) |
| F2 | Click [Terima Roll Baru] | Receive dialog opens |
| F3 | Fill: roll#, product, warehouse, length=100m, dye lot, grade=A | All fields validated |
| F4 | Submit | Toast success, new roll card appears with 100/100m progress bar |
| F5 | Toggle between Grid and Table views | Data renders correctly in both views |
| F6 | Search by roll number | Filters to matching roll |
| F7 | Filter by status=AVAILABLE | Shows only available rolls |
