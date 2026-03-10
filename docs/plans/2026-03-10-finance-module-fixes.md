# Finance Module Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix balance sheet imbalance, enhance bank reconciliation auto-match with 3-pass confidence scoring, and add audit trail for finance + inventory entities.

**Architecture:** Three independent parts: (A) Fix retained earnings calculation in both API route and server action to use proper fiscal-year logic, (B) Enhance existing `autoMatchReconciliation()` with 3-pass algorithm (exact→fuzzy amount→fuzzy text) returning confidence scores, (C) Add `AuditLog` Prisma model and `logAudit()` helper called inside existing write transactions.

**Tech Stack:** Prisma (schema + migrations), Next.js server actions, TanStack Query, Vitest for testing pure functions.

---

## Part A: Fix Balance Sheet Retained Earnings

### Task 1: Write tests for retained earnings calculation

**Files:**
- Create: `__tests__/balance-sheet-retained-earnings.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest"
import {
  calculateRetainedEarnings,
  classifyFiscalYearEarnings,
} from "@/lib/finance-helpers"

describe("calculateRetainedEarnings", () => {
  it("returns 0 when no journal entries exist", () => {
    const result = calculateRetainedEarnings([], new Date("2026-03-10"))
    expect(result).toEqual({
      priorYearsRetained: 0,
      currentYearNetIncome: 0,
      total: 0,
    })
  })

  it("separates prior-year and current-year earnings", () => {
    const entries = [
      // Prior year revenue (2025): credit to revenue account
      { date: new Date("2025-06-15"), accountType: "REVENUE" as const, debit: 0, credit: 5000000 },
      // Prior year expense (2025): debit to expense account
      { date: new Date("2025-06-15"), accountType: "EXPENSE" as const, debit: 3000000, credit: 0 },
      // Current year revenue (2026): credit to revenue account
      { date: new Date("2026-02-01"), accountType: "REVENUE" as const, debit: 0, credit: 2000000 },
      // Current year expense (2026): debit to expense account
      { date: new Date("2026-02-01"), accountType: "EXPENSE" as const, debit: 800000, credit: 0 },
    ]
    const result = calculateRetainedEarnings(entries, new Date("2026-03-10"))
    // Prior year: 5M revenue - 3M expense = 2M retained
    expect(result.priorYearsRetained).toBe(2000000)
    // Current year: 2M revenue - 800K expense = 1.2M net income
    expect(result.currentYearNetIncome).toBe(1200000)
    expect(result.total).toBe(3200000)
  })

  it("handles multiple prior years correctly", () => {
    const entries = [
      { date: new Date("2024-03-01"), accountType: "REVENUE" as const, debit: 0, credit: 10000000 },
      { date: new Date("2024-03-01"), accountType: "EXPENSE" as const, debit: 7000000, credit: 0 },
      { date: new Date("2025-06-01"), accountType: "REVENUE" as const, debit: 0, credit: 8000000 },
      { date: new Date("2025-06-01"), accountType: "EXPENSE" as const, debit: 5000000, credit: 0 },
    ]
    const result = calculateRetainedEarnings(entries, new Date("2026-01-15"))
    // 2024: 10M - 7M = 3M, 2025: 8M - 5M = 3M → total prior = 6M
    expect(result.priorYearsRetained).toBe(6000000)
    expect(result.currentYearNetIncome).toBe(0)
    expect(result.total).toBe(6000000)
  })
})

describe("classifyFiscalYearEarnings", () => {
  it("uses Laba Ditahan account balance when closing entries exist", () => {
    const accounts = [
      { code: "3200", name: "Laba Ditahan", type: "EQUITY" as const, balance: 15000000 },
    ]
    const result = classifyFiscalYearEarnings(accounts)
    expect(result.hasClosingEntries).toBe(true)
    expect(result.retainedFromClosing).toBe(15000000)
  })

  it("returns hasClosingEntries false when no Laba Ditahan account", () => {
    const accounts = [
      { code: "3100", name: "Modal Disetor", type: "EQUITY" as const, balance: 50000000 },
    ]
    const result = classifyFiscalYearEarnings(accounts)
    expect(result.hasClosingEntries).toBe(false)
    expect(result.retainedFromClosing).toBe(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/balance-sheet-retained-earnings.test.ts`
Expected: FAIL with "Cannot find module '@/lib/finance-helpers'"

**Step 3: Write minimal implementation**

Create file `lib/finance-helpers.ts`:

