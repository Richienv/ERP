import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// DELETE /api/manufacturing/bom-templates/[id]
export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { id } = await params
        const template = await prisma.bOMTemplate.findUnique({ where: { id } })
        if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (template.isBuiltIn) return NextResponse.json({ error: 'Built-in templates cannot be deleted' }, { status: 403 })

        await prisma.bOMTemplate.delete({ where: { id } })
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
