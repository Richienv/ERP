/**
 * Routes that opt into the Integra design shell (sidebar + topbar).
 *
 * Add a route prefix here when its page has been migrated to Integra style.
 * Routes not in this set fall back to the legacy NB shell.
 */

export const INTEGRA_ROUTE_PREFIXES: string[] = [
    "/dashboard",
]

export function isIntegraRoute(pathname: string): boolean {
    return INTEGRA_ROUTE_PREFIXES.some(
        (p) => pathname === p || pathname.startsWith(p + "/"),
    )
}
