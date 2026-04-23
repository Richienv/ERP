// lib/tax-rates.ts
// Centralized tax rate constants — ALL tax calculations MUST reference these.
// NEVER hardcode tax rates as numeric literals (0.11, 0.22) elsewhere.
//
// TODO: In the future, these should come from a system_settings table
// so users can configure rates per company/period.

/**
 * Standard tax rates for Indonesian business operations.
 * Rates are expressed as decimals (0.11 = 11%).
 */
export const TAX_RATES = {
  /** PPN (Pajak Pertambahan Nilai / VAT) — 11% since April 2022 */
  PPN: 0.11,

  /** PPh Badan (Corporate Income Tax) — 22% standard rate */
  CORPORATE: 0.22,

  /** PPh 21 (Employee Income Tax) — varies by bracket, this is the base rate */
  PPH21_BASE: 0.05,

  /** PPh 23 (Withholding Tax on services) — 2% standard */
  PPH23: 0.02,

  /** PPh 4(2) Final — Construction services — 2.5% */
  PPH_4_2_CONSTRUCTION: 0.025,

  /** PPh 4(2) Final — Rent of land/building — 10% */
  PPH_4_2_RENT: 0.10,
} as const

/**
 * Tax rate percentages (for display and form defaults).
 * Use TAX_RATES for calculations, TAX_PERCENT for UI display.
 */
export const TAX_PERCENT = {
  PPN: 11,
  CORPORATE: 22,
  PPH21_BASE: 5,
  PPH23: 2,
  PPH_4_2_CONSTRUCTION: 2.5,
  PPH_4_2_RENT: 10,
} as const
