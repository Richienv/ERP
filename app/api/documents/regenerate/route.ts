import { NextRequest, NextResponse } from 'next/server'
import { regenerateSnapshot } from '@/lib/documents/document-service'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        const { snapshotId } = await req.json()
        if (!snapshotId) return NextResponse.json({ error: 'snapshotId required' }, { status: 400 })
        const snap = await regenerateSnapshot(snapshotId, user.id)
        return NextResponse.json({ data: snap })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
