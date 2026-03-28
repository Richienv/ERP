"use client"

import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useRouter, usePathname } from "next/navigation"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Command as CommandPrimitive } from "cmdk"
import {
  IconBolt,
  IconClock,
  IconStar,
  IconSearch,
  IconCommand,
  IconArrowRight,
  IconArrowUpRight,
  IconMoodEmpty,
} from "@tabler/icons-react"
import { usePageHistory } from "@/hooks/use-page-history"
import {
  CMDK_ACTIONS,
  CMDK_BY_ID,
  PINNED_ACTIONS,
  MODULE_META,
  buildActionUrl,
  type CmdKAction,
} from "@/lib/cmdk-registry"
import { createCmdKFilter, recordActionUsage, getRecentActionIds } from "@/lib/cmdk-search"
import { resolveIcon } from "@/lib/cmdk-icons"
import { cn } from "@/lib/utils"

// ─── Derived collections (computed once at module level) ─────────────────────

const NAV_ACTIONS = CMDK_ACTIONS.filter((a) => a.type === "navigate")
const CREATE_ACTIONS = CMDK_ACTIONS.filter((a) => a.type !== "navigate")

// ─── Module Badge ────────────────────────────────────────────────────────────

function ModuleBadge({ module }: { module: CmdKAction["module"] }) {
  const meta = MODULE_META[module]
  return (
    <span
      className={cn(
        "shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none tracking-wider",
        meta.color
      )}
    >
      {meta.label}
    </span>
  )
}

// ─── Shortcut Hint ───────────────────────────────────────────────────────────

function ShortcutHint({ shortcut }: { shortcut: string }) {
  const parts = shortcut.split("+")
  return (
    <span className="ml-auto flex shrink-0 items-center gap-0.5">
      {parts.map((part, i) => (
        <kbd
          key={i}
          className="rounded border border-border/50 bg-muted/40 px-1 py-0.5 font-mono text-[10px] leading-none text-muted-foreground/50"
        >
          {part}
        </kbd>
      ))}
    </span>
  )
}

// ─── Type Indicator ──────────────────────────────────────────────────────────

function TypeIndicator({ type }: { type: CmdKAction["type"] }) {
  if (type === "navigate") {
    return <IconArrowUpRight className="size-3 shrink-0 text-muted-foreground/40" />
  }
  // open-dialog, open-page-form, trigger-fn → action indicator
  return <IconBolt className="size-3 shrink-0 text-amber-400" />
}

// ─── Spotlight Item ──────────────────────────────────────────────────────────

function SpotlightItem({
  onSelect,
  icon: Icon,
  iconColor,
  label,
  badge,
  typeIndicator,
  shortcut,
  suffix,
  className,
  ...props
}: {
  onSelect: () => void
  icon?: React.ComponentType<{ className?: string }>
  iconColor?: string
  label: React.ReactNode
  badge?: React.ReactNode
  typeIndicator?: React.ReactNode
  shortcut?: string
  suffix?: React.ReactNode
  className?: string
  value?: string
  keywords?: string[]
}) {
  return (
    <CommandPrimitive.Item
      onSelect={onSelect}
      className={cn(
        "group relative flex cursor-default items-center gap-3 rounded-lg px-3 py-2 text-sm outline-none select-none",
        "data-[selected=true]:bg-accent/60",
        "transition-colors duration-100",
        className
      )}
      {...props}
    >
      {/* Icon */}
      {Icon && (
        <span
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md",
            iconColor || "bg-muted"
          )}
        >
          <Icon className="size-3.5" />
        </span>
      )}

      {/* Label */}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>

      {/* Right side: badge → type → shortcut → suffix → arrow */}
      <div className="flex shrink-0 items-center gap-2">
        {badge}
        {typeIndicator}
        {shortcut && <ShortcutHint shortcut={shortcut} />}
        {suffix}
        <IconArrowRight className="size-3 text-muted-foreground/0 group-data-[selected=true]:text-muted-foreground/50 transition-colors" />
      </div>
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
        "px-2 py-1",
        "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3",
        "[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-bold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/50"
      )}
    >
      {children}
    </CommandPrimitive.Group>
  )
}

// ─── Action Item renderer ────────────────────────────────────────────────────

