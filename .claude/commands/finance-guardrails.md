# Finance Guardrails — Mandatory Implementation Checklist

Run this checklist before and after implementing ANY finance feature in this ERP.
This prevents the recurring bugs: missing journal entries, hardcoded GL codes, broken reports, unbalanced books.

## Pre-Implementation: Answer These Questions

Before writing code, verify each item. If you can't answer YES to all, stop and fix first.

### 1. Double-Entry Bookkeeping

**Every money movement MUST create a balanced journal entry via `postJournalEntry()`.**

Does your transaction create a JE? Check the pattern:

| Transaction | Debit | Credit |
|-------------|-------|--------|
| Invoice sent (AR) | `SYS_ACCOUNTS.AR` | `SYS_ACCOUNTS.REVENUE` + `SYS_ACCOUNTS.PPN_KELUARAN` |
| Bill approved (AP) | Expense account + `SYS_ACCOUNTS.PPN_MASUKAN` | `SYS_ACCOUNTS.AP` |
| AR Payment received | Cash/Bank account | `SYS_ACCOUNTS.AR` |
| AP Payment made | `SYS_ACCOUNTS.AP` | Cash/Bank account |
| Credit Note (AR) | Revenue account | `SYS_ACCOUNTS.AR` |
| COGS on delivery | `SYS_ACCOUNTS.COGS` | `SYS_ACCOUNTS.INVENTORY_ASSET` |
| Petty Cash top-up | `SYS_ACCOUNTS.PETTY_CASH` | Cash/Bank account |
| Petty Cash disbursement | Expense account | `SYS_ACCOUNTS.PETTY_CASH` |
| Depreciation | `SYS_ACCOUNTS.DEPRECIATION` | `SYS_ACCOUNTS.ACC_DEPRECIATION` |
| Bank charges on AR | `SYS_ACCOUNTS.BANK_CHARGES` | Cash/Bank account |
| WHT on vendor payment | `SYS_ACCOUNTS.AP` | Cash/Bank + `SYS_ACCOUNTS.PPH23_PAYABLE` |
| Bad debt (direct) | `SYS_ACCOUNTS.BAD_DEBT_EXPENSE` | `SYS_ACCOUNTS.AR` |
| Bad debt (allowance) | `SYS_ACCOUNTS.ALLOWANCE_DOUBTFUL` | `SYS_ACCOUNTS.AR` |

**The bilateral rule**: Every debit MUST have a matching credit. Ask: "Where is the other side?"

### 2. GL Account References

**NEVER hardcode GL account codes as string literals.**

```typescript
// WRONG
const arCode = '1200'

// CORRECT
import { SYS_ACCOUNTS, ensureSystemAccounts } from '@/lib/gl-accounts'
await ensureSystemAccounts()
const arCode = SYS_ACCOUNTS.AR
```

If you need a new account:
1. Add constant to `SYS_ACCOUNTS` in `lib/gl-accounts.ts`
2. Add to `SYSTEM_ACCOUNT_DEFS` array with type
3. Add to `ensureSystemAccounts()` upsert
4. Add to `prisma/seed-gl.ts`

### 3. Atomic GL Posting

If journal entry posting fails, the document MUST revert to previous status:

```typescript
const prevStatus = document.status
await prisma.invoice.update({ data: { status: 'ISSUED' } })
const je = await postJournalEntry({ ... })
if (!je?.success) {
  await prisma.invoice.update({ data: { status: prevStatus } })
  return { success: false, error: 'GL posting gagal' }
}
```

### 4. Tax Rates — Use Constants from `lib/tax-rates.ts`

Never hardcode `* 0.11` or `* 0.22` inline. Use:

```typescript
import { TAX_RATES } from '@/lib/tax-rates'
const ppn = subtotal * TAX_RATES.PPN          // 11%
const pph = income * TAX_RATES.CORPORATE      // 22%
```

### 5. COGS Classification

COGS is NOT just account code `5000`. Proper detection:
- Code range `5000`-`5099` = COGS
- Name contains: `harga pokok`, `hpp`, `cost of goods`, `cogs`

Use the `isCOGSAccount()` helper from `lib/gl-accounts.ts`.

### 6. Cash Flow Categorization

When adding transactions that affect cash:
- **Operating**: Revenue/Expense contra, AR (12xx), AP (20xx-24xx), Inventory (13xx)
- **Investing**: Fixed Assets (15xx), Accumulated Depreciation
- **Financing**: Equity (3xxx), Long-term Loans (25xx+)

Working capital changes must use **period deltas** (end balance - beginning balance), not current totals.

## Post-Implementation Verification

After coding, verify ALL of these:

### A. Journal Entry Check
- [ ] Transaction creates a journal entry? Check `JournalEntry` table.
- [ ] Entry is balanced? `SUM(debit) === SUM(credit)` for the entry.
- [ ] GL account balances updated correctly?

### B. Report Impact Check
- [ ] **Laba Rugi**: Revenue/expense appears in correct category?
- [ ] **Neraca**: Assets = Liabilities + Equity still holds?
- [ ] **Arus Kas**: Cash movement categorized in correct activity?
- [ ] **Neraca Saldo**: Total debits = Total credits?

### C. AR/AP Check
- [ ] AR/AP aging shows correct outstanding balance?
- [ ] Payment reduces the outstanding amount?

### D. Failure Handling
- [ ] If GL posting fails, document reverts to previous status?
- [ ] No orphaned documents without journal entries?

### E. Run Tests
```bash
npx vitest run __tests__/finance/
```

## Quick Reference: SYS_ACCOUNTS

| Key | Code | Name |
|-----|------|------|
| CASH | 1000 | Kas & Setara Kas |
| BANK_BCA | 1110 | Bank BCA |
| AR | 1200 | Piutang Usaha |
| INVENTORY_ASSET | 1300 | Persediaan |
| PPN_MASUKAN | 1330 | PPN Masukan |
| AP | 2000 | Hutang Usaha |
| PPN_KELUARAN | 2110 | PPN Keluaran |
| REVENUE | 4000 | Pendapatan |
| COGS | 5000 | HPP |
| EXPENSE_DEFAULT | 6900 | Beban Lain-lain |
| BANK_CHARGES | 7200 | Beban Admin Bank |

Full list: `lib/gl-accounts.ts`
