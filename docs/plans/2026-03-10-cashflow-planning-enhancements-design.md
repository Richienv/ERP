# Cashflow Planning Board Enhancements Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the existing cashflow planning board with bank account segregation (filter, tags, per-bank balances) and accuracy metrics (percentage variance, category breakdown, trend, accuracy score).

**Architecture:** All changes are UI enhancements to the existing `cashflow-planning-board.tsx` component and supporting server action. No new Prisma models — reuses GLAccount (bank/cash accounts starting with "10") and CashflowSnapshot (frozen plans for variance comparison).

**Tech Stack:** Next.js App Router, TanStack Query, Recharts (sparkline), existing server actions.

---

## Feature A: Bank Account Segregation

### Problem
Items link to GL accounts but the UI doesn't prominently show which bank account (Rekening A, B, C, D) money flows from/to. Users can't see per-bank projected balances.

### Changes

1. **Bank account filter dropdown** — top-right of planning board, next to "Tambah Item". Shows all GL accounts where code starts with "10" (bank/cash). Default: "Semua Rekening". Filters calendar items and running balance by selected account.

2. **Bank account pill on calendar items** — each item pill shows a small tag with the GL account code or short name (e.g., "BCA", "1011"). Color-coded per account.

3. **Per-bank balance cards** — collapsible section below main KPI strip. Each bank account card shows projected in/out/net for the month. Same data grouped by `glAccountId`.

4. **Create dialog label** — rename "Akun GL" to "Rekening" and filter dropdown to bank/cash accounts only (code starts with "10").

### Data Flow
- Bank accounts already available from GL accounts query
- Items already have `glAccountId` and `glAccountCode` fields
- Filter is client-side (just filter the existing `autoItems` + `manualItems` arrays)
- Per-bank grouping is a simple `reduce` over items

---

## Feature B: Accuracy Metrics

### Problem
Variance table shows absolute numbers (plan vs actual) but no percentage, no per-category breakdown, no trend over time. Users can't measure if their planning is improving.

### Changes

1. **Enhanced variance table** — add columns:
   - `Varians %`: `((actual - plan) / plan) × 100`, color coded (green ≤10%, yellow ≤20%, red >20%)
   - `Akurasi`: badge — "Akurat" (±10%), "Cukup" (±20%), "Meleset" (>20%)

2. **Category breakdown** — expandable rows showing per-category comparison (AR, Payroll, PO, etc.). Shows which categories are predictable vs volatile.

3. **3-month accuracy trend** — 3 colored dots or mini bar below variance table. Fetches past 3 months' snapshots and compares against actuals. Shows if accuracy is improving.

4. **Overall accuracy score** — header badge: "Akurasi Perencanaan: 78%". Weighted average of category accuracies where within ±10% = 100%, ±20% = 50%, >20% = 0%.

### Data Flow
- Current month: existing `snapshot` vs `actualItems` in `CashflowPlanData`
- Past months: need new server action `getAccuracyTrend(monthsBack)` that fetches past snapshots and compares against actual journal entries
- All computation is server-side, returned as part of the API response

---

## Implementation Order

1. Bank account filter + calendar pill tags
2. Per-bank balance cards
3. Create dialog "Rekening" label update
4. Enhanced variance table with % and badges
5. Category-level variance breakdown
6. Accuracy trend server action + 3-month trend display
7. Overall accuracy score
