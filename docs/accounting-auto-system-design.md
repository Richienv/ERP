# Automatic Accounting System Design

**Date:** 2026-03-27
**Prerequisite:** [Accounting Audit Report](./accounting-audit.md)
**Principle:** Every financial transaction MUST automatically generate complete, balanced double-entry journal entries in real-time. Zero manual reconciliation needed.

---

## 1. Core Architecture

### 1.1 Design Decision: Strengthen Existing Engine, Don't Replace It

Our audit shows that `postJournalEntry()` in `lib/actions/finance-gl.ts` is already a solid engine — it validates balance, blocks control account abuse, updates GL balances, and supports both standalone and in-transaction modes. **The problem is not the engine; it's that some code paths bypass it.**

The fix is two-fold:
1. **Plug the gaps** — make every code path that touches money go through `postJournalEntry()`
2. **Add a guardrail** — make it structurally impossible to update `GLAccount.balance` without a journal entry

### 1.2 New File: `lib/accounting-engine.ts`

A thin orchestration layer that wraps `postJournalEntry()` with transaction-type-aware templates. This is NOT a replacement — it's a convenience layer that modules call instead of hand-assembling journal lines.

```typescript
// lib/accounting-engine.ts

import { postJournalEntry } from "@/lib/actions/finance-gl"
import { SYS_ACCOUNTS, getCashAccountCode } from "@/lib/gl-accounts"
import { TAX_RATES } from "@/lib/tax-rates"

// ─── Types ───────────────────────────────────────────────────

export type TransactionType =
  // Sales & AR
  | "INVOICE_ISSUE_AR"        // Issue customer invoice
  | "INVOICE_COGS"            // COGS recognition on sales invoice
  | "AR_PAYMENT"              // Customer payment received
  | "AR_ADVANCE_PAYMENT"      // Customer advance (no invoice yet)
  | "AR_ADVANCE_MATCH"        // Match advance to invoice
  | "AR_CREDIT_NOTE"          // Sales credit note (reduces AR)
  | "AR_DEBIT_NOTE"           // Sales debit note (increases AR)
  | "AR_BAD_DEBT_PROVISION"   // Bad debt allowance
  | "AR_BAD_DEBT_WRITEOFF"    // Bad debt write-off (direct or allowance)
  | "AR_REFUND"               // Cash refund to customer
  // Purchasing & AP
  | "INVOICE_ISSUE_AP"        // Approve vendor bill
  | "INVOICE_ISSUE_AP_GRN"    // Approve vendor bill (goods already received)
  | "AP_PAYMENT"              // Pay vendor
  | "AP_GIRO_CLEARING"        // GIRO check clears
  | "PURCHASE_DEBIT_NOTE"     // Purchase debit note (reduces AP)
  | "PURCHASE_CREDIT_NOTE"    // Purchase credit note (increases AP)
  // Inventory
  | "GRN_ACCEPT"              // Goods received, inventory in
  | "INVENTORY_ADJUST_IN"     // Stock adjustment increase
  | "INVENTORY_ADJUST_OUT"    // Stock adjustment decrease
  | "INVENTORY_SCRAP"         // Inventory scrap/write-off
  | "INVENTORY_RETURN_IN"     // Sales return received back
  | "INVENTORY_RETURN_OUT"    // Purchase return sent back
  | "PRODUCTION_CONSUME"      // Raw material consumption
  | "PRODUCTION_OUTPUT"       // Finished goods from production
  // Payroll
  | "PAYROLL_ACCRUE"          // Accrue salary expense
  | "PAYROLL_PAY"             // Pay salaries
  | "PAYROLL_BPJS"            // BPJS employer contributions
  // Banking
  | "BANK_TRANSFER"           // Inter-bank transfer
  | "BANK_CHARGE"             // Bank service charges
  | "BANK_INTEREST"           // Interest income received
  // Petty Cash
  | "PETTY_CASH_TOPUP"        // Top up petty cash
  | "PETTY_CASH_DISBURSE"     // Petty cash disbursement
  // Fixed Assets
  | "DEPRECIATION"            // Monthly depreciation
  | "ASSET_DISPOSAL"          // Asset sale/disposal
  // Opening & Adjustments
  | "OPENING_BALANCE"         // Opening balance entry
  | "OPENING_INVOICE_AR"      // Opening AR invoice
  | "OPENING_INVOICE_AP"      // Opening AP invoice
  | "BALANCE_ADJUSTMENT"      // Adjusting entry (replaces direct balance set)

export interface AccountingInput {
  type: TransactionType
  date: Date
  reference: string
  description: string

  // Amounts — provide what applies to the transaction type
  amount?: number           // Primary amount
  subtotal?: number         // Before tax
  taxAmount?: number        // PPN amount
  totalAmount?: number      // After tax
  costAmount?: number       // For COGS
  whtAmount?: number        // Withholding tax amount

  // Account overrides — when default doesn't apply
  cashAccountCode?: string  // Override default bank account
  expenseAccountCode?: string
  revenueAccountCode?: string
  inventoryAccountCode?: string

  // Payment context
  paymentMethod?: string    // CASH, TRANSFER, CHECK, etc.
  bankAccountCode?: string  // Specific bank account

  // Linking
  invoiceId?: string
  paymentId?: string
  salesOrderId?: string
  purchaseOrderId?: string
  inventoryTransactionId?: string

  // Multi-line items (for itemized entries)
  items?: Array<{
    description?: string
    accountCode: string
    amount: number
  }>

  // Transaction client for atomicity
  txClient?: any
}

export interface AccountingResult {
  success: boolean
  journalEntryId?: string
  error?: string
}
```

