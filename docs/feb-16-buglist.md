Here is a comprehensive, structured bug list organized by module with detailed technical specifications for your AI/development team. Each bug includes severity classification, reproduction steps, and specific completion criteria.

---

## **MODULE: DASHBOARD**

### **DASH-001: CEO Dashboard ("Pusat Aksi") Responsive Layout Failure**
- **Severity:** Medium  
- **Page:** Dashboard Utama (CEO View)  
- **Description:** Layout breaks when viewed on 14-inch laptop screens. Content overflows or misaligns below 14", requiring responsive support down to 13".  
- **Steps to Reproduce:**
  1. Access Dashboard on 14" laptop (1366x768 or 1920x1080 resolution)
  2. Observe "Pusat Aksi" section layout
  3. Resize browser to 13" equivalent viewport
- **Expected:** Fluid responsive layout maintaining usability down to 13" screens  
- **Actual:** Layout error/overflow, elements misaligned  
- **Completion Criteria:** CSS media queries implemented for 1280px-1440px breakpoints; no horizontal scrolling; all buttons accessible.

### **DASH-002: Inventory Dashboard Warehouse Cards Layout Misalignment**
- **Severity:** Medium  
- **Page:** Dashboard Inventory > Gudang Aktif  
- **Description:** Active warehouse ("Gudang Aktif") cards and bottom action buttons have layout positioning errors.  
- **Steps to Reproduce:**
  1. Navigate to Inventory Dashboard
  2. View "Gudang Aktif" section
  3. Check warehouse cards (WH-0020, WH-0010, etc.) and bottom buttons
- **Expected:** Cards align properly; buttons positioned correctly below content  
- **Actual:** Layout "ga pas" (misaligned); buttons overlap or positioned incorrectly  
- **Completion Criteria:** Flexbox/Grid layout fixed; consistent spacing; button container properly separated from card list.

---

## **MODULE: INVENTORY (INVENTORI)**

### **INV-001: Critical Alert Card Visibility Limitation**
- **Severity:** High  
- **Page:** Inventory > Kelola Produk > Critical Alert Section  
- **Description:** Critical alert section displays only 2 cards when 4 alerts exist. Additional alerts hidden below fold without scroll functionality.  
- **Steps to Reproduce:**
  1. Ensure 4+ items have critical stock levels
  2. Open Kelola Produk page
  3. View Critical Alert section (top right)
- **Expected:** All 4 critical alerts visible or scrollable within container  
- **Actual:** Only 2 visible; 2 hidden below without scroll capability ("kesembunyi")  
- **Completion Criteria:** Container height fixed with `overflow-y: auto`; scrollbar visible; max-height set to show 4 items or enable scrolling.

### **INV-002: Session Timeout on Inventory Data Fetch**
- **Severity:** Critical  
- **Page:** Inventory Dashboard & Kelola Produk  
- **Description:** Intermittent error fetching data followed by immediate logout/session expiry ("sesi kadaluarsa"). Occurs when navigating from Dashboard to Kelola Produk or refreshing inventory data.  
- **Steps to Reproduce:**
  1. Login to system
  2. Navigate to Inventory Dashboard or Kelola Produk
  3. Wait for data fetch or refresh page
  4. Observe error message then auto-redirect to login
- **Expected:** Data loads successfully; session persists  
- **Actual:** "Error fetching" message → immediate logout  
- **Completion Criteria:** Check JWT token refresh logic; verify API authentication middleware; ensure session timeout handling doesn't trigger on valid tokens; check CORS/preflight request handling.

### **INV-003: Product Category Layout and Missing Add Button**
- **Severity:** Medium  
- **Page:** Inventory > Kategori Produk  
- **Description:** Layout not utilizing full width ("layout ga full"); unclear UI for adding products to root categories; missing "Add Product" button in specific roots (e.g., Finished Product).  
- **Steps to Reproduce:**
  1. Navigate to Kategori Produk
  2. Select "Finished Product" root category
  3. Look for add product button
- **Expected:** Full-width layout; clear "+" or "Tambah Produk" button visible in root categories  
- **Actual:** Layout constrained; no visible button to add product in root  
- **Completion Criteria:** CSS width set to 100%; "Tambah Produk" button added to root category view with proper visibility logic.

