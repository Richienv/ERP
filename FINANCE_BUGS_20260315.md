# Finance Module — Bug Report from Raymond Demo (March 15, 2026)

> **Source:** Raymond's WhatsApp video walkthrough + screenshots, recorded March 15, 2026
> **Reporter:** Raymond
> **Priority:** All HIGH — these are pre-trial blockers
> **Context:** Raymond was demoing the finance module (Keuangan) end-to-end on erp-navy-eight.vercel.app and found multiple disconnection/integration bugs across submodules.

---

## Summary

7 bugs found across 6 submodules. The core pattern is **data not flowing between modules** — invoices don't appear in AR, AP doesn't connect to COA, financial reports don't pull transaction data, and search/filter components have broken filtering logic.

---

## Bug 1: Invoice terkirim tapi tidak muncul di Piutang Usaha (AR)

- **ID:** B-012
- **Type:** BUG
- **Module:** Finance → Invoicing + Piutang Usaha (AR)
- **Priority:** HIGH
- **Severity:** Critical — breaks the entire AR workflow

### What happened
Raymond created invoices in the Invoicing module. One invoice (INV-2026-0003, Rp600.000 to "Darren ban...") has status "TERKIRIM" (sent). When navigating to Piutang Usaha (AR) / Penerimaan Piutang, the page shows:
- Dana belum dialokasi: Rp0
- Invoice terbuka: **0**
- Total piutang: Rp0
- "Tidak ada pembayaran ditemukan"

The sent invoice should appear as an open invoice in AR, but AR shows nothing.

### Expected behavior
Any invoice with status TERKIRIM or JATUH TEMPO should automatically appear in the AR module as an open receivable. The AR dashboard should show:
- Invoice terbuka: 1 (or however many are sent/overdue)
- Total piutang: Rp600.000
- The invoice should be selectable in the "Pilih Invoice" section for payment allocation

### Root cause investigation
Check these in order:
1. **Invoice status transition** — When an invoice is marked TERKIRIM, does the backend create/update an AR record? Look for a missing trigger, webhook, or post-save hook.
2. **AR query** — The AR page's data fetching query may be filtering incorrectly (e.g., wrong status filter, wrong tenant, wrong date range).
3. **Foreign key linkage** — The invoice table and AR/receivables table may not be properly linked. Check if `invoice_id` or `customer_id` foreign keys exist and are populated.

### Files likely affected
- Backend: Invoice status update handler (the function that runs when invoice goes from DRAFT → TERKIRIM)
- Backend: AR/receivables query endpoint
- Frontend: AR page data fetching (React Query key + fetch function)
- Database: Check if there's an `ar_entries` or `receivables` table that should be populated on invoice send

### How to verify
1. Create a new invoice → mark as TERKIRIM
2. Navigate to Keuangan → Piutang Usaha (AR)
3. The invoice should appear under "Invoice Terbuka" with correct amount
4. Total piutang should equal the sum of all unpaid sent invoices

---

## Bug 2: Hutang Usaha (AP) tidak terhubung ke modul lain

- **ID:** B-013
- **Type:** BUG
- **Module:** Finance → Hutang Usaha (AP)
- **Priority:** HIGH
- **Severity:** Critical — AP exists in isolation

### What happened
The AP module (Hutang Usaha) shows data correctly on its own page — there is 1 bill (BILL-2026-0001, PT Darren kurus, Rp777.000, status ISSUED, jatuh tempo 31/3/2026). However, this AP data does NOT flow to:
- Chart of Accounts (COA balance for the relevant liability account is Rp0)
- Financial reports (Neraca, Laba Rugi, etc.)

Meanwhile, the invoice/AR side has the same disconnection problem (Bug 1). So AP is working internally but not connected to the general ledger.

### Expected behavior
When a bill is created and marked ISSUED in AP:
1. A journal entry should be auto-created: Debit expense/asset account, Credit hutang usaha (AP liability account)
2. The COA should reflect this — the AP liability account should show Rp777.000 balance
3. Financial reports (Neraca) should include this liability

### Root cause investigation
1. **Missing journal entry creation** — When a bill is issued, does the system create a corresponding journal entry? This is likely the root cause — the AP module creates bills but never posts to the general ledger.
2. **COA query** — Even if journal entries exist, the COA balance calculation may not be summing from the journal entries table correctly.

