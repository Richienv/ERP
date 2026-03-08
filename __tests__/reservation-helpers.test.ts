import { describe, it, expect } from "vitest"
import {
    calculateBOMRequirements,
    calculateReservationDelta,
} from "@/lib/reservation-helpers"

describe("calculateBOMRequirements", () => {
    it("calculates required qty with waste percentage", () => {
        const items = [
            { materialId: "mat-1", quantityPerUnit: 2, wastePct: 10, unit: "meter" },
            { materialId: "mat-2", quantityPerUnit: 5, wastePct: 0, unit: "pcs" },
        ]
        const result = calculateBOMRequirements(items, 100)

        // 2 * 100 * 1.10 = 220.0000...03 (float) → ceil = 221
        expect(result).toEqual([
            { materialId: "mat-1", unit: "meter", requiredQty: 221 },
            { materialId: "mat-2", unit: "pcs", requiredQty: 500 },
        ])
    })

    it("uses Math.ceil for fractional quantities", () => {
        const items = [
            { materialId: "mat-1", quantityPerUnit: 1.5, wastePct: 5, unit: "kg" },
        ]
        const result = calculateBOMRequirements(items, 3)
        // 1.5 * 3 * 1.05 = 4.725 → ceil = 5
        expect(result[0].requiredQty).toBe(5)
    })

    it("returns empty array for empty items", () => {
        expect(calculateBOMRequirements([], 100)).toEqual([])
    })

    it("handles zero planned qty", () => {
        const items = [
            { materialId: "mat-1", quantityPerUnit: 2, wastePct: 10, unit: "meter" },
        ]
        const result = calculateBOMRequirements(items, 0)
        expect(result[0].requiredQty).toBe(0)
    })
})

describe("calculateReservationDelta", () => {
    it("calculates shortfall when stock is insufficient", () => {
        const result = calculateReservationDelta(100, 30, 20)
        expect(result.shortfall).toBe(50)
        expect(result.canReserve).toBe(30)
    })

    it("returns zero shortfall when stock + onOrder covers requirement", () => {
        const result = calculateReservationDelta(100, 80, 30)
        expect(result.shortfall).toBe(0)
        expect(result.canReserve).toBe(80)
    })

    it("caps canReserve to requiredQty when stock exceeds requirement", () => {
        const result = calculateReservationDelta(50, 200, 0)
        expect(result.shortfall).toBe(0)
        expect(result.canReserve).toBe(50)
    })

    it("handles zero available qty", () => {
        const result = calculateReservationDelta(100, 0, 0)
        expect(result.shortfall).toBe(100)
        expect(result.canReserve).toBe(0)
    })

    it("handles negative available qty", () => {
        // shortfall = max(0, 100 - (-10) - 0) = 110 (negative stock increases shortfall)
        // canReserve = min(100, max(0, -10)) = 0
        const result = calculateReservationDelta(100, -10, 0)
        expect(result.shortfall).toBe(110)
        expect(result.canReserve).toBe(0)
    })
})
