# Bank Reconciliation Matching Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the 3-tier bank reconciliation matching engine to finance-expert accuracy — fixing a direction-sign bug, adding percentage-based tolerance, token-aware description matching, reference match scoring boost, and restoring the exclude/include workflow with correct EXCLUDED semantics.

**Architecture:** All matching logic lives in `lib/finance-reconciliation-helpers.ts` (pure functions, no DB). Server action fixes live in `lib/actions/finance-reconciliation.ts`. No new files — modifications only. Tests in `__tests__/bank-reconciliation-matching.test.ts` and `__tests__/bank-recon-auto-gl.test.ts`.

**Tech Stack:** TypeScript, Vitest, Prisma, fastest-levenshtein

---

## Audit Summary — What's Wrong Right Now

### Bug 1 (Critical): Direction-sign ignored
`Math.abs(bankLine.bankAmount) === Math.abs(txn.amount)` means a bank credit of +500,000 can match a GL line representing money going OUT (credit: 500,000). Real matching requires same sign:
- Bank `+` (money in) → should match GL debit (`txn.amount > 0`)
- Bank `−` (money out) → should match GL credit (`txn.amount < 0`)

### Bug 2 (Critical): closeReconciliation blocks EXCLUDED items
Line 1064–1068 of `finance-reconciliation.ts`:
```ts
matchStatus: { in: ['UNMATCHED', 'EXCLUDED'] }
```
This prevents closing when ANY item is EXCLUDED. But classifyReconciliationItem (bank charges, interest income) sets `matchStatus: 'MATCHED'` as a workaround — semantically wrong. Fix: EXCLUDED should be allowed on close; only UNMATCHED blocks.

### Bug 3: classifyReconciliationItem uses MATCHED (wrong semantics)
Bank charges have no matching GL entry yet — they're pending auto-GL creation on close. Setting them as `MATCHED` is a lie. Should be `EXCLUDED` with `excludeReason`.

### Weakness 1: Fixed Rp 6,500 amount tolerance
For a Rp 100,000,000 transaction, Rp 6,500 is 0.0065% — far too tight. For Rp 50,000, Rp 6,500 is 13% — too loose. Fix: use `max(Rp 1,000, amount × 0.5%)`.

### Weakness 2: Raw Levenshtein on bank descriptions is noisy
Bank descriptions: `"TRF/INV-2026-001/BCA/VENDOR-NAME"` vs ERP: `"Pembayaran Invoice INV-2026-001"`. Levenshtein gives ~0.3 similarity. Token extraction gets the doc number and gives 1.0 similarity. Fix: normalize + extract tokens before similarity.

### Weakness 3: Reference match not rewarded in score
A reference overlap is the strongest match signal but only helps Tier 1 (exact). In Tier 2/3, a reference substring match should add a large score bonus.

