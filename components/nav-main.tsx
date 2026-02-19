"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { IconChevronRight, IconLock, type Icon } from "@tabler/icons-react"
import { useNavPrefetch } from "@/hooks/use-nav-prefetch"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
}: {
  items: {
    title: string
    url: string
    icon?: Icon
    locked?: boolean
    badge?: number
    items?: {
      title: string
      url: string
      locked?: boolean
      badge?: number
    }[]
  }[]
}) {
  const pathname = usePathname()
  const { prefetchRoute } = useNavPrefetch()

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-0.5">
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
                      {item.icon && <item.icon className="!size-4" />}
                      <span className="text-[13px] font-medium tracking-tight">{item.title}</span>
                      <IconLock className="ml-auto !size-3.5 text-zinc-400" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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
                        {item.icon && <item.icon className="!size-4" />}
                        <span className="text-[13px] tracking-tight">{item.title}</span>
                        {item.badge && item.badge > 0 ? (
                          <span className="ml-auto mr-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-black text-white tabular-nums">
                            {item.badge > 99 ? "99+" : item.badge}
                          </span>
                        ) : null}
                        <IconChevronRight className={`!size-3.5 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90 ${item.badge && item.badge > 0 ? "" : "ml-auto"}`} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub className="border-l-2 border-zinc-200 dark:border-zinc-700 ml-4 pl-2.5 mr-0 py-0.5">
                        {item.items!.map((subItem) => {
                          if (subItem.locked) {
                            return (
                              <SidebarMenuSubItem key={subItem.title}>
                                <SidebarMenuSubButton
                                  className="opacity-40 cursor-not-allowed pointer-events-none text-[12px] font-medium"
                                >
                                  <span>{subItem.title}</span>
                                  <IconLock className="ml-auto !size-3 text-zinc-400" />
                                </SidebarMenuSubButton>
                              </SidebarMenuSubItem>
                            )
                          }
                          const isSubActive = pathname === subItem.url
                          return (
                            <SidebarMenuSubItem key={subItem.title}>
                              <SidebarMenuSubButton
                                asChild
                                className={
                                  isSubActive
                                    ? "bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white active:bg-zinc-800 active:text-white font-bold rounded-none text-[12px]"
                                    : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-none text-[12px] font-medium"
                                }
                              >
                                <Link href={subItem.url} prefetch onMouseEnter={() => prefetchRoute(subItem.url)} className="flex items-center w-full">
                                  <span>{subItem.title}</span>
                                  {subItem.badge && subItem.badge > 0 ? (
                                    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white tabular-nums">
                                      {subItem.badge > 99 ? "99+" : subItem.badge}
                                    </span>
                                  ) : null}
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
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
                    {item.icon && <item.icon className="!size-4" />}
                    <span className="text-[13px] tracking-tight">{item.title}</span>
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
