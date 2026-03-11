import { describe, it, expect } from "vitest"
import { findCriticalPathStepIds } from "@/app/manufacturing/bom/[id]/hooks/use-critical-path"

describe("findCriticalPathStepIds", () => {
    it("returns all steps for a linear chain", () => {
        const steps = [
            { id: "a", durationMinutes: 10, parentStepIds: [] },
            { id: "b", durationMinutes: 20, parentStepIds: ["a"] },
            { id: "c", durationMinutes: 5, parentStepIds: ["b"] },
        ] as any
        const result = findCriticalPathStepIds(steps)
        expect(result.has("a")).toBe(true)
        expect(result.has("b")).toBe(true)
        expect(result.has("c")).toBe(true)
    })

    it("returns only the longer branch for a diamond DAG", () => {
        // a → b(20) ──┐
        //   └─ c(5)  ─→ d(10)
        const steps = [
            { id: "a", durationMinutes: 10, parentStepIds: [] },
            { id: "b", durationMinutes: 20, parentStepIds: ["a"] },
            { id: "c", durationMinutes: 5, parentStepIds: ["a"] },
            { id: "d", durationMinutes: 10, parentStepIds: ["b", "c"] },
        ] as any
        const result = findCriticalPathStepIds(steps)
        expect(result.has("a")).toBe(true)
        expect(result.has("b")).toBe(true)  // longer branch
        expect(result.has("c")).toBe(false) // not on critical path
        expect(result.has("d")).toBe(true)
    })

    it("handles empty steps array", () => {
        expect(findCriticalPathStepIds([])).toEqual(new Set())
    })

    it("handles single step", () => {
        const steps = [{ id: "a", durationMinutes: 15, parentStepIds: [] }] as any
        const result = findCriticalPathStepIds(steps)
        expect(result.has("a")).toBe(true)
    })
})
