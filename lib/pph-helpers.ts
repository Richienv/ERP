// lib/pph-helpers.ts
// Sync PPh (withholding tax) calculation helpers.
// NOT "use server" — these are pure functions importable anywhere.

import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

export const PPH_RATES = {
  PPH_23_SERVICES: 2,
  PPH_23_ROYALTY: 15,
  PPH_4_2_RENT: 10,
  PPH_4_2_CONSTRUCTION_SMALL: 1.75,
  PPH_4_2_CONSTRUCTION_MED: 2.65,
  PPH_4_2_CONSTRUCTION_LARGE: 4,
} as const

export type PPhTypeValue = "PPH_21" | "PPH_23" | "PPH_4_2"

/** Default flat rate for a PPh type. PPh 21 returns 0 (progressive, calculated elsewhere). */
export function getDefaultRate(type: PPhTypeValue): number {
  switch (type) {
    case "PPH_23": return PPH_RATES.PPH_23_SERVICES
    case "PPH_4_2": return PPH_RATES.PPH_4_2_RENT
    case "PPH_21": return 0
  }
}

/** Calculate withholding amount and net payment. */
export function calculateWithholding(rate: number, baseAmount: number) {
  const amount = Math.round((rate / 100) * baseAmount)
  return { amount, netAmount: baseAmount - amount }
}

/**
 * Adjust rate when counterparty has no NPWP.
 * PPh 23 doubles. PPh 4(2) and PPh 21 are unaffected.
 */
export function adjustRateForNpwp(type: PPhTypeValue, rate: number, hasNpwp: boolean): number {
  if (hasNpwp) return rate
  if (type === "PPH_23") return rate * 2
  return rate
}

/** Deposit deadline: 10th of M+1. */
export function getDepositDeadline(txDate: Date): Date {
  const year = txDate.getFullYear()
  const month = txDate.getMonth() + 1 // next month (0-indexed + 1)
  if (month > 11) {
    return new Date(Date.UTC(year + 1, 0, 10))
  }
  return new Date(Date.UTC(year, month, 10))
}

/** Filing deadline: 20th of M+1. */
export function getFilingDeadline(txDate: Date): Date {
  const year = txDate.getFullYear()
  const month = txDate.getMonth() + 1 // next month (0-indexed + 1)
  if (month > 11) {
    return new Date(Date.UTC(year + 1, 0, 20))
  }
  return new Date(Date.UTC(year, month, 20))
}

/** Map PPh type to its GL liability account code. */
export function getPPhLiabilityAccount(type: PPhTypeValue): string {
  switch (type) {
    case "PPH_21": return SYS_ACCOUNTS.PPH_21_PAYABLE
    case "PPH_23": return SYS_ACCOUNTS.PPH_23_PAYABLE
    case "PPH_4_2": return SYS_ACCOUNTS.PPH_4_2_PAYABLE
  }
}
