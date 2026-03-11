"use client"

import { QueryClient, QueryClientProvider, keepPreviousData } from "@tanstack/react-query"
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client"
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

// Cache version — bump this to invalidate all persisted caches on deploy
const CACHE_BUSTER = "v1"

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                staleTime: 30 * 60 * 1000,        // 30 min — data is "fresh" for this long
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
    } catch {}
    // Also clear in-memory query cache
    if (browserQueryClient) {
        browserQueryClient.clear()
    }
}

let browserQueryClient: QueryClient | undefined

function getQueryClient() {
    if (typeof window === "undefined") {
        return makeQueryClient()
    }
    if (!browserQueryClient) browserQueryClient = makeQueryClient()
    return browserQueryClient
}

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(getQueryClient)
    const [isClient, setIsClient] = useState(false)

    useEffect(() => {
        setIsClient(true)
    }, [])

    // Server-side or first render — use plain provider (no persistence on server)
    if (!isClient) {
        return (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        )
    }

    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{
                persister: idbPersister,
                maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days max cache age
                buster: CACHE_BUSTER,
            }}
            onSuccess={() => {
                // Resume any paused mutations (e.g. offline writes), but do NOT
                // invalidate all queries — let staleTime decide when to refetch.
                // Calling invalidateQueries() here would wipe the cache benefit
                // and force a full re-download on every login/lockout.
                queryClient.resumePausedMutations()
            }}
        >
            {children}
            {ReactQueryDevtools && (
                <Suspense fallback={null}>
                    <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
                </Suspense>
            )}
        </PersistQueryClientProvider>
    )
}
