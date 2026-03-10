// Pure functions extracted from fabric-rolls server actions (Next.js requires
// all exports from "use server" files to be async).

import type { FabricRollStatus } from "@prisma/client"

/**
 * Calculate remaining meters on a fabric roll from its transactions.
 *
 * The roll's `lengthMeters` is the initial/nominal length and serves as a
 * fallback when there are no transactions.  All actual meter tracking flows
 * through transactions:
 *   - FR_RECEIVE adds meters (initial receive records the full length)
 *   - FR_CUT / FR_TRANSFER subtracts meters
 *   - FR_ADJUST can be +/-
 *
 * If transactions exist the remaining is computed purely from them (starting
 * at 0).  If there are NO transactions we fall back to `initialLength` for
 * backwards compatibility with rolls created before the FR_RECEIVE fix.
 */
export function calculateRemainingMeters(
    initialLength: number,
    transactions: { type: string; meters: number }[]
): number {
    // Backwards-compat: rolls without any transactions use nominal length
    if (transactions.length === 0) return Math.max(0, initialLength)

    let remaining = 0
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

    // Backwards-compat: if remaining is 0 because old FR_RECEIVE stored 0m,
    // and no cuts have happened, use initialLength instead
    if (remaining === 0 && transactions.every(t => t.type === 'FR_RECEIVE' && t.meters === 0)) {
        return Math.max(0, initialLength)
    }

    return Math.max(0, Math.round(remaining * 100) / 100)
}

/**
 * Determine roll status based on remaining meters and transaction history.
 *
 * @param remainingMeters - meters left on the roll
 * @param currentStatus   - the roll's current status
 * @param hasCutTransactions - whether the roll has any FR_CUT transactions
 */
export function determineRollStatus(
    remainingMeters: number,
    currentStatus: FabricRollStatus,
    hasCutTransactions: boolean = false
): FabricRollStatus {
    if (remainingMeters <= 0) return 'DEPLETED'
    if (currentStatus === 'RESERVED') return 'RESERVED'
    // Roll has been partially cut but still has remaining meters → IN_USE
    if (hasCutTransactions && remainingMeters > 0) return 'IN_USE'
    return 'AVAILABLE'
}
