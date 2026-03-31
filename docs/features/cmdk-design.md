# Cmd+K Command Palette — Enhanced Design

> **Status**: Design only — not yet implemented.
> **Date**: 2026-03-27
> **Depends on**: `cmdk@1.1.1`, `@radix-ui/react-dialog`, Next.js App Router

---

## 1. Action Registry Schema

```typescript
// lib/cmdk-registry.ts

type ActionType = "navigate" | "open-dialog" | "open-page-form" | "trigger-fn"

interface CmdKAction {
  /** Unique key, e.g. "create-vendor" */
  id: string

  /** What happens on select */
  type: ActionType

  /** Display text in Bahasa: "Buat Vendor Baru" */
  label: string

  /** Bilingual search terms — Indonesian AND English, including typo-prone variants */
  keywords: string[]

  /** Tabler icon component name (resolved at render time) */
  icon: string

  /** Parent module slug for grouping & badge display */
  module: Module

  /** Target route. For navigate/open-dialog, this is the page URL */
  route: string

  /**
   * Only for type "open-dialog" / "open-page-form" / "trigger-fn".
   * Tells the target page WHAT to open after navigation completes.
   */
  signal?: {
    /** URL query param key. Convention: ?new=true, ?action=create-bom */
    param: string
    value: string
  }

  /** Optional global keyboard shortcut hint, e.g. "Ctrl+Shift+V" */
  shortcut?: string

  /** Minimum role required (omit = all roles). Used for filtering. */
  requiredRole?: string[]

  /** If true, this action appears in the "Aksi Cepat" group at the top */
  pinned?: boolean
}

type Module =
  | "dasbor"
  | "inventori"
  | "penjualan"
  | "pengadaan"
  | "keuangan"
  | "manufaktur"
  | "sdm"
  | "dokumen"
  | "pengaturan"
  | "subkontrak"
  | "costing"
  | "cutting"

/** Color + icon mappings per module, used for badge/icon tinting */
const MODULE_META: Record<Module, { color: string; label: string }> = {
  dasbor:      { color: "bg-gray-100 text-gray-600",    label: "Dasbor" },
  inventori:   { color: "bg-blue-100 text-blue-600",    label: "Inventori" },
  penjualan:   { color: "bg-green-100 text-green-600",  label: "Penjualan" },
  pengadaan:   { color: "bg-orange-100 text-orange-600", label: "Pengadaan" },
  keuangan:    { color: "bg-purple-100 text-purple-600", label: "Keuangan" },
  manufaktur:  { color: "bg-slate-100 text-slate-600",  label: "Manufaktur" },
  sdm:         { color: "bg-amber-100 text-amber-700",  label: "SDM" },
  dokumen:     { color: "bg-zinc-100 text-zinc-600",    label: "Dokumen" },
  pengaturan:  { color: "bg-gray-100 text-gray-500",    label: "Pengaturan" },
  subkontrak:  { color: "bg-slate-100 text-slate-600",  label: "Subkontrak" },
  costing:     { color: "bg-slate-100 text-slate-600",  label: "Costing" },
  cutting:     { color: "bg-slate-100 text-slate-600",  label: "Cutting" },
}
```

### Design Rationale

- **`signal` instead of embedding `?new=true` in the route**: Keeps route and intent separate. The registry defines *what* to signal; the execution engine constructs the URL.
- **`type` distinguishes behavior**: `navigate` = just go there. `open-dialog` = navigate + signal to auto-open a modal on that page. `open-page-form` = navigate to a dedicated `/new` form page. `trigger-fn` = run a function without navigation (e.g., export).
- **`keywords` is an array, not a string**: Allows precise matching. Each entry is a searchable phrase. Both Indonesian and English variants.
- **`module` is a typed slug**: Used for grouping results, tinting icons, showing module badge.

---

## 2. Full Action Catalog

### 2.1 Dasbor

| ID | Type | Label | Route | Signal | Keywords |
|----|------|-------|-------|--------|----------|
| `nav-dashboard` | navigate | Dasbor Utama | `/dashboard` | — | dashboard, beranda, home |
| `nav-approvals` | navigate | Antrian Persetujuan | `/dashboard/approvals` | — | approval, persetujuan, pending |
| `nav-pos` | navigate | Point of Sale | `/dashboard/pos` | — | pos, kasir, cashier |
| `nav-ecommerce` | navigate | E-Commerce Dashboard | `/dashboard/ecommerce` | — | ecommerce, toko online |

### 2.2 Inventori

**Navigation (12 pages)**

| ID | Type | Label | Route | Keywords |
|----|------|-------|-------|----------|
| `nav-inv-dashboard` | navigate | Dashboard Inventori | `/inventory` | inventory dashboard, stok |
| `nav-inv-products` | navigate | Kelola Produk | `/inventory/products` | products, produk, material, barang |
| `nav-inv-categories` | navigate | Kategori Produk | `/inventory/categories` | categories, kategori |
| `nav-inv-stock` | navigate | Level Stok | `/inventory/stock` | stock level, stok, persediaan |
| `nav-inv-movements` | navigate | Pergerakan Stok | `/inventory/movements` | movements, pergerakan, mutasi stok |
| `nav-inv-transfers` | navigate | Transfer Stok | `/inventory/transfers` | transfer, pindah stok |
| `nav-inv-warehouses` | navigate | Gudang & Lokasi | `/inventory/warehouses` | warehouse, gudang, lokasi |
| `nav-inv-fabric` | navigate | Fabric Rolls | `/inventory/fabric-rolls` | fabric, kain, roll |
| `nav-inv-audit` | navigate | Stok Opname | `/inventory/audit` | audit, opname, stock count |
| `nav-inv-cycle` | navigate | Opname Batch | `/inventory/cycle-counts` | cycle count, opname batch |
| `nav-inv-alerts` | navigate | Peringatan Stok | `/inventory/alerts` | alerts, peringatan, reorder |
| `nav-inv-reports` | navigate | Laporan Inventori | `/inventory/reports` | reports, laporan inventori |
| `nav-inv-opening` | navigate | Saldo Awal Stok | `/inventory/opening-stock` | opening stock, saldo awal |
| `nav-inv-settings` | navigate | Pengaturan Inventori | `/inventory/settings` | inventory settings |

