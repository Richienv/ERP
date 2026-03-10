import {
  IconDashboard,
  IconDatabase,
  IconFileDescription,
  IconHelp,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconUsers,
  IconTool,
  IconCurrencyDollar,
  IconId,
} from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"

export type SidebarSubItem = {
  title: string
  url: string
  locked?: boolean
  badge?: number
  group?: string
  badgeSeverity?: "info" | "warning" | "critical"
}

export type SidebarNavItem = {
  title: string
  url: string
  icon?: Icon
  locked?: boolean
  badge?: number
  accentColor?: string
  items?: SidebarSubItem[]
}

export const navMain: SidebarNavItem[] = [
  {
    title: "Dasbor",
    url: "/dashboard",
    icon: IconDashboard,
  },
  {
    title: "Inventori",
    url: "/inventory",
    icon: IconDatabase,
    accentColor: "bg-blue-500",
    items: [
      { title: "Dashboard Inventori", url: "/inventory" },
      { title: "Kelola Produk", url: "/inventory/products" },
      { title: "Kategori Produk", url: "/inventory/categories" },
      { title: "Level Stok", url: "/inventory/stock", group: "Stok" },
      { title: "Pergerakan Stok", url: "/inventory/movements" },
      { title: "Transfer Stok", url: "/inventory/transfers" },
      { title: "Gudang & Lokasi", url: "/inventory/warehouses" },
      { title: "Fabric Rolls", url: "/inventory/fabric-rolls" },
      { title: "Stok Opname", url: "/inventory/audit", group: "Kontrol" },
      { title: "Opname Batch", url: "/inventory/cycle-counts" },
      { title: "Peringatan Stok", url: "/inventory/alerts" },
      { title: "Laporan Inventori", url: "/inventory/reports" },
      { title: "Saldo Awal Stok", url: "/inventory/opening-stock", group: "Pengaturan" },
      { title: "Pengaturan Inventori", url: "/inventory/settings" },
    ],
  },
  {
    title: "Penjualan & CRM",
    url: "/sales",
    icon: IconUsers,
    accentColor: "bg-green-500",
    items: [
      { title: "Dashboard Sales", url: "/sales" },
      { title: "Kelola Pelanggan", url: "/sales/customers" },
      { title: "Penawaran", url: "/sales/quotations" },
      { title: "Pesanan Penjualan", url: "/sales/orders" },
      { title: "Penjualan", url: "/sales/sales" },
      { title: "Lead & Pipeline", url: "/sales/leads" },
      { title: "Point of Sale (POS)", url: "/dashboard/pos", locked: true },
      { title: "Daftar Harga", url: "/sales/pricelists", group: "Harga & Komisi" },
      { title: "Skema Diskon", url: "/sales/discounts" },
      { title: "Salesperson & Komisi", url: "/sales/salespersons" },
    ],
  },
  {
    title: "Pengadaan",
    url: "/procurement",
    icon: IconShoppingCart,
    accentColor: "bg-orange-500",
    items: [
      { title: "Dashboard Pengadaan", url: "/procurement" },
      { title: "Pemasok (Vendor)", url: "/procurement/vendors" },
      { title: "Pesanan Pembelian", url: "/procurement/orders" },
      { title: "Permintaan Pembelian", url: "/procurement/requests" },
      { title: "Surat Jalan Masuk", url: "/procurement/receiving" },
    ],
  },
  {
    title: "Keuangan",
    url: "/finance",
    icon: IconCurrencyDollar,
    accentColor: "bg-purple-500",
    items: [
      { title: "Invoicing", url: "/finance/invoices", group: "Transaksi" },
      { title: "Piutang Usaha (AR)", url: "/finance/receivables" },
      { title: "Hutang Usaha (AP)", url: "/finance/payables" },
      { title: "Nota Kredit/Debit", url: "/finance/credit-notes" },
      { title: "Peti Kas", url: "/finance/petty-cash" },
      { title: "Jurnal Umum", url: "/finance/journal", group: "Akuntansi" },
      { title: "Transaksi Akun", url: "/finance/transactions" },
      { title: "Rekonsiliasi Bank", url: "/finance/reconciliation" },
      { title: "Chart of Accounts", url: "/finance/chart-accounts" },
      { title: "Laporan Keuangan", url: "/finance/reports", group: "Laporan & Setup" },
      { title: "Perencanaan Arus Kas", url: "/finance/planning" },
      { title: "Saldo Awal", url: "/finance/opening-balances" },
      { title: "Kurs Mata Uang", url: "/finance/currencies" },
      { title: "Periode Fiskal", url: "/finance/fiscal-periods" },
    ],
  },
  {
    title: "Manufaktur",
    url: "/manufacturing",
    icon: IconTool,
    accentColor: "bg-slate-500",
    items: [
      { title: "Dashboard Manufaktur", url: "/manufacturing" },
      { title: "Bill of Materials (BoM)", url: "/manufacturing/bom", group: "Perencanaan" },
      { title: "Kebutuhan Material", url: "/manufacturing/material-demand" },
      { title: "Perencanaan (MPS)", url: "/manufacturing/planning" },
      { title: "Daftar Cost Sheet", url: "/costing/sheets" },
      { title: "Work Center", url: "/manufacturing/work-centers", group: "Produksi" },
      { title: "Proses", url: "/manufacturing/processes" },
      { title: "Perintah Kerja (SPK)", url: "/manufacturing/work-orders" },
      { title: "Daftar Cut Plan", url: "/cutting/plans" },
      { title: "Kontrol Kualitas (QC)", url: "/manufacturing/quality", group: "Kualitas & Mitra" },
      { title: "Order Subkontrak", url: "/subcontract/orders" },
      { title: "Registri Mitra CMT", url: "/subcontract/registry" },
    ],
  },
  {
    title: "SDM",
    url: "/hcm",
    icon: IconId,
    accentColor: "bg-amber-700",
    items: [
      { title: "Data Karyawan", url: "/hcm/employee-master" },
      { title: "Penggajian", url: "/hcm/payroll" },
      { title: "Absensi", url: "/hcm/attendance" },
      { title: "Jadwal Shift", url: "/hcm/shifts" },
      { title: "Onboarding", url: "/hcm/onboarding" },
    ],
  },
  {
    title: "Dokumen & Sistem",
    url: "/documents",
    icon: IconFileDescription,
    accentColor: "bg-zinc-400",
    items: [
      { title: "Data Master", url: "/documents/master" },
      { title: "Laporan Sistem", url: "/documents/reports" },
      { title: "Dokumentasi", url: "/documents/docs" },
    ],
  },
]

