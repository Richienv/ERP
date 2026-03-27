# Module Summary — Manufaktur (Manufacturing)

> Generated: 2026-03-27 | Verified: 2026-03-27
> Scope: All pages, components, APIs, and server actions under the Manufacturing module
> Source of truth: direct code reading of all 29 API route files, key pages, and all 9 test files

---

## 1. Documentation Coverage

| Metric | Count |
|--------|-------|
| Total checklist items | 109 |
| Detailed QA doc (full 9-section analysis) | 1 — `A1-dashboard-manufaktur.md` |
| Pages/routes catalogued | 34 |
| Dialogs/modals catalogued | 18 |
| BOM canvas components catalogued | 13 |
| Dashboard visualizations catalogued | 13 |
| API endpoints catalogued | 29 |
| Server actions catalogued | 2 |
| Existing automated test cases | 70 across 9 files |

### Detailed QA Doc

| # | Subpage | Doc file | Issues found |
|---|---------|----------|-------------|
| A1-A3 | Dashboard Manufaktur + StationWorkloadTimeline + Error boundary | `A1-dashboard-manufaktur.md` | 14 issues (5 bugs, 5 inconsistencies, 4 missing features) |

All other items were reviewed at the code level during module-summary preparation. Findings are consolidated in sections 2-5 below.

---

## 2. Key Findings

### 2.1 Production Workflow (Work Orders)

**State machine** — defined in `app/api/manufacturing/work-orders/[id]/route.ts:35-41`:

```
PLANNED ──> IN_PROGRESS, ON_HOLD, CANCELLED
IN_PROGRESS ──> ON_HOLD, CANCELLED, COMPLETED
ON_HOLD ──> IN_PROGRESS, CANCELLED
COMPLETED ──> (terminal)
CANCELLED ──> (terminal)
```

Enforced by `assertWorkOrderTransition()` — throws on invalid transitions.

**Strengths:**
- Two WO types: **SPK** (`SPK-00001`) and **MO** (`MO-00001`), selected at creation via `orderType` param
- REPORT_PRODUCTION action: posts partial qty, creates inventory transactions (PRODUCTION_OUT for materials, PRODUCTION_IN for finished goods), posts GL journals, updates actualQty
- PRODUCTION_RETURN action: fully reverses material consumption, stock, and GL entries with Bahasa error messages
- Stock reservation: material reserved on transition to IN_PROGRESS (`reserveStockForWorkOrder`), released on CANCELLED/COMPLETED (`releaseReservationsForWorkOrder`)
- Actual cost on completion: `lib/wo-cost-helpers.ts` calculates material + labor + overhead using Indonesian standard 172h/month, stores variance percentage
- Delete guard: cannot delete WO with inventory transactions

**Concerns:**
- Stock reservation runs **outside** `prisma.$transaction()` — errors are caught and logged but the WO status change has already committed (lines 839-851)
- Auto-completion: marking a WO as COMPLETED auto-produces `plannedQty - actualQty` without user confirmation (lines 774-810)
- Production return uses BOM waste-adjusted rates from current BOM state, which may not match what was actually consumed if BOM was modified between production and return

### 2.2 BOM Accuracy & Costing

**Two BOM systems coexist:**

| System | Model | Editor | Used for production posting |
|--------|-------|--------|----------------------------|
| Legacy | `BillOfMaterials` / `BOMItem` | Simple form (B1 dialog) | **Yes** — `work-orders/[id]/route.ts:146` uses `product.BillOfMaterials[0]` |
| New | `ProductionBOM` / `ProductionBOMStep` / `ProductionBOMItem` | Canvas (ReactFlow, A7) | **Indirectly** — `wo-cost-helpers.ts` uses `ProductionBOMItem` for cost calculation |

This dual system means production posting consumes materials from the legacy BOM, but cost calculation on completion may use ProductionBOM data. If both exist for the same product with different quantities, material consumption and cost will diverge.