### **INV-004: Stock Movement Page Layout Issues**
- **Severity:** Low  
- **Page:** Inventory > Pergerakan Stok  
- **Description:** General layout formatting errors in stock movement section.  
- **Completion Criteria:** UI audit completed; alignment, padding, and margins standardized.

### **INV-005: Manual Stock Movement Action Completion Failure**
- **Severity:** High  
- **Page:** Inventory > Manual Movement / Record Stock Movement / Adjustment In  
- **Description:** "Action" or "Complete" button non-functional when attempting to finalize manual stock movements or adjustments.  
- **Steps to Reproduce:**
  1. Navigate to Manual Movement or Adjustment In
  2. Fill in required fields (item, quantity, warehouse)
  3. Click "Complete" or "Simpan" (Save)
- **Expected:** Transaction saved; stock adjusted; success message shown  
- **Actual:** Button click has no effect or shows error; transaction not saved  
- **Completion Criteria:** Form submission handler debugged; API endpoint verified; success/error toast notifications implemented; database transaction commit confirmed.

### **INV-006: Warehouse Capacity Percentage Miscalculation**
- **Severity:** Medium  
- **Page:** Inventory > Gudang dan Lokasi  
- **Description:** Displayed percentage capacity does not match actual capacity calculation.  
- **Completion Criteria:** Verify calculation formula: `(used_space / total_space) * 100`; ensure unit consistency (m³ vs kg); fix display logic.

### **INV-007: Add Category Button Non-Functional in Warehouse Details**
- **Severity:** High  
- **Page:** Inventory > Gudang Details  
- **Description:** "Add Category" button unresponsive when accessed from warehouse detail view.  
- **Completion Criteria:** Event listener attached; modal/form opens correctly; category creation API functional from this entry point.

### **INV-008: Stock Opname (Stock Taking) Save Failure**
- **Severity:** High  
- **Page:** Inventory > Stok Opname  
- **Description:** Adjustment save button ("Simpan Penyesuaian") non-functional during stock opname process.  
- **Completion Criteria:** Form validation passes; API endpoint `/api/stock-opname/adjustment` responds correctly; database updates committed; success confirmation shown.

### **INV-009: Stock Transfer Employee Lookup Error**
- **Severity:** High  
- **Page:** Inventory > Stock Transfer  
- **Description:** Stock transfer fails with error message "Data karyawan tidak ditemukan" (Employee data not found) despite valid employee existing in system.  
- **Steps to Reproduce:**
  1. Create new stock transfer
  2. Select source/destination warehouse
  3. Add items
  4. Submit
- **Expected:** Transfer created successfully  
- **Actual:** Error: Employee data not found  
- **Completion Criteria:** Verify employee ID association with user account; check if stock transfer requires employee validation; fix lookup query.

---

## **MODULE: SALES (PENJUALAN) & CRM**

### **SAL-001: Customer Auto-Selection Missing in Direct Order Flow**
- **Severity:** Medium (Enhancement)  
- **Page:** Sales > Kelola Pelanggan  
- **Description:** When user clicks "Order" directly from a specific customer card (e.g., "PT Raymond Ganteng"), system should auto-populate that customer in the order form instead of requiring manual re-selection.  
- **Steps to Reproduce:**
  1. Go to Kelola Pelanggan
  2. Click "Order" button on PT Raymond Ganteng card
  3. System opens order creation page
- **Expected:** Customer field pre-filled with "PT Raymond Ganteng"  
- **Actual:** Customer field empty; user must select again  
- **Completion Criteria:** URL parameter or state management passes customer_id; order form reads and sets initial value; field disabled or marked as pre-selected.

### **SAL-002: Quotation Template 404 Error**
- **Severity:** High  
- **Page:** Sales > Penawaran (Quotations)  
- **Description:** Clicking "Template" button results in 404 Page Not Found.  
- **Completion Criteria:** Route `/penawaran/template` exists; component renders; backend API serves template data.

### **SAL-003: Incorrect Unit of Measure for Clothing**
- **Severity:** Medium  
- **Page:** Sales > Penawaran > Buat Penawaran Baru  
- **Description:** Clothing items ("Pakaian") display unit "Roll" instead of "Pcs" (pieces).  
- **Completion Criteria:** Database seed data corrected; UOM field for category "Pakaian" set to "Pcs"; frontend dropdown shows correct unit.

