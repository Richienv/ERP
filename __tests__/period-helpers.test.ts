import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock prisma
const mockFindUnique = vi.fn()
vi.mock("@/lib/db", () => ({
    prisma: {
        fiscalPeriod: {
            findUnique: (...args: any[]) => mockFindUnique(...args),
        },
    },
}))

import { assertPeriodOpen } from "@/lib/period-helpers"

describe("assertPeriodOpen", () => {
    beforeEach(() => {
        mockFindUnique.mockReset()
    })

    it("throws when period is closed", async () => {
        mockFindUnique.mockResolvedValue({
            isClosed: true,
            name: "Maret 2026",
        })

        await expect(assertPeriodOpen(new Date("2026-03-15")))
            .rejects.toThrow("Periode fiskal Maret 2026 sudah ditutup")
    })

    it("passes when period is open", async () => {
        mockFindUnique.mockResolvedValue({
            isClosed: false,
            name: "Maret 2026",
        })

        await expect(assertPeriodOpen(new Date("2026-03-15")))
            .resolves.not.toThrow()
    })

    it("passes when no fiscal period record exists (not yet created)", async () => {
        mockFindUnique.mockResolvedValue(null)

        await expect(assertPeriodOpen(new Date("2026-03-15")))
            .resolves.not.toThrow()
    })

    it("extracts correct year and month from date", async () => {
        mockFindUnique.mockResolvedValue(null)

        await assertPeriodOpen(new Date("2026-07-20"))

        expect(mockFindUnique).toHaveBeenCalledWith({
            where: { year_month: { year: 2026, month: 7 } },
        })
    })
})
