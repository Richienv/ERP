"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconChevronRight, IconLock } from "@tabler/icons-react"
import { useNavPrefetch } from "@/hooks/use-nav-prefetch"
import type { SidebarNavItem, SidebarSubItem } from "@/lib/sidebar-nav-data"
import { cn } from "@/lib/utils"

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

/*
 * Navy shell (SAP-like). Every colour comes from the --sidebar* tokens.
 * Active page = lighter navy fill + a left bar in --sidebar-primary.
 */
const TOP_ITEM =
  "relative flex w-full items-center gap-3 rounded-md px-3 h-10 text-left text-[15px] leading-tight outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring"
const TOP_IDLE =
  "font-medium text-sidebar-foreground/90 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
const TOP_ACTIVE = "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
/** Icon-only sidebar: a 34 px square centred in the 3rem rail. */
const TOP_COLLAPSED =
  "group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0! group-data-[collapsible=icon]:justify-center"

const SUB_ITEM =
  "relative flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[14px] leading-snug outline-none transition-colors focus-visible:ring-2 focus-visible:ring-sidebar-ring"
const SUB_IDLE =
  "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
const SUB_ACTIVE = "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"

/** Light popover used by the icon-only sidebar. */
const POP_ITEM =
  "relative flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
const POP_IDLE = "text-foreground/85 hover:bg-muted hover:text-foreground"
const POP_ACTIVE = "bg-accent font-semibold text-accent-foreground"

/* Badge colours stay legible on navy and on the white popover. */
const BADGE: Record<NonNullable<SidebarSubItem["badgeSeverity"]>, { className: string; hint: string }> = {
  info: { className: "bg-slate-200 text-slate-900", hint: "Data belum lengkap" },
  warning: { className: "bg-amber-300 text-amber-950", hint: "Menunggu tindakan" },
  critical: { className: "bg-red-600 text-white", hint: "Perlu perhatian" },
}

function NavBadge({ count, severity = "critical", className }: {
  count: number
  severity?: SidebarSubItem["badgeSeverity"]
  className?: string
}) {
  const style = BADGE[severity ?? "critical"]
  return (
    <span
      title={`${count} · ${style.hint}`}
      className={cn(
        "inline-flex h-5 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums leading-none",
        style.className,
        className,
      )}
    >
      {count > 99 ? "99+" : count}
    </span>
  )
}

function ActiveBar({ className, tone = "sidebar" }: { className?: string; tone?: "sidebar" | "popover" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r-full",
        tone === "sidebar" ? "bg-sidebar-primary" : "bg-primary",
        className,
      )}
    />
  )
}

