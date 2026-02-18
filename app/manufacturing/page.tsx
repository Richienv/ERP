"use client"

import { useMfgDashboard } from "@/hooks/use-mfg-dashboard"
import { ManufacturingDashboardClient } from "./manufacturing-dashboard-client"
import { CardPageSkeleton } from "@/components/ui/page-skeleton"

const emptyData = {
    productionHealth: { oee: 0, availability: 0, performance: 0, quality: 0 },
    workOrders: { total: 0, inProgress: 0, completedThisMonth: 0, productionThisMonth: 0, plannedThisMonth: 0 },
    machines: { total: 0, running: 0, idle: 0, maintenance: 0, breakdown: 0, avgHealth: 0, totalCapacity: 0 },
    quality: { passRate: 0, totalInspections: 0, passCount: 0, failCount: 0, recentInspections: [] },
    recentOrders: [],
    alerts: [],
}

export default function ManufacturingDashboardPage() {
    const { data, isLoading } = useMfgDashboard()

    if (isLoading) {
        return <CardPageSkeleton accentColor="bg-indigo-400" />
    }

    return <ManufacturingDashboardClient initialData={data ?? emptyData} />
}
