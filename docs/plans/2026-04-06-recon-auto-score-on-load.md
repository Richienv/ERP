# Bank Reconciliation: Auto-Score on Session Load

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Run the scoring engine on all unscored bank items when a reconciliation session is loaded, so the 4-layer sidebar (COCOK/POTENSI/HAMPIR/BELUM) shows accurate classifications immediately — not just after clicking AUTO-MATCH.

**Architecture:** Create a new lightweight `scoreUnmatchedItems(reconId)` server action that runs the existing scoring engine on unscored items and persists `matchScore`/`matchTier` WITHOUT auto-matching. Update `getItemDisplayLayer()` to classify UNMATCHED items by score (not just MATCHED). Auto-trigger scoring on first detail load in the client.

**Tech Stack:** Prisma queries, existing `findMatchesIndexed`/`buildTransactionIndex` from `finance-reconciliation-helpers.ts`, React state management.

---

## Audit Summary (pre-plan findings)

| Question | Answer |
|----------|--------|
| Where does scoring run? | Only in `autoMatchReconciliation()` (line 836 of `finance-reconciliation.ts`) |
| Are scores persisted? | YES — `matchScore`, `matchTier`, `matchAmountDiff`, `matchNameSimilarity`, `matchDaysDiff` on BankReconciliationItem |
| Does `getReconciliationDetail` compute scores? | NO — returns raw DB fields only |
| Does client-side scoring run for all items? | NO — only for the currently-selected item (right panel candidates) |
| Why everything shows BELUM on load | `getItemDisplayLayer()` only classifies MATCHED items by score. UNMATCHED items with null matchScore → BELUM |

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/actions/finance-reconciliation.ts` | Modify | Add `scoreUnmatchedItems()` server action |
| `components/finance/reconciliation-focus-view.tsx` | Modify | Update `getItemDisplayLayer()` to handle UNMATCHED items with scores; fix action button guards |
| `components/finance/bank-reconciliation-view.tsx` | Modify | Auto-trigger scoring on first detail load |
| `app/finance/reconciliation/page.tsx` | Modify | Pass `scoreUnmatchedItems` as prop |
| `__tests__/bank-reconciliation-matching.test.ts` | Modify | Add tests for updated `getItemDisplayLayer` logic |

---

## Task 1: Create `scoreUnmatchedItems` server action

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts` (add after `bulkConfirmCocokItems`, ~line 1160)

**Step 1: Write the server action**

This action reuses the same scoring infrastructure as `autoMatchReconciliation` but does NOT change `matchStatus` — it only persists score metadata for display.

