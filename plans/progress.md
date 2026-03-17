# Ralph Progress Log

Started: 2026-02-19
Project: ERP Textile (Indonesian SME)

## Codebase Patterns

- **Framework:** Next.js 16 App Router + Turbopack
- **ORM:** Prisma 6.x → PostgreSQL (Supabase)
- **UI:** shadcn/ui + Tailwind v4, neo-brutalist design
- **State:** TanStack Query for reads, server actions for writes
- **Auth:** Supabase Auth (SSR, cookie-based)
- **Localization:** Bahasa Indonesia, IDR currency
- **Test baseline:** 316/321 pass (5 pre-existing failures)

## Key Files

- `lib/query-keys.ts` — centralized query key factory
- `hooks/use-nav-prefetch.ts` — sidebar hover prefetch map
- `lib/actions/` — shared server actions
- `app/actions/` — page-level server actions
- `lib/db.ts` — Prisma singleton for reads
- `lib/dialog-styles.ts` — neo-brutalist dialog styles

---

## Session 2026-02-19T06:00:00Z — Ralph Loop Audit (F-001 to F-011)
- **Status:** COMPLETE — All 11 features pass
- **Completed:** 63 mutation points audited and fixed across all modules
- **Key fix:** Removed all unstable_cache wrappers (caused stale data on TanStack Query refetch)
- **Key fix:** Auth redirect race condition in middleware.ts (cache warming killed sessions)
- **Key fix:** Login page race condition (router.push before cookies sync)
- **Key fix:** Added inline supplier creation in material-input-form.tsx
- **Key fix:** Added SupplierCategory model + vendor categories multi-select
- **Key fix:** Added 10s refetchInterval to vendor list for real-time multi-user sync

## Session 2026-02-19 — Meeting Bug List (T-001 to T-010)
- **Source:** bug-list-meeting-19feb2026.md
- **Already fixed from prior work:** BUG-001, BUG-002, BUG-003, BUG-007, FEAT-001 (categories), FEAT-004 (supplier inline)
- **Remaining:** T-001 to T-009 (T-010 skipped — needs human review)
- **Approach:** Parallel agents via dispatching-parallel-agents skill

## Session 2026-03-08 — CSA Parity Sprint (CSA-001 to CSA-020)
- **Source:** docs/csa_vs_erp_comparison.json — 274 CSA features mapped against ERP
- **Filtered:** 20 tasks selected for Indonesian textile SME relevance (skipped enterprise bloat like multi-site, POS, complex security)
- **Priority:** 7 high, 7 medium, 6 low
- **Key areas:** UOM conversion, opening balances (GL/AP/AR/Stock), costing methods, direct purchase, returns workflows, closing journal, discount system, exchange rates
- **Branch:** feat/csa-parity
- **Verify command:** `npx vitest run && npx tsc --noEmit && npm run lint`

### CSA-001: UOM Conversion System — DONE
- **Iterations:** 1
- **Changes:**
  - Added `UomConversion` model to Prisma schema with `fromUnitId`, `toUnitId`, `factor` fields
  - Added bidirectional relations to `Unit` model (`conversionsFrom`, `conversionsTo`)
  - Added server actions: `getUomConversions()`, `createUomConversion()`, `deleteUomConversion()` in `lib/actions/master-data.ts`
  - Auto-creates reverse conversion (1/factor) atomically
  - Added `convertUom()` helper in `lib/inventory-utils.ts`
  - Added `useUomConversions` hook + `invalidateUomConversions` in `hooks/use-master-data.ts`
  - Added `uomConversions` query key in `lib/query-keys.ts`
  - Product form now shows secondary UOM section with conversion factor input and save button
  - Auto-fills conversion factor if existing conversion found in DB
- **Tests:** 316/321 pass (5 pre-existing failures, unchanged)

