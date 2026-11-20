import { readFileSync } from "node:fs"
import path from "node:path"
import { beforeAll, describe, expect, it } from "vitest"
import { extractTextItems, needsOcr } from "@/lib/invoice-parse/pdf-text"
import { parseInvoice } from "@/lib/invoice-parse/parse-invoice"
import type { ParsedInvoice, TextItem } from "@/lib/invoice-parse/types"

const FIXTURES = path.join(__dirname, "fixtures", "invoices")

async function loadPdf(name: string) {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
    const data = readFileSync(path.join(FIXTURES, name))
    const t0 = performance.now()
    const text = await extractTextItems(new Uint8Array(data), pdfjs as any)
    const t1 = performance.now()
    const parsed = parseInvoice(text.items)
    const t2 = performance.now()
    return { text, parsed, extractMs: t1 - t0, parseMs: t2 - t1 }
}

describe("supplier invoice in RMB (China, commercial invoice)", () => {
    let parsed: ParsedInvoice
    let parseMs = 0
    beforeAll(async () => {
        const r = await loadPdf("cn-commercial-invoice.pdf")
        parsed = r.parsed
        parseMs = r.parseMs
        expect(needsOcr(r.text)).toBe(false)
    })

    it("reads the header fields", () => {
        expect(parsed.fields.supplierName?.value).toBe("GUANGZHOU RUIXIANG AUTO PARTS CO., LTD.")
        expect(parsed.fields.invoiceNo?.value).toBe("RX-2026-1108")
        expect(parsed.fields.invoiceDate?.value).toBe("2026-11-08")
        expect(parsed.fields.currency?.value).toBe("CNY")
        expect(parsed.fields.poRef?.value).toBe("PO-SP-0012")
        expect(parsed.fields.supplierEmail?.value).toBe("sales@ruixiang-parts.example")
        expect(String(parsed.fields.paymentTerms?.value)).toContain("30% deposit")
        expect(parsed.numberLocale).toBe("en")
    })

    it("reads every item line with OE numbers", () => {
        expect(parsed.lines).toHaveLength(7)
        expect(parsed.lines.map((l) => l.partNo)).toEqual([
            "2304A078", "2301A084", "MN171419", "1460A037", "1465A041", "MR985041", "2324A080",
        ])
        expect(parsed.lines[0]).toMatchObject({ description: "COVER ASSY,CLUTCH", qty: 100, unit: "PCS", unitPrice: 180, amount: 18000 })
        expect(parsed.lines[3].description).toBe("DIESEL PUMP VACUUM PRESSURE VALVE")
        expect(parsed.lines[4]).toMatchObject({ qty: 50, unitPrice: 585, amount: 29250 })
        for (const line of parsed.lines) expect(line.issues).toEqual([])
    })

    it("totals add up", () => {
        expect(parsed.fields.subtotal?.value).toBe(88650)
        expect(parsed.fields.total?.value).toBe(88650)
        expect(parsed.fields.tax).toBeUndefined()
        expect(parsed.checks).toEqual({ linesVsSubtotal: 0, subtotalPlusTaxVsTotal: 0 })
        expect(parsed.confidence).toBeGreaterThanOrEqual(0.9)
    })

    it("parses fast", () => {
        expect(parseMs).toBeLessThan(50)
    })
})

describe("local faktur in IDR with PPN and discount", () => {
    let parsed: ParsedInvoice
    beforeAll(async () => {
        parsed = (await loadPdf("id-faktur-lokal.pdf")).parsed
    })

    it("reads the header fields", () => {
        expect(parsed.fields.supplierName?.value).toBe("CV SUMBER TEKNIK MOTOR")
        expect(parsed.fields.supplierNpwp?.value).toBe("01.234.567.8-901.000")
        expect(parsed.fields.invoiceNo?.value).toBe("INV/STM/2026/11/0457")
        expect(parsed.fields.invoiceDate?.value).toBe("2026-11-12")
        expect(parsed.fields.dueDate?.value).toBe("2026-12-12")
        expect(parsed.fields.currency?.value).toBe("IDR")
        expect(parsed.numberLocale).toBe("id")
    })

    it("reads lines, units and the 5% discount", () => {
        expect(parsed.lines).toHaveLength(4)
        expect(parsed.lines[0]).toMatchObject({ partNo: "MZ690070", qty: 24, unit: "PCS", unitPrice: 85000, amount: 2040000 })
        expect(parsed.lines[2]).toMatchObject({ partNo: "4605A558", unit: "SET", discountPct: 5, amount: 4037500 })
        for (const line of parsed.lines) expect(line.issues).toEqual([])
    })

    it("separates DPP and PPN", () => {
        expect(parsed.fields.subtotal?.value).toBe(9857500)
        expect(parsed.fields.tax?.value).toBe(1084325)
        expect(parsed.fields.taxRate?.value).toBe(11)
        expect(parsed.fields.total?.value).toBe(10941825)
        expect(parsed.checks).toEqual({ linesVsSubtotal: 0, subtotalPlusTaxVsTotal: 0 })
        expect(parsed.confidence).toBeGreaterThanOrEqual(0.9)
    })
})

// ── Synthetic layouts ────────────────────────────────────────────────────────

