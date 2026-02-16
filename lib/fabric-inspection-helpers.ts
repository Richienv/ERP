// ==============================================================================
// 4-Point Fabric Inspection Pure Functions (extracted from "use server" file)
// ==============================================================================

export interface FabricDefectEntry {
    location: string       // e.g. "3.5m from edge"
    type: string           // e.g. "Hole", "Stain", "Weaving defect"
    points: 1 | 2 | 3 | 4 // 1=minor, 2=moderate, 3=major, 4=critical
}

export interface FabricInspectionResult {
    totalPoints: number
    pointsPer100Yards: number
    metersInspected: number
    defectCount: number
    passed: boolean
    grade: 'A' | 'B' | 'C' | 'REJECT'
}

/**
 * Calculate 4-Point inspection score.
 *
 * @param metersInspected Total meters of fabric inspected
 * @param defects Array of defect entries with point values
 * @param passThreshold Points per 100 yards threshold (default 28)
 */
export function calculate4PointScore(
    metersInspected: number,
    defects: FabricDefectEntry[],
    passThreshold = 28
): FabricInspectionResult {
    const totalPoints = defects.reduce((sum, d) => sum + d.points, 0)

    // Convert meters to yards (1 meter = 1.09361 yards)
    const yardsInspected = metersInspected * 1.09361
    const pointsPer100Yards = yardsInspected > 0
        ? Math.round((totalPoints / yardsInspected) * 100 * 10) / 10
        : 0

    const passed = pointsPer100Yards <= passThreshold

    let grade: 'A' | 'B' | 'C' | 'REJECT'
    if (pointsPer100Yards <= 10) grade = 'A'
    else if (pointsPer100Yards <= 20) grade = 'B'
    else if (pointsPer100Yards <= passThreshold) grade = 'C'
    else grade = 'REJECT'

    return {
        totalPoints,
        pointsPer100Yards,
        metersInspected,
        defectCount: defects.length,
        passed,
        grade,
    }
}