```typescript
/**
 * Score all UNMATCHED items that haven't been scored yet.
 * Persists matchScore/matchTier WITHOUT auto-matching (matchStatus stays UNMATCHED).
 * Called automatically on session load so the 4-layer sidebar shows accurate tiers.
 */
export async function scoreUnmatchedItems(
    reconciliationId: string
): Promise<{ success: boolean; scored?: number; error?: string }> {
    try {
        const result = await withPrismaAuth(async (prisma: PrismaClient) => {
            const rec = await prisma.bankReconciliation.findUniqueOrThrow({
                where: { id: reconciliationId },
                include: {
                    items: {
                        where: {
                            matchStatus: 'UNMATCHED',
                            matchScore: null,  // Only score items not yet scored
                        },
                    },
                },
            })

            if (rec.items.length === 0) return { scored: 0 }

            // Expand date range by ±30 days for scoring
            const dateFrom = new Date(rec.periodStart)
            dateFrom.setDate(dateFrom.getDate() - 30)
            const dateTo = new Date(rec.periodEnd)
            dateTo.setDate(dateTo.getDate() + 30)

            // Fetch POSTED journal lines for the GL account
            const journalLines = await prisma.journalLine.findMany({
                where: {
                    accountId: rec.glAccountId,
                    entry: {
                        date: { gte: dateFrom, lte: dateTo },
                        status: 'POSTED',
                    },
                },
                include: {
                    entry: {
                        select: { id: true, date: true, description: true, reference: true },
                    },
                },
            })

            // Get already-matched transaction IDs to exclude
            const alreadyMatchedItems = await prisma.bankReconciliationItem.findMany({
                where: {
                    reconciliationId,
                    matchStatus: { in: ['MATCHED', 'CONFIRMED'] },
                    systemTransactionId: { not: null },
                },
                select: { systemTransactionId: true },
            })
            const matchedTxnIds = new Set(
                alreadyMatchedItems.map((i) => i.systemTransactionId).filter(Boolean) as string[]
            )

            // Convert journal lines to SystemTransaction[], de-duplicate by entry ID
            const seenEntryIds = new Set<string>()
            const systemTransactions: SystemTransaction[] = []

            for (const line of journalLines) {
                const entryId = line.entry.id
                if (seenEntryIds.has(entryId) || matchedTxnIds.has(entryId)) continue
                seenEntryIds.add(entryId)

                const debit = Number(line.debit)
                const credit = Number(line.credit)
                const amount = debit > 0 ? debit : -credit

                systemTransactions.push({
                    id: entryId,
                    date: line.entry.date,
                    amount,
                    description: line.entry.description || '',
                    reference: line.entry.reference,
                })
            }

            // Build indexed pool for efficient scoring
            const txnIndex = buildTransactionIndex(systemTransactions)

            // Score each unscored item and collect batch updates
            const updates: {
                id: string
                tier: string
                score: number
                amountDiff: number
                nameSimilarity: number
                daysDiff: number
            }[] = []

            for (const item of rec.items) {
                if (!item.bankDate) continue

                const bankLine: BankLine = {
                    id: item.id,
                    bankDate: item.bankDate,
                    bankAmount: Number(item.bankAmount),
                    bankDescription: item.bankDescription || '',
                    bankRef: item.bankRef || '',
                }

                const matches = findMatchesIndexed(bankLine, txnIndex)

                if (matches.length === 0) {
                    updates.push({
                        id: item.id,
                        tier: 'MANUAL',
                        score: 0,
                        amountDiff: 0,
                        nameSimilarity: 0,
                        daysDiff: 0,
                    })
                } else {
                    const best = matches[0]
                    updates.push({
                        id: item.id,
                        tier: best.tier,
                        score: best.score,
                        amountDiff: best.amountDiff,
                        nameSimilarity: best.nameSimilarity,
                        daysDiff: best.daysDiff,
                    })
                }
            }

            // Persist score metadata (NO matchStatus change — items stay UNMATCHED)
            for (const update of updates) {
                await prisma.bankReconciliationItem.update({
                    where: { id: update.id },
                    data: {
                        matchTier: update.tier,
                        matchScore: update.score,
                        matchAmountDiff: update.amountDiff,
                        matchNameSimilarity: update.nameSimilarity,
                        matchDaysDiff: update.daysDiff,
                    },
                })
            }

            return { scored: updates.length }
        })

        return { success: true, scored: result.scored }
    } catch (error) {
        const msg = error instanceof Error ? error.message : 'Gagal menilai item'
        console.error("[scoreUnmatchedItems] Error:", error)
        return { success: false, error: msg }
    }
}
```

**Important:** The existing imports for `BankLine`, `SystemTransaction`, `buildTransactionIndex`, `findMatchesIndexed` from `../finance-reconciliation-helpers` must already be present in this file (used by `autoMatchReconciliation`). Verify before adding duplicates.

**Step 2: Commit**

```bash
git add lib/actions/finance-reconciliation.ts
git commit -m "feat(recon): scoreUnmatchedItems action — score on load without auto-matching"
```

---

## Task 2: Update `getItemDisplayLayer` for UNMATCHED items with scores

**Files:**
- Modify: `components/finance/reconciliation-focus-view.tsx:116-127`

**Step 1: Update the function**

The current function only classifies MATCHED items by score. UNMATCHED items always return BELUM even if they have a high matchScore (set by `scoreUnmatchedItems`). Fix:

```typescript
// BEFORE (line 116-127):
function getItemDisplayLayer(item: ReconciliationItemData): ReconDisplayLayer {
    if (item.matchStatus === "CONFIRMED") return "CONFIRMED"
    if (item.matchStatus === "IGNORED") return "IGNORED"
    if (item.matchStatus === "MATCHED") {
        const score = item.matchScore ?? 0
        if (score >= 95) return "COCOK"
        if (score >= 70) return "POTENSI"
        if (score >= 40) return "HAMPIR"
        return "BELUM"
    }
    return "BELUM"
}

// AFTER:
function getItemDisplayLayer(item: ReconciliationItemData): ReconDisplayLayer {
    if (item.matchStatus === "CONFIRMED") return "CONFIRMED"
    if (item.matchStatus === "IGNORED") return "IGNORED"
    // Classify by score — works for both MATCHED and UNMATCHED items with scores
    const score = item.matchScore ?? 0
    if (score >= 95) return "COCOK"
    if (score >= 70) return "POTENSI"
    if (score >= 40) return "HAMPIR"
    return "BELUM"
}
```

**Step 2: Fix action button guards for UNMATCHED items**