## Session 2026-03-16 — Accounting Module Complete Integration (ACCT-001 to ACCT-010)
- **Source:** Meeting bug list + "ERP Accounting Module — Complete Technical Integration Guide" PDF + "Supplemental Integration Guide" PDF
- **Scope:** Fix all accounting transaction → journal entry → financial report connections
- **Branch:** feat/accounting-integration
- **Verify command:** `npx vitest run && npx tsc --noEmit`
- **Tasks:** 10 total (4 high, 4 medium, 2 low priority)

### Key Audit Findings (pre-loop):
- **Working:** Core postJournalEntry(), AR invoice GL, AP bill GL, AR/AP payments, credit notes, petty cash, balance sheet, P&L, trial balance, AR/AP aging
- **Broken:** Fixed asset depreciation has NO GL posting, DC notes createDCNote() truncated, COGS vs EXPENSE_DEFAULT inconsistency, GL failure doesn't revert documents, cash flow doesn't reconcile
- **Key files:** lib/actions/finance-gl.ts, finance-ap.ts, finance-ar.ts, finance-invoices.ts, finance-reports.ts, finance-dcnotes.ts, finance-fixed-assets.ts, finance-cashflow.ts
- **Accounting principle:** Every financial transaction → Journal Entry → GL balance update → Financial reports query GL. If any link is broken, reports are wrong.