```typescript
/**
 * Pure helper functions for finance calculations.
 * Extracted from server actions to enable testing and reuse.
 */

interface EarningsEntry {
  date: Date
  accountType: "REVENUE" | "EXPENSE"
  debit: number
  credit: number
}

interface RetainedEarningsResult {
  priorYearsRetained: number
  currentYearNetIncome: number
  total: number
}

export function calculateRetainedEarnings(
  entries: EarningsEntry[],
  asOfDate: Date
): RetainedEarningsResult {
  const currentYearStart = new Date(asOfDate.getFullYear(), 0, 1)

  let priorRevenue = 0
  let priorExpense = 0
  let currentRevenue = 0
  let currentExpense = 0

  for (const entry of entries) {
    const isPrior = entry.date < currentYearStart
    const netAmount = entry.accountType === "REVENUE"
      ? entry.credit - entry.debit
      : entry.debit - entry.credit

    if (isPrior) {
      if (entry.accountType === "REVENUE") priorRevenue += netAmount
      else priorExpense += netAmount
    } else {
      if (entry.accountType === "REVENUE") currentRevenue += netAmount
      else currentExpense += netAmount
    }
  }

  const priorYearsRetained = priorRevenue - priorExpense
  const currentYearNetIncome = currentRevenue - currentExpense

  return {
    priorYearsRetained,
    currentYearNetIncome,
    total: priorYearsRetained + currentYearNetIncome,
  }
}

interface EquityAccount {
  code: string
  name: string
  type: "EQUITY"
  balance: number
}

interface FiscalYearClassification {
  hasClosingEntries: boolean
  retainedFromClosing: number
}

export function classifyFiscalYearEarnings(
  accounts: EquityAccount[]
): FiscalYearClassification {
  const labaDitahan = accounts.find(
    (a) => a.code === "3200" || a.name.toLowerCase().includes("laba ditahan")
  )

  if (labaDitahan && labaDitahan.balance !== 0) {
    return { hasClosingEntries: true, retainedFromClosing: labaDitahan.balance }
  }

  return { hasClosingEntries: false, retainedFromClosing: 0 }
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/balance-sheet-retained-earnings.test.ts`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add __tests__/balance-sheet-retained-earnings.test.ts lib/finance-helpers.ts
git commit -m "feat(finance): add retained earnings helper with fiscal year separation"
```

---

### Task 2: Fix balance sheet in API route

**Files:**
- Modify: `app/api/finance/reports/route.ts` (lines 90-178, `fetchBalanceSheet` function)

**Step 1: Read the current implementation**

Read `app/api/finance/reports/route.ts` lines 90-178 to understand exact current code.

**Step 2: Fix `fetchBalanceSheet` retained earnings calculation**

In `app/api/finance/reports/route.ts`, find the `fetchBalanceSheet` function. Replace the all-time P&L calculation with fiscal-year-aware logic:

**Current code (around lines 104-107):**
```typescript
const allTimeStart = new Date('2000-01-01')
const pnlForRetained = await fetchPnL(allTimeStart, asOfDate)
```

**Replace with:**
```typescript
// Calculate retained earnings: prior years + current year net income
const currentYearStart = new Date(asOfDate.getFullYear(), 0, 1)

// Prior years: all P&L from beginning of time to Dec 31 of prior year
const priorYearEnd = new Date(asOfDate.getFullYear() - 1, 11, 31, 23, 59, 59)
const priorPnL = asOfDate.getFullYear() > 2000
  ? await fetchPnL(new Date('2000-01-01'), priorYearEnd)
  : { netIncome: 0 }

// Current year: Jan 1 to asOfDate
const currentPnL = await fetchPnL(currentYearStart, asOfDate)
```

And where retained earnings is assigned (around line 127):
```typescript
// Old:
equity.retainedEarnings = pnlForRetained.netIncome

// New:
equity.retainedEarnings = priorPnL.netIncome  // Prior years retained
equity.currentYearNetIncome = currentPnL.netIncome  // Current year (shown separately)
```

Also update the equity totals calculation to include both:
```typescript
const totalEquity = capitalTotal + priorPnL.netIncome + currentPnL.netIncome
```

**Step 3: Add balance validation diagnostic**

At the end of `fetchBalanceSheet`, before the return, add:

```typescript
// Balance equation diagnostic
const balanceCheck = {
  totalAssets: totalAssets,
  totalLiabilitiesAndEquity: totalLiabilities + totalEquity,
  difference: totalAssets - (totalLiabilities + totalEquity),
  isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 1,
}
```

Include `balanceCheck` in the returned object.

**Step 4: Verify build compiles**

Run: `npx tsc --noEmit`
Expected: No NEW errors (pre-existing errors are OK)

**Step 5: Commit**

```bash
git add app/api/finance/reports/route.ts
git commit -m "fix(finance): separate retained earnings by fiscal year in API balance sheet"
```

---

### Task 3: Fix balance sheet in server action

**Files:**
- Modify: `lib/actions/finance.ts` (around lines 594-750, `getBalanceSheet` function)

**Step 1: Read the current implementation**

Read `lib/actions/finance.ts` lines 594-750 to understand exact current code.

**Step 2: Apply same fiscal-year fix to server action**

Find where retained earnings is calculated (around line 649-650):

**Current:**
```typescript
const pnlData = await getProfitLossStatement(yearStart, date)
equity.retainedEarnings = pnlData.netIncome
```

**Replace with:**
```typescript
// Prior years retained earnings (all years before current)
const priorYearEnd = new Date(date.getFullYear() - 1, 11, 31, 23, 59, 59)
const priorPnl = date.getFullYear() > 2000
  ? await getProfitLossStatement(new Date('2000-01-01'), priorYearEnd)
  : { netIncome: 0 }

// Current year net income
const currentYearStart = new Date(date.getFullYear(), 0, 1)
const currentPnl = await getProfitLossStatement(currentYearStart, date)