### **SAL-004: Quotation to Purchase Order Conversion Failure**
- **Severity:** Critical  
- **Page:** Sales > Penawaran  
- **Description:** Workflow breakdown: Draft → Sent (OK), Sent → Accepted (OK), Accepted → Convert to PO (Error - nothing happens).  
- **Steps to Reproduce:**
  1. Create quotation → Save as Draft
  2. Send to customer → Mark as Sent
  3. Customer accepts → Mark as Accepted
  4. Click "Convert to PO"
- **Expected:** System generates Purchase Order; redirects to PO view  
- **Actual:** No action; no error message; page static  
- **Completion Criteria:** Conversion API endpoint functional; data mapping from quotation to PO correct; navigation triggered; loading state and error handling added.

### **SAL-005: Quotation Detail/Edit Buttons Non-Functional**
- **Severity:** High  
- **Page:** Sales > Penawaran  
- **Description:** "Lihat Detail" (View Detail) and "Edit Penawaran" buttons unresponsive.  
- **Completion Criteria:** Button onClick handlers implemented; routing to `/penawaran/:id` and `/penawaran/:id/edit`; data fetching for specific quotation ID.

### **SAL-006: Sales Order Detail Page Error**
- **Severity:** High  
- **Page:** Sales > Pesanan Penjualan (Sales Orders)  
- **Description:** Clicking detail on sales order results in error page.  
- **Completion Criteria:** Debug component lifecycle; check null reference errors; verify API response handling; error boundary implemented.

### **SAL-007: Sales CRM View Detail Button Failure**
- **Severity:** Medium  
- **Page:** Penjualan & CRM main page  
- **Description:** "Lihat Detail" button not working in CRM view.  
- **Completion Criteria:** Event binding checked; modal or navigation functional.

### **SAL-008: Sales CRM View All Transactions Button Failure**
- **Severity:** Medium  
- **Page:** Penjualan & CRM main page  
- **Description:** "Lihat Semua Transaksi" (View All Transactions) button not working.  
- **Completion Criteria:** Navigation to transaction list implemented; filters cleared/applied correctly.

### **SAL-009: Sales-Invoice Data Synchronization Gap**
- **Severity:** High  
- **Page:** Sales main page  
- **Description:** Newly created invoices do not appear in the Sales page transaction list.  
- **Completion Criteria:** Verify database relationship between sales orders and invoices; check API filter parameters; ensure real-time or refresh data binding.

### **SAL-010: POS Layout Issues and Architecture Separation**
- **Severity:** Medium (UI) / High (Architecture)  
- **Page:** Sales > POS  
- **Description:** (1) Layout messy/kacau. (2) **Architectural Decision:** POS should be separate system from ERP, specifically designed for retail cashier operations, not integrated into main ERP workflow.  
- **Completion Criteria:**  
  - **Short-term:** Fix CSS layout issues for current implementation  
  - **Long-term:** Discussion documented; decision on whether to decouple POS into standalone module with separate database/API or maintain integration.

---

## **MODULE: FINANCE (KEUANGAN)**

### **FIN-001: Invoice Payment Confirmation Button Non-Interactive**
- **Severity:** High  
- **Page:** Finance > Invoicing  
- **Description:** "Konfirmasi Pembayaran" (Payment Confirmation) button cannot be clicked or is disabled when it should be active.  
- **Completion Criteria:** Button state logic reviewed; enabled when invoice status = "unpaid"; click handler opens payment modal; payment recording API functional.

---

## **MODULE: PROCUREMENT (PENGADAAN)**

### **PROC-001: Procurement Dashboard Session Error**
- **Severity:** Critical  
- **Page:** Pengadaan > Dashboard  
- **Description:** Clicking on Procurement Dashboard triggers "Sesi Kadaluarsa" (Session Expired) error.  
- **Completion Criteria:** Authentication check on procurement module fixed; route guards verified; API token validation corrected.

### **PROC-002: Vendor Page Layout Error**
- **Severity:** Low  
- **Page:** Pengadaan > Vendor  
- **Description:** Layout issues in vendor list view (note: create new vendor function works correctly).  
- **Completion Criteria:** Table/grid layout fixed; responsive styling applied; pagination aligned.

### **PROC-003: PO Document Preview Error**
- **Severity:** High  
- **Page:** Pengadaan > Pesanan Pembelian (PO)  
- **Description:** After successfully creating PO, clicking "Preview Dokumen" results in error.  
- **Completion Criteria:** PDF generation service checked; template engine rendering correctly; error handling for missing templates implemented.

