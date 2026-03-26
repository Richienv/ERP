import { describe, it, expect } from "vitest"
import { legacyTermToDays, calculateDueDate } from "@/lib/payment-term-helpers"

describe("legacyTermToDays", () => {
    it("returns 0 for CASH", () => {
        expect(legacyTermToDays("CASH")).toBe(0)
    })

    it("returns 0 for COD", () => {
        expect(legacyTermToDays("COD")).toBe(0)
    })

    it("returns 30 for NET_30", () => {
        expect(legacyTermToDays("NET_30")).toBe(30)
    })

    it("returns 15 for NET_15", () => {
        expect(legacyTermToDays("NET_15")).toBe(15)
    })

    it("returns 45 for NET_45", () => {
        expect(legacyTermToDays("NET_45")).toBe(45)
    })

    it("returns 60 for NET_60", () => {
        expect(legacyTermToDays("NET_60")).toBe(60)
    })

    it("returns 90 for NET_90", () => {
        expect(legacyTermToDays("NET_90")).toBe(90)
    })

    it("returns 30 for unknown value (fallback)", () => {
        expect(legacyTermToDays("UNKNOWN")).toBe(30)
    })
})

describe("calculateDueDate", () => {
    it("adds correct number of days", () => {
        const issue = new Date("2026-03-01")
        const due = calculateDueDate(issue, 30)
        expect(due.toISOString().split("T")[0]).toBe("2026-03-31")
    })

    it("returns same date for 0 days", () => {
        const issue = new Date("2026-03-15")
        const due = calculateDueDate(issue, 0)
        expect(due.toISOString().split("T")[0]).toBe("2026-03-15")
    })

    it("does not mutate input date", () => {
        const issue = new Date("2026-01-01")
        const original = issue.toISOString()
        calculateDueDate(issue, 60)
        expect(issue.toISOString()).toBe(original)
    })
})
