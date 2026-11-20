/**
 * Pure rules for spare-part purchases (no DB, no React): currency conversion, status at a glance,
 * the one next action, and the search text. Shared by the server actions and the UI so both
 * always agree.
 */

export type CurrencyCode = "IDR" | "CNY" | "USD"

export type SaveLineInput = {
    productId?: string | null
    newProduct?: { code: string; name: string; unit: string } | null
    partNo?: string | null
    description: string
    qty: number
    unit?: string | null
    /** As printed, in the invoice currency, before discount. */
    unitPriceOriginal: number
    discountPct?: number | null
}

export type IdrLine = {
    qty: number
    /** Net of discount, converted to IDR, rounded to 2 decimals. */
    unitPriceIdr: number
    /** unitPriceIdr × qty — the same number the GRN will post, so GR/IR clears exactly. */
    totalIdr: number
    /** Net of discount, in the invoice currency. */
    amountOriginal: number
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function netUnitPrice(unitPrice: number, discountPct?: number | null): number {
    return unitPrice * (1 - (discountPct || 0) / 100)
}

/** Convert invoice lines to IDR. The PO and bill are always IDR; the capture keeps the original. */
export function toIdrLines(lines: Pick<SaveLineInput, "qty" | "unitPriceOriginal" | "discountPct">[], rate: number) {
    if (!(rate > 0)) throw new Error("Kurs harus lebih dari 0")
    const out: IdrLine[] = lines.map((l) => {
        const netOriginal = netUnitPrice(l.unitPriceOriginal, l.discountPct)
        const unitPriceIdr = round2(netOriginal * rate)
        return {
            qty: l.qty,
            unitPriceIdr,
            totalIdr: round2(unitPriceIdr * l.qty),
            amountOriginal: round2(netOriginal * l.qty),
        }
    })
    const subtotalIdr = round2(out.reduce((s, l) => s + l.totalIdr, 0))
    const subtotalOriginal = round2(out.reduce((s, l) => s + l.amountOriginal, 0))
    return { lines: out, subtotalIdr, subtotalOriginal }
}

export function validateSaveLines(lines: SaveLineInput[]): string | null {
    if (lines.length === 0) return "Minimal satu barang"
    for (const [i, l] of lines.entries()) {
        const n = i + 1
        if (!l.description?.trim()) return `Baris ${n}: nama barang kosong`
        if (!Number.isFinite(l.qty) || l.qty <= 0) return `Baris ${n}: qty harus lebih dari 0`
        if (!Number.isInteger(l.qty)) return `Baris ${n}: qty barang stok harus bilangan bulat`
        if (!Number.isFinite(l.unitPriceOriginal) || l.unitPriceOriginal < 0) return `Baris ${n}: harga tidak valid`
        if (l.discountPct != null && (l.discountPct < 0 || l.discountPct >= 100)) return `Baris ${n}: diskon tidak valid`
        if (!l.productId && !l.newProduct) return `Baris ${n}: pilih produk atau buat produk baru`
    }
    return null
}

// ── Status at a glance ───────────────────────────────────────────────────────

export type PayStage = "UNPOSTED" | "UNPAID" | "PARTIAL" | "PAID" | "VOID"
export type GoodsStage = "ORDERED" | "SHIPPED" | "PARTIAL" | "RECEIVED" | "CANCELLED"
export type NextAction = "POST_BILL" | "PAY" | "SHIP" | "RECEIVE" | "NONE"

export type StatusInput = {
    poStatus: string
    billStatus: string | null
    billTotal: number
    balanceDue: number
    dueDate: Date | string | null
    ordered: number
    received: number
    shippedAt: Date | string | null
    currencyCode: string
}

export type PurchaseStatus = {
    payStage: PayStage
    goodsStage: GoodsStage
    paidPct: number
    receivedPct: number
    overdue: boolean
    dueSoon: boolean
    nextAction: NextAction
}

const DAY = 24 * 60 * 60 * 1000

export function derivePurchaseStatus(s: StatusInput, now: Date = new Date()): PurchaseStatus {
    const cancelled = s.poStatus === "CANCELLED" || s.poStatus === "REJECTED"
    const billVoid = !s.billStatus || s.billStatus === "CANCELLED" || s.billStatus === "VOID"

    let payStage: PayStage
    if (billVoid) payStage = "VOID"
    else if (s.billStatus === "DRAFT") payStage = "UNPOSTED"
    else if (s.balanceDue <= 0.005) payStage = "PAID"
    else if (s.balanceDue < s.billTotal - 0.005) payStage = "PARTIAL"
    else payStage = "UNPAID"

    const paidPct = billVoid || s.billTotal <= 0 ? 0 : Math.min(1, Math.max(0, (s.billTotal - s.balanceDue) / s.billTotal))
    const receivedPct = s.ordered > 0 ? Math.min(1, s.received / s.ordered) : 0

    let goodsStage: GoodsStage
    if (cancelled) goodsStage = "CANCELLED"
    else if (s.ordered > 0 && s.received >= s.ordered) goodsStage = "RECEIVED"
    else if (s.received > 0) goodsStage = "PARTIAL"
    else if (s.shippedAt) goodsStage = "SHIPPED"
    else goodsStage = "ORDERED"

    const due = s.dueDate ? new Date(s.dueDate) : null
    const open = payStage === "UNPAID" || payStage === "PARTIAL"
    const overdue = open && !!due && due.getTime() < now.getTime() - DAY / 2
    const dueSoon = open && !!due && !overdue && due.getTime() - now.getTime() <= 3 * DAY

    let nextAction: NextAction = "NONE"
    if (!cancelled) {
        const goodsOpen = goodsStage !== "RECEIVED"
        if (payStage === "UNPOSTED") nextAction = "POST_BILL"
        else if (open && (overdue || dueSoon)) nextAction = "PAY"
        else if (goodsOpen && goodsStage !== "ORDERED") nextAction = "RECEIVE"
        else if (goodsOpen) nextAction = s.currencyCode !== "IDR" ? "SHIP" : "RECEIVE"
        else if (open) nextAction = "PAY"
    }

    return { payStage, goodsStage, paidPct, receivedPct, overdue, dueSoon, nextAction }
}

export const NEXT_ACTION_LABEL: Record<NextAction, string> = {
    POST_BILL: "Posting tagihan",
    PAY: "Catat bayar",
    SHIP: "Tandai dikirim",
    RECEIVE: "Terima barang",
    NONE: "Selesai",
}

export const PAY_STAGE_LABEL: Record<PayStage, string> = {
    UNPOSTED: "Tagihan belum diposting",
    UNPAID: "Belum bayar",
    PARTIAL: "Dibayar sebagian",
    PAID: "Lunas",
    VOID: "Tagihan batal",
}

export const GOODS_STAGE_LABEL: Record<GoodsStage, string> = {
    ORDERED: "Dipesan",
    SHIPPED: "Dalam perjalanan",
    PARTIAL: "Datang sebagian",
    RECEIVED: "Lengkap",
    CANCELLED: "Batal",
}

/** PurchaseOrder.paymentStatus from the bill — nothing else in the ERP keeps it in sync. */
export function poPaymentStatus(billTotal: number, balanceDue: number): "UNPAID" | "PARTIAL" | "PAID" {
    if (balanceDue <= 0.005) return "PAID"
    if (balanceDue < billTotal - 0.005) return "PARTIAL"
    return "UNPAID"
}

/**
 * IDR to post for a payment entered in the invoice currency. Paying the whole remainder posts the
 * exact IDR balance, so rounding never leaves a few rupiah open.
 */
export function paymentIdr(input: { amountOriginal: number; rate: number; balanceDueIdr: number }): number {
    const idr = Math.round(input.amountOriginal * input.rate * 100) / 100
    const remainingOriginal = input.balanceDueIdr / input.rate
    if (Math.abs(input.amountOriginal - remainingOriginal) < 0.01 || idr > input.balanceDueIdr) return input.balanceDueIdr
    return idr
}

export function buildSearchText(parts: {
    poNumber: string
    supplierName: string
    supplierInvoiceNo: string
    billNumber?: string | null
    partCodes: (string | null | undefined)[]
    descriptions?: (string | null | undefined)[]
}): string {
    const words = [
        parts.poNumber,
        parts.supplierName,
        parts.supplierInvoiceNo,
        parts.billNumber,
        ...parts.partCodes,
        ...(parts.descriptions || []),
    ]
        .filter(Boolean)
        .map((s) => String(s).toLowerCase().trim())
    return Array.from(new Set(words)).join(" | ").slice(0, 4000)
}

/** Lower-case, trimmed, LIKE wildcards escaped. */
export function normaliseSearch(q?: string | null): string | null {
    const s = (q || "").trim().toLowerCase()
    if (!s) return null
    return s.replace(/[\\%_]/g, (c) => `\\${c}`)
}
