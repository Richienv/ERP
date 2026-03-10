# Sidebar & Layout Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate sidebar nav data into a separate file with group separators, add breadcrumbs to site header, clean up code, and polish visual design.

**Architecture:** Extract nav data + types to `lib/sidebar-nav-data.ts`, create `hooks/use-filtered-nav.ts` and `hooks/use-inject-badges.ts` to handle logic, add `hooks/use-breadcrumbs.ts` for header breadcrumbs. Update `nav-main.tsx` to render group separators and accent colors. Fix site-header and mobile sidebar.

**Tech Stack:** React 19, Next.js App Router, Tailwind CSS v4, shadcn/ui sidebar primitives, Tabler Icons

---

### Task 1: Create `lib/sidebar-nav-data.ts` — Extract Nav Structure With Groups

**Files:**
- Create: `lib/sidebar-nav-data.ts`

**Step 1: Create the nav data file with types and grouped sub-items**

```ts
// lib/sidebar-nav-data.ts
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
  group?: string          // Group separator label — rendered before this item
  badgeSeverity?: "info" | "warning" | "critical"
}

export type SidebarNavItem = {
  title: string
  url: string
  icon?: Icon
  locked?: boolean
  badge?: number
  accentColor?: string    // Tailwind bg color class for module dot
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

// Role-specific nav builders
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

// Workflow visibility checker
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

// Breadcrumb label map — maps URL segments to Bahasa Indonesia labels
export const breadcrumbLabels: Record<string, string> = {
  // Modules
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
  // Sub-pages
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
```

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit lib/sidebar-nav-data.ts 2>&1 | head -5`
Expected: No new errors (pre-existing errors are OK)

**Step 3: Commit**

```bash
git add lib/sidebar-nav-data.ts
git commit -m "refactor(sidebar): extract nav data, types, and helpers to lib/sidebar-nav-data.ts"
```

---

### Task 2: Create `hooks/use-filtered-nav.ts` — Role + Workflow Filtering

**Files:**
- Create: `hooks/use-filtered-nav.ts`

**Step 1: Create the hook**

```ts
// hooks/use-filtered-nav.ts
"use client"

import { useMemo } from "react"
import {
  type SidebarNavItem,
  navMain,
  navSecondary,
  getStaffNav,
  getAccountantNav,
  getManagerNav,
  isSectionVisible,
} from "@/lib/sidebar-nav-data"

interface AuthUser {
  role?: string
}

export function useFilteredNav(user: AuthUser | null, activeModules: string[] | null) {
  const filteredNavMain = useMemo(() => {
    let items: SidebarNavItem[]

    if (user?.role === "ROLE_STAFF") {
      items = getStaffNav()
    } else if (user?.role === "ROLE_ACCOUNTANT") {
      items = getAccountantNav()
    } else if (user?.role === "ROLE_MANAGER") {
      items = getManagerNav()
    } else {
      items = navMain
    }

    if (activeModules) {
      items = items.filter(item => isSectionVisible(item.title, activeModules))
    }

    return items
  }, [user?.role, activeModules])

  const filteredNavSecondary = useMemo(() => {
    const hideSecondary = user?.role === "ROLE_STAFF" || user?.role === "ROLE_ACCOUNTANT" || user?.role === "ROLE_MANAGER"
    return hideSecondary ? [] : navSecondary
  }, [user?.role])

  return { filteredNavMain, filteredNavSecondary }
}
```

**Step 2: Commit**

```bash
git add hooks/use-filtered-nav.ts
git commit -m "refactor(sidebar): create useFilteredNav hook for role + workflow filtering"
```

---

### Task 3: Create `hooks/use-inject-badges.ts` — Badge Injection With Severity

**Files:**
- Create: `hooks/use-inject-badges.ts`

**Step 1: Create the hook**

```ts
// hooks/use-inject-badges.ts
"use client"

import { useMemo } from "react"
import type { SidebarNavItem, SidebarSubItem } from "@/lib/sidebar-nav-data"
import type { SidebarActionCounts } from "@/hooks/use-sidebar-actions"

interface BadgeEntry {
  url: string
  count: number
  severity: "info" | "warning" | "critical"
}

