"use client"

import { useStockMovements } from "@/hooks/use-stock-movements"
import { MovementsClient } from "./movements-client"
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function StockMovementsPage() {
    const { data, isLoading } = useStockMovements()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-violet-400" />
    }

    return (
        <InventoryPerformanceProvider currentPath="/inventory/movements">
            <MovementsClient
                movements={data.movements}
                products={data.products}
                warehouses={data.warehouses}
            />
        </InventoryPerformanceProvider>
    )
}