### 1.3 Interface: `postTransaction()`

The single entry point that ALL modules call:

```typescript
export async function postTransaction(input: AccountingInput): Promise<AccountingResult> {
  const lines = buildJournalLines(input)

  return postJournalEntry({
    description: input.description,
    date: input.date,
    reference: input.reference,
    sourceDocumentType: input.type,
    invoiceId: input.invoiceId,
    paymentId: input.paymentId,
    lines,
  }, input.txClient)
}
```

### 1.4 How It Maps Transactions to Journal Templates

`buildJournalLines()` is a pure function — given a `TransactionType` and amounts, it returns the correct debit/credit lines. No database calls, no side effects. This makes it testable in isolation.

```typescript
function buildJournalLines(input: AccountingInput): JournalLine[] {
  switch (input.type) {
    case "INVOICE_ISSUE_AR":
      return templateInvoiceAR(input)
    case "AR_PAYMENT":
      return templateARPayment(input)
    // ... one function per transaction type
    default:
      throw new Error(`Unknown transaction type: ${input.type}`)
  }
}
```

Each template function is a small, focused function:

```typescript
function templateInvoiceAR(input: AccountingInput): JournalLine[] {
  const { subtotal = 0, taxAmount = 0, totalAmount = subtotal + taxAmount } = input
  const lines: JournalLine[] = [
    { accountCode: SYS_ACCOUNTS.AR, debit: totalAmount, credit: 0 },
    { accountCode: input.revenueAccountCode || SYS_ACCOUNTS.REVENUE, debit: 0, credit: subtotal },
  ]
  if (taxAmount > 0) {
    lines.push({ accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: 0, credit: taxAmount })
  }
  return lines
}
```

### 1.5 Atomicity Strategy

**Rule:** The journal entry and the business transaction MUST succeed or fail together. Three patterns, depending on context:

**Pattern A: Same Transaction (preferred)**
Pass the Prisma transaction client to `postTransaction()` via `txClient`. Both the business record and the journal entry are created in the same database transaction.

```typescript
await withPrismaAuth(async (tx) => {
  // 1. Create/update the business record
  await tx.invoice.update({ where: { id }, data: { status: "ISSUED" } })
  // 2. Post the journal entry in the SAME transaction
  const result = await postTransaction({ ...input, txClient: tx })
  if (!result.success) throw new Error(result.error)
})
```

**Pattern B: Sequential with Rollback (when Pattern A causes deadlocks)**
Some operations (like `recordInvoicePayment`) hit deadlocks with nested transactions. For these:
1. Business record in transaction A
2. Journal entry in transaction B
3. If B fails, rollback A manually

This pattern already exists but needs hardening — see Section 3.

**Pattern C: Outbox Queue (future improvement, not in scope now)**
For truly decoupled posting, write a `gl_posting_outbox` record in the same transaction as the business record, then process it asynchronously with guaranteed delivery. This is the gold standard but adds significant complexity.

### 1.6 Guardrail: Ban Direct Balance Updates

Add a lint rule and code review check:

```typescript
// lib/accounting-engine.ts — export a validation constant
export const BALANCE_UPDATE_BANNED_PATTERN =
  /gLAccount\.update.*balance.*increment|gLAccount\.update.*balance.*decrement|gl_accounts.*SET.*balance/
```

Additionally, refactor `postJournalEntry()` to be the ONLY function that calls `prisma.gLAccount.update({ data: { balance: ... } })`. Every other file should go through `postTransaction()` or `postJournalEntry()`.

---

## 2. Transaction-to-Journal Mapping

