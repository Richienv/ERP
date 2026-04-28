# Document System Hardening — Design

**Date:** 2026-04-28
**Goal:** Production-ready hardening of the document system shipped 2026-04-27. Target: KRI mining customer demo on 2026-06-26.
**Audit input:** 5 parallel local subagents — 8 Critical + 12 Important findings (25 Minor deferred).

---

## Why

The document system shipped feature-complete but with **8 Critical security issues and 12 Important correctness/UX gaps** that surfaced in audit. Most consequential:

- **6 IDOR/authz failures** across all document API endpoints (any authenticated STAFF user can fetch CEO payslips, AP bills, faktur pajak by guessing snapshot IDs)
- **Logo rendering broken**: `brand-resolver` returns an HTTPS signed URL, but Typst's `image()` only reads local files — the moment a logo is uploaded, all snapshot generation silently fails
- **PR snapshots render as "Purchase Order"** PDFs (template fallback to PO with PR-shaped data → broken-looking PDFs)
- **Email button lies to users** — UI says "Mengirim..." but the action is a `console.log` stub

Without addressing these, the demo on June 26 would expose the system to embarrassment (broken PDFs, bogus email feedback) and the deployment would expose customer data (IDOR).

## Non-goals

- Rate limiting on render endpoints (needs Upstash/Vercel KV decision; flagged as TODO)
- Distribution log UI surface (Phase F per original plan; deferred)
- 25 Minor polish items: skeleton states, NB dialog styling, tooltips, format helpers, badge usage in headers, etc.
- WebSocket/SSE for snapshot list updates (polling is enough)

## Scope decisions (recorded from brainstorm)

| Q | Topic | Decision |
|---|-------|----------|
| 1 | Sprint scope | **B** — Production-readiness (8 Critical + 12 Important, skip 25 Minor) |
| 2 | Email behavior | **C** — Drop Email button entirely (no SMTP, no relabel) |
| 3 | PR template | **A** — Build a proper `templates/purchase_request/main.typ` |
| 4 | Logo upload UI | **A** — Full self-service file input + drag-drop + preview |
| 5 | Authorization policy | **A** — Inherit from underlying entity (`canViewEntity` dispatcher) |
| 6 | Finance integration | **A** — Wire `INVOICE_ISSUED` + add Lampiran tab to AR invoices |
| Approach | Sequencing | **1** — Fix by severity, Phase 1 (Critical) → Phase 2 (Important), serial |

---

## Architecture

### Two-phase sprint (~8-10 days)

```
Phase 1: SECURITY-CRITICAL (3-4 days)
  ↓ merge-ready: hardened security baseline
Phase 2: PRODUCTION-IMPORTANT (5-6 days)
  ↓ merge-ready: full hardening for KRI demo
```

Both phases stay on branch `feat/integra-mining-pivot`. Final merge to `main` after Phase 2 verification.

### Phase 1 hub: `lib/documents/entity-authz.ts`

8 Critical fixes pivot around one new module — a polymorphic permission dispatcher invoked by every document API endpoint and the branding endpoint:

```
                      ┌─────────────────────────────────┐
                      │  lib/documents/entity-authz.ts  │
                      │   canViewEntity(user, type, id) │
                      │   ↓ dispatches by DocType:      │
                      │     PO/PR/GRN/VENDOR_PROFILE    │
                      │       → procurement role list   │
                      │     INVOICE_AR/AP/FAKTUR_PAJAK  │
                      │       → finance role list       │
                      │     PAYSLIP                     │
                      │       → owner OR HCM/CEO/admin  │
                      │     BOM/SPK                     │
                      │       → manufacturing role list │
                      └─────────────────────────────────┘
                                    ↓ guards
   ┌────────────────────────────────────────────────────────┐
   │  ALL 6 document API endpoints                          │
   │  + PATCH /api/settings/branding (ADMIN only)           │
   └────────────────────────────────────────────────────────┘

   PLUS:
   - Logo render fix (download HTTPS → tmpfile under templates/_shared/cache)
   - PR template (new templates/purchase_request/main.typ)
```

