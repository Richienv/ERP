# QA Checklist — Modul Manufaktur

> Generated: 2026-03-27 | Last updated: 2026-03-27
> Module summary: [`_module-summary.md`](./_module-summary.md)
>
> Status legend:
> - ✅ **Done** = detailed QA doc written (full 9-section analysis)
> - ✅ **Reviewed** = source code read; findings in module summary

---

## A. Pages & Routes

| # | Subpage/Feature | File Path | Route | Status |
|---|----------------|-----------|-------|--------|
| A1 | Dashboard Manufaktur (OEE, mesin, alert) | `app/manufacturing/page.tsx` | `/manufacturing` | ✅ Done |
| A2 | Dashboard — client interactivity | `app/manufacturing/manufacturing-dashboard-client.tsx` | — | ✅ Done |
| A3 | Error boundary (module-wide) | `app/manufacturing/error.tsx` | — | ✅ Done |
| A4 | Daftar BOM (list, search, filter) | `app/manufacturing/bom/page.tsx` | `/manufacturing/bom` | ✅ Reviewed |
| A5 | BOM list — client interactivity | `app/manufacturing/bom/bom-client.tsx` | — | ✅ Reviewed |
| A6 | BOM list — loading skeleton | `app/manufacturing/bom/loading.tsx` | — | ✅ Reviewed |
| A7 | BOM Detail / Canvas Editor | `app/manufacturing/bom/[id]/page.tsx` | `/manufacturing/bom/[id]` | ✅ Reviewed |
| A8 | BOM Canvas Context (state provider) | `app/manufacturing/bom/[id]/bom-canvas-context.tsx` | — | ✅ Reviewed |
| A9 | BOM hook: Auto-save | `app/manufacturing/bom/[id]/hooks/use-auto-save.ts` | — | ✅ Reviewed |
| A10 | BOM hook: Critical path | `app/manufacturing/bom/[id]/hooks/use-critical-path.ts` | — | ✅ Reviewed |
| A11 | BOM hook: Price drift | `app/manufacturing/bom/[id]/hooks/use-price-drift.ts` | — | ✅ Reviewed |
| A12 | BOM hook: Stock availability | `app/manufacturing/bom/[id]/hooks/use-stock-availability.ts` | — | ✅ Reviewed |
| A13 | Work Orders (SPK + MO + Jadwal) | `app/manufacturing/work-orders/page.tsx` | `/manufacturing/work-orders` | ✅ Reviewed |
| A14 | Work Orders — client (SPK tab) | `app/manufacturing/work-orders/work-orders-client.tsx` | — | ✅ Reviewed |
| A15 | Production Orders (redirect to work-orders) | `app/manufacturing/orders/page.tsx` | `/manufacturing/orders` | ✅ Reviewed |
| A16 | Production Orders — client (MO tab) | `app/manufacturing/orders/orders-client.tsx` | — | ✅ Reviewed |
| A17 | Production Orders — loading skeleton | `app/manufacturing/orders/loading.tsx` | — | ✅ Reviewed |
| A18 | Perencanaan / MPS (3 tabs: MPS, Gantt, Workload) | `app/manufacturing/planning/page.tsx` | `/manufacturing/planning` | ✅ Reviewed |
| A19 | Planning — client interactivity | `app/manufacturing/planning/planning-client.tsx` | — | ✅ Reviewed |
| A20 | Planning — loading skeleton | `app/manufacturing/planning/loading.tsx` | — | ✅ Reviewed |
| A21 | Jadwal Produksi (schedule view) | `app/manufacturing/schedule/page.tsx` | `/manufacturing/schedule` | ✅ Reviewed |
| A22 | Schedule — client interactivity | `app/manufacturing/schedule/schedule-page-client.tsx` | — | ✅ Reviewed |
| A23 | Quality Control (inspeksi, pass rate) | `app/manufacturing/quality/page.tsx` | `/manufacturing/quality` | ✅ Reviewed |
| A24 | Quality — client interactivity | `app/manufacturing/quality/quality-client.tsx` | — | ✅ Reviewed |
| A25 | Quality — loading skeleton | `app/manufacturing/quality/loading.tsx` | — | ✅ Reviewed |
| A26 | Routing (daftar routing produksi) | `app/manufacturing/routing/page.tsx` | `/manufacturing/routing` | ✅ Reviewed |
| A27 | Routing — client interactivity | `app/manufacturing/routing/routing-client.tsx` | — | ✅ Reviewed |
| A28 | Work Center Groups (grup mesin) | `app/manufacturing/groups/page.tsx` | `/manufacturing/groups` | ✅ Reviewed |
| A29 | Groups — client interactivity | `app/manufacturing/groups/groups-client.tsx` | — | ✅ Reviewed |
| A30 | Work Centers / Stasiun Kerja | `app/manufacturing/work-centers/page.tsx` | `/manufacturing/work-centers` | ✅ Reviewed |
| A31 | Work Centers — stasiun client | `app/manufacturing/work-centers/stasiun-client.tsx` | — | ✅ Reviewed |
| A32 | Work Centers — work-centers client | `app/manufacturing/work-centers/work-centers-client.tsx` | — | ✅ Reviewed |
| A33 | Process Stations (stasiun proses) | `app/manufacturing/processes/page.tsx` | `/manufacturing/processes` | ✅ Reviewed |
| A34 | Material Demand Analysis | `app/manufacturing/material-demand/page.tsx` | `/manufacturing/material-demand` | ✅ Reviewed |

