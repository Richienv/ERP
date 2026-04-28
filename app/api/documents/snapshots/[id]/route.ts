import { NextRequest, NextResponse } from 'next/server'
import { updateMetadata } from '@/lib/documents/document-service'
import { getDocumentSignedUrl } from '@/lib/storage/document-storage'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth()
        const { id } = await params
        const snap = await prisma.documentSnapshot.findUnique({ where: { id } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        const url = await getDocumentSignedUrl(snap.storageKey, 60 * 60)
        return NextResponse.json({ data: { ...snap, signedUrl: url } })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 })
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth()
        const { id } = await params
        const body = await req.json()
        const updated = await updateMetadata({
            snapshotId: id,
            label: body.label, tags: body.tags, archivedAt: body.archivedAt,
        })
        return NextResponse.json({ data: updated })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
