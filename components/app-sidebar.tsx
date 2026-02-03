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
  IconBuildingStore,
  IconWorld,
  IconReceipt,
} from "@tabler/icons-react"
import { useAuth } from "@/lib/auth-context"
import { useWorkflowConfig } from "@/components/workflow/workflow-config-context"

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
          title: "Pergerakan Stok",
          url: "/inventory/movements",
        },
        {
          title: "Gudang & Lokasi",
          url: "/inventory/warehouses",
        },
        {
          title: "Stock Opname",
          url: "/inventory/adjustments",
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
          title: "Point of Sale (POS)",
          url: "/dashboard/pos",
        },
        {
          title: "Daftar Harga",
          url: "/sales/pricelists",
        },
      ],
    },
    {
      title: "E-commerce",
      url: "/dashboard/ecommerce",
      icon: IconWorld,
      items: [
        {
          title: "Dashboard Toko",
          url: "/dashboard/ecommerce",
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
        {
          title: "Penerimaan Barang (GRN)",
          url: "/procurement/receiving",
        },
      ],
    },
    {
      title: "Keuangan",
      url: "/finance",
      icon: IconCurrencyDollar,
      items: [
        {
          title: "Invoicing",
          url: "/finance/invoices",
        },
        {
          title: "Penerimaan (AR)",
          url: "/finance/payments",
        },
        {
          title: "Tagihan Vendor (AP)",
          url: "/finance/bills",
        },
        {
          title: "Pembayaran (AP)",
          url: "/finance/vendor-payments",
        },
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
  const { user } = useAuth()

  // Filter navigation for Staff Role
  const isStaff = user?.role === "ROLE_STAFF"
  const isAccountant = user?.role === "ROLE_ACCOUNTANT"

  const staffNav = [
    {
      title: "Portal Staf",
      url: "/staff",
      icon: IconDashboard,
      isActive: true,
    }
  ]

  const accountantNav = [
    {
      title: "Financial Command Center",
      url: "/accountant",
      icon: IconDashboard,
      isActive: true,
    },
    // Keep access to detailed Finance module if needed, but primary is Command Center
    {
      title: "Modul Keuangan",
      url: "/finance",
      icon: IconCurrencyDollar,
      items: data.navMain.find(i => i.url === "/finance")?.items || []
    }
  ]

  // Manager Navigation
  const managerNav = [
    {
      title: "Factory Command Center",
      url: "/manager",
      icon: IconDashboard, // Using Dashboard icon as it is a Command Center
      isActive: true,
    },
    {
      title: "Manufaktur",
      url: "/manufacturing",
      icon: IconTool,
      items: data.navMain.find(i => i.url === "/manufacturing")?.items || []
    },
    {
      title: "Inventori",
      url: "/inventory",
      icon: IconDatabase,
      items: data.navMain.find(i => i.url === "/inventory")?.items || []
    },
    {
      title: "Pengadaan",
      url: "/procurement",
      icon: IconShoppingCart,
      items: data.navMain.find(i => i.url === "/procurement")?.items || []
    }
  ]

  const { activeModules } = useWorkflowConfig();

  // MODULE MAPPING: Title Keyword -> Module Key Fragment
  // "MOD_SALES_01" -> "SALES" -> Matches "Penjualan"
  const MODULE_MAP: Record<string, string> = {
    "Penjualan": "SALES",
    "CRM": "SALES",
    "Inventori": "STOCK", // Maps to MOD_STOCK
    "Keuangan": "FINANCE", // Maps to MOD_PAYMENT, MOD_INVOICE (which are Finance) --> "PAYMENT", "INVOICE"
    // For cleaner logic: if ActiveModules contains ANY key that maps to this Section.
    // e.g. "Keuangan" section is active if "MOD_INVOICE" or "MOD_PAYMENT" is active.
  };

  const isSectionActive = (title: string, items: any[]) => {
    if (!activeModules) return true; // Show all if no config

    // Default: Show Dashboard
    if (title === "Dasbor") return true;

    // Mapping Logic
    let relevantKeys: string[] = [];
    if (title.includes("Penjualan")) relevantKeys = ["SALES", "QUOTATION", "LEAD"];
    if (title.includes("Inventori")) relevantKeys = ["STOCK", "WAREHOUSE", "PRODUCT"];
    if (title.includes("Keuangan")) relevantKeys = ["INVOICE", "PAYMENT", "BILL"];
    if (title.includes("Pengadaan")) relevantKeys = ["PURCHASE", "VENDOR"];
    if (title.includes("Manufaktur")) relevantKeys = ["MANUFACTURING", "PRODUCTION"];
    if (title.includes("SDM")) relevantKeys = ["HR", "EMPLOYEE"];

    // Check if any relevant key is in activeModules
    return activeModules.some(m => relevantKeys.some(k => m.includes(k)));
  };


  let filteredNavMain = data.navMain
  if (isStaff) {
    filteredNavMain = staffNav
  } else if (isAccountant) {
    filteredNavMain = accountantNav
  } else if (user?.role === "ROLE_MANAGER") {
    filteredNavMain = managerNav
  }

  // Apply Workflow Visibility Filter on top of Role Filter
  if (activeModules) {
    filteredNavMain = filteredNavMain.filter(item => isSectionActive(item.title, item.items || []));
  }

  const filteredNavSecondary = (isStaff || isAccountant || user?.role === "ROLE_MANAGER") ? [] : data.navSecondary

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
        <NavMain items={filteredNavMain} />
        {!isStaff && <NavSecondary items={filteredNavSecondary} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
