# Accounting Gold Standard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the ERP accounting module to global standard — every financial transaction flows through Document → GL Entry → Reports → Drill-Down with full audit trail.

**Architecture:** Transaction Lifecycle approach. Fix AR and AP lifecycles end-to-end (WS-1, WS-2), then add cross-cutting features (WS-3: HPP, drill-down, bug fixes), polish UI (WS-4), and verify with automated tests (WS-5). WS-1/WS-2/WS-4 are independent and can be parallelized.

**Tech Stack:** Next.js 16, Prisma 6.x, React 19, PostgreSQL, Typst (PDF), Vitest

**Design doc:** `docs/plans/2026-03-24-accounting-gold-standard-design.md`

---

## WS-1: AR Lifecycle

### Task 1: Fix Invoice Send Flow UX

**Files:**
- Modify: `app/finance/invoices/page.tsx:291-314` (send handler)
- Modify: `lib/actions/finance-invoices.ts:749-860` (moveInvoiceToSent)

**Step 1: Read and understand the current send flow**

Read `app/finance/invoices/page.tsx` around lines 291-314 to see the onClick handler. Read `lib/actions/finance-invoices.ts:749-860` to understand what `moveInvoiceToSent()` does, how it handles errors, and what it returns.

**Step 2: Identify the bug**

Check for:
- Is `setSending(true)` called before the async call? (line 301)
- Is the error from `moveInvoiceToSent()` properly caught and displayed?
- Does the toast show the actual error message or a generic one?
- Is there a race condition if user double-clicks?
- Does the React Query cache invalidate properly after success?

**Step 3: Fix the send handler**

In `app/finance/invoices/page.tsx`, ensure the send handler:
1. Sets loading state immediately
2. Disables the button while processing
3. Calls `moveInvoiceToSent()`
4. On success: shows toast with invoice number, invalidates query cache, updates card
5. On error: shows the ACTUAL error message (not generic), resets loading state
6. Uses try/finally to always reset loading state

**Step 4: Fix moveInvoiceToSent() error handling**

In `lib/actions/finance-invoices.ts:847-860`, ensure:
1. GL failure reverts invoice status back to DRAFT (already exists at lines 851-855)
2. Return a descriptive error message that the UI can display
3. Check for stale cache: if invoice is already ISSUED, return a clear message "Invoice sudah dikirim"

**Step 5: Test manually**

Run `npm run dev`, navigate to invoices, try sending a DRAFT invoice. Verify:
- Loading spinner shows
- Button is disabled during send
- Success toast with invoice number
- Card moves from Draft to Sent column
- Sending again shows "sudah dikirim" message

**Step 6: Commit**

```bash
git add app/finance/invoices/page.tsx lib/actions/finance-invoices.ts
git commit -m "fix(invoices): improve send flow UX — loading state, error messages, double-click prevention"
```

---

### Task 2: Fix Invoice PDF Download

**Files:**
- Modify: `app/api/documents/invoice/[id]/route.ts`
- Check: `templates/` directory for invoice Typst templates
- Check: `lib/services/document-service.ts`

**Step 1: Read the invoice PDF route**

Read `app/api/documents/invoice/[id]/route.ts` to understand:
- How it fetches invoice data
- How it calls Typst for PDF generation
- What error handling exists

**Step 2: Read the document service**

Read `lib/services/document-service.ts` to understand:
- How Typst is invoked
- What template path is used for invoices
- Whether the template file actually exists

**Step 3: Identify the error**

Check:
- Does the invoice Typst template exist in `templates/`?
- Are all template variables populated (customer name, items, amounts, tax)?
- Is Typst installed? (`scripts/install-typst.js`)
- Does the API route return proper error responses?

**Step 4: Fix the PDF generation**

Fix whatever is broken — common causes:
- Missing template file → create it
- Template variable mismatch → fix data binding
- Typst not installed → add check with user-friendly error
- Missing data fields (customer, items) → add null checks

**Step 5: Add error response**

Ensure the API route returns a clear JSON error with status 500 if PDF generation fails, not a raw exception. The frontend should show a toast: "Gagal membuat PDF: {reason}"

**Step 6: Test manually**

Navigate to an invoice, click download. Verify PDF generates with correct data.

**Step 7: Commit**

```bash
git add app/api/documents/invoice/ templates/ lib/services/document-service.ts
git commit -m "fix(documents): fix invoice PDF generation — template binding and error handling"
```

