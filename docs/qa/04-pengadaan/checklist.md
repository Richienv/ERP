# QA Checklist — Modul Pengadaan (Procurement)

> **Module scope:** Purchase Requests, Purchase Orders, Goods Receiving (GRN), Vendor Management, Returns, Direct Purchase, Analytics, and cross-module integrations.
>
> **Status legend:** ⬜ Not tested | ✅ Pass | ❌ Fail | ⚠️ Partial/Issue

---

## A. Pages & Routes

| # | Subpage / Feature | File Path | Route | Status |
|---|-------------------|-----------|-------|--------|
| A1 | Dashboard Pengadaan (KPI, registry, activity) | `app/procurement/page.tsx` | `/procurement` | ✅ [QA](01-dashboard-pengadaan.md) |
| A2 | Error boundary (global fallback) | `app/procurement/error.tsx` | `/procurement` (error) | ✅ [QA](01-dashboard-pengadaan.md) |
| A3 | Purchase Orders — list page | `app/procurement/orders/page.tsx` | `/procurement/orders` | ⬜ |
| A4 | Purchase Orders — loading skeleton | `app/procurement/orders/loading.tsx` | `/procurement/orders` (loading) | ⬜ |
| A5 | Receiving / GRN — list page | `app/procurement/receiving/page.tsx` | `/procurement/receiving` | ⬜ |
| A6 | Receiving / GRN — loading skeleton | `app/procurement/receiving/loading.tsx` | `/procurement/receiving` (loading) | ⬜ |
| A7 | Purchase Requests — list page | `app/procurement/requests/page.tsx` | `/procurement/requests` | ⬜ |
| A8 | Purchase Requests — loading skeleton | `app/procurement/requests/loading.tsx` | `/procurement/requests` (loading) | ⬜ |
| A9 | Create New Purchase Request — form page | `app/procurement/requests/new/page.tsx` | `/procurement/requests/new` | ⬜ |
| A10 | Vendors — list page | `app/procurement/vendors/page.tsx` | `/procurement/vendors` | ⬜ |
| A11 | Vendor Payments (Finance cross-module) | `app/finance/vendor-payments/page.tsx` | `/finance/vendor-payments` | ⬜ |

---

## B. Dashboard Pengadaan (`/procurement`)

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| B1 | KPI cards (monthly spend, vendor health, urgent restocks, incoming) | `app/procurement/page.tsx` | ⬜ |
| B2 | Approval center — pending POs & PRs list | `components/procurement/inline-approval-list.tsx` | ⬜ |
| B3 | Inline approve / reject actions | `components/procurement/inline-approval-list.tsx` | ⬜ |
| B4 | PO registry table with pagination | `app/procurement/page.tsx` | ⬜ |
| B5 | PR registry table with pagination | `app/procurement/page.tsx` | ⬜ |
| B6 | GRN registry table with pagination | `app/procurement/page.tsx` | ⬜ |
| B7 | Status filter per registry (po_status, pr_status, grn_status) | `app/procurement/page.tsx` | ⬜ |
| B8 | Recent activity log | `app/procurement/page.tsx` | ⬜ |
| B9 | Quick-action links (Requests, Vendors, Create Request) | `app/procurement/page.tsx` | ⬜ |
| B10 | Direct Purchase button + dialog | `components/procurement/direct-purchase-dialog.tsx` | ⬜ |
| B11 | Action Center widget (RFQ, PO, Invoice sections) | `components/procurement/action-center.tsx` | ⬜ |
| B12 | Procurement pipeline chart (RFQ + PO stages) | `components/procurement/procurement-pipeline.tsx` | ⬜ |
| B13 | Spend analytics by category (bar chart) | `components/procurement/spend-analytics.tsx` | ⬜ |
| B14 | Module navigation shortcuts | `components/procurement/procurement-modules.tsx` | ⬜ |
| B15 | Performance prefetch provider | `components/procurement/procurement-performance-provider.tsx` | ⬜ |

---

