// lib/gl-accounts.ts
// Centralized system GL account codes — ALL finance server actions MUST reference these.
// NEVER hardcode account codes as string literals elsewhere.
//
// These codes are ALIGNED with prisma/seed-gl.ts to avoid duplicate accounts.
// If you change a code here, update seed-gl.ts too.

import { prisma } from "@/lib/prisma"

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

  // --- Equity ---
  RETAINED_EARNINGS: "3100", // Laba Ditahan (for opening balances)
  OPENING_EQUITY:    "3900", // Saldo Awal Ekuitas (Opening Balance Equity)

  // --- Revenue ---
  REVENUE:        "4000",  // Pendapatan Penjualan (seed: 4000)

  // --- COGS ---
  COGS:           "5000",  // Beban Pokok Penjualan / HPP (seed: 5000)

  // --- Expenses ---
  EXPENSE_DEFAULT:"6900",  // Beban Lain-lain (generic expense for AP bills)
                           // NOT 6000 — Raymond's DB has 6000 as LIABILITY "Accrued Expenses"
  DEPRECIATION:   "6290",  // Beban Penyusutan (seed: 6290)

  // --- Losses & Adjustments ---
  LOSS_WRITEOFF:    "8200",  // Kerugian / Penghapusan
  INV_ADJUSTMENT:   "8300",  // Penyesuaian Persediaan

  // --- Accumulated Depreciation ---
  ACC_DEPRECIATION: "1590", // Akumulasi Penyusutan (seed: 1590)
} as const

const SYSTEM_ACCOUNT_DEFS: { code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" }[] = [
  { code: SYS_ACCOUNTS.CASH,             name: "Kas & Setara Kas",              type: "ASSET" },
  { code: SYS_ACCOUNTS.PETTY_CASH,       name: "Kas Kecil (Petty Cash)",        type: "ASSET" },
  { code: SYS_ACCOUNTS.BANK_BCA,         name: "Bank BCA",                      type: "ASSET" },
  { code: SYS_ACCOUNTS.BANK_MANDIRI,     name: "Bank Mandiri",                  type: "ASSET" },
  { code: SYS_ACCOUNTS.AR,               name: "Piutang Usaha",                 type: "ASSET" },
  { code: SYS_ACCOUNTS.INVENTORY_ASSET,  name: "Persediaan Barang Jadi",          type: "ASSET" },
  { code: SYS_ACCOUNTS.RAW_MATERIALS,   name: "Persediaan Bahan Baku",           type: "ASSET" },
  { code: SYS_ACCOUNTS.WIP,             name: "Persediaan Dalam Proses (WIP)",   type: "ASSET" },
  { code: SYS_ACCOUNTS.PPN_MASUKAN,      name: "PPN Masukan (Input VAT)",       type: "ASSET" },
  { code: SYS_ACCOUNTS.PPH_PREPAID,      name: "PPh Dibayar Dimuka",            type: "ASSET" },
  { code: SYS_ACCOUNTS.ACC_DEPRECIATION, name: "Akumulasi Penyusutan",          type: "ASSET" },
  { code: SYS_ACCOUNTS.AP,               name: "Utang Usaha (AP)",              type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPN_KELUARAN,     name: "Utang Pajak (PPN/PPh)",         type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH_21_PAYABLE,   name: "Utang PPh 21",                 type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH_23_PAYABLE,   name: "Utang PPh 23",                 type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH_4_2_PAYABLE,  name: "Utang PPh 4(2)",               type: "LIABILITY" },
  { code: SYS_ACCOUNTS.DEFERRED_REV,     name: "Pendapatan Diterima Dimuka",    type: "LIABILITY" },
  { code: SYS_ACCOUNTS.RETAINED_EARNINGS, name: "Laba Ditahan",                  type: "EQUITY" },
  { code: SYS_ACCOUNTS.OPENING_EQUITY,    name: "Saldo Awal Ekuitas",             type: "EQUITY" },
  { code: SYS_ACCOUNTS.REVENUE,          name: "Pendapatan Penjualan",          type: "REVENUE" },
  { code: SYS_ACCOUNTS.COGS,             name: "Beban Pokok Penjualan (HPP)",   type: "EXPENSE" },
  { code: SYS_ACCOUNTS.EXPENSE_DEFAULT,  name: "Beban Lain-lain",              type: "EXPENSE" },
  { code: SYS_ACCOUNTS.DEPRECIATION,     name: "Beban Penyusutan",              type: "EXPENSE" },
  { code: SYS_ACCOUNTS.LOSS_WRITEOFF,   name: "Kerugian / Penghapusan",          type: "EXPENSE" },
  { code: SYS_ACCOUNTS.INV_ADJUSTMENT,  name: "Penyesuaian Persediaan",          type: "EXPENSE" },
]

let _ensured = false

/**
 * Ensures all system GL accounts exist in the database.
 * Uses upsert (create if missing, skip if exists).
 * Cached per process — in serverless (Vercel), resets on cold start (harmless, upserts are idempotent).
 */
export async function ensureSystemAccounts(): Promise<void> {
  if (_ensured) return
  try {
    for (const def of SYSTEM_ACCOUNT_DEFS) {
      await prisma.gLAccount.upsert({
        where: { code: def.code },
        create: { code: def.code, name: def.name, type: def.type, balance: 0 },
        update: {}, // Don't overwrite existing name/type — user may have customized
      })
    }
    _ensured = true
  } catch (error) {
    console.error("Failed to ensure system accounts:", error)
    // Don't cache failure — retry next time
  }
}

/**
 * Resolves a cash/bank account code based on payment method.
 * For TRANSFER/CHECK/GIRO, uses the provided bankAccountCode or defaults to Bank BCA.
 */
export function getCashAccountCode(method: string, bankAccountCode?: string): string {
  if (method === "CASH") return SYS_ACCOUNTS.CASH
  return bankAccountCode || SYS_ACCOUNTS.BANK_BCA
}
