import { NextRequest, NextResponse } from 'next/server'
import { logDistribution } from '@/lib/documents/document-service'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

const VALID_ACTIONS = ['PRINT', 'DOWNLOAD', 'EMAIL'] as const

export async function GET(req: NextRequest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const snapshotId = req.nextUrl.searchParams.get('snapshotId')
    if (!snapshotId) return NextResponse.json({ error: 'snapshotId required' }, { status: 400 })

    const list = await prisma.documentDistribution.findMany({
        where: { snapshotId },
        orderBy: { timestamp: 'desc' },
    })
    return NextResponse.json({ data: list })
}

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await req.json()
        if (!VALID_ACTIONS.includes(body.action)) {
            return NextResponse.json({ error: `action must be one of ${VALID_ACTIONS.join(', ')}` }, { status: 400 })
        }

        const dist = await logDistribution({
            snapshotId: body.snapshotId,
            action: body.action,
            actorId: user.id,
            recipientEmail: body.recipientEmail,
            notes: body.notes,
        })

        // EMAIL stub — Phase E real SMTP later
        if (body.action === 'EMAIL') {
            console.log(`[EMAIL STUB] snapshot=${body.snapshotId} → ${body.recipientEmail} ("${body.notes ?? ''}")`)
        }

        return NextResponse.json({ data: dist })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
