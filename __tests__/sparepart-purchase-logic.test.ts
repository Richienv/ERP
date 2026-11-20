import { describe, expect, it } from "vitest"
import {
    buildSearchText,
    derivePurchaseStatus,
    normaliseSearch,
    paymentIdr,
    poPaymentStatus,
    toIdrLines,
    validateSaveLines,
    type StatusInput,
} from "@/lib/sparepart-purchase-logic"

describe("toIdrLines", () => {
    it("converts RMB lines at the invoice rate so qty × unit price equals the line total", () => {
        const r = toIdrLines(
            [
                { qty: 100, unitPriceOriginal: 180 },
                { qty: 50, unitPriceOriginal: 585 },
            ],
            2490,
        )
        expect(r.lines[0]).toEqual({ qty: 100, unitPriceIdr: 448200, totalIdr: 44820000, amountOriginal: 18000 })
        expect(r.lines[1].totalIdr).toBe(72832500)
        expect(r.subtotalIdr).toBe(44820000 + 72832500)
        expect(r.subtotalOriginal).toBe(47250)
    })
    it("applies the line discount before converting", () => {
        const r = toIdrLines([{ qty: 10, unitPriceOriginal: 425000, discountPct: 5 }], 1)
        expect(r.lines[0]).toMatchObject({ unitPriceIdr: 403750, totalIdr: 4037500 })
    })
    it("refuses a zero rate", () => {
        expect(() => toIdrLines([{ qty: 1, unitPriceOriginal: 1 }], 0)).toThrow(/Kurs/)
    })
})

describe("validateSaveLines", () => {
    const ok = { productId: "p1", description: "Filter", qty: 2, unitPriceOriginal: 10 }
    it("accepts a good line", () => expect(validateSaveLines([ok])).toBeNull())
    it("explains what is wrong, by line", () => {
        expect(validateSaveLines([])).toMatch(/Minimal/)
        expect(validateSaveLines([{ ...ok, qty: 1.5 }])).toMatch(/Baris 1: qty barang stok harus bilangan bulat/)
        expect(validateSaveLines([ok, { ...ok, productId: null }])).toMatch(/Baris 2: pilih produk/)
        expect(validateSaveLines([{ ...ok, newProduct: null, productId: null, description: "" }])).toMatch(/nama barang kosong/)
    })
})

describe("derivePurchaseStatus", () => {
    const now = new Date("2026-11-20T10:00:00")
    const base: StatusInput = {
        poStatus: "VENDOR_CONFIRMED",
        billStatus: "ISSUED",
        billTotal: 1000,
        balanceDue: 1000,
        dueDate: "2026-12-20",
        ordered: 10,
        received: 0,
        shippedAt: null,
        currencyCode: "CNY",
    }
    it("import just ordered → mark shipped next", () => {
        expect(derivePurchaseStatus(base, now)).toMatchObject({ payStage: "UNPAID", goodsStage: "ORDERED", nextAction: "SHIP" })
    })
    it("local purchase just ordered → receive next", () => {
        expect(derivePurchaseStatus({ ...base, currencyCode: "IDR" }, now).nextAction).toBe("RECEIVE")
    })
    it("unposted bill comes first", () => {
        expect(derivePurchaseStatus({ ...base, billStatus: "DRAFT" }, now)).toMatchObject({ payStage: "UNPOSTED", nextAction: "POST_BILL" })
    })
    it("30% deposit paid and on the boat → receive next", () => {
        const s = derivePurchaseStatus({ ...base, balanceDue: 700, shippedAt: "2026-11-15" }, now)
        expect(s).toMatchObject({ payStage: "PARTIAL", goodsStage: "SHIPPED", nextAction: "RECEIVE" })
        expect(s.paidPct).toBeCloseTo(0.3)
    })
    it("partial delivery shows the received share", () => {
        const s = derivePurchaseStatus({ ...base, received: 6, shippedAt: "2026-11-15" }, now)
        expect(s).toMatchObject({ goodsStage: "PARTIAL", nextAction: "RECEIVE" })
        expect(s.receivedPct).toBeCloseTo(0.6)
    })
    it("overdue payment beats everything but posting", () => {
        expect(derivePurchaseStatus({ ...base, dueDate: "2026-11-10" }, now)).toMatchObject({ overdue: true, nextAction: "PAY" })
    })
    it("all received and unpaid → pay; all paid → done", () => {
        expect(derivePurchaseStatus({ ...base, received: 10 }, now).nextAction).toBe("PAY")
        expect(derivePurchaseStatus({ ...base, received: 10, balanceDue: 0 }, now)).toMatchObject({ payStage: "PAID", goodsStage: "RECEIVED", nextAction: "NONE" })
    })
    it("cancelled purchases have no next action", () => {
        expect(derivePurchaseStatus({ ...base, poStatus: "CANCELLED", billStatus: "CANCELLED" }, now)).toMatchObject({ goodsStage: "CANCELLED", payStage: "VOID", nextAction: "NONE" })
    })
})

describe("payments", () => {
    it("maps the bill balance to PO payment status", () => {
        expect(poPaymentStatus(1000, 1000)).toBe("UNPAID")
        expect(poPaymentStatus(1000, 300)).toBe("PARTIAL")
        expect(poPaymentStatus(1000, 0)).toBe("PAID")
    })
    it("converts an RMB payment and closes the exact IDR balance on the last one", () => {
        expect(paymentIdr({ amountOriginal: 26595, rate: 2490, balanceDueIdr: 220738500 })).toBe(66221550)
        expect(paymentIdr({ amountOriginal: 62055, rate: 2490, balanceDueIdr: 154516950.01 })).toBe(154516950.01)
        expect(paymentIdr({ amountOriginal: 99999, rate: 2490, balanceDueIdr: 1000 })).toBe(1000)
    })
})

describe("search", () => {
    it("builds one lower-case haystack", () => {
        expect(buildSearchText({ poNumber: "PO-202611-0001", supplierName: "Ruixiang", supplierInvoiceNo: "RX-1", partCodes: ["2304A078", null, "2304A078"] })).toBe(
            "po-202611-0001 | ruixiang | rx-1 | 2304a078",
        )
    })
    it("escapes LIKE wildcards", () => {
        expect(normaliseSearch("  50%_OFF ")).toBe("50\\%\\_off")
        expect(normaliseSearch("   ")).toBeNull()
    })
})
