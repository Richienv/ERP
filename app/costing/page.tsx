"use client"

import { useCostingDashboard } from "@/hooks/use-costing-dashboard"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { CostingDashboardClient } from "./costing-dashboard-client"

export default function CostingPage() {
    const { data, isLoading } = useCostingDashboard()

    if (isLoading || !data) return <TablePageSkeleton accentColor="bg-emerald-400" />

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 pb-24">
            <CostingDashboardClient data={data.data} products={data.products} />
        </div>
    )
}
