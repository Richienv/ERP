"use server"

/**
 * ============================================================================
 * DUNNING / COLLECTION — NOT IMPLEMENTED (no database schema)
 * ============================================================================
 *
 * This module was written against a schema that does not exist. Nothing here
 * can run: every call below would fail at runtime.
 *
 * Missing from prisma/schema.prisma (verified — zero matches for "dunning" and
 * "CollectionActivity"):
 *   - model DunningRule        { level, daysAfterDue, action, template, isActive }
 *   - model CollectionActivity { invoiceId, type, notes, outcome, nextAction, date, createdBy }
 *   - Invoice.lastDunningLevel (Int?)
 *   - Invoice.nextDunningDate  (DateTime?)
 *
 * There is also no migration for any of them, and no caller anywhere in the app
 * imports this file — it only ever "compiled" because next.config.ts sets
 * typescript.ignoreBuildErrors.
 *
 * The exported surface is kept so a future implementation keeps the same API,
 * but every entry point now throws an explicit error instead of pretending to
 * work. Do NOT re-enable by casting prisma to `any`: add the models + migration
 * first, then restore the logic (the escalation algorithm is preserved in the
 * reference comment at the bottom of this file).
 */

const DUNNING_NOT_IMPLEMENTED =
    'Fitur dunning/penagihan otomatis belum tersedia — model DunningRule & CollectionActivity ' +
    'belum ada di database schema. Tambahkan model + migration terlebih dahulu.'

export async function getDunningRules(): Promise<never> {
    throw new Error(DUNNING_NOT_IMPLEMENTED)
}

export async function upsertDunningRule(_data: {
    level: number
    daysAfterDue: number
    action: string
    template?: string
    isActive?: boolean
}): Promise<never> {
    throw new Error(DUNNING_NOT_IMPLEMENTED)
}

export async function processDunning(): Promise<never> {
    throw new Error(DUNNING_NOT_IMPLEMENTED)
}

export async function logCollectionActivity(_data: {
    invoiceId: string
    type: string
    notes?: string
    outcome?: string
    nextAction?: string
    createdBy?: string
}): Promise<never> {
    throw new Error(DUNNING_NOT_IMPLEMENTED)
}

export async function getCollectionHistory(_invoiceId: string): Promise<never> {
    throw new Error(DUNNING_NOT_IMPLEMENTED)
}

/* ---------------------------------------------------------------------------
 * REFERENCE — the escalation algorithm that was here before, kept verbatim so
 * it can be restored once the schema exists. It is intentionally inert.
 *
 *   1. Load active DunningRule rows ordered by level asc.
 *   2. Load AR invoices (type INV_OUT) with status OVERDUE and balanceDue > 0.
 *   3. For each invoice compute daysOverdue = floor((now - dueDate) / 1 day).
 *   4. applicableRule = highest rule where daysAfterDue <= daysOverdue.
 *   5. Skip when invoice.lastDunningLevel >= applicableRule.level (no re-send).
 *   6. Otherwise update the invoice:
 *        lastDunningLevel = applicableRule.level
 *        nextDunningDate  = now + (nextRule.daysAfterDue - applicableRule.daysAfterDue) days
 *                           (null when there is no higher rule)
 *      and create a CollectionActivity row:
 *        { invoiceId, type: rule.action, outcome: 'PENDING', createdBy: 'SYSTEM' }
 *   7. Return { processed, escalated, byLevel, items }.
 * ------------------------------------------------------------------------- */
