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

/* ── Accent color mapping ──────────────────────────────── */
const accentMap: Record<string, { bg: string; text: string; border: string; borderLight: string; light: string; dot: string }> = {
  "bg-blue-500":   { bg: "bg-blue-500",   text: "text-blue-600 dark:text-blue-400",   border: "border-blue-500",   borderLight: "border-blue-200 dark:border-blue-800",   light: "bg-blue-50 dark:bg-blue-950/40",   dot: "bg-blue-400" },
  "bg-green-500":  { bg: "bg-green-500",  text: "text-green-600 dark:text-green-400",  border: "border-green-500",  borderLight: "border-green-200 dark:border-green-800",  light: "bg-green-50 dark:bg-green-950/40",  dot: "bg-green-400" },
  "bg-orange-500": { bg: "bg-orange-500", text: "text-orange-600 dark:text-orange-400", border: "border-orange-500", borderLight: "border-orange-200 dark:border-orange-800", light: "bg-orange-50 dark:bg-orange-950/40", dot: "bg-orange-400" },
  "bg-purple-500": { bg: "bg-purple-500", text: "text-purple-600 dark:text-purple-400", border: "border-purple-500", borderLight: "border-purple-200 dark:border-purple-800", light: "bg-purple-50 dark:bg-purple-950/40", dot: "bg-purple-400" },
  "bg-slate-500":  { bg: "bg-slate-500",  text: "text-slate-600 dark:text-slate-400",  border: "border-slate-500",  borderLight: "border-slate-200 dark:border-slate-700",  light: "bg-slate-50 dark:bg-slate-900/40",  dot: "bg-slate-400" },
  "bg-amber-700":  { bg: "bg-amber-600",  text: "text-amber-700 dark:text-amber-400",  border: "border-amber-600",  borderLight: "border-amber-200 dark:border-amber-800",  light: "bg-amber-50 dark:bg-amber-950/40",  dot: "bg-amber-400" },
  "bg-zinc-400":   { bg: "bg-zinc-400",   text: "text-zinc-500 dark:text-zinc-400",   border: "border-zinc-400",   borderLight: "border-zinc-200 dark:border-zinc-700",   light: "bg-zinc-50 dark:bg-zinc-800/40",   dot: "bg-zinc-400" },
}
const defaultAccent = { bg: "bg-zinc-800", text: "text-zinc-600", border: "border-zinc-800", borderLight: "border-zinc-200 dark:border-zinc-700", light: "bg-zinc-50", dot: "bg-zinc-400" }

function getAccent(accentColor?: string) {
  return accentColor ? (accentMap[accentColor] || defaultAccent) : defaultAccent
}