export function useInjectBadges(
  items: SidebarNavItem[],
  actionCounts: SidebarActionCounts | null | undefined
): SidebarNavItem[] {
  return useMemo(() => {
    if (!actionCounts) return items

    const badges: BadgeEntry[] = [
      { url: "/procurement/vendors", count: actionCounts.vendorsIncomplete, severity: "info" },
      { url: "/inventory/products", count: actionCounts.productsIncomplete, severity: "info" },
      { url: "/sales/customers", count: actionCounts.customersIncomplete, severity: "info" },
      { url: "/inventory", count: actionCounts.lowStockProducts, severity: "critical" },
      { url: "/procurement/requests", count: actionCounts.pendingPurchaseRequests, severity: "warning" },
      { url: "/procurement/orders", count: actionCounts.pendingApprovals, severity: "warning" },
    ]

    const badgeMap = new Map<string, BadgeEntry>()
    for (const b of badges) {
      if (b.count > 0) badgeMap.set(b.url, b)
    }

    if (badgeMap.size === 0) return items

    return items.map(item => {
      const subItems = item.items?.map(sub => {
        const entry = badgeMap.get(sub.url)
        return entry
          ? { ...sub, badge: entry.count, badgeSeverity: entry.severity }
          : sub
      })
      const parentBadge = subItems?.reduce((sum, s) => sum + (s.badge || 0), 0) || badgeMap.get(item.url)?.count || 0
      return { ...item, items: subItems, badge: parentBadge }
    })
  }, [items, actionCounts])
}
```

**Step 2: Commit**

```bash
git add hooks/use-inject-badges.ts
git commit -m "refactor(sidebar): create useInjectBadges hook with severity colors"
```

---

### Task 4: Create `hooks/use-breadcrumbs.ts` — Breadcrumb Trail From URL

**Files:**
- Create: `hooks/use-breadcrumbs.ts`

**Step 1: Create the hook**

```ts
// hooks/use-breadcrumbs.ts
"use client"

import { useMemo } from "react"
import { usePathname } from "next/navigation"
import { breadcrumbLabels } from "@/lib/sidebar-nav-data"

export interface BreadcrumbItem {
  label: string
  href: string
  isCurrent: boolean
}

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname()

  return useMemo(() => {
    if (!pathname || pathname === "/") return []

    const segments = pathname.split("/").filter(Boolean)
    if (segments.length === 0) return []

    const crumbs: BreadcrumbItem[] = []

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]
      const href = "/" + segments.slice(0, i + 1).join("/")
      const isCurrent = i === segments.length - 1

      // Skip UUID-like segments — show "Detail" instead
      const isId = /^[0-9a-f]{8}-|^\d+$|^[a-z0-9]{20,}$/i.test(segment)
      const label = isId ? "Detail" : (breadcrumbLabels[segment] || segment)

      // Skip if same label as previous (e.g. /sales/sales)
      if (crumbs.length > 0 && crumbs[crumbs.length - 1].label === label) continue

      crumbs.push({ label, href, isCurrent })
    }

    return crumbs
  }, [pathname])
}
```

**Step 2: Commit**

```bash
git add hooks/use-breadcrumbs.ts
git commit -m "feat(header): create useBreadcrumbs hook for navigation trail"
```

---

### Task 5: Rewrite `components/app-sidebar.tsx` — Slim Composition Shell

**Files:**
- Modify: `components/app-sidebar.tsx` (full rewrite, currently 585 lines → ~80 lines)

**Step 1: Rewrite the component to compose the new hooks**

Replace entire file with:

```tsx
"use client"

import * as React from "react"
import { useAuth } from "@/lib/auth-context"
import { useWorkflowConfig } from "@/components/workflow/workflow-config-context"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { useSidebarActions } from "@/hooks/use-sidebar-actions"
import { useFilteredNav } from "@/hooks/use-filtered-nav"
import { useInjectBadges } from "@/hooks/use-inject-badges"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const { activeModules, tenantBranding } = useWorkflowConfig()
  const { data: actionCounts } = useSidebarActions()
  const { filteredNavMain, filteredNavSecondary } = useFilteredNav(user, activeModules)
  const navWithBadges = useInjectBadges(filteredNavMain, actionCounts)
  const isStaff = user?.role === "ROLE_STAFF"

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
                <div className="flex items-center justify-center h-7 w-7 bg-zinc-900 dark:bg-white shadow-sm">
                  <span className="text-[11px] font-black text-white dark:text-zinc-900 leading-none">
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
        <NavMain items={navWithBadges} />
        {!isStaff && filteredNavSecondary.length > 0 && (
          <NavSecondary items={filteredNavSecondary} className="mt-auto" />
        )}
      </SidebarContent>
      <SidebarFooter className="p-0">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
