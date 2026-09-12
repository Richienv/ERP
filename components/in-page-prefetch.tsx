"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

import { useNavPrefetch } from "@/hooks/use-nav-prefetch"

function internalPath(href: string | null, origin: string): string | null {
    if (!href) return null
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) {
        return null
    }
    try {
        const url = new URL(href, origin)
        if (url.origin !== origin) return null
        return url.pathname
    } catch {
        return null
    }
}

/**
 * Warm route data for in-page links (dashboard cards, table rows, quick actions),
 * not only the sidebar. Hover starts the same prefetch map the nav uses.
 */
export function InPagePrefetch() {
    const pathname = usePathname()
    const { prefetchRoute } = useNavPrefetch()

    useEffect(() => {
        const origin = window.location.origin

        const onPointerEnter = (event: PointerEvent) => {
            const target = event.target
            if (!(target instanceof Element)) return
            const anchor = target.closest("a[href]")
            if (!anchor) return
            const next = internalPath(anchor.getAttribute("href"), origin)
            if (!next || next === pathname) return
            prefetchRoute(next)
        }

        document.addEventListener("pointerenter", onPointerEnter, true)
        return () => document.removeEventListener("pointerenter", onPointerEnter, true)
    }, [pathname, prefetchRoute])

    useEffect(() => {
        const origin = window.location.origin
        const seen = new Set<string>()
        const io = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue
                    const next = internalPath(entry.target.getAttribute("href"), origin)
                    if (!next || next === pathname || seen.has(next)) continue
                    seen.add(next)
                    prefetchRoute(next)
                }
            },
            { rootMargin: "160px" },
        )

        const scan = () => {
            document.querySelectorAll("a[href]").forEach((anchor) => io.observe(anchor))
        }
        scan()
        const retry = window.setTimeout(scan, 400)

        return () => {
            window.clearTimeout(retry)
            io.disconnect()
        }
    }, [pathname, prefetchRoute])

    return null
}
