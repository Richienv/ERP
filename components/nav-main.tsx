"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { IconChevronRight, IconLock } from "@tabler/icons-react"
import { useNavPrefetch } from "@/hooks/use-nav-prefetch"
import type { SidebarNavItem } from "@/lib/sidebar-nav-data"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const { prefetchRoute } = useNavPrefetch()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const [openPopover, setOpenPopover] = useState<string | null>(null)

  // Match both exact and child routes (e.g. /inventory/products matches /inventory/products/123)
  const isPathActive = (url: string) => pathname === url || pathname.startsWith(url + "/")

  const getBadgeColor = (severity?: "info" | "warning" | "critical") => {
    switch (severity) {
      case "info": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      case "warning": return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      case "critical": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      default: return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5 px-2">
          {items.map((item) => {
            const isActive = isPathActive(item.url)
            const hasSubItems = item.items && item.items.length > 0

            if (hasSubItems) {
              if (item.locked) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <div className="flex items-center gap-2.5 px-3 py-2 opacity-35 cursor-not-allowed select-none">
                      {item.icon && <item.icon className="size-[18px]" />}
                      <span className="text-[13px]">{item.title}</span>
                      <IconLock className="ml-auto size-3.5" />
                    </div>
                  </SidebarMenuItem>
                )
              }

              // Collapsed: popover
              if (isCollapsed) {
                return (
                  <Popover key={item.title} open={openPopover === item.title} onOpenChange={(open) => setOpenPopover(open ? item.title : null)}>
                    <SidebarMenuItem>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          data-slot="sidebar-menu-button"
                          data-sidebar="menu-button"
                          data-size="default"
                          className={`flex w-full items-center gap-2.5 overflow-hidden p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-colors focus-visible:ring-2 h-9 group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 rounded-lg ${
                            isActive
                              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium"
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                          }`}
                        >
                          {item.icon && <item.icon className="size-[18px]" />}
                          <span className="text-[13px]">{item.title}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="w-52 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-lg"
                      >
                        <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{item.title}</p>
                        {item.items!.map((subItem) => {
                          if (subItem.locked) {
                            return (
                              <div key={subItem.title} className="flex items-center px-2.5 py-1.5 text-[12.5px] text-zinc-300 dark:text-zinc-600 cursor-not-allowed">
                                <span>{subItem.title}</span>
                                <IconLock className="ml-auto size-3" />
                              </div>
                            )
                          }
                          const isSubActive = isPathActive(subItem.url)
                          return (
                            <React.Fragment key={subItem.title}>
                              {subItem.group && (
                                <p className="px-2.5 pt-3 pb-1 text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                                  {subItem.group}
                                </p>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPopover(null)
                                  router.push(subItem.url)
                                }}
                                onMouseEnter={() => prefetchRoute(subItem.url)}
                                className={`flex w-full items-center px-2.5 py-1.5 text-[12.5px] rounded-md transition-all duration-150 ${
                                  isSubActive
                                    ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium"
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 active:bg-zinc-100 dark:active:bg-zinc-800"
                                }`}
                              >
                                <span>{subItem.title}</span>
                                {subItem.badge && subItem.badge > 0 ? (
                                  <span className={`ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${getBadgeColor(subItem.badgeSeverity)}`}>
                                    {subItem.badge > 99 ? "99+" : subItem.badge}
                                  </span>
                                ) : null}
                              </button>
                            </React.Fragment>
                          )
                        })}
                      </PopoverContent>
                    </SidebarMenuItem>
                  </Popover>
                )
              }

              // Expanded: collapsible
              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={isActive}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <button
                        type="button"
                        data-slot="sidebar-menu-button"
                        data-sidebar="menu-button"
                        className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left transition-all duration-150 outline-none ${
                          isActive
                            ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                            : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 active:bg-zinc-100 dark:active:bg-zinc-800 active:scale-[0.98]"
                        }`}
                      >
                        {item.icon && <item.icon className="size-[18px] shrink-0" />}
                        <span className={`text-[13px] ${isActive ? "font-medium" : ""}`}>{item.title}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className={`ml-auto mr-1 text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${getBadgeColor("critical")}`}>
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                        <IconChevronRight className={`size-3.5 shrink-0 text-zinc-400 dark:text-zinc-500 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 ${item.badge && item.badge > 0 ? "" : "ml-auto"}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="ml-[18px] pl-4 border-l border-zinc-200 dark:border-zinc-800 mt-1 mb-2">
                        {(() => {
                          let lastGroup: string | undefined
                          return item.items!.map((subItem) => {
                            const showGroupHeader = subItem.group && subItem.group !== lastGroup
                            const isFirstGroup = !lastGroup && subItem.group
                            if (subItem.group) lastGroup = subItem.group

                            if (subItem.locked) {
                              return (
                                <React.Fragment key={subItem.title}>
                                  {showGroupHeader && (
                                    <div className={`flex items-center gap-2 px-2.5 ${isFirstGroup ? "pt-1.5 pb-1.5" : "pt-4 pb-1.5"}`}>
                                      <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider whitespace-nowrap">{subItem.group}</span>
                                      {!isFirstGroup && <div className="flex-1 h-px bg-zinc-150 dark:bg-zinc-800" />}
                                    </div>
                                  )}
                                  <div className="flex items-center px-2.5 py-[7px] text-[12.5px] text-zinc-300 dark:text-zinc-600 cursor-not-allowed select-none">
                                    <span>{subItem.title}</span>
                                    <IconLock className="ml-auto size-3" />
                                  </div>
                                </React.Fragment>
                              )
                            }
                            const isSubActive = isPathActive(subItem.url)
                            return (
                              <React.Fragment key={subItem.title}>
                                {showGroupHeader && (
                                  <div className={`flex items-center gap-2 px-2.5 ${isFirstGroup ? "pt-1.5 pb-1.5" : "pt-4 pb-1.5"}`}>
                                    <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider whitespace-nowrap">{subItem.group}</span>
                                    {!isFirstGroup && <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-800" />}
                                  </div>
                                )}
                                <Link
                                  href={subItem.url}
                                  prefetch
                                  onMouseEnter={() => prefetchRoute(subItem.url)}
                                  className={`flex items-center px-2.5 py-[7px] rounded-md text-[12.5px] transition-all duration-150 ${
                                    isSubActive
                                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium shadow-sm"
                                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 active:bg-zinc-200 dark:active:bg-zinc-700 active:scale-[0.98]"
                                  }`}
                                >
                                  <span>{subItem.title}</span>
                                  {subItem.badge && subItem.badge > 0 ? (
                                    <span className={`ml-auto text-[10px] font-semibold tabular-nums px-1.5 py-0.5 rounded-md ${getBadgeColor(subItem.badgeSeverity)}`}>
                                      {subItem.badge > 99 ? "99+" : subItem.badge}
                                    </span>
                                  ) : null}
                                </Link>
                              </React.Fragment>
                            )
                          })
                        })()}
                      </div>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            // Simple item (no sub-items) like Dasbor
            return (
              <SidebarMenuItem key={item.title}>
                <Link
                  href={item.url}
                  prefetch
                  onMouseEnter={() => prefetchRoute(item.url)}
                  data-slot="sidebar-menu-button"
                  data-sidebar="menu-button"
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-150 outline-none group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:justify-center ${
                    isActive
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium shadow-sm"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 active:bg-zinc-100 dark:active:bg-zinc-800 active:scale-[0.98]"
                  }`}
                >
                  {item.icon && <item.icon className="size-[18px] shrink-0" />}
                  <span className="text-[13px] group-data-[collapsible=icon]:hidden">{item.title}</span>
                </Link>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
