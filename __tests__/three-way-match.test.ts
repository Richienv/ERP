import { describe, expect, it } from "vitest"
import { buildThreeWayMatch, type ThreeWayMatchInput } from "@/lib/actions/finance-match"

function baseInput(overrides: Partial<ThreeWayMatchInput> = {}): ThreeWayMatchInput {
    return {
        billId: "bill-1",
        billNumber: "BILL-PO-001",
        poNumber: "PO-001",
        poItems: [
            {
                productId: "prod-filter",
                productName: "Filter Oli",
                productCode: "SP-OL-01",
                ordered: 100,
                received: 100,
                unitPrice: 50000,
            },
        ],
        billItems: [
            {
                productId: "prod-filter",
                description: "Filter Oli",
                billed: 100,
                unitPrice: 50000,
            },
        ],
        ...overrides,
    }
}

describe("buildThreeWayMatch", () => {
    it("returns MATCHED when billed equals received equals ordered", () => {
        const match = buildThreeWayMatch(baseInput())
        expect(match.status).toBe("MATCHED")
        expect(match.poNumber).toBe("PO-001")
        expect(match.totalVarianceQty).toBe(0)
        expect(match.totalVarianceAmount).toBe(0)
        expect(match.lines[0]).toMatchObject({
            ordered: 100,
            received: 100,
            billed: 100,
            varianceQty: 0,
            varianceAmount: 0,
        })
    })

    it("flags OVER_BILLED when DRAFT bills the ordered qty after a partial GRN (the AP leak)", () => {
        const match = buildThreeWayMatch(baseInput({
            poItems: [{
                productId: "prod-filter",
                productName: "Filter Oli",
                productCode: "SP-OL-01",
                ordered: 100,
                received: 60,
                unitPrice: 50000,
            }],
            billItems: [{
                productId: "prod-filter",
                description: "Filter Oli",
                billed: 100,
                unitPrice: 50000,
            }],
        }))
        expect(match.status).toBe("OVER_BILLED")
        expect(match.totalVarianceQty).toBe(40)
        expect(match.totalVarianceAmount).toBe(40 * 50000)
        expect(match.lines[0].varianceQty).toBe(40)
        expect(match.lines[0].varianceAmount).toBe(2_000_000)
    })

    it("returns UNDER_RECEIVED when the bill matches GRN but PO is still open", () => {
        const match = buildThreeWayMatch(baseInput({
            poItems: [{
                productId: "prod-filter",
                productName: "Filter Oli",
                productCode: "SP-OL-01",
                ordered: 100,
                received: 60,
                unitPrice: 50000,
            }],
            billItems: [{
                productId: "prod-filter",
                description: "Filter Oli",
                billed: 60,
                unitPrice: 50000,
            }],
        }))
        expect(match.status).toBe("UNDER_RECEIVED")
        expect(match.totalVarianceQty).toBe(0)
        expect(match.totalVarianceAmount).toBe(0)
    })

    it("returns NO_PO for a manual bill (not an error)", () => {
        const match = buildThreeWayMatch(baseInput({
            poNumber: null,
            poItems: [],
            billItems: [{
                productId: null,
                description: "Jasa servis",
                billed: 1,
                unitPrice: 1_500_000,
            }],
        }))
        expect(match.status).toBe("NO_PO")
        expect(match.poNumber).toBeNull()
        expect(match.lines).toEqual([])
        expect(match.totalVarianceAmount).toBe(0)
    })

    it("uses tolerance 0 — one extra billed unit is OVER_BILLED", () => {
        const match = buildThreeWayMatch(baseInput({
            billItems: [{
                productId: "prod-filter",
                description: "Filter Oli",
                billed: 101,
                unitPrice: 50000,
            }],
        }))
        expect(match.status).toBe("OVER_BILLED")
        expect(match.totalVarianceQty).toBe(1)
        expect(match.totalVarianceAmount).toBe(50000)
    })

    it("treats an invoice line with no PO counterpart as billed without goods", () => {
        const match = buildThreeWayMatch(baseInput({
            billItems: [
                {
                    productId: "prod-filter",
                    description: "Filter Oli",
                    billed: 100,
                    unitPrice: 50000,
                },
                {
                    productId: "prod-extra",
                    description: "Seal kit",
                    billed: 2,
                    unitPrice: 75000,
                },
            ],
        }))
        expect(match.status).toBe("OVER_BILLED")
        expect(match.totalVarianceQty).toBe(2)
        expect(match.totalVarianceAmount).toBe(150000)
    })

    it("matches bill lines to PO by product name when productId is missing", () => {
        const match = buildThreeWayMatch(baseInput({
            billItems: [{
                productId: null,
                description: "Filter Oli",
                billed: 100,
                unitPrice: 50000,
            }],
        }))
        expect(match.status).toBe("MATCHED")
        expect(match.lines).toHaveLength(1)
        expect(match.lines[0].billed).toBe(100)
    })

    it("aggregates multiple PO / bill rows for the same product", () => {
        const match = buildThreeWayMatch(baseInput({
            poItems: [
                {
                    productId: "prod-filter",
                    productName: "Filter Oli",
                    productCode: "SP-OL-01",
                    ordered: 40,
                    received: 40,
                    unitPrice: 50000,
                },
                {
                    productId: "prod-filter",
                    productName: "Filter Oli",
                    productCode: "SP-OL-01",
                    ordered: 60,
                    received: 20,
                    unitPrice: 50000,
                },
            ],
            billItems: [
                { productId: "prod-filter", description: "Filter Oli", billed: 50, unitPrice: 50000 },
                { productId: "prod-filter", description: "Filter Oli", billed: 50, unitPrice: 50000 },
            ],
        }))
        expect(match.lines).toHaveLength(1)
        expect(match.lines[0].ordered).toBe(100)
        expect(match.lines[0].received).toBe(60)
        expect(match.lines[0].billed).toBe(100)
        expect(match.status).toBe("OVER_BILLED")
        expect(match.totalVarianceAmount).toBe(40 * 50000)
    })
})
