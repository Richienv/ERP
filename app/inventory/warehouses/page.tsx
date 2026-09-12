"use client"

import { useWarehouses } from "@/hooks/use-warehouses"
import { WarehousesClient } from "./warehouses-client"
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function WarehousesPage() {
    const { data } = useWarehouses()

    if (!data) {
        return <CardPageSkeleton />
    }

    return (
        <InventoryPerformanceProvider currentPath="/inventory/warehouses">
            <div className="mf-page">
                <WarehousesClient warehouses={data} />
            </div>
        </InventoryPerformanceProvider>
    )
}
