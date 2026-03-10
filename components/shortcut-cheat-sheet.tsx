"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

interface Shortcut {
  keys: string[]
  description: string
}

interface ShortcutGroup {
  title: string
  shortcuts: Shortcut[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Navigasi",
    shortcuts: [
      { keys: ["⌘", "K"], description: "Command Palette" },
      { keys: ["G", "lalu", "D"], description: "Dashboard" },
      { keys: ["G", "lalu", "I"], description: "Inventori" },
      { keys: ["G", "lalu", "P"], description: "Penjualan" },
      { keys: ["G", "lalu", "F"], description: "Keuangan" },
    ],
  },
  {
    title: "Umum",
    shortcuts: [
      { keys: ["Shift", "?"], description: "Bantuan Shortcut" },
      { keys: ["Esc"], description: "Tutup dialog/modal" },
    ],
  },
]

const NAV_MAP: Record<string, string> = {
  d: "/dashboard",
  i: "/inventory/products",
  p: "/sales/customers",
  f: "/finance/invoices",
}

export function ShortcutCheatSheet() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pendingG = useRef(false)
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable

      if (isInput) return

      // Shift+? to open cheat sheet
      if (e.key === "?") {
        e.preventDefault()
        setOpen((prev) => !prev)
        return
      }

      // G-then-X navigation sequence
      if (e.key === "g" || e.key === "G") {
        if (!pendingG.current) {
          pendingG.current = true
          if (gTimer.current) clearTimeout(gTimer.current)
          gTimer.current = setTimeout(() => {
            pendingG.current = false
          }, 1000)
          return
        }
      }

      if (pendingG.current) {
        const route = NAV_MAP[e.key.toLowerCase()]
        if (route) {
          e.preventDefault()
          pendingG.current = false
          if (gTimer.current) clearTimeout(gTimer.current)
          router.push(route)
        } else {
          pendingG.current = false
          if (gTimer.current) clearTimeout(gTimer.current)
        }
      }
    },
    [router]
  )

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown)
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      if (gTimer.current) clearTimeout(gTimer.current)
    }
  }, [handleKeyDown])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Pintasan Keyboard
          </DialogTitle>
          <DialogDescription>
            Gunakan pintasan berikut untuk navigasi lebih cepat.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-5 mt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {group.title}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) =>
                        key === "lalu" ? (
                          <span
                            key={`${shortcut.description}-sep-${i}`}
                            className="text-xs text-muted-foreground"
                          >
                            lalu
                          </span>
                        ) : (
                          <kbd
                            key={`${shortcut.description}-key-${i}`}
                            className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 text-xs font-mono font-medium border-2 border-black bg-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] rounded-none"
                          >
                            {key}
                          </kbd>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