### 2.1 Sales & Revenue

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 1 | Issue customer invoice | `INVOICE_ISSUE_AR` | AR (1200) = totalAmount | Revenue (4000) = subtotal, PPN Keluaran (2110) = taxAmount | Revenue recognition per PSAK 72 |
| 2 | COGS on sales invoice | `INVOICE_COGS` | COGS (5000) = costAmount | Inventory (1300) = costAmount | Per item: qty × costPrice. Skip services. |
| 3 | Customer payment received | `AR_PAYMENT` | Bank (per method) = cashReceived, PPh Prepaid (1340) = whtAmount | AR (1200) = totalSettled | totalSettled = cashReceived + whtAmount |
| 4 | Customer advance payment | `AR_ADVANCE_PAYMENT` | Bank (per method) = amount | Deferred Revenue (2121) = amount | Per PSAK 72 — no revenue until delivery |
| 5 | Match advance to invoice | `AR_ADVANCE_MATCH` | Deferred Revenue (2121) = amount | AR (1200) = amount | Releases deferred revenue |
| 6 | Sales credit note | `AR_CREDIT_NOTE` | Revenue (4000) = subtotal, PPN Keluaran (2110) = taxAmount | AR (1200) = totalAmount | Reverses revenue, reduces AR |
| 7 | Sales debit note | `AR_DEBIT_NOTE` | AR (1200) = totalAmount | Revenue (4000) = subtotal, PPN Keluaran (2110) = taxAmount | Additional charge to customer |
| 8 | Bad debt provision | `AR_BAD_DEBT_PROVISION` | Bad Debt Expense (6500) = amount | Allowance Doubtful (1210) = amount | Allowance method step 1 |
| 9 | Bad debt write-off (direct) | `AR_BAD_DEBT_WRITEOFF` | Bad Debt Expense (6500) = amount | AR (1200) = amount | Direct method — hits P&L |
| 10 | Bad debt write-off (allowance) | `AR_BAD_DEBT_WRITEOFF` | Allowance Doubtful (1210) = amount | AR (1200) = amount | Allowance method — no P&L hit |
| 11 | Customer refund | `AR_REFUND` | AR (1200) = amount | Bank (per method) = amount | Cash returned to customer |

### 2.2 Purchasing & Expenses

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 12 | Approve vendor bill (direct purchase) | `INVOICE_ISSUE_AP` | Expense (6900) = subtotal, PPN Masukan (1330) = taxAmount | AP (2000) = totalAmount | No prior GRN |
| 13 | Approve vendor bill (goods received) | `INVOICE_ISSUE_AP_GRN` | GR/IR Clearing (2150) = subtotal, PPN Masukan (1330) = taxAmount | AP (2000) = totalAmount | Clears GR/IR suspense |
| 14 | Pay vendor (single bill) | `AP_PAYMENT` | AP (2000) = grossAmount | Bank (per method) = netAmount, PPh Payable (2220/2230) = whtAmount | netAmount = grossAmount - whtAmount |
| 15 | GIRO check clears | `AP_GIRO_CLEARING` | AP (2000) = amount | Bank (per method) = amount | Posted only when GIRO confirmed cleared |
| 16 | Purchase debit note (return to vendor) | `PURCHASE_DEBIT_NOTE` | AP (2000) = totalAmount | Expense (6900) = subtotal, PPN Masukan (1330) = taxAmount | Reduces what we owe vendor |
| 17 | Purchase credit note (vendor allowance) | `PURCHASE_CREDIT_NOTE` | Expense (6900) = subtotal, PPN Masukan (1330) = taxAmount | AP (2000) = totalAmount | Increases what we owe vendor |

### 2.3 Inventory

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 18 | GRN acceptance (goods received) | `GRN_ACCEPT` | Inventory (1300) = totalValue | GR/IR Clearing (2150) = totalValue | totalValue = qty × unitCost |
| 19 | Stock adjustment increase | `INVENTORY_ADJUST_IN` | Inventory (1300) = amount | Inv Adjustment (8300) = amount | Physical count > system |
| 20 | Stock adjustment decrease | `INVENTORY_ADJUST_OUT` | Inv Adjustment (8300) = amount | Inventory (1300) = amount | Physical count < system |
| 21 | Inventory scrap/write-off | `INVENTORY_SCRAP` | Loss/Write-off (8200) = amount | Inventory (1300) = amount | Damaged/expired goods |
| 22 | Sales return received | `INVENTORY_RETURN_IN` | Inventory (1300) = costAmount | COGS (5000) = costAmount | Reverses COGS |
| 23 | Purchase return sent | `INVENTORY_RETURN_OUT` | GR/IR Clearing (2150) = costAmount | Inventory (1300) = costAmount | Reduces inventory |
| 24 | Production material consumption | `PRODUCTION_CONSUME` | WIP (1320) = amount | Raw Materials (1310) = amount | BOM materials consumed |
| 25 | Production finished goods output | `PRODUCTION_OUTPUT` | Inventory (1300) = amount | WIP (1320) = amount | Finished goods into stock |

