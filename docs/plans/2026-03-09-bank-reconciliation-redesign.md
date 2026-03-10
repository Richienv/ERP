# Bank Reconciliation Redesign

**Date:** 2026-03-09
**Status:** Approved

## Problem

Bank reconciliation is fundamentally broken:
1. Auto-match doesn't filter by GL account — matches ANY journal line with same amount across all accounts
2. `systemDescription` hardcoded to `null` — matched items never show what they matched to
3. N+1 queries — one DB query per unmatched row (100 rows = 100 queries)
4. No reference matching — only amount + date within ±2 days
5. CSV import is a single text input — can't upload files
6. Manual matching requires typing journal entry UUIDs
7. No way to see candidate matches or system entries alongside bank rows

## Solution

### Side-by-Side Layout

Two-panel view:
- **Left:** Bank statement rows (imported from CSV/Excel)
- **Right:** System journal entries for that GL account in the same period

Unmatched items shown by default. Matched pairs move to "Sudah Dicocokkan" section below.

### Auto-Match Algorithm (Scored)

All matches filtered to `reconciliation.glAccountId` only. Scoring:
- Exact amount match: +50 points
- Reference/description text overlap: +30 points
- Exact date: +20 points, ±1 day: +10 points, ±2 days: +5 points

Threshold: 50+ = auto-match. Below 50 = suggest as candidate for manual review.
After auto-match: show summary "12 otomatis dicocokkan, 5 perlu review manual".

Single batch query instead of N+1 loop:
1. Load all unmatched bank items
2. Load all journal lines for the GL account in the period (one query)
3. Score all combinations in memory
4. Batch update matched items

### Manual Matching (Checkbox Multi-Select)

User checks 1 bank row + 1 or more system rows, clicks "Cocokkan".
Supports many-to-one (one bank deposit = multiple payments).
Validates total amounts match before confirming.

### File Import (CSV + Excel)

- Drag-and-drop file upload zone
- Support CSV (.csv) and Excel (.xlsx)
- Auto-detect columns by header names (Tanggal/Date, Deskripsi/Description, Jumlah/Amount, Referensi/Reference)
- Keep "Download Template CSV" button
- Preview imported rows before confirming

### Performance Fixes

- Replace N+1 auto-match loop with single batch query
- Add `@@index([matchStatus])` on BankReconciliationItem
- Load system entries once, match in memory
- `getReconciliationDetail()` loads system journal entries alongside bank items

### Data Model Changes

No schema changes needed. Fix server action queries:
- `autoMatchReconciliation()` — add `accountId = glAccountId` filter
- `getReconciliationDetail()` — also fetch journal lines for the GL account + period
- Resolve `systemDescription` from matched journal entry (currently hardcoded null)

## Files to Modify

1. `lib/actions/finance-reconciliation.ts` — fix auto-match, add system entries fetch, batch queries
2. `components/finance/bank-reconciliation-view.tsx` — complete rewrite: side-by-side layout, file upload, checkbox matching
3. `prisma/schema.prisma` — add `@@index([matchStatus])` on BankReconciliationItem
4. `hooks/use-reconciliation.ts` — may need detail query key

## UI Specification

### Side-by-Side Panel Layout

```
┌─────────────────────────────┬─────────────────────────────┐
│  LAPORAN BANK (Import)      │  JURNAL SISTEM              │
│  ☐ 2024-01-15  +5,000,000  │  ☐ PAY-001  +5,000,000     │
│    Transfer masuk TRF001    │    Pembayaran Invoice #12    │
│  ☐ 2024-01-16  -2,500,000  │  ☐ VPAY-003 -2,500,000     │
│    Bayar supplier           │    Vendor Payment            │
│  ☐ 2024-01-17  +3,750,000  │  ☐ PAY-005  +3,750,000     │
│    Pendapatan jasa          │    AR Payment                │
│                             │  ☐ PAY-006  +1,200,000     │
│                             │    (unmatched system entry)  │
├─────────────────────────────┴─────────────────────────────┤
│  [✓ Cocokkan Terpilih]  Bank: Rp 6,250,000  Sistem: ...  │
├───────────────────────────────────────────────────────────┤
│  SUDAH DICOCOKKAN (3 pasang)                              │
│  ✓ TRF001 ↔ PAY-001  Rp 5,000,000  15 Jan               │
│  ✓ ...                                                     │
└───────────────────────────────────────────────────────────┘
```

### Color Coding

- Unmatched bank row: white/default
- Unmatched system row: white/default
- Selected (checkbox checked): blue-50 highlight
- Matched pair: emerald-50 background
- Amount mismatch warning: amber highlight

### File Upload Zone

```
┌─────────────────────────────────────────┐
│  📁 Drag & drop file CSV/Excel di sini  │
│     atau klik untuk pilih file           │
│                                          │
│  [Download Template CSV]                 │
└─────────────────────────────────────────┘
```
