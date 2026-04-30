# Document System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
> **Design doc:** [`2026-04-27-document-system-design.md`](./2026-04-27-document-system-design.md)

**Goal:** Snapshot-on-event PDF foundation with version history, distribution tracking, tenant-configurable branding — Pengadaan as pilot module.

**Architecture:** When a business event commits (PO approved, etc.), `fireTrigger()` runs the document service in the background — it renders Typst with shared brand module, uploads to Supabase Storage, and writes a `DocumentSnapshot` row. PDFs are immutable; "regenerate" creates a new version. Distribution events (PRINT/EMAIL/DOWNLOAD) are logged separately. Existing PDF endpoints fetch from snapshots with lazy back-fill for pre-migration entities.

**Tech Stack:** Next.js 16, Prisma 6, Supabase Storage (bucket `documents`), Typst CLI (existing in `lib/services/document-service.ts`), TanStack Query, Vitest.

---

## How to Execute This Plan

**Each task is bite-sized (2–5 minutes of work).** Always:

1. Read the task's `Files` section — know exactly what to touch
2. Run `Step 1: Write the failing test` first (TDD discipline)
3. Run `Step 2` to confirm test fails for the expected reason
4. Implement minimal code in `Step 3`
5. Run `Step 4` to confirm test passes
6. Commit with the exact message in `Step 5`

**Do NOT batch tasks.** Commit after each one. If a task gets stuck, debug then commit. Never leave uncommitted work between tasks (multi-session safety per CLAUDE.md).

**Skip tests for pure UI/template tasks** where noted — those just need a manual run instruction.

---

## Phase A — Schema + Storage Foundation (1 day, ~6 tasks)

### Task A1: Extend TenantConfig with full branding fields

**Why:** `TenantConfig` already has `tenantName`, `logoUrl`, `primaryColor`. Add the missing fields the design doc calls for so we have ONE branding source — no duplicate `SystemSettings` model.

**Files:**
- Modify: `prisma/schema.prisma:99-114` (TenantConfig model)
- Create: `prisma/migrations/<timestamp>_add_tenant_branding_fields/migration.sql` (auto-generated)

**Step 1: Update schema**

Open `prisma/schema.prisma`, replace the TenantConfig model with:

```prisma
model TenantConfig {
  id             String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  tenantSlug     String   @unique
  tenantName     String
  enabledModules String[]
  maxUsers       Int      @default(5)
  planType       String   @default("STARTER")
  logoUrl        String?
  primaryColor   String?  @default("#18181b")

  // NEW — brand fields used by document templates
  companyAddress String?
  companyNpwp    String?  // 15-digit Indonesian tax ID
  companyEmail   String?
  companyPhone   String?
  logoStorageKey String?  // path inside "documents" bucket, e.g. "_brand/logo.png"

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("tenant_config")
}
```

**Step 2: Create migration**

Run: `npx prisma migrate dev --name add_tenant_branding_fields`
Expected: migration file created, schema applied, Prisma client regenerated.

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(documents): extend TenantConfig with brand fields"
```

---

### Task A2: Add DocType enum + DocumentSnapshot model

**Files:**
- Modify: `prisma/schema.prisma` (append at the end of the file)

**Step 1: Append to schema**

```prisma
enum DocType {
  PO
  PR
  GRN
  VENDOR_PROFILE
  INVOICE_AR
  INVOICE_AP
  FAKTUR_PAJAK
  PAYSLIP
  BOM
  SPK
}

model DocumentSnapshot {
  id            String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  type          DocType
  entityId      String   @db.Uuid
  version       Int
  storageKey    String   // path inside "documents" bucket
  generatedAt   DateTime @default(now())
  generatedBy   String?  @db.Uuid
  triggerEvent  String   // e.g. "AUTO_PO_APPROVED" | "MANUAL_REGENERATE" | "BACKFILL"
  label         String?
  tags          String[]
  archivedAt    DateTime?
  metadata      Json?
  distributions DocumentDistribution[]

  @@unique([type, entityId, version])
  @@index([type, entityId])
  @@index([generatedAt])
  @@map("document_snapshots")
}
```

**Step 2: Run migration (deferred)** — wait until A3 lands so we get one combined migration.

**Step 3: No commit yet** — combine with A3.

---

### Task A3: Add DocumentDistribution model + migration

**Files:**
- Modify: `prisma/schema.prisma` (append after DocumentSnapshot)

**Step 1: Append to schema**

```prisma
model DocumentDistribution {
  id              String           @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  snapshotId      String           @db.Uuid
  snapshot        DocumentSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
  action          String           // "PRINT" | "DOWNLOAD" | "EMAIL"
  actorId         String           @db.Uuid
  recipientEmail  String?
  timestamp       DateTime         @default(now())
  notes           String?

  @@index([snapshotId])
  @@index([timestamp])
  @@map("document_distributions")
}
```

**Step 2: Generate migration**

Run: `npx prisma migrate dev --name add_document_snapshots`
Expected: combined migration (DocType enum + both models), Prisma client regenerated.

**Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(documents): add DocumentSnapshot + DocumentDistribution models"
```

---

### Task A4: Storage wrapper — `lib/storage/document-storage.ts`

**Files:**
- Create: `lib/storage/document-storage.ts`
- Test: `__tests__/documents/storage.test.ts`

**Step 1: Write failing test**

```ts
// __tests__/documents/storage.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { uploadDocument, getDocumentSignedUrl, deleteDocument } from '@/lib/storage/document-storage'

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(() => Promise.resolve({
        storage: {
            from: vi.fn(() => ({
                upload: vi.fn(() => Promise.resolve({ data: { path: 'PO/abc/v1.pdf' }, error: null })),
                createSignedUrl: vi.fn(() => Promise.resolve({
                    data: { signedUrl: 'https://example.com/signed?token=abc' },
                    error: null,
                })),
                remove: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
        },
    })),
}))

describe('document-storage', () => {
    it('uploadDocument returns the storage key on success', async () => {
        const buffer = Buffer.from('fake-pdf-bytes')
        const key = await uploadDocument(buffer, 'PO/abc/v1.pdf')
        expect(key).toBe('PO/abc/v1.pdf')
    })

    it('getDocumentSignedUrl returns a URL string', async () => {
        const url = await getDocumentSignedUrl('PO/abc/v1.pdf', 60 * 60)
        expect(url).toContain('https://')
    })

    it('deleteDocument is idempotent (no throw on missing)', async () => {
        await expect(deleteDocument('PO/missing/v0.pdf')).resolves.not.toThrow()
    })
})
```

**Step 2: Run — fails**

Run: `npx vitest run __tests__/documents/storage.test.ts`
Expected: FAIL — "Cannot find module '@/lib/storage/document-storage'".

**Step 3: Implement**

```ts
// lib/storage/document-storage.ts
import { createClient } from '@/lib/supabase/server'

const BUCKET = 'documents'

export async function uploadDocument(buffer: Buffer, key: string): Promise<string> {
    const supabase = await createClient()
    const { error } = await supabase.storage.from(BUCKET).upload(key, buffer, {
        contentType: 'application/pdf',
        upsert: false,
    })
    if (error) throw new Error(`Storage upload failed: ${error.message}`)
    return key
}

export async function getDocumentSignedUrl(key: string, expiresInSeconds = 60 * 60): Promise<string> {
    const supabase = await createClient()
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(key, expiresInSeconds)
    if (error || !data) throw new Error(`Signed URL failed: ${error?.message ?? 'unknown'}`)
    return data.signedUrl
}

export async function downloadDocument(key: string): Promise<Buffer> {
    const supabase = await createClient()
    const { data, error } = await supabase.storage.from(BUCKET).download(key)
    if (error || !data) throw new Error(`Download failed: ${error?.message ?? 'unknown'}`)
    return Buffer.from(await data.arrayBuffer())
}

export async function deleteDocument(key: string): Promise<void> {
    const supabase = await createClient()
    await supabase.storage.from(BUCKET).remove([key])
    // intentionally swallow "not found" — idempotent delete
}
```

