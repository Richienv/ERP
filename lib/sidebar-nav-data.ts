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
  // Inventory sub-icons
  IconLayoutDashboard,
  IconPackage,
  IconCategory,
  IconChartBar,
  IconArrowsExchange,
  IconTransfer,
  IconBuildingWarehouse,
  IconRulerMeasure,
  IconClipboardCheck,
  IconRefresh,
  IconAlertTriangle,
  IconReportAnalytics,
  IconScale,
  IconAdjustments,
  // Sales sub-icons
  IconAddressBook,
  IconFileInvoice,
  IconShoppingBag,
  IconReceipt,
  IconTargetArrow,
  IconDeviceDesktop,
  IconTag,
  IconDiscount2,
  IconUserStar,
  // Procurement sub-icons
  IconTruckDelivery,
  IconFileText,
  IconClipboardList,
  IconPackageImport,
  // Finance sub-icons
  IconCash,
  IconArrowUpRight,
  IconArrowDownLeft,
  IconCreditCard,
  IconPigMoney,
  IconBook,
  IconListDetails,
  IconBuildingBank,
  IconSitemap,
  IconChartLine,
  IconWallet,
  IconCoin,
  IconCalendarStats,
  IconBuilding,
  // Manufacturing sub-icons
  IconPuzzle,
  IconStack2,
  IconCalendarEvent,
  IconCalculator,
  IconBuildingFactory,
  IconRoute,
  IconHammer,
  IconScissors,
  IconShieldCheck,
  IconTruckReturn,
  IconUsersGroup,
  IconGitBranch,
  IconCalendarTime,
  // HCM sub-icons
  IconUserCheck,
  // IconCurrencyDollar as IconPayroll, // unused
  IconFingerprint,
  IconClock,
  IconRocket,
  // Documents sub-icons
  IconDatabaseExport,
  IconFileAnalytics,
  IconNotebook,
  // Mining edition
  IconPlus,
} from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"

import type { ModuleKey } from "@/lib/sidebar-feature-flags"

export type SidebarSubItem = {
  title: string
  url: string
  icon?: Icon
  locked?: boolean
  badge?: number
  group?: string
  badgeSeverity?: "info" | "warning" | "critical"
  moduleKey?: ModuleKey
}

export type SidebarNavItem = {
  title: string
  url: string
  icon?: Icon
  locked?: boolean
  badge?: number
  accentColor?: string
  items?: SidebarSubItem[]
  moduleKey?: ModuleKey
}

