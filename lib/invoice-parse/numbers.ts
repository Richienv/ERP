import type { CurrencyCode, DateOrder, NumberLocale } from "./types"

/**
 * Number, date and currency readers for supplier invoices.
 * Handles both `1.234.567,00` (Indonesian) and `1,234,567.00` (English/Chinese) styles.
 */

const CURRENCY_TOKENS = /(US\$|USD|IDR|RMB|CNY|Rp\.?|\$|¥|￥|元|人民币)/gi
const UNIT_TOKENS = /\b(PCS|PC|PCE|SET|SETS|UNIT|UNITS|BOX|KG|EA|LOT|ROLL|BTL|LTR|PAIR|PRS|BH|BUAH)\b\.?/gi

/** Strip currency and unit words. Returns null when anything but a number is left. */
function numericCore(raw: string): string | null {
    if (!raw) return null
    let s = raw.replace(CURRENCY_TOKENS, " ").replace(UNIT_TOKENS, " ").replace(/[%:]/g, " ").trim()
    let negative = false
    if (/^\(.*\)$/.test(s)) {
        negative = true
        s = s.slice(1, -1).trim()
    }
    if (s.startsWith("-")) {
        negative = true
        s = s.slice(1).trim()
    }
    s = s.replace(/\s+/g, "")
    s = s.replace(/-+$/, "") // "-Rp 100,000-" (Excel accounting format)
    if (/^\(.*\)$/.test(s)) s = s.slice(1, -1)
    if (!/^\d[\d.,]*$/.test(s)) return null
    if (/[.,]$/.test(s)) s = s.slice(0, -1)
    return (negative ? "-" : "") + s
}

type Vote = { locale: NumberLocale; strength: number }

function voteFor(core: string): Vote | null {
    const digits = core.replace(/^-/, "")
    const dots = (digits.match(/\./g) || []).length
    const commas = (digits.match(/,/g) || []).length
    if (dots && commas) {
        return { locale: digits.lastIndexOf(",") > digits.lastIndexOf(".") ? "id" : "en", strength: 2 }
    }
    if (dots > 1) return { locale: "id", strength: 2 }
    if (commas > 1) return { locale: "en", strength: 2 }
    if (dots === 1) {
        const after = digits.split(".")[1]
        // "180.00" is a decimal (money has 2 decimals) → English. "85.000" is thousands → Indonesian, weakly.
        return after.length === 3 ? { locale: "id", strength: 1 } : { locale: "en", strength: 2 }
    }
    if (commas === 1) {
        const after = digits.split(",")[1]
        return after.length === 3 ? { locale: "en", strength: 1 } : { locale: "id", strength: 2 }
    }
    return null
}

/** Decide how a document writes numbers, from the numeric strings found in it. */
export function detectNumberLocale(samples: string[], currency?: string | null): NumberLocale {
    // Strong votes ("2.040.000", "180.00") decide. Weak ones ("1.500") only count when the
    // currency gives no hint, because "1.500" is 1500 in Rupiah and 1.5 in Yuan.
    const strong = { id: 0, en: 0 }
    const weak = { id: 0, en: 0 }
    for (const sample of samples) {
        const core = numericCore(sample)
        if (!core) continue
        const vote = voteFor(core)
        if (!vote) continue
        const bucket = vote.strength >= 2 ? strong : weak
        bucket[vote.locale] += 1
    }
    if (strong.id !== strong.en) return strong.id > strong.en ? "id" : "en"
    if (currency === "IDR") return "id"
    if (currency) return "en"
    if (weak.id !== weak.en) return weak.id > weak.en ? "id" : "en"
    return "en"
}

