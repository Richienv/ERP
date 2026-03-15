# Finance GL Integration — 7 Bug Fix Plan (v2 — post-review)

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 7 finance bugs (B-012 through B-018) where transaction modules don't create journal entries, causing COA/AR/AP/reports to show Rp0. Also fix search filter, asset category dropdown, and credit note invoice filter.

**Architecture:** Create a centralized `lib/gl-accounts.ts` with system account constants **aligned to the seed COA** and an `ensureSystemAccounts()` upsert function. Update ALL finance server actions (8 functions across 3 files) to use these constants instead of hardcoded strings. Fix the AR page import, ComboboxWithCreate search, petty cash bank dropdown, fixed asset category seeding, and DC note invoice + GL account lookups.

**Tech Stack:** Next.js server actions, Prisma, PostgreSQL, cmdk (Command component), React Query

**Source:** `FINANCE_BUGS_20260315.md` — Raymond's demo walkthrough, March 15 2026

---

## Root Cause Analysis

The master bug is an **account code mismatch** between the seed file and the server actions:

| Code Used in Server Actions | What It Should Map To | Seed-gl.ts Code | Problem |
|---|---|---|---|
| `1100` (AR) | Piutang Usaha | `1200` | Code doesn't exist → "Account code not found" |
| `1010` (Bank) | Bank BCA | `1110` | Code doesn't exist |
| `1330` (PPN Masukan) | Input VAT | Not seeded | Code doesn't exist |
| `2100` (AP credit) | Hutang Usaha | `2000` for AP, `2100` = Utang Gaji | Wrong account! Salary payable, not AP |
| `6000` (Expense) | Beban | Not in seed. In Raymond's DB: LIABILITY | Wrong type — balance direction inverted |

When `moveInvoiceToSent()` tries `accountCode: '1100'`, `postJournalEntry()` throws `"Account code not found: 1100"`, the invoice reverts to DRAFT, and no GL entry is created. This cascades: COA shows Rp0, AR shows 0 invoices, reports are empty.

**Fix strategy:** Align `SYS_ACCOUNTS` with the seed COA codes (1200 for AR, 1110 for Bank, 2000 for AP, 6900 for default expense). This avoids creating duplicate accounts in seeded databases.

**Affected functions (8 total across 3 files):**
1. `moveInvoiceToSent()` — `finance-invoices.ts`
2. `recordInvoicePayment()` — `finance-invoices.ts`
3. `approveVendorBill()` — `finance-ap.ts`
4. `recordVendorPayment()` — `finance-ap.ts` (line 481)
5. `recordMultiBillPayment()` — `finance-ap.ts` (line 614)
6. `approveAndPayBill()` — `finance-ap.ts` (lines 818, 838, 884-885)
7. `postDCNote()` — `finance-dcnotes.ts` (lines 458-477, uses findFirst with wrong startsWith)
8. `getDCNoteFormData()` — `finance-dcnotes.ts` (lines 219-251, AP query uses startsWith '2100')

---

## File Structure

| Action | File | Purpose |
|--------|------|---------|
| **Create** | `lib/gl-accounts.ts` | System account code constants + `ensureSystemAccounts()` |
| Modify | `lib/actions/finance-invoices.ts` | Fix `moveInvoiceToSent()` + `recordInvoicePayment()` — 2 functions |
| Modify | `lib/actions/finance-ap.ts` | Fix `approveVendorBill()` + `recordVendorPayment()` + `recordMultiBillPayment()` + `approveAndPayBill()` — 4 functions |
| Modify | `lib/actions/finance-dcnotes.ts` | Fix `postDCNote()` GL lookups + `getDCNoteFormData()` invoice filter + AP query |
| Modify | `hooks/use-ar-payments.ts` | Switch import from `finance.ts` → `finance-ar.ts` |
| Modify | `components/ui/combobox-with-create.tsx` | Search by code + name |
| Modify | `lib/actions/finance-petty-cash.ts` | Use system constants for bank defaults |
| Modify | `lib/actions/finance-fixed-assets.ts` | Auto-seed default categories |
| Modify | `prisma/seed-gl.ts` | Add missing `1330` PPN Masukan + `6900` Beban Lain-lain |

---

## Chunk 1: Foundation + Quick Wins

### Task 1: Create System Account Constants

**Files:**
- Create: `lib/gl-accounts.ts`

- [ ] **Step 1: Create `lib/gl-accounts.ts` with constants aligned to seed-gl.ts**

