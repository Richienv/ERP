import { describe, expect, it } from "vitest"

import { normalizeAPAgingSummary } from "@/lib/ap-aging"

describe("normalizeAPAgingSummary", () => {
    it("normalizes legacy prefetch keys into the canonical AP summary shape", () => {
        expect(
            normalizeAPAgingSummary({
                current: 83250000,
                days1to30: undefined,
                days31to60: 0,
                days61to90: 0,
                days90plus: 0,
                total: 83250000,
            })
        ).toEqual({
            current: 83250000,
            d1_30: 0,
            d31_60: 0,
            d61_90: 0,
            d90_plus: 0,
            totalOutstanding: 83250000,
            billCount: 0,
        })
    })

    it("falls back to the bucket sum when totalOutstanding is missing", () => {
        expect(
            normalizeAPAgingSummary({
                current: 83250000,
                d1_30: undefined,
                d31_60: undefined,
                d61_90: undefined,
                d90_plus: undefined,
            })
        ).toEqual({
            current: 83250000,
            d1_30: 0,
            d31_60: 0,
            d61_90: 0,
            d90_plus: 0,
            totalOutstanding: 83250000,
            billCount: 0,
        })
    })
})
