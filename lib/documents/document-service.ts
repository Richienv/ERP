import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import type { DocType, DocumentSnapshot, DocumentDistribution } from '@prisma/client'
import { DocumentService as TypstService } from '@/lib/services/document-service'
import { uploadDocument, deleteDocument } from '@/lib/storage/document-storage'
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

    return generateWithRetry(type, entityId, trigger, actorId, metadata, pdfBuffer, 0)
}

async function generateWithRetry(
    type: DocType,
    entityId: string,
    trigger: string,
    actorId: string | null | undefined,
    metadata: Record<string, unknown> | undefined,
    pdfBuffer: Buffer,
    attempt: number,
): Promise<DocumentSnapshot> {
    const MAX_ATTEMPTS = 3

    // Use MAX(version) + 1 instead of count() — handles version gaps from
    // archived/hard-deleted snapshots without collision.
    const last = await prisma.documentSnapshot.findFirst({
        where: { type, entityId },
        orderBy: { version: 'desc' },
        select: { version: true },
    })
    const version = (last?.version ?? 0) + 1
    const storageKey = `${type}/${entityId}/v${version}-${randomUUID()}.pdf`

    // Upload first — if storage fails, no DB row created
    await uploadDocument(pdfBuffer, storageKey)

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
        // Cleanup orphan blob — best-effort (deleteDocument swallows internal errors)
        await deleteDocument(storageKey).catch(() => {})

        if (e.code === 'P2002' && attempt < MAX_ATTEMPTS - 1) {
            return generateWithRetry(type, entityId, trigger, actorId, metadata, pdfBuffer, attempt + 1)
        }
        if (e.code === 'P2002') {
            throw new Error(`Snapshot create retried ${MAX_ATTEMPTS}x for ${type}/${entityId}: ${e.message}`)
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
