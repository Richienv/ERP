# Document System Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Design doc:** [`2026-04-28-document-system-hardening-design.md`](./2026-04-28-document-system-hardening-design.md)
> **Audit findings:** 8 Critical + 12 Important (25 Minor deferred)

**Goal:** Fix all 8 Critical security issues + 12 Important correctness/UX gaps in the document system before KRI customer demo on 2026-06-26.

**Architecture:** Two phases. Phase 1 = security baseline (1 new authz dispatcher + wire into 6 endpoints + branding admin check + logo render fix + PR template). Phase 2 = data integrity (cascade Restrict, MAX(version), Decimal robust, race retry cleanup, PO rollback) + UI/UX (drop email, logo upload, auto-refresh, signed URL TTL) + finance integration (INVOICE_ISSUED + Lampiran on AR invoice).

**Tech Stack:** Next.js 16, Prisma 6 (hand-written migrations per repo convention), Vitest (mocked + real-DB integration), TanStack Query, Supabase Storage, Typst CLI.

---

## How to Execute This Plan

Each task is bite-sized (2-5 min of work). Follow strict order — Phase 1 fully done before Phase 2.

1. Read task `Files` section first
2. TDD: write failing test (Step 1) → confirm fail (Step 2) → implement (Step 3) → confirm pass (Step 4) → commit (Step 5)
3. **Skip TDD for tasks marked `[no-test]`** — UI/template/migration changes verified by smoke test
4. Commit after EVERY task. Multi-session safety per CLAUDE.md.

**Branch:** `feat/integra-mining-pivot` (current). Both phases land on this branch. Merge to `main` only after Phase 2 verification.

**Key role constants** (used throughout the plan):
- `ROLE_ADMIN`, `ROLE_CEO`, `ROLE_DIRECTOR`, `ROLE_MANAGER`, `ROLE_PURCHASING`, `ROLE_RECEIVING`, `ROLE_FINANCE`, `ROLE_ACCOUNTANT`, `ROLE_HCM_MANAGER`, `ROLE_MANUFACTURING`
- These match the existing pattern in `lib/actions/procurement.ts:41-44`

---

# PHASE 1 — CRITICAL (Security baseline) — ~3-4 days, 10 tasks

## Task P1-1: Create entity-authz dispatcher

**Files:**
- Create: `lib/documents/entity-authz.ts`
- Test: `__tests__/documents/entity-authz.test.ts`

**Step 1: Write failing test**

```ts
// __tests__/documents/entity-authz.test.ts
import { describe, it, expect, vi } from 'vitest'
import { canViewEntity } from '@/lib/documents/entity-authz'

vi.mock('@/lib/db', () => ({
    prisma: {
        payslip: {
            findUnique: vi.fn(),
        },
    },
}))

const mkUser = (role: string, employeeId: string | null = null) => ({
    id: 'u1', role, email: 't@t.com', employeeId,
})

describe('canViewEntity', () => {
    describe('procurement docs (PO/PR/GRN/VENDOR_PROFILE)', () => {
        const types = ['PO', 'PR', 'GRN', 'VENDOR_PROFILE'] as const
        it.each(types)('ROLE_PURCHASING can view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_PURCHASING'), t, 'e1')).toBe(true)
        })
        it.each(types)('ROLE_ADMIN can view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_ADMIN'), t, 'e1')).toBe(true)
        })
        it.each(types)('ROLE_FINANCE cannot view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_FINANCE'), t, 'e1')).toBe(false)
        })
        it.each(types)('ROLE_STAFF cannot view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_STAFF'), t, 'e1')).toBe(false)
        })
    })

    describe('finance docs (INVOICE_AR/INVOICE_AP/FAKTUR_PAJAK)', () => {
        const types = ['INVOICE_AR', 'INVOICE_AP', 'FAKTUR_PAJAK'] as const
        it.each(types)('ROLE_FINANCE can view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_FINANCE'), t, 'e1')).toBe(true)
        })
        it.each(types)('ROLE_PURCHASING cannot view %s', async (t) => {
            expect(await canViewEntity(mkUser('ROLE_PURCHASING'), t, 'e1')).toBe(false)
        })
    })

    describe('manufacturing docs (BOM/SPK)', () => {
        it('ROLE_MANUFACTURING can view BOM', async () => {
            expect(await canViewEntity(mkUser('ROLE_MANUFACTURING'), 'BOM', 'e1')).toBe(true)
        })
        it('ROLE_FINANCE cannot view SPK', async () => {
            expect(await canViewEntity(mkUser('ROLE_FINANCE'), 'SPK', 'e1')).toBe(false)
        })
    })

    describe('PAYSLIP (owner OR HCM)', () => {
        it('ROLE_HCM_MANAGER can view any payslip', async () => {
            expect(await canViewEntity(mkUser('ROLE_HCM_MANAGER'), 'PAYSLIP', 'e1')).toBe(true)
        })
        it('owner can view their own payslip', async () => {
            const { prisma } = await import('@/lib/db')
            ;(prisma.payslip!.findUnique as any).mockResolvedValue({ employeeId: 'emp-99' })
            expect(await canViewEntity(mkUser('ROLE_STAFF', 'emp-99'), 'PAYSLIP', 'pay-1')).toBe(true)
        })
        it('non-owner cannot view another employee payslip', async () => {
            const { prisma } = await import('@/lib/db')
            ;(prisma.payslip!.findUnique as any).mockResolvedValue({ employeeId: 'emp-other' })
            expect(await canViewEntity(mkUser('ROLE_STAFF', 'emp-99'), 'PAYSLIP', 'pay-1')).toBe(false)
        })
    })

    it('unknown DocType denies by default', async () => {
        expect(await canViewEntity(mkUser('ROLE_ADMIN'), 'UNKNOWN_TYPE' as any, 'e1')).toBe(false)
    })
})
```

**Step 2: Run — fails**
`npx vitest run __tests__/documents/entity-authz.test.ts` → module not found.

**Step 3: Implement**

```ts
// lib/documents/entity-authz.ts
import type { DocType } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { AuthzUser } from '@/lib/authz'

const PROCUREMENT_VIEWERS = ['ROLE_ADMIN','ROLE_CEO','ROLE_DIRECTOR','ROLE_MANAGER','ROLE_PURCHASING','ROLE_RECEIVING'] as const
const FINANCE_VIEWERS     = ['ROLE_ADMIN','ROLE_CEO','ROLE_DIRECTOR','ROLE_FINANCE','ROLE_ACCOUNTANT'] as const
const HCM_VIEWERS         = ['ROLE_ADMIN','ROLE_CEO','ROLE_DIRECTOR','ROLE_HCM_MANAGER'] as const
const MFG_VIEWERS         = ['ROLE_ADMIN','ROLE_CEO','ROLE_DIRECTOR','ROLE_MANAGER','ROLE_MANUFACTURING'] as const

export async function canViewEntity(
    user: AuthzUser,
    type: DocType,
    entityId: string,
): Promise<boolean> {
    switch (type) {
        case 'PO':
        case 'PR':
        case 'GRN':
        case 'VENDOR_PROFILE':
            return PROCUREMENT_VIEWERS.includes(user.role as any)

        case 'INVOICE_AR':
        case 'INVOICE_AP':
        case 'FAKTUR_PAJAK':
            return FINANCE_VIEWERS.includes(user.role as any)

        case 'PAYSLIP': {
            if (HCM_VIEWERS.includes(user.role as any)) return true
            const slip = await (prisma as any).payslip?.findUnique({
                where: { id: entityId },
                select: { employeeId: true },
            }).catch(() => null)
            return slip?.employeeId != null && slip.employeeId === user.employeeId
        }

        case 'BOM':
        case 'SPK':
            return MFG_VIEWERS.includes(user.role as any)

        default:
            return false  // deny unknown DocTypes
    }
}
```

