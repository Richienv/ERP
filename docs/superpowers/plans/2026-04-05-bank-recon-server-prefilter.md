# Bank Reconciliation — Server-Side Per-Transaction Pre-Filters

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move candidate journal pre-filtering from the client-side scorer to the server, so only plausible matches for each bank transaction are sent to the client.

**Architecture:** The current system fetches ALL journal entries touching the bank GL account for the period in a single query (`getReconciliationDetail`), sends them all to the client, and the client scores each against the active bank transaction. This plan changes the architecture so the server applies direction, amount tolerance, and date proximity filters — reducing payload and improving accuracy. The key insight is that `getReconciliationDetail` currently returns one flat `systemEntries[]` for all bank items; we'll keep that shape but apply server-side post-query filters that match what the client-side scorer's direction gate already does.

**Tech Stack:** Prisma 6.x, TypeScript, Next.js server actions

---

## Audit Findings

### Architecture: How candidates flow today

```
Server: getReconciliationDetail(reconciliationId)
  → Prisma query: journalLine.findMany({ accountId: glAccountId, date: period, status: POSTED })
  → Returns ALL journal lines for the bank GL account in the period (paginated at 50)
  → Sends as detail.systemEntries[] to client

Client: JournalSuggestions component
  → rankMatchesForBankLine(currentBankItem, allSystemEntries)
  → Scores each system entry against ONE bank transaction
  → Direction gate: score=0 → filtered out (line 125)
  → Tier classification: AUTO ≥75, POTENTIAL ≥40, MANUAL >10
  → UI shows tiered results
```

### Problem

1. `getReconciliationDetail` has NO per-bank-transaction context — it fetches the same pool for all items
2. The client-side scorer already gates direction (score=0) and weak matches (score≤10), but ALL entries still travel over the network
3. The client-side date/amount gates added in the previous session are in the wrong layer

### Three server functions to modify

| Function | File:Line | Current params | Current WHERE | Bank tx context? |
|----------|-----------|---------------|---------------|-----------------|
| `getReconciliationDetail` | `lib/actions/finance-reconciliation.ts:146` | `reconciliationId, options?` | `accountId, date:period, status:POSTED` | **No** |
| `autoMatchReconciliation` | `lib/actions/finance-reconciliation.ts:674` | `reconciliationId` | `accountId, date:±30d, status:POSTED` | **Yes** (loops per item, scoring engine handles direction+amount) |
| `searchUnmatchedJournals` | `lib/actions/finance-reconciliation.ts:1223` | `reconciliationId, query` | `accountId, date:±30d, status:POSTED, desc/ref LIKE` | **No** |

### JournalLine schema (from `prisma/schema.prisma:2274`)

```prisma
model JournalLine {
  id        String @id
  entryId   String @db.Uuid
  accountId String @db.Uuid
  description String?
  debit       Decimal @default(0) @db.Decimal(20, 2)
  credit      Decimal @default(0) @db.Decimal(20, 2)
  entry   JournalEntry @relation(...)
  account GLAccount    @relation(...)
}
```

**Direction is NOT a single field** — it's determined by `debit > 0` (money in) vs `credit > 0` (money out). The system entry `amount` is computed as `debit > 0 ? debit : -credit`.

**Amount is per journal-line**, not per journal entry. The line's amount on the bank GL account IS the relevant amount for matching.

### Direction mapping

| Bank tx | Bank amount | Journal line on bank GL | Line field |
|---------|-------------|------------------------|------------|
| MASUK (inflow) | positive | DEBIT (money entered bank) | `debit > 0` |
| KELUAR (outflow) | negative | CREDIT (money left bank) | `credit > 0` |

### Key design decision

**Server-side post-query filter (NOT Prisma WHERE).**

The Prisma `debit`/`credit` fields are `Decimal` columns. Building a complex Prisma `where` with amount range checks on `debit`/`credit` would be fragile. Instead:
1. Keep the existing Prisma query as-is (fetch all lines for GL account in period)
2. Apply direction, amount, and date gates as a JavaScript filter on the result array BEFORE sending to client
3. This avoids schema changes and keeps the query simple

