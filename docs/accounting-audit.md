# Accounting Flow Audit Report

**Date:** 2026-03-27
**Scope:** Full audit of double-entry bookkeeping integrity across all ERP modules
**Symptom:** Trial Balance (Neraca Saldo) shows 7 accounts with "selisih" (discrepancy) between stored balance and computed-from-journal-lines balance

---

## Executive Summary

The Trial Balance page compares two values for each GL account:
- **Saldo Tersimpan**: The `GLAccount.balance` field stored in the database
- **Saldo Seharusnya**: Recomputed as `SUM(debit) - SUM(credit)` from `JournalLine` records

When these diverge, it means **balance was updated without a corresponding journal entry**, or a journal entry was created but **balance was not updated**. Our audit found **3 critical root causes** and **4 secondary issues**.

---

## A. Transaction Flow Map

### 1. Sales Invoice Issuance (AR Recognition)

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Create invoice | `createCustomerInvoice()` / `createInvoiceFromSalesOrder()` | finance-invoices.ts | NONE (DRAFT only) |
| Issue invoice | `moveInvoiceToSent()` | finance-invoices.ts | **YES**: DR AR (1200), CR Revenue (4000), CR PPN Keluaran (2110) |
| COGS recognition | (auto, inside moveInvoiceToSent) | finance-invoices.ts | **YES** (non-blocking): DR COGS (5000), CR Inventory (1300) |

**Verdict:** PROPER, but COGS posting is non-blocking (failure only logged, not blocking).

### 2. Customer Payment (AR Payment)

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Record payment | `recordARPayment()` | finance-ar.ts | **YES**: DR Bank, CR AR (1200) |
| Record payment (alt) | `recordInvoicePayment()` | finance-invoices.ts | **YES**: DR Bank, CR AR (1200) |
| Advance payment | `recordARPayment()` (no invoiceId) | finance-ar.ts | **YES**: DR Bank, CR Deferred Revenue (2400) |
| Match advance to invoice | `matchPaymentToInvoice()` | finance-ar.ts | **YES**: DR Deferred Revenue (2400), CR AR (1200) |

**Verdict:** PROPER. All AR payment paths create journal entries.

### 3. Vendor Bill Approval (AP Recognition)

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Create bill from PO | `recordPendingBillFromPO()` | finance-invoices.ts | NONE (DRAFT only) |
| Issue/approve bill | `moveInvoiceToSent()` | finance-invoices.ts | **YES**: DR Expense/GR-IR, CR AP (2000) |
| Approve + pay (combined) | `approveAndPayBill()` | finance-ap.ts | **YES**: 2 entries (approval + payment) |

**Verdict:** PROPER. Bill approval creates journal entries.

### 4. Vendor Payment (AP Payment)

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Single bill payment | `recordVendorPayment()` | finance-ap.ts | **YES**: DR AP (2000), CR Bank, CR PPh if applicable |
| Multi-bill payment | `recordMultiBillPayment()` | finance-ap.ts | **YES**: Consolidated entry for all bills |
| Payment voucher (non-GIRO) | `createPaymentVoucher()` | finance-ap.ts | **YES**: Immediate GL posting |
| GIRO payment | `createPaymentVoucher(GIRO)` | finance-ap.ts | NONE until cleared |
| GIRO clearing | `processGIROClearing()` | finance-ap.ts | **YES**: DR AP, CR Bank |

**Verdict:** PROPER. All AP payment paths create journal entries.

### 5. GRN Acceptance (Inventory Receipt)

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Accept GRN | `acceptGRN()` | grn.ts | **YES** (fire-and-forget): DR Inventory (1300), CR GR/IR Clearing (2150) |

**Verdict:** WORKS but fire-and-forget. GL failure is logged, not blocking.

### 6. Petty Cash

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Top-up | `topUpPettyCash()` | finance-petty-cash.ts | **YES**: DR Petty Cash (1050), CR Bank |
| Disbursement | `disbursePettyCash()` | finance-petty-cash.ts | **YES**: DR Expense, CR Petty Cash (1050) |

**Verdict:** PROPER. Both atomic with GL.

### 7. Fixed Asset Depreciation

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Run depreciation | `postDepreciationRun()` | finance-fixed-assets.ts | **YES**: DR Depreciation Expense, CR Accumulated Depreciation |
| Asset disposal | `recordAssetMovement()` | finance-fixed-assets.ts | **YES**: Posts gain/loss GL entry |

**Verdict:** PROPER.