**Actions (7 dialogs)**

| ID | Type | Label | Route | Signal | Dialog Component | Keywords |
|----|------|-------|-------|--------|------------------|----------|
| `act-create-product` | open-page-form | Buat Produk Baru | `/inventory/products/new` | — | (page form) | create product, tambah produk, buat material, add product |
| `act-import-products` | open-dialog | Import Produk | `/inventory/products` | `?action=import` | `ImportProductsDialog` | import, excel, csv, upload produk |
| `act-batch-price` | open-dialog | Update Harga Massal | `/inventory/products` | `?action=batch-price` | `BatchPriceDialog` | batch price, harga massal, update harga |
| `act-create-warehouse` | open-dialog | Tambah Gudang | `/inventory/warehouses` | `?new=true` | `WarehouseFormDialog` | create warehouse, tambah gudang, add warehouse |
| `act-create-transfer` | open-dialog | Transfer Stok Baru | `/inventory/transfers` | `?new=true` | `CreateTransferDialog` | create transfer, pindah stok |
| `act-manual-movement` | open-dialog | Buat Pergerakan Manual | `/inventory/movements` | `?action=manual` | `ManualMovementDialog` | manual movement, adjustment, koreksi stok |
| `act-receive-fabric` | open-dialog | Terima Roll Kain | `/inventory/fabric-rolls` | `?new=true` | `FabricRollReceiveDialog` | receive fabric, terima kain, roll baru |

### 2.3 Penjualan & CRM

**Navigation (12 pages)**

| ID | Type | Label | Route | Keywords |
|----|------|-------|-------|----------|
| `nav-sales-dashboard` | navigate | Dashboard Penjualan | `/sales` | sales dashboard |
| `nav-sales-customers` | navigate | Kelola Pelanggan | `/sales/customers` | customers, pelanggan, client |
| `nav-sales-orders` | navigate | Pesanan Penjualan | `/sales/orders` | sales orders, pesanan, SO |
| `nav-sales-quotations` | navigate | Penawaran | `/sales/quotations` | quotations, penawaran, quote |
| `nav-sales-leads` | navigate | Lead & Pipeline | `/sales/leads` | leads, pipeline, prospek, CRM |
| `nav-sales-sales` | navigate | Penjualan | `/sales/sales` | sales analytics, penjualan |
| `nav-sales-pricelists` | navigate | Daftar Harga | `/sales/pricelists` | pricelists, daftar harga, price |
| `nav-sales-discounts` | navigate | Skema Diskon | `/sales/discounts` | discounts, diskon, promo |
| `nav-sales-salespersons` | navigate | Salesperson & Komisi | `/sales/salespersons` | salesperson, komisi, commission |

**Actions (7 dialogs/forms)**

| ID | Type | Label | Route | Signal | Dialog Component | Keywords |
|----|------|-------|-------|--------|------------------|----------|
| `act-create-customer` | open-page-form | Tambah Pelanggan Baru | `/sales/customers/new` | — | (page form) | create customer, tambah pelanggan, add client |
| `act-create-quotation` | open-page-form | Buat Penawaran Baru | `/sales/quotations/new` | — | (page form) | create quotation, buat penawaran, new quote |
| `act-create-sales-order` | open-page-form | Buat Pesanan Penjualan | `/sales/orders/new` | — | (page form) | create sales order, buat SO, pesanan baru |
| `act-create-lead` | open-page-form | Buat Lead Baru | `/sales/leads/new` | — | (page form) | create lead, tambah prospek, new lead |
| `act-create-pricelist` | open-page-form | Buat Daftar Harga | `/sales/pricelists/new` | — | (page form) | create pricelist, daftar harga baru |
| `act-create-discount` | open-dialog | Buat Skema Diskon | `/sales/discounts` | `?new=true` | `DiscountFormDialog` | create discount, buat diskon, tambah promo |
| `act-create-salesperson` | open-dialog | Tambah Salesperson | `/sales/salespersons` | `?new=true` | (inline dialog) | create salesperson, tambah sales, add commission |

### 2.4 Pengadaan

**Navigation (5 pages)**

| ID | Type | Label | Route | Keywords |
|----|------|-------|-------|----------|
| `nav-proc-dashboard` | navigate | Dashboard Pengadaan | `/procurement` | procurement dashboard, pengadaan |
| `nav-proc-vendors` | navigate | Pemasok (Vendor) | `/procurement/vendors` | vendors, pemasok, supplier |
| `nav-proc-orders` | navigate | Pesanan Pembelian | `/procurement/orders` | purchase orders, PO, pesanan pembelian |
| `nav-proc-requests` | navigate | Permintaan Pembelian | `/procurement/requests` | purchase requests, PR, permintaan |
| `nav-proc-receiving` | navigate | Surat Jalan Masuk | `/procurement/receiving` | receiving, GRN, surat jalan, penerimaan |

