import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { cookies } from "next/headers"
import { ProductsPageHydrated } from "./products-hydrated"

export const dynamic = "force-dynamic"

export default async function InventoryProductsPage() {
    const queryClient = new QueryClient()
    const cookieStore = await cookies()
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ")

    await queryClient.prefetchQuery({
        queryKey: queryKeys.products.list(),
        queryFn: async () => {
            const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/api/inventory/page-data`, {
                headers: { Cookie: cookieHeader },
            })
            if (!res.ok) return { products: [], categories: [], warehouses: [], stats: { total: 0, healthy: 0, lowStock: 0, critical: 0, newArrivals: 0, planning: 0, incoming: 0, totalValue: 0 } }
            return res.json()
        },
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProductsPageHydrated />
        </HydrationBoundary>
    )
}
