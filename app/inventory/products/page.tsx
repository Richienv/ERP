import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { cookies, headers } from "next/headers"
import { ProductsPageHydrated } from "./products-hydrated"

export const dynamic = "force-dynamic"

const FALLBACK = { products: [], categories: [], warehouses: [], stats: { total: 0, healthy: 0, lowStock: 0, critical: 0, newArrivals: 0, planning: 0, incoming: 0, totalValue: 0 } }

export default async function InventoryProductsPage() {
    const queryClient = new QueryClient()
    const cookieStore = await cookies()
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ")

    // Derive base URL from request headers — works on both localhost and Vercel
    const headersList = await headers()
    const host = headersList.get("host") || "localhost:3002"
    const proto = headersList.get("x-forwarded-proto") || "http"
    const baseUrl = `${proto}://${host}`

    await queryClient.prefetchQuery({
        queryKey: queryKeys.products.list(),
        queryFn: async () => {
            const res = await fetch(`${baseUrl}/api/inventory/page-data`, {
                headers: { Cookie: cookieHeader },
            })
            if (!res.ok) throw new Error("inventory page-data failed")
            const json = await res.json()
            if (json.success === false) throw new Error(json.error || "inventory page-data failed")
            return {
                products: json.products ?? [],
                categories: json.categories ?? [],
                warehouses: json.warehouses ?? [],
                stats: json.stats ?? FALLBACK.stats,
            }
        },
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <ProductsPageHydrated />
        </HydrationBoundary>
    )
}
