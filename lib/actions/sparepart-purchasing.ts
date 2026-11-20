"use server"

/**
 * Spare-part purchasing — the fast lane from a supplier's invoice to PO + bill + receipt + payment.
 *
 * This file only COMPOSES the canonical actions; it posts no journal of its own:
 *   bill posting  → moveInvoiceToSent      (DR GR/IR [+ PPN Masukan] / CR Hutang Usaha)
 *   payment       → recordVendorPayment    (DR Hutang Usaha / CR Bank)
 *   receipt       → createGRN + acceptGRN  (DR Persediaan / CR GR/IR)
 *   shipping      → markAsShipped          (status + event)
 * The bill gets glAccountCode = GR_IR_CLEARING so posting it before the goods arrive still debits
 * GR/IR (not Beban), and GR/IR nets to zero once everything is billed and received.
 *
 * The PO and bill are stored in IDR at the invoice's rate; SupplierInvoiceCapture keeps the
 * invoice as printed (RMB/USD amounts, rate, file, parse result).
 */

import { Prisma } from "@prisma/client"
import { prisma, withPrismaAuth } from "@/lib/db"
import { assertRole, FINANCE_POSTING_ROLES, getAuthzUser } from "@/lib/authz"
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts-server"
import { getNextDocNumber } from "@/lib/document-numbering"
import { moveInvoiceToSent } from "@/lib/actions/finance-invoices"
import { recordVendorPayment } from "@/lib/actions/finance-ap"
import { markAsShipped } from "@/lib/actions/procurement"
import { acceptGRN, createGRN } from "@/lib/actions/grn"
import {
    buildSearchText,
    derivePurchaseStatus,
    normaliseSearch,
    paymentIdr,
    poPaymentStatus,
    toIdrLines,
    validateSaveLines,
    type CurrencyCode,
    type SaveLineInput,
} from "@/lib/sparepart-purchase-logic"

/** Same list as procurement.ts PURCHASING_ROLES (not exported there). */
const PURCHASING_ROLES = ["ROLE_PURCHASING", "ROLE_ADMIN", "ROLE_CEO", "ROLE_DIRECTOR"]
const RECEIVING_ROLES = ["ROLE_ADMIN", "ROLE_CEO", "ROLE_DIRECTOR", "ROLE_MANAGER", "ROLE_PURCHASING"]
const LINE = "SPAREPART"
const CURRENCIES: CurrencyCode[] = ["IDR", "CNY", "USD"]

type Authz = Awaited<ReturnType<typeof getAuthzUser>>

function hasRole(user: Authz, roles: readonly string[]): boolean {
    try {
        assertRole(user, [...roles])
        return true
    } catch {
        return false
    }
}

const num = (v: unknown) => (v == null ? 0 : Number(v))
const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e || "Terjadi kesalahan"))

function parseIsoDate(s: string | null | undefined): Date | null {
    if (!s) return null
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (!m) return null
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 5, 0, 0)) // 12:00 WIB — never shifts a day
    return Number.isNaN(d.getTime()) ? null : d
}

// ─────────────────────────────────────────────────────────────────────────────
// Lookup (prefetched by the page; matching runs in the browser)
// ─────────────────────────────────────────────────────────────────────────────

