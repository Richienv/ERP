"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useNavPrefetch } from "@/hooks/use-nav-prefetch"
import type { SidebarNavItem } from "@/lib/sidebar-nav-data"
import { cn } from "@/lib/utils"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: SidebarNavItem[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()
  const { prefetchRoute } = useNavPrefetch()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <div className="mx-3.5 mb-1 flex items-center gap-2 group-data-[collapsible=icon]:hidden">
          <span className="text-xs font-semibold text-sidebar-foreground/65">Sistem</span>
          <span aria-hidden className="h-px flex-1 bg-sidebar-border" />
        </div>
        <SidebarMenu className="gap-0.5 px-1 group-data-[collapsible=icon]:px-0">
          {items.map((item) => {
            const isActive = pathname === item.url
            return (
              <SidebarMenuItem key={item.title}>
                <Link
                  href={item.url}
                  prefetch
                  onPointerDown={() => prefetchRoute(item.url)}
                  onMouseEnter={() => prefetchRoute(item.url)}
                  data-slot="sidebar-menu-button"
                  data-sidebar="menu-button"
                  aria-current={isActive ? "page" : undefined}
                  title={isCollapsed ? item.title : undefined}
                  className={cn(
                    "relative flex h-9 w-full items-center gap-3 rounded-md px-3 text-[14px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                    "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center",
                    isActive
                      ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  {isActive && (
                    <span aria-hidden className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full bg-sidebar-primary" />
                  )}
                  {item.icon ? (
                    <item.icon className={cn("size-[18px] shrink-0", isActive ? "text-sidebar-primary" : "opacity-80")} />
                  ) : null}
                  <span className="group-data-[collapsible=icon]:sr-only">{item.title}</span>
                </Link>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
