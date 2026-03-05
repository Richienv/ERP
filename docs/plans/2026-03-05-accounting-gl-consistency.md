# Accounting GL Consistency & Revenue Recognition Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the ~Rp 98M gap between P&L revenue (journal-based) and invoice revenue, ensure all business events post correct GL entries per Indonesian accounting standards, and apply proper accounting terminology.

**Architecture:** Every financial event (invoice, payment, petty cash, etc.) must create a POSTED journal entry with balanced debits/credits. The P&L and Trial Balance read from these journal entries. If journal entries are missing, the reports are wrong.

**Tech Stack:** Prisma + existing `postJournalEntry()` from `lib/actions/finance-gl.ts`

**Reference:** `docs/erp_accounting_scenarios.json` — canonical COA and transaction scenarios

---

## Root Cause Analysis

The KPI strip shows:
- Pendapatan (from invoices): Rp 1,248,943,383
- P&L Revenue (from GL journal entries): Rp 1,150,135,883
- Gap: ~Rp 98M = invoices that exist WITHOUT corresponding journal entries

This happens because invoice creation doesn't always trigger GL posting. Some invoices may have been seeded or created through paths that skip `postJournalEntry()`.

## Accounting Standards Applied

Per `erp_accounting_scenarios.json` and Indonesian PSAK:

### Revenue Recognition (Accrual Basis)
- **S01 Cash Sale:** DR Cash (1-1000), CR Revenue (4-1000) + CR PPN Keluaran (2-1100)
- **S02 Credit Sale:** DR Piutang (1-1100), CR Revenue (4-1000) + CR PPN Keluaran (2-1100)
- **S03 Down Payment (DP):** DR Bank (1-1010), CR Unearned Revenue/DP (2-1210) + CR PPN — NOT revenue until delivered
- **S04 DP → Revenue:** When goods delivered: DR Unearned Revenue (2-1210), CR Revenue (4-1000)

### Key Principle
Revenue is recognized when:
1. Invoice is ISSUED (not DRAFT) — for credit sales
2. Payment received — for cash sales
3. Goods delivered — for down payments (deferred → earned)

Piutang = total invoices issued - payments received. Always <= Revenue.

---

### Task 1: Audit & Fix Missing GL Entries for Existing Invoices

**Files:**
- Create: `scripts/fix-missing-invoice-gl.ts`
- Read: `lib/actions/finance-gl.ts` (postJournalEntry)

**Step 1: Write audit script to find invoices without journal entries**

```typescript
// scripts/fix-missing-invoice-gl.ts
// Find all INV_OUT invoices (non-DRAFT, non-CANCELLED) that don't have
// a corresponding journal entry with reference matching the invoice number.
// For each missing one, create the proper GL entry:
//   DR 1100 Piutang Usaha (totalAmount)
//   CR 4000 Pendapatan Penjualan (subtotal)
//   CR 2110 PPN Keluaran (taxAmount) — if tax > 0
```

**Step 2: Run script to fix existing data**

Run: `npx tsx scripts/fix-missing-invoice-gl.ts`

**Step 3: Verify P&L revenue now matches invoice revenue**

After fixing, the gap should be zero or near-zero.

---

### Task 2: Ensure Invoice Status Changes Always Post GL

**Files:**
- Modify: `lib/actions/finance-invoices.ts`
- Read: `lib/actions/finance-gl.ts`

When an invoice transitions from DRAFT → ISSUED:
- **INV_OUT (AR):** DR Piutang (1100), CR Pendapatan (4000) + CR PPN Keluaran (2110 if tax > 0)
- **INV_IN (AP):** DR Beban/Inventory + DR PPN Masukan (1330), CR Hutang (2100)

**Step 1: Find the invoice status change function**

Look for where invoice status changes to ISSUED/SENT and ensure GL posting happens.

**Step 2: Add GL posting if missing**

Use `postJournalEntry()` with proper account codes per scenario S02 (credit sale).

**Step 3: Ensure idempotency**

Check if a journal entry already exists for this invoice before posting (prevent duplicates).

---

### Task 3: Fix P&L to Use Consistent Revenue Source

**Files:**
- Modify: `hooks/use-finance-reports.ts`
- Modify: `lib/actions/finance.ts` (getProfitLossStatement)

**Step 1: Remove the `Math.max` hack from KPI**

