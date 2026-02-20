"use client"

import { DashboardView } from "@/components/dashboard/dashboard-view"
import { CompanyPulseBar } from "@/components/dashboard/company-pulse-bar"
import { KpiSummaryCards } from "@/components/dashboard/kpi-summary-cards"
import { CeoActionCenter } from "@/components/dashboard/ceo-action-center"
import { FinancialHealthCard } from "@/components/dashboard/financial-health-card"
import { WarehouseOverview } from "@/components/dashboard/warehouse-overview"
import { StaffToday } from "@/components/dashboard/staff-today"
import { CompactActivityFeed } from "@/components/dashboard/compact-activity-feed"
import { useExecutiveDashboard } from "@/hooks/use-executive-dashboard"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

export default function DashboardPage() {
    const { data, isLoading } = useExecutiveDashboard()

    if (isLoading || !data) {
        return <CardPageSkeleton accentColor="bg-zinc-700" />
    }

    const { financials, operations, activity, charts, sales, hr, tax } = data

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
            kpiCardsSlot={
                <KpiSummaryCards
                    totalPRValue={operations?.procurement?.totalPRValue ?? 0}
                    totalPOValue={operations?.procurement?.totalPOValue ?? 0}
                    totalSalary={hr?.totalSalary ?? 0}
                    ppnNet={tax?.ppnNet ?? 0}
                    totalPRs={operations?.procurement?.totalPRs ?? 0}
                    totalPOs={operations?.procurement?.totalPOs ?? 0}
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
            warehouseSlot={
                <WarehouseOverview warehouses={operations?.inventoryValue?.warehouses ?? []} />
            }
            staffSlot={
                <StaffToday
                    totalStaff={operations?.workforceStatus?.totalStaff ?? 0}
                    presentCount={operations?.workforceStatus?.presentCount ?? 0}
                    lateCount={operations?.workforceStatus?.lateCount ?? 0}
                    attendanceRate={operations?.workforceStatus?.attendanceRate ?? 0}
                    topEmployees={operations?.workforceStatus?.topEmployees ?? []}
                />
            }
            activityFeedSlot={
                <CompactActivityFeed activities={activities} />
            }
        />
    )
}
