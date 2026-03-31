# OIC ERP — Accounting Module V2: Complete Transaction & Report Integration Spec

> **Reference for Ralph Loop tasks ACCT2-001 through ACCT2-012.**
> Every financial transaction MUST generate a Journal Entry. Total Debits MUST always equal Total Credits.

---

## COA Structure (Target State)

```
1xxx — ASSETS (Normal Balance: DEBIT)
  1000 — Kas & Setara Kas          [EXISTS]
  1050 — Kas Kecil (Petty Cash)    [EXISTS]
  1100 — Cash & Cash Equivalents
  1110 — Bank BCA                  [EXISTS]
  1111 — Bank Mandiri              [EXISTS]
  1200 — Piutang Usaha (AR)        [EXISTS] — CONTROL ACCOUNT
  1210 — Cadangan Kerugian Piutang [NEW — contra-asset, CREDIT normal]
  1300 — Persediaan Barang Jadi    [EXISTS] — CONTROL ACCOUNT
  1305 — Cadangan Penurunan Persediaan [NEW — contra-asset]
  1310 — Bahan Baku                [EXISTS]
  1320 — Barang Dalam Proses (WIP) [EXISTS]
  1330 — PPN Masukan               [EXISTS]
  1410 — PPN Lebih Bayar           [EXISTS]
  1450 — Piutang Karyawan          [NEW]
  1500 — Aset Tetap                [implied by depreciation]
  1590 — Akumulasi Penyusutan      [EXISTS — contra-asset]

2xxx — LIABILITIES (Normal Balance: CREDIT)
  2000 — Utang Usaha (AP)          [EXISTS] — CONTROL ACCOUNT
  2110 — Utang Pajak (PPN)         [EXISTS]
  2150 — Barang Diterima / Faktur Belum Diterima (GR/IR Clearing) [NEW]
  2200 — Utang Gaji                [NEW]
  2210 — Overhead Produksi Dibebankan [NEW]
  2310 — Utang PPh 21              [NEW]
  2315 — Utang PPh 23              [NEW]
  2320 — Utang BPJS Ketenagakerjaan [NEW]
  2330 — Utang BPJS Kesehatan      [NEW]
  2400 — Pendapatan Diterima Dimuka [NEW]

3xxx — EQUITY (Normal Balance: CREDIT)
  3100 — Laba Ditahan              [EXISTS]
  3900 — Saldo Awal Ekuitas        [EXISTS]
  3300 — Laba Tahun Berjalan       [CALCULATED dynamically, NOT stored]

4xxx — REVENUE (Normal Balance: CREDIT)
  4000 — Pendapatan Penjualan      [EXISTS]
  4200 — Pendapatan Jasa           [NEW]
  4300 — Pendapatan Lain-lain      [NEW]
  4400 — Pendapatan Bunga          [NEW]

5xxx — COGS (Normal Balance: DEBIT)
  5000 — Beban Pokok Penjualan     [EXISTS]

6xxx — OPERATING EXPENSES (Normal Balance: DEBIT)
  6100 — Beban Gaji & Upah        [NEW]
  6290 — Beban Penyusutan          [EXISTS]
  6500 — Beban Piutang Tak Tertagih [NEW]
  6900 — Beban Lain-lain           [EXISTS]

7xxx — OTHER EXPENSES (Normal Balance: DEBIT)
  7200 — Beban Administrasi Bank   [NEW]

8xxx — LOSSES (Normal Balance: DEBIT)
  8200 — Kerugian / Penghapusan    [EXISTS]
  8300 — Penyesuaian Persediaan    [EXISTS]
```

### Normal Balance Display Rule
```
display_balance = (normal_balance == DEBIT)
  ? SUM(debits) - SUM(credits)
  : SUM(credits) - SUM(debits)
```

### Control Accounts
Accounts 1200 (AR), 2000 (AP), 1300 (Inventory): `allowDirectPosting = false`. Only affected through AR/AP/Inventory modules. Manual journal entries blocked.

---

## Journal Entry Patterns (Quick Reference)

### AR Module

**Customer Invoice (INV_OUT):**
```
DR 1200 AR                    [total]
CR 4000 Revenue               [subtotal/DPP]
CR 2110 PPN Keluaran          [tax]
```
If STOCK_ITEM, also post COGS:
```
DR 5000 COGS                  [cost]
CR 1300 Inventory              [cost]
```

**Customer Payment:**
```
DR 1110 Bank                   [received]
CR 1200 AR                     [received]
```
With bank charges:
```
DR 1110 Bank                   [net received]
DR 7200 Bank Charges           [charge amount]
CR 1200 AR                     [full amount]
```

**Credit Note (Sales Return):**
```
DR 4000 Revenue                [net amount]
DR 2110 PPN Keluaran           [tax]
CR 1200 AR                     [total]
```

**Bad Debt Write-Off (Direct):**
```
DR 6500 Bad Debt Expense       [amount]
CR 1200 AR                     [amount]
```

**Bad Debt (Allowance Method):**
Step 1 - Provision: DR 6500, CR 1210
Step 2 - Write-off: DR 1210, CR 1200

### AP Module

**Vendor Bill — Inventory (STOCK_ITEM):**
```
DR 1300 Inventory              [subtotal/DPP]
DR 1330 PPN Masukan            [tax]
CR 2000 AP                     [total]
```

