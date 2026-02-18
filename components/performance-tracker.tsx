"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { trackPageMetrics, trackRouteChange } from "@/lib/performance"

export function PerformanceTracker() {
    const pathname = usePathname()

    useEffect(() => {
        trackPageMetrics()
    }, [])

    useEffect(() => {
        trackRouteChange(pathname)
    }, [pathname])

    return null
}
