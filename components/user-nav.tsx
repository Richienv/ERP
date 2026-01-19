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
            <Button variant="ghost" size="sm" onClick={() => router.push("/login")}>
                Masuk
            </Button>
        )
    }

    // Helper to format role name nicely
    const formatRole = (role: string) => {
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
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar} alt={user.name || "User"} />
                        <AvatarFallback>{(user.name || user.email || "U").charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user.name}</p>
                        <p className="text-xs leading-none text-muted-foreground uppercase font-semibold">
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
                <DropdownMenuItem onClick={logout} className="text-red-600 focus:text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Keluar</span>
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
