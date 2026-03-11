import { describe, it, expect } from "vitest"
import { detectPriceDrift } from "@/app/manufacturing/bom/[id]/hooks/use-price-drift"

describe("detectPriceDrift", () => {
    it("returns empty array when no prices changed", () => {
        const items = [
            { id: "i1", materialId: "m1", snapshotCostPrice: 10000, material: { id: "m1", name: "Kain", costPrice: 10000, code: "K1" } },
        ] as any
        expect(detectPriceDrift(items)).toHaveLength(0)
    })

    it("detects price increase", () => {
        const items = [
            { id: "i1", materialId: "m1", snapshotCostPrice: 10000, material: { id: "m1", name: "Kain", costPrice: 12000, code: "K1" } },
        ] as any
        const result = detectPriceDrift(items)
        expect(result).toHaveLength(1)
        expect(result[0].direction).toBe("naik")
        expect(result[0].changePct).toBeCloseTo(20)
    })

    it("detects price decrease", () => {
        const items = [
            { id: "i1", materialId: "m1", snapshotCostPrice: 10000, material: { id: "m1", name: "Kain", costPrice: 8000, code: "K1" } },
        ] as any
        const result = detectPriceDrift(items)
        expect(result[0].direction).toBe("turun")
        expect(result[0].changePct).toBeCloseTo(20)
    })

    it("ignores items with no snapshot price", () => {
        const items = [
            { id: "i1", materialId: "m1", snapshotCostPrice: null, material: { id: "m1", name: "Kain", costPrice: 12000, code: "K1" } },
        ] as any
        expect(detectPriceDrift(items)).toHaveLength(0)
    })
})
