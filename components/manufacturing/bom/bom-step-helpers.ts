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
 * Calculate per-piece duration along the critical path (longest path through DAG).
 *
 * Uses parentStepIds to walk the actual DAG structure:
 * - Each step's earliest start = max(end times of all parents)
 * - Critical path = longest start + duration among all steps
 *
 * Falls back to stationType grouping when parentStepIds are not available
 * (e.g., flat step lists from API without DAG info).
 */
export function calcCriticalPathDuration(
    steps: { id: string; station?: { stationType?: string } | null; durationMinutes?: number | null; parentStepIds?: string[] }[]
): number {
    if (steps.length === 0) return 0

    // Check if any step has parentStepIds — if so, use DAG-based calculation
    const hasDAG = steps.some(s => (s.parentStepIds || []).length > 0)

    if (hasDAG) {
        // DAG-based critical path: compute end time for each step, return max
        const endTimes = new Map<string, number>()
        // Sort by sequence-like order: steps with no parents first, then by dependency
        const stepMap = new Map(steps.map(s => [s.id, s]))
        const computed = new Set<string>()

        function computeEnd(stepId: string): number {
            if (endTimes.has(stepId)) return endTimes.get(stepId)!
            const step = stepMap.get(stepId)
            if (!step) return 0

            const parents = (step.parentStepIds || []).filter(pid => stepMap.has(pid))
            // Guard against cycles — if we're already computing this step, return 0
            if (computed.has(stepId)) return 0
            computed.add(stepId)

            const earliestStart = parents.length > 0
                ? Math.max(...parents.map(pid => computeEnd(pid)))
                : 0
            const duration = Number(step.durationMinutes) || 0
            const end = earliestStart + duration
            endTimes.set(stepId, end)
            return end
        }

        for (const step of steps) {
            computeEnd(step.id)
        }

        return endTimes.size > 0 ? Math.max(...endTimes.values(), 0) : 0
    }

    // Fallback: group by stationType (for flat lists without DAG)
    // Parallel siblings (same stationType) run simultaneously → take max, not sum.
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

export interface SplitGroup {
    stationType: string
    stepIds: string[]
    percentages: Map<string, number>
}

/**
 * Detect split groups: parallel siblings (same parentStepIds) with same stationType.
 * Returns array of groups, each with 2+ members.
 */
export function detectSplitGroups(
    steps: { id: string; parentStepIds?: string[]; station?: { stationType?: string; operationType?: string } | null; allocations?: { quantity: number }[] }[],
    totalQty: number,
): SplitGroup[] {
    const buckets = new Map<string, typeof steps>()

    for (const step of steps) {
        const stationType = step.station?.stationType
        if (!stationType) continue
        if (step.station?.operationType === "SUBCONTRACTOR") continue

        const parentKey = [...(step.parentStepIds || [])].sort().join(",") || "__root__"
        const key = `${parentKey}|${stationType}`
        const bucket = buckets.get(key) || []
        bucket.push(step)
        buckets.set(key, bucket)
    }

    const groups: SplitGroup[] = []

    for (const [key, members] of buckets) {
        if (members.length < 2) continue

        const stationType = key.split("|").pop()!
        const percentages = new Map<string, number>()

        const totalAllocated = members.reduce(
            (sum, m) => sum + (m.allocations || []).reduce((a, b) => a + (b.quantity || 0), 0),
            0
        )

        if (totalAllocated > 0 && totalQty > 0) {
            let usedPct = 0
            members.forEach((m, i) => {
                const allocQty = (m.allocations || []).reduce((a, b) => a + (b.quantity || 0), 0)
                if (i < members.length - 1) {
                    const pct = Math.round((allocQty / totalQty) * 100)
                    percentages.set(m.id, pct)
                    usedPct += pct
                } else {
                    percentages.set(m.id, 100 - usedPct)
                }
            })
        } else {
            const base = Math.floor(100 / members.length)
            const remainder = 100 % members.length
            members.forEach((m, i) => {
                percentages.set(m.id, base + (i < remainder ? 1 : 0))
            })
        }

        groups.push({ stationType, stepIds: members.map(m => m.id), percentages })
    }

    return groups
}
