import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

describe('DocumentSnapshot model', () => {
    const entityId = randomUUID()

    afterEach(async () => {
        await prisma.documentSnapshot.deleteMany({ where: { entityId } })
    })

    it('inserts v1 successfully', async () => {
        const snap = await prisma.documentSnapshot.create({
            data: {
                type: 'PO',
                entityId,
                version: 1,
                storageKey: `PO/${entityId}/v1.pdf`,
                triggerEvent: 'AUTO_PO_APPROVED',
            },
        })
        expect(snap.version).toBe(1)
    })

    it('rejects duplicate (type, entityId, version)', async () => {
        await prisma.documentSnapshot.create({
            data: { type: 'PO', entityId, version: 1, storageKey: 'k1', triggerEvent: 't' },
        })
        await expect(
            prisma.documentSnapshot.create({
                data: { type: 'PO', entityId, version: 1, storageKey: 'k2', triggerEvent: 't' },
            })
        ).rejects.toThrow()
    })

    it('lists snapshots in descending version order', async () => {
        await prisma.documentSnapshot.createMany({
            data: [
                { type: 'PO', entityId, version: 1, storageKey: 'v1', triggerEvent: 't' },
                { type: 'PO', entityId, version: 2, storageKey: 'v2', triggerEvent: 't' },
                { type: 'PO', entityId, version: 3, storageKey: 'v3', triggerEvent: 't' },
            ],
        })
        const list = await prisma.documentSnapshot.findMany({
            where: { type: 'PO', entityId },
            orderBy: { version: 'desc' },
        })
        expect(list.map(s => s.version)).toEqual([3, 2, 1])
    })

    it('cascade deletes distributions when snapshot deleted', async () => {
        const snap = await prisma.documentSnapshot.create({
            data: { type: 'PO', entityId, version: 1, storageKey: 'k', triggerEvent: 't' },
        })
        await prisma.documentDistribution.create({
            data: { snapshotId: snap.id, action: 'PRINT', actorId: randomUUID() },
        })
        await prisma.documentSnapshot.delete({ where: { id: snap.id } })
        const dists = await prisma.documentDistribution.findMany({ where: { snapshotId: snap.id } })
        expect(dists).toHaveLength(0)
    }, 30000) // remote Supabase round-trips push this past the 5s default
})
