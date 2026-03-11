import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

// GET /api/system/settings?key=xxx  — or all settings if no key
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const key = request.nextUrl.searchParams.get('key')

        if (key) {
            const setting = await prisma.systemSetting.findUnique({ where: { key } })
            return NextResponse.json({ value: setting?.value ?? null })
        }

        const settings = await prisma.systemSetting.findMany({ orderBy: { key: 'asc' } })
        return NextResponse.json({ settings })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

// PATCH /api/system/settings  — body: { key, value, description? }
export async function PATCH(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const body = await request.json()
        const { key, value, description } = body as { key: string; value: string; description?: string }

        if (!key || value === undefined) {
            return NextResponse.json({ error: 'key and value required' }, { status: 400 })
        }

        const setting = await prisma.systemSetting.upsert({
            where: { key },
            create: { key, value: String(value), description },
            update: { value: String(value), ...(description ? { description } : {}) },
        })

        return NextResponse.json({ setting })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}