export const navMain: SidebarNavItem[] = [
  {
    title: "Dasbor",
    url: "/dashboard",
    icon: IconDashboard,
    moduleKey: "dashboard",
  },
  {
    title: "Armada",
    url: "/fleet",
    icon: IconTruckDelivery,
    accentColor: "bg-amber-700",
    moduleKey: "fleet",
    items: [
      { title: "Daftar Armada", url: "/fleet", icon: IconLayoutDashboard },
      { title: "Tambah Armada", url: "/fleet/new", icon: IconPlus },
    ],
  },
  {
    title: "Inventori",
    url: "/inventory",
    icon: IconDatabase,
    accentColor: "bg-blue-500",
    moduleKey: "inventory",
    items: [
      { title: "Dashboard Inventori", url: "/inventory", icon: IconLayoutDashboard },
      { title: "Kelola Produk", url: "/inventory/products", icon: IconPackage },
      { title: "Level Stok", url: "/inventory/stock", icon: IconChartBar, group: "Stok" },
      { title: "Pergerakan Stok", url: "/inventory/movements", icon: IconArrowsExchange },
      { title: "Transfer Stok", url: "/inventory/transfers", icon: IconTransfer },
      { title: "Gudang & Lokasi", url: "/inventory/warehouses", icon: IconBuildingWarehouse },
      { title: "Fabric Rolls", url: "/inventory/fabric-rolls", icon: IconRulerMeasure, moduleKey: "inventoryFabricRolls" },
      { title: "Stok Opname", url: "/inventory/audit", icon: IconClipboardCheck, group: "Kontrol" },
      { title: "Opname Batch", url: "/inventory/cycle-counts", icon: IconRefresh },
      { title: "Peringatan Stok", url: "/inventory/alerts", icon: IconAlertTriangle },
      { title: "Laporan Inventori", url: "/inventory/reports", icon: IconReportAnalytics },
      { title: "Saldo Awal Stok", url: "/inventory/opening-stock", icon: IconScale, group: "Pengaturan" },
      { title: "Pengaturan Inventori", url: "/inventory/settings", icon: IconAdjustments },
    ],
  },
  {
    title: "Penjualan & CRM",
    url: "/sales",
    icon: IconUsers,
    accentColor: "bg-green-500",
    moduleKey: "sales",
    items: [
      { title: "Dashboard Sales", url: "/sales", icon: IconLayoutDashboard },
      { title: "Kelola Pelanggan", url: "/sales/customers", icon: IconAddressBook },
      { title: "Penawaran", url: "/sales/quotations", icon: IconFileInvoice },
      { title: "Pesanan Penjualan", url: "/sales/orders", icon: IconShoppingBag },
      { title: "Penjualan", url: "/sales/sales", icon: IconReceipt },
      { title: "Lead & Pipeline", url: "/sales/leads", icon: IconTargetArrow },
      { title: "Point of Sale (POS)", url: "/dashboard/pos", icon: IconDeviceDesktop, locked: true, moduleKey: "pos" },
      { title: "Daftar Harga", url: "/sales/pricelists", icon: IconTag, group: "Harga & Komisi" },
      { title: "Skema Diskon", url: "/sales/discounts", icon: IconDiscount2 },
      { title: "Salesperson & Komisi", url: "/sales/salespersons", icon: IconUserStar },
    ],
  },
  {
    title: "Pengadaan",
    url: "/procurement",
    icon: IconShoppingCart,
    accentColor: "bg-orange-500",
    moduleKey: "procurement",
    items: [
      { title: "Dashboard Pengadaan", url: "/procurement", icon: IconLayoutDashboard },
      { title: "Pemasok (Vendor)", url: "/procurement/vendors", icon: IconTruckDelivery },
      { title: "Pesanan Pembelian", url: "/procurement/orders", icon: IconFileText },
      { title: "Permintaan Pembelian", url: "/procurement/requests", icon: IconClipboardList },
      { title: "Surat Jalan Masuk", url: "/procurement/receiving", icon: IconPackageImport },
    ],
  },
  {
    title: "Keuangan",
    url: "/finance",
    icon: IconCurrencyDollar,
    accentColor: "bg-purple-500",
    moduleKey: "finance",
    items: [
      { title: "Invoicing", url: "/finance/invoices", icon: IconFileInvoice, group: "Transaksi" },
      { title: "Piutang Usaha (AR)", url: "/finance/receivables", icon: IconArrowUpRight },
      { title: "Hutang Usaha (AP)", url: "/finance/payables", icon: IconArrowDownLeft },
      { title: "Nota Kredit/Debit", url: "/finance/credit-notes", icon: IconCreditCard },
      { title: "Peti Kas", url: "/finance/petty-cash", icon: IconPigMoney },
      { title: "Jurnal Umum", url: "/finance/journal", icon: IconBook, group: "Akuntansi" },
      { title: "Transaksi Akun", url: "/finance/transactions", icon: IconListDetails },
      { title: "Rekonsiliasi Bank", url: "/finance/reconciliation", icon: IconBuildingBank },
      { title: "Chart of Accounts", url: "/finance/chart-accounts", icon: IconSitemap },
      { title: "Laporan Keuangan", url: "/finance/reports", icon: IconChartLine, group: "Laporan & Setup" },
      { title: "Perencanaan Arus Kas", url: "/finance/planning", icon: IconWallet },
      { title: "Saldo Awal", url: "/finance/opening-balances", icon: IconScale },
      { title: "Kurs Mata Uang", url: "/finance/currencies", icon: IconCoin },
      { title: "Periode Fiskal", url: "/finance/fiscal-periods", icon: IconCalendarStats },
      { title: "Aset Tetap", url: "/finance/fixed-assets", icon: IconBuilding, group: "Aset Tetap" },
      { title: "Gaji & SDM", url: "/hcm/payroll", icon: IconCash, group: "Terkait" },
    ],
  },
  {
    title: "Manufaktur",
    url: "/manufacturing",
    icon: IconTool,
    accentColor: "bg-slate-500",
    moduleKey: "manufacturing",
    items: [
      { title: "Dashboard Manufaktur", url: "/manufacturing", icon: IconLayoutDashboard },
      { title: "Bill of Materials (BoM)", url: "/manufacturing/bom", icon: IconPuzzle, group: "Perencanaan" },
      { title: "Kebutuhan Material", url: "/manufacturing/material-demand", icon: IconStack2 },
      { title: "Perencanaan (MPS)", url: "/manufacturing/planning", icon: IconCalendarEvent },
      { title: "Daftar Cost Sheet", url: "/costing/sheets", icon: IconCalculator },
      { title: "Work Center", url: "/manufacturing/work-centers", icon: IconBuildingFactory, group: "Produksi" },
      { title: "Grup Mesin", url: "/manufacturing/groups", icon: IconSitemap },
      { title: "Proses", url: "/manufacturing/processes", icon: IconRoute },
      { title: "Routing", url: "/manufacturing/routing", icon: IconGitBranch },
      { title: "Perintah Kerja (SPK)", url: "/manufacturing/work-orders", icon: IconHammer },
      { title: "Jadwal Produksi", url: "/manufacturing/schedule", icon: IconCalendarTime },
      { title: "Daftar Cut Plan", url: "/cutting/plans", icon: IconScissors },
      { title: "Kontrol Kualitas (QC)", url: "/manufacturing/quality", icon: IconShieldCheck, group: "Kualitas & Mitra" },
      { title: "Order Subkontrak", url: "/subcontract/orders", icon: IconTruckReturn },
      { title: "Registri Mitra CMT", url: "/subcontract/registry", icon: IconUsersGroup },
    ],
  },
  {
    title: "SDM",
    url: "/hcm",
    icon: IconId,
    accentColor: "bg-amber-700",
    moduleKey: "hcm",
    items: [
      { title: "Data Karyawan", url: "/hcm/employee-master", icon: IconUserCheck },
      { title: "Penggajian", url: "/hcm/payroll", icon: IconCash },
      { title: "Absensi", url: "/hcm/attendance", icon: IconFingerprint },
      { title: "Jadwal Shift", url: "/hcm/shifts", icon: IconClock, moduleKey: "hcmShifts" },
      { title: "Onboarding", url: "/hcm/onboarding", icon: IconRocket, moduleKey: "hcmOnboarding" },
    ],
  },
  {
    title: "Dokumen & Sistem",
    url: "/documents",
    icon: IconFileDescription,
    accentColor: "bg-zinc-400",
    moduleKey: "documents",
    items: [
      { title: "Data Master", url: "/documents/master", icon: IconDatabaseExport },
      { title: "Laporan Sistem", url: "/documents/reports", icon: IconFileAnalytics },
      { title: "Dokumentasi", url: "/documents/docs", icon: IconNotebook },
    ],
  },
]

