// lib/gl-accounts-server.ts
// Server-only GL account functions that need Prisma.
// Client-safe constants (SYS_ACCOUNTS, isCOGSAccount, etc.) live in gl-accounts.ts.

import { SYS_ACCOUNTS } from "@/lib/gl-accounts"

// Re-export everything from gl-accounts so callers can import from one place
export { SYS_ACCOUNTS, getCashAccountCode, isCOGSAccount } from "@/lib/gl-accounts"

const SYSTEM_ACCOUNT_DEFS: { code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE" }[] = [
  { code: SYS_ACCOUNTS.CASH,             name: "Kas & Setara Kas",              type: "ASSET" },
  { code: SYS_ACCOUNTS.PETTY_CASH,       name: "Kas Kecil (Petty Cash)",        type: "ASSET" },
  { code: SYS_ACCOUNTS.BANK_BCA,         name: "Bank BCA",                      type: "ASSET" },
  { code: SYS_ACCOUNTS.BANK_MANDIRI,     name: "Bank Mandiri",                  type: "ASSET" },
  { code: SYS_ACCOUNTS.AR,               name: "Piutang Usaha",                 type: "ASSET" },
  { code: SYS_ACCOUNTS.ALLOWANCE_DOUBTFUL, name: "Cadangan Kerugian Piutang",    type: "ASSET" },
  { code: SYS_ACCOUNTS.INVENTORY_ASSET,  name: "Persediaan Barang Jadi",          type: "ASSET" },
  { code: SYS_ACCOUNTS.RAW_MATERIALS,   name: "Persediaan Bahan Baku",           type: "ASSET" },
  { code: SYS_ACCOUNTS.WIP,             name: "Persediaan Dalam Proses (WIP)",   type: "ASSET" },
  { code: SYS_ACCOUNTS.PPN_MASUKAN,      name: "PPN Masukan (Input VAT)",       type: "ASSET" },
  { code: SYS_ACCOUNTS.PPH_PREPAID,      name: "PPh Dibayar Dimuka",            type: "ASSET" },
  { code: SYS_ACCOUNTS.PPN_LEBIH_BAYAR,  name: "PPN Lebih Bayar",              type: "ASSET" },
  { code: SYS_ACCOUNTS.FA_LAND_BUILDING, name: "Tanah & Bangunan",               type: "ASSET" },
  { code: SYS_ACCOUNTS.FA_VEHICLE,       name: "Kendaraan",                       type: "ASSET" },
  { code: SYS_ACCOUNTS.FA_OFFICE_EQUIP,  name: "Peralatan Kantor",                type: "ASSET" },
  { code: SYS_ACCOUNTS.FA_MACHINERY,     name: "Mesin & Peralatan",               type: "ASSET" },
  { code: SYS_ACCOUNTS.FA_FURNITURE,     name: "Furnitur & Inventaris",           type: "ASSET" },
  { code: SYS_ACCOUNTS.FA_COMPUTER,      name: "Komputer & IT",                   type: "ASSET" },
  { code: SYS_ACCOUNTS.ACC_DEPRECIATION, name: "Akumulasi Penyusutan",          type: "ASSET" },
  { code: SYS_ACCOUNTS.GAIN_ON_DISPOSAL, name: "Laba Penjualan Aset Tetap",      type: "REVENUE" },
  { code: SYS_ACCOUNTS.AP,               name: "Utang Usaha (AP)",              type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPN_KELUARAN,     name: "Utang Pajak (PPN/PPh)",         type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH_21_PAYABLE,   name: "Utang PPh 21",                 type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH_23_PAYABLE,   name: "Utang PPh 23",                 type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH_4_2_PAYABLE,  name: "Utang PPh 4(2)",               type: "LIABILITY" },
  { code: SYS_ACCOUNTS.DEFERRED_REV,     name: "Pendapatan Diterima Dimuka",    type: "LIABILITY" },
  { code: SYS_ACCOUNTS.GR_IR_CLEARING,   name: "Barang Diterima / Faktur Belum Diterima", type: "LIABILITY" },
  { code: SYS_ACCOUNTS.SALARY_PAYABLE,   name: "Utang Gaji",                   type: "LIABILITY" },
  { code: SYS_ACCOUNTS.MFG_OVERHEAD_APPLIED, name: "Overhead Manufaktur Dibebankan", type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH21_PAYABLE,    name: "Utang PPh 21",                 type: "LIABILITY" },
  { code: SYS_ACCOUNTS.PPH23_PAYABLE,    name: "Utang PPh 23",                 type: "LIABILITY" },
  { code: SYS_ACCOUNTS.BPJS_TK_PAYABLE,  name: "Utang BPJS Ketenagakerjaan",   type: "LIABILITY" },
  { code: SYS_ACCOUNTS.BPJS_KES_PAYABLE, name: "Utang BPJS Kesehatan",         type: "LIABILITY" },
  { code: SYS_ACCOUNTS.UNEARNED_REVENUE, name: "Pendapatan Diterima Dimuka",    type: "LIABILITY" },
  { code: SYS_ACCOUNTS.RETAINED_EARNINGS, name: "Laba Ditahan",                  type: "EQUITY" },
  { code: SYS_ACCOUNTS.OPENING_EQUITY,    name: "Saldo Awal Ekuitas",             type: "EQUITY" },
  { code: SYS_ACCOUNTS.REVENUE,          name: "Pendapatan Penjualan",          type: "REVENUE" },
  { code: SYS_ACCOUNTS.SERVICE_REVENUE,  name: "Pendapatan Jasa",               type: "REVENUE" },
  { code: SYS_ACCOUNTS.OTHER_INCOME,     name: "Pendapatan Lain-lain",          type: "REVENUE" },
  { code: SYS_ACCOUNTS.INTEREST_INCOME,  name: "Pendapatan Bunga",              type: "REVENUE" },
  { code: SYS_ACCOUNTS.COGS,             name: "Beban Pokok Penjualan (HPP)",   type: "EXPENSE" },
  { code: SYS_ACCOUNTS.SALARY_EXPENSE,   name: "Beban Gaji",                    type: "EXPENSE" },
  { code: SYS_ACCOUNTS.DEPRECIATION,     name: "Beban Penyusutan",              type: "EXPENSE" },
  { code: SYS_ACCOUNTS.BAD_DEBT_EXPENSE, name: "Beban Kerugian Piutang",        type: "EXPENSE" },
  { code: SYS_ACCOUNTS.EXPENSE_DEFAULT,  name: "Beban Lain-lain",              type: "EXPENSE" },
  { code: SYS_ACCOUNTS.BANK_CHARGES,     name: "Beban Administrasi Bank",       type: "EXPENSE" },
  { code: SYS_ACCOUNTS.LOSS_WRITEOFF,   name: "Kerugian / Penghapusan",          type: "EXPENSE" },
  { code: SYS_ACCOUNTS.INV_ADJUSTMENT,  name: "Penyesuaian Persediaan",          type: "EXPENSE" },
]

let _ensured = false

/**
 * Ensures all system GL accounts exist in the database.
 * Uses upsert (create if missing, skip if exists).
 * Cached per process — in serverless (Vercel), resets on cold start (harmless, upserts are idempotent).
 */
export async function ensureSystemAccounts(
  prismaClient?: {
    gLAccount: {
      upsert: (args: {
        where: { code: string }
        create: { code: string; name: string; type: "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE"; balance: number; isSystem: boolean }
        update: Record<string, never>
      }) => Promise<unknown>
    }
  }
): Promise<void> {
  if (_ensured) return
  const db = prismaClient ?? (await import("@/lib/prisma")).prisma
  try {
    await Promise.all(SYSTEM_ACCOUNT_DEFS.map((def) =>
      db.gLAccount.upsert({
        where: { code: def.code },
        create: { code: def.code, name: def.name, type: def.type, balance: 0, isSystem: true },
        update: {}, // Don't overwrite existing name/type — user may have customized
      })
    ))
    _ensured = true
  } catch (error) {
    console.error("Failed to ensure system accounts:", error)
    // Don't cache failure — retry next time
  }
}
