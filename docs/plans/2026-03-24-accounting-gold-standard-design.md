# Accounting Gold Standard — Transaction Lifecycle Design

**Date:** 2026-03-24
**Goal:** Bring the ERP accounting module to global standard (SAP/NetSuite/Accurate-grade) by ensuring every financial transaction flows correctly through the full lifecycle.

## Architecture

Every financial transaction must complete this chain:

```
Document → Status Change → GL Entry → Account Balance → Reports → Drill-Down
```

## 5 Workstreams

```
WS-1 (AR) ──────┐
                 ├──→ WS-3 (Cross-cutting) ──→ WS-5 (Audit & Test)
WS-2 (AP) ──────┘
WS-4 (UI) ──────────────────────────────────→ (independent)
```

| # | Workstream | Depends On |
|---|-----------|------------|
| WS-1 | AR Lifecycle | None |
| WS-2 | AP Lifecycle | None |
| WS-3 | Cross-Cutting (HPP, drill-down, PPN display, bug fixes) | WS-1, WS-2 |
| WS-4 | UI Polish (KPI cards, badges) | None |
| WS-5 | Automated Audit & Bank Recon Testing | WS-1, WS-2, WS-3 |

---

## WS-1: AR Lifecycle (Accounts Receivable)

### Already Working
- `createCustomerInvoice()` → DRAFT (no GL — correct)
- `moveInvoiceToSent()` → GL: DR AR, CR Revenue + PPN Keluaran
- `recordInvoicePayment()` → GL: DR Bank, CR AR
- Balance sheet: AR under Assets
- P&L: Revenue from sent invoices

### Gaps to Fix

**Gap 1: Send flow UX is broken**
- User clicks send → unclear feedback → error pops up
- Fix: investigate error in `moveInvoiceToSent()`, add loading state, clear success/error toast, ensure invoice card updates immediately
- Files: `app/finance/invoices/page.tsx`, `lib/actions/finance-invoices.ts`

**Gap 2: PDF download error**
- Typst PDF generation fails
- Fix: investigate Typst template + document API route, fix generation error, add fallback error handling
- Files: `app/api/documents/`, `templates/`

**Gap 3: Partial payment tracking**
- Verify `recordInvoicePayment()` correctly updates `balanceDue` and flips status to PARTIAL
- Files: `lib/actions/finance-invoices.ts`

**Gap 4: AR Aging drill-down**
- AR aging shows totals but clicking doesn't navigate anywhere
- Fix: click handler → account transactions filtered by customer/invoice
- Files: `components/finance/reports/`

---

## WS-2: AP Lifecycle (Accounts Payable)

### Already Working
- `approveVendorBill()` → GL: DR Expense + PPN Masukan, CR AP
- `recordVendorPayment()` → GL: DR AP, CR Bank
- `recordMultiBillPayment()` → batch payment with single GL entry
- Accrual basis correct (expense at approval, not payment)

### Gaps to Fix

**Gap 1: Bill approval always uses EXPENSE_DEFAULT (6900)**
- Every bill line debits `6900` regardless of what was purchased
- Fix: use product's `expenseAccountCode` (from HPP flag in WS-3), fall back to `6900`
- Files: `lib/actions/finance-ap.ts`

**Gap 2: Bills from PO flow to GL**
- `createBillFromPOId()` creates DRAFT — verify approve button is visible and working
- Files: `app/finance/bills/page.tsx`

**Gap 3: AP Aging drill-down**
- Same as AR — add click-through to vendor/bill detail
- Files: `components/finance/reports/`

**Gap 4: Unapproved bills invisible to P&L**
- User reported "Rp700.000 belum muncul sebagai expense" — likely bill not approved
- Fix: add warning indicator on unapproved bills, make approval flow more discoverable
- Files: `app/finance/bills/page.tsx`

---

## WS-3: Cross-Cutting Features

### Feature 1: HPP Flag on Products (COGS Marking)

Add `expenseAccountCode` field to Product model:

```prisma
model Product {
  ...existing fields
  expenseAccountCode  String?  // e.g. "5000" for HPP, null → falls back to "6900"
}
```

- Product form: dropdown "Akun Beban" with EXPENSE-type GL accounts
- Default: `null` (falls back to `SYS_ACCOUNTS.EXPENSE_DEFAULT`)
- `approveVendorBill()`: uses `product.expenseAccountCode ?? SYS_ACCOUNTS.EXPENSE_DEFAULT`
- Per-bill-line override: user can change the auto-selected account

