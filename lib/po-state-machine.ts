import { ProcurementStatus } from "@prisma/client"

export const allowedNextStatuses: Partial<Record<ProcurementStatus, ProcurementStatus[]>> = {
    PO_DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "REJECTED", "CANCELLED"],
    APPROVED: ["ORDERED", "REJECTED", "CANCELLED"],
    ORDERED: ["VENDOR_CONFIRMED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"],
    VENDOR_CONFIRMED: ["SHIPPED", "PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"],
    SHIPPED: ["PARTIAL_RECEIVED", "RECEIVED", "CANCELLED"],
    PARTIAL_RECEIVED: ["RECEIVED"],
    RECEIVED: ["COMPLETED"],
}

export function assertPOTransition(current: ProcurementStatus, next: ProcurementStatus) {
    const allowed = allowedNextStatuses[current] || []
    if (!allowed.includes(next)) {
        throw new Error(`Invalid status transition: ${current} -> ${next}`)
    }
}
