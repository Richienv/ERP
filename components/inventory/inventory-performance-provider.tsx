"use client"

import { ReactNode, useEffect } from "react"
import { useInventoryPrefetch, useDataPrefetch } from "@/lib/performance/procurement-prefetch"

type InventoryPerformanceProviderProps = {
    children: ReactNode
    currentPath?: string
}

export function InventoryPerformanceProvider({
    children,
    currentPath
}: InventoryPerformanceProviderProps) {
    const { prefetchData } = useDataPrefetch()

    useInventoryPrefetch()

    useEffect(() => {
        const prefetchRelatedData = () => {
            switch (currentPath) {
                case '/inventory':
                    prefetchData(['inventory-kpis', 'material-gap-analysis', 'procurement-insights'])
                    break
                case '/inventory/products':
                    prefetchData(['inventory-kanban', 'products-list'])
                    break
                case '/inventory/movements':
                    prefetchData(['inventory-movements', 'inventory-kanban', 'warehouses-list'])
                    break
                case '/inventory/warehouses':
                    prefetchData(['warehouses-list'])
                    break
                case '/inventory/audit':
                    prefetchData(['inventory-kanban', 'warehouses-list'])
                    break
                case '/inventory/stock':
                    prefetchData(['inventory-kanban', 'warehouses-list'])
                    break
            }
        }

        const timeout = setTimeout(prefetchRelatedData, 500)
        return () => clearTimeout(timeout)
    }, [currentPath, prefetchData])

    return <>{children}</>
}
