"use client"

// Enterprise-grade prefetching strategy like Google/Apple use
// Prefetches likely next pages when user hovers over navigation

import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

const PREFETCH_DELAY = 200 // 200ms delay before prefetch (Google uses 150-300ms)
const HOVER_THRESHOLD = 100 // Minimum hover time to trigger prefetch

type TimeoutMap = Record<string, ReturnType<typeof setTimeout>>
type HoverMap = Record<string, number>

export function useProcurementPrefetch() {
    const router = useRouter()
    const prefetchTimeouts = useRef<TimeoutMap>({})
    const hoverStartTimes = useRef<HoverMap>({})

    // Pages to prefetch when user shows intent
    const procurementPages = [
        '/procurement/requests',
        '/procurement/orders', 
        '/procurement/receiving',
        '/procurement/vendors'
    ]

    useEffect(() => {
        // Add prefetch listeners to navigation links
        const addPrefetchListeners = () => {
            const links = document.querySelectorAll('a[href*="/procurement/"]')
            
            links.forEach(link => {
                const linkEl = link as HTMLAnchorElement
                if (linkEl.dataset.prefetchBound === "1") return
                linkEl.dataset.prefetchBound = "1"

                const href = (link as HTMLAnchorElement).href
                const path = new URL(href).pathname

                if (procurementPages.includes(path)) {
                    // Mouse enter - start hover timer
                    link.addEventListener('mouseenter', () => {
                        hoverStartTimes.current[path] = Date.now()
                        
                        const timeout = setTimeout(() => {
                            const hoverDuration = Date.now() - (hoverStartTimes.current[path] || 0)
                            
                            if (hoverDuration >= HOVER_THRESHOLD) {
                                // Prefetch the page
                                router.prefetch(path)
                                console.log(`🚀 Prefetched: ${path}`)
                            }
                        }, PREFETCH_DELAY)

                        prefetchTimeouts.current[path] = timeout
                    })

                    // Mouse leave - cancel prefetch if not triggered
                    link.addEventListener('mouseleave', () => {
                        const timeout = prefetchTimeouts.current[path]
                        if (timeout) {
                            clearTimeout(timeout)
                            delete prefetchTimeouts.current[path]
                        }
                        delete hoverStartTimes.current[path]
                    })

                    // Touch start (mobile) - immediate prefetch
                    link.addEventListener('touchstart', () => {
                        router.prefetch(path)
                        console.log(`📱 Prefetched (mobile): ${path}`)
                    })
                }
            })
        }

        // Initial setup
        addPrefetchListeners()

        // Re-setup when DOM changes (for dynamic content)
        const observer = new MutationObserver(() => {
            addPrefetchListeners()
        })

        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        })

        return () => {
            // Cleanup
            Object.values(prefetchTimeouts.current).forEach(timeout => clearTimeout(timeout))
            observer.disconnect()
        }
    }, [router])

    // NOTE:
    // We intentionally avoid bulk prefetch-on-mount here to prevent
    // request storms that can exhaust database/session pool limits.
}

// Hook for components to prefetch related data
export function useDataPrefetch() {
    const prefetchData = async (dataKeys: string[]) => {
        // Trigger cache warming for specific data
        try {
            for (const key of dataKeys) {
                const response = await fetch(`/api/cache-warm?key=${key}`)
                if (response.ok) {
                    console.log(`🔥 Cache warmed: ${key}`)
                }
                // Small delay to avoid overwhelming server/db connection pools.
                await new Promise((resolve) => setTimeout(resolve, 120))
            }
        } catch (error) {
            console.warn('Cache warming failed:', error)
        }
    }

    return { prefetchData }
}

export function useInventoryPrefetch() {
    const router = useRouter()
    const prefetchTimeouts = useRef<TimeoutMap>({})
    const hoverStartTimes = useRef<HoverMap>({})

    const inventoryPages = [
        '/inventory',
        '/inventory/products',
        '/inventory/movements',
        '/inventory/warehouses',
        '/inventory/audit'
    ]

    useEffect(() => {
        const addPrefetchListeners = () => {
            const links = document.querySelectorAll('a[href*="/inventory/"]')

            links.forEach(link => {
                const linkEl = link as HTMLAnchorElement
                if (linkEl.dataset.prefetchBound === "1") return
                linkEl.dataset.prefetchBound = "1"

                const href = (link as HTMLAnchorElement).href
                const path = new URL(href).pathname

                if (inventoryPages.includes(path)) {
                    link.addEventListener('mouseenter', () => {
                        hoverStartTimes.current[path] = Date.now()

                        const timeout = setTimeout(() => {
                            const hoverDuration = Date.now() - (hoverStartTimes.current[path] || 0)

                            if (hoverDuration >= HOVER_THRESHOLD) {
                                router.prefetch(path)
                            }
                        }, PREFETCH_DELAY)

                        prefetchTimeouts.current[path] = timeout
                    })

                    link.addEventListener('mouseleave', () => {
                        const timeout = prefetchTimeouts.current[path]
                        if (timeout) {
                            clearTimeout(timeout)
                            delete prefetchTimeouts.current[path]
                        }
                        delete hoverStartTimes.current[path]
                    })

                    link.addEventListener('touchstart', () => {
                        router.prefetch(path)
                    })
                }
            })
        }

        addPrefetchListeners()

        const observer = new MutationObserver(() => {
            addPrefetchListeners()
        })

        observer.observe(document.body, {
            childList: true,
            subtree: true
        })

        return () => {
            Object.values(prefetchTimeouts.current).forEach(timeout => clearTimeout(timeout))
            observer.disconnect()
        }
    }, [router])

    // NOTE:
    // Avoid bulk prefetch-on-mount to prevent connection spikes.
}