equity.retainedEarnings = priorPnl.netIncome
equity.currentYearNetIncome = currentPnl.netIncome
```

Update `totalEquity` calculation:
```typescript
const totalEquity = capitalTotal + equity.retainedEarnings + (equity.currentYearNetIncome || 0)
```

**Step 3: Update BalanceSheetData type**

Find `BalanceSheetData` interface (around lines 80-104) and add:

```typescript
equity: {
  capital: { name: string; amount: number }[]
  retainedEarnings: number
  currentYearNetIncome: number  // ADD THIS
  totalEquity: number
}
balanceCheck?: {              // ADD THIS
  totalAssets: number
  totalLiabilitiesAndEquity: number
  difference: number
  isBalanced: boolean
}
```

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 5: Commit**

```bash
git add lib/actions/finance.ts
git commit -m "fix(finance): separate retained earnings by fiscal year in server action"
```

---

### Task 4: Update balance sheet UI to show fiscal year breakdown

**Files:**
- Modify: `app/finance/reports/page.tsx` (the balance sheet display section)

**Step 1: Read the current UI**

Read `app/finance/reports/page.tsx` to find where retained earnings is displayed.

**Step 2: Update equity section to show breakdown**

Find where `retainedEarnings` is displayed and split into two rows:

```tsx
{/* Laba Ditahan (Prior Years) */}
<div className="flex justify-between items-center py-1.5">
  <span className="text-sm text-zinc-600 pl-4">Laba Ditahan (Tahun Sebelumnya)</span>
  <span className="text-sm font-mono font-bold">
    {formatCurrency(equity.retainedEarnings)}
  </span>
</div>

{/* Laba Tahun Berjalan */}
<div className="flex justify-between items-center py-1.5">
  <span className="text-sm text-zinc-600 pl-4">Laba Tahun Berjalan</span>
  <span className="text-sm font-mono font-bold text-blue-600">
    {formatCurrency(equity.currentYearNetIncome || 0)}
  </span>
</div>
```

**Step 3: Add balance check diagnostic banner**

At the top of the balance sheet card (or bottom), show a diagnostic if unbalanced:

```tsx
{balanceSheet.balanceCheck && !balanceSheet.balanceCheck.isBalanced && (
  <div className="border-2 border-red-300 bg-red-50 p-3 flex items-center gap-2">
    <AlertTriangle className="h-4 w-4 text-red-500" />
    <span className="text-xs font-bold text-red-700 uppercase tracking-wide">
      Neraca tidak seimbang — selisih {formatCurrency(Math.abs(balanceSheet.balanceCheck.difference))}
    </span>
  </div>
)}
```

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 5: Commit**

```bash
git add app/finance/reports/page.tsx
git commit -m "feat(finance): show fiscal year earnings breakdown and balance diagnostic in UI"
```

---

## Part B: Bank Reconciliation Auto-Match Enhancement

### Task 5: Write tests for 3-pass matching algorithm

**Files:**
- Create: `__tests__/bank-reconciliation-matching.test.ts`

**Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from "vitest"
import {
  findMatches,
  type BankLine,
  type SystemTransaction,
  type MatchResult,
} from "@/lib/finance-reconciliation-helpers"

const makeBank = (overrides: Partial<BankLine> = {}): BankLine => ({
  id: "bank-1",
  bankDate: new Date("2026-03-01"),
  bankAmount: 5000000,
  bankDescription: "TRF/INV/2026/001",
  bankRef: "INV-2026-001",
  ...overrides,
})

const makeTxn = (overrides: Partial<SystemTransaction> = {}): SystemTransaction => ({
  id: "txn-1",
  date: new Date("2026-03-01"),
  amount: 5000000,
  description: "Pembayaran Invoice INV-2026-001",
  reference: "INV-2026-001",
  ...overrides,
})

describe("findMatches - Pass 1: HIGH confidence", () => {
  it("matches exact amount + date within 3 days + reference substring", () => {
    const results = findMatches(
      makeBank(),
      [makeTxn()]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("HIGH")
    expect(results[0].transactionId).toBe("txn-1")
  })

  it("matches when date is within 3 days", () => {
    const results = findMatches(
      makeBank({ bankDate: new Date("2026-03-03") }),
      [makeTxn({ date: new Date("2026-03-01") })]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("HIGH")
  })

  it("does not match HIGH when reference doesn't match", () => {
    const results = findMatches(
      makeBank({ bankRef: "DIFFERENT-REF", bankDescription: "Unrelated transfer" }),
      [makeTxn()]
    )
    const highResults = results.filter(r => r.confidence === "HIGH")
    expect(highResults).toHaveLength(0)
  })
})

describe("findMatches - Pass 2: MEDIUM confidence", () => {
  it("matches exact amount + date within 3 days without reference", () => {
    const results = findMatches(
      makeBank({ bankRef: "", bankDescription: "TRF MASUK" }),
      [makeTxn({ reference: null })]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("MEDIUM")
  })
})

describe("findMatches - Pass 3: LOW confidence", () => {
  it("matches amount within Rp 100 tolerance + date within 5 days", () => {
    const results = findMatches(
      makeBank({ bankAmount: 5000050, bankDate: new Date("2026-03-05") }),
      [makeTxn()]
    )
    expect(results).toHaveLength(1)
    expect(results[0].confidence).toBe("LOW")
  })

  it("does not match when amount differs by more than Rp 100", () => {
    const results = findMatches(
      makeBank({ bankAmount: 5001000 }),
      [makeTxn()]
    )
    expect(results).toHaveLength(0)
  })
})

describe("findMatches - scoring", () => {
  it("returns highest confidence match first when multiple exist", () => {
    const results = findMatches(
      makeBank(),
      [
        makeTxn({ id: "txn-high", reference: "INV-2026-001" }),
        makeTxn({ id: "txn-medium", reference: null, date: new Date("2026-03-02") }),
      ]
    )
    expect(results[0].confidence).toBe("HIGH")
  })

  it("returns empty array when no matches", () => {
    const results = findMatches(
      makeBank({ bankAmount: 99999999 }),
      [makeTxn()]
    )
    expect(results).toHaveLength(0)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/bank-reconciliation-matching.test.ts`
