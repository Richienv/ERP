"use client"

import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query"
import { persistQueryClient } from "@tanstack/react-query-persist-client"
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister"
import { get, set, del, clear } from "idb-keyval"
import { useState, type ReactNode, lazy, Suspense, useEffect } from "react"

const ReactQueryDevtools =
    process.env.NODE_ENV === "development"
        ? lazy(() =>
              import("@tanstack/react-query-devtools").then((mod) => ({
                  default: mod.ReactQueryDevtools,
              }))
          )
        : null

// Cache version — auto-busts on Vercel deploy via git SHA, manual bump for local
export const CACHE_BUSTER = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.slice(0, 8) || "v1"

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 5 * 60 * 1000,         // 5 min — safe middle ground; per-query overrides via CACHE_TIERS
                gcTime: 7 * 24 * 60 * 60 * 1000,  // 7 days — keep unused cache entries for persistence
                retry: 1,
                refetchOnWindowFocus: false,
                placeholderData: keepPreviousData,
                refetchOnMount: true,               // still revalidate on mount, but show persisted data instantly
                networkMode: "offlineFirst",
            },
            mutations: {
                retry: 2,
                retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
                networkMode: "offlineFirst",
            },
        },
    })
}

// IndexedDB-backed async storage persister
const idbPersister = createAsyncStoragePersister({
    storage: {
        getItem: async (key) => {
            const val = await get(`${CACHE_BUSTER}:${key}`)
            return val ?? null
        },
        setItem: async (key, value) => {
            await set(`${CACHE_BUSTER}:${key}`, value)
        },
        removeItem: async (key) => {
            await del(`${CACHE_BUSTER}:${key}`)
        },
    },
    // Throttle writes to IndexedDB to avoid excessive I/O
    throttleTime: 2000,
})

/**
 * Clear all persisted query cache from IndexedDB + in-memory.
 * MUST be called on logout to prevent data leaking between users.
 */
export async function clearPersistedCache() {
    try {
        // Clear all idb-keyval entries (our cache store)
        await clear()
    } catch (err) {
        console.error("[Cache] Failed to clear IndexedDB — stale data may persist:", err)
    }
    // Also clear in-memory query cache
    if (browserQueryClient) {
        browserQueryClient.clear()
    }
}

let browserQueryClient: QueryClient | undefined
let persistenceSetUp = false

function getQueryClient() {
    if (typeof window === "undefined") {
        return makeQueryClient()
    }
    if (!browserQueryClient) {
        browserQueryClient = makeQueryClient()
    }
    // Start IndexedDB restore EAGERLY during render (not in useEffect).
    // This fires during the first useState(getQueryClient) call, which is
    // ~50-100ms earlier than useEffect. For returning users with cached data,
    // this means the dashboard can render with real data on the very first paint.
    if (!persistenceSetUp) {
        persistenceSetUp = true
        const [, restorePromise] = persistQueryClient({
            queryClient: browserQueryClient,
            persister: idbPersister,
            maxAge: 7 * 24 * 60 * 60 * 1000,
            buster: CACHE_BUSTER,
        })
        restorePromise.then(() => {
            browserQueryClient!.resumePausedMutations()
            // Dev-only: log IndexedDB cache size
            if (process.env.NODE_ENV === "development" && navigator.storage?.estimate) {
                navigator.storage.estimate().then((est) => {
                    if (est.usage) {
                        console.log(
                            `[Cache] IndexedDB: ${(est.usage / 1024 / 1024).toFixed(1)}MB / ${((est.quota ?? 0) / 1024 / 1024).toFixed(0)}MB`
                        )
                    }
                }).catch(() => {})
            }
        })
    }
    return browserQueryClient
}

/**
 * QueryProvider — wraps the app in TanStack Query with IndexedDB persistence.
 *
 * Persistence is set up eagerly in getQueryClient() (fires during render),
 * NOT in useEffect. This eliminates the one-frame skeleton flash for returning
 * users because IndexedDB restore starts before the first paint.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(getQueryClient)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
        // Dev-only: report Core Web Vitals to console
        import("@/lib/web-vitals").then((m) => m.reportWebVitals()).catch(() => {})
    }, [])

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {isClient && ReactQueryDevtools && (
                <Suspense fallback={null}>
                    <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
                </Suspense>
            )}
        </QueryClientProvider>
    )
}
