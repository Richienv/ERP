// app/api/settings/branding/logo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { uploadDocument, deleteDocument } from '@/lib/storage/document-storage'
import { prisma } from '@/lib/db'
import { getAuthzUser, assertRole } from '@/lib/authz'
import { randomUUID } from 'crypto'

const ADMIN_ROLES = ['ROLE_ADMIN', 'ROLE_CEO', 'ROLE_DIRECTOR']
const MAX_SIZE = 2 * 1024 * 1024  // 2MB
const ALLOWED_MIME: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/svg+xml': '.svg',
    'image/webp': '.webp',
}

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthzUser()
        assertRole(user, ADMIN_ROLES)

        const formData = await req.formData()
        const file = formData.get('file') as File | null
        if (!file) return NextResponse.json({ error: 'file field required' }, { status: 400 })

        if (!ALLOWED_MIME[file.type]) {
            return NextResponse.json({ error: 'Format harus PNG/JPG/SVG/WebP' }, { status: 400 })
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: 'Ukuran maksimal 2MB' }, { status: 400 })
        }

        const ext = ALLOWED_MIME[file.type]
        const key = `_brand/logo-${randomUUID()}${ext}`
        const buffer = Buffer.from(await file.arrayBuffer())

        await uploadDocument(buffer, key, file.type)

        // Delete previous logo (best-effort)
        const config = await prisma.tenantConfig.findFirst()
        const oldKey = config?.logoStorageKey
        if (oldKey && oldKey !== key) {
            await deleteDocument(oldKey).catch(() => {})
        }

        // Update TenantConfig with new key
        if (config) {
            await prisma.tenantConfig.update({
                where: { id: config.id },
                data: { logoStorageKey: key },
            })
        } else {
            await prisma.tenantConfig.create({
                data: { tenantSlug: 'default', tenantName: 'Perusahaan Anda', logoStorageKey: key },
            })
        }

        return NextResponse.json({ data: { logoStorageKey: key } })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        if (e.message === 'Forbidden') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        console.error('[POST /api/settings/branding/logo] error:', e)
        const detail = process.env.NODE_ENV === 'production' ? undefined : e?.message
        return NextResponse.json({ error: 'Internal error', detail }, { status: 500 })
    }
}