---

## B. Dialogs & Modals

| # | Dialog/Modal | File Path | Triggered From | Status |
|---|-------------|-----------|----------------|--------|
| B1 | Create BOM Dialog (legacy) | `components/manufacturing/create-bom-dialog.tsx` | BOM list page | ✅ Reviewed |
| B2 | Create BOM Dialog (production) | `components/manufacturing/bom/create-bom-dialog.tsx` | BOM list page | ✅ Reviewed |
| B3 | Add Material Dialog | `components/manufacturing/bom/add-material-dialog.tsx` | BOM canvas editor | ✅ Reviewed |
| B4 | Create Station Dialog (in-house + subkon) | `components/manufacturing/bom/create-station-dialog.tsx` | BOM canvas editor | ✅ Reviewed |
| B5 | Template Manager Dialog | `components/manufacturing/bom/template-manager-dialog.tsx` | BOM canvas editor | ✅ Reviewed |
| B6 | Edit History Drawer | `components/manufacturing/bom/edit-history-drawer.tsx` | BOM canvas editor | ✅ Reviewed |
| B7 | Create Work Order Dialog | `components/manufacturing/create-work-order-dialog.tsx` | Work orders page | ✅ Reviewed |
| B8 | Schedule Work Order Dialog | `components/manufacturing/schedule-work-order-dialog.tsx` | Work orders / schedule | ✅ Reviewed |
| B9 | Create Inspection Dialog | `components/manufacturing/create-inspection-dialog.tsx` | Quality page | ✅ Reviewed |
| B10 | Fabric Inspection Dialog (4-point) | `components/manufacturing/fabric-inspection-dialog.tsx` | Quality page | ✅ Reviewed |
| B11 | Garment Measurement Dialog | `components/manufacturing/garment-measurement-dialog.tsx` | Quality page | ✅ Reviewed |
| B12 | Routing Form Dialog | `components/manufacturing/routing-form-dialog.tsx` | Routing page | ✅ Reviewed |
| B13 | Add Routing Step Dialog | `components/manufacturing/add-routing-step-dialog.tsx` | Routing page | ✅ Reviewed |
| B14 | Machine Form Dialog | `components/manufacturing/machine-form-dialog.tsx` | Work centers / machines | ✅ Reviewed |
| B15 | Group Form Dialog | `components/manufacturing/group-form-dialog.tsx` | Groups page | ✅ Reviewed |
| B16 | Assign Machine to Group Dialog | `components/manufacturing/assign-machine-group-dialog.tsx` | Groups page | ✅ Reviewed |
| B17 | Production Return Dialog | `components/manufacturing/production-return-dialog.tsx` | Work order detail | ✅ Reviewed |
| B18 | Shortage Dialog (material procurement) | `components/manufacturing/shortage-dialog.tsx` | Material demand / WO | ✅ Reviewed |

---

## C. BOM Canvas Components (visual editor)

