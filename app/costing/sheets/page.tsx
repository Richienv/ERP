"use client"

import { useCostSheets } from "@/hooks/use-cost-sheets"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { SheetsClient } from "./sheets-client"

export default function CostSheetsPage() {
    const { data, isLoading } = useCostSheets()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <SheetsClient initialSheets={data.initialSheets} products={data.products} />
        </div>
    )
}