**Step 4: Run — passes**

Run: `npx vitest run __tests__/documents/storage.test.ts`
Expected: 3 passed.

**Step 5: Commit**

```bash
git add lib/storage/document-storage.ts __tests__/documents/storage.test.ts
git commit -m "feat(documents): add Supabase storage wrapper for documents bucket"
```

---

### Task A5: Snapshot model integration test

**Files:**
- Test: `__tests__/documents/snapshot-model.test.ts`

**Step 1: Write test**

```ts
// __tests__/documents/snapshot-model.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

describe('DocumentSnapshot model', () => {
    const entityId = randomUUID()

    afterEach(async () => {
        await prisma.documentSnapshot.deleteMany({ where: { entityId } })
    })

    it('inserts v1 successfully', async () => {
        const snap = await prisma.documentSnapshot.create({
            data: {
                type: 'PO',
                entityId,
                version: 1,
                storageKey: `PO/${entityId}/v1.pdf`,
                triggerEvent: 'AUTO_PO_APPROVED',
            },
        })
        expect(snap.version).toBe(1)
    })

    it('rejects duplicate (type, entityId, version)', async () => {
        await prisma.documentSnapshot.create({
            data: { type: 'PO', entityId, version: 1, storageKey: 'k1', triggerEvent: 't' },
        })
        await expect(
            prisma.documentSnapshot.create({
                data: { type: 'PO', entityId, version: 1, storageKey: 'k2', triggerEvent: 't' },
            })
        ).rejects.toThrow()
    })

    it('lists snapshots in descending version order', async () => {
        await prisma.documentSnapshot.createMany({
            data: [
                { type: 'PO', entityId, version: 1, storageKey: 'v1', triggerEvent: 't' },
                { type: 'PO', entityId, version: 2, storageKey: 'v2', triggerEvent: 't' },
                { type: 'PO', entityId, version: 3, storageKey: 'v3', triggerEvent: 't' },
            ],
        })
        const list = await prisma.documentSnapshot.findMany({
            where: { type: 'PO', entityId },
            orderBy: { version: 'desc' },
        })
        expect(list.map(s => s.version)).toEqual([3, 2, 1])
    })

    it('cascade deletes distributions when snapshot deleted', async () => {
        const snap = await prisma.documentSnapshot.create({
            data: { type: 'PO', entityId, version: 1, storageKey: 'k', triggerEvent: 't' },
        })
        await prisma.documentDistribution.create({
            data: { snapshotId: snap.id, action: 'PRINT', actorId: randomUUID() },
        })
        await prisma.documentSnapshot.delete({ where: { id: snap.id } })
        const dists = await prisma.documentDistribution.findMany({ where: { snapshotId: snap.id } })
        expect(dists).toHaveLength(0)
    })
})
```

**Step 2: Run — passes (no impl needed; schema already in place from A2/A3)**

Run: `npx vitest run __tests__/documents/snapshot-model.test.ts`
Expected: 4 passed.

**Step 3: Commit**

```bash
git add __tests__/documents/snapshot-model.test.ts
git commit -m "test(documents): snapshot model unique constraint + cascade delete"
```

---

### Task A6: Phase A verification

**Step 1: Confirm migrations applied**

Run: `npx prisma migrate status`
Expected: "Database schema is up to date!"

**Step 2: Confirm Prisma client has new models**

Run: `npx tsc --noEmit lib/storage/document-storage.ts`
Expected: no errors.

**Step 3: Run all Phase A tests**

Run: `npx vitest run __tests__/documents/`
Expected: 7 passed (3 storage + 4 model).

**No commit** — verification only.

---

## Phase B — Brand Module + Templates (2 days, ~5 tasks)

### Task B1: Shared brand module — `templates/_shared/brand.typ`

**Why:** Single source of truth for header/footer/colors so changing the logo updates ALL 9 templates without editing each one.

**Files:**
- Create: `templates/_shared/brand.typ`

**Step 1: Implement**

```typst
// templates/_shared/brand.typ
// Shared brand module — read inputs once, expose helpers for all templates.

#let brand-inputs = (
  company_name: sys.inputs.at("company_name", default: "Perusahaan Anda"),
  company_address: sys.inputs.at("company_address", default: ""),
  company_npwp: sys.inputs.at("company_npwp", default: ""),
  company_email: sys.inputs.at("company_email", default: ""),
  company_phone: sys.inputs.at("company_phone", default: ""),
  logo_path: sys.inputs.at("logo_path", default: ""),
  brand_color: sys.inputs.at("brand_color", default: "#18181b"),
)

#let brand-color = rgb(brand-inputs.brand_color)
#let brand-text-color = rgb("#27272a")
#let brand-muted = rgb("#71717a")

#let header() = {
  block(
    width: 100%,
    inset: (bottom: 12pt),
    stroke: (bottom: 1.5pt + brand-color),
    grid(
      columns: (1fr, auto),
      align: (left + horizon, right + horizon),
      gutter: 12pt,
      [
        #if brand-inputs.logo_path != "" [
          #image(brand-inputs.logo_path, height: 32pt)
        ] else [
          #text(weight: "bold", size: 14pt, fill: brand-color)[#brand-inputs.company_name]
        ]
      ],
      [
        #text(weight: "bold", size: 11pt)[#brand-inputs.company_name] \
        #if brand-inputs.company_address != "" [
          #text(size: 8pt, fill: brand-muted)[#brand-inputs.company_address] \
        ]
        #if brand-inputs.company_npwp != "" [
          #text(size: 8pt, fill: brand-muted)[NPWP: #brand-inputs.company_npwp]
        ]
      ],
    ),
  )
}

#let footer() = {
  align(center)[
    #text(size: 7pt, fill: brand-muted)[
      #brand-inputs.company_name
      #if brand-inputs.company_email != "" [• #brand-inputs.company_email]
      #if brand-inputs.company_phone != "" [• #brand-inputs.company_phone]
    ]
  ]
}
```

**Step 2: Manual smoke test**

Run: `mkdir -p /tmp/brand-test && bin/typst compile --input company_name="PT Test" --input brand_color="#f97316" -- templates/_shared/brand.typ /tmp/brand-test/out.pdf 2>&1 || echo "expected — brand.typ has no top-level content; that's fine"`
Expected: error "no content" — confirms file parses but is import-only.

Better verification — create `templates/_shared/_test.typ` temporarily:

```typst
#import "brand.typ": header, footer
#header()
#text[Body content]
#footer()
```

Run: `bin/typst compile --input company_name="PT Test" --input brand_color="#f97316" templates/_shared/_test.typ /tmp/brand-test/out.pdf && echo OK && rm templates/_shared/_test.typ`
Expected: `OK` printed, PDF generated.

**Step 3: Commit**

```bash
git add templates/_shared/brand.typ
git commit -m "feat(documents): add shared brand Typst module"
```

---

### Task B2: Update first 3 templates to use shared brand

**Files:**
- Modify: `templates/purchase_order/main.typ`
- Modify: `templates/invoice/main.typ`
- Modify: `templates/surat_jalan/main.typ`

**Step 1: For each template, do these edits**

At the **top** of each `main.typ` (after page setup but before content):
```typst
#import "../_shared/brand.typ": header, footer, brand-color, brand-muted
```

In each template's existing header block, **replace** the inline header (logo + company name + address) with:
```typst
#header()
```

In `set page(...)` calls, set the footer:
```typst
#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2.5cm, left: 1.5cm, right: 1.5cm),
  footer: footer(),
)
```

**Step 2: Smoke test each template**

For each, run an existing PDF endpoint to confirm it still renders:
- PO: `curl -s http://localhost:3002/api/procurement/orders/<any-existing-id>/pdf -o /tmp/po.pdf && file /tmp/po.pdf`
- Invoice: similarly via `/api/finance/invoices/<id>/pdf` (if exists)
- Surat Jalan: via existing endpoint

