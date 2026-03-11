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
  IconFlagFilled,
  IconCheck,
  IconEye,
} from "@tabler/icons-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useSidebarActions } from "@/hooks/use-sidebar-actions"
import { useCeoFlags, usePendingFlagCount, useMarkFlagRead, useMarkFlagActed } from "@/hooks/use-ceo-flags"

interface NotificationItem {
  id: string
  icon: React.ReactNode
  title: string
  description: string
  href: string
  severity: "info" | "warning" | "critical"
  count: number
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "baru saja"
  if (mins < 60) return `${mins}m lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}j lalu`
  const days = Math.floor(hours / 24)
  return `${days}h lalu`
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"tugas" | "flags">("tugas")
  const { data: counts } = useSidebarActions()
  const { data: flagsData } = useCeoFlags({ limit: 15 })
  const { data: pendingFlagCount } = usePendingFlagCount()
  const markRead = useMarkFlagRead()
  const markActed = useMarkFlagActed()

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
  const flagCount = pendingFlagCount ?? 0
  const combinedCount = totalCount + flagCount
  const hasCritical = notifications.some((n) => n.severity === "critical")

  // Filter flags to only show PENDING or READ
  const activeFlags = ((flagsData as any[]) ?? []).filter(
    (f: any) => f.status === "PENDING" || f.status === "READ"
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={`${combinedCount} notifikasi`}
        >
          <IconBell className="w-5 h-5" />
          {combinedCount > 0 && (
            <span
              className={`absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-black text-white tabular-nums ${
                hasCritical ? "bg-red-500" : "bg-orange-500"
              }`}
            >
              {combinedCount > 99 ? "99+" : combinedCount}
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
          {combinedCount > 0 ? (
            <p className="text-xs text-muted-foreground mt-0.5">{combinedCount} item perlu perhatian</p>
          ) : (
            <p className="text-xs text-muted-foreground mt-0.5">Semua beres!</p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("tugas")}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === "tugas"
                ? "border-b-2 border-black dark:border-white font-black text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Tugas {totalCount > 0 && <span className="ml-1 text-[9px] bg-zinc-200 dark:bg-zinc-700 px-1.5 py-0.5 rounded-full tabular-nums">{totalCount}</span>}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("flags")}
            className={`flex-1 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
              activeTab === "flags"
                ? "border-b-2 border-black dark:border-white font-black text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 hover:text-zinc-600"
            }`}
          >
            Flag CEO {flagCount > 0 && <span className="ml-1 text-[9px] bg-orange-100 dark:bg-orange-900/30 text-orange-600 px-1.5 py-0.5 rounded-full tabular-nums">{flagCount}</span>}
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto">
          {activeTab === "tugas" ? (
            /* Tugas tab — existing notifications */
            notifications.length === 0 ? (
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
            )
          ) : (
            /* Flag CEO tab */
            activeFlags.length === 0 ? (
              <div className="py-8 text-center">
                <IconFlagFilled className="w-8 h-8 text-zinc-200 dark:text-zinc-700 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Tidak ada flag dari CEO</p>
              </div>
            ) : (
              activeFlags.map((flag: any) => (
                <div
                  key={flag.id}
                  className={`px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0 ${
                    flag.status === "PENDING" ? "bg-orange-50/50 dark:bg-orange-950/10" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <IconFlagFilled className="w-3.5 h-3.5 text-orange-500 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-bold text-zinc-900 dark:text-zinc-100 truncate">
                        {flag.title}
                      </p>
                      {flag.note && (
                        <p className="text-[11px] italic text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                          &ldquo;{flag.note}&rdquo;
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-zinc-400 truncate">{flag.sourceLabel}</span>
                        <span className="text-[10px] text-zinc-300">·</span>
                        <span className="text-[10px] text-zinc-400">{timeAgo(flag.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 ml-6">
                    {flag.status === "PENDING" && (
                      <button
                        type="button"
                        onClick={() => markRead.mutate(flag.id)}
                        disabled={markRead.isPending}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <IconEye className="w-3 h-3" />
                        Dibaca
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => markActed.mutate(flag.id)}
                      disabled={markActed.isPending}
                      className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold text-emerald-600 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
                    >
                      <IconCheck className="w-3 h-3" />
                      Selesai
                    </button>
                  </div>
                </div>
              ))
            )
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
