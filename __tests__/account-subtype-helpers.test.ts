import { describe, it, expect } from "vitest"
import { inferSubType, subTypeLabel } from "@/lib/account-subtype-helpers"

describe("inferSubType", () => {
    it("1000 → ASSET_CASH", () => expect(inferSubType("1000")).toBe("ASSET_CASH"))
    it("1110 → ASSET_CASH", () => expect(inferSubType("1110")).toBe("ASSET_CASH"))
    it("1200 → ASSET_RECEIVABLE", () => expect(inferSubType("1200")).toBe("ASSET_RECEIVABLE"))
    it("1300 → ASSET_CURRENT", () => expect(inferSubType("1300")).toBe("ASSET_CURRENT"))
    it("1330 → ASSET_PREPAYMENTS", () => expect(inferSubType("1330")).toBe("ASSET_PREPAYMENTS"))
    it("1500 → ASSET_FIXED", () => expect(inferSubType("1500")).toBe("ASSET_FIXED"))
    it("1590 → ASSET_FIXED", () => expect(inferSubType("1590")).toBe("ASSET_FIXED"))
    it("1800 → ASSET_NON_CURRENT", () => expect(inferSubType("1800")).toBe("ASSET_NON_CURRENT"))
    it("2000 → LIABILITY_PAYABLE", () => expect(inferSubType("2000")).toBe("LIABILITY_PAYABLE"))
    it("2100 → LIABILITY_CURRENT", () => expect(inferSubType("2100")).toBe("LIABILITY_CURRENT"))
    it("2500 → LIABILITY_NON_CURRENT", () => expect(inferSubType("2500")).toBe("LIABILITY_NON_CURRENT"))
    it("3000 → EQUITY", () => expect(inferSubType("3000")).toBe("EQUITY"))
    it("3300 → EQUITY_UNAFFECTED", () => expect(inferSubType("3300")).toBe("EQUITY_UNAFFECTED"))
    it("4000 → INCOME", () => expect(inferSubType("4000")).toBe("INCOME"))
    it("4800 → INCOME_OTHER", () => expect(inferSubType("4800")).toBe("INCOME_OTHER"))
    it("5000 → EXPENSE_DIRECT_COST", () => expect(inferSubType("5000")).toBe("EXPENSE_DIRECT_COST"))
    it("6100 → EXPENSE", () => expect(inferSubType("6100")).toBe("EXPENSE"))
    it("6290 → EXPENSE_DEPRECIATION", () => expect(inferSubType("6290")).toBe("EXPENSE_DEPRECIATION"))
    it("7100 → EXPENSE_DEPRECIATION", () => expect(inferSubType("7100")).toBe("EXPENSE_DEPRECIATION"))
    it("8100 → EXPENSE", () => expect(inferSubType("8100")).toBe("EXPENSE"))
    it("0000 → GENERAL", () => expect(inferSubType("0000")).toBe("GENERAL"))
    it("abc → GENERAL", () => expect(inferSubType("abc")).toBe("GENERAL"))
})

describe("subTypeLabel", () => {
    it("returns Bahasa label", () => expect(subTypeLabel("ASSET_CASH")).toBe("Kas & Bank"))
    it("returns raw value for unknown", () => expect(subTypeLabel("UNKNOWN")).toBe("UNKNOWN"))
})
