import { NextRequest, NextResponse } from 'next/server'
import { generateSnapshot, listVersions } from '@/lib/documents/document-service'
import { canViewEntity } from '@/lib/documents/entity-authz'
import { getAuthzUser } from '@/lib/authz'

export async function GET(req: NextRequest) {
    try {
        const user = await getAuthzUser()
        const type = req.nextUrl.searchParams.get('type') as any
        const entityId = req.nextUrl.searchParams.get('entityId')
        if (!type || !entityId) return NextResponse.json({ error: 'type + entityId required' }, { status: 400 })

        if (!(await canViewEntity(user, type, entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const list = await listVersions(type, entityId)
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
        if (!body.type || !body.entityId) {
            return NextResponse.json({ error: 'type + entityId required' }, { status: 400 })
        }
        if (!(await canViewEntity(user, body.type, body.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const snap = await generateSnapshot({
            type: body.type,
            entityId: body.entityId,
            trigger: 'MANUAL',
            actorId: user.id,
            metadata: body.metadata,
        })
        return NextResponse.json({ data: snap })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
