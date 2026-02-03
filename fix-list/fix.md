# ERP DEVELOPMENT TASK LIST - IMMEDIATE EXECUTION
**Meeting Date:** 31 January 2026  
**Next Review:** 10 February 2026  
**Target:** V1 MVP with 80% ERP Workflow Coverage

**CRITICAL RULE: DO NOT DUPLICATE EXISTING FUNCTIONALITY. IF A FEATURE ALREADY EXISTS AND WORKS, SKIP IT. NEVER CREATE OVERLAPPING FEATURES.**

---

## PHASE 1: CRITICAL FIXES (Priority: URGENT)

### Richie - Authentication Module
- [ ] **Fix Email Confirmation Redirect**
  - Change redirect URL from `localhost:3000` to production domain
  - Update environment variables: `NEXT_PUBLIC_APP_URL` or equivalent
  - Test sign-up flow end-to-end with new credentials
  - Verify email confirmation button routes to production, not localhost

- [ ] **Fix Login Credential Persistence**
  - Debug why saved credentials fail on login
  - Check session handling/token storage
  - Ensure "Remember Me" functionality works correctly

---

## PHASE 2: CORE MODULES (Priority: HIGH)

### Richie - Inventory Module (SPECIFIC BUG FIXES ONLY)
**NOTE: Blue Label already exists, do not recreate it. Only fix the specific status update bug.**

- [ ] **Fix Dashboard Inventory/Material Gap Analysis Table**
  - **Location:** Inventory Dashboard → Material Gap Analysis Table
  - **Bug:** "Request Purchase" button click does not update UI status
  - **Current Broken Behavior:** 
    - Button stays as "Request Purchase" 
    - Does NOT change to "Receive Product" 
    - Does NOT show Blue Label indicator
  - **Expected Behavior:**
    - After click: Button text changes to "Receive Product" 
    - Status indicator changes to show Blue Label (existing Blue Label feature, just trigger it)
    - Button routes to receiving workflow
  - **Backend Status:** Already working correctly (data sends to Purchasing "Pesanan Pembelian" page)
  - **Fix Required:** Frontend state management to reflect status change immediately after click

- [ ] **Fix Stock Alert System (if broken)**
  - Verify "Critical Stock 90 Days" alert displays correctly
  - Verify "Stock End 365 Days" alert displays correctly
  - Ensure vendor linking per product is clickable

### Richie - PO (Purchase Order) Module - PRIMARY FOCUS
**NOTE: Only build what doesn't exist. Check existing codebase first.**

- [ ] **Build PR (Purchase Request) Form (if not exists)**
  - Role-based access: Warehouse/Store staff only
  - Fields: Product, Quantity, Request Date, Required Date, Notes
  - Submit PR to Purchasing department queue

- [ ] **Build PO Conversion System**
  - Purchasing role can view pending PRs
  - Convert PR to PO with vendor assignment (General Etik/external vendors)
  - Auto-populate PR data to PO form
  - Generate PO Number (auto-increment/format: PO-2026-XXXX)

- [ ] **Implement Approval Workflow (CRITICAL LOGIC)**
  - **Rule:** Boss/Director CANNOT edit PO directly (read-only)
  - Boss actions: 
    - [ ] Approve button → Status: Approved → Notify Finance
    - [ ] Reject button → Mandatory notes field (reason for rejection)
  - **Rejection Flow:**
    - PO returns to creator with rejection notes visible
    - Creator edits quantity/items based on notes
    - Resubmit for approval (new revision/version tracked)
  - Status tracking: Draft → Pending Approval → Approved → Finance Review

- [ ] **PDF Generation Engine (if not exists)**
  - Fix PDF printer compatibility errors (A4 layout only)
  - **Implement Dual Template System:**
    - Template A (Internal): Company branding, internal use
    - Template B (External): Customizable Terms & Conditions per vendor
  - One-click generate: PR PDF + PO PDF + Sales Invoice (for raw materials)
  - Ensure PDFs are downloadable and printable standard A4

- [ ] **ETA Management (if not exists)**
  - Add Estimated Time of Arrival fields to PO
  - Track ETA changes with history log (who changed, when)
  - Show existing Blue Label ETA on dashboard for tracking

---

## PHASE 3: ANALYSIS & STRATEGY (Priority: MEDIUM)

### Raymond - Flow Analysis
- [ ] **Document Real-World Workflows**
  - Interview/note existing ERP pain points from users
  - Map current vs ideal flow for PR→PO→Payment
  
