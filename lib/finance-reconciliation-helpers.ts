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

  if (txnRef && bankTokens.includes(txnRef.toUpperCase())) return true
  if (bankRef && txnTokens.includes(bankRef.toUpperCase())) return true

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
        score: 100 - days,
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

  const confidenceOrder: Record<MatchConfidence, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 }
  results.sort((a, b) => {
    const confDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence]
    if (confDiff !== 0) return confDiff
    return b.score - a.score
  })

  return results
}
