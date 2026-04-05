/**
 * 3-Tier Bank Reconciliation Matching Engine.
 *
 * Composite scoring with 5 signals:
 *   amount (35%) + reference (25%) + description (20%) + date (10%) + direction (10%)
 *
 * TIER 1 — AUTO:      composite score >= 75 (or exact ref match + score >= 70)
 * TIER 2 — POTENTIAL:  composite score >= 40
 * TIER 3 — MANUAL:     composite score > 10
 *
 * Performance: Map<amount, txn[]> for O(1) exact lookups,
 * sorted array with binary search for O(log n) range queries.
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
  amount: number // positive = debit (money in), negative = credit (money out)
  description: string
  reference: string | null
}

export type MatchTier = "AUTO" | "POTENTIAL" | "MANUAL"

/** Legacy alias — maps AUTO->HIGH, POTENTIAL->MEDIUM, MANUAL->LOW */
export type MatchConfidence = "HIGH" | "MEDIUM" | "LOW"

export interface MatchSignals {
  amount: number // 0..1
  reference: number // 0..1
  description: number // 0..1
  date: number // 0..1
  direction: number // 0 or 1
}

export interface MatchResult {
  transactionId: string
  tier: MatchTier
  /** Legacy field — maps AUTO->HIGH, POTENTIAL->MEDIUM, MANUAL->LOW */
  confidence: MatchConfidence
  score: number // 0-100
  reason: string
  amountDiff: number
  nameSimilarity: number
  daysDiff: number
}

// =============================================================================
// String Similarity — Normalized Levenshtein (0..1)
// =============================================================================

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

export function normalizeRef(ref: string | null): string {
  if (!ref) return ""
  return ref
    .trim()
    .toUpperCase()
    .replace(/[\s\-_/]/g, "")
    .replace(/^0+/, "")
}

// =============================================================================
// Day calculation
// =============================================================================

function daysBetween(a: Date, b: Date): number {
  return Math.abs(
    Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24))
  )
}

// =============================================================================
// Task 1: Direction Gate
// =============================================================================

/**
 * Check if bank and GL amounts represent the same direction of cash flow.
 *
 * Bank statement: positive = deposit (money in), negative = withdrawal (money out).
 * GL (SystemTransaction.amount): positive = debit to bank (money in),
 *   negative = credit to bank (money out).
 *
 * A direction mismatch is an automatic disqualification (score = 0).
 */
function sameDirection(bankAmount: number, txnAmount: number): boolean {
  if (bankAmount >= 0 && txnAmount >= 0) return true
  if (bankAmount < 0 && txnAmount < 0) return true
  return false
}

// =============================================================================
// Task 2: Amount Scoring
// =============================================================================

/**
 * Dynamic amount tolerance for binary search range.
 * max(Rp 1,000 floor, 0.5% of transaction amount).
 */
function amountTolerance(amount: number): number {
  return Math.max(1000, Math.abs(amount) * 0.005)
}

/**
 * Tiered amount scoring (0..1).
 * Based on industry thresholds: Xero 0.5%, QBO 1%, Odoo 3%.
 */
function scoreAmount(bankAbs: number, glAbs: number): number {
  const diff = Math.abs(bankAbs - glAbs)
  const maxVal = Math.max(bankAbs, glAbs, 1)
  const pct = diff / maxVal

  if (diff === 0) return 1.0 // Exact match
  if (diff < 1) return 0.99 // Sub-rupiah rounding
  if (diff < 1000) return 0.95 // Rounding error < Rp 1.000
  if (pct < 0.005) return 0.9 // < 0.5% - Xero/QBO standard
  if (pct < 0.01) return 0.8 // < 1% - common bank admin fee
  if (pct < 0.02) return 0.65 // < 2% - e-wallet settlement fee
  if (pct < 0.03) return 0.45 // < 3% - Odoo default tolerance
  if (pct < 0.05) return 0.25 // < 5% - FX/cross-currency edge
  return 0 // > 5% = no credit
}

