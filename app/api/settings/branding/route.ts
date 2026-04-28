// app/api/settings/branding/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getAuthzUser, assertRole } from '@/lib/authz'

const BRAND_ADMIN_ROLES = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR']
const LOGO_KEY_RE = /^_brand\/[a-z0-9-]+\.(png|jpg|jpeg|svg|webp)$/i

export async function GET() {
    try {
        await getAuthzUser()  // any authenticated user can READ branding (logo+name shown in UI)
        const config = await prisma.tenantConfig.findFirst()
        return NextResponse.json({ data: config })
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const user = await getAuthzUser()
        assertRole(user, BRAND_ADMIN_ROLES)  // throws "Forbidden" if not allowed

        const body = await req.json()

        // Validate logoStorageKey if provided (defense against arbitrary path injection)
        if (body.logoStorageKey != null && body.logoStorageKey !== '' && !LOGO_KEY_RE.test(body.logoStorageKey)) {
            return NextResponse.json({ error: 'Format key logo tidak valid (harus _brand/<nama>.png|jpg|svg|webp)' }, { status: 400 })
        }

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
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        if (e.message === 'Forbidden') return NextResponse.json({ error: e.message }, { status: 403 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
