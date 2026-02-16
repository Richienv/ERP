import { CutPlanStatus } from "@prisma/client"

// ==============================================================================
// Allowed Transitions
// ==============================================================================

export const allowedCutPlanTransitions: Partial<
    Record<CutPlanStatus, CutPlanStatus[]>
> = {
    CP_DRAFT: ["FABRIC_ALLOCATED", "CP_CANCELLED"],
    FABRIC_ALLOCATED: ["IN_CUTTING", "CP_DRAFT", "CP_CANCELLED"],
    IN_CUTTING: ["CP_COMPLETED", "CP_CANCELLED"],
}

// ==============================================================================
// Assertion
// ==============================================================================

export function assertCutPlanTransition(
    current: CutPlanStatus,
    next: CutPlanStatus
): void {
    const allowed = allowedCutPlanTransitions[current] || []
    if (!allowed.includes(next)) {
        throw new Error(
            `Transisi status cut plan tidak valid: ${current} → ${next}`
        )
    }
}

// ==============================================================================
// Labels (Indonesian)
// ==============================================================================

export const cutPlanStatusLabels: Record<CutPlanStatus, string> = {
    CP_DRAFT: "Draft",
    FABRIC_ALLOCATED: "Kain Dialokasikan",
    IN_CUTTING: "Sedang Dipotong",
    CP_COMPLETED: "Selesai",
    CP_CANCELLED: "Dibatalkan",
}

export const cutPlanStatusColors: Record<CutPlanStatus, string> = {
    CP_DRAFT: "bg-zinc-100 text-zinc-600 border-zinc-300",
    FABRIC_ALLOCATED: "bg-blue-100 text-blue-700 border-blue-300",
    IN_CUTTING: "bg-amber-100 text-amber-700 border-amber-300",
    CP_COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    CP_CANCELLED: "bg-red-100 text-red-700 border-red-300",
}

// ==============================================================================
// Pure helpers
// ==============================================================================

export function canCutPlanTransitionTo(
    current: CutPlanStatus,
    next: CutPlanStatus
): boolean {
    const allowed = allowedCutPlanTransitions[current] || []
    return allowed.includes(next)
}

export function getCutPlanNextStatuses(
    current: CutPlanStatus
): CutPlanStatus[] {
    return allowedCutPlanTransitions[current] || []
}

export function isCutPlanTerminal(status: CutPlanStatus): boolean {
    return status === "CP_COMPLETED" || status === "CP_CANCELLED"
}

// ==============================================================================
// Pure Calculations
// ==============================================================================

/**
 * Calculate marker efficiency (percentage of fabric actually used vs total spread).
 * @param markerAreaUsed - actual pattern area used (m²)
 * @param markerLength - length of marker (m)
 * @param fabricWidth - fabric width (cm, converted to m internally)
 * @returns efficiency percentage (0-100)
 */
export function calculateMarkerEfficiency(
    markerAreaUsed: number,
    markerLength: number,
    fabricWidthCm: number
): number {
    if (markerLength <= 0 || fabricWidthCm <= 0) return 0
    const fabricWidthM = fabricWidthCm / 100
    const totalArea = markerLength * fabricWidthM
    if (totalArea <= 0) return 0
    return Math.round((markerAreaUsed / totalArea) * 10000) / 100
}

/**
 * Calculate total fabric required for a cut plan.
 * @param markerLength - length of one marker spread (m)
 * @param totalLayers - number of layers (plies)
 * @param wastagePercent - wastage percentage (default 3%)
 * @returns total meters of fabric required
 */
export function calculateFabricRequired(
    markerLength: number,
    totalLayers: number,
    wastagePercent: number = 3
): number {
    if (markerLength <= 0 || totalLayers <= 0) return 0
    const rawMeters = markerLength * totalLayers
    const withWastage = rawMeters * (1 + wastagePercent / 100)
    return Math.round(withWastage * 100) / 100
}

/**
 * Calculate yield (good pieces vs total cut).
 * @param actualQty - actual pieces produced
 * @param defectQty - defective pieces
 * @returns yield percentage (0-100)
 */
export function calculateCutYield(
    actualQty: number,
    defectQty: number
): number {
    const total = actualQty + defectQty
    if (total <= 0) return 0
    return Math.round((actualQty / total) * 10000) / 100
}
