/**
 * 3-Tier Bank Reconciliation Matching Engine.
 *
 * TIER 1 — AUTOMATCH: exact amount + exact name + (same date OR same ref)
 * TIER 2 — POTENTIAL: amount ≤ Rp 6.500 diff + name similarity ≥ 0.75 + date ±3 days
 * TIER 3 — MANUAL: everything else (scored for ranking)
 *
 * Performance: Uses Map<amount, transactions[]> index for O(1) exact-amount
 * lookups. Nearby amounts use sorted array with binary search O(log n).
 */

import { distance as levenshteinDistance } from "fastest-levenshtein"

// =============================================================================
// Types
// =============================================================================

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

export type MatchTier = "AUTO" | "POTENTIAL" | "MANUAL"

/** Legacy alias kept for backward compat with existing server action code */
export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW"

export interface MatchResult {
  transactionId: string
  tier: MatchTier
  /** Legacy field — maps AUTO→HIGH, POTENTIAL→MEDIUM, MANUAL→LOW */
  confidence: MatchConfidence
  score: number // 0–100
  reason: string
  amountDiff: number
  nameSimilarity: number
  daysDiff: number
}

// =============================================================================
// String Similarity — Normalized Levenshtein (0..1)
// =============================================================================

/**
 * Compute normalized similarity between two strings.
 * Returns 0..1 where 1 = identical.
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1
  if (a.length === 0 || b.length === 0) return 0
  const maxLen = Math.max(a.length, b.length)
  const dist = levenshteinDistance(a, b)
  return 1 - dist / maxLen
}

// =============================================================================
// Reference Normalization
// =============================================================================

/**
 * Normalize a reference string for comparison:
 * strip spaces, dashes, slashes, underscores, leading zeros → uppercase.
 */
export function normalizeRef(ref: string | null): string {
  if (!ref) return ""
  return ref
    .trim()
    .toUpperCase()
    .replace(/[\s\-_/]/g, "") // remove spaces, dashes, slashes
    .replace(/^0+/, "") // strip leading zeros
}

// =============================================================================
// Day calculation
// =============================================================================

function daysBetween(a: Date, b: Date): number {
  return Math.abs(Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)))
}

// =============================================================================
// Legacy reference overlap (kept for backward compat in document pattern matching)
// =============================================================================

function referenceOverlap(
  bankRef: string,
  bankDesc: string,
  txnRef: string | null,
  txnDesc: string
): boolean {
  if (!txnRef && !bankRef) return false

  const bankTokens = `${bankRef} ${bankDesc}`.toUpperCase()
  const txnTokens = `${txnRef || ""} ${txnDesc}`.toUpperCase()

  if (txnRef && bankTokens.includes(txnRef.toUpperCase())) return true
  if (bankRef && txnTokens.includes(bankRef.toUpperCase())) return true

  const docPattern = /(?:INV|PO|SO|GRN|JE|PAY|DN|CN)[-/]?\d{4}[-/]?\d{0,6}/gi
  const bankDocs = bankTokens.match(docPattern) || []
  const txnDocs = txnTokens.match(docPattern) || []

  return bankDocs.some((bd) => txnDocs.some((td) => bd === td))
}

// =============================================================================
// Tier Matching Functions
// =============================================================================

/** TIER 1: All 4 conditions must pass (amount exact + name exact + (date OR ref)) */
function isAutoMatch(bankLine: BankLine, txn: SystemTransaction): boolean {
  // Condition 1: Amount exact match
  const amountMatch = Math.abs(bankLine.bankAmount) === Math.abs(txn.amount)
  if (!amountMatch) return false

  // Condition 2: Name exact match (trimmed + uppercased)
  const bankName = bankLine.bankDescription.trim().toUpperCase()
  const txnName = txn.description.trim().toUpperCase()
  const nameMatch = bankName === txnName
  if (!nameMatch) return false

  // Condition 3 OR 4: Date same day OR Reference match (at least one)
  const dateMatch = daysBetween(bankLine.bankDate, txn.date) === 0
  const refMatch =
    normalizeRef(bankLine.bankRef) !== "" &&
    normalizeRef(txn.reference) !== "" &&
    normalizeRef(bankLine.bankRef) === normalizeRef(txn.reference)

  // Also check document reference overlap as additional ref matching
  const docRefMatch = referenceOverlap(
    bankLine.bankRef,
    bankLine.bankDescription,
    txn.reference,
    txn.description
  )

  return dateMatch || refMatch || docRefMatch
}

