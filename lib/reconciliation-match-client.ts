/**
 * Client-side 3-Tier Bank Reconciliation Matching.
 *
 * Pure functions — no server deps, runs in browser.
 * Uses `fastest-levenshtein` (already installed) for string similarity.
 *
 * TIER 1 — AUTO:      exact amount + exact name + (same date OR same ref)
 * TIER 2 — POTENTIAL:  amount ≤ Rp 6.500 + name similarity ≥ 0.65 + date ±1 day
 * TIER 3 — MANUAL:     everything else, ranked by composite score
 */

import { distance as levenshteinDistance } from "fastest-levenshtein"

// =============================================================================
// Types
// =============================================================================

export type ClientMatchTier = "AUTO" | "POTENTIAL" | "MANUAL"

export interface ClientBankLine {
    id: string
    bankDate: string | null   // ISO string
    bankAmount: number
    bankDescription: string | null
    bankRef: string | null
}

export interface ClientSystemEntry {
    entryId: string
    date: string              // ISO string
    amount: number            // positive = debit, negative = credit
    description: string
    lineDescription: string | null
    reference: string | null
}

export interface ClientMatchResult {
    entryId: string
    entry: ClientSystemEntry
    tier: ClientMatchTier
    score: number             // 0–100
    amountDiff: number
    nameSimilarity: number
    daysDiff: number
}

export interface TieredMatches {
    auto: ClientMatchResult[]
    potential: ClientMatchResult[]
    manual: ClientMatchResult[]
    /** Highest tier found: AUTO > POTENTIAL > MANUAL */
    bestTier: ClientMatchTier
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

function daysBetween(a: string | null, b: string): number {
    if (!a) return 999
    const da = new Date(a)
    const db = new Date(b)
    return Math.abs(Math.floor((da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24)))
}

// =============================================================================
// Reference overlap (document pattern matching)
// =============================================================================

function referenceOverlap(
    bankRef: string | null,
    bankDesc: string | null,
    txnRef: string | null,
    txnDesc: string
): boolean {
    if (!txnRef && !bankRef) return false

    const bankTokens = `${bankRef || ""} ${bankDesc || ""}`.toUpperCase()
    const txnTokens = `${txnRef || ""} ${txnDesc}`.toUpperCase()

    if (txnRef && bankTokens.includes(txnRef.toUpperCase())) return true
    if (bankRef && txnTokens.includes(bankRef.toUpperCase())) return true

    const docPattern = /(?:INV|PO|SO|GRN|JE|PAY|DN|CN)[-/]?\d{4}[-/]?\d{0,6}/gi
    const bankDocs = bankTokens.match(docPattern) || []
    const txnDocs = txnTokens.match(docPattern) || []

    return bankDocs.some((bd) => txnDocs.some((td) => bd === td))
}

// =============================================================================
// Tier Classification
// =============================================================================

/** TIER 1: exact amount + exact name + (same date OR same ref) */
function isAutoMatch(bank: ClientBankLine, entry: ClientSystemEntry): boolean {
    const amountMatch = Math.abs(bank.bankAmount) === Math.abs(entry.amount)
    if (!amountMatch) return false

    const bankName = (bank.bankDescription || "").trim().toUpperCase()
    const txnName = (entry.lineDescription || entry.description || "").trim().toUpperCase()
    const nameMatch = bankName === txnName
    if (!nameMatch) return false

    const dateMatch = daysBetween(bank.bankDate, entry.date) === 0
    const refMatch =
        normalizeRef(bank.bankRef) !== "" &&
        normalizeRef(entry.reference) !== "" &&
        normalizeRef(bank.bankRef) === normalizeRef(entry.reference)
    const docRefMatch = referenceOverlap(
        bank.bankRef,
        bank.bankDescription,
        entry.reference,
        entry.lineDescription || entry.description
    )

    return dateMatch || refMatch || docRefMatch
}

/** TIER 2: amount ≤ Rp 6.500 + name similarity ≥ 0.65 + date ±1 day */
function isPotentialMatch(
    bank: ClientBankLine,
    entry: ClientSystemEntry
): boolean {
    const amountDiff = Math.abs(Math.abs(bank.bankAmount) - Math.abs(entry.amount))
    if (amountDiff > 6500) return false

    const bankName = (bank.bankDescription || "").trim().toUpperCase()
    const txnName = (entry.lineDescription || entry.description || "").trim().toUpperCase()
    const nameSim = stringSimilarity(bankName, txnName)
    if (nameSim < 0.65) return false

    const days = daysBetween(bank.bankDate, entry.date)
    if (days > 1) return false

    return true
}

// =============================================================================
// Composite Score (0–100)
// =============================================================================

export function computeMatchScore(
    bank: ClientBankLine,
    entry: ClientSystemEntry
): { score: number; amountDiff: number; nameSimilarity: number; daysDiff: number } {
    const amountDiff = Math.abs(Math.abs(bank.bankAmount) - Math.abs(entry.amount))
    const amountScore = Math.max(0, 100 - amountDiff / 100)

    const bankName = (bank.bankDescription || "").trim().toUpperCase()
    const txnName = (entry.lineDescription || entry.description || "").trim().toUpperCase()
    const nameSimilarity = stringSimilarity(bankName, txnName)
    const nameScore = nameSimilarity * 100

    const daysDiff = daysBetween(bank.bankDate, entry.date)
    const dateScore = Math.max(0, 100 - daysDiff * 10)

    const score = Math.round(amountScore * 0.50 + nameScore * 0.35 + dateScore * 0.15)

    return { score, amountDiff, nameSimilarity, daysDiff }
}

// =============================================================================
// Main: Rank all system entries for a single bank line into 3 tiers
// =============================================================================

export function rankMatchesForBankLine(
    bankLine: ClientBankLine,
    systemEntries: ClientSystemEntry[]
): TieredMatches {
    const auto: ClientMatchResult[] = []
    const potential: ClientMatchResult[] = []
    const manual: ClientMatchResult[] = []

    for (const entry of systemEntries) {
        const { score, amountDiff, nameSimilarity, daysDiff } = computeMatchScore(bankLine, entry)

        if (isAutoMatch(bankLine, entry)) {
            auto.push({ entryId: entry.entryId, entry, tier: "AUTO", score: 100, amountDiff, nameSimilarity, daysDiff })
        } else if (isPotentialMatch(bankLine, entry)) {
            potential.push({ entryId: entry.entryId, entry, tier: "POTENTIAL", score, amountDiff, nameSimilarity, daysDiff })
        } else if (score > 10) {
            manual.push({ entryId: entry.entryId, entry, tier: "MANUAL", score, amountDiff, nameSimilarity, daysDiff })
        } else {
            // score ≤ 10 — still include in manual but at bottom
            manual.push({ entryId: entry.entryId, entry, tier: "MANUAL", score, amountDiff, nameSimilarity, daysDiff })
        }
    }

    // Sort each tier by score descending
    auto.sort((a, b) => b.score - a.score)
    potential.sort((a, b) => b.score - a.score)
    manual.sort((a, b) => b.score - a.score)

    const bestTier: ClientMatchTier =
        auto.length > 0 ? "AUTO" :
        potential.length > 0 ? "POTENTIAL" :
        "MANUAL"

    return { auto, potential, manual, bestTier }
}
