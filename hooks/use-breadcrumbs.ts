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