Expected: FAIL with "Cannot find module '@/lib/finance-reconciliation-helpers'"

**Step 3: Write minimal implementation**

Create file `lib/finance-reconciliation-helpers.ts`:

```typescript
/**
 * Pure functions for bank reconciliation matching.
 * No Prisma, no server actions — just matching logic.
 */

export interface BankLine {
  id: string
  bankDate: Date
  bankAmount: number
  bankDescription: string
  bankRef: string
}

export interface SystemTransaction {
  id: string
  date: Date
  amount: number
  description: string
  reference: string | null
}

export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW"

export interface MatchResult {
  transactionId: string
  confidence: MatchConfidence
  score: number
  reason: string
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)))
}

function referenceOverlap(bankRef: string, bankDesc: string, txnRef: string | null, txnDesc: string): boolean {
  if (!txnRef && !bankRef) return false

  const bankTokens = `${bankRef} ${bankDesc}`.toUpperCase()
  const txnTokens = `${txnRef || ""} ${txnDesc}`.toUpperCase()

  // Check if any reference-like token appears in both
  if (txnRef && bankTokens.includes(txnRef.toUpperCase())) return true
  if (bankRef && txnTokens.includes(bankRef.toUpperCase())) return true

  // Extract invoice/document numbers (INV-XXXX, PO-XXXX, etc.)
  const docPattern = /(?:INV|PO|SO|GRN|JE|PAY|DN|CN)[-/]?\d{4}[-/]?\d{0,6}/gi
  const bankDocs = bankTokens.match(docPattern) || []
  const txnDocs = txnTokens.match(docPattern) || []

  return bankDocs.some(bd => txnDocs.some(td => bd === td))
}

export function findMatches(bankLine: BankLine, transactions: SystemTransaction[]): MatchResult[] {
  const results: MatchResult[] = []
  const absAmount = Math.abs(bankLine.bankAmount)

  for (const txn of transactions) {
    const txnAmount = Math.abs(txn.amount)
    const days = daysBetween(bankLine.bankDate, txn.date)
    const amountDiff = Math.abs(absAmount - txnAmount)
    const hasRefMatch = referenceOverlap(bankLine.bankRef, bankLine.bankDescription, txn.reference, txn.description)

    // Pass 1: HIGH — exact amount + ≤3 days + reference match
    if (amountDiff === 0 && days <= 3 && hasRefMatch) {
      results.push({
        transactionId: txn.id,
        confidence: "HIGH",
        score: 100 - days, // closer date = higher score
        reason: `Jumlah cocok, tanggal ±${days} hari, referensi cocok`,
      })
      continue
    }

    // Pass 2: MEDIUM — exact amount + ≤3 days (no reference needed)
    if (amountDiff === 0 && days <= 3) {
      results.push({
        transactionId: txn.id,
        confidence: "MEDIUM",
        score: 70 - days,
        reason: `Jumlah cocok, tanggal ±${days} hari`,
      })
      continue
    }

    // Pass 3: LOW — amount within Rp 100 + ≤5 days
    if (amountDiff <= 100 && days <= 5) {
      results.push({
        transactionId: txn.id,
        confidence: "LOW",
        score: 40 - days - (amountDiff / 10),
        reason: `Jumlah mirip (selisih ${amountDiff}), tanggal ±${days} hari`,
      })
      continue
    }
  }

  // Sort by confidence priority then score
  const confidenceOrder: Record<MatchConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
  results.sort((a, b) => {
    const confDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    if (confDiff !== 0) return confDiff
    return b.score - a.score
  })

  return results
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/bank-reconciliation-matching.test.ts`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add __tests__/bank-reconciliation-matching.test.ts lib/finance-reconciliation-helpers.ts
git commit -m "feat(finance): add 3-pass bank reconciliation matching algorithm with tests"
```

---

### Task 6: Integrate auto-match into server action

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts` (enhance `autoMatchReconciliation` at lines 377-447)

**Step 1: Read the current `autoMatchReconciliation` implementation**

Read `lib/actions/finance-reconciliation.ts` lines 377-447.

**Step 2: Replace with 3-pass confidence-aware matching**

Replace the existing `autoMatchReconciliation` function body. Keep the function signature and auth pattern. The enhanced version should:

