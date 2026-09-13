import { getFinanceDashboardData, getFinancialMetrics } from "@/lib/actions/finance-reports"
import { handleReadApi } from "@/lib/http/handle-read-api"

export const dynamic = "force-dynamic"

export async function GET() {
    return handleReadApi(async () => {
        const [metrics, dashboardData] = await Promise.all([
            getFinancialMetrics(),
            getFinanceDashboardData(),
        ])
        return { metrics, dashboardData }
    }, { cache: "DASHBOARD", failMessage: "Gagal memuat dasbor keuangan" })
}
