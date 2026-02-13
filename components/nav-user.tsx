"use client"

import {
  IconCreditCard,
  IconDotsVertical,
  IconLogout,
  IconNotification,
  IconUserCircle,
} from "@tabler/icons-react"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"

export function NavUser({
  user: propUser,
}: {
  user?: {
    name: string
    email: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const { user: authUser, logout } = useAuth()
  const router = useRouter()

  const formatRole = (role: string) => {
    const roleMap: Record<string, string> = {
      "ROLE_CEO": "Pemilik & CEO",
      "ROLE_MANAGER": "Manajer Operasional",
      "ROLE_ACCOUNTANT": "Akuntan",
      "ROLE_STAFF": "Staf"
    }
    return roleMap[role] || role.replace("ROLE_", "").replace(/_/g, " ")
  }

  const user = authUser ? {
    name: authUser.name ?? "Tamu",
    email: formatRole(authUser.role ?? "user"),
    avatar: authUser.avatar || "",
  } : propUser || {
    name: "Tamu",
    email: "guest@erp.com",
    avatar: ""
  }

  if (!authUser && !propUser) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={() => router.push("/login")}
            className="rounded-none font-bold text-[13px] tracking-tight hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <IconLogout className="!size-4" />
            <span>Masuk</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-zinc-100 dark:data-[state=open]:bg-zinc-800 rounded-none border-t border-zinc-200 dark:border-zinc-800"
            >
              <Avatar className="h-7 w-7 rounded-none border border-zinc-300 dark:border-zinc-600">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-none bg-zinc-900 text-white text-[10px] font-black">
                  {user.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-bold tracking-tight">{user.name}</span>
                <span className="truncate text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto !size-4 text-zinc-400" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none p-0 overflow-hidden"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 px-3 py-2.5 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-700">
                <Avatar className="h-8 w-8 rounded-none border border-zinc-300 dark:border-zinc-600">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-none bg-zinc-900 text-white text-[10px] font-black">
                    {user.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-bold">{user.name}</span>
                  <span className="truncate text-[10px] font-medium text-zinc-400 uppercase tracking-widest">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuGroup>
              <DropdownMenuItem className="rounded-none text-[13px] font-medium px-3 py-2 cursor-pointer">
                <IconUserCircle className="!size-4" />
                Akun
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-none text-[13px] font-medium px-3 py-2 cursor-pointer">
                <IconCreditCard className="!size-4" />
                Tagihan
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-none text-[13px] font-medium px-3 py-2 cursor-pointer">
                <IconNotification className="!size-4" />
                Notifikasi
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-0" />
            <DropdownMenuItem
              onClick={logout}
              className="rounded-none text-[13px] font-bold px-3 py-2.5 text-red-600 focus:text-red-600 cursor-pointer"
            >
              <IconLogout className="!size-4" />
              Keluar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