### 8. Inventory Adjustments

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Adjustment in/out | `postInventoryGLEntry()` | inventory-gl.ts | **YES** (fire-and-forget): DR/CR Inventory vs Adjustment account |
| Scrap/write-off | `postInventoryGLEntry()` | inventory-gl.ts | **YES** (fire-and-forget): DR Loss, CR Inventory |

**Verdict:** WORKS but fire-and-forget. Silent failure risk.

### 9. Debit/Credit Notes

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Create DC note | `createDCNote()` | finance-dcnotes.ts | NONE (DRAFT only) |
| Post DC note | `postDCNote()` | finance-dcnotes.ts | **YES**: Proper double-entry per type |
| Void DC note | `voidDCNote()` | finance-dcnotes.ts | **YES**: Creates reversal entry |

**Verdict:** PROPER.

### 10. Sales Returns

| Step | Function | File | GL Entry |
|------|----------|------|----------|
| Create return | `createSalesReturn()` | sales.ts | **YES**: DR Sales Returns (contra), CR AR + Inventory COGS reversal |

**Verdict:** PROPER.

---

## B. Missing Links Table

| Transaction Type | Trigger Point | Expected Journal Entries | Actually Created | Gap | Severity |
|-----------------|---------------|------------------------|-----------------|-----|----------|
| **Opening invoices** | `createOpeningInvoices()` in finance-gl.ts | DR AR/AP, CR Opening Equity | **NONE — only balance increment** | Balance updated without journal entry | **CRITICAL** |
| **Seed GL opening balance** | `seed-gl.ts` lines 173-181 | DR Bank, CR Capital | **NONE — only balance increment** | Balance updated without journal entry | **CRITICAL** |
| **Manual balance reconciliation** | `applyBalanceReconciliation()` in finance-gl.ts | Adjusting journal entry | **NONE — directly sets balance** | Balance overwritten without audit trail | **CRITICAL** |
| **COGS on invoice issue** | `moveInvoiceToSent()` catch block | DR COGS, CR Inventory | Created but **non-blocking** — failure only logged | COGS entry can silently fail | **HIGH** |
| **Inventory GL entries** | `postInventoryGLEntry()` | Various inventory pairs | Created but **fire-and-forget** — failure logged only | GL entry can silently fail | **HIGH** |
| **Payment GL posting** | `recordInvoicePayment()` | DR Bank, CR AR/AP | Created **outside transaction** | Window for inconsistency if GL fails after payment committed | **MEDIUM** |
| **Void depreciation** | `voidDepreciationEntry()` | Reversal journal entry | Balance reversed directly, journal voided separately | Minor mismatch risk | **LOW** |
| **Sales order cancellation** | `cancelSalesOrder()` | None needed (no prior GL) | NONE | Not a real gap — SO has no GL impact | **NONE** |
| **Stock transfers** | `transitionStockTransfer()` | None (intra-entity) | NONE (intentional) | Design decision, not a gap | **NONE** |

---

## C. Root Cause Analysis

### ROOT CAUSE 1: `createOpeningInvoices()` — Balance Update Without Journal Entry

**File:** `lib/actions/finance-gl.ts` ~lines 1225-1229

This function creates opening AR/AP invoices but updates `GLAccount.balance` directly via `{ increment: totalAmount }` **without creating any journal entry**. This is the most likely cause of the massive discrepancies visible in the screenshot:

- **Piutang Usaha (1200)**: Stored balance = -Rp 89M, Computed from journals = Rp 2.6M → Selisih = -Rp 92M
- **Pendapatan Diterima Dimuka (2121)**: Stored balance = Rp 209B, Computed from journals = Rp 0 → Selisih = Rp 209B

These numbers strongly suggest opening balances were loaded via `createOpeningInvoices()` which incremented balances without journal entries.

**Fix:** Create a proper opening balance journal entry (DR AR, CR Opening Balance Equity) inside `createOpeningInvoices()`.

### ROOT CAUSE 2: `seed-gl.ts` — Seed Script Sets Balances Without Journal Entries

**File:** `prisma/seed-gl.ts` lines 173-181

The seed script sets initial Bank and Capital balances via direct `balance: { increment }` without creating a corresponding journal entry. On a fresh database, this creates an immediate discrepancy.

**Fix:** Use `postOpeningBalances()` or create a journal entry in the seed script.

### ROOT CAUSE 3: `applyBalanceReconciliation()` — Self-Healing That Breaks Audit Trail

**File:** `lib/actions/finance-gl.ts` ~line 1406

The "Rekonsiliasi Saldo" button on the Trial Balance page calls this function, which directly sets `balance = newBalance` on GL accounts. This "fixes" the selisih but:
- Creates no journal entry to explain the adjustment
- Destroys the audit trail
- Masks the original problem instead of fixing it