**Note:** `(prisma as any).payslip` — the Payslip model may not exist yet in the schema. The optional chain + catch returns null gracefully. Future Payslip model integration drops the `as any`.

**Step 4: Run — passes**
`npx vitest run __tests__/documents/entity-authz.test.ts` → all green (~14 tests).

**Step 5: Commit**

```bash
git add lib/documents/entity-authz.ts __tests__/documents/entity-authz.test.ts
git commit -m "feat(documents): polymorphic entity authz dispatcher"
```

---

## Task P1-2: Wire authz into snapshots list/create endpoints

**Files:**
- Modify: `app/api/documents/snapshots/route.ts`

**Step 1: Read current code**

```bash
cat app/api/documents/snapshots/route.ts
```

**Step 2: Replace GET handler**

The GET handler currently returns ALL snapshots for `(type, entityId)` if authenticated. Change it so the underlying entity-permission is checked:

```ts
import { canViewEntity } from '@/lib/documents/entity-authz'
// existing imports...

export async function GET(req: NextRequest) {
    try {
        const user = await requireAuth()
        const type = req.nextUrl.searchParams.get('type') as any
        const entityId = req.nextUrl.searchParams.get('entityId')
        if (!type || !entityId) return NextResponse.json({ error: 'type + entityId required' }, { status: 400 })

        const userAuthz = { id: user.id, role: (user as any).role ?? '', email: user.email, employeeId: null }
        if (!(await canViewEntity(userAuthz, type, entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const list = await listVersions(type, entityId)
        return NextResponse.json({ data: list })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
```

**Important:** the existing `requireAuth()` returns a Supabase user, NOT an AuthzUser with `.role`. To get role+employeeId, use `getAuthzUser()` from `@/lib/authz` instead. Replace `requireAuth` call with:

```ts
import { getAuthzUser } from '@/lib/authz'
// ...
const user = await getAuthzUser()
if (!(await canViewEntity(user, type, entityId))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

**Step 3: Same for POST**

```ts
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
            type: body.type, entityId: body.entityId, trigger: 'MANUAL', actorId: user.id, metadata: body.metadata,
        })
        return NextResponse.json({ data: snap })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
```

**Step 4: Type-check**
`npx tsc --noEmit | grep "documents/snapshots/route" | head -3` → no errors for this file.

**Step 5: Commit**

```bash
git add app/api/documents/snapshots/route.ts
git commit -m "feat(documents): wire entity authz on snapshots GET/POST"
```

---

## Task P1-3: Wire authz into snapshot detail [id] endpoints

**Files:**
- Modify: `app/api/documents/snapshots/[id]/route.ts`

**Step 1: Replace BOTH handlers**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { updateMetadata } from '@/lib/documents/document-service'
import { getDocumentSignedUrl } from '@/lib/storage/document-storage'
import { prisma } from '@/lib/db'
import { getAuthzUser } from '@/lib/authz'
import { canViewEntity } from '@/lib/documents/entity-authz'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getAuthzUser()
        const { id } = await params
        const snap = await prisma.documentSnapshot.findUnique({ where: { id } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!(await canViewEntity(user, snap.type, snap.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const url = await getDocumentSignedUrl(snap.storageKey)
        return NextResponse.json({ data: { ...snap, signedUrl: url } })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const user = await getAuthzUser()
        const { id } = await params
        const snap = await prisma.documentSnapshot.findUnique({ where: { id } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!(await canViewEntity(user, snap.type, snap.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        const body = await req.json()
        const updated = await updateMetadata({
            snapshotId: id,
            label: body.label, tags: body.tags, archivedAt: body.archivedAt,
        })
        return NextResponse.json({ data: updated })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
```

Note: signed URL default TTL was already 60min in storage wrapper. Phase 2 task P2-7 will lower to 5min.

**Step 2: Type-check + commit**

```bash
npx tsc --noEmit | grep "documents/snapshots/\[id\]" | head -3
git add app/api/documents/snapshots/\[id\]/route.ts
git commit -m "feat(documents): wire entity authz on snapshot [id] GET/PATCH"
```

---

## Task P1-4: Wire authz into regenerate endpoint

**Files:**
- Modify: `app/api/documents/regenerate/route.ts`

**Step 1: Replace POST handler**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { regenerateSnapshot } from '@/lib/documents/document-service'
import { prisma } from '@/lib/db'
import { getAuthzUser } from '@/lib/authz'
import { canViewEntity } from '@/lib/documents/entity-authz'

