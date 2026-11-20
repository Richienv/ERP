import { buildLines, cellBox, lineBox, normaliseLabel, type Cell, type Line } from "./layout"
import { detectCurrency, detectNumberLocale, looksNumeric, parseAmount, parseDocDate, toIsoDate } from "./numbers"
import type {
    ColumnKey,
    CurrencyCode,
    FieldKey,
    NumberLocale,
    ParsedField,
    ParsedInvoice,
    ParsedLine,
    SupplierTemplate,
    TextItem,
} from "./types"

/**
 * Supplier invoice parser: positioned text in, fields + item lines out.
 *
 * Steps: lines/cells → header fields by label dictionaries (ID/EN/ZH) → item table found by its
 * header vocabulary → rows mapped to columns by x-position → totals → arithmetic self-check.
 * A supplier template (learned from earlier confirmations) is applied first when given.
 */

// ── Column vocabulary ────────────────────────────────────────────────────────

const COLUMN_VOCAB: Record<ColumnKey, string[]> = {
    no: ["no", "nr", "item", "序号", "#"],
    partNo: [
        "oe number", "oe no", "oem no", "oem number", "part no", "part number", "parts no", "kode barang",
        "kode part", "kode", "item code", "code", "sku", "p n", "pn", "article no", "material no", "ref no",
        "零件号", "编号", "型号", "货号",
    ],
    description: [
        "description of goods", "description", "nama barang", "nama item", "keterangan", "uraian",
        "item description", "part name", "product name", "product", "goods", "barang", "nama", "commodity",
        "名称", "品名", "货物名称",
    ],
    qty: ["quantity", "qty", "q ty", "kuantitas", "jml", "kts", "banyaknya", "banyak", "数量"],
    unit: ["satuan", "unit", "uom", "sat", "单位"],
    unitPrice: ["unit price", "harga satuan", "harga", "price", "u price", "rate", "单价"],
    discount: ["discount", "disc", "diskon", "potongan", "折扣"],
    amount: ["line total", "total price", "amount", "jumlah", "subtotal", "total", "nilai", "金额", "总价"],
}

const VOCAB_ENTRIES: { phrase: string; column: ColumnKey }[] = Object.entries(COLUMN_VOCAB)
    .flatMap(([column, phrases]) => phrases.map((phrase) => ({ phrase: normaliseLabel(phrase), column: column as ColumnKey })))
    .sort((a, b) => b.phrase.length - a.phrase.length)

function columnFor(text: string, template?: SupplierTemplate): ColumnKey | null {
    const norm = normaliseLabel(text)
    if (!norm) return null
    const learned = template?.columnMap?.[norm]
    if (learned) return learned
    for (const { phrase, column } of VOCAB_ENTRIES) {
        if (norm === phrase || norm.startsWith(phrase + " ") || norm.endsWith(" " + phrase)) return column
    }
    return null
}

// ── Field labels ─────────────────────────────────────────────────────────────

const FIELD_LABELS: Partial<Record<FieldKey, string[]>> = {
    dueDate: ["due date", "tanggal jatuh tempo", "tgl jatuh tempo", "jatuh tempo", "payment due", "到期日"],
    invoiceNo: [
        "commercial invoice no", "proforma invoice no", "invoice number", "invoice no", "invoice #", "no invoice",
        "nomor invoice", "no faktur", "nomor faktur", "faktur no", "inv no", "pi no", "发票号码", "发票号", "invoice",
    ],
    invoiceDate: ["invoice date", "tanggal faktur", "tgl faktur", "tanggal invoice", "tanggal", "tgl", "date", "日期", "开票日期"],
    poRef: ["po ref", "po no", "po number", "no po", "your order", "order no", "ref po", "订单号"],
    currency: ["currency", "mata uang", "币种"],
    paymentTerms: ["payment terms", "terms of payment", "syarat pembayaran", "termin", "terms", "付款方式"],
}

const TOTAL_LABELS: { key: "subtotal" | "tax" | "total"; phrases: string[] }[] = [
    { key: "subtotal", phrases: ["sub total", "subtotal", "dpp", "jumlah sebelum pajak", "total before tax", "小计"] },
    { key: "tax", phrases: ["ppn", "vat", "tax", "pajak", "税额", "增值税"] },
    {
        key: "total",
        phrases: ["grand total", "total amount", "total tagihan", "jumlah total", "amount due", "total", "jumlah", "合计", "总计"],
    },
]

