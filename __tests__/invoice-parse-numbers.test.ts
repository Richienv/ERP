import { describe, expect, it } from "vitest"
import {
    detectCurrency,
    detectNumberLocale,
    parseAmount,
    parseDocDate,
} from "@/lib/invoice-parse/numbers"

describe("detectNumberLocale", () => {
    it("reads comma-thousands as English", () => {
        expect(detectNumberLocale(["18,000.00", "180.00", "88,650.00"])).toBe("en")
    })
    it("reads dot-thousands as Indonesian", () => {
        expect(detectNumberLocale(["2.040.000", "85.000", "1.084.325"])).toBe("id")
    })
    it("uses the currency to break a tie", () => {
        expect(detectNumberLocale(["1.500"], "IDR")).toBe("id")
        expect(detectNumberLocale(["1.500"], "CNY")).toBe("en")
    })
})

describe("parseAmount", () => {
    it("parses English amounts", () => {
        expect(parseAmount("18,000.00", "en")).toBe(18000)
        expect(parseAmount("88,650.00", "en")).toBe(88650)
        expect(parseAmount("180.00", "en")).toBe(180)
        expect(parseAmount("RMB 1,234.5", "en")).toBe(1234.5)
    })
    it("parses Indonesian amounts", () => {
        expect(parseAmount("2.040.000", "id")).toBe(2040000)
        expect(parseAmount("Rp 10.941.825", "id")).toBe(10941825)
        expect(parseAmount("Rp10.941.825,50", "id")).toBe(10941825.5)
        expect(parseAmount("85.000", "id")).toBe(85000)
    })
    it("parses percentages and plain integers", () => {
        expect(parseAmount("5%", "id")).toBe(5)
        expect(parseAmount("24", "id")).toBe(24)
        expect(parseAmount("100 PCS", "en")).toBe(100)
    })
    it("returns null for text", () => {
        expect(parseAmount("COVER ASSY", "en")).toBeNull()
        expect(parseAmount("", "en")).toBeNull()
        expect(parseAmount("2304A078", "en")).toBeNull()
    })
})

describe("parseDocDate", () => {
    const ymd = (d: Date | null) => d && `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    it("parses common invoice dates", () => {
        expect(ymd(parseDocDate("12/11/2026"))).toBe("2026-11-12")
        expect(ymd(parseDocDate("2026-11-08"))).toBe("2026-11-8")
        expect(ymd(parseDocDate("8 Nov 2026"))).toBe("2026-11-8")
        expect(ymd(parseDocDate("12 November 2026"))).toBe("2026-11-12")
        expect(ymd(parseDocDate("12 Desember 2026"))).toBe("2026-12-12")
        expect(ymd(parseDocDate("2026年11月8日"))).toBe("2026-11-8")
        expect(ymd(parseDocDate("Nov. 8, 2026"))).toBe("2026-11-8")
    })
    it("honours an explicit month-first order", () => {
        expect(ymd(parseDocDate("11/12/2026", "MDY"))).toBe("2026-11-12")
    })
    it("rejects impossible dates", () => {
        expect(parseDocDate("32/13/2026")).toBeNull()
        expect(parseDocDate("hello")).toBeNull()
    })
})

describe("detectCurrency", () => {
    it("finds the invoice currency", () => {
        expect(detectCurrency("TOTAL AMOUNT (RMB): 88,650.00")).toBe("CNY")
        expect(detectCurrency("Currency: CNY")).toBe("CNY")
        expect(detectCurrency("合计 ¥ 1,000")).toBe("CNY")
        expect(detectCurrency("Total: Rp 10.941.825")).toBe("IDR")
        expect(detectCurrency("Amount USD 1,000")).toBe("USD")
        expect(detectCurrency("hello")).toBeNull()
    })
})
