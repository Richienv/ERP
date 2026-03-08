import { describe, it, expect } from "vitest"
import {
    calculateSchemeDiscount,
    findApplicableDiscounts,
    validateTieredRules,
    DiscountSchemeInput,
    LineItemInput,
    TieredRule,
} from "@/lib/discount-calculator"

// ─── Fixtures ────────────────────────────────────────────────────────────

const baseScheme: DiscountSchemeInput = {
    id: "s1",
    code: "DISC-001",
    name: "Diskon 10%",
    type: "PERCENTAGE",
    scope: "GLOBAL",
    value: 10,
    tieredRules: null,
    isActive: true,
    validFrom: null,
    validTo: null,
    minOrderValue: null,
    priceListId: null,
    customerId: null,
    productId: null,
    categoryId: null,
}

const lineItem: LineItemInput = {
    productId: "p1",
    categoryId: "c1",
    quantity: 100,
    unitPrice: 50000,
}

// ─── PERCENTAGE ──────────────────────────────────────────────────────────

describe("PERCENTAGE discount", () => {
    it("calculates 10% discount correctly", () => {
        const result = calculateSchemeDiscount(baseScheme, lineItem)
        expect(result).not.toBeNull()
        expect(result!.type).toBe("PERCENTAGE")
        expect(result!.discountPercent).toBe(10)
        expect(result!.discountPerUnit).toBe(5000)
        expect(result!.totalDiscount).toBe(500000)
    })

    it("returns null for inactive scheme", () => {
        const inactive = { ...baseScheme, isActive: false }
        expect(calculateSchemeDiscount(inactive, lineItem)).toBeNull()
    })

    it("returns null for expired scheme", () => {
        const expired = { ...baseScheme, validTo: "2020-01-01" }
        expect(calculateSchemeDiscount(expired, lineItem)).toBeNull()
    })

    it("returns null for future scheme", () => {
        const future = { ...baseScheme, validFrom: "2099-01-01" }
        expect(calculateSchemeDiscount(future, lineItem)).toBeNull()
    })

    it("returns null when value is 0", () => {
        const zero = { ...baseScheme, value: 0 }
        expect(calculateSchemeDiscount(zero, lineItem)).toBeNull()
    })
})

// ─── FIXED ───────────────────────────────────────────────────────────────

describe("FIXED discount", () => {
    it("calculates fixed Rp 5000/unit discount", () => {
        const scheme: DiscountSchemeInput = {
            ...baseScheme,
            type: "FIXED",
            value: 5000,
        }
        const result = calculateSchemeDiscount(scheme, lineItem)
        expect(result).not.toBeNull()
        expect(result!.type).toBe("FIXED")
        expect(result!.discountPerUnit).toBe(5000)
        expect(result!.totalDiscount).toBe(500000)
        expect(result!.discountPercent).toBe(10) // 5000/50000 * 100
    })
})

// ─── TIERED ──────────────────────────────────────────────────────────────

describe("TIERED discount", () => {
    const tieredScheme: DiscountSchemeInput = {
        ...baseScheme,
        type: "TIERED",
        value: null,
        tieredRules: [
            { minQty: 1, maxQty: 99, discount: 0 },
            { minQty: 100, maxQty: 499, discount: 5 },
            { minQty: 500, maxQty: 999, discount: 10 },
            { minQty: 1000, maxQty: null, discount: 15 },
        ],
    }

    it("returns 5% for qty=100", () => {
        const result = calculateSchemeDiscount(tieredScheme, { ...lineItem, quantity: 100 })
        expect(result).not.toBeNull()
        expect(result!.discountPercent).toBe(5)
        expect(result!.totalDiscount).toBe(250000) // 100 * 50000 * 5%
    })

    it("returns 10% for qty=500", () => {
        const result = calculateSchemeDiscount(tieredScheme, { ...lineItem, quantity: 500 })
        expect(result).not.toBeNull()
        expect(result!.discountPercent).toBe(10)
    })

    it("returns 15% for qty=1000 (unbounded tier)", () => {
        const result = calculateSchemeDiscount(tieredScheme, { ...lineItem, quantity: 1000 })
        expect(result).not.toBeNull()
        expect(result!.discountPercent).toBe(15)
    })

    it("returns 0% tier for qty=50 (matches tier but no effective discount)", () => {
        const result = calculateSchemeDiscount(tieredScheme, { ...lineItem, quantity: 50 })
        // 0% tier is still a valid match — totalDiscount will be 0
        expect(result).not.toBeNull()
        expect(result!.discountPercent).toBe(0)
        expect(result!.totalDiscount).toBe(0)
    })

    it("returns null for empty tiered rules", () => {
        const empty = { ...tieredScheme, tieredRules: [] }
        expect(calculateSchemeDiscount(empty, lineItem)).toBeNull()
    })

    it("includes tier label", () => {
        const result = calculateSchemeDiscount(tieredScheme, { ...lineItem, quantity: 200 })
        expect(result).not.toBeNull()
        expect(result!.tierLabel).toContain("100")
        expect(result!.tierLabel).toContain("499")
        expect(result!.tierLabel).toContain("5%")
    })
})