**Actions (6 dialogs/forms)**

| ID | Type | Label | Route | Signal | Dialog Component | Keywords |
|----|------|-------|-------|--------|------------------|----------|
| `act-create-vendor` | open-dialog | Buat Vendor Baru | `/procurement/vendors` | `?new=true` | `NewVendorDialog` | create vendor, tambah vendor, buat pemasok, add supplier |
| `act-create-po` | open-dialog | Buat Purchase Order | `/procurement/orders` | `?new=true` | `NewPurchaseOrderDialog` | create PO, buat PO, purchase order baru |
| `act-create-pr` | open-page-form | Buat Permintaan Pembelian | `/procurement/requests/new` | — | `CreateRequestForm` (page) | create PR, buat permintaan, purchase request |
| `act-create-pr-dialog` | open-dialog | Buat PR Cepat | `/procurement/requests` | `?new=true` | `NewPRDialog` | quick PR, PR cepat |
| `act-direct-purchase` | open-dialog | Pembelian Langsung | `/procurement` | `?action=direct` | `DirectPurchaseDialog` | direct purchase, beli langsung |
| `act-create-grn` | open-dialog | Terima Barang (GRN) | `/procurement/receiving` | `?new=true` | `CreateGRNDialog` | receive goods, terima barang, GRN, surat jalan |

### 2.5 Keuangan

**Navigation (17 pages)**

| ID | Type | Label | Route | Keywords |
|----|------|-------|-------|----------|
| `nav-fin-invoices` | navigate | Invoicing | `/finance/invoices` | invoices, faktur, tagihan |
| `nav-fin-receivables` | navigate | Piutang Usaha (AR) | `/finance/receivables` | AR, piutang, receivables |
| `nav-fin-payables` | navigate | Hutang Usaha (AP) | `/finance/payables` | AP, hutang, payables |
| `nav-fin-credit-notes` | navigate | Nota Kredit/Debit | `/finance/credit-notes` | credit note, nota kredit, debit note |
| `nav-fin-petty-cash` | navigate | Peti Kas | `/finance/petty-cash` | petty cash, kas kecil |
| `nav-fin-journal` | navigate | Jurnal Umum | `/finance/journal` | journal, jurnal, GL |
| `nav-fin-transactions` | navigate | Transaksi Akun | `/finance/transactions` | transactions, transaksi, ledger |
| `nav-fin-reconciliation` | navigate | Rekonsiliasi Bank | `/finance/reconciliation` | bank reconciliation, rekonsiliasi |
| `nav-fin-coa` | navigate | Chart of Accounts | `/finance/chart-accounts` | COA, chart of accounts, akun |
| `nav-fin-reports` | navigate | Laporan Keuangan | `/finance/reports` | financial reports, laporan keuangan, neraca, laba rugi |
| `nav-fin-planning` | navigate | Perencanaan Arus Kas | `/finance/planning` | cash flow, arus kas, planning |
| `nav-fin-opening` | navigate | Saldo Awal | `/finance/opening-balances` | opening balance, saldo awal |
| `nav-fin-currencies` | navigate | Kurs Mata Uang | `/finance/currencies` | currency, kurs, exchange rate |
| `nav-fin-fiscal` | navigate | Periode Fiskal | `/finance/fiscal-periods` | fiscal period, periode fiskal, tahun buku |
| `nav-fin-assets` | navigate | Aset Tetap | `/finance/fixed-assets` | fixed assets, aset tetap |
| `nav-fin-depreciation` | navigate | Penyusutan | `/finance/fixed-assets/depreciation` | depreciation, penyusutan |
| `nav-fin-expenses` | navigate | Beban & Pengeluaran | `/finance/expenses` | expenses, beban, pengeluaran |
| `nav-fin-vendor-pay` | navigate | Pembayaran Vendor | `/finance/vendor-payments` | vendor payments, pembayaran vendor |

**Actions (10 dialogs/forms)**

| ID | Type | Label | Route | Signal | Dialog Component | Keywords |
|----|------|-------|-------|--------|------------------|----------|
| `act-create-invoice` | open-dialog | Buat Invoice Baru | `/finance/invoices` | `?new=true` | `CreateInvoiceDialog` | create invoice, buat faktur, buat tagihan |
| `act-create-journal` | open-page-form | Buat Jurnal Baru | `/finance/journal/new` | — | (page form) | create journal, buat jurnal, journal entry |
| `act-create-journal-dialog` | open-dialog | Buat Jurnal Cepat | `/finance/journal` | `?new=true` | `CreateJournalDialog` | quick journal, jurnal cepat |
| `act-create-dcnote` | open-dialog | Buat Nota Kredit/Debit | `/finance/credit-notes` | `?new=true` | `CreateDCNoteDialog` | credit note, nota kredit, debit note, retur |
| `act-vendor-payment` | open-dialog | Pembayaran Multi-Tagihan | `/finance/vendor-payments` | `?new=true` | `VendorMultiPaymentDialog` | vendor payment, bayar vendor, multi bill |
| `act-create-asset` | open-dialog | Daftarkan Aset Tetap | `/finance/fixed-assets` | `?new=true` | `CreateAssetDialog` | create asset, daftarkan aset, fixed asset |
| `act-create-cashflow` | open-dialog | Tambah Item Arus Kas | `/finance/planning/aktual` | `?new=true` | `CreateCashflowItemDialog` | cash flow item, arus kas, forecast |
| `act-create-scenario` | open-dialog | Buat Skenario Arus Kas | `/finance/planning/simulasi` | `?new=true` | `CashflowScenarioDialog` | scenario, skenario, simulasi |
| `act-closing-journal` | open-dialog | Jurnal Penutup | `/finance/journal` | `?action=closing` | `ClosingJournalDialog` | closing journal, jurnal penutup, tutup buku |
| `act-efaktur-export` | open-dialog | Export e-Faktur | `/finance/invoices` | `?action=efaktur` | `EFakturExportDialog` | efaktur, export, pajak, tax |