function GroupLabel({ label, first, tone = "sidebar" }: { label: string; first: boolean; tone?: "sidebar" | "popover" }) {
  return (
    <div className={cn("flex items-center gap-2 px-2.5 pb-1", first ? "pt-1.5" : "pt-3.5")}>
      <span
        className={cn(
          "whitespace-nowrap text-xs font-semibold",
          tone === "sidebar" ? "text-sidebar-foreground/65" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
      <span aria-hidden className={cn("h-px flex-1", tone === "sidebar" ? "bg-sidebar-border" : "bg-border")} />
    </div>
  )
}

export function NavMain({ items }: { items: SidebarNavItem[] }) {
  const pathname = usePathname()
  const { prefetchRoute } = useNavPrefetch()
  const { state } = useSidebar()
  const isCollapsed = state === "collapsed"
  const [openPopover, setOpenPopover] = useState<string | null>(null)

  const isPathActive = (url: string) => pathname === url || pathname.startsWith(url + "/")
  // Among sibling sub-items only the most specific match is active ("/procurement" must not light
  // up together with "/procurement/spareparts").
  const bestSubUrl = (items?: { url: string }[]) =>
    (items ?? []).filter((s) => isPathActive(s.url)).sort((a, b) => b.url.length - a.url.length)[0]?.url

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu className="gap-0.5 px-1 group-data-[collapsible=icon]:px-0">
          {items.map((item) => {
            const isActive = isPathActive(item.url)
            const hasSubItems = item.items && item.items.length > 0

            if (hasSubItems) {
              if (item.locked) {
                return (
                  <SidebarMenuItem key={item.title}>
                    <div
                      aria-disabled="true"
                      title={`${item.title} · terkunci`}
                      className={cn(TOP_ITEM, TOP_COLLAPSED, "cursor-not-allowed select-none font-medium text-sidebar-foreground/45")}
                    >
                      {item.icon && <item.icon className="size-[18px] shrink-0" />}
                      <span className="group-data-[collapsible=icon]:sr-only">{item.title}</span>
                      <IconLock className="ml-auto size-4 group-data-[collapsible=icon]:hidden" />
                    </div>
                  </SidebarMenuItem>
                )
              }

              // Icon-only sidebar: the sub-menu opens in a popover
              if (isCollapsed) {
                let lastGroup: string | undefined
                return (
                  <Popover key={item.title} open={openPopover === item.title} onOpenChange={(open) => setOpenPopover(open ? item.title : null)}>
                    <SidebarMenuItem>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          data-slot="sidebar-menu-button"
                          data-sidebar="menu-button"
                          data-size="default"
                          title={item.title}
                          className={cn(TOP_ITEM, TOP_COLLAPSED, "overflow-hidden", isActive ? TOP_ACTIVE : TOP_IDLE)}
                        >
                          {isActive && <ActiveBar />}
                          {item.icon && <item.icon className={cn("size-[18px] shrink-0", isActive && "text-sidebar-primary")} />}
                          {/* Visible in the mobile sheet, screen-reader only in the icon rail */}
                          <span className="truncate group-data-[collapsible=icon]:sr-only">{item.title}</span>
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        align="start"
                        sideOffset={10}
                        className="w-64 rounded-lg border border-border p-1.5 shadow-md"
                      >
                        <p className="mb-1 border-b border-border px-2.5 pb-2 pt-1.5 text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        {(item.items ?? []).map((subItem) => {
                          const showGroupHeader = subItem.group && subItem.group !== lastGroup
                          const isFirstGroup = !lastGroup
                          if (subItem.group) lastGroup = subItem.group

                          if (subItem.locked) {
                            return (
                              <React.Fragment key={subItem.title}>
                                {showGroupHeader && <GroupLabel label={subItem.group!} first={isFirstGroup} tone="popover" />}
                                <div
                                  aria-disabled="true"
                                  title={`${subItem.title} · terkunci`}
                                  className="flex items-center gap-2.5 px-2.5 py-2 text-sm text-muted-foreground/70 cursor-not-allowed select-none"
                                >
                                  {subItem.icon && <subItem.icon className="size-4 shrink-0" />}
                                  <span>{subItem.title}</span>
                                  <IconLock className="ml-auto size-3.5" />
                                </div>
                              </React.Fragment>
                            )
                          }
                          const isSubActive = subItem.url === bestSubUrl(item.items)
                          return (
                            <React.Fragment key={subItem.title}>
                              {showGroupHeader && <GroupLabel label={subItem.group!} first={isFirstGroup} tone="popover" />}
                              <Link
                                href={subItem.url}
                                prefetch
                                onClick={() => setOpenPopover(null)}
                                onPointerDown={() => prefetchRoute(subItem.url)}
                                onMouseEnter={() => prefetchRoute(subItem.url)}
                                aria-current={isSubActive ? "page" : undefined}
                                className={cn(POP_ITEM, isSubActive ? POP_ACTIVE : POP_IDLE)}
                              >
                                {isSubActive && <ActiveBar tone="popover" />}
                                {subItem.icon && (
                                  <subItem.icon className={cn("size-4 shrink-0", isSubActive ? "text-primary" : "text-muted-foreground")} />
                                )}
                                <span>{subItem.title}</span>
                                {subItem.badge && subItem.badge > 0 ? (
                                  <NavBadge count={subItem.badge} severity={subItem.badgeSeverity} className="ml-auto" />
                                ) : null}
                              </Link>
                            </React.Fragment>
                          )
                        })}
                      </PopoverContent>
                    </SidebarMenuItem>
                  </Popover>
                )
              }

              // Expanded sidebar: collapsible group with a guide line under the icon
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
                        className={cn(
                          TOP_ITEM,
                          isActive
                            ? "font-semibold text-sidebar-accent-foreground hover:bg-sidebar-accent/60 data-[state=closed]:bg-sidebar-accent"
                            : TOP_IDLE,
                        )}
                      >
                        {/* When the group is closed, the parent carries the "you are here" bar */}
                        {isActive && <ActiveBar className="group-data-[state=open]/collapsible:hidden" />}
                        {item.icon && <item.icon className={cn("size-[18px] shrink-0", isActive && "text-sidebar-primary")} />}
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {item.badge && item.badge > 0 ? <NavBadge count={item.badge} severity="critical" /> : null}
                        <IconChevronRight
                          aria-hidden
                          className="size-4 shrink-0 text-sidebar-foreground/60 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                        />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mb-1.5 ml-[21px] mt-0.5 space-y-0.5 border-l border-sidebar-border pl-2">
                        {(() => {
                          let lastGroup: string | undefined
                          return (item.items ?? []).map((subItem) => {
                            const showGroupHeader = subItem.group && subItem.group !== lastGroup
                            const isFirstGroup = !lastGroup && !!subItem.group
                            if (subItem.group) lastGroup = subItem.group

                            if (subItem.locked) {
                              return (
                                <React.Fragment key={subItem.title}>
                                  {showGroupHeader && <GroupLabel label={subItem.group!} first={isFirstGroup} />}
                                  <div
                                    aria-disabled="true"
                                    title={`${subItem.title} · terkunci`}
                                    className={cn(SUB_ITEM, "cursor-not-allowed select-none text-sidebar-foreground/45")}
                                  >
                                    {subItem.icon && <subItem.icon className="size-4 shrink-0" />}
                                    <span>{subItem.title}</span>
                                    <IconLock className="ml-auto size-3.5 shrink-0" />
                                  </div>
                                </React.Fragment>
                              )
                            }
                            const isSubActive = subItem.url === bestSubUrl(item.items)
                            return (
                              <React.Fragment key={subItem.title}>
                                {showGroupHeader && <GroupLabel label={subItem.group!} first={isFirstGroup} />}
                                <Link
                                  href={subItem.url}
                                  prefetch
                                  onPointerDown={() => prefetchRoute(subItem.url)}
                                  onMouseEnter={() => prefetchRoute(subItem.url)}
                                  aria-current={isSubActive ? "page" : undefined}
                                  className={cn(SUB_ITEM, isSubActive ? SUB_ACTIVE : SUB_IDLE)}
                                >
                                  {isSubActive && <ActiveBar />}
                                  {subItem.icon && (
                                    <subItem.icon
                                      className={cn("size-4 shrink-0", isSubActive ? "text-sidebar-primary" : "opacity-70")}
                                    />
                                  )}
                                  <span className="min-w-0">{subItem.title}</span>
                                  {subItem.badge && subItem.badge > 0 ? (
                                    <NavBadge count={subItem.badge} severity={subItem.badgeSeverity} className="ml-auto" />
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
                  onPointerDown={() => prefetchRoute(item.url)}
                  onMouseEnter={() => prefetchRoute(item.url)}
                  data-slot="sidebar-menu-button"
                  data-sidebar="menu-button"
                  aria-current={isActive ? "page" : undefined}
                  title={isCollapsed ? item.title : undefined}
                  className={cn(TOP_ITEM, TOP_COLLAPSED, isActive ? TOP_ACTIVE : TOP_IDLE)}
                >
                  {isActive && <ActiveBar />}
                  {item.icon && <item.icon className={cn("size-[18px] shrink-0", isActive && "text-sidebar-primary")} />}
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