/** Build items from rows of [x, text] cells; each row is one line 14pt apart. */
function layout(rows: [number, string][][], startY = 100): TextItem[] {
    return rows.flatMap((cells, i) =>
        cells.map(([x, str]) => ({ str, x, y: startY + i * 14, w: str.length * 5, h: 9, page: 1 })),
    )
}

describe("parser edge cases", () => {
    it("returns an empty result for no text", () => {
        const r = parseInvoice([])
        expect(r.lines).toEqual([])
        expect(r.confidence).toBe(0)
    })

    it("finds a part code at the start of the description when there is no code column", () => {
        const items = layout([
            [[40, "TOKO MAJU JAYA"]],
            [[100, "Barang"], [300, "Qty"], [360, "Harga"], [440, "Jumlah"]],
            [[100, "ME013307 Filter Oli"], [300, "10"], [360, "50.000"], [440, "500.000"]],
            [[360, "Total:"], [440, "500.000"]],
        ])
        expect(parseInvoice(items).lines[0]).toMatchObject({ partNo: "ME013307", description: "Filter Oli" })
    })

    it("uses a learned template for an unknown column header and label", () => {
        const items = layout([
            [[40, "TOKO MAJU JAYA"]],
            [[40, "Nota: NJ-7781"], [300, "Tgl: 03/11/2026"]],
            [[40, "Kd"], [100, "Barang"], [300, "Kuant"], [360, "Harga"], [440, "Jumlah"]],
            [[40, "ME013307"], [100, "Filter Oli"], [300, "10"], [360, "50.000"], [440, "500.000"]],
            [[360, "Total:"], [440, "500.000"]],
        ])
        const without = parseInvoice(items)
        expect(without.fields.invoiceNo).toBeUndefined()
        expect(without.lines[0].issues.length).toBeGreaterThan(0)

        const withTemplate = parseInvoice(items, {
            template: { columnMap: { kd: "partNo", kuant: "qty" }, labelMap: { invoiceNo: "nota" }, numberLocale: "id" },
        })
        expect(withTemplate.lines[0]).toMatchObject({ partNo: "ME013307", description: "Filter Oli", qty: 10, unitPrice: 50000, amount: 500000 })
        expect(withTemplate.lines[0].issues).toEqual([])
        expect(withTemplate.fields.invoiceNo?.value).toBe("NJ-7781")
    })

    it("flags a line whose numbers do not add up instead of guessing", () => {
        const items = layout([
            [[40, "PT SUPPLIER CONTOH"]],
            [[40, "Invoice No: A-1"], [300, "Date: 2026-11-01"]],
            [[40, "Part No"], [100, "Description"], [300, "Qty"], [360, "Unit Price"], [440, "Amount"]],
            [[40, "X100"], [100, "Bolt"], [300, "10"], [360, "2.00"], [440, "25.00"]],
            [[360, "Total:"], [440, "25.00"]],
        ])
        const r = parseInvoice(items)
        expect(r.lines[0].issues[0]).toMatch(/Qty × harga ≠ jumlah/)
        expect(r.lines[0].confidence).toBeLessThan(0.75)
    })

    it("falls back to price + amount rows when OCR destroyed the table header, and flags them", () => {
        // Shape of a real OCR pass over a scanned faktur (header row garbled, narrow columns lost).
        const items = layout([
            [[40, "CV SUMBER TEKNIK MOTOR"], [400, "FAKTUR PENJUALAN"]],
            [[300, "No. Faktur: INV/STM/2026/11/0457"]],
            [[40, "[No"], [70, "oe"], [100, "Barang"], [330, "Harga"], [360, "Saran"], [400, "[se"], [440, "Jaman"]],
            [[40, "MZ680070"], [90, "|"], [100, "Filter Oli Mitsubishi L200"], [330, "85.000"], [440, "2.040.000"]],
            [[40, "4605A558"], [90, "|"], [100, "Kampas Rem Depan L200"], [330, "425.000"], [400, "5%"], [440, "4.037.500"]],
            [[360, "Subtotal:"], [440, "Rp 6.077.500"]],
        ])
        const r = parseInvoice(items, { method: "OCR" })
        expect(r.lines).toHaveLength(2)
        expect(r.lines[0]).toMatchObject({ partNo: "MZ680070", description: "Filter Oli Mitsubishi L200", qty: 24, unitPrice: 85000, amount: 2040000 })
        expect(r.lines[1]).toMatchObject({ partNo: "4605A558", qty: 10, discountPct: 5, amount: 4037500 })
        expect(r.lines.every((l) => l.confidence < 0.75 && l.issues.length > 0)).toBe(true)
        expect(r.fields.subtotal?.value).toBe(6077500)
        expect(r.checks.linesVsSubtotal).toBe(0)
    })

    it("attaches a wrapped description printed above the numbers", () => {
        const items = layout([
            [[40, "PT SUPPLIER CONTOH"]],
            [[40, "Invoice No: A-2"], [300, "Date: 2026-11-01"]],
            [[40, "Part No"], [100, "Description"], [300, "Qty"], [360, "Unit Price"], [440, "Amount"]],
            [[100, "DIESEL PUMP VACUUM PRESSURE"]],
            [[40, "1460A037"], [100, "VALVE"], [300, "100"], [360, "125.00"], [440, "12,500.00"]],
            [[360, "Total:"], [440, "12,500.00"]],
        ])
        const r = parseInvoice(items)
        expect(r.lines[0].description).toBe("DIESEL PUMP VACUUM PRESSURE VALVE")
    })
})
