"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import {
  IconPlus,
  IconFileInvoice,
  IconShoppingCart,
  IconPackage,
  IconUsers,
  IconFileText,
  IconClock,
  IconStar,
  IconSearch,
  IconCommand,
  IconArrowRight,
} from "@tabler/icons-react"
import { usePageHistory } from "@/hooks/use-page-history"
import { navMain, navSecondary } from "@/lib/sidebar-nav-data"
import { cn } from "@/lib/utils"

// ─── Quick Actions ───────────────────────────────────────────────────────────

const quickActions = [
  { title: "Buat Produk Baru", url: "/inventory/products/new", icon: IconPackage, color: "bg-blue-100 text-blue-600" },
  { title: "Buat Penawaran Baru", url: "/sales/quotations/new", icon: IconFileText, color: "bg-green-100 text-green-600" },
  { title: "Buat Pesanan Penjualan", url: "/sales/orders/new", icon: IconFileText, color: "bg-emerald-100 text-emerald-600" },
  { title: "Buat PO Baru", url: "/procurement/orders?new=true", icon: IconShoppingCart, color: "bg-orange-100 text-orange-600" },
  { title: "Buat Invoice Baru", url: "/finance/invoices?new=true", icon: IconFileInvoice, color: "bg-purple-100 text-purple-600" },
  { title: "Buat Jurnal Baru", url: "/finance/journal/new", icon: IconFileText, color: "bg-violet-100 text-violet-600" },
  { title: "Tambah Pelanggan", url: "/sales/customers?new=true", icon: IconUsers, color: "bg-teal-100 text-teal-600" },
  { title: "Tambah Vendor", url: "/procurement/vendors?new=true", icon: IconUsers, color: "bg-amber-100 text-amber-600" },
]

// ─── Module color mapping ────────────────────────────────────────────────────

const moduleColors: Record<string, string> = {
  Dasbor: "bg-gray-100 text-gray-600",
  Inventori: "bg-blue-100 text-blue-600",
  "Penjualan & CRM": "bg-green-100 text-green-600",
  Pengadaan: "bg-orange-100 text-orange-600",
  Keuangan: "bg-purple-100 text-purple-600",
  Manufaktur: "bg-slate-100 text-slate-600",
  SDM: "bg-amber-100 text-amber-700",
  "Dokumen & Sistem": "bg-zinc-100 text-zinc-600",
  Pengaturan: "bg-gray-100 text-gray-500",
}

// ─── Spotlight Item ──────────────────────────────────────────────────────────

function SpotlightItem({
  onSelect,
  icon: Icon,
  iconColor,
  children,
  suffix,
  className,
  ...props
}: {
  onSelect: () => void
  icon?: React.ComponentType<{ className?: string }>
  iconColor?: string
  children: React.ReactNode
  suffix?: React.ReactNode
  className?: string
  value?: string
}) {
  return (
    <CommandPrimitive.Item
      onSelect={onSelect}
      className={cn(
        "group relative flex cursor-default items-center gap-3 rounded-xl px-3 py-2.5 text-sm outline-none select-none",
        "data-[selected=true]:bg-accent/60",
        "transition-colors duration-100",
        className
      )}
      {...props}
    >
      {Icon && (
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", iconColor || "bg-muted")}>
          <Icon className="size-4" />
        </span>
      )}
      <span className="flex-1 truncate">{children}</span>
      {suffix}
      <IconArrowRight className="size-3.5 text-muted-foreground/0 group-data-[selected=true]:text-muted-foreground transition-colors" />
    </CommandPrimitive.Item>
  )
}

// ─── Spotlight Group ─────────────────────────────────────────────────────────