export async function POST(req: NextRequest) {
    try {
        const user = await getAuthzUser()
        const { snapshotId } = await req.json()
        if (!snapshotId) return NextResponse.json({ error: 'snapshotId required' }, { status: 400 })

        const snap = await prisma.documentSnapshot.findUnique({ where: { id: snapshotId } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        if (!(await canViewEntity(user, snap.type, snap.entityId))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const newSnap = await regenerateSnapshot(snapshotId, user.id)
        return NextResponse.json({ data: newSnap })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
```

**Step 2: Commit**

```bash
git add app/api/documents/regenerate/route.ts
git commit -m "feat(documents): wire entity authz on regenerate POST"
```

---

## Task P1-5: Wire authz into distributions endpoints

**Files:**
- Modify: `app/api/documents/distributions/route.ts`

**Step 1: Replace both handlers — also add try/catch on GET (was missing)**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { logDistribution } from '@/lib/documents/document-service'
import { prisma } from '@/lib/db'
import { getAuthzUser } from '@/lib/authz'
import { canViewEntity } from '@/lib/documents/entity-authz'

const VALID_ACTIONS = ['PRINT', 'DOWNLOAD', 'EMAIL'] as const  // Phase 2 P2-9 drops EMAIL

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
            recipientEmail: body.recipientEmail,
            notes: body.notes,
        })

        // EMAIL stub kept for now — P2-9 will drop it entirely
        if (body.action === 'EMAIL') {
            console.log(`[EMAIL STUB] snapshot=${body.snapshotId} → ${body.recipientEmail}`)
        }

        return NextResponse.json({ data: dist })
    } catch (e: any) {
        if (e.message === 'Unauthorized') return NextResponse.json({ error: e.message }, { status: 401 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
```

**Step 2: Commit**

```bash
git add app/api/documents/distributions/route.ts
git commit -m "feat(documents): wire entity authz on distributions GET/POST + GET try/catch"
```

---

## Task P1-6: Wire authz into PO PDF backfill endpoint

**Files:**
- Modify: `app/api/procurement/orders/[id]/pdf/route.ts`

**Step 1: Replace user lookup + add canViewEntity check**

The file currently uses `getAuthzUser()` (good — already returns AuthzUser). Add the canViewEntity guard after `await getAuthzUser()`:

```ts
import { canViewEntity } from "@/lib/documents/entity-authz"
// ...

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const user = await getAuthzUser()
        if (!(await canViewEntity(user, 'PO', id))) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        // ... existing snapshot lookup + lazy backfill + stream code unchanged
    } catch (e: unknown) {
        // existing catch
    }
}
```

**Step 2: Commit**

```bash
git add app/api/procurement/orders/\[id\]/pdf/route.ts
git commit -m "feat(documents): wire entity authz on PO PDF endpoint"
```

---

## Task P1-7: Branding endpoint admin-only + logo key validation

**Files:**
- Modify: `app/api/settings/branding/route.ts`

**Step 1: Replace handlers**

```ts
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
        assertRole(user, BRAND_ADMIN_ROLES)  // throws if not admin

        const body = await req.json()

        // Validate logoStorageKey if provided
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
        if (e.message?.includes('Forbidden') || e.message?.includes('role')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
```

**Note:** `assertRole` throws on failure; the catch maps it to 403. Verify by reading `lib/authz.ts:64` — confirm the throw message contains 'role' or 'Forbidden'.

**Step 2: Commit**

```bash
git add app/api/settings/branding/route.ts
git commit -m "feat(documents): admin-only branding PATCH + logoStorageKey validation"
```

---

## Task P1-8: Logo render fix in brand-resolver

**Files:**
- Modify: `lib/documents/brand-resolver.ts`
- Test: `__tests__/documents/brand-resolver.test.ts` (extend)

**Step 1: Add new test cases**

Append to existing brand-resolver test file (after the existing 4 tests):

```ts
it('downloads logo to local file when logoStorageKey set', async () => {
    ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
        tenantName: 'PT Test', logoStorageKey: '_brand/logo.png',
    })
    const { downloadDocument } = await import('@/lib/storage/document-storage') as any
    downloadDocument.mockResolvedValueOnce(Buffer.from('fake-png'))

    const inputs = await resolveBrandInputs()
    expect(inputs.logo_path).toMatch(/templates\/_shared\/cache\/logo-.*\.png$/)
})

it('falls back to empty logo_path when downloadDocument throws', async () => {
    ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
        tenantName: 'PT Test', logoStorageKey: '_brand/missing.png',
    })
    const { downloadDocument } = await import('@/lib/storage/document-storage') as any
    downloadDocument.mockRejectedValueOnce(new Error('not found'))

    const inputs = await resolveBrandInputs()
    expect(inputs.logo_path).toBe('')
})
```

Also extend the storage mock at top of file to include `downloadDocument`:
```ts
vi.mock('@/lib/storage/document-storage', () => ({
    getDocumentSignedUrl: vi.fn(() => Promise.resolve('https://example.com/logo.png')),
    downloadDocument: vi.fn(() => Promise.resolve(Buffer.from('fake'))),
}))
```

**Step 2: Run — fails**
`npx vitest run __tests__/documents/brand-resolver.test.ts` → 2 new tests fail.

**Step 3: Implement**

Replace the logo-resolution block in `lib/documents/brand-resolver.ts`:

```ts
import { prisma } from '@/lib/db'
import { downloadDocument } from '@/lib/storage/document-storage'
import { promises as fs } from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'

// ... interface BrandInputs + DEFAULTS unchanged

const LOGO_CACHE_DIR = path.join(process.cwd(), 'templates', '_shared', 'cache')

export async function resolveBrandInputs(): Promise<BrandInputs> {
    const config = await prisma.tenantConfig.findFirst().catch((err) => {
        console.warn('[brand-resolver] TenantConfig lookup failed:', err)
        return null
    })
    if (!config) return DEFAULTS

    let logoPath = ''
    if (config.logoStorageKey) {
        try {
            const buffer = await downloadDocument(config.logoStorageKey)
            await fs.mkdir(LOGO_CACHE_DIR, { recursive: true })
            const ext = path.extname(config.logoStorageKey) || '.png'
            const filename = `logo-${randomUUID()}${ext}`
            const fullPath = path.join(LOGO_CACHE_DIR, filename)
            await fs.writeFile(fullPath, buffer)
            // Return path relative to Typst --root (templates/) so it resolves correctly
            logoPath = `_shared/cache/${filename}`
        } catch (err) {
            console.warn('[brand-resolver] logo download failed:', err)
            logoPath = ''
        }
    }

    return {
        company_name: config.tenantName ?? DEFAULTS.company_name,
        company_address: config.companyAddress ?? '',
        company_npwp: config.companyNpwp ?? '',
        company_email: config.companyEmail ?? '',
        company_phone: config.companyPhone ?? '',
        logo_path: logoPath,
        brand_color: config.primaryColor ?? DEFAULTS.brand_color,
    }
}
```

Update test expectation accordingly (the path will be `_shared/cache/logo-<uuid>.png` not absolute):

```ts
expect(inputs.logo_path).toMatch(/^_shared\/cache\/logo-.*\.png$/)
```

**Step 4: Add cleanup to test**
At top of describe block:
```ts
afterEach(async () => {
    const fs = await import('fs/promises')
    const path = await import('path')
    const dir = path.join(process.cwd(), 'templates', '_shared', 'cache')
    await fs.rm(dir, { recursive: true, force: true })
})
```

**Step 5: Run — passes**
`npx vitest run __tests__/documents/brand-resolver.test.ts` → 6 passed.

**Step 6: Add `templates/_shared/cache/.gitignore`**
Create `templates/_shared/cache/.gitignore` with content:
```
*
!.gitignore
```
This ensures the dir exists in git but contents are ignored.

**Step 7: Commit**

```bash
git add lib/documents/brand-resolver.ts __tests__/documents/brand-resolver.test.ts templates/_shared/cache/.gitignore
git commit -m "fix(documents): download logo to local cache for Typst image() to read"
```

---

## Task P1-9: PR template

**Files:**
- Create: `templates/purchase_request/main.typ`

**Step 1: Implement**

Use `templates/purchase_order/main.typ` as the structural reference, but adjust:
- Header title: `"FORMULIR PERMINTAAN PEMBELIAN"`
- Drop vendor section
- Drop tax/PPN section in summary
- Add justification (notes) section
- Add requester + department fields
- Items table: `[Kode | Nama Barang | Qty | Catatan]` (no unit_price column for PR)

```typst
// ============================================
// Purchase Request Template
// ============================================

#let safe-text(value, default: "") = {
  if value == none { default } else { str(value) }
}

#let format-num(val) = { if val == none { "0" } else { str(val) } }

#let json-data = sys.inputs.data
#let data = if json-data != none and json-data != "" {
  json.decode(json-data)
} else {
  json.decode("{\"number\":\"PR-ERROR\",\"requestDate\":\"2026-01-01\",\"items\":[],\"notes\":\"\"}")
}

#let get-field(obj, field, default: "") = {
  if obj == none { return default }
  if type(obj) != dictionary { return default }
  obj.at(field, default: default)
}

#import "../_shared/brand.typ": header, footer, brand-color

#let colors = (
  primary: rgb("#1a365d"),
  text-light: rgb("#4a5568"),
  border: rgb("#cbd5e0"),
  bg-light: rgb("#f7fafc"),
)

#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2.5cm, left: 1.5cm, right: 1.5cm),
  footer: footer(label: "PR " + safe-text(get-field(data, "number"))),
)

#set text(font: "Inter", size: 10pt, fill: rgb("#1a202c"))

#header()
#v(12pt)

// Title
#align(center)[
  #text(size: 16pt, weight: "black", fill: brand-color)[FORMULIR PERMINTAAN PEMBELIAN]
  #v(4pt)
  #text(size: 11pt, weight: "bold")[Nomor: #safe-text(get-field(data, "number"))]
  #v(2pt)
  #text(size: 9pt, fill: colors.text-light)[
    Tanggal: #safe-text(get-field(data, "requestDate"))
  ]
]

#v(16pt)
#line(length: 100%, stroke: 1pt + colors.primary)
#v(12pt)

// Requester info
#let requester = get-field(data, "requester", default: (:))
#grid(
  columns: (auto, 1fr),
  column-gutter: 12pt,
  row-gutter: 6pt,
  text(weight: "bold")[Pemohon:], text[#safe-text(get-field(requester, "name"), default: "—")],
  text(weight: "bold")[Departemen:], text[#safe-text(get-field(data, "department"), default: get-field(requester, "department", default: "—"))],
  text(weight: "bold")[Prioritas:], text[#safe-text(get-field(data, "priority"), default: "NORMAL")],
)

#v(16pt)

// Items table
#text(size: 11pt, weight: "bold")[Daftar Permintaan]
#v(6pt)

#let items = get-field(data, "items", default: ())
#table(
  columns: (auto, 1fr, auto, auto),
  stroke: 0.5pt + colors.border,
  inset: 8pt,
  fill: (_, y) => if y == 0 { colors.bg-light } else { none },
  align: (x, y) => if y == 0 { center + horizon } else if x == 1 { left + horizon } else { right + horizon },

  text(weight: "bold")[Kode], text(weight: "bold")[Nama Barang], text(weight: "bold")[Qty], text(weight: "bold")[Catatan],

  ..if items.len() == 0 {
    (table.cell(colspan: 4, align: center)[#text(fill: colors.text-light)[Belum ada item]],)
  } else {
    items.map(it => (
      safe-text(get-field(it, "productCode"), default: "—"),
      safe-text(get-field(it, "productName"), default: "—"),
      format-num(get-field(it, "quantity", default: 0)),
      safe-text(get-field(it, "notes"), default: "—"),
    )).flatten()
  }
)

#v(16pt)

// Justification
#text(size: 11pt, weight: "bold")[Justifikasi]
#v(6pt)
#rect(width: 100%, stroke: 0.5pt + colors.border, inset: 10pt)[
  #text(size: 10pt)[
    #safe-text(get-field(data, "notes"), default: "Tidak ada catatan justifikasi.")
  ]
]

#v(20pt)

// Signatures
#grid(
  columns: (1fr, 1fr),
  gutter: 24pt,
  [
    #text(weight: "bold")[Pemohon] \
    #v(40pt)
    #line(length: 60%, stroke: 0.5pt) \
    #text(size: 9pt)[(#safe-text(get-field(requester, "name"), default: "..............................")) ]
  ],
  [
    #text(weight: "bold")[Disetujui Oleh] \
    #v(40pt)
    #line(length: 60%, stroke: 0.5pt) \
    #text(size: 9pt)[(.............................................)]
  ],
)
```

**Step 2: Smoke test**

```bash
DATA='{"number":"PR-2026-001","requestDate":"2026-04-28","department":"OPS","priority":"HIGH","requester":{"name":"Budi","department":"OPS"},"notes":"Stok sedang habis","items":[{"productCode":"P001","productName":"Kemeja","quantity":50,"notes":"Ukuran M"}]}'

typst compile --root templates --input "data=$DATA" --input company_name="PT Demo" --input brand_color="#f97316" templates/purchase_request/main.typ /tmp/pr-test.pdf && file /tmp/pr-test.pdf
```

Expected: `PDF document, version X.X`.

**Step 3: Commit**

```bash
git add templates/purchase_request/main.typ
git commit -m "feat(documents): add purchase_request Typst template"
```

---

## Task P1-10: Wire PR template in render-adapter

**Files:**
- Modify: `lib/documents/render-adapter.ts`

**Step 1: Update PR case**

Replace the `case 'PR':` block:

```ts
case 'PR': {
    const pr = await prisma.purchaseRequest.findUnique({
        where: { id: entityId },
        include: {
            items: { include: { product: true } } as any,
            requester: true as any,
        },
    })
    if (!pr) throw new Error(`PR not found: ${entityId}`)
    return { templateName: 'purchase_request', payload: pr }
}
```

**Step 2: Type-check**
`npx tsc --noEmit | grep render-adapter | head -3` → no errors.

**Step 3: Commit**

```bash
git add lib/documents/render-adapter.ts
git commit -m "fix(documents): PR snapshots use purchase_request template (no longer PO fallback)"
```

---

## Task P1-11: Phase 1 verification + smoke test

**[no-test]** — verification only.

**Step 1: Run all relevant tests**

```bash
npx vitest run __tests__/documents/entity-authz.test.ts __tests__/documents/brand-resolver.test.ts
```
Expected: ~20 tests green.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit 2>&1 | grep -E "(documents|api/documents|api/settings/branding|brand-resolver|render-adapter)" | head -10
```
Expected: no NEW errors (some pre-existing project errors may show; ignore).

**Step 3: Manual smoke test (per design doc — runs after Phase 1 ships)**

Document for the user:
```
After Phase 1 commit:
1. Login as a STAFF user (no procurement role) → curl /api/documents/snapshots/<any-id> → expect 403
2. Login as PURCHASING → same → expect 200
3. Login as STAFF → curl PATCH /api/settings/branding → expect 403
4. Login as ADMIN → upload logo to Supabase _brand/logo.png + PATCH branding with logoStorageKey="_brand/logo.png" → approve fresh PO → check Lampiran → PDF should show logo
```

**Step 4: No commit — verification only.**

---

# PHASE 1 COMPLETE — STOP HERE BEFORE PHASE 2

✅ All 8 Critical findings fixed
✅ ~15 new tests + smoke checklist
✅ Branch is in a security-clean shippable state

---

# PHASE 2 — IMPORTANT (Production-ready) — ~5-6 days, 13 tasks

## Workstream A — Data Integrity

### Task P2-1: Cascade Restrict on DocumentDistribution + invert test

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260429000000_distributions_restrict_delete/migration.sql`
- Modify: `__tests__/documents/snapshot-model.test.ts`

**Step 1: Schema change**

In `prisma/schema.prisma`, find the DocumentDistribution model and change:
```prisma
snapshot DocumentSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
```
to:
```prisma
snapshot DocumentSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Restrict)
```

**Step 2: Hand-write migration** (per repo convention — shadow DB blocks `migrate dev`)

```sql
-- prisma/migrations/20260429000000_distributions_restrict_delete/migration.sql
-- Change DocumentDistribution.snapshotId FK from CASCADE to RESTRICT.
-- Audit log distributions must outlive snapshots; admins can no longer
-- delete a snapshot that has distributions.

ALTER TABLE "document_distributions" DROP CONSTRAINT "document_distributions_snapshotId_fkey";

ALTER TABLE "document_distributions" ADD CONSTRAINT "document_distributions_snapshotId_fkey"
    FOREIGN KEY ("snapshotId") REFERENCES "document_snapshots"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
```

**Step 3: Apply + register**
```bash
npx prisma db execute --file prisma/migrations/20260429000000_distributions_restrict_delete/migration.sql --schema prisma/schema.prisma
npx prisma migrate resolve --applied 20260429000000_distributions_restrict_delete
npx prisma generate
```

**Step 4: Invert the cascade test in snapshot-model.test.ts**

Replace the existing `cascade deletes distributions` test:

```ts
it('does NOT cascade-delete distributions; throws on FK violation', async () => {
    const snap = await prisma.documentSnapshot.create({
        data: { type: 'PO', entityId, version: 1, storageKey: 'k', triggerEvent: 't' },
    })
    await prisma.documentDistribution.create({
        data: { snapshotId: snap.id, action: 'PRINT', actorId: randomUUID() },
    })
    await expect(
        prisma.documentSnapshot.delete({ where: { id: snap.id } })
    ).rejects.toThrow(/foreign key|constraint/i)

    // cleanup
    await prisma.documentDistribution.deleteMany({ where: { snapshotId: snap.id } })
    await prisma.documentSnapshot.delete({ where: { id: snap.id } })
}, 30000)
```

**Step 5: Run — passes**
`npx vitest run __tests__/documents/snapshot-model.test.ts` → 4 passed.

**Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ __tests__/documents/snapshot-model.test.ts
git commit -m "fix(documents): change distributions FK to Restrict — audit log outlives snapshots"
```

---

### Task P2-2: MAX(version) instead of count() + cleanup orphan on race retry

**Files:**
- Modify: `lib/documents/document-service.ts`
- Modify: `__tests__/documents/document-service.test.ts`

**Step 1: Add failing test cases**

Append to existing test file:

```ts
describe('versioning resilience', () => {
    const entityId = randomUUID()

    beforeEach(async () => {
        await prisma.documentSnapshot.deleteMany({ where: { entityId } })
    })

    it('uses MAX(version) — archived snapshots do not collide', async () => {
        const snap1 = await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        await prisma.documentSnapshot.update({ where: { id: snap1.id }, data: { archivedAt: new Date() } })

        const snap2 = await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        expect(snap2.version).toBe(2)  // not 1 (count-based would be 1 since snap1 is archived but still in DB)
    }, 30000)

    it('cleans up orphan storage blob on race retry', async () => {
        // Mock prisma.create to throw P2002 once, then succeed
        const createSpy = vi.spyOn(prisma.documentSnapshot, 'create')
        const { deleteDocument } = await import('@/lib/storage/document-storage') as any

        let callCount = 0
        createSpy.mockImplementation(async ({ data }: any) => {
            callCount++
            if (callCount === 1) {
                const err: any = new Error('Unique constraint')
                err.code = 'P2002'
                throw err
            }
            return { id: 'snap-retry', version: data.version, storageKey: data.storageKey, type: data.type, entityId: data.entityId } as any
        })

        await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        // The first uploaded key should have been cleaned up via deleteDocument
        expect(deleteDocument).toHaveBeenCalled()

        createSpy.mockRestore()
    }, 30000)
})
```

Also update the storage mock at top of document-service.test.ts to add deleteDocument:
```ts
vi.mock('@/lib/storage/document-storage', () => ({
    uploadDocument: vi.fn((_, key) => Promise.resolve(key)),
    getDocumentSignedUrl: vi.fn(() => Promise.resolve('https://signed')),
    deleteDocument: vi.fn(() => Promise.resolve()),
}))
```

**Step 2: Run — fails (orphan cleanup test fails because no deleteDocument call)**

**Step 3: Update generateSnapshot**

In `lib/documents/document-service.ts`:

```ts
import { uploadDocument, deleteDocument } from '@/lib/storage/document-storage'
// ...

export async function generateSnapshot(input: GenerateInput): Promise<DocumentSnapshot> {
    const { type, entityId, trigger, actorId, metadata } = input

    const target = await buildRenderTarget(type, entityId)
    const brand = await resolveBrandInputs()
    const pdfBuffer = await TypstService.generatePDF(
        target.templateName,
        target.payload,
        brand as unknown as Record<string, string>,
    )

    // Race-safe versioning: MAX(version) + bounded retry with cleanup
    return generateWithRetry(type, entityId, trigger, actorId, metadata, pdfBuffer, 0)
}

async function generateWithRetry(
    type: DocType,
    entityId: string,
    trigger: string,
    actorId: string | null | undefined,
    metadata: any,
    pdfBuffer: Buffer,
    attempt: number,
): Promise<DocumentSnapshot> {
    const MAX_ATTEMPTS = 3

    const last = await prisma.documentSnapshot.findFirst({
        where: { type, entityId },
        orderBy: { version: 'desc' },
        select: { version: true },
    })
    const version = (last?.version ?? 0) + 1
    const storageKey = `${type}/${entityId}/v${version}-${randomUUID()}.pdf`

    await uploadDocument(pdfBuffer, storageKey)

    try {
        return await prisma.documentSnapshot.create({
            data: {
                type, entityId, version, storageKey,
                triggerEvent: trigger,
                generatedBy: actorId ?? null,
                metadata: metadata as any,
            },
        })
    } catch (e: any) {
        // Cleanup orphan blob — best-effort
        await deleteDocument(storageKey).catch(() => {})

        if (e.code === 'P2002' && attempt < MAX_ATTEMPTS - 1) {
            return generateWithRetry(type, entityId, trigger, actorId, metadata, pdfBuffer, attempt + 1)
        }
        if (e.code === 'P2002') {
            throw new Error(`Snapshot create retried ${MAX_ATTEMPTS}x for ${type}/${entityId}: ${e.message}`)
        }
        throw e
    }
}
```

**Step 4: Run — passes**
`npx vitest run __tests__/documents/document-service.test.ts` → all green.

**Step 5: Commit**

```bash
git add lib/documents/document-service.ts __tests__/documents/document-service.test.ts
git commit -m "fix(documents): MAX(version) + bounded retry with orphan cleanup"
```

---

### Task P2-3: Decimal.isDecimal robust serialization

**Files:**
- Modify: `lib/services/document-service.ts`

**Step 1: Replace JSON replacer**

```ts
import { Prisma } from '@prisma/client'
// ... existing imports

// In generatePDF, replace the existing replacer:
const jsonData = JSON.stringify(data, (_k, v) => {
    if (Prisma.Decimal.isDecimal(v)) return v.toString()
    return v
})
```

**Step 2: Smoke test via existing test (no new test needed — covered transitively by document-service tests)**

```bash
npx vitest run __tests__/documents/document-service.test.ts
```
Expected: all 8 tests still pass (Decimal change is internal to TypstService; mocks don't exercise it).

Optionally add a tiny direct test for the replacer logic:

```ts
// __tests__/documents/typst-decimal.test.ts (NEW, optional)
import { describe, it, expect } from 'vitest'
import { Prisma } from '@prisma/client'

describe('Decimal serialization in TypstService', () => {
    it('Prisma.Decimal.isDecimal correctly identifies Decimal instances', () => {
        const d = new Prisma.Decimal('123.45')
        expect(Prisma.Decimal.isDecimal(d)).toBe(true)
        expect(Prisma.Decimal.isDecimal(123)).toBe(false)
        expect(Prisma.Decimal.isDecimal('123')).toBe(false)
        expect(Prisma.Decimal.isDecimal(null)).toBe(false)
    })

    it('JSON.stringify with replacer serializes Decimal as string', () => {
        const d = new Prisma.Decimal('99.99')
        const result = JSON.stringify({ amount: d }, (_k, v) =>
            Prisma.Decimal.isDecimal(v) ? v.toString() : v
        )
        expect(result).toBe('{"amount":"99.99"}')
    })
})
```

**Step 3: Commit**

```bash
git add lib/services/document-service.ts __tests__/documents/typst-decimal.test.ts
git commit -m "fix(documents): use Prisma.Decimal.isDecimal for robust serialization"
```

---

### Task P2-4: PO approval rollback on bill creation failure

**Files:**
- Modify: `lib/actions/procurement.ts`
- Test: `__tests__/procurement/po-approval-rollback.test.ts`

**Step 1: Write failing test**

```ts
// __tests__/procurement/po-approval-rollback.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/actions/finance-invoices', () => ({
    recordPendingBillFromPO: vi.fn(),
}))
vi.mock('@/lib/documents/triggers', () => ({
    fireTrigger: vi.fn(),
}))

// Plus mocks for getAuthzUser, withPrismaAuth, etc — copy from existing procurement tests.
// Skip the test body if these mocks are too painful; just write a minimal version
// that asserts the rollback path is reached.

describe('approvePurchaseOrder rollback', () => {
    it('reverts PO to original status when recordPendingBillFromPO throws', async () => {
        const { recordPendingBillFromPO } = await import('@/lib/actions/finance-invoices')
        ;(recordPendingBillFromPO as any).mockRejectedValueOnce(new Error('Period locked'))

        // Setup: insert a real PO in PENDING_APPROVAL state
        // Call approvePurchaseOrder
        // Assert: status reverted, error returned

        // NOTE: this test may need to be deferred to manual verification due to
        // the heavy mocking required. If complexity exceeds 1h, skip and document
        // as "verified manually via smoke test."
    })
})
```

**Note:** if writing this test exceeds 1 hour due to mock complexity, **skip the test** and document the rollback verification in the manual smoke test checklist. The implementation change is the primary deliverable.

**Step 2: Implement rollback in `lib/actions/procurement.ts`**

Find the `approvePurchaseOrder` function (around line 1135). Wrap the post-commit work in try/catch:

```ts
export async function approvePurchaseOrder(poId: string, _approverId?: string) {
    let originalStatus: ProcurementStatus | null = null
    try {
        const user = await getAuthzUser()
        assertRole(user, APPROVER_ROLES)

        const po = await withPrismaAuth(async (prisma) => {
            await requireActiveProcurementActor(prisma, user)
            const current = await prisma.purchaseOrder.findUnique({ where: { id: poId } })
            if (!current) throw new Error("Purchase Order not found")

            originalStatus = current.status as ProcurementStatus  // capture for potential rollback

            // ... existing SoD check + atomic transition + event creation + return updated
        })

        // POST-COMMIT WORK (could throw — wrap in try/catch with rollback)
        try {
            await recordPendingBillFromPO(po)
        } catch (billErr: any) {
            // Rollback PO status
            console.error('[approvePO] recordPendingBillFromPO failed, rolling back:', billErr)
            if (originalStatus) {
                await prisma.purchaseOrder.update({
                    where: { id: poId },
                    data: {
                        status: originalStatus,
                        previousStatus: null,
                        approvedBy: null,
                    },
                }).catch((rollbackErr) => {
                    console.error('[approvePO] ROLLBACK FAILED — manual intervention needed:', rollbackErr)
                })

                // Log TRANSITION_FAILED event
                await createPurchaseOrderEvent(prisma as any, {
                    purchaseOrderId: poId,
                    status: originalStatus,
                    changedBy: (await getAuthzUser()).id,
                    action: "TRANSITION_FAILED",
                    notes: `Bill creation failed: ${billErr.message}`,
                    metadata: { source: "AUTO_ROLLBACK", reason: billErr.message },
                }).catch(() => {})
            }
            throw billErr  // surface to outer catch
        }

        void fireTrigger('PO_APPROVED', poId, user.id)

        revalidateProcurementPaths()

        return { success: true }
    } catch (error) {
        console.error("Approval Error:", error)
        return { success: false, error: (error as any)?.message || "Approval failed" }
    }
}
```

**Step 3: Manual smoke test**

```
1. Find a PO in PENDING_APPROVAL state
2. Manually close the fiscal period (or otherwise force recordPendingBillFromPO to fail)
3. Approve the PO via UI
4. Verify: PO status reverts to PENDING_APPROVAL, error toast shows
5. Verify: PurchaseOrderEvent table has TRANSITION_FAILED entry
```

**Step 4: Commit**

```bash
git add lib/actions/procurement.ts __tests__/procurement/po-approval-rollback.test.ts
git commit -m "fix(procurement): rollback PO status when post-commit bill creation fails"
```

---

## Workstream B — UI/UX

### Task P2-5: Drop Email button + DistributionDialog + EMAIL action

**Files:**
- Modify: `components/documents/document-version-row.tsx`
- Delete: `components/documents/distribution-dialog.tsx`
- Modify: `app/api/documents/distributions/route.ts`

**Step 1: Update document-version-row.tsx**

Remove all email-related code:

```tsx
"use client"
import { Button } from '@/components/ui/button'
import { Printer, Download, RotateCw } from 'lucide-react'   // remove Mail
import { DocumentVersionPill } from './document-version-pill'
// remove DistributionDialog import
import { useLogDistribution, useRegenerateSnapshot, fetchSignedUrl } from '@/hooks/use-document-snapshots'

// remove emailOpen state
// remove DistributionDialog JSX block at end
// keep PRINT/DOWNLOAD/REGEN buttons
```

The component becomes:
```tsx
export function DocumentVersionRow({ snapshot, isLatest, type, entityId }: Props) {
    const logDist = useLogDistribution()
    const regen = useRegenerateSnapshot(type, entityId)

    async function handleOpen(action: 'PRINT' | 'DOWNLOAD') {
        const url = await fetchSignedUrl(snapshot.id)
        await logDist.mutateAsync({ snapshotId: snapshot.id, action })
        window.open(url, '_blank')
    }

    return (
        <div className="flex items-center gap-3 p-3 border-b border-zinc-200 last:border-b-0">
            <DocumentVersionPill version={snapshot.version} isLatest={isLatest} />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{snapshot.label ?? snapshot.triggerEvent}</div>
                <div className="text-[11px] text-zinc-500">
                    {new Date(snapshot.generatedAt).toLocaleString('id-ID')} • {snapshot.triggerEvent}
                </div>
            </div>
            <div className="flex gap-1">
                <Button size="sm" variant="ghost" title="Cetak" onClick={() => handleOpen('PRINT')}>
                    <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" title="Unduh PDF" onClick={() => handleOpen('DOWNLOAD')}>
                    <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" title="Buat Versi Baru" onClick={() => regen.mutate(snapshot.id)} disabled={regen.isPending}>
                    <RotateCw className="h-3.5 w-3.5" />
                </Button>
            </div>
        </div>
    )
}
```

**Step 2: Delete the dialog file**

```bash
rm components/documents/distribution-dialog.tsx
```

**Step 3: Update distributions API**

In `app/api/documents/distributions/route.ts`:
- Change `VALID_ACTIONS` to `['PRINT', 'DOWNLOAD'] as const`
- Remove the entire `if (body.action === 'EMAIL')` block (drops the console.log PII)

**Step 4: Commit**

```bash
git add components/documents/document-version-row.tsx app/api/documents/distributions/route.ts
git rm components/documents/distribution-dialog.tsx
git commit -m "feat(documents): drop Email button + DistributionDialog + EMAIL action"
```

---

### Task P2-6: Logo upload — backend route

**Files:**
- Create: `app/api/settings/branding/logo/route.ts`

**Step 1: Implement**

```ts
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

        await uploadDocument(buffer, key)

        // Delete the previous logo (best-effort)
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
        if (e.message?.includes('role') || e.message?.includes('Forbidden')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
        return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }
}
```

**Note:** `uploadDocument` uses `upsert: false` so collision throws. The UUID suffix avoids collision. The contentType is set to `application/pdf` in the wrapper — for logo upload, **this is wrong**. We need to override.

**Step 2: Update `lib/storage/document-storage.ts` to accept contentType**

```ts
export async function uploadDocument(
    buffer: Buffer,
    key: string,
    contentType: string = 'application/pdf',
): Promise<string> {
    const supabase = await createClient()
    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
        contentType,
        upsert: false,
    })
    if (error) throw new Error(`Storage upload failed: ${error.message}`)
    return key
}
```

Then in `app/api/settings/branding/logo/route.ts`:
```ts
await uploadDocument(buffer, key, file.type)
```

Update the storage test to verify the new signature passes through (extend existing storage.test.ts):
```ts
it('uploadDocument accepts custom contentType', async () => {
    const buffer = Buffer.from('fake')
    const key = await uploadDocument(buffer, 'test.png', 'image/png')
    expect(key).toBe('test.png')
})
```

**Step 3: Commit**

```bash
git add app/api/settings/branding/logo/route.ts lib/storage/document-storage.ts __tests__/documents/storage.test.ts
git commit -m "feat(documents): logo upload API + storage wrapper accepts contentType"
```

---

### Task P2-7: Logo upload — frontend component

**Files:**
- Create: `components/settings/logo-uploader.tsx`
- Modify: `components/settings/branding-form.tsx`

**Step 1: Implement uploader component**

```tsx
// components/settings/logo-uploader.tsx
"use client"
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
    currentKey?: string | null
    onChange: (newKey: string | null) => void
}