### **PROC-004: PO Confirmation and PDF Generation Failure**
- **Severity:** Critical  
- **Page:** Pengadaan > Pesanan Pembelian  
- **Description:** Cannot confirm PO or generate PDF. Error message: "Akun belum terhubung ke employee aktif, hubungi admin SDM" (Account not connected to active employee, contact HR admin).  
- **Steps to Reproduce:**
  1. Create PO
  2. Click "Konfirmasi" or "Buat PDF"
- **Expected:** PO status changes to Confirmed; PDF generated  
- **Actual:** Error message about employee account linkage  
- **Completion Criteria:** Verify user-employee relationship in database; check if procurement actions require employee ID validation; fix authentication context; ensure HR employee record links to user account.

### **PROC-005: Purchase Request Approval Access Denied**
- **Severity:** High  
- **Page:** Pengadaan > Purchase Request (PR)  
- **Description:** Cannot approve PR due to "No Access" error.  
- **Completion Criteria:** Role-based access control (RBAC) reviewed; approval permissions checked for user role; middleware authorization rules updated if needed.

### **PROC-006: GRN Layout and PO Count Discrepancy**
- **Severity:** Medium  
- **Page:** Pengadaan > GRN (Goods Receipt Note)  
- **Description:** (1) Page layout error. (2) Data mismatch: "PO Menunggu" (PO Waiting) shows 0, but system has 2 approved POs waiting for GRN.  
- **Completion Criteria:** CSS layout fixed; query filter for "PO Menunggu" reviewed; status filter should include 'approved' but not 'completed'; count query synchronized with actual data.

---

## **MODULE: SUBCONTRACTING (SUBKONTRAK)**

### **SUB-001: Subcontract Order Item Recognition Failure**
- **Severity:** Critical  
- **Page:** Subkontrak > Order Subkontrak > Buat Order Baru  
- **Description:** System fails to recognize items already added to order; persistently shows error "Minimal 1 item" despite items being present in the list.  
- **Steps to Reproduce:**
  1. Create new subcontract order
  2. Add item to details
  3. Click Save/Submit
- **Expected:** Order created with selected items  
- **Actual:** Validation error: requires minimum 1 item  
- **Completion Criteria:** Form state management debugged; item array properly bound to submission payload; validation logic checked against actual array length.

### **SUB-002: Partner Rate Management Missing Edit/Delete**
- **Severity:** Medium  
- **Page:** Subkontrak > Registrasi Mitra > Kelola Tarif  
- **Description:** Cannot edit or delete partner rates. Rates should be editable/deletable because they are not fixed (vary by unit/model/time period).  
- **Completion Criteria:** CRUD operations implemented for rate management; Edit and Delete buttons added; API endpoints for PUT/DELETE created; confirmation modal for deletion.

---

## **MODULE: CUTTING (PEMOTONGAN)**

### **CUT-001: Missing Action Buttons in Cutting Dashboard**
- **Severity:** Medium  
- **Page:** Pemotongan > Dashboard and Daftar Cut Plan  
- **Description:** No action buttons available in Cutting Dashboard and Cut Plan list views.  
- **Completion Criteria:** UI audit completed; "Tambah Cut Plan" or relevant action buttons added; routing to creation forms implemented.

---

## **SUMMARY STATISTICS**

| Module | Critical | High | Medium | Low | Total |
|--------|----------|------|--------|-----|-------|
| Dashboard | 0 | 0 | 2 | 0 | 2 |
| Inventory | 1 | 5 | 3 | 1 | 10 |
| Sales/CRM | 1 | 5 | 4 | 1 | 11 |
| Finance | 0 | 1 | 0 | 0 | 1 |
| Procurement | 2 | 3 | 1 | 1 | 7 |
| Subcontracting | 1 | 0 | 1 | 0 | 2 |
| Cutting | 0 | 0 | 1 | 0 | 1 |
| **TOTAL** | **5** | **14** | **12** | **3** | **34** |

**Priority Order Recommendation:**
1. Fix all **Critical** session/authentication issues (INV-002, SAL-004, PROC-001, PROC-004, SUB-001)
2. Resolve all **High** severity button/functionality failures
3. Address **Medium** layout and UI/UX improvements
4. Implement **Low** priority cosmetic fixes

**Technical Debt Note:** SAL-010 (POS Architecture) requires product decision before implementation.