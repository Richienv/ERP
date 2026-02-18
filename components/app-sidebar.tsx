"use client"

import * as React from "react"
import {
  IconDashboard,
  IconDatabase,
  IconFileDescription,
  IconHelp,
  IconInnerShadowTop,
  IconSearch,
  IconSettings,
  IconShoppingCart,
  IconUsers,
  IconTool,
  IconCurrencyDollar,
  IconChartLine,
  IconTruck,
  IconWorld,
  IconScissors,
} from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useWorkflowConfig } from "@/components/workflow/workflow-config-context"

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

type SidebarNavItem = {
  title: string
  url: string
  icon?: React.ComponentType<any>
  locked?: boolean
  items?: { title: string; url: string }[]
}

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
          title: "Kategori Produk",
          url: "/inventory/categories",
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
        {
          title: "Fabric Rolls",
          url: "/inventory/fabric-rolls",
        },
        {
          title: "Transfer Stok",
          url: "/inventory/transfers",
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
      locked: true,
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
        {
          title: "Rekonsiliasi Bank",
          url: "/finance/reconciliation",
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
          title: "Pusat Kerja (Mesin)",
          url: "/manufacturing/work-centers",
        },
        {
          title: "Grup Pusat Kerja",
          url: "/manufacturing/groups",
        },
        {
          title: "Bill of Materials (BoM)",
          url: "/manufacturing/bom",
        },
        {
          title: "Routing Proses",
          url: "/manufacturing/routing",
        },
        {
          title: "Perencanaan (MPS)",
          url: "/manufacturing/planning",
        },
        {
          title: "Jadwal Produksi",
          url: "/manufacturing/schedule",
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
          title: "Kontrol Kualitas (QC)",
          url: "/manufacturing/quality",
        },
      ],
    },
    {
      title: "Subkontrak",
      url: "/subcontract",
      icon: IconTruck,
      items: [
        {
          title: "Dashboard CMT",
          url: "/subcontract",
        },
        {
          title: "Registri Mitra",
          url: "/subcontract/registry",
        },
        {
          title: "Order Subkontrak",
          url: "/subcontract/orders",
        },
      ],
    },
    {
      title: "Pemotongan",
      url: "/cutting",
      icon: IconScissors,
      items: [
        {
          title: "Dashboard Potong",
          url: "/cutting",
        },
        {
          title: "Daftar Cut Plan",
          url: "/cutting/plans",
        },
      ],
    },
    {
      title: "Kalkulasi Biaya",
      url: "/costing",
      icon: IconCurrencyDollar,
      items: [
        {
          title: "Dashboard Biaya",
          url: "/costing",
        },
        {
          title: "Daftar Cost Sheet",
          url: "/costing/sheets",
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
        {
          title: "Jadwal Shift",
          url: "/hcm/shifts",
        },
        {
          title: "Onboarding",
          url: "/hcm/onboarding",
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
      title: "Matriks Izin",
      url: "/settings/permissions",
      icon: IconSettings,
    },
    {
      title: "Penomoran Dokumen",
      url: "/settings/numbering",
      icon: IconFileDescription,
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
  const router = useRouter()

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

  const { activeModules, tenantBranding } = useWorkflowConfig();

  const isSectionActive = (title: string, _items: any[]) => {
    if (!activeModules) return true; // Show all if no config

    // Always-visible command centers and landing pages.
    if (title === "Dasbor") return true;
    if (title === "Portal Staf") return true;
    if (title === "Financial Command Center") return true;
    if (title === "Factory Command Center") return true;

    // Mapping Logic
    let relevantKeys: string[] = [];
    if (title.includes("Penjualan")) relevantKeys = ["SALES", "CRM", "QUOTATION", "LEAD", "ORDER"];
    if (title.includes("Inventori")) relevantKeys = ["INVENTORY", "STOCK", "WAREHOUSE", "PRODUCT", "STOCK_OPNAME"];
    if (title.includes("Keuangan")) relevantKeys = ["FINANCE", "ACCOUNTING", "INVOICE", "PAYMENT", "BILL"];
    if (title.includes("Financial Command Center")) relevantKeys = ["FINANCE", "ACCOUNTING", "INVOICE", "PAYMENT", "BILL"];
    if (title.includes("Pengadaan")) relevantKeys = ["PURCHASING", "PURCHASE", "VENDOR", "PO", "PR", "RECEIVING"];
    if (title.includes("Manufaktur")) relevantKeys = ["MANUFACTURING", "PRODUCTION", "MO", "SPK", "BOM", "ROUTING", "WORK_ORDER"];
    if (title.includes("Subkontrak")) relevantKeys = ["MANUFACTURING", "PRODUCTION", "SUBCONTRACT", "CMT"];
    if (title.includes("Pemotongan")) relevantKeys = ["MANUFACTURING", "PRODUCTION", "CUTTING", "CUT_PLAN"];
    if (title.includes("Kalkulasi Biaya")) relevantKeys = ["MANUFACTURING", "PRODUCTION", "COSTING", "FINANCE"];
    if (title.includes("Factory Command Center")) relevantKeys = ["MANUFACTURING", "PRODUCTION", "INVENTORY", "PURCHASING", "WORK_ORDER"];
    if (title.includes("SDM")) relevantKeys = ["HR", "SDM", "PAYROLL", "EMPLOYEE", "ATTENDANCE"];
    if (title.includes("Dokumen")) relevantKeys = ["DOCUMENTS", "SYSTEM", "REPORT"];

    // Check if any relevant key is in activeModules
    if (relevantKeys.length === 0) return true
    return activeModules.some((m) => relevantKeys.some((k) => m.includes(k) || k.includes(m)));
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

  const prefetchUrls = React.useMemo(() => {
    const urls = new Set<string>()
    const addUrl = (url?: string) => {
      if (!url || url === "#" || url.startsWith("http")) return
      urls.add(url)
    }

    const collectFromMain = (items: SidebarNavItem[]) => {
      items.forEach((item) => {
        addUrl(item.url)
        item.items?.forEach((subItem) => addUrl(subItem.url))
      })
    }

    collectFromMain(filteredNavMain as SidebarNavItem[])
    filteredNavSecondary.forEach((item) => addUrl(item.url))
    return Array.from(urls)
  }, [filteredNavMain, filteredNavSecondary])

  React.useEffect(() => {
    if (prefetchUrls.length === 0) return

    let cancelled = false
    const timers: number[] = []
    prefetchUrls.forEach((url, index) => {
      const timer = window.setTimeout(() => {
        if (!cancelled) {
          router.prefetch(url)
        }
      }, 50 + index * 20)
      timers.push(timer)
    })

    return () => {
      cancelled = true
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [router, prefetchUrls])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="border-b border-zinc-200 dark:border-zinc-800">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5 rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <a href="/dashboard">
                <div className="flex items-center justify-center h-6 w-6 bg-zinc-900 dark:bg-white">
                  <span className="text-[10px] font-black text-white dark:text-zinc-900 leading-none">
                    {tenantBranding.tenantName ? tenantBranding.tenantName.slice(0, 2).toUpperCase() : "EP"}
                  </span>
                </div>
                <span className="text-[14px] font-black uppercase tracking-tight">
                  {tenantBranding.tenantName || "Sistem ERP"}
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={filteredNavMain} />
        {!isStaff && <NavSecondary items={filteredNavSecondary} className="mt-auto" />}
      </SidebarContent>
      <SidebarFooter className="p-0">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
