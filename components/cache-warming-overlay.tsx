"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { routePrefetchMap } from "@/hooks/use-nav-prefetch"
import { useAuth } from "@/lib/auth-context"
import { IconCheck, IconLoader2 } from "@tabler/icons-react"

const SESSION_KEY = "erp_cache_warmed"

/**
 * Two-phase cache warmer:
 *
 * Phase 1 (visible): Quick splash loading priority routes (~2-3s).
 *   Shows a sleek progress bar. User can skip anytime with "Lewati".
 *   Auto-dismisses when priority routes are done.
 *
 * Phase 2 (silent): Remaining routes load in background batches.
 *   No UI — user is already using the app.
 *
 * Result: Every page the user visits after login opens instantly.
 */

const PRIORITY_ROUTES = [
    "/dashboard",
    "/inventory/products",
    "/inventory",
    "/sales/customers",
    "/sales/orders",
    "/sales",
    "/finance",
    "/procurement",
    "/manufacturing",
]

export function CacheWarmingOverlay() {
    const { isAuthenticated, isLoading: authLoading } = useAuth()
    const queryClient = useQueryClient()
    const hasStarted = useRef(false)

    const [show, setShow] = useState(false)
    const [fadeOut, setFadeOut] = useState(false)
    const [priorityDone, setPriorityDone] = useState(0)
    const [priorityTotal, setPriorityTotal] = useState(0)
    const [phase, setPhase] = useState<"priority" | "background" | "done">("priority")

    const dismiss = useCallback(() => {
        setFadeOut(true)
        setTimeout(() => setShow(false), 300)
    }, [])

    const warmPriority = useCallback(async () => {
        const entries = Object.entries(routePrefetchMap).filter(([r]) => PRIORITY_ROUTES.includes(r))
        setPriorityTotal(entries.length)
        setPriorityDone(0)

        // Fetch priority routes in batches of 5 (safe — most use prisma singleton, no transactions)
        const BATCH = 5
        for (let i = 0; i < entries.length; i += BATCH) {
            const batch = entries.slice(i, i + BATCH)
            await Promise.allSettled(
                batch.map(async ([, config]) => {
                    try {
                        await queryClient.prefetchQuery({
                            queryKey: config.queryKey,
                            queryFn: config.queryFn,
                        })
                    } catch { /* ignore */ }
                    setPriorityDone((prev) => prev + 1)
                })
            )
        }
    }, [queryClient])

    const warmBackground = useCallback(async () => {
        const entries = Object.entries(routePrefetchMap).filter(([r]) => !PRIORITY_ROUTES.includes(r))
        const BATCH = 4

        for (let i = 0; i < entries.length; i += BATCH) {
            const batch = entries.slice(i, i + BATCH)
            await Promise.allSettled(
                batch.map(([, config]) =>
                    queryClient.prefetchQuery({
                        queryKey: config.queryKey,
                        queryFn: config.queryFn,
                    }).catch(() => {})
                )
            )
            if (i + BATCH < entries.length) {
                await new Promise((r) => setTimeout(r, 150))
            }
        }

        sessionStorage.setItem(SESSION_KEY, "true")
        setPhase("done")
    }, [queryClient])

    useEffect(() => {
        if (authLoading || !isAuthenticated || hasStarted.current) return
        hasStarted.current = true

        // If already warmed this session, just do silent background refresh
        if (sessionStorage.getItem(SESSION_KEY) === "true") {
            warmBackground()
            return
        }

        // Show overlay and start priority loading
        setShow(true)
        ;(async () => {
            await warmPriority()
            setPhase("background")

            // Auto-dismiss overlay once priority routes are cached
            dismiss()

            // Continue loading remaining routes silently
            await warmBackground()
        })()
    }, [authLoading, isAuthenticated, warmPriority, warmBackground, dismiss])

    if (!show) return null

    const pct = priorityTotal > 0 ? Math.round((priorityDone / priorityTotal) * 100) : 0
    const allPriorityDone = phase !== "priority"

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
                        Mempersiapkan Sistem
                    </h2>
                    <p className="text-xs text-zinc-400 mt-1">
                        Mengunduh data agar semua halaman terbuka instan
                    </p>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                    <div className="h-2 bg-zinc-100 dark:bg-zinc-800 border-2 border-black overflow-hidden">
                        <div
                            className="h-full bg-emerald-500 transition-all duration-500 ease-out"
                            style={{ width: `${allPriorityDone ? 100 : pct}%` }}
                        />
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-400 font-mono">
                            {allPriorityDone ? (
                                <span className="flex items-center gap-1 text-emerald-600">
                                    <IconCheck size={12} /> Siap
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <IconLoader2 size={12} className="animate-spin" />
                                    {priorityDone}/{priorityTotal}
                                </span>
                            )}
                        </span>
                        <span className="text-zinc-400 font-mono font-bold">
                            {allPriorityDone ? "100" : pct}%
                        </span>
                    </div>
                </div>

                {/* Skip button */}
                <button
                    onClick={dismiss}
                    className="text-xs text-zinc-400 hover:text-black dark:hover:text-white font-medium underline underline-offset-4 decoration-zinc-300 hover:decoration-black transition-colors"
                >
                    Lewati
                </button>
            </div>
        </div>
    )
}