### Files likely affected
- Backend: Bill/AP creation handler — needs to auto-create journal entries on status change to ISSUED
- Backend: COA balance calculation query
- Database: `journal_entries` table — check if AP transactions create entries here

### How to verify
1. Create a bill in AP → mark as ISSUED
2. Go to Jurnal Umum → the journal entry should appear (Debit: expense, Credit: hutang usaha)
3. Go to COA → the liability account should show the correct balance
4. Go to Neraca → total kewajiban should include the AP amount

---

## Bug 3: Chart of Accounts (COA) tidak merefleksikan transaksi

- **ID:** B-014
- **Type:** BUG
- **Module:** Finance → Chart of Accounts
- **Priority:** HIGH
- **Severity:** Critical — COA is the backbone of all financial reporting

### What happened
Raymond navigated to Chart of Accounts and showed the full list of accounts:
- 1000 Kas Besar (Cash on Hand) — Rp0
- 1010 Bank BCA — Rp0
- 1020 Bank Mandiri — Rp0
- 1030 Petty Cash 101 — Rp0
- 1050 Kas Kecil (Petty Cash) — Rp0
- 123 Share Capital — Rp0
- 2000 Bank Danamon — Main Bank — Rp0
- 3000 Prepayment — Rp0
- 500 Building — Rp0
- 501 Accumulated Depn - Building — **-Rp450.000** (only account with a balance)
- 6000 Accrued Expenses — Rp0
- 800 Sales — Rp0
- 801 Other Income — Rp0
- 900 Professional Fees — **Rp450.000** (has balance)
- 901 Materials — Rp0
- 902 Stationery — Rp0
- 904 Utilities — Rp0
- 910 Depreciation — Rp0
- BARU — Liability
- BARU — Bank CIMB Niaga — Done — Asset

Despite having invoices (Rp600K sent), bills (Rp777K issued), and other transactions in the system, almost all COA balances are Rp0. Only the depreciation-related accounts (501, 900) show balances — likely from seed data or a single manual journal entry.

### Expected behavior
COA balances should be the **real-time sum of all journal entries** for each account. If invoices, bills, petty cash transactions, etc. exist, they should have corresponding journal entries that feed into COA balances.

### Root cause
This is a **systemic issue** — the root cause is that transaction modules (Invoicing, AP, AR, Petty Cash) are NOT creating journal entries when transactions occur. The COA is correctly summing journal entries, but there are no journal entries to sum because the other modules don't create them.

**Fix priority:** This is the MASTER BUG. Fixing Bug 1 (AR), Bug 2 (AP), and ensuring all transaction modules post journal entries will fix COA automatically.

### Action required
For each transaction module, ensure it creates proper double-entry journal entries:
- **Invoicing (TERKIRIM):** Debit: Piutang Usaha (AR), Credit: Sales
- **AP (ISSUED):** Debit: Expense account, Credit: Hutang Usaha (AP)
- **Petty Cash (pengeluaran):** Debit: Expense account, Credit: Kas Kecil
- **Petty Cash (top up):** Debit: Kas Kecil, Credit: Bank account
- **Pembayaran AR:** Debit: Bank account, Credit: Piutang Usaha (AR)
- **Pembayaran AP:** Debit: Hutang Usaha (AP), Credit: Bank account

### How to verify
1. Perform a transaction in any module (e.g., send an invoice)
2. Go to Jurnal Umum → a journal entry should exist for that transaction
3. Go to COA → the affected accounts should show updated balances
4. Go to financial reports → totals should match COA

---

## Bug 4: Laporan Keuangan — hanya Arus Kas yang connect

- **ID:** B-015
- **Type:** BUG
- **Module:** Finance → Laporan Keuangan (Financial Reports)
- **Priority:** HIGH
- **Severity:** Critical

### What happened
Raymond went through all financial reports:

1. **Laba Rugi (P&L):** Shows Professional Fees Rp450.000 expense only (from seed data). No revenue from invoices. No AP expenses.
2. **Neraca (Balance Sheet):** Only shows Accumulated Depn -Rp450.000 and the offsetting entries. All other accounts Rp0. Unbalanced indicator present.
3. **Arus Kas (Cash Flow):** This is the ONLY report that shows some data — Laba Bersih -Rp450.000, Perubahan Piutang Usaha, Perubahan Hutang Usaha, with a Kenaikan Bersih Kas of -Rp273.000. Raymond confirmed "yang connect cuma arus kas."
4. **Perubahan Ekuitas:** Shows Share Capital Rp0, Laba Bersih Periode -(Rp450.000), Total Ekuitas Rp0.
5. **Neraca Saldo:** Not shown but likely also disconnected.
6. **AR Aging:** Shows "Tidak ada piutang terbuka" — connected to Bug 1.
7. **AP Aging:** Not explicitly shown.
8. **Laporan Pajak (PPN):** Shows 0 faktur keluaran and 0 faktur masukan. Total PPN Keluaran Rp0, Total PPN Masukan Rp0.

### Expected behavior
All financial reports should pull from the same journal entries / general ledger data. If COA is fixed (Bug 3 — which requires fixing Bug 1 and Bug 2), all reports should automatically show correct data.

### Root cause
Same systemic issue as Bug 3 — transaction modules don't create journal entries, so reports have nothing to aggregate. The Arus Kas report partially works because it seems to have a separate calculation path (possibly pulling from a cash transactions table rather than journal entries).

### Action required
1. Fix the journal entry creation in all transaction modules (master fix from Bug 3)
2. Verify each report's data source query pulls from journal_entries correctly
3. For Laporan Pajak (PPN): ensure invoices with PPN flag create faktur pajak records

### How to verify
After fixing journal entry creation:
1. Laba Rugi should show revenue from invoices and expenses from AP
2. Neraca should be balanced and include AR, AP, cash balances
3. Arus Kas should match
4. PPN report should show faktur if invoices have PPN enabled

---

## Bug 5: Aset Tetap — "Pilih Kategori" dropdown error

- **ID:** B-016
- **Type:** BUG
- **Module:** Finance → Aset Tetap (Fixed Assets)
- **Priority:** HIGH
- **Severity:** Medium — blocks asset registration

### What happened
Raymond navigated to Keuangan → Aset Tetap → Daftarkan Aset Tetap. He filled in:
- Nama Aset: "Tanah Nicholas Abang"
- Kategori: clicked "Pilih kategori" dropdown → **ERROR** (circled in green in screenshot)

The category dropdown either shows an error, shows no options, or fails to load categories. Without selecting a category, the asset cannot be registered.

### Expected behavior
The "Pilih kategori" dropdown should show a list of fixed asset categories (e.g., Tanah, Bangunan, Kendaraan, Peralatan, Mesin, etc.). These should be pre-seeded or configurable.

### Root cause investigation
1. **Missing seed data** — The asset categories table may be empty
2. **API error** — The endpoint that fetches categories may be failing (check console for 404/500)
3. **Frontend fetch** — The dropdown component may not be calling the API correctly

### Other fields visible on the form (for context)
- Supplier: dropdown (Pilih supplier)
- Nomor Seri: text input (SN-12345 placeholder)
- Tanggal Pembelian, Tanggal Kapitalisasi, Mulai Penyusutan: date fields
- Harga Perolehan: 0
- Nilai Residu: 0
- Masa Manfaat (Bulan): 60
- Metode Penyusutan: Garis Lurus
- Frekuensi Penyusutan: Bulanan

### How to verify
1. Navigate to Aset Tetap → Daftarkan Aset Tetap
2. Click "Pilih kategori" dropdown
3. Categories should load and be selectable
4. Complete the form and save → asset should appear in the asset list

---

## Bug 6: Nota Kredit — belum connect / form issues

- **ID:** B-017
- **Type:** BUG
- **Module:** Finance → Nota Kredit/Debit
- **Priority:** HIGH
- **Severity:** Medium — credit notes exist but don't integrate

### What happened
Raymond opened Keuangan → Nota Kredit/Debit → Buat Nota Kredit. The form shows:
- Untuk: CUSTOMER / SUPPLIER toggle (CUSTOMER selected)
- Customer: "Darren sangat gendut" (selected)
- Invoice Asal (Opsional): "Pilih..." dropdown
- Alasan: "Pilih..." dropdown
- Referensi: "Tidak ada"
- Date: Mar 15, 2026

