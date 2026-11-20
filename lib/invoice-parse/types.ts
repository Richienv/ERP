/**
 * Types for the supplier-invoice parser.
 *
 * The parser is pure TypeScript: it takes positioned text items (from pdf.js
 * or OCR) and returns fields + line items with a confidence per value. It never
 * touches the network, so invoice content stays on the user's device.
 */

/** One run of text on a page. Coordinates are in PDF points, origin top-left. */
export type TextItem = {
    str: string
    x: number
    y: number
    w: number
    h: number
    page: number
}

export type Box = { page: number; x: number; y: number; w: number; h: number }

export type NumberLocale = "id" | "en"
export type DateOrder = "DMY" | "YMD" | "MDY"
export type CurrencyCode = "IDR" | "CNY" | "USD"

export type FieldKey =
    | "supplierName"
    | "supplierNpwp"
    | "supplierEmail"
    | "supplierPhone"
    | "invoiceNo"
    | "invoiceDate"
    | "dueDate"
    | "poRef"
    | "currency"
    | "paymentTerms"
    | "subtotal"
    | "tax"
    | "taxRate"
    | "total"

export type ParsedField<T = string | number> = {
    value: T
    /** 0..1 — how sure the parser is. Below 0.75 the review screen outlines it amber. */
    confidence: number
    /** Where on the page the value was read, for the review highlight. */
    source?: Box
    /** The label text that preceded the value (learned into supplier templates). */
    label?: string
}

export type ColumnKey =
    | "no"
    | "partNo"
    | "description"
    | "qty"
    | "unit"
    | "unitPrice"
    | "discount"
    | "amount"

export type ParsedLine = {
    partNo: string | null
    description: string
    qty: number | null
    unit: string | null
    unitPrice: number | null
    /** Percent, e.g. 5 for 5%. */
    discountPct: number | null
    amount: number | null
    confidence: number
    /** Human-readable problems, in Bahasa, shown next to the line. */
    issues: string[]
    source?: Box
}

export type ParsedInvoice = {
    fields: Partial<Record<FieldKey, ParsedField>>
    lines: ParsedLine[]
    numberLocale: NumberLocale
    /** Differences (absolute) between what the document says and what the lines add up to. null = not checkable. */
    checks: {
        linesVsSubtotal: number | null
        subtotalPlusTaxVsTotal: number | null
    }
    /** Overall 0..1. */
    confidence: number
    /** Header cells of the item table as printed, left to right (learned into templates). */
    headerCells: { text: string; column: ColumnKey | null }[]
    method: "TEXT" | "OCR"
    pages: number
}

/** What we learned about one supplier's layout. Stored in SupplierInvoiceTemplate. */
export type SupplierTemplate = {
    /** Normalised header text → column. Overrides the built-in vocabulary. */
    columnMap?: Record<string, ColumnKey>
    /** Field → the label this supplier prints for it (normalised). */
    labelMap?: Partial<Record<FieldKey, string>>
    numberLocale?: NumberLocale
    dateOrder?: DateOrder
    currencyCode?: CurrencyCode
}