### 2.6 Manufaktur

**Navigation (15 pages)**

| ID | Type | Label | Route | Keywords |
|----|------|-------|-------|----------|
| `nav-mfg-dashboard` | navigate | Dashboard Manufaktur | `/manufacturing` | manufacturing dashboard, produksi |
| `nav-mfg-bom` | navigate | Bill of Materials | `/manufacturing/bom` | BOM, bill of materials, resep |
| `nav-mfg-demand` | navigate | Kebutuhan Material | `/manufacturing/material-demand` | material demand, kebutuhan, MRP |
| `nav-mfg-planning` | navigate | Perencanaan (MPS) | `/manufacturing/planning` | MPS, planning, perencanaan |
| `nav-mfg-work-centers` | navigate | Work Center | `/manufacturing/work-centers` | work center, stasiun kerja |
| `nav-mfg-groups` | navigate | Grup Mesin | `/manufacturing/groups` | machine group, grup mesin |
| `nav-mfg-processes` | navigate | Proses | `/manufacturing/processes` | processes, proses produksi |
| `nav-mfg-routing` | navigate | Routing | `/manufacturing/routing` | routing, alur produksi |
| `nav-mfg-work-orders` | navigate | Perintah Kerja (SPK) | `/manufacturing/work-orders` | work orders, SPK, MO, perintah kerja |
| `nav-mfg-schedule` | navigate | Jadwal Produksi | `/manufacturing/schedule` | schedule, jadwal produksi |
| `nav-mfg-quality` | navigate | Kontrol Kualitas (QC) | `/manufacturing/quality` | quality, QC, inspeksi, kualitas |
| `nav-cost-sheets` | navigate | Daftar Cost Sheet | `/costing/sheets` | cost sheet, biaya produksi |
| `nav-cut-plans` | navigate | Daftar Cut Plan | `/cutting/plans` | cut plan, potong, cutting |
| `nav-sub-orders` | navigate | Order Subkontrak | `/subcontract/orders` | subcontract, subkon, CMT |
| `nav-sub-registry` | navigate | Registri Mitra CMT | `/subcontract/registry` | subcontractor, mitra CMT, registry |

**Actions (9 dialogs)**

| ID | Type | Label | Route | Signal | Dialog Component | Keywords |
|----|------|-------|-------|--------|------------------|----------|
| `act-create-wo` | open-dialog | Buat Work Order (SPK) | `/manufacturing/work-orders` | `?new=true` | `CreateWorkOrderDialog` | create work order, buat SPK, MO baru |
| `act-create-bom` | open-dialog | Buat Bill of Materials | `/manufacturing/bom` | `?new=true` | `CreateBOMDialog` | create BOM, buat BOM, bill of materials |
| `act-create-inspection` | open-dialog | Buat Inspeksi QC | `/manufacturing/quality` | `?new=true` | `CreateInspectionDialog` | create inspection, QC, inspeksi kualitas |
| `act-create-group` | open-dialog | Buat Grup Mesin | `/manufacturing/groups` | `?new=true` | `GroupFormDialog` | create group, buat grup, machine group |
| `act-create-machine` | open-dialog | Tambah Mesin | `/manufacturing/work-centers` | `?new=true` | `MachineFormDialog` | create machine, tambah mesin, add machine |
| `act-create-routing` | open-dialog | Buat Routing | `/manufacturing/routing` | `?new=true` | `RoutingFormDialog` | create routing, buat routing, alur produksi |
| `act-create-subcontractor` | open-dialog | Tambah Mitra CMT | `/subcontract/registry` | `?new=true` | `CreateSubcontractorDialog` | create subcontractor, tambah mitra, CMT |
| `act-schedule-wo` | open-dialog | Jadwalkan Work Order | `/manufacturing/schedule` | `?action=schedule` | `ScheduleWorkOrderDialog` | schedule, jadwalkan, assign |
| `act-detect-shortage` | trigger-fn | Deteksi Kekurangan Material | `/manufacturing/work-orders` | `?action=shortage` | `ShortageDialog` | shortage, kekurangan, stock out |

### 2.7 SDM (HCM)

**Navigation (5 pages)**

| ID | Type | Label | Route | Keywords |
|----|------|-------|-------|----------|
| `nav-hcm-employees` | navigate | Data Karyawan | `/hcm/employee-master` | employees, karyawan, staff, pegawai |
| `nav-hcm-payroll` | navigate | Penggajian | `/hcm/payroll` | payroll, gaji, salary |
| `nav-hcm-attendance` | navigate | Absensi | `/hcm/attendance` | attendance, absensi, hadir |
| `nav-hcm-shifts` | navigate | Jadwal Shift | `/hcm/shifts` | shifts, jadwal shift, schedule |
| `nav-hcm-onboarding` | navigate | Onboarding | `/hcm/onboarding` | onboarding, orientasi, karyawan baru |