For `autoMatchReconciliation`: the `findMatchesIndexed` function already handles direction (line 582, 607, 626) and amount tolerance (3-pass architecture). No changes needed.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/actions/finance-reconciliation.ts` | Modify | Add post-query server-side filters to `getReconciliationDetail` and `searchUnmatchedJournals` |
| `lib/reconciliation-match-client.ts` | Modify | Revert client-side date/amount gates from `rankMatchesForBankLine` |
| `components/finance/bank-reconciliation-view.tsx` | Modify | Pass active bank item context when loading detail |
| `components/finance/reconciliation-focus-view.tsx` | No change | Already passes `currentItem` to `JournalSuggestions` |

---

### Task 1: Revert client-side pre-filters from `rankMatchesForBankLine`

**Files:**
- Modify: `lib/reconciliation-match-client.ts:108-165`

- [ ] **Step 1: Remove client-side date and amount gates**

Revert `rankMatchesForBankLine` to its original form — the client scorer should only score, not gate. Remove the date proximity check, amount tolerance check, and the pre-computed constants (`bankAbsAmount`, `bankDate`, `DAY_MS`, `DATE_WINDOW_DAYS`).

```ts
/**
 * Rank all system entries for a single bank line into 3 tiers.
 * Delegates scoring to the server-side engine via type adapters.
 */
export function rankMatchesForBankLine(
  bankLine: ClientBankLine,
  systemEntries: ClientSystemEntry[]
): TieredMatches {
  const auto: ClientMatchResult[] = []
  const potential: ClientMatchResult[] = []
  const manual: ClientMatchResult[] = []

  const serverBank = toBankLine(bankLine)

  for (const entry of systemEntries) {
    const result = serverScore(serverBank, toSystemTxn(entry))

    if (result.score <= 0) continue // direction mismatch

    const tier = scoreTier(result.score, result.signals.reference)
    const match: ClientMatchResult = {
      entryId: entry.entryId,
      entry,
      tier,
      score: result.score,
      amountDiff: result.amountDiff,
      nameSimilarity: result.nameSimilarity,
      daysDiff: result.daysDiff,
      signals: result.signals,
      matchedRefs: result.matchedRefs,
    }

    if (tier === "AUTO") auto.push(match)
    else if (tier === "POTENTIAL") potential.push(match)
    else if (result.score > 10) manual.push(match)
  }

  auto.sort((a, b) => b.score - a.score)
  potential.sort((a, b) => b.score - a.score)
  manual.sort((a, b) => b.score - a.score)

  const bestTier: ClientMatchTier =
    auto.length > 0 ? "AUTO" : potential.length > 0 ? "POTENTIAL" : "MANUAL"

  return { auto, potential, manual, bestTier }
}
```

- [ ] **Step 2: Verify no other references to removed constants**

Run: `grep -n "DATE_WINDOW_DAYS\|DAY_MS\|bankAbsAmount" lib/reconciliation-match-client.ts`
Expected: No matches

- [ ] **Step 3: Commit**

```bash
git add lib/reconciliation-match-client.ts
git commit -m "refactor(recon): revert client-side date/amount gates from rankMatchesForBankLine"
```

---

### Task 2: Add server-side post-query filter to `getReconciliationDetail`

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts:146-253`

The function currently fetches ALL journal lines for the GL account in the period. We need to add a post-query JavaScript filter that narrows the results based on the active bank transaction's direction, amount, and date.

**Key constraint:** `getReconciliationDetail` does NOT currently receive the active bank item — it returns ALL bank items and ALL system entries. The client then picks per-item. We have two options:

- **Option A:** Add optional `activeBankItem` param to the function → filter system entries for that item
- **Option B:** Apply a general "reasonable window" filter that removes obviously implausible entries for ANY item

**We choose Option A** — add an optional `activeBankItemId` param. When provided, filter system entries. When not provided (backward compat), return unfiltered.

- [ ] **Step 1: Update function signature**

In `lib/actions/finance-reconciliation.ts`, update the `getReconciliationDetail` function signature to accept an optional `activeBankItemId`:

