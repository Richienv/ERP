"use client"

import { useProductsPage } from "@/hooks/use-products-query"
import { InventoryPerformanceProvider } from "@/components/inventory/inventory-performance-provider"
import { ProductsPageClient } from "./products-client"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function InventoryProductsPage() {
    const { data, isLoading } = useProductsPage()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-emerald-400" />
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
