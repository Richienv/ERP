"use client"

import * as React from "react"
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
  SidebarMenuButton,
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
      <SidebarHeader className="border-b-2 border-zinc-200 dark:border-zinc-800 pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-2 rounded-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <a href="/dashboard">
                <div className="flex items-center justify-center h-8 w-8 bg-black dark:bg-white">
                  <span className="text-[11px] font-black text-emerald-400 dark:text-zinc-900 leading-none tracking-tight">
                    {tenantBranding.tenantName ? tenantBranding.tenantName.slice(0, 2).toUpperCase() : "EP"}
                  </span>
                </div>
                <span className="text-sm font-black uppercase tracking-tight">
                  {tenantBranding.tenantName || "Sistem ERP"}
                </span>
              </a>
            </SidebarMenuButton>
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
