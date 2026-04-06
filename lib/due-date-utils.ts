/**
 * Shared due-date classification utilities for AP and AR aging.
 *
 * RULE: dueDate === today is NOT overdue. It's "Jatuh Tempo Hari Ini".
 * OVERDUE only when daysLate >= 1 (strictly past due).
 */

export type DueDateStatus =
    | 'BELUM_JATUH_TEMPO'    // not yet due
    | 'JATUH_TEMPO_HARI_INI' // due today — needs attention but not overdue
    | 'OVERDUE'              // past due

export type AgingBucket =
    | 'current'       // BELUM JATUH TEMPO — not yet due
    | 'hari_ini'      // HARI INI — due today
    | '1-30'          // 1-30 days overdue
    | '31-60'         // 31-60 days overdue
    | '61-90'         // 61-90 days overdue
    | '90+'           // >90 days overdue

/** Strip time component — compare dates only */
function stripTime(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** Number of days late (negative = not yet due, 0 = today, positive = overdue) */
export function getDaysLate(dueDate: Date | string): number {
    const today = stripTime(new Date())
    const due = stripTime(new Date(dueDate))
    return Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
}

/** Classify a due date into one of three statuses */
export function getDueDateStatus(dueDate: Date | string): DueDateStatus {
    const daysLate = getDaysLate(dueDate)
    if (daysLate < 0) return 'BELUM_JATUH_TEMPO'
    if (daysLate === 0) return 'JATUH_TEMPO_HARI_INI'
    return 'OVERDUE'
}

/** Classify a due date into an aging bucket */
export function getAgingBucket(dueDate: Date | string): AgingBucket {
    const daysLate = getDaysLate(dueDate)
    if (daysLate < 0) return 'current'
    if (daysLate === 0) return 'hari_ini'
    if (daysLate <= 30) return '1-30'
    if (daysLate <= 60) return '31-60'
    if (daysLate <= 90) return '61-90'
    return '90+'
}

/** Boolean helpers used by list views */
export function isOverdue(dueDate: Date | string): boolean {
    return getDaysLate(dueDate) > 0
}

export function isDueToday(dueDate: Date | string): boolean {
    return getDaysLate(dueDate) === 0
}
