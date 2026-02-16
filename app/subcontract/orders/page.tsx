import { Suspense } from "react"
import {
    getSubcontractOrders,
    getSubcontractors,
    getProductsForSubcontract,
} from "@/lib/actions/subcontract"
import { SubcontractOrdersClient } from "@/components/subcontract/subcontract-orders-client"
import { ClipboardList } from "lucide-react"

export const dynamic = "force-dynamic"

async function OrdersContent() {
    const [orders, subcontractors, products] = await Promise.all([
        getSubcontractOrders(),
        getSubcontractors(),
        getProductsForSubcontract(),
    ])

    return (
        <SubcontractOrdersClient
            orders={orders}
            subcontractors={subcontractors}
            products={products}
        />
    )
}

export default function SubcontractOrdersPage() {
    return (
        <div className="p-6 space-y-6">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400">
                        <ClipboardList className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat order...
                        </span>
                    </div>
                }
            >
                <OrdersContent />
            </Suspense>
        </div>
    )
}
