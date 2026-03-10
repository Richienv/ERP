/**
 * Calculate the production target for a single BOM step.
 *
 * Rules:
 * 1. Single step (only one of its stationType) with NO allocations → totalQty
 * 2. Single step WITH allocations → totalQty (allocations show distribution, not target)
 * 3. Multiple parallel siblings of same stationType, NONE have allocations → split evenly
 * 4. Multiple parallel siblings, EACH has allocations → each step target = its own allocTotal
 */
export function calcStepTarget(
    step: { id: string; station?: { stationType?: string } | null; allocations?: { quantity: number }[] },
    allSteps: typeof step[],
    totalQty: number,
): number {
    const stationType = step.station?.stationType
    const siblings = stationType
        ? allSteps.filter((s) => s.station?.stationType === stationType)
        : [step]

    if (siblings.length <= 1) {
        return totalQty
    }

    const siblingsWithAllocs = siblings.filter(
        (s) => (s.allocations || []).reduce((sum, a) => sum + (a.quantity || 0), 0) > 0
    )

    if (siblingsWithAllocs.length > 0) {
        const allocTotal = (step.allocations || []).reduce((sum, a) => sum + (a.quantity || 0), 0)
        if (allocTotal > 0) return allocTotal
        const allocatedTotal = siblingsWithAllocs.reduce(
            (sum, s) => sum + (s.allocations || []).reduce((a, b) => a + (b.quantity || 0), 0),
            0
        )
        const unallocatedSiblings = siblings.length - siblingsWithAllocs.length
        const leftover = Math.max(0, totalQty - allocatedTotal)
        return unallocatedSiblings > 0 ? Math.floor(leftover / unallocatedSiblings) : totalQty
    }

    const idx = siblings.indexOf(step)
    const share = Math.floor(totalQty / siblings.length)
    const remainder = totalQty % siblings.length
    return share + (idx < remainder ? 1 : 0)
}

/** Calculate targets for all steps at once (returns Map<stepId, target>) */
export function calcAllStepTargets(
    steps: { id: string; station?: { stationType?: string } | null; allocations?: { quantity: number }[] }[],
    totalQty: number,
): Map<string, number> {
    const targets = new Map<string, number>()
    for (const step of steps) {
        targets.set(step.id, calcStepTarget(step, steps, totalQty))
    }
    return targets
}

/**
 * Calculate per-piece duration along the critical path.
 * Parallel siblings (same stationType) run simultaneously → take max, not sum.
 */
export function calcCriticalPathDuration(
    steps: { id: string; station?: { stationType?: string } | null; durationMinutes?: number | null }[]
): number {
    const groups: Record<string, number[]> = {}
    for (const step of steps) {
        const type = step.station?.stationType || step.id
        if (!groups[type]) groups[type] = []
        groups[type].push(Number(step.durationMinutes) || 0)
    }
    let total = 0
    for (const durations of Object.values(groups)) {
        total += Math.max(...durations, 0)
    }
    return total
}