Raymond circled the area around Invoice Asal, Alasan, and Referensi fields — indicating these are **not connecting properly**. Specifically:
1. "Invoice Asal" dropdown may not be loading the customer's invoices
2. The nota kredit likely doesn't create reversal journal entries
3. The nota kredit doesn't adjust the AR/AP balance

### Expected behavior
1. "Invoice Asal" should list all invoices for the selected customer
2. When a credit note is created, it should:
   - Create a reversal journal entry (Debit: Sales/Revenue, Credit: AR)
   - Reduce the customer's AR balance
   - Appear in the AR aging report as a credit
3. For supplier credit notes: reverse the AP entry

### Root cause investigation
1. **Invoice Asal dropdown** — Check if the query filters by selected customer and loads their invoices
2. **Journal entry creation** — Credit notes likely don't post to the general ledger (same pattern as Bug 1-3)
3. **AR/AP adjustment** — Even if the credit note saves, it may not reduce AR/AP

### How to verify
1. Select a customer with existing invoices
2. "Invoice Asal" should show those invoices
3. Create credit note → Jurnal Umum should show reversal entry
4. AR balance for that customer should decrease by credit note amount

---

## Bug 7: Jurnal Umum — search/filter "Cari kode" broken

- **ID:** B-018
- **Type:** BUG
- **Module:** Finance → Jurnal Umum (General Journal)
- **Priority:** HIGH
- **Severity:** Medium — blocks efficient account selection

### What happened
Raymond went to Jurnal Umum → Buat Jurnal Baru. In the account selection dropdown ("Cari akun..."), he tested the search filter:

1. **Typing "1"** — Only shows account 1030 (Petty Cash 101). Should show ALL accounts starting with "1": 1000 (Kas Besar), 1010 (Bank BCA), 1020 (Bank Mandiri), 1030 (Petty Cash 101), 1050 (Kas Kecil), 123 (Share Capital).
2. **Typing "2"** — Shows "Akun tidak ditemukan". Should show 2000 (Bank Danamon — Main Bank).
3. **Typing "3"** — Shows "Akun tidak ditemukan". Should show 3000 (Prepayment).
4. **Typing "4"** — Shows "Akun tidak ditemukan". No accounts start with 4, so this is correct behavior... BUT there should be 4xxx accounts in a proper Indonesian COA.
5. **Clearing search and browsing** — The full dropdown shows all accounts correctly (1000, 1010, 1020, 1030, 1050, 123, 2000, 3000, 500, 501, 6000, etc.)

**Separately**, in the Peti Kas (Petty Cash) → Top Up modal, the "Dari Akun Bank" dropdown shows **0 bank accounts** (empty search results, only "+ Buat Akun Bank Baru" option). Despite having Bank BCA (1010), Bank Mandiri (1020), Bank Danamon (2000), and Bank CIMB Niaga in the COA.

### Expected behavior
1. **Jurnal Umum search:** Typing "1" should filter to show ALL accounts whose code starts with "1" (1000, 1010, 1020, 1030, 1050). Typing "2" should show 2000. The filter should match on both code AND name.
2. **Peti Kas bank dropdown:** Should show all accounts tagged as bank/cash accounts (1010 Bank BCA, 1020 Bank Mandiri, 2000 Bank Danamon, Bank CIMB Niaga).

### Root cause investigation

**For Jurnal Umum search:**
- The search filter is likely doing an **exact match** or **contains on name only** instead of **startsWith on code**
- "1" matches "1030" because "Petty Cash **1**01" contains "1" in the name, NOT because the code starts with "1"
- "2" doesn't match because no account NAME contains just "2"
- This confirms: the filter searches the **name** field, not the **code** field
- **Fix:** Change the filter to search BOTH code (startsWith or contains) AND name (contains). Priority: code match first, then name match.

**For Peti Kas bank dropdown:**
- The bank account dropdown likely queries accounts with a specific `type` or `category` flag (e.g., `is_bank: true` or `account_type: 'bank'`)
- The bank accounts in COA may not have this flag set correctly
- **Fix:** Either update the bank accounts to have the correct type/flag, or change the query to filter by account code range (1010-1099 for bank accounts) or by name containing "Bank"

### Files likely affected
- Frontend: Account search/combobox component (used in Jurnal Umum form) — fix the filter function
- Frontend: Bank account dropdown component (used in Peti Kas top up) — fix the query filter
- Backend: Account search API endpoint — if filtering is server-side
- Database: `chart_of_accounts` table — check `account_type` or `is_bank` flags on bank accounts

