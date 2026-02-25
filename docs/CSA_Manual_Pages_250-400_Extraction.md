# CSA Software Help Manual - Exhaustive Feature Extraction (Pages 250-400)

## Table of Contents
1. [Voucher Utang (AP Voucher)](#voucher-utang)
2. [Pembayaran Utang (AP Payment)](#pembayaran-utang)
3. [Retur PO (Purchase Return)](#retur-po)
4. [Penerimaan Bank (Bank Receipt)](#penerimaan-bank)
5. [Pengeluaran Bank (Bank Disbursement)](#pengeluaran-bank)
6. [Transaksi Journal (Journal Transaction)](#transaksi-journal)
7. [Tutup Bulan (Close Month)](#tutup-bulan)
8. [Journal Penutup (Closing Journal)](#journal-penutup)
9. [Penjualan Langsung (Direct Sales / POS)](#penjualan-langsung)
10. [Pembelian Langsung (Direct Purchase)](#pembelian-langsung)
11. [Retur Pembelian Langsung (Direct Purchase Return)](#retur-pembelian-langsung)
12. [Absensi Karyawan (Employee Attendance)](#absensi-karyawan)
13. [Menu Laporan (Reports Menu)](#menu-laporan)
14. [Menu Utility](#menu-utility)
15. [Parameter Kontrol (Control Parameters)](#parameter-kontrol)
16. [Utility Functions](#utility-functions)
17. [Bank Reports](#bank-reports)
18. [Financial/Accounting Reports](#financial-accounting-reports)
19. [Employee Reports](#employee-reports)
20. [Other Reports](#other-reports)

---

## 1. Voucher Utang (AP Voucher) <a name="voucher-utang"></a>

### Module: Trans, Voucher Utang
- **Kode Modul**: TVOUCHER
- **Judul Modul**: Transaksi Voucher Utang
- **Jenis Modul**: Transaksi
- **Menu Standar**: Menu, Pembelian

### Description
Generates AP vouchers from received POs. One PO generates one Voucher. Voucher creation triggers GL journal posting.

### Functions
- Generate Voucher Utang from Penerimaan PO (received PO)
- Automatic GL journal entry creation
- Voucher numbering (auto-generated)
- PPN (tax) calculation and posting
- Multi-line item support (from PO items)
- Discount handling per item
- Currency conversion (if multi-currency module installed)

### Fields (TVOUCHER)
- 10.CVESSION - Voucher Session
- 20.CVESSION2 - Voucher Session 2
- 30.CVESSION3 - Voucher Session 3
- 40.DVOUDATE - Tanggal Voucher
- 50.CVOUCHER - Nomor Voucher
- 55.CVOUCHER2 - Nomor Voucher (counter)
- 60.CSESSION - PO Session (linked)
- 70.CSUPPLIER - Kode Supplier
- 75. - Nama Supplier (from master)
- 80.DINVDATE - Tanggal Invoice Supplier
- 90.CINVNO - Nomor Invoice Supplier
- 100.CPPNNO - Nomor Faktur Pajak
- 110.CGLACCT - GL Account Utang
- 120. - Deskripsi GL Account
- 130.CNOTES - Catatan
- 140.NJMLTOT - Jumlah Total
- 150. - Jumlah Total (Mata Uang Domestik)
- 155.NPPNTOT - Jumlah PPN
- 160. - Jumlah PPN (Mata Uang Domestik)
- 170.NDISCTOT - Jumlah Diskon
- 180. - Jumlah Diskon (Mata Uang Domestik)
- 190.NGRANDTOT - Grand Total
- 200. - Grand Total (Mata Uang Domestik)
- 210. - Kurs (if multi-currency)

### Detail Line Fields (TVOULINE)
- 10.CVESSION - Voucher Session
- 20.NLINE - Nomor Baris
- 25. - Unique key
- 30.CSTOCKCD - Kode Stock
- 35. - Nama Stock
- 40.CGLACCT - GL Account
- 45. - Deskripsi GL Account
- 50.NQTY - Quantity
- 55.CUNIT - Satuan
- 60.NUNITPRC - Harga Satuan
- 70.NDISC1 - Diskon 1 (%)
- 80.NDISC2 - Diskon 2 (%)
- 90.NDISC3 - Diskon 3 (%)
- 100.NLINEVAL - Nilai Baris
- 110. - Nilai Baris (Mata Uang Domestik)

### GL Journal Generation
- Creates journal entries automatically:
  - Debit: Stock/Inventory Account or Expense Account
  - Credit: AP (Utang) Account
  - Separate entries for PPN if applicable
  - Discount entries if applicable

### Filters/Options
- Range: Session1 s/d Session2 (PO sessions to process)
- Range: Supplier1 s/d Supplier2
- Options: Proses Otomatis? (Auto-process all in range)

### Parameters (Parameter Voucher Utang)
- Accessible from Parameter Kontrol
- Controls voucher numbering, GL account defaults, PPN handling

---

## 2. Pembayaran Utang (AP Payment) <a name="pembayaran-utang"></a>

### Module: Trans, Pembayaran Utang
- **Kode Modul**: TPAYABLE
- **Judul Modul**: Transaksi Pembayaran Utang
- **Jenis Modul**: Transaksi
- **Menu Standar**: Menu, Pembelian

### Description
Records payment of AP vouchers. Supports partial and full payment. Creates GL journal entries for payments.

### Functions
- Select outstanding vouchers for payment
- Partial payment support
- Full payment support
- Automatic GL journal posting (Debit: AP Account, Credit: Bank/Cash Account)
- Payment allocation to specific vouchers
- Multiple voucher payment in single transaction
- Payment discount handling
- Currency conversion for foreign currency vouchers

### Fields (TPAYABLE)
- Payment Session
- Payment Date
- Supplier Code
- Supplier Name
- Bank Account (payment source)
- GL Account
- Payment Amount
- Currency conversion fields (if multi-currency)
- Notes/Description
- Voucher selection list (outstanding vouchers)

### Detail Fields
- Voucher Number
- Voucher Date
- Invoice Number
- Outstanding Amount
- Payment Amount (for this voucher)
- Remaining Balance

---

## 3. Retur PO (Purchase Return) <a name="retur-po"></a>

### Module: Trans, Retur PO
- **Kode Modul**: TRETPO
- **Judul Modul**: Transaksi Retur PO
- **Jenis Modul**: Transaksi
- **Menu Standar**: Menu, Pembelian

### Description
Processes returns of goods to suppliers from received POs. Reverses stock quantities and creates reversal GL entries.

### Functions
- Return goods from received PO
- Stock quantity reversal (reduces stock)
- GL journal reversal entries
- Partial return support (select specific items/quantities)
- Return reason tracking
- Links back to original PO and GRN

### Fields
- Return Session
- Return Date
- Original PO Session reference
- Supplier Code/Name
- Return items (from PO items)
- Quantity returned per item
- Return reason/notes
- GL Account for return

### Parameters (Parameter Retur PO)
- Accessible from Parameter Kontrol
- Controls return numbering, GL account defaults

---

## 4. Penerimaan Bank (Bank Receipt) <a name="penerimaan-bank"></a>

### Module: Trans, Penerimaan Bank
- **Kode Modul**: TBANKIN
- **Judul Modul**: Transaksi Penerimaan Bank
- **Jenis Modul**: Transaksi
- **Menu Standar**: Menu, Bank

### Description
Records bank receipts/incoming funds. Creates GL journal entries. Supports multiple distribution lines.

### Functions
- Record incoming bank transactions
- Multiple distribution lines per transaction
- GL journal auto-posting
- Bank account selection
- Distribution code assignment
- Currency conversion (if multi-currency)
- Voucher sequence tracking
- Links to AR (Piutang) transactions

### Fields (TBANKIN)
- Transaction Date
- Bank Code
- Distribution Code (Kode Distribusi Penerimaan)
- Voucher Number
- Description
- GL Account
- Debit Amount (Dana Masuk)
- Currency/Kurs fields
- Notes

### Transaction Types Generated
- Type: R (Receipt)
- Reference codes: A (Piutang), B (Bank), etc.

### Parameters (Parameter Penerimaan Bank)
- Accessible from Parameter Kontrol
- Controls numbering, default GL accounts

---

## 5. Pengeluaran Bank (Bank Disbursement) <a name="pengeluaran-bank"></a>

### Module: Trans, Pengeluaran Bank
- **Kode Modul**: TBANKOUT
- **Judul Modul**: Transaksi Pengeluaran Bank
- **Jenis Modul**: Transaksi
- **Menu Standar**: Menu, Bank

### Description
Records bank disbursements/outgoing funds. Creates GL journal entries. Supports multiple distribution lines.

### Functions
- Record outgoing bank transactions
- Multiple distribution lines per transaction
- GL journal auto-posting
- Bank account selection
- Distribution code assignment
- Currency conversion (if multi-currency)
- Voucher sequence tracking
- Links to AP (Utang) transactions

### Fields (TBANKOUT)
- Transaction Date
- Bank Code
- Distribution Code (Kode Distribusi Pengeluaran)
- Voucher Number
- Description
- GL Account
- Credit Amount (Dana Keluar)
- Currency/Kurs fields
- Notes

### Transaction Types Generated
- Type: Y (Payment)
- Reference codes: Y (Utang), B (Bank), etc.

### Parameters (Parameter Pengeluaran Bank)
- Accessible from Parameter Kontrol
- Controls numbering, default GL accounts

---

## 6. Transaksi Journal (Journal Transaction) <a name="transaksi-journal"></a>

### Module: Trans, Journal
- **Kode Modul**: TJOURNAL
- **Judul Modul**: Transaksi Journal
- **Jenis Modul**: Transaksi
- **Menu Standar**: Menu, Ledger

### Description
Manual journal entry module for General Ledger. Supports multi-line debit/credit entries. Used for adjustments, corrections, and non-standard transactions.

### Functions
- Create manual journal entries
- Multi-line debit/credit support
- Journal type classification
- Journal set grouping
- Auto-balanced validation (total debit must equal total credit)
- GL account lookup
- Description per line
- Posting to General Ledger (Transaksi Ledger)

### Fields (TJOURNAL header)
- Journal Session / Transaction Number
- Journal Date
- Journal Type (Jenis Journal)
- Journal Set
- Description
- Total Debit
- Total Credit

### Fields (TJOURNAL detail lines)
- Line Number
- GL Account Code
- GL Account Description
- Debit Amount
- Credit Amount
- Line Description

### Journal Types
- N: Journal Manual (Manual Journal)
- Other system-generated types: I (Inventory), O (Penjualan), P (Pembelian), X (Pembelian Berganda), T (Transfer), A (Piutang), Y (Utang), B (Bank), V (Invoicing/Vouchering)

### Parameters (Parameter Transaksi Journal)
- Accessible from Parameter Kontrol
- Controls journal numbering, default journal type/set

---

## 7. Tutup Bulan (Close Month) <a name="tutup-bulan"></a>

### Module: Util, Tutup Bulan
- **Kode Modul**: XCLSMNTH
- **Judul Modul**: Tutup Perioda (Bulan)
- **Jenis Modul**: Utility/Parameter
- **Menu Standar**: Menu, Utility

### Description
Period-end closing utility. Advances the current period (month) in the system. Prevents further transactions in closed periods.

### Functions
- Close current accounting period
- Advance Tahun Berjalan (Current Year) and Bulan Berjalan (Current Month) in Parameter Kontrol
- Validate all transactions are complete before closing
- Lock closed period from further entry
- Must be performed sequentially (cannot skip months)

### Prerequisites
- All transactions for the period must be entered
- All vouchers must be generated
- All bank transactions must be recorded
- All journal entries must be posted
- Ambil Record (if using dual database) should be done before closing

### Process
- Updates NTAHUN (Year) and NBULAN (Month) in SCTRL
- Locks previous period

---

## 8. Journal Penutup (Closing Journal) <a name="journal-penutup"></a>

### Module: Generate Journal Penutup
- **Related to**: Year-end closing process

### Description
Generates the closing journal entry to transfer Revenue and Expense account balances to Retained Earnings (Laba Ditahan).

### Functions
- Calculate net income (Revenue - Expense)
- Generate closing journal entry
- Transfer P&L balances to Laba Ditahan (Retained Earnings) GL Account
- Required before year-end Neraca (Balance Sheet) will balance
- Reversible if needed

---

## 9. Penjualan Langsung (Direct Sales / POS) <a name="penjualan-langsung"></a>

### Module: Trans, Penjualan Langsung
- **Jenis Modul**: Transaksi
- **Menu Standar**: Menu, Penjualan Langsung

### Description
Point-of-sale / direct sales transaction module. Used for walk-in retail sales, both cash and credit card.

### Functions
- Direct sales without prior Sales Order
- Cash payment processing
- Credit card payment processing (Non-Cash)
- Stock reduction on sale
- Receipt printing
- Per-Gudang (warehouse) tracking
- Both Inside and Outside Gudang support
- GL journal auto-posting

### Transaction Types
- Penjualan Langsung Cash
- Penjualan Langsung Non-Cash (Credit Card)

---

## 10. Pembelian Langsung (Direct Purchase) <a name="pembelian-langsung"></a>

### Module: Trans, Pembelian Langsung
- **Jenis Modul**: Transaksi

### Description
Direct purchase transaction without going through PO process. For small/immediate purchases.

### Functions
- Direct purchase entry
- Stock increase on receipt
- GL journal auto-posting
- Supplier tracking
- Per-Gudang tracking

---

## 11. Retur Pembelian Langsung (Direct Purchase Return) <a name="retur-pembelian-langsung"></a>

### Module: Trans, Retur Pembelian Langsung
- **Jenis Modul**: Transaksi

### Description
Return of goods from direct purchases (non-PO purchases).

### Functions
- Return direct purchase items
- Stock reduction
- GL journal reversal
- Links to original direct purchase

---

## 12. Absensi Karyawan (Employee Attendance) <a name="absensi-karyawan"></a>

### Module: Catatan Absensi Karyawan
- **Jenis Modul**: Transaksi/Master

### Description
Employee attendance recording system. Tracks clock-in/clock-out times and attendance status.

### Functions
- Record daily attendance per employee
- Clock-in time (Jam Datang)
- Clock-out time (Jam Pulang)
- Attendance status tracking:
  - Masuk (Present)
  - Off (Day Off)
  - Sakit (Sick)
  - Ijin (Permission/Leave)
  - Alpa (Absent without notice)
  - Salah (Error - e.g., missing clock-in or clock-out)
- Working hours calculation (Jumlah Jam Kerja)
- Notes/Catatan per entry

### Related Master Data
- Master Karyawan (Employee Master) - referenced but not detailed in these pages

---

## 13. Menu Laporan (Reports Menu) <a name="menu-laporan"></a>

### Module: Menu, Laporan
- **Kode Modul**: MLAPORAN
- **Judul Modul**: Menu, Laporan
- **Jenis Modul**: Menu
- **Menu Standar**: Menu, Utama

### Sub-Menus
- Menu, Lap. Stock
- Menu, Lap. Penjualan
- Menu, Lap. Pembelian
- Menu, Lap. Piutang
- Menu, Lap. Utang
- Menu, Lap. Bank
- Menu, Lap. Financial/Accounting
- Menu, Lap. Karyawan
- Menu, Lap. Lain-lain (Other Reports)
- Lap, Daftar Bank
- Lap, Cash Flow Bulanan
- Lap, Proyeksi Cash Flow

### Stock Reports (Menu, Lap. Stock)
Referenced but detailed content is in pages before 250.

### Sales Reports (Menu, Lap. Penjualan)
Referenced but detailed content is in pages before 250.

### Purchase Reports (Menu, Lap. Pembelian)
Referenced but detailed content is in pages before 250.

### AR Reports (Menu, Lap. Piutang)
Referenced but detailed content is in pages before 250.

### AP Reports (Menu, Lap. Utang)
Referenced but detailed content is in pages before 250.

---

## 14. Menu Utility <a name="menu-utility"></a>

### Module: Menu, Utility
- **Kode Modul**: MUTIL
- **Judul Modul**: Menu, Utility
- **Jenis Modul**: Menu
- **Menu Standar**: Menu, Utama

### Menu Items
1. **Util, Ganti User** (XGNTUSR) - Switch User
2. **Parameter Kontrol** (SCTRL) - Control Parameters
3. **Util, Ambil Record dari Database Sumber** (XMOVREC) - Fetch Records from Source Database
4. **Util, Dump Record ke Database Lain** (referenced) - Dump Records to Another Database
5. **Util, Import Master & Tran** (XIMPDAT) - Import Master Data & Transactions
6. **Util, Import Master Customer & Related** (XIMPCUS) - Import Customer Master & Related
7. **Util, Import Master (Selektif)** (XIMPMAS) - Selective Master Import
8. **Util, Export Master & Tran** (referenced) - Export Master Data & Transactions
9. **Util, Export Master Customer & Related** (referenced) - Export Customer Master & Related
10. **Util, Export Master (Selektif)** (referenced) - Selective Master Export
11. **Util, Dump Data untuk Stock Taking** (referenced) - Dump Data for Stock Taking
12. **Util, Hapus Transaksi Hasil Import** (referenced) - Delete Imported Transactions
13. **Util, Pack & Reindex** (referenced) - Pack & Reindex Database
14. **Util, Pindah Perioda** (referenced) - Move Period
15. **Util, Tutup Perioda** (XCLSMNTH) - Close Period
16. **Util, Copy Record dari Perioda Lalu** (referenced) - Copy Records from Previous Period
17. **Util, Backup Data** (referenced) - Backup Data
18. **Util, Restore Data** (referenced) - Restore Data
19. **Mast, Daftar Modul** (referenced) - Module List Master
20. **Menu, Utility Mengenai Stock** (referenced) - Stock Utilities Sub-menu
21. **Menu, Utility Mengenai Piutang** (referenced) - AR Utilities Sub-menu
22. **Menu, Utility Mengenai Utang** (referenced) - AP Utilities Sub-menu

### Related
- Penyesuaian Menu untuk User (Menu Customization per User)
- Menu dan Accessibility

---

## 15. Parameter Kontrol (Control Parameters) <a name="parameter-kontrol"></a>

### Module: Parameter Kontrol
- **Kode Modul**: SCTRL
- **Judul Modul**: Parameter Kontrol
- **Jenis Modul**: Utility/Parameter
- **Menu Standar**: Menu, Utility

### Main Screen Fields
- **Modus Directory**: T (Tahunan) or ' ' (Bulanan)
- **Mata Uang Domestik**: IDR (or configured domestic currency)
- **Tahun Berjalan**: Current active year (auto-set by Tutup Bulan)
- **Bulan Berjalan**: Current active month (auto-set by Tutup Bulan)
- **Toleransi Ke Depan**: Number of days tolerance for future-dated entry
- **Info Registrasi**: [Process] button - Registration Information
- **PPN Penjualan**: Sales tax rate (e.g., 10.00%)
- **PPN Pembelian**: Purchase tax rate (e.g., 10.00%)

### Parameter Buttons (Sub-Parameters accessible from main screen)
- **Parameter Umum**: [Process] - General Parameters
- **Parameter Khusus**: [Process] - Special Parameters

### Module-Specific Parameter Buttons

#### Sales Side
- **Sales Order**: [Process] - Sales Order Parameters
- **SJ Penjualan**: [Process] - Sales Delivery Note Parameters
- **Trans Kirim SJ**: [Process] - SJ Shipping Transaction Parameters
- **Invoice A/P**: [Process] - Invoice (AR) Parameters
- **Trans Retur SJ**: [Process] - Sales Return Parameters

#### Purchase Side
- **Purchase Request**: [Process] - Purchase Request Parameters
- **Purchase Order**: [Process] - Purchase Order Parameters
- **Trans Terima PO**: [Process] - PO Receiving Parameters
- **Trans Multi Rev**: [Process] - Multi Receiving Parameters
- **Voucher A/P**: [Process] - AP Voucher Parameters
- **Trans Retur PO**: [Process] - PO Return Parameters

#### Bank/Financial
- **Penerimaan Bank**: [Process] - Bank Receipt Parameters
- **Pengeluaran Bank**: [Process] - Bank Disbursement Parameters
- **Trans Journal**: [Process] - Journal Transaction Parameters

### Parameter Kontrol Fields (SCTRL database)
- 10.CDIRMODE - Modus Directory Data (' '=Bulanan, 'T'=Tahunan)
- 20.NTAHUN - Tahun Berjalan (Current Year)
- 30.NBULAN - Bulan Berjalan (Current Month)
- 40.NFORWARD - Jumlah Hari Toleransi untuk input data di luar Tahun/Bulan Berjalan
- 50.NSALESTAX - Isikan % PPN yang Diberlakukan untuk Penjualan
- 55.NPURCHTAX - Isikan % PPN yang Diberlakukan untuk Pembelian
- 60.CDOMCURCOD - Isikan Kode Mata Uang Domestik (hanya jika Modul Mata Uang terpasang)

### Field Categories
1. **(a) Informasi** - Read-only, auto-updated:
   - Modus Directory (set at Install Data)
   - Tahun Berjalan (set by Tutup Bulan)
   - Bulan Berjalan (set by Tutup Bulan)

2. **(b) Default** - Editable default values:
   - PPN Penjualan
   - PPN Pembelian

3. **(c) Counter** - Auto-updated, can be reset:
   - (none listed)

4. **(d) Soft Control** - Non-critical controls:
   - (none listed)

5. **(e) Hard Control** - Set once at installation:
   - Mata Uang Domestik

### Linked Parameter Pages

#### Parameter Sistem (Umum) - General System Parameters
- Referenced from Parameter Kontrol

#### Parameter Sistem (Khusus) - Special System Parameters
- Referenced from Parameter Kontrol

#### Parameter Sales Order
- Controls SO numbering, defaults, behavior

#### Parameter Surat Jalan Penjualan
- Controls delivery note numbering, defaults

#### Parameter Transaksi Kirim SJ Penjualan
- Controls shipping transaction parameters

#### Parameter Invoice (Piutang)
- Controls AR invoice numbering, defaults, GL accounts

#### Parameter Retur SJ Penjualan
- Controls sales return parameters

#### Parameter Purchase Request
- Controls PR numbering, defaults

#### Parameter Purchase Order
- Controls PO numbering, defaults, behavior

#### Parameter Penerimaan PO
- Controls PO receiving parameters

#### Parameter Penerimaan PO Berganda
- Controls multi-PO receiving parameters

#### Parameter Voucher Utang
- Controls AP voucher numbering, GL accounts

#### Parameter Retur PO
- Controls PO return parameters

#### Parameter Penerimaan Bank
- Controls bank receipt parameters

#### Parameter Pengeluaran Bank
- Controls bank disbursement parameters

#### Parameter Transaksi Journal
- Controls journal entry parameters

---

## 16. Utility Functions <a name="utility-functions"></a>

### 16.1 Util, Ganti User (Switch User)
- **Kode Modul**: XGNTUSR
- **Jenis Modul**: Utility/Parameter
- Logs out current user and prompts for new User ID and Password
- Used for shift changes or user switching
- Related: Master User

### 16.2 Util, Ambil Record dari Database Sumber (Fetch Records from Source DB)
- **Kode Modul**: XMOVREC
- **Jenis Modul**: Utility/Parameter

#### Description
Transfers transaction records from a Source Database to the Target Database. Records are deleted from Source after transfer (except Saldo Akhir Stock/Piutang/Utang).

#### Use Case
- Database Sumber: for all updating & transactions
- Database Tujuan: for reporting only
- Periodic transfer to keep reporting DB current

#### Filters/Options
- **Database Sumber**: Source database path (must match Target in: Modus Directory, Perioda Aktif, Versi, Site Id)
- **Update File Master?**: Whether to update master files in Target DB

#### Key Rules
- All data changes must be done in Source DB only
- Exception: if operation is ONLY in Target DB (e.g., Voucher generation, AP Payment in Target while Purchase in Source)
- Run Ambil Record BEFORE Tutup Bulan in Source
- Run Tutup Bulan in BOTH databases after Ambil Record
- All users must exit before running
- Backup recommended before running
- If process crashes, Restore Data on BOTH databases

### 16.3 Util, Import Master & Tran (Import Master Data & Transactions)
- **Kode Modul**: XIMPDAT
- **Jenis Modul**: Utility/Parameter
- Imports data from another Site (recorded as Gudang Outside)
- Uses CSA-ROSSY/P program
- Imports data exported by CSA-ROSSY/C
- Related: Export Data Master dan Transaksi

### 16.4 Util, Import Master Customer & Related
- **Kode Modul**: XIMPCUS
- **Jenis Modul**: Utility/Parameter
- Imports Customer data and related files (Member, Sales Person)
- From another Site (Gudang Outside)
- Updates existing Customer/Member/Sales Person records based on imported data
- Uses CSA-ROSSY/C program, imports CSA-ROSSY/P exports
- Different from Import Master & Transaksi: this module UPDATES existing records

### 16.5 Util, Import Master (Selektif)
- **Kode Modul**: XIMPMAS
- **Jenis Modul**: Utility/Parameter
- Selective import of Master data only (no transactions)
- From another Site (Gudang Outside)
- Updates existing master records based on imported data
- Uses CSA-ROSSY/C program, imports CSA-ROSSY/P exports

### 16.6 Util, Export Master & Tran
- Export master data and transactions to another site
- Counterpart of Import Master & Tran

### 16.7 Util, Export Master Customer & Related
- Export Customer and related data
- Counterpart of Import Master Customer & Related

### 16.8 Util, Export Master (Selektif)
- Selective export of master data only
- Counterpart of Import Master (Selektif)

### 16.9 Util, Dump Data untuk Stock Taking
- Dumps stock data for physical inventory count

### 16.10 Util, Hapus Transaksi Hasil Import
- Deletes previously imported transactions
- Cleanup utility

### 16.11 Util, Pack & Reindex
- Database maintenance: packs database files and rebuilds indexes
- Performance optimization

### 16.12 Util, Pindah Perioda
- Move/switch active period
- Navigate between accounting periods

### 16.13 Util, Tutup Perioda (Close Period)
- See Section 7 above (Tutup Bulan)

### 16.14 Util, Copy Record dari Perioda Lalu
- Copy records from a previous period
- Used for recurring entries

### 16.15 Util, Backup Data
- Database backup utility
- Recommended before major operations (Ambil Record, Tutup Bulan)

### 16.16 Util, Restore Data
- Database restore utility
- Restores from backup
- Used for crash recovery

### 16.17 Mast, Daftar Modul (Module List)
- Master list of all installed modules
- View module codes, names, types

### 16.18 Menu, Utility Mengenai Stock
- Sub-menu for stock-related utilities

### 16.19 Menu, Utility Mengenai Piutang
- Sub-menu for AR-related utilities

### 16.20 Menu, Utility Mengenai Utang
- Sub-menu for AP-related utilities

---

## 17. Bank Reports <a name="bank-reports"></a>

### Menu, Lap. Bank
- **Kode Modul**: MLAPBNK
- **Judul Modul**: Menu, Lap. Bank
- **Jenis Modul**: Menu
- **Menu Standar**: Menu, Laporan

### Reports:
1. Lap, Analisis Cash Flow
2. Lap, Buku Bank

### 17.1 Lap, Analisis Cash Flow (Cash Flow Analysis Report)
- **Kode Modul**: XRBANK02
- **Judul Modul**: Laporan Analisis Cash Flow
- **Jenis Modul**: Laporan

#### Description
Prints Cash Flow Analysis Report showing:
- Total Penerimaan Bank (Cash-In)
- Total Pengeluaran Bank (Cash-Out)
per Kode Distribusi Penerimaan/Pengeluaran Bank within a specified time period.

#### Filters/Options
- **Tanggal1 s/d Tanggal2**: Date range (e.g., 01/11 s/d 30/11)
- **KodeDist1 s/d KodeDist2**: Range of Distribution Codes (Dist.Penerimaan Bank / Dist.Pengeluaran Bank)
- **Kode Bank**: Bank code to process (* for all banks)
- **Lingkup Laporan**:
  - I: Penerimaan Bank (In) only
  - O: Pengeluaran Bank (Out) only
  - X: Penerimaan dan Pengeluaran Bank (Both)
- **Hari Kolom[1..n]**: Days per column (max 12 columns), e.g., Kolom-1: 10 (days 1-10), Kolom-2: 10 (days 11-20), Kolom-3: 10 (days 21-30)
- **Global/Detail Report**:
  - Detail: shows individual bank transactions
  - Global: shows summarized totals per distribution code per day-column
- **Konversi Mata Uang?**: Convert to domestic currency (if multi-currency module installed)
- **Urutan Output**:
  - 1: Kode Distribusi Penerimaan/Pengeluaran
  - 2: Deskripsi Distribusi Penerimaan/Pengeluaran

#### Output
- Summary of Transaksi Bank per Kode Distribusi Penerimaan Bank / Dist.Pengeluaran Bank
- Grouped into day-column "buckets"
- Cash-In section first, then Cash-Out, then Grand Total per bucket

### 17.2 Lap, Buku Bank (Bank Book Report)
- **Kode Modul**: XRBNCARD
- **Judul Modul**: Laporan Buku Bank
- **Jenis Modul**: Laporan

#### Description
Prints Bank Book (bank statement/ledger) for a specific bank.

#### Filters/Options
- **Kode Bank**: Bank code to process
- **Tanggal1 s/d Tanggal2**: Date range
- **Translate ke Domestik?**: Print in domestic currency?
- **Type Laporan**:
  - 1: Lengkap (Full detail)
  - 2: Ringkas (Summary)

#### Output Fields (per transaction line)
- Tanggal Transaksi (Transaction Date)
- Type Transaksi:
  - A: Adjustment
  - F: Finish
  - I: Issue (pengeluaran barang)
  - R: Receipt (penerimaan barang)
  - S: Ship (pengiriman/penjualan barang)
  - T: Transfer (pemindahan barang)
  - W: Return (retur barang)
  - Y: Payment (Pembayaran)
- Referensi Transaksi:
  - O: Penjualan
  - P: Pembelian
  - X: Pembelian Berganda
  - A: Piutang
  - Y: Utang
- In/Out indicator
- Nomor Voucher
- Voucher Sequence (*)
- Kode Distribusi
- Deskripsi
- GL Account (*)
- Kurs (if multi-currency) (*)
- Debet (Dana Masuk)
- Kredit (Dana Keluar)

(*) Not printed in "Ringkas" (Summary) report type

---

## 18. Financial/Accounting Reports <a name="financial-accounting-reports"></a>

### Menu, Lap. Financial/Accounting
- **Kode Modul**: MLAPFIN
- **Judul Modul**: Menu, Lap. Financial/Accounting
- **Jenis Modul**: Menu
- **Menu Standar**: Menu, Laporan

### Reports:
1. Lap, Saldo & Mutasi GL Accounts
2. Lap, Buku Besar (General Ledger)
3. Lap, Neraca (Quick Report)
4. Lap, Laba/Rugi (Quick Report)
5. Lap, Financial/Accounting Spesifik

### 18.1 Lap, Saldo & Mutasi GL Accounts (GL Account Balance & Mutation Report)
- **Kode Modul**: XRGL01
- **Judul Modul**: Laporan Saldo dan Mutasi GL Accounts
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Lap. Financial/Accounting

#### Description
Prints GL Account balances and mutations. Can also serve as Trial Balance (Neraca Percobaan).

#### Filters/Options
- **Account1 s/d Account2**: Range of GL Account codes
- **Tanggal1 s/d Tanggal2**: Date range

#### Output (per GL Account line)
- Kode Account
- Deskripsi Account
- Saldo Awal (Opening Balance)
- Mutasi Debet (Debit Mutations)
- Mutasi Kredit (Credit Mutations)
- Saldo Akhir (Closing Balance)

#### Access Control
- Requires Hak Akses "See Cost" and "See Price"

### 18.2 Lap, Buku Besar / General Ledger Report
- **Kode Modul**: XRGLCARD
- **Judul Modul**: Laporan Buku Besar (General Ledger)
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Lap. Financial/Accounting

#### Description
Prints the General Ledger (Buku Besar) showing all transactions per GL Account.

#### Filters/Options
- **Account1 s/d Account2**: Range of GL Account codes
- **Tanggal1 s/d Tanggal2**: Date range
- **Detail?**: Show reference/source transaction details?
- **Urutan Tampilan**:
  - 1: Tanggal Transaksi + Urutan Posting
  - 2: Urutan Posting
  - 3: Jenis Journal + JournalSet

#### Output (per transaction line in each GL Account)
- Tanggal Transaksi
- If Detail (Tampilkan Referensi):
  - Referensi Transaksi with codes:
    - I: Inventory Umum
    - J: Job
    - O: Penjualan
    - P: Pembelian
    - X: Pembelian Berganda
    - T: Transfer
    - A: Piutang
    - Y: Utang
    - B: Bank
    - N: Journal Manual
  - Nomor Referensi
  - Type Transaksi:
    - A: Adjustment
    - F: Finish
    - I: Issue (pengeluaran barang)
    - R: Receipt (penerimaan barang)
    - S: Ship (pengiriman/penjualan barang)
    - T: Transfer (pemindahan barang)
    - W: Return (retur barang)
    - Y: Payment (Pembayaran)
    - M: Input Manual
    - V: Invoicing/Vouchering
  - Nomor Transaksi Asal
  - Nomor Baris pada Transaksi Asal
- Jenis Journal
- Journal Set
- GL Account
- Deskripsi
- Debet
- Kredit
- Saldo

### 18.3 Lap, Neraca / Quick Report Balance Sheet
- **Kode Modul**: XRQUIKBS
- **Judul Modul**: Neraca (Quick Report)
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Lap. Financial/Accounting

#### Description
Generates Balance Sheet (Neraca) for a specific date, using a simple auto-generated layout.

#### Filters/Options
- **Tanggal1 s/d Tanggal2**: Balance sheet period date range

#### Output
- **Kelompok AKTIVA**: GL Accounts with type A (Asset)
- **Kelompok PASSIVA**: GL Accounts with type L (Liability) and type O (Owner's Equity/Modal)

#### Notes
- Total AKTIVA must equal total PASSIVA for a balanced sheet
- Difference indicates Generate Journal Penutup has not been run (Laba/Rugi not yet transferred to Retained Earnings)
- Custom layout can be created using Lap, Financial/Accounting Spesifik

### 18.4 Lap, Laba/Rugi / Quick Report Profit & Loss
- **Kode Modul**: XRQUIKPL
- **Judul Modul**: Laba/Rugi (Quick Report)
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Lap. Financial/Accounting

#### Description
Generates Income Statement (Laba/Rugi) for a specific period, using a simple auto-generated layout. Also known as Profit & Loss Statement.

#### Filters/Options
- **Tanggal1 s/d Tanggal2**: Period date range

#### Output
- **Kelompok PENDAPATAN**: GL Accounts with type R (Revenue)
- **Kelompok BIAYA**: GL Accounts with type E (Expense)
- Selisih (difference) = Laba/(Rugi) = Net Income/(Loss)
- Net income is transferred to Retained Earnings via Journal Penutup

#### Notes
- Custom layout can be created using Lap, Financial/Accounting Spesifik

### 18.5 Lap, Financial/Accounting Spesifik (Custom Financial Report)
- **Kode Modul**: BFINRPT
- **Judul Modul**: Laporan Keuangan
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Lap. Financial/Accounting

#### Description
Custom financial report designer. Allows creating specific financial report layouts (Balance Sheet, P&L, or any custom financial report).

Quick Report Neraca and Quick Report Rugi/Laba formulas can be saved into this module for custom editing/layout.

#### Header Fields (BFINRPT)
- 10.CRPTCODE - Kode Laporan Keuangan Ini
- 20.CRPTNAME - Deskripsi Mengenai Laporan Keuangan Ini
- 30.CRPTTITLE1 - Tampilan Judul Laporan Keuangan Ini (Baris-1)
- 40.CRPTTITLE2 - Tampilan Judul Laporan Keuangan Ini (Baris-2)
- 90.CREMARK - Catatan Mengenai Kelompok Stock Ini
- 100.LCALCCLS - Y: Journal Penutup (Income Summary) Dihitung, N: Journal Penutup Diabaikan
- 110.CCOL1TITLE - Isikan Judul Kolom ke-1
- 120.CCOL1TYPE - Isikan Jenis Isi Kolom 1
- 130. - Kolom1 (x)
- 210.CCOL2TITLE - Isikan Judul Kolom ke-2
- 220.CCOL2TYPE - Isikan Jenis Isi Kolom 2
- 230. - Kolom2 (x)
- 310.CCOL3TITLE - Isikan Judul Kolom ke-3
- 320.CCOL3TYPE - Isikan Jenis Isi Kolom 3
- 330. - Kolom3 (x)
- 410.CCOL4TITLE - Isikan Judul Kolom ke-4
- 420.CCOL4TYPE - Isikan Jenis Isi Kolom 4
- 430. - Kolom4 (x)

#### Detail Line Fields (BFRLINE - Definisi Baris Lap Keuangan)
- 10.CRPTCODE - Isikan Kode Laporan Keuangan Ini
- 20.NLINE - Nomor Baris Laporan
- 25. - Unique key w/ BFRLINE (otomatis diawali CRPTCODE)
- 30.CTYPE - Informasi yang Ditampilkan pada Baris Laporan Ini
- 31. - TypeDesc (x)
- 33.LPRINT - Apakah Baris Ini Dicetak dalam Laporan?
- 35.CTEXT - Text yang Akan Ditampilkan pada Laporan
- 36. - Text (x)
- 40.CACCT1 - Proses Mulai dari Account Ini
- 50.CACCT2 - Proses S/D dari Account Ini
- 60.NLINE1 - Proses Mulai dari Line Ini
- 70.NLINE2 - Proses S/D Line Ini
- 80.CPARENWHEN - Saldo/Transaksi Ditulis dalam Kurung Jika D:Debet, C:Kredit
- 85. - Paren When Desc (x)

#### Supports up to 4 columns of data with configurable types

---

## 19. Employee Reports <a name="employee-reports"></a>

### Menu, Lap. Karyawan
- **Kode Modul**: MLAPEMP
- **Judul Modul**: Menu, Lap. Karyawan
- **Jenis Modul**: Menu
- **Menu Standar**: Menu, Laporan

### Reports:
1. Lap, Absensi Harian
2. Lap, Absensi Bulanan
3. Lap, Absensi Per Karyawan

### 19.1 Lap, Absensi Harian (Daily Attendance Report)
- **Kode Modul**: XRABSHRN
- **Judul Modul**: Laporan Absensi Harian
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Lap. Karyawan

#### Description
Prints daily attendance for each employee showing clock-in and clock-out times.

#### Filters/Options
- **Karyawan1 s/d Karyawan2**: Employee code range
- **Tanggal**: Date to process

#### Output (per employee)
- Nama (Name)
- Jam Datang (Clock-in Time)
- Jam Pulang (Clock-out Time)
- Jumlah Jam Kerja (Working Hours)

### 19.2 Lap, Absensi Bulanan (Monthly Attendance Report)
- **Kode Modul**: XRABSBLN
- **Judul Modul**: Laporan Absensi Bulanan
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Lap. Karyawan

#### Description
Prints monthly attendance summary showing total days for each attendance status.

#### Filters/Options
- **Tanggal1 s/d Tanggal2**: Date range (default: current month)
- **Karyawan1 s/d Karyawan2**: Employee code range

#### Output (per employee)
- Nama (Name)
- Jumlah hari Masuk (Present days)
- Jumlah hari Off (Days off)
- Jumlah hari Sakit (Sick days)
- Jumlah hari Ijin (Leave days)
- Jumlah hari Alpa (Absent days)
- Jumlah hari Salah (Error days - missing clock-in/out)

### 19.3 Lap, Absensi Per Karyawan (Per-Employee Attendance Report)
- **Kode Modul**: XRABSBL2
- **Judul Modul**: Laporan Absensi Per Karyawan
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Lap. Karyawan

#### Description
Prints detailed per-employee attendance showing daily records for a date range.

#### Filters/Options
- **Karyawan**: Employee code
- **Tanggal1 s/d Tanggal2**: Date range (default: current month)

#### Output (per date for the selected employee)
- Masuk/Off/Sakit/Ijin/Alpa status
- Jam Masuk (Clock-in Time)
- Jam Pulang (Clock-out Time)
- Jumlah Jam Kerja (Working Hours)
- Catatan (Notes)

#### Summary Section (bottom of report)
- Total Masuk (Present days)
- Total Off (Days off)
- Total Sakit (Sick days)
- Total Ijin (Leave days)
- Total Alpa (Absent days)
- Total Salah (Error days)

---

## 20. Other Reports <a name="other-reports"></a>

### 20.1 Lap, Daftar Bank (Bank List Report)
- **Kode Modul**: XRBANK1
- **Judul Modul**: Laporan Daftar Bank
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Laporan

#### Description
Prints listing of all banks from Master Bank.

#### Access
- Hak Akses "Can Edit" allows output to printer, screen, or file

### 20.2 Lap, Cash Flow Bulanan (Monthly Cash Flow Report)
- **Kode Modul**: XRCSHFLW
- **Judul Modul**: Laporan Cash Flow Bulanan
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Laporan

#### Description
Monthly cash flow report showing:
- Total Penjualan Langsung Cash
- Total Penjualan Langsung Non-Cash (Credit Card)
- Total Pembelian Langsung
- Total Retur Pembelian Langsung

Per Gudang (both Inside and Outside).

#### Use Case
- Used on CSA-ROSSY/P to view transaction summary per Site
- Used on CSA-ROSSY/C to view per Gudang

#### Filters/Options
- **Tanggal1 s/d Tanggal2**: Date range

#### Output
- Sequential summary of total transaction values within the date range

### 20.3 Lap, Proyeksi Cash Flow (Cash Flow Projection Report)
- **Kode Modul**: XRCASH01
- **Judul Modul**: Laporan Proyeksi Cash Flow
- **Jenis Modul**: Laporan
- **Menu Standar**: Menu, Laporan

#### Description
Cash flow projection/forecast report showing:
- Total Piutang (Receivables)
- Total Utang (Payables)
in time-bucket columns based on aging.

#### Filters/Options
- **Tanggal Acuan**: Reference date (baseline)
- **Tanggal Basis**:
  - (1) Tanggal Invoice/Voucher
  - (2) Tanggal Jatuh Tempo (Due Date)
- **Kolom Hari**: Day "bucket" for aging, grouped by days from Tanggal Basis to Tanggal Acuan
- **Summary/Detail Customer**:
  - Summary: Sub-customers of Corp Customer not shown separately
  - Detail: All customers shown
- **Konversi Mata Uang?**: Convert to domestic currency (if multi-currency)
- **Global/Detail Report**:
  - Detail: Outstanding Invoice/Voucher details shown
  - Global: Customer/Supplier totals per bucket

#### Output
- Outstanding Invoice per Customer (AR/receivables, positive = projected cash-in)
- Outstanding Voucher per Supplier (AP/payables, negative = projected cash-out)
- Grand Total per "bucket" = net projected cash flow (positive = inflow, negative = outflow)
- Ordered by Customer/Supplier Code

---

## Summary of All Modules/Codes Found (Pages 250-400)

### Transaction Modules
| Code | Name | Type |
|------|------|------|
| TVOUCHER | Transaksi Voucher Utang | Transaksi |
| TPAYABLE | Transaksi Pembayaran Utang | Transaksi |
| TRETPO | Transaksi Retur PO | Transaksi |
| TBANKIN | Transaksi Penerimaan Bank | Transaksi |
| TBANKOUT | Transaksi Pengeluaran Bank | Transaksi |
| TJOURNAL | Transaksi Journal | Transaksi |

### Utility Modules
| Code | Name | Type |
|------|------|------|
| XGNTUSR | Ganti User | Utility/Parameter |
| SCTRL | Parameter Kontrol | Utility/Parameter |
| XMOVREC | Ambil Record Database Sumber | Utility/Parameter |
| XIMPDAT | Import Data Master dan Transaksi | Utility/Parameter |
| XIMPCUS | Import Data Master Customer & Related | Utility/Parameter |
| XIMPMAS | Import Data Master (Selektif) | Utility/Parameter |
| XCLSMNTH | Tutup Perioda (Bulan) | Utility/Parameter |

### Report Modules
| Code | Name | Type |
|------|------|------|
| XRBANK02 | Laporan Analisis Cash Flow | Laporan |
| XRBNCARD | Laporan Buku Bank | Laporan |
| XRGL01 | Laporan Saldo dan Mutasi GL Accounts | Laporan |
| XRGLCARD | Laporan Buku Besar (General Ledger) | Laporan |
| XRQUIKBS | Neraca (Quick Report) / Balance Sheet | Laporan |
| XRQUIKPL | Laba/Rugi (Quick Report) / P&L | Laporan |
| BFINRPT | Laporan Keuangan Spesifik | Laporan |
| XRABSHRN | Laporan Absensi Harian | Laporan |
| XRABSBLN | Laporan Absensi Bulanan | Laporan |
| XRABSBL2 | Laporan Absensi Per Karyawan | Laporan |
| XRBANK1 | Laporan Daftar Bank | Laporan |
| XRCSHFLW | Laporan Cash Flow Bulanan | Laporan |
| XRCASH01 | Laporan Proyeksi Cash Flow | Laporan |

### Menu Modules
| Code | Name | Type |
|------|------|------|
| MLAPORAN | Menu, Laporan | Menu |
| MLAPBNK | Menu, Lap. Bank | Menu |
| MLAPFIN | Menu, Lap. Financial/Accounting | Menu |
| MLAPEMP | Menu, Lap. Karyawan | Menu |
| MUTIL | Menu, Utility | Menu |

### Database Files Referenced
| File | Description |
|------|-------------|
| SCTRL.DBx | Parameter Kontrol data |
| BFINRPT.DBx | Financial Report definitions |
| BFRLINE.DBx | Financial Report line definitions |
| TVOUCHER records | Voucher Utang header data |
| TVOULINE records | Voucher Utang detail line data |

### GL Account Types
| Type | Description |
|------|-------------|
| A | Asset (AKTIVA) |
| L | Liability (PASSIVA) |
| O | Owner's Equity / Modal |
| R | Revenue (PENDAPATAN) |
| E | Expense (BIAYA) |

### Transaction Reference Codes (in GL/Bank)
| Code | Description |
|------|-------------|
| I | Inventory Umum |
| J | Job |
| O | Penjualan (Sales) |
| P | Pembelian (Purchase) |
| X | Pembelian Berganda (Multi-Purchase) |
| T | Transfer |
| A | Piutang (AR) |
| Y | Utang (AP) |
| B | Bank |
| N | Journal Manual |

### Transaction Type Codes
| Code | Description |
|------|-------------|
| A | Adjustment |
| F | Finish |
| I | Issue (pengeluaran barang) |
| R | Receipt (penerimaan barang) |
| S | Ship (pengiriman/penjualan barang) |
| T | Transfer (pemindahan barang) |
| W | Return (retur barang) |
| Y | Payment (Pembayaran) |
| M | Input Manual |
| V | Invoicing/Vouchering |

### Attendance Status Codes
| Status | Description |
|--------|-------------|
| Masuk | Present |
| Off | Day Off |
| Sakit | Sick |
| Ijin | Permission/Leave |
| Alpa | Absent without notice |
| Salah | Error (missing clock-in/out) |

### System Programs Referenced
| Program | Description |
|---------|-------------|
| CSA-ROSSY/P | Server/Parent program for multi-site operations |
| CSA-ROSSY/C | Client/Child program for multi-site operations |

### Key Concepts/Features
- **Dual Database Architecture**: Source DB (transactions) + Target DB (reporting)
- **Multi-Site Support**: Gudang Inside/Outside, Site-based data exchange via Import/Export
- **Multi-Currency Module**: Optional module for foreign currency support with domestic conversion
- **Perioda (Period) Management**: Monthly accounting periods, sequential closing required
- **GL Integration**: All transaction modules auto-generate GL journal entries
- **PPN (Tax) Handling**: Configurable tax rates for sales and purchases
- **Hak Akses (Access Rights)**: Per-module, per-user access control with "See Cost", "See Price", "Can Edit" permissions
- **Journal Penutup**: Year-end closing journal for P&L to Retained Earnings transfer
- **Penyesuaian Menu untuk User**: Per-user menu customization
- **Menu dan Accessibility**: Menu accessibility settings
