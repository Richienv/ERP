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
            tooltip="Masuk"
            className="h-10 rounded-md text-[15px] font-semibold"
          >
            <IconLogout className="!size-[18px]" />
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
              aria-label={`Akun ${user.name}`}
              className="rounded-md data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-md">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                  {user.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-semibold text-sidebar-accent-foreground">{user.name}</span>
                <span className="truncate text-xs text-sidebar-foreground/75">
                  {user.email}
                </span>
              </div>
              <IconDotsVertical className="ml-auto !size-4 text-sidebar-foreground/70" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-60 overflow-hidden rounded-lg border border-border p-0 shadow-md"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={6}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2.5 border-b border-border bg-muted/60 px-3 py-3">
                <Avatar className="size-9 rounded-md">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                    {user.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate text-sm font-semibold text-foreground">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuGroup className="p-1">
              <DropdownMenuItem className="cursor-pointer rounded-md px-3 py-2 text-sm">
                <IconUserCircle className="!size-[18px]" />
                Akun
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-md px-3 py-2 text-sm">
                <IconCreditCard className="!size-[18px]" />
                Tagihan
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer rounded-md px-3 py-2 text-sm">
                <IconNotification className="!size-[18px]" />
                Notifikasi
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="my-0" />
            <div className="p-1">
              <DropdownMenuItem
                onClick={logout}
                className="cursor-pointer rounded-md px-3 py-2 text-sm font-semibold text-red-700 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-950/40 dark:focus:text-red-400"
              >
                <IconLogout className="!size-[18px] text-current" />
                Keluar
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