### Results — All 10 tasks COMPLETE:
- **ACCT-001:** Fixed COGS→EXPENSE_DEFAULT in moveInvoiceToSent(), approveAndPayBill(), and monolithic finance.ts. COGS (5000) reserved for sales only.
- **ACCT-002:** Made GL posting atomic — throw error on failure so withPrismaAuth rolls back. Fixed in finance-ap.ts (3 locations), finance-ar.ts (3 locations), finance-invoices.ts (manual revert since GL is outside tx).
- **ACCT-003:** Fixed asset depreciation now uses postJournalEntry() instead of direct prisma.journalEntry.create. Correct GL balance direction for contra-asset accounts.
- **ACCT-004:** Already fully implemented — createDCNote(), postDCNote(), settleDCNote(), voidDCNote() all working with proper GL posting.
- **ACCT-005:** Fixed cash flow: widened cash account range to include 1100-1199 (banks), beginning cash now calculated from pre-period journal lines (point-in-time), added reconciliation discrepancy check.
- **ACCT-006:** Already correct — dashboard uses GL for cash, sub-ledger for AR/AP (standard practice).
- **ACCT-007:** New runIntegrityChecks() function: AR sub-ledger vs GL 1200, AP sub-ledger vs GL 2000, trial balance, balance sheet equation, orphan journal lines.
- **ACCT-008:** New postPPNSettlement() for monthly VAT settlement. Added PPN_LEBIH_BAYAR (1410) to SYS_ACCOUNTS. Handles both SETOR (owe tax) and LEBIH_BAYAR (excess input) scenarios.
- **ACCT-009:** Fixed asset disposal now uses postJournalEntry(). Added Bank debit for sale proceeds (was missing — journal wouldn't balance). Handles gain/loss correctly.
- **ACCT-010:** Added AR/AP aging KPI strips to receivables and payables pages. Shows 6 buckets: Total, Current, 1-30, 31-60, 61-90, 90+ days.
- **Tests:** 531/536 pass (5 pre-existing failures, unchanged)

## Session 2026-03-16 — Accounting Module V2 (ACCT2-001 to ACCT2-012)
- **Source:** Gap analysis against full accounting spec
- **Branch:** feat/accounting-integration
- **Verify command:** `npx vitest run && npx tsc --noEmit`

### ACCT2-002: Product Accounting Fields — DONE
- **Iterations:** 1
- **Changes:**
  - Added 4 optional FK fields to Product model: cogsAccountId, inventoryAccountId, incomeAccountId, purchaseAccountId (all String? @db.Uuid)
  - Added 4 relations on Product: cogsAccount, inventoryAccount, incomeAccount, purchaseAccount → GLAccount
  - Added 4 reverse relations on GLAccount: productsAsCogs, productsAsInventory, productsAsIncome, productsAsPurchase
  - Created migration 20260316100000_add_product_accounting_fields (manual apply due to shadow DB issue)
  - All fields default to NULL — existing products unaffected
- **Tests:** 531/536 pass (baseline unchanged)
- **Learned:** Shadow DB migrations fail due to old ProcurementStatus enum issue — use manual migration + db execute + migrate resolve workflow

### ACCT2-003: GLAccount Control Account Flag & Direct Posting Restriction — DONE
- **Iterations:** 1
- **Changes:**
  - Added `isControlAccount` (Boolean, default false) and `allowDirectPosting` (Boolean, default true) to GLAccount model
  - Created migration 20260316120000_add_gl_control_account_flags
  - Set isControlAccount=true, allowDirectPosting=false for AR (1200), AP (2000), Inventory (1300) via migration + seed-gl.ts
  - Added `sourceDocumentType` optional parameter to postJournalEntry() in both finance-gl.ts and finance.ts
  - When sourceDocumentType='MANUAL', checks each line's account.allowDirectPosting — blocks with Indonesian error message
  - System-generated entries (no sourceDocumentType or non-MANUAL) bypass the check — backwards compatible
  - Updated manual journal page (app/finance/journal/new/page.tsx) to pass sourceDocumentType: 'MANUAL'
  - Added 13 unit tests in __tests__/control-account-restriction.test.ts
- **Tests:** 544/549 pass (5 pre-existing failures, 13 new tests added)

### ACCT2-001: COA Expansion — DONE
- **Iterations:** 1
- **Changes:**
  - Added 15 new accounts to SYS_ACCOUNTS: ALLOWANCE_DOUBTFUL (1210), GR_IR_CLEARING (2150), SALARY_PAYABLE (2200), MFG_OVERHEAD_APPLIED (2210), PPH21_PAYABLE (2310), PPH23_PAYABLE (2315), BPJS_TK_PAYABLE (2320), BPJS_KES_PAYABLE (2330), UNEARNED_REVENUE (2400), SERVICE_REVENUE (4200), OTHER_INCOME (4300), INTEREST_INCOME (4400), SALARY_EXPENSE (6100), BAD_DEBT_EXPENSE (6500), BANK_CHARGES (7200)
  - Added all 15 to SYSTEM_ACCOUNT_DEFS with correct AccountType
  - Updated seed-gl.ts: added new accounts, updated conflicting codes (4200, 6100) to match system names, added missing system accounts (1210, 1410, 2150, 2200, 2210, 2310, 2315, 2320, 2330, 2400, 3900, 4300, 4400, 6500, 8200, 8300)
- **Tests:** 531/536 pass (baseline unchanged)

### ACCT2-004: Fiscal Period Enforcement — DONE
- **Iterations:** 1
- **Changes:**
  - Implementation already existed in postJournalEntry() (lines 153-162 of finance-gl.ts) — checks FiscalPeriod by year/month, blocks if isClosed=true, allows if no period exists
  - Added 12 unit tests in __tests__/fiscal-period-enforcement.test.ts covering: closed period blocking, open period allowing, missing period allowing, edge cases (first/last day, December month extraction), universal application to both manual and system entries
  - Fixed timezone issue: use `new Date(year, month, day)` instead of ISO strings to avoid UTC parsing shifting months
- **Tests:** 556/561 pass (5 pre-existing failures, 12 new tests added)

### ACCT2-005: GR/IR Clearing Account Flow — DONE
- **Iterations:** 1
- **Changes:**
  - **inventory-gl.ts**: PO_RECEIVE now credits GR/IR Clearing (2150) instead of AP (2000). Removed unused GL_ACCOUNTS_PAYABLE constant.
  - **inventory-gl.ts**: RETURN_OUT now debits GR/IR Clearing (2150) instead of AP (2000) — reversal of PO_RECEIVE.
  - **finance-invoices.ts**: moveInvoiceToSent() now checks `purchaseOrderId` and whether goods were received via GRN (ACCEPTED status).
  - For PO-linked bills with received goods: DR GR/IR Clearing (2150) instead of DR Expense (6900), ensuring 2150 nets to zero after both GRN receipt and bill posting.
  - For non-PO bills (direct expense purchases): existing flow unchanged (DR 6900).
- **Two-step flow:** GRN receipt: DR Inventory (1300), CR GR/IR (2150). Bill posting: DR GR/IR (2150), DR PPN (1330), CR AP (2000). Net: GR/IR = 0.
- **Tests:** 556/561 pass (baseline unchanged, no regressions)

### ACCT2-006: COGS Trigger on Sales Delivery — DONE
- **Iterations:** 1
- **Changes:**
  - In moveInvoiceToSent() for INV_OUT invoices: after AR/Revenue journal, fetches invoice items with product details (costPrice, cogsAccount, inventoryAccount)
  - For each stock item with costPrice > 0: generates COGS journal line (DR COGS, CR Inventory)
  - Uses product-specific cogsAccountId/inventoryAccountId when set, falls back to SYS_ACCOUNTS.COGS (5000) / SYS_ACCOUNTS.INVENTORY_ASSET (1300)
  - COGS journal is separate from AR/Revenue entry, with sourceDocumentType: 'COGS_RECOGNITION' and reference: 'COGS-{invoiceNumber}'
  - Items without product (service lines), zero costPrice, or zero quantity are skipped with console.warn
  - COGS failure does NOT block invoice posting (logged as warning, not thrown)
  - Added 14 unit tests in __tests__/cogs-recognition.test.ts
- **Tests:** 570/575 pass (5 pre-existing failures, 14 new tests added)

### ACCT2-007: Bad Debt Write-Off — DONE
- **Iterations:** 1
- **Changes:**
  - Added `provisionBadDebt()` in finance-ar.ts: DR Bad Debt Expense (6500), CR Allowance for Doubtful Debts (1210)
  - Added `writeOffBadDebt()` in finance-ar.ts with two methods:
    - DIRECT: DR Bad Debt Expense (6500), CR AR (1200) — hits P&L
    - ALLOWANCE: DR Allowance for Doubtful Debts (1210), CR AR (1200) — no P&L impact
  - Supports partial write-off (amount < balanceDue)
  - Full write-off sets invoice status to VOID
  - Uses ensureSystemAccounts() and sourceDocumentType: 'BAD_DEBT_WRITEOFF'
  - GL failure throws to trigger withPrismaAuth rollback (atomic)
  - Added 21 unit tests in __tests__/bad-debt-writeoff.test.ts
- **Tests:** 591/596 pass (5 pre-existing failures, 21 new tests added)

### ACCT2-008: WHT/PPh 23 on Vendor Payments — DONE
- **Iterations:** 1
- **Changes:**
  - Added `whtAmount` (Decimal 15,2) and `whtRate` (Decimal 5,4) optional fields to Payment model
  - Created migration 20260316180000_add_payment_wht_fields
  - Extended `recordVendorPayment()` in finance-ap.ts to accept optional `whtAmount` and `whtRate` params
  - When whtAmount > 0: DR AP (gross), CR Bank (net = gross - WHT), CR PPh 23 Payable (2315) [WHT]
  - Invoice balanceDue reduces by GROSS amount (WHT counts against invoice)
  - When whtAmount is 0 or not provided: existing 2-line flow unchanged (backwards compatible)
  - Payment record stores whtAmount and whtRate for tax reporting
  - Uses ensureSystemAccounts() before posting
  - Added 18 unit tests in __tests__/wht-vendor-payment.test.ts
- **Tests:** 609/614 pass (5 pre-existing failures, 18 new tests added)
