"use client"

import * as React from "react"
import {
  IconChartBar,
  IconDashboard,
  IconDatabase,
  IconFileDescription,
  IconHelp,
  IconInnerShadowTop,
  IconReport,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconUsers,
  IconTool,
  IconCurrencyDollar,
  IconChartLine,
  IconTruck,
} from "@tabler/icons-react"

import { NavDocuments } from "@/components/nav-documents"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "Admin John",
    email: "admin@perusahaan.com",
    avatar: "/avatars/admin.jpg",
  },
  navMain: [
    {
      title: "Dasbor",
      url: "/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Inventori",
      url: "/inventory",
      icon: IconDatabase,
      items: [
        {
          title: "Dashboard Inventori",
          url: "/inventory",
        },
        {
          title: "Kelola Produk",
          url: "/inventory/products",
        },
        {
          title: "Level Stok",
          url: "/inventory/stock",
        },
        {
          title: "Pergerakan Stok",
          url: "/inventory/movements",
        },
        {
          title: "Gudang",
          url: "/inventory/warehouses",
        },
        {
          title: "Kategori",
          url: "/inventory/categories",
        },
        {
          title: "Penyesuaian Stok",
          url: "/inventory/adjustments",
        },
        {
          title: "Peringatan Stok",
          url: "/inventory/alerts",
        },
      ],
    },
    {
      title: "Penjualan & CRM",
      url: "/sales",
      icon: IconUsers,
      items: [
        {
          title: "Dashboard Sales",
          url: "/sales",
        },
        {
          title: "Kelola Pelanggan",
          url: "/sales/customers",
        },
        {
          title: "Penawaran",
          url: "/sales/quotations",
        },
        {
          title: "Pesanan Penjualan",
          url: "/sales/orders",
        },
        {
          title: "Penjualan",
          url: "/sales/sales",
        },
        {
          title: "Lead & Pipeline",
          url: "/sales/leads",
        },
        {
          title: "Daftar Harga",
          url: "/sales/pricelists",
        },
      ],
    },
    {
      title: "Pengadaan",
      url: "/procurement",
      icon: IconShoppingCart,
      items: [
        {
          title: "Dashboard Pengadaan",
          url: "/procurement",
        },
        {
          title: "Pemasok (Vendor)",
          url: "/procurement/vendors",
        },
        {
          title: "Pesanan Pembelian",
          url: "/procurement/orders",
        },
        {
          title: "Permintaan Pembelian",
          url: "/procurement/requests",
        },
      ],
    },
    {
      title: "Keuangan",
      url: "/finance",
      icon: IconCurrencyDollar,
      items: [
        {
          title: "Chart of Accounts",
          url: "/finance/chart-accounts",
        },
        {
          title: "Jurnal Umum",
          url: "/finance/journal",
        },
        {
          title: "Laporan Keuangan",
          url: "/finance/reports",
        },
      ],
    },
    {
      title: "Manufaktur",
      url: "/manufacturing",
      icon: IconTool,
      items: [
        {
          title: "Dashboard Manufaktur",
          url: "/manufacturing",
        },
        {
          title: "Bill of Materials (BoM)",
          url: "/manufacturing/bom",
        },
        {
          title: "Order Produksi (MO)",
          url: "/manufacturing/orders",
        },
        {
          title: "Perintah Kerja (SPK)",
          url: "/manufacturing/work-orders",
        },
        {
          title: "Pusat Kerja & Routing",
          url: "/manufacturing/work-centers",
        },
        {
          title: "Perencanaan (MPS)",
          url: "/manufacturing/planning",
        },
        {
          title: "Kontrol Kualitas (QC)",
          url: "/manufacturing/quality",
        },
      ],
    },
    {
      title: "SDM",
      url: "/hcm",
      icon: IconUsers,
      items: [
        {
          title: "Data Karyawan",
          url: "/hcm/employee-master",
        },
        {
          title: "Penggajian",
          url: "/hcm/payroll",
        },
        {
          title: "Absensi",
          url: "/hcm/attendance",
        },
      ],
    },
    {
      title: "Dokumen & Sistem",
      url: "/documents",
      icon: IconFileDescription,
      items: [
        {
          title: "Data Master",
          url: "/documents/master",
        },
        {
          title: "Laporan Sistem",
          url: "/documents/reports",
        },
        {
          title: "Dokumentasi",
          url: "/documents/docs",
        },
      ],
    },
  ],
  navClouds: [
    {
      title: "Analitik",
      icon: IconChartLine,
      isActive: true,
      url: "/analytics",
      items: [
        {
          title: "Analitik Penjualan",
          url: "/analytics/sales",
        },
        {
          title: "Laporan Inventori",
          url: "/analytics/inventory",
        },
        {
          title: "Laporan Keuangan",
          url: "/analytics/finance",
        },
      ],
    },
    {
      title: "Operasional",
      icon: IconTruck,
      url: "/operations",
      items: [
        {
          title: "Manajemen Gudang",
          url: "/operations/warehouse",
        },
        {
          title: "Pengiriman & Delivery",
          url: "/operations/shipping",
        },
        {
          title: "Kontrol Kualitas",
          url: "/operations/quality",
        },
      ],
    },
    {
      title: "Kepatuhan",
      icon: IconFileDescription,
      url: "/compliance",
      items: [
        {
          title: "Jejak Audit",
          url: "/compliance/audit",
        },
        {
          title: "Laporan Regulasi",
          url: "/compliance/regulatory",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Pengaturan Sistem",
      url: "/settings",
      icon: IconSettings,
    },
    {
      title: "Manajemen Pengguna",
      url: "/settings/users",
      icon: IconUsers,
    },
    {
      title: "Bantuan & Dukungan",
      url: "/help",
      icon: IconHelp,
    },
    {
      title: "Pencarian",
      url: "/search",
      icon: IconSearch,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <a href="#">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Sistem ERP</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
