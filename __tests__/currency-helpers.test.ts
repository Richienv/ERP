import { describe, it, expect, vi, beforeEach } from "vitest"

const mockFindFirst = vi.fn()
vi.mock("@/lib/db", () => ({
    prisma: {
        exchangeRate: {
            findFirst: (...args: any[]) => mockFindFirst(...args),
        },
    },
}))

import { getExchangeRate, convertToIDR } from "@/lib/currency-helpers"

describe("getExchangeRate", () => {
    beforeEach(() => mockFindFirst.mockReset())

    it("returns 1 for IDR", async () => {
        const rate = await getExchangeRate("IDR", new Date())
        expect(rate).toBe(1)
        expect(mockFindFirst).not.toHaveBeenCalled()
    })

    it("returns middleRate for foreign currency", async () => {
        mockFindFirst.mockResolvedValue({ middleRate: 16300 })
        const rate = await getExchangeRate("USD", new Date("2026-03-27"))
        expect(rate).toBe(16300)
    })

    it("throws when no rate found", async () => {
        mockFindFirst.mockResolvedValue(null)
        await expect(getExchangeRate("EUR", new Date("2026-03-27")))
            .rejects.toThrow("Kurs EUR belum tersedia")
    })
})

describe("convertToIDR", () => {
    it("converts amount using rate", () => {
        expect(convertToIDR(100, 16300)).toBe(1630000)
    })

    it("returns same amount for rate=1 (IDR)", () => {
        expect(convertToIDR(50000, 1)).toBe(50000)
    })
})