### 2.4 Payroll

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 26 | Accrue monthly payroll | `PAYROLL_ACCRUE` | Salary Expense (6100) = grossSalary | Salary Payable (2200) = netSalary, PPh 21 Payable (2310) = pph21, BPJS TK Payable (2320) = bpjsTK, BPJS Kes Payable (2330) = bpjsKes | Multi-line deductions |
| 27 | Pay salaries | `PAYROLL_PAY` | Salary Payable (2200) = netSalary | Bank (per method) = netSalary | Clears salary liability |
| 28 | Pay BPJS contributions | `PAYROLL_BPJS` | BPJS TK Payable (2320) = bpjsTK, BPJS Kes Payable (2330) = bpjsKes | Bank (per method) = total | Clears BPJS liabilities |

### 2.5 Banking

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 29 | Inter-bank transfer | `BANK_TRANSFER` | Bank Tujuan (destination) = amount | Bank Asal (source) = amount | Both accounts must exist |
| 30 | Bank service charges | `BANK_CHARGE` | Bank Charges (7200) = amount | Bank (source) = amount | Auto-posted during recon |
| 31 | Interest income | `BANK_INTEREST` | Bank (account) = amount | Interest Income (4400) = amount | Auto-posted during recon |

### 2.6 Petty Cash

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 32 | Top up petty cash | `PETTY_CASH_TOPUP` | Petty Cash (1050) = amount | Bank (source) = amount | Imprest system |
| 33 | Petty cash disbursement | `PETTY_CASH_DISBURSE` | Expense (per category) = amount | Petty Cash (1050) = amount | Expense account varies |

### 2.7 Fixed Assets

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 34 | Monthly depreciation | `DEPRECIATION` | Depreciation Expense (6290) = amount | Accumulated Depreciation (1590) = amount | Per asset category |
| 35 | Asset disposal/sale | `ASSET_DISPOSAL` | Bank = proceeds, Acc Depreciation = accDep, Loss (if any) | Asset account = originalCost, Gain (if any) | Complex multi-line |

### 2.8 Opening & Adjustments

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 36 | Opening balance | `OPENING_BALANCE` | Various (per account) | Various (per account) | Year-start entry. Uses Opening Equity (3900) as plug. |
| 37 | Opening AR invoice | `OPENING_INVOICE_AR` | AR (1200) = amount | Opening Equity (3900) = amount | Migration: existing receivables |
| 38 | Opening AP invoice | `OPENING_INVOICE_AP` | Opening Equity (3900) = amount | AP (2000) = amount | Migration: existing payables |
| 39 | Balance adjustment | `BALANCE_ADJUSTMENT` | Adjustment account = amount | Opening Equity (3900) = amount | Replaces direct balance overwrite |

### 2.9 Tax

Tax is embedded in the transactions above (PPN is a line item in invoice entries, PPh is a line item in payment entries). Standalone tax transactions:

| # | Transaction | Type Enum | Debit | Credit | Notes |
|---|------------|-----------|-------|--------|-------|
| 40 | PPN monthly payment | (manual journal) | PPN Keluaran (2110) = outputVAT, PPN Masukan (1330) = -inputVAT offset | Bank = netPayment, PPN Lebih Bayar (1410) = if overpaid | Netting of input vs output VAT |
| 41 | PPh deposit to tax office | (manual journal) | PPh Payable (2220) = amount | Bank = amount | Monthly PPh 23 deposit |

---

## 3. Implementation Plan

### Phase 1: Fix Critical Gaps (P0) — Causes Current Discrepancies

#### Fix 1: `createOpeningInvoices()` — Add Journal Entry

**File:** `lib/actions/finance-gl.ts`
**What to change:**
- Find the `createOpeningInvoices()` function (~line 1200+)
- Replace direct `prisma.gLAccount.update({ balance: { increment } })` calls with a call to `postJournalEntry()` (or the new `postTransaction()`)
- For AR opening invoices: DR AR (1200), CR Opening Equity (3900)
- For AP opening invoices: DR Opening Equity (3900), CR AP (2000)

```typescript
// BEFORE (broken):
await prisma.gLAccount.update({
  where: { id: arAccount.id },
  data: { balance: { increment: totalAmount } }
})

// AFTER (correct):
await postJournalEntry({
  description: `Saldo Awal Piutang — ${customerName}`,
  date: invoiceDate,
  reference: `OPENING-AR-${invoiceNumber}`,
  invoiceId: newInvoice.id,
  sourceDocumentType: "OPENING_INVOICE_AR",
  lines: [
    { accountCode: SYS_ACCOUNTS.AR, debit: totalAmount, credit: 0 },
    { accountCode: SYS_ACCOUNTS.OPENING_EQUITY, debit: 0, credit: totalAmount },
  ]
}, txClient)
```

**Priority:** CRITICAL
**Complexity:** Simple — replace ~10 lines of balance update with journal entry call
**Risk:** Must also create journal entries for EXISTING opening invoices that lack them (one-time backfill script)

#### Fix 2: `applyBalanceReconciliation()` — Replace With Adjusting Entry

