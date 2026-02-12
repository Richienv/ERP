# Master Project Roadmap: RISE ERP System

Dokumen ini adalah **Single Source of Truth** (Sumber Kebenaran Tunggal).
Roadmap ini mencakup **SEMUA** fungsi dari `erp_system_benchmark.md` yang dipetakan ke dalam Flow Bisnis. Item yang tidak masuk ke flow inti dikelompokkan dalam "Advanced Modules".

**Legenda:**
- `[ ]` : Belum Dikerjakan (Pending)
- `[x]` : **SELESAI & SUKSES** (Terverifikasi berfungsi penuh: DB, Logic, UI)
- `[!]` : **ERROR / GAGAL** (Fitur ada tapi error atau tidak sesuai)
- `[/]` : Sedang Dikerjakan (In Progress)

---

## Phase 1: Foundations (Core System & Master Data)

### 1.1 Core Configuration `[Bench 7]`
- [ ] **Cloud & Licensing**:
    - [ ] Server Setup: Ubuntu, 4 Core, 8GB RAM, 100GB Storage `[Bench 7]`
    - [ ] Backups: 30 days retention `[Bench 7]`

### 1.2 Master Data: Partners (CRM Base) `[Bench 2, 6]`
- [ ] **Customer Management**:
    - [ ] Company & Contact Person Management `[Bench 2]`
    - [ ] Customer Contacts & Addresses Management `[Bench 2]`
    - [ ] Customer Tagging `[Bench 2]`
    - [ ] Customer E-Faktur Credentials `[Bench 2]`
    - [ ] Customer Target & Reward `[Bench 2]`
- [ ] **Vendor Management**:
    - [ ] Vendors & Contact Person Management `[Bench 6]`
    - [ ] Vendor Tagging `[Bench 6]`
    - [ ] Vendor Payment Terms Tracking `[Bench 6]`
    - [ ] Purchase Lead Time per Vendor Management `[Bench 6]`
    - [ ] Vendor Pricelist Approval Matrix `[Bench 6]`

### 1.3 Master Data: Products `[Bench 2, 4]`
- [ ] **Product Database**:
    - [ ] Product Information: SKU, Name, Variants, Vendor Tagging, Lifetime `[Bench 4]`
    - [ ] Product Attributes & Variants (Size, Color, Material) `[Bench 2]`
    - [ ] SKU & Barcode Generation per Product `[Bench 2]`
    - [ ] Unlimited Product Category Management `[Bench 4]`
    - [ ] Product Costing: Standard, FIFO, Average `[Bench 4]`
- [ ] **Unit of Measure (UoM)**:
    - [ ] Multi Unit of Measure Management `[Bench 4]`
    - [ ] Smaller / Bigger Ratio Management `[Bench 4]`
- [ ] **Data Management**:
    - [ ] Product Bundling Management `[Bench 2]`
    - [ ] Alternative Product Management `[Bench 2]`
    - [ ] Import Pricelist Function `[Bench 2]`

### 1.4 Manufacturing Setup `[Bench 1]`
- [ ] **Work Centers**:
    - [ ] Manage Work Centers & Locations `[Bench 1]`
    - [ ] Manage Work Center Groups `[Bench 1]`
    - [ ] Standard working hours per Work Center `[Bench 1]`
    - [ ] Overhead Time & Material Usage per Hour `[Bench 1]`
- [ ] **Kiosk Mode**:
    - [ ] Tablet/Laptop Mode for Work Centers `[Bench 1]`
    - [ ] Employee Attendance Tap `[Bench 1]`

---

## Phase 2: CRM & Sales Strategy (Pre-Sales)
*Module: CRM Sales Management (Full)*

### 2.1 Leads & Pipeline `[Bench 2]`
- [ ] **Pipeline Management**:
    - [ ] Stages Management `[Bench 2]`
    - [ ] Interested Products for Quotation `[Bench 2]`
    - [ ] Won & Lost Reasons Analysis `[Bench 2]`
    - [ ] Online Lead Form `[Bench 2]`
    - [ ] Leads / Pipeline Pivot Analysis `[Bench 2]`
- [ ] **Activity Tracking**:
    - [ ] Track #meetings, #calls, #emails, #follow-up `[Bench 2]`
    - [ ] Activity Reminder per Lead `[Bench 2]`
    - [ ] Salesperson Activity Targeting & Realization `[Bench 2]`
    - [ ] GPS Tracking for meeting (Mobile App) `[Bench 2]`