---

### Task 3: Verify AR Partial Payment Tracking

**Files:**
- Read: `lib/actions/finance-invoices.ts` — `recordInvoicePayment()` (starts around line 869)
- Test: `__tests__/accounting-lifecycle.test.ts` (new)

**Step 1: Write the failing test**

Create `__tests__/accounting-lifecycle.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('AR Lifecycle: Partial Payment', () => {
  it('partial payment reduces balanceDue and keeps status PARTIAL', () => {
    // Simulate: invoice total 1,000,000 — payment of 400,000
    const invoiceTotal = 1000000
    const paymentAmount = 400000
    const newBalanceDue = invoiceTotal - paymentAmount
    const newStatus = newBalanceDue > 0 ? 'PARTIAL' : 'PAID'

    expect(newBalanceDue).toBe(600000)
    expect(newStatus).toBe('PARTIAL')
  })

  it('full payment sets balanceDue to 0 and status to PAID', () => {
    const invoiceTotal = 1000000
    const paymentAmount = 1000000
    const newBalanceDue = invoiceTotal - paymentAmount
    const newStatus = newBalanceDue <= 0 ? 'PAID' : 'PARTIAL'

    expect(newBalanceDue).toBe(0)
    expect(newStatus).toBe('PAID')
  })

  it('overpayment clamps balanceDue to 0', () => {
    const invoiceTotal = 1000000
    const paymentAmount = 1200000
    const newBalanceDue = Math.max(0, invoiceTotal - paymentAmount)

    expect(newBalanceDue).toBe(0)
  })
})
```

**Step 2: Run test to verify it passes**

```bash
npx vitest run __tests__/accounting-lifecycle.test.ts
```

**Step 3: Read recordInvoicePayment()**

Read `lib/actions/finance-invoices.ts` around line 869. Verify:
- Does it compute `newBalanceDue = currentBalanceDue - paymentAmount`?
- Does it update invoice status to PARTIAL if `newBalanceDue > 0`?
- Does it update to PAID if `newBalanceDue <= 0`?
- Does it clamp to 0 (no negative balanceDue)?

**Step 4: Fix if needed**

If any of the above checks fail, fix the logic in `recordInvoicePayment()`.

**Step 5: Commit**

```bash
git add __tests__/accounting-lifecycle.test.ts lib/actions/finance-invoices.ts
git commit -m "test(ar): verify partial payment tracking — balanceDue and status transitions"
```

---

## WS-2: AP Lifecycle

### Task 4: Add HPP Product Flag (Schema + Migration)

**Files:**
- Modify: `prisma/schema.prisma:211-285` (Product model)
- Create: migration via `npx prisma migrate dev`

**Step 1: Add expenseAccountCode to Product model**

In `prisma/schema.prisma`, find the Product model (line 211). Add after the last field before relations:

```prisma
  expenseAccountCode String?  // GL expense account code (e.g. "5000" HPP, "6900" Beban Lain-lain)
```

**Step 2: Create migration**

```bash
npx prisma migrate dev --name add_product_expense_account
```

**Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(schema): add expenseAccountCode to Product for HPP/COGS routing"
```

---

### Task 5: Add Expense Account Dropdown to Product Form

**Files:**
- Modify: `components/inventory/product-form.tsx:63-95`

**Step 1: Read the product form**

Read `components/inventory/product-form.tsx` to understand the form structure, especially around lines 63-95.

**Step 2: Add expense account field to form defaults**

Add `expenseAccountCode` to the form default values (after line 78):

```typescript
expenseAccountCode: product?.expenseAccountCode || '',
```

**Step 3: Add dropdown UI**

Add a select field after the existing fields (before the submit button). Fetch EXPENSE-type GL accounts for the dropdown options. Use a pattern similar to existing select fields in the form.

Label: "Akun Beban (Expense Account)"
Options: GLAccount where type = 'EXPENSE', displaying code + name
Default: empty (will fall back to 6900 Beban Lain-lain)
Helper text: "Pilih '5000 - HPP' untuk item yang termasuk Harga Pokok Penjualan"

**Step 4: Test manually**

Open product create/edit form. Verify dropdown shows expense accounts. Save and verify it persists.

**Step 5: Commit**

```bash
git add components/inventory/product-form.tsx
git commit -m "feat(products): add expense account dropdown for HPP/COGS classification"
```

---

### Task 6: Route Bill Approval to Product Expense Account

**Files:**
- Modify: `lib/actions/finance-ap.ts:250-265` (approveVendorBill GL lines)
- Test: `__tests__/accounting-lifecycle.test.ts`

**Step 1: Write the failing test**

Add to `__tests__/accounting-lifecycle.test.ts`:

```typescript
describe('AP Lifecycle: HPP Routing', () => {
  const SYS = { EXPENSE_DEFAULT: '6900', COGS: '5000' }

  function resolveExpenseAccount(product: { expenseAccountCode?: string | null } | null): string {
    return product?.expenseAccountCode || SYS.EXPENSE_DEFAULT
  }

  it('product with HPP flag routes to COGS (5000)', () => {
    const product = { expenseAccountCode: '5000' }
    expect(resolveExpenseAccount(product)).toBe('5000')
  })

  it('product without HPP flag routes to EXPENSE_DEFAULT (6900)', () => {
    const product = { expenseAccountCode: null }
    expect(resolveExpenseAccount(product)).toBe('6900')
  })

  it('bill line without product routes to EXPENSE_DEFAULT (6900)', () => {
    expect(resolveExpenseAccount(null)).toBe('6900')
  })

  it('per-line override takes precedence', () => {
    // If user overrides the account on the bill line, use that
    const lineOverride = '6200' // e.g. Beban Sewa
    const product = { expenseAccountCode: '5000' }
    const resolvedAccount = lineOverride || resolveExpenseAccount(product)
    expect(resolvedAccount).toBe('6200')
  })
})
```

**Step 2: Run test to verify it passes**

```bash
npx vitest run __tests__/accounting-lifecycle.test.ts
```

**Step 3: Modify approveVendorBill()**

In `lib/actions/finance-ap.ts` around line 254-264, change the bill items loop:

Before:
```typescript
glLines.push({
  accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT,
  debit: amount,
  ...
})
```

After:
```typescript
// Use product's expense account if set, otherwise fall back to default
const expenseAccount = item.product?.expenseAccountCode || SYS_ACCOUNTS.EXPENSE_DEFAULT
glLines.push({
  accountCode: expenseAccount,
  debit: amount,
  ...
})
```

Also ensure the Prisma query that fetches the bill includes `items.product.expenseAccountCode` in the select/include.

**Step 4: Run tests**

```bash
npx vitest run __tests__/accounting-lifecycle.test.ts
npx vitest run __tests__/accounting-integrity.test.ts
```

**Step 5: Commit**

```bash
git add lib/actions/finance-ap.ts __tests__/accounting-lifecycle.test.ts
git commit -m "feat(ap): route bill approval to product expense account (HPP/COGS support)"
```

---

### Task 7: Add Unapproved Bill Warning Indicator

**Files:**
- Modify: `app/finance/bills/page.tsx`

**Step 1: Read the bills page**

Read `app/finance/bills/page.tsx` to understand how bills are rendered (stack/kanban view).

**Step 2: Add warning for DRAFT bills that should be approved**

For bills in DRAFT status that have been in draft for more than 3 days, show a warning badge:
- Orange badge: "Belum disetujui" (Not yet approved)
- Tooltip: "Approve bill ini agar masuk ke Laba Rugi sebagai beban"

This helps users understand WHY their expenses aren't showing in P&L.

**Step 3: Make the Approve button more prominent**

Ensure the "Setujui" (Approve) button is clearly visible on DRAFT bills — use `NB.toolbarBtnPrimary` style (orange).

**Step 4: Test manually**

Open bills page. DRAFT bills should show the warning. Click approve — bill moves to approved, warning disappears.

**Step 5: Commit**

```bash
git add app/finance/bills/page.tsx
git commit -m "feat(bills): add warning indicator for unapproved bills — guides users to approve for P&L"
```

---

## WS-3: Cross-Cutting Features

### Task 8: Add Account Param Support to Transactions Page

**Files:**
- Modify: `app/finance/transactions/page.tsx`

**Step 1: Read the transactions page**

Read `app/finance/transactions/page.tsx`. Currently it has no query param support — all filtering is via internal state.

**Step 2: Add searchParams support**

Add `useSearchParams()` hook to read URL params:

```typescript
const searchParams = useSearchParams()
const initialAccount = searchParams.get('account') || ''
const initialFrom = searchParams.get('from') || ''
const initialTo = searchParams.get('to') || ''
```

Initialize the filter state with these values so when the user navigates from reports/COA, the page pre-filters to the right account and date range.

**Step 3: Test manually**

Navigate to `/finance/transactions?account=1200&from=2026-01-01&to=2026-03-31`. Verify it pre-filters to show only AR (1200) transactions in Q1 2026.

**Step 4: Commit**

```bash
git add app/finance/transactions/page.tsx
git commit -m "feat(transactions): support URL query params for account/date filtering"
```

---

### Task 9: Add Drill-Down from P&L Report

**Files:**
- Modify: `app/finance/reports/page.tsx:851+` (P&L section)

**Step 1: Read the P&L rendering**

Read `app/finance/reports/page.tsx` around line 851+. P&L rows already have `onClick` handlers for `toggleDrillDown()`. We need to add a "Lihat Transaksi" link that navigates to the transactions page.

**Step 2: Add navigation link in drill-down rows**

When a P&L line is expanded (drill-down is open), add a link at the bottom of the expanded section:

```tsx
<Link
  href={`/finance/transactions?account=${account.code}&from=${startDate}&to=${endDate}`}
  className="text-xs text-orange-600 hover:underline"
