/**
 * Pure functions for bank reconciliation matching.
 * No Prisma, no server actions — just matching logic.
 *
 * Performance: Uses a Map<amount, transactions[]> index for O(1) exact-amount
 * lookups instead of O(n) scanning. Nearby amounts (±Rp 100) use a sorted
 * array with binary search for O(log n) range queries.
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

  if (txnRef && bankTokens.includes(txnRef.toUpperCase())) return true
  if (bankRef && txnTokens.includes(bankRef.toUpperCase())) return true

  const docPattern = /(?:INV|PO|SO|GRN|JE|PAY|DN|CN)[-/]?\d{4}[-/]?\d{0,6}/gi
  const bankDocs = bankTokens.match(docPattern) || []
  const txnDocs = txnTokens.match(docPattern) || []

  return bankDocs.some(bd => txnDocs.some(td => bd === td))
}

/**
 * Pre-indexed transaction pool for efficient matching.
 * Build once, query many times — avoids O(n*m) when matching multiple bank lines.
 */
export interface TransactionIndex {
  /** Map from rounded absolute amount (integer cents) → transactions with that exact amount */
  exactMap: Map<number, SystemTransaction[]>
  /** Sorted by absolute amount for binary-search range queries */
  sortedByAmount: { absAmount: number; txn: SystemTransaction }[]
}

/**
 * Build an index over system transactions for fast lookups.
 * Call once before matching all bank lines.
 */
export function buildTransactionIndex(transactions: SystemTransaction[]): TransactionIndex {
  const exactMap = new Map<number, SystemTransaction[]>()
  const sortedByAmount: { absAmount: number; txn: SystemTransaction }[] = []

  for (const txn of transactions) {
    const absAmount = Math.abs(txn.amount)
    // Use integer key (rounded to nearest integer) for exact matching
    const key = Math.round(absAmount)

    const bucket = exactMap.get(key)
    if (bucket) {
      bucket.push(txn)
    } else {
      exactMap.set(key, [txn])
    }

    sortedByAmount.push({ absAmount, txn })
  }

  // Sort for binary search range queries
  sortedByAmount.sort((a, b) => a.absAmount - b.absAmount)

  return { exactMap, sortedByAmount }
}

/**
 * Binary search: find the leftmost index where absAmount >= target.
 */
function lowerBound(arr: { absAmount: number }[], target: number): number {
  let lo = 0
  let hi = arr.length
  while (lo < hi) {
    const mid = (lo + hi) >>> 1
    if (arr[mid].absAmount < target) lo = mid + 1
    else hi = mid
  }
  return lo
}

/**
 * Find matches for a single bank line against an indexed transaction pool.
 * Uses the index for O(1) exact-amount and O(log n + k) near-amount lookups.
 */
export function findMatchesIndexed(bankLine: BankLine, index: TransactionIndex): MatchResult[] {
  const results: MatchResult[] = []
  const absAmount = Math.abs(bankLine.bankAmount)
  const amountKey = Math.round(absAmount)

  // Set to track which transactions we've already scored
  const scored = new Set<string>()

  // Pass 1 & 2: Exact amount matches (HIGH and MEDIUM) — O(1) lookup
  const exactCandidates = index.exactMap.get(amountKey) || []
  for (const txn of exactCandidates) {
    const txnAmount = Math.abs(txn.amount)
    const amountDiff = Math.abs(absAmount - txnAmount)
    if (amountDiff > 0) continue // floating point mismatch after rounding

    const days = daysBetween(bankLine.bankDate, txn.date)
    if (days > 5) continue // too far for any match

    const hasRefMatch = referenceOverlap(bankLine.bankRef, bankLine.bankDescription, txn.reference, txn.description)
    scored.add(txn.id)

    if (days <= 3 && hasRefMatch) {
      results.push({
        transactionId: txn.id,
        confidence: "HIGH",
        score: 100 - days,
        reason: `Jumlah cocok, tanggal ±${days} hari, referensi cocok`,
      })
    } else if (days <= 3) {
      results.push({
        transactionId: txn.id,
        confidence: "MEDIUM",
        score: 70 - days,
        reason: `Jumlah cocok, tanggal ±${days} hari`,
      })
    }
  }

  // Pass 3: Near-amount matches (LOW) — binary search for range [absAmount - 100, absAmount + 100]
  const lo = lowerBound(index.sortedByAmount, absAmount - 100)
  for (let i = lo; i < index.sortedByAmount.length; i++) {
    const entry = index.sortedByAmount[i]
    if (entry.absAmount > absAmount + 100) break

    const txn = entry.txn
    if (scored.has(txn.id)) continue

    const amountDiff = Math.abs(absAmount - entry.absAmount)
    if (amountDiff === 0) continue // already handled in exact pass
    if (amountDiff > 100) continue

    const days = daysBetween(bankLine.bankDate, txn.date)
    if (days > 5) continue

    scored.add(txn.id)
    results.push({
      transactionId: txn.id,
      confidence: "LOW",
      score: 40 - days - (amountDiff / 10),
      reason: `Jumlah mirip (selisih ${Math.round(amountDiff)}), tanggal ±${days} hari`,
    })
  }

  const confidenceOrder: Record<MatchConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
  results.sort((a, b) => {
    const confDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    if (confDiff !== 0) return confDiff
    return b.score - a.score
  })

  return results
}

/**
 * Original findMatches — kept for backward compatibility.
 * For bulk matching, prefer buildTransactionIndex + findMatchesIndexed.
 */
export function findMatches(bankLine: BankLine, transactions: SystemTransaction[]): MatchResult[] {
  const index = buildTransactionIndex(transactions)
  return findMatchesIndexed(bankLine, index)
}