## C. Purchase Requests (`/procurement/requests`)

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| C1 | PR list with status badges (Draft/Pending/Approved/Rejected/Cancelled/PO Created) | `components/procurement/request-list.tsx` | ⬜ |
| C2 | Search / filter PR list | `components/procurement/request-list.tsx` | ⬜ |
| C3 | Create new PR — dialog (from list page) | `components/procurement/new-pr-dialog.tsx` | ⬜ |
| C4 | Create new PR — full form page (`/procurement/requests/new`) | `components/procurement/create-request-form.tsx` | ⬜ |
| C5 | Product selection in PR items | `components/procurement/create-request-form.tsx` | ⬜ |
| C6 | Quantity + preferred supplier per item | `components/procurement/create-request-form.tsx` | ⬜ |
| C7 | Priority selection (Low / Normal / High) | `components/procurement/create-request-form.tsx` | ⬜ |
| C8 | Requester (employee) selection | `components/procurement/create-request-form.tsx` | ⬜ |
| C9 | Add / remove item rows dynamically | `components/procurement/create-request-form.tsx` | ⬜ |
| C10 | Submit PR (status → PENDING) | `lib/actions/procurement.ts` → `createPurchaseRequest()` | ⬜ |
| C11 | Approve PR (role-guarded) | `lib/actions/procurement.ts` → `approvePurchaseRequest()` | ⬜ |
| C12 | Reject PR with reason | `lib/actions/procurement.ts` → `rejectPurchaseRequest()` | ⬜ |
| C13 | Approve + auto-create PO from PR | `lib/actions/procurement.ts` → `approveAndCreatePOFromPR()` | ⬜ |
| C14 | Convert selected PR items to PO | `lib/actions/procurement.ts` → `convertPRToPO()` | ⬜ |
| C15 | Back navigation to `/procurement/requests` | `app/procurement/requests/new/page.tsx` | ⬜ |

---

## D. Purchase Orders (`/procurement/orders`)

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| D1 | PO list table with all statuses | `app/procurement/orders/orders-view.tsx` | ⬜ |
| D2 | Search by PO number or vendor name | `app/procurement/orders/orders-view.tsx` | ⬜ |
| D3 | Status filter (All / Active / Approved / Completed) | `app/procurement/orders/orders-view.tsx` | ⬜ |
| D4 | Excel export of PO list | `app/procurement/orders/orders-view.tsx` | ⬜ |
| D5 | Highlight newly created PO (via `?highlight=` query param) | `app/procurement/orders/orders-view.tsx` | ⬜ |
| D6 | Auto-scroll to highlighted PO | `app/procurement/orders/orders-view.tsx` | ⬜ |
| D7 | Create new PO — dialog | `components/procurement/new-po-dialog.tsx` | ⬜ |
| D8 | PO creation: vendor selection | `components/procurement/new-po-dialog.tsx` | ⬜ |
| D9 | PO creation: create vendor on-the-fly | `components/procurement/new-po-dialog.tsx` | ⬜ |
| D10 | PO creation: add/remove line items | `components/procurement/new-po-dialog.tsx` | ⬜ |
| D11 | PO creation: tax calculation (PPN / NON_PPN) | `components/procurement/new-po-dialog.tsx` | ⬜ |
| D12 | PO creation: subtotal, tax, grand total | `components/procurement/new-po-dialog.tsx` | ⬜ |
| D13 | PO creation: payment terms selection | `components/procurement/new-po-dialog.tsx` | ⬜ |
| D14 | PO template: save current PO as template | `components/procurement/po-template-selector.tsx` | ⬜ |
| D15 | PO template: create PO from template | `components/procurement/po-template-selector.tsx` | ⬜ |
| D16 | PO detail sheet — view full details | `components/procurement/po-details-sheet.tsx` | ⬜ |
| D17 | PO detail sheet — status badge + timeline | `components/procurement/po-details-sheet.tsx` | ⬜ |
| D18 | PO detail sheet — approve action | `components/procurement/po-details-sheet.tsx` | ⬜ |
| D19 | PO detail sheet — reject with reason | `components/procurement/po-details-sheet.tsx` | ⬜ |
| D20 | PO detail sheet — mark as ordered | `components/procurement/po-details-sheet.tsx` | ⬜ |
| D21 | PO detail sheet — vendor confirmed | `components/procurement/po-details-sheet.tsx` | ⬜ |
| D22 | PO detail sheet — mark as shipped (tracking number) | `components/procurement/po-details-sheet.tsx` | ⬜ |
| D23 | PO detail sheet — SoD violation checking | `components/procurement/po-details-sheet.tsx` | ⬜ |
| D24 | PO finalize dialog — confirm + PDF preview | `components/procurement/po-finalize-dialog.tsx` | ⬜ |
| D25 | PO finalize dialog — items table with totals | `components/procurement/po-finalize-dialog.tsx` | ⬜ |
| D26 | PO finalize dialog — PDF generation + download | `components/procurement/po-finalize-dialog.tsx` | ⬜ |
| D27 | Mark as Ordered action | `lib/actions/procurement.ts` → `markAsOrdered()` | ⬜ |
| D28 | Submit PO for approval | `lib/actions/procurement.ts` → `submitPOForApproval()` | ⬜ |
| D29 | Approve PO (role-guarded) | `lib/actions/procurement.ts` → `approvePurchaseOrder()` | ⬜ |
| D30 | Reject PO with reason | `lib/actions/procurement.ts` → `rejectPurchaseOrder()` | ⬜ |
| D31 | Cancel PO with reason | `lib/actions/procurement.ts` → `cancelPurchaseOrder()` | ⬜ |
| D32 | Update PO vendor | `lib/actions/procurement.ts` → `updatePurchaseOrderVendor()` | ⬜ |
| D33 | Update PO tax mode (PPN / NON_PPN) | `lib/actions/procurement.ts` → `updatePurchaseOrderTaxMode()` | ⬜ |
| D34 | PO state machine — valid transitions only | `lib/po-state-machine.ts` | ⬜ |
| D35 | PO PDF generation via API | `app/api/documents/purchase-order/[id]/route.ts` | ⬜ |
| D36 | PO PDF — inline vs attachment disposition | `app/api/documents/purchase-order/[id]/route.ts` | ⬜ |
| D37 | PO audit trail (PurchaseOrderEvent) | `lib/actions/procurement.ts` | ⬜ |

