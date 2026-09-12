"use client"

import { useProductsPage } from "@/hooks/use-products-query"
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider"
import { ProductsPageClient } from "./products-client"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export function ProductsPageHydrated() {
    const { data } = useProductsPage()

    if (!data) {
        return <CardPageSkeleton />
    }

    return (
        <InventoryPerformanceProvider currentPath="/inventory/products">
            <ProductsPageClient
                products={data.products}
                categories={data.categories}
                warehouses={data.warehouses}
                stats={data.stats}
            />
        </InventoryPerformanceProvider>
    )
}