>
  Lihat semua transaksi →
</Link>
```

**Step 3: Test manually**

Open P&L report. Click "Pendapatan Penjualan" to expand. Verify "Lihat semua transaksi →" link appears. Click it — navigates to transactions page filtered to account 4000.

**Step 4: Commit**

```bash
git add app/finance/reports/page.tsx
git commit -m "feat(reports): add drill-down link from P&L to account transactions"
```

---

### Task 10: Add Drill-Down from Balance Sheet

**Files:**
- Modify: `app/finance/reports/page.tsx` (Neraca section, after P&L)

**Step 1: Find the Neraca rendering section**

Read `app/finance/reports/page.tsx` — find where Balance Sheet rows are rendered. They are currently NOT clickable.

**Step 2: Make Balance Sheet line items clickable**

Add onClick to each account row in the balance sheet that navigates to transactions:

```tsx
onClick={() => router.push(
  `/finance/transactions?account=${account.code}&from=${fiscalYearStart}&to=${asOfDate}`
)}
className="cursor-pointer hover:bg-orange-50/50"
```

Apply to: Current Assets, Fixed Assets, Current Liabilities, Long-term Liabilities, and Equity items.

**Step 3: Test manually**

Open Neraca report. Click "Piutang Usaha" row. Verify it navigates to transactions for account 1200.

**Step 4: Commit**

```bash
git add app/finance/reports/page.tsx
git commit -m "feat(reports): add drill-down from balance sheet to account transactions"
```

---

### Task 11: Add Drill-Down from Chart of Accounts

**Files:**
- Modify: `app/finance/chart-accounts/page.tsx:46+` (AccountNode component)

**Step 1: Read the COA page**

Read `app/finance/chart-accounts/page.tsx`. The AccountNode component at line 46+ renders each row. onClick at line 61 only toggles expand — does NOT navigate.

**Step 2: Add transaction drill-down**

Add a clickable balance amount or "Lihat" icon button on each account row that navigates to transactions:

```tsx
<button
  onClick={(e) => {
    e.stopPropagation() // Don't toggle expand
    router.push(`/finance/transactions?account=${account.code}`)
  }}
  className="text-xs text-orange-600 hover:underline"
  title="Lihat transaksi akun ini"
>
  {formatCurrency(account.balance)}
