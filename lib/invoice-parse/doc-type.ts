import { buildLines, cellBox, normaliseLabel, type Cell, type Line } from "./layout"
import type { Box, TextItem } from "./types"

/**
 * What kind of document is this, who issued it, and what does it refer to?
 * Tuned on the our company purchase cycle (customer POs, our POs/COs to vendors, surat jalan,
 * invoices) but phrased generally.
 */

export type DocKind = "INVOICE" | "DELIVERY_NOTE" | "PURCHASE_ORDER"

export type DocInfo = {
    kind: DocKind | null
    /** "CO" = Cash Order (a PO paid in cash). */
    poType: "PO" | "CO" | null
    /** True when the document was issued by one of our own companies. */
    issuedByUs: boolean
    issuer: string | null
    /** The other party: "KEPADA / TO / Kepada Yth" for our documents, the issuer otherwise. */
    counterparty: string | null
    counterpartyBox?: Box
    documentNo: string | null
    documentNoBox?: Box
    /** A PO number this document refers to ("REFF PO", "Nomor PO", "PO Ref"). */
    poRef: string | null
    pic: string | null
    modelUnit: string | null
    payment: string | null
}

/**
 * Our own companies. Documents issued by these are outgoing (we wrote them). Never hard-coded here
 * (the repo is public): the lookup passes them from SystemSetting "company.names" / the tenant name,
 * with NEXT_PUBLIC_OUR_COMPANY_NAMES (comma-separated) as a fallback.
 */
