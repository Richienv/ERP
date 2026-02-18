"use client"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import { CompanyPulseBar } from "@/components/dashboard/company-pulse-bar"
import { CeoActionCenter } from "@/components/dashboard/ceo-action-center"
import { FinancialHealthCard } from "@/components/dashboard/financial-health-card"
import { AiSearchCard } from "@/components/dashboard/ai-search-card"
import { OperationsStrip } from "@/components/dashboard/operations-strip"
import { CompactActivityFeed } from "@/components/dashboard/compact-activity-feed"
import { TrendingWidget } from "@/components/dashboard/trending-widget"
import { OEEGauge } from "@/components/dashboard/oee-gauge"
import { ShiftHandoverWidget } from "@/components/dashboard/shift-handover-widget"
import { MachineDowntimeWidget } from "@/components/dashboard/machine-downtime-widget"
import { useExecutiveDashboard } from "@/hooks/use-executive-dashboard"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function DashboardPage() {
    const { data, isLoading } = useExecutiveDashboard()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-zinc-700" />
    }

    const { financials, operations, activity, charts, sales, oee, shiftNotes, downtimeLogs } = data

    const cashFlowData = (charts?.dataCash7d ?? []).map((d: any) => ({
        date: d.name ?? d.date ?? d.day ?? "",
        balance: Number(d.val ?? d.balance ?? d.value ?? 0)
    }))

    const activities = (activity?.activityFeed ?? []).map((a: any, i: number) => ({
        id: a.id ?? `activity-${i}`,
        type: a.type ?? "general",
        title: a.title ?? a.message ?? "",
        description: a.description ?? a.message ?? "",
        timestamp: a.timestamp ?? a.time ?? a.createdAt ?? new Date().toISOString(),
    }))

    return (
        <DashboardView
            pulseBarSlot={
                <CompanyPulseBar
                    cashBalance={financials?.cashBalance ?? 0}
                    revenueMTD={sales?.totalRevenue ?? 0}
                    netMargin={financials?.netMargin ?? 0}
                    inventoryValue={operations?.inventoryValue?.value ?? 0}
                    inventoryItems={operations?.inventoryValue?.itemCount ?? 0}
                    burnRate={financials?.burnRate ?? 0}
                />
            }
            actionCenterSlot={
                <CeoActionCenter
                    pendingApproval={operations?.procurement?.pendingApproval ?? operations?.procurement?.delays ?? []}
                    activeCount={operations?.procurement?.activeCount ?? 0}
                    alerts={[]}
                    pendingLeaves={operations?.leaves ?? 0}
                    totalPRs={operations?.procurement?.totalPRs ?? 0}
                    pendingPRs={operations?.procurement?.pendingPRs ?? 0}
                    totalPOs={operations?.procurement?.totalPOs ?? 0}
                    totalPOValue={operations?.procurement?.totalPOValue ?? 0}
                    poByStatus={operations?.procurement?.poByStatus ?? {}}
                />
            }
            financialHealthSlot={
                <FinancialHealthCard
                    cashFlowData={cashFlowData}
                    accountsReceivable={financials?.receivables ?? 0}
                    accountsPayable={financials?.payables ?? 0}
                    overdueInvoices={financials?.overdueInvoices ?? []}
                    upcomingPayables={financials?.upcomingPayables ?? []}
                    recentInvoices={financials?.recentInvoices ?? []}
                    netCashIn={financials?.netCashIn ?? 0}
                    revenueMTD={sales?.totalRevenue ?? 0}
                />
            }
            aiSearchSlot={<AiSearchCard />}
            operationsStripSlot={
                <OperationsStrip
                    activeWorkOrders={operations?.prodMetrics?.activeWorkOrders ?? 0}
                    lowStockCount={Array.isArray(operations?.materialStatus) ? operations.materialStatus.length : 0}
                    salesRevenueMTD={sales?.totalRevenue ?? 0}
                    attendanceRate={operations?.workforceStatus?.attendanceRate ?? 0}
                    totalStaff={operations?.workforceStatus?.totalStaff ?? 0}
                    qualityPassRate={operations?.qualityStatus?.passRate ?? 0}
                />
            }
            textileStripSlot={
                <>
                    <div className="md:col-span-3 min-h-0 overflow-hidden">
                        <OEEGauge
                            oee={oee?.oee ?? 0}
                            availability={oee?.availability ?? 0}
                            performance={oee?.performance ?? 0}
                            quality={oee?.quality ?? 0}
                        />
                    </div>
                    <div className="md:col-span-4 min-h-0 overflow-hidden">
                        <ShiftHandoverWidget notes={shiftNotes ?? []} />
                    </div>
                    <div className="md:col-span-5 min-h-0 overflow-hidden">
                        <MachineDowntimeWidget logs={downtimeLogs ?? []} />
                    </div>
                </>
            }
            activityFeedSlot={
                <CompactActivityFeed activities={activities} />
            }
            trendingSlot={
                <TrendingWidget
                    activePOs={operations?.procurement?.activeCount ?? 0}
                    lowStockAlerts={Array.isArray(operations?.materialStatus) ? operations.materialStatus.length : 0}
                    pendingLeaves={operations?.leaves ?? 0}
                    activeOrders={sales?.activeOrders ?? 0}
                    totalPRs={operations?.procurement?.totalPRs ?? 0}
                    pendingPRs={operations?.procurement?.pendingPRs ?? 0}
                />
            }
        />
    )
}