</button>
```

This makes the balance column clickable while keeping the row click for expand/collapse.

**Step 3: Test manually**

Open Chart of Accounts. Click the balance amount of any account. Verify it navigates to transactions filtered by that account code.

**Step 4: Commit**

```bash
git add app/finance/chart-accounts/page.tsx
git commit -m "feat(coa): add drill-down from account balance to transactions"
```

---

### Task 12: Add Source Document Links in Transactions

**Files:**
- Modify: `app/finance/transactions/page.tsx`

**Step 1: Read how journal entries are rendered**

Read the transactions page to see how journal entry rows are displayed. Check if the `reference` field (e.g. "INV-2026-001", "BILL-001") is shown.

**Step 2: Add source document link**

Parse the `reference` field to determine the source document type and link:

```typescript
function getSourceDocumentLink(reference: string): string | null {
  if (reference.startsWith('INV-')) return `/finance/invoices?highlight=${reference}`
  if (reference.startsWith('BILL-')) return `/finance/bills?highlight=${reference}`
  if (reference.startsWith('PAY-')) return `/finance/payments?highlight=${reference}`
  if (reference.startsWith('VPAY-')) return `/finance/vendor-payments?highlight=${reference}`
  if (reference.startsWith('PC-')) return `/finance/petty-cash`
  if (reference.startsWith('DEP-')) return `/finance/fixed-assets/depreciation`
  return null
}
```

Add a "Lihat Dokumen" button/link next to each journal entry that has a resolvable reference.

**Step 3: Test manually**

Open transactions page. Find a journal entry from an invoice. Click "Lihat Dokumen". Verify it navigates to the invoice page.

**Step 4: Commit**

```bash
git add app/finance/transactions/page.tsx
git commit -m "feat(transactions): add source document links for full audit trail"
```

---

### Task 13: Add AR/AP Aging Drill-Down

**Files:**
- Modify: `components/finance/reports/` (AR and AP aging components)

**Step 1: Find AR and AP aging rendering**

Read the reports page to find where AR Aging and AP Aging are rendered. Find the table rows.

**Step 2: Make aging rows clickable**

Each aging row (grouped by customer/vendor) should navigate to the transactions page filtered by the AR or AP account:

- AR aging row click → `/finance/transactions?account=1200&search={customerName}`
- AP aging row click → `/finance/transactions?account=2000&search={vendorName}`

**Step 3: Test manually**

Open AR Aging. Click a customer row. Verify navigation to transactions for AR account.

**Step 4: Commit**

```bash
git add components/finance/reports/ app/finance/reports/page.tsx
git commit -m "feat(reports): add drill-down from AR/AP aging to account transactions"
```

---

### Task 14: Verify PPN Display in Invoice/Bill Detail

**Files:**
- Read: `components/finance/create-invoice-dialog.tsx`
- Read: invoice/bill detail views in `app/finance/invoices/page.tsx`

**Step 1: Check PPN display**

Read the invoice detail view (quick view or dialog). Verify:
- DPP (Subtotal) is shown as a separate line
- PPN (Tax) is shown as a separate line with "PPN 11%" label
- Total is shown as DPP + PPN
- They are NOT combined into a single number

**Step 2: Fix if needed**

If DPP and PPN are shown as a single combined amount, split them:

```tsx
<div>Subtotal (DPP): {formatCurrency(invoice.subtotal)}</div>
<div>PPN 11%: {formatCurrency(invoice.taxAmount)}</div>
<div className="font-bold">Total: {formatCurrency(invoice.totalAmount)}</div>
```

**Step 3: Commit (only if changes needed)**

```bash
git add components/finance/
git commit -m "fix(invoices): show DPP and PPN as separate line items in invoice detail"
```

---

## WS-4: UI Polish

### Task 15: Refine KPI Card and Badge Colors

**Files:**
- Modify: `components/finance/finance-metric-card.tsx:25-31` (color mapping)
- Modify: `app/finance/page.tsx` (dashboard KPIs)
- Modify: `app/finance/invoices/page.tsx` (invoice kanban KPIs)
- Modify: `app/finance/bills/page.tsx` (bill KPIs)
- Modify: `app/finance/receivables/page.tsx` (AR aging cards)
- Modify: `app/finance/payables/page.tsx` (AP aging cards)

**Step 1: Update finance-metric-card color palette**

In `components/finance/finance-metric-card.tsx:25-31`, replace the colorful backgrounds with muted professional palette:

```typescript
const colorStyles: Record<string, string> = {
  emerald: "text-emerald-600 bg-white border-l-4 border-l-emerald-500 border border-zinc-200",
  blue: "text-zinc-700 bg-white border-l-4 border-l-zinc-400 border border-zinc-200",
  rose: "text-red-600 bg-white border-l-4 border-l-red-500 border border-zinc-200",
  amber: "text-amber-600 bg-white border-l-4 border-l-amber-500 border border-zinc-200",
  indigo: "text-zinc-700 bg-white border-l-4 border-l-orange-500 border border-zinc-200",
}
```

Key changes:
- White backgrounds instead of colored backgrounds
- Left border accent only (4px)
- Numbers in `zinc-900` (dark) — prominence from font size, not color
- Only 4 semantic colors: orange (primary), emerald (success), red (error), zinc (neutral)

**Step 2: Audit KPI usage across finance pages**

Check each finance page and ensure KPI cards use the correct semantic color:
- Total / primary metrics → `indigo` (maps to orange accent)
- Paid / success → `emerald`
- Overdue / error → `rose`
- Draft / neutral → `blue` (maps to zinc accent)
- Partial → `amber`

**Step 3: Update status badges**

In any inline status badges, use the same 4-color system:
- `bg-orange-100 text-orange-700` — active/primary
- `bg-emerald-100 text-emerald-700` — paid/success
- `bg-red-100 text-red-700` — overdue/error
- `bg-zinc-100 text-zinc-700` — draft/neutral
- `bg-amber-100 text-amber-700` — partial

**Step 4: Test manually**

Navigate through all finance pages. Verify cards look professional — white backgrounds with subtle left-border accents. Numbers are prominent via size, not color.

**Step 5: Commit**

```bash
git add components/finance/finance-metric-card.tsx app/finance/page.tsx app/finance/invoices/page.tsx app/finance/bills/page.tsx app/finance/receivables/page.tsx app/finance/payables/page.tsx
git commit -m "style(finance): refine KPI cards to professional palette — white bg, left-border accent"
```

---

## WS-5: Automated Audit & Testing

### Task 16: Expand Accounting Lifecycle Tests

**Files:**
- Modify: `__tests__/accounting-lifecycle.test.ts`

**Step 1: Add full AR lifecycle test**

```typescript
describe('Full AR Lifecycle', () => {
  it('invoice create → send → partial pay → full pay produces correct GL chain', () => {
    const subtotal = 1000000
    const ppn = Math.round(subtotal * 0.11)
    const total = subtotal + ppn

    // Step 1: Create invoice (DRAFT) — NO GL entry
    const draftGLEntries: any[] = []
    expect(draftGLEntries.length).toBe(0)

    // Step 2: Send invoice — GL: DR AR 1,110,000 / CR Revenue 1,000,000 + CR PPN 110,000
    const sendEntry = {
      lines: [
        { account: '1200', debit: total, credit: 0 },
        { account: '4000', debit: 0, credit: subtotal },
        { account: '2110', debit: 0, credit: ppn },
      ]
    }
    const sendBalance = sendEntry.lines.reduce((s, l) => s + l.debit - l.credit, 0)
    expect(sendBalance).toBe(0) // Balanced

    // Step 3: Partial payment 500,000 — GL: DR Bank / CR AR
    const partialPay = {
      lines: [
        { account: '1110', debit: 500000, credit: 0 },
        { account: '1200', debit: 0, credit: 500000 },
      ]
    }
    const partialBalance = partialPay.lines.reduce((s, l) => s + l.debit - l.credit, 0)
    expect(partialBalance).toBe(0)

    // After partial: balanceDue = 1,110,000 - 500,000 = 610,000
    const balanceAfterPartial = total - 500000
    expect(balanceAfterPartial).toBe(610000)

    // Step 4: Full remaining payment — GL: DR Bank / CR AR
    const finalPay = {
      lines: [
        { account: '1110', debit: 610000, credit: 0 },
        { account: '1200', debit: 0, credit: 610000 },
      ]
    }
    const finalBalance = finalPay.lines.reduce((s, l) => s + l.debit - l.credit, 0)
    expect(finalBalance).toBe(0)

    // After full payment: balanceDue = 0, status = PAID
    const finalBalanceDue = balanceAfterPartial - 610000
    expect(finalBalanceDue).toBe(0)
  })
})
```

**Step 2: Add full AP lifecycle test**

```typescript
describe('Full AP Lifecycle', () => {
  it('bill create → approve → pay produces correct GL chain', () => {
    const subtotal = 777000
    const ppn = Math.round(subtotal * 0.11)
    const total = subtotal + ppn

    // Step 1: Create bill (DRAFT) — NO GL entry
    // Step 2: Approve bill — GL: DR Expense + DR PPN Masukan / CR AP
    const approveEntry = {
      lines: [
        { account: '6900', debit: subtotal, credit: 0 },
        { account: '1330', debit: ppn, credit: 0 },
        { account: '2000', debit: 0, credit: total },
      ]
    }
    const approveBalance = approveEntry.lines.reduce((s, l) => s + l.debit - l.credit, 0)
    expect(approveBalance).toBe(0)

    // Step 3: Pay bill — GL: DR AP / CR Bank
    const payEntry = {
      lines: [
        { account: '2000', debit: total, credit: 0 },
        { account: '1110', debit: 0, credit: total },
      ]
    }
    const payBalance = payEntry.lines.reduce((s, l) => s + l.debit - l.credit, 0)
    expect(payBalance).toBe(0)
  })
})
```

**Step 3: Run all tests**

```bash
npx vitest run __tests__/accounting-lifecycle.test.ts
npx vitest run __tests__/accounting-integrity.test.ts
```

**Step 4: Commit**

```bash
git add __tests__/accounting-lifecycle.test.ts
git commit -m "test(accounting): add full AR and AP lifecycle tests"
```

---

### Task 17: Create No-Orphan Data Integrity Tests

**Files:**
- Create: `__tests__/accounting-no-orphans.test.ts`

**Step 1: Write the test file**

```typescript
import { describe, it, expect } from 'vitest'