export const navSecondary: SidebarNavItem[] = [
  { title: "Pengaturan Sistem", url: "/settings", icon: IconSettings, moduleKey: "settings" },
  { title: "Manajemen Pengguna", url: "/settings/users", icon: IconUsers, moduleKey: "settings" },
  { title: "Matriks Izin", url: "/settings/permissions", icon: IconSettings, moduleKey: "permissionMatrix" },
  { title: "Penomoran Dokumen", url: "/settings/numbering", icon: IconFileDescription, moduleKey: "documentNumbering" },
  { title: "Bantuan & Dukungan", url: "/help", icon: IconHelp, moduleKey: "help" },
  { title: "Pencarian", url: "/search", icon: IconSearch, moduleKey: "search" },
]

// ─────────────────────────────────────────────────────────────────────────
// Feature-flag aware filtering — applies MODULE_FLAGS visibility rules to
// nav items + their subitems. Use this in app-sidebar.tsx instead of raw
// navMain/navSecondary.
// ─────────────────────────────────────────────────────────────────────────

import { isModuleEnabled } from "@/lib/sidebar-feature-flags"

export function filterNavByFeatureFlags(items: SidebarNavItem[]): SidebarNavItem[] {
  return items
    .filter((item) => isModuleEnabled(item.moduleKey))
    .map((item) => ({
      ...item,
      items: item.items?.filter((sub) => isModuleEnabled(sub.moduleKey)),
    }))
}

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
  "fixed-assets": "Aset Tetap",
  depreciation: "Penyusutan",
  bom: "Bill of Materials",
  "material-demand": "Kebutuhan Material",
  planning: "Perencanaan (MPS)",
  "work-orders": "Perintah Kerja (SPK)",
  "work-centers": "Work Center",
  groups: "Grup Mesin",
  processes: "Proses",
  routing: "Routing",
  schedule: "Jadwal Produksi",
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