### How to verify
**Jurnal Umum:**
1. Go to Jurnal Umum → Buat Jurnal Baru
2. Click account dropdown → type "1" → should see 1000, 1010, 1020, 1030, 1050, 123
3. Type "2" → should see 2000
4. Type "bank" → should see Bank BCA, Bank Mandiri, Bank Danamon, Bank CIMB Niaga
5. Type "kas" → should see Kas Besar, Kas Kecil

**Peti Kas:**
1. Go to Peti Kas → click Top Up
2. "Dari Akun Bank" dropdown should list all bank accounts
3. Select a bank → complete top up → journal entry should be created

---

## Implementation Priority Order

Fix these in this order because of dependencies:

```
1. B-014 (COA not reflecting transactions) — this is the MASTER BUG
   └── Requires: B-012 (AR not connected) + B-013 (AP not connected)
       └── Root fix: All transaction modules must create journal entries
   
2. B-012 (Invoice → AR disconnected)
   - When invoice status → TERKIRIM: create journal entry (Debit AR, Credit Sales)
   
3. B-013 (AP → COA disconnected)  
   - When bill status → ISSUED: create journal entry (Debit Expense, Credit AP)

4. B-015 (Financial reports empty)
   - Will auto-fix once B-012, B-013, B-014 are resolved
   - Verify each report pulls from journal_entries correctly

5. B-018 (Search filter broken in Jurnal Umum + Peti Kas bank dropdown)
   - Independent fix — can be done in parallel
   - Two sub-issues: search logic + bank account flag

6. B-016 (Aset Tetap category dropdown error)
   - Independent fix — likely missing seed data or broken API
   
7. B-017 (Nota Kredit not connected)
   - Fix after B-012/B-013 since it depends on the same journal entry pattern
```

---

## Architecture Note for Claude Code

The **systemic pattern** across Bug 1-4 is: **transaction modules create records in their own tables but never post double-entry journal entries to the general ledger.** 

The fix should be a **shared utility/service** that all transaction modules call:

```
createJournalEntry({
  date: transaction.date,
  reference: transaction.reference_number,
  description: `Auto: ${transaction.type} ${transaction.number}`,
  entries: [
    { account_code: '...', debit: amount, credit: 0 },
    { account_code: '...', debit: 0, credit: amount }
  ],
  source_module: 'invoicing' | 'ap' | 'petty_cash' | 'credit_note',
  source_id: transaction.id
})
```

This ensures:
- Every transaction creates balanced journal entries
- COA balances are always correct (they just SUM from journal_entries)
- All financial reports are automatically correct
- Entries are traceable back to their source transaction

---

## Appendix: COA Account List (from video/screenshots)

| Code | Name | Type | Balance (Current) |
|------|------|------|-------------------|
| 1000 | Kas Besar (Cash on Hand) | Asset | Rp0 |
| 1010 | Bank BCA | Asset | Rp0 |
| 1020 | Bank Mandiri | Asset | Rp0 |
| 1030 | Petty Cash 101 | Asset | Rp0 |
| 1050 | Kas Kecil (Petty Cash) | Asset | Rp0 |
| 123 | Share Capital | Equity | Rp0 |
| 2000 | Bank Danamon — Main Bank | Asset | Rp0 |
| 3000 | Prepayment | Asset | Rp0 |
| 500 | Building | Asset | Rp0 |
| 501 | Accumulated Depn - Building | Asset | -Rp450.000 |
| 6000 | Accrued Expenses | Liability | Rp0 |
| 800 | Sales | Revenue | Rp0 |
| 801 | Other Income | Revenue | Rp0 |
| 900 | Professional Fees | Expense | Rp450.000 |
| 901 | Materials | Expense | Rp0 |
| 902 | Stationery | Expense | Rp0 |
| 904 | Utilities | Expense | Rp0 |
| 910 | Depreciation | Expense | Rp0 |
| BARU | BARU | Liability | Rp0 |
| BARU | Bank CIMB Niaga — Done | Asset | Rp0 |

**Note:** Account code "123" for Share Capital and "BARU" codes are non-standard. The COA numbering needs cleanup but that's a separate task.