const STOP_WORDS = /^(sub ?total|total|grand total|jumlah total|ppn|vat|dpp|terbilang|say total|say|合计|总计|小计|bank|catatan|notes?|remarks?)\b/i

const TITLE_WORDS = /^(commercial invoice|proforma invoice|invoice|faktur( penjualan| pajak)?|nota|tagihan|bill|packing list|发票|形式发票)$/i
const COMPANY_SUFFIX = /\b(co\.?,? ?ltd\.?|company|limited|ltd|inc|corp|pt\.?|cv\.?|ud\.?|toko|gmbh|llc|trading)\b|有限公司|公司/i
const BILL_TO = /^(bill to|sold to|buyer|kepada( yth)?|ship to|consignee|customer|pembeli|买方|收货人)\b/i
const NPWP_RE = /\b(\d{2}[.\s]?\d{3}[.\s]?\d{3}[.\s]?\d[-.\s]?\d{3}[.\s]?\d{3}|\d{16})\b/
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const TAX_RATE_RE = /(\d{1,2}(?:[.,]\d+)?)\s*%/

function labelRegex(phrase: string): RegExp {
    const body = phrase
        .split(" ")
        .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[\\s.]*")
    return new RegExp(`^\\s*${body}\\.?\\s*(?:\\([^)]*\\))?\\s*[:：#]?\\s*(.*)$`, "i")
}

type Hit = { value: string; cell: Cell; label: string; viaNeighbour: boolean }

/** Find `label: value` in cells. The value may sit in the same cell, the next cell, or the cell below. */
function findLabelled(lines: Line[], phrases: string[], accept: (v: string) => boolean, preferLabel?: string): Hit | null {
    const ordered = preferLabel ? [preferLabel, ...phrases.filter((p) => p !== preferLabel)] : phrases
    for (const phrase of ordered) {
        const re = labelRegex(phrase)
        for (let li = 0; li < lines.length; li++) {
            const line = lines[li]
            for (let ci = 0; ci < line.cells.length; ci++) {
                const cell = line.cells[ci]
                const m = cell.text.match(re)
                if (!m) continue
                const inline = m[1].trim()
                if (inline && accept(inline)) return { value: inline, cell, label: phrase, viaNeighbour: false }
                if (inline) continue
                const next = line.cells[ci + 1]
                if (next && accept(next.text)) return { value: next.text, cell: next, label: phrase, viaNeighbour: true }
                const below = lines[li + 1]
                if (below && below.page === line.page) {
                    const under = below.cells.find((c) => c.x2 > cell.x - 2 && c.x < cell.x2 + 40)
                    if (under && accept(under.text)) return { value: under.text, cell: under, label: phrase, viaNeighbour: true }
                }
            }
        }
    }
    return null
}

const isInvoiceNumber = (v: string) =>
    v.length >= 3 && v.length <= 40 && /\d/.test(v) && !parseDocDate(v) && !/^\d{1,3}([.,]\d{3})*([.,]\d+)?$/.test(v)

// ── Item table ───────────────────────────────────────────────────────────────

type Column = { key: ColumnKey; text: string; x: number; x2: number; left: number; right: number }

function findHeader(lines: Line[], template?: SupplierTemplate): { index: number; columns: Column[] } | null {
    let best: { index: number; columns: Column[]; score: number } | null = null
    for (let i = 0; i < lines.length; i++) {
        const mapped = lines[i].cells.map((cell) => ({ cell, key: columnFor(cell.text, template) }))
        const keys = new Set(mapped.filter((m) => m.key).map((m) => m.key))
        const hasNumeric = keys.has("qty") || keys.has("unitPrice") || keys.has("amount")
        const hasText = keys.has("description") || keys.has("partNo")
        if (keys.size < 3 || !hasNumeric || !hasText) continue
        const score = keys.size
        if (!best || score > best.score) {
            const cols = mapped
                .filter((m) => m.key)
                .map((m) => ({ key: m.key as ColumnKey, text: m.cell.text, x: m.cell.x, x2: m.cell.x2, left: 0, right: 0 }))
            best = { index: i, columns: cols, score }
        }
    }
    if (!best) return null
    const cols = best.columns.sort((a, b) => a.x - b.x)
    // Two header cells for the same key (e.g. "Total" twice) → keep the right-most for amount, left-most otherwise.
    const dedup: Column[] = []
    for (const col of cols) {
        const idx = dedup.findIndex((c) => c.key === col.key)
        if (idx === -1) dedup.push(col)
        else if (col.key === "amount") dedup[idx] = col
    }
    for (let i = 0; i < dedup.length; i++) {
        dedup[i].left = i === 0 ? -Infinity : (dedup[i - 1].x2 + dedup[i].x) / 2
        dedup[i].right = i === dedup.length - 1 ? Infinity : (dedup[i].x2 + dedup[i + 1].x) / 2
    }
    return { index: best.index, columns: dedup }
}