export const navSecondary = [
  { title: "Pengaturan Sistem", url: "/settings", icon: IconSettings },
  { title: "Manajemen Pengguna", url: "/settings/users", icon: IconUsers },
  { title: "Matriks Izin", url: "/settings/permissions", icon: IconSettings },
  { title: "Penomoran Dokumen", url: "/settings/numbering", icon: IconFileDescription },
  { title: "Bantuan & Dukungan", url: "/help", icon: IconHelp },
  { title: "Pencarian", url: "/search", icon: IconSearch },
]

export function getStaffNav(): SidebarNavItem[] {
  return [{ title: "Portal Staf", url: "/staff", icon: IconDashboard }]
}

export function getAccountantNav(): SidebarNavItem[] {
  return [
    { title: "Financial Command Center", url: "/accountant", icon: IconDashboard },
    {
      title: "Modul Keuangan",
      url: "/finance",
      icon: IconCurrencyDollar,
      accentColor: "bg-purple-500",
      items: navMain.find(i => i.url === "/finance")?.items || [],
    },
  ]
}

export function getManagerNav(): SidebarNavItem[] {
  return [
    { title: "Factory Command Center", url: "/manager", icon: IconDashboard },
    {
      title: "Manufaktur",
      url: "/manufacturing",
      icon: IconTool,
      accentColor: "bg-slate-500",
      items: navMain.find(i => i.url === "/manufacturing")?.items || [],
    },
    {
      title: "Inventori",
      url: "/inventory",
      icon: IconDatabase,
      accentColor: "bg-blue-500",
      items: navMain.find(i => i.url === "/inventory")?.items || [],
    },
    {
      title: "Pengadaan",
      url: "/procurement",
      icon: IconShoppingCart,
      accentColor: "bg-orange-500",
      items: navMain.find(i => i.url === "/procurement")?.items || [],
    },
  ]
}

