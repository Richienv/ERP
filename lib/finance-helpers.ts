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