```typescript
// lib/gl-accounts.ts
// Centralized system GL account codes — ALL finance server actions MUST reference these.
// NEVER hardcode account codes as string literals elsewhere.
//
// These codes are ALIGNED with prisma/seed-gl.ts to avoid duplicate accounts.
// If you change a code here, update seed-gl.ts too.

import { prisma } from "@/lib/prisma"

/**
 * System account codes used across all finance modules.
 * These MUST exist in the database before any GL posting.
 * Call ensureSystemAccounts() to guarantee they exist.
 *
 * Code scheme follows Indonesian standard COA (PSAK):
 *   1xxx = Assets, 2xxx = Liabilities, 3xxx = Equity,
 *   4xxx = Revenue, 5xxx = COGS, 6xxx = Operating Expenses
 */
export const SYS_ACCOUNTS = {
  // --- Cash & Bank (aligned with seed-gl.ts) ---
  CASH:           "1000",  // Kas & Setara Kas
  BANK_BCA:       "1110",  // Bank BCA (seed: 1110)
  BANK_MANDIRI:   "1111",  // Bank Mandiri (seed: 1111)
  PETTY_CASH:     "1050",  // Kas Kecil (matches PETTY_CASH_ACCOUNT in finance-petty-cash.ts)

  // --- Receivables ---
  AR:             "1200",  // Piutang Usaha (seed: 1200)

  // --- Tax Assets ---
  PPN_MASUKAN:    "1330",  // PPN Masukan (Input VAT) — added to seed

  // --- Payables ---
  AP:             "2000",  // Hutang Usaha / Utang Usaha (seed: 2000)

  // --- Tax Liabilities ---
  PPN_KELUARAN:   "2110",  // Utang Pajak PPN/PPh (seed: 2110)

  // --- Deferred Revenue ---
  DEFERRED_REV:   "2121",  // Pendapatan Diterima Dimuka

  // --- Revenue ---
  REVENUE:        "4000",  // Pendapatan Penjualan (seed: 4000)

  // --- COGS ---
  COGS:           "5000",  // Beban Pokok Penjualan / HPP (seed: 5000)

  // --- Expenses ---
  EXPENSE_DEFAULT:"6900",  // Beban Lain-lain (generic expense for AP bills)
                           // NOT 6000 — Raymond's DB has 6000 as LIABILITY "Accrued Expenses"
  DEPRECIATION:   "6290",  // Beban Penyusutan (seed: 6290)

  // --- Accumulated Depreciation ---
  ACC_DEPRECIATION: "1590", // Akumulasi Penyusutan (seed: 1590)
} as const

/**
 * Full definitions for system accounts. Used by ensureSystemAccounts() to upsert.
 */
const SYSTEM_ACCOUNT_DEFS: { code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" }[] = [
  { code: SYS_ACCOUNTS.CASH,             name: "Kas & Setara Kas",              type: "ASSET" },
  { code: SYS_ACCOUNTS.PETTY_CASH,       name: "Kas Kecil (Petty Cash)",        type: "ASSET" },
  { code: SYS_ACCOUNTS.BANK_BCA,         name: "Bank BCA",                      type: "ASSET" },
  { code: SYS_ACCOUNTS.BANK_MANDIRI,     name: "Bank Mandiri",                  type: "ASSET" },
  { code: SYS_ACCOUNTS.AR,               name: "Piutang Usaha",                 type: "ASSET" },
  { code: SYS_ACCOUNTS.PPN_MASUKAN,      name: "PPN Masukan (Input VAT)",       type: "ASSET" },
  { code: SYS_ACCOUNTS.ACC_DEPRECIATION, name: "Akumulasi Penyusutan",          type: "ASSET" },
  { code: SYS_ACCOUNTS.AP,               name: "Utang Usaha (AP)",              type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPN_KELUARAN,     name: "Utang Pajak (PPN/PPh)",         type: "LIABILITY" },
  { code: SYS_ACCOUNTS.DEFERRED_REV,     name: "Pendapatan Diterima Dimuka",    type: "LIABILITY" },
  { code: SYS_ACCOUNTS.REVENUE,          name: "Pendapatan Penjualan",          type: "REVENUE" },
  { code: SYS_ACCOUNTS.COGS,             name: "Beban Pokok Penjualan (HPP)",   type: "EXPENSE" },
  { code: SYS_ACCOUNTS.EXPENSE_DEFAULT,  name: "Beban Lain-lain",              type: "EXPENSE" },
  { code: SYS_ACCOUNTS.DEPRECIATION,     name: "Beban Penyusutan",              type: "EXPENSE" },
]

let _ensured = false

/**
 * Ensures all system GL accounts exist in the database.
 * Uses upsert (create if missing, skip if exists).
 * Cached per process — in serverless (Vercel), resets on cold start (harmless, upserts are idempotent).
 */
export async function ensureSystemAccounts(): Promise<void> {
  if (_ensured) return
  try {
    for (const def of SYSTEM_ACCOUNT_DEFS) {
      await prisma.gLAccount.upsert({
        where: { code: def.code },
        create: { code: def.code, name: def.name, type: def.type, balance: 0 },
        update: {}, // Don't overwrite existing name/type — user may have customized
      })
    }
    _ensured = true
  } catch (error) {
    console.error("Failed to ensure system accounts:", error)
    // Don't cache failure — retry next time
  }
}

/**
 * Resolves a cash/bank account code based on payment method.
 * For TRANSFER/CHECK/GIRO, uses the provided bankAccountCode or defaults to Bank BCA.
 */
export function getCashAccountCode(method: string, bankAccountCode?: string): string {
  if (method === "CASH") return SYS_ACCOUNTS.CASH
  return bankAccountCode || SYS_ACCOUNTS.BANK_BCA
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit lib/gl-accounts.ts 2>&1 | head -5`
Expected: No errors (or only unrelated project-wide errors)

- [ ] **Step 3: Commit**

