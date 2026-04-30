"use client"

import { useProductsPage } from "@/hooks/use-products-query"
import { StockClient } from "./stock-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function StockLevelPage() {
    const { data, isLoading } = useProductsPage()

    if (isLoading || !data) {
        return <TablePageSkeleton accentColor="bg-emerald-400" />
    }

    return (
        <div className="mf-page min-h-screen">
            <StockClient products={data.products} warehouses={data.warehouses} />
        </div>
    )
}