// ─── minOrderValue ───────────────────────────────────────────────────────

describe("minOrderValue guard", () => {
    it("returns null when line total is below minOrderValue", () => {
        const scheme: DiscountSchemeInput = {
            ...baseScheme,
            minOrderValue: 10000000, // 10 juta
        }
        const smallLine: LineItemInput = { productId: "p1", categoryId: "c1", quantity: 1, unitPrice: 50000 }
        expect(calculateSchemeDiscount(scheme, smallLine)).toBeNull()
    })

    it("applies when line total meets minOrderValue", () => {
        const scheme: DiscountSchemeInput = {
            ...baseScheme,
            minOrderValue: 1000000,
        }
        // 100 * 50000 = 5,000,000 >= 1,000,000
        expect(calculateSchemeDiscount(scheme, lineItem)).not.toBeNull()
    })
})

// ─── findApplicableDiscounts (scope matching + best-discount) ────────────

describe("findApplicableDiscounts", () => {
    it("returns best discount from multiple schemes", () => {
        const schemes: DiscountSchemeInput[] = [
            { ...baseScheme, id: "s1", value: 5 },
            { ...baseScheme, id: "s2", value: 15 },
            { ...baseScheme, id: "s3", value: 10 },
        ]
        const result = findApplicableDiscounts(schemes, lineItem)
        expect(result.appliedDiscounts).toHaveLength(1)
        expect(result.appliedDiscounts[0].schemeId).toBe("s2")
        expect(result.totalDiscount).toBe(750000) // 15% of 5M
        expect(result.finalTotal).toBe(4250000)
    })

    it("filters by PRODUCT scope", () => {
        const schemes: DiscountSchemeInput[] = [
            { ...baseScheme, scope: "PRODUCT", productId: "p1" }, // matches
            { ...baseScheme, id: "s2", scope: "PRODUCT", productId: "p99" }, // no match
        ]
        const result = findApplicableDiscounts(schemes, lineItem)
        expect(result.appliedDiscounts).toHaveLength(1)
        expect(result.appliedDiscounts[0].schemeId).toBe("s1")
    })

    it("filters by CUSTOMER scope", () => {
        const schemes: DiscountSchemeInput[] = [
            { ...baseScheme, scope: "CUSTOMER", customerId: "cust1" },
        ]
        const result = findApplicableDiscounts(schemes, lineItem, { customerId: "cust1" })
        expect(result.appliedDiscounts).toHaveLength(1)
    })

    it("returns empty when no schemes match", () => {
        const schemes: DiscountSchemeInput[] = [
            { ...baseScheme, scope: "CUSTOMER", customerId: "cust1" },
        ]
        const result = findApplicableDiscounts(schemes, lineItem, { customerId: "cust99" })
        expect(result.appliedDiscounts).toHaveLength(0)
        expect(result.totalDiscount).toBe(0)
    })
})

// ─── validateTieredRules ─────────────────────────────────────────────────

describe("validateTieredRules", () => {
    it("accepts valid non-overlapping tiers", () => {
        const rules: TieredRule[] = [
            { minQty: 1, maxQty: 99, discount: 2 },
            { minQty: 100, maxQty: 499, discount: 5 },
            { minQty: 500, maxQty: null, discount: 10 },
        ]
        expect(validateTieredRules(rules)).toHaveLength(0)
    })

    it("rejects empty rules", () => {
        const errors = validateTieredRules([])
        expect(errors.length).toBeGreaterThan(0)
    })

    it("rejects overlapping tiers", () => {
        const rules: TieredRule[] = [
            { minQty: 1, maxQty: 100, discount: 5 },
            { minQty: 50, maxQty: 200, discount: 10 },
        ]
        const errors = validateTieredRules(rules)
        expect(errors.some((e) => e.includes("tumpang tindih"))).toBe(true)
    })

    it("rejects discount > 100%", () => {
        const rules: TieredRule[] = [{ minQty: 1, maxQty: null, discount: 150 }]
        const errors = validateTieredRules(rules)
        expect(errors.length).toBeGreaterThan(0)
    })

    it("rejects negative minQty", () => {
        const rules: TieredRule[] = [{ minQty: -5, maxQty: 10, discount: 5 }]
        const errors = validateTieredRules(rules)
        expect(errors.some((e) => e.includes("negatif"))).toBe(true)
    })

    it("rejects maxQty < minQty", () => {
        const rules: TieredRule[] = [{ minQty: 100, maxQty: 50, discount: 5 }]
        const errors = validateTieredRules(rules)
        expect(errors.some((e) => e.includes("maxQty"))).toBe(true)
    })
})
