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

/* ────────────────────────────────────────────────────────────────────────────
 * CACHE TIERS
 *
 * The canonical tier table lives in `lib/cache-tiers.ts` (CONFIG, MASTER,
 * MASTER_PLUS, DASHBOARD, TRANSACTIONAL, REALTIME). It is re-exported here so
 * the global default below and the per-query overrides are discoverable from
 * one place.
 *
 * How to apply a tier to a query — spread it into the useQuery options:
 *
 *     import { CACHE_TIERS } from "@/lib/query-client"   // or "@/lib/cache-tiers"
 *
 *     useQuery({
 *         queryKey: ["categories"],
 *         queryFn: fetchCategories,
 *         ...CACHE_TIERS.MASTER,        // STATIC-ish: 30 min stale, no focus refetch
 *     })
 *
 * Rough mapping to the three canonical buckets:
 *   • STATIC   → CACHE_TIERS.CONFIG / CACHE_TIERS.MASTER   (categories, units, COA)
 *   • STANDARD → CACHE_TIERS.DASHBOARD / MASTER_PLUS       (KPIs, products, customers)
 *   • REALTIME → CACHE_TIERS.TRANSACTIONAL / REALTIME      (invoices, POs, approvals)
 *
 * For money that can be double-spent (invoice balances, payment status, AR/AP
 * outstanding, stock on hand before a reservation) even a 30-second window is
 * too wide — a user can see a paid invoice as unpaid and record a duplicate
 * payment. Use MONEY_TIER for those:
 *
 *     useQuery({
 *         queryKey: ["invoice", id, "balance"],
 *         queryFn: fetchInvoiceBalance,
 *         ...MONEY_TIER,                // always refetch, never show stale money
 *     })
 * ──────────────────────────────────────────────────────────────────────────── */
export { CACHE_TIERS, type CacheTier } from "@/lib/cache-tiers"

/**
 * Zero-staleness tier for money-sensitive reads.
 *
 * - `staleTime: 0` + `refetchOnMount: "always"` — the number on screen is always
 *   revalidated against the server, never served from a stale cache entry.
 * - `refetchOnWindowFocus: true` — coming back from another tab re-reads the balance.
 * - `placeholderData: undefined` — cancels the global `keepPreviousData`, so a
 *   different invoice/customer never briefly renders the previous one's amount.
 * - `networkMode: "online"` — offline reads of financial balances are refused
 *   rather than answered from a possibly hours-old cache.
 * - short `gcTime` — these entries are not worth persisting to IndexedDB.
 */
export const MONEY_TIER = {
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    placeholderData: undefined,
    networkMode: "online",
} as const

function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // 60s (was 5 min). Queries that do NOT opt into a tier are mostly
                // ad-hoc widgets, and in an accounting system an unlabelled query is
                // just as likely to be showing money as master data. 5 minutes of
                // silent staleness is long enough for a user to act on a settled
                // invoice twice; 60s keeps the "instant navigation" feel while
                // bounding how wrong the screen can be. Tiers that want longer
                // (CONFIG/MASTER) override this explicitly, so master data is
                // unaffected.
                staleTime: 60 * 1000,
                gcTime: 7 * 24 * 60 * 60 * 1000,  // 7 days — keep unused cache entries for persistence
                retry: 1,
                // Refetch when the user returns to the tab. Tiers that opt out
                // (CONFIG / MASTER / MASTER_PLUS) set this to false themselves.
                refetchOnWindowFocus: true,
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