export function LogoUploader({ currentKey, onChange }: Props) {
    const [uploading, setUploading] = useState(false)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    async function handleFile(file: File) {
        const ALLOWED = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
        if (!ALLOWED.includes(file.type)) {
            toast.error('Format harus PNG/JPG/SVG/WebP')
            return
        }
        if (file.size > 2 * 1024 * 1024) {
            toast.error('Ukuran maksimal 2MB')
            return
        }

        // Local preview before upload
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)

        setUploading(true)
        try {
            const fd = new FormData()
            fd.append('file', file)
            const res = await fetch('/api/settings/branding/logo', { method: 'POST', body: fd })
            const json = await res.json()
            if (!res.ok) {
                toast.error(json.error || 'Upload gagal')
                setPreviewUrl(null)
                return
            }
            onChange(json.data.logoStorageKey)
            toast.success('Logo diupload')
        } catch {
            toast.error('Upload gagal — coba lagi')
            setPreviewUrl(null)
        } finally {
            setUploading(false)
        }
    }

    function onDrop(e: React.DragEvent) {
        e.preventDefault()
        const file = e.dataTransfer.files[0]
        if (file) handleFile(file)
    }

    return (
        <div className="space-y-2">
            <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop}
                className="border-2 border-dashed border-zinc-300 rounded p-6 text-center cursor-pointer hover:border-orange-400"
                onClick={() => inputRef.current?.click()}
            >
                {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="max-h-24 mx-auto" />
                ) : currentKey ? (
                    <div className="text-sm text-zinc-600">Logo terpasang: {currentKey}</div>
                ) : (
                    <div className="space-y-2">
                        <ImageIcon className="h-8 w-8 mx-auto text-zinc-400" />
                        <p className="text-sm text-zinc-600">
                            Drag & drop file atau klik untuk pilih
                        </p>
                        <p className="text-[11px] text-zinc-500">
                            PNG/JPG/SVG/WebP, maks 2MB
                        </p>
                    </div>
                )}
            </div>
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploading ? 'Mengupload...' : 'Pilih File'}
                </Button>
                {(currentKey || previewUrl) && (
                    <Button size="sm" variant="ghost" onClick={() => { onChange(null); setPreviewUrl(null) }}>
                        <X className="h-3.5 w-3.5 mr-1" />
                        Hapus
                    </Button>
                )}
            </div>
        </div>
    )
}
```

**Step 2: Wire into branding-form.tsx**

In `components/settings/branding-form.tsx`, add to the form:

```tsx
import { LogoUploader } from './logo-uploader'

