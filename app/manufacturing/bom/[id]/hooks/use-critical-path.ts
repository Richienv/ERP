"use client"

import { useMemo } from "react"
import type { BOMStep } from "../bom-canvas-context"

// ─── Pure helper (exported for testing) ──────────────────────────────────────

export function findCriticalPathStepIds(
    steps: Pick<BOMStep, "id" | "durationMinutes" | "parentStepIds">[]
): Set<string> {
    if (steps.length === 0) return new Set()

    const stepMap = new Map(steps.map((s) => [s.id, s]))
    const endTime = new Map<string, number>()

    // Forward pass (array order = sequence order)
    for (const step of steps) {
        const parentMax =
            step.parentStepIds.length === 0
                ? 0
                : Math.max(...step.parentStepIds.map((pid) => endTime.get(pid) ?? 0))
        endTime.set(step.id, parentMax + (step.durationMinutes ?? 0))
    }

    const maxEnd = Math.max(...endTime.values())

    // Find terminal steps (not a parent of anyone)
    const parentedIds = new Set(steps.flatMap((s) => s.parentStepIds))
    const terminals = steps.filter((s) => !parentedIds.has(s.id))

    // Backward trace from terminals with max end time
    const critical = new Set<string>()

    function traceBack(stepId: string) {
        if (critical.has(stepId)) return
        critical.add(stepId)
        const step = stepMap.get(stepId)
        if (!step || step.parentStepIds.length === 0) return
        const currentEnd = endTime.get(stepId) ?? 0
        const criticalStart = currentEnd - (step.durationMinutes ?? 0)
        for (const pid of step.parentStepIds) {
            if ((endTime.get(pid) ?? 0) === criticalStart) {
                traceBack(pid)
            }
        }
    }

    for (const t of terminals) {
        if ((endTime.get(t.id) ?? 0) === maxEnd) traceBack(t.id)
    }

    return critical
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCriticalPath(steps: BOMStep[]): Set<string> {
    return useMemo(() => findCriticalPathStepIds(steps), [steps])
}