/* ────────────────────────────────────────────────────────────────────────────
 * PER-USER CACHE NAMESPACING
 *
 * The persisted cache holds invoices, payments, AR/AP balances, payroll and
 * employee records. Namespacing it by git SHA alone means two users on the same
 * browser share one cache bucket, so user B could be served user A's financial
 * data on first paint after a session timeout.
 *
 * Every IndexedDB key is therefore prefixed with the authenticated user id:
 *     `${CACHE_BUSTER}:${scope}:${key}`   where scope = "u_<userId>" | "anon"
 *
 * The scope is a module-level variable read at call time (not baked in at module
 * load), so it can be repointed once auth resolves. The last known scope is
 * mirrored to localStorage under CACHE_SCOPE_KEY so it can be read synchronously
 * during the first render — that keeps the eager restore (and its instant first
 * paint) working for a returning single user.
 *
 * `setCacheScope()` is called by AuthProvider. When the identity changes it
 * wipes IndexedDB + the in-memory cache BEFORE repointing, so a new user starts
 * from an empty cache and old entries are unreachable even if a wipe fails.
 * ──────────────────────────────────────────────────────────────────────────── */

const CACHE_SCOPE_KEY = "erp:qc-scope"
const ANON_SCOPE = "anon"

function readStoredScope(): string {
    if (typeof window === "undefined") return ANON_SCOPE
    try {
        return localStorage.getItem(CACHE_SCOPE_KEY) || ANON_SCOPE
    } catch {
        return ANON_SCOPE
    }
}

/** Current cache namespace. Read at call time by the persister storage adapter. */
let activeScope: string = readStoredScope()

function scopedKey(key: string) {
    return `${CACHE_BUSTER}:${activeScope}:${key}`
}

// IndexedDB-backed async storage persister
const idbPersister = createAsyncStoragePersister({
    storage: {
        getItem: async (key) => {
            const val = await get(scopedKey(key))
            return val ?? null
        },
        setItem: async (key, value) => {
            await set(scopedKey(key), value)
        },
        removeItem: async (key) => {
            await del(scopedKey(key))
        },
    },
    // Throttle writes to IndexedDB to avoid excessive I/O
    throttleTime: 2000,
})

/**
 * Clear all persisted query cache from IndexedDB + in-memory.
 *
 * MUST be called on logout AND on session expiry / token-refresh failure —
 * anything that ends an authenticated session — to prevent financial data
 * leaking to the next person who uses this browser.
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
let unsubscribePersist: (() => void) | undefined

function setupPersistence(client: QueryClient) {
    if (persistenceSetUp) return
    persistenceSetUp = true
    const [unsubscribe, restorePromise] = persistQueryClient({
        queryClient: client,
        persister: idbPersister,
        maxAge: 7 * 24 * 60 * 60 * 1000,
        // Scope is part of the buster too: a blob written under another user's
        // scope is rejected even if it were somehow read back.
        buster: `${CACHE_BUSTER}:${activeScope}`,
    })
    unsubscribePersist = unsubscribe
    restorePromise.then(() => {
        client.resumePausedMutations()
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

/**
 * Point the persisted cache at a specific authenticated user.
 *
 * Called by AuthProvider as soon as the session's user is known, and with
 * `null` when the session ends. If the identity differs from the one that owns
 * the current cache, the whole cache (IndexedDB + in-memory) is wiped before
 * the namespace is repointed — so user B never reads user A's invoices,
 * payments or payroll. If the identity is unchanged this is a no-op, which
 * preserves the instant-restore behaviour for a single returning user.
 */
export async function setCacheScope(userId: string | null | undefined) {
    if (typeof window === "undefined") return
    const nextScope = userId ? `u_${userId}` : ANON_SCOPE
    if (nextScope === activeScope) return

    // Stop the old persister subscription so an in-flight restore/write cannot
    // resurrect the previous user's data under the new scope.
    try {
        unsubscribePersist?.()
    } catch {}
    unsubscribePersist = undefined
    persistenceSetUp = false

    await clearPersistedCache()

    activeScope = nextScope
    try {
        localStorage.setItem(CACHE_SCOPE_KEY, nextScope)
    } catch {}

    if (browserQueryClient) {
        setupPersistence(browserQueryClient)
    }
}

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
    // The restore reads from `activeScope`, seeded synchronously from
    // localStorage, so it can only ever restore the last signed-in user's own
    // bucket — and AuthProvider wipes it the moment a different user appears.
    setupPersistence(browserQueryClient)
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