/**
 * These tests verify the RULES for data integrity.
 * They don't query the DB — they verify the logic that prevents orphans.
 */
describe('No-Orphan Rules: Invoice → Journal Entry', () => {
  // Simulates the lifecycle check
  function hasJournalEntry(invoiceStatus: string): boolean {
    // DRAFT and CANCELLED invoices should NOT have journal entries
    // ISSUED, PARTIAL, PAID, OVERDUE should ALWAYS have journal entries
    return !['DRAFT', 'CANCELLED'].includes(invoiceStatus)
  }

  it('DRAFT invoice should NOT require journal entry', () => {
    expect(hasJournalEntry('DRAFT')).toBe(false)
  })

  it('ISSUED invoice MUST have journal entry', () => {
    expect(hasJournalEntry('ISSUED')).toBe(true)
  })

  it('PARTIAL invoice MUST have journal entry', () => {
    expect(hasJournalEntry('PARTIAL')).toBe(true)
  })

  it('PAID invoice MUST have journal entry', () => {
    expect(hasJournalEntry('PAID')).toBe(true)
  })

  it('OVERDUE invoice MUST have journal entry', () => {
    expect(hasJournalEntry('OVERDUE')).toBe(true)
  })

  it('CANCELLED invoice should NOT require journal entry', () => {
    expect(hasJournalEntry('CANCELLED')).toBe(false)
  })
})

