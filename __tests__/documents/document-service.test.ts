import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSnapshot, listVersions, logDistribution, updateMetadata } from '@/lib/documents/document-service'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

vi.mock('@/lib/services/document-service', () => ({
    DocumentService: { generatePDF: vi.fn(() => Promise.resolve(Buffer.from('fake-pdf'))) },
}))
vi.mock('@/lib/storage/document-storage', () => ({
    uploadDocument: vi.fn((_, key) => Promise.resolve(key)),
    getDocumentSignedUrl: vi.fn(() => Promise.resolve('https://signed')),
}))
vi.mock('@/lib/documents/render-adapter', () => ({
    buildRenderTarget: vi.fn(() => Promise.resolve({ templateName: 'purchase_order', payload: { foo: 'bar' } })),
}))
vi.mock('@/lib/documents/brand-resolver', () => ({
    resolveBrandInputs: vi.fn(() => Promise.resolve({ company_name: 'Test Co', brand_color: '#000' })),
}))

describe('generateSnapshot', () => {
    const entityId = randomUUID()
    const actorId = randomUUID()

    beforeEach(async () => {
        await prisma.documentSnapshot.deleteMany({ where: { entityId } })
    })

    it('creates v1 on first call', async () => {
        const snap = await generateSnapshot({ type: 'PO', entityId, trigger: 'AUTO_PO_APPROVED', actorId })
        expect(snap.version).toBe(1)
        expect(snap.storageKey).toContain(`PO/${entityId}/v1`)
    })

    it('creates v2 on second call (auto-increments)', async () => {
        await generateSnapshot({ type: 'PO', entityId, trigger: 'AUTO_PO_APPROVED', actorId })
        const snap2 = await generateSnapshot({ type: 'PO', entityId, trigger: 'MANUAL_REGENERATE', actorId })
        expect(snap2.version).toBe(2)
    }, 30000)

    it('does NOT insert row when render fails', async () => {
        const { DocumentService } = await import('@/lib/services/document-service')
        ;(DocumentService.generatePDF as any).mockRejectedValueOnce(new Error('render fail'))
        await expect(generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId })).rejects.toThrow()
        const snaps = await prisma.documentSnapshot.findMany({ where: { entityId } })
        expect(snaps).toHaveLength(0)
    })
})

describe('listVersions', () => {
    const entityId = randomUUID()
    beforeEach(async () => { await prisma.documentSnapshot.deleteMany({ where: { entityId } }) })

    it('returns versions descending', async () => {
        await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        const list = await listVersions('PO', entityId)
        expect(list.map(v => v.version)).toEqual([2, 1])
    }, 30000)
})

describe('logDistribution', () => {
    it('inserts a distribution row linked to snapshot', async () => {
        const entityId = randomUUID()
        const snap = await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        const dist = await logDistribution({
            snapshotId: snap.id,
            action: 'PRINT',
            actorId: randomUUID(),
        })
        expect(dist.action).toBe('PRINT')
    })
})

describe('updateMetadata', () => {
    it('updates label without touching storageKey', async () => {
        const entityId = randomUUID()
        const snap = await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        const updated = await updateMetadata({ snapshotId: snap.id, label: 'Final v1' })
        expect(updated.label).toBe('Final v1')
        expect(updated.storageKey).toBe(snap.storageKey)
    })
})
