"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
    IconSearch,
    IconChevronDown,
    IconMoon,
    IconSun,
    IconUser,
    IconSettings,
    IconLogout,
    IconLock,
} from "@tabler/icons-react"
import { useTheme } from "next-themes"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import { getIntegraNav, type IntegraNavItem } from "@/lib/integra-nav-data"
import { useNavPrefetch } from "@/hooks/use-nav-prefetch"
import { NotificationCenter } from "@/components/notification-center"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const sections = getIntegraNav()

// Pre-computed flat list of all nav URLs, used for longest-prefix active match.
const ALL_NAV_URLS = sections.flatMap((s) => s.items.map((i) => i.url))

function findActiveUrl(pathname: string): string | null {
    let best: string | null = null
    for (const url of ALL_NAV_URLS) {
        if (pathname === url || (url !== "/" && pathname.startsWith(url + "/"))) {
            if (!best || url.length > best.length) best = url
        }
    }
    return best
}

export function IntegraSidebar() {
    const pathname = usePathname()
    const router = useRouter()
    const { user, logout } = useAuth()
    const { prefetchRoute } = useNavPrefetch()
    const [search, setSearch] = React.useState("")

    // Longest-prefix wins — prevents parent + child both lighting up
    // (e.g. /inventory and /inventory/products simultaneously).
    const activeUrl = React.useMemo(() => findActiveUrl(pathname), [pathname])

    // ⌘K → focus search
    const inputRef = React.useRef<HTMLInputElement | null>(null)
    React.useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault()
                inputRef.current?.focus()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    }, [])

    const visibleSections = React.useMemo(() => {
        if (!search.trim()) return sections
        const q = search.toLowerCase()
        return sections
            .map((s) => ({
                ...s,
                items: s.items.filter((i) => i.title.toLowerCase().includes(q)),
            }))
            .filter((s) => s.items.length > 0)
    }, [search])

    const userInitials = (user?.name ?? user?.email ?? "?")
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("") || "?"
    const userName = user?.name ?? user?.email?.split("@")[0] ?? "Pengguna"
    const userRole = user?.role ? prettyRole(user.role) : "PT Integra"

    return (
        <aside
            className={cn(
                "h-screen sticky top-0 self-start overflow-auto",
                "border-r border-[var(--integra-hairline)]",
                "bg-[var(--integra-canvas)]",
                "flex flex-col w-[240px] shrink-0",
                "font-body text-[var(--integra-ink-soft)]",
            )}
        >
            {/* Brand row */}
            <div className="h-[52px] flex items-center gap-2 px-4 border-b border-[var(--integra-hairline)] shrink-0">
                <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
                    <span
                        className="w-[22px] h-[22px] rounded-[4px] bg-[var(--integra-ink)] text-[var(--integra-canvas)] grid place-items-center font-display font-semibold text-[12px]"
                        style={{ letterSpacing: "-0.04em" }}
                    >
                        I
                    </span>
                    <span
                        className="font-display font-semibold text-[15px] text-[var(--integra-ink)]"
                        style={{ letterSpacing: "-0.025em" }}
                    >
                        Integra
                    </span>
                </Link>
                <div className="ml-auto flex items-center gap-0.5">
                    <NotificationCenter />
                    <ThemeToggleButton />
                </div>
            </div>

            {/* Search row */}
            <div className="px-3 py-2.5 border-b border-[var(--integra-hairline)] flex items-center gap-2 shrink-0">
                <IconSearch className="size-3.5 text-[var(--integra-muted)] shrink-0" stroke={1.4} />
                <input
                    ref={inputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Cari modul, dokumen, SKU…"
                    className={cn(
                        "flex-1 min-w-0 bg-[var(--integra-canvas-pure)]",
                        "border border-[var(--integra-hairline)] rounded-[2px]",
                        "px-2 py-1 text-[12px] text-[var(--integra-ink)]",
                        "outline-none focus:border-[var(--integra-ink)]",
                        "placeholder:text-[var(--integra-muted)]",
                    )}
                />
                <span className="font-mono text-[10.5px] text-[var(--integra-muted)] border border-[var(--integra-hairline-strong)] px-1 rounded-[2px]">
                    ⌘K
                </span>
            </div>

            {/* Nav sections */}
            <nav className="flex-1 py-1">
                {visibleSections.map((section) => (
                    <div key={section.title} className="px-2 pt-3 pb-1">
                        <div
                            className="text-[10px] font-semibold uppercase text-[var(--integra-muted)] px-2.5 pt-1 pb-1.5"
                            style={{ letterSpacing: "0.14em" }}
                        >
                            {section.title}
                        </div>
                        {section.items.map((item) => (
                            <SidebarNavItem
                                key={item.url}
                                item={item}
                                active={item.url === activeUrl}
                                onHover={() => prefetchRoute(item.url)}
                            />
                        ))}
                    </div>
                ))}
                {visibleSections.length === 0 && (
                    <div className="px-4 py-6 text-[12px] text-[var(--integra-muted)] text-center">
                        Tidak ada modul cocok.
                    </div>
                )}
            </nav>

            {/* Footer: user dropdown */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className={cn(
                            "mt-auto border-t border-[var(--integra-hairline)] shrink-0",
                            "px-3.5 py-2.5 flex items-center gap-2.5 text-[12px]",
                            "hover:bg-[#F1EFE8] transition-colors text-left w-full",
                            "outline-none",
                        )}
                    >
                        <span className="w-6 h-6 rounded-full bg-[var(--integra-ink)] text-[var(--integra-canvas)] grid place-items-center font-display font-semibold text-[11px] shrink-0">
                            {userInitials}
                        </span>
                        <span className="flex-1 min-w-0">
                            <span className="block font-medium text-[var(--integra-ink)] truncate">
                                {userName}
                            </span>
                            <span className="block text-[var(--integra-muted)] text-[11px] truncate">
                                {userRole}
                            </span>
                        </span>
                        <IconChevronDown className="size-3.5 text-[var(--integra-muted)] shrink-0" stroke={1.4} />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side="right"
                    align="end"
                    sideOffset={8}
                    className="w-56"
                >
                    <DropdownMenuLabel className="font-normal">
                        <div className="flex flex-col space-y-0.5">
                            <span className="text-[12px] font-medium text-[var(--integra-ink)]">{userName}</span>
                            <span className="text-[11px] text-[var(--integra-muted)] truncate">
                                {user?.email ?? userRole}
                            </span>
                        </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                        <IconUser className="mr-2 size-4" stroke={1.4} />
                        <span>Profil</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                        <IconSettings className="mr-2 size-4" stroke={1.4} />
                        <span>Pengaturan</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => router.push("/settings")}>
                        <IconLock className="mr-2 size-4" stroke={1.4} />
                        <span>Ubah Kata Sandi</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={logout}
                        className="text-[var(--integra-red)] focus:text-[var(--integra-red)]"
                    >
                        <IconLogout className="mr-2 size-4" stroke={1.4} />
                        <span>Keluar</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </aside>
    )
}

