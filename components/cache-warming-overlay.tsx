"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap, masterDataPrefetchMap } from "@/hooks/use-nav-prefetch"
import { useAuth } from "@/lib/auth-context"
import { getTierForRoute, getTierForMasterData } from "@/lib/cache-tiers"
import { CACHE_BUSTER, markPrefetchComplete } from "@/lib/query-client"
import {
    P1_ROUTES, P1_MASTER_DATA, P2_ROUTES, P3_ROUTES,
    P1_TOTAL, P2_TOTAL,
    PROGRESS_WEIGHTS,
} from "@/lib/prefetch-manifest"
import { IconCheck, IconLoader2, IconRefresh, IconWifiOff } from "@tabler/icons-react"
import { get } from "idb-keyval"
import { createClient } from "@/lib/supabase/client"

const SESSION_KEY = "erp_cache_warmed"
const FAILURE_THRESHOLD = 0.7   // >70% failures → show retry (was 0.5 — too aggressive)

// Phase-aware timeouts — reduced after migration from server actions to API routes
const TIMEOUT_MS = {
    P1: 10_000,  // 10s — critical routes (API routes respond in <3s typically)
    P2: 12_000,  // 12s — important routes
    P3: 15_000,  // 15s — background, lenient
    MASTER: 10_000,  // 10s — master data (small payloads, fast)
} as const

// Max concurrent prefetch queries — API routes handle parallelism well
const MAX_CONCURRENCY = 8

/**
 * Three-phase cache warmer modeled after native app install:
 *
 * FIRST LOGIN (no cache):
 *   Phase 1 (P1 — visible, 0–60%): Landing pages + master data. MANDATORY.
 *   Phase 2 (P2 — visible, 60–90%): Second-click pages. MANDATORY.
 *   Phase 3 (P3 — silent, 90–100%): Everything else. Background.
 *   NO "Lewati" BUTTON — only "Coba Lagi" on catastrophic failure.
 *
 * SUBSEQUENT VISIT (cache exists in IndexedDB):
 *   Skip overlay entirely → hydrate from IndexedDB → instant.
 */

// ── Helpers ────────────────────────────────────────────────────────────────

const isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development"

/**
 * Check if IndexedDB has persisted TanStack Query cache with SUFFICIENT data.
 *
 * A partial cache (e.g., 2-3 items from an aborted prefetch) must NOT bypass
 * the overlay. We require at least P1_TOTAL (22) queries to consider the cache
 * "warm enough" to skip the loading screen.
 */
async function hasPersistedCache(): Promise<boolean> {
    try {
        // The persister stores the entire cache under this key
        const cached = await get(`${CACHE_BUSTER}:REACT_QUERY_OFFLINE_CACHE`)
        if (!cached || typeof cached !== "object") return false

        // Check expiry — the persisted format is { timestamp, buster, clientState }
        if ("timestamp" in cached) {
            const age = Date.now() - (cached.timestamp as number)
            const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
            if (age > maxAge) return false
        }

        // Check that the cache has meaningful data — not just an empty shell or
        // a partial cache from a previous aborted prefetch run.
        // Require at least P1_TOTAL queries to consider the cache "warm".
        if ("clientState" in cached) {
            const state = (cached as Record<string, unknown>).clientState as Record<string, unknown> | undefined
            const queries = state?.queries
            const queryCount = Array.isArray(queries) ? queries.length : 0
            if (queryCount < P1_TOTAL) {
                if (isDev) {
                    console.log(`[Prefetch] IndexedDB has ${queryCount} queries, need ${P1_TOTAL} — running full prefetch`)
                }
                return false
            }
        } else {
            return false
        }

        return true
    } catch {
        return false
    }
}

/** Wrap a promise with a timeout. Rejects if timeout expires. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        promise.then(
            (v) => { clearTimeout(timer); resolve(v) },
            (e) => { clearTimeout(timer); reject(e) },
        )
    })
}

/**
 * Semaphore-based concurrency limiter.
 * Runs up to `limit` tasks concurrently, queuing the rest.
 */