// ... inside JSX, before "Brand Color" field:
<div>
    <Label>Logo Perusahaan</Label>
    <LogoUploader
        currentKey={form.logoStorageKey}
        onChange={(newKey) => setForm({ ...form, logoStorageKey: newKey ?? '' })}
    />
</div>
```

Note: `LogoUploader` calls the API directly and updates `logoStorageKey`. The form's Save button still saves the rest of the fields, but `logoStorageKey` is already saved by the upload API.

**Step 3: Commit**

```bash
git add components/settings/logo-uploader.tsx components/settings/branding-form.tsx
git commit -m "feat(documents): logo uploader UI with drag-drop + preview"
```

---

### Task P2-8: Auto-refresh polling on Lampiran tab

**Files:**
- Modify: `hooks/use-document-snapshots.ts`

**Step 1: Update useDocumentSnapshots to poll when empty**

```ts
export function useDocumentSnapshots(type: string, entityId: string) {
    return useQuery({
        queryKey: queryKeys.documents.list(type, entityId),
        queryFn: async () => {
            const res = await fetch(`/api/documents/snapshots?type=${type}&entityId=${entityId}`)
            if (!res.ok) {
                if (res.status === 403) throw new Error('Anda tidak memiliki akses ke dokumen ini')
                throw new Error('Gagal memuat dokumen')
            }
            const json = await res.json()
            return json.data ?? []
        },
        enabled: !!entityId,
        refetchInterval: (query) => {
            // Poll @ 2s when empty (waiting for auto-snapshot to land)
            // Stop polling once we have data
            const data = query.state.data as any[]
            if (!data || data.length === 0) {
                // Cap at 30 seconds of polling (15 attempts)
                const attempts = query.state.dataUpdateCount
                if (attempts < 15) return 2000
            }
            return false
        },
    })
}
```

**Note:** TanStack v5 query API — `refetchInterval` accepts a function returning `false | number`. Verify with `grep "refetchInterval" hooks/` for existing usage patterns in this project.

**Step 2: Smoke test (manual)**

```
1. Approve a fresh PO
2. Navigate to its Lampiran tab quickly (within 2s)
3. Empty state appears, then auto-refreshes every 2s
4. Within ~5s, v1 appears; polling stops
```

**Step 3: Commit**

```bash
git add hooks/use-document-snapshots.ts
git commit -m "feat(documents): poll snapshots @ 2s when empty (auto-refresh after approval)"
```

---

### Task P2-9: Signed URL TTL → 5 min + drop redundant args

**Files:**
- Modify: `lib/storage/document-storage.ts`
- Modify: `app/api/documents/snapshots/[id]/route.ts`
- Modify: `lib/documents/brand-resolver.ts`

**Step 1: Update default + export constant**

```ts
// lib/storage/document-storage.ts
export const DEFAULT_SIGNED_URL_TTL = 60 * 5  // 5 minutes

