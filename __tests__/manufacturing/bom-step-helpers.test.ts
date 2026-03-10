import { describe, it, expect } from "vitest"
import { calcStepTarget, calcAllStepTargets } from "@/components/manufacturing/bom/bom-step-helpers"

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