**Actions (2)**

| ID | Type | Label | Route | Signal | Dialog Component | Keywords |
|----|------|-------|-------|--------|------------------|----------|
| `act-create-onboarding` | open-dialog | Buat Template Onboarding | `/hcm/onboarding` | `?new=true` | `CreateTemplateDialog` (inline) | create onboarding, template, orientasi |
| `act-create-disbursement` | trigger-fn | Buat Batch Disbursement | `/hcm/payroll` | `?action=disburse` | (inline handler) | disbursement, gaji, payroll batch |

### 2.8 Dokumen & Sistem

**Navigation (3 pages)**

| ID | Type | Label | Route | Keywords |
|----|------|-------|-------|----------|
| `nav-doc-master` | navigate | Data Master | `/documents/master` | master data, dokumen master |
| `nav-doc-reports` | navigate | Laporan Sistem | `/documents/reports` | system reports, laporan sistem |
| `nav-doc-docs` | navigate | Dokumentasi | `/documents/docs` | documentation, dokumentasi |

**Actions: None** (read-only reporting module)

### 2.9 Pengaturan

**Navigation (5 pages)**

| ID | Type | Label | Route | Keywords |
|----|------|-------|-------|----------|
| `nav-set-system` | navigate | Pengaturan Sistem | `/settings` | settings, pengaturan |
| `nav-set-users` | navigate | Manajemen Pengguna | `/settings/users` | users, pengguna, akun |
| `nav-set-perms` | navigate | Matriks Izin | `/settings/permissions` | permissions, izin, role |
| `nav-set-numbering` | navigate | Penomoran Dokumen | `/settings/numbering` | numbering, penomoran, auto number |
| `nav-help` | navigate | Bantuan & Dukungan | `/help` | help, bantuan, support |

### 2.10 Totals

| Category | Count |
|----------|-------|
| Navigation actions | **79** |
| Dialog actions (`open-dialog`) | **33** |
| Page form actions (`open-page-form`) | **8** |
| Function triggers (`trigger-fn`) | **2** |
| **Total registry entries** | **122** |

---

## 3. Search Algorithm

### 3.1 Architecture: Hybrid cmdk + Custom Scoring

We keep `cmdk`'s built-in filtering for its fast substring matching, but layer a **custom scoring function** on top via cmdk's `filter` prop.

```typescript
// Passed to <Command filter={customFilter}>
function customFilter(value: string, search: string, keywords?: string[]): number {
  // value = action.label + " " + action.keywords.join(" ")
  // search = user's input
  // Returns 0-1 score. 0 = hidden, 1 = best match.

  const normalizedSearch = normalize(search)  // lowercase, strip diacritics
  const normalizedValue = normalize(value)
  const tokens = normalizedSearch.split(/\s+/)

  let score = 0

  // 1. Exact phrase match (highest weight)
  if (normalizedValue.includes(normalizedSearch)) {
    score = 1.0
  }
  // 2. All tokens match (AND logic)
  else if (tokens.every(t => normalizedValue.includes(t))) {
    score = 0.8
  }
  // 3. Starts-with on any token
  else if (tokens.some(t => normalizedValue.split(/\s+/).some(w => w.startsWith(t)))) {
    score = 0.6
  }
  // 4. Fuzzy match (Levenshtein distance <= 2 on any token)
  else if (tokens.some(t => fuzzyMatch(t, normalizedValue))) {
    score = 0.4
  }
  // 5. No match
  else {
    score = 0
  }

  // Boost: actions > navigate (users want to DO things)
  if (score > 0 && isActionType(value)) {
    score = Math.min(1.0, score + 0.05)
  }

  // Boost: recently used (frequency from localStorage)
  const usageBoost = getUsageBoost(value) // 0.0 - 0.1 based on frequency
  score = Math.min(1.0, score + usageBoost)

  return score
}
```

### 3.2 Fuzzy Matching Strategy

For typo tolerance ("crete vendro" -> "Buat Vendor"), we use a lightweight approach:

```typescript
function fuzzyMatch(searchToken: string, corpus: string): boolean {
  // For short tokens (<=3 chars), require exact substring
  if (searchToken.length <= 3) return corpus.includes(searchToken)

  // For longer tokens, allow Levenshtein distance of 1-2
  const words = corpus.split(/\s+/)
  const maxDist = searchToken.length <= 5 ? 1 : 2

  return words.some(word => levenshtein(searchToken, word) <= maxDist)
}
```

**Why not a heavier fuzzy library?** cmdk already handles basic fuzzy. We only need the Levenshtein fallback for typos that cmdk misses. Keeping it lightweight avoids blocking the main thread on every keystroke.

### 3.3 Bilingual Search

Every action has Indonesian AND English keywords. Example:

```typescript
{
  id: "act-create-vendor",
  label: "Buat Vendor Baru",
  keywords: [
    // Indonesian
    "buat vendor", "tambah vendor", "buat pemasok", "tambah pemasok",
    "vendor baru", "pemasok baru",
    // English
    "create vendor", "add vendor", "new vendor", "add supplier",
    "create supplier", "new supplier",
  ]
}
```