export const OUR_COMPANIES: string[] = (process.env.NEXT_PUBLIC_OUR_COMPANY_NAMES || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim()
export function isOurCompany(name?: string | null, ours: string[] = OUR_COMPANIES): boolean {
    if (!name) return false
    const n = ` ${norm(name)} `
    return ours.some((o) => {
        const core = norm(o).replace(/^(CV|PT|UD|TOKO) /, "").replace(/ (CV|PT)$/, "")
        return core.length >= 3 && n.includes(` ${core} `)
    })
}

// Document numbers as these companies write them.
const DOC_NO = [
    { re: /\b((?:PO|CO)\s?\d{2}\s?-\s?[A-Z]{2,8}\s?-\s?\d{3,6})\b/, kind: "PURCHASE_ORDER" as const }, // PO24 - CBANG - 00777
    { re: /\b((?:PO|CO)\d{2}-\d{2}-\d{3,5})\b/, kind: "PURCHASE_ORDER" as const }, // CO24-03-0016
    { re: /\b(SJ\s?\d{4}-\d{2}-\d{3,5})\b/i, kind: "DELIVERY_NOTE" as const }, // SJ2023-07-0005
    { re: /\b(\d{2,5}\/INV[-A-Z0-9/]*\/\d{4})\b/i, kind: "INVOICE" as const }, // 050/INV-CJ/JKT/XII/2023
]

const TITLES: { re: RegExp; kind: DocKind }[] = [
    { re: /\bSURAT\s*JALAN\b|\bDELIVERY\s*(ORDER|NOTE)\b|\bTANDA\s*TERIMA\s*BARANG\b/i, kind: "DELIVERY_NOTE" },
    { re: /\bI\s?N\s?V\s?O\s?I\s?C\s?E\b|\bFAKTUR\b|\bTAGIHAN\b/i, kind: "INVOICE" },
    { re: /\bPURCHASE\s*ORDER\b|\bCASH\s*ORDER\b|\bPESANAN\s*PEMBELIAN\b/i, kind: "PURCHASE_ORDER" },
]

function labelValue(lines: Line[], labels: RegExp, accept: (v: string) => boolean = (v) => v.length > 1): { value: string; cell: Cell } | null {
    for (let li = 0; li < lines.length; li++) {
        const line = lines[li]
        for (let ci = 0; ci < line.cells.length; ci++) {
            const cell = line.cells[ci]
            const m = cell.text.match(new RegExp(`^\\s*(?:${labels.source})\\b\\s*\\*?\\s*[:：]?\\s*\\*?\\s*(.*)$`, "i"))
            if (!m) continue
            const inline = m[m.length - 1].replace(/^[:：*\s]+/, "").trim()
            if (inline && accept(inline)) return { value: inline, cell }
            let ni = ci + 1
            while (line.cells[ni] && /^[:：*\s]+$/.test(line.cells[ni].text)) ni++
            const next = line.cells[ni]
            if (next) {
                const v = next.text.replace(/^[:：*\s]+/, "").trim()
                if (v && accept(v)) return { value: v, cell: next }
            }
        }
    }
    return null
}

export function detectDocument(items: TextItem[], opts: { issuerName?: string | null; ours?: string[] } = {}): DocInfo {
    const lines = buildLines(items)
    const top = lines.slice(0, 14)
    const allText = lines.map((l) => l.text).join("\n")
    const topText = top.map((l) => l.text).join("\n")

    let kind: DocKind | null = null
    for (const t of TITLES) if (t.re.test(topText) || lines.some((l) => l.cells.some((c) => t.re.test(c.text) && c.text.length < 40))) { kind = t.kind; break }

    let documentNo: string | null = null
    let documentNoBox: Box | undefined
    for (const line of lines.slice(0, 20)) {
        for (const cell of line.cells) {
            for (const d of DOC_NO) {
                const m = cell.text.match(d.re)
                if (!m) continue
                // A PO number next to "REFF PO" / "Nomor PO" is a reference, not this document's number.
                if (/REF|NOMOR\s*PO|NO\.?\s*PO|PO\s*REF/i.test(line.text) && d.kind === "PURCHASE_ORDER" && kind !== "PURCHASE_ORDER") continue
                if (!documentNo && (kind === null || d.kind === kind)) {
                    documentNo = m[1].replace(/\s+/g, " ").trim()
                    documentNoBox = cellBox(cell)
                    kind ??= d.kind
                }
            }
        }
    }

    const poType: DocInfo["poType"] = kind === "PURCHASE_ORDER" ? (/\bCASH\s*ORDER\b/i.test(allText) || /^CO/i.test(documentNo ?? "") ? "CO" : "PO") : null

    const issuer = opts.issuerName ?? top[0]?.cells[0]?.text ?? null
    const ours = opts.ours ?? OUR_COMPANIES
    const issuedByUs = isOurCompany(issuer, ours)

    const to = labelValue(lines, /KEPADA(?:\s*YTH)?|TO|BILL\s*TO|SOLD\s*TO/, (v) => v.length > 2 && !/^[:：]$/.test(v))
    const counterparty = issuedByUs ? (to?.value.replace(/\s*[:：]\s*$/, "") ?? null) : issuer
    const poRefHit = labelValue(lines, /REFF?\s*PO|NOMOR\s*PO|NO\.?\s*PO|PO\s*REF(?:ERENCE)?|YOUR\s*ORDER/, (v) => /\d/.test(v) && v.length < 40)
    const pic = labelValue(lines, /PIC/, (v) => v.length > 1 && v.length < 40 && !/^[:：]/.test(v))?.value ?? null
    const modelUnit = labelValue(lines, /MODEL\s*UNIT/, (v) => v.length > 0 && v !== "-")?.value ?? null
    const payment = labelValue(lines, /PEMBAYARAN|PAYMENT(?:\s*ROLE|\s*TERMS)?/, (v) => v.length > 2 && v.length < 60)?.value ?? null

    return {
        kind,
        poType,
        issuedByUs,
        issuer,
        counterparty: counterparty ? counterparty.replace(/\s+/g, " ").trim() : null,
        counterpartyBox: to && issuedByUs ? cellBox(to.cell) : undefined,
        documentNo,
        documentNoBox,
        poRef: poRefHit ? poRefHit.value.replace(/\s+/g, " ").trim() : null,
        pic: pic?.replace(/^(BPK|IBU|BAPAK|PAK|BU)\.?\s+/i, (m) => m) ?? null,
        modelUnit: modelUnit && modelUnit !== "-" ? modelUnit : null,
        payment,
    }
}

/** What one import will do, in the user's words, before they press Simpan. */
export type ImportPlan =
    | { action: "CREATE_PO"; label: string }
    | { action: "SUPPLIER_INVOICE"; label: string }
    | { action: "RECEIVE_DELIVERY"; label: string }
    | { action: "SALES_NOT_ENABLED"; label: string }
    | { action: "UNKNOWN"; label: string }

export function planImport(doc: DocInfo): ImportPlan {
    if (doc.kind === "PURCHASE_ORDER" && doc.issuedByUs) return { action: "CREATE_PO", label: `Catat ${doc.poType === "CO" ? "Cash Order" : "PO"} ke vendor` }
    if (doc.kind === "INVOICE" && !doc.issuedByUs) return { action: "SUPPLIER_INVOICE", label: "Catat tagihan supplier" }
    if (doc.kind === "DELIVERY_NOTE" && !doc.issuedByUs) return { action: "RECEIVE_DELIVERY", label: "Terima barang dari surat jalan" }
    if (doc.kind && (doc.issuedByUs || doc.kind === "PURCHASE_ORDER")) {
        return { action: "SALES_NOT_ENABLED", label: "Dokumen penjualan (ke pelanggan) — modul penjualan belum aktif" }
    }
    // Unknown title: an invoice-shaped document from someone else is treated as a supplier invoice.
    return doc.issuedByUs ? { action: "UNKNOWN", label: "Jenis dokumen tidak dikenali" } : { action: "SUPPLIER_INVOICE", label: "Catat tagihan supplier" }
}

export const _test = { norm, labelValue, normaliseLabel }
