"use client"

import { useEffect, useRef } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap, masterDataPrefetchMap } from "@/hooks/use-nav-prefetch"
import { useAuth } from "@/lib/auth-context"
import { ROUTE_TIERS, MASTER_DATA_TIERS, CACHE_TIERS, type CacheTier } from "@/lib/cache-tiers"
import { P1_ROUTES, P1_MASTER_DATA } from "@/lib/prefetch-manifest"
import { prefetchComplete } from "@/lib/query-client"

/**
 * Background data freshness — runs AFTER the app is interactive.
 *
 * 1. Post-hydration: silently refetches P1 data to pick up any changes
 *    since the IndexedDB snapshot. Completely invisible to user.
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

    // ── Post-hydration: silently refetch P1 data ──
    useEffect(() => {
        if (!isAuthenticated || hasRefreshed.current) return
        hasRefreshed.current = true

        // Delay to let the app settle after hydration / prefetch completion
        const timer = setTimeout(() => {
            // Silently refetch P1 routes — uses staleTime to skip fresh data
            for (const route of P1_ROUTES) {
                const config = routePrefetchMap[route]
                if (!config) continue
                queryClient.invalidateQueries({
                    queryKey: config.queryKey,
                    refetchType: "active",  // only refetch if a component is mounted using this key
                })
            }

            // Silently refetch P1 master data
            for (const key of P1_MASTER_DATA) {
                const config = masterDataPrefetchMap[key]
                if (!config) continue
                queryClient.invalidateQueries({
                    queryKey: config.queryKey,
                    refetchType: "active",
                })
            }
        }, 3000) // 3s after mount — app is settled, don't compete with initial render

        return () => clearTimeout(timer)
    }, [isAuthenticated, queryClient])

    // ── Dev: post-prefetch fetch detector ──
    // Logs a warning whenever a query fetches AFTER prefetch has completed.
    // This reveals cache misses — queries that SHOULD have been prefetched but weren't.
    useEffect(() => {
        if (process.env.NODE_ENV !== "development" || !isAuthenticated) return

        const cache = queryClient.getQueryCache()
        const unsubscribe = cache.subscribe((event) => {
            if (!prefetchComplete) return
            if (event.type !== "updated" || event.action.type !== "fetch") return
            // Skip queries that were previously cached — these are intentional refreshes
            // (e.g. background refresh, window focus), not true cache misses
            if (event.query.state.dataUpdateCount > 1) return
            const key = event.query.queryKey
            console.warn("[POST-PREFETCH FETCH]", JSON.stringify(key), "— this should have been cached!")
        })

        return unsubscribe
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
            // This means only the data the user is currently viewing gets refetched.
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
