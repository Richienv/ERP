# Professional Document System — Design

**Date:** 2026-04-27
**Owner:** Document System (Phase A–E foundation, F deferred)
**Pilot module:** Pengadaan (PO, PR, GRN, Vendor Profile)
**Goal:** Snapshot-on-event PDF system with version history, distribution tracking, and tenant-configurable branding — replicable across the entire ERP.

---

## Why

Right now PDFs are generated on-demand from live data. Three problems:

1. **No audit trail** — once a PO is approved and printed, you can't prove what the PDF said at that moment. If the PO is later edited, the printed copy becomes a phantom.
2. **No distribution tracking** — we don't know who printed/emailed/downloaded what, when, or to whom.
3. **No branded standard** — each Typst template hardcodes its own header/logo. Changing company logo requires editing 8 templates.

Industry standard (SAP, Accurate, NetSuite) is **snapshot-on-event**: when a business event happens (PO approved, invoice issued), the PDF is rendered ONCE, frozen, and stored. Subsequent prints serve the same blob. Re-renders create a new version, never overwrite.

---

## Non-goals

- Building the central `/documents` hub UI (deferred to Phase F, post-demo)
- Real SMTP email delivery (Phase E uses console.log stub; real email later)
- PDF visual diff testing (too noisy with font/spacing variance)
- Performance/load testing (defer until real customer volume)
- Migration script for existing PO PDFs (handled via lazy back-fill on first access)

---

## Architecture

### Layers

```
┌─────────────────────────────────────────────────────────────┐
│  UI Layer                                                    │
│  • Per-doc "Lampiran" tab on entity detail pages            │
│  • DocumentSnapshotList, DocumentVersionPill, etc.          │
│  • BrandingForm in /settings                                │
│  • Central /documents hub → Phase F (deferred)              │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Trigger Layer (lib/documents/triggers.ts)                  │
│  • AUTO_TRIGGERS registry (typed)                           │
│  • fireTrigger(eventKey, entityId, actorId)                 │
│  • Called fire-and-forget after business action commits     │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Document Service (lib/documents/document-service.ts)        │
│  • generateSnapshot()    — render + upload + insert         │
│  • regenerateSnapshot()  — new version, never mutate        │
│  • listVersions()        — for Lampiran tab                 │
│  • logDistribution()     — print/email/download events      │
│  • updateMetadata()      — label/tags only                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Render + Storage                                            │
│  • Typst CLI + templates/_shared/brand.typ                  │
│  • Brand resolver reads SystemSettings                      │
│  • Supabase Storage bucket "documents"                      │
│  • Key: {type}/{entityId}/v{N}-{uuid}.pdf                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Persistence (Prisma)                                        │
│  • DocumentSnapshot                                          │
│  • DocumentDistribution                                      │
│  • SystemSettings (singleton)                                │
└─────────────────────────────────────────────────────────────┘
```

### Phase sequencing (5 phases, ~9 days)

| Phase | What | Days |
|-------|------|------|
| **A** | Schemas + Storage wrapper | 1 |
| **B** | Brand module + 8 templates updated + BrandingForm | 2 |
| **C** | Document service + trigger registry + 8 API routes | 2 |
| **D** | UI primitives (8 components) | 2 |
| **E** | Pengadaan wire-up (Lampiran tab + auto-triggers in PO/PR/GRN actions) | 2 |
| ~~F~~ | Central /documents hub | DEFERRED |

---

## Components

### Phase A — Schemas

```prisma
model DocumentSnapshot {
    id            String    @id @default(uuid())
    type          DocType
    entityId      String
    version       Int
    storageKey    String
    generatedAt   DateTime  @default(now())
    generatedBy   String?
    triggerEvent  String
    label         String?
    tags          String[]
    archivedAt    DateTime?
    metadata      Json?
    distributions DocumentDistribution[]

    @@unique([type, entityId, version])
    @@index([type, entityId])
    @@map("document_snapshots")
}

model DocumentDistribution {
    id              String   @id @default(uuid())
    snapshotId      String
    snapshot        DocumentSnapshot @relation(fields: [snapshotId], references: [id], onDelete: Cascade)
    action          String   // PRINT | DOWNLOAD | EMAIL
    actorId         String
    recipientEmail  String?
    timestamp       DateTime @default(now())
    notes           String?

    @@index([snapshotId])
    @@map("document_distributions")
}

model SystemSettings {
    id              String   @id @default("singleton")
    companyName     String
    companyAddress  String?
    companyNpwp     String?
    companyEmail    String?
    companyPhone    String?
    logoStorageKey  String?
    brandColor      String?
    updatedAt       DateTime @updatedAt

    @@map("system_settings")
}

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
```