**Pragmatic compromise on "inherit from entity":** pure inheritance requires every module to expose a `canRead*` helper; most don't. The dispatcher uses **role-based tables that mirror each module's existing access pattern**, with PAYSLIP as the only entity-level check (owner OR HCM). Modules can later add `canRead*` helpers and the dispatcher swaps to call them.

### Phase 2: three workstreams (sequential within phase)

1. **Data Integrity (~1.5d)**: cascade Restrict, MAX(version), race retry cleanup, Decimal.isDecimal, PO approval rollback
2. **UI/UX (~2.5d)**: drop email button, logo upload UI, auto-refresh polling, signed URL TTL → 5min, dead import cleanup
3. **Finance Integration (~1d)**: wire INVOICE_ISSUED + Lampiran tab on AR invoice detail

---

## Components

### Phase 1 (Critical) — files

**Created (3):**
- `lib/documents/entity-authz.ts` — the dispatcher
- `templates/purchase_request/main.typ` — PR template ("FORMULIR PERMINTAAN PEMBELIAN")
- `__tests__/documents/entity-authz.test.ts`

**Modified (8):**
- `app/api/documents/snapshots/route.ts` — wire `canViewEntity` on GET (filter list to allowed) + POST
- `app/api/documents/snapshots/[id]/route.ts` — guard GET (signed URL) + PATCH (metadata)
- `app/api/documents/regenerate/route.ts` — guard POST
- `app/api/documents/distributions/route.ts` — guard GET + POST
- `app/api/procurement/orders/[id]/pdf/route.ts` — guard GET (lazy backfill stream)
- `app/api/settings/branding/route.ts` — `assertRole(['ADMIN','CEO','DIRECTOR'])` + `logoStorageKey` regex validation
- `lib/documents/brand-resolver.ts` — download logo to `templates/_shared/cache/logo-<uuid>.<ext>` (local path Typst can read)
- `lib/documents/render-adapter.ts` — `case 'PR'` returns `templateName: 'purchase_request'`

### Phase 2 (Important) — files

**Created (3):**
- `prisma/migrations/20260429000000_distributions_restrict_delete/migration.sql`
- `components/settings/logo-uploader.tsx`
- `app/api/settings/branding/logo/route.ts`

**Modified (~12):**
- `prisma/schema.prisma` — `DocumentDistribution.snapshot onDelete: Restrict`
- `lib/documents/document-service.ts` — MAX(version), race retry with `deleteDocument(originalKey)`, bounded retry 3x
- `lib/services/document-service.ts` — `Prisma.Decimal.isDecimal()` replacer
- `lib/storage/document-storage.ts` — default TTL 5min, export `DEFAULT_SIGNED_URL_TTL`
- `lib/actions/procurement.ts` — try/catch with status rollback if `recordPendingBillFromPO` throws after PO commit
- `lib/actions/finance-invoices.ts` — `void fireTrigger('INVOICE_ISSUED', ...)` after `moveInvoiceToSent`
- `components/documents/document-version-row.tsx` — drop Email button + Mail icon + DistributionDialog import + emailOpen state
- `components/settings/branding-form.tsx` — add `<LogoUploader>` section
- `app/api/documents/distributions/route.ts` — drop `EMAIL` from `VALID_ACTIONS`, drop `console.log` PII
- `app/api/documents/snapshots/[id]/route.ts` — drop redundant `60 * 60` arg
- `lib/documents/brand-resolver.ts` — drop redundant `60 * 60` arg
- `app/finance/invoices/[id]/page.tsx` — add Lampiran tab/section with `<DocumentSnapshotList type="INVOICE_AR" entityId={inv.id} />`
- 9 templates: strip unused `brand-color, brand-muted` imports

**Deleted (1):**
- `components/documents/distribution-dialog.tsx`

---

## Data Flow

### Auto-trigger snapshot — Phase 2 polling refresh

