import { ProcurementStatus } from "@prisma/client"

export const allowedNextStatuses: Partial<Record<ProcurementStatus, ProcurementStatus[]>> = {
    PO_DRAFT: ["PENDING_APPROVAL"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED"],
    APPROVED: ["ORDERED", "REJECTED"],
    ORDERED: ["VENDOR_CONFIRMED", "PARTIAL_RECEIVED", "RECEIVED"],
    VENDOR_CONFIRMED: ["SHIPPED", "PARTIAL_RECEIVED", "RECEIVED"],
    SHIPPED: ["PARTIAL_RECEIVED", "RECEIVED"],
    PARTIAL_RECEIVED: ["RECEIVED"],
    RECEIVED: ["COMPLETED"],
}

export function assertPOTransition(current: ProcurementStatus, next: ProcurementStatus) {
    const allowed = allowedNextStatuses[current] || []
    if (!allowed.includes(next)) {
        throw new Error(`Invalid status transition: ${current} -> ${next}`)
    }
}