```ts
export async function getReconciliationDetail(
    reconciliationId: string,
    options?: {
        bankPage?: number
        bankPageSize?: number
        systemPage?: number
        systemPageSize?: number
        activeBankItemId?: string  // NEW: when set, filter system entries for this item
    }
): Promise<ReconciliationDetail | null> {
```

- [ ] **Step 2: Look up the active bank item and build filter params**

After `if (!rec) return null` (line 171), add a block that resolves the active bank item when `activeBankItemId` is provided:

```ts
        // Resolve active bank item for per-transaction filtering
        let activeBankItem: { bankAmount: number; bankDate: Date | null } | null = null
        if (options?.activeBankItemId) {
            const item = rec.items.find(i => i.id === options.activeBankItemId)
                ?? await prisma.bankReconciliationItem.findUnique({
                    where: { id: options.activeBankItemId },
                    select: { bankAmount: true, bankDate: true },
                })
            if (item) {
                activeBankItem = {
                    bankAmount: Number(item.bankAmount),
                    bankDate: item.bankDate,
                }
            }
        }
```

- [ ] **Step 3: Add post-query filter function**

After the existing `journalLines` fetch (after line 222), add a filter function that applies direction, amount tolerance, and date proximity:

```ts
        // ── Server-side per-transaction pre-filter ──
        // When an active bank item is specified, filter journal lines to plausible matches.
        // Direction: KELUAR bank tx → only CREDIT lines; MASUK → only DEBIT lines
        // Amount: within ±10% or ±Rp 10.000 (whichever is larger)
        // Date: within ±30 days of bank transaction date
        const filteredJournalLines = activeBankItem
            ? journalLines.filter(line => {
                const debit = Number(line.debit)
                const credit = Number(line.credit)
                const lineAmount = debit > 0 ? debit : credit  // absolute amount on this GL line

                // Direction gate: bank KELUAR (negative) → journal CREDIT; bank MASUK (positive) → journal DEBIT
                const bankIsKeluar = activeBankItem!.bankAmount < 0
                if (bankIsKeluar && debit > 0) return false   // bank outflow but journal debits bank → wrong direction
                if (!bankIsKeluar && credit > 0) return false // bank inflow but journal credits bank → wrong direction

                // Amount tolerance gate
                const bankAbsAmount = Math.abs(activeBankItem!.bankAmount)
                const tolerance = Math.max(bankAbsAmount * 0.10, 10_000)
                if (Math.abs(lineAmount - bankAbsAmount) > tolerance) return false

                // Date proximity gate (±30 days)
                if (activeBankItem!.bankDate && line.entry.date) {
                    const diffMs = Math.abs(new Date(activeBankItem!.bankDate).getTime() - new Date(line.entry.date).getTime())
                    if (diffMs > 30 * 86_400_000) return false
                }

                return true
            })
            : journalLines  // no active item → return all (backward compat)
```

- [ ] **Step 4: Use filtered lines for systemEntries mapping**

Replace the existing `journalLines` references in the mapping code (lines 234-253) with `filteredJournalLines`:

Change:
```ts
        for (const line of journalLines) {
            entryDescriptionMap.set(line.entryId, line.entry.description)
        }

        const systemEntries: SystemEntryData[] = journalLines.map((line) => {
```

To:
```ts
        for (const line of filteredJournalLines) {
            entryDescriptionMap.set(line.entryId, line.entry.description)
        }

        const systemEntries: SystemEntryData[] = filteredJournalLines.map((line) => {
```

Also update the `systemPagination` to reflect filtered count:

```ts
            systemPagination: {
                page: systemPage,
                pageSize: systemPageSize,
                totalItems: activeBankItem ? filteredJournalLines.length : totalSystemEntries,
                totalPages: activeBankItem
                    ? Math.ceil(filteredJournalLines.length / systemPageSize)
                    : Math.ceil(totalSystemEntries / systemPageSize),
            },
```

- [ ] **Step 5: Commit**

```bash
git add lib/actions/finance-reconciliation.ts
git commit -m "feat(recon): add server-side per-transaction pre-filter to getReconciliationDetail"
```

---

