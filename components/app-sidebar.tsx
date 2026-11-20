"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { useWorkflowConfig } from "@/components/workflow/workflow-config-context"
import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { IntegraLogo } from "@/components/brand/integra-logo"
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
  useSidebar,
} from "@/components/ui/sidebar"

/** Isolated header — only re-renders when tenantBranding changes.
 *  Same height as the site header (h-14) so both bottom borders line up. */
const SidebarBrand = React.memo(function SidebarBrand({ tenantName }: { tenantName: string }) {
  return (
    <SidebarHeader className="h-14 shrink-0 justify-center border-b border-sidebar-border px-2 py-0">
      <SidebarMenu>
        <SidebarMenuItem>
          <Link
            href="/dashboard"
            data-slot="sidebar-menu-button"
            data-sidebar="menu-button"
            title="Ke Dasbor"
            className="flex min-w-0 items-center rounded-md px-2 py-1.5 outline-none transition-colors hover:bg-sidebar-accent/60 focus-visible:ring-2 focus-visible:ring-sidebar-ring group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <IntegraLogo
              tone="sidebar"
              caption="ERP"
              subtitle={tenantName || undefined}
              textClassName="group-data-[collapsible=icon]:hidden"
            />
            <span className="sr-only">, ke Dasbor</span>
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

  // On a phone the menu is a sheet over the page. Close it once a new page opens, so people
  // land on the screen they picked instead of tapping "close" every time (one tap less).
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  React.useEffect(() => {
    if (isMobile) setOpenMobile(false)
  }, [pathname, isMobile, setOpenMobile])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarBrand tenantName={tenantBranding.tenantName || ""} />
      <SidebarContent className="pt-1 [scrollbar-color:var(--sidebar-border)_transparent] [scrollbar-width:thin]">
        <NavMain items={navWithBadges} />
        {!isStaff && filteredNavSecondary.length > 0 && (
          <NavSecondary items={filteredNavSecondary} className="mt-auto" />
        )}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  )
}
