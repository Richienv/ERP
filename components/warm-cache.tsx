"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap, masterDataPrefetchMap } from "@/hooks/use-nav-prefetch"

/**
 * Invisible component that warm-caches BOTH:
 * 1. TanStack Query data (API responses) — so useQuery renders instantly from cache
 * 2. Next.js routes (RSC payload + JS chunks) — so navigation doesn't stall
 *
 * Without #2, clicking a nav link still fetches the RSC payload from the server,
 * causing a visible delay even when TanStack data is already cached.
 * The sidebar's <Link prefetch> only works for VISIBLE links — collapsed sections
 * never trigger the Intersection Observer, so those routes stay un-prefetched.
 */

const PRIORITY_ROUTES = [
    "/inventory/products",
    "/inventory/categories",
    "/sales/customers",
    "/sales/orders",
    "/sales/leads",
    "/sales/sales",
]

export function WarmCache() {
    const queryClient = useQueryClient()
    const router = useRouter()

    useEffect(() => {
        // Phase 1: Priority routes — data + Next.js route prefetch
        const priorityTimer = setTimeout(() => {
            PRIORITY_ROUTES.forEach((route) => {
                const config = routePrefetchMap[route]
                if (config) {
                    queryClient.prefetchQuery({
                        queryKey: config.queryKey,
                        queryFn: config.queryFn,
                    })
                }
                // Prefetch RSC payload + JS chunks so navigation is instant
                router.prefetch(route)
            })

            // Also warm master data for form dialogs
            Object.values(masterDataPrefetchMap).forEach(config => {
                queryClient.prefetchQuery({
                    queryKey: config.queryKey,
                    queryFn: config.queryFn,
                })
            })
        }, 100)

        // Phase 2: Remaining routes — data + Next.js route prefetch
        const remainingTimer = setTimeout(() => {
            Object.entries(routePrefetchMap).forEach(([route, config]) => {
                if (!PRIORITY_ROUTES.includes(route)) {
                    queryClient.prefetchQuery({
                        queryKey: config.queryKey,
                        queryFn: config.queryFn,
                    })
                    // Prefetch Next.js route (skip companion #hash entries —
                    // they share the same route segment as the parent)
                    if (!route.includes("#")) {
                        router.prefetch(route)
                    }
                }
            })
        }, 800)

        return () => {
            clearTimeout(priorityTimer)
            clearTimeout(remainingTimer)
        }
    }, [queryClient, router])

    return null
}