Expected: each output is `PDF document, version X.X`.

**Step 3: Commit**

```bash
git add templates/purchase_order/main.typ templates/invoice/main.typ templates/surat_jalan/main.typ
git commit -m "feat(documents): wire shared brand into PO + Invoice + Surat Jalan templates"
```

---

### Task B3: Update remaining 6 templates to use shared brand

**Files:** same edits as B2 applied to:
- `templates/payroll_report/main.typ`
- `templates/payslip/main.typ`
- `templates/faktur_pajak/main.typ`
- `templates/surat_jalan_masuk/main.typ`
- `templates/production_bom/main.typ`
- `templates/spk/main.typ`

**Step 1:** Apply same `#import` + `#header()` + `footer: footer()` edits to each.

**Step 2:** Smoke test each via its respective existing PDF endpoint.

**Step 3: Commit**

```bash
git add templates/
git commit -m "feat(documents): wire shared brand into remaining 6 templates"
```

---

### Task B4: Brand resolver — `lib/documents/brand-resolver.ts`

**Files:**
- Create: `lib/documents/brand-resolver.ts`
- Test: `__tests__/documents/brand-resolver.test.ts`

**Step 1: Write failing test**

```ts
// __tests__/documents/brand-resolver.test.ts
import { describe, it, expect, vi } from 'vitest'
import { resolveBrandInputs } from '@/lib/documents/brand-resolver'

vi.mock('@/lib/db', () => ({
    prisma: {
        tenantConfig: {
            findFirst: vi.fn(),
        },
    },
}))

vi.mock('@/lib/storage/document-storage', () => ({
    getDocumentSignedUrl: vi.fn(() => Promise.resolve('https://example.com/logo.png')),
}))

import { prisma } from '@/lib/db'
import { getDocumentSignedUrl } from '@/lib/storage/document-storage'

describe('brand-resolver', () => {
    it('returns full brand inputs when TenantConfig fully populated', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
            tenantName: 'PT Integra',
            companyAddress: 'Jl. Test 1',
            companyNpwp: '01.234.567.8-901.000',
            companyEmail: 'info@integra.id',
            companyPhone: '+62 21 1234567',
            logoStorageKey: '_brand/logo.png',
            primaryColor: '#f97316',
        })

        const inputs = await resolveBrandInputs()
        expect(inputs.company_name).toBe('PT Integra')
        expect(inputs.company_npwp).toBe('01.234.567.8-901.000')
        expect(inputs.brand_color).toBe('#f97316')
        expect(inputs.logo_path).toBe('https://example.com/logo.png')
    })

    it('falls back to defaults when TenantConfig missing', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue(null)

        const inputs = await resolveBrandInputs()
        expect(inputs.company_name).toBe('Perusahaan Anda')
        expect(inputs.brand_color).toBe('#18181b')
        expect(inputs.logo_path).toBe('')
    })

    it('falls back to empty logo_path when logoStorageKey null', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
            tenantName: 'PT Test',
            primaryColor: null,
            logoStorageKey: null,
        })

        const inputs = await resolveBrandInputs()
        expect(inputs.logo_path).toBe('')
        expect(inputs.brand_color).toBe('#18181b') // default
    })

    it('falls back to defaults when storage URL signing fails', async () => {
        ;(prisma.tenantConfig.findFirst as any).mockResolvedValue({
            tenantName: 'PT Test',
            logoStorageKey: '_brand/missing.png',
        })
        ;(getDocumentSignedUrl as any).mockRejectedValueOnce(new Error('not found'))

        const inputs = await resolveBrandInputs()
        expect(inputs.logo_path).toBe('') // graceful: no logo, no throw
    })
})
```

**Step 2: Run — fails**

Run: `npx vitest run __tests__/documents/brand-resolver.test.ts`
Expected: module not found.

**Step 3: Implement**

