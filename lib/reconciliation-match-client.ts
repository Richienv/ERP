/**
 * Client-side Bank Reconciliation Matching — thin adapter over server-side engine.
 *
 * Converts client types (string dates, nullable fields) to the server-side
 * BankLine/SystemTransaction types, delegates all scoring to
 * `finance-reconciliation-helpers.ts` (single source of truth), and adds
 * UI-specific fields (signals breakdown, matchedRefs for highlighting).
 */

import {
  computeMatchScore as serverScore,
  type BankLine,
  type SystemTransaction,
  type MatchSignals,
} from "@/lib/finance-reconciliation-helpers"

// Re-export for convenience
export type { MatchSignals }

// =============================================================================
// Client Types (string dates, nullable fields — as returned by the API)
// =============================================================================

export type ClientMatchTier = "AUTO" | "POTENTIAL" | "MANUAL"

export interface ClientBankLine {
  id: string
  bankDate: string | null // ISO string
  bankAmount: number
  bankDescription: string | null
  bankRef: string | null
}

export interface ClientSystemEntry {
  entryId: string
  date: string // ISO string
  amount: number // positive = debit, negative = credit
  description: string
  lineDescription: string | null
  reference: string | null
}

export interface ClientMatchResult {
  entryId: string
  entry: ClientSystemEntry
  tier: ClientMatchTier
  score: number // 0-100
  amountDiff: number
  nameSimilarity: number
  daysDiff: number
  signals: MatchSignals
  matchedRefs: string[] // doc numbers matched on both sides (for UI highlight)
}

export interface TieredMatches {
  auto: ClientMatchResult[]
  potential: ClientMatchResult[]
  manual: ClientMatchResult[]
  bestTier: ClientMatchTier
}

// =============================================================================
// Type Adapters — client types -> server types
// =============================================================================

function toBankLine(c: ClientBankLine): BankLine {
  return {
    id: c.id,
    bankDate: c.bankDate ? new Date(c.bankDate) : new Date(),
    bankAmount: c.bankAmount,
    bankDescription: c.bankDescription || "",
    bankRef: c.bankRef || "",
  }
}

function toSystemTxn(e: ClientSystemEntry): SystemTransaction {
  return {
    id: e.entryId,
    date: new Date(e.date),
    amount: e.amount,
    description: e.lineDescription || e.description || "",
    reference: e.reference,
  }
}

// =============================================================================
// Tier Classification (score-based, same thresholds as server)
// =============================================================================

function scoreTier(score: number, refSignal: number): ClientMatchTier {
  if (refSignal === 1.0 && score >= 70) return "AUTO"
  if (score >= 75) return "AUTO"
  if (score >= 40) return "POTENTIAL"
  return "MANUAL"
}

// =============================================================================
// Public API
// =============================================================================

export function computeMatchScore(
  bank: ClientBankLine,
  entry: ClientSystemEntry
) {
  return serverScore(toBankLine(bank), toSystemTxn(entry))
}

/**
 * Rank all system entries for a single bank line into 3 tiers.
 * Delegates scoring to the server-side engine via type adapters.
 *
 * Pre-filtering (direction, amount, date) is done server-side before
 * entries reach this function. This function only scores and classifies.
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
