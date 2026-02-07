import { getProcurementMetrics, getHRMetrics, getPendingLeaves, getAuditStatus, getProductionMetrics } from "@/app/actions/dashboard"
import { getSalesStats } from "@/lib/actions/sales"
import { ExecutiveKPIs } from "@/components/dashboard/executive-kpis"

export async function KPIWrapper() {
    // Parallel fetch for KPIs
    const [
        procurement,
        hrMetrics,
        pendingLeaves,
        auditStatus,
        production,
        salesStats
    ] = await Promise.all([
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

    return <ExecutiveKPIs {...kpiData} />
}
