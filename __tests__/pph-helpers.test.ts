import { describe, it, expect } from "vitest"
import {
  calculateWithholding,
  getDefaultRate,
  getDepositDeadline,
  getFilingDeadline,
  adjustRateForNpwp,
  getPPhLiabilityAccount,
  PPH_RATES,
} from "@/lib/pph-helpers"

describe("PPH_RATES constants", () => {
  it("has correct default rates", () => {
    expect(PPH_RATES.PPH_23_SERVICES).toBe(2)
    expect(PPH_RATES.PPH_23_ROYALTY).toBe(15)
    expect(PPH_RATES.PPH_4_2_RENT).toBe(10)
    expect(PPH_RATES.PPH_4_2_CONSTRUCTION_SMALL).toBe(1.75)
    expect(PPH_RATES.PPH_4_2_CONSTRUCTION_MED).toBe(2.65)
    expect(PPH_RATES.PPH_4_2_CONSTRUCTION_LARGE).toBe(4)
  })
})

describe("getDefaultRate", () => {
  it("returns 2 for PPH_23", () => {
    expect(getDefaultRate("PPH_23")).toBe(2)
  })
  it("returns 10 for PPH_4_2", () => {
    expect(getDefaultRate("PPH_4_2")).toBe(10)
  })
  it("returns 0 for PPH_21 (calculated separately)", () => {
    expect(getDefaultRate("PPH_21")).toBe(0)
  })
})

describe("calculateWithholding", () => {
  it("calculates PPh 23 at 2% on Rp20M", () => {
    const result = calculateWithholding(2, 20_000_000)
    expect(result.amount).toBe(400_000)
    expect(result.netAmount).toBe(19_600_000)
  })

  it("calculates PPh 4(2) at 10% on Rp100M", () => {
    const result = calculateWithholding(10, 100_000_000)
    expect(result.amount).toBe(10_000_000)
    expect(result.netAmount).toBe(90_000_000)
  })

  it("calculates PPh 23 royalty at 15%", () => {
    const result = calculateWithholding(15, 50_000_000)
    expect(result.amount).toBe(7_500_000)
    expect(result.netAmount).toBe(42_500_000)
  })

  it("handles zero base amount", () => {
    const result = calculateWithholding(2, 0)
    expect(result.amount).toBe(0)
    expect(result.netAmount).toBe(0)
  })

  it("rounds to nearest rupiah", () => {
    const result = calculateWithholding(2, 33_333)
    expect(result.amount).toBe(667) // Math.round(666.66)
    expect(result.netAmount).toBe(32_666)
  })
})

describe("adjustRateForNpwp", () => {
  it("doubles PPh 23 rate when no NPWP", () => {
    expect(adjustRateForNpwp("PPH_23", 2, false)).toBe(4)
  })

  it("keeps PPh 23 rate when has NPWP", () => {
    expect(adjustRateForNpwp("PPH_23", 2, true)).toBe(2)
  })

  it("does NOT double PPh 4(2) — it is final tax", () => {
    expect(adjustRateForNpwp("PPH_4_2", 10, false)).toBe(10)
  })

  it("does NOT double PPh 21", () => {
    expect(adjustRateForNpwp("PPH_21", 5, false)).toBe(5)
  })
})

describe("getDepositDeadline", () => {
  it("returns 10th of next month", () => {
    const result = getDepositDeadline(new Date("2026-03-15T00:00:00Z"))
    expect(result).toEqual(new Date("2026-04-10T00:00:00Z"))
  })

  it("handles December → January rollover", () => {
    const result = getDepositDeadline(new Date("2026-12-20T00:00:00Z"))
    expect(result).toEqual(new Date("2027-01-10T00:00:00Z"))
  })
})

describe("getFilingDeadline", () => {
  it("returns 20th of next month", () => {
    const result = getFilingDeadline(new Date("2026-03-15T00:00:00Z"))
    expect(result).toEqual(new Date("2026-04-20T00:00:00Z"))
  })

  it("handles December → January rollover", () => {
    const result = getFilingDeadline(new Date("2026-12-20T00:00:00Z"))
    expect(result).toEqual(new Date("2027-01-20T00:00:00Z"))
  })
})

describe("getPPhLiabilityAccount", () => {
  it("returns 2210 for PPH_21", () => {
    expect(getPPhLiabilityAccount("PPH_21")).toBe("2210")
  })
  it("returns 2220 for PPH_23", () => {
    expect(getPPhLiabilityAccount("PPH_23")).toBe("2220")
  })
  it("returns 2230 for PPH_4_2", () => {
    expect(getPPhLiabilityAccount("PPH_4_2")).toBe("2230")
  })
})