```bash
git add lib/gl-accounts.ts
git commit -m "feat(finance): add centralized GL account constants (lib/gl-accounts.ts)

SYS_ACCOUNTS defines all system-critical account codes, aligned with seed-gl.ts.
ensureSystemAccounts() upserts them to guarantee they exist before GL posting.
Prevents 'Account code not found' errors that caused B-012 through B-015.

Key codes: AR=1200, AP=2000, BANK_BCA=1110, EXPENSE=6900, PPN_MASUKAN=1330."
```

---

### Task 2: Fix ComboboxWithCreate Search (Bug 7a — B-018)

**Files:**
- Modify: `components/ui/combobox-with-create.tsx:163`

- [ ] **Step 1: Fix CommandItem value to include subtitle (code) in search**

In `components/ui/combobox-with-create.tsx`, line 163, change the `value` prop:

```typescript
// BEFORE (line 163):
value={option.label}

// AFTER:
value={option.subtitle ? `${option.subtitle} ${option.label}` : option.label}
```

This makes cmdk search both the account code (subtitle) AND the name (label). Typing "1200" will match "1200 Piutang Usaha". Typing "bank" will also match.

- [ ] **Step 2: Manually verify** (dev server must be running)

1. Go to Jurnal Umum → Buat Jurnal Baru
2. Click account dropdown → type "1" → should see all 1xxx accounts
3. Type "2" → should see 2xxx accounts
4. Type "bank" → should see Bank BCA, Bank Mandiri, etc.
5. Type "kas" → should see Kas Besar, Kas Kecil

- [ ] **Step 3: Commit**

```bash
git add components/ui/combobox-with-create.tsx
git commit -m "fix(ui): ComboboxWithCreate now searches by code AND name (B-018)

cmdk CommandItem.value was set to label only (name), so typing account
codes like '1200' found nothing. Now includes subtitle (code) in the
searchable value."
```

---

## Chunk 2: GL Posting Fixes (Bugs 1-4)

### Task 3: Fix moveInvoiceToSent GL Posting (Bug 1 — B-012)

**Files:**
- Modify: `lib/actions/finance-invoices.ts:807-843` (GL entry code)

- [ ] **Step 1: Add imports at top of file**

At the top of `lib/actions/finance-invoices.ts`, add:

```typescript
import { SYS_ACCOUNTS, ensureSystemAccounts, getCashAccountCode } from "@/lib/gl-accounts"
```

- [ ] **Step 2: Add ensureSystemAccounts() call before GL posting**

In `moveInvoiceToSent()`, at line 796 (just before the idempotency check), add:

```typescript
// Ensure system GL accounts exist before posting
await ensureSystemAccounts()
```

- [ ] **Step 3: Replace hardcoded account codes in AR invoice GL entry (lines 808-825)**

```typescript
// BEFORE:
if (txResult.type === 'INV_OUT') {
    const lines = [
        { accountCode: '1100', debit: txResult.totalAmount, credit: 0, description: `Piutang - ${txResult.customerName || 'Customer'}` },
    ]
    // ... '4000', '2110' ...

// AFTER:
if (txResult.type === 'INV_OUT') {
    const lines: { accountCode: string; debit: number; credit: number; description: string }[] = [
        { accountCode: SYS_ACCOUNTS.AR, debit: txResult.totalAmount, credit: 0, description: `Piutang - ${txResult.customerName || 'Customer'}` },
    ]
    if (txResult.taxAmount > 0) {
        lines.push({ accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: txResult.subtotal, description: `Pendapatan - ${txResult.number}` })
        lines.push({ accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: 0, credit: txResult.taxAmount, description: `PPN Keluaran - ${txResult.number}` })
    } else {
        lines.push({ accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: txResult.totalAmount, description: `Pendapatan - ${txResult.number}` })
    }
    await postJournalEntry({
        description: `Faktur Penjualan ${txResult.number} - ${txResult.customerName || 'Customer'}`,
        date: txResult.issueDate,
        reference: txResult.number,
        invoiceId: invoiceId,
        lines,
    })
}
```

- [ ] **Step 4: Replace hardcoded account codes in AP invoice GL entry (lines 826-843)**

```typescript
// AFTER:
} else {
    const lines: { accountCode: string; debit: number; credit: number; description: string }[] = []
    if (txResult.taxAmount > 0) {
        lines.push({ accountCode: SYS_ACCOUNTS.COGS, debit: txResult.subtotal, credit: 0, description: `HPP - ${txResult.number}` })
        lines.push({ accountCode: SYS_ACCOUNTS.PPN_MASUKAN, debit: txResult.taxAmount, credit: 0, description: `PPN Masukan - ${txResult.number}` })
    } else {
        lines.push({ accountCode: SYS_ACCOUNTS.COGS, debit: txResult.totalAmount, credit: 0, description: `HPP - ${txResult.number}` })
    }
    lines.push({ accountCode: SYS_ACCOUNTS.AP, debit: 0, credit: txResult.totalAmount, description: `Hutang - ${txResult.supplierName || 'Supplier'}` })
    await postJournalEntry({
        description: `Tagihan Pembelian ${txResult.number} - ${txResult.supplierName || 'Supplier'}`,
        date: txResult.issueDate,
        reference: txResult.number,
        invoiceId: invoiceId,
        lines,
    })
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/finance-invoices.ts
git commit -m "fix(finance): moveInvoiceToSent uses SYS_ACCOUNTS (B-012)

Replaces hardcoded '1100'→SYS_ACCOUNTS.AR(1200), '4000'→REVENUE,
'2110'→PPN_KELUARAN, '5000'→COGS, '1330'→PPN_MASUKAN, '2100'→AP(2000).
Calls ensureSystemAccounts() before GL posting."
```

