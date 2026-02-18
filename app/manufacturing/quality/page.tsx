"use client"

import { useMfgQuality } from "@/hooks/use-mfg-quality"
import { QualityClient } from "./quality-client"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"

const emptySummary = { passRate: 100, defectCount: 0, pendingCount: 0, todayCount: 0 }

export default function QualityControlPage() {
    const { data, isLoading } = useMfgQuality()

    if (isLoading) {
        return <TablePageSkeleton accentColor="bg-emerald-400" />
    }

    return (
        <div className="mf-page">
            <QualityClient
                initialInspections={data?.inspections ?? []}
                initialPendingQueue={data?.pendingQueue ?? []}
                initialSummary={data?.summary ?? emptySummary}
            />
        </div>
    )
}