```
User clicks "Setujui PO"
  ↓
approvePurchaseOrder() commits → recordPendingBillFromPO() runs (with rollback safety)
  ↓
void fireTrigger('PO_APPROVED', poId, user.id)  [non-blocking]
  ↓
Background: generateSnapshot() runs ~2-3s
  ↓
DB: documentSnapshot row created
  ↓
Client: useDocumentSnapshots polls @ 2s for 30s post-mount when empty
  ↓
List refreshes, v1 + TERBARU pill appears
```

### Logo render flow — fixed

```
generateSnapshot() called
  ↓
resolveBrandInputs():
   1. Read TenantConfig
   2. If logoStorageKey set:
      - downloadDocument(key) → buffer
      - Write to templates/_shared/cache/logo-<uuid>.<ext>
      - logoPath = "templates/_shared/cache/logo-<uuid>.<ext>"
   3. Pass to TypstService as --input logo_path=<path>
  ↓
Typst image() reads local file → renders correctly
```

### Authz check — every document endpoint

```
Request hits endpoint
  ↓
const user = await requireAuth()           // 401 if not logged in
const snap = await prisma.findUnique(...)  // 404 if not exists
if (!await canViewEntity(user, snap.type, snap.entityId)) {
    return 403 Forbidden
}
// proceed with operation
```

### PO approval rollback flow

```
try:
   1. Save originalStatus = current.status
   2. Atomic transition to APPROVED inside withPrismaAuth tx
   3. Tx commits
   4. recordPendingBillFromPO(po) — if throws → catch
   5. void fireTrigger('PO_APPROVED', poId, user.id)
catch (e):
   6. prisma.purchaseOrder.update({status: originalStatus, approvedBy: null})
   7. Log PO_TRANSITION_FAILED event
   8. return { success: false, error: e.message }
```

---

## Error Handling

| Failure | Behavior |
|---------|----------|
| **Authz: wrong role** | 403 Forbidden + toast "Anda tidak memiliki akses ke dokumen ini" (NEVER 404 — leaks existence via timing) |
| **Authz: not authenticated** | 401 Unauthorized + redirect to login |
| **Authz: unknown DocType** | Dispatcher returns `false` (deny default) |
| **Logo upload: wrong MIME** | Client-side reject, toast "Format harus PNG/JPG/SVG/WebP" |
| **Logo upload: >2MB** | Client-side reject, toast "Ukuran maksimal 2MB" |
| **Logo upload: storage fails** | 500 with sanitized message, toast "Upload gagal — coba lagi" |
| **Logo upload: replace fails to delete old** | Best-effort log warn, proceed (orphan in storage; future cleanup) |
| **Logo render: download fails** | `logoPath = ''`, PDF renders without logo (graceful) |
| **PR template: missing items** | Render "Belum ada item" placeholder, no throw |
| **MAX(version) edge: hard-deleted v3** | Next snapshot becomes v3 again (UUID suffix avoids storage collision; audit may show duplicate version numbers — accepted, hard-delete is admin-only) |
| **Race retry: orphan storage cleanup** | `deleteDocument(originalKey)` is best-effort; worst case 1 orphan per concurrent collision |
| **Race retry: 3 attempts exhausted** | Throw context-rich error, fire-and-forget caller logs to console, snapshot silently lost (future "outbox" table is post-demo) |
| **PO approval: bill creation throws** | Catch → `prisma.purchaseOrder.update({status: originalStatus})` → log TRANSITION_FAILED event → return error |
| **PO approval: rollback fails** | Console.error "ROLLBACK FAILED — manual intervention needed" — extremely rare |
| **Auto-refresh polling: trigger never lands** | Polling stops at 30s, user clicks "Generate Sekarang" manually as fallback |
| **Branding admin check: non-admin** | 403 + form Save button disabled with tooltip explanation |
| **Finance INVOICE_ISSUED snapshot fails** | Invoice still ISSUED (correct business state); Lampiran tab shows "Generate Sekarang" empty state |

---

## Testing

### What we test (Vitest + targeted integration)

**Phase 1:**
- `__tests__/documents/entity-authz.test.ts` (NEW) — pure unit tests, all 10 DocTypes × 6 roles matrix
- `__tests__/documents/brand-resolver.test.ts` (extend) — logo download → local path; storage fail → empty path graceful
- PR template smoke test via Typst CLI direct invocation (matches Phase B pattern)

