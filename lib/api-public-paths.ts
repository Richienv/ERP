/**
 * API routes that stay reachable without a logged-in session.
 * Everything else under /api must return 401 JSON from middleware.
 */
export const PUBLIC_API_PATHS = [
    "/api/health",
    "/api/tenant",
    "/api/xendit/webhook",
    "/api/dev/local-demo",
] as const

export function isPublicApiPath(pathname: string): boolean {
    return PUBLIC_API_PATHS.some(
        (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
}