---

### Task 4: Fix recordInvoicePayment GL Posting (Bug 1/2 supplemental)

**Files:**
- Modify: `lib/actions/finance-invoices.ts:916-946` (payment GL entry)

- [ ] **Step 1: Replace hardcoded account codes in recordInvoicePayment**

```typescript
// BEFORE (lines 916-946):
const cashAccountCode = data.paymentMethod === 'CASH' ? '1000' : '1010'
// ... '1100' for AR, '2100' for AP ...

// AFTER:
await ensureSystemAccounts()
const cashAccountCode = getCashAccountCode(data.paymentMethod)

let glResult: any
if (txResult.invoiceType === 'INV_OUT') {
    glResult = await postJournalEntry({
        description: `Penerimaan Pembayaran ${txResult.invoiceNumber} - ${txResult.customerName || 'Customer'}`,
        date: data.paymentDate,
        reference: `${txResult.paymentNumber} — ${txResult.invoiceNumber}`,
        invoiceId: data.invoiceId,
        lines: [
            { accountCode: cashAccountCode, debit: data.amount, credit: 0, description: `Terima dari ${txResult.customerName}` },
            { accountCode: SYS_ACCOUNTS.AR, debit: 0, credit: data.amount, description: `Pelunasan ${txResult.invoiceNumber}` }
        ]
    })
} else {
    glResult = await postJournalEntry({
        description: `Pembayaran Tagihan ${txResult.invoiceNumber} - ${txResult.supplierName || 'Supplier'}`,
        date: data.paymentDate,
        reference: `${txResult.paymentNumber} — ${txResult.invoiceNumber}`,
        invoiceId: data.invoiceId,
        lines: [
            { accountCode: SYS_ACCOUNTS.AP, debit: data.amount, credit: 0, description: `Pelunasan ${txResult.supplierName}` },
            { accountCode: cashAccountCode, debit: 0, credit: data.amount, description: `Bayar ${txResult.invoiceNumber}` }
        ]
    })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/finance-invoices.ts
git commit -m "fix(finance): recordInvoicePayment uses SYS_ACCOUNTS (B-012/B-013)

Replaces '1100'→AR(1200), '2100'→AP(2000), '1010'→BANK_BCA(1110)."
```

---

### Task 5: Fix ALL AP functions in finance-ap.ts (Bug 2 — B-013)

**Files:**
- Modify: `lib/actions/finance-ap.ts` — **4 functions** with hardcoded codes

**CRITICAL: The reviewer found 3 additional functions beyond `approveVendorBill` that use hardcoded codes. ALL must be fixed or AP payments will still fail.**

- [ ] **Step 1: Add imports at top of finance-ap.ts**

```typescript
import { SYS_ACCOUNTS, ensureSystemAccounts, getCashAccountCode } from "@/lib/gl-accounts"
```

- [ ] **Step 2: Fix approveVendorBill (lines 243-324)**

Replace the GL posting block. Key changes:
- `'6000'` → `SYS_ACCOUNTS.EXPENSE_DEFAULT` (line 262/267)
- `'1330'` → `SYS_ACCOUNTS.PPN_MASUKAN` (line 295/298)
- `'2100'` → `SYS_ACCOUNTS.AP` (line 309)
- Add `await ensureSystemAccounts()` before GL posting
- Add status revert to DRAFT on GL failure (was missing — bill stayed ISSUED without GL entry)

```typescript
            // 3. Post to General Ledger (Accrual Basis)
            await ensureSystemAccounts()

            const glLines: { accountCode: string; debit: number; credit: number; description: string }[] = []
            let totalAmount = 0

            for (const item of bill.items) {
                const amount = Number(item.amount)
                totalAmount += amount
                glLines.push({
                    accountCode: SYS_ACCOUNTS.EXPENSE_DEFAULT,
                    debit: amount,
                    credit: 0,
                    description: `${item.description} (Qty: ${item.quantity})`
                })
            }

            if (Number(bill.taxAmount) > 0) {
                glLines.push({
                    accountCode: SYS_ACCOUNTS.PPN_MASUKAN,
                    debit: Number(bill.taxAmount),
                    credit: 0,
                    description: `PPN Masukan - Bill ${bill.number}`
                })
                totalAmount += Number(bill.taxAmount)
            }

            glLines.push({
                accountCode: SYS_ACCOUNTS.AP,
                debit: 0,
                credit: totalAmount,
                description: `Hutang - ${bill.supplier?.name}`
            })

            const glResult = await postJournalEntry({
                description: `Bill Approval #${bill.number} - ${bill.supplier?.name}`,
                date: new Date(),
                reference: bill.number,
                invoiceId: billId,
                lines: glLines
            })
            if (!glResult?.success) {
                // Revert bill to DRAFT — don't leave ISSUED without GL entry
                try {
                    await prisma.invoice.update({
                        where: { id: billId },
                        data: { status: 'DRAFT' },
                    })
                } catch { /* revert best-effort */ }
                return { success: false, error: `Bill gagal diposting ke jurnal: ${(glResult as any)?.error || 'Akun GL tidak ditemukan'}. Status dikembalikan ke DRAFT.` }
            }
