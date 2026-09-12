/**
 * Helpers for the top-of-app navigation progress bar.
 * Pure functions so click-intent can start the bar before the route commits.
 */

const SKIP_PREFIXES = ["#", "mailto:", "tel:", "javascript:"]

export function resolveNavHrefFromLink(
    link: { href: string | null; target: string | null; download: boolean },
    currentPath: string,
    origin: string,
    currentSearch = "",
): string | null {
    const href = link.href
    if (!href) return null
    if (SKIP_PREFIXES.some((prefix) => href.startsWith(prefix))) return null
    if (link.download) return null
    if (link.target && link.target !== "_self") return null

    let url: URL
    try {
        url = new URL(href, origin)
    } catch {
        return null
    }

    if (url.origin !== origin) return null

    const next = `${url.pathname}${url.search}`
    const current = `${currentPath}${currentSearch}`
    if (next === current) return null

    return next
}

export function resolveInternalNavHref(
    target: EventTarget | null,
    currentPath: string,
    origin: string,
    currentSearch = "",
): string | null {
    if (!(target instanceof Element)) return null
    const anchor = target.closest("a[href]")
    if (!anchor) return null

    return resolveNavHrefFromLink(
        {
            href: anchor.getAttribute("href"),
            target: anchor.getAttribute("target"),
            download: anchor.getAttribute("download") !== null,
        },
        currentPath,
        origin,
        currentSearch,
    )
}

export function isModifiedClick(event: Pick<MouseEvent, "metaKey" | "ctrlKey" | "shiftKey" | "altKey" | "button">) {
    return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}
