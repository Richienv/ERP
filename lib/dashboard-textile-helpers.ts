// ==============================================================================
// OEE Calculation (Pure Function — separated from server actions for Next.js)
// ==============================================================================

export interface OEEMetrics {
    availability: number    // % of scheduled time machine was running
    performance: number     // % of theoretical max output achieved
    quality: number         // % of good output vs total
    oee: number            // availability × performance × quality
    totalScheduledMinutes: number
    totalDowntimeMinutes: number
    totalProduced: number
    totalDefects: number
}

export function calculateOEE(params: {
    scheduledMinutes: number
    downtimeMinutes: number
    totalProduced: number
    theoreticalCapacity: number
    defects: number
}): OEEMetrics {
    const { scheduledMinutes, downtimeMinutes, totalProduced, theoreticalCapacity, defects } = params

    const runTime = Math.max(scheduledMinutes - downtimeMinutes, 0)
    const availability = scheduledMinutes > 0 ? (runTime / scheduledMinutes) * 100 : 0
    const performance = theoreticalCapacity > 0 ? (totalProduced / theoreticalCapacity) * 100 : 0
    const quality = totalProduced > 0 ? ((totalProduced - defects) / totalProduced) * 100 : 0
    const oee = (availability / 100) * (performance / 100) * (quality / 100) * 100

    return {
        availability: Math.round(availability * 10) / 10,
        performance: Math.min(Math.round(performance * 10) / 10, 100),
        quality: Math.round(quality * 10) / 10,
        oee: Math.round(oee * 10) / 10,
        totalScheduledMinutes: scheduledMinutes,
        totalDowntimeMinutes: downtimeMinutes,
        totalProduced,
        totalDefects: defects,
    }
}