```

- [ ] **Step 3: Fix recordVendorPayment (line 470-484)**

```typescript
// BEFORE (line 470-484):
const bankCode = data.bankAccountCode || '1000'
// ...
{ accountCode: '2100', debit: data.amount, credit: 0, description: 'Hutang Usaha' },
{ accountCode: bankCode, debit: 0, credit: data.amount, description: bankAccountName }

// AFTER:
const bankCode = getCashAccountCode(data.method || 'TRANSFER', data.bankAccountCode)
// ...
{ accountCode: SYS_ACCOUNTS.AP, debit: data.amount, credit: 0, description: 'Hutang Usaha' },
{ accountCode: bankCode, debit: 0, credit: data.amount, description: bankAccountName }
```

- [ ] **Step 4: Fix recordMultiBillPayment (lines 608-616)**

```typescript
// BEFORE:
const bankCode = data.bankAccountCode || '1010'
// ...
{ accountCode: '2100', debit: totalAmount, credit: 0, description: 'Pelunasan Hutang Usaha' },
{ accountCode: bankCode, ...}

// AFTER:
const bankCode = getCashAccountCode(data.method || 'TRANSFER', data.bankAccountCode)
// ...
{ accountCode: SYS_ACCOUNTS.AP, debit: totalAmount, credit: 0, description: 'Pelunasan Hutang Usaha' },
{ accountCode: bankCode, ...}
```

- [ ] **Step 5: Fix approveAndPayBill (lines 810-890)**

This function has TWO GL postings — approval + payment. Fix ALL hardcoded codes:

```typescript
// Approval GL (lines 817-838):
// '5000' → SYS_ACCOUNTS.COGS
// '1330' → SYS_ACCOUNTS.PPN_MASUKAN
// '2100' → SYS_ACCOUNTS.AP

// Payment GL (lines 884-885):
// '2100' → SYS_ACCOUNTS.AP
// '1010' → SYS_ACCOUNTS.BANK_BCA (or getCashAccountCode)
```

Add `await ensureSystemAccounts()` at the start of this function (before the approval GL posting).

- [ ] **Step 6: Verify no remaining hardcoded account codes**

Run: `grep -n "'2100'\|'1100'\|'1010'\|'1330'" lib/actions/finance-ap.ts`
Expected: 0 matches

- [ ] **Step 7: Commit**

```bash
git add lib/actions/finance-ap.ts
git commit -m "fix(finance): ALL AP functions use SYS_ACCOUNTS (B-013)

Fixed 4 functions: approveVendorBill, recordVendorPayment,
recordMultiBillPayment, approveAndPayBill.
- '2100' → SYS_ACCOUNTS.AP (2000) — was hitting Utang Gaji, not AP
- '6000' → SYS_ACCOUNTS.EXPENSE_DEFAULT (6900) — avoids type conflict
- '1330' → SYS_ACCOUNTS.PPN_MASUKAN
- '5000' → SYS_ACCOUNTS.COGS
- '1010' → SYS_ACCOUNTS.BANK_BCA (1110)
- approveVendorBill now reverts to DRAFT on GL failure"
```

---

### Task 6: Fix AR Page Import (Bug 1 — B-012 frontend)

**Files:**
- Modify: `hooks/use-ar-payments.ts:5`

- [ ] **Step 1: Change import to use finance-ar.ts (correct implementation)**

The hook currently imports from `lib/actions/finance` which has a broken implementation using client-side filtering with a hard limit of 100 invoices. The correct implementation is in `lib/actions/finance-ar.ts` which does DB-level filtering.

```typescript
// BEFORE (line 5):
import { getARPaymentRegistry, getARPaymentStats } from "@/lib/actions/finance"

// AFTER:
import { getARPaymentRegistry, getARPaymentStats } from "@/lib/actions/finance-ar"
```

- [ ] **Step 2: Verify function signatures match**

Check that `finance-ar.ts`'s exports accept the same parameters the hook passes: `{ paymentsQ, invoicesQ, customerId, paymentPage, invoicePage, pageSize }`. Verify `ARRegistryQueryInput` type has these fields. Also verify `getARPaymentStats` exists in `finance-ar.ts`.

- [ ] **Step 3: Commit**

```bash
git add hooks/use-ar-payments.ts
git commit -m "fix(finance): AR page uses correct getARPaymentRegistry from finance-ar.ts (B-012)

