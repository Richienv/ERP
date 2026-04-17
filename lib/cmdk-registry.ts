// lib/cmdk-registry.ts
// Single source-of-truth for all Cmd+K Command Palette actions.
// See docs/features/cmdk-design.md for the full design specification.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ActionType = "navigate" | "open-dialog" | "open-page-form" | "trigger-fn"

export type Module =
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

export interface CmdKAction {
  /** Unique key, e.g. "create-vendor" */
  id: string
  /** What happens on select */
  type: ActionType
  /** Display text in Bahasa */
  label: string
  /** Bilingual search terms — Indonesian AND English */
  keywords: string[]
  /** Tabler icon component name (resolved at render time) */
  icon: string
  /** Parent module slug for grouping & badge display */
  module: Module
  /** Target route */
  route: string
  /**
   * Only for type "open-dialog" / "open-page-form" / "trigger-fn".
   * Tells the target page WHAT to open after navigation completes.
   */
  signal?: { param: string; value: string }
  /** Optional global keyboard shortcut hint, e.g. "Ctrl+Shift+V" */
  shortcut?: string
  /** Minimum role required (omit = all roles). Used for filtering. */
  requiredRole?: string[]
  /** If true, this action appears in the "Aksi Cepat" group at the top */
  pinned?: boolean
}

// ---------------------------------------------------------------------------
// Module metadata — color + label for badges / icon tinting
// ---------------------------------------------------------------------------