**Phase 2:**
- `__tests__/documents/snapshot-model.test.ts` — INVERT cascade test (assert FK violation on snapshot delete with distributions)
- `__tests__/documents/document-service.test.ts` (extend) — MAX(version) after archive; orphan cleanup on race retry; Decimal.isDecimal serialization
- `__tests__/procurement/po-approval-rollback.test.ts` (NEW) — mock `recordPendingBillFromPO` throw → assert PO reverts + TRANSITION_FAILED event
- `__tests__/api/branding-admin-check.test.ts` (NEW) — non-admin 403, admin 200, invalid logoStorageKey 400
- `__tests__/components/document-snapshot-list.test.tsx` (NEW) — empty/loading/403/populated states, polling config

### What we DON'T test
- Real Supabase Storage uploads (mocked)
- Real Typst CLI execution (mocked via TypstService mock)
- E2E browser flow (manual smoke is the validation; no Playwright)
- Logo uploader component (react-dropzone mock too painful — manual smoke covers)
- Document API authz integration tests (auth cookie setup painful — unit dispatcher tests + manual smoke cover)
- Rate limiting (out of scope)

### Manual smoke test checklist (run before declaring each phase done)

**After Phase 1:**
1. STAFF user → GET `/api/documents/snapshots/<any-id>` → expect 403
2. PURCHASING user → same → expect 200
3. STAFF user → PATCH `/api/settings/branding` → expect 403
4. ADMIN user → upload logo via Branding form → approve fresh PO → Lampiran shows PDF with logo

**After Phase 2:**
5. Approve a PO → wait 5s → Lampiran auto-refreshes (no manual reload) → shows v1
6. Open snapshot row → Email button is GONE
7. Issue an AR invoice → /finance/invoices/[id] Lampiran shows snapshot within 5s
8. Delete a snapshot via Prisma Studio that has distribution rows → expect FK violation

### Estimated test work

- Phase 1: ~15 new tests + smoke checklist (~6 hours, included in per-task estimates)
- Phase 2: ~12 new tests + smoke checklist (~5 hours, included)

---

## Open Decisions (locked-in defaults)

| Decision | Default |
|----------|---------|
| Authz unknown DocType | **deny** (security default) |
| Authz endpoint failure code | **403 Forbidden**, never 404 (no existence leak) |
| PO rollback approach | **Erase approvedBy on rollback** (audit captured separately via TRANSITION_FAILED event) |
| Auto-refresh implementation | **TanStack Query polling** every 2s for 30s (no WebSocket) |
| Race retry attempts | **3 max** (per-attempt orphan cleanup) |
| Logo cache location | **`templates/_shared/cache/`** (under existing Typst --root, simpler than multi-root setup) |
| Signed URL TTL | **5 minutes** (was 60 min — too long for sensitive PDFs) |
| Logo file constraints | **≤2MB**, MIME ∈ {png, jpg, svg, webp} |
| `logoStorageKey` regex | **`^_brand/[a-z0-9-]+\.(png\|jpg\|svg\|webp)$`** (prevents path injection) |
| Email button | **Removed entirely** (file deletion); EMAIL action removed from VALID_ACTIONS |

---

## Success Criteria

**Phase 1 done when:**
- All 8 Critical findings closed
- Manual smoke test 1-4 pass
- 15+ new unit tests pass
- No new TS errors introduced

**Phase 2 done when:**
- All 12 Important findings closed
- Manual smoke test 5-8 pass
- 12+ new unit tests pass
- Phase 1 tests still pass
- Total: ready for KRI demo on 2026-06-26

**Sprint done when both phases land + final test sweep passes + ready to merge `feat/integra-mining-pivot` → `main`.**

---

## Phase F (Still Deferred — post-demo)

- Central `/documents` hub UI
- Distribution log popover (per-snapshot history)
- Bulk download (zip)
- Real SMTP email integration
- Rate limiting (Upstash/Vercel KV)
- 25 Minor polish items from audit
