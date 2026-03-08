import { describe, it, expect } from "vitest"
import { calculateMaterialVariance } from "@/lib/material-variance"

const workOrder = { id: "wo-1", number: "WO-001", plannedQty: 100, actualQty: 100 }

describe("calculateMaterialVariance", () => {
    it("calculates variance for a single material", () => {
        const bomItems = [
            {
                materialId: "mat-1",
                materialCode: "FAB-001",
                materialName: "Kain Katun",
                unit: "meter",
                quantityPerUnit: 2,
                wastePct: 10,
                currentCostPrice: 50000,
            },
        ]
        // Planned: ceil(2 * 100 * 1.10) = 221 (float precision: 220.0...03)
        // Planned cost: 221 * 50000 = 11,050,000
        const transactions = [
            { productId: "mat-1", quantity: -230, unitCost: 52000, totalValue: -11960000 },
        ]

        const result = calculateMaterialVariance(workOrder, bomItems, transactions)

        expect(result.lines).toHaveLength(1)
        const line = result.lines[0]
        expect(line.plannedQty).toBe(221)
        expect(line.actualQty).toBe(230)
        expect(line.qtyVariance).toBe(9)
        expect(line.plannedCost).toBe(11050000)
        expect(line.actualCost).toBe(11960000)
        expect(line.costVariance).toBe(910000)
        expect(line.status).toBe("BOROS")
    })

    it("returns HEMAT when actual is significantly less than planned", () => {
        const bomItems = [
            {
                materialId: "mat-1",
                materialCode: "FAB-001",
                materialName: "Kain Katun",
                unit: "meter",
                quantityPerUnit: 2,
                wastePct: 10,
                currentCostPrice: 50000,
            },
        ]
        // Planned: 220. Actual: 200 → variance = -20/220 = -9.09% → HEMAT
        const transactions = [
            { productId: "mat-1", quantity: -200, unitCost: 50000, totalValue: -10000000 },
        ]

        const result = calculateMaterialVariance(workOrder, bomItems, transactions)
        expect(result.lines[0].status).toBe("HEMAT")
    })

    it("returns SESUAI when variance is within ±2%", () => {
        const bomItems = [
            {
                materialId: "mat-1",
                materialCode: "FAB-001",
                materialName: "Kain Katun",
                unit: "meter",
                quantityPerUnit: 2,
                wastePct: 10,
                currentCostPrice: 50000,
            },
        ]
        // Planned: 220. Actual: 221 → variance = 1/220 = 0.45% → SESUAI
        const transactions = [
            { productId: "mat-1", quantity: -221, unitCost: 50000, totalValue: -11050000 },
        ]

        const result = calculateMaterialVariance(workOrder, bomItems, transactions)
        expect(result.lines[0].status).toBe("SESUAI")
    })

    it("uses plannedQty when actualQty is zero", () => {
        const wo = { id: "wo-1", number: "WO-001", plannedQty: 50, actualQty: 0 }
        const bomItems = [
            {
                materialId: "mat-1",
                materialCode: "FAB-001",
                materialName: "Kain",
                unit: "meter",
                quantityPerUnit: 3,
                wastePct: 0,
                currentCostPrice: 10000,
            },
        ]
        const result = calculateMaterialVariance(wo, bomItems, [])
        // quantityPerUnit(3) * plannedQty(50) * 1.0 = 150
        expect(result.lines[0].plannedQty).toBe(150)
    })

    it("handles multiple materials with mixed variances", () => {
        const bomItems = [
            {
                materialId: "mat-1",
                materialCode: "FAB-001",
                materialName: "Kain",
                unit: "meter",
                quantityPerUnit: 2,
                wastePct: 0,
                currentCostPrice: 10000,
            },
            {
                materialId: "mat-2",
                materialCode: "BTN-001",
                materialName: "Kancing",
                unit: "pcs",
                quantityPerUnit: 5,
                wastePct: 0,
                currentCostPrice: 500,
            },
        ]
        const transactions = [
            { productId: "mat-1", quantity: -200, unitCost: 10000, totalValue: -2000000 },
            { productId: "mat-2", quantity: -500, unitCost: 500, totalValue: -250000 },
        ]

        const result = calculateMaterialVariance(workOrder, bomItems, transactions)

        expect(result.lines).toHaveLength(2)
        expect(result.totalPlannedCost).toBe(2000000 + 250000)
        expect(result.totalActualCost).toBe(2000000 + 250000)
        expect(result.totalCostVariance).toBe(0)
        expect(result.woStatus).toBe("SESUAI")
    })

    it("handles no transactions (all zero actuals)", () => {
        const bomItems = [
            {
                materialId: "mat-1",
                materialCode: "FAB-001",
                materialName: "Kain",
                unit: "meter",
                quantityPerUnit: 2,
                wastePct: 0,
                currentCostPrice: 10000,
            },
        ]

        const result = calculateMaterialVariance(workOrder, bomItems, [])

        expect(result.lines[0].actualQty).toBe(0)
        expect(result.lines[0].actualCost).toBe(0)
        expect(result.lines[0].status).toBe("HEMAT")
        expect(result.totalActualCost).toBe(0)
    })
})