function ActionItem({
  action,
  onSelect,
  suffixOverride,
}: {
  action: CmdKAction
  onSelect: () => void
  suffixOverride?: React.ReactNode
}) {
  const IconComponent = resolveIcon(action.icon)
  const meta = MODULE_META[action.module]

  return (
    <SpotlightItem
      value={action.id}
      keywords={action.keywords}
      onSelect={onSelect}
      icon={IconComponent}
      iconColor={meta.color}
      label={action.label}
      badge={<ModuleBadge module={action.module} />}
      typeIndicator={<TypeIndicator type={action.type} />}
      shortcut={action.shortcut}
      suffix={suffixOverride}
    />
  )
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const router = useRouter()
  const pathname = usePathname()
  const inputRef = useRef<HTMLInputElement>(null)

  // Custom filter using our scoring engine
  const cmdkFilter = useMemo(() => createCmdKFilter(CMDK_BY_ID), [])

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

  // Reset search when closing
  useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  // Page history (existing behavior preserved)
  const { getFrequentPages, getRecentPages } = usePageHistory()
  const recentPages = open ? getRecentPages(5) : []
  const frequentPages = open ? getFrequentPages(5) : []

  // Recently used actions from our usage tracker
  const recentActions = useMemo(() => {
    if (!open) return []
    const ids = getRecentActionIds(5)
    return ids
      .map((id) => CMDK_BY_ID.get(id))
      .filter((a): a is CmdKAction => a !== undefined)
  }, [open])

  const navigate = useCallback(
    (url: string, actionId?: string) => {
      if (actionId) recordActionUsage(actionId)

      setOpen(false)
      const [targetPath, targetQuery] = url.split("?")
      if (targetPath === pathname && targetQuery) {
        router.push(`${pathname}?${targetQuery}`)
      } else {
        router.push(url)
      }
    },
    [router, pathname]
  )

  const isSearching = search.trim().length > 0

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        {/* Overlay */}
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
              filter={cmdkFilter}
            >
              {/* ─── Search input ─── */}
              <div className="flex items-center gap-3 border-b border-border/40 px-4">
                <IconSearch className="size-5 shrink-0 text-muted-foreground/60" />
                <CommandPrimitive.Input
                  ref={inputRef}
                  placeholder="Cari halaman, aksi, menu..."
                  value={search}
                  onValueChange={setSearch}
                  className={cn(
                    "flex h-14 w-full bg-transparent text-base outline-none",
                    "placeholder:text-muted-foreground/40"
                  )}
                />
                <kbd className="pointer-events-none hidden shrink-0 select-none items-center gap-0.5 rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground/60 sm:flex">
                  <IconCommand className="size-3" />K
                </kbd>
              </div>

              {/* ─── Results ─── */}
              <CommandPrimitive.List className="max-h-[min(420px,50vh)] scroll-py-2 overflow-y-auto overflow-x-hidden overscroll-contain p-1">

                {/* Empty state */}
                <CommandPrimitive.Empty className="flex flex-col items-center justify-center gap-3 py-14 text-center">
                  <div className="flex size-12 items-center justify-center rounded-xl bg-muted/50">
                    <IconMoodEmpty className="size-6 text-muted-foreground/30" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground/60">
                      Tidak ada hasil
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/40">
                      Coba kata kunci lain, dalam Bahasa Indonesia atau English
                    </p>
                  </div>
                </CommandPrimitive.Empty>

                {/* ═══════ Idle state (no search) ═══════ */}
                {!isSearching && (
                  <>
                    {/* Terbaru — recent pages */}
                    {recentPages.length > 0 && (
                      <SpotlightGroup heading="Terbaru">
                        {recentPages.map((page) => (
                          <SpotlightItem
                            key={`recent-${page.url}`}
                            onSelect={() => navigate(page.url)}
                            icon={IconClock}
                            iconColor="bg-muted text-muted-foreground"
                            label={page.label}
                          />
                        ))}
                      </SpotlightGroup>
                    )}

                    {/* Terbaru — recent actions */}
                    {recentActions.length > 0 && (
                      <SpotlightGroup heading="Aksi Terakhir">
                        {recentActions.map((action) => (
                          <ActionItem
                            key={`recent-act-${action.id}`}
                            action={action}
                            onSelect={() => navigate(buildActionUrl(action), action.id)}
                            suffixOverride={
                              <IconClock className="size-3 text-muted-foreground/30" />
                            }
                          />
                        ))}
                      </SpotlightGroup>
                    )}

                    {/* Sering Digunakan — frequent pages */}
                    {frequentPages.length > 0 && (
                      <SpotlightGroup heading="Sering Digunakan">
                        {frequentPages.map((page) => (
                          <SpotlightItem
                            key={`frequent-${page.url}`}
                            onSelect={() => navigate(page.url)}
                            icon={IconStar}
                            iconColor="bg-amber-50 text-amber-500"
                            label={page.label}
                            suffix={
                              <span className="tabular-nums text-[10px] font-medium text-muted-foreground/40">
                                {page.count}x
                              </span>
                            }
                          />
                        ))}
                      </SpotlightGroup>
                    )}

                    {/* Aksi Cepat — pinned */}
                    <SpotlightGroup heading="Aksi Cepat">
                      {PINNED_ACTIONS.map((action) => (
                        <ActionItem
                          key={action.id}
                          action={action}
                          onSelect={() => navigate(buildActionUrl(action), action.id)}
                        />
                      ))}
                    </SpotlightGroup>
                  </>
                )}

                {/* ═══════ Search results (always rendered so cmdk can filter) ═══════ */}

                {/* Aksi group — create actions */}
                <SpotlightGroup heading="Aksi">
                  {CREATE_ACTIONS.map((action) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      onSelect={() => navigate(buildActionUrl(action), action.id)}
                    />
                  ))}
                </SpotlightGroup>

                {/* Halaman group — navigation */}
                <SpotlightGroup heading="Halaman">
                  {NAV_ACTIONS.map((action) => (
                    <ActionItem
                      key={action.id}
                      action={action}
                      onSelect={() => navigate(buildActionUrl(action), action.id)}
                    />
                  ))}
                </SpotlightGroup>

              </CommandPrimitive.List>

              {/* ─── Footer ─── */}
              <div className="flex items-center justify-between border-t border-border/40 px-4 py-2">
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
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
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
                  <span className="flex items-center gap-1">
                    <IconBolt className="size-3 text-amber-400/60" />
                    aksi
                  </span>
                  <span className="flex items-center gap-1">
                    <IconArrowUpRight className="size-3 text-muted-foreground/30" />
                    halaman
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
