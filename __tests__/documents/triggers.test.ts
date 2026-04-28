import { describe, it, expect, vi } from 'vitest'
import { AUTO_TRIGGERS, fireTrigger } from '@/lib/documents/triggers'

vi.mock('@/lib/documents/document-service', () => ({
    generateSnapshot: vi.fn(() => Promise.resolve({ id: 'snap-1', version: 1 })),
}))

describe('AUTO_TRIGGERS registry', () => {
    it('contains expected keys', () => {
        expect(AUTO_TRIGGERS.PO_APPROVED).toBeDefined()
        expect(AUTO_TRIGGERS.PO_ORDERED).toBeDefined()
        expect(AUTO_TRIGGERS.PR_APPROVED).toBeDefined()
        expect(AUTO_TRIGGERS.GRN_ACCEPTED).toBeDefined()
        expect(AUTO_TRIGGERS.INVOICE_ISSUED).toBeDefined()
    })

    it('each trigger has a type and event', () => {
        for (const trigger of Object.values(AUTO_TRIGGERS)) {
            expect(trigger.type).toBeTruthy()
            expect(trigger.event).toBeTruthy()
        }
    })
})

describe('fireTrigger', () => {
    it('calls generateSnapshot with mapped type + event', async () => {
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        await fireTrigger('PO_APPROVED', 'po-uuid', 'user-uuid')
        expect(generateSnapshot).toHaveBeenCalledWith({
            type: 'PO',
            entityId: 'po-uuid',
            trigger: 'AUTO_PO_APPROVED',
            actorId: 'user-uuid',
        })
    })

    it('does NOT throw when generateSnapshot rejects (fire-and-forget)', async () => {
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        ;(generateSnapshot as any).mockRejectedValueOnce(new Error('render failed'))
        await expect(fireTrigger('PO_APPROVED', 'po-uuid', 'user-uuid')).resolves.not.toThrow()
    })
})
