"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, SearchIcon } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserNav } from "@/components/user-nav"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs"
import { NotificationCenter } from "@/components/notification-center"

export function SiteHeader() {
  const router = useRouter()
  const crumbs = useBreadcrumbs()

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm dark:bg-zinc-950/95 border-border/40 dark:border-zinc-800 shadow-sm z-30 relative">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="mr-2 text-foreground" />

        <Button variant="ghost" size="icon" className="mr-1 h-7 w-7" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <Separator orientation="vertical" className="mx-1 h-4 bg-zinc-200 dark:bg-zinc-800" />

        {/* Breadcrumbs */}
        <nav className="flex items-center gap-1 min-w-0 overflow-hidden">
          {crumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1 min-w-0">
              {i > 0 && (
                <span className="text-zinc-300 dark:text-zinc-600 text-xs shrink-0">/</span>
              )}
              {crumb.isCurrent ? (
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-sm text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors truncate"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <NotificationCenter />
          <button
            type="button"
            onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-zinc-200 dark:border-zinc-700 rounded px-2 py-1 transition-colors"
          >
            <SearchIcon className="h-3 w-3" />
            <span>Cari...</span>
            <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-0.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-1.5 font-mono text-[10px] font-medium">
              <span className="text-xs">&#8984;</span>K
            </kbd>
          </button>
          <UserNav />
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}
