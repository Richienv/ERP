# Laporan Keuangan — Inline Drill-Down Design

## Goal

Add inline expand/collapse drill-down to P&L (Laba Rugi) and Balance Sheet (Neraca) line items, so users can see exactly which journal entries make up each number — with full traceability back to source documents.

## Problem

8 out of 10 financial reports show summary numbers without explaining where they come from. Only AR Aging and AP Aging have clickable drill-down. Users have no way to verify "Pendapatan Rp 600.000" without manually reviewing the GL journal.

## User

Indonesian textile SME owner/accountant viewing financial reports. They want to trust the numbers and quickly trace any amount to its source invoice, bill, payment, or journal entry.

## Design Decisions

- **Inline expand** (not side panel or page navigation) — matches AR/AP Aging pattern already in the app
- **Full detail per row** — date, reference, description, counterparty, journal entry number, GL account, debit/credit, link to source
- **Color-coded transaction type badges** — green for invoices, red for bills, blue for payments, gray for manual journals, amber for petty cash, purple for opening balances
- **Smooth animations** — framer-motion expand/collapse on detail rows, hover effects with subtle bg change + left accent bar
- **P&L and Neraca only** — other reports can adopt the same pattern later

## Architecture

### New Server Action

`getAccountDrillDown(accountCode: string, startDate: Date, endDate: Date)`

Located in `lib/actions/finance-gl.ts`. Queries:

```
JournalLine
  → JournalEntry (date, reference, description, status=POSTED)
    → Invoice? (number, customer.name, supplier.name)
    → Payment? (number, customer.name, supplier.name)
  → GLAccount (code, name)
WHERE accountId matches the GL account for accountCode
  AND entry.date BETWEEN startDate AND endDate
  AND entry.status = 'POSTED'
ORDER BY entry.date DESC
```

Returns:
```typescript
interface DrillDownRow {
  id: string              // JournalLine ID
  date: string            // ISO date
  reference: string       // Journal entry reference
  description: string     // Journal entry description
  counterparty: string    // Customer/vendor name (from invoice/payment relation)
  journalNumber: string   // Journal entry reference number
  accountCode: string     // GL account code
  accountName: string     // GL account name
  debit: number
  credit: number
  sourceType: 'INVOICE_AR' | 'INVOICE_AP' | 'PAYMENT' | 'JOURNAL' | 'PETTY_CASH' | 'OPENING'
  sourceUrl: string       // e.g., "/finance/invoices?highlight=xxx"
}
```

Source type detection logic:
- If `journalEntry.invoiceId` exists AND invoice.type = 'INV_OUT' → `INVOICE_AR`, url = `/finance/invoices?highlight={invoiceId}`
- If `journalEntry.invoiceId` exists AND invoice.type = 'INV_IN' → `INVOICE_AP`, url = `/finance/bills?highlight={invoiceId}`
- If `journalEntry.paymentId` exists → `PAYMENT`, url = `/finance/payments`
- If reference starts with 'OPENING' → `OPENING`, url = `/finance/opening-balances`
- If `journalEntry.pettyCashTransactionId` exists → `PETTY_CASH`, url = `/finance/petty-cash`
- Else → `JOURNAL`, url = `/finance/journal`

### Frontend Changes

**File:** `app/finance/reports/page.tsx`

Modify P&L and Balance Sheet panels to:

1. **Each account line item** gets:
   - Chevron icon (▶ collapsed, ▼ expanded)
   - `cursor-pointer` + hover effect (bg-zinc-50, left orange accent bar)
   - Transaction count badge when amount > 0 (e.g., `[3]` in zinc pill)
   - Click handler that toggles expand and fetches drill-down data

2. **Expanded detail section** (below the clicked row):
   - Loading spinner while fetching
   - Table with columns: Date | Type Badge | Reference | Description | Counterparty | Debit | Credit | Link
   - Rows animate in with `AnimatePresence` + stagger
   - Link column: arrow icon that navigates to sourceUrl via `router.push()`
   - Row hover: subtle bg change

3. **Color-coded type badges:**

| sourceType | Label | Badge Style |
|-----------|-------|-------------|
| INVOICE_AR | FAKTUR | `bg-emerald-100 text-emerald-700` |
| INVOICE_AP | TAGIHAN | `bg-red-100 text-red-700` |
| PAYMENT | BAYAR | `bg-blue-100 text-blue-700` |
| JOURNAL | JURNAL | `bg-zinc-100 text-zinc-600` |
| PETTY_CASH | PETTY | `bg-amber-100 text-amber-700` |
| OPENING | SALDO AWAL | `bg-purple-100 text-purple-700` |

### State Management

Per-account expand state stored as `Set<string>` (account codes currently expanded). When an account is expanded:
1. Check if drill-down data already cached in `Map<string, DrillDownRow[]>`
2. If not cached, fetch via `getAccountDrillDown()`
3. Cache result for session (no refetch on re-expand)

### Performance

- Drill-down data fetched **on demand** (not pre-loaded with the report)
- Cached per session in component state
- Only POSTED journal entries included
- Result limited to 100 rows per account (with "tampilkan semua" button if truncated)

## Scope

### In Scope
- P&L: all revenue/expense line items expandable
- Neraca: all asset/liability/equity line items expandable
- New server action `getAccountDrillDown()`
- Framer-motion animations for expand/collapse
- Color-coded type badges
- Clickable links to source documents

### Out of Scope
- Cash Flow, Equity Changes, Tax Report, Inventory Turnover drill-down (future)
- AR/AP Aging (already has drill-down)
- Export with drill-down data (future)
- Changing how report totals are calculated

## Files

| Action | File | Purpose |
|--------|------|---------|
| Modify | `lib/actions/finance-gl.ts` | Add `getAccountDrillDown()` server action |
| Modify | `app/finance/reports/page.tsx` | Add expand/collapse UI to P&L and Balance Sheet panels |