```

**Step 2: Verify TypeScript**

Run: `npx tsc --noEmit 2>&1 | grep app-sidebar`
Expected: No new errors

**Step 3: Commit**

```bash
git add components/app-sidebar.tsx
git commit -m "refactor(sidebar): slim down to ~80 lines composing extracted hooks"
```

---

### Task 6: Update `components/nav-main.tsx` — Group Separators, Accent Dots, Active Indicator, Badge Severity

**Files:**
- Modify: `components/nav-main.tsx` (244 lines)

**Step 1: Update the type import and props**

Replace the inline type definition (lines 33-47) with imported types:

```tsx
import type { SidebarNavItem } from "@/lib/sidebar-nav-data"

export function NavMain({ items }: { items: SidebarNavItem[] }) {
```

**Step 2: Add a group separator renderer**

Add this helper function inside NavMain, before the return:

```tsx
const GroupSeparator = ({ label }: { label: string }) => (
  <li className="px-3 pt-3 pb-1">
    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
      {label}
    </span>
  </li>
)
```

**Step 3: Add badge severity color helper**

```tsx
const getBadgeColor = (severity?: "info" | "warning" | "critical") => {
  switch (severity) {
    case "info": return "bg-amber-500"
    case "warning": return "bg-orange-500"
    case "critical": return "bg-red-500"
    default: return "bg-red-500"
  }
}
```

**Step 4: Update the expanded sub-item rendering (lines 177-213)**

In the CollapsibleContent section, replace the sub-item map with group-aware rendering:

```tsx
<CollapsibleContent>
  <SidebarMenuSub className="border-l-2 border-zinc-200 dark:border-zinc-700 ml-4 pl-2.5 mr-0 py-0.5">
    {item.items!.map((subItem) => {
      if (subItem.locked) {
        return (
          <React.Fragment key={subItem.title}>
            {subItem.group && <GroupSeparator label={subItem.group} />}
            <SidebarMenuSubItem>
              <SidebarMenuSubButton className="opacity-40 cursor-not-allowed pointer-events-none text-[12px] font-medium">
                <span>{subItem.title}</span>
                <IconLock className="ml-auto !size-3 text-zinc-400" />
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
          </React.Fragment>
        )
      }
      const isSubActive = pathname === subItem.url
      return (
        <React.Fragment key={subItem.title}>
          {subItem.group && <GroupSeparator label={subItem.group} />}
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              asChild
              className={
                isSubActive
                  ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white active:bg-zinc-800 active:text-white font-bold rounded-none text-[12px] border-l-2 border-black -ml-[2px] pl-[calc(0.5rem+2px)]"
                  : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-none text-[12px] font-medium"
              }
            >
              <Link href={subItem.url} prefetch onMouseEnter={() => prefetchRoute(subItem.url)} className="flex items-center w-full">
                <span>{subItem.title}</span>
                {subItem.badge && subItem.badge > 0 ? (
                  <span className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full ${getBadgeColor(subItem.badgeSeverity)} px-1 text-[9px] font-black text-white tabular-nums`}>
                    {subItem.badge > 99 ? "99+" : subItem.badge}
                  </span>
                ) : null}
              </Link>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
        </React.Fragment>
      )
    })}
  </SidebarMenuSub>
</CollapsibleContent>
```

**Step 5: Add accent color dot to parent module icons (in the CollapsibleTrigger button)**

In the SidebarMenuButton for collapsible items (around line 158-174), add the accent dot:

```tsx
<SidebarMenuButton
  tooltip={item.title}
  className={
    isActive
      ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white active:bg-zinc-800 active:text-white font-bold rounded-none"
      : "hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none font-medium"
  }
>
  <span className="relative">
    {item.icon && <item.icon className="!size-4" />}
    {item.accentColor && (
      <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${item.accentColor}`} />
    )}
  </span>
  <span className="text-[13px] tracking-tight">{item.title}</span>
  {/* ... badge and chevron unchanged */}
</SidebarMenuButton>
```

**Step 6: Apply same group separator + badge severity + accent dot to the collapsed popover rendering (lines 82-146)**

In the popover content sub-item map, add group separators before items that have `group`:

```tsx
{item.items!.map((subItem) => {
  if (subItem.locked) { /* unchanged */ }
  const isSubActive = pathname === subItem.url
  return (
    <React.Fragment key={subItem.title}>
      {subItem.group && (
        <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
          {subItem.group}
        </p>
      )}
      <button
        type="button"
        onClick={() => { setOpenPopover(null); router.push(subItem.url) }}
        onMouseEnter={() => prefetchRoute(subItem.url)}
        className={`flex w-full items-center px-3 py-1.5 text-[12px] font-medium transition-colors ${
          isSubActive
            ? "bg-zinc-900 text-white font-bold"
            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        }`}
      >
        <span>{subItem.title}</span>
        {subItem.badge && subItem.badge > 0 ? (
          <span className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full ${getBadgeColor(subItem.badgeSeverity)} px-1 text-[9px] font-black text-white tabular-nums`}>
            {subItem.badge > 99 ? "99+" : subItem.badge}
          </span>
        ) : null}
      </button>
    </React.Fragment>
  )
})}
```

**Step 7: Add accent dot to standalone items (no sub-items, around lines 221-238)**

Same pattern as collapsible items — wrap icon in relative span, add accent dot.

**Step 8: Commit**

```bash
git add components/nav-main.tsx
git commit -m "feat(sidebar): add group separators, accent dots, active indicator, badge severity"
```

---

### Task 7: Update `components/site-header.tsx` — Breadcrumbs + Fix Duplicate Trigger

**Files:**
- Modify: `components/site-header.tsx` (92 lines)

**Step 1: Replace the entire file**

```tsx
"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserNav } from "@/components/user-nav"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs"
import { useAuth } from "@/lib/auth-context"

export function SiteHeader() {
  const router = useRouter()
  const { user } = useAuth()
  const crumbs = useBreadcrumbs()
  const isStaff = user?.role === "ROLE_STAFF"

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm dark:bg-zinc-950/95 border-border/40 dark:border-zinc-800 shadow-sm z-30 relative">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="mr-2 text-foreground" />

        <Button variant="ghost" size="icon" className="mr-1 h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4 bg-zinc-200 dark:bg-zinc-800" />

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 min-w-0 overflow-hidden">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <span className="text-zinc-300 dark:text-zinc-600 text-xs shrink-0">/</span>
              )}
              {crumb.isCurrent ? (
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <UserNav />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
```

Key changes:
- Removed duplicate `<SidebarTrigger>` (was 2 in DOM, now 1)
- Removed `getPageTitle()` function (replaced by breadcrumbs)
- Removed Home button (breadcrumb first segment serves same purpose)
- Header height `h-16` → `h-14` (slightly tighter, more modern)
- Added breadcrumb trail with `/` separator
- Cleaned up unused imports

**Step 2: Commit**

```bash
git add components/site-header.tsx
git commit -m "feat(header): replace page title with clickable breadcrumbs, fix duplicate trigger"
```

---

### Task 8: Fix Mobile Sheet Sticky Header/Footer in `components/ui/sidebar.tsx`

**Files:**
- Modify: `components/ui/sidebar.tsx:183-205` (mobile sheet section)

**Step 1: Update the mobile sheet children wrapper**

Change line 202 from:
```tsx
<div className="flex h-full w-full flex-col">{children}</div>
```

To:
```tsx
<div className="flex h-full w-full flex-col overflow-hidden">
  {children}
</div>
```

Then find the `SidebarContent` component and ensure it has `overflow-y-auto flex-1`:

Find the SidebarContent component definition and verify it has:
```tsx
className={cn("flex min-h-0 flex-1 flex-col gap-2 overflow-auto", ...)}
```

This ensures the header and footer stay fixed while the middle content scrolls.

**Step 2: Commit**

```bash
git add components/ui/sidebar.tsx
git commit -m "fix(sidebar): sticky header/footer in mobile sheet"
```

---

### Task 9: Final Verification

**Step 1: TypeScript check**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No new errors (pre-existing ones OK)

**Step 2: Lint check**

Run: `npm run lint 2>&1 | tail -10`
Expected: No new lint errors

**Step 3: Dev server smoke test**

Run: `npm run dev` and verify in browser:
- Sidebar renders with accent dots on module icons
- Expanding Inventori/Keuangan/Manufaktur shows group separators
- Breadcrumbs appear in header with clickable segments
- Mobile view: sidebar header/footer stay sticky
- Collapsed sidebar popover shows group labels
- SDM uses IconId (not IconUsers)

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(sidebar): complete sidebar improvements — groups, breadcrumbs, code cleanup, visual polish"
```