/** TIER 2: Fuzzy matching — amount ≤ Rp 6.500 + name similarity ≥ 0.75 + date ±3 days */
function isPotentialMatch(
  bankLine: BankLine,
  txn: SystemTransaction
): { match: boolean; amountDiff: number; nameSimilarity: number; daysDiff: number } {
  const amountDiff = Math.abs(Math.abs(bankLine.bankAmount) - Math.abs(txn.amount))
  const amountClose = amountDiff <= 6500

  const bankName = bankLine.bankDescription.trim().toUpperCase()
  const txnName = txn.description.trim().toUpperCase()
  const nameSimilarity = stringSimilarity(bankName, txnName)
  const nameClose = nameSimilarity >= 0.75

  const daysDiff = daysBetween(bankLine.bankDate, txn.date)
  const dateClose = daysDiff <= 3

  return {
    match: amountClose && nameClose && dateClose,
    amountDiff,
    nameSimilarity,
    daysDiff,
  }
}

// =============================================================================
// Composite Score (0–100)
// =============================================================================

/**
 * Compute a composite match score for ranking.
 * Weights: amount 50%, name 35%, date 15%.
 */
export function computeMatchScore(
  bankLine: BankLine,
  txn: SystemTransaction
): { score: number; amountDiff: number; nameSimilarity: number; daysDiff: number } {
  const amountDiff = Math.abs(Math.abs(bankLine.bankAmount) - Math.abs(txn.amount))
  // Penalize by amount diff: -1 point per Rp 100 difference, floor at 0
  const amountScore = Math.max(0, 100 - amountDiff / 100)

  const bankName = bankLine.bankDescription.trim().toUpperCase()
  const txnName = txn.description.trim().toUpperCase()
  const nameSimilarity = stringSimilarity(bankName, txnName)
  const nameScore = nameSimilarity * 100

  const daysDiff = daysBetween(bankLine.bankDate, txn.date)
  // -10 per day difference, floor at 0
  const dateScore = Math.max(0, 100 - daysDiff * 10)

  const score = Math.round(amountScore * 0.5 + nameScore * 0.35 + dateScore * 0.15)

  return { score, amountDiff, nameSimilarity, daysDiff }
}

// =============================================================================
// Transaction Index (for efficient bulk matching)
// =============================================================================

export interface TransactionIndex {
  /** Map from rounded absolute amount (integer) → transactions */
  exactMap: Map<number, SystemTransaction[]>
  /** Sorted by absolute amount for binary-search range queries */
  sortedByAmount: { absAmount: number; txn: SystemTransaction }[]
  /** All transactions for Tier 3 manual scoring */
  all: SystemTransaction[]
}

export function buildTransactionIndex(transactions: SystemTransaction[]): TransactionIndex {
  const exactMap = new Map<number, SystemTransaction[]>()
  const sortedByAmount: { absAmount: number; txn: SystemTransaction }[] = []

  for (const txn of transactions) {
    const absAmount = Math.abs(txn.amount)
    const key = Math.round(absAmount)

    const bucket = exactMap.get(key)
    if (bucket) {
      bucket.push(txn)
    } else {
      exactMap.set(key, [txn])
    }

    sortedByAmount.push({ absAmount, txn })
  }

  sortedByAmount.sort((a, b) => a.absAmount - b.absAmount)

  return { exactMap, sortedByAmount, all: transactions }
}

// =============================================================================
// Binary search helper
// =============================================================================

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

// =============================================================================
// Tier-to-confidence mapping
// =============================================================================

function tierToConfidence(tier: MatchTier): MatchConfidence {
  switch (tier) {
    case "AUTO":
      return "HIGH"
    case "POTENTIAL":
      return "MEDIUM"
    case "MANUAL":
      return "LOW"
  }
}

