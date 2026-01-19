import { getLatestSnapshot, getProcurementMetrics, getHRMetrics, getPendingLeaves, getAuditStatus, getProductionMetrics } from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"
import { FinanceSnapshot } from "@/components/dashboard/finance-snapshot"
import { ExecutiveKPIs } from "@/components/dashboard/executive-kpis"
import { MetricsAnimator } from "@/components/dashboard/metrics-animator"

export async function MetricsWrapper() {

    // Parallel Fetching of ALL data
    const [
        snapshot,
        procurement,
        hrMetrics,
        pendingLeaves,
        auditStatus,
        production,
        salesStats
    ] = await Promise.all([
        getLatestSnapshot(),
        getProcurementMetrics(),
        getHRMetrics(),
        getPendingLeaves(),
        getAuditStatus(),
        getProductionMetrics(),
        getSalesStats()
    ])

    const kpiData = {
        procurement: procurement,
        hr: { ...hrMetrics, pendingLeaves },
        inventory: {
            auditDate: auditStatus?.date,
            warehouseName: auditStatus?.warehouseName
        },
        production: production,
        sales: salesStats
    }

    return (
        <MetricsAnimator>
            <div className="md:col-span-6">
                <FinanceSnapshot data={snapshot} />
            </div>
            <div className="md:col-span-6">
                <ExecutiveKPIs {...kpiData} />
            </div>
        </MetricsAnimator>
    )
}
