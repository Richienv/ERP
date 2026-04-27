# Procurement Flagship Design — `/procurement/orders`

**Status:** Approved 2026-04-25 (brainstorming completed)
**Owner:** Richie + Claude orchestration
**Target:** KRI demo June 26, 2026
**Branch:** `feat/integra-mining-pivot`

---

## Goal

Transform `/procurement/orders` (PO list page) from a visually polished but functionally stubbed page into a true **enterprise-grade module** that matches SAP/Oracle/NetSuite quality. Use this page as the **template** that subsequent procurement sub-pages (`/requests`, `/vendors`, `/receiving`) will follow.

After this design ships, the entire Pengadaan module will pass enterprise polish bar. Replication to sibling modules (Inventory, Finance) follows same template.

## Position & Strategy (Brainstorming Decisions)

| Question | Decision |
|---|---|
| Demo positioning | **B — Enterprise-Grade Polish Showcase** ("look & feel like SAP/Oracle"; smooth flow can be mocked) |
| Coverage strategy | **a — Flagship-first (template approach)** — make `/procurement/orders` truly bulletproof, replicate elsewhere |
| Feature scope | **Tier 1+2+3 = 14 features** (full ERP gold standard) |
| Detail page UX | **a — Full-page route** (`/procurement/orders/[id]`) — most familiar to mining-co exec audience |
| Filter UX | **a — Slide-out panel from right** — modern + screen-real-estate efficient |
| Implementation | **Approach 3 — Component Library First** — build 8 reusable primitives, then assemble pages |

## Feature Inventory (14 features)

### Tier 1 — MUST (7 features)
1. Detail page (full route, sticky header + 6 tabs)
2. Real filter panel (slide-out, multi-status / date range / vendor / amount / payment term)
3. Smart search (debounced server-side, PO no / vendor / SKU)
4. Bulk select + batch actions (checkbox → Setujui/Tolak/Ekspor/Print)
5. Inline quick actions per status (Setujui only when PENDING_APPROVAL, Lacak when SHIPPED)
6. Real export (CSV/XLSX with filters applied)
7. Empty / loading / error states polished

### Tier 2 — SHOULD (5 features)
8. Audit trail (timeline view in detail page)
9. Print/PDF PO (Typst-rendered formal document)
10. Approval workflow UI (multi-stage indicator: Creator → Manager → CEO if amount > Rp 100 jt)
11. Linked documents trail (PR → PO → GRN → Bill chain)
12. Saved filters (localStorage, named combos)

### Tier 3 — NICE (2 features)
13. Quick view drawer (hover preview, optional)
14. Keyboard shortcuts (`/` search, `j/k` navigate, `Enter` open, `e` edit, `a` approve)

## Architecture

```
app/procurement/orders/
├── page.tsx                          ← LIST page (refactor existing 804-line file)
└── [id]/
    └── page.tsx                      ← NEW: DETAIL page

components/integra/                   ← NEW shared primitives (Phase A)
├── filter-panel.tsx                  ← <FilterPanel> slide-out
├── detail-page.tsx                   ← <DetailPage> shell + tabs
├── bulk-action-toolbar.tsx           ← <BulkActionToolbar> sticky toolbar
├── audit-trail-timeline.tsx          ← <AuditTrailTimeline> vertical timeline
├── approval-workflow-steps.tsx       ← <ApprovalWorkflowSteps> stepper
├── linked-docs-panel.tsx             ← <LinkedDocsPanel> PR→PO→GRN→Bill
├── saved-filters-dropdown.tsx        ← <SavedFiltersDropdown>
└── typst-pdf-button.tsx              ← <TypstPdfButton> wrapper

hooks/
├── use-purchase-orders.ts            ← EXISTING — extend filter params
├── use-purchase-order-detail.ts      ← NEW — fetch 1 PO + relations
└── use-saved-filters.ts              ← NEW — localStorage CRUD

lib/actions/procurement.ts            ← EXTEND — bulkApprovePurchaseOrders, getPurchaseOrderById
lib/pdf/po-pdf.ts                     ← NEW — Typst template wrapper
templates/purchase_order/             ← EXISTING Typst — reuse + polish

app/api/procurement/orders/
├── route.ts                          ← EXISTING — extend filters
├── [id]/route.ts                     ← NEW — detail endpoint
├── bulk/route.ts                     ← NEW — bulk approve/reject
└── [id]/pdf/route.ts                 ← NEW — PDF stream
```