---

## E. Receiving / GRN (`/procurement/receiving`)

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| E1 | Pending POs tab (orders ready for receiving) | `app/procurement/receiving/receiving-view.tsx` | ⬜ |
| E2 | GRN list tab (completed receipts) | `app/procurement/receiving/receiving-view.tsx` | ⬜ |
| E3 | Search by PO/GRN number or vendor | `app/procurement/receiving/receiving-view.tsx` | ⬜ |
| E4 | Create GRN dialog — select PO | `components/procurement/create-grn-dialog.tsx` | ⬜ |
| E5 | Create GRN — warehouse destination selection | `components/procurement/create-grn-dialog.tsx` | ⬜ |
| E6 | Create GRN — line-by-line qty received/accepted/rejected | `components/procurement/create-grn-dialog.tsx` | ⬜ |
| E7 | Create GRN — inspection notes per item | `components/procurement/create-grn-dialog.tsx` | ⬜ |
| E8 | GRN number auto-generation (SJM-YYYYMM-NNNN) | `lib/actions/grn.ts` → `createGRN()` | ⬜ |
| E9 | GRN detail sheet — view all details | `components/procurement/grn-details-sheet.tsx` | ⬜ |
| E10 | GRN detail sheet — accept action | `components/procurement/grn-details-sheet.tsx` | ⬜ |
| E11 | GRN detail sheet — reject with reason | `components/procurement/grn-details-sheet.tsx` | ⬜ |
| E12 | GRN detail sheet — SoD override (if same approver) | `components/procurement/grn-details-sheet.tsx` | ⬜ |
| E13 | GRN detail sheet — print GRN document | `components/procurement/grn-details-sheet.tsx` | ⬜ |
| E14 | GRN accept → inventory transaction (PO_RECEIVE) | `lib/actions/grn.ts` → `acceptGRN()` | ⬜ |
| E15 | GRN accept → stock level update (qty + availableQty) | `lib/actions/grn.ts` → `acceptGRN()` | ⬜ |
| E16 | GRN accept → GL posting (DR Inventory / CR AP) | `lib/actions/grn.ts` → `acceptGRN()` | ⬜ |
| E17 | GRN accept → PO status auto-transition (PARTIAL_RECEIVED / RECEIVED / COMPLETED) | `lib/actions/grn.ts` → `acceptGRN()` | ⬜ |
| E18 | GRN accept → vendor rating recalculation | `lib/actions/grn.ts` → `recalculateVendorRating()` | ⬜ |
| E19 | GRN reject (only DRAFT status allowed) | `lib/actions/grn.ts` → `rejectGRN()` | ⬜ |
| E20 | Race condition guard on receivedQty update | `lib/actions/grn.ts` → `acceptGRN()` | ⬜ |