**Storage wrapper (`lib/storage/document-storage.ts`):**
- `upload(buffer, key)` → uploads to bucket "documents"
- `download(key)` → returns Buffer
- `getSignedUrl(key, expiresIn)` → time-limited URL (60 min default)
- `delete(key)` → soft delete

### Phase B — Brand module

**`templates/_shared/brand.typ`** (NEW):
- Exports `header()`, `footer()`, `colors`, `typography` functions
- Reads Typst inputs: `company_name`, `company_npwp`, `company_address`, `logo_path`, `brand_color`
- Provides defaults for missing values

**8 existing templates updated:**
- `templates/purchase_order/main.typ`
- `templates/payroll_report/main.typ`
- `templates/surat_jalan/main.typ`
- `templates/payslip/main.typ`
- `templates/faktur_pajak/main.typ`
- `templates/surat_jalan_masuk/main.typ`
- `templates/production_bom/main.typ`
- `templates/spk/main.typ`
- `templates/invoice/main.typ`

Each adds `#import "../_shared/brand.typ": header, footer, colors` and replaces inline header with `#header()`.

**`components/settings/BrandingForm.tsx`** + **`LogoUploader.tsx`**:
- Form for SystemSettings (companyName, address, NPWP, brandColor)
- Logo upload → Supabase Storage `documents/_brand/logo.png`
- Save → updates SystemSettings singleton

### Phase C — Document service + triggers

**`lib/documents/document-service.ts`:**
```ts
generateSnapshot({ type, entityId, trigger, actorId, metadata? })
regenerateSnapshot(snapshotId)
listVersions(type, entityId)
logDistribution({ snapshotId, action, actorId, recipientEmail?, notes? })
updateMetadata({ snapshotId, label?, tags?, archivedAt? })
```

**`lib/documents/triggers.ts`:**
```ts
export const AUTO_TRIGGERS = {
    PO_APPROVED:    { type: 'PO',         event: 'AUTO_PO_APPROVED' },
    PO_ORDERED:     { type: 'PO',         event: 'AUTO_PO_SENT' },
    PR_APPROVED:    { type: 'PR',         event: 'AUTO_PR_APPROVED' },
    GRN_ACCEPTED:   { type: 'GRN',        event: 'AUTO_GRN_ACCEPTED' },
    INVOICE_ISSUED: { type: 'INVOICE_AR', event: 'AUTO_INVOICE_ISSUED' },
} as const

export type AutoTriggerKey = keyof typeof AUTO_TRIGGERS
export async function fireTrigger(key: AutoTriggerKey, entityId: string, actorId: string)
```

**API routes:**
- `POST /api/documents/snapshots` — manual generate
- `POST /api/documents/regenerate` — regenerate
- `PATCH /api/documents/snapshots/[id]` — update metadata
- `GET /api/documents/snapshots/[id]/url` — signed URL
- `POST /api/documents/distributions` — log event
- `GET /api/documents/list?type=PO&entityId=...` — version list

### Phase D — UI primitives

`components/documents/`:
1. `DocumentSnapshotList.tsx` — version list with empty state
2. `DocumentVersionPill.tsx` — "v3 • TERBARU" badge
3. `DocumentVersionRow.tsx` — single version row + actions
4. `RegenerateButton.tsx` — manual regen trigger
5. `DistributionDialog.tsx` — email recipient + notes
6. `DistributionLog.tsx` — distribution history per snapshot
7. `BrandingForm.tsx` — settings page form (Phase B placement)
8. `DocumentTypeBadge.tsx` — colored badge per DocType (used in Phase F, build now)

### Phase E — Pengadaan wire-up

**Lampiran tab** added to:
- `/procurement/orders/[id]` (PO detail)
- `/procurement/requests/[id]` (PR detail)
- `/procurement/receiving/[id]` (GRN detail)
- `/procurement/vendors/[id]` (Vendor profile)