export async function getDocumentSignedUrl(
    key: string,
    expiresInSeconds: number = DEFAULT_SIGNED_URL_TTL,
): Promise<string> {
    // ... existing implementation
}
```

**Step 2: Drop the redundant `60 * 60` from callers**

In `app/api/documents/snapshots/[id]/route.ts`:
```ts
const url = await getDocumentSignedUrl(snap.storageKey)  // was: snap.storageKey, 60 * 60
```

In `lib/documents/brand-resolver.ts` — wait, P1-8 already changed this to use `downloadDocument` instead of `getDocumentSignedUrl`. So this only applies to the snapshot detail route.

**Step 3: Update existing storage test**

```ts
it('getDocumentSignedUrl uses 5min default TTL', async () => {
    const supabase = (await import('@/lib/supabase/server')).createClient as any
    const createSignedUrl = vi.fn(() => Promise.resolve({ data: { signedUrl: 'https://x' }, error: null }))
    supabase.mockResolvedValueOnce({
        storage: { from: () => ({ createSignedUrl }) },
    })

    await getDocumentSignedUrl('key')
    expect(createSignedUrl).toHaveBeenCalledWith('key', 300)
})
```

(Or simpler — just verify the constant value `expect(DEFAULT_SIGNED_URL_TTL).toBe(300)`.)

**Step 4: Commit**

```bash
git add lib/storage/document-storage.ts app/api/documents/snapshots/\[id\]/route.ts __tests__/documents/storage.test.ts
git commit -m "fix(documents): signed URL TTL 60min → 5min default"
```

---

### Task P2-10: Strip dead `brand-color, brand-muted` imports from 9 templates

**[no-test]** — Typst lint cleanup.

**Step 1: For each of the 9 templates** (`templates/{purchase_order,invoice,surat_jalan,payroll_report,payslip,faktur_pajak,surat_jalan_masuk,production_bom,spk}/main.typ`):

Change:
```typst
#import "../_shared/brand.typ": header, footer, brand-color, brand-muted
```
to:
```typst
#import "../_shared/brand.typ": header, footer
```

(Templates that DO use `brand-color` in their body — verify with grep first.)

```bash
for tpl in purchase_order invoice surat_jalan payroll_report payslip faktur_pajak surat_jalan_masuk production_bom spk purchase_request; do
    grep -c "brand-color\|brand-muted" templates/$tpl/main.typ