**File:** `lib/actions/finance-gl.ts`
**What to change:**
- Find `applyBalanceReconciliation()` (~line 1400+)
- Instead of `balance: newBalance` (direct set), calculate the delta and create an adjusting journal entry
- Use Opening Equity (3900) as the contra account (standard for unexplained adjustments)

```typescript
// BEFORE (broken):
await tx.gLAccount.update({
  where: { id: row.accountId },
  data: { balance: row.newBalance }
})

// AFTER (correct):
const delta = row.newBalance - currentBalance
if (Math.abs(delta) > 0.01) {
  const isDebitNormal = ["ASSET", "EXPENSE"].includes(account.type)
  await postJournalEntry({
    description: `Penyesuaian Saldo — ${account.code} ${account.name}`,
    date: new Date(),
    reference: `ADJ-${account.code}-${Date.now()}`,
    sourceDocumentType: "BALANCE_ADJUSTMENT",
    lines: [
      {
        accountCode: account.code,
        debit: delta > 0 && isDebitNormal ? delta : delta < 0 && !isDebitNormal ? Math.abs(delta) : 0,
        credit: delta < 0 && isDebitNormal ? Math.abs(delta) : delta > 0 && !isDebitNormal ? delta : 0,
      },
      {
        accountCode: SYS_ACCOUNTS.OPENING_EQUITY,
        debit: /* opposite of above */,
        credit: /* opposite of above */,
      },
    ]
  }, tx)
}
```

**Priority:** CRITICAL
**Complexity:** Medium — need to correctly calculate debit/credit direction based on account type and delta sign
**Risk:** Low — this is only used manually, not in automated flows

#### Fix 3: `seed-gl.ts` — Create Journal Entry for Opening Balances

**File:** `prisma/seed-gl.ts`
**What to change:**
- Replace direct balance increment with a journal entry creation
- Use the same pattern as `postOpeningBalances()`

```typescript
// BEFORE (broken):
await glDelegate.update({
  where: { id: bankId },
  data: { balance: { increment: openingAmount } }
})

// AFTER (correct):
await prisma.journalEntry.create({
  data: {
    date: new Date(seedYear, 0, 1),
    description: "Saldo Awal (Seed)",
    reference: `OPENING-SEED-${seedYear}`,
    status: "POSTED",
    lines: {
      create: [
        { accountId: bankId, debit: openingAmount, credit: 0 },
        { accountId: capitalId, debit: 0, credit: openingAmount },
      ]
    }
  }
})
// Then update balances to match:
await glDelegate.update({ where: { id: bankId }, data: { balance: { increment: openingAmount } } })
await glDelegate.update({ where: { id: capitalId }, data: { balance: { increment: openingAmount } } })
```

**Priority:** CRITICAL
**Complexity:** Simple
**Risk:** Only affects fresh databases (seed is not run in production)

#### Fix 4: One-Time Backfill Script for Existing Discrepancies

**File:** `scripts/backfill-opening-journal-entries.ts` (NEW)
**What it does:**
1. Query all opening invoices that have no linked journal entry
2. For each, create the missing journal entry (DR AR/AP, CR Opening Equity)
3. Recompute ALL `GLAccount.balance` values from journal lines
4. Report before/after comparison

**Priority:** CRITICAL
**Complexity:** Medium
**Risk:** Must run in a maintenance window, takes a write lock on GL accounts

---

### Phase 2: Harden Existing Flows (P1) — Prevent Future Discrepancies

#### Fix 5: Make COGS Posting Blocking

**File:** `lib/actions/finance-invoices.ts` — inside `moveInvoiceToSent()`
**What to change:**
- Remove the try/catch that swallows COGS posting errors
- If COGS journal entry fails, revert invoice status to DRAFT (same as AR entry failure)

```typescript
// BEFORE:
try {
  await postJournalEntry(cogsEntry, txClient)
} catch (cogsError: any) {
  console.warn(`COGS journal failed...`) // ← swallowed!
}

// AFTER:
const cogsResult = await postJournalEntry(cogsEntry, txClient)
if (!cogsResult.success) {
  throw new Error(`COGS journal gagal: ${cogsResult.error}`)
  // This will cause the outer transaction to rollback, reverting invoice to DRAFT
}
```

**Priority:** HIGH
**Complexity:** Simple — remove try/catch, add error check
**Risk:** Invoices will fail to issue if COGS account doesn't exist. Need to ensure all products have valid costPrice and COGS account exists.

#### Fix 6: Make Inventory GL Posting Blocking

**File:** `lib/actions/inventory-gl.ts` — `postInventoryGLEntry()`
**What to change:**
- Remove the outer try/catch that silently eats errors
- Propagate the error to the caller (GRN acceptance, adjustment, scrap)
- The caller decides whether to block or queue