```ts
// lib/documents/brand-resolver.ts
import { prisma } from '@/lib/db'
import { getDocumentSignedUrl } from '@/lib/storage/document-storage'

export interface BrandInputs {
    company_name: string
    company_address: string
    company_npwp: string
    company_email: string
    company_phone: string
    logo_path: string
    brand_color: string
}

const DEFAULTS: BrandInputs = {
    company_name: 'Perusahaan Anda',
    company_address: '',
    company_npwp: '',
    company_email: '',
    company_phone: '',
    logo_path: '',
    brand_color: '#18181b',
}

export async function resolveBrandInputs(): Promise<BrandInputs> {
    const config = await prisma.tenantConfig.findFirst().catch(() => null)
    if (!config) return DEFAULTS

    let logoPath = ''
    if (config.logoStorageKey) {
        try {
            logoPath = await getDocumentSignedUrl(config.logoStorageKey, 60 * 60)
        } catch {
            // graceful: missing logo doesn't block render
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

**Step 4: Run — passes**

Run: `npx vitest run __tests__/documents/brand-resolver.test.ts`
Expected: 4 passed.

**Step 5: Commit**

```bash
git add lib/documents/brand-resolver.ts __tests__/documents/brand-resolver.test.ts
git commit -m "feat(documents): brand resolver reads TenantConfig + signs logo URL"
```

---

### Task B5: Branding form UI — `components/settings/branding-form.tsx`

**Why:** User-facing form to edit company name, address, NPWP, brand color. Logo upload deferred to a small companion component (B5b).

**Files:**
- Create: `components/settings/branding-form.tsx`
- Create: `app/api/settings/branding/route.ts`
- Modify: `app/settings/page.tsx` (add form to existing settings page) — or create if missing

**Step 1: API route**

```ts
// app/api/settings/branding/route.ts
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
```

**Step 2: Component**

```tsx
// components/settings/branding-form.tsx
"use client"
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export function BrandingForm() {
    const [form, setForm] = useState({
        tenantName: '',
        companyAddress: '',
        companyNpwp: '',
        companyEmail: '',
        companyPhone: '',
        primaryColor: '#18181b',
        logoStorageKey: '',
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetch('/api/settings/branding')
            .then(r => r.json())
            .then(({ data }) => { if (data) setForm(f => ({ ...f, ...data })); setLoading(false) })
    }, [])

    async function onSave() {
        const res = await fetch('/api/settings/branding', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
        })
        if (!res.ok) { toast.error('Gagal menyimpan'); return }
        toast.success('Branding disimpan')
    }

    if (loading) return <div className="text-sm text-zinc-500">Memuat...</div>

    return (
        <div className="space-y-4 max-w-xl">
            <div>
                <Label>Nama Perusahaan</Label>
                <Input value={form.tenantName} onChange={e => setForm({ ...form, tenantName: e.target.value })} />
            </div>
            <div>
                <Label>Alamat</Label>
                <Input value={form.companyAddress ?? ''} onChange={e => setForm({ ...form, companyAddress: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <Label>NPWP</Label>
                    <Input value={form.companyNpwp ?? ''} onChange={e => setForm({ ...form, companyNpwp: e.target.value })} />
                </div>
                <div>
                    <Label>Telepon</Label>
                    <Input value={form.companyPhone ?? ''} onChange={e => setForm({ ...form, companyPhone: e.target.value })} />
                </div>
            </div>
            <div>
                <Label>Email</Label>
                <Input value={form.companyEmail ?? ''} onChange={e => setForm({ ...form, companyEmail: e.target.value })} />
            </div>
            <div>
                <Label>Brand Color</Label>
                <div className="flex items-center gap-2">
                    <Input type="color" value={form.primaryColor ?? '#18181b'} onChange={e => setForm({ ...form, primaryColor: e.target.value })} className="w-16 h-9 p-1" />
                    <Input value={form.primaryColor ?? ''} onChange={e => setForm({ ...form, primaryColor: e.target.value })} placeholder="#18181b" className="flex-1" />
                </div>
            </div>
            <Button onClick={onSave}>Simpan Branding</Button>
        </div>
    )
}
```

**Step 3: Wire into settings page**

Edit `app/settings/page.tsx` (or create if missing) to import + render `<BrandingForm />` in a "Branding" section.

**Step 4: Manual test**

Run: `npm run dev`, open http://localhost:3002/settings, edit company name, click Simpan → toast appears, refresh → value persists.

**Step 5: Commit**

```bash
git add app/api/settings/branding/ components/settings/branding-form.tsx app/settings/page.tsx
git commit -m "feat(documents): branding form for TenantConfig"
```

---

## Phase C — Document Service + Triggers + APIs (2 days, ~8 tasks)

### Task C1: Trigger registry — `lib/documents/triggers.ts`

**Files:**
- Create: `lib/documents/triggers.ts`
- Test: `__tests__/documents/triggers.test.ts`

**Step 1: Write failing test**

```ts
// __tests__/documents/triggers.test.ts
import { describe, it, expect, vi } from 'vitest'
import { AUTO_TRIGGERS, fireTrigger } from '@/lib/documents/triggers'

vi.mock('@/lib/documents/document-service', () => ({
    generateSnapshot: vi.fn(() => Promise.resolve({ id: 'snap-1', version: 1 })),
}))

describe('AUTO_TRIGGERS registry', () => {
    it('contains expected keys', () => {
        expect(AUTO_TRIGGERS.PO_APPROVED).toBeDefined()
        expect(AUTO_TRIGGERS.PO_ORDERED).toBeDefined()
        expect(AUTO_TRIGGERS.PR_APPROVED).toBeDefined()
        expect(AUTO_TRIGGERS.GRN_ACCEPTED).toBeDefined()
        expect(AUTO_TRIGGERS.INVOICE_ISSUED).toBeDefined()
    })

    it('each trigger has a type and event', () => {
        for (const trigger of Object.values(AUTO_TRIGGERS)) {
            expect(trigger.type).toBeTruthy()
            expect(trigger.event).toBeTruthy()
        }
    })
})

describe('fireTrigger', () => {
    it('calls generateSnapshot with mapped type + event', async () => {
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        await fireTrigger('PO_APPROVED', 'po-uuid', 'user-uuid')
        expect(generateSnapshot).toHaveBeenCalledWith({
            type: 'PO',
            entityId: 'po-uuid',
            trigger: 'AUTO_PO_APPROVED',
            actorId: 'user-uuid',
        })
    })

    it('does NOT throw when generateSnapshot rejects (fire-and-forget)', async () => {
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        ;(generateSnapshot as any).mockRejectedValueOnce(new Error('render failed'))
        await expect(fireTrigger('PO_APPROVED', 'po-uuid', 'user-uuid')).resolves.not.toThrow()
    })
})
```

**Step 2: Run — fails**

`npx vitest run __tests__/documents/triggers.test.ts` — module not found.

**Step 3: Implement**

```ts
// lib/documents/triggers.ts
import type { DocType } from '@prisma/client'
import { generateSnapshot } from '@/lib/documents/document-service'

export const AUTO_TRIGGERS = {
    PO_APPROVED:    { type: 'PO'         as DocType, event: 'AUTO_PO_APPROVED' },
    PO_ORDERED:     { type: 'PO'         as DocType, event: 'AUTO_PO_SENT' },
    PR_APPROVED:    { type: 'PR'         as DocType, event: 'AUTO_PR_APPROVED' },
    GRN_ACCEPTED:   { type: 'GRN'        as DocType, event: 'AUTO_GRN_ACCEPTED' },
    INVOICE_ISSUED: { type: 'INVOICE_AR' as DocType, event: 'AUTO_INVOICE_ISSUED' },
} as const

export type AutoTriggerKey = keyof typeof AUTO_TRIGGERS

export async function fireTrigger(
    key: AutoTriggerKey,
    entityId: string,
    actorId: string,
): Promise<void> {
    const trigger = AUTO_TRIGGERS[key]
    try {
        await generateSnapshot({
            type: trigger.type,
            entityId,
            trigger: trigger.event,
            actorId,
        })
    } catch (err) {
        // fire-and-forget: never block the caller's business action
        console.error(`[fireTrigger ${key}] failed:`, err)
    }
}
```

**Step 4: Run — passes**

`npx vitest run __tests__/documents/triggers.test.ts` → 4 passed.

**Step 5: Commit**

```bash
git add lib/documents/triggers.ts __tests__/documents/triggers.test.ts
git commit -m "feat(documents): typed AUTO_TRIGGERS registry + fire-and-forget"
```

---

### Task C2: Render adapter — map DocType → template name + fetch entity data

**Files:**
- Create: `lib/documents/render-adapter.ts`

**Why separate file:** `document-service.ts` shouldn't know about Prisma models for every DocType. The adapter encapsulates "given (type, entityId), return (templateName, dataPayload)".

**Step 1: Implement** (no test — pure mapping; tested transitively via document-service)

```ts
// lib/documents/render-adapter.ts
import { prisma } from '@/lib/db'
import type { DocType } from '@prisma/client'

interface RenderTarget {
    templateName: string
    payload: any
}

export async function buildRenderTarget(type: DocType, entityId: string): Promise<RenderTarget> {
    switch (type) {
        case 'PO': {
            const po = await prisma.purchaseOrder.findUnique({
                where: { id: entityId },
                include: { items: true, supplier: true },
            })
            if (!po) throw new Error(`PO not found: ${entityId}`)
            return { templateName: 'purchase_order', payload: po }
        }
        case 'PR': {
            const pr = await prisma.purchaseRequest.findUnique({
                where: { id: entityId },
                include: { items: true },
            })
            if (!pr) throw new Error(`PR not found: ${entityId}`)
            return { templateName: 'purchase_order', payload: pr } // reuse PO template for now
        }
        case 'GRN': {
            const grn = await prisma.goodsReceivedNote.findUnique({
                where: { id: entityId },
                include: { items: true, purchaseOrder: { include: { supplier: true } } },
            })
            if (!grn) throw new Error(`GRN not found: ${entityId}`)
            return { templateName: 'surat_jalan_masuk', payload: grn }
        }
        case 'VENDOR_PROFILE': {
            const vendor = await prisma.supplier.findUnique({ where: { id: entityId } })
            if (!vendor) throw new Error(`Vendor not found: ${entityId}`)
            return { templateName: 'purchase_order', payload: vendor } // placeholder
        }
        case 'INVOICE_AR':
        case 'INVOICE_AP': {
            const inv = await prisma.invoice.findUnique({
                where: { id: entityId },
                include: { items: true, customer: true, supplier: true },
            })
            if (!inv) throw new Error(`Invoice not found: ${entityId}`)
            return { templateName: 'invoice', payload: inv }
        }
        default:
            throw new Error(`Render adapter not implemented for type: ${type}`)
    }
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit lib/documents/render-adapter.ts`
Expected: clean (or only pre-existing project errors).

**Step 3: Commit**

```bash
git add lib/documents/render-adapter.ts
git commit -m "feat(documents): render adapter maps DocType to template + entity payload"
```

---

### Task C3: Document service — `lib/documents/document-service.ts`

**Files:**
- Create: `lib/documents/document-service.ts`
- Test: `__tests__/documents/document-service.test.ts`

**Step 1: Write failing test**

```ts
// __tests__/documents/document-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSnapshot, listVersions, logDistribution, updateMetadata } from '@/lib/documents/document-service'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'

vi.mock('@/lib/services/document-service', () => ({
    DocumentService: { generatePDF: vi.fn(() => Promise.resolve(Buffer.from('fake-pdf'))) },
}))
vi.mock('@/lib/storage/document-storage', () => ({
    uploadDocument: vi.fn((_, key) => Promise.resolve(key)),
    getDocumentSignedUrl: vi.fn(() => Promise.resolve('https://signed')),
}))
vi.mock('@/lib/documents/render-adapter', () => ({
    buildRenderTarget: vi.fn(() => Promise.resolve({ templateName: 'purchase_order', payload: { foo: 'bar' } })),
}))
vi.mock('@/lib/documents/brand-resolver', () => ({
    resolveBrandInputs: vi.fn(() => Promise.resolve({ company_name: 'Test Co', brand_color: '#000' })),
}))

describe('generateSnapshot', () => {
    const entityId = randomUUID()
    const actorId = randomUUID()

    beforeEach(async () => {
        await prisma.documentSnapshot.deleteMany({ where: { entityId } })
    })

    it('creates v1 on first call', async () => {
        const snap = await generateSnapshot({ type: 'PO', entityId, trigger: 'AUTO_PO_APPROVED', actorId })
        expect(snap.version).toBe(1)
        expect(snap.storageKey).toContain(`PO/${entityId}/v1`)
    })

    it('creates v2 on second call (auto-increments)', async () => {
        await generateSnapshot({ type: 'PO', entityId, trigger: 'AUTO_PO_APPROVED', actorId })
        const snap2 = await generateSnapshot({ type: 'PO', entityId, trigger: 'MANUAL_REGENERATE', actorId })
        expect(snap2.version).toBe(2)
    })

    it('does NOT insert row when render fails', async () => {
        const { DocumentService } = await import('@/lib/services/document-service')
        ;(DocumentService.generatePDF as any).mockRejectedValueOnce(new Error('render fail'))
        await expect(generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId })).rejects.toThrow()
        const snaps = await prisma.documentSnapshot.findMany({ where: { entityId } })
        expect(snaps).toHaveLength(0)
    })
})

describe('listVersions', () => {
    const entityId = randomUUID()
    beforeEach(async () => { await prisma.documentSnapshot.deleteMany({ where: { entityId } }) })

    it('returns versions descending', async () => {
        await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        const list = await listVersions('PO', entityId)
        expect(list.map(v => v.version)).toEqual([2, 1])
    })
})

describe('logDistribution', () => {
    it('inserts a distribution row linked to snapshot', async () => {
        const entityId = randomUUID()
        const snap = await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        const dist = await logDistribution({
            snapshotId: snap.id,
            action: 'PRINT',
            actorId: randomUUID(),
        })
        expect(dist.action).toBe('PRINT')
    })
})

describe('updateMetadata', () => {
    it('updates label without touching storageKey', async () => {
        const entityId = randomUUID()
        const snap = await generateSnapshot({ type: 'PO', entityId, trigger: 't', actorId: randomUUID() })
        const updated = await updateMetadata({ snapshotId: snap.id, label: 'Final v1' })
        expect(updated.label).toBe('Final v1')
        expect(updated.storageKey).toBe(snap.storageKey)
    })
})
```

**Step 2: Run — fails**

`npx vitest run __tests__/documents/document-service.test.ts` — module not found.

**Step 3: Implement**

```ts
// lib/documents/document-service.ts
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import type { DocType, DocumentSnapshot, DocumentDistribution } from '@prisma/client'
import { DocumentService as TypstService } from '@/lib/services/document-service'
import { uploadDocument } from '@/lib/storage/document-storage'
import { buildRenderTarget } from '@/lib/documents/render-adapter'
import { resolveBrandInputs } from '@/lib/documents/brand-resolver'

interface GenerateInput {
    type: DocType
    entityId: string
    trigger: string
    actorId?: string | null
    metadata?: Record<string, unknown>
}

export async function generateSnapshot(input: GenerateInput): Promise<DocumentSnapshot> {
    const { type, entityId, trigger, actorId, metadata } = input

    // 1. Build render target (template name + entity payload)
    const target = await buildRenderTarget(type, entityId)

    // 2. Resolve brand inputs from TenantConfig
    const brand = await resolveBrandInputs()

    // 3. Render PDF with brand merged into template inputs
    const pdfBuffer = await TypstService.generatePDF(target.templateName, {
        ...target.payload,
        ...brand, // merged so templates can read sys.inputs.company_name etc.
    })

    // 4. Compute next version (race-safe via @@unique constraint + retry)
    let version = (await prisma.documentSnapshot.count({ where: { type, entityId } })) + 1
    const storageKey = `${type}/${entityId}/v${version}-${randomUUID()}.pdf`

    // 5. Upload first — if storage fails, no DB row created
    await uploadDocument(pdfBuffer, storageKey)

    // 6. Insert DB row (retry once on race-condition unique violation)
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
        if (e.code === 'P2002') {
            version = (await prisma.documentSnapshot.count({ where: { type, entityId } })) + 1
            const retryKey = `${type}/${entityId}/v${version}-${randomUUID()}.pdf`
            await uploadDocument(pdfBuffer, retryKey)
            return prisma.documentSnapshot.create({
                data: {
                    type, entityId, version, storageKey: retryKey,
                    triggerEvent: trigger,
                    generatedBy: actorId ?? null,
                    metadata: metadata as any,
                },
            })
        }
        throw e
    }
}