**Production BOM canvas capabilities:**
- DAG-based step scheduling with `parentStepIds` for parallel processing
- Auto-save with local draft persistence (`use-auto-save.ts`)
- Critical path analysis (`use-critical-path.ts`)
- Price drift detection vs snapshot prices (`use-price-drift.ts`)
- Real-time stock availability check (`use-stock-availability.ts`)
- Subcontractor vs in-house allocation per step
- File attachments per step (Supabase storage)
- SPK generation from BOM steps with DAG-aware scheduling

**Cost formula (`lib/wo-cost-helpers.ts`):**
```
materialCost = SUM(itemQty * costPrice * (1 + wastePct/100)) * producedQty
laborCost    = (monthlySalary * timeUsedMinutes) / 10320   [172h * 60m]
overheadCost = laborCost * station.overheadPct / 100
actualTotal  = materialCost + laborCost + overheadCost
variancePct  = ((actualTotal - estimated) / estimated) * 100
```

Subcontractor steps excluded from labor/overhead (use `station.costPerUnit` instead).

### 2.3 Quality Control

**Architecture** (`app/api/manufacturing/quality/route.ts`):
- CRUD for `QualityInspection` with `InspectionDefect` child records
- Inspector validation: employee must have QC/Quality/Inspector keyword in `department` or `position` field
- Authorization: requires both Supabase auth AND employee context (non-super roles need linked employee record)
- Pending inspection queue: auto-surfaces WOs without inspections, ordered by due date
- Pass rate calculated from today's inspections in the paginated result (not a global metric)

**Specialized inspections (component-level only):**
- `fabric-inspection-dialog.tsx` (B10): 4-point grading system with defect location/type/points, live grade preview
- `garment-measurement-dialog.tsx` (B11): spec vs actual table with tolerance validation