### Missing feature: Exclude/Include
There is no way for the user to manually exclude an item with a reason. `excludeReconciliationItem` and `includeReconciliationItem` were removed. Need to restore.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/finance-reconciliation-helpers.ts` | Modify | Core matching: direction-sign, token normalization, percentage tolerance, ref bonus |
| `lib/actions/finance-reconciliation.ts` | Modify | Fix closeReconciliation, classifyReconciliationItem, restore exclude/include |
| `prisma/schema.prisma` | Modify | Remove DEPRECATED comment from EXCLUDED enum |
| `__tests__/bank-reconciliation-matching.test.ts` | Modify | Add tests for direction-sign, percentage tolerance, token matching, ref bonus |
| `__tests__/bank-recon-auto-gl.test.ts` | Modify | Fix expectations for EXCLUDED status in classifyReconciliationItem |

---

## Task 1: Fix direction-sign in matching engine

**Files:**
- Modify: `lib/finance-reconciliation-helpers.ts`

The `SystemTransaction.amount` convention in the codebase is already: positive = debit (money in), negative = credit (money out). The bank statement amount follows the same: positive = deposit (money in), negative = withdrawal (money out). Currently both sides use `Math.abs()`, defeating the directional check.

- [ ] **Step 1: Write failing tests**

Open `__tests__/bank-reconciliation-matching.test.ts` and add this describe block after the existing ones:

```ts
describe("findMatches - direction-sign enforcement", () => {
  it("does NOT match bank credit (+) to GL credit (−) — same amount, wrong direction", () => {
    const bank = makeBank({ bankAmount: 5000000 }) // positive = deposit
    const txn = makeTxn({ amount: -5000000 }) // negative = CR bank (money out)
    const results = findMatches(bank, [txn])
    const highResults = results.filter((r) => r.confidence === "HIGH")
    expect(highResults).toHaveLength(0)
  })

  it("DOES match bank credit (+) to GL debit (+) — same direction", () => {
    const bank = makeBank({ bankAmount: 5000000 })
    const txn = makeTxn({ amount: 5000000 }) // positive = DR bank (money in)
    const results = findMatches(bank, [txn])
    expect(results[0].confidence).toBe("HIGH")
  })

  it("DOES match bank debit (−) to GL credit (−) — same direction", () => {
    const bank = makeBank({ bankAmount: -5000000 }) // withdrawal
    const txn = makeTxn({ amount: -5000000 }) // CR bank (money out)
    const results = findMatches(bank, [txn])
    expect(results[0].confidence).toBe("HIGH")
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: the "does NOT match" test fails (returns HIGH when it should not).

- [ ] **Step 3: Fix direction-sign in `isAutoMatch` and `isPotentialMatch`**

In `lib/finance-reconciliation-helpers.ts`, replace the amount matching logic:

```ts
// OLD (in isAutoMatch):
const amountMatch = Math.abs(bankLine.bankAmount) === Math.abs(txn.amount)

// NEW — same sign required:
function sameDirection(bankAmount: number, txnAmount: number): boolean {
  // Both positive (money in) or both negative (money out)
  if (bankAmount >= 0 && txnAmount >= 0) return true
  if (bankAmount < 0 && txnAmount < 0) return true
  return false
}
```

Then update `isAutoMatch`:
```ts
function isAutoMatch(bankLine: BankLine, txn: SystemTransaction): boolean {
  // Condition 1: Same direction + exact amount
  if (!sameDirection(bankLine.bankAmount, txn.amount)) return false
  const amountMatch = Math.abs(bankLine.bankAmount) === Math.abs(txn.amount)
  if (!amountMatch) return false
  // ... rest unchanged
}
```

Update `isPotentialMatch`:
```ts
function isPotentialMatch(bankLine, txn) {
  if (!sameDirection(bankLine.bankAmount, txn.amount)) {
    return { match: false, amountDiff: 0, nameSimilarity: 0, daysDiff: 0 }
  }
  // ... rest unchanged
}
```

Update `computeMatchScore`:
```ts
export function computeMatchScore(bankLine, txn) {
  if (!sameDirection(bankLine.bankAmount, txn.amount)) {
    return { score: 0, amountDiff: Infinity, nameSimilarity: 0, daysDiff: 0 }
  }
  // ... rest unchanged
}
```

Also update `findMatchesIndexed` — the index uses `Math.round(Math.abs(txn.amount))` which is fine for lookup, but the float guard must use signed amount:

```ts
// OLD:
if (Math.abs(Math.abs(txn.amount) - absAmount) > 0.01) continue

// NEW (add direction check):
if (!sameDirection(bankLine.bankAmount, txn.amount)) continue
if (Math.abs(Math.abs(txn.amount) - absAmount) > 0.01) continue
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: All tests pass including the 3 new direction tests.

- [ ] **Step 5: Commit**

```bash
git add lib/finance-reconciliation-helpers.ts __tests__/bank-reconciliation-matching.test.ts
git commit -m "fix(bank-recon): enforce direction-sign in matching — DR bank only matches DR GL"
```

---

## Task 2: Percentage-based amount tolerance

**Files:**
- Modify: `lib/finance-reconciliation-helpers.ts`

Replace the fixed Rp 6,500 threshold with `max(Rp 1,000, |amount| × 0.5%)`. This means:
- Rp 100,000 → tolerance Rp 500 (0.5%)
- Rp 10,000,000 → tolerance Rp 50,000 (0.5%)
- Rp 1,000 → tolerance Rp 1,000 (floor)

Also replace the score penalty formula (currently `-1 per Rp 100`) with a percentage-aware penalty.

- [ ] **Step 1: Write failing tests**

Add to `__tests__/bank-reconciliation-matching.test.ts`:

```ts
describe("findMatches - percentage-based amount tolerance", () => {
  it("POTENTIAL match: 0.3% amount diff on large transaction (within 0.5%)", () => {
    // Rp 10,000,000 transaction, Rp 30,000 diff = 0.3% — should be POTENTIAL
    const results = findMatches(
      makeBank({ bankAmount: 10000000 }),
      [makeTxn({ amount: 9970000, reference: null, description: "TRF MASUK" })]
    )
    const potentialOrAbove = results.filter((r) => r.confidence !== "LOW")
    expect(potentialOrAbove.length).toBeGreaterThan(0)
  })

  it("does NOT match as POTENTIAL: 1% diff on large transaction (outside 0.5%)", () => {
    // Rp 10,000,000 transaction, Rp 100,000 diff = 1% — should NOT be POTENTIAL
    const results = findMatches(
      makeBank({ bankAmount: 10000000 }),
      [makeTxn({ amount: 9900000, reference: null, description: "TRF MASUK" })]
    )
    const potentialResults = results.filter((r) => r.confidence === "MEDIUM")
    expect(potentialResults).toHaveLength(0)
  })

  it("POTENTIAL match: small transaction within Rp 1,000 floor", () => {
    // Rp 50,000 transaction, Rp 800 diff — within Rp 1,000 floor
    const results = findMatches(
      makeBank({ bankAmount: 50000 }),
      [makeTxn({ amount: 49200, reference: null, description: "TRF MASUK" })]
    )
    const potentialOrAbove = results.filter((r) => r.confidence !== "LOW")
    expect(potentialOrAbove.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: large-transaction POTENTIAL test fails (Rp 6,500 fixed limit can't match Rp 30,000 diff).

- [ ] **Step 3: Replace fixed tolerance with percentage-based**

In `lib/finance-reconciliation-helpers.ts`, add a helper and update `isPotentialMatch`:

```ts
/**
 * Compute dynamic amount tolerance for fuzzy matching.
 * Finance rule: max(Rp 1,000 floor, 0.5% of transaction amount).
 */
function amountTolerance(amount: number): number {
  return Math.max(1000, Math.abs(amount) * 0.005)
}
```

Then update `isPotentialMatch`:
```ts
function isPotentialMatch(bankLine, txn) {
  if (!sameDirection(bankLine.bankAmount, txn.amount)) {
    return { match: false, amountDiff: 0, nameSimilarity: 0, daysDiff: 0 }
  }
  const amountDiff = Math.abs(Math.abs(bankLine.bankAmount) - Math.abs(txn.amount))
  const tolerance = amountTolerance(bankLine.bankAmount)
  const amountClose = amountDiff <= tolerance
  // ... rest unchanged (name, date)
}
```

Update the binary search range in `findMatchesIndexed`:
```ts
// OLD:
const lo = lowerBound(index.sortedByAmount, absAmount - 6500)
for (let i = lo; ...) {
  if (entry.absAmount > absAmount + 6500) break

// NEW:
const tol = amountTolerance(bankLine.bankAmount)
const lo = lowerBound(index.sortedByAmount, absAmount - tol)
for (let i = lo; ...) {
  if (entry.absAmount > absAmount + tol) break
```

Update `computeMatchScore` amount penalty to be percentage-aware:
```ts
// OLD:
const amountScore = Math.max(0, 100 - amountDiff / 100)

// NEW — penalize as % of tolerance:
const tol = amountTolerance(bankLine.bankAmount)
const amountScore = Math.max(0, 100 - (amountDiff / tol) * 50)
// At 0 diff = 100, at tolerance = 50, beyond = decays to 0
```

- [ ] **Step 4: Run tests and confirm pass**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/finance-reconciliation-helpers.ts __tests__/bank-reconciliation-matching.test.ts
git commit -m "feat(bank-recon): percentage-based amount tolerance (max Rp 1k, 0.5% of amount)"
```

---

## Task 3: Token-based description normalization

**Files:**
- Modify: `lib/finance-reconciliation-helpers.ts`

Bank descriptions have structured prefixes and noise. ERP descriptions are human-readable. Levenshtein on raw strings fails. Solution: extract meaningful tokens from both sides, compare tokens, then fall back to Levenshtein on cleaned strings.

- [ ] **Step 1: Write failing tests**

Add to `__tests__/bank-reconciliation-matching.test.ts`:

```ts
describe("findMatches - token-based description matching", () => {
  it("AUTO match when doc number matches across different description formats", () => {
    // Bank: "TRF/INV-2026-001/BCA" vs ERP: "Pembayaran Invoice INV-2026-001"
    const results = findMatches(
      makeBank({
        bankDescription: "TRF/INV-2026-001/BCA",
        bankRef: "",
      }),
      [makeTxn({
        description: "Pembayaran Invoice INV-2026-001",
        reference: "INV-2026-001",
      })]
    )
    expect(results[0].confidence).toBe("HIGH")
  })

  it("POTENTIAL match when bank has RTGS prefix stripped and name matches", () => {
    const results = findMatches(
      makeBank({
        bankDescription: "RTGS/TRF VENDOR SUMBER JAYA",
        bankRef: "",
        bankAmount: 5000000,
      }),
      [makeTxn({
        description: "Transfer Vendor Sumber Jaya",
        reference: null,
        amount: 5000000,
      })]
    )
    const meaningful = results.filter((r) => r.confidence !== "LOW")
    expect(meaningful.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 2: Run tests and confirm failure**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: "TRF/INV-2026-001/BCA" vs "Pembayaran Invoice INV-2026-001" does not reach HIGH.

- [ ] **Step 3: Add `extractDocTokens` and `normalizeDescription` to helpers**

In `lib/finance-reconciliation-helpers.ts`, add after the `normalizeRef` function:

```ts
/** Common bank description prefixes to strip before similarity comparison */
const BANK_PREFIXES = /^(TRF|RTGS|IBFT|ATM|KLIRING|SKN|BI-FAST|TRANSFER|DEBIT|KREDIT)[/\s-]*/i

/**
 * Extract document number tokens from a string.
 * Matches patterns like INV-2026-001, PO-001, SO/2026/001, etc.
 */
export function extractDocTokens(text: string): string[] {
  const pattern = /(?:INV|PO|SO|GRN|JE|PAY|DN|CN|PR|WO)[-/]?\d{4}[-/]?\d{0,6}/gi
  return (text.match(pattern) || []).map((t) => t.toUpperCase().replace(/[/\-]/g, ""))
}

/**
 * Normalize a description for string similarity:
 * Strip bank prefixes, remove special chars, uppercase, collapse spaces.
 */
export function normalizeDescription(text: string): string {
  return text
    .replace(BANK_PREFIXES, "")
    .replace(/[/\-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

/**
 * Enhanced string similarity that checks doc token overlap first,
 * then falls back to Levenshtein on normalized descriptions.
 * Returns 0..1.
 */
export function enhancedSimilarity(a: string, b: string): number {
  // Step 1: Check document token overlap — highest signal
  const aTokens = extractDocTokens(a)
  const bTokens = extractDocTokens(b)
  if (aTokens.length > 0 && bTokens.length > 0) {
    const overlap = aTokens.filter((t) => bTokens.includes(t))
    if (overlap.length > 0) return 1.0 // doc number match = perfect similarity
  }

  // Step 2: Levenshtein on normalized descriptions
  const aNorm = normalizeDescription(a)
  const bNorm = normalizeDescription(b)
  return stringSimilarity(aNorm, bNorm)
}
```

- [ ] **Step 4: Wire `enhancedSimilarity` into matching functions**

Replace every `stringSimilarity(bankName, txnName)` call in `isAutoMatch`, `isPotentialMatch`, and `computeMatchScore` with `enhancedSimilarity`:

In `isAutoMatch`:
```ts
// OLD:
const bankName = bankLine.bankDescription.trim().toUpperCase()
const txnName = txn.description.trim().toUpperCase()
const nameMatch = bankName === txnName

// NEW:
const nameSimilarity = enhancedSimilarity(bankLine.bankDescription, txn.description)
const nameMatch = nameSimilarity >= 0.95 // near-perfect (allows for minor bank formatting)
```

In `isPotentialMatch`:
```ts
// OLD:
const bankName = bankLine.bankDescription.trim().toUpperCase()
const txnName = txn.description.trim().toUpperCase()
const nameSimilarity = stringSimilarity(bankName, txnName)

// NEW:
const nameSimilarity = enhancedSimilarity(bankLine.bankDescription, txn.description)
```

In `computeMatchScore`:
```ts
// OLD:
const bankName = bankLine.bankDescription.trim().toUpperCase()
const txnName = txn.description.trim().toUpperCase()
const nameSimilarity = stringSimilarity(bankName, txnName)

// NEW:
const nameSimilarity = enhancedSimilarity(bankLine.bankDescription, txn.description)
```

- [ ] **Step 5: Run tests and confirm pass**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: All tests pass including the new token matching tests.

- [ ] **Step 6: Commit**

```bash
git add lib/finance-reconciliation-helpers.ts __tests__/bank-reconciliation-matching.test.ts
git commit -m "feat(bank-recon): token-based description matching — extract doc numbers before Levenshtein"
```

---

## Task 4: Reference match bonus in composite score

**Files:**
- Modify: `lib/finance-reconciliation-helpers.ts`

A normalized reference match is the strongest possible signal — it means the bank recorded exactly the same doc number as the ERP. Currently this bonus only exists in Tier 1. Add it to `computeMatchScore` so it elevates Tier 2/3 suggestions when ref matches.

- [ ] **Step 1: Write failing test**

Add to `__tests__/bank-reconciliation-matching.test.ts`:

```ts
describe("findMatches - reference match score bonus", () => {
  it("reference match elevates score above non-ref match of same amount", () => {
    const bankItem = makeBank({ bankRef: "INV-2026-005", bankDescription: "INCOMING TRF", bankAmount: 7500000 })

    const txnWithRef = makeTxn({ id: "with-ref", reference: "INV-2026-005", amount: 7500000, description: "Some payment", date: new Date("2026-03-05") })
    const txnNoRef = makeTxn({ id: "no-ref", reference: null, amount: 7500000, description: "Some payment", date: new Date("2026-03-01") })

    const results = findMatches(bankItem, [txnWithRef, txnNoRef])
    const withRefResult = results.find((r) => r.transactionId === "with-ref")
    const noRefResult = results.find((r) => r.transactionId === "no-ref")

    expect(withRefResult).toBeDefined()
    expect(noRefResult).toBeDefined()
    expect(withRefResult!.score).toBeGreaterThan(noRefResult!.score)
  })
})
```

- [ ] **Step 2: Run test and confirm failure**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: test fails — both have same score since ref isn't used in scoring.

- [ ] **Step 3: Add ref bonus to `computeMatchScore`**

In `lib/finance-reconciliation-helpers.ts`, update `computeMatchScore`:

```ts
export function computeMatchScore(bankLine, txn) {
  if (!sameDirection(bankLine.bankAmount, txn.amount)) {
    return { score: 0, amountDiff: Infinity, nameSimilarity: 0, daysDiff: 0 }
  }

  const amountDiff = Math.abs(Math.abs(bankLine.bankAmount) - Math.abs(txn.amount))
  const tol = amountTolerance(bankLine.bankAmount)
  const amountScore = Math.max(0, 100 - (amountDiff / tol) * 50)

  const nameSimilarity = enhancedSimilarity(bankLine.bankDescription, txn.description)
  const nameScore = nameSimilarity * 100

  const daysDiff = daysBetween(bankLine.bankDate, txn.date)
  const dateScore = Math.max(0, 100 - daysDiff * 10)

  // Reference match bonus: +25 points if ref strings overlap (normalized)
  const refNormBank = normalizeRef(bankLine.bankRef)
  const refNormTxn = normalizeRef(txn.reference)
  const refBonus =
    refNormBank !== "" &&
    refNormTxn !== "" &&
    (refNormBank.includes(refNormTxn) || refNormTxn.includes(refNormBank))
      ? 25
      : 0

  // Weights: amount 45%, name 30%, date 10%, ref bonus additive (capped at 100)
  const raw = Math.round(amountScore * 0.45 + nameScore * 0.30 + dateScore * 0.10 + refBonus)
  const score = Math.min(100, raw)

  return { score, amountDiff, nameSimilarity, daysDiff }
}
```

- [ ] **Step 4: Run tests and confirm pass**

```bash
npx vitest run __tests__/bank-reconciliation-matching.test.ts
```

Expected: All tests pass including ref bonus test.

- [ ] **Step 5: Commit**

```bash
git add lib/finance-reconciliation-helpers.ts __tests__/bank-reconciliation-matching.test.ts
git commit -m "feat(bank-recon): reference match bonus +25pts in composite score"
```

---

## Task 5: Fix closeReconciliation + classifyReconciliationItem + restore exclude/include

**Files:**
- Modify: `lib/actions/finance-reconciliation.ts`
- Modify: `prisma/schema.prisma`

Three bugs to fix in one task (they're tightly coupled):

1. `closeReconciliation` rejects EXCLUDED items — should only reject UNMATCHED
2. `classifyReconciliationItem` sets `MATCHED` (wrong) — should set `EXCLUDED` + `excludeReason`
3. `excludeReconciliationItem` and `includeReconciliationItem` are missing

- [ ] **Step 1: Write failing tests**

Open `__tests__/bank-recon-auto-gl.test.ts` and update the two existing failing tests. Find the block for `classifyReconciliationItem` and replace:

```ts
it('marks item as BANK_CHARGE with correct status and reason', async () => {
  const result = await classifyReconciliationItem('item-1', 'BANK_CHARGE')
  expect(result.success).toBe(true)
  expect(prismaMock.bankReconciliationItem.update).toHaveBeenCalledWith({
    where: { id: 'item-1' },
    data: {
      itemType: 'BANK_CHARGE',
      matchStatus: 'EXCLUDED',
      excludeReason: 'Biaya bank — jurnal otomatis saat finalisasi',
    },
  })
})

it('marks item as INTEREST_INCOME with correct status and reason', async () => {
  const result = await classifyReconciliationItem('item-2', 'INTEREST_INCOME')
  expect(result.success).toBe(true)
  expect(prismaMock.bankReconciliationItem.update).toHaveBeenCalledWith({
    where: { id: 'item-2' },
    data: {
      itemType: 'INTEREST_INCOME',
      matchStatus: 'EXCLUDED',
      excludeReason: 'Pendapatan bunga — jurnal otomatis saat finalisasi',
    },
  })
})
```

- [ ] **Step 2: Run test and confirm failure**

```bash
npx vitest run __tests__/bank-recon-auto-gl.test.ts
```

Expected: both tests fail because current code sets `matchStatus: 'MATCHED'`.

- [ ] **Step 3: Fix `classifyReconciliationItem` in `finance-reconciliation.ts`**

Find the `classifyReconciliationItem` function (around line 1031) and replace the update data:

```ts
// OLD:
data: {
  itemType,
  matchStatus: 'MATCHED',
},

// NEW:
data: {
  itemType,
  matchStatus: 'EXCLUDED',
  excludeReason: itemType === 'BANK_CHARGE'
    ? 'Biaya bank — jurnal otomatis saat finalisasi'
    : 'Pendapatan bunga — jurnal otomatis saat finalisasi',
},
```

- [ ] **Step 4: Fix `closeReconciliation` to allow EXCLUDED**

Find line ~1064 in `finance-reconciliation.ts` and update the unmatched count query:

```ts
// OLD:
const unmatchedCount = await prisma.bankReconciliationItem.count({
  where: {
    reconciliationId,
    matchStatus: { in: ['UNMATCHED', 'EXCLUDED'] },
  },
})

// NEW — EXCLUDED is allowed, only block on UNMATCHED:
const unmatchedCount = await prisma.bankReconciliationItem.count({
  where: {
    reconciliationId,
    matchStatus: 'UNMATCHED',
  },
})
```

Also update the error message:
```ts
error: `Masih ada ${unmatchedCount} item belum dicocokkan`,
```

- [ ] **Step 5: Restore `excludeReconciliationItem` and `includeReconciliationItem`**

Find the comment `// REMOVED: excludeReconciliationItem...` (around line 1196) and replace it with:

```ts
/**
 * Exclude a bank reconciliation item with a reason.
 * Used when an item is acknowledged but intentionally has no system match.
 */
export async function excludeReconciliationItem(
  itemId: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await withPrismaAuth(async (prisma: PrismaClient) => {
      await prisma.bankReconciliationItem.update({
        where: { id: itemId },
        data: {
          matchStatus: 'EXCLUDED',
          excludeReason: reason,
        },
      })
    })
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Gagal mengecualikan item'
    console.error("[excludeReconciliationItem] Error:", error)
    return { success: false, error: msg }
  }
}

/**
 * Re-include a previously excluded bank reconciliation item.
 * Resets to UNMATCHED so the user can match it normally.
 */
export async function includeReconciliationItem(
  itemId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await withPrismaAuth(async (prisma: PrismaClient) => {
      await prisma.bankReconciliationItem.update({
        where: { id: itemId },
        data: {
          matchStatus: 'UNMATCHED',
          excludeReason: null,
        },
      })
    })
    return { success: true }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Gagal mengembalikan item'
    console.error("[includeReconciliationItem] Error:", error)
    return { success: false, error: msg }
  }
}
```

- [ ] **Step 6: Fix EXCLUDED enum comment in schema.prisma**

In `prisma/schema.prisma` find:
```
EXCLUDED // DEPRECATED — remove in next major migration. No longer set by application code.
```
Replace with:
```
EXCLUDED // Dikecualikan — diakui namun tidak perlu dicocokkan (biaya bank, bunga, atau pengecualian manual)
```

- [ ] **Step 7: Run all tests and confirm pass**

```bash
npx vitest run __tests__/bank-recon-auto-gl.test.ts __tests__/bank-reconciliation-matching.test.ts
```

Expected: All tests pass.

- [ ] **Step 8: Commit**

```bash
git add lib/actions/finance-reconciliation.ts prisma/schema.prisma __tests__/bank-recon-auto-gl.test.ts
git commit -m "fix(bank-recon): EXCLUDED semantics — classify uses EXCLUDED, close allows EXCLUDED, restore exclude/include"
```

---

## Task 6: Full test suite run + verify

- [ ] **Step 1: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass, no regressions.

- [ ] **Step 2: Verify autoMatch still works end-to-end**

The `autoMatchReconciliation` function in `finance-reconciliation.ts` calls `findMatchesIndexed`. Confirm nothing broke by reading the function signature — no code change needed, but check the direction:

`SystemTransaction.amount` is built as: `const amount = debit > 0 ? debit : -credit`

This means:
- DR Cash 500,000 → `amount = +500,000` (money in)
- CR Cash 500,000 → `amount = -500,000` (money out)

Bank statement: deposit = positive, withdrawal = negative. ✓ Signs match — the direction fix works correctly.

- [ ] **Step 3: Final commit message if needed, then push**

```bash
git log --oneline -6
git push origin main
```

---

## Self-Review: Spec Coverage Check

| Issue | Task that addresses it |
|-------|----------------------|
| Direction-sign bug | Task 1 |
| Fixed Rp 6,500 tolerance | Task 2 |
| Noisy Levenshtein on raw bank descriptions | Task 3 |
| Reference match not rewarded in score | Task 4 |
| closeReconciliation blocks EXCLUDED | Task 5 |
| classifyReconciliationItem uses MATCHED (wrong) | Task 5 |
| Missing excludeReconciliationItem / includeReconciliationItem | Task 5 |
| EXCLUDED enum comment is misleading | Task 5 |

No gaps found.

## Placeholder Scan

All code blocks are complete. All test expectations are concrete. All file paths are exact. No "TBD" or "similar to above".

## Type Consistency Check

- `sameDirection(bankAmount: number, txnAmount: number): boolean` — used in Tasks 1, 2, 3, 4 ✓
- `amountTolerance(amount: number): number` — used in Tasks 2 and 4 ✓
- `enhancedSimilarity(a: string, b: string): number` — used in Tasks 3 and 4 ✓
- `extractDocTokens(text: string): string[]` — used in Task 3 ✓
- `normalizeDescription(text: string): string` — used in Task 3 ✓
- `MatchResult` shape unchanged throughout ✓
- `BankLine` and `SystemTransaction` interfaces unchanged ✓