export async function regenerateSnapshot(snapshotId: string, actorId?: string | null): Promise<DocumentSnapshot> {
    const original = await prisma.documentSnapshot.findUnique({ where: { id: snapshotId } })
    if (!original) throw new Error(`Snapshot not found: ${snapshotId}`)
    return generateSnapshot({
        type: original.type,
        entityId: original.entityId,
        trigger: 'MANUAL_REGENERATE',
        actorId,
    })
}

export async function listVersions(type: DocType, entityId: string): Promise<DocumentSnapshot[]> {
    return prisma.documentSnapshot.findMany({
        where: { type, entityId, archivedAt: null },
        orderBy: { version: 'desc' },
        include: { distributions: true } as any,
    })
}

interface LogDistInput {
    snapshotId: string
    action: 'PRINT' | 'DOWNLOAD' | 'EMAIL'
    actorId: string
    recipientEmail?: string
    notes?: string
}

export async function logDistribution(input: LogDistInput): Promise<DocumentDistribution> {
    return prisma.documentDistribution.create({ data: input })
}

interface UpdateMetaInput {
    snapshotId: string
    label?: string
    tags?: string[]
    archivedAt?: Date | null
}

export async function updateMetadata(input: UpdateMetaInput): Promise<DocumentSnapshot> {
    const { snapshotId, ...rest } = input
    return prisma.documentSnapshot.update({ where: { id: snapshotId }, data: rest })
}
```

**Step 4: Run — passes**

`npx vitest run __tests__/documents/document-service.test.ts` → all passed.

**Step 5: Commit**

```bash
git add lib/documents/document-service.ts __tests__/documents/document-service.test.ts
git commit -m "feat(documents): document service with snapshot/regenerate/list/log/update"
```

---

### Task C4: API route — generate / regenerate

**Files:**
- Create: `app/api/documents/snapshots/route.ts`
- Create: `app/api/documents/snapshots/[id]/route.ts`
- Create: `app/api/documents/regenerate/route.ts`

**Step 1: Implement**

```ts
// app/api/documents/snapshots/route.ts
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
```

```ts
// app/api/documents/snapshots/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { updateMetadata } from '@/lib/documents/document-service'
import { getDocumentSignedUrl } from '@/lib/storage/document-storage'
import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function requireAuth() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) throw new Error('Unauthorized')
    return user
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth()
        const { id } = await params
        const snap = await prisma.documentSnapshot.findUnique({ where: { id } })
        if (!snap) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        const url = await getDocumentSignedUrl(snap.storageKey, 60 * 60)
        return NextResponse.json({ data: { ...snap, signedUrl: url } })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 401 })
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        await requireAuth()
        const { id } = await params
        const body = await req.json()
        const updated = await updateMetadata({
            snapshotId: id,
            label: body.label, tags: body.tags, archivedAt: body.archivedAt,
        })
        return NextResponse.json({ data: updated })
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 })
    }
}
```

```ts
// app/api/documents/regenerate/route.ts
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
```

**Step 2: Manual test**

Run: `npm run dev`. With existing PO id, run:

```bash
curl -s -X POST http://localhost:3002/api/documents/snapshots \
  -H "Cookie: <copy from browser>" \
  -H "Content-Type: application/json" \
  -d '{"type":"PO","entityId":"<existing-po-uuid>"}'
