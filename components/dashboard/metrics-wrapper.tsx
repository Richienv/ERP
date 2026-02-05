import { getLatestSnapshot, getProcurementMetrics, getHRMetrics, getPendingLeaves, getAuditStatus, getProductionMetrics, getDeadStockValue, getFinancialChartData } from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"
import { FinanceSnapshot } from "@/components/dashboard/finance-snapshot"
import { ExecutiveKPIs } from "@/components/dashboard/executive-kpis"
import { MetricsAnimator } from "@/components/dashboard/metrics-animator"

export async function MetricsWrapper() {

    // Parallel Fetching of ALL data
    const [
        snapshot,
        chartData,
        procurement,
        hrMetrics,
        pendingLeaves,
        auditStatus,
        production,
        salesStats,
        deadStockValue
    ] = await Promise.all([
        getLatestSnapshot().catch(() => null),
        getFinancialChartData().catch(() => null),
        getProcurementMetrics().catch(() => ({ activeCount: 0, delays: [] })),
        getHRMetrics().catch(() => ({ totalSalary: 0, lateEmployees: [] })),
        getPendingLeaves().catch(() => 0),
        getAuditStatus().catch(() => null),
        getProductionMetrics().catch(() => ({ activeWorkOrders: 0, totalProduction: 0, efficiency: 0 })),
        getSalesStats().catch(() => ({ totalRevenue: 0, totalOrders: 0, activeOrders: 0, recentOrders: [] })),
        getDeadStockValue().catch(() => 0)
    ])

    const kpiData = {
        procurement: procurement,
        hr: { ...hrMetrics, pendingLeaves },
        inventory: {
            auditDate: auditStatus?.date,
            warehouseName: auditStatus?.warehouseName,
            deadStockValue: deadStockValue
        },
        production: production,
        sales: salesStats
    }

    return (
        <MetricsAnimator>
            <div className="md:col-span-6">
                <FinanceSnapshot data={snapshot} chartData={chartData} />
            </div>
            <div className="md:col-span-6">
                <ExecutiveKPIs {...kpiData} />
            </div>
        </MetricsAnimator>
    )
}
