"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  IconPlus,
  IconFileInvoice,
  IconShoppingCart,
  IconPackage,
  IconUsers,
  IconFileText,
  IconClock,
  IconStar,
} from "@tabler/icons-react"
import { usePageHistory } from "@/hooks/use-page-history"
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import { navMain, navSecondary } from "@/lib/sidebar-nav-data"

const quickActions = [
  { title: "Buat Produk Baru", url: "/inventory/products/new", icon: IconPackage },
  { title: "Buat Penawaran Baru", url: "/sales/quotations/new", icon: IconFileText },
  { title: "Buat Pesanan Penjualan", url: "/sales/orders/new", icon: IconFileText },
  { title: "Buat PO Baru", url: "/procurement/orders?new=true", icon: IconShoppingCart },
  { title: "Buat Invoice Baru", url: "/finance/invoices?new=true", icon: IconFileInvoice },
  { title: "Buat Jurnal Baru", url: "/finance/journal/new", icon: IconFileText },
  { title: "Tambah Pelanggan", url: "/sales/customers?new=true", icon: IconUsers },
  { title: "Tambah Vendor", url: "/procurement/vendors?new=true", icon: IconUsers },
]

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

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

  const navigate = useCallback((url: string) => {
    setOpen(false)
    router.push(url)
  }, [router])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Command Palette"
      description="Cari halaman atau aksi..."
      className="rounded-none border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] max-w-lg"
      showCloseButton={false}
    >
      <CommandInput placeholder="Ketik untuk mencari..." />
      <CommandList className="max-h-[400px]">
        <CommandEmpty>Tidak ditemukan.</CommandEmpty>

        {recentPages.length > 0 && (
          <CommandGroup heading="Terakhir Dikunjungi">
            {recentPages.map((page) => (
              <CommandItem
                key={`recent-${page.url}`}
                onSelect={() => navigate(page.url)}
                className="rounded-none"
              >
                <IconClock className="!size-4 mr-2 text-muted-foreground" />
                <span>{page.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {frequentPages.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Sering Digunakan">
              {frequentPages.map((page) => (
                <CommandItem
                  key={`frequent-${page.url}`}
                  onSelect={() => navigate(page.url)}
                  className="rounded-none"
                >
                  <IconStar className="!size-4 mr-2 text-muted-foreground" />
                  <span>{page.label}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{page.count}x</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />

        <CommandGroup heading="Aksi Cepat">
          {quickActions.map((action) => (
            <CommandItem
              key={action.url}
              onSelect={() => navigate(action.url)}
              className="rounded-none"
            >
              <action.icon className="!size-4 mr-2 text-muted-foreground" />
              <span>{action.title}</span>
              <IconPlus className="ml-auto !size-3 text-muted-foreground" />
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        {navMain.map((section) => {
          if (!section.items || section.items.length === 0) {
            return (
              <CommandGroup key={section.title} heading={section.title}>
                <CommandItem
                  onSelect={() => navigate(section.url)}
                  className="rounded-none"
                >
                  {section.icon && <section.icon className="!size-4 mr-2 text-muted-foreground" />}
                  <span>{section.title}</span>
                </CommandItem>
              </CommandGroup>
            )
          }
          return (
            <CommandGroup key={section.title} heading={section.title}>
              {section.items.map((item) => (
                <CommandItem
                  key={item.url}
                  onSelect={() => navigate(item.url)}
                  className="rounded-none"
                >
                  <span>{item.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )
        })}

        <CommandSeparator />

        <CommandGroup heading="Pengaturan">
          {navSecondary.map((item) => (
            <CommandItem
              key={item.url}
              onSelect={() => navigate(item.url)}
              className="rounded-none"
            >
              <item.icon className="!size-4 mr-2 text-muted-foreground" />
              <span>{item.title}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
