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
