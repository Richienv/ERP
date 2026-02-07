import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { OrdersWrapper } from "./orders-wrapper"

// Force dynamic rendering for real-time updates
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default function PurchaseOrdersPage() {
    return (
        <Suspense fallback={
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        }>
            <OrdersWrapper />
        </Suspense>
    )
}
