import { ProcurementStatus } from "@prisma/client"

/**
 * Allowed PO/PR status transitions.
 *
 * NOTE: ProcurementStatus enum is overloaded — it covers BOTH the PR phase
 * (GAP_DETECTED, PR_CREATED) and the PO phase (PO_DRAFT..COMPLETED).
 * The PR phase uses its own status field (PRStatus) on PurchaseRequest, but
 * the ProcurementStatus enum still includes those values for cross-phase
 * compatibility. We map the PR-phase entries here so assertPOTransition
 * doesn't throw "Invalid transition" for legitimate flows like
 * GAP_DETECTED → PR_CREATED → PO_DRAFT.
 */
export const allowedNextStatuses: Partial<Record<ProcurementStatus, ProcurementStatus[]>> = {
    // PR phase (cross-phase entry points)
    GAP_DETECTED: ["PR_CREATED", "CANCELLED"],
    PR_CREATED: ["PO_DRAFT", "CANCELLED", "REJECTED"],
    // PO phase
    PO_DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["ORDERED", "REJECTED", "CANCELLED"],
    ORDERED: ["VENDOR_CONFIRMED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"],
    VENDOR_CONFIRMED: ["SHIPPED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"],
    SHIPPED: ["PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"],
    PARTIAL_RECEIVED: ["RECEIVED", "CANCELLED"],
    RECEIVED: ["COMPLETED"],
}

export function assertPOTransition(current: ProcurementStatus, next: ProcurementStatus) {
    const allowed = allowedNextStatuses[current] || []
    if (!allowed.includes(next)) {
        throw new Error(`Invalid status transition: ${current} -> ${next}`)
    }
}

/**
 * H11 — derive return status from PO items so UI can surface it as a badge
 * without inflating the ProcurementStatus enum. A "completed" PO with a
 * partial/full return looks identical in the list otherwise.
 *
 * Returns:
 *   - "NONE"      — no item has returnedQty > 0
 *   - "PARTIAL"   — some items returned but not all received qty
 *   - "FULL"      — every received item has returnedQty === receivedQty
 */
export type POReturnState = "NONE" | "PARTIAL" | "FULL"

export function derivePOReturnState(
    items: Array<{ receivedQty: number; returnedQty: number | null | undefined }>,
): POReturnState {
    const itemsWithReturns = items.filter((i) => (i.returnedQty ?? 0) > 0)
    if (itemsWithReturns.length === 0) return "NONE"
    const allFullyReturned = items
        .filter((i) => i.receivedQty > 0)
        .every((i) => (i.returnedQty ?? 0) >= i.receivedQty)
    return allFullyReturned ? "FULL" : "PARTIAL"
}
