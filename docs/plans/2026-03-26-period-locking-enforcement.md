# Period Locking — Complete Enforcement

**Date:** 2026-03-26
**Status:** Approved
**Scope:** Low-risk, high-impact — no schema changes

## Problem

Period locking exists (`FiscalPeriod.isClosed`) and is enforced in `postJournalEntry()` and fixed asset depreciation, but **not** in AP/AR/invoice/payment/DCNote/petty cash mutations. A user can approve a bill or post a payment into a closed period — the GL posting will fail, but the document status changes anyway, leaving inconsistent state.

## Design

### 1. Shared helper: `lib/period-helpers.ts`

```typescript
export async function assertPeriodOpen(date: Date, prisma?: PrismaClient): Promise<void>
```

- Extracts year/month from date
- Looks up FiscalPeriod by `year_month` unique constraint
- If `isClosed === true`, throws descriptive error in Bahasa Indonesia
- If no FiscalPeriod record exists, allows the operation (period not yet created = open)
- Accepts optional prisma client for use inside transactions

### 2. Refactor `postJournalEntry()` to use helper

Replace the inline 10-line check (lines 152-161 of `finance-gl.ts`) with `await assertPeriodOpen(data.date, prisma)`.

### 3. Add checks to all financial mutation points

| File | Functions to guard | Where to add check |
|------|-------------------|-------------------|
| `finance-ap.ts` | `approveBill()`, `postBillPayment()` | Before GL posting |
| `finance-ar.ts` | `postInvoice()`, `receivePayment()` | Before GL posting |
| `finance-invoices.ts` | `sendInvoice()`, `markInvoicePaid()` | Before status change |
| Debit/credit notes server action | `postDebitCreditNote()` | Before GL posting |
| `finance-gl.ts` | `postJournalEntry()` (refactor) | Already exists, use helper |
| Fixed assets server action | Depreciation posting | Already exists, use helper |
| Petty cash server action | `createPettyCashTransaction()` | Before GL posting |

### 4. No schema changes

- FiscalPeriod model already has `isClosed`, `closedAt`, `closedBy`
- No new migration needed
- No FK from JournalEntry to FiscalPeriod (date-based lookup is sufficient and already the pattern)

## What this does NOT cover

- Multi-level lock dates (period vs fiscal year vs tax) — future enhancement
- User-role-based lock overrides (e.g., admin can still post) — future enhancement
- Automatic period creation — already handled by UI

## Success criteria

- Attempting to approve a bill / post a payment / send an invoice / post a DCNote / create petty cash transaction into a closed period throws a clear error
- `postJournalEntry()` uses the shared helper instead of inline code
- All existing tests still pass