**Files:** `prisma/schema.prisma`, `lib/actions/finance-ap.ts`, `components/inventory/product-form.tsx`, new migration

### Feature 2: Full Drill-Down Audit Trail

Three levels:

```
Reports (Neraca/Laba Rugi)
  → click line item → Account Transaction List
    → click journal entry → Source Document (invoice/bill/payment)
```

**Level 1: Reports → Account Transactions**
- P&L and Neraca line items become clickable
- Navigate to `/finance/transactions?account={code}&from={date}&to={date}`

**Level 2: COA → Account Transactions**
- Chart of Accounts: click account row → transactions view
- Balance Sheet detail: click account → transactions view

**Level 3: Transaction → Source Document**
- Journal entry row shows "Lihat Dokumen" link
- Resolves via `journalEntry.reference` → invoice/bill/payment page

**Files:** `app/finance/reports/page.tsx`, `components/finance/reports/`, `app/finance/transactions/page.tsx`, `app/finance/chart-accounts/page.tsx`

### Feature 3: PPN Display Fix

- Verify invoice/bill detail views show DPP and PPN as separate line items
- Fix display components to read `subtotal` and `taxAmount` separately

**Files:** `components/finance/create-invoice-dialog.tsx`, invoice/bill detail views

### Bug Fix 1: PDF Generation Error

- Investigate `app/api/documents/` routes and Typst templates
- Fix compilation/data binding error, add error response with user-friendly message

### Bug Fix 2: Send Flow UX

- Fix error in `moveInvoiceToSent()` (race condition / stale cache)
- Add loading spinner, clear toast, prevent double-click

---

## WS-4: UI Polish

### Color Hierarchy (KPI Cards & Status Badges)

| Element | New Standard |
|---------|-------------|
| Primary action | Orange (brand) |
| Paid / success | `emerald-600` (muted) |
| Overdue / error | `red-600` |
| Draft / neutral | `zinc-500` |
| Partial | `amber-600` (muted) |
| Disputed | `zinc-700` with icon |
| KPI numbers | `zinc-900` — prominence from size, not color |
| KPI card backgrounds | White with left-border accent only |

**Files:** `components/finance/finance-metric-card.tsx`, finance dashboard/invoices/bills/receivables/payables pages

---

## WS-5: Automated Audit & Bank Reconciliation Testing

### Part 1: Expand Test Suite

**`__tests__/accounting-lifecycle.test.ts`** (new)
- Full AR lifecycle sequence test
- Full AP lifecycle sequence test
- HPP routing: product with HPP → `5000`, without → `6900`
- PPN split: with PPN → 3 GL lines, without → 2
- Credit note reversal: Revenue decreases, AR decreases
- Drill-down data: `getAccountTransactions()` returns all posted entries

**`__tests__/accounting-no-orphans.test.ts`** (new)
- No ISSUED/PAID invoice without journal entry
- No APPROVED/PAID bill without journal entry
- No payment without journal entry

### Part 2: Bank Reconciliation Manual Test

1. Verify bank GL entries exist (from AR/AP payments)
2. Import mock bank statement CSV
3. Auto-match by amount + date
4. Manual match remaining
5. Close reconciliation — verify balance

### Part 3: Smoke Test Script

**`scripts/smoke-test-accounting.ts`** (new)
- Query invoices/bills with status != DRAFT → check journal entry exists
- Query all journal entries → check balanced
- Run balance sheet → check `isBalanced === true`
- Output pass/fail report

Run: `npx tsx scripts/smoke-test-accounting.ts`

---

## Success Criteria

- [ ] Every sent invoice has a balanced GL entry with correct DPP/PPN split
- [ ] Every approved bill has a GL entry debiting the correct expense account (HPP or Beban)
- [ ] Every payment has a GL entry (DR/CR only balance sheet accounts)
- [ ] Balance sheet equation holds: Assets = Liabilities + Equity
- [ ] P&L shows all recognized revenue and expenses
- [ ] Full drill-down: Reports → Transactions → Source Documents
- [ ] PDF download works
- [ ] Send flow works with clear UX feedback
- [ ] KPI cards use professional color palette
- [ ] `npx vitest` passes all accounting tests
- [ ] `npx tsx scripts/smoke-test-accounting.ts` passes
- [ ] Bank reconciliation works end-to-end
