import { TransferStatus } from "@prisma/client"

/**
 * Stock Transfer State Machine
 *
 * Flow: DRAFT → PENDING_APPROVAL → APPROVED → IN_TRANSIT → RECEIVED
 *       Any non-terminal state → CANCELLED
 */

export const TRANSFER_TRANSITIONS: Partial<Record<TransferStatus, TransferStatus[]>> = {
    DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
    PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
    APPROVED: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['RECEIVED', 'CANCELLED'],
}

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
    DRAFT: 'Draft',
    PENDING_APPROVAL: 'Menunggu Approval',
    APPROVED: 'Disetujui',
    IN_TRANSIT: 'Dalam Perjalanan',
    RECEIVED: 'Diterima',
    CANCELLED: 'Dibatalkan',
}

export const TRANSFER_STATUS_COLORS: Record<TransferStatus, { bg: string; text: string }> = {
    DRAFT: { bg: 'bg-zinc-100', text: 'text-zinc-600' },
    PENDING_APPROVAL: { bg: 'bg-amber-100', text: 'text-amber-700' },
    APPROVED: { bg: 'bg-blue-100', text: 'text-blue-700' },
    IN_TRANSIT: { bg: 'bg-violet-100', text: 'text-violet-700' },
    RECEIVED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    CANCELLED: { bg: 'bg-red-100', text: 'text-red-600' },
}

export function getAllowedTransferTransitions(current: TransferStatus): TransferStatus[] {
    return TRANSFER_TRANSITIONS[current] ?? []
}

export function assertTransferTransition(current: TransferStatus, next: TransferStatus): void {
    const allowed = getAllowedTransferTransitions(current)
    if (!allowed.includes(next)) {
        throw new Error(
            `Transisi transfer tidak valid: ${TRANSFER_STATUS_LABELS[current]} → ${TRANSFER_STATUS_LABELS[next]}. ` +
            `Yang diperbolehkan: ${allowed.map(s => TRANSFER_STATUS_LABELS[s]).join(', ') || 'tidak ada'}`
        )
    }
}

export function isTransferTerminal(status: TransferStatus): boolean {
    return status === 'RECEIVED' || status === 'CANCELLED'
}
