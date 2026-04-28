import { describe, it, expect, vi } from 'vitest'
import { fireTrigger } from '@/lib/documents/triggers'

vi.mock('@/lib/documents/document-service', () => ({
    generateSnapshot: vi.fn(() => Promise.resolve({ id: 'snap-1', version: 1 })),
}))

describe('PO auto-trigger contract', () => {
    it('fireTrigger("PO_APPROVED") resolves to a snapshot', async () => {
        await expect(fireTrigger('PO_APPROVED', 'po-1', 'user-1')).resolves.not.toThrow()
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        expect(generateSnapshot).toHaveBeenCalledWith({
            type: 'PO',
            entityId: 'po-1',
            trigger: 'AUTO_PO_APPROVED',
            actorId: 'user-1',
        })
    })

    it('fireTrigger("PO_ORDERED") uses the SENT event tag', async () => {
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        ;(generateSnapshot as any).mockClear()
        await fireTrigger('PO_ORDERED', 'po-1', 'user-1')
        expect(generateSnapshot).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'AUTO_PO_SENT' }))
    })

    it('approval-side: fireTrigger does not throw if generateSnapshot fails', async () => {
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        ;(generateSnapshot as any).mockRejectedValueOnce(new Error('render fail'))
        await expect(fireTrigger('PO_APPROVED', 'po-1', 'user-1')).resolves.not.toThrow()
    })
})