function SidebarNavItem({
    item,
    active,
    onHover,
}: {
    item: IntegraNavItem
    active: boolean
    onHover: () => void
}) {
    const Icon = item.icon
    return (
        <Link
            href={item.url}
            prefetch
            onMouseEnter={onHover}
            className={cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-[3px] text-[13px] cursor-pointer select-none",
                active
                    ? "bg-[var(--integra-ink)] text-[var(--integra-canvas)]"
                    : "text-[var(--integra-ink-soft)] hover:bg-[#F1EFE8] hover:text-[var(--integra-ink)]",
            )}
        >
            <Icon
                className={cn(
                    "size-3.5 shrink-0",
                    active ? "opacity-100" : "opacity-75",
                )}
                stroke={1.4}
            />
            <span className="truncate">{item.title}</span>
            {item.count !== undefined && item.count !== null && (
                <span
                    className={cn(
                        "ml-auto font-mono text-[11px]",
                        active && "opacity-60",
                        !active && (
                            item.countKind === "warn" ? "text-[var(--integra-amber)]"
                                : item.countKind === "err" ? "text-[var(--integra-red)]"
                                    : "text-[var(--integra-muted)]"
                        ),
                    )}
                >
                    {item.count}
                </span>
            )}
        </Link>
    )
}

function ThemeToggleButton() {
    const { theme, setTheme } = useTheme()
    const isDark = theme === "dark"
    return (
        <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={cn(
                "w-7 h-7 grid place-items-center rounded-[3px]",
                "text-[var(--integra-muted)] hover:text-[var(--integra-ink)] hover:bg-[#F1EFE8]",
                "transition-colors",
            )}
        >
            {isDark ? (
                <IconSun className="size-3.5" stroke={1.4} />
            ) : (
                <IconMoon className="size-3.5" stroke={1.4} />
            )}
        </button>
    )
}

function prettyRole(role: string): string {
    const map: Record<string, string> = {
        ROLE_ADMIN: "Admin",
        ROLE_CEO: "Pemilik & CEO",
        ROLE_MANAGER: "Manajer Operasional",
        ROLE_ACCOUNTANT: "Akuntan",
        ROLE_STAFF: "Staf",
    }
    return map[role] ?? role
}
