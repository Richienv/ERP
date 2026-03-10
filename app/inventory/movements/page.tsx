"use client"

import { useSearchParams } from "next/navigation"
import { useStockMovements } from "@/hooks/use-stock-movements"
import { MovementsClient } from "./movements-client"
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function StockMovementsPage() {
    const searchParams = useSearchParams()
    const productId = searchParams.get("product")
    const warehouseId = searchParams.get("warehouse")
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
                initialProductFilter={productId}
                initialWarehouseFilter={warehouseId}
            />
        </InventoryPerformanceProvider>
    )
}
