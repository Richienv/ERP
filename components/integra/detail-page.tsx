"use client"
import * as React from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export type Tab = { key: string; label: React.ReactNode; content: React.ReactNode }
export type Crumb = { label: string; href: string }

/**
 * DetailPage — sticky-header + tabs shell for any detail/show page.
 *
 * - Sticky breadcrumb + title/subtitle/actions header
 * - Sticky ARIA tablist (role=tablist, role=tab, aria-selected, aria-controls)
 * - Tab content panel (role=tabpanel, aria-labelledby)
 * - URL hash sync: clicking a tab updates `#tab-key`, mounting reads hash
 * - Keyboard nav: ArrowLeft/Right move between tabs, Home/End jump to ends
 * - Empty `tabs` array → no tablist rendered, no crash
 */
export function DetailPage({
    breadcrumb,
    title,
    subtitle,
    status,
    meta,
    actions,
    tabs,
    defaultTab,
}: {
    breadcrumb: Crumb[]
    title: React.ReactNode
    subtitle?: React.ReactNode
    status?: React.ReactNode
    meta?: React.ReactNode
    actions?: React.ReactNode
    tabs: Tab[]
    defaultTab?: string
}) {
    const idBase = React.useId()
    const tabId = (key: string) => `${idBase}-tab-${key}`
    const panelId = (key: string) => `${idBase}-panel-${key}`

    const [activeTab, setActiveTab] = React.useState<string | undefined>(
        defaultTab ?? tabs[0]?.key,
    )

    // Read URL hash on mount (SSR-safe via useEffect)
    React.useEffect(() => {
        if (typeof window === "undefined") return
        const hash = window.location.hash.slice(1)
        if (hash && tabs.some((t) => t.key === hash)) {
            setActiveTab(hash)
        }
        // intentionally only runs on mount; tabs identity stable for the page lifetime
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const handleTabSelect = React.useCallback((key: string) => {
        setActiveTab(key)
        if (typeof window !== "undefined") {
            window.history.replaceState(null, "", `#${key}`)
        }
    }, [])

    const handleKeyDown = React.useCallback(
        (e: React.KeyboardEvent<HTMLDivElement>) => {
            if (tabs.length === 0) return
            const currentIdx = tabs.findIndex((t) => t.key === activeTab)
            let nextIdx = currentIdx
            if (e.key === "ArrowRight") {
                nextIdx = (currentIdx + 1) % tabs.length
            } else if (e.key === "ArrowLeft") {
                nextIdx = (currentIdx - 1 + tabs.length) % tabs.length
            } else if (e.key === "Home") {
                nextIdx = 0
            } else if (e.key === "End") {
                nextIdx = tabs.length - 1
            } else {
                return
            }
            e.preventDefault()
            const nextKey = tabs[nextIdx].key
            handleTabSelect(nextKey)
            // Move focus to the newly selected tab button
            const nextEl = document.getElementById(tabId(nextKey))
            if (nextEl instanceof HTMLElement) nextEl.focus()
        },
        // tabId is stable derived from idBase
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [tabs, activeTab, handleTabSelect],
    )

    const active = tabs.find((t) => t.key === activeTab) ?? tabs[0]

    return (
        <>
            {/* Sticky header */}
            <div className="sticky top-0 bg-[var(--integra-canvas)] z-20 border-b border-[var(--integra-hairline)] px-6 py-3">
                {breadcrumb.length > 0 && (
                    <nav
                        aria-label="Breadcrumb"
                        className="flex items-center gap-1.5 text-[12px] text-[var(--integra-muted)] mb-2"
                    >
                        {breadcrumb.map((c, i) => (
                            <React.Fragment key={`${c.href}-${i}`}>
                                {i > 0 && <span className="opacity-50" aria-hidden="true">/</span>}
                                <Link
                                    href={c.href}
                                    className="hover:text-[var(--integra-ink)]"
                                >
                                    {c.label}
                                </Link>
                            </React.Fragment>
                        ))}
                        <span className="opacity-50" aria-hidden="true">/</span>
                        <span
                            className="text-[var(--integra-ink)]"
                            aria-current="page"
                        >
                            {title}
                        </span>
                    </nav>
                )}
                <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                        <div className="flex items-center gap-3">
                            <h1 className="font-display font-medium text-[20px] text-[var(--integra-ink)] truncate">
                                {title}
                            </h1>
                            {status}
                        </div>
                        {subtitle && (
                            <p className="text-[12.5px] text-[var(--integra-muted)] mt-1">
                                {subtitle}
                            </p>
                        )}
                        {meta && <div className="mt-2">{meta}</div>}
                    </div>
                    {actions && (
                        <div className="flex items-center gap-2 shrink-0">{actions}</div>
                    )}
                </div>
            </div>

            {/* Sticky tab bar */}
            {tabs.length > 0 && (
                <div className="sticky top-[var(--detail-header-h,80px)] bg-[var(--integra-canvas)] z-10 border-b border-[var(--integra-hairline)] px-6">
                    <div
                        role="tablist"
                        aria-label="Detail tabs"
                        className="flex gap-0.5"
                        onKeyDown={handleKeyDown}
                    >
                        {tabs.map((t) => {
                            const isActive = activeTab === t.key
                            return (
                                <button
                                    key={t.key}
                                    id={tabId(t.key)}
                                    role="tab"
                                    type="button"
                                    aria-selected={isActive}
                                    aria-controls={panelId(t.key)}
                                    tabIndex={isActive ? 0 : -1}
                                    data-tab={t.key}
                                    onClick={() => handleTabSelect(t.key)}
                                    className={cn(
                                        "px-3 py-2 text-[12.5px] font-mono outline-none focus-visible:ring-2 focus-visible:ring-[var(--integra-ink)]",
                                        isActive
                                            ? "text-[var(--integra-ink)] border-b-2 border-[var(--integra-ink)]"
                                            : "text-[var(--integra-muted)] hover:text-[var(--integra-ink)]",
                                    )}
                                >
                                    {t.label}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* Tab content */}
            {active && (
                <div
                    role="tabpanel"
                    id={panelId(active.key)}
                    aria-labelledby={tabId(active.key)}
                    tabIndex={0}
                    className="px-6 py-5 outline-none"
                >
                    {active.content}
                </div>
            )}
        </>
    )
}
