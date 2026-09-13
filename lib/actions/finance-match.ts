"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import {
    fromLoadedBill,
    type PoForMatch,
    type ThreeWayMatch,
} from "@/lib/three-way-match"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

const poItemSelect = {
    productId: true,
    quantity: true,
    receivedQty: true,
    unitPrice: true,
    product: { select: { name: true, code: true } },
} as const

/**
 * Read-only PO ↔ GRN ↔ Bill match for one vendor bill (INV_IN).
 * No PO → NO_PO (manual bill, not an error).
 */
export async function getThreeWayMatch(billId: string): Promise<ThreeWayMatch> {
    await requireAuth()

    const bill = await prisma.invoice.findUnique({
        where: { id: billId },
        select: {
            id: true,
            number: true,
            type: true,
            purchaseOrderId: true,
            orderId: true,
            items: {
                select: {
                    productId: true,
                    description: true,
                    quantity: true,
                    unitPrice: true,
                },
            },
            purchaseOrder: {
                select: {
                    number: true,
                    items: { select: poItemSelect },
                },
            },
        },
    })

    if (!bill) throw new Error("Tagihan tidak ditemukan")
    if (bill.type !== "INV_IN") throw new Error("Bukan tagihan vendor")

    let po: PoForMatch | null = bill.purchaseOrder
    const fallbackPoId = bill.purchaseOrderId || bill.orderId
    if (!po && fallbackPoId) {
        po = await prisma.purchaseOrder.findUnique({
            where: { id: fallbackPoId },
            select: {
                number: true,
                items: { select: poItemSelect },
            },
        })
    }

    return fromLoadedBill(bill, po)
}

/**
 * Dashboard contract — keep this signature stable.
 * Counts DRAFT INV_IN bills that would post AP for qty not yet received.
 */
type MatchCountRow = { count: unknown; amount: unknown }

async function countOverBilledDraftsFromLoaded(
    drafts: Array<{
        id: string
        number: string
        purchaseOrderId: string | null
        orderId: string | null
        items: Array<{
            productId: string | null
            description: string
            quantity: unknown
            unitPrice: unknown
        }>
        purchaseOrder: PoForMatch | null
    }>,
): Promise<{ count: number; amount: number; ids: Set<string> }> {
    const missingIds = [...new Set(
        drafts
            .filter((bill) => !bill.purchaseOrder && (bill.purchaseOrderId || bill.orderId))
            .map((bill) => (bill.purchaseOrderId || bill.orderId) as string),
    )]

    const extraPos = missingIds.length
        ? await prisma.purchaseOrder.findMany({
            where: { id: { in: missingIds } },
            select: {
                id: true,
                number: true,
                items: { select: poItemSelect },
            },
        })
        : []
    const extraById = new Map(extraPos.map((po) => [po.id, po]))

    let count = 0
    let amount = 0
    const ids = new Set<string>()
    for (const bill of drafts) {
        const po = bill.purchaseOrder
            ?? extraById.get(bill.purchaseOrderId || bill.orderId || "")
            ?? null
        if (!po) continue
        const match = fromLoadedBill(bill, po)
        if (match.status === "OVER_BILLED") {
            count += 1
            amount += match.totalVarianceAmount
            ids.add(bill.id)
        }
    }
    return { count, amount, ids }
}

const draftBillSelect = {
    id: true,
    number: true,
    purchaseOrderId: true,
    orderId: true,
    items: {
        select: {
            productId: true,
            description: true,
            quantity: true,
            unitPrice: true,
        },
    },
    purchaseOrder: {
        select: {
            number: true,
            items: { select: poItemSelect },
        },
    },
} as const

export async function getThreeWayMatchExceptionCount(): Promise<{ count: number; amount: number }> {
    await requireAuth()

    try {
        const rows = await prisma.$queryRaw<MatchCountRow[]>`
            SELECT COUNT(*)::int AS count,
                   COALESCE(SUM(var_amount), 0) AS amount
            FROM (
                SELECT i.id,
                       SUM(GREATEST(0, b.qty - COALESCE(r.qty, 0)) * b.unit_price) AS var_amount
                FROM invoices i
                JOIN (
                    SELECT "invoiceId" AS invoice_id,
                           "productId" AS product_id,
                           SUM(quantity) AS qty,
                           MAX("unitPrice") AS unit_price
                    FROM invoice_items
                    WHERE "productId" IS NOT NULL
                    GROUP BY 1, 2
                ) b ON b.invoice_id = i.id
                LEFT JOIN (
                    SELECT "purchaseOrderId" AS po_id,
                           "productId" AS product_id,
                           SUM("receivedQty") AS qty
                    FROM purchase_order_items
                    GROUP BY 1, 2
                ) r ON r.po_id = COALESCE(i."purchaseOrderId", i."orderId")
                   AND r.product_id = b.product_id
                WHERE i.type = 'INV_IN'
                  AND i.status = 'DRAFT'
                  AND COALESCE(i."purchaseOrderId", i."orderId") IS NOT NULL
                  AND EXISTS (
                      SELECT 1
                      FROM purchase_order_items poi
                      WHERE poi."purchaseOrderId" = COALESCE(i."purchaseOrderId", i."orderId")
                  )
                GROUP BY i.id
                HAVING SUM(GREATEST(0, b.qty - COALESCE(r.qty, 0))) > 0
            ) t
        `
        return {
            count: Number(rows[0]?.count ?? 0) || 0,
            amount: Number(rows[0]?.amount ?? 0) || 0,
        }
    } catch (error) {
        if (process.env.VITEST !== "true") {
            console.warn("[finance-match] match-count SQL failed, falling back:", error)
        }
        const drafts = await prisma.invoice.findMany({
            where: { type: "INV_IN", status: "DRAFT" },
            select: draftBillSelect,
        })
        const loaded = await countOverBilledDraftsFromLoaded(drafts)
        return { count: loaded.count, amount: loaded.amount }
    }
}
