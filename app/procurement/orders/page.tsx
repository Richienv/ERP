import { Suspense } from "react"
import { Loader2 } from "lucide-react"

import { getAllPurchaseOrders, getVendors } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"
import { OrdersView } from "@/app/procurement/orders/orders-view"

export const dynamic = 'force-dynamic'

export default async function PurchaseOrdersPage() {
    // Parallel fetching for performance
    const [orders, vendorsRaw, products] = await Promise.all([
        getAllPurchaseOrders(),
        getVendors(),
        getProductsForPO()
    ])

    // Map vendors to simple format for dropdown
    const vendors = vendorsRaw.map(v => ({ id: v.id, name: v.name }))

    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <OrdersView
                initialOrders={orders}
                vendors={vendors}
                products={products}
            />
        </Suspense>
    )
}
