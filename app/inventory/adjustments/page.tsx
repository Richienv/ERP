"use client"

import { useAdjustmentsData } from "@/hooks/use-stock-movements"
import { AdjustmentsClient } from "./adjustments-client"
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function StockAdjustmentsPage() {
    const { data, isLoading } = useAdjustmentsData()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-emerald-400" />
    }

    return (
        <InventoryPerformanceProvider currentPath="/inventory/adjustments">
            <AdjustmentsClient
                products={data.products}
                warehouses={data.warehouses}
                movements={data.movements}
            />
        </InventoryPerformanceProvider>
    )
}
