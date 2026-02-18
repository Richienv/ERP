const CACHE_NAME = "erp-static-v1"

const PRECACHE_URLS = ["/"]

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
    )
    self.skipWaiting()
})

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    )
    self.clients.claim()
})

self.addEventListener("fetch", (event) => {
    const url = new URL(event.request.url)

    if (event.request.method !== "GET") return
    if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) return

    if (url.pathname.startsWith("/_next/static/")) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                    }
                    return response
                })
            })
        )
        return
    }

    if (event.request.mode === "navigate") {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        )
        return
    }

    if (url.pathname.match(/\.(js|css|woff2?|ttf|png|jpg|jpeg|svg|ico|webp)$/)) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                const networkFetch = fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                    }
                    return response
                })
                return cached || networkFetch
            })
        )
        return
    }
})
