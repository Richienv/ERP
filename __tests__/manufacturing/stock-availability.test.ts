import { describe, it, expect } from "vitest"
import { getStockStatus } from "@/app/manufacturing/bom/[id]/hooks/use-stock-availability"

describe("getStockStatus", () => {
    it("returns 'cukup' when available stock >= required", () => {
        expect(getStockStatus(300, 300)).toBe("cukup")
        expect(getStockStatus(300, 500)).toBe("cukup")
    })

    it("returns 'hampir-habis' when available is 50-99% of required", () => {
        expect(getStockStatus(300, 180)).toBe("hampir-habis") // 60%
        expect(getStockStatus(300, 150)).toBe("hampir-habis") // 50%
    })

    it("returns 'kurang' when available < 50% of required", () => {
        expect(getStockStatus(300, 100)).toBe("kurang") // 33%
        expect(getStockStatus(300, 0)).toBe("kurang")
    })

    it("returns 'cukup' when required is 0", () => {
        expect(getStockStatus(0, 500)).toBe("cukup")
        expect(getStockStatus(0, 0)).toBe("cukup")
    })
})
