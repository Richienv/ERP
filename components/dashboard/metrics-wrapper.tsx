import { CompanyPulseBar } from "@/components/dashboard/company-pulse-bar"
import { CeoActionCenter } from "@/components/dashboard/ceo-action-center"
import { FinancialHealthCard } from "@/components/dashboard/financial-health-card"
import { AiSearchCard } from "@/components/dashboard/ai-search-card"

interface MetricsWrapperProps {
    data: {
        financialChart: any
        deadStock: number
        procurement: any
        hr: any
        leaves: number
        audit: any
        prodMetrics: any
        materialStatus: any
        qualityStatus: any
        workforceStatus: any
        executiveAlerts: any
        inventoryValue: { value: number; itemCount: number }
    }
    salesStats: any
    snapshot: any
    slot: "pulseBar" | "actionCenter" | "financialHealth" | "aiSearch"
}

export async function MetricsWrapper({ data, snapshot, salesStats, slot }: MetricsWrapperProps) {
    // Prepare pulse bar data
    const cashBalance = snapshot?.cashBalance ?? 0
    const revenueMTD = salesStats?.totalRevenue ?? 0
    // snapshot.netProfit is actually the netMargin percentage from getFinancialMetrics()
    // So use it directly as a percentage, don't divide by revenue again
    const netMargin = snapshot?.netProfit ?? 0
    const inventoryValue = data.inventoryValue?.value ?? 0
    const inventoryItems = data.inventoryValue?.itemCount ?? 0
    const burnRate = snapshot?.burnRate ?? 0

    if (slot === "pulseBar") {
        return (
            <CompanyPulseBar
                cashBalance={cashBalance}
                revenueMTD={revenueMTD}
                netMargin={netMargin}
                inventoryValue={inventoryValue}
                inventoryItems={inventoryItems}
                burnRate={burnRate}
            />
        )
    }

    if (slot === "actionCenter") {
        const pendingApproval = data.procurement?.pendingApproval ?? data.procurement?.delays ?? []
        const activeCount = data.procurement?.activeCount ?? 0
        const alerts = data.executiveAlerts ?? []
        const pendingLeaves = data.leaves ?? 0

        return (
            <CeoActionCenter
                pendingApproval={pendingApproval}
                activeCount={activeCount}
                alerts={alerts}
                pendingLeaves={pendingLeaves}
            />
        )
    }

    if (slot === "financialHealth") {
        // dataCash7d from fetchFinancialChartData: Array<{ name: string; val: number }>
        // name = weekday (Mon, Tue...), val = cash in millions (jt)
        const cashFlowData = (data.financialChart?.dataCash7d ?? []).map((d: any) => ({
            date: d.name ?? d.date ?? d.day ?? "",
            balance: Number(d.val ?? d.balance ?? d.value ?? 0)
        }))
        const accountsReceivable = snapshot?.accountsReceivable ?? 0
        const accountsPayable = snapshot?.accountsPayable ?? 0
        const overdueInvoices = snapshot?.overdueInvoices ?? []
        const upcomingPayables = snapshot?.upcomingPayables ?? []

        return (
            <FinancialHealthCard
                cashFlowData={cashFlowData}
                accountsReceivable={accountsReceivable}
                accountsPayable={accountsPayable}
                overdueInvoices={overdueInvoices}
                upcomingPayables={upcomingPayables}
            />
        )
    }

    // aiSearch
    return <AiSearchCard />
}
