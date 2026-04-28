import { NextRequest, NextResponse } from 'next/server'
import { generateSnapshot, listVersions } from '@/lib/documents/document-service'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

export async function GET(req: NextRequest) {
    try {
        await requireAuth()
        const type = req.nextUrl.searchParams.get('type') as any
        const entityId = req.nextUrl.searchParams.get('entityId')
        if (!type || !entityId) return NextResponse.json({ error: 'type + entityId required' }, { status: 400 })
        const list = await listVersions(type, entityId)
        return NextResponse.json({ data: list })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 })
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await requireAuth()
        const body = await req.json()
        const snap = await generateSnapshot({
            type: body.type, entityId: body.entityId, trigger: 'MANUAL', actorId: user.id, metadata: body.metadata,
        })
        return NextResponse.json({ data: snap })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
