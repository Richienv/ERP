// ═══════════════════════════════════════════════════════════════════════════
// ERP Service Worker — Static Asset Cache Layer
//
// Strategies:
//   /_next/static/**  → Cache-first (immutable — URL contains content hash)
//   Navigation (HTML) → Network-first with offline fallback from cache
//   Static assets     → Stale-while-revalidate (fonts, images, icons)
//   /api/**, /auth/** → Network-only (never cached by SW)
//
// Update flow:
//   New deploy → new SW installs → skipWaiting → activate → purge old caches
//   → postMessage("SW_UPDATED") to all clients → app shows toast
// ═══════════════════════════════════════════════════════════════════════════

// Bump this on every deployment to invalidate old caches.
// The registration component also uses periodic update checks (every 30 min)
// to detect new SW versions even without a page reload.
const SW_VERSION = "v2"
const CACHE_STATIC = `erp-static-${SW_VERSION}`
const CACHE_PAGES  = `erp-pages-${SW_VERSION}`

// App shell pages to precache on install — ensures offline access
const PRECACHE_PAGES = ["/"]

// ── Install ────────────────────────────────────────────────────────────────

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_PAGES)
            .then((cache) => cache.addAll(PRECACHE_PAGES))
    )
    // Activate immediately — don't wait for old tabs to close
    self.skipWaiting()
})

// ── Activate ───────────────────────────────────────────────────────────────

self.addEventListener("activate", (event) => {
    event.waitUntil(
        (async () => {
            // Delete any cache that doesn't match our current version
            const keys = await caches.keys()
            await Promise.all(
                keys
                    .filter((k) => k !== CACHE_STATIC && k !== CACHE_PAGES)
                    .map((k) => caches.delete(k))
            )

            // Take control of all open tabs immediately
            await self.clients.claim()

            // Notify all clients that a new version is active
            const clients = await self.clients.matchAll({ type: "window" })
            for (const client of clients) {
                client.postMessage({ type: "SW_UPDATED", version: SW_VERSION })
            }
        })()
    )
})

// ── Fetch ──────────────────────────────────────────────────────────────────

self.addEventListener("fetch", (event) => {
    const { request } = event
    const url = new URL(request.url)

    // Only handle GET requests from our own origin
    if (request.method !== "GET") return
    if (url.origin !== self.location.origin) return

    // ── BYPASS: API and auth routes — handled by TanStack Query / Supabase ──
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return

    // ── CACHE-FIRST: Next.js static chunks (immutable — URL has content hash) ──
    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(cacheFirst(request, CACHE_STATIC))
        return
    }

    // ── NETWORK-FIRST: Navigation requests (HTML pages) ──
    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request, CACHE_PAGES))
        return
    }

    // ── STALE-WHILE-REVALIDATE: Other static assets (fonts, images, etc.) ──
    if (isStaticAsset(url.pathname)) {
        event.respondWith(staleWhileRevalidate(request, CACHE_STATIC))
        return
    }
})

// ── Cache Strategies ───────────────────────────────────────────────────────

/** Cache-first: serve from cache if available, otherwise fetch and cache. */
async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request)
    if (cached) return cached

    try {
        const response = await fetch(request)
        if (response.ok) {
            const cache = await caches.open(cacheName)
            cache.put(request, response.clone())
        }
        return response
    } catch {
        // Offline — return a basic error response
        return new Response("Offline", { status: 503, statusText: "Service Unavailable" })
    }
}

/** Network-first: try network, fall back to cache. Caches successful responses. */
async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request)
        if (response.ok) {
            const cache = await caches.open(cacheName)
            cache.put(request, response.clone())
        }
        return response
    } catch {
        // Network failed — try cache
        const cached = await caches.match(request)
        if (cached) return cached

        // Last resort: serve the cached app shell
        const shell = await caches.match("/")
        if (shell) return shell

        return new Response("Offline", { status: 503, statusText: "Service Unavailable" })
    }
}

/** Stale-while-revalidate: return cache immediately, update in background. */
async function staleWhileRevalidate(request, cacheName) {
    const cached = await caches.match(request)

    // Always fetch in background to update cache
    const networkPromise = fetch(request)
        .then((response) => {
            if (response.ok) {
                caches.open(cacheName).then((cache) => cache.put(request, response.clone()))
            }
            return response
        })
        .catch(() => null)

    // Return cached version immediately if available, otherwise wait for network
    if (cached) return cached
    const networkResponse = await networkPromise
    return networkResponse || new Response("Offline", { status: 503, statusText: "Service Unavailable" })
}

// ── Helpers ────────────────────────────────────────────────────────────────

function isStaticAsset(pathname) {
    return /\.(js|css|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|ico|webp|avif|mp4|webm)$/i.test(pathname)
}
