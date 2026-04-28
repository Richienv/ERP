import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

export async function GET() {
    try {
        await requireAuth()
        const config = await prisma.tenantConfig.findFirst()
        return NextResponse.json({ data: config })
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
}

export async function PATCH(req: NextRequest) {
    try {
        await requireAuth()
        const body = await req.json()
        const config = await prisma.tenantConfig.findFirst()
        const id = config?.id

        const updated = id
            ? await prisma.tenantConfig.update({
                  where: { id },
                  data: {
                      tenantName: body.tenantName,
                      companyAddress: body.companyAddress,
                      companyNpwp: body.companyNpwp,
                      companyEmail: body.companyEmail,
                      companyPhone: body.companyPhone,
                      primaryColor: body.primaryColor,
                      logoStorageKey: body.logoStorageKey,
                  },
              })
            : await prisma.tenantConfig.create({
                  data: {
                      tenantSlug: 'default',
                      tenantName: body.tenantName ?? 'Perusahaan Anda',
                      companyAddress: body.companyAddress,
                      companyNpwp: body.companyNpwp,
                      companyEmail: body.companyEmail,
                      companyPhone: body.companyPhone,
                      primaryColor: body.primaryColor,
                      logoStorageKey: body.logoStorageKey,
                  },
              })

        return NextResponse.json({ data: updated })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
