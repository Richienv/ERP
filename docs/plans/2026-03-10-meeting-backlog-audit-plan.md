# Meeting Backlog Audit — Implementation Plan
**Date:** 2026-03-10
**Source:** Team meeting transcript 11 Juni 2025 (Richie, Darren, Raymond)
**Audit result:** 18/30 FIXED, 5 PARTIALLY, 4 NOT FIXED, 3 INVESTIGATE

---

## Audit Summary

### Already Done (18 items — no action)
MTG-005, 007, 009, 010, 011, 012, 013, 015, 016, 017, 018, 019, 021, 026, 027, 028, 029, 030

### Remaining Work (12 items)

---

## Phase 1 — P0 Blockers

### Task 1.1: MTG-001 — Balance Sheet Validation
**Status:** PARTIALLY_FIXED | **Type:** bug
**What exists:** `getBalanceSheet()` calculates difference, UI shows warning
**What's missing:**
- `isBalanced` boolean flag not returned from `getBalanceSheet()`
- No backend prevention of unbalanced journal entries beyond single-entry validation
**Files:**
- `lib/actions/finance.ts` (lines 738-742) — add `isBalanced` to balanceCheck
- `lib/actions/finance-gl.ts` — verify double-entry validation catches all edge cases
- `app/finance/reports/page.tsx` (lines 943-956) — fix UI check for `isBalanced`
**Effort:** Small (1-2 hours)

### Task 1.2: MTG-002 — Bank Reconciliation Shows 0 Matches
**Status:** NOT_FIXED | **Type:** bug
**What exists:** Full reconciliation engine (3-pass matching, auto-match, manual match)
**What's missing:** Zero seed/demo data — feature works but nothing to display
**Files:**
- `prisma/seed-bank-reconciliation.ts` — NEW: create seed with sample bank statements + GL entries
- `prisma/seed.ts` — import and call new seed
- `lib/actions/finance-reconciliation.ts` — verify queries work with real data
**Effort:** Medium (2-3 hours)

### Task 1.3: MTG-006 — Payment Methods Beyond Xendit
**Status:** PARTIALLY_FIXED | **Type:** feature
**What exists:** PaymentMethod enum (CASH, TRANSFER, CHECK, CREDIT_CARD, OTHER), GIRO in functions
**What's missing:**
- GIRO not in Prisma enum (used in functions but not schema)
- CREDIT_CARD has no UI pathway
- Inconsistent method naming across components
**Files:**
- `prisma/schema.prisma` — add GIRO to PaymentMethod enum
- `prisma/migrations/` — new migration for enum change
- `components/finance/vendor-multi-payment-dialog.tsx` (line 41) — update type to include GIRO
- `lib/actions/finance.ts` — standardize method references
- `app/finance/payments/` — ensure all methods have UI options
**Effort:** Medium (2-3 hours)

---

## Phase 2 — P1 Required for MVP

### Task 2.1: MTG-003 — Bank Reconciliation Performance
**Status:** NOT_FIXED | **Type:** improvement
**What exists:** O(n*m) matching, no pagination, no indexes
**What's missing:**
- DB indexes on BankReconciliationItem.reconciliationId, JournalLine.accountId
- Pagination for large bank statements
- Lazy loading in UI
**Files:**
- `prisma/schema.prisma` — add @@index directives
- `lib/actions/finance-reconciliation.ts` — add pagination params, optimize queries
- `components/finance/bank-reconciliation-view.tsx` — add pagination UI
**Effort:** Medium (3-4 hours)

### Task 2.2: MTG-004 — Cashflow Dashboard Financing Activity
**Status:** PARTIALLY_FIXED | **Type:** bug
**What exists:** `getCashFlowStatement()` with 3 sections, dashboard 7-day chart
**What's missing:**
- Financing activities categorized by keyword parsing (brittle)
- Dashboard chart doesn't distinguish Operating/Investing/Financing
- Rp 500M item may be from bad seed data
**Files:**
- `lib/actions/finance.ts` (lines 837-856) — improve categorization logic
- `prisma/schema.prisma` — consider adding `cashflowCategory` to JournalEntry
- `components/finance/cash-flow-chart.tsx` — show activity breakdown
**Effort:** Medium-Large (3-5 hours)

### Task 2.3: MTG-014 — Duration Per Piece Calculation Bug
**Status:** NOT_FIXED | **Type:** bug
**What exists:** `calcCriticalPathDuration()` sums sequential, takes max of parallel
**What's missing:**
- Display may show accumulated duration when parallel substeps should overlap
- `durationMinutes` field on station-node may not account for parallelism
**Files:**
- `components/manufacturing/bom/bom-step-helpers.ts` (lines 62-76) — review calc logic
- `components/manufacturing/bom/station-node.tsx` (line 133) — verify display
- `components/manufacturing/bom/timeline-view.tsx` — check timeline duration calc
**Effort:** Small-Medium (2-3 hours, mostly investigation)