export function isSectionVisible(title: string, activeModules: string[] | null): boolean {
  if (!activeModules) return true

  const alwaysVisible = ["Dasbor", "Portal Staf", "Financial Command Center", "Factory Command Center"]
  if (alwaysVisible.includes(title)) return true

  const keyMap: Record<string, string[]> = {
    "Penjualan": ["SALES", "CRM", "QUOTATION", "LEAD", "ORDER"],
    "Inventori": ["INVENTORY", "STOCK", "WAREHOUSE", "PRODUCT", "STOCK_OPNAME"],
    "Keuangan": ["FINANCE", "ACCOUNTING", "INVOICE", "PAYMENT", "BILL"],
    "Financial Command Center": ["FINANCE", "ACCOUNTING", "INVOICE", "PAYMENT", "BILL"],
    "Pengadaan": ["PURCHASING", "PURCHASE", "VENDOR", "PO", "PR", "RECEIVING"],
    "Manufaktur": ["MANUFACTURING", "PRODUCTION", "MO", "SPK", "BOM", "ROUTING", "WORK_ORDER"],
    "Factory Command Center": ["MANUFACTURING", "PRODUCTION", "INVENTORY", "PURCHASING", "WORK_ORDER"],
    "SDM": ["HR", "SDM", "PAYROLL", "EMPLOYEE", "ATTENDANCE"],
    "Dokumen": ["DOCUMENTS", "SYSTEM", "REPORT"],
  }

  const matchKey = Object.keys(keyMap).find(k => title.includes(k))
  if (!matchKey) return true

  const relevantKeys = keyMap[matchKey]
  return activeModules.some(m => relevantKeys.some(k => m.includes(k) || k.includes(m)))
}

export const breadcrumbLabels: Record<string, string> = {
  dashboard: "Dasbor",
  inventory: "Inventori",
  sales: "Penjualan & CRM",
  procurement: "Pengadaan",
  finance: "Keuangan",
  manufacturing: "Manufaktur",
  subcontract: "Manufaktur",
  cutting: "Manufaktur",
  costing: "Manufaktur",
  hcm: "SDM",
  documents: "Dokumen & Sistem",
  settings: "Pengaturan",
  help: "Bantuan",
  accountant: "Akuntan",
  manager: "Manajer",
  staff: "Staf",
  products: "Kelola Produk",
  categories: "Kategori",
  stock: "Level Stok",
  movements: "Pergerakan Stok",
  transfers: "Transfer Stok",
  warehouses: "Gudang & Lokasi",
  audit: "Stok Opname",
  alerts: "Peringatan Stok",
  "fabric-rolls": "Fabric Rolls",
  reports: "Laporan",
  "opening-stock": "Saldo Awal Stok",
  customers: "Pelanggan",
  quotations: "Penawaran",
  orders: "Pesanan",
  leads: "Lead & Pipeline",
  pricelists: "Daftar Harga",
  discounts: "Skema Diskon",
  salespersons: "Salesperson",
  vendors: "Pemasok",
  requests: "Permintaan Pembelian",
  receiving: "Surat Jalan Masuk",
  invoices: "Invoicing",
  receivables: "Piutang (AR)",
  payables: "Hutang (AP)",
  "credit-notes": "Nota Kredit/Debit",
  "chart-accounts": "Chart of Accounts",
  "opening-balances": "Saldo Awal",
  transactions: "Transaksi Akun",
  journal: "Jurnal Umum",
  "petty-cash": "Peti Kas",
  reconciliation: "Rekonsiliasi Bank",
  currencies: "Kurs Mata Uang",
  "fiscal-periods": "Periode Fiskal",
  bom: "Bill of Materials",
  "material-demand": "Kebutuhan Material",
  planning: "Perencanaan (MPS)",
  "work-orders": "Perintah Kerja (SPK)",
  "work-centers": "Work Center",
  processes: "Proses",
  quality: "Kontrol Kualitas",
  plans: "Cut Plan",
  sheets: "Cost Sheet",
  registry: "Registri Mitra CMT",
  "employee-master": "Data Karyawan",
  payroll: "Penggajian",
  attendance: "Absensi",
  shifts: "Jadwal Shift",
  onboarding: "Onboarding",
  master: "Data Master",
  docs: "Dokumentasi",
  users: "Pengguna",
  permissions: "Matriks Izin",
  numbering: "Penomoran Dokumen",
  new: "Baru",
}