async function runWithConcurrency<T>(
    tasks: Array<() => Promise<T>>,
    limit: number,
): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = new Array(tasks.length)
    let nextIndex = 0

    async function worker() {
        while (nextIndex < tasks.length) {
            const idx = nextIndex++
            try {
                const value = await tasks[idx]()
                results[idx] = { status: "fulfilled", value }
            } catch (reason) {
                results[idx] = { status: "rejected", reason }
            }
        }
    }

    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker())
    await Promise.all(workers)
    return results
}

/** Prefetch a single route with tier-aware staleTime + phase timeout. */
async function prefetchRoute(
    queryClient: ReturnType<typeof useQueryClient>,
    route: string,
    config: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> },
    timeoutMs: number,
) {
    const tier = getTierForRoute(route)
    await withTimeout(
        queryClient.prefetchQuery({
            queryKey: config.queryKey,
            queryFn: config.queryFn,
            staleTime: tier.staleTime,
            gcTime: tier.gcTime,
        }),
        timeoutMs,
    )
}

/** Prefetch a master data key with tier-aware staleTime + timeout. */
async function prefetchMasterData(
    queryClient: ReturnType<typeof useQueryClient>,
    key: string,
    config: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> },
) {
    const tier = getTierForMasterData(key)
    await withTimeout(
        queryClient.prefetchQuery({
            queryKey: config.queryKey,
            queryFn: config.queryFn,
            staleTime: tier.staleTime,
            gcTime: tier.gcTime,
        }),
        TIMEOUT_MS.MASTER,
    )
}

/**
 * Batch-prefetch a list of routes using a concurrency-limited pool.
 * Returns count of failed items. Individual failures are logged and skipped.
 */
async function batchPrefetchRoutes(
    queryClient: ReturnType<typeof useQueryClient>,
    routes: readonly string[],
    onProgress: () => void,
    timeoutMs: number,
    preloadRoute?: (url: string) => void,
): Promise<{ failures: number; details: Array<{ route: string; status: "ok" | "fail" | "timeout" | "skip"; ms: number; error?: string }> }> {
    let failures = 0
    const details: Array<{ route: string; status: "ok" | "fail" | "timeout" | "skip"; ms: number; error?: string }> = []

    // Separate routes with prefetch config from those without
    const withConfig: Array<readonly [string, { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }]> = []
    for (const r of routes) {
        const config = routePrefetchMap[r]
        if (config) {
            withConfig.push([r, config])
        } else {
            // Route in manifest but not in prefetchMap — tick progress but log warning
            if (isDev) {
                console.warn(`[Prefetch] SKIP: "${r}" in manifest but missing from routePrefetchMap`)
            }
            details.push({ route: r, status: "skip", ms: 0 })
            onProgress()
        }
    }

    // Build task list for concurrency limiter
    const tasks = withConfig.map(([route, config]) => async () => {
        const t0 = performance.now()
        if (isDev) console.log(`[Prefetch] START: ${route}`)

        // Preload Next.js JS chunk in parallel with data fetch
        if (preloadRoute) {
            const cleanRoute = route.split("#")[0]
            preloadRoute(cleanRoute)
        }

        try {
            await prefetchRoute(queryClient, route, config, timeoutMs)
            const ms = Math.round(performance.now() - t0)
            if (isDev) console.log(`[Prefetch] OK: ${route} (${ms}ms)`)
            details.push({ route, status: "ok", ms })
        } catch (err) {
            const ms = Math.round(performance.now() - t0)
            const errMsg = err instanceof Error ? err.message : String(err)
            const status = errMsg.includes("Timeout") ? "timeout" : "fail"
            if (isDev) console.warn(`[Prefetch] ${status.toUpperCase()}: ${route} — ${errMsg} (${ms}ms)`)
            details.push({ route, status, ms, error: errMsg })
            failures++
        }
        onProgress()
    })

    // Run with concurrency limiter instead of fixed batches
    await runWithConcurrency(tasks, MAX_CONCURRENCY)

    return { failures, details }
}