---

## F. Vendor Management (`/procurement/vendors`)

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| F1 | Vendor card grid with stats (rating, on-time %, active orders) | `components/procurement/vendor-list.tsx` | ⬜ |
| F2 | Search by vendor name or code | `app/procurement/vendors/vendors-view.tsx` | ⬜ |
| F3 | Filter by status (Active / Inactive) | `app/procurement/vendors/vendors-view.tsx` | ⬜ |
| F4 | Filter by supplier category | `app/procurement/vendors/vendors-view.tsx` | ⬜ |
| F5 | Create new vendor dialog | `components/procurement/new-vendor-dialog.tsx` | ⬜ |
| F6 | Create vendor — company info (code, name, contact, email, phone) | `components/procurement/new-vendor-dialog.tsx` | ⬜ |
| F7 | Create vendor — contact person with title | `components/procurement/new-vendor-dialog.tsx` | ⬜ |
| F8 | Create vendor — address and office contact | `components/procurement/new-vendor-dialog.tsx` | ⬜ |
| F9 | Create vendor — payment terms + bank details | `components/procurement/new-vendor-dialog.tsx` | ⬜ |
| F10 | Create vendor — supplier category (with create-on-the-fly) | `components/procurement/new-vendor-dialog.tsx` | ⬜ |
| F11 | Create vendor — duplicate detection | `components/procurement/new-vendor-dialog.tsx` | ⬜ |
| F12 | Edit vendor dialog | `components/procurement/edit-vendor-dialog.tsx` | ⬜ |
| F13 | Edit vendor — all fields editable (code disabled) | `components/procurement/edit-vendor-dialog.tsx` | ⬜ |
| F14 | Deactivate vendor (soft delete) | `lib/actions/procurement.ts` → `deactivateVendor()` | ⬜ |
| F15 | Vendor action menu (history, contact, toggle status, share) | `components/procurement/vendor-actions.tsx` | ⬜ |
| F16 | Vendor contact dialog — email + WhatsApp | `components/procurement/vendor-contact-dialog.tsx` | ⬜ |
| F17 | Vendor history dialog — all POs with vendor | `components/procurement/vendor-history-dialog.tsx` | ⬜ |
| F18 | Vendor performance table (on-time %, defect rate, rating) | `components/procurement/vendor-performance.tsx` | ⬜ |
| F19 | Supplier scorecard — weighted scoring + radar chart | `components/procurement/supplier-scorecard.tsx` | ⬜ |
| F20 | Supplier scorecard — grade (A-F) assignment | `components/procurement/supplier-scorecard.tsx` | ⬜ |

---

## G. Direct Purchase

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| G1 | Direct purchase dialog — vendor + warehouse selection | `components/procurement/direct-purchase-dialog.tsx` | ⬜ |
| G2 | Direct purchase — item table (qty, unit price) | `components/procurement/direct-purchase-dialog.tsx` | ⬜ |
| G3 | Direct purchase → auto-create PO (COMPLETED) | `lib/actions/procurement.ts` → `createDirectPurchase()` | ⬜ |
| G4 | Direct purchase → auto-create GRN (ACCEPTED) | `lib/actions/procurement.ts` → `createDirectPurchase()` | ⬜ |
| G5 | Direct purchase → auto-create Bill (DRAFT) | `lib/actions/procurement.ts` → `createDirectPurchase()` | ⬜ |
| G6 | Direct purchase → inventory update | `lib/actions/procurement.ts` → `createDirectPurchase()` | ⬜ |
| G7 | Direct purchase → GL posting | `lib/actions/procurement.ts` → `createDirectPurchase()` | ⬜ |

---