function assign(cells: Cell[], columns: Column[]): Partial<Record<ColumnKey, Cell[]>> {
    const out: Partial<Record<ColumnKey, Cell[]>> = {}
    for (const cell of cells) {
        const center = (cell.x + cell.x2) / 2
        let col = columns.find((c) => center >= c.left && center < c.right)
        if (!col) {
            col = columns.reduce((a, b) =>
                Math.abs((a.x + a.x2) / 2 - center) <= Math.abs((b.x + b.x2) / 2 - center) ? a : b,
            )
        }
        ;(out[col.key] ||= []).push(cell)
    }
    return out
}

const textOf = (cells?: Cell[]) => (cells || []).map((c) => c.text).join(" ").trim()

type RawRow = { line: Line; parts: Partial<Record<ColumnKey, Cell[]>>; numeric: boolean; prefix: string[]; suffix: string[] }

function readTable(lines: Line[], header: { index: number; columns: Column[] }, locale: NumberLocale) {
    const rows: RawRow[] = []
    const textOnly: { line: Line; desc: string; part: string }[] = []
    const headerLine = lines[header.index]
    let endIndex = lines.length
    for (let i = header.index + 1; i < lines.length; i++) {
        const line = lines[i]
        const first = line.cells[0]?.text ?? ""
        if (STOP_WORDS.test(first) || STOP_WORDS.test(line.cells[line.cells.length - 2]?.text ?? "")) {
            endIndex = i
            break
        }
        // A repeated header on the next page: skip it.
        if (line.page !== headerLine.page && findHeader([line])) continue
        const parts = assign(line.cells, header.columns)
        const hasNumber = (["qty", "unitPrice", "amount"] as ColumnKey[]).some((k) => {
            const t = textOf(parts[k])
            return t && looksNumeric(t) && parseAmount(t, locale) !== null
        })
        if (hasNumber) rows.push({ line, parts, numeric: true, prefix: [], suffix: [] })
        else {
            const desc = textOf(parts.description) || textOf(parts.unit) || ""
            const part = textOf(parts.partNo)
            if (desc || part) textOnly.push({ line, desc, part })
        }
    }
    // Wrapped descriptions: attach each text-only line to the nearest numeric row on the same page.
    for (const t of textOnly) {
        let best: RawRow | null = null
        let bestDist = Infinity
        for (const r of rows) {
            if (r.line.page !== t.line.page) continue
            const dist = Math.abs(r.line.y - t.line.y)
            if (dist < bestDist || (dist === bestDist && r.line.y < t.line.y)) {
                best = r
                bestDist = dist
            }
        }
        if (!best || bestDist > t.line.h * 3.2) continue
        if (t.line.y < best.line.y) best.prefix.push(t.desc)
        else best.suffix.push(t.desc)
    }
    return { rows, endIndex }
}

const PART_IN_DESC = /^([A-Z0-9]{2,}[-/]?[A-Z0-9]{2,}(?:\/[A-Z]+)?)\s+(.+)$/

