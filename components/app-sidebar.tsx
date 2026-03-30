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

/** Isolated header — only re-renders when tenantBranding changes */
const SidebarBrand = React.memo(function SidebarBrand({ tenantName }: { tenantName: string }) {
  return (
    <SidebarHeader className="pb-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <Link
            href="/dashboard"
            data-slot="sidebar-menu-button"
            data-sidebar="menu-button"
            className="flex items-center gap-2.5 px-3 py-2.5 mx-2 rounded-md border-2 border-zinc-900 dark:border-zinc-200 bg-zinc-900 dark:bg-zinc-100 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] transition-all duration-100 group-data-[collapsible=icon]:mx-0 group-data-[collapsible=icon]:border-0 group-data-[collapsible=icon]:shadow-none"
          >
            <div className="flex items-center justify-center h-7 w-7 rounded-sm bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-600">
              <span className="text-[10px] font-black text-zinc-900 dark:text-zinc-100 leading-none tracking-tight">
                {tenantName ? tenantName.slice(0, 2).toUpperCase() : "EP"}
              </span>
            </div>
            <span className="text-[13px] font-black text-white dark:text-zinc-900 tracking-tight group-data-[collapsible=icon]:hidden">
              {tenantName || "Sistem ERP"}
            </span>
          </Link>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  )
})

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const { activeModules, tenantBranding } = useWorkflowConfig()
  const { data: actionCounts } = useSidebarActions()
  const { filteredNavMain, filteredNavSecondary } = useFilteredNav(user, activeModules)
  const navWithBadges = useInjectBadges(filteredNavMain, actionCounts)
  const isStaff = user?.role === "ROLE_STAFF"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarBrand tenantName={tenantBranding.tenantName || ""} />
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