## H. Purchase Returns (Retur Pembelian)

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| H1 | Return dialog — select returnable POs | `components/procurement/purchase-return-dialog.tsx` | ⬜ |
| H2 | Return — select items + qty to return | `components/procurement/purchase-return-dialog.tsx` | ⬜ |
| H3 | Return — reason per item | `components/procurement/purchase-return-dialog.tsx` | ⬜ |
| H4 | Return → debit note (credit note) creation | `lib/actions/procurement.ts` → `createPurchaseReturn()` | ⬜ |
| H5 | Return → AP reduction | `lib/actions/procurement.ts` → `createPurchaseReturn()` | ⬜ |
| H6 | Return → inventory reversal (PO_RETURN transaction) | `lib/actions/procurement.ts` → `createPurchaseReturn()` | ⬜ |
| H7 | Return → GL posting (DR AP / CR Inventory) | `lib/actions/procurement.ts` → `createPurchaseReturn()` | ⬜ |
| H8 | Return — only allowed on RECEIVED/COMPLETED/PARTIAL_RECEIVED POs | `lib/actions/procurement.ts` → `getReturnablePurchaseOrders()` | ⬜ |

---

## I. Landed Cost

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| I1 | Landed cost dialog — freight, customs, insurance, other costs | `components/procurement/landed-cost-dialog.tsx` | ⬜ |
| I2 | Allocation methods (by value, quantity, weight, equal) | `components/procurement/landed-cost-dialog.tsx` | ⬜ |
| I3 | Cost-per-unit calculation | `components/procurement/landed-cost-dialog.tsx` | ⬜ |
| I4 | Save landed cost to PO | `lib/actions/procurement.ts` → `saveLandedCost()` | ⬜ |

---

## J. Auto-Reorder

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| J1 | Reorder suggestions — products below reorder level | `lib/actions/procurement-reorder.ts` → `getReorderSuggestions()` | ⬜ |
| J2 | Urgency classification (CRITICAL / WARNING / NORMAL) | `lib/procurement-reorder-helpers.ts` | ⬜ |
| J3 | Days-of-stock calculation (burn rate) | `lib/procurement-reorder-helpers.ts` | ⬜ |
| J4 | Suggested qty (EOQ, lead time, safety stock, open PO) | `lib/procurement-reorder-helpers.ts` | ⬜ |
| J5 | Bulk create PRs from selected suggestions | `lib/actions/procurement-reorder.ts` → `createAutoReorderPR()` | ⬜ |
| J6 | Group by preferred supplier | `lib/actions/procurement-reorder.ts` → `createAutoReorderPR()` | ⬜ |

---

## K. Manufacturing Integration

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| K1 | Detect work order material shortages | `lib/actions/manufacturing-procurement.ts` → `detectWorkOrderShortages()` | ⬜ |
| K2 | Shortage calculation (BOM qty x WO qty x waste %) | `lib/actions/manufacturing-procurement.ts` | ⬜ |
| K3 | Create PR from work order shortages | `lib/actions/manufacturing-procurement.ts` → `createPRFromWorkOrder()` | ⬜ |

---

## L. Finance Integration (Bills & Payments)

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| L1 | Create bill/invoice from PO (INV_IN) | `lib/actions/finance-invoices.ts` → `recordPendingBillFromPO()` | ⬜ |
| L2 | Bill idempotency (no duplicate bills per PO) | `lib/actions/finance-invoices.ts` → `recordPendingBillFromPO()` | ⬜ |
| L3 | Get pending POs for billing | `lib/actions/finance-invoices.ts` → `getPendingPurchaseOrders()` | ⬜ |
| L4 | Vendor Payments page | `app/finance/vendor-payments/page.tsx` | ⬜ |
| L5 | Multi-vendor payment dialog | `components/finance/vendor-multi-payment-dialog.tsx` | ⬜ |

---

## M. Cross-Module Widgets

| # | Feature | Component / File | Status |
|---|---------|-----------------|--------|
| M1 | Dashboard — Pengadaan card (PO/PR snapshots, approvals) | `components/dashboard/pengadaan-card.tsx` | ⬜ |
| M2 | Inventory — procurement insights widget (restock alerts, incoming POs) | `components/inventory/procurement-insights.tsx` | ⬜ |
| M3 | Inventory — purchase request dialog (create PR from inventory) | `components/inventory/purchase-request-dialog.tsx` | ⬜ |

---

## N. API Endpoints