1. Fetch all UNMATCHED bank items for the reconciliation
2. Fetch all POSTED journal lines within the date range (periodStart - 5 days to periodEnd + 5 days)
3. Convert journal lines to `SystemTransaction[]` format
4. For each unmatched bank line, call `findMatches()` from `lib/finance-reconciliation-helpers.ts`
5. Only auto-match HIGH confidence results. Store MEDIUM and LOW as suggestions.
6. Return `{ matched: number, suggestions: { bankItemId, matches: MatchResult[] }[] }`

```typescript
import { findMatches, type BankLine, type SystemTransaction, type MatchResult } from "@/lib/finance-reconciliation-helpers"

export async function autoMatchReconciliation(reconciliationId: string) {
  const user = await requireAuth()

  // Fetch reconciliation with items
  const recon = await prisma.bankReconciliation.findUnique({
    where: { id: reconciliationId },
    include: {
      items: { where: { matchStatus: "UNMATCHED" } },
      glAccount: true,
    },
  })

  if (!recon) return { error: "Rekonsiliasi tidak ditemukan" }

  // Date range with buffer for fuzzy matching
  const startDate = new Date(recon.periodStart)
  startDate.setDate(startDate.getDate() - 5)
  const endDate = new Date(recon.periodEnd)
  endDate.setDate(endDate.getDate() + 5)

  // Fetch candidate journal lines for the GL account
  const journalLines = await prisma.journalLine.findMany({
    where: {
      accountId: recon.glAccountId,
      entry: {
        status: "POSTED",
        date: { gte: startDate, lte: endDate },
      },
    },
    include: {
      entry: { select: { id: true, date: true, description: true, reference: true } },
    },
  })

  // Also fetch already-matched transaction IDs to exclude them
  const matchedTxnIds = new Set(
    (await prisma.bankReconciliationItem.findMany({
      where: {
        reconciliationId,
        matchStatus: "MATCHED",
        systemTransactionId: { not: null },
      },
      select: { systemTransactionId: true },
    })).map(i => i.systemTransactionId!)
  )

  // Convert to SystemTransaction format, excluding already-matched
  const transactions: SystemTransaction[] = journalLines
    .filter(jl => !matchedTxnIds.has(jl.entry.id))
    .map(jl => ({
      id: jl.entry.id,
      date: jl.entry.date,
      amount: Number(jl.debit) > 0 ? Number(jl.debit) : -Number(jl.credit),
      description: jl.entry.description,
      reference: jl.entry.reference,
    }))

  // De-duplicate transactions (multiple lines per entry)
  const uniqueTxns = Array.from(
    new Map(transactions.map(t => [t.id, t])).values()
  )

  let matchedCount = 0
  const suggestions: { bankItemId: string; matches: MatchResult[] }[] = []

  for (const item of recon.items) {
    const bankLine: BankLine = {
      id: item.id,
      bankDate: item.bankDate,
      bankAmount: Number(item.bankAmount),
      bankDescription: item.bankDescription || "",
      bankRef: item.bankRef || "",
    }

    const matches = findMatches(bankLine, uniqueTxns)
    if (matches.length === 0) continue

    // Auto-apply HIGH confidence single match
    if (matches[0].confidence === "HIGH" && matches.filter(m => m.confidence === "HIGH").length === 1) {
      await prisma.bankReconciliationItem.update({
        where: { id: item.id },
        data: {
          systemTransactionId: matches[0].transactionId,
          matchStatus: "MATCHED",
          matchedBy: user.id,
          matchedAt: new Date(),
        },
      })
      // Remove matched transaction from pool
      const idx = uniqueTxns.findIndex(t => t.id === matches[0].transactionId)
      if (idx !== -1) uniqueTxns.splice(idx, 1)
      matchedCount++
    } else {
      // Store as suggestions for user review
      suggestions.push({ bankItemId: item.id, matches })
    }
  }

  // Update reconciliation status if items were matched
  if (matchedCount > 0) {
    await prisma.bankReconciliation.update({
      where: { id: reconciliationId },
      data: { status: "REC_IN_PROGRESS" },
    })
  }

  return { matched: matchedCount, suggestions }
}
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 4: Commit**

```bash
git add lib/actions/finance-reconciliation.ts
git commit -m "feat(finance): enhance auto-match with 3-pass confidence scoring algorithm"
```

---

### Task 7: Update bank reconciliation UI for suggestions

**Files:**
- Modify: `components/finance/bank-reconciliation-view.tsx`

**Step 1: Read the current UI**

Read `components/finance/bank-reconciliation-view.tsx` to understand current layout.

**Step 2: Add auto-match button and suggestion display**

Add an "Auto-Match" button in the detail panel toolbar (near the import section). When clicked, it calls `autoMatchReconciliation()` and shows results:

```tsx
// State for auto-match
const [isAutoMatching, setIsAutoMatching] = useState(false)
const [suggestions, setSuggestions] = useState<AutoMatchSuggestion[]>([])

const handleAutoMatch = async () => {
  setIsAutoMatching(true)
  try {
    const result = await autoMatchReconciliation(selectedRecon.id)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`${result.matched} transaksi berhasil dicocokkan`)
      setSuggestions(result.suggestions || [])
      // Refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.reconciliations.all })
    }
  } finally {
    setIsAutoMatching(false)
  }
}
```

Add the button next to the import button:
```tsx
<Button
  onClick={handleAutoMatch}
  disabled={isAutoMatching}
  className="border-2 border-black bg-emerald-500 text-white hover:bg-emerald-600 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-black uppercase text-[10px] tracking-wider h-8 px-3 rounded-none"
