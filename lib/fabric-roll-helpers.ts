// Pure functions extracted from fabric-rolls server actions (Next.js requires
// all exports from "use server" files to be async).

import type { FabricRollStatus } from "@prisma/client"

/**
 * Calculate remaining meters on a fabric roll from its transactions.
 * RECEIVE adds meters, CUT/TRANSFER subtracts, ADJUST can be +/-.
 */
export function calculateRemainingMeters(
    initialLength: number,
    transactions: { type: string; meters: number }[]
): number {
    let remaining = initialLength
    for (const tx of transactions) {
        switch (tx.type) {
            case 'FR_RECEIVE':
                remaining += tx.meters
                break
            case 'FR_CUT':
            case 'FR_TRANSFER':
                remaining -= tx.meters
                break
            case 'FR_ADJUST':
                // Adjust can be positive or negative
                remaining += tx.meters
                break
        }
    }
    return Math.max(0, Math.round(remaining * 100) / 100)
}

/**
 * Determine roll status based on remaining meters.
 */
export function determineRollStatus(
    remainingMeters: number,
    currentStatus: FabricRollStatus
): FabricRollStatus {
    if (remainingMeters <= 0) return 'DEPLETED'
    if (currentStatus === 'RESERVED') return 'RESERVED'
    return 'AVAILABLE'
}