export function NavMain({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname()
  const router = useRouter()
  const { prefetchRoute } = useNavPrefetch()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const [openPopover, setOpenPopover] = useState<string | null>(null)

  const isPathActive = (url: string) => pathname === url || pathname.startsWith(url + "/")

  const getBadgeColor = (severity?: "info" | "warning" | "critical") => {
    switch (severity) {
      case "info": return "bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700"
      case "warning": return "bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700"
      case "critical": return "bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
      default: return "bg-red-100 text-red-800 border border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700"
    }
  }

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1 px-2">
          {items.map((item) => {
            const isActive = isPathActive(item.url)
            const hasSubItems = item.items && item.items.length > 0
            const accent = getAccent(item.accentColor)

            if (hasSubItems) {
              if (item.locked) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <div className="flex items-center gap-2.5 px-3 py-2 opacity-30 cursor-not-allowed select-none">
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
                          className={`relative flex w-full items-center gap-2.5 overflow-hidden p-2 text-left text-sm outline-hidden ring-sidebar-ring transition-all focus-visible:ring-2 h-9 group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2! [&>span:last-child]:truncate [&>svg]:size-4 [&>svg]:shrink-0 rounded-md border ${
                            isActive
                              ? `${accent.light} ${accent.text} font-bold border-current`
                              : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
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
                        className="w-56 p-1.5 rounded-md border-2 border-black dark:border-zinc-600 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] dark:shadow-[3px_3px_0px_0px_rgba(255,255,255,0.1)]"
                      >
                        <div className={`flex items-center gap-2 px-2.5 py-2 mb-1 rounded-sm ${accent.light}`}>
                          <div className={`size-2 rounded-full ${accent.bg}`} />
                          <p className={`text-[11px] font-bold uppercase tracking-wider ${accent.text}`}>{item.title}</p>
                        </div>
                        {item.items!.map((subItem) => {
                          if (subItem.locked) {
                            return (
                              <div key={subItem.title} className="flex items-center gap-2 px-2.5 py-1.5 text-[12.5px] text-zinc-300 dark:text-zinc-600 cursor-not-allowed">
                                {subItem.icon && <subItem.icon className="size-3.5 shrink-0" />}
                                <span>{subItem.title}</span>
                                <IconLock className="ml-auto size-3" />
                              </div>
                            )
                          }
                          const isSubActive = isPathActive(subItem.url)
                          return (
                            <React.Fragment key={subItem.title}>
                              {subItem.group && (
                                <div className="flex items-center gap-2 px-2.5 pt-3 pb-1">
                                  <div className={`size-1.5 rounded-full ${accent.dot}`} />
                                  <p className={`text-[10px] font-bold uppercase tracking-wider ${accent.text} opacity-70`}>
                                    {subItem.group}
                                  </p>
                                  <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenPopover(null)
                                  router.push(subItem.url)
                                }}
                                onMouseEnter={() => prefetchRoute(subItem.url)}
                                className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-[12.5px] rounded-r-sm transition-all duration-150 ease-out ${
                                  isSubActive
                                    ? `${accent.light} ${accent.text} font-semibold border-l-[3px] ${accent.border} pl-[7px]`
                                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 hover:translate-x-0.5 active:scale-[0.98] border-l-[3px] border-transparent"
                                }`}
                              >
                                {subItem.icon && <subItem.icon className="size-3.5 shrink-0 opacity-70" />}
                                <span>{subItem.title}</span>
                                {subItem.badge && subItem.badge > 0 ? (
                                  <span className={`ml-auto text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm ${getBadgeColor(subItem.badgeSeverity)}`}>
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

              // Expanded: collapsible with accent color strip
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
                        className={`relative flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-left transition-all duration-150 outline-none border ${
                          isActive
                            ? `${accent.light} ${accent.text} font-bold border-current`
                            : "text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-200 dark:hover:border-zinc-700 active:scale-[0.98]"
                        }`}
                      >
                        {/* Color indicator dot */}
                        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full ${accent.bg} transition-opacity ${isActive ? "opacity-100" : "opacity-0 group-hover/collapsible:opacity-40"}`} />
                        {item.icon && <item.icon className={`size-[18px] shrink-0 ${isActive ? accent.text : ""}`} />}
                        <span className="text-[13px]">{item.title}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className={`ml-auto mr-1 text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm ${getBadgeColor("critical")}`}>
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                        <IconChevronRight className={`size-3.5 shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 ${isActive ? accent.text + " opacity-60" : "text-zinc-400 dark:text-zinc-500"} ${item.badge && item.badge > 0 ? "" : "ml-auto"}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className={`ml-[18px] pl-3 border-l ${accent.borderLight} mt-1 mb-2 space-y-0.5`}>
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
                                      <div className={`size-1.5 rounded-full ${accent.dot}`} />
                                      <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${accent.text} opacity-70`}>{subItem.group}</span>
                                      {!isFirstGroup && <div className={`flex-1 h-px ${accent.bg} opacity-20`} />}
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 px-2.5 py-[7px] text-[12.5px] text-zinc-300 dark:text-zinc-600 cursor-not-allowed select-none">
                                    {subItem.icon && <subItem.icon className="size-3.5 shrink-0" />}
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
                                    <div className={`size-1.5 rounded-full ${accent.dot}`} />
                                    <span className={`text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${accent.text} opacity-70`}>{subItem.group}</span>
                                    {!isFirstGroup && <div className={`flex-1 h-px ${accent.bg} opacity-20`} />}
                                  </div>
                                )}
                                <Link
                                  href={subItem.url}
                                  prefetch
                                  onMouseEnter={() => prefetchRoute(subItem.url)}
                                  className={`relative flex items-center gap-2 px-2.5 py-[7px] rounded-r-sm text-[12.5px] transition-all duration-150 ease-out ${
                                    isSubActive
                                      ? `${accent.light} ${accent.text} font-semibold border-l-[3px] ${accent.border} pl-[7px]`
                                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 hover:translate-x-0.5 active:scale-[0.98] border-l-[3px] border-transparent"
                                  }`}
                                >
                                  {subItem.icon && <subItem.icon className={`size-3.5 shrink-0 transition-opacity duration-150 ${isSubActive ? "opacity-100" : "opacity-50 group-hover:opacity-70"}`} />}
                                  <span>{subItem.title}</span>
                                  {subItem.badge && subItem.badge > 0 ? (
                                    <span className={`ml-auto text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-sm ${getBadgeColor(subItem.badgeSeverity)}`}>
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
                  className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 transition-all duration-150 outline-none border group-data-[collapsible=icon]:size-9! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:justify-center ${
                    isActive
                      ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold border-zinc-900 dark:border-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.3)]"
                      : "text-zinc-600 dark:text-zinc-400 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200 hover:border-zinc-200 dark:hover:border-zinc-700 active:scale-[0.98]"
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