UNMATCHED items in COCOK/POTENSI layers cannot be confirmed (they're not matched to a journal entry yet). Update the action button logic in QueueSidebar to only show Konfirmasi for MATCHED items.

Find the QueueItemRow usage in QueueSidebar (the `onConfirm` prop assignment). Update:

```typescript
// BEFORE:
onConfirm={
    (layer === "COCOK" || layer === "POTENSI") && !isCompleted
        ? () => onConfirmItem(item.id)
        : undefined
}

// AFTER:
onConfirm={
    (layer === "COCOK" || layer === "POTENSI") && item.matchStatus === "MATCHED" && !isCompleted
        ? () => onConfirmItem(item.id)
        : undefined
}
```

Also update the Tolak button — can only reject matched/confirmed items:

```typescript
// BEFORE:
onReject={
    (layer === "COCOK" || layer === "POTENSI" || layer === "CONFIRMED") && !isCompleted
        ? () => onRejectItem(item.id)
        : undefined
}

// AFTER:
onReject={
    (layer === "COCOK" || layer === "POTENSI" || layer === "CONFIRMED")
        && (item.matchStatus === "MATCHED" || item.matchStatus === "CONFIRMED")
        && !isCompleted
        ? () => onRejectItem(item.id)
        : undefined
}
```

And Abaikan should be available for ALL unmatched items (not just BELUM layer):

```typescript
// BEFORE:
onIgnore={
    layer === "BELUM" && !isCompleted
        ? () => onIgnoreItem(item.id)
        : undefined
}

// AFTER:
onIgnore={
    item.matchStatus === "UNMATCHED" && !isCompleted
        ? () => onIgnoreItem(item.id)
        : undefined
}
```

**Step 3: Update the `allDone` check**

The `allDone` variable determines when to show the completion screen. Currently checks for CONFIRMED/IGNORED. After the scoring fix, MATCHED items should also count as "not done yet" (they need to be confirmed). Keep the current logic — it's correct:

```typescript
const allDone = allItems.every(i =>
    i.matchStatus === "CONFIRMED" || i.matchStatus === "IGNORED"
)
```

No change needed here.

**Step 4: Commit**

```bash
git add components/finance/reconciliation-focus-view.tsx
git commit -m "fix(recon): classify UNMATCHED items by score in 4-layer sidebar"
```

---

## Task 3: Auto-trigger scoring on first detail load

**Files:**
- Modify: `components/finance/bank-reconciliation-view.tsx` (inside the detail loading logic)
- Modify: `app/finance/reconciliation/page.tsx` (add new prop)

**Step 1: Add `onScoreItems` prop to BankReconciliationViewProps**

In `bank-reconciliation-view.tsx`, add to the interface (after the existing optional confirm/reject props):

```typescript
    onScoreItems?: (reconciliationId: string) => Promise<{ success: boolean; scored?: number; error?: string }>
```

Add to the destructured props in the component function.

**Step 2: Auto-trigger scoring after loading detail**

Find the `reloadDetail` function or the effect that loads the initial detail. After the detail is loaded and set, check if any items need scoring. If so, trigger scoring and reload.

The detail load happens in the reconciliation selection handler. Find where `setSelectedRec(detail)` is called after `onLoadDetail`. Add a scoring check:

```typescript
// After setting the detail:
// Check if any items need scoring (unmatched with null matchScore)
if (detail && onScoreItems) {
    const needsScoring = detail.items.some(
        i => i.matchStatus === "UNMATCHED" && i.matchScore == null
    )
    if (needsScoring) {
        // Score in background, then reload to show updated tiers
        onScoreItems(detail.id).then(async (result) => {
            if (result.success && (result.scored ?? 0) > 0) {
                // Reload detail to get updated scores
                const updated = await onLoadDetail(detail.id, {
                    bankPage,
                    bankPageSize: PAGE_SIZE,
                    systemPage,
                    systemPageSize: PAGE_SIZE,
                })
                if (updated) setSelectedRec(updated)
            }
        })
    }
}
```

Find the exact location where this should go. Look for the `reloadDetail` function and the initial detail load path. The scoring auto-trigger should run:
1. After initial detail load (when user clicks on a reconciliation)
2. NOT on every reload (only when unscored items exist)

The best place is inside `reloadDetail` itself, or right after the initial `onLoadDetail` call in the selection handler.

**Step 3: Add prop to page**

In `app/finance/reconciliation/page.tsx`, add import and prop:

```typescript
import {
    // ...existing imports...
    scoreUnmatchedItems,
} from "@/lib/actions/finance-reconciliation"
```

Pass to BankReconciliationView:
```tsx
    onScoreItems={scoreUnmatchedItems}
```

**Step 4: Performance guard (EAGER_SCORE_THRESHOLD)**

Add a guard: only auto-score sessions with ≤ 50 items. For larger sessions, the user must click AUTO-MATCH manually.

```typescript
const EAGER_SCORE_THRESHOLD = 50

if (needsScoring && detail.items.length <= EAGER_SCORE_THRESHOLD) {
    onScoreItems(detail.id).then(/* ... */)
}
```

**Step 5: Commit**

```bash
git add components/finance/bank-reconciliation-view.tsx app/finance/reconciliation/page.tsx
git commit -m "feat(recon): auto-trigger scoring on session load for accurate 4-layer display"
```

---

## Task 4: Test the scoring logic

**Files:**
- Modify: `__tests__/bank-reconciliation-matching.test.ts`

**Step 1: Add test for updated getItemDisplayLayer logic**

We can't directly import the component function, but we can test the equivalent logic:

```typescript
describe("getItemDisplayLayer — UNMATCHED items with scores", () => {
    // Simulated logic from the component
    function getLayer(matchStatus: string, matchScore: number | null): string {
        if (matchStatus === "CONFIRMED") return "CONFIRMED"
        if (matchStatus === "IGNORED") return "IGNORED"
        const score = matchScore ?? 0
        if (score >= 95) return "COCOK"
        if (score >= 70) return "POTENSI"
        if (score >= 40) return "HAMPIR"
        return "BELUM"
    }

    it("UNMATCHED item with score 100 → COCOK", () => {
        expect(getLayer("UNMATCHED", 100)).toBe("COCOK")
    })
    it("UNMATCHED item with score 80 → POTENSI", () => {
        expect(getLayer("UNMATCHED", 80)).toBe("POTENSI")
    })
    it("UNMATCHED item with score 50 → HAMPIR", () => {
        expect(getLayer("UNMATCHED", 50)).toBe("HAMPIR")
    })
    it("UNMATCHED item with null score → BELUM", () => {
        expect(getLayer("UNMATCHED", null)).toBe("BELUM")
    })
    it("MATCHED item with score 100 → COCOK", () => {
        expect(getLayer("MATCHED", 100)).toBe("COCOK")
    })
    it("CONFIRMED item ignores score", () => {
        expect(getLayer("CONFIRMED", 50)).toBe("CONFIRMED")
    })
})
```

**Step 2: Run tests**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: All tests pass.

**Step 3: Commit**

```bash
git add __tests__/bank-reconciliation-matching.test.ts
git commit -m "test(recon): add tests for UNMATCHED item layer classification"
```

---

## Task 5: Final verification

**Step 1: Run all tests**

```bash
npx vitest run
```

Expected: All bank recon tests pass. Pre-existing failures only.

**Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: No new type errors.

**Step 3: Manual verification**

Open `/finance/reconciliation`, select the April session (3 items).

**Expected behavior (WITHOUT clicking AUTO-MATCH):**
- Left sidebar shows items classified: COCOK (green), POTENSI (amber), or BELUM based on match quality
- "Beli Mobil Raymond" Rp 500M should be COCOK (exact match in Jurnal Umum)
- Tab counts reflect actual scores: e.g. COCOK 1 | POTENSI 1 | BELUM 1
- Progress bar: 0/3 confirmed (scoring ≠ confirming)

**AUTO-MATCH button:**
- Still works — re-runs scoring AND auto-matches AUTO-tier items
- After clicking: AUTO-tier items become MATCHED, shown with [Konfirmasi] button

---

## Verification Guide

**Halaman:** `/finance/reconciliation`

**Sebelumnya (Before):** All items showed BELUM on load. User had to click AUTO-MATCH to see any scoring. Tab counts: COCOK 0 | POTENSI 0 | HAMPIR 0 | BELUM 3.

**Sekarang (Now):** Items are scored on session load. Exact matches show COCOK immediately. Good candidates show POTENSI. Tab counts reflect real match quality without manual action.

**Kenapa penting (Why it matters):** Users need instant visual feedback about match quality. Forcing them to click AUTO-MATCH just to see scores is a broken UX. The scoring engine exists — it just wasn't triggered at the right time.

**Cara Test:**
1. Go to `/finance/reconciliation`, open a session with bank items
2. Verify sidebar shows items in COCOK/POTENSI/HAMPIR layers (not all BELUM)
3. Verify tab counts are non-zero for layers with matches
4. Verify progress bar shows 0/N confirmed (scoring did NOT auto-confirm)
5. Click a COCOK item → right panel shows the match candidate
6. Click "Match" → item becomes MATCHED with COCOK classification → [Konfirmasi] button appears
7. Click AUTO-MATCH → re-scores all items AND auto-matches AUTO-tier
8. Verify previously scored items aren't re-scored unnecessarily
