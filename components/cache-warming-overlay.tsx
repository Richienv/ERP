"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap, masterDataPrefetchMap } from "@/hooks/use-nav-prefetch"
import { useAuth } from "@/lib/auth-context"
import { getTierForRoute, getTierForMasterData } from "@/lib/cache-tiers"
import { CACHE_BUSTER } from "@/lib/query-client"
import {
    P1_ROUTES, P1_MASTER_DATA, P2_ROUTES, P3_ROUTES,
    P1_TOTAL, P2_TOTAL,
    PROGRESS_WEIGHTS,
} from "@/lib/prefetch-manifest"
import { IconCheck, IconLoader2, IconRefresh, IconWifiOff } from "@tabler/icons-react"
import { get } from "idb-keyval"

const SESSION_KEY = "erp_cache_warmed"
const ITEM_TIMEOUT_MS = 10_000  // 10s max per item
const FAILURE_THRESHOLD = 0.5   // >50% failures → show retry

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

/** Check if IndexedDB has persisted TanStack Query cache (not expired). */
async function hasPersistedCache(): Promise<boolean> {
    try {
        // The persister stores the entire cache under this key
        const cached = await get(`${CACHE_BUSTER}:REACT_QUERY_OFFLINE_CACHE`)
        if (!cached) return false

        // Check if the cache has actual query data (not just an empty shell)
        // The persisted format is { timestamp, buster, clientState }
        if (typeof cached === "object" && "timestamp" in cached) {
            const age = Date.now() - (cached.timestamp as number)
            const maxAge = 7 * 24 * 60 * 60 * 1000 // 7 days
            if (age > maxAge) return false
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

/** Prefetch a single route with tier-aware staleTime + 10s timeout. */
async function prefetchRoute(
    queryClient: ReturnType<typeof useQueryClient>,
    route: string,
    config: { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> },
) {
    const tier = getTierForRoute(route)
    await withTimeout(
        queryClient.prefetchQuery({
            queryKey: config.queryKey,
            queryFn: config.queryFn,
            staleTime: tier.staleTime,
            gcTime: tier.gcTime,
        }),
        ITEM_TIMEOUT_MS,
    )
}

/** Prefetch a master data key with tier-aware staleTime + 10s timeout. */
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
        ITEM_TIMEOUT_MS,
    )
}

/**
 * Batch-prefetch a list of routes.
 * Returns count of failed items. Individual failures are logged and skipped.
 */
async function batchPrefetchRoutes(
    queryClient: ReturnType<typeof useQueryClient>,
    routes: readonly string[],
    batchSize: number,
    onProgress: () => void,
    delayMs?: number,
): Promise<number> {
    let failures = 0

    // Separate routes with prefetch config from those without
    const entries: Array<readonly [string, { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }]> = []
    for (const r of routes) {
        const config = routePrefetchMap[r]
        if (config) {
            entries.push([r, config])
        } else {
            // Route in manifest but not in prefetchMap — tick progress but log warning
            if (process.env.NODE_ENV === "development") {
                console.warn(`[Prefetch] Route "${r}" in manifest but missing from routePrefetchMap`)
            }
            onProgress()
        }
    }

    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize)
        await Promise.allSettled(
            batch.map(async ([route, config]) => {
                try {
                    await prefetchRoute(queryClient, route, config)
                } catch (err) {
                    console.warn(`[Prefetch] Failed: ${route}`, err instanceof Error ? err.message : err)
                    failures++
                }
                onProgress()
            })
        )
        if (delayMs && i + batchSize < entries.length) {
            await new Promise((r) => setTimeout(r, delayMs))
        }
    }
    return failures
}

// ── Component ──────────────────────────────────────────────────────────────

export function CacheWarmingOverlay() {
    const { isAuthenticated, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()
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

        let failures = 0

        // ── P1: Critical routes + master data (progress 0–60%) ──
        failures += await batchPrefetchRoutes(queryClient, P1_ROUTES, 6, tick)

        // Master data (all in parallel)
        await Promise.allSettled(
            P1_MASTER_DATA.map((key) => {
                const config = masterDataPrefetchMap[key]
                if (!config) { tick(); return Promise.resolve() }
                return prefetchMasterData(queryClient, key, config)
                    .catch((err) => {
                        console.warn(`[Prefetch] Master data failed: ${key}`, err instanceof Error ? err.message : err)
                        failures++
                    })
                    .finally(tick)
            })
        )

        // Check for catastrophic failure after P1
        const p1Attempted = P1_TOTAL
        if (failures / p1Attempted > FAILURE_THRESHOLD) {
            setTotalFailures(failures)
            setShowRetry(true)
            return
        }

        // ── P2: Important routes (progress 60–90%) ──
        setPhase("p2")
        failures += await batchPrefetchRoutes(queryClient, P2_ROUTES, 6, tick)

        // Check for catastrophic failure after P1+P2
        const totalAttempted = P1_TOTAL + P2_TOTAL
        if (failures / totalAttempted > FAILURE_THRESHOLD) {
            setTotalFailures(failures)
            setShowRetry(true)
            return
        }

        // ── Dismiss overlay — app is interactive at 90% ──
        setPhase("p3")
        dismiss()

        // ── P3: Background (invisible) ──
        await batchPrefetchRoutes(queryClient, P3_ROUTES, 4, () => {}, 150)
        sessionStorage.setItem(SESSION_KEY, "true")
        setPhase("done")
    }, [queryClient, tick, dismiss])

    useEffect(() => {
        if (authLoading || !isAuthenticated || hasStarted.current) return
        hasStarted.current = true

        // Fast path: already warmed this session (tab refresh)
        if (sessionStorage.getItem(SESSION_KEY) === "true") {
            return
        }

        // Check IndexedDB for existing cache — if found, skip overlay entirely
        ;(async () => {
            const hasCached = await hasPersistedCache()
            if (hasCached) {
                // Cache exists in IndexedDB → PersistQueryClientProvider will hydrate it.
                // Mark session as warmed and skip the overlay.
                sessionStorage.setItem(SESSION_KEY, "true")
                return
            }

            // No cache → first login experience: full prefetch with progress bar
            setShow(true)
            await runPrefetch()
        })()
    }, [authLoading, isAuthenticated, runPrefetch])

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