**Vendor Bill — Expense (SERVICE/NON-STOCK):**
```
DR 6xxx Expense                [subtotal/DPP]
DR 1330 PPN Masukan            [tax]
CR 2000 AP                     [total]
```

**Vendor Payment:**
```
DR 2000 AP                     [paid]
CR 1110 Bank                   [paid]
```
With WHT/PPh 23:
```
DR 2000 AP                     [gross]
CR 1110 Bank                   [net]
CR 2315 PPh 23 Payable         [withheld]
```

**Debit Note (Purchase Return):**
```
DR 2000 AP                     [total]
CR 1300 Inventory (or 6xxx)    [net]
CR 1330 PPN Masukan            [tax]
```

### Inventory Module

**GRN Receipt (PO-based, before vendor invoice):**
```
DR 1300 Inventory              [cost]
CR 2150 GR/IR Clearing         [cost]
```
When vendor invoice arrives for PO-received goods:
```
DR 2150 GR/IR Clearing         [cost]
DR 1330 PPN Masukan            [tax]
CR 2000 AP                     [total]
```

**Stock Adjustment (Positive):**
```
DR 1300 Inventory              [cost]
CR 8300 Inventory Adjustment   [cost]     (or 4300 Other Income)
```

**Stock Adjustment (Negative):**
```
DR 8300 Inventory Adjustment   [cost]
CR 1300 Inventory              [cost]
```

### Fixed Assets (already implemented)

**Depreciation:** DR 6290, CR 1590
**Disposal:** DR Bank + DR 1590 ± Gain/Loss, CR 1500

### Payroll

**Payroll Calculation:**
```
DR 6100 Salary Expense         [gross]
CR 2200 Salary Payable         [net take-home]
CR 2310 PPh 21 Payable         [tax]
CR 2320 BPJS TK Payable        [employee]
CR 2330 BPJS Kes Payable       [employee]
```

**Salary Payment:**
```
DR 2200 Salary Payable         [net]
CR 1110 Bank                   [net]
```

**Tax/BPJS Remittance:**
```
DR 2310 PPh 21 Payable         [amount]
CR 1110 Bank                   [amount]
```

### Tax Module (PPN Settlement already implemented)

**WHT/PPh 23 Remittance:**
```
DR 2315 PPh 23 Payable         [amount]
CR 1110 Bank                   [amount]
```

### Bank Reconciliation

**Bank Charges:**
```
DR 7200 Bank Charges           [fee]
CR 1110 Bank                   [fee]
```

**Interest Income:**
```
DR 1110 Bank                   [interest]
CR 4400 Interest Income        [interest]
```

---

## Financial Report Query Logic

### Balance Sheet (Neraca) — Point-in-Time

```
ASSETS = SUM(debits - credits) for 1xxx accounts
  Note: Contra-assets (1210, 1590) show as negative (credit normal)

LIABILITIES = SUM(credits - debits) for 2xxx accounts

EQUITY
  Share Capital    = SUM(credits - debits) for 3100
  Retained Earn.   = SUM(credits - debits) for 3200/3900
  Current Year     = Revenue(4xxx) - Expenses(5xxx+6xxx+7xxx+8xxx) for YTD
                     ↑ CALCULATED dynamically, identical to P&L Net Profit

CHECK: ASSETS = LIABILITIES + EQUITY (always)
```

### P&L (Laba Rugi) — Period

```
Revenue       = SUM(credits - debits) for 4xxx in period
COGS          = SUM(debits - credits) for 5xxx in period
Gross Profit  = Revenue - COGS
OpEx          = SUM(debits - credits) for 6xxx in period
Other Expense = SUM(debits - credits) for 7xxx+8xxx in period
Net Profit    = Gross Profit - OpEx - Other Expense
```

### Cash Flow (Arus Kas) — Indirect Method

```
OPERATING:
  Net Profit + Depreciation + Bad Debt Expense
  ± Working capital changes (delta AR, Inventory, AP, PPN)

INVESTING:
  - Fixed asset purchases (debits to 1500)
  + Asset sale proceeds

FINANCING:
  ± Equity changes (3xxx)
  ± Long-term liability changes

CHECK: Opening Cash + Operating + Investing + Financing = Closing Cash
       (= GL balance of 1000+1050+1100+1110+1111 at period end)
```

---

## Integrity Checks (Daily)

1. AR Aging SUM = GL 1200 balance
2. AP Aging SUM = GL 2000 balance
3. Inventory sub-ledger = GL 1300 balance
4. Fixed Asset NBV = GL 1500 - GL 1590
5. Trial Balance: Total Debits = Total Credits
6. Balance Sheet: Assets = Liabilities + Equity
7. GR/IR Clearing (2150) aged items = goods received but not yet invoiced

---

## Item Master Accounting Config

Every STOCK_ITEM Product needs:
| Field | Default | Purpose |
|-------|---------|---------|
| `cogsAccountId` | 5000 (COGS) | Which account debited on sale |
| `inventoryAccountId` | 1300 (Inventory) | Which account credited on sale |
| `incomeAccountId` | 4000 (Revenue) | Which account credited on invoice |
| `purchaseAccountId` | NULL | For non-stock: expense account on purchase |

Rule: If item_type = STOCK_ITEM and sale posted, COGS journal MUST exist.
