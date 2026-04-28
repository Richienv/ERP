import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import type { DocType, DocumentSnapshot, DocumentDistribution } from '@prisma/client'
import { DocumentService as TypstService } from '@/lib/services/document-service'
import { uploadDocument } from '@/lib/storage/document-storage'
import { buildRenderTarget } from '@/lib/documents/render-adapter'
import { resolveBrandInputs } from '@/lib/documents/brand-resolver'

interface GenerateInput {
    type: DocType
    entityId: string
    trigger: string
    actorId?: string | null
    metadata?: Record<string, unknown>
}

export async function generateSnapshot(input: GenerateInput): Promise<DocumentSnapshot> {
    const { type, entityId, trigger, actorId, metadata } = input

    // 1. Build render target (template name + entity payload)
    const target = await buildRenderTarget(type, entityId)

    // 2. Resolve brand inputs from TenantConfig
    const brand = await resolveBrandInputs()

    // 3. Render PDF — brand fields passed as separate --input flags so templates
    //    can read them via sys.inputs.company_name (matches the shared brand
    //    module from Phase B).
    const pdfBuffer = await TypstService.generatePDF(
        target.templateName,
        target.payload,
        brand as unknown as Record<string, string>,
    )

    // 4. Compute next version (race-safe via @@unique constraint + retry)
    let version = (await prisma.documentSnapshot.count({ where: { type, entityId } })) + 1
    const storageKey = `${type}/${entityId}/v${version}-${randomUUID()}.pdf`

    // 5. Upload first — if storage fails, no DB row created
    await uploadDocument(pdfBuffer, storageKey)

    // 6. Insert DB row (retry once on race-condition unique violation)
    try {
        return await prisma.documentSnapshot.create({
            data: {
                type, entityId, version, storageKey,
                triggerEvent: trigger,
                generatedBy: actorId ?? null,
                metadata: metadata as any,
            },
        })
    } catch (e: any) {
        if (e.code === 'P2002') {
            version = (await prisma.documentSnapshot.count({ where: { type, entityId } })) + 1
            const retryKey = `${type}/${entityId}/v${version}-${randomUUID()}.pdf`
            await uploadDocument(pdfBuffer, retryKey)
            return prisma.documentSnapshot.create({
                data: {
                    type, entityId, version, storageKey: retryKey,
                    triggerEvent: trigger,
                    generatedBy: actorId ?? null,
                    metadata: metadata as any,
                },
            })
        }
        throw e
    }
}

export async function regenerateSnapshot(snapshotId: string, actorId?: string | null): Promise<DocumentSnapshot> {
    const original = await prisma.documentSnapshot.findUnique({ where: { id: snapshotId } })
    if (!original) throw new Error(`Snapshot not found: ${snapshotId}`)
    return generateSnapshot({
        type: original.type,
        entityId: original.entityId,
        trigger: 'MANUAL_REGENERATE',
        actorId,
    })
}

export async function listVersions(type: DocType, entityId: string): Promise<DocumentSnapshot[]> {
    return prisma.documentSnapshot.findMany({
        where: { type, entityId, archivedAt: null },
        orderBy: { version: 'desc' },
        include: { distributions: true } as any,
    })
}

interface LogDistInput {
    snapshotId: string
    action: 'PRINT' | 'DOWNLOAD' | 'EMAIL'
    actorId: string
    recipientEmail?: string
    notes?: string
}

export async function logDistribution(input: LogDistInput): Promise<DocumentDistribution> {
    return prisma.documentDistribution.create({ data: input })
}

interface UpdateMetaInput {
    snapshotId: string
    label?: string
    tags?: string[]
    archivedAt?: Date | null
}

export async function updateMetadata(input: UpdateMetaInput): Promise<DocumentSnapshot> {
    const { snapshotId, ...rest } = input
    return prisma.documentSnapshot.update({ where: { id: snapshotId }, data: rest })
}
