import { ProductionLineStatus } from "@/components/manager/production-line-status"
import { MaterialTrackingCard } from "@/components/manager/material-tracking-card"
import { QualityTrackingCard } from "@/components/manager/quality-tracking-card"
import { RitchieSDMCard } from "@/components/dashboard/ritchie-sdm-card"
import { RitchieActivityFeed } from "@/components/dashboard/ritchie-activity-feed"
import { ExecutiveAlerts } from "@/components/dashboard/executive-alerts"
import { MetricsAnimator } from "@/components/dashboard/metrics-animator"
import { SDMApprovalQueueCard } from "@/components/dashboard/sdm-approval-queue-card"

interface OperationsWrapperProps {
    data: {
        prodStatus: any
        materialStatus: any
        qualityStatus: any
        workforceStatus: any
        activityFeed: any
        executiveAlerts: any
        sdmApprovals: any
    }
}

export async function OperationsWrapper({ data }: OperationsWrapperProps) {
    // Artificial delay removed for perf
    // Data is now passed from parent

    const machines = data.prodStatus
    const materials = data.materialStatus
    const qc = data.qualityStatus
    const workforce = data.workforceStatus
    const activities = data.activityFeed
    const alerts = data.executiveAlerts
    const sdmApprovals = data.sdmApprovals

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
            <div className="md:col-span-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
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
                <div className="min-h-[400px]">
                    <SDMApprovalQueueCard data={sdmApprovals} />
                </div>
            </div>
        </MetricsAnimator>
    )
}