The hook was importing from finance.ts which had a broken implementation:
client-side filtering with 100-invoice hard limit. The finance-ar.ts
version does proper DB-level filtering and pagination."
```

---

## Chunk 3: Data & Dropdown Fixes (Bugs 5-7)

### Task 7: Fix Petty Cash Bank Dropdown (Bug 7b — B-018)

**Files:**
- Modify: `lib/actions/finance-petty-cash.ts:265-300`

- [ ] **Step 1: Add static import at top of file**

```typescript
import { ensureSystemAccounts } from "@/lib/gl-accounts"
```

- [ ] **Step 2: Replace getBankAccounts implementation**

```typescript
// AFTER:
export async function getBankAccounts() {
    try {
        await requireAuth()

        // Ensure system cash/bank accounts exist (1000, 1110, 1111, etc.)
        await ensureSystemAccounts()

        // Return all ASSET accounts that are cash/bank (exclude petty cash itself)
        return await basePrisma.gLAccount.findMany({
            where: {
                type: "ASSET",
                code: { not: PETTY_CASH_ACCOUNT },
                OR: [
                    { code: { startsWith: "1" } },
                    { name: { contains: "Bank", mode: "insensitive" } },
                    { name: { contains: "Kas", mode: "insensitive" } },
                ],
            },
            orderBy: { code: "asc" },
            select: { code: true, name: true },
        })
    } catch (error) {
        console.error("getBankAccounts failed:", error)
        return []
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/actions/finance-petty-cash.ts
git commit -m "fix(finance): petty cash bank dropdown uses ensureSystemAccounts (B-018)

Replaces inline default account upserts with centralized ensureSystemAccounts().
Adds error logging instead of silent empty array return."
```

---

### Task 8: Seed Fixed Asset Categories (Bug 5 — B-016)

**Files:**
- Modify: `lib/actions/finance-fixed-assets.ts:65-84`

- [ ] **Step 1: Add cached auto-seeding to getFixedAssetCategories**

```typescript
let _categoriesSeeded = false

export async function getFixedAssetCategories() {
    try {
        return await withPrismaAuth(async (prisma) => {
            // Ensure default categories exist (cached per process)
            if (!_categoriesSeeded) {
                const defaults = [
                    { code: "FA-TAN", name: "Tanah", defaultUsefulLife: 0, defaultResidualPct: 100 },
                    { code: "FA-BNG", name: "Bangunan", defaultUsefulLife: 240, defaultResidualPct: 10 },
                    { code: "FA-KND", name: "Kendaraan", defaultUsefulLife: 96, defaultResidualPct: 10 },
                    { code: "FA-MSN", name: "Mesin & Peralatan", defaultUsefulLife: 96, defaultResidualPct: 5 },
                    { code: "FA-KMP", name: "Komputer & IT", defaultUsefulLife: 48, defaultResidualPct: 0 },
                    { code: "FA-FRN", name: "Furnitur & Inventaris", defaultUsefulLife: 48, defaultResidualPct: 5 },
                    { code: "FA-LIN", name: "Peralatan Kantor", defaultUsefulLife: 48, defaultResidualPct: 5 },
                ]
                for (const d of defaults) {
                    await prisma.fixedAssetCategory.upsert({
                        where: { code: d.code },
                        create: {
                            code: d.code,
                            name: d.name,
                            defaultMethod: "STRAIGHT_LINE",
                            defaultUsefulLife: d.defaultUsefulLife,
                            defaultResidualPct: d.defaultResidualPct,
                        },
                        update: {},
                    })
                }
                _categoriesSeeded = true
            }

            const categories = await prisma.fixedAssetCategory.findMany({
                include: {
                    assetAccount: { select: { id: true, code: true, name: true } },
                    accDepAccount: { select: { id: true, code: true, name: true } },
                    depExpAccount: { select: { id: true, code: true, name: true } },
                    gainLossAccount: { select: { id: true, code: true, name: true } },
                    _count: { select: { assets: true } },
                },
                orderBy: { code: "asc" },
            })
            return { success: true, categories }
        })
    } catch (error) {
        console.error("Failed to fetch fixed asset categories:", error)
        return { success: false, categories: [] }
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/actions/finance-fixed-assets.ts
git commit -m "fix(finance): auto-seed default fixed asset categories (B-016)

Adds 7 default Indonesian asset categories (Tanah, Bangunan, Kendaraan,
Mesin, Komputer, Furnitur, Peralatan Kantor) via upsert on first fetch.
Uses process-level cache to avoid repeated upserts."
```

---

### Task 9: Fix DC Note GL Lookups + Invoice Filter (Bug 6 — B-017)

**Files:**
- Modify: `lib/actions/finance-dcnotes.ts:180-260` (getDCNoteFormData)
- Modify: `lib/actions/finance-dcnotes.ts:452-477` (postDCNote GL account lookups)

**CRITICAL: The reviewer found that `postDCNote()` uses `findFirst({ startsWith: '2100' })` for AP lookup, which finds "Utang Gaji" (wrong account) instead of AP at code 2000. Also, `getDCNoteFormData()` AP query uses `startsWith: '2100'` — same wrong lookup.**

- [ ] **Step 1: Add import at top of file**

```typescript
import { SYS_ACCOUNTS, ensureSystemAccounts } from "@/lib/gl-accounts"
```

- [ ] **Step 2: Fix postDCNote GL account lookups (lines 452-477)**

Replace the `findFirst` calls that use wrong `startsWith` patterns:

```typescript
// BEFORE (lines 455-477):
const [revenueAccount, arAccount, apAccount, expenseAccount, ppnKeluaranAccount, ppnMasukanAccount] = await Promise.all([
    prisma.gLAccount.findFirst({ where: { type: 'REVENUE' }, orderBy: { code: 'asc' } }),
    prisma.gLAccount.findFirst({
        where: { type: 'ASSET', OR: [{ code: { startsWith: '1100' } }, { name: { contains: 'piutang', mode: 'insensitive' } }] },
        orderBy: { code: 'asc' },
    }),
    prisma.gLAccount.findFirst({
        where: { type: 'LIABILITY', OR: [{ code: { startsWith: '2100' } }, { name: { contains: 'hutang', mode: 'insensitive' } }] },
        orderBy: { code: 'asc' },
    }),
    prisma.gLAccount.findFirst({ where: { type: 'EXPENSE' }, orderBy: { code: 'asc' } }),
    prisma.gLAccount.findFirst({ where: { code: { startsWith: '2110' } }, orderBy: { code: 'asc' } }),
    prisma.gLAccount.findFirst({ where: { code: { startsWith: '1330' } }, orderBy: { code: 'asc' } }),
])

// AFTER:
await ensureSystemAccounts()
const [revenueAccount, arAccount, apAccount, expenseAccount, ppnKeluaranAccount, ppnMasukanAccount] = await Promise.all([
    prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.REVENUE } }),
    prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.AR } }),
    prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.AP } }),
    prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.EXPENSE_DEFAULT } }),
    prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.PPN_KELUARAN } }),
    prisma.gLAccount.findFirst({ where: { code: SYS_ACCOUNTS.PPN_MASUKAN } }),
])
```

- [ ] **Step 3: Fix getDCNoteFormData AP/AR account queries (lines 216-251)**

Replace the `startsWith` queries with exact code matches:

```typescript
// BEFORE (lines 216-251):
// AR accounts query: startsWith: '1100'
// AP accounts query: startsWith: '2100'
// PPN Keluaran query: startsWith: '2110'
// PPN Masukan query: startsWith: '1330'

