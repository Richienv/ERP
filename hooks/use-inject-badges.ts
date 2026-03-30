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
      const subItems = item.items?.map((sub: SidebarSubItem) => {
        const entry = badgeMap.get(sub.url)
        return entry
          ? { ...sub, badge: entry.count, badgeSeverity: entry.severity as SidebarSubItem["badgeSeverity"] }
          : sub
      })
      const parentBadge = subItems?.reduce((sum: number, s: SidebarSubItem) => sum + (s.badge || 0), 0) || badgeMap.get(item.url)?.count || 0
      return { ...item, ...(subItems ? { items: subItems } : {}), badge: parentBadge }
    })
  }, [items, actionCounts])
}