The `value` prop passed to cmdk concatenates: `label + " " + keywords.join(" ")`. This means typing either "pemasok" or "supplier" will find the same action.

### 3.4 Scoring Priority (descending)

| Priority | Match Type | Score | Example |
|----------|-----------|-------|---------|
| 1 | Exact phrase | 1.0 | "buat vendor" matches "Buat Vendor Baru" |
| 2 | All tokens present | 0.8 | "vendor baru" matches label |
| 3 | Starts-with on token | 0.6 | "ven" matches "vendor" |
| 4 | Fuzzy (Levenshtein) | 0.4 | "vendro" matches "vendor" (dist=1) |
| 5 | No match | 0.0 | Hidden from results |

Modifiers applied after base score:
- **Action type boost**: +0.05 (actions rank above navigation for same search)
- **Usage frequency boost**: +0.0 to +0.1 (from `use-page-history` data)
- **Pinned items**: Always shown in "Aksi Cepat" group regardless of score

### 3.5 Performance Constraints

- **Debounce**: None needed — cmdk filters synchronously on each keystroke
- **Max results**: 50 visible items across all groups (more than enough for 122 total)
- **Levenshtein cutoff**: Only computed if base score is 0 (last resort)
- **Registry is static**: Imported as a const array, no runtime fetching

---

## 4. Navigation + Action Execution Flow

### 4.1 The Signal Mechanism: URL Query Params

**Chosen approach**: URL query parameters (`?new=true`, `?action=import`).

**Why URL params over alternatives:**

| Approach | Pros | Cons | Verdict |
|----------|------|------|---------|
| URL query param | Survives full-page reload; no global state; SSR-compatible; inspectable in devtools | Visible in URL bar; must be cleaned up | **Chosen** |
| Global zustand store | Fast; no URL noise | Lost on refresh; requires store setup; another dependency | Rejected |
| Event bus / CustomEvent | Decoupled; no URL noise | Lost on refresh; timing issues with navigation; no SSR | Rejected |
| Next.js router state | Clean API | Not accessible in server components; lost on refresh | Rejected |
| sessionStorage flag | Persists across navigation | Manual cleanup; race conditions; not inspectable | Rejected |

### 4.2 Execution Flow

```
User opens Cmd+K
       │
       ▼
Types "buat vendor" ──→ Registry filters to matching actions
       │
       ▼
Selects "Buat Vendor Baru" (id: act-create-vendor)
       │
       ▼
CommandPalette.navigate() runs:
       │
       ├─ Reads action.route = "/procurement/vendors"
       ├─ Reads action.signal = { param: "new", value: "true" }
       ├─ Constructs URL: "/procurement/vendors?new=true"
       │
       ├─ Is pathname === "/procurement/vendors"?
       │     ├─ YES: router.push with just the query (same page, no navigation)
       │     └─ NO:  router.push full URL (navigates to page)
       │
       ▼
Target page loads (or is already loaded)
       │
       ▼
useActionSignal("new") hook fires:
       │
       ├─ Reads searchParams.get("new") === "true"
       ├─ Sets triggered = true
       ├─ Calls router.replace(pathname) to clean URL
       │
       ▼
Parent component passes triggered → Dialog's autoOpen prop
       │
       ▼
Dialog opens via useEffect([autoOpen])
       │
       ├─ Calls onAutoOpenConsumed() → resets triggered to false
       │
       ▼
User interacts with dialog normally
       │
       ▼
Dialog closes → clean state, no re-trigger on refresh ✓
```

### 4.3 Edge Cases

#### Case A: User is already on the target page

```typescript
// In CommandPalette's navigate():
const [targetPath] = url.split("?")
if (targetPath === pathname) {
  // Same page — just update the query to trigger the signal
  router.push(url)
} else {
  router.push(url)
}
```

The `useActionSignal` hook watches `searchParams` reactively. When the query changes on the same page, the effect fires and opens the dialog.

#### Case B: Dialog requires preloaded data

Some dialogs (e.g., `CreateInvoiceDialog`) need customer lists, product lists, etc. These are fetched inside the dialog component via `useQuery`. Solution:

```tsx
// Inside the dialog component:
export function CreateInvoiceDialog({ autoOpen, onAutoOpenConsumed }) {
  const [open, setOpen] = useState(false)
  const { data: customers, isLoading } = useQuery(...)

  useEffect(() => {
    if (autoOpen) {
      // Open immediately — the dialog shows a loading state internally
      setOpen(true)
      onAutoOpenConsumed?.()
    }
  }, [autoOpen])

  // Dialog content shows spinner while data loads
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        {isLoading ? <Skeleton /> : <Form data={customers} />}
      </DialogContent>
    </Dialog>
  )
}
```

**Decision**: Open the dialog immediately and show loading state inside it. Do NOT wait for data before opening — this feels faster and gives the user visual confirmation their action was received.

#### Case C: `?new=true` signal in URL on initial page load (direct link / bookmark)

The `useActionSignal` hook fires on mount. If someone bookmarks `/procurement/vendors?new=true`, the dialog will auto-open once. The hook immediately cleans the URL via `router.replace`. This is acceptable behavior — the URL acts as a deep link to the create action.

#### Case D: Multiple signals on the same page

Some pages may have multiple action types (e.g., `/finance/invoices` has "create invoice" and "export e-faktur"). Use distinct param keys:

```typescript
// Registry:
{ signal: { param: "new", value: "true" } }       // → ?new=true
{ signal: { param: "action", value: "efaktur" } }  // → ?action=efaktur

// Page reads both:
const { triggered: autoCreate } = useActionSignal("new")
const { triggered: autoExport } = useActionSignal("action") // value check in page
```

For pages with multiple actions keyed to `?action=X`, the hook returns the param value:

```typescript
// Enhanced hook variant for multi-action pages:
export function useActionSignalValue(key = "action") {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState<string | null>(null)

  useEffect(() => {
    const v = searchParams.get(key)
    if (v) {
      setValue(v)
      const next = new URLSearchParams(searchParams.toString())
      next.delete(key)
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, { scroll: false })
    }
  }, [searchParams, key, router, pathname])

  const clear = useCallback(() => setValue(null), [])
  return { value, clear }
}
```

### 4.4 The `useActionSignal` Hook API

```typescript
// Simple boolean signal (most dialogs):
const { triggered, clear } = useActionSignal("new")
// triggered: boolean — true once when ?new=true is in URL
// clear: () => void — call after dialog opens

// Multi-action signal (pages with multiple dialog types):
const { value, clear } = useActionSignalValue("action")
// value: string | null — "efaktur", "import", "closing", etc.
// clear: () => void — call after consuming
```

---

## 5. UI/UX Enhancements

### 5.1 Result Grouping

Results are displayed in this order:

```
┌────────────────────────────────────────────────┐
│  🔍 Cari halaman, aksi, menu...        ⌘K     │
├────────────────────────────────────────────────┤
│  TERAKHIR DIKUNJUNGI              (if search   │
│  ◷ Pemasok (Vendor)               is empty)    │
│  ◷ Invoicing                                   │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  SERING DIGUNAKAN                 (if search   │
│  ★ Kelola Produk              12x  is empty)   │
│  ★ Pesanan Pembelian           8x              │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  AKSI CEPAT                       (always,     │
│  ⚡ Buat Produk Baru     [Inventori]  pinned)  │
│  ⚡ Buat Invoice Baru    [Keuangan]            │
│  ⚡ Buat Vendor Baru     [Pengadaan]           │
│  ⚡ Buat SO Baru         [Penjualan]           │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  INVENTORI                        (when search │
│  🔗 Kelola Produk                  matches)    │
│  ⚡ Tambah Gudang         [+]                  │
│  🔗 Level Stok                                 │
├╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌┤
│  PENGADAAN                                     │
│  ⚡ Buat Vendor Baru      [+]                  │
│  🔗 Pemasok (Vendor)                           │
├────────────────────────────────────────────────┤
│  ↑↓ navigasi    ↵ buka    esc tutup           │
└────────────────────────────────────────────────┘
```

**Grouping rules:**
1. **Empty search**: Show Recent → Frequent → Pinned Actions → All modules
2. **With search**: Show matching Pinned Actions first → then results grouped by module
3. Within each module group, **actions sort before navigations** (the user is more likely searching for an action than a page)

### 5.2 Visual Distinction

Each result row shows:

```
┌──────────────────────────────────────────────────┐
│  [icon]  Label Text          [module badge]  →   │
│   8x8    14px semibold       10px tag             │
│  tinted  flex-1 truncate     rounded pill         │
└──────────────────────────────────────────────────┘
```

| Element | Navigate | Action |
|---------|----------|--------|
| Icon background | Module color (muted) | Module color (muted) |
| Suffix icon | `→` arrow (subtle) | `+` plus (subtle) |
| Text style | Normal weight | **Bold** weight |
| Module badge | Shown | Shown |

**Module badge**: A small pill `<span>` with `MODULE_META[module].color` background and `MODULE_META[module].label` text. Example: `<span class="bg-orange-100 text-orange-600 text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Pengadaan</span>`

### 5.3 Keyboard Navigation

Already handled by cmdk's `loop` prop:

| Key | Action |
|-----|--------|
| `↑` / `↓` | Move selection through results |
| `Enter` | Execute selected action |
| `Escape` | Close palette |
| `⌘K` / `Ctrl+K` | Toggle open/close |
| Type anything | Filter results instantly |

**Enhancement**: If an action has a `shortcut` field, show it as a right-aligned hint:

```
⚡ Buat Vendor Baru     [Pengadaan]   Ctrl+Shift+V  →
```

Shortcut hints are display-only in the palette. The actual global shortcut listener is registered separately (future work, not in scope for this design).

### 5.4 Empty State

When no results match:

```
┌────────────────────────────────────────┐
│         🔍                             │
│   Tidak ada hasil untuk "xyz"          │
│                                        │
│   Coba kata kunci lain atau           │
│   tekan Esc untuk menutup             │
└────────────────────────────────────────┘
```

### 5.5 Loading / Transition State

When the user selects an action that triggers navigation, the palette closes immediately (no loading state). The target page's own loading skeleton handles the transition. This is intentional — the palette is a launcher, not a progress tracker.

---

## 6. Implementation Roadmap

### Phase 1: Registry + Refactor (foundation)

1. Create `lib/cmdk-registry.ts` with the full action catalog (122 entries)
2. Refactor `components/command-palette.tsx` to consume the registry instead of hardcoded arrays
3. Add `value` prop to each item using `label + keywords.join(" ")`
4. Add custom `filter` function with weighted scoring

### Phase 2: Signal System (action execution)