// =============================================================================
// Main: Find matches for a single bank line (3-tier)
// =============================================================================

/**
 * Find matches for a single bank line against an indexed transaction pool.
 * Returns results classified into AUTO / POTENTIAL / MANUAL tiers.
 */
export function findMatchesIndexed(
  bankLine: BankLine,
  index: TransactionIndex
): MatchResult[] {
  const results: MatchResult[] = []
  const absAmount = Math.abs(bankLine.bankAmount)
  const amountKey = Math.round(absAmount)
  const scored = new Set<string>()

  // ─── PASS 1: AUTOMATCH (exact amount candidates) ───
  const exactCandidates = index.exactMap.get(amountKey) || []
  for (const txn of exactCandidates) {
    if (Math.abs(Math.abs(txn.amount) - absAmount) > 0.01) continue // float guard

    if (isAutoMatch(bankLine, txn)) {
      scored.add(txn.id)
      const { amountDiff, nameSimilarity, daysDiff } = computeMatchScore(bankLine, txn)
      results.push({
        transactionId: txn.id,
        tier: "AUTO",
        confidence: "HIGH",
        score: 100,
        reason: `Jumlah & nama cocok, ${daysDiff === 0 ? "tanggal sama" : "referensi cocok"}`,
        amountDiff,
        nameSimilarity,
        daysDiff,
      })
    }
  }

  // If we found an AUTO match, return immediately (best possible)
  if (results.length > 0) return results

  // ─── PASS 2: POTENTIAL MATCH (fuzzy, wider search) ───
  // Search within amount range: ±6500
  const lo = lowerBound(index.sortedByAmount, absAmount - 6500)
  for (let i = lo; i < index.sortedByAmount.length; i++) {
    const entry = index.sortedByAmount[i]
    if (entry.absAmount > absAmount + 6500) break

    const txn = entry.txn
    if (scored.has(txn.id)) continue

    const potentialResult = isPotentialMatch(bankLine, txn)
    if (potentialResult.match) {
      scored.add(txn.id)
      const { score } = computeMatchScore(bankLine, txn)
      results.push({
        transactionId: txn.id,
        tier: "POTENTIAL",
        confidence: "MEDIUM",
        score,
        reason: `Selisih Rp ${Math.round(potentialResult.amountDiff).toLocaleString("id-ID")}, kecocokan nama ${Math.round(potentialResult.nameSimilarity * 100)}%, ±${potentialResult.daysDiff} hari`,
        amountDiff: potentialResult.amountDiff,
        nameSimilarity: potentialResult.nameSimilarity,
        daysDiff: potentialResult.daysDiff,
      })
    }
  }

  // If we found POTENTIAL matches, sort by score and return
  if (results.length > 0) {
    results.sort((a, b) => b.score - a.score)
    return results
  }

  // ─── PASS 3: MANUAL — score ALL remaining transactions for ranking ───
  // Only include transactions within reasonable range (±30 days, any amount)
  for (const txn of index.all) {
    if (scored.has(txn.id)) continue

    const days = daysBetween(bankLine.bankDate, txn.date)
    if (days > 30) continue // too far for even manual suggestion

    const { score, amountDiff, nameSimilarity, daysDiff } = computeMatchScore(bankLine, txn)

    // Only include if score is meaningful (> 10)
    if (score > 10) {
      results.push({
        transactionId: txn.id,
        tier: "MANUAL",
        confidence: "LOW",
        score,
        reason: `Skor ${score}% — selisih Rp ${Math.round(amountDiff).toLocaleString("id-ID")}, nama ${Math.round(nameSimilarity * 100)}%, ±${daysDiff} hari`,
        amountDiff,
        nameSimilarity,
        daysDiff,
      })
    }
  }

  results.sort((a, b) => b.score - a.score)

  // Limit manual suggestions to top 10
  return results.slice(0, 10)
}

// =============================================================================
// Convenience wrapper (backward compat)
// =============================================================================

export function findMatches(
  bankLine: BankLine,
  transactions: SystemTransaction[]
): MatchResult[] {
  const index = buildTransactionIndex(transactions)
  return findMatchesIndexed(bankLine, index)
}
