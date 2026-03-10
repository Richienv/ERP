import { describe, it, expect } from "vitest"
import {
  calculateRetainedEarnings,
  classifyFiscalYearEarnings,
} from "@/lib/finance-helpers"

describe("calculateRetainedEarnings", () => {
  it("returns 0 when no journal entries exist", () => {
    const result = calculateRetainedEarnings([], new Date("2026-03-10"))
    expect(result).toEqual({
      priorYearsRetained: 0,
      currentYearNetIncome: 0,
      total: 0,
    })
  })

  it("separates prior-year and current-year earnings", () => {
    const entries = [
      { date: new Date("2025-06-15"), accountType: "REVENUE" as const, debit: 0, credit: 5000000 },
      { date: new Date("2025-06-15"), accountType: "EXPENSE" as const, debit: 3000000, credit: 0 },
      { date: new Date("2026-02-01"), accountType: "REVENUE" as const, debit: 0, credit: 2000000 },
      { date: new Date("2026-02-01"), accountType: "EXPENSE" as const, debit: 800000, credit: 0 },
    ]
    const result = calculateRetainedEarnings(entries, new Date("2026-03-10"))
    expect(result.priorYearsRetained).toBe(2000000)
    expect(result.currentYearNetIncome).toBe(1200000)
    expect(result.total).toBe(3200000)
  })

  it("handles multiple prior years correctly", () => {
    const entries = [
      { date: new Date("2024-03-01"), accountType: "REVENUE" as const, debit: 0, credit: 10000000 },
      { date: new Date("2024-03-01"), accountType: "EXPENSE" as const, debit: 7000000, credit: 0 },
      { date: new Date("2025-06-01"), accountType: "REVENUE" as const, debit: 0, credit: 8000000 },
      { date: new Date("2025-06-01"), accountType: "EXPENSE" as const, debit: 5000000, credit: 0 },
    ]
    const result = calculateRetainedEarnings(entries, new Date("2026-01-15"))
    expect(result.priorYearsRetained).toBe(6000000)
    expect(result.currentYearNetIncome).toBe(0)
    expect(result.total).toBe(6000000)
  })
})

describe("classifyFiscalYearEarnings", () => {
  it("uses Laba Ditahan account balance when closing entries exist", () => {
    const accounts = [
      { code: "3200", name: "Laba Ditahan", type: "EQUITY" as const, balance: 15000000 },
    ]
    const result = classifyFiscalYearEarnings(accounts)
    expect(result.hasClosingEntries).toBe(true)
    expect(result.retainedFromClosing).toBe(15000000)
  })

  it("returns hasClosingEntries false when no Laba Ditahan account", () => {
    const accounts = [
      { code: "3100", name: "Modal Disetor", type: "EQUITY" as const, balance: 50000000 },
    ]
    const result = classifyFiscalYearEarnings(accounts)
    expect(result.hasClosingEntries).toBe(false)
    expect(result.retainedFromClosing).toBe(0)
  })
})
