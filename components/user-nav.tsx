"use client"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { LogOut, User as UserIcon, Settings, Lock } from "lucide-react"

export function UserNav() {
    const { user, logout, isAuthenticated } = useAuth()
    const router = useRouter()

    if (!isAuthenticated || !user) {
        return (
            <Button variant="outline" size="sm" className="h-9 px-4 text-sm font-semibold" onClick={() => router.push("/login")}>
                Masuk
            </Button>
        )
    }

    // Helper to format role name nicely
    const formatRole = (role?: string | null) => {
        if (!role) return ""

        // Map roles to Indonesian friendly names
        const roleMap: Record<string, string> = {
            "ROLE_CEO": "Pemilik & CEO",
            "ROLE_MANAGER": "Manajer Operasional",
            "ROLE_ACCOUNTANT": "Akuntan",
            "ROLE_STAFF": "Staf"
        }
        return roleMap[role] || role.replace("ROLE_", "").replace(/_/g, " ")
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative size-9 rounded-full p-0" aria-label={`Menu akun ${user.name || ""}`.trim()}>
                    <Avatar className="size-8">
                        <AvatarImage src={user.avatar} alt={user.name || "Pengguna"} />
                        <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">{(user.name || user.email || "U").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-60" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-semibold leading-tight">{user.name}</p>
                        <p className="text-xs leading-tight text-muted-foreground">
                            {formatRole(user.role)}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                    <DropdownMenuItem>
                        <UserIcon className="mr-2 h-4 w-4" />
                        <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Settings className="mr-2 h-4 w-4" />
                        <span>Pengaturan</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem>
                        <Lock className="mr-2 h-4 w-4" />
                        <span>Ubah Kata Sandi</span>
                    </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="font-semibold text-red-700 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:focus:bg-red-950/40 dark:focus:text-red-400">
                    <LogOut className="mr-2 h-4 w-4 text-current" />
                    <span>Keluar</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