function toParsedLine(row: RawRow, locale: NumberLocale): ParsedLine {
    const num = (k: ColumnKey) => {
        const t = textOf(row.parts[k])
        return t ? parseAmount(t, locale) : null
    }
    const issues: string[] = []
    let description = [...row.prefix, textOf(row.parts.description), ...row.suffix].filter(Boolean).join(" ").replace(/\s+/g, " ").trim()
    let partNo: string | null = textOf(row.parts.partNo) || null
    if (!partNo) {
        const m = description.match(PART_IN_DESC)
        if (m && /\d/.test(m[1])) {
            partNo = m[1]
            description = m[2]
        }
    }
    let qty = num("qty")
    let unit: string | null = textOf(row.parts.unit) || null
    const qtyText = textOf(row.parts.qty)
    if (!unit && qtyText) {
        const u = qtyText.match(/[A-Za-z]{2,6}\.?$/)
        if (u) unit = u[0].replace(".", "").toUpperCase()
    }
    let unitPrice = num("unitPrice")
    let amount = num("amount")
    let discountPct: number | null = null
    const discText = textOf(row.parts.discount)
    if (discText) {
        const d = parseAmount(discText, locale)
        if (d !== null) {
            if (/%/.test(discText) || d <= 100) discountPct = d
            else if (qty && unitPrice) discountPct = Math.round((d / (qty * unitPrice)) * 10000) / 100
        }
    }
    const factor = 1 - (discountPct || 0) / 100

    let confidence = 1
    if (qty !== null && unitPrice !== null && amount !== null) {
        const expected = qty * unitPrice * factor
        const diff = Math.abs(expected - amount)
        if (diff > Math.max(1, amount * 0.005)) {
            confidence = 0.5
            issues.push(`Qty × harga ≠ jumlah (selisih ${Math.round(diff * 100) / 100})`)
        }
    } else if (qty !== null && unitPrice !== null) {
        amount = Math.round(qty * unitPrice * factor * 100) / 100
        confidence = 0.8
    } else if (qty !== null && amount !== null && qty > 0) {
        unitPrice = Math.round((amount / qty / factor) * 100) / 100
        confidence = 0.8
    } else if (unitPrice !== null && amount !== null && unitPrice > 0) {
        qty = Math.round((amount / (unitPrice * factor)) * 1000) / 1000
        confidence = 0.6
        issues.push("Qty dihitung dari jumlah ÷ harga")
    } else {
        confidence = 0.3
        issues.push("Angka baris tidak lengkap")
    }
    if (!description) {
        confidence = Math.min(confidence, 0.6)
        issues.push("Nama barang kosong")
    }

    return {
        partNo,
        description,
        qty,
        unit,
        unitPrice,
        discountPct,
        amount,
        confidence,
        issues,
        source: lineBox(row.line),
    }
}

// ── Headerless fallback (scans where the header row did not survive OCR) ───────