export async function getSparepartLookup() {
    const user = await getAuthzUser()
    const [suppliers, templates, products, skus, warehouses, rates] = await Promise.all([
        prisma.supplier.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true, npwp: true, email: true },
            orderBy: { name: "asc" },
        }),
        prisma.supplierInvoiceTemplate.findMany({
            select: { supplierId: true, fingerprint: true, template: true, samples: true, lastRate: true },
        }),
        prisma.product.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true, unit: true },
            orderBy: { code: "asc" },
            take: 20000,
        }),
        prisma.supplierProduct.findMany({
            where: { skuCode: { not: null } },
            select: { supplierId: true, productId: true, skuCode: true },
        }),
        prisma.warehouse.findMany({
            where: { isActive: true },
            select: { id: true, code: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.exchangeRate.findMany({
            where: { currency: { code: { in: ["CNY", "USD"] } } },
            select: { middleRate: true, date: true, currency: { select: { code: true } } },
            orderBy: { date: "desc" },
            take: 20,
        }),
    ])
    const latestRate: Record<string, { rate: number; date: string }> = {}
    for (const r of rates) {
        if (!latestRate[r.currency.code]) latestRate[r.currency.code] = { rate: num(r.middleRate), date: r.date.toISOString().slice(0, 10) }
    }
    return {
        suppliers,
        templates: templates.map((t) => ({
            supplierId: t.supplierId,
            fingerprint: t.fingerprint as Record<string, string | null>,
            template: t.template as Record<string, unknown>,
            samples: t.samples,
            lastRate: t.lastRate == null ? null : num(t.lastRate),
        })),
        products,
        skus: skus.map((s) => ({ supplierId: s.supplierId, productId: s.productId, skuCode: s.skuCode as string })),
        warehouses,
        latestRate,
        canPost: hasRole(user, FINANCE_POSTING_ROLES),
        canPurchase: hasRole(user, PURCHASING_ROLES),
        canReceive: hasRole(user, RECEIVING_ROLES),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// List — one SQL statement, keyset pagination, live paid/received from the source tables
// ─────────────────────────────────────────────────────────────────────────────

export type SparepartFilter = "all" | "unpaid" | "transit" | "incoming" | "done"

type RawRow = {
    id: string
    supplierInvoiceNo: string
    invoiceDate: Date
    dueDate: Date | null
    currencyCode: string
    exchangeRate: number
    totalOriginal: number
    shippedAt: Date | null
    trackingNumber: string | null
    eta: Date | null
    createdAt: Date
    parseMethod: string
    poId: string
    poNumber: string
    poStatus: string
    supplierId: string
    supplierName: string
    billId: string | null
    billNumber: string | null
    billStatus: string | null
    billTotal: number | null
    balanceDue: number | null
    billDueDate: Date | null
    ordered: number
    received: number
    lineCount: number
}

const FROM_SQL = Prisma.sql`
    FROM supplier_invoice_captures c
    JOIN purchase_orders po ON po.id = c."purchaseOrderId"
    JOIN suppliers s ON s.id = c."supplierId"
    LEFT JOIN invoices b ON b.id = c."billId"
    LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(i.quantity), 0)::int AS ordered,
               COALESCE(SUM(i."receivedQty"), 0)::int AS received,
               COUNT(*)::int AS "lineCount"
        FROM purchase_order_items i
        WHERE i."purchaseOrderId" = po.id
    ) it ON true`

function filterSql(filter: SparepartFilter): Prisma.Sql {
    switch (filter) {
        case "unpaid":
            return Prisma.sql`AND b."balanceDue" > 0.005 AND b.status NOT IN ('CANCELLED','VOID')`
        case "transit":
            return Prisma.sql`AND c."shippedAt" IS NOT NULL AND it.received < it.ordered AND po.status NOT IN ('CANCELLED','REJECTED')`
        case "incoming":
            return Prisma.sql`AND it.received < it.ordered AND po.status NOT IN ('CANCELLED','REJECTED')`
        case "done":
            return Prisma.sql`AND COALESCE(b."balanceDue", 0) <= 0.005 AND it.received >= it.ordered`
        default:
            return Prisma.empty
    }
}

function toListRow(r: RawRow) {
    const status = derivePurchaseStatus({
        poStatus: r.poStatus,
        billStatus: r.billStatus,
        billTotal: num(r.billTotal),
        balanceDue: num(r.balanceDue),
        dueDate: r.billDueDate ?? r.dueDate,
        ordered: r.ordered,
        received: r.received,
        shippedAt: r.shippedAt,
        currencyCode: r.currencyCode,
    })
    return {
        id: r.id,
        supplierInvoiceNo: r.supplierInvoiceNo,
        invoiceDate: r.invoiceDate.toISOString(),
        dueDate: (r.billDueDate ?? r.dueDate)?.toISOString() ?? null,
        currencyCode: r.currencyCode,
        exchangeRate: num(r.exchangeRate),
        totalOriginal: num(r.totalOriginal),
        shippedAt: r.shippedAt?.toISOString() ?? null,
        trackingNumber: r.trackingNumber,
        eta: r.eta?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
        parseMethod: r.parseMethod,
        poId: r.poId,
        poNumber: r.poNumber,
        poStatus: r.poStatus,
        supplierId: r.supplierId,
        supplierName: r.supplierName,
        billId: r.billId,
        billNumber: r.billNumber,
        billStatus: r.billStatus,
        billTotal: num(r.billTotal),
        balanceDue: num(r.balanceDue),
        ordered: r.ordered,
        received: r.received,
        lineCount: r.lineCount,
        ...status,
    }
}

export type SparepartRow = ReturnType<typeof toListRow>

export async function listSparepartPurchases(params: { cursor?: string | null; q?: string | null; filter?: SparepartFilter; limit?: number } = {}) {
    await getAuthzUser()
    const t0 = performance.now()
    const limit = Math.min(Math.max(params.limit ?? 30, 1), 100)
    const filter = params.filter ?? "all"
    const q = normaliseSearch(params.q)

    let cursorSql = Prisma.empty
    if (params.cursor) {
        const [iso, id] = params.cursor.split("|")
        const at = new Date(iso)
        if (id && !Number.isNaN(at.getTime())) cursorSql = Prisma.sql`AND (c."createdAt", c.id) < (${at}, ${id}::uuid)`
    }
    const searchSql = q ? Prisma.sql`AND c."searchText" LIKE ${"%" + q + "%"}` : Prisma.empty

    const rowsPromise = prisma.$queryRaw<RawRow[]>`
        SELECT c.id, c."supplierInvoiceNo", c."invoiceDate", c."dueDate", c."currencyCode",
               c."exchangeRate"::float8 AS "exchangeRate", c."totalOriginal"::float8 AS "totalOriginal",
               c."shippedAt", c."trackingNumber", c.eta, c."createdAt", c."parseMethod",
               po.id AS "poId", po.number AS "poNumber", po.status::text AS "poStatus",
               s.id AS "supplierId", s.name AS "supplierName",
               b.id AS "billId", b.number AS "billNumber", b.status::text AS "billStatus",
               b."totalAmount"::float8 AS "billTotal", b."balanceDue"::float8 AS "balanceDue", b."dueDate" AS "billDueDate",
               it.ordered, it.received, it."lineCount"
        ${FROM_SQL}
        WHERE c.line = ${LINE} ${cursorSql} ${searchSql} ${filterSql(filter)}
        ORDER BY c."createdAt" DESC, c.id DESC
        LIMIT ${limit + 1}`

    // KPI strip only with the first page (it ignores the filter, so the chips always show totals).
    // One grouped aggregate over the line's PO items instead of a per-row LATERAL: 9 ms vs 15 ms
    // at 5,000 purchases (docs/plans/2026-11-20-sparepart-purchasing-design.md, "What shipped").
    const kpiPromise = params.cursor
        ? Promise.resolve(null)
        : prisma.$queryRaw<{ total: number; unpaid: number; unpaidAmount: number; transit: number; incoming: number; done: number }[]>`
            WITH it AS (
                SELECT i."purchaseOrderId", COALESCE(SUM(i.quantity), 0)::int AS ordered, COALESCE(SUM(i."receivedQty"), 0)::int AS received
                FROM purchase_order_items i
                JOIN supplier_invoice_captures c2 ON c2."purchaseOrderId" = i."purchaseOrderId" AND c2.line = ${LINE}
                GROUP BY 1
            )
            SELECT COUNT(*)::int AS total,
                   COUNT(*) FILTER (WHERE b."balanceDue" > 0.005 AND b.status NOT IN ('CANCELLED','VOID'))::int AS unpaid,
                   COALESCE(SUM(b."balanceDue") FILTER (WHERE b."balanceDue" > 0.005 AND b.status NOT IN ('CANCELLED','VOID')), 0)::float8 AS "unpaidAmount",
                   COUNT(*) FILTER (WHERE c."shippedAt" IS NOT NULL AND it.received < it.ordered AND po.status NOT IN ('CANCELLED','REJECTED'))::int AS transit,
                   COUNT(*) FILTER (WHERE it.received < it.ordered AND po.status NOT IN ('CANCELLED','REJECTED'))::int AS incoming,
                   COUNT(*) FILTER (WHERE COALESCE(b."balanceDue", 0) <= 0.005 AND it.received >= it.ordered)::int AS done
            FROM supplier_invoice_captures c
            JOIN purchase_orders po ON po.id = c."purchaseOrderId"
            LEFT JOIN invoices b ON b.id = c."billId"
            LEFT JOIN it ON it."purchaseOrderId" = c."purchaseOrderId"
            WHERE c.line = ${LINE} ${searchSql}`

    const [raw, kpi] = await Promise.all([rowsPromise, kpiPromise])
    const hasMore = raw.length > limit
    const rows = raw.slice(0, limit).map(toListRow)
    const last = rows[rows.length - 1]
    return {
        rows,
        nextCursor: hasMore && last ? `${last.createdAt}|${last.id}` : null,
        kpi: kpi ? kpi[0] : null,
        serverMs: Math.round(performance.now() - t0),
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail
// ─────────────────────────────────────────────────────────────────────────────

export async function getSparepartPurchase(id: string) {
    await getAuthzUser()
    const c = await prisma.supplierInvoiceCapture.findUnique({
        where: { id },
        include: {
            supplier: { select: { id: true, name: true, code: true, npwp: true, email: true } },
            purchaseOrder: {
                select: {
                    id: true,
                    number: true,
                    status: true,
                    taxMode: true,
                    expectedDate: true,
                    items: {
                        select: {
                            id: true,
                            quantity: true,
                            receivedQty: true,
                            unitPrice: true,
                            totalPrice: true,
                            product: { select: { id: true, code: true, name: true, unit: true } },
                        },
                        orderBy: { createdAt: "asc" },
                    },
                    events: { select: { id: true, action: true, status: true, notes: true, metadata: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 30 },
                    goodsReceivedNotes: {
                        select: {
                            id: true,
                            number: true,
                            status: true,
                            receivedDate: true,
                            warehouse: { select: { name: true } },
                            items: { select: { quantityAccepted: true, poItemId: true } },
                        },
                        orderBy: { receivedDate: "desc" },
                    },
                },
            },
            bill: {
                select: {
                    id: true,
                    number: true,
                    status: true,
                    subtotal: true,
                    taxAmount: true,
                    totalAmount: true,
                    balanceDue: true,
                    dueDate: true,
                    payments: { select: { id: true, number: true, date: true, amount: true, method: true, reference: true }, orderBy: { date: "desc" } },
                },
            },
        },
    })
    if (!c) return null
    const po = c.purchaseOrder
    const parsedLines = ((c.parsed as { lines?: { partNo?: string | null; unitPriceOriginal?: number; discountPct?: number | null }[] } | null)?.lines) || []
    const ordered = po.items.reduce((s, i) => s + i.quantity, 0)
    const received = po.items.reduce((s, i) => s + i.receivedQty, 0)
    const status = derivePurchaseStatus({
        poStatus: po.status,
        billStatus: c.bill?.status ?? null,
        billTotal: num(c.bill?.totalAmount),
        balanceDue: num(c.bill?.balanceDue),
        dueDate: c.bill?.dueDate ?? c.dueDate,
        ordered,
        received,
        shippedAt: c.shippedAt,
        currencyCode: c.currencyCode,
    })
    return {
        id: c.id,
        supplierInvoiceNo: c.supplierInvoiceNo,
        invoiceDate: c.invoiceDate.toISOString(),
        dueDate: (c.bill?.dueDate ?? c.dueDate)?.toISOString() ?? null,
        paymentTerms: c.paymentTerms,
        currencyCode: c.currencyCode,
        exchangeRate: num(c.exchangeRate),
        subtotalOriginal: num(c.subtotalOriginal),
        taxOriginal: num(c.taxOriginal),
        totalOriginal: num(c.totalOriginal),
        file: c.storagePath ? { name: c.fileName, type: c.fileType, size: c.fileSize, url: `/api/procurement/sparepart-invoices/${c.id}/file` } : null,
        parseMethod: c.parseMethod,
        parseMs: c.parseMs,
        parseConfidence: c.parseConfidence == null ? null : num(c.parseConfidence),
        shippedAt: c.shippedAt?.toISOString() ?? null,
        trackingNumber: c.trackingNumber,
        eta: c.eta?.toISOString() ?? null,
        createdAt: c.createdAt.toISOString(),
        supplier: c.supplier,
        po: {
            id: po.id,
            number: po.number,
            status: po.status,
            taxMode: po.taxMode,
            items: po.items.map((i, idx) => ({
                id: i.id,
                productId: i.product.id,
                code: i.product.code,
                name: i.product.name,
                unit: i.product.unit,
                partNo: parsedLines[idx]?.partNo ?? null,
                quantity: i.quantity,
                receivedQty: i.receivedQty,
                unitPriceIdr: num(i.unitPrice),
                totalIdr: num(i.totalPrice),
                unitPriceOriginal: parsedLines[idx]?.unitPriceOriginal ?? null,
            })),
            events: po.events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
            grns: po.goodsReceivedNotes.map((g) => ({
                id: g.id,
                number: g.number,
                status: g.status,
                receivedDate: g.receivedDate.toISOString(),
                warehouse: g.warehouse?.name ?? null,
                qty: g.items.reduce((s, it) => s + it.quantityAccepted, 0),
            })),
        },
        bill: c.bill
            ? {
                id: c.bill.id,
                number: c.bill.number,
                status: c.bill.status,
                subtotal: num(c.bill.subtotal),
                taxAmount: num(c.bill.taxAmount),
                totalAmount: num(c.bill.totalAmount),
                balanceDue: num(c.bill.balanceDue),
                payments: c.bill.payments.map((p) => ({ ...p, amount: num(p.amount), date: p.date.toISOString() })),
            }
            : null,
        ordered,
        received,
        ...status,
    }
}

export type SparepartDetail = NonNullable<Awaited<ReturnType<typeof getSparepartPurchase>>>

// ─────────────────────────────────────────────────────────────────────────────
// Duplicate check (runs while the review screen opens)
// ─────────────────────────────────────────────────────────────────────────────

export async function checkSupplierInvoiceDuplicate(input: { sha256?: string | null; supplierId?: string | null; invoiceNo?: string | null }) {
    await getAuthzUser()
    const or: Prisma.SupplierInvoiceCaptureWhereInput[] = []
    if (input.sha256) or.push({ fileSha256: input.sha256 })
    if (input.supplierId && input.invoiceNo) or.push({ supplierId: input.supplierId, supplierInvoiceNo: input.invoiceNo.trim() })
    if (!or.length) return null
    const hit = await prisma.supplierInvoiceCapture.findFirst({
        where: { OR: or },
        select: { id: true, supplierInvoiceNo: true, fileSha256: true, purchaseOrder: { select: { number: true } }, supplier: { select: { name: true } } },
    })
    if (!hit) return null
    return {
        id: hit.id,
        supplierInvoiceNo: hit.supplierInvoiceNo,
        poNumber: hit.purchaseOrder.number,
        supplierName: hit.supplier.name,
        sameFile: !!input.sha256 && hit.fileSha256 === input.sha256,
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Save — core records in ONE transaction, then post / pay / receive as separate reported steps
// ─────────────────────────────────────────────────────────────────────────────

export type SaveSupplierInvoiceInput = {
    supplier: { id?: string | null; name: string; npwp?: string | null; email?: string | null; phone?: string | null; address?: string | null }
    invoiceNo: string
    invoiceDate: string
    dueDate?: string | null
    paymentTerms?: string | null
    currencyCode: CurrencyCode
    exchangeRate: number
    /** Tax as printed (invoice currency). 0 = no PPN. */
    taxOriginal: number
    lines: SaveLineInput[]
    file?: { name: string; type: string; size: number; sha256: string; storagePath: string } | null
    parse?: {
        method: "TEXT" | "OCR" | "MANUAL"
        ms?: number | null
        confidence?: number | null
        snapshot?: unknown
        fingerprint?: Record<string, string | null> | null
        template?: Record<string, unknown> | null
    } | null
    already?: {
        paidOriginal?: number | null
        method?: "TRANSFER" | "CASH"
        bankAccountCode?: string | null
        receivedAll?: boolean
        warehouseId?: string | null
    } | null
}

type StepResult = { ok: boolean; error?: string; skipped?: string }

export async function saveSupplierInvoice(input: SaveSupplierInvoiceInput) {
    const t0 = performance.now()
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)

        const invoiceNo = (input.invoiceNo || "").trim()
        const invoiceDate = parseIsoDate(input.invoiceDate)
        const dueDate = parseIsoDate(input.dueDate) ?? (invoiceDate ? new Date(invoiceDate.getTime() + 30 * 86400000) : null)
        const rate = input.currencyCode === "IDR" ? 1 : Number(input.exchangeRate)
        if (!input.supplier?.id && !input.supplier?.name?.trim()) return { success: false as const, error: "Supplier wajib diisi" }
        if (!invoiceNo) return { success: false as const, error: "Nomor invoice supplier wajib diisi" }
        if (!invoiceDate) return { success: false as const, error: "Tanggal invoice tidak valid" }
        if (!CURRENCIES.includes(input.currencyCode)) return { success: false as const, error: "Mata uang tidak didukung" }
        if (!(rate > 0)) return { success: false as const, error: `Isi kurs ${input.currencyCode} → IDR` }
        if (!(input.taxOriginal >= 0)) return { success: false as const, error: "PPN tidak valid" }
        const lineError = validateSaveLines(input.lines)
        if (lineError) return { success: false as const, error: lineError }

        const idr = toIdrLines(input.lines, rate)
        const taxIdr = Math.round(input.taxOriginal * rate * 100) / 100
        const totalIdr = Math.round((idr.subtotalIdr + taxIdr) * 100) / 100
        const totalOriginal = Math.round((idr.subtotalOriginal + input.taxOriginal) * 100) / 100

        const core = await withPrismaAuth(async (tx) => {
            // 1. Supplier
            let supplierId = input.supplier.id || null
            let supplierName = input.supplier.name.trim()
            if (supplierId) {
                const s = await tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true, name: true } })
                if (!s) throw new Error("Supplier tidak ditemukan")
                supplierName = s.name
            } else {
                const npwpDigits = (input.supplier.npwp || "").replace(/\D/g, "")
                let code = await getNextDocNumber(tx, "SUP-SP", 3)
                while (await tx.supplier.findUnique({ where: { code }, select: { id: true } })) code = await getNextDocNumber(tx, "SUP-SP", 3)
                const created = await tx.supplier.create({
                    data: {
                        code,
                        name: supplierName,
                        npwp: npwpDigits.length === 15 || npwpDigits.length === 16 ? npwpDigits : null,
                        email: input.supplier.email || null,
                        phone: input.supplier.phone || null,
                        address: input.supplier.address || null,
                    },
                    select: { id: true },
                })
                supplierId = created.id
            }

            // 2. The same supplier invoice can never be entered twice.
            const dup = await tx.supplierInvoiceCapture.findUnique({
                where: { supplierId_supplierInvoiceNo: { supplierId, supplierInvoiceNo: invoiceNo } },
                select: { id: true, purchaseOrder: { select: { number: true } } },
            })
            if (dup) throw new DuplicateInvoiceError(dup.id, dup.purchaseOrder.number, invoiceNo, supplierName)

            // 3. New products for unknown part numbers.
            let categoryId: string | null = null
            const productIds: string[] = []
            for (const [i, line] of input.lines.entries()) {
                if (line.productId) {
                    productIds.push(line.productId)
                    continue
                }
                const np = line.newProduct!
                const code = np.code.trim().toUpperCase()
                const existing = await tx.product.findUnique({ where: { code }, select: { id: true } })
                if (existing) {
                    productIds.push(existing.id)
                    continue
                }
                if (!categoryId) {
                    const cat = await tx.category.upsert({
                        where: { code: "SPAREPART" },
                        create: { code: "SPAREPART", name: "Sparepart" },
                        update: {},
                        select: { id: true },
                    })
                    categoryId = cat.id
                }
                const created = await tx.product.create({
                    data: {
                        code,
                        name: np.name.trim() || line.description,
                        unit: (np.unit || line.unit || "PCS").toUpperCase(),
                        productType: "TRADING",
                        equipmentType: "spare_part",
                        categoryId,
                        costPrice: idr.lines[i].unitPriceIdr,
                    },
                    select: { id: true },
                })
                productIds.push(created.id)
            }

            // 4. PO — the supplier's invoice is the vendor's confirmation.
            const ym = `${invoiceDate.getUTCFullYear()}${String(invoiceDate.getUTCMonth() + 1).padStart(2, "0")}`
            const poNumber = await getNextDocNumber(tx, `PO-${ym}`, 4)
            const po = await tx.purchaseOrder.create({
                data: {
                    number: poNumber,
                    supplierId,
                    orderDate: invoiceDate,
                    sentToVendorAt: invoiceDate,
                    status: "VENDOR_CONFIRMED",
                    taxMode: taxIdr > 0 ? "EXCLUSIVE" : "NON_PPN",
                    totalAmount: idr.subtotalIdr,
                    taxAmount: taxIdr,
                    netAmount: totalIdr,
                    createdBy: user.id,
                    items: {
                        create: input.lines.map((line, i) => ({
                            productId: productIds[i],
                            quantity: line.qty,
                            unitPrice: idr.lines[i].unitPriceIdr,
                            totalPrice: idr.lines[i].totalIdr,
                        })),
                    },
                },
                select: { id: true, number: true },
            })
            await tx.purchaseOrderEvent.create({
                data: {
                    purchaseOrderId: po.id,
                    status: "VENDOR_CONFIRMED",
                    changedBy: user.id,
                    action: "CAPTURE_SUPPLIER_INVOICE",
                    notes: `Dicatat dari invoice supplier ${invoiceNo}`,
                    metadata: { source: "SPAREPART_INVOICE", supplierInvoiceNo: invoiceNo, currencyCode: input.currencyCode, exchangeRate: rate },
                },
            })

            // 5. Bill (DRAFT) with the supplier's own lines and tax. Debit goes to GR/IR.
            const bill = await tx.invoice.create({
                data: {
                    number: `BILL-${po.number}`,
                    type: "INV_IN",
                    supplierId,
                    purchaseOrderId: po.id,
                    orderId: po.id,
                    status: "DRAFT",
                    issueDate: invoiceDate,
                    dueDate: dueDate!,
                    subtotal: idr.subtotalIdr,
                    taxAmount: taxIdr,
                    totalAmount: totalIdr,
                    balanceDue: totalIdr,
                    currencyCode: "IDR",
                    exchangeRate: 1,
                    amountInIDR: totalIdr,
                    glAccountCode: SYS_ACCOUNTS.GR_IR_CLEARING,
                    items: {
                        create: input.lines.map((line, i) => ({
                            productId: productIds[i],
                            description: [line.partNo, line.description].filter(Boolean).join(" — ").slice(0, 300),
                            quantity: line.qty,
                            unitPrice: idr.lines[i].unitPriceIdr,
                            amount: idr.lines[i].totalIdr,
                        })),
                    },
                },
                select: { id: true, number: true },
            })

            // 6. Learn the supplier's codes for these parts.
            for (const [i, line] of input.lines.entries()) {
                const sku = (line.partNo || "").trim()
                await tx.supplierProduct.upsert({
                    where: { supplierId_productId: { supplierId, productId: productIds[i] } },
                    create: {
                        supplierId,
                        productId: productIds[i],
                        price: idr.lines[i].amountOriginal / line.qty,
                        currency: input.currencyCode,
                        skuCode: sku || null,
                    },
                    update: {
                        price: idr.lines[i].amountOriginal / line.qty,
                        currency: input.currencyCode,
                        ...(sku ? { skuCode: sku } : {}),
                    },
                })
            }

            // 7. Learn the supplier's invoice layout.
            if (input.parse?.template && input.parse.method !== "MANUAL") {
                await tx.supplierInvoiceTemplate.upsert({
                    where: { supplierId },
                    create: {
                        supplierId,
                        fingerprint: (input.parse.fingerprint ?? {}) as Prisma.InputJsonValue,
                        template: input.parse.template as Prisma.InputJsonValue,
                        lastRate: input.currencyCode === "IDR" ? null : rate,
                    },
                    update: {
                        fingerprint: (input.parse.fingerprint ?? {}) as Prisma.InputJsonValue,
                        template: input.parse.template as Prisma.InputJsonValue,
                        samples: { increment: 1 },
                        ...(input.currencyCode === "IDR" ? {} : { lastRate: rate }),
                    },
                })
            } else if (input.currencyCode !== "IDR") {
                await tx.supplierInvoiceTemplate.upsert({
                    where: { supplierId },
                    create: { supplierId, fingerprint: {}, template: {}, samples: 0, lastRate: rate },
                    update: { lastRate: rate },
                })
            }

            // 8. The capture row (one per purchase).
            const capture = await tx.supplierInvoiceCapture.create({
                data: {
                    line: LINE,
                    purchaseOrderId: po.id,
                    billId: bill.id,
                    supplierId,
                    supplierInvoiceNo: invoiceNo,
                    invoiceDate,
                    dueDate,
                    paymentTerms: input.paymentTerms || null,
                    currencyCode: input.currencyCode,
                    exchangeRate: rate,
                    subtotalOriginal: idr.subtotalOriginal,
                    taxOriginal: input.taxOriginal,
                    totalOriginal,
                    fileName: input.file?.name ?? null,
                    fileType: input.file?.type ?? null,
                    fileSize: input.file?.size ?? null,
                    fileSha256: input.file?.sha256 ?? null,
                    storagePath: input.file?.storagePath ?? null,
                    parseMethod: input.parse?.method ?? "MANUAL",
                    parseMs: input.parse?.ms == null ? null : Math.round(input.parse.ms),
                    parseConfidence: input.parse?.confidence ?? null,
                    parsed: {
                        lines: input.lines.map((l) => ({ partNo: l.partNo ?? null, unitPriceOriginal: l.unitPriceOriginal, discountPct: l.discountPct ?? null, unit: l.unit ?? null })),
                        ...(input.parse?.snapshot ? { snapshot: input.parse.snapshot } : {}),
                    } as Prisma.InputJsonValue,
                    searchText: buildSearchText({
                        poNumber: po.number,
                        supplierName,
                        supplierInvoiceNo: invoiceNo,
                        billNumber: bill.number,
                        partCodes: input.lines.map((l) => l.partNo || l.newProduct?.code),
                        descriptions: input.lines.map((l) => l.description),
                    }),
                    createdBy: user.id,
                },
                select: { id: true },
            })

            if (input.file?.storagePath) {
                await tx.invoiceAttachment.create({
                    data: {
                        invoiceId: bill.id,
                        fileName: input.file.name,
                        fileUrl: `/api/procurement/sparepart-invoices/${capture.id}/file`,
                        fileType: input.file.type,
                        fileSize: input.file.size,
                    },
                })
            }

            return { captureId: capture.id, poId: po.id, poNumber: po.number, billId: bill.id, billNumber: bill.number, supplierId }
        })
        const coreMs = Math.round(performance.now() - t0)

        // Steps after commit. Each one reports back; none can undo the saved purchase.
        const steps: { post?: StepResult; pay?: StepResult; receive?: StepResult } = {}
        if (hasRole(user, FINANCE_POSTING_ROLES)) {
            steps.post = await postBill(core.billId)
        } else {
            steps.post = { ok: false, skipped: "Menunggu finance untuk posting tagihan" }
        }
        const paid = Number(input.already?.paidOriginal || 0)
        if (paid > 0) {
            steps.pay = steps.post.ok
                ? await payCapture(core.captureId, paid, input.already?.method ?? "TRANSFER", input.already?.bankAccountCode ?? null)
                : { ok: false, skipped: "Pembayaran dicatat setelah tagihan diposting" }
        }
        if (input.already?.receivedAll) {
            steps.receive = await receiveCapture(core.captureId, input.already.warehouseId ?? null, null)
        }

        return { success: true as const, ...core, steps, coreMs, totalMs: Math.round(performance.now() - t0) }
    } catch (e) {
        if (e instanceof DuplicateInvoiceError) {
            return { success: false as const, code: "DUPLICATE" as const, existingId: e.existingId, error: e.message }
        }
        console.error("[saveSupplierInvoice]", e)
        return { success: false as const, error: errorMessage(e) }
    }
}

class DuplicateInvoiceError extends Error {
    constructor(public existingId: string, poNumber: string, invoiceNo: string, supplierName: string) {
        super(`Invoice ${invoiceNo} dari ${supplierName} sudah tercatat (${poNumber}).`)
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Post bill / pay / ship / receive
// ─────────────────────────────────────────────────────────────────────────────

async function postBill(billId: string): Promise<StepResult> {
    try {
        await ensureSystemAccounts()
        const r = await moveInvoiceToSent(billId)
        if (r && typeof r === "object" && "success" in r && !r.success) return { ok: false, error: (r as { error?: string }).error || "Posting gagal" }
        return { ok: true }
    } catch (e) {
        return { ok: false, error: errorMessage(e) }
    }
}

export async function postSparepartBill(id: string) {
    const user = await getAuthzUser()
    try {
        assertRole(user, [...FINANCE_POSTING_ROLES])
    } catch {
        return { success: false, error: "Hanya finance/manajer yang bisa posting tagihan" }
    }
    const c = await prisma.supplierInvoiceCapture.findUnique({ where: { id }, select: { billId: true } })
    if (!c?.billId) return { success: false, error: "Tagihan tidak ditemukan" }
    const r = await postBill(c.billId)
    return r.ok ? { success: true } : { success: false, error: r.error }
}

async function syncPoPayment(captureId: string) {
    const c = await prisma.supplierInvoiceCapture.findUnique({
        where: { id: captureId },
        select: { purchaseOrderId: true, bill: { select: { totalAmount: true, balanceDue: true } } },
    })
    if (!c?.bill) return null
    const status = poPaymentStatus(num(c.bill.totalAmount), num(c.bill.balanceDue))
    await withPrismaAuth(async (tx) => {
        await tx.purchaseOrder.update({
            where: { id: c.purchaseOrderId },
            data: { paymentStatus: status, ...(status === "PAID" ? { datePaid: new Date() } : {}) },
        })
    })
    return { status, balanceDue: num(c.bill.balanceDue) }
}

async function payCapture(captureId: string, amountOriginal: number, method: "TRANSFER" | "CASH", bankAccountCode: string | null): Promise<StepResult & { balanceDue?: number }> {
    try {
        const c = await prisma.supplierInvoiceCapture.findUnique({
            where: { id: captureId },
            select: { supplierId: true, supplierInvoiceNo: true, currencyCode: true, exchangeRate: true, billId: true, bill: { select: { balanceDue: true, status: true } } },
        })
        if (!c?.billId || !c.bill) return { ok: false, error: "Tagihan tidak ditemukan" }
        if (c.bill.status === "DRAFT") return { ok: false, error: "Tagihan belum diposting" }
        const balance = num(c.bill.balanceDue)
        if (balance <= 0.005) return { ok: false, error: "Tagihan sudah lunas" }
        const rate = num(c.exchangeRate) || 1
        const amount = paymentIdr({ amountOriginal, rate, balanceDueIdr: balance })
        const fx = c.currencyCode !== "IDR" ? ` (${c.currencyCode} ${amountOriginal.toLocaleString("id-ID")} @ ${rate.toLocaleString("id-ID")})` : ""
        const r = await recordVendorPayment({
            supplierId: c.supplierId,
            billId: c.billId,
            amount,
            method,
            reference: c.supplierInvoiceNo,
            notes: `Pembayaran invoice ${c.supplierInvoiceNo}${fx}`,
            ...(bankAccountCode ? { bankAccountCode } : {}),
        })
        if (!r || (typeof r === "object" && "success" in r && !r.success)) return { ok: false, error: (r as { error?: string })?.error || "Pembayaran gagal" }
        const synced = await syncPoPayment(captureId)
        return { ok: true, balanceDue: synced?.balanceDue }
    } catch (e) {
        return { ok: false, error: errorMessage(e) }
    }
}

export async function recordSparepartPayment(input: { id: string; amountOriginal: number; method?: "TRANSFER" | "CASH"; bankAccountCode?: string | null }) {
    if (!(input.amountOriginal > 0)) return { success: false, error: "Jumlah bayar harus lebih dari 0" }
    const r = await payCapture(input.id, input.amountOriginal, input.method ?? "TRANSFER", input.bankAccountCode ?? null)
    return r.ok ? { success: true, balanceDue: r.balanceDue } : { success: false, error: r.error }
}

export async function markSparepartShipped(input: { id: string; trackingNumber?: string | null; eta?: string | null }) {
    try {
        const user = await getAuthzUser()
        assertRole(user, PURCHASING_ROLES)
        const c = await prisma.supplierInvoiceCapture.findUnique({
            where: { id: input.id },
            select: { purchaseOrderId: true, purchaseOrder: { select: { status: true } } },
        })
        if (!c) return { success: false, error: "Pembelian tidak ditemukan" }
        const tracking = input.trackingNumber?.trim() || null
        const eta = parseIsoDate(input.eta)
        const status = c.purchaseOrder.status

        if (status === "VENDOR_CONFIRMED") {
            // Canonical status transition + event.
            const r = await markAsShipped(c.purchaseOrderId, tracking ?? undefined)
            if (!r.success) return { success: false, error: r.error }
        } else if (status === "SHIPPED" || status === "PARTIAL_RECEIVED" || status === "ORDERED") {
            // A further shipment of a partly received order: the PO status already says enough.
            await withPrismaAuth(async (tx) => {
                await tx.purchaseOrderEvent.create({
                    data: { purchaseOrderId: c.purchaseOrderId, status, changedBy: user.id, action: "MARK_SHIPPED", metadata: { source: "SPAREPART_INVOICE", trackingNumber: tracking } },
                })
            })
        } else {
            return { success: false, error: "Pembelian ini sudah selesai atau dibatalkan" }
        }

        await withPrismaAuth(async (tx) => {
            await tx.supplierInvoiceCapture.update({
                where: { id: input.id },
                data: { shippedAt: new Date(), trackingNumber: tracking, eta },
            })
            if (eta) await tx.purchaseOrder.update({ where: { id: c.purchaseOrderId }, data: { expectedDate: eta } })
        })
        return { success: true }
    } catch (e) {
        return { success: false, error: errorMessage(e) }
    }
}

async function receiveCapture(captureId: string, warehouseId: string | null, lines: { poItemId: string; qty: number }[] | null): Promise<StepResult & { grnNumber?: string }> {
    try {
        const c = await prisma.supplierInvoiceCapture.findUnique({
            where: { id: captureId },
            select: {
                purchaseOrderId: true,
                purchaseOrder: { select: { items: { select: { id: true, productId: true, quantity: true, receivedQty: true, unitPrice: true } } } },
            },
        })
        if (!c) return { ok: false, error: "Pembelian tidak ditemukan" }
        let whId = warehouseId
        if (!whId) {
            const wh = await prisma.warehouse.findFirst({ where: { isActive: true }, orderBy: { createdAt: "asc" }, select: { id: true } })
            whId = wh?.id ?? null
        }
        if (!whId) return { ok: false, error: "Belum ada gudang aktif" }

        const wanted = new Map((lines ?? []).map((l) => [l.poItemId, l.qty]))
        const items = c.purchaseOrder.items
            .map((i) => {
                const remaining = i.quantity - i.receivedQty
                const qty = lines ? Math.min(remaining, Math.max(0, Math.floor(wanted.get(i.id) ?? 0))) : remaining
                return { poItemId: i.id, productId: i.productId, quantityOrdered: i.quantity, quantityReceived: qty, quantityAccepted: qty, unitCost: num(i.unitPrice) }
            })
            .filter((i) => i.quantityReceived > 0)
        if (!items.length) return { ok: false, error: "Tidak ada barang yang tersisa untuk diterima" }

        const created = await createGRN({ purchaseOrderId: c.purchaseOrderId, warehouseId: whId, notes: "Penerimaan sparepart", items })
        if (!created.success || !("grnId" in created) || !created.grnId) return { ok: false, error: created.error || "Gagal membuat penerimaan" }
        const accepted = await acceptGRN(created.grnId)
        if (!accepted.success) {
            // Remove our own draft so it does not block the next attempt (createGRN counts drafts as received).
            await withPrismaAuth(async (tx) => {
                await tx.goodsReceivedNote.deleteMany({ where: { id: created.grnId, status: "DRAFT" } })
            }).catch(() => undefined)
            return { ok: false, error: ("error" in accepted && accepted.error) || "Gagal menerima barang" }
        }
        return { ok: true, grnNumber: created.grnNumber }
    } catch (e) {
        return { ok: false, error: errorMessage(e) }
    }
}

export async function receiveSparepartGoods(input: { id: string; warehouseId?: string | null; lines?: { poItemId: string; qty: number }[] | null }) {
    const user = await getAuthzUser()
    try {
        assertRole(user, RECEIVING_ROLES)
    } catch {
        return { success: false, error: "Tidak punya akses penerimaan barang" }
    }
    const r = await receiveCapture(input.id, input.warehouseId ?? null, input.lines ?? null)
    return r.ok ? { success: true, grnNumber: r.grnNumber } : { success: false, error: r.error }
}
