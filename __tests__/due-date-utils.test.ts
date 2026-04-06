import { describe, expect, it, vi, afterEach } from "vitest"
import {
    getDaysLate,
    getDueDateStatus,
    getAgingBucket,
    isOverdue,
    isDueToday,
} from "@/lib/due-date-utils"

/** Helper: build a date relative to "today" (mocked) */
function daysFromToday(offset: number): Date {
    const d = new Date(2026, 3, 6) // 2026-04-06 (mocked today)
    d.setDate(d.getDate() + offset)
    return d
}

describe("due-date-utils", () => {
    afterEach(() => { vi.useRealTimers() })

    // Lock "today" to 2026-04-06 for deterministic tests
    function mockToday() {
        vi.useFakeTimers()
        vi.setSystemTime(new Date(2026, 3, 6, 14, 30, 0)) // 2026-04-06 14:30
    }

    describe("getDaysLate", () => {
        it("returns negative for future dates", () => {
            mockToday()
            expect(getDaysLate(daysFromToday(5))).toBe(-5)
        })

        it("returns 0 for today", () => {
            mockToday()
            expect(getDaysLate(daysFromToday(0))).toBe(0)
        })

        it("returns positive for past dates", () => {
            mockToday()
            expect(getDaysLate(daysFromToday(-3))).toBe(3)
        })

        it("handles string dates", () => {
            mockToday()
            expect(getDaysLate("2026-04-06")).toBe(0)
        })
    })

    describe("getDueDateStatus", () => {
        it("returns BELUM_JATUH_TEMPO for future dates", () => {
            mockToday()
            expect(getDueDateStatus(daysFromToday(10))).toBe("BELUM_JATUH_TEMPO")
        })

        it("returns JATUH_TEMPO_HARI_INI for today", () => {
            mockToday()
            expect(getDueDateStatus(daysFromToday(0))).toBe("JATUH_TEMPO_HARI_INI")
        })

        it("returns OVERDUE for yesterday (1 day late)", () => {
            mockToday()
            expect(getDueDateStatus(daysFromToday(-1))).toBe("OVERDUE")
        })

        it("returns OVERDUE for 30 days late", () => {
            mockToday()
            expect(getDueDateStatus(daysFromToday(-30))).toBe("OVERDUE")
        })
    })

    describe("getAgingBucket", () => {
        it("returns 'current' for future dates", () => {
            mockToday()
            expect(getAgingBucket(daysFromToday(5))).toBe("current")
        })

        it("returns 'hari_ini' for today — NOT '1-30'", () => {
            mockToday()
            expect(getAgingBucket(daysFromToday(0))).toBe("hari_ini")
        })

        it("returns '1-30' for 1 day late (yesterday)", () => {
            mockToday()
            expect(getAgingBucket(daysFromToday(-1))).toBe("1-30")
        })

        it("returns '1-30' for 30 days late", () => {
            mockToday()
            expect(getAgingBucket(daysFromToday(-30))).toBe("1-30")
        })

        it("returns '31-60' for 31 days late", () => {
            mockToday()
            expect(getAgingBucket(daysFromToday(-31))).toBe("31-60")
        })

        it("returns '61-90' for 61 days late", () => {
            mockToday()
            expect(getAgingBucket(daysFromToday(-61))).toBe("61-90")
        })

        it("returns '90+' for 91 days late", () => {
            mockToday()
            expect(getAgingBucket(daysFromToday(-91))).toBe("90+")
        })
    })

    describe("isOverdue", () => {
        it("returns false for future dates", () => {
            mockToday()
            expect(isOverdue(daysFromToday(5))).toBe(false)
        })

        it("returns false for today — today is NOT overdue", () => {
            mockToday()
            expect(isOverdue(daysFromToday(0))).toBe(false)
        })

        it("returns true for yesterday (1 day late)", () => {
            mockToday()
            expect(isOverdue(daysFromToday(-1))).toBe(true)
        })
    })

    describe("isDueToday", () => {
        it("returns false for future dates", () => {
            mockToday()
            expect(isDueToday(daysFromToday(5))).toBe(false)
        })

        it("returns true for today", () => {
            mockToday()
            expect(isDueToday(daysFromToday(0))).toBe(true)
        })

        it("returns false for yesterday", () => {
            mockToday()
            expect(isDueToday(daysFromToday(-1))).toBe(false)
        })
    })
})
