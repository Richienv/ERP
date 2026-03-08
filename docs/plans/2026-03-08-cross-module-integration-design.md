# Cross-Module Integration: Manufacturing ↔ Inventory ↔ Procurement

**Date:** 2026-03-08
**Branch:** feat/csa-parity
**Core principle:** All data must be connected — BOM materials flow to inventory stock levels, procurement PO status, and back to manufacturing planning.

## Feature 1: Material Demand Dashboard

**Page:** `/manufacturing/material-demand` (sidebar: "Kebutuhan Material")

**Data connections:**
- WorkOrder (PLANNED/IN_PROGRESS) → ProductionBOM → ProductionBOMItem.materialId → Product
- Product → StockLevel (SUM availableQty across warehouses)
- Product → PurchaseOrderItem (active POs: ORDERED/SHIPPED/PARTIAL_RECEIVED) → remaining qty
- Shortfall = required - inStock - onOrder

**API:** `GET /api/manufacturing/material-demand`
**Response:** summary KPIs + MaterialDemandRow[] with expandable WO breakdown
**Action:** "Buat PR" button creates PurchaseRequest for shortfall items

## Feature 2: Auto-PR from Work Order

**Trigger:** "Cek Kebutuhan Material" button on WO detail + auto-check on IN_PROGRESS transition

**Data connections:**
- WorkOrder → ProductionBOM → BOMItems → calculate required per material
- StockLevel.availableQty (accounts for reservations)
- Existing PurchaseRequest/PurchaseOrder pipeline (avoid duplicate PRs)
- SupplierProduct (preferred supplier lookup)

**Server actions:** `detectWorkOrderShortages()` + `createPRFromWorkOrder()` in `lib/actions/manufacturing-procurement.ts`
**Dialog:** Shows shortages with editable qty, preferred supplier, one-click PR creation

## Feature 3: Product Manufacturing Usage Tab

**Location:** New "Manufaktur" tab on `/inventory/products/[id]` (only for materials in BOMs)

**Data connections:**
- ProductionBOMItem WHERE materialId = product → shows which BOMs use this material
- WorkOrder (PLANNED/IN_PROGRESS) with BOMs containing this material → active demand
- StockLevel → current stock
- PurchaseOrderItem (active POs) → on order
- Supply summary: stock - productionDemand + onOrder = netAvailable

**API:** `GET /api/products/[id]/manufacturing-usage`
**Status:** Cukup (green) / Segera Pesan (yellow) / Kurang (red)

## Feature 4: Stock Reservation System

**New model:** `StockReservation` (workOrderId, productId, warehouseId, reservedQty, consumedQty, status)
**New enum:** `ReservationStatus` (ACTIVE, CONSUMED, RELEASED)

**Lifecycle:**
- RESERVE: WO → IN_PROGRESS (reservedQty++, availableQty--)
- CONSUME: Production posting (quantity--, reservedQty--, create PRODUCTION_OUT txn)
- RELEASE: WO cancelled/on-hold (reservedQty--, availableQty++)

**Invariant:** `availableQty = quantity - reservedQty` (always enforced)

**Data connections:**
- StockReservation links WorkOrder ↔ StockLevel ↔ Product
- checkStockAvailability() uses availableQty (respects reservations)
- Product detail shows reservation breakdown by WO
- Planning board shows reserved vs available per material

## Feature 5: Material Cost Variance

**No new models** — computed from existing InventoryTransaction + BOM data

**Data connections:**
- BOMItem (quantityPerUnit × plannedQty × waste) = planned qty/cost
- InventoryTransaction (PRODUCTION_OUT, workOrderId) = actual qty/cost
- Variance = actual - planned per material per WO

**Display:** "Biaya Material" section on WO detail
**Status:** HEMAT (<-2%) / SESUAI (±2%) / BOROS (>+2%)

## Data Flow Diagram

```
WorkOrder (PLANNED/IN_PROGRESS)
    │
    ├─→ ProductionBOM → ProductionBOMItem
    │       │
    │       └─→ Product (material)
    │               │
    │               ├─→ StockLevel (availableQty, reservedQty)
    │               │       │
    │               │       └─→ StockReservation (per WO, per material)
    │               │
    │               ├─→ PurchaseOrderItem → PurchaseOrder (status, incoming)
    │               │
    │               ├─→ PurchaseRequestItem → PurchaseRequest (pending)
    │               │
    │               ├─→ SupplierProduct (preferred supplier, price)
    │               │
    │               └─→ InventoryTransaction (PRODUCTION_OUT = actual consumption)
    │
    ├─→ Material Demand Dashboard (aggregated view)
    ├─→ Auto-PR Dialog (shortage detection + one-click PR)
    ├─→ Product Manufaktur Tab (per-product view)
    ├─→ Stock Reservation (reserve/consume/release)
    └─→ Cost Variance (planned vs actual)
```