---

## Phase 3 — P2 Before Testing

### Task 3.1: MTG-020 — Simplify Subprocess UI
**Status:** PARTIALLY_FIXED | **Type:** improvement
**What exists:** Full subprocess CRUD with parent-child hierarchy
**What's missing:** UI is feature-rich but redundant — subprocesses should be auto-populated or hidden
**Files:**
- `app/manufacturing/work-centers/stasiun-client.tsx` (lines 211-220, 330-361) — simplify/hide subprocess management
**Effort:** Small (1-2 hours)

### Task 3.2: MTG-023 — Salary Field in Manufacturing
**Status:** PARTIALLY_FIXED | **Type:** improvement
**What exists:** Read-only field sourced from HCM employee data
**What's missing:** Field still visible in BOM detail panel (could be hidden entirely)
**Files:**
- `components/manufacturing/bom/detail-panel.tsx` (lines 303-349) — hide or collapse salary display
**Effort:** Small (30 min)

### Task 3.3: MTG-022 — INVESTIGATE "Delete for New" Button
**Status:** CANNOT_DETERMINE
**Action:** Search for any non-functional buttons on work order pages. Grep for "delete", "hapus", "baru" in manufacturing components. If not found, confirm removed with team.
**Files to search:** `components/manufacturing/orders/*`, `app/manufacturing/orders/*`
**Effort:** Investigation only (30 min)

### Task 3.4: MTG-025 — INVESTIGATE Ratio 3/4 Source
**Status:** CANNOT_DETERMINE
**Action:** Current allocation code uses `totalQty` correctly. Check API routes and database for hardcoded ratio values. Test with real data to reproduce.
**Files to search:** `app/api/manufacturing/production-bom/`, `app/api/manufacturing/work-orders/`
**Effort:** Investigation only (30 min)

---

## Phase 4 — P3 Batch 2

### Task 4.1: MTG-008 — CSV BCA Bulk Payment Upload
**Status:** NOT_FIXED | **Type:** feature
**What exists:** Nothing — zero implementation
**Requirements:**
- Parse BCA internet banking CSV format (fixed format)
- Generate CSV from planning board data
- Upload CSV → create bulk payment records
**Files:**
- `lib/bca-csv-parser.ts` — NEW: BCA format parser
- `components/finance/csv-upload-dialog.tsx` — NEW: upload UI
- `app/finance/planning/` — add "Export CSV BCA" button
**Effort:** Large (6-8 hours)
**Note:** Deferred to Batch 2. Raymond to provide BCA CSV format example.

### Task 4.2: MTG-024 — INVESTIGATE Time Study Feature
**Status:** CANNOT_DETERMINE
**Action:** Feature not found in codebase. Discuss with team if it should be built, repurposed as actual-vs-estimate reporting, or dropped.
**Effort:** Investigation only (30 min)

---

## Execution Order

```
Phase 1 (P0 — do first, parallel where possible)
├── Task 1.1: Balance sheet isBalanced flag ──────── Agent A
├── Task 1.2: Bank reconciliation seed data ──────── Agent B
└── Task 1.3: Payment methods enum + UI ──────────── Agent C

Phase 2 (P1 — after Phase 1)
├── Task 2.1: Bank recon performance ─────────────── Agent A
├── Task 2.2: Cashflow financing categorization ──── Agent B
└── Task 2.3: Duration per piece investigation ───── Agent C

Phase 3 (P2 — after Phase 2)
├── Task 3.1: Subprocess UI simplification ───────── Agent A
├── Task 3.2: Salary field hide in manufacturing ─── Agent A (small)
├── Task 3.3: INVESTIGATE "delete for new" button ── Agent B
└── Task 3.4: INVESTIGATE ratio 3/4 ─────────────── Agent B

Phase 4 (P3 — Batch 2, defer)
├── Task 4.1: CSV BCA bulk payment ───────────────── Future
└── Task 4.2: INVESTIGATE time study ─────────────── Future
```

## Estimated Total Effort
- **Phase 1 (P0):** ~6 hours (parallelizable to ~3 hours with 3 agents)
- **Phase 2 (P1):** ~10 hours (parallelizable to ~5 hours)
- **Phase 3 (P2):** ~3 hours (parallelizable to ~2 hours)
- **Phase 4 (P3):** Deferred
- **Total active work:** ~19 hours → ~10 hours with parallel agents
