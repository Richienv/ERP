"use server"

import { prisma } from "@/lib/db"
import { createClient } from "@/lib/supabase/server"
import { toNum } from "@/lib/utils"

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error("Unauthorized")
    return user
}

/** Qty must match exactly — 1 unit over/under is a variance. */
export const THREE_WAY_QTY_TOLERANCE = 0

export type ThreeWayMatchStatus = "MATCHED" | "OVER_BILLED" | "UNDER_RECEIVED" | "NO_PO"

export type ThreeWayMatchLine = {
    productId: string | null
    productCode: string
    productName: string
    ordered: number
    received: number
    billed: number
    unitPrice: number
    varianceQty: number
    varianceAmount: number
}

export type ThreeWayMatch = {
    billId: string
    billNumber: string
    poNumber: string | null
    status: ThreeWayMatchStatus
    totalVarianceQty: number
    totalVarianceAmount: number
    lines: ThreeWayMatchLine[]
}

export type ThreeWayMatchPoItem = {
    productId: string
    productName: string
    productCode: string
    ordered: number
    received: number
    unitPrice: number
}

export type ThreeWayMatchBillItem = {
    productId: string | null
    description: string
    billed: number
    unitPrice: number
}

export type ThreeWayMatchInput = {
    billId: string
    billNumber: string
    poNumber: string | null
    poItems: ThreeWayMatchPoItem[]
    billItems: ThreeWayMatchBillItem[]
}

type AggLine = {
    productId: string | null
    productCode: string
    productName: string
    ordered: number
    received: number
    billed: number
    unitPrice: number
}

function lineKey(productId: string | null | undefined, name: string) {
    if (productId) return `id:${productId}`
    return `name:${name.trim().toLowerCase()}`
}

function exceedsTolerance(delta: number) {
    return delta > THREE_WAY_QTY_TOLERANCE
}

/**
 * Pure PO ↔ GRN ↔ Bill variance. Safe to unit-test without Prisma.
 * varianceQty / varianceAmount are billed − received (positive = ditagih tanpa barang).
 */
export function buildThreeWayMatch(input: ThreeWayMatchInput): ThreeWayMatch {
    const hasPo = Boolean(input.poNumber)

    if (!hasPo) {
        return {
            billId: input.billId,
            billNumber: input.billNumber,
            poNumber: null,
            status: "NO_PO",
            totalVarianceQty: 0,
            totalVarianceAmount: 0,
            lines: [],
        }
    }

    const byKey = new Map<string, AggLine>()

    for (const po of input.poItems) {
        const key = lineKey(po.productId, po.productName)
        const existing = byKey.get(key)
        if (existing) {
            existing.ordered += po.ordered
            existing.received += po.received
            if (!existing.unitPrice && po.unitPrice) existing.unitPrice = po.unitPrice
        } else {
            byKey.set(key, {
                productId: po.productId,
                productCode: po.productCode,
                productName: po.productName,
                ordered: po.ordered,
                received: po.received,
                billed: 0,
                unitPrice: po.unitPrice,
            })
        }
    }

    for (const item of input.billItems) {
        const idKey = item.productId ? lineKey(item.productId, item.description) : null
        const nameKey = lineKey(null, item.description)
        const existing = (idKey ? byKey.get(idKey) : undefined) ?? byKey.get(nameKey)
        if (existing) {
            existing.billed += item.billed
            if (item.unitPrice) existing.unitPrice = item.unitPrice
        } else {
            byKey.set(idKey ?? nameKey, {
                productId: item.productId,
                productCode: "",
                productName: item.description,
                ordered: 0,
                received: 0,
                billed: item.billed,
                unitPrice: item.unitPrice,
            })
        }
    }

    const lines: ThreeWayMatchLine[] = [...byKey.values()].map((row) => {
        const varianceQty = row.billed - row.received
        return {
            productId: row.productId,
            productCode: row.productCode,
            productName: row.productName,
            ordered: row.ordered,
            received: row.received,
            billed: row.billed,
            unitPrice: row.unitPrice,
            varianceQty,
            varianceAmount: varianceQty * row.unitPrice,
        }
    })

    let totalVarianceQty = 0
    let totalVarianceAmount = 0
    let overBilled = false
    let underReceived = false

    for (const line of lines) {
        if (exceedsTolerance(line.varianceQty)) {
            overBilled = true
            totalVarianceQty += line.varianceQty
            totalVarianceAmount += line.varianceAmount
        }
        if (exceedsTolerance(line.ordered - line.received)) {
            underReceived = true
        }
    }

    const status: ThreeWayMatchStatus = overBilled
        ? "OVER_BILLED"
        : underReceived
            ? "UNDER_RECEIVED"
            : "MATCHED"

    return {
        billId: input.billId,
        billNumber: input.billNumber,
        poNumber: input.poNumber,
        status,
        totalVarianceQty,
        totalVarianceAmount,
        lines,
    }
}

type PoForMatch = {
    number: string
    items: Array<{
        productId: string
        quantity: unknown
        receivedQty: unknown
        unitPrice: unknown
        product: { name: string; code: string } | null
    }>
}

function fromLoadedBill(
    bill: {
        id: string
        number: string
        items: Array<{
            productId: string | null
            description: string
            quantity: unknown
            unitPrice: unknown
        }>
    },
    po: PoForMatch | null
): ThreeWayMatch {
    return buildThreeWayMatch({
        billId: bill.id,
        billNumber: bill.number,
        poNumber: po?.number ?? null,
        poItems: (po?.items ?? []).map((item) => ({
            productId: item.productId,
            productName: item.product?.name || "Barang",
            productCode: item.product?.code || "",
            ordered: toNum(item.quantity),
            received: toNum(item.receivedQty),
            unitPrice: toNum(item.unitPrice),
        })),
        billItems: bill.items.map((item) => ({
            productId: item.productId,
            description: item.description,
            billed: toNum(item.quantity),
            unitPrice: toNum(item.unitPrice),
        })),
    })
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
