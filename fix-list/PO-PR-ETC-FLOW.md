```markdown
# ERP STATUS LIFECYCLE IMPLEMENTATION PLAN
**Target Implementation:** Phase 1 (Status 1-6) by Feb 10, 2026  
**Document Version:** 1.0  
**Scope:** Procurement workflow from Inventory Alert to Vendor Order

---

## 1. MASTER STATUS LIFECYCLE

Complete flow for full ERP (reference only):
```
[SYSTEM] Gap Detected → [INVENTORY] Request Purchase → [PURCHASING] Create PO 
→ [CEO] Approve → [PURCHASING] Send to Vendor → [VENDOR] Confirm → [VENDOR] Ship 
→ [WAREHOUSE] Receive Goods → [SYSTEM] Complete
```

**Phase 1 Implementation (Feb 10 MVP):** Status 1-6 only (Alert through Ordered)

---

## 2. DATABASE SCHEMA CHANGES

### Enum Type: `ProcurementStatus`
```sql
-- PostgreSQL Enum for PurchaseOrder table
CREATE TYPE ProcurementStatus AS ENUM (
  'GAP_DETECTED',      -- System detected low stock
  'PR_CREATED',        -- Purchase Request submitted
  'PO_DRAFT',          -- PO created by Purchasing, not yet sent
  'PENDING_APPROVAL',  -- PO submitted to CEO/Director
  'APPROVED',          -- CEO approved, ready to order
  'ORDERED',           -- Sent to vendor (MVP Endpoint)
  'VENDOR_CONFIRMED',  -- Post-MVP
  'SHIPPED',           -- Post-MVP  
  'RECEIVED',          -- Goods Receipt done
  'COMPLETED',         -- Stock updated, Finance updated
  'REJECTED',          -- CEO rejected with notes
  'CANCELLED'          -- PO cancelled
);
```

### Table: `PurchaseOrder` (Add/Modify Columns)
- `status`: `ProcurementStatus` (NOT NULL, default: 'PO_DRAFT')
- `previousStatus`: `ProcurementStatus` (for tracking rejections/amendments)
- `requestedBy`: `UUID` (Inventory staff)
- `createdBy`: `UUID` (Purchasing staff)
- `approvedBy`: `UUID` (CEO/Director)
- `requestedAt`: `Timestamp`
- `sentToVendorAt`: `Timestamp`
- `rejectionReason`: `Text` (nullable, only if REJECTED)

### Table: `PurchaseRequest` (PR)
- `status`: Enum ('PENDING', 'CONVERTED_TO_PO', 'REJECTED', 'CANCELLED')
- `convertedToPOId`: `UUID` (foreign key to PurchaseOrder, nullable)

---

## 3. PHASE 1 IMPLEMENTATION (Feb 10 Critical Path)

### Status 1: GAP_DETECTED (System)
**Trigger:** Inventory < Min Stock (90 or 365 day alert)  
**Database:** `MaterialGapAnalysis` table flag  
**Frontend Behavior:**
- Button: **"Request Purchase"** (Blue, active)
- Click: Opens `PurchaseRequestDialog`
- On Submit: Creates PR, transitions to Status 2

### Status 2: PR_CREATED (Inventory → Purchasing)
**Trigger:** Inventory staff clicks "Confirm Request"  
**Database:** Row in `PurchaseRequest` table  
**Frontend Behavior (Inventory Dashboard):**
- Button changes to: **"Menunggu Purchasing..."** (Grey, disabled)
- Badge: `Status: Permintaan Diajukan`
- Click: Show PR details modal (read-only)

**Handoff:** Purchasing team sees this in "Permintaan Pembelian" page

### Status 3: PO_DRAFT (Purchasing)
**Trigger:** Purchasing converts PR to PO but hasn't sent to CEO yet  
**Database:** `PurchaseOrder` created with `status = 'PO_DRAFT'`  
**Frontend Behavior (Purchasing Page):**
- Button: **"Edit PO"** → Can modify items, qty, vendor
- Button: **"Kirim ke CEO"** → Transitions to Status 4
- Badge: `Draft`

### Status 4: PENDING_APPROVAL (CEO Queue)
**Trigger:** Purchasing clicks "Send to CEO"  
**Database:** `status = 'PENDING_APPROVAL'`, `requestedAt = now()`  
**Frontend Behavior (CEO Dashboard):**
- Card shows: PO Number, Vendor, Total Amount, Requester
- Buttons: **"Setuju"** (Green) / **"Tolak dengan Alasan"** (Red)
- Action: Approve → Status 5 / Reject → Status 11 (REJECTED)

**Frontend Behavior (Inventory Dashboard - View Only):**
- Button: **"Menunggu Persetujuan CEO..."** (Grey, loading animation)
- Tooltip: "Sedang direview Direksi"

### Status 5: APPROVED (Ready to Order)
**Trigger:** CEO clicks "Setuju"  
**Database:** `status = 'APPROVED'`, `approvedBy = CEO_ID`, `approvedAt = now()`  
**Frontend Behavior (Finance Dashboard - CRITICAL):**
- **MVP Requirement:** PO appears immediately in Finance "Pending Payments" list
- Status tag: `Disetujui - Belum Dibayar`
- Action: **"Buat Invoice/Bill"** button (creates Finance record)

**Frontend Behavior (Purchasing Page):**
- Button: **"Kirim ke Vendor"** (Blue, active)
- Click: Opens vendor contact options (Email/WhatsApp template)
- On Confirm: Transitions to Status 6

### Status 6: ORDERED (MVP Complete)
**Trigger:** Purchasing confirms "Sent to Vendor"  
**Database:** `status = 'ORDERED'`, `sentToVendorAt = now()`  
**Frontend Behavior (Inventory Dashboard):**
- Button: **"Tandai Diterima"** (Yellow/Orange - indicates waiting)
- Badge: `Status: Dikirim Vendor`
- ETA Display: Show expected delivery date (from PO)

**End of Phase 1 Flow** (Next: Warehouse waits for physical delivery)

---

## 4. REJECTION & AMENDMENT FLOW

### Path A: CEO Rejects
1. CEO clicks "Tolak" → Enters reason → Status: `REJECTED`
2. Notification to Purchasing with reason
3. Purchasing edits PO → Resubmits → Back to Status 4
4. **OR** Purchasing cancels → Status: `CANCELLED`

### Path B: Inventory Cancels PR
- Only allowed if Status = 'PR_CREATED' (before PO made)
- Button: **"Batalkan Permintaan"**

---

## 5. FRONTEND BUTTON STATE MATRIX

**Location:** `DetailedMaterialTable.tsx` (Inventory Dashboard)

| Current Status | Button Text | Color | Enabled | Click Action |
|---------------|-------------|-------|---------|--------------|
| GAP_DETECTED | **Request Purchase** | Blue | Yes | Open PR Dialog |
| PR_CREATED | **Menunggu Purchasing...** | Grey | No | Show PR detail |
| PO_DRAFT | **Sedang Diproses...** | Yellow | No | Show PO draft |
| PENDING_APPROVAL | **Menunggu CEO...** | Grey | No | Show status |
| APPROVED | **Disetujui - Order Pending** | Green | No (info only) | Show approval |
| ORDERED | **Tandai Diterima** | Orange | Yes | Open Receive Dialog |
| REJECTED | **Ditolak - Edit Ulang** | Red | Yes | Show rejection reason |
| RECEIVED | **Selesai** | Green | No | Archive |

---

## 6. API ENDPOINT UPDATES

### `requestPurchase()` (Inventory Action)
- Input: `itemId`, `quantity`, `notes`
- Output: `{ success: true, prId: UUID, status: 'PR_CREATED' }`
- Side Effect: Update `MaterialGapAnalysis` cache to show new status

### `convertPRtoPO()` (Purchasing Action)
- Input: `prId`, `vendorId`, `items[]`
- Output: `{ poId: UUID, status: 'PO_DRAFT' }`
- Side Effect: Update PR status to 'CONVERTED_TO_PO'

### `submitPOForApproval()` (Purchasing Action)
- Input: `poId`
- Output: `{ success: true, status: 'PENDING_APPROVAL' }`
- Side Effect: Notify CEO (in-app notification)

### `approvePO()` (CEO Action)
- Input: `poId`, `decision: 'APPROVE' | 'REJECT'`, `reason?`
- Output: `{ success: true, newStatus: 'APPROVED' | 'REJECTED' }`
- Side Effect: 
  - If APPROVED: Push to Finance dashboard (immediate visibility)
  - If REJECTED: Notify Purchasing with reason

### `markAsOrdered()` (Purchasing Action)
- Input: `poId`, `sentDate`, `vendorContactMethod`
- Output: `{ success: true, status: 'ORDERED' }`
- Side Effect: Update Inventory dashboard status

---

## 7. FINANCE INTEGRATION REQUIREMENT (CRITICAL)

**Rule:** When `approvePO()` sets status to `APPROVED`:
1. Create row in `FinancePending` table (or equivalent)
2. Columns: `poId`, `amount`, `vendor`, `approvedAt`, `status: 'WAITING_BILL'`
3. Finance dashboard queries this table (not just Invoice table)
4. Finance can click "Generate Bill" which creates actual Invoice record

**Why:** Finance must see approved POs immediately, not wait for vendor delivery.

---

## 8. TESTING CHECKLIST (Before Marking Done)

**Scenario 1: Happy Path**
- [ ] Stock Alert → Request Purchase → PR Created (Button grey)
- [ ] Purchasing converts to PO (Draft) → Sends to CEO
- [ ] CEO Approves → Finance sees it immediately
- [ ] Purchasing marks "Sent to Vendor" → Inventory shows "Tandai Diterima"

**Scenario 2: Rejection**
- [ ] CEO rejects with note "Qty 50→40"
- [ ] Purchasing sees rejection reason
- [ ] Edits PO → Resubmits → CEO Approves
- [ ] Flow continues normally

**Scenario 3: Duplicate Prevention**
- [ ] Try to create second PR while first is PENDING → Blocked
- [ ] After first is REJECTED or ORDERED → Can create new PR

---

## 9. PHASE 2 (Post-Feb 10) - Vendor Touchpoints

**Status 7: VENDOR_CONFIRMED**
- Vendor portal login or Email webhook updates status
- Button: **"Dikonfirmasi Vendor - Proses Produksi"**

**Status 8: SHIPPED**
- Vendor updates tracking number
- Button: **"Dalam Pengiriman"** (shows tracking)

**Status 9: RECEIVED**
- Warehouse scans/inputs received qty
- Triggers: Stock update + Finance Bill generation prompt

**Status 10: COMPLETED**
- Automatic when stock updated and Finance matched

---

## 10. EXECUTION ORDER

**Do in this exact sequence:**

1. **Database:** Add status enum and columns to PO table
2. **Backend:** Update `requestPurchase` to return correct status
3. **Backend:** Update `approvePO` to auto-create Finance pending record
4. **Frontend:** Implement button state matrix in `DetailedMaterialTable`
5. **Frontend:** Create status badges for each stage
6. **Integration:** Test full flow end-to-end 3 times
7. **Cleanup:** Remove any hardcoded status strings, use enum constants

**Stop here. Do not proceed to Phase 2 until Feb 10 demo successful.**

---

**Questions for clarification:**
1. What is the monetary threshold for CEO vs Director approval? (e.g., >10jt CEO, <10jt Manager?)
2. Do we need email notifications at each status change, or in-app sufficient for MVP?
3. Can vendor confirm via simple link (magic URL), or manual update by Purchasing only for Feb 10?
```