import { describe, it, expect } from "vitest"

// ─── Test helpers that mirror the server action logic ──────────────────────

function getMonthName(month: number): string {
    const names = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"]
    return names[month] ?? ""
}

function getMonthBoundaries(month: number, year: number) {
    const start = new Date(year, month - 1, 1)
    const end = new Date(year, month, 0)
    return { start, end }
}

interface CashflowItem {
    id: string
    date: string
    description: string
    amount: number
    direction: "IN" | "OUT"
    category: string
    isRecurring: boolean
    isManual: boolean
}

function calculateSummary(items: CashflowItem[], startingBalance: number) {
    const totalIn = items.filter(i => i.direction === "IN").reduce((s, i) => s + i.amount, 0)
    const totalOut = items.filter(i => i.direction === "OUT").reduce((s, i) => s + i.amount, 0)
    return {
        totalIn,
        totalOut,
        netFlow: totalIn - totalOut,
        estimatedEndBalance: startingBalance + totalIn - totalOut,
    }
}

function calculateVariance(planned: number, actual: number) {
    return {
        planned,
        actual,
        selisih: actual - planned,
        isOverBudget: actual > planned,
    }
}

function calculateBPJS(totalBaseSalary: number) {
    return {
        kesehatan: Math.round(totalBaseSalary * 0.04),
        ketenagakerjaan: Math.round(totalBaseSalary * 0.0574),
    }
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("Cashflow Planning — Month Names", () => {
    it("returns correct Indonesian month names", () => {
        expect(getMonthName(1)).toBe("Januari")
        expect(getMonthName(6)).toBe("Juni")
        expect(getMonthName(12)).toBe("Desember")
    })

    it("returns empty string for invalid month", () => {
        expect(getMonthName(0)).toBe("")
        expect(getMonthName(13)).toBe("")
        expect(getMonthName(-1)).toBe("")
    })
})

describe("Cashflow Planning — Month Boundaries", () => {
    it("calculates correct start and end for January", () => {
        const { start, end } = getMonthBoundaries(1, 2026)
        expect(start.getFullYear()).toBe(2026)
        expect(start.getMonth()).toBe(0)
        expect(start.getDate()).toBe(1)
        expect(end.getDate()).toBe(31)
    })

    it("calculates correct end for February non-leap year", () => {
        const { end } = getMonthBoundaries(2, 2025)
        expect(end.getDate()).toBe(28)
    })

    it("calculates correct end for February leap year", () => {
        const { end } = getMonthBoundaries(2, 2024)
        expect(end.getDate()).toBe(29)
    })

    it("calculates correct end for April (30 days)", () => {
        const { end } = getMonthBoundaries(4, 2026)
        expect(end.getDate()).toBe(30)
    })
})

describe("Cashflow Planning — Summary Calculation", () => {
    const makeItem = (amount: number, direction: "IN" | "OUT"): CashflowItem => ({
        id: `test-${Math.random()}`,
        date: "2026-03-15",
        description: "Test item",
        amount,
        direction,
        category: "MANUAL",
        isRecurring: false,
        isManual: true,
    })

    it("calculates total in and out correctly", () => {
        const items = [
            makeItem(50000000, "IN"),
            makeItem(30000000, "IN"),
            makeItem(20000000, "OUT"),
            makeItem(10000000, "OUT"),
        ]
        const summary = calculateSummary(items, 100000000)
        expect(summary.totalIn).toBe(80000000)
        expect(summary.totalOut).toBe(30000000)
        expect(summary.netFlow).toBe(50000000)
        expect(summary.estimatedEndBalance).toBe(150000000)
    })

    it("handles empty items", () => {
        const summary = calculateSummary([], 100000000)
        expect(summary.totalIn).toBe(0)
        expect(summary.totalOut).toBe(0)
        expect(summary.netFlow).toBe(0)
        expect(summary.estimatedEndBalance).toBe(100000000)
    })

    it("handles negative net flow", () => {
        const items = [
            makeItem(20000000, "IN"),
            makeItem(50000000, "OUT"),
        ]
        const summary = calculateSummary(items, 100000000)
        expect(summary.netFlow).toBe(-30000000)
        expect(summary.estimatedEndBalance).toBe(70000000)
    })
})

describe("Cashflow Planning — Variance", () => {
    it("detects over budget (pengeluaran lebih besar)", () => {
        const v = calculateVariance(50000000, 60000000)
        expect(v.selisih).toBe(10000000)
        expect(v.isOverBudget).toBe(true)
    })

    it("detects under budget (pengeluaran lebih kecil)", () => {
        const v = calculateVariance(50000000, 40000000)
        expect(v.selisih).toBe(-10000000)
        expect(v.isOverBudget).toBe(false)
    })

    it("handles exact match", () => {
        const v = calculateVariance(50000000, 50000000)
        expect(v.selisih).toBe(0)
        expect(v.isOverBudget).toBe(false)
    })
})

describe("Cashflow Planning — BPJS Calculation", () => {
    it("calculates BPJS rates correctly", () => {
        const totalSalary = 100000000 // 100 juta
        const bpjs = calculateBPJS(totalSalary)
        expect(bpjs.kesehatan).toBe(4000000) // 4%
        expect(bpjs.ketenagakerjaan).toBe(5740000) // 5.74%
    })

    it("handles zero salary", () => {
        const bpjs = calculateBPJS(0)
        expect(bpjs.kesehatan).toBe(0)
        expect(bpjs.ketenagakerjaan).toBe(0)
    })

    it("rounds to nearest rupiah", () => {
        const bpjs = calculateBPJS(7500000) // 7.5 juta
        expect(bpjs.kesehatan).toBe(300000) // 4% = 300000
        expect(bpjs.ketenagakerjaan).toBe(430500) // 5.74% = 430500
    })
})