**Fix:** Create an adjusting journal entry instead of directly setting the balance.

### SECONDARY CAUSE 4: Fire-and-Forget GL Posting

**Files:** `lib/actions/inventory-gl.ts`, `lib/actions/grn.ts`

Inventory GL entries (`postInventoryGLEntry()`) are posted in a try/catch that only logs errors. If the GL posting fails (e.g., missing GL account, connection timeout), the inventory transaction succeeds but the journal entry is never created. Over time, this accumulates discrepancies.

**Fix:** Make GL posting blocking for critical transactions (GRN acceptance, inventory adjustments). At minimum, create an alert/queue for failed GL postings.

### SECONDARY CAUSE 5: COGS Recognition Non-Blocking

**File:** `lib/actions/finance-invoices.ts` ~lines 1012-1015

When a sales invoice is issued, the AR recognition entry is blocking (failure reverts to DRAFT), but the COGS entry is wrapped in a try/catch that only warns. This means:
- Invoice posts successfully as ISSUED
- AR and Revenue are recognized in GL
- But COGS and Inventory adjustment may be missing

**Fix:** Make COGS posting blocking, or implement a retry queue.

### SECONDARY CAUSE 6: GL Posting Outside Transaction

**File:** `lib/actions/finance-invoices.ts` in `recordInvoicePayment()`

The payment record and invoice status update happen inside a Prisma transaction, but the GL posting happens **after** the transaction commits (to avoid nested transaction deadlocks). If GL posting fails:
- Payment record exists in DB
- Invoice status is already updated (PAID/PARTIAL)
- But no journal entry exists

Manual rollback code exists but is a best-effort pattern.

**Fix:** Either use a saga pattern with compensating transactions, or queue GL postings with guaranteed delivery.

---

## D. Account-Specific Discrepancy Analysis (from Screenshot)

| Account | Code | Stored Balance | Computed Balance | Selisih | Likely Cause |
|---------|------|---------------|-----------------|---------|--------------|
| Bank BCA | 1110 | -Rp 100,000 | Rp 209,440,129,153 | Rp 209,440,229,153 | Journal entries exist from payments but balance was never properly initialized or was reset |
| Piutang Usaha | 1200 | -Rp 89,474,721 | Rp 2,625,400 | -Rp 92,100,121 | Opening invoices loaded via `createOpeningInvoices()` without journal entries |
| Utang Usaha (AP) | 2000 | -Rp 77,000 | Rp 77,000 | -Rp 154,000 | Opening AP invoices without journal entries |
| Utang Pajak (PPN/PPh) | 2110 | -Rp 97,900 | Rp 97,900 | -Rp 195,800 | Tax amounts from opening invoices without journal entries |
| Pendapatan Diterima Dimuka | 2121 | Rp 209,348,129,032 | Rp 0 | Rp 209,348,129,032 | Massive direct balance update with NO journal entry — likely advance payment or opening balance loaded incorrectly |
| Pendapatan Penjualan | 4000 | Rp 72,500 | Rp 3,127,500 | -Rp 3,055,000 | Revenue recognized in journal entries but balance field not fully updated |
| Bank CIMB Niaga | BARU | Rp 90,000 | Rp 0 | Rp 90,000 | New bank account with manually set balance, no journal entry |

---

## E. Complete Transaction → Journal Entry Map

### Transactions That PROPERLY Create Journal Entries

