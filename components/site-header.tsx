"use client"

import { ModeToggle } from "@/components/mode-toggle"
import { usePathname, useRouter } from "next/navigation"
import Link from "next/link"
import { Separator } from "@/components/ui/separator"
import { Home, ArrowLeft } from "lucide-react"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserNav } from "@/components/user-nav"
import { Button } from "@/components/ui/button"

// Define page titles based on routes
const getPageTitle = (pathname: string): string => {
  if (pathname === "/dashboard") return "Dasbor"
  if (pathname.startsWith("/inventory")) {
    if (pathname === "/inventory") return "Dashboard Inventori"
    if (pathname === "/inventory/products") return "Kelola Produk"
    if (pathname === "/inventory/products/new") return "Tambah Produk Baru"
    if (pathname === "/inventory/stock") return "Level Stok"
    if (pathname === "/inventory/adjustments") return "Penyesuaian Stok"
    if (pathname === "/inventory/warehouses") return "Kelola Gudang"
    if (pathname.includes("/inventory/products/")) return "Detail Produk"
    return "Inventori"
  }
  if (pathname.startsWith("/sales")) return "Penjualan & CRM"
  if (pathname.startsWith("/procurement")) return "Pengadaan"
  if (pathname.startsWith("/finance")) {
    if (pathname === "/finance/chart-accounts") return "Chart of Accounts"
    return "Keuangan"
  }
  if (pathname.startsWith("/manufacturing")) return "Manufaktur"
  if (pathname.startsWith("/hcm")) {
    if (pathname === "/hcm/employee-master") return "Data Karyawan"
    if (pathname === "/hcm/payroll") return "Penggajian"
    if (pathname === "/hcm/attendance") return "Absensi"
    return "SDM"
  }
  if (pathname.startsWith("/analytics")) return "Analitik"
  if (pathname.startsWith("/operations")) return "Operasional"
  if (pathname.startsWith("/compliance")) return "Kepatuhan"
  if (pathname.startsWith("/settings")) return "Pengaturan"
  if (pathname.startsWith("/help")) return "Bantuan & Dukungan"

  return "Sistem ERP"
}

import { useAuth } from "@/lib/auth-context"

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const pageTitle = getPageTitle(pathname)
  const { user, homePath } = useAuth()
  const isStaff = user?.role === "ROLE_STAFF"

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b bg-background dark:bg-zinc-950 relative z-40 border-border/40 dark:border-zinc-800">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="mr-2 text-foreground md:hidden" />
        <SidebarTrigger className="mr-2 text-foreground hidden md:flex" />

        <Button variant="ghost" size="icon" className="mr-2 h-8 w-8" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {!isStaff && (
          <>
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Link
              href={homePath}
              className="p-2 -ml-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors text-zinc-500 hover:text-foreground dark:text-zinc-400 dark:hover:text-white"
            >
              <Home className="h-5 w-5" />
            </Link>
          </>
        )}

        <Separator
          orientation="vertical"
          className="mx-2 h-4 bg-zinc-200 dark:bg-zinc-800"
        />
        <h1 className="text-base font-medium text-zinc-800 dark:text-zinc-200 font-serif tracking-tight">{pageTitle}</h1>

        <div className="ml-auto flex items-center gap-2">
          <UserNav />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