- [ ] **Finalize Master Roadmap**
  - Compile overlapping features from Darren's research and Raymond's flow analysis
  - Define "80% ERP Workflow" scope clearly (what's in V1 vs V2)
  - Create decision matrix: Full ERP vs Modular API strategy
  - Document best practices for inventory-purchasing-finance integration

### Darren - Finance & Competitor Analysis
- [ ] **Competitor Analysis Report**
  - Benchmark 2-3 ERP competitors (pricing, features, weaknesses)
  - Identify gap in market for "AI PO Generator" standalone
  - Pricing strategy recommendations (reference: Rp 3jt/bulan for PO module)

- [ ] **Finance Module Specification**
  - Design Three-Way Matching system:
    - [ ] PO vs Goods Receipt (GR) vs Vendor Invoice matching
    - [ ] Discrepancy alert system (qty/price mismatch)
    - [ ] Payment hold until matching valid
  - Budget Release workflow:
    - [ ] Dashboard view: Approved POs ready for budget allocation
    - [ ] Notification system to Finance team
  - Account Payable tracking:
    - [ ] Invoice status: Unpaid/Partially Paid/Paid
    - [ ] Due date scheduler with alerts
    - [ ] Penalty calculation logic (if applicable)
  - Integration points:
    - [ ] Input: Receive approved PO data from Richie's PO Module
    - [ ] Output: Sync GR validation to Richie's Inventory Module
    - [ ] Feedback: Budget insufficient alerts to Purchasing
    
- [ ] **Migrate Finance Module**
  - Move code from Replit to production/dev server
  - Ensure database connection strings updated
  - Test environment accessibility

---

## PHASE 4: INTEGRATION REQUIREMENTS (Cross-Team)

- [ ] **Inventory → PO Integration (if not exists)**
  - When stock hits 90-day threshold, auto-suggest PR creation
  - Show stock levels in PO creation interface (prevent over-ordering)

- [ ] **PO → Finance Integration (if not exists)**
  - Auto-push approved PO data to Finance dashboard
  - Include: PO number, Vendor, Amount, Budget Category, Request Date

- [ ] **Finance → Inventory Integration (if not exists)**
  - Finance can view GR (Goods Receipt) status before approving payment
  - Only pay for received goods (Three-way match validation)

- [ ] **Role-Based Access Control (RBAC)**
  - Warehouse: Create PR only
  - Purchasing: Create/Edit PO (until approved), convert PR→PO
  - Director: Approve/Reject PO only (no edit rights)
  - Finance: View approved POs only, manage payments
  - System Admin: Full access

---

## DEFINITION OF DONE (V1 MVP)

**Richie's Deliverables (10 Feb 2026):**
- [ ] Auth bug fixed, login flow smooth
- [ ] Inventory: Material Gap Analysis "Request Purchase" button updates status correctly (changes to "Receive Product" + Blue Label shows)
- [ ] PO Module complete: PR→PO→Approval→PDF (Boss can reject with notes, creator resubmits)
- [ ] PDF generation working with dual templates

**Raymond's Deliverables (10 Feb 2026):**
- [ ] Master roadmap documenting 80% workflow coverage
- [ ] Flow analysis validated with real-world scenarios

**Darren's Deliverables (10 Feb 2026):**
- [ ] Competitor analysis report submitted
- [ ] Finance module specification document complete
- [ ] Finance code migrated from Replit to production server
- [ ] Three-way matching workflow designed and approved

---

## TECHNICAL NOTES

- **NO DUPLICATION RULE:** Before coding any feature, check if it exists in current codebase. If exists and works, SKIP. Do not create overlapping features.
- **No Direct Boss Edit:** Implement soft-lock on PO fields for Director role (frontend disable + backend validation)
- **Blue Label:** Already exists in system, just ensure it's triggered correctly when status changes to "Receive Product"
- **PDF Templates:** Use HTML→PDF library (e.g., Puppeteer, wkhtmltopdf) with dynamic CSS switching for Internal vs External
- **Audit Trail:** Every status change must log user_id, timestamp, action, reason (if rejection)
- **API First:** Structure all modules as REST APIs so individual features can be sold as standalone products later
- **Database:** Ensure soft-delete only for Finance records (no hard delete)

---

## ARCHITECTURE DECISIONS (Frozen for V1)

1. **Approval Authority:** Director can only approve/reject with notes, never edit
2. **Pivot Strategy:** PO Module can be standalone product if full ERP delayed
3. **PDF Strategy:** A4 only, two templates (Internal/External per vendor)
4. **Finance Integration:** Three-way matching (PO-GR-Invoice) is non-negotiable for launch
5. **Inventory Fix:** Only fix the status update bug, do not rebuild existing Blue Label functionality