```

Expected: `{"data":{"id":"...","version":1,"storageKey":"PO/.../v1-...pdf",...}}`

**Step 3: Commit**

```bash
git add app/api/documents/
git commit -m "feat(documents): API routes for snapshot generate/list/regenerate/metadata"
```

---

### Task C5: API route — distributions

**Files:**
- Create: `app/api/documents/distributions/route.ts`

**Step 1: Implement**

```ts
// app/api/documents/distributions/route.ts
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
```

**Step 2: Manual test**

Run with valid snapshot id from C4:
```bash
curl -X POST http://localhost:3002/api/documents/distributions \
  -H "Cookie: <browser session>" -H "Content-Type: application/json" \
  -d '{"snapshotId":"<snap-uuid>","action":"PRINT"}'
```
Expected: `{"data":{"id":"...","action":"PRINT",...}}`

**Step 3: Commit**

```bash
git add app/api/documents/distributions/
git commit -m "feat(documents): distributions API + email stub"
```

---

### Task C6: Phase C verification

**Step 1: Run all Phase A+B+C tests**

Run: `npx vitest run __tests__/documents/`
Expected: storage(3) + snapshot-model(4) + brand-resolver(4) + triggers(4) + document-service(~6) → ~21 passed.

**Step 2: TypeScript check**

Run: `npx tsc --noEmit | grep -E "lib/(documents|storage)|app/api/documents" | head -10`
Expected: no errors in our files.

**No commit** — verification only.

---

## Phase D — UI Primitives (2 days, ~6 tasks)

### Task D1: TanStack Query hook + query keys

**Files:**
- Modify: `lib/query-keys.ts` (add documents key factory)
- Create: `hooks/use-document-snapshots.ts`

**Step 1: Add to query keys**

Open `lib/query-keys.ts`, add:
```ts
documents: {
    all: ['documents'] as const,
    list: (type: string, entityId: string) => ['documents', type, entityId] as const,
    distributions: (snapshotId: string) => ['documents', 'distributions', snapshotId] as const,
},
```

**Step 2: Create hook**

```ts
// hooks/use-document-snapshots.ts
"use client"
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { toast } from 'sonner'

export function useDocumentSnapshots(type: string, entityId: string) {
    return useQuery({
        queryKey: queryKeys.documents.list(type, entityId),
        queryFn: async () => {
            const res = await fetch(`/api/documents/snapshots?type=${type}&entityId=${entityId}`)
            const json = await res.json()
            return json.data ?? []
        },
        enabled: !!entityId,
    })
}

export function useGenerateSnapshot(type: string, entityId: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async () => {
            const res = await fetch('/api/documents/snapshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, entityId }),
            })
            if (!res.ok) throw new Error('Generate failed')
            return res.json()
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.documents.list(type, entityId) })
            toast.success('PDF dibuat')
        },
        onError: () => toast.error('Gagal membuat PDF'),
    })
}

export function useRegenerateSnapshot(type: string, entityId: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: async (snapshotId: string) => {
            const res = await fetch('/api/documents/regenerate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ snapshotId }),
            })
            if (!res.ok) throw new Error('Regenerate failed')
            return res.json()
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: queryKeys.documents.list(type, entityId) })
            toast.success('Versi baru dibuat')
        },
    })
}

export function useLogDistribution() {
    return useMutation({
        mutationFn: async (input: { snapshotId: string; action: string; recipientEmail?: string; notes?: string }) => {
            await fetch('/api/documents/distributions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(input),
            })
        },
    })
}

export async function fetchSignedUrl(snapshotId: string): Promise<string> {
    const res = await fetch(`/api/documents/snapshots/${snapshotId}`)
    const json = await res.json()
    return json.data.signedUrl
}
```

**Step 3: Commit**

```bash
git add lib/query-keys.ts hooks/use-document-snapshots.ts
git commit -m "feat(documents): TanStack Query hooks for snapshots/distributions"
```

---

### Task D2: `DocumentVersionPill` + `DocumentTypeBadge`

**Files:**
- Create: `components/documents/document-version-pill.tsx`
- Create: `components/documents/document-type-badge.tsx`

**Step 1: Implement**

```tsx
// components/documents/document-version-pill.tsx
"use client"
import { cn } from '@/lib/utils'

interface Props { version: number; isLatest?: boolean; className?: string }

export function DocumentVersionPill({ version, isLatest, className }: Props) {
    return (
        <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-none border',
            isLatest ? 'bg-orange-500 text-white border-orange-600' : 'bg-zinc-100 text-zinc-700 border-zinc-300',
            className,
        )}>
            v{version}
            {isLatest && <span className="text-[8px]">TERBARU</span>}
        </span>
    )
}
```

```tsx
// components/documents/document-type-badge.tsx
"use client"
import { cn } from '@/lib/utils'

