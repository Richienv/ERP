import { distance } from "fastest-levenshtein"
import { normaliseLabel } from "./layout"
import type { FieldKey, ParsedInvoice, ParsedLine, SupplierTemplate } from "./types"

/**
 * Matching parsed invoices to master data, and learning supplier templates.
 * Pure functions over a slim lookup that the page prefetches, so the review screen fills in
 * the supplier and products with no network round trip.
 */

export type LookupSupplier = {
    id: string
    code: string
    name: string
    npwp?: string | null
    email?: string | null
}

export type TemplateFingerprint = {
    npwp?: string | null
    emailDomain?: string | null
    printedName?: string | null
}

export type LookupTemplate = {
    supplierId: string
    fingerprint: TemplateFingerprint
    template: SupplierTemplate
    samples: number
}

export type LookupProduct = { id: string; code: string; name: string; unit: string }
export type LookupSku = { supplierId: string; productId: string; skuCode: string }

export type SupplierMatch = {
    supplierId: string
    via: "npwp" | "email" | "template" | "name"
    confidence: number
}

const FREE_MAIL = new Set(["gmail.com", "yahoo.com", "yahoo.co.id", "hotmail.com", "outlook.com", "qq.com", "163.com", "126.com", "foxmail.com", "icloud.com"])

export const digitsOnly = (s?: string | null) => (s || "").replace(/\D/g, "")

export function emailDomain(email?: string | null): string | null {
    const m = (email || "").toLowerCase().match(/@([a-z0-9.-]+\.[a-z]{2,})$/)
    return m ? m[1] : null
}

/** Company name without legal form, city prefixes kept. "GUANGZHOU RUIXIANG AUTO PARTS CO., LTD." → "guangzhou ruixiang auto parts". */
export function normaliseCompany(name?: string | null): string {
    return normaliseLabel(name || "")
        .replace(/[,()]/g, " ")
        .replace(/\b(co|ltd|limited|company|inc|corp|pt|cv|ud|tbk|toko|trading)\b/g, " ")
        .replace(/有限公司|公司/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function nameSimilarity(a: string, b: string): number {
    if (!a || !b) return 0
    if (a === b) return 1
    if ((a.length >= 6 && b.includes(a)) || (b.length >= 6 && a.includes(b))) return 0.9
    return 1 - distance(a, b) / Math.max(a.length, b.length)
}

export function matchSupplier(
    parsed: Pick<ParsedInvoice, "fields">,
    suppliers: LookupSupplier[],
    templates: LookupTemplate[] = [],
): SupplierMatch | null {
    const npwp = digitsOnly(parsed.fields.supplierNpwp?.value as string)
    if (npwp.length >= 15) {
        const hit = suppliers.find((s) => digitsOnly(s.npwp) === npwp)
        if (hit) return { supplierId: hit.id, via: "npwp", confidence: 0.99 }
        const t = templates.find((t) => digitsOnly(t.fingerprint.npwp) === npwp)
        if (t) return { supplierId: t.supplierId, via: "template", confidence: 0.98 }
    }

    const email = (parsed.fields.supplierEmail?.value as string) || ""
    const domain = emailDomain(email)
    if (domain) {
        const hit = FREE_MAIL.has(domain)
            ? suppliers.find((s) => (s.email || "").toLowerCase() === email.toLowerCase())
            : suppliers.find((s) => emailDomain(s.email) === domain)
        if (hit) return { supplierId: hit.id, via: "email", confidence: 0.95 }
        if (!FREE_MAIL.has(domain)) {
            const t = templates.find((t) => t.fingerprint.emailDomain === domain)
            if (t) return { supplierId: t.supplierId, via: "template", confidence: 0.95 }
        }
    }

    const printed = normaliseCompany(parsed.fields.supplierName?.value as string)
    if (!printed) return null
    let best: SupplierMatch | null = null
    for (const t of templates) {
        const score = nameSimilarity(printed, normaliseCompany(t.fingerprint.printedName))
        if (score >= 0.85 && (!best || score > best.confidence)) best = { supplierId: t.supplierId, via: "template", confidence: score }
    }
    for (const s of suppliers) {
        const score = nameSimilarity(printed, normaliseCompany(s.name))
        if (score >= 0.82 && (!best || score > best.confidence)) best = { supplierId: s.id, via: "name", confidence: Math.min(score, 0.92) }
    }
    return best
}

/** Upper-case, no spaces/dashes/dots: "MN-171 419" and "mn171419" are the same part. */
export function normalisePartCode(code?: string | null): string {
    return (code || "").toUpperCase().replace(/[\s.\-_]/g, "")
}

export type LineMatch = { productId: string | null; via: "sku" | "code" | null }

export function matchLines(
    lines: Pick<ParsedLine, "partNo">[],
    supplierId: string | null,
    products: LookupProduct[],
    skus: LookupSku[],
): LineMatch[] {
    const byCode = new Map<string, string>()
    for (const p of products) byCode.set(normalisePartCode(p.code), p.id)
    const bySku = new Map<string, string>()
    if (supplierId) {
        for (const s of skus) if (s.supplierId === supplierId && s.skuCode) bySku.set(normalisePartCode(s.skuCode), s.productId)
    }
    return lines.map((line) => {
        const code = normalisePartCode(line.partNo)
        if (!code) return { productId: null, via: null }
        const sku = bySku.get(code)
        if (sku) return { productId: sku, via: "sku" }
        const product = byCode.get(code)
        if (product) return { productId: product, via: "code" }
        return { productId: null, via: null }
    })
}

/** Merge what this confirmed invoice taught us into the supplier's template. */
export function learnTemplate(
    prev: SupplierTemplate | null | undefined,
    parsed: Pick<ParsedInvoice, "headerCells" | "fields" | "numberLocale">,
    confirmed: { currencyCode?: string | null },
): SupplierTemplate {
    const columnMap = { ...(prev?.columnMap || {}) }
    for (const cell of parsed.headerCells) {
        const key = normaliseLabel(cell.text)
        if (key && cell.column) columnMap[key] = cell.column
    }
    const labelMap = { ...(prev?.labelMap || {}) }
    for (const [key, f] of Object.entries(parsed.fields) as [FieldKey, { label?: string }][]) {
        if (f?.label) labelMap[key] = f.label
    }
    const currency = confirmed.currencyCode || prev?.currencyCode
    return {
        columnMap,
        labelMap,
        numberLocale: parsed.numberLocale,
        dateOrder: prev?.dateOrder ?? "DMY",
        currencyCode: currency === "IDR" || currency === "CNY" || currency === "USD" ? currency : undefined,
    }
}

export function fingerprintOf(parsed: Pick<ParsedInvoice, "fields">): TemplateFingerprint {
    return {
        npwp: digitsOnly(parsed.fields.supplierNpwp?.value as string) || null,
        emailDomain: emailDomain(parsed.fields.supplierEmail?.value as string),
        printedName: (parsed.fields.supplierName?.value as string) || null,
    }
}
