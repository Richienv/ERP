import { getAllPurchaseOrders, getVendors } from "@/lib/actions/procurement"
import { getProductsForPO } from "@/app/actions/purchase-order"
import { OrdersView } from "@/app/procurement/orders/orders-view"

export async function OrdersWrapper() {
    const [orders, vendorsRaw, products] = await Promise.all([
        getAllPurchaseOrders(),
        getVendors(),
        getProductsForPO()
    ])

    const vendors = vendorsRaw.map(v => ({ id: v.id, name: v.name, email: v.email, phone: v.phone }))

    return (
        <OrdersView
            initialOrders={orders}
            vendors={vendors}
            products={products}
        />
    )
}