### Task 3: Pass `activeBankItemId` from the focus view caller

**Files:**
- Modify: `components/finance/bank-reconciliation-view.tsx:353-358` (the `reloadDetail` function)
- Modify: `components/finance/bank-reconciliation-view.tsx:1208` (the `onReloadDetail` prop)

The parent component `BankReconciliationView` calls `getReconciliationDetail` via `reloadDetail()`. The focus view calls `onReloadDetail()` when the user navigates between bank items. We need to pass the current bank item ID through this chain.

- [ ] **Step 1: Update `reloadDetail` to accept `activeBankItemId`**

Find the `reloadDetail` function (around line 353):

```ts
    const reloadDetail = async (recId: string, opts?: { bPage?: number; sPage?: number; activeBankItemId?: string }) => {
        const d = await onLoadDetail(recId, {
            bankPage: opts?.bPage ?? bankPage,
            bankPageSize: PAGE_SIZE,
            systemPage: opts?.sPage ?? systemPage,
            systemPageSize: PAGE_SIZE,
            activeBankItemId: opts?.activeBankItemId,
        })
```

- [ ] **Step 2: Update focus view's `onReloadDetail` to pass current item**

In the focus view props passed at line ~1208, change `onReloadDetail` to pass the current item's ID. The focus view already has `currentItem` in scope.

Change the `ReconciliationFocusViewProps` interface (around line 68) to include:

```ts
    onReloadDetail: (activeBankItemId?: string) => Promise<void>
```

Then update the focus view's `handleMatchAndNext` (line ~1385) and the caller:

In `bank-reconciliation-view.tsx` at the `onReloadDetail` prop (line ~1208):

```ts
onReloadDetail={async (activeBankItemId?: string) => {
    if (selectedRec) await reloadDetail(selectedRec.id, { activeBankItemId })
}}
```

In `reconciliation-focus-view.tsx`, update calls to `onReloadDetail()` to pass the current item ID:

```ts
// In handleMatchAndNext (~line 1393):
await onReloadDetail(currentItem?.id)

// In handleUnmatch (~line 1400):
await onReloadDetail(currentItem?.id)
```

- [ ] **Step 3: Commit**

```bash
git add components/finance/bank-reconciliation-view.tsx components/finance/reconciliation-focus-view.tsx
git commit -m "feat(recon): pass activeBankItemId through reloadDetail chain"
```

---

