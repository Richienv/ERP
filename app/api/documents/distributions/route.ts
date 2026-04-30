// app/api/documents/distributions/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { logDistribution } from '@/lib/documents/document-service'
import { prisma } from '@/lib/db'
import { getAuthzUser } from '@/lib/authz'
import { canViewEntity } from '@/lib/documents/entity-authz'

const VALID_ACTIONS = ['PRINT', 'DOWNLOAD'] as const

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthzUser()
        const snapshotId = req.nextUrl.searchParams.get('snapshotId')
        if (!snapshotId) return NextResponse.json({ error: 'snapshotId required' }, { status: 400 })

        const snap = await prisma.documentSnapshot.findUnique({ where: { id: snapshotId } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!(await canViewEntity(user, snap.type, snap.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const list = await prisma.documentDistribution.findMany({
            where: { snapshotId },
            orderBy: { timestamp: 'desc' },
        })
        return NextResponse.json({ data: list })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthzUser()
        const body = await req.json()

        if (!VALID_ACTIONS.includes(body.action)) {
            return NextResponse.json({ error: `action must be one of ${VALID_ACTIONS.join(', ')}` }, { status: 400 })
        }

        const snap = await prisma.documentSnapshot.findUnique({ where: { id: body.snapshotId } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!(await canViewEntity(user, snap.type, snap.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const dist = await logDistribution({
            snapshotId: body.snapshotId,
            action: body.action,
            actorId: user.id,
            notes: body.notes,
        })

        return NextResponse.json({ data: dist })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
