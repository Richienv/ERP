import { OperationsStrip } from "@/components/dashboard/operations-strip"
import { CompactActivityFeed } from "@/components/dashboard/compact-activity-feed"
import { TrendingWidget } from "@/components/dashboard/trending-widget"

interface OperationsWrapperProps {
    data: {
        prodMetrics: any
        materialStatus: any
        qualityStatus: any
        workforceStatus: any
        activityFeed: any
        executiveAlerts: any
        procurement: any
        leaves: number
        inventoryValue: { value: number; itemCount: number }
    }
    salesStats: any
    slot: "operationsStrip" | "activityFeed" | "trending"
}

export async function OperationsWrapper({ data, salesStats, slot }: OperationsWrapperProps) {
    if (slot === "operationsStrip") {
        return (
            <OperationsStrip
                activeWorkOrders={data.prodMetrics?.activeWorkOrders ?? 0}
                lowStockCount={Array.isArray(data.materialStatus) ? data.materialStatus.length : 0}
                salesRevenueMTD={salesStats?.totalRevenue ?? 0}
                attendanceRate={data.workforceStatus?.attendanceRate ?? 0}
                totalStaff={data.workforceStatus?.totalStaff ?? 0}
                qualityPassRate={data.qualityStatus?.passRate ?? 0}
            />
        )
    }

    if (slot === "activityFeed") {
        const activities = (data.activityFeed ?? []).map((a: any, i: number) => ({
            id: a.id ?? `activity-${i}`,
            type: a.type ?? "general",
            title: a.title ?? "",
            description: a.description ?? a.message ?? "",
            timestamp: a.timestamp ?? a.createdAt ?? new Date().toISOString(),
        }))

        return <CompactActivityFeed activities={activities} />
    }

    // trending
    return (
        <TrendingWidget
            activePOs={data.procurement?.activeCount ?? 0}
            lowStockAlerts={Array.isArray(data.materialStatus) ? data.materialStatus.length : 0}
            pendingLeaves={data.leaves ?? 0}
            activeOrders={salesStats?.activeOrders ?? 0}
        />
    )
}