| # | Component | File Path | Role | Status |
|---|-----------|-----------|------|--------|
| C1 | BOM Canvas (ReactFlow) | `components/manufacturing/bom/bom-canvas.tsx` | Main visual editor | ✅ Reviewed |
| C2 | Station Node | `components/manufacturing/bom/station-node.tsx` | Node rendering in canvas | ✅ Reviewed |
| C3 | Node Context Menu | `components/manufacturing/bom/node-context-menu.tsx` | Right-click menu on nodes | ✅ Reviewed |
| C4 | Detail Panel (step editor) | `components/manufacturing/bom/detail-panel.tsx` | Side panel for step details | ✅ Reviewed |
| C5 | Allocation Editor | `components/manufacturing/bom/allocation-editor.tsx` | Multi-WC allocation | ✅ Reviewed |
| C6 | In-house Allocator | `components/manufacturing/bom/inhouse-allocator.tsx` | In-house allocation UI | ✅ Reviewed |
| C7 | Subkon Selector | `components/manufacturing/bom/subkon-selector.tsx` | Subcontractor selection | ✅ Reviewed |
| C8 | Material Panel | `components/manufacturing/bom/material-panel.tsx` | Material display/mgmt | ✅ Reviewed |
| C9 | Timeline View | `components/manufacturing/bom/timeline-view.tsx` | Timeline visualization | ✅ Reviewed |
| C10 | BOM Cost Card | `components/manufacturing/bom/bom-cost-card.tsx` | Cost breakdown display | ✅ Reviewed |
| C11 | Station Config | `components/manufacturing/bom/station-config.ts` | Icon/color theme config | ✅ Reviewed |
| C12 | BOM Cost Helpers | `components/manufacturing/bom/bom-cost-helpers.ts` | Cost calculation utils | ✅ Reviewed |
| C13 | BOM Step Helpers | `components/manufacturing/bom/bom-step-helpers.ts` | Step processing utils | ✅ Reviewed |

---

## D. Dashboard & Visualization Components

| # | Component | File Path | Role | Status |
|---|-----------|-----------|------|--------|
| D1 | Production Gantt Chart | `components/manufacturing/dashboard/production-gantt.tsx` | Full Gantt schedule view | ✅ Reviewed |
| D2 | Station Workload Timeline | `components/manufacturing/dashboard/station-workload-timeline.tsx` | Per-station workload heatmap | ✅ Done |
| D3 | Planning Board | `components/manufacturing/dashboard/planning-board.tsx` | Interactive planning drag/drop | ✅ Reviewed |
| D4 | Production Health | `components/manufacturing/dashboard/production-health.tsx` | KPI health scores | ✅ Reviewed |
| D5 | Quality Workspace | `components/manufacturing/dashboard/quality-workspace.tsx` | QC dashboard widgets | ✅ Reviewed |
| D6 | Detailed Alerts | `components/manufacturing/dashboard/detailed-alerts.tsx` | Production alert list | ✅ Reviewed |
| D7 | Detailed Line Status | `components/manufacturing/dashboard/detailed-line-status.tsx` | Production line metrics | ✅ Reviewed |
| D8 | Material Impact | `components/manufacturing/dashboard/material-impact.tsx` | Material consumption analysis | ✅ Reviewed |
| D9 | People Overlay | `components/manufacturing/dashboard/people-overlay.tsx` | Workforce allocation | ✅ Reviewed |
| D10 | AI Coach | `components/manufacturing/dashboard/ai-coach.tsx` | AI production suggestions | ✅ Reviewed |
| D11 | Gantt Schedule (page-level) | `components/manufacturing/gantt-schedule.tsx` | Gantt chart (schedule page) | ✅ Reviewed |
| D12 | Garment Measurement Chart | `components/manufacturing/garment-measurement-chart.tsx` | Spec vs actual bar chart | ✅ Reviewed |
| D13 | Material Variance Section | `components/manufacturing/material-variance-section.tsx` | Cost variance KPI + table | ✅ Reviewed |

---

## E. API Routes

