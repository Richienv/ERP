"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap, masterDataPrefetchMap } from "@/hooks/use-nav-prefetch"
import { useAuth } from "@/lib/auth-context"
import { ROUTE_TIERS, MASTER_DATA_TIERS, CACHE_TIERS, type CacheTier } from "@/lib/cache-tiers"

/**
 * Background data freshness — runs AFTER the app is interactive.
 *
 * 1. Master data prefetch: silently prefetches master data (units, brands,
 *    colors, categories, suppliers, GL accounts, etc.) for form dropdowns.
 *    Non-blocking — fires and forgets.
 *
 * 2. Window focus: invalidates T4/T5/T6 queries (dashboards, transactional,
 *    realtime) so TanStack Query refetches them in background.
 *    Master data (T1/T2/T3) is NOT refetched on focus — too stable.
 *
 * 3. Navigation: handled by TanStack Query's refetchOnMount: true (global).
 *    Cached data renders instantly, stale data refetches in background.
 */
export function useBackgroundRefresh() {
    const { isAuthenticated } = useAuth()
    const queryClient = useQueryClient()
    const hasRefreshed = useRef(false)

    // ── Background master data prefetch ──
    // Non-blocking prefetch of master data for form dropdowns.
    // Fires once after auth, no progress bar, no blocking.
    useEffect(() => {
        if (!isAuthenticated || hasRefreshed.current) return
        hasRefreshed.current = true

        // Delay 1s to let the current page finish rendering first
        const timer = setTimeout(() => {
            // Prefetch all master data for form dropdowns
            for (const [, config] of Object.entries(masterDataPrefetchMap)) {
                queryClient.prefetchQuery({
                    queryKey: config.queryKey,
                    queryFn: config.queryFn,
                })
            }
        }, 1000)

        return () => clearTimeout(timer)
    }, [isAuthenticated, queryClient])

    // ── Window focus: refetch T4/T5/T6 queries ──
    useEffect(() => {
        if (!isAuthenticated) return

        // Build sets of queryKeys for focus-refetchable tiers
        const focusRefetchKeys: Array<readonly unknown[]> = []

        // Route-based queries
        for (const [route, tierName] of Object.entries(ROUTE_TIERS)) {
            const tier = CACHE_TIERS[tierName as CacheTier]
            if (!tier.refetchOnWindowFocus) continue
            const config = routePrefetchMap[route]
            if (config) focusRefetchKeys.push(config.queryKey)
        }

        // Master data queries
        for (const [key, tierName] of Object.entries(MASTER_DATA_TIERS)) {
            const tier = CACHE_TIERS[tierName as CacheTier]
            if (!tier.refetchOnWindowFocus) continue
            const config = masterDataPrefetchMap[key]
            if (config) focusRefetchKeys.push(config.queryKey)
        }

        function handleVisibilityChange() {
            if (document.visibilityState !== "visible") return

            // Invalidate all focus-refetchable queries.
            // TanStack Query will only actually refetch queries that:
            //   1. Have an active observer (component is mounted)
            //   2. Are stale (older than their staleTime)
            for (const queryKey of focusRefetchKeys) {
                queryClient.invalidateQueries({
                    queryKey,
                    refetchType: "active",
                })
            }
        }

        document.addEventListener("visibilitychange", handleVisibilityChange)
        return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
    }, [isAuthenticated, queryClient])
}
