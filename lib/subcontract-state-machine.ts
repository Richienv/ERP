import { SubcontractOrderStatus } from "@prisma/client"

// ==============================================================================
// Allowed Transitions
// ==============================================================================

export const allowedSubcontractTransitions: Partial<
    Record<SubcontractOrderStatus, SubcontractOrderStatus[]>
> = {
    SC_DRAFT: ["SC_SENT", "SC_CANCELLED"],
    SC_SENT: ["SC_IN_PROGRESS", "SC_CANCELLED"],
    SC_IN_PROGRESS: ["SC_PARTIAL_COMPLETE", "SC_COMPLETED", "SC_CANCELLED"],
    SC_PARTIAL_COMPLETE: ["SC_COMPLETED", "SC_CANCELLED"],
}

// ==============================================================================
// Assertion
// ==============================================================================

export function assertSubcontractTransition(
    current: SubcontractOrderStatus,
    next: SubcontractOrderStatus
): void {
    const allowed = allowedSubcontractTransitions[current] || []
    if (!allowed.includes(next)) {
        throw new Error(
            `Transisi status subkontrak tidak valid: ${current} → ${next}`
        )
    }
}

// ==============================================================================
// Labels (Indonesian)
// ==============================================================================

export const subcontractStatusLabels: Record<SubcontractOrderStatus, string> = {
    SC_DRAFT: "Draft",
    SC_SENT: "Terkirim ke CMT",
    SC_IN_PROGRESS: "Dalam Proses",
    SC_PARTIAL_COMPLETE: "Sebagian Selesai",
    SC_COMPLETED: "Selesai",
    SC_CANCELLED: "Dibatalkan",
}

export const subcontractStatusColors: Record<SubcontractOrderStatus, string> = {
    SC_DRAFT: "bg-zinc-100 text-zinc-600 border-zinc-300",
    SC_SENT: "bg-blue-100 text-blue-700 border-blue-300",
    SC_IN_PROGRESS: "bg-amber-100 text-amber-700 border-amber-300",
    SC_PARTIAL_COMPLETE: "bg-purple-100 text-purple-700 border-purple-300",
    SC_COMPLETED: "bg-emerald-100 text-emerald-700 border-emerald-300",
    SC_CANCELLED: "bg-red-100 text-red-700 border-red-300",
}

// ==============================================================================
// Pure helpers
// ==============================================================================

export function canTransitionTo(
    current: SubcontractOrderStatus,
    next: SubcontractOrderStatus
): boolean {
    const allowed = allowedSubcontractTransitions[current] || []
    return allowed.includes(next)
}

export function getNextStatuses(
    current: SubcontractOrderStatus
): SubcontractOrderStatus[] {
    return allowedSubcontractTransitions[current] || []
}

export function isTerminal(status: SubcontractOrderStatus): boolean {
    return status === "SC_COMPLETED" || status === "SC_CANCELLED"
}

export function isActive(status: SubcontractOrderStatus): boolean {
    return !isTerminal(status) && status !== "SC_DRAFT"
}