| # | Endpoint | File Path | Methods | Auth | Status |
|---|----------|-----------|---------|------|--------|
| E1 | Dashboard metrics | `app/api/manufacturing/dashboard/route.ts` | GET | **NO** | ✅ Done |
| E2 | BOM list + create | `app/api/manufacturing/bom/route.ts` | GET, POST | **NO** | ✅ Reviewed |
| E3 | BOM detail CRUD | `app/api/manufacturing/bom/[id]/route.ts` | GET, PATCH, DELETE | **NO** | ✅ Reviewed |
| E4 | BOM cost analysis | `app/api/manufacturing/bom/[id]/cost/route.ts` | GET, POST | YES | ✅ Reviewed |
| E5 | BOM templates list + create | `app/api/manufacturing/bom-templates/route.ts` | GET, POST | YES | ✅ Reviewed |
| E6 | BOM template delete | `app/api/manufacturing/bom-templates/[id]/route.ts` | DELETE | YES | ✅ Reviewed |
| E7 | Production BOM list + create | `app/api/manufacturing/production-bom/route.ts` | GET, POST | YES | ✅ Reviewed |
| E8 | Production BOM CRUD | `app/api/manufacturing/production-bom/[id]/route.ts` | GET, PATCH, DELETE | YES | ✅ Reviewed |
| E9 | Production BOM attachments | `app/api/manufacturing/production-bom/[id]/attachments/route.ts` | POST | YES | ✅ Reviewed |
| E10 | Production BOM generate SPK | `app/api/manufacturing/production-bom/[id]/generate-spk/route.ts` | POST | YES | ✅ Reviewed |
| E11 | Production BOM history | `app/api/manufacturing/production-bom/[id]/history/route.ts` | GET | YES | ✅ Reviewed |
| E12 | Production BOM PDF | `app/api/manufacturing/production-bom/[id]/pdf/route.ts` | GET | YES | ✅ Reviewed |
| E13 | Production BOM work orders | `app/api/manufacturing/production-bom/[id]/work-orders/route.ts` | DELETE | YES | ✅ Reviewed |
| E14 | BOM attachment delete | `app/api/manufacturing/production-bom-attachments/[id]/route.ts` | DELETE | YES | ✅ Reviewed |
| E15 | Work orders list + create | `app/api/manufacturing/work-orders/route.ts` | GET, POST | **NO** | ✅ Reviewed |
| E16 | Work order CRUD + production posting | `app/api/manufacturing/work-orders/[id]/route.ts` | GET, PATCH, DELETE | **NO** | ✅ Reviewed |
| E17 | Work order variance | `app/api/manufacturing/work-orders/[id]/variance/route.ts` | GET | YES | ✅ Reviewed |
| E18 | Quality inspections | `app/api/manufacturing/quality/route.ts` | GET, POST | YES | ✅ Reviewed |
| E19 | Machines list + create | `app/api/manufacturing/machines/route.ts` | GET, POST | **NO** | ✅ Reviewed |
| E20 | Machine CRUD | `app/api/manufacturing/machines/[id]/route.ts` | GET, PATCH, DELETE | **NO** | ✅ Reviewed |
| E21 | Groups list + create | `app/api/manufacturing/groups/route.ts` | GET, POST | **NO** | ✅ Reviewed |
| E22 | Group CRUD | `app/api/manufacturing/groups/[id]/route.ts` | GET, PATCH, DELETE | **NO** | ✅ Reviewed |
| E23 | Process stations | `app/api/manufacturing/process-stations/route.ts` | GET, POST, PATCH | YES | ✅ Reviewed |
| E24 | Process station CRUD | `app/api/manufacturing/process-stations/[id]/route.ts` | GET, PATCH, DELETE | YES | ✅ Reviewed |
| E25 | Routing list + create | `app/api/manufacturing/routing/route.ts` | GET, POST | **NO** | ✅ Reviewed |
| E26 | Routing CRUD | `app/api/manufacturing/routing/[id]/route.ts` | GET, PATCH, DELETE | **NO** | ✅ Reviewed |
| E27 | Planning / MPS data | `app/api/manufacturing/planning/route.ts` | GET | **NO** | ✅ Reviewed |
| E28 | Material demand | `app/api/manufacturing/material-demand/route.ts` | GET | YES | ✅ Reviewed |
| E29 | Station workload | `app/api/manufacturing/station-workload/route.ts` | GET | YES | ✅ Done |

**Auth summary: 17 routes protected, 12 routes unprotected (see issue C1 in module summary)**

---

## F. Server Actions

| # | Action | File Path | Purpose | Status |
|---|--------|-----------|---------|--------|
| F1 | getWorkOrdersByStage() | `lib/actions/manufacturing-garment.ts` | Kanban WO by garment stage | ✅ Reviewed |
| F2 | detectWorkOrderShortages() | `lib/actions/manufacturing-procurement.ts` | Material shortage detection | ✅ Reviewed |

---

## Summary

| Section | Count | ✅ Done | ✅ Reviewed |
|---------|-------|--------|------------|
| A. Pages & Routes | 34 | 3 | 31 |
| B. Dialogs & Modals | 18 | 0 | 18 |
| C. BOM Canvas Components | 13 | 0 | 13 |
| D. Dashboard & Visualization | 13 | 1 | 12 |
| E. API Routes | 29 | 3 | 26 |
| F. Server Actions | 2 | 0 | 2 |
| **Total** | **109** | **7** | **102** |

> **All 109 items confirmed ✅.**
> 7 items have full detailed QA documentation; 102 reviewed at code level.
> See [`_module-summary.md`](./_module-summary.md) for consolidated findings: **21 issues (5 critical, 10 medium, 6 low)**.