| Transaction | Function | Debit | Credit |
|-------------|----------|-------|--------|
| Issue sales invoice | `moveInvoiceToSent()` (INV_OUT) | AR (1200) | Revenue (4000) + PPN Keluaran (2110) |
| COGS recognition | `moveInvoiceToSent()` (auto) | COGS (5000) | Inventory (1300) |
| Issue vendor bill | `moveInvoiceToSent()` (INV_IN) | Expense (6900) or GR/IR (2150) + PPN Masukan (1330) | AP (2000) |
| Customer payment | `recordARPayment()` | Bank + PPh Prepaid (if withheld) | AR (1200) |
| Advance payment | `recordARPayment()` (no invoice) | Bank | Deferred Revenue (2400) |
| Match advance | `matchPaymentToInvoice()` | Deferred Revenue (2400) | AR (1200) |
| Vendor payment | `recordVendorPayment()` | AP (2000) | Bank + PPh Payable (if withheld) |
| Multi-bill payment | `recordMultiBillPayment()` | AP (2000) | Bank + PPh Payable |
| Payment voucher | `createPaymentVoucher()` | AP (2000) | Bank |
| GIRO clearing | `processGIROClearing()` | AP (2000) | Bank |
| GRN acceptance | `acceptGRN()` → `postInventoryGLEntry()` | Inventory (1300) | GR/IR Clearing (2150) |
| Petty cash top-up | `topUpPettyCash()` | Petty Cash (1050) | Bank |
| Petty cash disbursement | `disbursePettyCash()` | Expense account | Petty Cash (1050) |
| Depreciation | `postDepreciationRun()` | Depreciation Expense | Accumulated Depreciation |
| Asset disposal | `recordAssetMovement()` | Gain/Loss account | Asset account |
| Bad debt provision | `provisionBadDebt()` | Bad Debt Expense (6500) | Allowance (1210) |
| Bad debt write-off (direct) | `writeOffBadDebt(DIRECT)` | Bad Debt Expense (6500) | AR (1200) |
| Bad debt write-off (allowance) | `writeOffBadDebt(ALLOWANCE)` | Allowance (1210) | AR (1200) |
| Sales credit note | `postDCNote(SALES_CN)` | Revenue (4000) + PPN (2110) | AR (1200) |
| Sales debit note | `postDCNote(SALES_DN)` | AR (1200) | Revenue (4000) + PPN (2110) |
| Purchase debit note | `postDCNote(PURCHASE_DN)` | AP (2000) | Expense (6900) + PPN (1330) |
| Purchase credit note | `postDCNote(PURCHASE_CN)` | Expense (6900) + PPN (1330) | AP (2000) |
| Sales return | `createSalesReturn()` | Sales Returns (4010) + PPN (2110) | AR (1200) |
| Inventory adjustment in | `postInventoryGLEntry(ADJUSTMENT_IN)` | Inventory (1300) | Inv Adjustment (8300) |
| Inventory adjustment out | `postInventoryGLEntry(ADJUSTMENT_OUT)` | Inv Adjustment (8300) | Inventory (1300) |
| Inventory scrap | `postInventoryGLEntry(SCRAP)` | Loss/Write-off (8200) | Inventory (1300) |
| Journal entry reversal | `reverseJournalEntry()` | Swapped original credits | Swapped original debits |

### Transactions That DO NOT Create Journal Entries (GAPS)

| Transaction | Function | What Happens | What Should Happen |
|-------------|----------|-------------|-------------------|
| **Opening invoices** | `createOpeningInvoices()` | Balance incremented directly | Should create opening balance journal entry |
| **Seed GL balances** | `seed-gl.ts` | Balance incremented directly | Should create opening balance journal entry |
| **Balance reconciliation** | `applyBalanceReconciliation()` | Balance set directly | Should create adjusting journal entry |
| **New bank account with balance** | Manual/UI | Balance set on creation | Should create opening balance journal entry |

---

## F. Recommended Fix Priority

### P0 — Fix Immediately (Causes Current Discrepancies)

1. **`createOpeningInvoices()`**: Add `postJournalEntry()` call with proper opening balance entries
2. **`applyBalanceReconciliation()`**: Replace direct balance set with adjusting journal entry creation
3. **`seed-gl.ts`**: Create journal entry for opening balances instead of direct increment

### P1 — Fix Soon (Prevents Future Discrepancies)

4. **Make COGS posting blocking**: In `moveInvoiceToSent()`, make COGS journal entry failure revert invoice to DRAFT
5. **Make inventory GL posting blocking**: In `postInventoryGLEntry()`, throw error instead of catching silently for critical transactions (GRN, adjustments)
6. **Implement GL posting queue**: For `recordInvoicePayment()` and other functions that post GL outside transaction, add a retry queue

### P2 — Improve Resilience

7. **Add periodic reconciliation job**: Compare `GLAccount.balance` vs computed-from-journal-lines, alert on discrepancies
8. **Add GL posting audit log**: Track all GL posting attempts (success/failure) with full context
9. **Add idempotency checks**: Prevent duplicate journal entries across all posting functions (some already have this)

---

## G. Architecture Recommendation

The current architecture has a fundamental tension: **GL balance is denormalized** (stored on `GLAccount.balance` AND derivable from `JournalLine` records). This is fine for performance, but requires **absolute discipline** that every balance change goes through `postJournalEntry()`.

**Option A (Recommended):** Keep denormalized balance but add a database trigger or application-level middleware that **prevents any `GLAccount.balance` update that doesn't originate from `postJournalEntry()`**. This is the safest approach.

**Option B:** Remove `GLAccount.balance` field entirely and always compute from journal lines. This eliminates discrepancies by design but may impact query performance for reports. Can be mitigated with materialized views or periodic recomputation.

**Option C:** Add a nightly reconciliation job that recomputes all balances from journal lines and overwrites `GLAccount.balance`. This is a band-aid but prevents long-term drift.
