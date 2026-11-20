import { describe, expect, it } from "vitest"
import * as XLSX from "xlsx"
import { excelToTextItems, isExcelFile, pickSheet } from "@/lib/invoice-parse/excel"
import { detectDocument, isOurCompany, planImport } from "@/lib/invoice-parse/doc-type"
import { parseInvoice } from "@/lib/invoice-parse/parse-invoice"

/**
 * Shapes copied from a real spare-part trading cycle (customer PO → our PO/CO to a vendor →
 * surat jalan → invoice), with fictional names and numbers. The real files never enter the repo.
 */

const OURS = ["CV Contoh Jaya"]

function workbook(rows: (string | number | null)[][], opts: { cols?: number[]; sheet?: string; percentCells?: string[] } = {}) {
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws["!cols"] = (opts.cols ?? [6, 30, 16, 6, 6, 16, 8, 18]).map((wch) => ({ wch }))
    for (const ref of opts.percentCells ?? []) if (ws[ref]) ws[ref].z = "0%"
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, opts.sheet ?? "Sheet1")
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["kwitansi"]]), "kwitansi")
    return new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" }))
}

describe("our Cash Order to a vendor (Excel)", () => {
    const bytes = workbook([
        ["CV. CONTOH JAYA", null, null, "PHONE*", null, "021 - 000000"],
        ["JL. CONTOH NO. 1"],
        ["BALIKPAPAN"],
        [],
        ["KEPADA*", ": ARTA MOBIL", null, "TANGGAL*", null, "27 Maret 2024"],
        ["PIC*", ": BPK ANDI", null, "REFF PR*", null, null],
        ["PEMBAYARAN*", ": CASH ORDER", null, "MODEL UNIT*", null, "TRITON"],
        [null, null, null, null, null, null, "CO24-03-0016"],
        ["NO", "MATERIAL", "PART NUMBER", "QTY", null, "HARGA SATUAN", "DISC", "JUMLAH HARGA"],
        [1, "BALL JOINT LOWER ARM", "4013A314", 2, "PCS", 100000, null, 200000],
        [2, "BOLT CALIPER, FR BRAKE", "MR527540", 26, "PCS", 5000, null, 130000],
        [3, "HUB ASSY, FR WHEEL", "3880A036", 22, "PCS", 375000, null, 8250000],
        [],
        [null, null, null, null, null, "JUMLAH", null, 8580000],
        [null, null, null, null, null, "DISCOUNT", null, null],
        [null, null, null, null, null, "TOTAL", null, 8580000],
    ])
    const text = excelToTextItems(bytes, XLSX as never)

    it("is recognised as our CO to the vendor, with its references", () => {
        const doc = detectDocument(text.items, { ours: OURS })
        expect(doc).toMatchObject({ kind: "PURCHASE_ORDER", poType: "CO", issuedByUs: true, documentNo: "CO24-03-0016", counterparty: "ARTA MOBIL", pic: "BPK ANDI", modelUnit: "TRITON" })
        expect(planImport(doc).action).toBe("CREATE_PO")
    })

    it("reads every line with its part number and adds up", () => {
        const p = parseInvoice(text.items)
        expect(p.lines.map((l) => [l.partNo, l.description, l.qty, l.unitPrice, l.amount])).toEqual([
            ["4013A314", "BALL JOINT LOWER ARM", 2, 100000, 200000],
            ["MR527540", "BOLT CALIPER, FR BRAKE", 26, 5000, 130000],
            ["3880A036", "HUB ASSY, FR WHEEL", 22, 375000, 8250000],
        ])
        expect(p.fields.invoiceDate?.value).toBe("2024-03-27")
        expect(p.fields.subtotal?.value).toBe(8580000)
        expect(p.fields.total?.value).toBe(8580000)
        expect(p.checks).toEqual({ linesVsSubtotal: 0, subtotalPlusTaxVsTotal: 0 })
    })
})

describe("our invoice to a customer (Excel, 'Jumlah' means quantity next to 'Total Harga')", () => {
    const bytes = workbook(
        [
            ["CV. CONTOH JAYA"],
            ["I N V O I C E"],
            ["Tanggal:", null, "28 December 2023", "Kepada:", null, " PT. Pelanggan Contoh"],
            ["Nomor :", null, "050/INV-CJ/JKT/XII/2023", "PIC:", null, " Ibu Rina"],
            ["Nomor PO:", null, "PO23 - CBANG - 01234"],
            [" No ", " Material ", null, " Jumlah ", null, " Harga Satuan ", " Total Harga "],
            [1, "38801036", "BEARING HUB", 2, "PCS", 600000, 1200000],
            [" Jumlah ", null, null, null, null, null, 1200000],
            [null, null, null, null, null, " PPN 11% ", 132000],
            [" Total ", null, null, null, null, null, 1332000],
        ],
        { sheet: "Invoice", cols: [6, 14, 24, 8, 6, 14, 16] },
    )
    const text = excelToTextItems(bytes, XLSX as never)

    it("picks the Invoice sheet and sees a sales document", () => {
        expect(text.sheet).toBe("Invoice")
        const doc = detectDocument(text.items, { ours: OURS })
        expect(doc).toMatchObject({ kind: "INVOICE", issuedByUs: true, documentNo: "050/INV-CJ/JKT/XII/2023", poRef: "PO23 - CBANG - 01234", counterparty: "PT. Pelanggan Contoh" })
        expect(planImport(doc).action).toBe("SALES_NOT_ENABLED")
    })

    it("reads quantity, price, PPN and total", () => {
        const p = parseInvoice(text.items)
        expect(p.lines).toHaveLength(1)
        expect(p.lines[0]).toMatchObject({ partNo: "38801036", description: "BEARING HUB", qty: 2, unitPrice: 600000, amount: 1200000, issues: [] })
        expect(p.fields.tax?.value).toBe(132000)
        expect(p.fields.total?.value).toBe(1332000)
    })
})

