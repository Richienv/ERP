import { getLatestSnapshot, getFinancialChartData } from "@/app/actions/dashboard"
import { FinanceSnapshot } from "@/components/dashboard/finance-snapshot"

export async function FinanceWrapper() {
    const [snapshot, chartData] = await Promise.all([
        getLatestSnapshot(),
        getFinancialChartData()
    ])

    return <FinanceSnapshot data={snapshot} chartData={chartData} />
}