export const MODULE_META: Record<Module, { color: string; label: string }> = {
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

// ---------------------------------------------------------------------------
// Helper — keeps action definitions concise
// ---------------------------------------------------------------------------

function nav(
  id: string,
  label: string,
  route: string,
  module: Module,
  icon: string,
  keywords: string[],
  extra?: Partial<CmdKAction>,
): CmdKAction {
  return { id, type: "navigate", label, route, module, icon, keywords, ...extra }
}

function dialog(
  id: string,
  label: string,
  route: string,
  module: Module,
  icon: string,
  keywords: string[],
  signal: { param: string; value: string },
  extra?: Partial<CmdKAction>,
): CmdKAction {
  return { id, type: "open-dialog", label, route, module, icon, keywords, signal, ...extra }
}

function pageForm(
  id: string,
  label: string,
  route: string,
  module: Module,
  icon: string,
  keywords: string[],
  extra?: Partial<CmdKAction>,
): CmdKAction {
  return { id, type: "open-page-form", label, route, module, icon, keywords, ...extra }
}

function triggerFn(
  id: string,
  label: string,
  route: string,
  module: Module,
  icon: string,
  keywords: string[],
  signal: { param: string; value: string },
  extra?: Partial<CmdKAction>,
): CmdKAction {
  return { id, type: "trigger-fn", label, route, module, icon, keywords, signal, ...extra }
}

// ---------------------------------------------------------------------------
// 2.1 — Dasbor (4 actions)
// ---------------------------------------------------------------------------

const DASBOR: CmdKAction[] = [
  nav("nav-dashboard", "Dasbor Utama", "/dashboard", "dasbor", "IconDashboard", [
    "dashboard", "beranda", "home",
  ]),
  nav("nav-approvals", "Antrian Persetujuan", "/dashboard/approvals", "dasbor", "IconCheckbox", [
    "approval", "persetujuan", "pending",
  ]),
  nav("nav-pos", "Point of Sale", "/dashboard/pos", "dasbor", "IconShoppingCart", [
    "pos", "kasir", "cashier",
  ]),
  nav("nav-ecommerce", "E-Commerce Dashboard", "/dashboard/ecommerce", "dasbor", "IconWorld", [
    "ecommerce", "toko online",
  ]),
]

// ---------------------------------------------------------------------------
// 2.2 — Inventori (19 actions: 12 nav + 7 dialog/form)
// ---------------------------------------------------------------------------

const INVENTORI: CmdKAction[] = [
  // Navigation
  nav("nav-inv-dashboard", "Dashboard Inventori", "/inventory", "inventori", "IconPackages", [
    "inventory dashboard", "stok",
  ]),
  nav("nav-inv-products", "Kelola Produk", "/inventory/products", "inventori", "IconBox", [
    "products", "produk", "material", "barang",
  ]),
  nav("nav-inv-stock", "Level Stok", "/inventory/stock", "inventori", "IconChartBar", [
    "stock level", "stok", "persediaan",
  ]),
  nav("nav-inv-movements", "Pergerakan Stok", "/inventory/movements", "inventori", "IconArrowsExchange", [
    "movements", "pergerakan", "mutasi stok",
  ]),
  nav("nav-inv-transfers", "Transfer Stok", "/inventory/transfers", "inventori", "IconTransfer", [
    "transfer", "pindah stok",
  ]),
  nav("nav-inv-warehouses", "Gudang & Lokasi", "/inventory/warehouses", "inventori", "IconBuildingWarehouse", [
    "warehouse", "gudang", "lokasi",
  ]),
  nav("nav-inv-fabric", "Fabric Rolls", "/inventory/fabric-rolls", "inventori", "IconRuler", [
    "fabric", "kain", "roll",
  ]),
  nav("nav-inv-audit", "Stok Opname", "/inventory/audit", "inventori", "IconClipboardCheck", [
    "audit", "opname", "stock count",
  ]),
  nav("nav-inv-cycle", "Opname Batch", "/inventory/cycle-counts", "inventori", "IconRefresh", [
    "cycle count", "opname batch",
  ]),
  nav("nav-inv-alerts", "Peringatan Stok", "/inventory/alerts", "inventori", "IconAlertTriangle", [
    "alerts", "peringatan", "reorder",
  ]),
  nav("nav-inv-reports", "Laporan Inventori", "/inventory/reports", "inventori", "IconFileAnalytics", [
    "reports", "laporan inventori",
  ]),
  nav("nav-inv-opening", "Saldo Awal Stok", "/inventory/opening-stock", "inventori", "IconDatabaseImport", [
    "opening stock", "saldo awal",
  ]),
  nav("nav-inv-settings", "Pengaturan Inventori", "/inventory/settings", "inventori", "IconSettings", [
    "inventory settings",
  ]),

  // Actions
  dialog("act-create-product", "Buat Produk Baru", "/inventory/products", "inventori", "IconPlus", [
    "create product", "tambah produk", "buat material", "add product", "tambah material",
  ], { param: "new", value: "true" }, { pinned: true }),
  dialog("act-import-products", "Import Produk", "/inventory/products", "inventori", "IconFileImport", [
    "import", "excel", "csv", "upload produk",
  ], { param: "action", value: "import" }),
  dialog("act-batch-price", "Update Harga Massal", "/inventory/products", "inventori", "IconCurrencyDollar", [
    "batch price", "harga massal", "update harga",
  ], { param: "action", value: "batch-price" }),
  dialog("act-create-warehouse", "Tambah Gudang", "/inventory/warehouses", "inventori", "IconBuildingWarehouse", [
    "create warehouse", "tambah gudang", "add warehouse",
  ], { param: "new", value: "true" }),
  dialog("act-create-transfer", "Transfer Stok Baru", "/inventory/transfers", "inventori", "IconTransfer", [
    "create transfer", "pindah stok",
  ], { param: "new", value: "true" }),
  dialog("act-manual-movement", "Buat Pergerakan Manual", "/inventory/movements", "inventori", "IconAdjustments", [
    "manual movement", "adjustment", "koreksi stok",
  ], { param: "action", value: "manual" }),
  dialog("act-receive-fabric", "Terima Roll Kain", "/inventory/fabric-rolls", "inventori", "IconRuler", [
    "receive fabric", "terima kain", "roll baru",
  ], { param: "new", value: "true" }),
]

// ---------------------------------------------------------------------------
// 2.3 — Penjualan & CRM (16 actions: 9 nav + 7 dialog/form)
// ---------------------------------------------------------------------------

const PENJUALAN: CmdKAction[] = [
  // Navigation
  nav("nav-sales-dashboard", "Dashboard Penjualan", "/sales", "penjualan", "IconChartLine", [
    "sales dashboard",
  ]),
  nav("nav-sales-customers", "Kelola Pelanggan", "/sales/customers", "penjualan", "IconUsers", [
    "customers", "pelanggan", "client",
  ]),
  nav("nav-sales-orders", "Pesanan Penjualan", "/sales/orders", "penjualan", "IconShoppingBag", [
    "sales orders", "pesanan", "SO",
  ]),
  nav("nav-sales-quotations", "Penawaran", "/sales/quotations", "penjualan", "IconFileInvoice", [
    "quotations", "penawaran", "quote",
  ]),
  nav("nav-sales-leads", "Lead & Pipeline", "/sales/leads", "penjualan", "IconTargetArrow", [
    "leads", "pipeline", "prospek", "CRM",
  ]),
  nav("nav-sales-sales", "Penjualan", "/sales/sales", "penjualan", "IconCash", [
    "sales analytics", "penjualan",
  ]),
  nav("nav-sales-pricelists", "Daftar Harga", "/sales/pricelists", "penjualan", "IconTag", [
    "pricelists", "daftar harga", "price",
  ]),
  nav("nav-sales-discounts", "Skema Diskon", "/sales/discounts", "penjualan", "IconDiscount", [
    "discounts", "diskon", "promo",
  ]),
  nav("nav-sales-salespersons", "Salesperson & Komisi", "/sales/salespersons", "penjualan", "IconUserStar", [
    "salesperson", "komisi", "commission",
  ]),

  // Actions
  pageForm("act-create-customer", "Tambah Pelanggan Baru", "/sales/customers/new", "penjualan", "IconUserPlus", [
    "create customer", "tambah pelanggan", "add client",
  ], { pinned: true }),
  pageForm("act-create-quotation", "Buat Penawaran Baru", "/sales/quotations/new", "penjualan", "IconFilePlus", [
    "create quotation", "buat penawaran", "new quote",
  ], { pinned: true }),
  pageForm("act-create-sales-order", "Buat Pesanan Penjualan", "/sales/orders/new", "penjualan", "IconShoppingBagPlus", [
    "create sales order", "buat SO", "pesanan baru",
  ], { pinned: true }),
  pageForm("act-create-lead", "Buat Lead Baru", "/sales/leads/new", "penjualan", "IconTargetArrow", [
    "create lead", "tambah prospek", "new lead",
  ]),
  pageForm("act-create-pricelist", "Buat Daftar Harga", "/sales/pricelists/new", "penjualan", "IconTag", [
    "create pricelist", "daftar harga baru",
  ]),
  dialog("act-create-discount", "Buat Skema Diskon", "/sales/discounts", "penjualan", "IconDiscount", [
    "create discount", "buat diskon", "tambah promo",
  ], { param: "new", value: "true" }),
  dialog("act-create-salesperson", "Tambah Salesperson", "/sales/salespersons", "penjualan", "IconUserStar", [
    "create salesperson", "tambah sales", "add commission",
  ], { param: "new", value: "true" }),
]

// ---------------------------------------------------------------------------
// 2.4 — Pengadaan (11 actions: 5 nav + 6 dialog/form)
// ---------------------------------------------------------------------------

const PENGADAAN: CmdKAction[] = [
  // Navigation
  nav("nav-proc-dashboard", "Dashboard Pengadaan", "/procurement", "pengadaan", "IconTruck", [
    "procurement dashboard", "pengadaan",
  ]),
  nav("nav-proc-vendors", "Pemasok (Vendor)", "/procurement/vendors", "pengadaan", "IconBuilding", [
    "vendors", "pemasok", "supplier",
  ]),
  nav("nav-proc-orders", "Pesanan Pembelian", "/procurement/orders", "pengadaan", "IconFileText", [
    "purchase orders", "PO", "pesanan pembelian",
  ]),
  nav("nav-proc-requests", "Permintaan Pembelian", "/procurement/requests", "pengadaan", "IconFileDescription", [
    "purchase requests", "PR", "permintaan",
  ]),
  nav("nav-proc-receiving", "Surat Jalan Masuk", "/procurement/receiving", "pengadaan", "IconPackageImport", [
    "receiving", "GRN", "surat jalan", "penerimaan",
  ]),

  // Actions
  dialog("act-create-vendor", "Buat Vendor Baru", "/procurement/vendors", "pengadaan", "IconBuildingPlus", [
    "create vendor", "tambah vendor", "buat pemasok", "add supplier",
  ], { param: "new", value: "true" }, { pinned: true }),
  dialog("act-create-po", "Buat Purchase Order", "/procurement/orders", "pengadaan", "IconFilePlus", [
    "create PO", "buat PO", "purchase order baru",
  ], { param: "new", value: "true" }, { pinned: true }),
  pageForm("act-create-pr", "Buat Permintaan Pembelian", "/procurement/requests/new", "pengadaan", "IconFileDescription", [
    "create PR", "buat permintaan", "purchase request",
  ]),
  dialog("act-create-pr-dialog", "Buat PR Cepat", "/procurement/requests", "pengadaan", "IconBolt", [
    "quick PR", "PR cepat",
  ], { param: "new", value: "true" }),
  dialog("act-direct-purchase", "Pembelian Langsung", "/procurement", "pengadaan", "IconShoppingCart", [
    "direct purchase", "beli langsung",
  ], { param: "action", value: "direct" }),
  dialog("act-create-grn", "Terima Barang (GRN)", "/procurement/receiving", "pengadaan", "IconPackageImport", [
    "receive goods", "terima barang", "GRN", "surat jalan",
  ], { param: "new", value: "true" }),
]

// ---------------------------------------------------------------------------
// 2.5 — Keuangan (27 actions: 17 nav + 10 dialog/form)
// ---------------------------------------------------------------------------

const KEUANGAN: CmdKAction[] = [
  // Navigation
  nav("nav-fin-invoices", "Invoicing", "/finance/invoices", "keuangan", "IconFileInvoice", [
    "invoices", "faktur", "tagihan",
  ]),
  nav("nav-fin-receivables", "Piutang Usaha (AR)", "/finance/receivables", "keuangan", "IconCashBanknote", [
    "AR", "piutang", "receivables",
  ]),
  nav("nav-fin-payables", "Hutang Usaha (AP)", "/finance/payables", "keuangan", "IconReceipt", [
    "AP", "hutang", "payables",
  ]),
  nav("nav-fin-credit-notes", "Nota Kredit/Debit", "/finance/credit-notes", "keuangan", "IconReceiptRefund", [
    "credit note", "nota kredit", "debit note",
  ]),
  nav("nav-fin-petty-cash", "Peti Kas", "/finance/petty-cash", "keuangan", "IconWallet", [
    "petty cash", "kas kecil",
  ]),
  nav("nav-fin-journal", "Jurnal Umum", "/finance/journal", "keuangan", "IconBook", [
    "journal", "jurnal", "GL",
  ]),
  nav("nav-fin-transactions", "Transaksi Akun", "/finance/transactions", "keuangan", "IconList", [
    "transactions", "transaksi", "ledger",
  ]),
  nav("nav-fin-reconciliation", "Rekonsiliasi Bank", "/finance/reconciliation", "keuangan", "IconScale", [
    "bank reconciliation", "rekonsiliasi",
  ]),
  nav("nav-fin-coa", "Chart of Accounts", "/finance/chart-accounts", "keuangan", "IconSitemap", [
    "COA", "chart of accounts", "akun",
  ]),
  nav("nav-fin-reports", "Laporan Keuangan", "/finance/reports", "keuangan", "IconReportAnalytics", [
    "financial reports", "laporan keuangan", "neraca", "laba rugi",
  ]),
  nav("nav-fin-planning", "Perencanaan Arus Kas", "/finance/planning", "keuangan", "IconTrendingUp", [
    "cash flow", "arus kas", "planning",
  ]),
  nav("nav-fin-opening", "Saldo Awal", "/finance/opening-balances", "keuangan", "IconDatabaseImport", [
    "opening balance", "saldo awal",
  ]),
  nav("nav-fin-currencies", "Kurs Mata Uang", "/finance/currencies", "keuangan", "IconCoin", [
    "currency", "kurs", "exchange rate",
  ]),
  nav("nav-fin-fiscal", "Periode Fiskal", "/finance/fiscal-periods", "keuangan", "IconCalendar", [
    "fiscal period", "periode fiskal", "tahun buku",
  ]),
  nav("nav-fin-assets", "Aset Tetap", "/finance/fixed-assets", "keuangan", "IconBuildingFactory", [
    "fixed assets", "aset tetap",
  ]),
  nav("nav-fin-depreciation", "Penyusutan", "/finance/fixed-assets/depreciation", "keuangan", "IconTrendingDown", [
    "depreciation", "penyusutan",
  ]),
  nav("nav-fin-expenses", "Beban & Pengeluaran", "/finance/expenses", "keuangan", "IconReceiptTax", [
    "expenses", "beban", "pengeluaran",
  ]),
  nav("nav-fin-vendor-pay", "Pembayaran Vendor", "/finance/vendor-payments", "keuangan", "IconCreditCard", [
    "vendor payments", "pembayaran vendor",
  ]),

  // Actions
  dialog("act-create-invoice", "Buat Invoice Baru", "/finance/invoices", "keuangan", "IconFilePlus", [
    "create invoice", "buat faktur", "buat tagihan",
  ], { param: "new", value: "true" }, { pinned: true }),
  pageForm("act-create-journal", "Buat Jurnal Baru", "/finance/journal/new", "keuangan", "IconBookUpload", [
    "create journal", "buat jurnal", "journal entry",
  ]),
  dialog("act-create-journal-dialog", "Buat Jurnal Cepat", "/finance/journal", "keuangan", "IconBolt", [
    "quick journal", "jurnal cepat",
  ], { param: "new", value: "true" }),
  dialog("act-create-dcnote", "Buat Nota Kredit/Debit", "/finance/credit-notes", "keuangan", "IconReceiptRefund", [
    "credit note", "nota kredit", "debit note", "retur",
  ], { param: "new", value: "true" }),
  dialog("act-vendor-payment", "Pembayaran Multi-Tagihan", "/finance/vendor-payments", "keuangan", "IconCreditCard", [
    "vendor payment", "bayar vendor", "multi bill",
  ], { param: "new", value: "true" }),
  dialog("act-create-asset", "Daftarkan Aset Tetap", "/finance/fixed-assets", "keuangan", "IconBuildingFactory", [
    "create asset", "daftarkan aset", "fixed asset",
  ], { param: "new", value: "true" }),
  dialog("act-create-cashflow", "Tambah Item Arus Kas", "/finance/planning/aktual", "keuangan", "IconTrendingUp", [
    "cash flow item", "arus kas", "forecast",
  ], { param: "new", value: "true" }),
  dialog("act-create-scenario", "Buat Skenario Arus Kas", "/finance/planning/simulasi", "keuangan", "IconChartDots", [
    "scenario", "skenario", "simulasi",
  ], { param: "new", value: "true" }),
  dialog("act-closing-journal", "Jurnal Penutup", "/finance/journal", "keuangan", "IconLock", [
    "closing journal", "jurnal penutup", "tutup buku",
  ], { param: "action", value: "closing" }),
  dialog("act-efaktur-export", "Export e-Faktur", "/finance/invoices", "keuangan", "IconFileExport", [
    "efaktur", "export", "pajak", "tax",
  ], { param: "action", value: "efaktur" }),
]

// ---------------------------------------------------------------------------
// 2.6 — Manufaktur + Subkontrak + Costing + Cutting (24 actions: 15 nav + 9 dialog/fn)
// ---------------------------------------------------------------------------

const MANUFAKTUR: CmdKAction[] = [
  // Navigation
  nav("nav-mfg-dashboard", "Dashboard Manufaktur", "/manufacturing", "manufaktur", "IconBuildingFactory2", [
    "manufacturing dashboard", "produksi",
  ]),
  nav("nav-mfg-bom", "Bill of Materials", "/manufacturing/bom", "manufaktur", "IconListTree", [
    "BOM", "bill of materials", "resep",
  ]),
  nav("nav-mfg-demand", "Kebutuhan Material", "/manufacturing/material-demand", "manufaktur", "IconStack2", [
    "material demand", "kebutuhan", "MRP",
  ]),
  nav("nav-mfg-planning", "Perencanaan (MPS)", "/manufacturing/planning", "manufaktur", "IconCalendarStats", [
    "MPS", "planning", "perencanaan",
  ]),
  nav("nav-mfg-work-centers", "Work Center", "/manufacturing/work-centers", "manufaktur", "IconTool", [
    "work center", "stasiun kerja",
  ]),
  nav("nav-mfg-groups", "Grup Mesin", "/manufacturing/groups", "manufaktur", "IconComponents", [
    "machine group", "grup mesin",
  ]),
  nav("nav-mfg-processes", "Proses", "/manufacturing/processes", "manufaktur", "IconArrowIteration", [
    "processes", "proses produksi",
  ]),
  nav("nav-mfg-routing", "Routing", "/manufacturing/routing", "manufaktur", "IconRoute", [
    "routing", "alur produksi",
  ]),
  nav("nav-mfg-work-orders", "Perintah Kerja (SPK)", "/manufacturing/work-orders", "manufaktur", "IconClipboardList", [
    "work orders", "SPK", "MO", "perintah kerja",
  ]),
  nav("nav-mfg-schedule", "Jadwal Produksi", "/manufacturing/schedule", "manufaktur", "IconCalendarEvent", [
    "schedule", "jadwal produksi",
  ]),
  nav("nav-mfg-quality", "Kontrol Kualitas (QC)", "/manufacturing/quality", "manufaktur", "IconShieldCheck", [
    "quality", "QC", "inspeksi", "kualitas",
  ]),
  nav("nav-cost-sheets", "Daftar Cost Sheet", "/costing/sheets", "costing", "IconCalculator", [
    "cost sheet", "biaya produksi",
  ]),
  nav("nav-cut-plans", "Daftar Cut Plan", "/cutting/plans", "cutting", "IconCut", [
    "cut plan", "potong", "cutting",
  ]),
  nav("nav-sub-orders", "Order Subkontrak", "/subcontract/orders", "subkontrak", "IconTruckDelivery", [
    "subcontract", "subkon", "CMT",
  ]),
  nav("nav-sub-registry", "Registri Mitra CMT", "/subcontract/registry", "subkontrak", "IconAddressBook", [
    "subcontractor", "mitra CMT", "registry",
  ]),

  // Actions
  dialog("act-create-wo", "Buat Work Order (SPK)", "/manufacturing/work-orders", "manufaktur", "IconClipboardPlus", [
    "create work order", "buat SPK", "MO baru",
  ], { param: "new", value: "true" }, { pinned: true }),
  dialog("act-create-bom", "Buat Bill of Materials", "/manufacturing/bom", "manufaktur", "IconListTree", [
    "create BOM", "buat BOM", "bill of materials",
  ], { param: "new", value: "true" }),
  dialog("act-create-inspection", "Buat Inspeksi QC", "/manufacturing/quality", "manufaktur", "IconShieldCheck", [
    "create inspection", "QC", "inspeksi kualitas",
  ], { param: "new", value: "true" }),
  dialog("act-create-group", "Buat Grup Mesin", "/manufacturing/groups", "manufaktur", "IconComponents", [
    "create group", "buat grup", "machine group",
  ], { param: "new", value: "true" }),
  dialog("act-create-machine", "Tambah Mesin", "/manufacturing/work-centers", "manufaktur", "IconTool", [
    "create machine", "tambah mesin", "add machine",
  ], { param: "new", value: "true" }),
  dialog("act-create-routing", "Buat Routing", "/manufacturing/routing", "manufaktur", "IconRoute", [
    "create routing", "buat routing", "alur produksi",
  ], { param: "new", value: "true" }),
  dialog("act-create-subcontractor", "Tambah Mitra CMT", "/subcontract/registry", "subkontrak", "IconUserPlus", [
    "create subcontractor", "tambah mitra", "CMT",
  ], { param: "new", value: "true" }),
  dialog("act-schedule-wo", "Jadwalkan Work Order", "/manufacturing/schedule", "manufaktur", "IconCalendarPlus", [
    "schedule", "jadwalkan", "assign",
  ], { param: "action", value: "schedule" }),
  triggerFn("act-detect-shortage", "Deteksi Kekurangan Material", "/manufacturing/work-orders", "manufaktur", "IconAlertCircle", [
    "shortage", "kekurangan", "stock out",
  ], { param: "action", value: "shortage" }),
]

// ---------------------------------------------------------------------------
// 2.7 — SDM / HCM (7 actions: 5 nav + 2 dialog/fn)
// ---------------------------------------------------------------------------

const SDM: CmdKAction[] = [
  // Navigation
  nav("nav-hcm-employees", "Data Karyawan", "/hcm/employee-master", "sdm", "IconUsers", [
    "employees", "karyawan", "staff", "pegawai",
  ]),
  nav("nav-hcm-payroll", "Penggajian", "/hcm/payroll", "sdm", "IconCash", [
    "payroll", "gaji", "salary",
  ]),
  nav("nav-hcm-attendance", "Absensi", "/hcm/attendance", "sdm", "IconClock", [
    "attendance", "absensi", "hadir",
  ]),
  nav("nav-hcm-shifts", "Jadwal Shift", "/hcm/shifts", "sdm", "IconCalendarTime", [
    "shifts", "jadwal shift", "schedule",
  ]),
  nav("nav-hcm-onboarding", "Onboarding", "/hcm/onboarding", "sdm", "IconUserCheck", [
    "onboarding", "orientasi", "karyawan baru",
  ]),

  // Actions
  dialog("act-create-onboarding", "Buat Template Onboarding", "/hcm/onboarding", "sdm", "IconTemplate", [
    "create onboarding", "template", "orientasi",
  ], { param: "new", value: "true" }),
  triggerFn("act-create-disbursement", "Buat Batch Disbursement", "/hcm/payroll", "sdm", "IconCashBanknote", [
    "disbursement", "gaji", "payroll batch",
  ], { param: "action", value: "disburse" }),
]

// ---------------------------------------------------------------------------
// 2.8 — Dokumen & Sistem (3 nav)
// ---------------------------------------------------------------------------

const DOKUMEN: CmdKAction[] = [
  nav("nav-doc-master", "Data Master", "/documents/master", "dokumen", "IconDatabase", [
    "master data", "dokumen master",
  ]),
  nav("nav-doc-reports", "Laporan Sistem", "/documents/reports", "dokumen", "IconReportAnalytics", [
    "system reports", "laporan sistem",
  ]),
  nav("nav-doc-docs", "Dokumentasi", "/documents/docs", "dokumen", "IconNotebook", [
    "documentation", "dokumentasi",
  ]),
]

// ---------------------------------------------------------------------------
// 2.9 — Pengaturan (5 nav)
// ---------------------------------------------------------------------------

const PENGATURAN: CmdKAction[] = [
  nav("nav-set-system", "Pengaturan Sistem", "/settings", "pengaturan", "IconSettings", [
    "settings", "pengaturan",
  ]),
  nav("nav-set-users", "Manajemen Pengguna", "/settings/users", "pengaturan", "IconUserCog", [
    "users", "pengguna", "akun",
  ]),
  nav("nav-set-perms", "Matriks Izin", "/settings/permissions", "pengaturan", "IconShieldLock", [
    "permissions", "izin", "role",
  ]),
  nav("nav-set-numbering", "Penomoran Dokumen", "/settings/numbering", "pengaturan", "IconHash", [
    "numbering", "penomoran", "auto number",
  ]),
  nav("nav-help", "Bantuan & Dukungan", "/help", "pengaturan", "IconHelp", [
    "help", "bantuan", "support",
  ]),
]

// ---------------------------------------------------------------------------
// Full registry — flat array of all 122 actions
// ---------------------------------------------------------------------------

export const CMDK_ACTIONS: CmdKAction[] = [
  ...DASBOR,
  ...INVENTORI,
  ...PENJUALAN,
  ...PENGADAAN,
  ...KEUANGAN,
  ...MANUFAKTUR,
  ...SDM,
  ...DOKUMEN,
  ...PENGATURAN,
]

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** O(1) lookup by action ID */
export const CMDK_BY_ID: ReadonlyMap<string, CmdKAction> = new Map(
  CMDK_ACTIONS.map((a) => [a.id, a]),
)

/** Actions marked as pinned — shown in "Aksi Cepat" group */
export const PINNED_ACTIONS: CmdKAction[] = CMDK_ACTIONS.filter((a) => a.pinned)

/** Actions grouped by module */
export function getActionsByModule(mod: Module): CmdKAction[] {
  return CMDK_ACTIONS.filter((a) => a.module === mod)
}

/** Only navigation actions */
export function getNavigationActions(): CmdKAction[] {
  return CMDK_ACTIONS.filter((a) => a.type === "navigate")
}

/** Only create/action entries (dialog, page-form, trigger-fn) */
export function getCreateActions(): CmdKAction[] {
  return CMDK_ACTIONS.filter((a) => a.type !== "navigate")
}

/**
 * Build the full URL for an action, appending signal as query param if present.
 * e.g. "/procurement/vendors?new=true"
 */
export function buildActionUrl(action: CmdKAction): string {
  if (!action.signal) return action.route
  const sep = action.route.includes("?") ? "&" : "?"
  return `${action.route}${sep}${action.signal.param}=${action.signal.value}`
}
