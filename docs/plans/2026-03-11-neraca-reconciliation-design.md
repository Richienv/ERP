# Neraca Reconciliation & Tutup Buku — Design

**Date:** 2026-03-11
**Status:** Approved

## Problem
The balance sheet (neraca) can become unbalanced due to corrupted GL balance fields (e.g., seed data bugs, manual DB edits). Users see "Neraca tidak seimbang" but have no tools to diagnose or fix the issue. Additionally, there's no enforced closing workflow — fiscal periods can be closed but journal entries aren't blocked.

## Solution
Three interconnected features on the neraca page:

### 1. Trial Balance Diagnostic Panel
- Location: Below imbalance banner on `/finance/reports` (Neraca tab)
- Table columns: Kode Akun | Nama Akun | Tipe | Total Debit | Total Credit | Saldo Tersimpan | Saldo Seharusnya | Selisih
- Red highlight on rows where Selisih ≠ 0
- Summary row: Total Debit vs Total Credit
- Visible when neraca unbalanced OR user clicks "Lihat Neraca Saldo"
- Action button: "Rekonsiliasi Saldo"

### 2. Reconciliation Preview Dialog
- Shows only accounts where stored ≠ calculated balance
- Table: Akun | Saldo Lama | Saldo Baru | Selisih
- Warning: "Tindakan ini akan memperbarui saldo X akun berdasarkan jurnal aktual"
- Confirm: "Terapkan Koreksi"
- Server action: recalculate ALL GL balances from journal lines in single $transaction
- Creates audit log entry

### 3. Tutup Buku Workflow (Flexible)

**Monthly soft-close:**
- Close month → validate no DRAFT journals in that month
- Lock period: block new journal entries with dates in closed month
- Enforcement in `postJournalEntry()` (reject if period closed)
- No closing entries generated
- Can reopen if needed

**Year-end hard-close:**
- Pre-checks: all 12 months soft-closed + neraca balanced
- Preview closing journal (existing feature)
- Post closing entries: Revenue/Expense → Laba Ditahan
- Lock fiscal year (all 12 months)
- Audit log: who closed, when, journal reference

## Server Actions

### New
- `getTrialBalance(asOfDate?)` → all GL accounts with debit/credit totals + stored vs calculated balance
- `previewBalanceReconciliation()` → accounts with mismatched balances only
- `applyBalanceReconciliation()` → recalculate all GL balances from journal lines in $transaction + audit log
- `closeYearEnd(fiscalYear)` → validate all months closed + neraca balanced → post closing journal → lock year

### Modified
- `postJournalEntry()` — add fiscal period check: reject if entry date falls in closed period
- Fiscal period close action — validate no DRAFT entries exist in month before allowing close

## Files

| File | Change |
|------|--------|
| `lib/actions/finance-gl.ts` | New: `getTrialBalance()`, `previewBalanceReconciliation()`, `applyBalanceReconciliation()`. Modify: `postJournalEntry()` period validation |
| `lib/finance-gl-helpers.ts` | New types: `TrialBalanceRow`, `ReconciliationPreviewRow` |
| `app/finance/reports/page.tsx` | Add trial balance panel + reconciliation button in neraca section |
| `components/finance/reports/trial-balance-panel.tsx` | NEW: trial balance diagnostic table |
| `components/finance/reports/reconciliation-preview-dialog.tsx` | NEW: preview + confirm dialog |
| `app/finance/fiscal-periods/page.tsx` | Add draft validation on close, year-end close button |
| `components/finance/closing-year-dialog.tsx` | NEW: year-end closing workflow with pre-checks |
| `app/api/finance/fiscal-periods/route.ts` | Add year-end close endpoint |

## Out of Scope
- Transaction-level drill-down (clicking account → journal lines)
- Automatic monthly closing (user must manually close each month)
- Multi-year P&L rollup
- Budget variance integration
