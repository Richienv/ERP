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
const FAILURE_THRESHOLD = 0.7   // >70% failures → show retry

// Phase-aware timeouts
const TIMEOUT_MS = {
    P1: 10_000,
    P2: 12_000,
    P3: 15_000,
    MASTER: 10_000,
} as const

const MAX_CONCURRENCY = 6
const MAX_RETRIES = 2  // Per-query retry count before skipping

// ── Helpers ────────────────────────────────────────────────────────────────

const isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development"

async function hasPersistedCache(): Promise<boolean> {
    try {
        const cached = await get(`${CACHE_BUSTER}:REACT_QUERY_OFFLINE_CACHE`)
        if (!cached || typeof cached !== "object") return false
        if ("timestamp" in cached) {
            const age = Date.now() - (cached.timestamp as number)
            if (age > 7 * 24 * 60 * 60 * 1000) return false
        }
        if ("clientState" in cached) {
            const state = (cached as Record<string, unknown>).clientState as Record<string, unknown> | undefined
            const queries = state?.queries
            const queryCount = Array.isArray(queries) ? queries.length : 0
            if (queryCount < P1_TOTAL) {
                if (isDev) console.log(`[Prefetch] IndexedDB has ${queryCount} queries, need ${P1_TOTAL} — running full prefetch`)
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        promise.then(
            (v) => { clearTimeout(timer); resolve(v) },
            (e) => { clearTimeout(timer); reject(e) },
        )
    })
}

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

type RouteResult = { route: string; status: "ok" | "fail" | "timeout" | "skip" | "cached"; ms: number; error?: string }

/**
 * Batch-prefetch routes with concurrency limit, per-query retry, and resume support.
 * Each query gets MAX_RETRIES retries with exponential backoff before being skipped.
 * Routes in `alreadyCached` are skipped silently (no progress tick — caller pre-sets itemsDone).
 */
async function batchPrefetchRoutes(
    queryClient: ReturnType<typeof useQueryClient>,
    routes: readonly string[],
    onProgress: () => void,
    timeoutMs: number,
    alreadyCached?: Set<string>,
): Promise<{ failures: number; succeeded: string[]; failed: string[]; details: RouteResult[] }> {
    let failures = 0
    const succeeded: string[] = []
    const failed: string[] = []
    const details: RouteResult[] = []

    const withConfig: Array<readonly [string, { queryKey: readonly unknown[]; queryFn: () => Promise<unknown> }]> = []
    for (const r of routes) {
        if (alreadyCached?.has(r)) {
            details.push({ route: r, status: "cached", ms: 0 })
            continue
        }
        const config = routePrefetchMap[r]
        if (config) {
            withConfig.push([r, config])
        } else {
            if (isDev) console.warn(`[Prefetch] SKIP: "${r}" missing from routePrefetchMap`)
            details.push({ route: r, status: "skip", ms: 0 })
            onProgress()
        }
    }

    const tasks = withConfig.map(([route, config]) => async () => {
        const t0 = performance.now()
        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                if (isDev) {
                    if (attempt > 0) console.log(`[Prefetch] RETRY #${attempt}: ${route}`)
                    else console.log(`[Prefetch] START: ${route}`)
                }
                await prefetchRoute(queryClient, route, config, timeoutMs)
                const ms = Math.round(performance.now() - t0)
                if (isDev) console.log(`[Prefetch] OK: ${route} (${ms}ms${attempt > 0 ? `, attempt ${attempt + 1}` : ""})`)
                details.push({ route, status: "ok", ms })
                succeeded.push(route)
                onProgress()
                return
            } catch (err) {
                if (attempt < MAX_RETRIES) {
                    await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
                    continue
                }
                const ms = Math.round(performance.now() - t0)
                const errMsg = err instanceof Error ? err.message : String(err)
                const status: "fail" | "timeout" = errMsg.includes("Timeout") ? "timeout" : "fail"
                if (isDev) console.warn(`[Prefetch] SKIP (${MAX_RETRIES + 1} attempts): ${route} — ${errMsg} (${ms}ms)`)
                details.push({ route, status, ms, error: errMsg })
                failed.push(route)
                failures++
            }
        }
        onProgress()
    })

    await runWithConcurrency(tasks, MAX_CONCURRENCY)
    return { failures, succeeded, failed, details }
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
    const [showRetry, setShowRetry] = useState(false)

    // Track cached items across retries — resume picks up where we left off
    const cachedRoutesRef = useRef(new Set<string>())
    const cachedMasterDataRef = useRef(new Set<string>())
    const allFailedRef = useRef<string[]>([])

    useEffect(() => {
        if (!isAuthenticated && !authLoading) {
            hasStarted.current = false
            cachedRoutesRef.current.clear()
            cachedMasterDataRef.current.clear()
            allFailedRef.current = []
        }
    }, [isAuthenticated, authLoading])

    const dismiss = useCallback(() => {
        setFadeOut(true)
        setTimeout(() => setShow(false), 300)
    }, [])

    const tick = useCallback(() => setItemsDone((prev) => prev + 1), [])

    const runPrefetch = useCallback(async () => {
        const alreadyCachedCount = cachedRoutesRef.current.size + cachedMasterDataRef.current.size

        setShowRetry(false)
        setTotalFailures(0)
        allFailedRef.current = []
        setItemsDone(alreadyCachedCount)
        setPhase(alreadyCachedCount >= P1_TOTAL ? "p2" : "p1")

        const supabase = createClient()
        try {
            const { error: refreshError } = await supabase.auth.refreshSession()
            if (refreshError) {
                console.warn("[Prefetch] Token pre-refresh failed:", refreshError.message)
            } else if (isDev) {
                console.log("[Prefetch] Token refreshed before starting")
            }
        } catch (err) {
            console.warn("[Prefetch] Token pre-refresh threw:", err)
        }

        const refreshInterval = setInterval(async () => {
            try {
                await supabase.auth.refreshSession()
                if (isDev) console.log("[Prefetch] Periodic token refresh OK")
            } catch { /* silent — non-critical */ }
        }, 45_000)

        const isResume = alreadyCachedCount > 0
        if (isDev) console.log(`[Prefetch] ${isResume ? "RESUMING" : "Starting"} — cached=${alreadyCachedCount}, P1=${P1_ROUTES.length}+${P1_MASTER_DATA.length}md, P2=${P2_ROUTES.length}, P3=${P3_ROUTES.length}`)
        const t0 = performance.now()
        let failures = 0

        // ── P1 ──
        if (isDev) console.log("[Prefetch] Phase P1: critical routes...")
        const p1Result = await batchPrefetchRoutes(queryClient, P1_ROUTES, tick, TIMEOUT_MS.P1, cachedRoutesRef.current)
        failures += p1Result.failures
        p1Result.succeeded.forEach(r => cachedRoutesRef.current.add(r))
        allFailedRef.current.push(...p1Result.failed)

        if (isDev) console.log("[Prefetch] Phase P1: master data...")
        const mdTasks = P1_MASTER_DATA.map((key) => async () => {
            if (cachedMasterDataRef.current.has(key)) return
            const t1 = performance.now()
            const config = masterDataPrefetchMap[key]
            if (!config) { tick(); return }
            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                try {
                    if (isDev) console.log(`[Prefetch] ${attempt > 0 ? `RETRY #${attempt}` : "START"}: md:${key}`)
                    await prefetchMasterData(queryClient, key, config)
                    if (isDev) console.log(`[Prefetch] OK: md:${key} (${Math.round(performance.now() - t1)}ms)`)
                    cachedMasterDataRef.current.add(key)
                    tick()
                    return
                } catch (err) {
                    if (attempt < MAX_RETRIES) {
                        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
                        continue
                    }
                    const errMsg = err instanceof Error ? err.message : String(err)
                    if (isDev) console.warn(`[Prefetch] SKIP: md:${key} — ${errMsg}`)
                    allFailedRef.current.push(`md:${key}`)
                    failures++
                }
            }
            tick()
        })
        await runWithConcurrency(mdTasks, MAX_CONCURRENCY)

        if (isDev) console.log(`[Prefetch] P1: ${P1_TOTAL - failures}/${P1_TOTAL} OK (${Math.round(performance.now() - t0)}ms)`)

        if (failures / P1_TOTAL > FAILURE_THRESHOLD) {
            setTotalFailures(failures)
            setShowRetry(true)
            clearInterval(refreshInterval)
            return
        }

        // ── P2 ──
        if (isDev) console.log("[Prefetch] Phase P2...")
        setPhase("p2")
        const p2Result = await batchPrefetchRoutes(queryClient, P2_ROUTES, tick, TIMEOUT_MS.P2, cachedRoutesRef.current)
        failures += p2Result.failures
        p2Result.succeeded.forEach(r => cachedRoutesRef.current.add(r))
        allFailedRef.current.push(...p2Result.failed)

        if (isDev) console.log(`[Prefetch] P1+P2: ${(P1_TOTAL + P2_TOTAL) - failures}/${P1_TOTAL + P2_TOTAL} OK (${Math.round(performance.now() - t0)}ms)`)

        if (failures / (P1_TOTAL + P2_TOTAL) > FAILURE_THRESHOLD) {
            setTotalFailures(failures)
            setShowRetry(true)
            clearInterval(refreshInterval)
            return
        }

        // ── Dismiss — app is interactive ──
        if (isDev) console.log(`[Prefetch] P1+P2 done (${failures} skipped) — dismissing`)
        setPhase("p3")
        markPrefetchComplete()
        dismiss()

        // ── P3: Background ──
        const p3Result = await batchPrefetchRoutes(queryClient, P3_ROUTES, () => { /* no-op */ }, TIMEOUT_MS.P3, cachedRoutesRef.current)
        p3Result.succeeded.forEach(r => cachedRoutesRef.current.add(r))
        allFailedRef.current.push(...p3Result.failed)
        sessionStorage.setItem(SESSION_KEY, "true")
        setPhase("done")
        clearInterval(refreshInterval)

        if (isDev) console.log(`[Prefetch] All done — ${Math.round(performance.now() - t0)}ms, ${allFailedRef.current.length} failed`)

        // ── Background retry of persistently-failed queries ──
        if (allFailedRef.current.length > 0) {
            setTimeout(async () => {
                if (isDev) console.log(`[Prefetch] Background retry: ${allFailedRef.current.length} items`)
                for (const item of allFailedRef.current) {
                    if (item.startsWith("md:")) {
                        const config = masterDataPrefetchMap[item.slice(3)]
                        if (config) {
                            try { await prefetchMasterData(queryClient, item.slice(3), config) } catch { /* final silent */ }
                        }
                    } else {
                        const config = routePrefetchMap[item]
                        if (config) {
                            try { await prefetchRoute(queryClient, item, config, 20_000) } catch { /* final silent */ }
                        }
                    }
                }
            }, 5000)
        }

        // ── Deferred route chunk preloading ──
        setTimeout(() => {
            const allRoutes = [...P1_ROUTES, ...P2_ROUTES, ...P3_ROUTES]
            const uniqueRoutes = [...new Set(allRoutes.map(r => r.split("#")[0]))]
            for (const route of uniqueRoutes) {
                try { router.prefetch(route) } catch { /* silent */ }
            }
            if (isDev) console.log(`[Prefetch] Route chunk preload: ${uniqueRoutes.length} routes`)
        }, 500)
    }, [queryClient, tick, dismiss, router])

    useEffect(() => {
        if (authLoading || !isAuthenticated || hasStarted.current) return
        hasStarted.current = true

        if (sessionStorage.getItem(SESSION_KEY) === "true") {
            if (isDev) console.log("[Prefetch] Skipping — sessionStorage flag set")
            return
        }

        ;(async () => {
            const hasCached = await hasPersistedCache()
            if (hasCached) {
                if (isDev) console.log("[Prefetch] Skipping overlay — IndexedDB cache sufficient")
                sessionStorage.setItem(SESSION_KEY, "true")
                const allRoutes = [...P1_ROUTES, ...P2_ROUTES, ...P3_ROUTES]
                const uniqueRoutes = [...new Set(allRoutes.map(r => r.split("#")[0]))]
                for (const route of uniqueRoutes) {
                    try { router.prefetch(route) } catch { /* silent */ }
                }
                return
            }
            if (isDev) console.log("[Prefetch] No sufficient cache — showing overlay")
            setShow(true)
            await runPrefetch()
        })()
    }, [authLoading, isAuthenticated, runPrefetch, router])

    if (!show) return null

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
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-white/98 dark:bg-zinc-950/98 backdrop-blur-sm transition-opacity duration-300 ${fadeOut ? "opacity-0" : "opacity-100"}`}>
            <div className="w-full max-w-sm mx-6 text-center space-y-6">
                <div className="flex justify-center">
                    <div className="w-12 h-12 bg-black border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                        <span className="text-emerald-400 font-bold text-xl font-heading">E</span>
                    </div>
                </div>
                <div>
                    <h2 className="text-lg font-bold font-heading text-black dark:text-white">
                        {showRetry ? "Koneksi Bermasalah" : "Mempersiapkan Sistem"}
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                        {showRetry
                            ? `${totalFailures} item gagal diunduh — periksa koneksi internet Anda`
                            : "Mengunduh data agar semua halaman terbuka instan"}
                    </p>
                </div>
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
                                <span className="flex items-center gap-1 text-red-500"><IconWifiOff size={12} /> Gagal</span>
                            ) : allDone ? (
                                <span className="flex items-center gap-1 text-emerald-600"><IconCheck size={12} /> Siap</span>
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
