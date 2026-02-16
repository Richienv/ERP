import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getStockTransfers, getTransferFormData } from "@/lib/actions/stock-transfers"
import { StockTransferList } from "@/components/inventory/stock-transfer-list"

export const dynamic = "force-dynamic"

async function TransferData() {
    const [transfers, formData] = await Promise.all([
        getStockTransfers(),
        getTransferFormData(),
    ])

    return (
        <StockTransferList
            transfers={transfers}
            warehouses={formData.warehouses}
            products={formData.products}
        />
    )
}

function TransferSkeleton() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-[300px] w-full" />
        </div>
    )
}

export default function StockTransfersPage() {
    return (
        <div className="mf-page">
            <div>
                <h2 className="mf-title">Stock Transfers</h2>
                <p className="text-muted-foreground">Transfer stok antar gudang dengan approval workflow.</p>
            </div>

            <Suspense fallback={<TransferSkeleton />}>
                <TransferData />
            </Suspense>
        </div>
    )
}
