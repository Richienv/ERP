import { NextRequest, NextResponse } from 'next/server'
import { updateMetadata } from '@/lib/documents/document-service'
import { getDocumentSignedUrl } from '@/lib/storage/document-storage'
import { prisma } from '@/lib/db'
import { getAuthzUser } from '@/lib/authz'
import { canViewEntity } from '@/lib/documents/entity-authz'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getAuthzUser()
        const { id } = await params
        const snap = await prisma.documentSnapshot.findUnique({ where: { id } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!(await canViewEntity(user, snap.type, snap.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const url = await getDocumentSignedUrl(snap.storageKey)
        return NextResponse.json({ data: { ...snap, signedUrl: url } })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getAuthzUser()
        const { id } = await params
        const snap = await prisma.documentSnapshot.findUnique({ where: { id } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!(await canViewEntity(user, snap.type, snap.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const body = await req.json()
        const updated = await updateMetadata({
            snapshotId: id,
            label: body.label,
            tags: body.tags,
            archivedAt: body.archivedAt,
        })
        return NextResponse.json({ data: updated })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