const UNIT_WORD = /^(PCS|PC|PCE|SET|SETS|UNIT|UNITS|BOX|KG|EA|LOT|ROLL|BTL|LTR|PAIR|PRS|BH|BUAH)\.?$/i
const NOISE_CELL = /^[|[\]{}()_\-–—:;.,'"`~]+$/

/**
 * When no item header is found, treat a line as an item when it has text on the left and at least
 * a price and an amount on the right that agree with a whole quantity. Every such line is marked for
 * review (confidence 0.6), never silently trusted.
 */
function readHeaderless(lines: Line[], locale: NumberLocale, stopAt: number): ParsedLine[] {
    const out: ParsedLine[] = []
    for (let i = 0; i < stopAt; i++) {
        const line = lines[i]
        const cells = line.cells.map((c) => ({ ...c, text: c.text.replace(/^[|[\]]+|[|[\]]+$/g, "").trim() })).filter((c) => c.text && !NOISE_CELL.test(c.text))
        if (cells.length < 2 || cells.some((c) => /[:：]/.test(c.text))) continue
        const words = cells.flatMap((c) => c.text.split(/\s+/))
        // Peel numbers off the right end of the line.
        const nums: { value: number; pct: boolean }[] = []
        while (words.length) {
            const w = words[words.length - 1]
            const v = parseAmount(w, locale)
            if (v === null || parseDocDate(w)) break
            nums.unshift({ value: v, pct: /%$/.test(w) })
            words.pop()
        }
        let unit: string | null = null
        if (words.length && UNIT_WORD.test(words[words.length - 1])) unit = words.pop()!.replace(".", "").toUpperCase()
        const plain = nums.filter((n) => !n.pct)
        const disc = nums.find((n) => n.pct)?.value ?? null
        if (plain.length < 2 || !words.some((w) => /[A-Za-z]{3,}/.test(w))) continue
        const amount = plain[plain.length - 1].value
        const price = plain[plain.length - 2].value
        const factor = 1 - (disc || 0) / 100
        let qty = plain.length >= 3 ? plain[plain.length - 3].value : null
        if (qty !== null && Math.abs(qty * price * factor - amount) > Math.max(1, amount * 0.005)) qty = null
        if (qty === null) {
            const q = price > 0 ? amount / (price * factor) : 0
            if (q < 1 || Math.abs(q - Math.round(q)) > 0.01) continue
            qty = Math.round(q)
        }
        let partNo: string | null = null
        if (words.length > 1 && /\d/.test(words[0]) && /^[A-Z0-9][A-Z0-9/-]{3,}$/i.test(words[0])) partNo = words.shift()!.toUpperCase()
        if (words.length && /^\d{1,3}$/.test(words[0])) words.shift() // row number
        out.push({
            partNo,
            description: words.join(" "),
            qty,
            unit,
            unitPrice: price,
            discountPct: disc,
            amount,
            confidence: 0.6,
            issues: ["Dibaca tanpa kepala tabel — cek kode & qty"],
            source: lineBox(line),
        })
    }
    return out
}

// ── Main ─────────────────────────────────────────────────────────────────────

const field = <T extends string | number>(value: T, confidence: number, cell?: Cell, label?: string): ParsedField =>
    ({ value, confidence, source: cell ? cellBox(cell) : undefined, label })

export function parseInvoice(
    items: TextItem[],
    opts: { template?: SupplierTemplate | null; method?: "TEXT" | "OCR" } = {},
): ParsedInvoice {
    const template = opts.template ?? undefined
    const lines = buildLines(items)
    const pages = items.reduce((max, it) => Math.max(max, it.page), 0) || (items.length ? 1 : 0)
    const empty: ParsedInvoice = {
        fields: {},
        lines: [],
        numberLocale: template?.numberLocale ?? "en",
        checks: { linesVsSubtotal: null, subtotalPlusTaxVsTotal: null },
        confidence: 0,
        headerCells: [],
        method: opts.method ?? "TEXT",
        pages,
    }
    if (lines.length === 0) return empty

    const fullText = lines.map((l) => l.text).join("\n")
    const fields: ParsedInvoice["fields"] = {}

    // Currency first: it decides how ambiguous numbers are read.
    const currencyHit = findLabelled(lines, FIELD_LABELS.currency!, (v) => !!detectCurrency(v) || /^(IDR|CNY|RMB|USD)$/i.test(v))
    const currency: CurrencyCode | null =
        (currencyHit && (detectCurrency(currencyHit.value) || (currencyHit.value.toUpperCase() === "RMB" ? "CNY" : null))) ||
        detectCurrency(fullText) ||
        template?.currencyCode ||
        null
    if (currency) fields.currency = field(currency, currencyHit ? 0.98 : 0.85, currencyHit?.cell, currencyHit?.label)

    const numericSamples = lines.flatMap((l) => l.cells.map((c) => c.text)).filter((t) => looksNumeric(t))
    const locale: NumberLocale = template?.numberLocale ?? detectNumberLocale(numericSamples, currency)

    // Header fields.
    const labelOf = (k: FieldKey) => template?.labelMap?.[k]
    const due = findLabelled(lines, FIELD_LABELS.dueDate!, (v) => !!parseDocDate(v, template?.dateOrder), labelOf("dueDate"))
    if (due) fields.dueDate = field(toIsoDate(parseDocDate(due.value, template?.dateOrder)!), 0.95, due.cell, due.label)

    const inv = findLabelled(lines, FIELD_LABELS.invoiceNo!, isInvoiceNumber, labelOf("invoiceNo"))
    if (inv) fields.invoiceNo = field(inv.value.replace(/^[:#\s]+/, ""), inv.label === "invoice" ? 0.8 : 0.97, inv.cell, inv.label)

    const dateHit = findLabelled(
        lines,
        FIELD_LABELS.invoiceDate!,
        (v) => !!parseDocDate(v, template?.dateOrder) && (!due || v !== due.value),
        labelOf("invoiceDate"),
    )
    if (dateHit) fields.invoiceDate = field(toIsoDate(parseDocDate(dateHit.value, template?.dateOrder)!), 0.95, dateHit.cell, dateHit.label)

    const po = findLabelled(lines, FIELD_LABELS.poRef!, (v) => /\d/.test(v) && v.length <= 40, labelOf("poRef"))
    if (po) fields.poRef = field(po.value, 0.9, po.cell, po.label)

    const terms = findLabelled(lines, FIELD_LABELS.paymentTerms!, (v) => v.length >= 2 && v.length <= 120, labelOf("paymentTerms"))
    if (terms) fields.paymentTerms = field(terms.value, 0.9, terms.cell, terms.label)

    // Supplier block: everything above the bill-to label (or the top third of page 1).
    const billToIdx = lines.findIndex((l) => l.cells.some((c) => BILL_TO.test(c.text)))
    const billToLine = billToIdx >= 0 ? lines[billToIdx] : null
    const billToCellX = billToLine?.cells.find((c) => BILL_TO.test(c.text))?.x ?? null
    const inBillTo = (line: Line, cell: Cell) =>
        !!billToLine &&
        line.page === billToLine.page &&
        line.y >= billToLine.y - 1 &&
        line.y <= billToLine.y + billToLine.h * 5 &&
        billToCellX !== null &&
        Math.abs(cell.x - billToCellX) < 60
    const firstPage = lines.filter((l) => l.page === lines[0].page)
    const pageTop = firstPage[0].y
    const pageBottom = firstPage[firstPage.length - 1].y
    const topZone = pageTop + (pageBottom - pageTop) * 0.35

    const candidates: { cell: Cell; score: number }[] = []
    const maxH = Math.max(...firstPage.map((l) => l.h))
    for (const line of firstPage) {
        if (line.y > topZone) break
        for (const cell of line.cells) {
            if (inBillTo(line, cell) || TITLE_WORDS.test(cell.text.trim()) || BILL_TO.test(cell.text)) continue
            if (cell.text.length < 3 || /^\d/.test(cell.text) || /[:：]/.test(cell.text)) continue
            let score = 0
            if (COMPANY_SUFFIX.test(cell.text)) score += 2
            if (cell.h >= maxH * 0.9) score += 1.5
            score += 1 - (line.y - pageTop) / Math.max(1, topZone - pageTop)
            if (/^[A-Z0-9 .,&()-]+$/.test(cell.text) && /[A-Z]{3}/.test(cell.text)) score += 0.3
            candidates.push({ cell, score })
        }
    }
    candidates.sort((a, b) => b.score - a.score)
    if (candidates[0] && candidates[0].score >= 1.5) {
        fields.supplierName = field(candidates[0].cell.text, Math.min(0.95, 0.5 + candidates[0].score / 8), candidates[0].cell)
    }

    for (const line of lines) {
        for (const cell of line.cells) {
            if (inBillTo(line, cell)) continue
            if (!fields.supplierNpwp) {
                const m = cell.text.match(NPWP_RE)
                if (m && (/npwp/i.test(cell.text) || /npwp/i.test(line.text))) {
                    fields.supplierNpwp = field(m[1].replace(/\s/g, ""), 0.95, cell)
                }
            }
            if (!fields.supplierEmail) {
                const m = cell.text.match(EMAIL_RE)
                if (m) fields.supplierEmail = field(m[0].toLowerCase(), 0.9, cell)
            }
        }
    }

    // Item table.
    const header = findHeader(lines, template)
    let parsedLines: ParsedLine[] = []
    let tableEnd = 0
    if (header) {
        const { rows, endIndex } = readTable(lines, header, locale)
        parsedLines = rows.map((r) => toParsedLine(r, locale))
        tableEnd = endIndex
    }
    if (!parsedLines.length) {
        const firstStop = lines.findIndex((l) => STOP_WORDS.test(l.cells[0]?.text ?? "") || l.cells.some((c, i) => i > 0 && /^(sub ?total|total|ppn|grand total)\b/i.test(c.text)))
        const stopAt = firstStop === -1 ? lines.length : firstStop
        parsedLines = readHeaderless(lines, locale, stopAt)
        if (parsedLines.length) tableEnd = stopAt
    }

    // Totals: read below the table (or anywhere if there is no table).
    const totalsZone = lines.slice(header ? tableEnd : 0)
    const lastNumber = (line: Line, from: number) => {
        for (let i = line.cells.length - 1; i >= from; i--) {
            const text = line.cells[i].text
            const label = text.match(/^[^\d(]*[:：]\s*(.+)$/)
            const v = parseAmount(label ? label[1] : text, locale)
            if (v !== null && !/%\s*$/.test(text.trim())) return { value: v, cell: line.cells[i] }
        }
        return null
    }
    const found: Partial<Record<"subtotal" | "tax" | "total", { value: number; cell: Cell; label: string; rate?: number }>> = {}
    for (const line of totalsZone) {
        for (let ci = 0; ci < line.cells.length; ci++) {
            const norm = normaliseLabel(line.cells[ci].text)
            if (!norm) continue
            for (const group of TOTAL_LABELS) {
                const phrase = group.phrases.find((p) => norm === p || norm.startsWith(p + " ") || norm.startsWith(p))
                if (!phrase) continue
                if (group.key === "total" && /^(sub ?total|jumlah sebelum)/.test(norm)) continue
                if (group.key === "tax" && /terbilang|say/.test(norm)) continue
                const hit = lastNumber(line, ci)
                if (!hit) continue
                const prev = found[group.key]
                const rateMatch = group.key === "tax" ? line.cells[ci].text.match(TAX_RATE_RE) : null
                // For "total", keep the largest labelled amount (grand total beats a stray "Jumlah").
                if (!prev || (group.key === "total" && hit.value > prev.value)) {
                    found[group.key] = {
                        value: hit.value,
                        cell: hit.cell,
                        label: phrase,
                        rate: rateMatch ? parseAmount(rateMatch[1], locale) ?? undefined : undefined,
                    }
                }
                break
            }
        }
    }

    const sumLines = parsedLines.reduce((s, l) => s + (l.amount ?? 0), 0)
    const round2 = (n: number) => Math.round(n * 100) / 100
    if (found.subtotal) fields.subtotal = field(found.subtotal.value, 0.95, found.subtotal.cell, found.subtotal.label)
    else if (parsedLines.length) fields.subtotal = field(round2(sumLines), 0.6)
    if (found.tax) {
        fields.tax = field(found.tax.value, 0.95, found.tax.cell, found.tax.label)
        if (found.tax.rate) fields.taxRate = field(found.tax.rate, 0.95, found.tax.cell)
    }
    if (found.total) fields.total = field(found.total.value, 0.95, found.total.cell, found.total.label)
    else if (fields.subtotal) fields.total = field(round2(Number(fields.subtotal.value) + Number(fields.tax?.value ?? 0)), 0.6)

    // When "total" and "subtotal" are the same printed number and there is no tax, that is fine.
    const subtotal = fields.subtotal ? Number(fields.subtotal.value) : null
    const tax = fields.tax ? Number(fields.tax.value) : 0
    const total = fields.total ? Number(fields.total.value) : null
    const checks = {
        linesVsSubtotal: parsedLines.length && subtotal !== null ? round2(Math.abs(sumLines - subtotal)) : null,
        subtotalPlusTaxVsTotal: subtotal !== null && total !== null ? round2(Math.abs(subtotal + tax - total)) : null,
    }
    const tolerance = (n: number) => Math.max(1, n * 0.002)
    if (checks.linesVsSubtotal !== null && subtotal !== null && checks.linesVsSubtotal > tolerance(subtotal) && fields.subtotal) {
        fields.subtotal.confidence = Math.min(fields.subtotal.confidence, 0.5)
    }
    if (checks.subtotalPlusTaxVsTotal !== null && total !== null && checks.subtotalPlusTaxVsTotal > tolerance(total) && fields.total) {
        fields.total.confidence = Math.min(fields.total.confidence, 0.5)
    }

    // Overall confidence: key fields + lines + arithmetic.
    const keyFields: FieldKey[] = ["supplierName", "invoiceNo", "invoiceDate", "total"]
    const fieldScore = keyFields.reduce((s, k) => s + (fields[k]?.confidence ?? 0), 0) / keyFields.length
    const lineScore = parsedLines.length ? parsedLines.reduce((s, l) => s + l.confidence, 0) / parsedLines.length : 0
    const checkScore =
        checks.linesVsSubtotal !== null && checks.subtotalPlusTaxVsTotal !== null
            ? (checks.linesVsSubtotal <= tolerance(subtotal ?? 0) ? 0.5 : 0) + (checks.subtotalPlusTaxVsTotal <= tolerance(total ?? 0) ? 0.5 : 0)
            : 0.3
    const confidence = Math.round((fieldScore * 0.4 + lineScore * 0.4 + checkScore * 0.2) * 100) / 100

    return {
        fields,
        lines: parsedLines,
        numberLocale: locale,
        checks,
        confidence,
        headerCells: header ? header.columns.map((c) => ({ text: c.text, column: c.key })) : [],
        method: opts.method ?? "TEXT",
        pages,
    }
}
