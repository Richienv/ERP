import { describe, it, expect } from "vitest"
import { checkStockAvailability } from "@/lib/inventory-utils"

describe("checkStockAvailability", () => {
  describe("when negative stock is NOT allowed (default)", () => {
    const allowNegative = false

    it("allows transaction when stock is sufficient", () => {
      const result = checkStockAvailability(100, 50, allowNegative)
      expect(result.allowed).toBe(true)
      expect(result.message).toBeNull()
      expect(result.remainingStock).toBe(50)
    })

    it("allows transaction that brings stock exactly to zero", () => {
      const result = checkStockAvailability(10, 10, allowNegative)
      expect(result.allowed).toBe(true)
      expect(result.message).toBeNull()
      expect(result.remainingStock).toBe(0)
    })

    it("rejects transaction that would make stock negative", () => {
      const result = checkStockAvailability(5, 10, allowNegative)
      expect(result.allowed).toBe(false)
      expect(result.message).toBe("Stok tidak cukup. Sisa stok: 5 unit")
      expect(result.remainingStock).toBe(-5)
    })

    it("rejects transaction from zero stock", () => {
      const result = checkStockAvailability(0, 1, allowNegative)
      expect(result.allowed).toBe(false)
      expect(result.message).toBe("Stok tidak cukup. Sisa stok: 0 unit")
      expect(result.remainingStock).toBe(-1)
    })

    it("includes custom unit in error message", () => {
      const result = checkStockAvailability(3, 7, allowNegative, "meter")
      expect(result.allowed).toBe(false)
      expect(result.message).toBe("Stok tidak cukup. Sisa stok: 3 meter")
    })

    it("formats large numbers with Indonesian locale in error message", () => {
      const result = checkStockAvailability(1500, 2000, allowNegative, "pcs")
      expect(result.allowed).toBe(false)
      // Indonesian locale uses dot as thousands separator
      expect(result.message).toBe("Stok tidak cukup. Sisa stok: 1.500 pcs")
    })
  })

  describe("when negative stock IS allowed (pre-selling mode)", () => {
    const allowNegative = true

    it("allows transaction when stock is sufficient", () => {
      const result = checkStockAvailability(100, 50, allowNegative)
      expect(result.allowed).toBe(true)
      expect(result.message).toBeNull()
      expect(result.remainingStock).toBe(50)
    })

    it("allows transaction that would make stock negative", () => {
      const result = checkStockAvailability(5, 10, allowNegative)
      expect(result.allowed).toBe(true)
      expect(result.message).toBeNull()
      expect(result.remainingStock).toBe(-5)
    })

    it("allows transaction from zero stock", () => {
      const result = checkStockAvailability(0, 100, allowNegative)
      expect(result.allowed).toBe(true)
      expect(result.message).toBeNull()
      expect(result.remainingStock).toBe(-100)
    })

    it("allows deeply negative stock for pre-selling", () => {
      const result = checkStockAvailability(-50, 100, allowNegative)
      expect(result.allowed).toBe(true)
      expect(result.message).toBeNull()
      expect(result.remainingStock).toBe(-150)
    })
  })

  describe("edge cases", () => {
    it("handles zero quantity deduction", () => {
      const result = checkStockAvailability(10, 0, false)
      expect(result.allowed).toBe(true)
      expect(result.remainingStock).toBe(10)
    })

    it("handles decimal stock values", () => {
      const result = checkStockAvailability(2.5, 3.0, false, "meter")
      expect(result.allowed).toBe(false)
      expect(result.remainingStock).toBe(-0.5)
    })

    it("defaults unit to 'unit' when not specified", () => {
      const result = checkStockAvailability(1, 5, false)
      expect(result.message).toContain("unit")
    })
  })
})
