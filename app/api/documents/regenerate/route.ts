// app/api/documents/regenerate/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { regenerateSnapshot } from '@/lib/documents/document-service'
import { prisma } from '@/lib/db'
import { getAuthzUser } from '@/lib/authz'
import { canViewEntity } from '@/lib/documents/entity-authz'

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthzUser()
        const { snapshotId } = await req.json()
        if (!snapshotId) return NextResponse.json({ error: 'snapshotId required' }, { status: 400 })

        const snap = await prisma.documentSnapshot.findUnique({ where: { id: snapshotId } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!(await canViewEntity(user, snap.type, snap.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const newSnap = await regenerateSnapshot(snapshotId, user.id)
        return NextResponse.json({ data: newSnap })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
