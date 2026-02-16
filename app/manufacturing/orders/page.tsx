import { Suspense } from "react"
import { OrdersClient } from "./orders-client"
import { Package } from "lucide-react"

export const dynamic = "force-dynamic"

async function OrdersContent() {
    const emptySummary = { planned: 0, inProgress: 0, completed: 0, onHold: 0 }

    try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3002"
        const params = new URLSearchParams({ orderType: "MO" })
        const res = await fetch(`${baseUrl}/api/manufacturing/work-orders?${params.toString()}`, { cache: "no-store" })
        if (!res.ok) return <OrdersClient initialOrders={[]} initialSummary={emptySummary} />
        const result = await res.json()
        const orders = result.success ? result.data : []
        const summary = result.success ? result.summary : emptySummary
        return <OrdersClient initialOrders={orders} initialSummary={summary} />
    } catch {
        return <OrdersClient initialOrders={[]} initialSummary={emptySummary} />
    }
}

export default function ProductionOrdersPage() {
    return (
        <div className="min-h-screen bg-background pb-24">
            <Suspense
                fallback={
                    <div className="flex items-center gap-2 text-zinc-400 pt-8">
                        <Package className="h-5 w-5 animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                            Memuat order produksi...
                        </span>
                    </div>
                }
            >
                <OrdersContent />
            </Suspense>
        </div>
    )
}
