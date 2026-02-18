"use client"

import { useStockTransfers } from "@/hooks/use-stock-transfers"
import { StockTransferList } from "@/components/inventory/stock-transfer-list"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

export default function StockTransfersPage() {
    const { data, isLoading } = useStockTransfers()

    return (
        <div className="mf-page">
            <div>
                <h2 className="mf-title">Stock Transfers</h2>
                <p className="text-muted-foreground">Transfer stok antar gudang dengan approval workflow.</p>
            </div>

            {isLoading || !data ? (
                <TablePageSkeleton accentColor="bg-blue-400" />
            ) : (
                <StockTransferList
                    transfers={data.transfers}
                    warehouses={data.warehouses}
                    products={data.products}
                />
            )}
        </div>
    )
}