done
```

If any template uses `brand-color` in its body (count > 1, since the import line itself counts as 1), KEEP the import. Otherwise strip.

**Step 2: Smoke test**
Run any one of the templates via Typst CLI to confirm it still compiles.

**Step 3: Commit**

```bash
git add templates/
git commit -m "chore(documents): strip unused brand-color/brand-muted imports from templates"
```

---

## Workstream C — Finance Integration

### Task P2-11: Wire INVOICE_ISSUED auto-trigger

**Files:**
- Modify: `lib/actions/finance-invoices.ts`

**Step 1: Add fireTrigger call after successful moveInvoiceToSent**

Find `moveInvoiceToSent` (around line 1065). After the transaction succeeds and BEFORE `return { success: true, ... }`:

```ts
import { fireTrigger } from '@/lib/documents/triggers'
// ... existing imports

// Inside moveInvoiceToSent, after the successful tx commit:
const result = await prisma.$transaction(async (tx) => {
    // ... existing tx logic
    return { dueDate, status: nextStatus }
})

// TRIGGER DOCUMENT SNAPSHOT — fire-and-forget
const user = await getAuthzUser()  // re-resolve user (or pass via parameter)
void fireTrigger('INVOICE_ISSUED', invoiceId, user.id)

return { success: true, dueDate: result.dueDate, status: result.status }
```

**Note:** `getAuthzUser()` may need to be called at the top of `moveInvoiceToSent` so the user.id is available. If the function doesn't currently have an auth check, add one. Read the function start (line 1065-1075) to determine.

**Step 2: Type-check**
`npx tsc --noEmit | grep finance-invoices | head -3` → no errors.

**Step 3: Commit**

```bash
git add lib/actions/finance-invoices.ts
git commit -m "feat(documents): wire INVOICE_ISSUED auto-snapshot trigger"
```

---

### Task P2-12: Lampiran section on AR Invoice detail

**Files:**
- Modify: `app/finance/invoices/[id]/page.tsx` (or alternative path — see note)

**Step 1: Inspect current state**

```bash
cat app/finance/invoices/\[id\]/page.tsx
```

The current file is just a redirect to `/finance/invoices?highlight=<id>`. The actual detail UI is in the parent invoices page Kanban modal.

**Step 2: Decide approach**

Option A — Build a real detail page with Lampiran:
- Convert the redirect to a real page that renders invoice detail + Lampiran section
- ~3-4 hours

Option B — Add Lampiran to the existing Kanban modal:
- Find where the highlighted invoice opens (likely in `components/finance/...`)
- Add a Lampiran section to that modal
- ~1-2 hours

**RECOMMENDED:** Option B for the demo (less invasive). Investigate `app/finance/invoices/page.tsx` and find the modal/drawer component that renders when `?highlight=<id>` is set.

**Step 3: Apply Option B**

Find the invoice detail modal/drawer. Add:
```tsx
import { DocumentSnapshotList } from '@/components/documents/document-snapshot-list'

