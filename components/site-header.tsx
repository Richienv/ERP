"use client"

import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"

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

export function SiteHeader() {
  const pathname = usePathname()
  const pageTitle = getPageTitle(pathname)

  return (
    <header className="flex h-[--header-height] shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-[--header-height]">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{pageTitle}</h1>
      </div>
    </header>
  )
}
