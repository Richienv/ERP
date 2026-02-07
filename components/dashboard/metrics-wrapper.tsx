import { FinanceSnapshot } from "@/components/dashboard/finance-snapshot"
import { ExecutiveKPIs } from "@/components/dashboard/executive-kpis"
import { MetricsAnimator } from "@/components/dashboard/metrics-animator"

interface MetricsWrapperProps {
    data: {
        financialChart: any
        deadStock: number
        procurement: any
        hr: any
        leaves: number
        audit: any
        prodMetrics: any
        // Sales stats might still be separate if not included in dashboard aggregator, 
        // but for now let's assume we pass what we have or fetch sales separately if needed.
        // The dashboard aggregator didn't include sales stats in my previous edit?
        // Wait, looking at getDashboardData, I missed getSalesStats in the aggregation!
        // I should probably fix that or keep sales stats separate if it's from a different module/db part?
        // getSalesStats was in the original parallel fetch list.
    }
    // For now I will pass the aggregated data, and handled missing sales data gracefully or fetch it here if needed?
    // Actually, getSalesStats is from @/lib/actions/sales. 
    // It's better to pass it in too.
    salesStats: any
    snapshot: any
}

export async function MetricsWrapper({ data, snapshot, salesStats }: MetricsWrapperProps) {
    const kpiData = {
        procurement: data.procurement,
        hr: { ...data.hr, pendingLeaves: data.leaves },
        inventory: {
            auditDate: data.audit?.date,
            warehouseName: data.audit?.warehouseName,
            deadStockValue: data.deadStock
        },
        production: data.prodMetrics,
        sales: salesStats
    }

    return (
        <MetricsAnimator>
            <div className="md:col-span-6">
                <FinanceSnapshot data={snapshot} chartData={data.financialChart} />
            </div>
            <div className="md:col-span-6">
                <ExecutiveKPIs {...kpiData} />
            </div>
        </MetricsAnimator>
    )
}
