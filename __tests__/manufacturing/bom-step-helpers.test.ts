import { describe, it, expect } from "vitest"
import { calcStepTarget, calcAllStepTargets, calcCriticalPathDuration } from "@/components/manufacturing/bom/bom-step-helpers"

describe("calcStepTarget", () => {
    it("single step with no allocations → target = totalQty", () => {
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(600)
    })

    it("single step WITH allocations → target still = totalQty (not allocTotal)", () => {
        const steps = [
            {
                id: "s1",
                station: { stationType: "CUTTING" },
                allocations: [{ stationId: "wc-a", quantity: 300 }],
            },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(600)
    })

    it("two parallel siblings of same type, no allocations → split evenly", () => {
        const steps = [
            { id: "s1", station: { stationType: "SEWING" }, allocations: [] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(300)
        expect(calcStepTarget(steps[1], steps, 600)).toBe(300)
    })

    it("two parallel siblings, odd totalQty → remainder goes to first", () => {
        const steps = [
            { id: "s1", station: { stationType: "SEWING" }, allocations: [] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 7)).toBe(4)
        expect(calcStepTarget(steps[1], steps, 7)).toBe(3)
    })

    it("parallel siblings WITH allocations → each step target = its own allocTotal", () => {
        const steps = [
            {
                id: "s1",
                station: { stationType: "SEWING" },
                allocations: [{ stationId: "wc-a", quantity: 400 }],
            },
            {
                id: "s2",
                station: { stationType: "SEWING" },
                allocations: [{ stationId: "wc-b", quantity: 200 }],
            },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(400)
        expect(calcStepTarget(steps[1], steps, 600)).toBe(200)
    })

    it("mixed: some siblings with allocs, some without → unallocated get leftover share", () => {
        const steps = [
            { id: "s1", station: { stationType: "SEWING" }, allocations: [{ stationId: "wc-a", quantity: 400 }] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(400)
        expect(calcStepTarget(steps[1], steps, 600)).toBe(200) // leftover
    })

    it("different stationTypes are not treated as siblings", () => {
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, allocations: [] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        expect(calcStepTarget(steps[0], steps, 600)).toBe(600)
        expect(calcStepTarget(steps[1], steps, 600)).toBe(600)
    })
})

describe("calcAllStepTargets", () => {
    it("returns a Map of step.id → target", () => {
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, allocations: [] },
            { id: "s2", station: { stationType: "SEWING" }, allocations: [] },
        ]
        const targets = calcAllStepTargets(steps, 600)
        expect(targets.get("s1")).toBe(600)
        expect(targets.get("s2")).toBe(600)
    })
})

describe("calcCriticalPathDuration", () => {
    it("returns 0 for empty steps", () => {
        expect(calcCriticalPathDuration([])).toBe(0)
    })

    it("single step → returns its duration", () => {
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, durationMinutes: 12, parentStepIds: [] },
        ]
        expect(calcCriticalPathDuration(steps)).toBe(12)
    })

    it("sequential steps (DAG chain) → sums all durations", () => {
        // CUTTING(12) → SEWING(3) → PACKING(4) = 19 total
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, durationMinutes: 12, parentStepIds: [] },
            { id: "s2", station: { stationType: "SEWING" }, durationMinutes: 3, parentStepIds: ["s1"] },
            { id: "s3", station: { stationType: "PACKING" }, durationMinutes: 4, parentStepIds: ["s2"] },
        ]
        expect(calcCriticalPathDuration(steps)).toBe(19)
    })

    it("parallel steps (same parent) → takes max of parallel branches", () => {
        // CUTTING(12) → SEWING_A(3) and SEWING_B(5) in parallel → max(3,5) = 5
        // Critical path = 12 + 5 = 17
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, durationMinutes: 12, parentStepIds: [] },
            { id: "s2", station: { stationType: "SEWING" }, durationMinutes: 3, parentStepIds: ["s1"] },
            { id: "s3", station: { stationType: "SEWING" }, durationMinutes: 5, parentStepIds: ["s1"] },
        ]
        expect(calcCriticalPathDuration(steps)).toBe(17)
    })

    it("parallel branches with different types converging → takes longest path", () => {
        //   ┌→ SEWING(10) ─┐
        // CUTTING(5) ─┤             ├→ PACKING(2)
        //   └→ PRINTING(3) ┘
        // Path 1: 5 + 10 + 2 = 17
        // Path 2: 5 + 3 + 2 = 10
        // Critical path = 17
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, durationMinutes: 5, parentStepIds: [] },
            { id: "s2", station: { stationType: "SEWING" }, durationMinutes: 10, parentStepIds: ["s1"] },
            { id: "s3", station: { stationType: "PRINTING" }, durationMinutes: 3, parentStepIds: ["s1"] },
            { id: "s4", station: { stationType: "PACKING" }, durationMinutes: 2, parentStepIds: ["s2", "s3"] },
        ]
        expect(calcCriticalPathDuration(steps)).toBe(17)
    })

    it("OLD BUG: does NOT double-count parallel siblings of different types", () => {
        // Old code grouped by stationType, summing across groups.
        // With DAG: parallel branches should take max, not sum.
        //   ┌→ SEWING(10)
        // CUTTING(5) ─┤
        //   └→ PRINTING(3)
        // Critical path = 5 + max(10, 3) = 15 (not 5 + 10 + 3 = 18)
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, durationMinutes: 5, parentStepIds: [] },
            { id: "s2", station: { stationType: "SEWING" }, durationMinutes: 10, parentStepIds: ["s1"] },
            { id: "s3", station: { stationType: "PRINTING" }, durationMinutes: 3, parentStepIds: ["s1"] },
        ]
        expect(calcCriticalPathDuration(steps)).toBe(15)
    })

    it("steps with null duration → treated as 0", () => {
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, durationMinutes: null, parentStepIds: [] },
            { id: "s2", station: { stationType: "SEWING" }, durationMinutes: 5, parentStepIds: ["s1"] },
        ]
        expect(calcCriticalPathDuration(steps)).toBe(5)
    })

    it("fallback: no parentStepIds → groups by stationType", () => {
        // Without DAG info, falls back to stationType grouping
        const steps = [
            { id: "s1", station: { stationType: "CUTTING" }, durationMinutes: 12 },
            { id: "s2", station: { stationType: "SEWING" }, durationMinutes: 3 },
            { id: "s3", station: { stationType: "SEWING" }, durationMinutes: 5 },
            { id: "s4", station: { stationType: "PACKING" }, durationMinutes: 4 },
        ]
        // CUTTING: max(12) + SEWING: max(3,5) + PACKING: max(4) = 12 + 5 + 4 = 21
        expect(calcCriticalPathDuration(steps)).toBe(21)
    })

    it("multiple sequential steps of same stationType with DAG → sums correctly", () => {
        // SEWING(5) → SEWING(3) — sequential same type should SUM, not max
        const steps = [
            { id: "s1", station: { stationType: "SEWING" }, durationMinutes: 5, parentStepIds: [] },
            { id: "s2", station: { stationType: "SEWING" }, durationMinutes: 3, parentStepIds: ["s1"] },
        ]
        expect(calcCriticalPathDuration(steps)).toBe(8)
    })
})
