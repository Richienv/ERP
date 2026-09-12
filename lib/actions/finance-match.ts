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
export async function getThreeWayMatchExceptionCount(): Promise<{ count: number; amount: number }> {
    await requireAuth()

    const drafts = await prisma.invoice.findMany({
        where: {
            type: "INV_IN",
            status: "DRAFT",
        },
        select: {
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
        },
    })

    const missingIds = [...new Set(
        drafts
            .filter((bill) => !bill.purchaseOrder && (bill.purchaseOrderId || bill.orderId))
            .map((bill) => (bill.purchaseOrderId || bill.orderId) as string)
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
    for (const bill of drafts) {
        const po = bill.purchaseOrder
            ?? extraById.get(bill.purchaseOrderId || bill.orderId || "")
            ?? null
        if (!po) continue
        const match = fromLoadedBill(bill, po)
        if (match.status === "OVER_BILLED") {
            count += 1
            amount += match.totalVarianceAmount
        }
    }

    return { count, amount }
}