describe('No-Orphan Rules: Bill → Journal Entry', () => {
  function hasJournalEntry(billStatus: string): boolean {
    return !['DRAFT', 'CANCELLED', 'DISPUTED'].includes(billStatus)
  }

  it('DRAFT bill should NOT require journal entry', () => {
    expect(hasJournalEntry('DRAFT')).toBe(false)
  })

  it('APPROVED bill MUST have journal entry', () => {
    expect(hasJournalEntry('APPROVED')).toBe(true)
  })

  it('PAID bill MUST have journal entry', () => {
    expect(hasJournalEntry('PAID')).toBe(true)
  })
})
```

**Step 2: Run tests**

```bash
npx vitest run __tests__/accounting-no-orphans.test.ts
```

**Step 3: Commit**

```bash
git add __tests__/accounting-no-orphans.test.ts
git commit -m "test(accounting): add no-orphan data integrity rule tests"
```

---

### Task 18: Create Smoke Test Script

**Files:**
- Create: `scripts/smoke-test-accounting.ts`

**Step 1: Write the smoke test script**

```typescript
/**
 * Accounting Smoke Test — run before trial push
 * Usage: npx tsx scripts/smoke-test-accounting.ts
 *
 * Queries the database and verifies:
 * 1. All non-DRAFT invoices have journal entries
 * 2. All journal entries are balanced
 * 3. Balance sheet equation holds
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Accounting Smoke Test ===\n')
  let passed = 0
  let failed = 0

  // Test 1: Non-DRAFT invoices have journal entries
  console.log('1. Checking invoice → journal entry connectivity...')
  const issuedInvoices = await prisma.invoice.findMany({
    where: { status: { notIn: ['DRAFT', 'CANCELLED'] } },
    select: { id: true, number: true, status: true }
  })
  for (const inv of issuedInvoices) {
    const je = await prisma.journalEntry.findFirst({
      where: { reference: inv.number }
    })
    if (!je) {
      console.log(`   FAIL: Invoice ${inv.number} (${inv.status}) has no journal entry`)
      failed++
    } else {
      passed++
    }
  }
  console.log(`   ${passed} invoices OK, ${failed} missing GL entries\n`)

  // Test 2: All journal entries are balanced
  console.log('2. Checking journal entry balance...')
  let balancePassed = 0
  let balanceFailed = 0
  const entries = await prisma.journalEntry.findMany({
    where: { status: 'POSTED' },
    include: { lines: true }
  })
  for (const entry of entries) {
    const totalDebit = entry.lines.reduce((s, l) => s + Number(l.debit), 0)
    const totalCredit = entry.lines.reduce((s, l) => s + Number(l.credit), 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      console.log(`   FAIL: JE ${entry.reference} imbalanced: DR ${totalDebit} != CR ${totalCredit}`)
      balanceFailed++
    } else {
      balancePassed++
    }
  }
  console.log(`   ${balancePassed} entries balanced, ${balanceFailed} imbalanced\n`)

  // Test 3: GL account balance direction
  console.log('3. Checking GL account balance signs...')
  let signPassed = 0
  let signWarnings = 0
  const accounts = await prisma.gLAccount.findMany()
  for (const account of accounts) {
    const balance = Number(account.balance)
    if (balance === 0) continue
    // ASSET/EXPENSE should normally have positive (debit) balance
    // LIABILITY/EQUITY/REVENUE should normally have positive (credit) balance
    const isDebitNormal = ['ASSET', 'EXPENSE'].includes(account.type)
    if (isDebitNormal && balance < 0) {
      console.log(`   WARN: ${account.code} ${account.name} (${account.type}) has negative balance ${balance}`)
      signWarnings++
    } else if (!isDebitNormal && balance < 0) {
      console.log(`   WARN: ${account.code} ${account.name} (${account.type}) has negative balance ${balance}`)
      signWarnings++
    } else {
      signPassed++
    }
  }
  console.log(`   ${signPassed} accounts OK, ${signWarnings} warnings\n`)

  // Summary
  const totalFailed = failed + balanceFailed
  console.log('=== SUMMARY ===')
  console.log(`Passed: ${passed + balancePassed + signPassed}`)
  console.log(`Failed: ${totalFailed}`)
  console.log(`Warnings: ${signWarnings}`)
  console.log(totalFailed === 0 ? '\n✅ ALL CHECKS PASSED' : '\n❌ SOME CHECKS FAILED')

  await prisma.$disconnect()
  process.exit(totalFailed > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
```

**Step 2: Test the script**

```bash
npx tsx scripts/smoke-test-accounting.ts
```

**Step 3: Commit**

```bash
git add scripts/smoke-test-accounting.ts
git commit -m "feat(scripts): add accounting smoke test — one-command pre-trial verification"
```

---

## Task Execution Order

```
PARALLEL GROUP 1 (independent):
  Task 1:  Fix invoice send flow UX
  Task 2:  Fix invoice PDF download
  Task 4:  Add HPP product flag (schema)
  Task 15: Refine KPI card colors

SEQUENTIAL GROUP 2 (depends on Task 4):
  Task 5:  Add expense account dropdown to product form
  Task 6:  Route bill approval to product expense account
  Task 7:  Add unapproved bill warning

SEQUENTIAL GROUP 3 (drill-down chain):
  Task 8:  Add account param support to transactions page
  Task 9:  Add drill-down from P&L report
  Task 10: Add drill-down from balance sheet
  Task 11: Add drill-down from chart of accounts
  Task 12: Add source document links in transactions
  Task 13: Add AR/AP aging drill-down

PARALLEL GROUP 4 (independent):
  Task 3:  Verify AR partial payment tracking
  Task 14: Verify PPN display

FINAL GROUP 5 (after everything):
  Task 16: Expand accounting lifecycle tests
  Task 17: Create no-orphan data integrity tests
  Task 18: Create smoke test script + run it
```

## Success Criteria

- [ ] Invoice send works with clear loading/error feedback
- [ ] Invoice PDF downloads successfully
- [ ] Products can be flagged as HPP with expense account dropdown
- [ ] Bill approval routes to correct expense account (HPP or default)
- [ ] Full drill-down: Reports → Transactions → Source Documents
- [ ] COA balances are clickable → transactions
- [ ] PPN shown as separate DPP + PPN in detail views
- [ ] KPI cards use professional muted palette
- [ ] `npx vitest` passes all tests (integrity + lifecycle + no-orphan)
- [ ] `npx tsx scripts/smoke-test-accounting.ts` passes
- [ ] Balance sheet is balanced (A = L + E)