```typescript
// BEFORE:
export async function postInventoryGLEntry(tx: any, data: InventoryGLInput) {
  try {
    // ... create journal entry ...
  } catch (error) {
    console.error(`[inventory-gl] Failed to post GL entry...`) // ← silent!
  }
}

// AFTER:
export async function postInventoryGLEntry(tx: any, data: InventoryGLInput) {
  // ... create journal entry ...
  // Let errors propagate — caller handles them
}
```

**Then in `grn.ts` `acceptGRN()`:**
```typescript
// Wrap in try/catch that rolls back the GRN acceptance if GL fails
try {
  await postInventoryGLEntry(tx, glInput)
} catch (glError) {
  throw new Error(`GRN gagal: Jurnal GL tidak dapat dibuat — ${glError.message}`)
}
```

**Priority:** HIGH
**Complexity:** Simple
**Risk:** GRN acceptance will fail if GL account missing. Need to run `ensureSystemAccounts()` during system startup.

#### Fix 7: Harden Payment GL Posting (Outside-Transaction Pattern)

**File:** `lib/actions/finance-invoices.ts` — `recordInvoicePayment()`
**What to change:**
- Keep the two-phase pattern (payment record in tx A, GL in tx B) but add robust rollback
- Add a `gl_posting_status` field to the Payment model: `PENDING | POSTED | FAILED`
- On GL failure, mark payment as `gl_posting_status = FAILED` and alert

```typescript
// Phase 1: Create payment + update invoice (in transaction)
const payment = await withPrismaAuth(async (tx) => {
  const p = await tx.payment.create({ data: { ...paymentData, glPostingStatus: "PENDING" } })
  await tx.invoice.update({ where: { id: invoiceId }, data: { balanceDue: newBalance, status } })
  return p
})

// Phase 2: Post GL (outside transaction)
const glResult = await postTransaction({ type: "AR_PAYMENT", ...amounts, paymentId: payment.id })

if (glResult.success) {
  await prisma.payment.update({ where: { id: payment.id }, data: { glPostingStatus: "POSTED" } })
} else {
  // Rollback phase 1
  await prisma.payment.update({ where: { id: payment.id }, data: { glPostingStatus: "FAILED" } })
  await prisma.invoice.update({ where: { id: invoiceId }, data: { balanceDue: originalBalance, status: originalStatus } })
  throw new Error(`GL posting gagal, pembayaran dibatalkan: ${glResult.error}`)
}
```

**Priority:** HIGH
**Complexity:** Medium — needs schema change (add `glPostingStatus` field to Payment model)
**Risk:** Existing payments without the field need a migration default

---

### Phase 3: Create Accounting Engine (P1)

#### Fix 8: Create `lib/accounting-engine.ts`

**File:** `lib/accounting-engine.ts` (NEW)
**What it contains:**
- The `TransactionType` enum and `AccountingInput` interface (from Section 1.2)
- The `postTransaction()` function (from Section 1.3)
- The `buildJournalLines()` dispatcher (from Section 1.4)
- 39 template functions, one per transaction type (from Section 2)

**Priority:** HIGH
**Complexity:** Medium — mostly boilerplate, but each template must exactly match the current behavior in the existing server actions

**Migration strategy:** Don't rewrite existing server actions immediately. Instead:
1. Create the engine with all templates
2. Add comprehensive tests for each template (see Section 4)
3. Gradually migrate each server action to use `postTransaction()` instead of hand-assembling journal lines
4. Each migration is a small, reviewable PR

#### Fix 9: Migrate Existing Server Actions to Use Engine

**Files to migrate (in priority order):**

| # | Server Action File | Functions to Migrate | Complexity |
|---|-------------------|---------------------|------------|
| 1 | `lib/actions/finance-gl.ts` | `createOpeningInvoices()`, `applyBalanceReconciliation()` | Simple |
| 2 | `lib/actions/finance-invoices.ts` | `moveInvoiceToSent()`, `recordInvoicePayment()` | Medium |
| 3 | `lib/actions/finance-ar.ts` | `recordARPayment()`, `matchPaymentToInvoice()`, `writeOffBadDebt()`, `provisionBadDebt()`, `createCreditNote()` | Medium |
| 4 | `lib/actions/finance-ap.ts` | `approveVendorBill()`, `recordVendorPayment()`, `recordMultiBillPayment()`, `createPaymentVoucher()`, `processGIROClearing()` | Medium |
| 5 | `lib/actions/finance-dcnotes.ts` | `postDCNote()`, `voidDCNote()` | Simple |
| 6 | `lib/actions/inventory-gl.ts` | `postInventoryGLEntry()` | Simple |
| 7 | `lib/actions/grn.ts` | `acceptGRN()` GL portion | Simple |
| 8 | `lib/actions/finance-petty-cash.ts` | `topUpPettyCash()`, `disbursePettyCash()` | Simple |
| 9 | `lib/actions/finance-fixed-assets.ts` | `postDepreciationRun()`, `recordAssetMovement()`, `voidDepreciationEntry()` | Medium |
| 10 | `prisma/seed-gl.ts` | Opening balance seed | Simple |

