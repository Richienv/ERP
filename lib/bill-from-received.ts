import { TAX_RATES } from "@/lib/tax-rates"
import { toNum } from "@/lib/utils"

export type BillFromReceivedPoItem = {
    productId?: string | null
    product?: { name?: string | null } | null
    description?: string | null
    receivedQty?: unknown
    unitPrice?: unknown
}

export type ExistingBillForReceived = {
    id: string
    number: string
    status: string
    items?: Array<{
        productId?: string | null
        description?: string | null
        quantity?: unknown
    }>
}

export type BillFromReceivedLine = {
    description: string
    quantity: number
    unitPrice: number
    amount: number
    productId: string | null
}

export type BillFromReceivedTotals = {
    subtotal: number
    taxAmount: number
    totalAmount: number
    balanceDue: number
}

export type BillFromReceivedPlan =
    | { action: "skip"; reason: "nothing_received" | "fully_billed" }
    | {
        action: "refresh"
        draftId: string
        draftNumber: string
        lines: BillFromReceivedLine[]
        totals: BillFromReceivedTotals
    }
    | { action: "create"; lines: BillFromReceivedLine[]; totals: BillFromReceivedTotals }
    | { action: "confirm"; existing: { id: string; number: string; status: string } }

function lineKey(productId: string | null | undefined, name: string) {
    if (productId) return `id:${productId}`
    return `name:${name.trim().toLowerCase()}`
}

function itemDescription(item: BillFromReceivedPoItem) {
    return item.product?.name || item.description || "Unknown Item"
}

function billedQtyFor(
    billed: Map<string, number>,
    productId: string | null | undefined,
    description: string,
) {
    const idKey = productId ? lineKey(productId, description) : null
    if (idKey && billed.has(idKey)) return billed.get(idKey) ?? 0
    return billed.get(lineKey(null, description)) ?? 0
}

export function totalsFromReceivedLines(
    lines: BillFromReceivedLine[],
    taxMode?: string | null,
): BillFromReceivedTotals {
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0)
    // Lines always store DPP. Inclusive PO prices are stripped before this.
    void taxMode
    const taxAmount = Math.round(subtotal * TAX_RATES.PPN)
    const totalAmount = subtotal + taxAmount
    return { subtotal, taxAmount, totalAmount, balanceDue: totalAmount }
}

export function planBillFromReceived(input: {
    poItems: BillFromReceivedPoItem[]
    taxMode?: string | null
    existingBills: ExistingBillForReceived[]
    options?: { forceCreate?: boolean; requireConfirmationOnDuplicate?: boolean }
}): BillFromReceivedPlan {
    const options = input.options ?? {}
    const netFactor = input.taxMode === "INCLUSIVE" ? 1 / (1 + TAX_RATES.PPN) : 1

    const receivedByKey = new Map<string, {
        qty: number
        item: BillFromReceivedPoItem
        description: string
    }>()
    for (const item of input.poItems) {
        const description = itemDescription(item)
        const key = lineKey(item.productId, description)
        const existing = receivedByKey.get(key)
        if (existing) existing.qty += toNum(item.receivedQty)
        else receivedByKey.set(key, { qty: toNum(item.receivedQty), item, description })
    }

    const totalReceived = [...receivedByKey.values()].reduce((sum, row) => sum + row.qty, 0)
    if (totalReceived <= 0) return { action: "skip", reason: "nothing_received" }

    const drafts = input.existingBills.filter((bill) => bill.status === "DRAFT")
    const draft = drafts[0]
    const latest = input.existingBills[0]

    const billedElsewhere = new Map<string, number>()
    for (const bill of input.existingBills) {
        if (draft && bill.id === draft.id && !options.forceCreate) continue
        for (const line of bill.items ?? []) {
            const description = line.description || ""
            const key = lineKey(line.productId, description)
            billedElsewhere.set(key, (billedElsewhere.get(key) ?? 0) + toNum(line.quantity))
        }
    }

    const lines: BillFromReceivedLine[] = []
    for (const rec of receivedByKey.values()) {
        const already = billedQtyFor(billedElsewhere, rec.item.productId, rec.description)
        const quantity = rec.qty - already
        if (quantity <= 0) continue
        const unitPrice = Math.round(toNum(rec.item.unitPrice) * netFactor)
        lines.push({
            description: rec.description,
            quantity,
            unitPrice,
            amount: Math.round(quantity * unitPrice),
            productId: rec.item.productId ?? null,
        })
    }

    const totals = totalsFromReceivedLines(lines, input.taxMode)

    if (lines.length === 0) {
        if (options.requireConfirmationOnDuplicate && !options.forceCreate && latest) {
            return {
                action: "confirm",
                existing: { id: latest.id, number: latest.number, status: latest.status },
            }
        }
        return { action: "skip", reason: "fully_billed" }
    }

    if (draft && !options.forceCreate) {
        return {
            action: "refresh",
            draftId: draft.id,
            draftNumber: draft.number,
            lines,
            totals,
        }
    }

    return { action: "create", lines, totals }
}
