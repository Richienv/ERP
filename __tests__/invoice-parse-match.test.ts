import { describe, expect, it } from "vitest"
import {
    fingerprintOf,
    learnTemplate,
    matchLines,
    matchSupplier,
    normaliseCompany,
    normalisePartCode,
} from "@/lib/invoice-parse/match"
import type { ParsedInvoice } from "@/lib/invoice-parse/types"

const suppliers = [
    { id: "s-local", code: "SUP-001", name: "CV Sumber Teknik Motor", npwp: "012345678901000", email: "admin@stm.co.id" },
    { id: "s-cn", code: "SUP-002", name: "Ruixiang Auto Parts", npwp: null, email: "sales@ruixiang-parts.example" },
    { id: "s-other", code: "SUP-003", name: "PT Solar Industri", npwp: null, email: "budi@gmail.com" },
]

const fields = (f: Record<string, string>) =>
    ({ fields: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { value: v, confidence: 0.9 }])) }) as Pick<ParsedInvoice, "fields">

describe("matchSupplier", () => {
    it("matches by NPWP regardless of punctuation", () => {
        expect(matchSupplier(fields({ supplierNpwp: "01.234.567.8-901.000" }), suppliers)).toMatchObject({ supplierId: "s-local", via: "npwp" })
    })
    it("matches by company email domain", () => {
        expect(matchSupplier(fields({ supplierEmail: "export@ruixiang-parts.example" }), suppliers)).toMatchObject({ supplierId: "s-cn", via: "email" })
    })
    it("does not match two different people on gmail", () => {
        expect(matchSupplier(fields({ supplierEmail: "andi@gmail.com" }), suppliers)).toBeNull()
    })
    it("matches a printed name that contains the stored name", () => {
        expect(matchSupplier(fields({ supplierName: "GUANGZHOU RUIXIANG AUTO PARTS CO., LTD." }), suppliers)).toMatchObject({ supplierId: "s-cn", via: "name" })
    })
    it("prefers a learned template fingerprint", () => {
        const templates = [{ supplierId: "s-cn", fingerprint: { printedName: "GUANGZHOU RUIXIANG AUTO PARTS CO., LTD." }, template: {}, samples: 2 }]
        expect(matchSupplier(fields({ supplierName: "Guangzhou Ruixiang Auto Parts Co Ltd" }), [], templates)).toMatchObject({ supplierId: "s-cn", via: "template" })
    })
    it("returns null for a stranger", () => {
        expect(matchSupplier(fields({ supplierName: "Shenzhen Brake Masters Ltd" }), suppliers)).toBeNull()
    })
})

describe("matchLines", () => {
    const products = [
        { id: "p1", code: "2304A078", name: "Cover Assy Clutch L200", unit: "PCS" },
        { id: "p2", code: "MN-171419", name: "Bearing Clutch Release", unit: "PCS" },
    ]
    const skus = [{ supplierId: "s-cn", productId: "p9", skuCode: "RX-1465A041" }]
    it("prefers the supplier's own SKU, then our product code", () => {
        const m = matchLines([{ partNo: "RX-1465A041" }, { partNo: "2304a078" }, { partNo: "MN171419" }, { partNo: "ZZZ" }, { partNo: null }], "s-cn", products, skus)
        expect(m).toEqual([
            { productId: "p9", via: "sku" },
            { productId: "p1", via: "code" },
            { productId: "p2", via: "code" },
            { productId: null, via: null },
            { productId: null, via: null },
        ])
    })
    it("ignores another supplier's SKUs", () => {
        expect(matchLines([{ partNo: "RX-1465A041" }], "s-local", products, skus)[0].productId).toBeNull()
    })
})

describe("templates", () => {
    it("learns header columns, labels, locale and currency", () => {
        const parsed = {
            headerCells: [{ text: "Kode Part", column: "partNo" as const }, { text: "Qty", column: "qty" as const }, { text: "Foo", column: null }],
            fields: { invoiceNo: { value: "A-1", confidence: 0.9, label: "no nota" } },
            numberLocale: "id" as const,
        }
        const t = learnTemplate({ columnMap: { kd: "partNo" } }, parsed, { currencyCode: "IDR" })
        expect(t.columnMap).toEqual({ kd: "partNo", "kode part": "partNo", qty: "qty" })
        expect(t.labelMap).toEqual({ invoiceNo: "no nota" })
        expect(t.numberLocale).toBe("id")
        expect(t.currencyCode).toBe("IDR")
    })
    it("fingerprints a supplier by NPWP digits, email domain and printed name", () => {
        expect(fingerprintOf(fields({ supplierNpwp: "01.234.567.8-901.000", supplierEmail: "a@stm.co.id", supplierName: "CV STM" }))).toEqual({
            npwp: "012345678901000",
            emailDomain: "stm.co.id",
            printedName: "CV STM",
        })
    })
    it("normalises names and codes", () => {
        expect(normaliseCompany("GUANGZHOU RUIXIANG AUTO PARTS CO., LTD.")).toBe("guangzhou ruixiang auto parts")
        expect(normalisePartCode(" mn-171 419 ")).toBe("MN171419")
    })
})
