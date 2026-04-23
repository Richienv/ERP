// lib/gl-accounts.ts
// Centralized system GL account codes — ALL finance server actions MUST reference these.
// NEVER hardcode account codes as string literals elsewhere.
//
// These codes are ALIGNED with prisma/seed-gl.ts to avoid duplicate accounts.
// If you change a code here, update seed-gl.ts too.

// This file is CLIENT-SAFE — no prisma or server imports.
// Server-only functions (ensureSystemAccounts) live in gl-accounts-server.ts.

/**
 * System account codes used across all finance modules.
 * Code scheme follows Indonesian standard COA (PSAK):
 *   1xxx = Assets, 2xxx = Liabilities, 3xxx = Equity,
 *   4xxx = Revenue, 5xxx = COGS, 6xxx = Operating Expenses
 */
export const SYS_ACCOUNTS = {
  // --- Cash & Bank (aligned with seed-gl.ts) ---
  CASH:           "1000",  // Kas & Setara Kas
  BANK_BCA:       "1110",  // Bank BCA (seed: 1110)
  BANK_MANDIRI:   "1111",  // Bank Mandiri (seed: 1111)
  PETTY_CASH:     "1050",  // Kas Kecil (matches PETTY_CASH_ACCOUNT in finance-petty-cash.ts)

  // --- Receivables ---
  AR:             "1200",  // Piutang Usaha (seed: 1200)
  ALLOWANCE_DOUBTFUL: "1210", // Cadangan Kerugian Piutang (contra-asset, CREDIT normal balance)

  // --- Inventory ---
  INVENTORY_ASSET: "1300",  // Persediaan Barang Jadi (Finished Goods)
  RAW_MATERIALS:   "1310",  // Persediaan Bahan Baku
  WIP:             "1320",  // Persediaan Dalam Proses (Work in Progress)

  // --- Tax Assets ---
  PPN_MASUKAN:    "1330",  // PPN Masukan (Input VAT) — added to seed
  PPH_PREPAID:    "1340",  // PPh Dibayar Dimuka (when customer withholds from us)

  // --- Payables ---
  AP:             "2000",  // Hutang Usaha / Utang Usaha (seed: 2000)

  // --- Tax Liabilities ---
  PPN_KELUARAN:   "2110",  // Utang Pajak PPN/PPh (seed: 2110)
  PPH_21_PAYABLE: "2210",  // Utang PPh 21 (employee payroll withholding)
  PPH_23_PAYABLE: "2220",  // Utang PPh 23 (vendor service withholding)
  PPH_4_2_PAYABLE: "2230", // Utang PPh 4(2) (final tax: rent, construction)

  // --- Deferred Revenue ---
  DEFERRED_REV:   "2121",  // Pendapatan Diterima Dimuka

  // --- GR/IR Clearing ---
  GR_IR_CLEARING: "2150",  // Barang Diterima / Faktur Belum Diterima

  // --- Payroll & Benefit Liabilities ---
  SALARY_PAYABLE:    "2200",  // Utang Gaji
  MFG_OVERHEAD_APPLIED: "2210", // Overhead Manufaktur Dibebankan
  PPH21_PAYABLE:     "2310",  // Utang PPh 21
  PPH23_PAYABLE:     "2315",  // Utang PPh 23
  BPJS_TK_PAYABLE:   "2320",  // Utang BPJS Ketenagakerjaan
  BPJS_KES_PAYABLE:  "2330",  // Utang BPJS Kesehatan

  // --- Equity ---
  RETAINED_EARNINGS: "3100", // Laba Ditahan (for opening balances)
  OPENING_EQUITY:    "3900", // Saldo Awal Ekuitas (Opening Balance Equity)

  // --- Revenue ---
  REVENUE:        "4000",  // Pendapatan Penjualan (seed: 4000)
  SERVICE_REVENUE: "4200",  // Pendapatan Jasa
  OTHER_INCOME:    "4300",  // Pendapatan Lain-lain
  INTEREST_INCOME: "4400",  // Pendapatan Bunga

  // --- COGS ---
  COGS:           "5000",  // Beban Pokok Penjualan / HPP (seed: 5000)

  // --- Expenses ---
  SALARY_EXPENSE: "6100",  // Beban Gaji
  DEPRECIATION:   "6290",  // Beban Penyusutan (seed: 6290)
  BAD_DEBT_EXPENSE: "6500", // Beban Kerugian Piutang
  EXPENSE_DEFAULT:"6900",  // Beban Lain-lain (generic expense for AP bills)
                           // NOT 6000 — Raymond's DB has 6000 as LIABILITY "Accrued Expenses"

  // --- Other Expenses ---
  BANK_CHARGES:   "7200",  // Beban Administrasi Bank

  // --- Losses & Adjustments ---
  LOSS_WRITEOFF:    "8200",  // Kerugian / Penghapusan
  INV_ADJUSTMENT:   "8300",  // Penyesuaian Persediaan

  // --- Tax Carry-Forward ---
  PPN_LEBIH_BAYAR: "1410",  // PPN Lebih Bayar (Input Tax Carry-Forward)

  // --- Accumulated Depreciation ---
  ACC_DEPRECIATION: "1590", // Akumulasi Penyusutan (seed: 1590)

  // --- Fixed Assets (Aset Tetap) — 1500-series ---
  FA_LAND_BUILDING: "1500", // Tanah & Bangunan
  FA_VEHICLE:       "1510", // Kendaraan
  FA_OFFICE_EQUIP:  "1520", // Peralatan Kantor
  FA_MACHINERY:     "1530", // Mesin & Peralatan
  FA_COMPUTER:      "1540", // Komputer & IT
  FA_FURNITURE:     "1550", // Furnitur & Inventaris
} as const

/**
 * Resolves a cash/bank account code based on payment method.
 * For TRANSFER/CHECK/GIRO, uses the provided bankAccountCode or defaults to Bank BCA.
 */
export function getCashAccountCode(method: string, bankAccountCode?: string): string {
  if (method === "CASH") return bankAccountCode || SYS_ACCOUNTS.PETTY_CASH
  return bankAccountCode || SYS_ACCOUNTS.BANK_BCA
}

/**
 * Determines if a GL account is a Cost of Goods Sold (COGS / HPP) account.
 * Uses both code range (5000-5099) and name-based detection for flexibility.
 *
 * Used by P&L report to properly classify COGS vs operating expenses.
 */
export function isCOGSAccount(account: { code: string; name: string; type: string }): boolean {
  if (account.type !== "EXPENSE") return false
  // Code range: 5000-5099 are COGS accounts
  if (account.code >= "5000" && account.code < "5100") return true
  // Name-based fallback for accounts outside standard code range
  const lowerName = account.name.toLowerCase()
  return (
    lowerName.includes("harga pokok") ||
    lowerName.includes("hpp") ||
    lowerName.includes("cost of goods") ||
    lowerName.includes("cogs") ||
    lowerName.includes("beban pokok")
  )
}
