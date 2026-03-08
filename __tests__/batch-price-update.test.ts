import { describe, it, expect } from "vitest"

/**
 * Unit tests for batch price update logic.
 * Tests the calculation logic used in the batch-price-dialog component.
 */

// Replicate the core calculation logic from the dialog
function applyBulkPrice(
    oldPrice: number,
    mode: "percent" | "fixed",
    direction: "increase" | "decrease",
    value: number
): number {
    let newPrice: number
    if (mode === "percent") {
        const delta = oldPrice * (value / 100)
        newPrice = direction === "increase" ? oldPrice + delta : oldPrice - delta
    } else {
        newPrice = direction === "increase" ? oldPrice + value : oldPrice - value
    }
    return Math.max(0, Math.round(newPrice))
}

interface PriceUpdate {
    productId: string
    newCostPrice?: number | null
    newSellingPrice?: number | null
}

function filterValidUpdates(updates: PriceUpdate[]): PriceUpdate[] {
    return updates.filter(
        (u) =>
            (u.newCostPrice !== null && u.newCostPrice !== undefined) ||
            (u.newSellingPrice !== null && u.newSellingPrice !== undefined)
    )
}

function buildChangeLog(
    updates: PriceUpdate[],
    existingProducts: Array<{ id: string; costPrice: number; sellingPrice: number }>
) {
    const existingMap = new Map(existingProducts.map((p) => [p.id, p]))
    return updates.map((u) => {
        const existing = existingMap.get(u.productId)!
        return {
            productId: u.productId,
            oldCostPrice: existing.costPrice,
            newCostPrice: u.newCostPrice ?? existing.costPrice,
            oldSellingPrice: existing.sellingPrice,
            newSellingPrice: u.newSellingPrice ?? existing.sellingPrice,
        }
    })
}

describe("Batch Price Update - Calculation Logic", () => {
    describe("applyBulkPrice", () => {
        it("should increase price by percentage", () => {
            expect(applyBulkPrice(100000, "percent", "increase", 10)).toBe(110000)
            expect(applyBulkPrice(250000, "percent", "increase", 25)).toBe(312500)
        })

        it("should decrease price by percentage", () => {
            expect(applyBulkPrice(100000, "percent", "decrease", 10)).toBe(90000)
            expect(applyBulkPrice(200000, "percent", "decrease", 50)).toBe(100000)
        })

        it("should increase price by fixed amount", () => {
            expect(applyBulkPrice(100000, "fixed", "increase", 5000)).toBe(105000)
            expect(applyBulkPrice(0, "fixed", "increase", 10000)).toBe(10000)
        })

        it("should decrease price by fixed amount", () => {
            expect(applyBulkPrice(100000, "fixed", "decrease", 5000)).toBe(95000)
        })

        it("should never go below zero", () => {
            expect(applyBulkPrice(5000, "fixed", "decrease", 10000)).toBe(0)
            expect(applyBulkPrice(1000, "percent", "decrease", 200)).toBe(0)
        })

        it("should round to nearest integer (no decimals for IDR)", () => {
            expect(applyBulkPrice(100000, "percent", "increase", 3)).toBe(103000)
            // 99999 + 99999 * 0.01 = 99999 + 999.99 = 100998.99 → 100999
            expect(applyBulkPrice(99999, "percent", "increase", 1)).toBe(100999)
        })

        it("should handle zero percent change", () => {
            expect(applyBulkPrice(100000, "percent", "increase", 0)).toBe(100000)
            expect(applyBulkPrice(100000, "percent", "decrease", 0)).toBe(100000)
        })

        it("should handle zero price", () => {
            expect(applyBulkPrice(0, "percent", "increase", 10)).toBe(0)
            expect(applyBulkPrice(0, "fixed", "increase", 5000)).toBe(5000)
        })
    })

    describe("filterValidUpdates", () => {
        it("should filter out updates with no price changes", () => {
            const updates: PriceUpdate[] = [
                { productId: "1", newCostPrice: 100000, newSellingPrice: null },
                { productId: "2", newCostPrice: null, newSellingPrice: null },
                { productId: "3", newCostPrice: null, newSellingPrice: 200000 },
            ]
            const valid = filterValidUpdates(updates)
            expect(valid).toHaveLength(2)
            expect(valid[0].productId).toBe("1")
            expect(valid[1].productId).toBe("3")
        })

        it("should keep updates with both prices set", () => {
            const updates: PriceUpdate[] = [
                { productId: "1", newCostPrice: 100000, newSellingPrice: 150000 },
            ]
            expect(filterValidUpdates(updates)).toHaveLength(1)
        })

        it("should return empty array when no valid updates", () => {
            const updates: PriceUpdate[] = [
                { productId: "1", newCostPrice: null, newSellingPrice: null },
                { productId: "2" },
            ]
            expect(filterValidUpdates(updates)).toHaveLength(0)
        })
    })

    describe("buildChangeLog", () => {
        it("should correctly track old vs new prices", () => {
            const existing = [
                { id: "1", costPrice: 100000, sellingPrice: 150000 },
                { id: "2", costPrice: 200000, sellingPrice: 300000 },
            ]
            const updates: PriceUpdate[] = [
                { productId: "1", newCostPrice: 110000, newSellingPrice: 165000 },
                { productId: "2", newCostPrice: 220000 },
            ]
            const log = buildChangeLog(updates, existing)

            expect(log[0]).toEqual({
                productId: "1",
                oldCostPrice: 100000,
                newCostPrice: 110000,
                oldSellingPrice: 150000,
                newSellingPrice: 165000,
            })
            expect(log[1]).toEqual({
                productId: "2",
                oldCostPrice: 200000,
                newCostPrice: 220000,
                oldSellingPrice: 300000,
                newSellingPrice: 300000, // unchanged
            })
        })
    })
})
