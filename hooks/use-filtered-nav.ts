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
  filterNavByFeatureFlags,
} from "@/lib/sidebar-nav-data"
import { isModuleEnabled } from "@/lib/sidebar-feature-flags"

interface AuthUser {
  role?: string
}

export function useFilteredNav(user: AuthUser | null, activeModules: string[] | null) {
  const filteredNavMain = useMemo(() => {
    let items: SidebarNavItem[]

    // Role-based portals — also gated by MODULE_FLAGS so we can hide
    // staff/accountant/manager portals when not provisioned for the tenant.
    if (user?.role === "ROLE_STAFF" && isModuleEnabled("staffPortal")) {
      items = getStaffNav()
    } else if (user?.role === "ROLE_ACCOUNTANT" && isModuleEnabled("accountantPortal")) {
      items = getAccountantNav()
    } else if (user?.role === "ROLE_MANAGER" && isModuleEnabled("managerPortal")) {
      items = getManagerNav()
    } else {
      items = navMain
    }

    // Feature flag filter (integra.id mining edition: hide non-core modules)
    items = filterNavByFeatureFlags(items)

    // Tenant module access (existing system, layered after feature flag)
    if (activeModules) {
      items = items.filter(item => isSectionVisible(item.title, activeModules))
    }

    return items
  }, [user?.role, activeModules])

  const filteredNavSecondary = useMemo(() => {
    const hideSecondary = user?.role === "ROLE_STAFF" || user?.role === "ROLE_ACCOUNTANT" || user?.role === "ROLE_MANAGER"
    if (hideSecondary) return []
    return filterNavByFeatureFlags(navSecondary)
  }, [user?.role])

  return { filteredNavMain, filteredNavSecondary }
}
