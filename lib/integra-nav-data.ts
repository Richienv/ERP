/**
 * Integra sidebar nav data — flat structure grouped by section.
 *
 * Reference: integra.html lines 553-641. Each section has a title (uppercase
 * 10px) and a flat list of items. No nested submenus.
 *
 * Filtered against MODULE_FLAGS so KRI mining edition only shows enabled items.
 */

import type { Icon } from "@tabler/icons-react"
import {
    IconLayoutDashboard,
    IconChartLine,
    IconReportAnalytics,
    IconTruckDelivery,
    IconShoppingCart,
    IconClipboardList,
    IconPackageImport,
    IconPackages,
    IconBoxSeam,
    IconArrowsExchange,
    IconBuildingWarehouse,
    IconAlertTriangle,
    IconCash,
    IconArrowUpRight,
    IconArrowDownLeft,
    IconBuilding,
    IconBook,
    IconWallet,
    IconUsers,
    IconUserCog,
    IconCalendarTime,
    IconCar,
    IconSettings,
    IconHelpCircle,
    IconFileInvoice,
} from "@tabler/icons-react"
import { isModuleEnabled, type ModuleKey } from "./sidebar-feature-flags"

export type IntegraNavItem = {
    title: string
    url: string
    icon: Icon
    /** Optional badge count. If string starts with "!" → err variant; suffix `*` → warn variant. */
    count?: number | null
    countKind?: "default" | "warn" | "err"
    moduleKey?: ModuleKey
}

export type IntegraNavSection = {
    title: string
    items: IntegraNavItem[]
}

const ALL_SECTIONS: IntegraNavSection[] = [
    {
        title: "Umum",
        items: [
            { title: "Dasbor", url: "/dashboard", icon: IconLayoutDashboard, moduleKey: "dashboard" },
            { title: "Laporan", url: "/reports", icon: IconChartLine, moduleKey: "dashboard" },
            { title: "Pesanan Penjualan", url: "/sales/orders", icon: IconReportAnalytics, moduleKey: "sales" },
        ],
    },
    {
        title: "Armada",
        items: [
            { title: "Daftar Armada", url: "/fleet", icon: IconCar, moduleKey: "fleet" },
        ],
    },
    {
        title: "Pengadaan",
        items: [
            { title: "Dashboard Pengadaan", url: "/procurement", icon: IconLayoutDashboard, moduleKey: "procurement" },
            { title: "Pesanan Pembelian", url: "/procurement/orders", icon: IconShoppingCart, moduleKey: "procurement" },
            { title: "Permintaan (PR)", url: "/procurement/requests", icon: IconClipboardList, moduleKey: "procurement" },
            { title: "Pemasok", url: "/procurement/vendors", icon: IconTruckDelivery, moduleKey: "procurement" },
            { title: "Surat Jalan Masuk", url: "/procurement/receiving", icon: IconPackageImport, moduleKey: "procurement" },
        ],
    },
    {
        title: "Logistik",
        items: [
            { title: "Inventaris", url: "/inventory", icon: IconPackages, moduleKey: "inventory" },
            { title: "Kelola Produk", url: "/inventory/products", icon: IconBoxSeam, moduleKey: "inventory" },
            { title: "Pergerakan Stok", url: "/inventory/movements", icon: IconArrowsExchange, moduleKey: "inventory" },
            { title: "Gudang", url: "/inventory/warehouses", icon: IconBuildingWarehouse, moduleKey: "inventory" },
            { title: "Peringatan Stok", url: "/inventory/alerts", icon: IconAlertTriangle, moduleKey: "inventory" },
        ],
    },
    {
        title: "Keuangan",
        items: [
            { title: "Invoicing", url: "/finance/invoices", icon: IconFileInvoice, moduleKey: "finance" },
            { title: "Piutang Usaha", url: "/finance/receivables", icon: IconArrowUpRight, moduleKey: "finance" },
            { title: "Hutang Usaha", url: "/finance/payables", icon: IconArrowDownLeft, moduleKey: "finance" },
            { title: "Arus Kas", url: "/finance/planning", icon: IconWallet, moduleKey: "finance" },
            { title: "Aset Tetap", url: "/finance/fixed-assets", icon: IconBuilding, moduleKey: "finance" },
            { title: "Jurnal Umum", url: "/finance/journal", icon: IconBook, moduleKey: "finance" },
            { title: "Laporan Keuangan", url: "/finance/reports", icon: IconCash, moduleKey: "finance" },
        ],
    },
    {
        title: "Sumber Daya",
        items: [
            { title: "Karyawan", url: "/hcm/employee-master", icon: IconUsers, moduleKey: "hcm" },
            { title: "Penggajian", url: "/hcm/payroll", icon: IconUserCog, moduleKey: "hcm" },
            { title: "Absensi", url: "/hcm/attendance", icon: IconCalendarTime, moduleKey: "hcm" },
        ],
    },
    {
        title: "Sistem",
        items: [
            { title: "Pengaturan", url: "/settings", icon: IconSettings, moduleKey: "settings" },
            { title: "Bantuan", url: "/help", icon: IconHelpCircle, moduleKey: "help" },
        ],
    },
]

export function getIntegraNav(): IntegraNavSection[] {
    return ALL_SECTIONS
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => isModuleEnabled(item.moduleKey)),
        }))
        .filter((section) => section.items.length > 0)
}