// =============================================================================
// Task 3: Description Normalization & Scoring
// =============================================================================

/** Indonesian bank description prefixes to strip before similarity comparison */
const BANK_PREFIXES = [
  "TRSF E-BANKING DR/",
  "TRSF E-BANKING CR/",
  "SWITCHING DEBIT ",
  "SWITCHING KREDIT ",
  "ATM TRANSFER ",
  "POS DEBIT ",
  "POS CREDIT ",
  "ATM TUNAI ",
  "SETORAN TUNAI",
  "TARIK TUNAI",
  "BIFAST/",
  "RTGS/",
  "SKN/",
  "QRIS",
  "TRF/",
  "TRF ",
  "VA ",
]

/**
 * Normalize bank description: strip known prefixes, replace separators
 * with spaces, remove non-alphanumeric noise, collapse whitespace.
 */
export function normalizeBankDescription(raw: string): string {
  let text = raw.toUpperCase().trim()
  for (const prefix of BANK_PREFIXES) {
    if (text.startsWith(prefix)) {
      text = text.slice(prefix.length).trim()
      break // only strip one prefix
    }
  }
  return text
    .replace(/[\/\-_\.]/g, " ")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Normalize any text for comparison (GL descriptions, etc.) */
function normalizeTextForComparison(text: string): string {
  return text
    .toUpperCase()
    .trim()
    .replace(/[\/\-_\.]/g, " ")
    .replace(/[^A-Z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Extract document/reference number tokens from a string.
 * Matches ERP doc patterns (INV-2026-001), Indonesian VA numbers (16 digits),
 * and transfer reference numbers (10-15 digits).
 */
export function extractDocNumbers(text: string): string[] {
  const patterns: RegExp[] = [
    /(?:INV|BILL|PO|SO|GRN|JE|PAY|DN|CN|PR|WO)[-\/]?\d{2,4}[-\/]?\d{1,6}/gi,
    /\b\d{16}\b/g, // Virtual account (16 digits)
    /\b\d{10,15}\b/g, // Transfer reference numbers
  ]
  const refs: string[] = []
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const cleaned = match[0]
        .toUpperCase()
        .replace(/[\s\-\/]/g, "")
        .replace(/^0+/, "")
      if (cleaned.length > 0 && !refs.includes(cleaned)) refs.push(cleaned)
    }
  }
  return refs
}

/**
 * Token-sort ratio: sort tokens alphabetically, then compute Levenshtein.
 * Makes "PT RICHIE CEPAT PAYMENT" match "PAYMENT PT RICHIE CEPAT".
 */
function tokenSortRatio(a: string, b: string): number {
  const tokensA = a
    .split(" ")
    .filter((t) => t.length > 2)
    .sort()
    .join(" ")
  const tokensB = b
    .split(" ")
    .filter((t) => t.length > 2)
    .sort()
    .join(" ")
  if (tokensA.length === 0 && tokensB.length === 0) return 1
  if (tokensA.length === 0 || tokensB.length === 0) return 0
  return stringSimilarity(tokensA, tokensB)
}

/**
 * Combined description scoring (0..1).
 * Uses token-sort ratio and Jaccard overlap, takes the max.
 */
function scoreDescription(bankDesc: string, glDesc: string): number {
  const bankNorm = normalizeBankDescription(bankDesc)
  const glNorm = normalizeTextForComparison(glDesc)

  if (bankNorm.length === 0 && glNorm.length === 0) return 1
  if (bankNorm.length === 0 || glNorm.length === 0) return 0

  // Token sort ratio (order-independent Levenshtein)
  const tokenScore = tokenSortRatio(bankNorm, glNorm)

  // Jaccard on token sets (word-level overlap)
  const bankTokens = new Set(bankNorm.split(" ").filter((t) => t.length > 2))
  const glTokens = new Set(glNorm.split(" ").filter((t) => t.length > 2))
  const intersection = new Set([...bankTokens].filter((t) => glTokens.has(t)))
  const union = new Set([...bankTokens, ...glTokens])
  const jaccardScore = union.size > 0 ? intersection.size / union.size : 0

  return Math.max(tokenScore, jaccardScore)
}

// =============================================================================
// Task 4: Reference & Date Scoring
// =============================================================================

/**
 * Score reference/document number match (0..1).
 * Exact match = 1.0, substring match = 0.85.
 */
export function scoreReference(bankRefs: string[], glRefs: string[]): number {
  if (bankRefs.length === 0 || glRefs.length === 0) return 0

  const bankNorm = bankRefs.map((r) =>
    r
      .toUpperCase()
      .replace(/[\s\-\/]/g, "")
      .replace(/^0+/, "")
  )
  const glNorm = glRefs.map((r) =>
    r
      .toUpperCase()
      .replace(/[\s\-\/]/g, "")
      .replace(/^0+/, "")
  )

  for (const b of bankNorm) {
    for (const g of glNorm) {
      if (b === g) return 1.0 // Exact reference match
      if (b.includes(g) || g.includes(b)) return 0.85 // Substring match
    }
  }
  return 0
}

/**
 * Score date proximity (0..1).
 * Same day = 1.0, +/-1 day = 0.90, +/-3 = 0.75, +/-7 = 0.40, +/-14 = 0.15.
 */
function scoreDateProximity(bankDate: Date, glDate: Date): number {
  const diff = daysBetween(bankDate, glDate)
  if (diff === 0) return 1.0
  if (diff === 1) return 0.9
  if (diff <= 3) return 0.75
  if (diff <= 7) return 0.4
  if (diff <= 14) return 0.15
  return 0
}

// =============================================================================
// Composite Score
// =============================================================================

/** Composite score weights — sum = 1.0 */
const MATCH_WEIGHTS = {
  amount: 0.35,
  reference: 0.25,
  description: 0.2,
  date: 0.1,
  direction: 0.1,
} as const

/** Collect reference tokens from both bank line and GL transaction */
export function collectRefs(
  bankLine: BankLine,
  txn: SystemTransaction
): { bankRefs: string[]; glRefs: string[]; matchedRefs: string[] } {
  const bankRefs = extractDocNumbers(
    `${bankLine.bankRef} ${bankLine.bankDescription}`
  )
  const glRefs = extractDocNumbers(
    `${txn.reference || ""} ${txn.description}`
  )

  // Also add normalized explicit references if not already present
  if (bankLine.bankRef) {
    const nr = normalizeRef(bankLine.bankRef)
    if (nr && !bankRefs.includes(nr)) bankRefs.push(nr)
  }
  if (txn.reference) {
    const nr = normalizeRef(txn.reference)
    if (nr && !glRefs.includes(nr)) glRefs.push(nr)
  }

  // Find matched refs (for UI highlighting)
  const bNorm = bankRefs.map((r) => r.toUpperCase().replace(/[\s\-\/]/g, "").replace(/^0+/, ""))
  const gNorm = glRefs.map((r) => r.toUpperCase().replace(/[\s\-\/]/g, "").replace(/^0+/, ""))
  const matchedRefs: string[] = []
  for (const b of bNorm) {
    for (const g of gNorm) {
      if (b === g || b.includes(g) || g.includes(b)) {
        if (!matchedRefs.includes(b)) matchedRefs.push(b)
      }
    }
  }

  return { bankRefs, glRefs, matchedRefs }
}

/**
 * Compute composite match score for a bank line against a GL transaction.
 * Returns 0-100 score with individual signal values.
 *
 * 5 signals: amount (35%), reference (25%), description (20%), date (10%), direction (10%).
 * Direction mismatch = hard gate (score 0).
 * Exact reference match forces minimum score 75.
 */
export function computeMatchScore(
  bankLine: BankLine,
  txn: SystemTransaction
): {
  score: number
  amountDiff: number
  nameSimilarity: number
  daysDiff: number
  refSignal: number
  signals: MatchSignals
  matchedRefs: string[]
} {
  const amountDiff = Math.abs(
    Math.abs(bankLine.bankAmount) - Math.abs(txn.amount)
  )
  const dd = daysBetween(bankLine.bankDate, txn.date)

  // Direction hard gate
  if (!sameDirection(bankLine.bankAmount, txn.amount)) {
    const zeroSignals: MatchSignals = { amount: 0, reference: 0, description: 0, date: 0, direction: 0 }
    return { score: 0, amountDiff, nameSimilarity: 0, daysDiff: dd, refSignal: 0, signals: zeroSignals, matchedRefs: [] }
  }

  // Compute individual signals
  const { bankRefs, glRefs, matchedRefs } = collectRefs(bankLine, txn)

  const amtSignal = scoreAmount(
    Math.abs(bankLine.bankAmount),
    Math.abs(txn.amount)
  )
  const refSignal = scoreReference(bankRefs, glRefs)
  const descSignal = scoreDescription(bankLine.bankDescription, txn.description)
  const dateSignal = scoreDateProximity(bankLine.bankDate, txn.date)
  const dirSignal = 1.0

  const signals: MatchSignals = {
    amount: amtSignal,
    reference: refSignal,
    description: descSignal,
    date: dateSignal,
    direction: dirSignal,
  }

  let rawScore =
    amtSignal * MATCH_WEIGHTS.amount +
    refSignal * MATCH_WEIGHTS.reference +
    descSignal * MATCH_WEIGHTS.description +
    dateSignal * MATCH_WEIGHTS.date +
    dirSignal * MATCH_WEIGHTS.direction

  // OVERRIDE: exact reference match forces minimum HIGH_CONFIDENCE tier
  // regardless of other signal scores (mirrors SAP/NetSuite reference-first logic)
  if (refSignal === 1.0) {
    rawScore = Math.max(rawScore, 0.75)
  }

  const score = Math.min(100, Math.round(Math.min(1.0, rawScore) * 100))

  return { score, amountDiff, nameSimilarity: descSignal, daysDiff: dd, refSignal, signals, matchedRefs }
}

// =============================================================================
// Tier Classification
// =============================================================================

function scoreTier(score: number, refSignal: number): MatchTier {
  // Exact reference match with decent score forces AUTO
  if (refSignal === 1.0 && score >= 70) return "AUTO"
  if (score >= 75) return "AUTO"
  if (score >= 40) return "POTENTIAL"
  return "MANUAL"
}

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
// Transaction Index (for efficient bulk matching)
// =============================================================================

export interface TransactionIndex {
  /** Map from rounded absolute amount (integer) -> transactions */
  exactMap: Map<number, SystemTransaction[]>
  /** Sorted by absolute amount for binary-search range queries */
  sortedByAmount: { absAmount: number; txn: SystemTransaction }[]
  /** All transactions for Tier 3 manual scoring */
  all: SystemTransaction[]
}

export function buildTransactionIndex(
  transactions: SystemTransaction[]
): TransactionIndex {
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
// Build MatchResult from scoring data
// =============================================================================

function buildMatchResult(
  txnId: string,
  scoring: {
    score: number
    amountDiff: number
    nameSimilarity: number
    daysDiff: number
    refSignal: number
  }
): MatchResult {
  const tier = scoreTier(scoring.score, scoring.refSignal)
  const confidence = tierToConfidence(tier)

  let reason: string
  if (tier === "AUTO") {
    reason = `Cocok otomatis \u2014 skor ${scoring.score}%`
  } else {
    const parts: string[] = []
    if (scoring.amountDiff > 0)
      parts.push(
        `selisih Rp ${Math.round(scoring.amountDiff).toLocaleString("id-ID")}`
      )
    parts.push(`nama ${Math.round(scoring.nameSimilarity * 100)}%`)
    if (scoring.daysDiff > 0) parts.push(`\u00b1${scoring.daysDiff} hari`)
    reason = `Skor ${scoring.score}% \u2014 ${parts.join(", ")}`
  }

  return {
    transactionId: txnId,
    tier,
    confidence,
    score: scoring.score,
    reason,
    amountDiff: scoring.amountDiff,
    nameSimilarity: scoring.nameSimilarity,
    daysDiff: scoring.daysDiff,
  }
}

// =============================================================================
// Main: Find matches for a single bank line (3-tier)
// =============================================================================

/**
 * Find matches for a single bank line against an indexed transaction pool.
 * Uses 3-pass architecture for performance:
 *   Pass 1: exact amount (O(1) hash lookup)
 *   Pass 2: nearby amount (O(log n) binary search, percentage-based tolerance)
 *   Pass 3: all remaining within +/-30 days (manual suggestions)
 *
 * Tier classification is based on composite score, not which pass found the match.
 */
export function findMatchesIndexed(
  bankLine: BankLine,
  index: TransactionIndex
): MatchResult[] {
  const results: MatchResult[] = []
  const absAmount = Math.abs(bankLine.bankAmount)
  const amountKey = Math.round(absAmount)
  const scored = new Set<string>()

  // --- PASS 1: EXACT AMOUNT candidates (O(1) lookup) ---
  const exactCandidates = index.exactMap.get(amountKey) || []
  for (const txn of exactCandidates) {
    if (Math.abs(Math.abs(txn.amount) - absAmount) > 0.01) continue // float guard
    if (!sameDirection(bankLine.bankAmount, txn.amount)) continue // Task 1: direction gate

    scored.add(txn.id)
    const scoring = computeMatchScore(bankLine, txn)
    if (scoring.score > 10) {
      results.push(buildMatchResult(txn.id, scoring))
    }
  }

  // If we found AUTO matches, return all pass-1 results sorted (AUTO first)
  const hasAuto = results.some((r) => r.tier === "AUTO")
  if (hasAuto) {
    results.sort((a, b) => b.score - a.score)
    return results
  }

  // --- PASS 2: NEARBY AMOUNT (binary search, percentage-based tolerance) ---
  const tol = amountTolerance(bankLine.bankAmount)
  const lo = lowerBound(index.sortedByAmount, absAmount - tol)
  for (let i = lo; i < index.sortedByAmount.length; i++) {
    const entry = index.sortedByAmount[i]
    if (entry.absAmount > absAmount + tol) break

    const txn = entry.txn
    if (scored.has(txn.id)) continue
    if (!sameDirection(bankLine.bankAmount, txn.amount)) continue // Task 1

    scored.add(txn.id)
    const scoring = computeMatchScore(bankLine, txn)
    if (scoring.score > 10) {
      results.push(buildMatchResult(txn.id, scoring))
    }
  }

  // If we found POTENTIAL or better, sort and return
  const hasPotential = results.some((r) => r.tier !== "MANUAL")
  if (hasPotential) {
    results.sort((a, b) => b.score - a.score)
    return results
  }

  // --- PASS 3: ALL REMAINING (manual suggestions, +/-30 days) ---
  for (const txn of index.all) {
    if (scored.has(txn.id)) continue
    if (!sameDirection(bankLine.bankAmount, txn.amount)) continue // Task 1

    const days = daysBetween(bankLine.bankDate, txn.date)
    if (days > 30) continue

    const scoring = computeMatchScore(bankLine, txn)
    if (scoring.score > 10) {
      results.push(buildMatchResult(txn.id, scoring))
    }
  }

  results.sort((a, b) => b.score - a.score)
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