### 2.2 Sales Strategy & Analysis `[Bench 2]`
- [ ] **Sales Forecast**:
    - [ ] Config: Start/End Date, Base, Products, Period `[Bench 2]`
    - [ ] Methods: Moving Average, Autoregression, ARIMA, Holt Winter`s `[Bench 2]`
    - [ ] View Forecast Report & Predicted Result `[Bench 2]`
- [ ] **Customer Analysis**:
    - [ ] RFM Analysis (Recency, Frequency, Monetary) `[Bench 2]`
    - [ ] Customer Segmentation (Champion, Loyal, Sleeping, etc) `[Bench 2]`
- [ ] **Promotions & Loyalty**:
    - [ ] Sales Coupon Generation (Rewards, Limits) `[Bench 2]`
    - [ ] Promotion Validity & Reward Types (Discount, Free Product) `[Bench 2]`
    - [ ] Loyalty Point: Weightage, Gifts, History `[Bench 2]`

---

## Phase 3: RISE Business Flow (Garment Manufacturing)

### 3.1 R&D & Design `[Bench 1]`
- [ ] **Bill of Materials**:
    - [ ] Multi Level BoM & Gain/Loss Materials `[Bench 1]`
    - [ ] BoM Creation Wizard `[Bench 1]`
- [ ] **Routing**:
    - [ ] Define Process & Duration `[Bench 1]`
    - [ ] Link Materials to Routing `[Bench 1]`
- [ ] **Costing**:
    - [ ] Cost Forecasting based on Work Center / BoM `[Bench 1]`

### 3.2 Supply Chain (Purchasing) `[Bench 6]`
- [ ] **Purchase Request (PR)**:
    - [ ] Approval Matrix (Branch, Qty, Amount) `[Bench 6]`
    - [ ] Combine/Split PR to RFQ `[Bench 6]`
- [ ] **Purchasing Execution**:
    - [ ] RFQ Comparison & Multi-Vendor Email `[Bench 6]`
    - [ ] Multiple PO Types (Goods, Services, Assets) `[Bench 6]`
    - [ ] Purchase Tender Management (Comparison, Analytic Account) `[Bench 6]`
    - [ ] Blanket Order Management (Contract, History) `[Bench 6]`
    - [ ] Purchase Order Expiry Tracking `[Bench 6]`
    - [ ] Schedule Multiple Deliveries per Date/Warehouse `[Bench 6]`
    - [ ] E-Budgeting: PR/PO linked to Budget Code `[Bench 6]`

### 3.3 Production Execution `[Bench 1]`
- [ ] **Planning**:
    - [ ] Manufacturing Demand Planning `[Bench 1]`
    - [ ] Auto Schedule based on Duration & WC Availability `[Bench 1]`
    - [ ] Calculate Materials to Purchase based on Forecast `[Bench 1]`
- [ ] **Manufacturing Orders**:
    - [ ] Auto Create from Sales Order or Plan `[Bench 1]`
    - [ ] Capacity Exceed Production Handling `[Bench 1]`
    - [ ] Track Full & Partial Production `[Bench 1]`
- [ ] **Shop Floor (Kiosk)**:
    - [ ] Real-time Material Scanning & Update `[Bench 1]`
    - [ ] Real-time Finished Goods Input `[Bench 1]`
    - [ ] By Products & Scrap Management `[Bench 1]`
    - [ ] Quality Control per WIP & Finished Good `[Bench 1]`

### 3.4 Sales Execution `[Bench 2]`
- [ ] **Quotation & SO**:
    - [ ] Discount, Margin Calculation, Tax Fiscal Position `[Bench 2]`
    - [ ] Upsell Recommendation per SO Line `[Bench 2]`
    - [ ] Multiple Delivery per Sales Order `[Bench 2]`
    - [ ] Credit Limit Check (Lock SO, Approval Matrix) `[Bench 2]`
    - [ ] Sales Agreement (Blanket Order) with different deliveries `[Bench 2]`
- [ ] **Sales Team**:
    - [ ] Multi Level Sales Team & Access Rights `[Bench 2]`
    - [ ] Sales Report by Salespersons `[Bench 2]`

---

## Phase 4: Inventory Management (Consolidated)

### 4.1 Operations `[Bench 4]`
- [ ] **Movement**:
    - [ ] Goods Receipt, Delivery, Internal Transfer `[Bench 4]`
    - [ ] Product Usage/Scrap (with Approval Matrix) `[Bench 4]`
    - [ ] Return Merchandise Authorization (RMA) `[Bench 4]`
    - [ ] Direct Dropship (Supplier to Customer) `[Bench 4]`
- [ ] **Warehouse**:
    - [ ] Picking Waves (Group Delivery Notes) `[Bench 4]`
    - [ ] Packages / Continer Tracking `[Bench 4]`
    - [ ] Location Removal Strategy (FIFO, LIFO, FEFO) `[Bench 4]`
    - [ ] Barcode/QR Scanning with Camera `[Bench 4]`

### 4.2 Consignment Management `[Bench 3]`
- [ ] Consignment Agent & Location Management `[Bench 3]`
- [ ] Consignment Commission & Pricelist `[Bench 3]`
- [ ] Consignment Stock Adjustment & Inventory Valuation `[Bench 3]`

### 4.3 Control & Replenishment `[Bench 4]`
- [ ] **Stock Control**:
    - [ ] Stock Count & Adjustment (with Value) `[Bench 4]`
    - [ ] Lot & Serial Number Tracking (Expiry, Traceability) `[Bench 4]`
- [ ] **Replenishment**:
    - [ ] Reordering Rules (Min/Max) `[Bench 4]`
    - [ ] Auto Trigger: PR, MR, RFQ, PO, Internal Transfer `[Bench 4]`

---

## Phase 5: Finance, Accounting & Budgeting

### 5.1 Core Accounting `[Bench 5]`
- [ ] **Journals & COA**:
    - [ ] Chart of Accounts (Tags, Parent) `[Bench 5]`
    - [ ] Journal Entries (Auto Recurring, Reversal) `[Bench 5]`
    - [ ] Multi Currency (Realized/Unrealized Gain/Loss) `[Bench 5]`
- [ ] **Receivables (AR)**:
    - [ ] Invoice Management (Down Payment, Terms) `[Bench 5]`
    - [ ] Credit Note & Refunds `[Bench 5]`
    - [ ] AR Exchange Management `[Bench 5]`
    - [ ] GIRO Payments (Open, Posted, Cleared, Rejected) `[Bench 5]`
- [ ] **Payables (AP)**:
    - [ ] Vendor Bills (DP, Deposit) `[Bench 5]`
    - [ ] Payment Vouchers (Approval Request) `[Bench 5]`
    - [ ] AP Exchange Management `[Bench 5]`

### 5.2 Banking & Cash `[Bench 5]`
- [ ] **Bank Integration**: BCA & CIMB (Sync, Mutation) `[Bench 5]`
- [ ] **Reconciliation**: Bank Statement Import & Matching `[Bench 5]`
- [ ] **Petty Cash**: Tracking, Top Up, Expense Voucher Approval `[Bench 5]`

### 5.3 Advanced Accounting `[Bench 5]`
- [ ] **Assets**:
    - [ ] Depreciation (Linear, Degressive) `[Bench 5]`
    - [ ] Asset Disposal & Revaluation `[Bench 5]`
- [ ] **Taxes**:
    - [ ] E-Faktur Integration (Generate NSFP, Export DJP) `[Bench 5]`
    - [ ] Fiscal Years & Tax Periods `[Bench 5]`
- [ ] **Analytic Accounting**:
    - [ ] Cost Center Analysis (Profit/Loss per Center) `[Bench 5]`
    - [ ] Multi-Level Analytic Accounting `[Bench 5]`
- [ ] **Budgeting**:
    - [ ] Budget Plan vs Actual Pivot Analysis `[Bench 5]`
    - [ ] Analytic Account Budget Request `[Bench 5]`

### 5.4 Reporting `[Bench 5]`
- [ ] **Financial Statements**: P&L, Balance Sheet, Cash Flow `[Bench 5]`
- [ ] **Financial Ratios**: Liquidity, Solvability, Profitability (ROA, ROE) `[Bench 5]`
- [ ] **Management Ratios**: Activity, Turnover `[Bench 5]`

---

## Phase 6: Mobile Apps & Extras `[Bench 2, 4]`

- [ ] **Sales App**:
    - [ ] Leads, Customer, Quotation Management `[Bench 2]`
    - [ ] Offline & Hybrid Connection `[Bench 2]`
- [ ] **Inventory App**:
    - [ ] Receiving, Picking, Stock Take `[Bench 4]`
    - [ ] Online Signature for Delivery `[Bench 4]`
    - [ ] Hybrid Connection `[Bench 4]`

---

## Phase 7: SDM / HCM (Cross-Module Backbone)

> Catatan Audit: UI SDM (`/hcm`) sudah ada, tetapi mayoritas masih mock data. Fase ini menjadi prioritas agar SDM benar-benar terhubung ke Pengadaan, Manufaktur, Inventori, Finance, dan Dashboard CEO.

### 7.1 Data Foundation & Identity
- [/] **Core HR Master Data (DB)**:
    - [/] Employee, Attendance, LeaveRequest, EmployeeTask model sudah tersedia di schema.
    - [ ] Employee lifecycle fields lengkap: contract type, grade, shift group, supervisor, branch.
- [ ] **User ↔ Employee Identity Link**:
    - [ ] Relasi tegas antara auth user dengan employee (tanpa fallback "any employee").
    - [ ] Guard role + scope akses per department/warehouse/work center.
- [ ] **Reference Data SDM**:
    - [ ] Master Department, Position, Shift, Employment Status.
    - [ ] BPJS/PTKP profile per karyawan.

### 7.2 Employee Master (Operational)
- [ ] **Employee CRUD Full Backend**:
    - [ ] Create/Edit/Deactivate employee dari page SDM.
    - [ ] Import/export karyawan (CSV/XLSX) dengan validasi.
    - [ ] Dokumen karyawan (KTP/NPWP/BPJS/Kontrak) terhubung ke "Dokumen & Sistem".
- [ ] **Org & Assignment**:
    - [ ] Struktur organisasi, reporting line, manager assignment.
    - [ ] Assignment ke warehouse/work center untuk operasional lintas modul.

### 7.3 Attendance, Shift, Leave, Overtime
- [ ] **Attendance Engine**:
    - [ ] Clock-in/clock-out API + UI (manual + kiosk/work center mode).
    - [ ] Late, absent, remote, leave status otomatis per shift.
- [ ] **Shift Scheduling**:
    - [ ] Roster per minggu/bulan, termasuk lembur terencana.
    - [ ] Dependency ke kapasitas Work Center (Manufaktur).
- [ ] **Leave & Overtime Workflow**:
    - [ ] Request -> approval manager -> approval HR (opsional).
    - [ ] Task approval via EmployeeTask + notifikasi dashboard CEO/manager.

### 7.4 Payroll Engine & Finance Integration
- [ ] **Payroll Data Model**:
    - [ ] PayrollPeriod, PayrollRun, PayrollItem, Payslip, PayrollComponent.
    - [ ] Versioned formula (gaji pokok, tunjangan, lembur, potongan, BPJS, PPh21).
- [ ] **Payroll Processing**:
    - [ ] Generate draft payroll dari attendance + leave + overtime.
    - [ ] Approval berjenjang + lock period.
    - [ ] Slip gaji per karyawan.
- [ ] **Finance Posting**:
    - [ ] Auto jurnal payroll ke COA (gaji, kewajiban BPJS/PPh, kas/bank).
    - [ ] Integrasi ke Pembayaran AP/checkbook untuk disbursement batch.

### 7.5 Cross-Module Dependency Enforcement
- [ ] **Procurement**:
    - [ ] PR requester/approver harus valid employee aktif.
    - [ ] Approval matrix berdasarkan jabatan/department.
- [ ] **Inventory/Warehouse**:
    - [ ] Warehouse manager assignment dari employee aktif.
    - [ ] Stock opname/adjustment approval masuk ke task approver SDM.
- [ ] **Manufacturing/Quality**:
    - [ ] Attendance operator mempengaruhi kapasitas produksi harian.
    - [ ] QC inspector wajib employee aktif dengan role sesuai.
- [ ] **Executive Dashboard**:
    - [ ] KPI SDM real-time: headcount, attendance, leave pending, payroll exposure.

### 7.6 Reporting & Compliance
- [ ] **HR Analytics**:
    - [ ] Absensi bulanan, lembur, turnover, produktivitas per department.
- [ ] **Compliance Reports**:
    - [ ] BPJS, PPh21, dan laporan ketenagakerjaan periodik.
- [ ] **Auditability**:
    - [ ] Approval log end-to-end + siapa, kapan, alasan.
