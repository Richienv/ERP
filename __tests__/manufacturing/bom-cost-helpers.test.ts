import { describe, it, expect } from "vitest"
import {
    calcOverheadCostPerPcs,
    calcTotalOverheadCost,
    calcHPPPerPcs,
    calcLaborCostPerPcs,
    calcItemCostPerUnit,
} from "@/components/manufacturing/bom/bom-cost-helpers"

describe("calcOverheadCostPerPcs", () => {
    it("returns 0 when no overhead sources", () => {
        expect(calcOverheadCostPerPcs(1000, null, null)).toBe(0)
    })

    it("calculates overhead as percentage of labor cost", () => {
        expect(calcOverheadCostPerPcs(1000, 15, null)).toBe(150)
    })

    it("adds machine overhead when provided", () => {
        // Station overhead: 1000 × 0.10 = 100
        // Machine overhead: 200 × (30/60) = 100
        expect(calcOverheadCostPerPcs(1000, 10, { overheadMaterialCostPerHour: 200, durationMinutes: 30 })).toBe(200)
    })

    it("handles machine overhead alone (no station overhead)", () => {
        // 600 × (10/60) = 100
        expect(calcOverheadCostPerPcs(1000, null, { overheadMaterialCostPerHour: 600, durationMinutes: 10 })).toBe(100)
    })
})

describe("calcTotalOverheadCost", () => {
    it("sums overhead across in-house steps × targetQty", () => {
        const steps = [
            {
                laborMonthlySalary: 5160000,
                durationMinutes: 2,
                station: { overheadPct: 10, operationType: "INTERNAL" },
                useSubkon: false,
                allocations: [],
            },
        ]
        // Labor per pcs: 5160000 × 2 / (172 × 60) = 1000
        // Overhead per pcs: 1000 × 0.10 = 100
        // Total: 100 × 100 = 10000
        const result = calcTotalOverheadCost(steps, 100)
        expect(result).toBeCloseTo(10000, 0)
    })

    it("skips subkon steps", () => {
        const steps = [
            {
                laborMonthlySalary: 5160000,
                durationMinutes: 2,
                station: { overheadPct: 10, operationType: "SUBCONTRACTOR" },
                useSubkon: true,
                allocations: [],
            },
        ]
        expect(calcTotalOverheadCost(steps, 100)).toBe(0)
    })
})

describe("calcHPPPerPcs", () => {
    it("sums material + labor + overhead per piece", () => {
        expect(calcHPPPerPcs(5000, 2000, 500)).toBe(7500)
    })
})

// Regression tests for existing functions
describe("calcLaborCostPerPcs", () => {
    it("calculates correctly with standard formula", () => {
        // 5,160,000 / (172 × 60) = 500 per minute × 2 = 1000
        expect(calcLaborCostPerPcs(5160000, 2)).toBeCloseTo(1000, 0)
    })

    it("returns 0 for zero salary", () => {
        expect(calcLaborCostPerPcs(0, 5)).toBe(0)
    })
})

describe("calcItemCostPerUnit", () => {
    it("calculates with waste percentage", () => {
        const item = {
            id: "1",
            quantityPerUnit: 2,
            material: { id: "m1", costPrice: 1000 },
            wastePct: 10,
        }
        expect(calcItemCostPerUnit(item)).toBe(2200)
    })
})