**Priority:** HIGH (but can be done incrementally)
**Complexity:** Medium overall — each migration is Simple individually

---

### Phase 4: Guardrails & Monitoring (P2)

#### Fix 10: Add Balance Integrity Check

**File:** `lib/actions/finance-gl.ts` (add new function)
**What it does:**
- New function `checkBalanceIntegrity()` that compares `GLAccount.balance` vs computed-from-journal-lines for ALL accounts
- Returns list of discrepancies with account code, stored balance, computed balance, and delta
- Called by: (a) nightly cron job, (b) Trial Balance page load, (c) before closing a fiscal period

```typescript
export async function checkBalanceIntegrity(): Promise<{
  isClean: boolean
  discrepancies: Array<{
    accountCode: string
    accountName: string
    storedBalance: number
    computedBalance: number
    delta: number
  }>
}> {
  // Query: compare gl_accounts.balance vs SUM from journal_lines
  // Return any rows where abs(delta) > 0.01
}
```

**Priority:** MEDIUM
**Complexity:** Simple

#### Fix 11: Add GL Posting Failed Alert Queue

**File:** `lib/actions/finance-gl.ts` (modify `postJournalEntry()`)
**What to change:**
- On ANY GL posting failure, write to a `gl_posting_failures` table (new)
- Dashboard widget shows count of unresolved failures
- Schema: `{ id, transactionType, sourceFunction, errorMessage, inputData (JSON), resolvedAt, createdAt }`

**Priority:** MEDIUM
**Complexity:** Medium — needs new table + migration + dashboard widget

#### Fix 12: Lint Rule — Ban Direct Balance Updates

**File:** `.eslintrc.js` or custom ESLint plugin
**What it does:**
- Custom ESLint rule that flags any code matching `gLAccount.update` with `balance` in the data object, unless inside `postJournalEntryInner()` function
- Prevents future developers from bypassing the journal entry system

**Priority:** LOW
**Complexity:** Medium (custom ESLint rule)

---

## 4. Validation Strategy

### 4.1 Unit Tests for Journal Templates

**File:** `__tests__/accounting-engine.test.ts` (NEW)

Test each template function in isolation. Every test verifies:
1. Total debits === total credits (balanced)
2. Correct account codes used
3. Correct amounts assigned to debit vs credit sides

```typescript
describe("buildJournalLines", () => {
  describe("INVOICE_ISSUE_AR", () => {
    it("creates balanced entry: DR AR, CR Revenue + PPN", () => {
      const lines = buildJournalLines({
        type: "INVOICE_ISSUE_AR",
        subtotal: 1_000_000,
        taxAmount: 110_000,
        totalAmount: 1_110_000,
        // ...required fields
      })

      // Assert balance
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
      expect(totalDebit).toBe(totalCredit)

      // Assert accounts
      expect(lines).toContainEqual(
        expect.objectContaining({ accountCode: "1200", debit: 1_110_000, credit: 0 })
      )
      expect(lines).toContainEqual(
        expect.objectContaining({ accountCode: "4000", debit: 0, credit: 1_000_000 })
      )
      expect(lines).toContainEqual(
        expect.objectContaining({ accountCode: "2110", debit: 0, credit: 110_000 })
      )
    })

    it("omits PPN line when taxAmount is 0", () => {
      const lines = buildJournalLines({
        type: "INVOICE_ISSUE_AR",
        subtotal: 500_000,
        taxAmount: 0,
        totalAmount: 500_000,
      })
      expect(lines).toHaveLength(2) // AR + Revenue only
    })
  })

  // ... similar tests for all 39 transaction types
})
```

### 4.2 Integration Tests for End-to-End Flows

**File:** `__tests__/accounting-integration.test.ts` (NEW)

Test complete workflows against a test database:

```typescript
describe("Sales cycle: Invoice → Payment → Reconciliation", () => {
  it("produces zero selisih after full cycle", async () => {
    // 1. Create and issue invoice
    const invoice = await createCustomerInvoice(...)
    await moveInvoiceToSent(invoice.id)

    // 2. Verify AR entry exists
    const arEntries = await getJournalEntriesForInvoice(invoice.id)
    expect(arEntries).toHaveLength(1) // or 2 if COGS
    assertBalanced(arEntries[0])

    // 3. Record payment
    await recordARPayment({ invoiceId: invoice.id, amount: invoice.totalAmount, method: "TRANSFER" })

    // 4. Verify payment entry exists
    const payEntries = await getJournalEntriesForPayment(...)
    assertBalanced(payEntries[0])

    // 5. Check balance integrity — ZERO discrepancies
    const integrity = await checkBalanceIntegrity()
    expect(integrity.isClean).toBe(true)
    expect(integrity.discrepancies).toHaveLength(0)
  })
})

describe("Procurement cycle: PO → GRN → Bill → Payment", () => {
  it("GR/IR clearing nets to zero after bill approval", async () => {
    // 1. Accept GRN → DR Inventory, CR GR/IR
    // 2. Approve bill → DR GR/IR, CR AP
    // 3. Pay vendor → DR AP, CR Bank
    // 4. Check: GR/IR balance = 0, AP balance = 0 for this vendor
    // 5. Check balance integrity = clean
  })
})
```

