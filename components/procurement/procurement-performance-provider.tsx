"use client"

import { ReactNode, useEffect } from "react"
import { useProcurementPrefetch, useDataPrefetch } from "@/lib/performance/procurement-prefetch"

interface ProcurementPerformanceProviderProps {
    children: ReactNode
    currentPath?: string
}

// Enterprise-grade performance provider like Google/Apple use
// Optimizes procurement module with intelligent prefetching and caching
export function ProcurementPerformanceProvider({ 
    children, 
    currentPath 
}: ProcurementPerformanceProviderProps) {
    const { prefetchData } = useDataPrefetch()

    // Enable intelligent prefetching for procurement navigation
    useProcurementPrefetch()

    useEffect(() => {
        // Prefetch related data based on current page
        const prefetchRelatedData = () => {
            switch (currentPath) {
                case '/procurement':
                    // Dashboard: prefetch stats, recent activity
                    prefetchData(['procurement-stats', 'recent-activity'])
                    break
                    
                case '/procurement/requests':
                    // Requests page: prefetch vendors, products
                    prefetchData(['vendors-list', 'products-list'])
                    break
                    
                case '/procurement/orders':
                    // Orders page: prefetch vendors, products, pending requests
                    prefetchData(['vendors-list', 'products-list', 'pending-requests'])
                    break
                    
                case '/procurement/receiving':
                    // Receiving page: prefetch warehouses, employees, pending POs
                    prefetchData(['warehouses-list', 'employees-list', 'pending-pos'])
                    break
                    
                case '/procurement/vendors':
                    // Vendors page: prefetch related data
                    prefetchData(['vendor-stats', 'active-pos'])
                    break
            }
        }

        // Prefetch after a short delay to not block initial render
        const timeout = setTimeout(prefetchRelatedData, 500)
        return () => clearTimeout(timeout)
    }, [currentPath, prefetchData])

    return <>{children}</>
}

// Performance monitoring hook (like Facebook's PerfDog)
export function usePerformanceMonitor(pageName: string) {
    useEffect(() => {
        if (typeof window === 'undefined') return

        // Start performance measurement
        const startTime = performance.now()
        
        // Measure page load performance
        const measurePageLoad = () => {
            const loadTime = performance.now() - startTime
            
            // Log performance metrics (in production, send to analytics)
            console.log(`📊 ${pageName} load time: ${loadTime.toFixed(2)}ms`)
            
            // Alert if page is slow (enterprise standard: < 2 seconds)
            if (loadTime > 2000) {
                console.warn(`⚠️ Slow page detected: ${pageName} (${loadTime.toFixed(2)}ms)`)
            }
        }

        // Measure when page is fully loaded
        if (document.readyState === 'complete') {
            measurePageLoad()
        } else {
            window.addEventListener('load', measurePageLoad)
            return () => window.removeEventListener('load', measurePageLoad)
        }
    }, [pageName])
}