**Concerns:**
- QC FAIL does not block WO progression — production can continue after a failed inspection
- Dashboard QC metrics (monthly `groupBy`) vs quality page metrics (today's paginated) use different calculation windows — can show different pass rates
- Fabric/garment inspection dialogs exist but all inspections funnel through the same single `QualityInspection` model — no separate 4-point or measurement data model

### 2.4 GL / Double-Entry Integration

**Journal entries posted by manufacturing** (only in `work-orders/[id]/route.ts`):

| Scenario | Debit | Credit | Account codes |
|----------|-------|--------|---------------|
| Production posting | WIP (1320) | Raw Materials (1310) | `SYS_ACCOUNTS.WIP`, `.RAW_MATERIALS` |
| Production posting | Inventory Asset (1300) | WIP (1320) | `SYS_ACCOUNTS.INVENTORY_ASSET`, `.WIP` |
| Production return | Raw Materials (1310) | WIP (1320) | Reverse of above |
| Production return | WIP (1320) | Inventory Asset (1300) | Reverse of above |

**Strengths:**
- Uses `SYS_ACCOUNTS` constants from `lib/gl-accounts.ts` (not hardcoded string literals)
- Balance validation: `Math.abs(totalDebit - totalCredit) > 0.01` throws before posting
- GL balance update respects account type via `ledgerBalanceDelta()` (ASSET/EXPENSE: debit-credit; LIABILITY/REVENUE/EQUITY: credit-debit)
- All production + return operations wrapped in `prisma.$transaction()`

**Concerns:**
- **Local journal function**: `postJournalWithBalanceUpdate()` is defined inline in the work-orders route (lines 57-111), NOT using the shared `postJournalEntry()` from `lib/actions/finance-gl.ts` — two divergent implementations exist
- **No `ensureSystemAccounts()` call**: GL accounts 1300, 1310, 1320 must pre-exist in the database or posting crashes with "GL account not configured"
- **No COGS posting**: material stays in Inventory Asset (1300) after WO completion — COGS recognition presumably happens at invoice time but this is not enforced or documented

---

## 3. All Issues — Prioritized by Severity

### CRITICAL (5) — Production / Data Integrity / Security

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | **12 API route files have NO authentication** — covers work-orders (CRUD + production posting + return), machines, routing, groups, dashboard, legacy BOM, planning | `work-orders/route.ts`, `work-orders/[id]/route.ts`, `machines/route.ts`, `machines/[id]/route.ts`, `routing/route.ts`, `routing/[id]/route.ts`, `groups/route.ts`, `groups/[id]/route.ts`, `dashboard/route.ts`, `bom/route.ts`, `bom/[id]/route.ts`, `bom/[id]/cost/route.ts`, `planning/route.ts` | Unauthenticated callers can: create/delete work orders, trigger REPORT_PRODUCTION (posts to GL + modifies stock), delete machines, modify routings. **PATCH work-orders is the most dangerous — triggers stock changes + GL postings without any auth.** |
| C2 | **`ensureSystemAccounts()` never called in manufacturing** — journal entries reference GL accounts 1300, 1310, 1320 but never verify they exist before posting | `work-orders/[id]/route.ts:268-284` | On fresh DB or after GL deletion, production completion crashes with "GL account not configured: 1320". WO gets stuck in IN_PROGRESS because the transaction rolls back, but stock reservation (outside the transaction) may have already been released. |
| C3 | **Two divergent journal posting functions** — manufacturing uses local `postJournalWithBalanceUpdate()` (57 lines, inline), finance uses shared `postJournalEntry()` from `lib/actions/finance-gl.ts` | `work-orders/[id]/route.ts:57-111` | Bug fixes or enhancements to the shared function (audit trail, multi-currency, approval workflow) will not apply to manufacturing journal entries. The local function also lacks the `ensureSystemAccounts()` guard the shared one may have. |
| C4 | **WO auto-completion posts phantom production** — transitioning to COMPLETED auto-produces `plannedQty - actualQty` units via `executeProductionPosting()` | `work-orders/[id]/route.ts:774-810` | Example: WO planned 1000, only 200 actually produced. Marking COMPLETED auto-posts 800 phantom units to inventory + GL. No confirmation dialog. User may intend to close a partial WO. |
| C5 | **Stock reservation is non-blocking** — runs AFTER the main `prisma.$transaction` commits, errors silently caught | `work-orders/[id]/route.ts:839-851` | WO transitions to IN_PROGRESS successfully, but if reservation fails (e.g. stock levels don't exist), materials are not reserved. Other WOs can consume the same stock, leading to double-allocation. |

### MEDIUM (10) — Functionality / UX

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | **Legacy BOM vs Production BOM confusion** — production posting consumes from `BillOfMaterials[0]`, but canvas editor and cost calc use `ProductionBOM` | `work-orders/[id]/route.ts:146` vs `wo-cost-helpers.ts:35` | If both exist with different quantities/materials, consumption and costing will diverge |
| M2 | **QC failure doesn't block production** — FAIL inspection creates a record but has no effect on WO status or dashboard alerts | `quality/route.ts` POST handler | Defective batches continue through production unchecked; no integration point between QC and WO workflow |
| M3 | **OEE includes idle machines in availability** — `(running + idle) / total` inflates the metric | `dashboard/route.ts:106-108` | Industry standard OEE measures running time vs scheduled time. Including idle artificially boosts availability. |
| M4 | **Dashboard dual data flows** — `useMfgDashboard` hook (TanStack Query) + inline `fetchDashboard` (local state) bypass each other's cache | `manufacturing-dashboard-client.tsx:94-110` | Manual refresh writes to local state only; TanStack cache stays stale until remount |
| M5 | **Collapsed timeline rows — dead code** — `collapsedRows` Set is maintained and `toggleRow` is wired to clicks, but no rendering logic uses it | `station-workload-timeline.tsx:252-259` | Clicking station labels in sidebar changes state with no visual feedback |
| M6 | **Mixed EN/ID language** — KPI labels ("In Progress", "Pass Rate", "Availability"), alert messages ("Machine Breakdown"), status labels ("Planned") are English; others are Bahasa | Dashboard client + API routes | Violates project's "Bahasa Indonesia first" policy |
| M7 | **"Buat Order" CTA links to list** — primary action button navigates to `/manufacturing/orders` (the list page) instead of opening a create dialog | `manufacturing-dashboard-client.tsx:150-154` | Extra clicks for the most frequent action |
| M8 | **Info alert uses amber icon** — when `alert.type === 'info'`, the else-branch renders `AlertTriangle` (amber) instead of an info icon (blue) | `manufacturing-dashboard-client.tsx:172-175` | Blue background + amber icon visual mismatch |
| M9 | **Silent refresh failure** — `fetchDashboard` catches errors with `console.error` only | `manufacturing-dashboard-client.tsx:105-108` | User sees spinner, then nothing — no toast or error state |
| M10 | **`recentInspections` fetched but unused** — dashboard API queries 5 recent inspections, client never renders them | `dashboard/route.ts:67-75` | Wasted DB query per dashboard load |

### LOW (6) — Polish / Enhancement

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| L1 | **No date range on dashboard** — always shows current month | `manufacturing-dashboard-client.tsx` | Cannot view historical production metrics |
| L2 | **No drill-down from KPI cards** — OEE/Availability/Performance/Quality cards are not clickable | `manufacturing-dashboard-client.tsx:188-261` | Missed navigation to detailed breakdowns |
| L3 | **No auto-refresh** — subtitle says "real-time" but data loads once on mount | `manufacturing-dashboard-client.tsx` | Stale data on monitoring screens |
| L4 | **Timeline has no zoom** — fixed 3px/minute scale | `station-workload-timeline.tsx:45` | Long production runs create very wide charts requiring extensive horizontal scroll |
| L5 | **Alert messages in English** — "Machine Breakdown", "Quality Alert", "Maintenance Required" | `dashboard/route.ts:114-135` | Should be Bahasa for Indonesian SME users |
| L6 | **WO number generation race condition** — `findFirst` + increment without transaction; `@unique` constraint on `number` field catches duplicates as a DB error instead of graceful retry | `work-orders/route.ts:197-214` | Concurrent WO creates get a Prisma unique constraint error (500 response). Note: generate-spk route correctly uses `$transaction` for the same pattern — inconsistency. |

---

## 4. Missing Test Coverage

### Existing Tests (verified — 70 test cases across 9 files)

| Test File | Cases | Covers |
|-----------|-------|--------|
| `manufacturing/bom-cost-helpers.test.ts` | 9 | Overhead, labor, HPP per-piece calculation |
| `manufacturing/bom-step-helpers.test.ts` | 10 | Step target qty, critical path duration, DAG scheduling |
| `manufacturing/critical-path.test.ts` | 4 | Critical path identification in step DAGs |
| `manufacturing/price-drift.test.ts` | 5 | Material cost drift detection (naik/turun/null) |
| `manufacturing/stock-availability.test.ts` | 4 | Stock status classification (cukup/hampir-habis/kurang) |
| `manufacturing/use-auto-save-helpers.test.ts` | 5 | Draft comparison, serialization round-trip |
| `bom-costing.test.ts` | 12 | Full BOM cost with waste, edge cases (zero, strings, negative) |
| `material-variance.test.ts` | 6 | Planned vs actual variance (BOROS/HEMAT/SESUAI, 2% tolerance) |
| `cross-module-consistency.test.ts` | 15 | Product/Customer/Supplier entity sharing, stock qty consistency, order status flow across modules |

### What IS covered

- BOM costing formulas (material, labor, overhead, waste %)
- DAG scheduling (critical path, step targets, parallel branches)
- Price drift detection
- Stock status classification
- Auto-save serialization
- Cross-module entity sharing and status mapping

### What is NOT covered (critical gaps, ordered by priority)

| Priority | Area | Why it matters | What to test |
|----------|------|---------------|-------------|
| **P0** | WO state machine transitions | Core workflow — invalid transitions could corrupt production flow | Every valid transition pair; every invalid pair throws; concurrent status changes |
| **P0** | Production posting (REPORT_PRODUCTION) | Creates inventory transactions + GL entries — errors mean financial data corruption | Stock decrement per BOM item, FG increment, waste calculation, GL journal balance, overproduction guard (`actualQty > plannedQty`), insufficient stock error |
| **P0** | Production return (PRODUCTION_RETURN) | Reversal must exactly mirror original posting | Stock reversal, GL reversal, partial return, return > actualQty guard, BOM-matched qty |
| **P0** | GL journal entry balance | Financial integrity — unbalanced books break reports | Balanced entries post successfully, unbalanced throw, missing GL account handled, `ledgerBalanceDelta` for each account type |
| **P1** | Stock reservation lifecycle | Prevents double-allocation of materials | Reserve on IN_PROGRESS, release on CANCELLED, consumed tracking on production, partial reservation when stock insufficient |
| **P1** | Actual cost calculation | Feeds cost variance and product costing | Full formula (material + labor + overhead), subcontractor exclusion, zero edge cases, variance percentage |
| **P1** | WO auto-completion | Silently posts phantom production | remaining=0 case (no posting), remaining>0 case (auto-posts), warehouse selection fallback |
| **P1** | API authentication | Security — 12 routes currently unprotected | Protected routes reject unauthenticated requests; unprotected routes identified and flagged |
| **P2** | QC inspection creation | Inspector validation is keyword-based | Only QC employees accepted, non-QC rejected, defect creation, actor authorization |
| **P2** | WO number generation | Concurrent creates can fail | Sequential numbering, SPK vs MO prefix, unique constraint conflict handling |
| **P2** | BOM canvas save (PATCH) | Complex change detection logic | Step add/update/delete, material reassignment, allocation changes, attachment handling |
| **P2** | SPK generation from BOM | DAG-to-WO conversion | Step ordering preserved, sequence numbering, parent step dependency |
| **P3** | Material demand calculation | Planning accuracy | Shortage detection, stock + on-order aggregation, BOM qty multiplication |
| **P3** | Dashboard OEE | Edge cases affect displayed metrics | 0 machines, 0 production, 0 inspections, all machines idle |

---

## 5. Recommended QA Test Cases for Stakeholder Demo

### Scenario 1: End-to-End Production Flow (Happy Path)

> **Goal:** Full cycle from BOM creation to completed goods with GL verification
> **Estimated time:** 15 minutes

| Step | Action | Verify |
|------|--------|--------|
| 1 | `/manufacturing/bom` — create Production BOM with 2 materials, 3 stations (Cutting > Sewing > QC) | BOM in list; canvas shows connected nodes |
| 2 | Open canvas, edit a station's duration, wait 3s | Auto-save triggers; edit history drawer shows change |
| 3 | Click "Generate SPK" from BOM detail | SPK work orders created per station, `SPK-YYYYMM-XXXX` numbers, status PLANNED |
| 4 | `/manufacturing/work-orders` — find SPKs | SPKs visible with correct product, qty, status badges |
| 5 | Create manual MO via create dialog | `MO-XXXXX` number, status PLANNED |
| 6 | Transition MO to IN_PROGRESS | Start date set; stock reserved for BOM materials |
| 7 | Report 50% production | actualQty increases; progress = 50%; inventory transactions visible |
| 8 | Report remaining 50% | Status auto-transitions to COMPLETED; actual cost + variance calculated |
| 9 | `/manufacturing` dashboard | OEE updates; completed order in recent list |

### Scenario 2: Quality Control Flow

> **Goal:** Inspection lifecycle and metrics accuracy
> **Estimated time:** 10 minutes

| Step | Action | Verify |
|------|--------|--------|
| 1 | `/manufacturing/quality` | Pending queue shows WOs without inspections |
| 2 | Create PASS inspection for a WO | Appears in list; pass rate updates |
| 3 | Create FAIL inspection with 2 defects | Defects recorded; fail count rises; pass rate drops |
| 4 | Open fabric inspection dialog | 4-point defect entry; live grade calculates |
| 5 | Open garment measurement dialog | Spec vs actual table; tolerance validation works |
| 6 | Dashboard — check QC cards | Pass Rate, Total Inspeksi, Lolos, Gagal reflect changes |

### Scenario 3: Production Return (Retur Produksi)

> **Goal:** Material reversal and GL accuracy
> **Estimated time:** 10 minutes

| Step | Action | Verify |
|------|--------|--------|
| 1 | Find COMPLETED WO with actualQty > 0 | Production history visible |
| 2 | Execute partial return (e.g. 10 of 100) | actualQty decreases by 10 |
| 3 | Check stock levels | FG stock -10; raw materials restored (BOM-adjusted qty) |
| 4 | Check GL journal entries | 2 reversing entries: DR Raw Materials / CR WIP, DR WIP / CR Inventory Asset |
| 5 | Return all remaining qty | Status reverts to IN_PROGRESS (actualQty = 0) |

### Scenario 4: Dashboard & Planning Walkthrough

> **Goal:** Monitoring capabilities for management audience
> **Estimated time:** 8 minutes

| Step | Action | Verify |
|------|--------|--------|
| 1 | `/manufacturing` | OEE donut, 4 KPI cards, machine status, recent orders, QC summary |
| 2 | Click refresh | Spinner animates; data refreshes |
| 3 | Scroll to Station Workload Timeline | Bars per station, color-coded by product |
| 4 | Filter by one BOM | Only that BOM's steps shown; KPIs update |
| 5 | Click a bar | Detail panel: station, operator, duration, progress, status |
| 6 | `/manufacturing/planning` | MPS table, Gantt chart, station workload tabs |
| 7 | `/manufacturing/material-demand` | Material list with Cukup/Perlu Pesan/Kurang status |

### Scenario 5: Security Smoke Test (Internal QA Only)

> **Goal:** Verify authentication gaps
> **Estimated time:** 5 minutes

| Step | cURL Command | Expected (correct) | Actual (current) |
|------|-------------|---------------------|-------------------|
| 1 | `curl /api/manufacturing/work-orders` (no cookie) | 401 Unauthorized | **200 + data** |
| 2 | `curl -X POST /api/manufacturing/work-orders -d '{"productId":"...","plannedQty":1}'` | 401 | **201 Created** |
| 3 | `curl -X PATCH /api/manufacturing/work-orders/{id} -d '{"action":"REPORT_PRODUCTION","quantityProduced":1}'` | 401 | **200 + GL posted** |
| 4 | `curl -X DELETE /api/manufacturing/machines/{id}` | 401 | **200 Deleted** |

### Scenario 6: BOM Canvas Power Features

> **Goal:** Demonstrate visual BOM editor depth
> **Estimated time:** 10 minutes

| Step | Action | Verify |
|------|--------|--------|
| 1 | Create BOM with 5+ stations including parallel branches | Canvas layout auto-arranges |
| 2 | Right-click a node | Context menu with edit/delete/add child options |
| 3 | Open detail panel for a step | Duration, operator, allocation, materials, attachments all editable |
| 4 | Add subcontractor allocation to a step | Subkon selector populates; allocation split visible |
| 5 | Check BOM cost card | Material + labor + overhead breakdown; HPP per unit calculated |
| 6 | View edit history | Drawer shows timestamped changes |
| 7 | Generate PDF | BOM document with steps and costs |
