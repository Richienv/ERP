import { toNum } from "@/lib/utils"

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
        let existing = (idKey ? byKey.get(idKey) : undefined) ?? byKey.get(nameKey)
        if (!existing) {
            const desc = item.description.trim().toLowerCase()
            for (const row of byKey.values()) {
                if (row.productName.trim().toLowerCase() === desc) {
                    existing = row
                    break
                }
            }
        }
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

export type PoForMatch = {
    number: string
    items: Array<{
        productId: string
        quantity: unknown
        receivedQty: unknown
        unitPrice: unknown
        product: { name: string; code: string } | null
    }>
}

export function fromLoadedBill(
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