const LABELS: Record<string, { label: string; color: string }> = {
    PO:             { label: 'Purchase Order',   color: 'bg-blue-100 text-blue-800 border-blue-300' },
    PR:             { label: 'Purchase Request', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    GRN:            { label: 'Surat Jalan Masuk', color: 'bg-green-100 text-green-800 border-green-300' },
    VENDOR_PROFILE: { label: 'Profil Vendor',    color: 'bg-zinc-100 text-zinc-800 border-zinc-300' },
    INVOICE_AR:     { label: 'Invoice (AR)',     color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    INVOICE_AP:     { label: 'Invoice (AP)',     color: 'bg-amber-100 text-amber-800 border-amber-300' },
    FAKTUR_PAJAK:   { label: 'Faktur Pajak',     color: 'bg-red-100 text-red-800 border-red-300' },
    PAYSLIP:        { label: 'Slip Gaji',        color: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
    BOM:            { label: 'BOM',              color: 'bg-pink-100 text-pink-800 border-pink-300' },
    SPK:            { label: 'SPK',              color: 'bg-cyan-100 text-cyan-800 border-cyan-300' },
}

export function DocumentTypeBadge({ type }: { type: string }) {
    const meta = LABELS[type] ?? { label: type, color: 'bg-zinc-100 text-zinc-700 border-zinc-300' }
    return (
        <span className={cn('inline-flex px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-none border', meta.color)}>
            {meta.label}
        </span>
    )
}
```

**Step 2: Commit**

```bash
git add components/documents/document-version-pill.tsx components/documents/document-type-badge.tsx
git commit -m "feat(documents): version pill + type badge primitives"
```

---

### Task D3: `DistributionDialog`

**Files:**
- Create: `components/documents/distribution-dialog.tsx`

**Step 1: Implement**

```tsx
// components/documents/distribution-dialog.tsx
"use client"
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

interface Props {
    open: boolean
    onClose: () => void
    onSubmit: (recipientEmail: string, notes: string) => Promise<void> | void
}

export function DistributionDialog({ open, onClose, onSubmit }: Props) {
    const [email, setEmail] = useState('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    function isValidEmail(v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
    }

    async function handleSubmit() {
        if (!isValidEmail(email)) return
        setSubmitting(true)
        try {
            await onSubmit(email, notes)
            setEmail(''); setNotes('')
            onClose()
        } finally { setSubmitting(false) }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent>
                <DialogHeader><DialogTitle>Kirim PDF via Email</DialogTitle></DialogHeader>
                <div className="space-y-3">
                    <div>
                        <Label>Email Penerima</Label>
                        <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="vendor@example.com" />
                    </div>
                    <div>
                        <Label>Catatan (opsional)</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Mohon konfirmasi penerimaan..." rows={3} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Batal</Button>
                    <Button onClick={handleSubmit} disabled={!isValidEmail(email) || submitting}>
                        {submitting ? 'Mengirim...' : 'Kirim'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
```

**Step 2: Commit**

```bash
git add components/documents/distribution-dialog.tsx
git commit -m "feat(documents): distribution email dialog"
```

---

### Task D4: `DocumentVersionRow` (single row in list)

**Files:**
- Create: `components/documents/document-version-row.tsx`

**Step 1: Implement**

```tsx
// components/documents/document-version-row.tsx
"use client"
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Download, Mail, RotateCw } from 'lucide-react'
import { DocumentVersionPill } from './document-version-pill'
import { DistributionDialog } from './distribution-dialog'
import { useLogDistribution, useRegenerateSnapshot, fetchSignedUrl } from '@/hooks/use-document-snapshots'

interface Snapshot {
    id: string
    version: number
    triggerEvent: string
    generatedAt: string | Date
    label?: string | null
}

interface Props {
    snapshot: Snapshot
    isLatest: boolean
    type: string
    entityId: string
}

export function DocumentVersionRow({ snapshot, isLatest, type, entityId }: Props) {
    const [emailOpen, setEmailOpen] = useState(false)
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
                <Button size="sm" variant="ghost" onClick={() => handleOpen('PRINT')}>
                    <Printer className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleOpen('DOWNLOAD')}>
                    <Download className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEmailOpen(true)}>
                    <Mail className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => regen.mutate(snapshot.id)} disabled={regen.isPending}>
                    <RotateCw className="h-3.5 w-3.5" />
                </Button>
            </div>
            <DistributionDialog
                open={emailOpen}
                onClose={() => setEmailOpen(false)}
                onSubmit={async (email, notes) => {
                    await logDist.mutateAsync({ snapshotId: snapshot.id, action: 'EMAIL', recipientEmail: email, notes })
                }}
            />
        </div>
    )
}
```

**Step 2: Commit**

```bash
git add components/documents/document-version-row.tsx
git commit -m "feat(documents): single-row component with print/download/email/regen actions"
```

---

### Task D5: `DocumentSnapshotList` (the main "Lampiran" tab content)

**Files:**
- Create: `components/documents/document-snapshot-list.tsx`

**Step 1: Implement**

```tsx
// components/documents/document-snapshot-list.tsx
"use client"
import { Button } from '@/components/ui/button'
import { FileText, Plus } from 'lucide-react'
import { DocumentVersionRow } from './document-version-row'
import { useDocumentSnapshots, useGenerateSnapshot } from '@/hooks/use-document-snapshots'

interface Props {
    type: string
    entityId: string
}

export function DocumentSnapshotList({ type, entityId }: Props) {
    const { data: snapshots = [], isLoading } = useDocumentSnapshots(type, entityId)
    const generate = useGenerateSnapshot(type, entityId)

    if (isLoading) {
        return <div className="p-8 text-center text-sm text-zinc-500">Memuat dokumen...</div>
    }

    if (snapshots.length === 0) {
        return (
            <div className="p-8 text-center border border-dashed border-zinc-300 rounded">
                <FileText className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                <p className="text-sm text-zinc-500 mb-3">Belum ada dokumen tercatat</p>
                <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending}>
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    {generate.isPending ? 'Membuat...' : 'Generate Sekarang'}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{snapshots.length} versi</div>
                <Button size="sm" variant="outline" onClick={() => generate.mutate()} disabled={generate.isPending}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Versi Baru
                </Button>
            </div>
            <div className="border border-zinc-200 rounded">
                {snapshots.map((s: any, i: number) => (
                    <DocumentVersionRow
                        key={s.id}
                        snapshot={s}
                        isLatest={i === 0}
                        type={type}
                        entityId={entityId}
                    />
                ))}
            </div>
        </div>
    )
}
```

**Step 2: Commit**

```bash
git add components/documents/document-snapshot-list.tsx
git commit -m "feat(documents): snapshot list with empty state + version rows"
```

---

### Task D6: Phase D smoke test

**Step 1:** Run `npm run dev`. Open any existing PO detail page. Manually drop the component into the page temporarily:

```tsx
import { DocumentSnapshotList } from '@/components/documents/document-snapshot-list'
// ...
<DocumentSnapshotList type="PO" entityId={po.id} />
```

**Step 2:** Verify:
- Empty state appears
- Click "Generate Sekarang" → toast → row appears with v1 + TERBARU pill
- Click Print → PDF opens in new tab + distribution log entry created
- Click "Versi Baru" → v2 appears, v1 loses TERBARU pill

**Step 3: Revert temporary integration** — Phase E will wire it for real.

```bash
git status   # should be clean
```

**No commit** — smoke test only.

---

## Phase E — Pengadaan Pilot Wire-Up (2 days, ~5 tasks)

### Task E1: Add "Lampiran" tab to PO detail page

**Files:**
- Modify: `app/procurement/orders/[id]/page.tsx` (add tab) — **find the existing tabs component first**

**Step 1: Locate the tab system**

Run: `grep -n "Tabs\|TabsContent\|TabsList" app/procurement/orders/\[id\]/page.tsx | head -10`

If a `<Tabs>` element exists, add a new `<TabsTrigger value="lampiran">Lampiran</TabsTrigger>` and corresponding `<TabsContent>`. If detail page uses a different tabs pattern, adapt — but DON'T restructure the page.

**Step 2: Add the tab content**

```tsx
// inside the existing tabs block:
<TabsContent value="lampiran" className="space-y-4 pt-4">
    <DocumentSnapshotList type="PO" entityId={po.id} />
</TabsContent>
```

Add the import at the top:
```tsx
import { DocumentSnapshotList } from '@/components/documents/document-snapshot-list'
```

**Step 3: Manual smoke**

`npm run dev`, open PO detail, click "Lampiran" tab. Confirm empty state or list renders.

**Step 4: Commit**

```bash
git add app/procurement/orders/\[id\]/page.tsx
git commit -m "feat(documents): Lampiran tab on PO detail page"
```

---

### Task E2: Wire auto-trigger into `approvePurchaseOrder()`

**Files:**
- Modify: `lib/actions/procurement.ts` (find the approve function)

**Step 1: Locate**

Run: `grep -n "export async function approve\|markPOOrdered\|approvePO" lib/actions/procurement.ts | head -10`

**Step 2: Wire trigger**

Inside `approvePurchaseOrder()` (or whichever function transitions PO to APPROVED), AFTER the transaction commits, add:

```ts
import { fireTrigger } from '@/lib/documents/triggers'
// ... existing code ...

// at the end, after status change committed
await fireTrigger('PO_APPROVED', poId, userId)
```

If the function transitions PO to ORDERED separately, also wire `'PO_ORDERED'` there.

**Step 3: Manual test**

Run `npm run dev`, approve a PO, watch terminal logs — should see `[DocumentService] Generating PDF: purchase_order` within ~2s of approval. Open the PO's Lampiran tab — v1 should appear.

**Step 4: Commit**

```bash
git add lib/actions/procurement.ts
git commit -m "feat(documents): auto-snapshot PO on approval + ordered transitions"
```

---

### Task E3: Lampiran tab + auto-trigger for PR

**Files:**
- Modify: `app/procurement/requests/[id]/page.tsx` — add Lampiran tab (same pattern as E1)
- Modify: `lib/actions/procurement.ts` — find PR approve function, wire `fireTrigger('PR_APPROVED', prId, userId)` after commit

**Step 1: Add tab** (same code as E1 with `type="PR"` and `entityId={pr.id}`)

**Step 2: Wire trigger** in `approvePurchaseRequest()` (or equivalent) after commit.

**Step 3: Manual test** — approve PR, confirm v1 appears in Lampiran tab.

**Step 4: Commit**

```bash
git add app/procurement/requests/\[id\]/page.tsx lib/actions/procurement.ts
git commit -m "feat(documents): Lampiran tab + auto-snapshot for PR"
```

---

### Task E4: Lampiran tab + auto-trigger for GRN

**Files:**
- Modify: `app/procurement/receiving/[id]/page.tsx` — add Lampiran tab with `type="GRN"`
- Modify: `lib/actions/grn.ts` — wire `fireTrigger('GRN_ACCEPTED', grnId, userId)` after the accept transaction commits

**Step 1: Add tab** (same pattern)

**Step 2: Wire trigger** in `acceptGRN()` (or `confirmGRN`, `markGRNReceived` — whichever is the "complete" action).

**Step 3: Manual test** — accept a GRN, confirm v1 appears.

**Step 4: Commit**

```bash
git add app/procurement/receiving/\[id\]/page.tsx lib/actions/grn.ts
git commit -m "feat(documents): Lampiran tab + auto-snapshot for GRN"
```

---

### Task E5: Lazy back-fill + rewire existing PO PDF endpoint

**Why:** Old POs (created before Phase A) have no snapshots. The existing `/api/procurement/orders/[id]/pdf` endpoint must lazily generate one on first access so old POs aren't broken.

**Files:**
- Modify: `app/api/procurement/orders/[id]/pdf/route.ts`

**Step 1: Read the file**

```bash
cat app/api/procurement/orders/\[id\]/pdf/route.ts
```

**Step 2: Replace its render-on-the-fly logic with snapshot fetch + lazy back-fill**

Replace the body of the GET handler with:

```ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { generateSnapshot } from '@/lib/documents/document-service'
import { downloadDocument } from '@/lib/storage/document-storage'
import { logDistribution } from '@/lib/documents/document-service'
import { createClient } from '@/lib/supabase/server'

// In-memory mutex per entity to prevent concurrent back-fills
const backfillLocks = new Map<string, Promise<any>>()

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // Find latest snapshot
    let latest = await prisma.documentSnapshot.findFirst({
        where: { type: 'PO', entityId: id, archivedAt: null },
        orderBy: { version: 'desc' },
    })

    // Lazy back-fill (with concurrent request mutex)
    if (!latest) {
        const inflight = backfillLocks.get(id)
        if (inflight) {
            await inflight
        } else {
            const promise = generateSnapshot({ type: 'PO', entityId: id, trigger: 'BACKFILL', actorId: user.id })
                .finally(() => backfillLocks.delete(id))
            backfillLocks.set(id, promise)
            await promise
        }
        latest = await prisma.documentSnapshot.findFirst({
            where: { type: 'PO', entityId: id },
            orderBy: { version: 'desc' },
        })
    }

    if (!latest) return NextResponse.json({ error: 'Snapshot generation failed' }, { status: 500 })

    // Log download distribution
    await logDistribution({ snapshotId: latest.id, action: 'DOWNLOAD', actorId: user.id }).catch(() => {})

    // Stream the PDF
    const buffer = await downloadDocument(latest.storageKey)
    return new NextResponse(buffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="po-${id}-v${latest.version}.pdf"`,
        },
    })
}
```

**Step 3: Manual test**

- Open an OLD PO created before today. Click any existing "Print PDF" button.
- First request: ~2s delay (back-fill). PDF appears.
- Open Lampiran tab on same PO → v1 (BACKFILL) is listed.
- Click Print again → instant. New distribution row logged.

**Step 4: Commit**

```bash
git add app/api/procurement/orders/\[id\]/pdf/route.ts
git commit -m "feat(documents): rewire PO PDF endpoint to snapshots + lazy back-fill"
```

---

### Task E6: Phase E integration test

**Files:**
- Test: `__tests__/procurement/po-document-trigger.test.ts`

**Step 1: Write test**

```ts
// __tests__/procurement/po-document-trigger.test.ts
import { describe, it, expect, vi } from 'vitest'
import { fireTrigger } from '@/lib/documents/triggers'

vi.mock('@/lib/documents/document-service', () => ({
    generateSnapshot: vi.fn(() => Promise.resolve({ id: 'snap-1', version: 1 })),
}))

describe('PO auto-trigger contract', () => {
    it('fireTrigger("PO_APPROVED") resolves to a snapshot', async () => {
        await expect(fireTrigger('PO_APPROVED', 'po-1', 'user-1')).resolves.not.toThrow()
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        expect(generateSnapshot).toHaveBeenCalledWith({
            type: 'PO',
            entityId: 'po-1',
            trigger: 'AUTO_PO_APPROVED',
            actorId: 'user-1',
        })
    })

    it('fireTrigger("PO_ORDERED") uses the SENT event tag', async () => {
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        ;(generateSnapshot as any).mockClear()
        await fireTrigger('PO_ORDERED', 'po-1', 'user-1')
        expect(generateSnapshot).toHaveBeenCalledWith(expect.objectContaining({ trigger: 'AUTO_PO_SENT' }))
    })

    it('approval-side: fireTrigger does not throw if generateSnapshot fails', async () => {
        const { generateSnapshot } = await import('@/lib/documents/document-service')
        ;(generateSnapshot as any).mockRejectedValueOnce(new Error('render fail'))
        await expect(fireTrigger('PO_APPROVED', 'po-1', 'user-1')).resolves.not.toThrow()
    })
})
```

**Step 2: Run — passes**

`npx vitest run __tests__/procurement/po-document-trigger.test.ts`
Expected: 3 passed.

**Step 3: Commit**

```bash
git add __tests__/procurement/po-document-trigger.test.ts
git commit -m "test(documents): PO trigger contract + fire-and-forget guarantee"
```

---

### Task E7: Final verification

**Step 1: Full test sweep**

```bash
npx vitest run __tests__/documents/ __tests__/procurement/po-document-trigger.test.ts
```
Expected: ~24 tests pass (Phase A + B + C + E).

**Step 2: TypeScript check**

```bash
npx tsc --noEmit | grep -E "lib/documents|lib/storage|app/api/documents|components/documents" | head -10
```
Expected: no errors in our files.

**Step 3: End-to-end manual demo script**

Open `npm run dev`, then:

1. Go to `/settings`, set company name "PT Demo" + brand color `#f97316`. Save.
2. Go to `/procurement/orders`, create a new PO, submit for approval.
3. Login as approver, approve PO.
4. Watch terminal — should see `[DocumentService] Generating PDF` within 3s.
5. Open PO detail → Lampiran tab → see **v1 • TERBARU** pill, with timestamp.
6. Click Print icon → PDF opens, header shows "PT Demo" with orange brand color.
7. Click Mail icon → enter `vendor@test.com` → submit. Terminal shows `[EMAIL STUB]`.
8. Click Regenerate icon → toast "Versi baru dibuat" → **v2 • TERBARU** appears, v1 loses badge.
9. Open an OLD PO from before today → click existing "Print PDF" button → ~2s delay → PDF appears. Lampiran tab now shows v1 (BACKFILL).

If all 9 steps work, Phase E is complete.

**No commit** — verification only.

---

## Done. What's NOT in this plan (deferred to Phase F, post-demo)

- Central `/documents` hub UI (cross-entity filterable table)
- Bulk download (zip)
- Real SMTP email delivery (currently stubbed)
- Logo upload UI (Phase B5 form has the field but no uploader — workaround: directly upload to Supabase Storage `documents/_brand/logo.png` and set `logoStorageKey` via PATCH /api/settings/branding)
- Vendor profile + Faktur Pajak + Payslip + BOM + SPK templates wired to snapshots (Phase E only wires PO/PR/GRN)
- Distribution log UI (per-snapshot history list — only the create flow exists; reading the log per snapshot is a 30-min add later)

---

## Estimated total: ~9 working days (32 tasks)

| Phase | Tasks | Days |
|-------|-------|------|
| A | 6 | 1 |
| B | 5 | 2 |
| C | 6 | 2 |
| D | 6 | 2 |
| E | 7 | 2 |
| **Total** | **30** | **9** |

Buffer of 6 days to demo (June 26). Phase E should be demo-ready by **June 20**.