/** Parse one printed amount. Unambiguous formats win over the document locale. */
export function parseAmount(raw: string, locale: NumberLocale): number | null {
    const core = numericCore(raw)
    if (core == null) return null
    const negative = core.startsWith("-")
    const digits = negative ? core.slice(1) : core
    const dots = (digits.match(/\./g) || []).length
    const commas = (digits.match(/,/g) || []).length

    let decimalSep: "." | "," | null
    if (dots && commas) decimalSep = digits.lastIndexOf(",") > digits.lastIndexOf(".") ? "," : "."
    else if (dots > 1) decimalSep = null
    else if (commas > 1) decimalSep = null
    else if (dots === 1) {
        const after = digits.split(".")[1]
        decimalSep = after.length === 3 && locale === "id" ? null : "."
    } else if (commas === 1) {
        const after = digits.split(",")[1]
        decimalSep = after.length === 3 && locale === "en" ? null : ","
    } else decimalSep = null

    let normalised: string
    if (decimalSep === ".") normalised = digits.replace(/,/g, "")
    else if (decimalSep === ",") normalised = digits.replace(/\./g, "").replace(",", ".")
    else normalised = digits.replace(/[.,]/g, "")

    const value = Number(normalised)
    if (!Number.isFinite(value)) return null
    return negative ? -value : value
}

/** True when the string is (only) a number in some format. */
export function looksNumeric(raw: string): boolean {
    return numericCore(raw) != null
}

const MONTHS: Record<string, number> = {
    jan: 1, january: 1, januari: 1,
    feb: 2, february: 2, februari: 2, peb: 2,
    mar: 3, march: 3, maret: 3,
    apr: 4, april: 4,
    may: 5, mei: 5,
    jun: 6, june: 6, juni: 6,
    jul: 7, july: 7, juli: 7,
    aug: 8, august: 8, agu: 8, agt: 8, agustus: 8, ags: 8,
    sep: 9, sept: 9, september: 9,
    oct: 10, october: 10, okt: 10, oktober: 10,
    nov: 11, november: 11, nop: 11, nopember: 11,
    dec: 12, december: 12, des: 12, desember: 12,
}

function makeDate(y: number, m: number, d: number): Date | null {
    if (y < 100) y += 2000
    if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null
    const date = new Date(y, m - 1, d, 12, 0, 0)
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
    return date
}

/** Parse a printed invoice date. Default order for `a/b/yyyy` is day-first (Indonesia, China exports). */
export function parseDocDate(raw: string, order: DateOrder = "DMY"): Date | null {
    if (!raw) return null
    const s = raw.trim()

    let m = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?/)
    if (m) return makeDate(+m[1], +m[2], +m[3])

    m = s.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/)
    if (m) return makeDate(+m[1], +m[2], +m[3])

    m = s.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})\b/)
    if (m) {
        const a = +m[1]
        const b = +m[2]
        const y = +m[3]
        if (a > 12) return makeDate(y, b, a)
        if (b > 12) return makeDate(y, a, b)
        return order === "MDY" ? makeDate(y, a, b) : makeDate(y, b, a)
    }

    m = s.match(/\b(\d{1,2})(?:st|nd|rd|th)?[\s-]+([A-Za-z]{3,9})\.?,?[\s-]+(\d{2,4})\b/)
    if (m && MONTHS[m[2].toLowerCase()]) return makeDate(+m[3], MONTHS[m[2].toLowerCase()], +m[1])

    m = s.match(/\b([A-Za-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})\b/)
    if (m && MONTHS[m[1].toLowerCase()]) return makeDate(+m[3], MONTHS[m[1].toLowerCase()], +m[2])

    return null
}

/** `YYYY-MM-DD` in local time — the wire format between the review screen and the server. */
export function toIsoDate(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, "0")
    const d = String(date.getDate()).padStart(2, "0")
    return `${y}-${m}-${d}`
}

/** The currency an invoice is written in, by the most frequent marker. */
export function detectCurrency(text: string): CurrencyCode | null {
    const counts: Record<CurrencyCode, number> = { IDR: 0, CNY: 0, USD: 0 }
    counts.CNY += (text.match(/\b(RMB|CNY)\b|¥|￥|人民币/g) || []).length
    counts.IDR += (text.match(/\bIDR\b|\bRp\.?(?=\s?\d)|\bRp\b|rupiah/gi) || []).length
    counts.USD += (text.match(/\bUSD\b|US\$/g) || []).length
    if (!counts.USD && /\$\s?\d/.test(text)) counts.USD += 1
    const best = (Object.entries(counts) as [CurrencyCode, number][]).sort((a, b) => b[1] - a[1])[0]
    return best[1] > 0 ? best[0] : null
}
