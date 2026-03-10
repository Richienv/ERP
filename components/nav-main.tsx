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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"

export function NavMain({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const { prefetchRoute } = useNavPrefetch()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const [openPopover, setOpenPopover] = useState<string | null>(null)

  const GroupSeparator = ({ label }: { label: string }) => (
    <li className="px-3 pt-4 pb-1.5">
      <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-[0.15em]">
        {label}
      </span>
    </li>
  )

  const getBadgeColor = (severity?: "info" | "warning" | "critical") => {
    switch (severity) {
      case "info": return "bg-amber-500"
      case "warning": return "bg-orange-500"
      case "critical": return "bg-red-500"
      default: return "bg-red-500"
    }
  }

  const AccentIcon = ({ item }: { item: SidebarNavItem }) => (
    <span className="relative inline-flex">
      {item.icon && <item.icon className="!size-[18px]" />}
      {item.accentColor && (
        <span className={`absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full ${item.accentColor}`} />
      )}
    </span>
  )

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-1">
        <SidebarMenu>
          {items.map((item) => {
            const isActive = pathname === item.url || pathname.startsWith(item.url + "/")
            const hasSubItems = item.items && item.items.length > 0

            if (hasSubItems) {
              if (item.locked) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={`${item.title} (Locked)`}
                      disabled
                      className="opacity-40 cursor-not-allowed pointer-events-none"
                    >
                      <AccentIcon item={item} />
                      <span className="text-[13.5px] font-medium tracking-tight">{item.title}</span>
                      <IconLock className="ml-auto !size-3.5 text-zinc-400" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              }

              // When sidebar is collapsed, use Popover to show sub-items as floating menu
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
                          className={`flex w-full items-center gap-2 overflow-hidden rounded-md p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-[width,height,padding] focus-visible:ring-2 active:bg-sidebar-accent active:text-sidebar-accent-foreground disabled:pointer-events-none disabled:opacity-50 group-has-data-[sidebar=menu-action]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:bg-sidebar-accent data-[active=true]:font-medium data-[active=true]:text-sidebar-accent-foreground data-[state=open]:hover:bg-sidebar-accent data-[state=open]:hover:text-sidebar-accent-foreground h-9 text-sm group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 ${
                            isActive
                              ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white active:bg-zinc-800 active:text-white font-bold rounded-none"
                              : "hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none font-medium"
                          }`}
                        >
                          <AccentIcon item={item} />
                          <span className="text-[13.5px] tracking-tight">{item.title}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        align="start"
                        sideOffset={8}
                        className="w-56 p-1 rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        <p className="px-3 py-2 text-[11px] font-black uppercase tracking-wider text-zinc-400">{item.title}</p>
                        {item.items!.map((subItem) => {
                          if (subItem.locked) {
                            return (
                              <div key={subItem.title} className="flex items-center px-3 py-2 text-[12.5px] text-zinc-400 cursor-not-allowed">
                                <span>{subItem.title}</span>
                                <IconLock className="ml-auto !size-3" />
                              </div>
                            )
                          }
                          const isSubActive = pathname === subItem.url
                          return (
                            <React.Fragment key={subItem.title}>
                              {subItem.group && (
                                <p className="px-3 pt-2 pb-0.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
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
                                className={`flex w-full items-center px-3 py-2 text-[12.5px] font-medium transition-colors ${
                                  isSubActive
                                    ? "bg-zinc-900 text-white font-bold"
                                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                                }`}
                              >
                                <span>{subItem.title}</span>
                                {subItem.badge && subItem.badge > 0 ? (
                                  <span className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full ${getBadgeColor(subItem.badgeSeverity)} px-1 text-[9px] font-black text-white tabular-nums`}>
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

              return (
                <Collapsible
                  key={item.title}
                  asChild
                  defaultOpen={isActive}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        tooltip={item.title}
                        className={
                          isActive
                            ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white active:bg-zinc-800 active:text-white font-bold rounded-none"
                            : "hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none font-medium"
                        }
                      >
                        <AccentIcon item={item} />
                        <span className="text-[13.5px] tracking-tight">{item.title}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className="ml-auto mr-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white tabular-nums">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                        <IconChevronRight className={`!size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 ${item.badge && item.badge > 0 ? "" : "ml-auto"}`} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="border-l border-zinc-200 dark:border-zinc-700 ml-4 pl-3 mr-0 py-1.5">
                        {item.items!.map((subItem) => {
                          if (subItem.locked) {
                            return (
                              <React.Fragment key={subItem.title}>
                                {subItem.group && <GroupSeparator label={subItem.group} />}
                                <SidebarMenuSubItem>
                                  <SidebarMenuSubButton
                                    className="opacity-40 cursor-not-allowed pointer-events-none text-[12.5px] font-medium"
                                  >
                                    <span>{subItem.title}</span>
                                    <IconLock className="ml-auto !size-3 text-zinc-400" />
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              </React.Fragment>
                            )
                          }
                          const isSubActive = pathname === subItem.url
                          return (
                            <React.Fragment key={subItem.title}>
                              {subItem.group && <GroupSeparator label={subItem.group} />}
                              <SidebarMenuSubItem>
                                <SidebarMenuSubButton
                                  asChild
                                  className={
                                    isSubActive
                                      ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white active:bg-zinc-800 active:text-white font-bold rounded-none text-[12.5px] border-l-2 border-black -ml-[2px] pl-[calc(0.5rem+2px)]"
                                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-none text-[12.5px] font-medium"
                                  }
                                >
                                  <Link href={subItem.url} prefetch onMouseEnter={() => prefetchRoute(subItem.url)} className="flex items-center w-full">
                                    <span>{subItem.title}</span>
                                    {subItem.badge && subItem.badge > 0 ? (
                                      <span className={`ml-auto flex h-4 min-w-4 items-center justify-center rounded-full ${getBadgeColor(subItem.badgeSeverity)} px-1 text-[9px] font-black text-white tabular-nums`}>
                                        {subItem.badge > 99 ? "99+" : subItem.badge}
                                      </span>
                                    ) : null}
                                  </Link>
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            </React.Fragment>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            }

            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  tooltip={item.title}
                  asChild
                  className={
                    isActive
                      ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white active:bg-zinc-800 active:text-white font-bold rounded-none"
                      : "hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-none font-medium"
                  }
                >
                  <Link href={item.url} prefetch onMouseEnter={() => prefetchRoute(item.url)}>
                    <AccentIcon item={item} />
                    <span className="text-[13.5px] tracking-tight">{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