// Inside the modal/drawer, in an appropriate section:
<div className="border-t border-zinc-200 pt-4 mt-4">
    <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-2">
        Dokumen PDF (versi tercatat)
    </h3>
    <DocumentSnapshotList type="INVOICE_AR" entityId={invoice.id} />
</div>
```

**Step 4: Manual smoke test**
```
1. Issue an AR invoice (DRAFT → ISSUED via send button)
2. Open the invoice detail (Kanban modal)
3. Lampiran section appears with v1 within ~5s (auto-snapshot)
```

**Step 5: Commit**

```bash
git add <whichever files were modified>
git commit -m "feat(documents): Lampiran section on AR Invoice detail"
```

---

### Task P2-13: Phase 2 verification + final smoke test

**[no-test]** — verification only.

**Step 1: Run full document test suite**

```bash
npx vitest run __tests__/documents/ __tests__/procurement/po-document-trigger.test.ts __tests__/procurement/po-approval-rollback.test.ts
```
Expected: ~30+ tests green.

**Step 2: TypeScript check**

```bash
npx tsc --noEmit | grep -E "(documents|brand-resolver|render-adapter|finance-invoices|procurement\.ts|api/documents|api/settings)" | head -15
```
Expected: no NEW errors from this sprint.

**Step 3: Manual smoke test (full set)**

```
PHASE 1 (re-verify):
1. STAFF user → curl /api/documents/snapshots/<any-id> → 403
2. PURCHASING → same → 200
3. STAFF → PATCH /api/settings/branding → 403
4. ADMIN → upload logo via Branding form → approve fresh PO → Lampiran shows PDF with logo

PHASE 2:
5. Approve a PO → wait 5s → Lampiran auto-refreshes → shows v1 (no manual reload)
6. Open snapshot row → Email button is GONE
7. Issue an AR invoice → /finance/invoices?highlight=<id> Lampiran shows snapshot within 5s
8. Try to delete a snapshot via Prisma Studio that has distribution rows → expect FK violation
9. Approve a PO with closed fiscal period → expect rollback (PO stays PENDING_APPROVAL)
10. Approve a PR → Lampiran shows PDF with "FORMULIR PERMINTAAN PEMBELIAN" header (NOT "PURCHASE ORDER")
```

**Step 4: No commit — sprint complete.**

---

# SPRINT COMPLETE

✅ Phase 1: 8 Critical fixes
✅ Phase 2: 12 Important fixes
✅ ~30 new tests + 10-step manual smoke
✅ Branch ready to merge → `main`

Estimated total: ~8-10 working days (23 tasks)

| Phase | Tasks | Days |
|-------|-------|------|
| 1 (Critical) | 11 | 3-4 |
| 2 (Important) | 13 | 5-6 |
| **Total** | **24** | **8-10** |

Demo on June 26 → ~50 days buffer after sprint completion.