The `Math.max(revenue, arOutstanding)` was a band-aid. Once Task 1 fixes the missing GL entries, the P&L revenue should naturally be >= AR. Remove the safety and let the numbers speak truth.

**Step 2: KPI Pendapatan should come from P&L (journal-based)**

After GL entries are fixed, P&L revenue = invoice revenue. Use one consistent source.

---

### Task 4: Standardize GL Account Codes per Accounting Scenarios Doc

**Files:**
- Modify: `lib/actions/finance-petty-cash.ts`
- Modify: `lib/actions/finance-invoices.ts`
- Modify: `lib/actions/finance-ar.ts`
- Modify: `lib/actions/finance-ap.ts`

Ensure all GL posting uses standard account codes from the scenarios doc:

| Code | Name | Type | Used For |
|------|------|------|----------|
| 1000 | Kas Besar (Cash on Hand) | ASSET | Cash sales, petty cash source |
| 1010 | Bank (IDR) | ASSET | Bank transfers, salary payments |
| 1050 | Kas Kecil (Petty Cash) | ASSET | Petty cash fund |
| 1100 | Piutang Usaha | ASSET | Accounts Receivable |
| 2100 | Hutang Usaha | LIABILITY | Accounts Payable |
| 2110 | PPN Keluaran | LIABILITY | Output VAT |
| 2120 | PPN Masukan | ASSET | Input VAT |
| 2121 | Pendapatan Diterima Dimuka (Unearned Revenue/DP) | LIABILITY | Customer down payments |
| 4000 | Pendapatan Penjualan | REVENUE | Sales revenue |
| 4010 | Pendapatan Jasa CMT | REVENUE | CMT service revenue |
| 5000 | Harga Pokok Penjualan (HPP) | EXPENSE | COGS |
| 5100+ | Beban Transportasi, etc. | EXPENSE | Operating expenses (petty cash) |
| 6xxx | Beban Operasional | EXPENSE | Operating expenses (payroll, etc.) |

**Step 1: Create/ensure these accounts exist via upsert**

Add an `ensureStandardAccounts()` function that upserts the core accounts.

**Step 2: Update all postJournalEntry calls to use correct codes**

Audit each module's GL posting to use the right account codes.

---

### Task 5: Add Deferred Revenue (Uang Muka / DP) Handling

**Files:**
- Modify: `lib/actions/finance-ar.ts` (payment receipt logic)
- Modify: `lib/actions/finance-invoices.ts`

When a customer pays BEFORE delivery (down payment):
1. Receipt: DR Bank (1010), CR Pendapatan Diterima Dimuka (2121) — NOT revenue yet
2. On delivery/invoice: DR Pendapatan Diterima Dimuka (2121), CR Pendapatan (4000) — NOW it's revenue

This ensures revenue is only recognized when earned (PSAK 72 / IFRS 15).

**Step 1: Check if DP handling exists in AR payment flow**
**Step 2: Add deferred revenue posting for advance payments**
**Step 3: Add revenue recognition when invoice is fulfilled**

---

### Task 6: Translate All Financial Report Labels to Bahasa Indonesia

**Files:**
- Modify: `app/finance/reports/page.tsx`

Remaining English labels → Bahasa Indonesia:
- "Net Income" → "Laba Bersih"
- "Tax Expense (PPh 22%)" → "Pajak Penghasilan (PPh 22%)"
- "Revenue" in export → "Pendapatan"
- Trial Balance headers
- Balance Sheet labels
- Cash Flow statement labels

---

## Execution Priority

1. **Task 1** (Critical) — Fix missing GL entries. This is the root cause of the revenue gap.
2. **Task 2** (Critical) — Prevent future gaps by ensuring invoice → GL posting.
3. **Task 3** (Quick) — Clean up KPI after Task 1 fixes the data.
4. **Task 4** (Important) — Standardize account codes for consistency.
5. **Task 5** (Enhancement) — Proper deferred revenue handling.
6. **Task 6** (Polish) — Full Bahasa Indonesia translation.

## Verification

After all tasks:
- P&L Pendapatan = sum of all ISSUED INV_OUT invoices in period ± adjustments
- Pendapatan >= Piutang Usaha (always)
- Trial Balance debits = credits (balanced)
- Every invoice has a corresponding journal entry
- Every payment has a corresponding journal entry
