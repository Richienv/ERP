"use client"

import { useState } from "react"
import Link from "next/link"
import {
  IconBell,
  IconAlertTriangle,
  IconPackage,
  IconUsers,
  IconShoppingCart,
  IconChecklist,
} from "@tabler/icons-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useSidebarActions } from "@/hooks/use-sidebar-actions"

interface NotificationItem {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  href: string
  severity: "info" | "warning" | "critical"
  count: number
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const { data: counts } = useSidebarActions()

  const notifications: NotificationItem[] = []

  if (counts) {
    if (counts.lowStockProducts > 0) {
      notifications.push({
        id: "low-stock",
        icon: <IconAlertTriangle className="w-4 h-4 text-red-500" />,
        title: "Stok Rendah",
        description: `${counts.lowStockProducts} produk di bawah minimum`,
        href: "/inventory/alerts",
        severity: "critical",
        count: counts.lowStockProducts,
      })
    }
    if (counts.pendingApprovals > 0) {
      notifications.push({
        id: "pending-approvals",
        icon: <IconChecklist className="w-4 h-4 text-orange-500" />,
        title: "Menunggu Approval",
        description: `${counts.pendingApprovals} PO perlu disetujui`,
        href: "/procurement/orders",
        severity: "warning",
        count: counts.pendingApprovals,
      })
    }
    if (counts.pendingPurchaseRequests > 0) {
      notifications.push({
        id: "pending-pr",
        icon: <IconShoppingCart className="w-4 h-4 text-orange-500" />,
        title: "Purchase Request",
        description: `${counts.pendingPurchaseRequests} PR menunggu tindakan`,
        href: "/procurement/requests",
        severity: "warning",
        count: counts.pendingPurchaseRequests,
      })
    }
    if (counts.vendorsIncomplete > 0) {
      notifications.push({
        id: "vendors-incomplete",
        icon: <IconUsers className="w-4 h-4 text-amber-500" />,
        title: "Data Vendor Belum Lengkap",
        description: `${counts.vendorsIncomplete} vendor perlu dilengkapi`,
        href: "/procurement/vendors",
        severity: "info",
        count: counts.vendorsIncomplete,
      })
    }
    if (counts.productsIncomplete > 0) {
      notifications.push({
        id: "products-incomplete",
        icon: <IconPackage className="w-4 h-4 text-amber-500" />,
        title: "Data Produk Belum Lengkap",
        description: `${counts.productsIncomplete} produk perlu dilengkapi`,
        href: "/inventory/products",
        severity: "info",
        count: counts.productsIncomplete,
      })
    }
    if (counts.customersIncomplete > 0) {
      notifications.push({
        id: "customers-incomplete",
        icon: <IconUsers className="w-4 h-4 text-amber-500" />,
        title: "Data Pelanggan Belum Lengkap",
        description: `${counts.customersIncomplete} pelanggan perlu dilengkapi`,
        href: "/sales/customers",
        severity: "info",
        count: counts.customersIncomplete,
      })
    }
  }

  const totalCount = notifications.reduce((sum, n) => sum + n.count, 0)
  const hasCritical = notifications.some((n) => n.severity === "critical")

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`${totalCount} notifikasi`}
        >
          <IconBell className="w-5 h-5" />
          {totalCount > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white tabular-nums ${
                hasCritical ? "bg-red-500" : "bg-orange-500"
              }`}
            >
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-80 p-0 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      >
        <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-sm font-bold">Notifikasi</h3>
          {totalCount > 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">{totalCount} item perlu perhatian</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Semua beres!</p>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <IconBell className="w-8 h-8 text-zinc-200 dark:text-zinc-700 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Tidak ada notifikasi</p>
            </div>
          ) : (
            notifications.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-start gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${
                  item.severity === "critical" ? "bg-red-50/50 dark:bg-red-950/20" : ""
                }`}
              >
                <div className="mt-0.5 shrink-0">{item.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
                <span className={`shrink-0 flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold text-white tabular-nums ${
                  item.severity === "critical"
                    ? "bg-red-500"
                    : item.severity === "warning"
                    ? "bg-orange-500"
                    : "bg-amber-500"
                }`}>
                  {item.count}
                </span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