| # | Feature | File Path | Method / Route | Status |
|---|---------|-----------|---------------|--------|
| N1 | Procurement dashboard data (KPIs, registries, approvals) | `app/api/procurement/dashboard/route.ts` | `GET /api/procurement/dashboard` | ⬜ |
| N2 | PO PDF generation (Typst template) | `app/api/documents/purchase-order/[id]/route.ts` | `GET /api/documents/purchase-order/:id` | ⬜ |

---

## O. Hooks (Client-Side State)

| # | Hook | File Path | Status |
|---|------|-----------|--------|
| O1 | `useProcurementDashboard` — dashboard data fetching | `hooks/use-procurement-dashboard.ts` | ⬜ |
| O2 | `usePurchaseOrders` — PO list data | `hooks/use-purchase-orders.ts` | ⬜ |
| O3 | `usePurchaseRequests` — PR list data | `hooks/use-purchase-requests.ts` | ⬜ |
| O4 | `useReceiving` — receiving/GRN data | `hooks/use-receiving.ts` | ⬜ |
| O5 | `useVendorsList` — vendor data | `hooks/use-vendors.ts` | ⬜ |
| O6 | `useDirectPurchaseOptions` — direct purchase dropdowns | `hooks/use-direct-purchase-options.ts` | ⬜ |
| O7 | `useProcurementRequestForm` — PR form state | `hooks/use-procurement-request-form.ts` | ⬜ |
| O8 | `useVendorPayments` — vendor payment data | `hooks/use-vendor-payments.ts` | ⬜ |

---

## P. Authorization & Security

| # | Feature | Source | Status |
|---|---------|--------|--------|
| P1 | PO approval — role guard (CEO/Director/Admin/Manager) | `lib/actions/procurement.ts` | ⬜ |
| P2 | PR approval — role guard (Manager/CEO/Director/Purchasing/Admin) | `lib/actions/procurement.ts` | ⬜ |
| P3 | GRN accept — SoD check (cannot accept own PO without override) | `lib/actions/grn.ts` | ⬜ |
| P4 | GRN SoD override requires 10+ character reason | `lib/actions/grn.ts` | ⬜ |
| P5 | PO state machine — invalid transition rejection | `lib/po-state-machine.ts` | ⬜ |

---

## Q. Page-Level Server Actions

| # | Feature | File Path | Status |
|---|---------|-----------|--------|
| Q1 | Purchase order page-level actions | `app/actions/purchase-order.ts` | ⬜ |
| Q2 | Vendor page-level actions | `app/actions/vendor.ts` | ⬜ |

---

## R. Templates & Documents

| # | Feature | File Path | Status |
|---|---------|-----------|--------|
| R1 | PO PDF — Typst template | `templates/purchase_order/main.typ` | ⬜ |
| R2 | PO PDF — inline preview mode | `app/api/documents/purchase-order/[id]/route.ts` | ⬜ |
| R3 | PO PDF — attachment download mode | `app/api/documents/purchase-order/[id]/route.ts` | ⬜ |

---

## Summary

| Section | Items | Description |
|---------|-------|-------------|
| A. Pages & Routes | 11 | All procurement page files |
| B. Dashboard | 15 | KPIs, registries, widgets, analytics |
| C. Purchase Requests | 15 | PR CRUD, approval workflow |
| D. Purchase Orders | 37 | PO lifecycle, templates, PDF, audit |
| E. Receiving / GRN | 20 | GRN creation, acceptance, inventory, GL |
| F. Vendor Management | 20 | Vendor CRUD, performance, contact |
| G. Direct Purchase | 7 | One-step purchase flow |
| H. Purchase Returns | 8 | Returns, debit notes, reversals |
| I. Landed Cost | 4 | Cost allocation to POs |
| J. Auto-Reorder | 6 | Intelligent reorder suggestions |
| K. Manufacturing Integration | 3 | WO shortage → PR |
| L. Finance Integration | 5 | Bills from POs, vendor payments |
| M. Cross-Module Widgets | 3 | Dashboard + inventory integrations |
| N. API Endpoints | 2 | REST APIs |
| O. Hooks | 8 | Client-side data hooks |
| P. Authorization & Security | 5 | Role guards, SoD, state machine |
| Q. Page-Level Actions | 2 | App-level server actions |
| R. Templates & Documents | 3 | PDF generation |
| **TOTAL** | **174** | |
