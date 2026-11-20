"use client"

import { useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ChevronRight, SearchIcon } from "lucide-react"
import { ModeToggle } from "@/components/mode-toggle"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UserNav } from "@/components/user-nav"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useBreadcrumbs } from "@/hooks/use-breadcrumbs"
import { NotificationCenter } from "@/components/notification-center"
import { cn } from "@/lib/utils"

/** "⌘" on Apple devices, "Ctrl" elsewhere. Server render (and first paint) uses "Ctrl". */
function useShortcutKey() {
  const isApple = useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.userAgent),
    () => false,
  )
  return isApple ? "⌘" : "Ctrl"
}

/** Tooltip in Indonesian under a header control. */
function HeaderTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={6} className="text-sm">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function openSearch() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))
}

export function SiteHeader() {
  const router = useRouter()
  const crumbs = useBreadcrumbs()
  const mod = useShortcutKey()

  return (
    <header className="relative z-30 flex h-14 shrink-0 items-center border-b border-border bg-card">
      <div className="flex w-full min-w-0 items-center gap-1 px-2 md:px-4 lg:px-6">
        <HeaderTip label={`Tampilkan atau sembunyikan menu (${mod} B)`}>
          <SidebarTrigger className="size-9 text-foreground [&_svg]:size-[18px]" />
        </HeaderTip>

        <HeaderTip label="Kembali ke halaman sebelumnya">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 text-foreground"
            onClick={() => router.back()}
            aria-label="Kembali"
          >
            <ArrowLeft className="size-[18px]" />
          </Button>
        </HeaderTip>

        <Separator orientation="vertical" className="mx-1.5 bg-border data-[orientation=vertical]:h-5" />

        {/* Breadcrumbs: on phones only the current page is shown */}
        <nav aria-label="Lokasi halaman" className="min-w-0 flex-1">
          <ol className="flex min-w-0 items-center gap-1.5">
            {crumbs.map((crumb, i) => (
              <li
                key={crumb.href}
                className={cn("flex min-w-0 items-center gap-1.5", !crumb.isCurrent && "hidden md:flex")}
              >
                {i > 0 && (
                  <ChevronRight
                    aria-hidden
                    className={cn("size-4 shrink-0 text-muted-foreground/70", crumb.isCurrent && "hidden md:block")}
                  />
                )}
                {crumb.isCurrent ? (
                  <span aria-current="page" className="truncate text-sm font-semibold text-foreground">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="truncate rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    {crumb.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1 md:gap-1.5">
          {/* Search: a labelled field on wide screens, an icon button on small ones */}
          <button
            type="button"
            onClick={openSearch}
            aria-keyshortcuts="Control+K Meta+K"
            className="hidden h-9 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground lg:inline-flex lg:w-60 xl:w-72"
          >
            <SearchIcon aria-hidden className="size-4 shrink-0" />
            <span className="flex-1 truncate text-left">Cari menu atau dokumen…</span>
            <kbd className="pointer-events-none inline-flex h-6 select-none items-center gap-1 rounded border border-border bg-card px-1.5 font-sans text-xs font-medium text-muted-foreground">
              {mod} K
            </kbd>
          </button>
          <HeaderTip label={`Cari menu atau dokumen (${mod} K)`}>
            <Button
              variant="ghost"
              size="icon"
              className="size-9 text-foreground lg:hidden"
              onClick={openSearch}
              aria-label="Cari menu atau dokumen"
            >
              <SearchIcon className="size-[18px]" />
            </Button>
          </HeaderTip>

          <HeaderTip label="Notifikasi">
            <span className="inline-flex size-9 items-center justify-center rounded-md transition-colors hover:bg-accent">
              <NotificationCenter />
            </span>
          </HeaderTip>

          <HeaderTip label="Akun saya">
            <span className="inline-flex">
              <UserNav />
            </span>
          </HeaderTip>

          {/* ModeToggle ships dark-glass styles; these keep it calm on the white bar. */}
          <HeaderTip label="Ganti tampilan">
            <span className="inline-flex [&>button]:size-9 [&>button]:border-border [&>button]:text-muted-foreground [&>button:hover]:bg-accent [&>button:hover]:text-foreground">
              <ModeToggle />
            </span>
          </HeaderTip>
        </div>
      </div>
    </header>
  )
}