function SpotlightGroup({
  heading,
  children,
}: {
  heading: string
  children: React.ReactNode
}) {
  return (
    <CommandPrimitive.Group
      heading={heading}
      className={cn(
        "px-2 py-1.5",
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3",
        "[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/70"
      )}
    >
      {children}
    </CommandPrimitive.Group>
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)

  // Cmd+K listener
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const { getFrequentPages, getRecentPages } = usePageHistory()
  const recentPages = open ? getRecentPages(5) : []
  const frequentPages = open ? getFrequentPages(5) : []

  const navigate = useCallback(
    (url: string) => {
      setOpen(false)
      router.push(url)
    },
    [router]
  )

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        {/* Overlay — subtle dark with blur */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/25 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "duration-200"
          )}
        />

        {/* Content — positioned in upper third like Spotlight */}
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn(
            "fixed left-1/2 top-[18%] z-50 w-full max-w-[640px] -translate-x-1/2",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
            "data-[state=open]:zoom-in-[0.96] data-[state=closed]:zoom-out-[0.96]",
            "data-[state=open]:slide-in-from-top-2 data-[state=closed]:slide-out-to-top-2",
            "duration-200"
          )}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            inputRef.current?.focus()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Command Palette
          </DialogPrimitive.Title>

          {/* Spotlight container */}
          <div
            className={cn(
              "overflow-hidden rounded-2xl",
              "bg-background/80 backdrop-blur-2xl",
              "border border-border/40",
              "shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)]",
              "ring-1 ring-black/[0.05]"
            )}
          >
            <CommandPrimitive
              className="flex h-full w-full flex-col"
              loop
            >
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-border/40 px-4">
                <IconSearch className="size-5 shrink-0 text-muted-foreground/60" />
                <CommandPrimitive.Input
                  ref={inputRef}
                  placeholder="Cari halaman, aksi, menu..."
                  className={cn(
                    "flex h-14 w-full bg-transparent text-base outline-none",
                    "placeholder:text-muted-foreground/40"
                  )}
                />
                <kbd className="pointer-events-none hidden shrink-0 select-none items-center gap-0.5 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 sm:flex">
                  <IconCommand className="size-3" />K
                </kbd>
              </div>

              {/* Results list */}
              <CommandPrimitive.List className="max-h-[min(420px,50vh)] scroll-py-2 overflow-y-auto overflow-x-hidden overscroll-contain p-1">
                <CommandPrimitive.Empty className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground/60">
                  <IconSearch className="mb-2 size-8 text-muted-foreground/30" />
                  Tidak ada hasil ditemukan
                </CommandPrimitive.Empty>

                {/* Recent pages */}
                {recentPages.length > 0 && (
                  <SpotlightGroup heading="Terakhir Dikunjungi">
                    {recentPages.map((page) => (
                      <SpotlightItem
                        key={`recent-${page.url}`}
                        onSelect={() => navigate(page.url)}
                        icon={IconClock}
                        iconColor="bg-muted text-muted-foreground"
                      >
                        {page.label}
                      </SpotlightItem>
                    ))}
                  </SpotlightGroup>
                )}

                {/* Frequent pages */}
                {frequentPages.length > 0 && (
                  <SpotlightGroup heading="Sering Digunakan">
                    {frequentPages.map((page) => (
                      <SpotlightItem
                        key={`frequent-${page.url}`}
                        onSelect={() => navigate(page.url)}
                        icon={IconStar}
                        iconColor="bg-amber-50 text-amber-500"
                        suffix={
                          <span className="tabular-nums text-[10px] font-medium text-muted-foreground/50">
                            {page.count}x
                          </span>
                        }
                      >
                        {page.label}
                      </SpotlightItem>
                    ))}
                  </SpotlightGroup>
                )}

                {/* Quick actions */}
                <SpotlightGroup heading="Aksi Cepat">
                  {quickActions.map((action) => (
                    <SpotlightItem
                      key={action.url}
                      onSelect={() => navigate(action.url)}
                      icon={action.icon}
                      iconColor={action.color}
                      suffix={
                        <IconPlus className="size-3 text-muted-foreground/30 group-data-[selected=true]:text-muted-foreground/60" />
                      }
                    >
                      {action.title}
                    </SpotlightItem>
                  ))}
                </SpotlightGroup>

                {/* Navigation sections */}
                {navMain.map((section) => {
                  if (!section.items || section.items.length === 0) {
                    return (
                      <SpotlightGroup key={section.title} heading={section.title}>
                        <SpotlightItem
                          onSelect={() => navigate(section.url)}
                          icon={section.icon as React.ComponentType<{ className?: string }>}
                          iconColor={moduleColors[section.title]}
                        >
                          {section.title}
                        </SpotlightItem>
                      </SpotlightGroup>
                    )
                  }
                  return (
                    <SpotlightGroup key={section.title} heading={section.title}>
                      {section.items.map((item) => (
                        <SpotlightItem
                          key={item.url}
                          onSelect={() => navigate(item.url)}
                          icon={item.icon as React.ComponentType<{ className?: string }>}
                          iconColor={moduleColors[section.title]}
                        >
                          {item.title}
                        </SpotlightItem>
                      ))}
                    </SpotlightGroup>
                  )
                })}

                {/* Settings / secondary nav */}
                <SpotlightGroup heading="Pengaturan">
                  {navSecondary.map((item) => (
                    <SpotlightItem
                      key={item.url}
                      onSelect={() => navigate(item.url)}
                      icon={item.icon as React.ComponentType<{ className?: string }>}
                      iconColor={moduleColors.Pengaturan}
                    >
                      {item.title}
                    </SpotlightItem>
                  ))}
                </SpotlightGroup>
              </CommandPrimitive.List>

              {/* Footer hint */}
              <div className="flex items-center justify-between border-t border-border/40 px-4 py-2 text-[11px] text-muted-foreground/50">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd>
                    navigasi
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5 font-mono text-[10px]">↵</kbd>
                    buka
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded border border-border/50 bg-muted/30 px-1 py-0.5 font-mono text-[10px]">esc</kbd>
                    tutup
                  </span>
                </div>
              </div>
            </CommandPrimitive>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