**Auto-triggers wired into existing actions:**
- `approvePurchaseOrder()` → `fireTrigger('PO_APPROVED', poId, userId)`
- `markPOOrdered()` → `fireTrigger('PO_ORDERED', poId, userId)`
- `approvePurchaseRequest()` → `fireTrigger('PR_APPROVED', prId, userId)`
- `acceptGRN()` → `fireTrigger('GRN_ACCEPTED', grnId, userId)`

**Existing PDF endpoints rewired** to fetch from snapshots (with lazy back-fill for pre-migration entities).

---

## Data Flow

### Auto-trigger snapshot
```
User approves PO
  → approvePurchaseOrder() commits
  → fireTrigger('PO_APPROVED', poId, userId) [non-blocking]
  → generateSnapshot() runs in background
  → Render Typst with brand → Upload to storage → INSERT snapshot row
  → TanStack Query invalidates → Lampiran tab refreshes
```

### Manual regenerate
```
User clicks "Generate Ulang" on v3
  → regenerateSnapshot('snap-v3')
  → Re-fetch fresh entity data
  → Render with current brand
  → Upload as v4 (NEVER overwrite v3)
  → INSERT new snapshot, link triggerEvent='MANUAL_REGENERATE'
```

### Distribution logging
```
User clicks Print
  → POST /api/documents/distributions { snapshotId, action: 'PRINT' }
  → Open signed URL → print dialog
  → INSERT distribution row → log refreshes
```

### Brand injection
```
Render starts
  → Read SystemSettings (singleton)
  → Resolve logo: signed URL from documents/_brand/logo.png
  → Pass as Typst inputs (company_name, npwp, logo_path, brand_color)
  → templates/_shared/brand.typ renders consistent header
```

### Edit metadata (no re-render)
```
User edits label "Original" → "Versi final"
  → PATCH /api/documents/snapshots/[id] { label }
  → updateMetadata() — UPDATE row, storageKey untouched
  → PDF blob immutable, label mutable
```

### Cross-module trigger registration
```
Adding new trigger = 2 changes:
  1. Add line to AUTO_TRIGGERS registry
  2. Call fireTrigger('NEW_KEY', id, userId) in business action
```

---

## Error Handling

| Failure | Behavior |
|---------|----------|
| **Typst render fails** | NO snapshot row inserted. Toast warns user. Manual regenerate retries. |
| **Storage upload fails** | NO snapshot row inserted. Toast. PDF buffer discarded. |
| **Business action OK but trigger fails** | PO is approved (correct). Lampiran shows "Belum ada dokumen. [Generate Sekarang]". User generates manually. |
| **Distribution log fails** | PDF still opens. Toast warns. Audit trail incomplete (acceptable). |
| **Concurrent regenerate race** | DB unique constraint `(type, entityId, version)` rejects duplicate. Caller catches violation, increments, retries once. |
| **Brand assets missing** | Fall back to defaults: no logo, neutral color, "Perusahaan Anda". PDF always renders. |
| **Auto-trigger event not registered** | TypeScript compile-time error via `keyof typeof AUTO_TRIGGERS`. Impossible to deploy. |
| **Storage signed URL expires** | URL re-issued server-side per click. TTL = 60 min. Never cached client-side. |
| **Migration breaks old PO PDF endpoint** | Lazy back-fill: if `snapshots.length === 0`, generate on first access. ~2s delay once, then cached. |

**Concurrency safety for back-fill:** simple in-memory mutex per `entityId` so 100 concurrent requests share one render.

---

## Testing

### Phase A — Schema + Storage
**Unit:** `__tests__/documents/storage.test.ts`
- `upload()` returns key, throws on missing bucket
- `getSignedUrl()` returns URL with TTL
- `delete()` is idempotent

**Integration:** `__tests__/documents/snapshot-model.test.ts`
- Insert v1 succeeds; duplicate (type, entityId, version) violates unique
- Cascade delete removes distributions
- `findMany` returns descending version order

### Phase B — Brand
**Unit:** `__tests__/documents/brand-resolver.test.ts`
- Full brand resolves all fields
- Missing logo → `logoPath: null`, no throw
- Missing color → defaults to `#18181b`
- Missing name → defaults to "Perusahaan Anda"

