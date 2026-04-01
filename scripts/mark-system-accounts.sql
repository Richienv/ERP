-- ============================================================
-- Mark system GL accounts with isSystem = true
-- ============================================================
-- These accounts are auto-created by ensureSystemAccounts() and
-- are required for the ERP to function (journal entries reference them).
-- Run this ONCE to retroactively mark them.
--
-- DO NOT DELETE system accounts — they are needed for GL postings.
-- If you want to clean up accounts you don't need, only delete
-- accounts that are NOT in this list AND have zero balance AND
-- zero journal entries.
-- ============================================================

-- Step 1: Mark all system account codes as isSystem = true
UPDATE gl_accounts SET "isSystem" = true WHERE code IN (
  '1000', -- Kas & Setara Kas
  '1050', -- Kas Kecil (Petty Cash)
  '1110', -- Bank BCA
  '1111', -- Bank Mandiri
  '1200', -- Piutang Usaha
  '1210', -- Cadangan Kerugian Piutang
  '1300', -- Persediaan Barang Jadi
  '1310', -- Persediaan Bahan Baku
  '1320', -- Persediaan Dalam Proses (WIP)
  '1330', -- PPN Masukan
  '1340', -- PPh Dibayar Dimuka
  '1350', -- PPN Lebih Bayar
  '1400', -- Akumulasi Penyusutan
  '2000', -- Utang Usaha (AP)
  '2110', -- Utang Pajak (PPN/PPh)
  '2210', -- Utang PPh 21
  '2220', -- Utang PPh 23
  '2230', -- Utang PPh 4(2)
  '2300', -- Pendapatan Diterima Dimuka
  '2400', -- GR/IR Clearing
  '2500', -- Utang Gaji
  '2600', -- Overhead Manufaktur Dibebankan
  '2211', -- Utang PPh 21 (duplicate code check)
  '2221', -- Utang PPh 23 (duplicate code check)
  '2510', -- Utang BPJS Ketenagakerjaan
  '2520', -- Utang BPJS Kesehatan
  '2301', -- Pendapatan Diterima Dimuka (unearned)
  '3100', -- Laba Ditahan
  '3900', -- Saldo Awal Ekuitas
  '4000', -- Pendapatan Penjualan
  '4200', -- Pendapatan Jasa
  '4300', -- Pendapatan Lain-lain
  '4400', -- Pendapatan Bunga
  '5000', -- Beban Pokok Penjualan (HPP)
  '6100', -- Beban Gaji
  '6290', -- Beban Penyusutan
  '6500', -- Beban Kerugian Piutang
  '6900', -- Beban Lain-lain
  '6910', -- Beban Administrasi Bank
  '6800', -- Kerugian / Penghapusan
  '5900'  -- Penyesuaian Persediaan
);

-- Step 2: View accounts that are NOT system accounts (candidates for review)
-- These are accounts that were either seeded or manually created.
-- Review this list and decide which to keep.
SELECT code, name, type, balance, "isSystem",
  CASE WHEN EXISTS (
    SELECT 1 FROM journal_lines jl WHERE jl."accountId" = gl.id
  ) THEN 'HAS TRANSACTIONS' ELSE 'NO TRANSACTIONS' END as status
FROM gl_accounts gl
WHERE "isSystem" = false
ORDER BY code;

-- Step 3: To delete accounts with NO transactions and zero balance (CAREFUL!):
-- Uncomment and run only after reviewing Step 2 output.
-- DELETE FROM gl_accounts
-- WHERE "isSystem" = false
--   AND balance = 0
--   AND NOT EXISTS (SELECT 1 FROM journal_lines jl WHERE jl."accountId" = gl_accounts.id);
