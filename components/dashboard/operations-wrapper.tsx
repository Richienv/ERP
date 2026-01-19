import {
    getProductionStatus,
    getMaterialStatus,
    getQualityStatus,
    getWorkforceStatus,
    getActivityFeed,
    getExecutiveAlerts
} from "@/app/actions/dashboard"
import { ProductionLineStatus } from "@/components/manager/production-line-status"
import { MaterialTrackingCard } from "@/components/manager/material-tracking-card"
import { QualityTrackingCard } from "@/components/manager/quality-tracking-card"
import { RitchieSDMCard } from "@/components/dashboard/ritchie-sdm-card"
import { RitchieActivityFeed } from "@/components/dashboard/ritchie-activity-feed"
import { ExecutiveAlerts } from "@/components/dashboard/executive-alerts"
import { MetricsAnimator } from "@/components/dashboard/metrics-animator"

export async function OperationsWrapper() {
    // Artificial delay removed for perf

    const [
        machines,
        materials,
        qc,
        workforce,
        activities,
        alerts
    ] = await Promise.all([
        getProductionStatus(),
        getMaterialStatus(),
        getQualityStatus(),
        getWorkforceStatus(),
        getActivityFeed(),
        getExecutiveAlerts()
    ])

    return (
        <MetricsAnimator>
            {/* Row 2: Operational Details */}
            <div className="md:col-span-4 h-full min-h-[400px]">
                <ProductionLineStatus data={machines} />
            </div>
            <div className="md:col-span-2 h-full min-h-[400px]">
                <ExecutiveAlerts data={alerts} />
            </div>

            {/* Row 3: Tracking & HR - Nested Grid wrapper to span 6 cols */}
            {/* Note: MetricsAnimator children are direct grid items of the parent grid (cols-6) if we are not careful.
                But MetricsAnimator renders a fragment or a wrapper?
                Let's check MetricsAnimator. It maps children to divs.
                So if we want a nested grid row, we should put these 4 items in a single col-span-6 div with its own grid.
             */}

            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div className="min-h-[400px]">
                    <RitchieActivityFeed data={activities} />
                </div>
                <div className="min-h-[400px]">
                    <MaterialTrackingCard data={materials} />
                </div>
                <div className="min-h-[400px]">
                    <QualityTrackingCard data={qc} />
                </div>
                <div className="min-h-[400px]">
                    <RitchieSDMCard data={workforce} />
                </div>
            </div>
        </MetricsAnimator>
    )
}