>
  {isAutoMatching ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
  Auto-Match
</Button>
```

**Step 3: Add suggestion cards below the items table**

When suggestions exist, show them grouped by confidence:

```tsx
{suggestions.length > 0 && (
  <div className="border-t-2 border-black p-4 space-y-3">
    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
      Saran Pencocokan ({suggestions.length})
    </span>
    {suggestions.map(s => (
      <div key={s.bankItemId} className="border-2 border-zinc-200 p-3 space-y-2">
        {s.matches.map(m => (
          <div key={m.transactionId} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className={`rounded-none text-[9px] font-black ${
                m.confidence === "HIGH" ? "bg-emerald-100 text-emerald-800 border-emerald-300" :
                m.confidence === "MEDIUM" ? "bg-amber-100 text-amber-800 border-amber-300" :
                "bg-zinc-100 text-zinc-600 border-zinc-300"
              }`}>
                {m.confidence}
              </Badge>
              <span className="text-xs text-zinc-600">{m.reason}</span>
            </div>
            <Button
              size="sm"
              onClick={() => handleApplySuggestion(s.bankItemId, m.transactionId)}
              className="h-6 px-2 text-[9px] font-bold rounded-none border-2 border-black"
            >
              Terapkan
            </Button>
          </div>
        ))}
      </div>
    ))}
  </div>
)}
```

**Step 4: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 5: Commit**

```bash
git add components/finance/bank-reconciliation-view.tsx
git commit -m "feat(finance): add auto-match button and confidence-scored suggestion UI"
```

---

## Part C: Audit Trail

### Task 8: Add AuditLog Prisma model

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: Add the AuditLog model to schema**

Add at the end of `prisma/schema.prisma` (before the closing of the file):

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  entityType  String   // "JournalEntry", "Invoice", "Payment", "Product", etc.
  entityId    String
  action      String   // "CREATE", "UPDATE", "DELETE", "STATUS_CHANGE"
  userId      String
  userName    String?  // Denormalized for display
  changes     Json?    // { field: { from: oldVal, to: newVal } }
  narrative   String?  // Auto-generated Indonesian description
  createdAt   DateTime @default(now())

  @@index([entityType, entityId])
  @@index([userId])
  @@index([createdAt])
}
```

**Step 2: Generate Prisma client**

Run: `npx prisma generate`
Expected: "Generated Prisma Client"

**Step 3: Create migration**

Run: `npx prisma migrate dev --name add_audit_log`
Expected: Migration created and applied

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(audit): add AuditLog model with entity tracking indexes"
```

---

### Task 9: Create logAudit helper

**Files:**
- Create: `lib/audit-helpers.ts`
- Create: `__tests__/audit-helpers.test.ts`

**Step 1: Write the failing test for narrative generation**

```typescript
import { describe, it, expect } from "vitest"
import { generateNarrative, computeChanges } from "@/lib/audit-helpers"

describe("generateNarrative", () => {
  it("generates Indonesian narrative for invoice creation", () => {
    const result = generateNarrative("Invoice", "CREATE", "admin@test.com", {})
    expect(result).toContain("membuat")
    expect(result).toContain("Invoice")
  })

  it("generates narrative for status change", () => {
    const result = generateNarrative("Invoice", "STATUS_CHANGE", "admin@test.com", {
      status: { from: "DRAFT", to: "ISSUED" },
    })
    expect(result).toContain("DRAFT")
    expect(result).toContain("ISSUED")
  })

  it("generates narrative for field update", () => {
    const result = generateNarrative("Product", "UPDATE", "admin@test.com", {
      name: { from: "Kain A", to: "Kain B" },
      price: { from: 50000, to: 55000 },
    })
    expect(result).toContain("name")
    expect(result).toContain("price")
  })
})

describe("computeChanges", () => {
  it("detects changed fields", () => {
    const before = { name: "A", price: 100, status: "DRAFT" }
    const after = { name: "B", price: 100, status: "DRAFT" }
    const changes = computeChanges(before, after)
    expect(changes).toEqual({ name: { from: "A", to: "B" } })
  })

  it("ignores updatedAt field", () => {
    const before = { name: "A", updatedAt: new Date("2026-01-01") }
    const after = { name: "A", updatedAt: new Date("2026-03-10") }
    const changes = computeChanges(before, after)
    expect(changes).toEqual({})
  })

  it("returns empty for identical objects", () => {
    const obj = { name: "A", price: 100 }
    const changes = computeChanges(obj, obj)
    expect(changes).toEqual({})
  })
})
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/audit-helpers.test.ts`
Expected: FAIL

**Step 3: Write implementation**

Create `lib/audit-helpers.ts`:

```typescript
import prisma from "@/lib/db"

const IGNORED_FIELDS = new Set(["updatedAt", "createdAt", "id"])

export interface FieldChange {
  from: unknown
  to: unknown
}

export type ChangeMap = Record<string, FieldChange>

export function computeChanges(
  before: Record<string, unknown>,
  after: Record<string, unknown>
): ChangeMap {
  const changes: ChangeMap = {}

  for (const key of Object.keys(after)) {
    if (IGNORED_FIELDS.has(key)) continue
    const oldVal = before[key]
    const newVal = after[key]

    // Compare serialized values for dates, decimals, etc.
    const oldStr = JSON.stringify(oldVal)
    const newStr = JSON.stringify(newVal)

    if (oldStr !== newStr) {
      changes[key] = { from: oldVal, to: newVal }
    }
  }

  return changes
}

export function generateNarrative(
  entityType: string,
  action: string,
  userName: string,
  changes: ChangeMap
): string {
  const actor = userName || "Sistem"

  switch (action) {
    case "CREATE":
      return `${actor} membuat ${entityType} baru`
    case "DELETE":
      return `${actor} menghapus ${entityType}`
    case "STATUS_CHANGE": {
      const statusChange = changes.status
      if (statusChange) {
        return `${actor} mengubah status ${entityType} dari ${statusChange.from} ke ${statusChange.to}`
      }
      return `${actor} mengubah status ${entityType}`
    }
    case "UPDATE": {
      const fields = Object.keys(changes)
      if (fields.length === 0) return `${actor} memperbarui ${entityType}`
      if (fields.length <= 3) {
        return `${actor} memperbarui ${fields.join(", ")} pada ${entityType}`
      }
      return `${actor} memperbarui ${fields.length} field pada ${entityType}`
    }
    default:
      return `${actor} melakukan ${action} pada ${entityType}`
  }
}

/**
 * Log an audit entry. Call inside existing Prisma transactions.
 * Can accept either a PrismaClient or a transaction client.
 */
export async function logAudit(
  tx: { auditLog: { create: Function } },
  params: {
    entityType: string
    entityId: string
    action: string
    userId: string
    userName?: string
    changes?: ChangeMap
  }
) {
  const narrative = generateNarrative(
    params.entityType,
    params.action,
    params.userName || params.userId,
    params.changes || {}
  )

  await tx.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      userId: params.userId,
      userName: params.userName,
      changes: params.changes ? JSON.parse(JSON.stringify(params.changes)) : undefined,
      narrative,
    },
  })
}

