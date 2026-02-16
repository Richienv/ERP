// Pure functions extracted from finance-gl server actions (Next.js requires
// all exports from "use server" files to be async).

export type RecurringPattern = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY'

/**
 * Calculate the next occurrence date given a pattern and current date.
 */
export function calculateNextDate(currentDate: Date, pattern: RecurringPattern): Date {
    const next = new Date(currentDate)
    switch (pattern) {
        case 'DAILY':
            next.setDate(next.getDate() + 1)
            break
        case 'WEEKLY':
            next.setDate(next.getDate() + 7)
            break
        case 'MONTHLY':
            next.setMonth(next.getMonth() + 1)
            break
        case 'QUARTERLY':
            next.setMonth(next.getMonth() + 3)
            break
        case 'YEARLY':
            next.setFullYear(next.getFullYear() + 1)
            break
    }
    return next
}
