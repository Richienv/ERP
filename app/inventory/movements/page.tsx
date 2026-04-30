"use client"

import { useSearchParams } from "next/navigation"
import { useStockMovements } from "@/hooks/use-stock-movements"
import { MovementsClient } from "./movements-client"
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
        <MovementsClient
            movements={data.movements}
            products={data.products}
            warehouses={data.warehouses}
            initialProductFilter={productId}
            initialWarehouseFilter={warehouseId}
        />
    )
}