/**
 * Fetch audit log for an entity. Used by detail pages.
 */
export async function getAuditLog(entityType: string, entityId: string) {
  return prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })
}
```

**Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/audit-helpers.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add __tests__/audit-helpers.test.ts lib/audit-helpers.ts
git commit -m "feat(audit): add logAudit helper with narrative generation and change detection"
```

---

### Task 10: Wire audit logging into finance write operations

**Files:**
- Modify: `lib/actions/finance.ts` — add `logAudit` calls to journal entry create/update/void
- Modify: `lib/actions/finance-invoices.ts` — add to invoice create/status changes
- Modify: `lib/actions/finance-ap.ts` — add to payment/bill operations

**Step 1: Read the target functions**

Read the relevant create/update/status-change functions in each file to identify where to add `logAudit()` calls.

**Step 2: Add audit logging to journal entry operations**

In `lib/actions/finance.ts`, find journal entry creation function. After the `prisma.journalEntry.create()` call (inside the same transaction if using `$transaction`), add:

```typescript
import { logAudit } from "@/lib/audit-helpers"

// After creating journal entry:
await logAudit(prisma, {
  entityType: "JournalEntry",
  entityId: newEntry.id,
  action: "CREATE",
  userId: user.id,
  userName: user.email || undefined,
})
```

For voiding:
```typescript
await logAudit(prisma, {
  entityType: "JournalEntry",
  entityId: entryId,
  action: "STATUS_CHANGE",
  userId: user.id,
  userName: user.email || undefined,
  changes: { status: { from: "POSTED", to: "VOID" } },
})
```

**Step 3: Add audit logging to invoice operations**

In `lib/actions/finance-invoices.ts`, add `logAudit` calls after invoice creation, status changes, and payment recording.

**Step 4: Add audit logging to payment operations**

In `lib/actions/finance-ap.ts`, add `logAudit` calls after payment creation and vendor payment recording.

**Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 6: Commit**

```bash
git add lib/actions/finance.ts lib/actions/finance-invoices.ts lib/actions/finance-ap.ts
git commit -m "feat(audit): wire audit logging into finance write operations"
```

---

### Task 11: Wire audit logging into inventory write operations

**Files:**
- Modify: `app/actions/inventory.ts` — product create/update, warehouse create/update/delete
- Modify: `lib/actions/fabric-rolls.ts` — fabric roll operations (if applicable)

**Step 1: Read the target functions**

Read `app/actions/inventory.ts` to find product/warehouse CRUD functions.

**Step 2: Add audit logging**

After each create/update/delete operation, add `logAudit()` calls:

```typescript
import { logAudit } from "@/lib/audit-helpers"

// After product update:
await logAudit(prisma, {
  entityType: "Product",
  entityId: product.id,
  action: "UPDATE",
  userId: user.id,
  userName: user.email || undefined,
  changes: computeChanges(oldProduct, updatedProduct),
})
```