5. Create `useActionSignalValue` hook (extends existing `useActionSignal`)
6. Wire `autoOpen` / `onAutoOpenConsumed` into each dialog that needs it (33 dialogs)
7. Prioritize high-traffic dialogs first:
   - `NewVendorDialog` (already done)
   - `CreateInvoiceDialog`
   - `NewPurchaseOrderDialog`
   - `CreateJournalDialog`
   - `ProductCreateDialog`
   - `CreateWorkOrderDialog`

### Phase 3: UI Polish

8. Add module badge pills to each result row
9. Add bold styling for action items vs normal for navigation
10. Add shortcut hint display (right-aligned, muted)
11. Improve empty state message

### Phase 4: Analytics + Personalization

12. Track action usage in `use-page-history` (extend to cover action IDs, not just pages)
13. Apply usage frequency boost in search scoring
14. Consider: "Suggested for you" group based on role + recent module usage

---

## Appendix A: Pages Needing `?new=true` Handler (by priority)

Dialogs that currently manage their own `open` state and need the `autoOpen` / `onAutoOpenConsumed` pattern wired in:

| Priority | Page | Dialog Component | File |
|----------|------|------------------|------|
| **P0** (done) | `/procurement/vendors` | `NewVendorDialog` | `components/procurement/new-vendor-dialog.tsx` |
| **P1** | `/finance/invoices` | `CreateInvoiceDialog` | `components/finance/create-invoice-dialog.tsx` |
| **P1** | `/procurement/orders` | `NewPurchaseOrderDialog` | `components/procurement/new-po-dialog.tsx` |
| **P1** | `/finance/journal` | `CreateJournalDialog` | `components/finance/journal/create-journal-dialog.tsx` |
| **P1** | `/inventory/products` | `ProductCreateDialog` | `components/inventory/product-create-dialog.tsx` |
| **P2** | `/manufacturing/work-orders` | `CreateWorkOrderDialog` | `components/manufacturing/create-work-order-dialog.tsx` |
| **P2** | `/manufacturing/bom` | `CreateBOMDialog` | `components/manufacturing/create-bom-dialog.tsx` |
| **P2** | `/manufacturing/routing` | `RoutingFormDialog` | `components/manufacturing/routing-form-dialog.tsx` |
| **P2** | `/manufacturing/groups` | `GroupFormDialog` | `components/manufacturing/group-form-dialog.tsx` |
| **P2** | `/manufacturing/work-centers` | `MachineFormDialog` | `components/manufacturing/machine-form-dialog.tsx` |
| **P2** | `/manufacturing/quality` | `CreateInspectionDialog` | `components/manufacturing/create-inspection-dialog.tsx` |
| **P3** | `/finance/credit-notes` | `CreateDCNoteDialog` | `components/finance/create-dcnote-dialog.tsx` |
| **P3** | `/finance/vendor-payments` | `VendorMultiPaymentDialog` | `components/finance/vendor-multi-payment-dialog.tsx` |
| **P3** | `/finance/fixed-assets` | `CreateAssetDialog` | `components/finance/fixed-assets/create-asset-dialog.tsx` |
| **P3** | `/finance/planning/aktual` | `CreateCashflowItemDialog` | `components/finance/create-cashflow-item-dialog.tsx` |
| **P3** | `/finance/planning/simulasi` | `CashflowScenarioDialog` | `components/finance/cashflow-scenario-dialog.tsx` |
| **P3** | `/inventory/warehouses` | `WarehouseFormDialog` | `components/inventory/warehouse-form-dialog.tsx` |
| **P3** | `/inventory/transfers` | `CreateTransferDialog` | `components/inventory/create-transfer-dialog.tsx` |
| **P3** | `/inventory/fabric-rolls` | `FabricRollReceiveDialog` | `components/inventory/fabric-roll-receive-dialog.tsx` |
| **P3** | `/inventory/movements` | `ManualMovementDialog` | `components/inventory/manual-movement-dialog.tsx` |
| **P3** | `/procurement/requests` | `NewPRDialog` | `components/procurement/new-pr-dialog.tsx` |
| **P3** | `/procurement/receiving` | `CreateGRNDialog` | `components/procurement/create-grn-dialog.tsx` |
| **P3** | `/sales/discounts` | `DiscountFormDialog` | `app/sales/discounts/discount-form-dialog.tsx` |
| **P3** | `/sales/salespersons` | (inline dialog) | `app/sales/salespersons/page.tsx` |
| **P3** | `/subcontract/registry` | `CreateSubcontractorDialog` | `components/subcontract/create-subcontractor-dialog.tsx` |
| **P3** | `/hcm/onboarding` | `CreateTemplateDialog` | `app/hcm/onboarding/page.tsx` (inline) |

**Total dialogs to wire**: 26 remaining (1 done).

## Appendix B: Actions That Use Page Forms (no signal needed)

These actions navigate to a dedicated `/new` page — no dialog signal required:

| Action | Route |
|--------|-------|
| Buat Produk Baru | `/inventory/products/new` |
| Tambah Pelanggan Baru | `/sales/customers/new` |
| Buat Penawaran Baru | `/sales/quotations/new` |
| Buat Pesanan Penjualan | `/sales/orders/new` |
| Buat Lead Baru | `/sales/leads/new` |
| Buat Daftar Harga | `/sales/pricelists/new` |
| Buat Permintaan Pembelian | `/procurement/requests/new` |
| Buat Jurnal Baru | `/finance/journal/new` |