### Routing
- List: `/procurement/orders?status=APPROVED&vendor=United&page=2`
- Detail: `/procurement/orders/PO-KRI-2026-001#item` (URL hash for active tab)

### Data Layer Pattern
- Reads (list, detail) → API route + TanStack Query
- Writes (approve, bulk approve) → server actions via `lib/actions/procurement.ts`
- PDF generation → API route streaming Typst output
- Saved filters → `localStorage` namespaced `integra:saved-filters:purchase-orders`
- Audit trail → existing `PurchaseOrderEvent` model
- Approval workflow → derive from `status` + `totalAmount > Rp 100 jt`

### Phase Sequencing
- **Phase A (3 days):** Build 8 primitives — 6 subagents in parallel
- **Phase B (2 days):** Refactor list page to consume primitives — 1 subagent
- **Phase C (2 days):** Build detail page — 1 subagent
- **Phase D (1 day):** Polish, edge cases, E2E test

**Total estimate:** 8 days (≈ June 5 if start April 26). Buffer = ~50 days before demo.

## Component Specifications

### `<FilterPanel>` (320px slide-out, configurable dimensions)
- Multi-select / date range / amount range / checkbox group dimensions
- Active filter chips above table after Apply
- Saved filters slot at top
- Keyboard: ESC closes

### `<DetailPage>` (sticky header + 6 tabs)
- Tabs: Header / Item / Approval / History / Lampiran / Komunikasi
- URL hash sync (`#item` → tabs aktif "Item")
- Tab content scrolls independently
- Print button slot

### `<BulkActionToolbar>` (sticky top, slide-down on selection)
- "X dipilih dari Y · [Pilih semua | Batal] · [Action buttons]"
- Confirmation dialog auto-built from `confirm` prop
- ESC clears selection

### `<AuditTrailTimeline>` (vertical timeline)
- Action color mapping: CREATED/UPDATED→blue, APPROVED/RECEIVED→green, REJECTED/CANCELLED→red, PENDING→amber
- Empty: `<EmptyState>`
- Data source: `prisma.purchaseOrderEvent.findMany({ where: { poId } })`

### `<ApprovalWorkflowSteps>` (horizontal stepper)
- 2-step (≤Rp 100 jt) or 3-step (>Rp 100 jt) flow
- Visual: filled green=done, blue ring=current, hollow=pending
- Click step → scroll to relevant audit entry

### `<LinkedDocsPanel>` (chain of cards)
- PR → PO → GRN → Bill with current doc highlighted
- Hide entire panel if trail empty
- Broken link → "Dokumen dihapus" badge

### `<SavedFiltersDropdown>` (localStorage CRUD)
- Items list + "+ Simpan filter saat ini..." footer
- Hover item → delete button
- Quota exceeded → toast

### `<TypstPdfButton>` (PDF download trigger)
- Click → fetch PDF stream → browser download
- Loading state with spinner
- Error → toast + retry

## Data Flow Patterns

### Read (List)
```
URL params → useQuery → API route → Prisma findMany → DataTable
```

### Read (Detail)
```
[id] route → useQuery → API route → Prisma findUnique with relations → DetailPage tabs hydrate from one fetch
```

### Write (Single Approve)
```
Click Setujui → ConfirmDialog → server action approvePurchaseOrder(id)
  → withPrismaAuth transaction:
    - update status to APPROVED
    - create PurchaseOrderEvent (PO_APPROVED)
  → invalidateQueries → toast → row pill updates
```

### Write (Bulk Approve)
```
Select 3 rows → BulkActionToolbar appears → Setujui (3) → ConfirmDialog
  → bulkApprovePurchaseOrders(ids) → per-id transaction (NOT mega-transaction)
  → return { succeeded: [...], failed: [...] }
  → toast: "3 sukses" or "2 sukses, 1 gagal: <reason>"
```

### Filter Flow
```
Open FilterPanel → pick values → Apply
  → URL updates (queryKey changes) → re-fetch
  → active filter chips above table
```

### Saved Filters Flow
```
Save current → modal "Nama filter" → localStorage.setItem
  → dropdown re-reads
  → Click saved → load values → URL updates
```

### PDF Flow
```
Click Print → spinner → fetch /api/procurement/orders/[id]/pdf
  → API: prisma fetch + render Typst template via lib/pdf/po-pdf.ts
  → Response with PDF bytes + Content-Disposition: attachment
  → browser download
```

## Mock vs Real Data Status

