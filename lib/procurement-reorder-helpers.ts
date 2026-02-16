// ==============================================================================
// Procurement Reorder Pure Functions (extracted from "use server" file)
// ==============================================================================

/**
 * Calculate how many days of stock remain given current stock and daily burn rate.
 * Returns Infinity if burn rate is 0 (no consumption).
 */
export function calculateDaysOfStock(currentStock: number, dailyBurnRate: number): number {
    if (dailyBurnRate <= 0) return Infinity
    return Math.max(0, Math.round((currentStock / dailyBurnRate) * 100) / 100)
}

/**
 * Determine urgency level based on stock position relative to safety thresholds.
 * CRITICAL: stock is at or below safety stock (risk of stockout)
 * WARNING: stock is below reorder level but above safety stock
 * NORMAL: stock is at or above reorder level (but flagged for monitoring)
 */
export function determineUrgency(
    currentStock: number,
    reorderLevel: number,
    safetyStock: number
): 'CRITICAL' | 'WARNING' | 'NORMAL' {
    if (currentStock <= safetyStock) return 'CRITICAL'
    if (currentStock <= reorderLevel) return 'WARNING'
    return 'NORMAL'
}

/**
 * Calculate suggested reorder quantity using the economic order approach:
 * Target: bring stock up to maxStock, accounting for open PO quantities.
 * Minimum: at least enough to cover lead time consumption + safety stock.
 */
export function calculateSuggestedQty(
    currentStock: number,
    maxStock: number,
    safetyStock: number,
    dailyBurnRate: number,
    leadTimeDays: number,
    openPOQty: number
): number {
    // Target quantity = max stock - current stock - already ordered
    const targetQty = maxStock - currentStock - openPOQty

    // Minimum quantity = lead time demand + safety buffer - current stock - open POs
    const leadTimeDemand = Math.ceil(dailyBurnRate * leadTimeDays)
    const minQty = leadTimeDemand + safetyStock - currentStock - openPOQty

    // Take the larger of target and minimum, but never negative
    const suggested = Math.max(targetQty, minQty, 0)

    return Math.ceil(suggested)
}