// AFTER — use exact system codes:
basePrisma.gLAccount.findMany({
    where: {
        type: 'ASSET',
        OR: [
            { code: SYS_ACCOUNTS.AR },
            { name: { contains: 'piutang', mode: 'insensitive' } },
        ],
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
}),
basePrisma.gLAccount.findMany({
    where: {
        type: 'LIABILITY',
        OR: [
            { code: SYS_ACCOUNTS.AP },
            { name: { contains: 'utang usaha', mode: 'insensitive' } },
        ],
    },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
}),
```

Note: Changed `contains: 'hutang'` to `contains: 'utang usaha'` because the seed uses "Utang Usaha (AP)" (with 'U', not 'hutang'). The old query found "Utang Gaji" which also contains 'utang'.

- [ ] **Step 4: Add customerId/supplierId filter to getDCNoteFormData**

```typescript
// BEFORE (line 180):
export async function getDCNoteFormData() {

// AFTER:
export async function getDCNoteFormData(filters?: { customerId?: string; supplierId?: string }) {
```

Apply filters to the invoice queries:

```typescript
// In outstandingCustomerInvoices query (line ~253):
...(filters?.customerId ? { customerId: filters.customerId } : {}),

// In outstandingSupplierBills query:
...(filters?.supplierId ? { supplierId: filters.supplierId } : {}),
```

- [ ] **Step 5: Update the DC note create dialog to pass customerId**

The DC note create dialog is at `components/finance/dc-notes/create-dc-note-dialog.tsx` (or similar path in the credit-notes page). When the user selects a customer from the dropdown, the "Invoice Asal" dropdown should refetch with that customerId. Either:
- Split the invoice fetch into a separate query called on customer change
- Or pass customerId through the existing `useDCNoteFormData()` hook

- [ ] **Step 6: Commit**

```bash
git add lib/actions/finance-dcnotes.ts
git commit -m "fix(finance): DC Note uses SYS_ACCOUNTS + filters invoices by customer (B-017)

- postDCNote() GL lookups now use exact SYS_ACCOUNTS codes instead of
  findFirst with startsWith:'2100' (was finding Utang Gaji, not AP)
- getDCNoteFormData() AP query uses SYS_ACCOUNTS.AP instead of startsWith:'2100'
- getDCNoteFormData() now accepts customerId/supplierId filters for
  Invoice Asal dropdown"
```

---

### Task 10: Update seed-gl.ts to include missing accounts

**Files:**
- Modify: `prisma/seed-gl.ts:21-83`

**Note:** `seed-gl.ts` is DESTRUCTIVE — it deletes all GL data before seeding. Only run on fresh databases. The `ensureSystemAccounts()` function is the runtime fix.

- [ ] **Step 1: Add missing accounts to seed**

Add after line 32 (after `1320 WIP`):
```typescript
{ code: '1330', name: 'PPN Masukan (Input VAT)', type: 'ASSET', isSystem: true },
```

Add to the expenses section (after line 82, after `7900`):
```typescript
{ code: '6900', name: 'Beban Lain-lain', type: 'EXPENSE', isSystem: false },
```

Add to the liabilities section (after line 45, after `2120`):
```typescript
{ code: '2121', name: 'Pendapatan Diterima Dimuka', type: 'LIABILITY', isSystem: false },
```

- [ ] **Step 2: Commit**

```bash
git add prisma/seed-gl.ts
git commit -m "fix(finance): add missing system accounts to GL seed

Adds 1330 (PPN Masukan), 6900 (Beban Lain-lain), 2121 (Deferred Revenue)
to match SYS_ACCOUNTS in lib/gl-accounts.ts. Seed is destructive — only
for fresh databases. ensureSystemAccounts() handles existing databases."
```

---

## Chunk 4: Verification

### Task 11: End-to-End Verification

- [ ] **Step 1: Grep for any remaining hardcoded account codes across all finance actions**

```bash
grep -rn "'1100'\|'2100'\|'1010'" lib/actions/finance-*.ts hooks/use-ar-payments.ts
```
Expected: 0 matches (all replaced with SYS_ACCOUNTS)

- [ ] **Step 2: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Verify Bug 1 fix — Invoice → AR flow**

1. Go to Keuangan → Invoicing → create a new invoice → mark as TERKIRIM
2. Check: invoice status should be ISSUED (not reverted to DRAFT)
3. Go to Keuangan → Jurnal Umum → a journal entry should exist (DR 1200 Piutang Usaha, CR 4000 Pendapatan)
4. Go to Keuangan → Piutang Usaha (AR) → the invoice should appear with correct amount
5. Go to Keuangan → Chart of Accounts → account 1200 should show the invoice amount

- [ ] **Step 4: Verify Bug 2 fix — AP → COA flow**

1. Go to Keuangan → Tagihan → create a bill → approve it
2. Check: journal entry created (DR 6900 Beban Lain-lain, CR 2000 Hutang Usaha)
3. Go to COA → account 2000 should show the bill amount

- [ ] **Step 5: Verify Bug 3/4 fix — Reports**

1. Go to Keuangan → Laporan → Laba Rugi → should show revenue and expenses
2. Go to Neraca → should show AR and AP balances
3. Go to AR Aging → should list the outstanding invoice

- [ ] **Step 6: Verify Bug 5 fix — Fixed Asset category**

1. Go to Keuangan → Aset Tetap → Daftarkan Aset Tetap
2. Click "Pilih kategori" → should show 7 default categories

- [ ] **Step 7: Verify Bug 6 fix — DC Note invoice filter**

1. Go to Nota Kredit/Debit → Buat Nota Kredit
2. Select a customer → "Invoice Asal" should show only that customer's invoices

- [ ] **Step 8: Verify Bug 7 fix — Search filters**

1. Go to Jurnal Umum → Buat Jurnal Baru → type "1" in account search → should show all 1xxx accounts
2. Type "bank" → should show Bank BCA, Bank Mandiri, etc.
3. Go to Peti Kas → Top Up → "Dari Akun Bank" should show bank accounts

---

## Summary: What Each Bug Fix Does

| Bug | ID | Root Cause | Fix |
|-----|-----|-----------|-----|
| B-012 | Invoice → AR | Hardcoded '1100' doesn't exist (seed: 1200) + AR page uses broken import | SYS_ACCOUNTS.AR(1200) + switch to finance-ar.ts |
| B-013 | AP → COA | Hardcoded '2100' is Utang Gaji, not AP (seed: 2000) + no revert on GL fail + 3 more unfixed functions | SYS_ACCOUNTS.AP(2000) in all 4 functions + revert on fail |
| B-014 | COA Rp0 | No journal entries exist (all GL postings fail on missing accounts) | ensureSystemAccounts() guarantees accounts exist |
| B-015 | Reports empty | No journal entries → nothing to aggregate | Auto-fixed by B-012/B-013/B-014 |
| B-016 | Asset category | FixedAssetCategory table empty | Auto-seed 7 default categories with cache |
| B-017 | DC Note invoices | No customer filter + postDCNote uses startsWith:'2100' (wrong account) | SYS_ACCOUNTS in postDCNote + customerId filter |
| B-018 | Search + bank dropdown | cmdk only searches label + stale bank upserts | Include code in search value + ensureSystemAccounts |

## Functions Fixed (Complete List)

| # | Function | File | Codes Replaced |
|---|----------|------|---------------|
| 1 | `moveInvoiceToSent` | finance-invoices.ts | 1100→1200, 4000→4000, 2110→2110, 5000→5000, 1330→1330, 2100→2000 |
| 2 | `recordInvoicePayment` | finance-invoices.ts | 1100→1200, 2100→2000, 1010→1110, 1000→1000 |
| 3 | `approveVendorBill` | finance-ap.ts | 6000→6900, 1330→1330, 2100→2000 |
| 4 | `recordVendorPayment` | finance-ap.ts | 2100→2000, 1000→getCashAccountCode |
| 5 | `recordMultiBillPayment` | finance-ap.ts | 2100→2000, 1010→getCashAccountCode |
| 6 | `approveAndPayBill` | finance-ap.ts | 5000→5000, 1330→1330, 2100→2000, 1010→1110 |
| 7 | `postDCNote` | finance-dcnotes.ts | findFirst startsWith→exact SYS_ACCOUNTS codes |
| 8 | `getDCNoteFormData` | finance-dcnotes.ts | startsWith:'2100'→SYS_ACCOUNTS.AP, add customer filter |
