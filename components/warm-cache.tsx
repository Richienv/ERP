"use client"

import { useEffect } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap } from "@/hooks/use-nav-prefetch"

/**
 * Invisible component that warm-caches TanStack Query data on mount.
 * Priority routes (inventory, sales) fire immediately.
 * Remaining routes fire after a short delay.
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

    useEffect(() => {
        // Priority routes: prefetch immediately (100ms to avoid blocking first paint)
        const priorityTimer = setTimeout(() => {
            PRIORITY_ROUTES.forEach((route) => {
                const config = routePrefetchMap[route]
                if (config) {
                    queryClient.prefetchQuery({
                        queryKey: config.queryKey,
                        queryFn: config.queryFn,
                    })
                }
            })
        }, 100)

        // Remaining routes: prefetch after priority routes have had time to start
        const remainingTimer = setTimeout(() => {
            Object.entries(routePrefetchMap).forEach(([route, config]) => {
                if (!PRIORITY_ROUTES.includes(route)) {
                    queryClient.prefetchQuery({
                        queryKey: config.queryKey,
                        queryFn: config.queryFn,
                    })
                }
            })
        }, 800)

        return () => {
            clearTimeout(priorityTimer)
            clearTimeout(remainingTimer)
        }
    }, [queryClient])

    return null
}