// ── Component ──────────────────────────────────────────────────────────────

export function CacheWarmingOverlay() {
    const { isAuthenticated, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()
    const router = useRouter()
    const hasStarted = useRef(false)

    const [show, setShow] = useState(false)
    const [fadeOut, setFadeOut] = useState(false)
    const [itemsDone, setItemsDone] = useState(0)
    const [phase, setPhase] = useState<"p1" | "p2" | "p3" | "done">("p1")
    const [totalFailures, setTotalFailures] = useState(0)

    // Reset hasStarted when user logs out — allows overlay to re-trigger on next login
    // even if the component persists across client-side navigation (router.push)
    useEffect(() => {
        if (!isAuthenticated && !authLoading) {
            hasStarted.current = false
        }
    }, [isAuthenticated, authLoading])
    const [showRetry, setShowRetry] = useState(false)

    const dismiss = useCallback(() => {
        setFadeOut(true)
        setTimeout(() => setShow(false), 300)
    }, [])

    const tick = useCallback(() => setItemsDone((prev) => prev + 1), [])

    const runPrefetch = useCallback(async () => {
        setShowRetry(false)
        setTotalFailures(0)
        setItemsDone(0)
        setPhase("p1")

        // ── Proactive token refresh — ensures a fresh JWT that won't expire during prefetch ──
        const supabase = createClient()
        try {
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) {
                console.warn('[Prefetch] Token pre-refresh failed:', refreshError.message)
            } else if (isDev) {
                console.log('[Prefetch] Token refreshed before starting')
            }
        } catch (err) {
            console.warn('[Prefetch] Token pre-refresh threw:', err)
        }

        // Periodic token refresh during prefetch (every 45s) to prevent expiry mid-flight
        const refreshInterval = setInterval(async () => {
            try {
                await supabase.auth.refreshSession()
                if (isDev) console.log('[Prefetch] Periodic token refresh OK')
            } catch { /* silent — non-critical */ }
        }, 45_000)

        if (isDev) console.log(`[Prefetch] Starting — P1=${P1_ROUTES.length}+${P1_MASTER_DATA.length}md, P2=${P2_ROUTES.length}, P3=${P3_ROUTES.length}, concurrency=${MAX_CONCURRENCY}`)
        const t0 = performance.now()

        let failures = 0

        // ── P1: Critical routes + master data (progress 0–60%) ──
        // NOTE: No router.prefetch() here — only data fetches via /api/ routes.
        // router.prefetch() goes through middleware which can cause auth race conditions
        // during concurrent prefetching. Route chunks are preloaded AFTER all data phases.
        if (isDev) console.log("[Prefetch] Phase P1: critical routes...")
        const p1Result = await batchPrefetchRoutes(queryClient, P1_ROUTES, tick, TIMEOUT_MS.P1)
        failures += p1Result.failures

        // Master data — also concurrency-limited (not all-at-once)
        if (isDev) console.log("[Prefetch] Phase P1: master data...")
        const mdTasks = P1_MASTER_DATA.map((key) => async () => {
            const t1 = performance.now()
            const config = masterDataPrefetchMap[key]
            if (!config) {
                if (isDev) console.warn(`[Prefetch] SKIP: master data "${key}" missing from masterDataPrefetchMap`)
                tick()
                return
            }
            if (isDev) console.log(`[Prefetch] START: md:${key}`)
            try {
                await prefetchMasterData(queryClient, key, config)
                if (isDev) console.log(`[Prefetch] OK: md:${key} (${Math.round(performance.now() - t1)}ms)`)
            } catch (err) {
                const errMsg = err instanceof Error ? err.message : String(err)
                if (isDev) console.warn(`[Prefetch] FAIL: md:${key} — ${errMsg} (${Math.round(performance.now() - t1)}ms)`)
                failures++
            }
            tick()
        })
        await runWithConcurrency(mdTasks, MAX_CONCURRENCY)

        const p1Ms = Math.round(performance.now() - t0)
        const p1Ok = P1_TOTAL - failures
        if (isDev) console.log(`[Prefetch] P1 Summary: ${p1Ok}/${P1_TOTAL} OK, ${failures} FAIL (total ${p1Ms}ms)`)

        // Check for catastrophic failure after P1 — only if CRITICAL routes fail massively
        if (failures / P1_TOTAL > FAILURE_THRESHOLD) {
            setTotalFailures(failures)
            setShowRetry(true)
            return
        }

        // ── P2: Important routes (progress 60–90%) ──
        if (isDev) console.log("[Prefetch] Phase P2: important routes...")
        setPhase("p2")
        const p2Result = await batchPrefetchRoutes(queryClient, P2_ROUTES, tick, TIMEOUT_MS.P2)
        failures += p2Result.failures

        const p2Ms = Math.round(performance.now() - t0)
        const p2Ok = (P1_TOTAL + P2_TOTAL) - failures
        if (isDev) console.log(`[Prefetch] P2 Summary: ${p2Ok}/${P1_TOTAL + P2_TOTAL} OK, ${failures} total FAIL (total ${p2Ms}ms)`)

        // Check for catastrophic failure after P1+P2
        if (failures / (P1_TOTAL + P2_TOTAL) > FAILURE_THRESHOLD) {
            setTotalFailures(failures)
            setShowRetry(true)
            return
        }

        // ── Dismiss overlay — app is interactive at 90% ──
        if (isDev) console.log("[Prefetch] P1+P2 complete — dismissing overlay, starting P3 in background")
        setPhase("p3")
        markPrefetchComplete()
        dismiss()

        // ── P3: Background (invisible) — use longer timeout, no UI ──
        await batchPrefetchRoutes(queryClient, P3_ROUTES, () => {}, TIMEOUT_MS.P3)
        sessionStorage.setItem(SESSION_KEY, "true")
        setPhase("done")

        // Stop periodic token refresh
        clearInterval(refreshInterval)

        if (isDev) console.log(`[Prefetch] All done — total ${Math.round(performance.now() - t0)}ms`)

        // ── Deferred route code-chunk preloading ──
        // Done AFTER all data phases to avoid middleware auth race conditions.
        // router.prefetch() hits middleware (unlike /api/ fetches), so we run these
        // sequentially after the session is stable and all data is cached.
        setTimeout(() => {
            const allRoutes = [...P1_ROUTES, ...P2_ROUTES, ...P3_ROUTES]
            const uniqueRoutes = [...new Set(allRoutes.map(r => r.split("#")[0]))]
            for (const route of uniqueRoutes) {
                try { router.prefetch(route) } catch {}
            }
            if (isDev) console.log(`[Prefetch] Deferred route chunk preload: ${uniqueRoutes.length} routes`)
        }, 500)
    }, [queryClient, tick, dismiss, router])

    useEffect(() => {
        if (authLoading || !isAuthenticated || hasStarted.current) {
            if (isDev && hasStarted.current) console.log("[Prefetch] Skipping — already started")
            return
        }
        hasStarted.current = true

        // Fast path: already warmed this session (tab refresh)
        if (sessionStorage.getItem(SESSION_KEY) === "true") {
            if (isDev) console.log("[Prefetch] Skipping — sessionStorage flag set")
            return
        }

        // Check IndexedDB for existing cache — if found, skip overlay entirely
        // but still preload route code chunks in the background
        ;(async () => {
            const hasCached = await hasPersistedCache()
            if (hasCached) {
                // Cache exists in IndexedDB with sufficient data.
                // persistQueryClient() will hydrate it in the background.
                if (isDev) console.log("[Prefetch] Skipping overlay — IndexedDB has sufficient cached data")
                sessionStorage.setItem(SESSION_KEY, "true")

                // Still preload JS code chunks for all routes (silent, no UI)
                const allRoutes = [...P1_ROUTES, ...P2_ROUTES, ...P3_ROUTES]
                const uniqueRoutes = [...new Set(allRoutes.map(r => r.split("#")[0]))]
                for (const route of uniqueRoutes) {
                    try { router.prefetch(route) } catch {}
                }
                return
            }

            // No cache (or insufficient) → first login experience: full prefetch
            if (isDev) console.log("[Prefetch] No sufficient cache found — showing overlay")
            setShow(true)
            await runPrefetch()
        })()
    }, [authLoading, isAuthenticated, runPrefetch, router])

    if (!show) return null

    // ── Weighted progress calculation ──
    const { P1_START, P1_END, P2_START, P2_END } = PROGRESS_WEIGHTS
    let pct: number
    if (phase === "p1") {
        const p1Progress = P1_TOTAL > 0 ? Math.min(itemsDone / P1_TOTAL, 1) : 0
        pct = P1_START + p1Progress * (P1_END - P1_START)
    } else if (phase === "p2") {
        const p2Done = itemsDone - P1_TOTAL
        const p2Progress = P2_TOTAL > 0 ? Math.min(p2Done / P2_TOTAL, 1) : 0
        pct = P2_START + p2Progress * (P2_END - P2_START)
    } else {
        pct = 100
    }
    pct = Math.round(pct)
    const allDone = phase === "p3" || phase === "done"

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white/98 dark:bg-zinc-950/98 backdrop-blur-sm transition-opacity duration-300 ${fadeOut ? "opacity-0" : "opacity-100"}`}
        >
            <div className="w-full max-w-sm mx-6 text-center space-y-6">
                {/* Logo */}
                <div className="flex justify-center">
                    <div className="w-12 h-12 bg-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <span className="text-emerald-400 font-bold text-xl font-heading">E</span>
                    </div>
                </div>

                {/* Title */}
                <div>
                    <h2 className="text-lg font-bold font-heading text-black dark:text-white">
                        {showRetry ? "Koneksi Bermasalah" : "Mempersiapkan Sistem"}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                        {showRetry
                            ? `${totalFailures} item gagal diunduh — periksa koneksi internet Anda`
                            : "Mengunduh data agar semua halaman terbuka instan"
                        }
                    </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 border-2 border-black overflow-hidden">
                        <div
                            className={`h-full transition-all duration-500 ease-out ${showRetry ? "bg-red-500" : "bg-emerald-500"}`}
                            style={{ width: `${allDone ? 100 : pct}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 font-mono">
                            {showRetry ? (
                                <span className="flex items-center gap-1 text-red-500">
                                    <IconWifiOff size={12} /> Gagal
                                </span>
                            ) : allDone ? (
                                <span className="flex items-center gap-1 text-emerald-600">
                                    <IconCheck size={12} /> Siap
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <IconLoader2 size={12} className="animate-spin" />
                                    {phase === "p1" ? "Mengunduh data utama..." : "Mengunduh data modul..."}
                                </span>
                            )}
                        </span>
                        <span className={`font-mono font-bold ${showRetry ? "text-red-500" : "text-zinc-400"}`}>
                            {allDone ? "100" : pct}%
                        </span>
                    </div>
                </div>

                {/* Retry button — ONLY shown on catastrophic failure, NEVER a skip button */}
                {showRetry && (
                    <button
                        onClick={runPrefetch}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white border-2 border-black text-xs font-bold uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(0,0,0,0.2)] hover:shadow-[1px_1px_0px_0px_rgba(0,0,0,0.2)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                        <IconRefresh size={14} />
                        Coba Lagi
                    </button>
                )}
            </div>
        </div>
    )
}