### 4.3 Balance Assertion Helper

```typescript
function assertBalanced(journalEntry: JournalEntry & { lines: JournalLine[] }) {
  const totalDebit = journalEntry.lines.reduce((s, l) => s + Number(l.debit), 0)
  const totalCredit = journalEntry.lines.reduce((s, l) => s + Number(l.credit), 0)
  expect(Math.abs(totalDebit - totalCredit)).toBeLessThanOrEqual(0.01)
}
```

### 4.4 Trial Balance Verification Script

**File:** `scripts/verify-zero-selisih.ts` (NEW)

Run after deploying fixes to verify the system is clean:

```typescript
// 1. Run checkBalanceIntegrity()
// 2. If discrepancies found, list them
// 3. Exit with code 1 if any discrepancy > Rp 1

// Can be added to CI pipeline or run as post-deployment check
```

### 4.5 Regression Test: No Direct Balance Updates

**File:** `__tests__/no-direct-balance-update.test.ts` (NEW)

A grep-based test that scans the codebase for violations:

```typescript
describe("No direct GLAccount.balance updates outside postJournalEntry", () => {
  it("only postJournalEntryInner updates balance", async () => {
    const violations = await scanForDirectBalanceUpdates()
    // Allow: lib/actions/finance-gl.ts (postJournalEntryInner)
    // Allow: prisma/seed-gl.ts (after journal entry creation)
    // Deny: everything else
    expect(violations.filter(v => !isAllowlisted(v))).toHaveLength(0)
  })
})
```

### 4.6 Acceptance Criteria — "Zero Reconciliation"

The system is correct when ALL of these pass:

- [ ] `checkBalanceIntegrity()` returns `isClean: true` for all GL accounts
- [ ] Trial Balance page shows 0 accounts with "selisih"
- [ ] Every invoice (AR and AP) has at least one linked journal entry when status >= ISSUED
- [ ] Every payment has at least one linked journal entry
- [ ] Every GRN acceptance has a linked inventory GL journal entry
- [ ] `GLAccount.balance` for Bank BCA matches `SUM(debit) - SUM(credit)` from journal lines
- [ ] Opening invoices created via `createOpeningInvoices()` have journal entries
- [ ] "Rekonsiliasi Saldo" button creates adjusting journal entries (not direct balance sets)
- [ ] COGS posting failure blocks invoice issuance (does not silently fail)
- [ ] Inventory GL posting failure blocks GRN acceptance (does not silently fail)

---

## 5. Implementation Sequence

```
Week 1 — P0 Critical Fixes
├── Fix 1: createOpeningInvoices() → add postJournalEntry()
├── Fix 2: applyBalanceReconciliation() → create adjusting entry
├── Fix 3: seed-gl.ts → create opening journal entry
└── Fix 4: Backfill script for existing discrepancies

Week 2 — P1 Hardening
├── Fix 5: COGS posting → make blocking
├── Fix 6: Inventory GL → make blocking
├── Fix 7: Payment GL → add rollback + glPostingStatus
└── Fix 8: Create lib/accounting-engine.ts + tests

Week 3 — P1 Migration
├── Fix 9a: Migrate finance-gl.ts to use engine
├── Fix 9b: Migrate finance-invoices.ts
├── Fix 9c: Migrate finance-ar.ts
├── Fix 9d: Migrate finance-ap.ts
└── Fix 9e: Migrate remaining files

Week 4 — P2 Guardrails
├── Fix 10: Balance integrity check function
├── Fix 11: GL posting failure alert queue
├── Fix 12: ESLint rule for direct balance updates
└── Full regression test suite
```

---

## 6. Summary

The core principle is simple: **`GLAccount.balance` is a cache of `SUM(journal_lines)`**. If you update the cache without updating the source of truth (journal lines), they diverge. Our system already has a solid journal engine (`postJournalEntry`). The fix is:

1. **Plug 3 holes** where code bypasses the engine (opening invoices, balance reconciliation, seed script)
2. **Harden 3 flows** where GL posting can silently fail (COGS, inventory GL, payment GL)
3. **Create a convenience layer** (`lib/accounting-engine.ts`) that makes correct behavior the easy path
4. **Add guardrails** that make incorrect behavior structurally difficult (integrity checks, lint rules)

After these fixes, bank reconciliation becomes a **verification** step (confirming the system is correct) rather than a **correction** step (fixing missing entries). That is the definition of a properly automated accounting system.
