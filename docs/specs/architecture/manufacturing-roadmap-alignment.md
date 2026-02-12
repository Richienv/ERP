# Manufacturing Module Architecture Alignment (Roadmap-Driven)

This document aligns the current Manufacturing implementation with `master_roadmap.md` (Phase 1.4, 3.1, 3.3, and cross-module dependencies to Procurement, Inventory, Sales, and Finance).

## 1) Current State Summary

### Working foundation
- API routes exist for core entities:
  - `/api/manufacturing/bom`
  - `/api/manufacturing/routing`
  - `/api/manufacturing/work-orders`
  - `/api/manufacturing/machines`
  - `/api/manufacturing/groups`
  - `/api/manufacturing/planning`
  - `/api/manufacturing/quality`
  - `/api/manufacturing/dashboard`
- Main dashboard (`/manufacturing`) already reads backend data from `/api/manufacturing/dashboard`.

### Gap patterns found
- Many page-level action buttons are still UI-only or partially wired.
- Some manufacturing dashboard components still rely on mock/static datasets in `components/manufacturing/*`.
- Inter-module transaction chain is not fully enforced end-to-end:
  - Sales Order -> Manufacturing Order -> Material Consumption -> Finished Goods Receipt -> GL postings.

## 2) Roadmap Mapping to Module Surfaces

### Phase 1.4 Manufacturing Setup
- Work Centers / Groups
  - UI: `/manufacturing/work-centers`, `/manufacturing/groups`
  - Backend: `/api/manufacturing/machines`, `/api/manufacturing/groups`
  - Required additions:
    - Standard working hours per center.
    - Overhead time/material consumption per hour.

### Phase 3.1 R&D & Design
- BOM + Routing + Costing
  - UI: `/manufacturing/bom`, `/manufacturing/routing`
  - Backend: `/api/manufacturing/bom`, `/api/manufacturing/routing`
  - Required additions:
    - Multi-level BOM handling and gain/loss material factors.
    - Routing-material linkage validation.
    - Cost forecast service (BOM + routing + WC rates).

### Phase 3.3 Production Execution
- Planning + Manufacturing Orders + Shop Floor
  - UI: `/manufacturing/planning`, `/manufacturing/orders`, `/manufacturing/work-orders`, `/manufacturing/quality`
  - Backend: planning/work-orders/quality API routes
  - Required additions:
    - Auto schedule by duration + machine availability.
    - Capacity exceed handling and partial production tracking.
    - Shop-floor transactions (real-time material out and FG in).
    - Scrap/by-product handling and QC gate by stage.

## 3) Unified Dependency Architecture (Must-Have)

### Data chain (authoritative)
1. Procurement GRN updates Inventory lots/batches.
2. Planning calculates material demand from BOM + forecast/SO.
3. Manufacturing order reserves inventory and generates work orders.
4. Work order execution posts:
   - RM consumption -> inventory out.
   - FG completion -> inventory in.
   - Scrap/by-product -> inventory adjustment records.
5. Finance receives accounting events:
   - WIP accumulation, variance, COGM/COGS impacts, and inventory valuation adjustments.

### Event contracts (recommended)
- `MO_CREATED`
- `MO_RELEASED`
- `WO_STARTED`
- `MATERIAL_CONSUMED`
- `WO_COMPLETED`
- `FG_RECEIVED`
- `SCRAP_RECORDED`
- `QC_PASSED` / `QC_FAILED`

Each event should include `sourceModule`, `sourceId`, `timestamp`, `performedBy`, and `journalReference` (if applicable).

## 4) Page-by-Page Backend Completion Plan

### `/manufacturing/bom`
- Convert all CTA buttons into modal forms with API mutation handlers.
- Enforce BOM validation:
  - No circular reference.
  - Valid UoM conversion.
  - Optional gain/loss % per material line.

### `/manufacturing/routing`
- Wire create/update buttons to API mutations.
- Enforce sequence uniqueness and machine availability constraints.

### `/manufacturing/planning`
- Replace static controls with live planning actions:
  - Generate plan.
  - Recalculate demand.
  - Raise procurement request when shortage detected.

### `/manufacturing/orders` and `/manufacturing/work-orders`
- Wire status transition buttons to backend state machine.
- Block illegal transitions (e.g. complete before consume/quality gate).

### `/manufacturing/quality`
- Wire pass/fail actions to quality API.
- On fail, trigger rework/scrap flow; on pass, unlock next execution stage.

### `/manufacturing/page` dashboard
- Replace remaining component-level mock widgets with API-backed reads.
- Keep dashboard read-only; mutations should route to operational pages.

## 5) Integration with Finance & Inventory

### Finance integration requirements
- Manufacturing completion should create journal candidates (or direct post where policy allows):
  - DR Finished Goods / CR WIP
  - Variance posting for over-consumption or scrap.
- Reference all postings with manufacturing order/work order IDs.

### Inventory integration requirements
- Reserve on MO release.
- Consume on WO execution.
- Receive FG on WO completion.
- Persist lot/serial and warehouse location transitions.

## 6) Implementation Order (Pragmatic)

1. Stabilize state transitions for MO/WO (`orders`, `work-orders`, `quality`).
2. Wire all create/edit/delete actions on master setup (`bom`, `routing`, `work-centers`, `groups`).
3. Implement planning-demand shortfall -> procurement request bridge.
4. Add automatic inventory + finance event posting from manufacturing execution.
5. Replace remaining dashboard mocks with live data providers.

## 7) Acceptance Criteria

- No primary action button on manufacturing pages is static.
- Every create/update transition persists to DB and survives reload.
- MO/WO lifecycle prevents invalid transitions.
- Inventory and finance side-effects are generated from execution events.
- Dashboard cards are fully API-driven (no mock arrays in production paths).
