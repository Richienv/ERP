"use client"

import * as React from "react"
import Link from "next/link"
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
      <SidebarHeader className="pb-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <Link
              href="/dashboard"
              data-slot="sidebar-menu-button"
              data-sidebar="menu-button"
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors"
            >
              <div className="flex items-center justify-center h-7 w-7 rounded-md bg-zinc-900 dark:bg-zinc-100">
                <span className="text-[10px] font-bold text-white dark:text-zinc-900 leading-none">
                  {tenantBranding.tenantName ? tenantBranding.tenantName.slice(0, 2).toUpperCase() : "EP"}
                </span>
              </div>
              <span className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 group-data-[collapsible=icon]:hidden">
                {tenantBranding.tenantName || "Sistem ERP"}
              </span>
            </Link>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent className="pt-1">
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
