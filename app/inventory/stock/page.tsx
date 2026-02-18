"use client"

import { useProductsPage } from "@/hooks/use-products-query"
import { StockClient } from "./stock-client"
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function StockLevelPage() {
    const { data, isLoading } = useProductsPage()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-emerald-400" />
    }

    return (
        <InventoryPerformanceProvider currentPath="/inventory/stock">
            <div className="p-4 md:p-8 pt-6 max-w-[1600px] mx-auto min-h-screen">
                <StockClient products={data.products} warehouses={data.warehouses} />
            </div>
        </InventoryPerformanceProvider>
    )
}