**Snapshot:** `__tests__/documents/brand-typst.test.ts`
- Render with brand → non-empty buffer
- Render without logo → still non-empty
- Byte length within ±5% of fixture (regression guard, requires pinned Typst)

### Phase C — Service + triggers
**Integration:** `__tests__/documents/document-service.test.ts`
- `generateSnapshot` creates v1, then v2 auto-increment
- Concurrent calls do NOT duplicate version
- Render fail → no DB insert
- Storage fail → no DB insert
- Missing SystemSettings → falls back to defaults

`regenerateSnapshot`:
- Creates new version, never overwrites
- Preserves original metadata.label and tags
- Uses fresh entity data, not cached

`logDistribution`:
- PRINT logged with actorId
- EMAIL logged with recipientEmail
- Unknown action rejected

`updateMetadata`:
- Updates label without touching storageKey
- Updates tags array
- Soft-archives via archivedAt

**Unit:** `__tests__/documents/triggers.test.ts`
- `AUTO_TRIGGERS` has expected keys (typed test)
- Valid key resolves to snapshot
- Failed `fireTrigger` does NOT throw to caller

### Phase D — UI primitives
**Component:** `__tests__/components/document-snapshot-list.test.tsx`
- Empty state with "Generate Sekarang"
- Renders 3 versions descending
- Latest has "TERBARU" badge
- Print click → log + opens URL
- Loading state → skeleton

**Component:** `__tests__/components/distribution-dialog.test.tsx`
- Email validation rejects malformed
- Submit calls `onSubmit` with payload

**Component:** `__tests__/components/branding-form.test.tsx`
- Initial values from SystemSettings
- Logo upload calls `onUpload(file)`
- Brand color constrained to hex

### Phase E — Pengadaan integration
**Integration:** `__tests__/procurement/po-document-trigger.test.ts`
- PO approval creates v1
- PO ordered creates v2 (separate trigger)
- Approval succeeds even if snapshot fails
- Lampiran tab shows list after approval

### What we're NOT testing
- Typst CLI itself (assume works)
- Supabase Storage SDK (assume works)
- PDF visual rendering (too noisy)
- Email delivery (stub only in Phase E)
- Performance/load (defer until real volume)
- Manual smoke tests (per user — instructions in plan instead)

### CI integration
Add to existing test workflow:
```yaml
- run: npx vitest run __tests__/documents
- run: npx vitest run __tests__/procurement/po-document-trigger.test.ts
```

Phase A tests must pass before Phase B starts (foundation gates).

---

## Open Decisions (locked-in defaults)

| Decision | Default |
|----------|---------|
| Trigger semantics | Hybrid: auto on status transitions + manual button |
| Storage key format | `{type}/{entityId}/v{N}-{uuid}.pdf` (uuid suffix avoids retry collision) |
| Signed URL TTL | 60 minutes |
| Email delivery | Phase E stub (`console.log` + toast). Real SMTP later. |
| PDF gen on trigger fail | Toast only. No persistent badge until users complain. |
| Lazy back-fill mutex | In-memory per `entityId`. Simple. Upgrade if needed. |
| Vitest coverage threshold | None. Critical-path coverage instead. |
| Typst version | Pin in `package.json` postinstall (prevents byte-length test drift) |
| Trigger ordering | Multi-status transitions generate one PDF per status (full audit) |

---

## Phase F (deferred — post-demo)

- Central `/documents` hub: filterable cross-entity table
- Document type filters, date range, distribution filter
- Bulk download (zip)
- Advanced search across metadata.tags
- Document expiry / retention policy

Not in scope for June 26 demo. Foundation built in A–E supports this without rework.

---

## Success Criteria

**Phase A–E demo-ready by June 20** (6 days buffer to June 26):

1. ✅ Approve a PO → PDF appears in Lampiran tab within 3 seconds
2. ✅ Print PDF → distribution log shows event with actor + timestamp
3. ✅ Click "Generate Ulang" → new version appears, old version still accessible
4. ✅ Update company logo in `/settings` → next PDF uses new logo
5. ✅ Open old PO (pre-migration) → PDF auto-generates on first access
6. ✅ Tests pass: schema, service, triggers, Pengadaan integration
7. ✅ No business action blocked by PDF failure
