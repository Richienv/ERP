"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { type Icon } from "@tabler/icons-react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url: string
    icon: Icon
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const pathname = usePathname()

  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <div className="mx-3 mb-2">
          <div className="flex items-center gap-2 pb-1.5">
            <div className="size-1.5 rounded-full bg-zinc-400 dark:bg-zinc-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Sistem</span>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
        <SidebarMenu className="gap-0.5 px-2">
          {items.map((item) => {
            const isActive = pathname === item.url
            return (
              <SidebarMenuItem key={item.title}>
                <Link
                  href={item.url}
                  prefetch
                  data-slot="sidebar-menu-button"
                  data-sidebar="menu-button"
                  className={`flex w-full items-center gap-2 rounded-sm px-3 py-1.5 transition-all duration-100 outline-none group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-2! group-data-[collapsible=icon]:justify-center ${
                    isActive
                      ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-bold border border-zinc-300 dark:border-zinc-600"
                      : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 hover:translate-x-0.5 border border-transparent"
                  }`}
                >
                  <item.icon className="size-3.5 shrink-0" />
                  <span className="text-[12px] group-data-[collapsible=icon]:hidden">{item.title}</span>
                </Link>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
