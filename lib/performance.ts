export function trackPageMetrics() {
    if (typeof window === "undefined") return

    try {
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries()
            const lastEntry = entries[entries.length - 1]
            if (lastEntry) {
                console.log(`[Perf] LCP: ${Math.round(lastEntry.startTime)}ms`)
            }
        })
        lcpObserver.observe({ type: "largest-contentful-paint", buffered: true })
    } catch {
        // Not supported
    }

    try {
        const fidObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const e = entry as PerformanceEventTiming
                console.log(`[Perf] FID: ${Math.round(e.processingStart - e.startTime)}ms`)
            }
        })
        fidObserver.observe({ type: "first-input", buffered: true })
    } catch {
        // Not supported
    }

    try {
        let clsScore = 0
        const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const e = entry as PerformanceEntry & { hadRecentInput?: boolean; value?: number }
                if (!e.hadRecentInput && e.value) {
                    clsScore += e.value
                }
            }
            console.log(`[Perf] CLS: ${clsScore.toFixed(4)}`)
        })
        clsObserver.observe({ type: "layout-shift", buffered: true })
    } catch {
        // Not supported
    }
}

export function trackRouteChange(pathname: string) {
    if (typeof window === "undefined") return
    const start = performance.now()
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            const duration = performance.now() - start
            console.log(`[Perf] Route ${pathname}: ${Math.round(duration)}ms`)
        })
    })
}