describe("surat jalan (quantities only)", () => {
    const bytes = workbook([
        ["PT VENDOR PARTS"],
        ["KEPADA:", "CV CONTOH JAYA", null, "TANGGAL:", null, "27 July 2023"],
        ["PIC:", "IBU RINA", null, "REFF PO:", null, "CO24-03-0016"],
        [null, null, null, "SJ2023-07-0005"],
        ["SURAT JALAN"],
        ["NO", "MATERIAL", "PART NUMBER", "JML", null, "KETERANGAN"],
        [1, "OIL SEAL FR DIFF SIDE", "3541A198", 6, "PCS"],
        [2, "SHOE SET,RR BRAKE", "4600A106", 2, "SET"],
    ])
    const text = excelToTextItems(bytes, XLSX as never)

    it("is a delivery from the vendor against our CO", () => {
        const doc = detectDocument(text.items, { ours: OURS })
        expect(doc).toMatchObject({ kind: "DELIVERY_NOTE", issuedByUs: false, documentNo: "SJ2023-07-0005", poRef: "CO24-03-0016" })
        expect(planImport(doc).action).toBe("RECEIVE_DELIVERY")
    })

    it("reads quantities without complaining about missing prices", () => {
        const p = parseInvoice(text.items)
        expect(p.lines.map((l) => [l.partNo, l.qty, l.unit, l.issues.length])).toEqual([
            ["3541A198", 6, "PCS", 0],
            ["4600A106", 2, "SET", 0],
        ])
    })
})

describe("customer PO (PDF text) and accounting formats", () => {
    const layout = (rows: [number, string][][]) =>
        rows.flatMap((cells, i) => cells.map(([x, str]) => ({ str, x, y: 100 + i * 14, w: str.length * 5, h: 9, page: 1 })))

    it("treats '(  200,000.00)' and '-Rp 100,000-' as positive amounts", () => {
        const items = layout([
            [[40, "CV. CONTOH JAYA"]],
            [[40, "KEPADA*"], [100, ": ARTA MOBIL"], [300, "TANGGAL*"], [360, ": 27 Maret 2024"]],
            [[420, "CO24-03-0017"]],
            [[40, "NO"], [70, "MATERIAL"], [200, "PART NUMBER"], [280, "QTY"], [330, "HARGA SATUAN"], [420, "DISC"], [470, "JUMLAH HARGA"]],
            [[40, "1"], [70, "BALL JOINT LOWER ARM"], [200, "4013A314"], [280, "2"], [300, "PCS"], [330, "-Rp 100,000-"], [470, "(  200,000.00)"]],
            [[420, "JUMLAH"], [470, "(  200,000.00)"]],
            [[420, "TOTAL"], [470, "(  200,000.00)"]],
        ])
        const p = parseInvoice(items)
        expect(p.lines[0]).toMatchObject({ partNo: "4013A314", qty: 2, unitPrice: 100000, amount: 200000 })
        expect(p.fields.total?.value).toBe(200000)
        expect(detectDocument(items, { ours: OURS })).toMatchObject({ kind: "PURCHASE_ORDER", poType: "CO", documentNo: "CO24-03-0017" })
    })

    it("knows a customer's PO to us is a sales document", () => {
        const items = layout([
            [[40, "PT. PELANGGAN CONTOH"]],
            [[40, "TO"], [100, ":"], [120, "CV. CONTOH JAYA"], [300, "DATE"], [360, ":"], [380, "20-Apr-24"]],
            [[40, "PIC"], [100, ":"], [120, "CHRIS"], [300, "MODEL UNIT"], [360, ":"], [380, "BUS"]],
            [[60, "Bersama ini kami sampaikan Purchase Order sebagai berikut :"], [400, "PO24 - CBANG - 00777"]],
        ])
        const doc = detectDocument(items, { ours: OURS })
        expect(doc).toMatchObject({ kind: "PURCHASE_ORDER", issuedByUs: false, documentNo: "PO24 - CBANG - 00777", pic: "CHRIS", modelUnit: "BUS" })
        expect(planImport(doc).action).toBe("SALES_NOT_ENABLED")
    })
})

describe("helpers", () => {
    it("matches our company however it is written", () => {
        expect(isOurCompany("CV. CONTOH JAYA", OURS)).toBe(true)
        expect(isOurCompany("Contoh Jaya, CV", OURS)).toBe(true)
        expect(isOurCompany("ARTA MOBIL", OURS)).toBe(false)
        expect(isOurCompany("CV. CONTOH JAYA", [])).toBe(false)
    })
    it("recognises Excel files and the document sheet", () => {
        expect(isExcelFile({ name: "CO24-03-0016 Andi.xlsx" })).toBe(true)
        expect(isExcelFile({ name: "x.pdf", type: "application/pdf" })).toBe(false)
        expect(pickSheet(["kwitansi", "Invoice", "tanda terima"])).toBe("Invoice")
        expect(pickSheet(["Sheet1"])).toBe("Sheet1")
    })
})