For warehouse soft-delete:
```typescript
await logAudit(prisma, {
  entityType: "Warehouse",
  entityId: warehouseId,
  action: "DELETE",
  userId: user.id,
  userName: user.email || undefined,
})
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 4: Commit**

```bash
git add app/actions/inventory.ts lib/actions/fabric-rolls.ts
git commit -m "feat(audit): wire audit logging into inventory write operations"
```

---

### Task 12: Create audit log display component

**Files:**
- Create: `components/audit-log-timeline.tsx`

**Step 1: Create the audit timeline component**

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { Clock, User, FileText } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { id as localeId } from "date-fns/locale"

interface AuditEntry {
  id: string
  action: string
  userName: string | null
  narrative: string | null
  changes: Record<string, { from: unknown; to: unknown }> | null
  createdAt: string
}

interface AuditLogTimelineProps {
  entityType: string
  entityId: string
}

export function AuditLogTimeline({ entityType, entityId }: AuditLogTimelineProps) {
  const { data: entries, isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["audit-log", entityType, entityId],
    queryFn: async () => {
      const res = await fetch(`/api/audit-log?entityType=${entityType}&entityId=${entityId}`)
      const json = await res.json()
      return json.data ?? []
    },
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 bg-zinc-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (!entries?.length) {
    return (
      <div className="p-6 text-center">
        <FileText className="h-8 w-8 mx-auto text-zinc-200 mb-2" />
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
          Belum ada riwayat perubahan
        </p>
      </div>
    )
  }

  const ACTION_COLORS: Record<string, string> = {
    CREATE: "bg-emerald-400",
    UPDATE: "bg-blue-400",
    DELETE: "bg-red-400",
    STATUS_CHANGE: "bg-amber-400",
  }

  return (
    <div className="space-y-0">
      {entries.map((entry, idx) => (
        <div key={entry.id} className="flex gap-3 p-3 border-b border-zinc-100 last:border-b-0">
          {/* Timeline dot */}
          <div className="flex flex-col items-center pt-1">
            <div className={`h-2.5 w-2.5 rounded-full ${ACTION_COLORS[entry.action] || "bg-zinc-300"}`} />
            {idx < entries.length - 1 && <div className="w-px flex-1 bg-zinc-200 mt-1" />}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-zinc-800">{entry.narrative}</p>

            {/* Field changes */}
            {entry.changes && Object.keys(entry.changes).length > 0 && (
              <div className="mt-1.5 space-y-0.5">
                {Object.entries(entry.changes).slice(0, 5).map(([field, change]) => (
                  <div key={field} className="text-[10px] text-zinc-500 font-mono">
                    <span className="font-bold text-zinc-600">{field}:</span>{" "}
                    <span className="line-through text-red-400">{String(change.from)}</span>{" → "}
                    <span className="text-emerald-600">{String(change.to)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 mt-1">
              <span className="text-[9px] text-zinc-400 flex items-center gap-1">
                <User className="h-2.5 w-2.5" />
                {entry.userName || "Sistem"}
              </span>
              <span className="text-[9px] text-zinc-400 flex items-center gap-1">
                <Clock className="h-2.5 w-2.5" />
                {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true, locale: localeId })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 3: Commit**

```bash
git add components/audit-log-timeline.tsx
git commit -m "feat(audit): add AuditLogTimeline component with change diff display"
```

---

### Task 13: Create audit log API route

**Files:**
- Create: `app/api/audit-log/route.ts`

**Step 1: Create the API route**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import prisma from "@/lib/db"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get("entityType")
  const entityId = searchParams.get("entityId")

  if (!entityType || !entityId) {
    return NextResponse.json({ error: "entityType and entityId required" }, { status: 400 })
  }

  const data = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  return NextResponse.json({ data })
}
```

**Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 3: Commit**

```bash
git add app/api/audit-log/route.ts
git commit -m "feat(audit): add audit log API route"
```

---

### Task 14: Add "Riwayat Perubahan" tab to invoice detail page

**Files:**
- Modify: `app/finance/invoices/page.tsx` or relevant invoice detail component

**Step 1: Read the invoice detail page**

Read the invoice detail/view component to understand where to add the tab.

**Step 2: Add audit timeline tab**

Import and render `AuditLogTimeline` in a new tab or collapsible section:

```tsx
import { AuditLogTimeline } from "@/components/audit-log-timeline"

// Inside the detail view, add a section:
<div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
  <div className="px-5 py-3 border-b-2 border-black bg-zinc-50 flex items-center gap-2">
    <Clock className="h-4 w-4 text-zinc-500" />
    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
      Riwayat Perubahan
    </span>
  </div>
  <AuditLogTimeline entityType="Invoice" entityId={invoice.id} />
</div>
```

**Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No NEW errors

**Step 4: Commit**

```bash
git add app/finance/invoices/page.tsx
git commit -m "feat(audit): add audit trail section to invoice detail page"
```

---

### Task 15: Final verification

**Step 1: Run all tests**

Run: `npx vitest`
Expected: All new tests pass. Pre-existing failures unchanged.

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No NEW errors.

**Step 3: Run lint**

Run: `npm run lint`
Expected: No NEW warnings/errors.

**Step 4: Commit any remaining fixes**

If any test/lint fixes are needed, commit them:

```bash
git add -A
git commit -m "fix(finance): address lint and type errors from finance module fixes"
```