### Task 4: Add per-transaction filter to `searchUnmatchedJournals`

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts:1223-1315`

The manual search function also needs direction and amount gates when context is available.

- [ ] **Step 1: Add optional bank item context to function signature**

```ts
export async function searchUnmatchedJournals(
    reconciliationId: string,
    query: string,
    bankItemContext?: { bankAmount: number; bankDate: string | null }  // NEW
): Promise<SearchJournalResult[]> {
```

- [ ] **Step 2: Add post-query filter to search results**

After the existing `for (const line of journalLines)` loop (line 1292-1308), add a filter before returning:

```ts
        // Per-transaction filter when bank item context is available
        if (bankItemContext) {
            const bankAbsAmount = Math.abs(bankItemContext.bankAmount)
            const bankIsKeluar = bankItemContext.bankAmount < 0
            const tolerance = Math.max(bankAbsAmount * 0.10, 10_000)
            const bankDateMs = bankItemContext.bankDate ? new Date(bankItemContext.bankDate).getTime() : null

            return results.filter(r => {
                // Direction gate
                if (bankIsKeluar && r.amount > 0) return false  // bank outflow but journal debit → wrong
                if (!bankIsKeluar && r.amount < 0) return false // bank inflow but journal credit → wrong

                // Amount tolerance
                if (Math.abs(Math.abs(r.amount) - bankAbsAmount) > tolerance) return false

                // Date proximity (±30 days)
                if (bankDateMs) {
                    const diffMs = Math.abs(new Date(r.date).getTime() - bankDateMs)
                    if (diffMs > 30 * 86_400_000) return false
                }

                return true
            })
        }

        return results
```

- [ ] **Step 3: Update the caller to pass bank item context**

In `components/finance/bank-reconciliation-view.tsx`, find where `searchUnmatchedJournals` is called (likely via `onSearchJournals` prop). The focus view has `currentItem` — pass its amount and date.

In `reconciliation-focus-view.tsx`, find `onSearchJournals` usage and update:

```ts
// When calling search, pass the current bank item context
const results = await onSearchJournals(reconciliationId, query, {
    bankAmount: currentItem.bankAmount,
    bankDate: currentItem.bankDate,
})
```

Update the prop type and the parent's handler to pass through the new parameter.

In `bank-reconciliation-view.tsx` at the `onSearchJournals` prop (find the exact line):

```ts
onSearchJournals={async (recId, query, bankCtx) => {
    return searchUnmatchedJournals(recId, query, bankCtx)
}}
```

Update `ReconciliationFocusViewProps` interface:

```ts
onSearchJournals?: (reconciliationId: string, query: string, bankItemContext?: { bankAmount: number; bankDate: string | null }) => Promise<SearchJournalResult[]>
```

And the parent `BankReconciliationViewProps`:

```ts
onSearchJournals?: (reconciliationId: string, query: string, bankItemContext?: { bankAmount: number; bankDate: string | null }) => Promise<SearchJournalResult[]>
```

- [ ] **Step 4: Commit**

```bash
git add lib/actions/finance-reconciliation.ts components/finance/bank-reconciliation-view.tsx components/finance/reconciliation-focus-view.tsx
git commit -m "feat(recon): add per-transaction filter to searchUnmatchedJournals"
```

---

### Task 5: Verify `autoMatchReconciliation` (no changes needed)

**Files:**
- Read-only: `lib/actions/finance-reconciliation.ts:674-900`
- Read-only: `lib/finance-reconciliation-helpers.ts:569-639`

- [ ] **Step 1: Confirm auto-match already handles direction + amount + date**

Verify these three gates exist in `findMatchesIndexed`:

1. **Direction gate**: Line 582 (`sameDirection`), Line 607, Line 626 — ✅ all three passes check direction
2. **Amount tolerance**: Pass 1 = exact match, Pass 2 = binary search with `amountTolerance()`, Pass 3 = all within ±30 days — ✅
3. **Date proximity**: Pass 3 line 629 (`days > 30` → continue) — ✅

No changes needed. The auto-match engine already filters per-bank-item because it loops through `rec.items` and calls `findMatchesIndexed` for each one.

- [ ] **Step 2: Commit (no-op, just verify)**

No commit needed — this is a verification step only.

---

### Task 6: End-to-end verification

- [ ] **Step 1: Test the PT nicholas scenario**

1. Open Bank Rekonsiliasi → select Bank BCA
2. Open any reconciliation session (01 Mar – 31 Mar 2026)
3. Navigate to PT nicholas transaction (KELUAR, Rp 933.250.000, 31 Mar)
4. Check "Pilih Jurnal Yang Cocok":
   - ✅ Bayar BILL-2026-0002 (Rp 933.249.650, CREDIT on BCA) appears as POTENSI
   - ❌ Top Up Peti Kas (Rp 888.888) does NOT appear (amount gate: diff >> tolerance)
   - ❌ Pengeluaran Peti Kas (Rp 20.000) does NOT appear (amount gate)
   - ❌ Faktur Penjualan MASUK entries do NOT appear (direction gate)
5. Click "Cocokkan & Lanjut" → proceeds without error
6. Check browser console — zero errors

- [ ] **Step 2: Test MASUK direction**

1. Find a MASUK bank transaction
2. Verify candidates only show journals with DEBIT on the bank GL account
3. KELUAR journals (CREDIT on bank) must NOT appear

- [ ] **Step 3: Test manual search**

1. Type in the "Cari jurnal..." search field
2. Verify results still respect direction + amount + date gates
3. Verify unrelated journals don't appear

- [ ] **Step 4: Test auto-match**

1. Click AUTO-MATCH button
2. Verify matched entries are correct direction
3. Verify POTENTIAL suggestions have reasonable amounts

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(recon): server-side per-transaction pre-filter for journal candidates"
```