| Feature | Status | Source / Note |
|---|---|---|
| List rows | ✅ Real | seed-kri-demo.ts (12 PO) |
| Filter | 🟡 Real backend, new fields | Add WHERE clauses |
| Detail page | ✅ Real | Existing Prisma relations |
| Audit trail | 🟡 Model exists, needs seed events | Update seed to insert PurchaseOrderEvent |
| Approval workflow | 🔶 Hardcoded display | Derive from status + amount |
| Linked docs | ✅ Real if seeded | Verify seed creates relations |
| Bulk approve | 🟡 New action | Build bulkApprovePurchaseOrders |
| Real export | 🟡 New endpoint | xlsx already in deps |
| PDF print | 🟡 Typst infra exists | Reuse template, polish |
| Saved filters | ✅ Pure client | localStorage |

## Error Handling

| Category | Pattern |
|---|---|
| Network/API failure | Inline retry banner + toast |
| Validation | Inline field error |
| Permission denied | Disabled button + tooltip |
| State machine violation | Toast + dialog explanation |
| Database constraint | Partial success toast ("2 sukses, 1 gagal") |
| PDF generation fail | Toast + retry |
| localStorage quota | Toast "Quota habis" |

### Optimistic UI (ON for Approve)
- `onMutate`: optimistic cache update
- `onError`: rollback + toast
- `onSettled`: invalidate

### Global Error Boundary
- `app/procurement/orders/error.tsx` (verify exists, extend if needed)

## Testing Strategy

### Tier 1 — Critical Demo Path (E2E Playwright)
File: `e2e/demo-journey-procurement.spec.ts` (NEW)
- Login → navigate → filter → search → click row → detail → approve → print PDF → bulk approve

### Tier 2 — Component Unit Tests (Vitest)
8 primitives × 4-8 tests each = ~40 unit tests
- FilterPanel: apply, reset, validation, keyboard
- BulkActionToolbar: visibility, confirm, ESC
- AuditTrailTimeline: order, color mapping, empty
- ApprovalWorkflowSteps: threshold logic
- SavedFiltersDropdown: CRUD, quota
- DetailPage: tab switching, URL hash sync
- LinkedDocsPanel: empty hide, broken link
- TypstPdfButton: loading, error

### Tier 3 — Integration Smoke (Vitest + Prisma)
- Bulk approve happy path + race condition
- Approve creates audit event
- Filter API returns correct subset
- Detail API includes relations

### Out of Scope
- Visual regression (Percy/Chromatic)
- Snapshot tests
- 100% coverage
- Accessibility audit (defer post-demo)
- Cross-browser (Chrome only for demo)

### Pre-Demo Checklist (24h before June 26)
1. `npx tsc --noEmit` clean
2. `npm run lint` clean
3. `npx vitest run` green
4. `npx playwright test demo-journey --headed` green
5. Re-seed demo DB: `npx tsx prisma/seed-kri-demo.ts`
6. Manual smoke test through dashboard
7. Update audit-trail seed if needed

## Replication to Sibling Pages (Post-Flagship)

After PO list flagship ships (Phase A-D done), replicate template to:
- `/procurement/requests` (PR list) — ~1 day, reuse all primitives
- `/procurement/vendors` (vendor master) — ~1 day, reuse FilterPanel + BulkActionToolbar + DetailPage
- `/procurement/receiving` (GRN list) — ~1 day, reuse all primitives

**Total Pengadaan module:** 8 days flagship + 3 days replication = **11 days end-to-end**.

## Open Questions / Future Work

- **Approval threshold configurable** — currently hardcoded Rp 100 jt → CEO. Move to SystemSettings post-demo.
- **Audit event auto-creation** — ensure all status mutation paths in `lib/actions/procurement.ts` create `PurchaseOrderEvent` rows. Audit existing paths.
- **Multi-tenant scoping** — verify all queries scope by current user's tenant when multi-tenant ships.
- **Permission matrix** — currently using simple role checks; full RBAC matrix is post-demo work.
- **Real-time updates** — WebSocket/poll for status changes (since multi-user). Skip for demo, add post-deal.

## Next Steps

1. Save this design doc + commit ✅ (this step)
2. Invoke `superpowers:writing-plans` skill → generate detailed implementation plan with task breakdown, file paths, and code skeletons
3. Execute via `superpowers:subagent-driven-development` (dispatch Phase A's 6 primitives in parallel via subagents)
4. Verify each phase with E2E + unit tests before moving to next phase
5. Pre-demo (24h before June 26): run pre-demo checklist
