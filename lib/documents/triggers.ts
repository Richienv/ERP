import type { DocType } from '@prisma/client'
import { generateSnapshot } from '@/lib/documents/document-service'

export const AUTO_TRIGGERS = {
    PO_APPROVED:    { type: 'PO'         as DocType, event: 'AUTO_PO_APPROVED' },
    PO_ORDERED:     { type: 'PO'         as DocType, event: 'AUTO_PO_SENT' },
    PR_APPROVED:    { type: 'PR'         as DocType, event: 'AUTO_PR_APPROVED' },
    GRN_ACCEPTED:   { type: 'GRN'        as DocType, event: 'AUTO_GRN_ACCEPTED' },
    INVOICE_ISSUED: { type: 'INVOICE_AR' as DocType, event: 'AUTO_INVOICE_ISSUED' },
} as const

export type AutoTriggerKey = keyof typeof AUTO_TRIGGERS

export async function fireTrigger(
    key: AutoTriggerKey,
    entityId: string,
    actorId: string,
): Promise<void> {
    const trigger = AUTO_TRIGGERS[key]
    try {
        await generateSnapshot({
            type: trigger.type,
            entityId,
            trigger: trigger.event,
            actorId,
        })
    } catch (err) {
        // fire-and-forget: never block the caller's business action
        console.error(`[fireTrigger ${key}] failed:`, err)
    }
}
