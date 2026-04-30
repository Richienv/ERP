import { describe, it, expect } from "vitest"

/**
 * Pure logic test for spot-audit delta calculation.
 * The discrepancy must be applied as a delta (increment), not an absolute set,
 * so concurrent movements between count-time and submit-time are preserved.
 */

function applyAuditDelta(currentSystemQty: number, countedSystemQty: number, actualQty: number) {
    const discrepancy = actualQty - countedSystemQty
    const newQty = currentSystemQty + discrepancy
    return { discrepancy, newQty }
}

describe("spot audit delta calculation", () => {
    it("applies zero delta when actual matches what was counted", () => {
        const result = applyAuditDelta(10, 10, 10)
        expect(result.discrepancy).toBe(0)
        expect(result.newQty).toBe(10)
    })

    it("preserves concurrent sale that happened during count window", () => {
        const result = applyAuditDelta(8, 10, 10)
        expect(result.discrepancy).toBe(0)
        expect(result.newQty).toBe(8)
    })

    it("adds variance when shelf has more than counted system", () => {
        const result = applyAuditDelta(10, 10, 12)
        expect(result.discrepancy).toBe(2)
        expect(result.newQty).toBe(12)
    })

    it("subtracts variance when shelf has less than counted system", () => {
        const result = applyAuditDelta(10, 10, 8)
        expect(result.discrepancy).toBe(-2)
        expect(result.newQty).toBe(8)
    })

    it("composes correctly when both shelf-discrepancy AND concurrent sale happen", () => {
        const result = applyAuditDelta(8, 10, 12)
        expect(result.discrepancy).toBe(2)
        expect(result.newQty).toBe(10)
    })
})
