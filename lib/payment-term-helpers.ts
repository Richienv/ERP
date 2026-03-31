/**
 * Convert legacy PaymentTermLegacy enum value to days.
 * Used as fallback when the new PaymentTerm model is not yet referenced.
 */
export function legacyTermToDays(term: string): number {
    const map: Record<string, number> = {
        CASH: 0,
        COD: 0,
        NET_15: 15,
        NET_30: 30,
        NET_45: 45,
        NET_60: 60,
        NET_90: 90,
    }
    return map[term] ?? 30
}

/**
 * Calculate due date from issue date + payment term days.
 * Does not mutate the input date.
 */
export function calculateDueDate(issueDate: Date, days: number): Date {
    const due = new Date(issueDate)
    due.setUTCDate(due.getUTCDate() + days)
    return due
}
