# Complete ERP Accounting Module Specification for Indonesian Textile/Garment SME

**This specification provides the complete architecture, data models, business rules, workflows, and calculation formulas needed to build a full accounting module.** Benchmarked against Odoo 17/18 as the primary reference, with patterns from SAP Business One, ERPNext, and Mekari Jurnal. All 10 sub-modules are covered with implementation-ready detail.

---

## 1. General Ledger and Chart of Accounts

The General Ledger is the foundation of the entire accounting module. Every financial transaction ultimately creates journal entry lines that post to GL accounts. The architecture follows Odoo's unified model where **`account.move`** represents all financial documents (invoices, bills, payments, journal entries) and **`account.move.line`** represents individual debit/credit lines — which ARE the GL entries.

### 1.1 Chart of Accounts data model

**Model: `account_account`**

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | Integer PK | Auto | Primary key |
| `code` | Varchar(64) | ✅ | Account code, regex `^[A-Za-z0-9.]+$`, unique per company |
| `name` | Varchar | ✅ | Account name (translatable) |
| `account_type` | Enum | ✅ | See 17 types below |
| `currency_id` | FK → currency | No | Forces all entries to use this currency |
| `company_id` | FK → company | ✅ | Company |
| `group_id` | FK → account_group | No | Account group for hierarchy |
| `reconcile` | Boolean | No | Allow reconciliation of journal items |
| `deprecated` | Boolean | No | Soft-disable (default false) |
| `non_trade` | Boolean | No | Non-trade receivable/payable |
| `tax_ids` | M2M → tax | No | Default taxes applied when using this account |
| `tag_ids` | M2M → account_tag | No | Tags for reports (e.g., cash flow classification) |
| `allowed_journal_ids` | M2M → journal | No | Restrict which journals can use this account |

**17 Account Types (drives fiscal year close behavior and report classification):**

| Key | Label | Balance Sheet / P&L | Carry Forward |
|---|---|---|---|
| `asset_receivable` | Receivable | BS - Assets | Yes, must have reconcile=True |
| `asset_cash` | Bank and Cash | BS - Assets | Yes |
| `asset_current` | Current Assets | BS - Assets | Yes |
| `asset_non_current` | Non-current Assets | BS - Assets | Yes |
| `asset_prepayments` | Prepayments | BS - Assets | Yes |
| `asset_fixed` | Fixed Assets | BS - Assets | Yes |
| `liability_payable` | Payable | BS - Liabilities | Yes, must have reconcile=True |
| `liability_credit_card` | Credit Card | BS - Liabilities | Yes |
| `liability_current` | Current Liabilities | BS - Liabilities | Yes |
| `liability_non_current` | Non-current Liabilities | BS - Liabilities | Yes |
| `equity` | Equity | BS - Equity | Yes |
| `equity_unaffected` | Current Year Earnings | BS - Equity | Yes, exactly ONE per company |
| `income` | Income | P&L | No — zeroed, flows to equity_unaffected |
| `income_other` | Other Income | P&L | No |
| `expense` | Expenses | P&L | No |
| `expense_depreciation` | Depreciation | P&L | No |
| `expense_direct_cost` | Cost of Revenue | P&L | No |

**Validation rules:**
1. `asset_receivable` and `liability_payable` accounts MUST have `reconcile=True`
2. Exactly ONE `equity_unaffected` account per company
3. Account code unique per company
4. Code must match regex `^[A-Za-z0-9.]+$`

### 1.2 Account groups (hierarchy)

**Model: `account_group`**

| Field | Type | Description |
|---|---|---|
| `name` | Varchar | Group name |
| `code_prefix_start` | Varchar | Start of code prefix range |
| `code_prefix_end` | Varchar | End of code prefix range |
| `parent_id` | FK → self | Auto-computed from overlapping prefix ranges |
| `company_id` | FK → company | Company |

Accounts are matched to groups by code prefix. Group with prefix `131` contains accounts `131000`, `131100`, etc. Parent-child relationships between groups are auto-computed. Used in Trial Balance with "Hierarchy and Subtotals."

### 1.3 Indonesian PSAK-compliant CoA structure

| Code Range | Category | Account Type |
|---|---|---|
| 1100–1199 | Kas dan Bank | `asset_cash` |
| 1200–1299 | Piutang Usaha | `asset_receivable` |
| 1300–1399 | Piutang Lain-lain, Uang Muka | `asset_current`, `asset_prepayments` |
| 1400–1499 | Persediaan (Bahan Baku, BDP, Barang Jadi) | `asset_current` |
| 1500–1599 | Biaya Dibayar Dimuka, PPN Masukan, PPh Dibayar Dimuka | `asset_prepayments` |
| 1600–1799 | Aset Tetap dan Akumulasi Penyusutan | `asset_fixed` |
| 1800–1999 | Aset Tidak Lancar Lainnya | `asset_non_current` |
| 2100–2199 | Hutang Usaha | `liability_payable` |
| 2200–2399 | Hutang Pajak (PPN Keluaran, PPh 21/23/4(2), BPJS) | `liability_current` |
| 2400–2999 | Hutang Jangka Panjang | `liability_non_current` |
| 3100 | Modal Saham | `equity` |
| 3200 | Saldo Laba | `equity` |
| 3300 | Laba Tahun Berjalan | `equity_unaffected` |
| 4100–4199 | Penjualan | `income` |
| 4200–4999 | Pendapatan Lain-lain | `income_other` |
| 5100–5199 | Harga Pokok Produksi | `expense_direct_cost` |
| 5200–5299 | Harga Pokok Penjualan | `expense_direct_cost` |
| 6100–6999 | Beban Operasional | `expense` |
| 7100–7199 | Beban Penyusutan | `expense_depreciation` |
| 8100–8999 | Pendapatan/Beban Non-operasional | `income_other` / `expense` |
| 9100–9199 | Beban Pajak Penghasilan | `expense` |

### 1.4 Journal entry architecture (account.move + account.move.line)

**Model: `account_move`** (unified journal entry / invoice / bill)

| Field | Type | Required | Description |
|---|---|---|---|
| `name` | Varchar | Auto | Sequence number (e.g., INV/2024/0001) |
| `move_type` | Enum | ✅ | `entry`, `out_invoice`, `out_refund`, `in_invoice`, `in_refund`, `out_receipt`, `in_receipt` |
| `state` | Enum | ✅ | `draft`, `posted`, `cancel` |
| `date` | Date | ✅ | Accounting date |
| `invoice_date` | Date | No | Invoice/bill date |
| `invoice_date_due` | Date | No | Due date (computed from payment terms) |
| `journal_id` | FK → journal | ✅ | Journal |
| `partner_id` | FK → partner | No | Customer/vendor |
| `currency_id` | FK → currency | ✅ | Document currency |
| `amount_total` | Decimal | Computed | Total including tax |
| `amount_untaxed` | Decimal | Computed | Total excluding tax |
| `amount_tax` | Decimal | Computed | Tax amount |
| `amount_residual` | Decimal | Computed | Outstanding balance |
| `payment_state` | Enum | Computed | `not_paid`, `in_payment`, `paid`, `partial`, `reversed` |
| `ref` | Varchar | No | External reference |
| `invoice_payment_term_id` | FK → payment_term | No | Payment terms |
| `fiscal_position_id` | FK → fiscal_position | No | Tax/account mapping |
| `reversed_entry_id` | FK → self | No | Links to reversal |

**State machine:**
- **draft** → fully editable, no GL impact, no sequence assigned
- **draft → posted** (`action_post`): validates balance, assigns sequence, GL entries live, tax finalized
- **posted** → read-only, can register payments, can reverse
- **posted → cancel** (only if no reconciliation and no hash lock)
- **posted → draft** (reset to draft, only if no reconciliation)

**Critical validation on posting:** `SUM(debit) == SUM(credit)` across all line_ids. Unbalanced entries cannot post.

**Model: `account_move_line`** (journal items = GL entries)

| Field | Type | Required | Description |
|---|---|---|---|
| `move_id` | FK → account_move | ✅ | Parent entry |
| `account_id` | FK → account_account | ✅ | GL account |
| `debit` | Decimal | — | Debit in company currency |
| `credit` | Decimal | — | Credit in company currency |
| `balance` | Decimal | Stored | `debit - credit` (the actual stored field) |
| `amount_currency` | Decimal | — | Amount in foreign currency (+debit, -credit) |
| `currency_id` | FK → currency | ✅ | Transaction currency |
| `partner_id` | FK → partner | No | Partner |
| `name` | Varchar | No | Label/description |
| `date_maturity` | Date | No | Due date for this line (from payment terms) |
| `product_id` | FK → product | No | Product |
| `quantity` | Decimal | No | Quantity |
| `price_unit` | Decimal | No | Unit price |
| `discount` | Decimal | No | Discount % |
| `tax_ids` | M2M → tax | No | Taxes applied |
| `tax_line_id` | FK → tax | No | Tax that generated this line |
| `analytic_distribution` | JSON | No | `{"analytic_id": percentage}` |
| `reconciled` | Boolean | Computed | Fully reconciled flag |
| `amount_residual` | Decimal | Computed | Remaining unreconciled |
| `full_reconcile_id` | FK → full_reconcile | No | Full reconciliation group |
| `display_type` | Enum | No | `product`, `tax`, `payment_term`, `cogs`, `rounding` |

### 1.5 Journal types

| Type | Code | Usage | move_types |
|---|---|---|---|
| `sale` | INV | Customer invoices, credit notes | `out_invoice`, `out_refund` |
| `purchase` | BILL | Vendor bills, debit notes | `in_invoice`, `in_refund` |
| `bank` | BNK1 | Bank statements, payments | payments |
| `cash` | CSH1 | Cash transactions | payments |
| `general` | MISC | Manual entries, adjustments | `entry` |

Key journal fields: `default_account_id`, `payment_debit_account_id` (outstanding payments), `payment_credit_account_id` (outstanding receipts), `bank_account_id`, `currency_id`, `sequence`.

### 1.6 Multi-currency handling

**Exchange rate model:** `currency_rate` with fields: `date`, `rate` (relative to company currency), `currency_id`, `company_id`.

**Exchange difference on reconciliation:** When an invoice at rate R1 is paid at rate R2, full reconciliation auto-creates an exchange difference journal entry debiting/crediting the configured Exchange Gain/Loss accounts.

**Currency revaluation:** Period-end process adjusts BS accounts at current exchange rate, generating unrealized FX gain/loss entries.

### 1.7 Period management

Three lock dates on company:
- **`period_lock_date`**: Non-advisor users cannot post entries on or before this date
- **`fiscalyear_lock_date`**: ALL users locked
- **`tax_lock_date`**: Cannot modify tax-affecting entries on or before this date

No explicit period-closing entry needed. P&L balances auto-flow to `equity_unaffected` in Balance Sheet computation. Fiscal year end configurable (default Dec 31).

### 1.8 Financial reporting engine

Three models: `account_report` (report definition), `account_report_line` (lines with code references), `account_report_expression` (computation logic).

**Computation engines:**
1. **`domain`**: Matches journal items via ORM domain
2. **`account_codes`**: Arithmetic on account code prefixes (e.g., `21 + 10 - 5`)
3. **`tax_tags`**: Matches tax tag names
4. **`aggregate`**: Arithmetic on other expression results
5. **`custom`**: Python function

Standard reports: Balance Sheet (date-based), P&L (date-range), Trial Balance (with hierarchy), Cash Flow (using cash flow tags), General Ledger (all items by account), Aged Receivable/Payable.

---

## 2. Accounts Payable

### 2.1 Vendor master data

Key accounting fields on `partner` model: `property_account_payable_id` (default AP account), `property_supplier_payment_term_id`, `property_account_position_id` (fiscal position), `bank_ids` (vendor bank accounts), `invoice_warn` (warning/block on invoice creation).

### 2.2 Purchase invoice workflow

Vendor bills use `account_move` with `move_type = 'in_invoice'`. States: **draft → posted → paid**.

**Creation methods:**
1. Manual: Accounting → Vendors → Bills → New
2. From PO: Purchase Order → Create Bill (pre-fills from PO lines with received quantities)
3. Auto from receipt: When bill control = "Received Quantities"

**On posting (`action_post`):**
- Validates balance (Σdebit = Σcredit)
- Assigns sequence from purchase journal
- Creates GL entries: DR Expense/Inventory accounts, CR Accounts Payable
- Tax lines finalized
- `payment_state` → `not_paid`

### 2.3 Payment matching and allocation

**Payment model:** `account_payment` (inherits from `account_move`)

Key fields: `payment_type` (`inbound`/`outbound`), `partner_type` (`customer`/`supplier`), `amount`, `journal_id` (bank/cash), `payment_method_line_id`.

**Payment → Invoice flow:**
1. Click "Pay" on bill → payment register wizard
2. Creates payment with JE: DR Accounts Payable / CR Outstanding Payments
3. AP line on payment is reconciled with AP line on bill via `account_partial_reconcile`
4. Bill `payment_state` → `in_payment` (until bank reconciliation) → `paid`

**Partial payment:** Creates `account_partial_reconcile` with amount less than full. Bill's `amount_residual` decreases. `payment_state` → `partial`.

### 2.4 Reconciliation models

**`account_partial_reconcile`**: Links two move lines. Fields: `debit_move_id`, `credit_move_id`, `amount`, `full_reconcile_id`.

**`account_full_reconcile`**: Created when all partials fully clear residuals to zero. Fields: `name` (matching number), `partial_reconcile_ids`, `exchange_move_id` (auto FX entry).

### 2.5 AP aging

Based on **due date** (`date_maturity`), not invoice date. Formula: `days_overdue = report_date - date_maturity`. Default buckets: **Current, 1–30, 31–60, 61–90, 91–120, 120+**. Uses `amount_residual` (not total) for partially paid invoices. Grouped by partner.

### 2.6 Vendor credit notes

`move_type = 'in_refund'`. Creation methods: **Reverse** (draft credit note from original), **Reverse and Create Invoice** (credit note + new draft bill).

Credit note JE is mirror of original: DR Accounts Payable / CR Expense. `reversed_entry_id` links to original.

### 2.7 Three-way matching

Compares PO quantities/prices → GRN received quantities → Vendor bill quantities/prices. Field `should_be_paid`: `yes` (match) / `no` (not ready) / `exception` (mismatch). Odoo flags exceptions but does NOT block payment by default.

### 2.8 Payment terms

**Model: `account_payment_term`** with lines. Each line: `value` (percent/fixed/balance), `value_amount`, `nb_days`, `months`, `end_of_month`. Early discount: `discount_percentage`, `discount_days`.

When invoice posts with multi-line terms, the AP amount splits into multiple `account_move_line` records with different `date_maturity` values. This enables accurate aging.

---

## 3. Accounts Receivable

### 3.1 Customer master data

Key fields: `property_account_receivable_id`, `property_payment_term_id`, `credit_limit`, `trust` (good/normal/bad debtor), `bank_ids`.

### 3.2 Sales invoice workflow

`move_type = 'out_invoice'`. Same state machine as AP: draft → posted → paid.

**Creation methods:** Manual, from Sales Order (SO → Delivery → Invoice flow), from delivery.

**On posting:** DR Accounts Receivable / CR Revenue + CR Tax Payable. In Anglo-Saxon mode, also generates COGS entry: DR COGS / CR Stock Interim Delivered.

### 3.3 Payment collection

Inbound payment JE: DR Outstanding Receipts / CR Accounts Receivable. Bank reconciliation then matches statement line: DR Bank / CR Outstanding Receipts. Invoice goes from `in_payment` → `paid`.

### 3.4 Customer credit notes

`move_type = 'out_refund'`. JE: DR Revenue / CR Accounts Receivable.

### 3.5 Dunning and follow-ups

**Follow-up levels** with configurable delay (days after due date) and actions: Send Email, Send Letter, Send SMS, Schedule Activity. Each level has `auto` flag for automatic execution.

Per-customer settings: follow-up mode (Automatic/Manual), trust level, next reminder date, responsible user.

---

## 4. Bank and Cash Management

### 4.1 Bank reconciliation architecture (v17+)

**Major change from older versions:** Statement lines are the primary model. No requirement to create formal bank statements first.

**Model: `account_bank_statement_line`**

Key fields: `payment_ref`, `amount`, `partner_id`, `journal_id`, `move_id` (auto-generated journal entry), `is_reconciled`.

**When a statement line is created**, Odoo auto-generates a posted JE: DR Bank Account / CR Bank Suspense Account. The suspense line remains until reconciliation replaces it with the actual counterpart.

**Reconciliation widget** (three sections): transactions list, counterpart matching (existing entries + manual operations), resulting entry preview. When validated, the suspense account on the statement line's JE is replaced with the matched account.

### 4.2 Reconciliation models

**Model: `account_reconcile_model`**. Types: `writeoff_button` (manual button), `writeoff_suggestion` (auto-suggest), `invoice_matching` (match existing invoices). Key config: `auto_reconcile`, `match_label` (contains/regex), `match_partner`, `payment_tolerance_param`.

### 4.3 Bank statement import

Supported formats: **OFX, CSV, CAMT.053 (ISO 20022), QIF, XLS**. Import wizard parses file and creates `account_bank_statement_line` records. For Indonesian context, **CSV** and **MT940** are most common from local banks (BCA, Mandiri, BNI, BRI).

### 4.4 Payment methods

**Model: `account_payment_method`**. Built-in codes: `manual` (cash/wire), `check_printing`, `batch_payment`. For Indonesia, add: `bank_transfer` (standard), `giro` (postdated check common in textile), `cash`.

**Payment method lines** link methods to journals with optional outstanding account overrides.

### 4.5 Outstanding receipts/payments — the two-step flow

1. **Invoice posted:** DR AR / CR Revenue
2. **Payment registered:** DR Outstanding Receipts / CR AR (invoice → `in_payment`)
3. **Statement line imported:** DR Bank / CR Suspense
4. **Bank reconciliation:** Suspense replaced with Outstanding Receipts (invoice → `paid`)

**Bypass for cash:** Set Outstanding Receipts = Cash Account on journal → payment goes directly to `paid`.

### 4.6 Petty cash

Cash journal with `cash_control=True`. Cashbox counting wizard for open/close with denomination lines. Difference between computed and actual balance auto-generates profit/loss entry.

### 4.7 Internal transfers

Creates TWO paired JEs routing through a Liquidity Transfer Account (inter-bank transfer account). Source: DR Outstanding Payment / CR Transfer Account. Destination: DR Transfer Account / CR Outstanding Receipts. Each side reconciled independently with bank statements.

---

## 5. Fixed Assets

### 5.1 Asset data model

**Model: `account_asset`**

| Field | Type | Description |
|---|---|---|
| `name` | Varchar | Asset name |
| `original_value` | Decimal | Purchase/gross value |
| `book_value` | Decimal | Computed: original - accumulated depreciation |
| `salvage_value` | Decimal | Residual value |
| `value_residual` | Decimal | Remaining depreciable value |
| `acquisition_date` | Date | Purchase date |
| `method` | Enum | `linear`, `degressive`, `degressive_then_linear` |
| `method_number` | Integer | Number of depreciation periods |
| `method_period` | Enum | `1` (monthly) or `12` (yearly) |
| `method_progress_factor` | Decimal | Degressive factor |
| `prorata_computation_type` | Enum | `none`, `constant_periods`, `daily_computation` |
| `state` | Enum | `draft`, `open`, `paused`, `close` |
| `account_asset_id` | FK → account | Fixed asset BS account |
| `account_depreciation_id` | FK → account | Accumulated depreciation (contra) |
| `account_depreciation_expense_id` | FK → account | Depreciation expense P&L |
| `journal_id` | FK → journal | Depreciation journal |
| `asset_type` | Enum | `purchase` (asset), `sale` (deferred revenue), `expense` (deferred expense) |

### 5.2 State machine

```
draft → open (Running) → paused → open (Resume)
                       → close (Fully depreciated, auto)
                       → close (Disposed/Sold)
```

### 5.3 Depreciation formulas

**Straight-line (linear):**
```
Period Amount = (Original Value - Salvage Value - Already Depreciated) / Number of Periods
```

**Declining balance (degressive):**
```
Period Amount = Residual Value × Degressive Factor
Last period: Amount = remaining Residual Value
```

**Declining then linear (hybrid):**
```
Linear Amount = Depreciable Value / Remaining Periods
Degressive Amount = Residual Value × Factor
Period Amount = MAX(Linear, Degressive)
```

**Pro-rata temporis:**
```
constant_periods: First period = Full Amount × (Days to Period End / Days in Period)
daily_computation: Each period = (Depreciable Value / Total Days) × Days in Period
```

### 5.4 Depreciation entry generation

On asset confirmation, ALL future depreciation entries are generated as **draft** `account_move` records. A daily cron job posts entries where `date <= today`.

**Depreciation JE:**
```
DR  Depreciation Expense (P&L)     xxx
CR  Accumulated Depreciation (BS)  xxx
```

### 5.5 Disposal

**Write-off/Scrap:**
```
DR  Accumulated Depreciation     [total depreciated]
DR  Loss on Disposal             [remaining book value]
CR  Fixed Asset Account          [original value]
```

**Sale (gain):**
```
DR  Accumulated Depreciation     [total depreciated]
DR  Accounts Receivable          [sale price]
CR  Fixed Asset Account          [original value]
CR  Gain on Disposal             [sale price - book value]
```

**Gain/Loss = Sale Price - Book Value** where Book Value = Original - Accumulated Depreciation.

### 5.6 Asset models (templates)

Asset models use the same `account_asset` model with `state='model'`. Configure on GL accounts: `create_asset` = `draft`|`validate` with linked asset model. When a vendor bill is posted against that account, an asset is auto-created.

---

## 6. Financial Reporting

### 6.1 Balance Sheet

Date-based (single date). Aggregates all BS account types. P&L net balance flows to `equity_unaffected`. Uses `account_codes` engine referencing account prefixes.

### 6.2 Profit and Loss

Date-range. Aggregates income and expense account types. Supports period comparison.

### 6.3 Cash Flow Statement

Uses cash flow tags on accounts. Two approaches: **Direct method** (tags on cash accounts) and **Indirect method** (start from net income, adjust for non-cash items). Odoo uses tag-based engine.

### 6.4 Trial Balance

All accounts with debit/credit/balance columns. Supports hierarchy via account groups. Options: with opening balance, comparison periods.

### 6.5 General Ledger

All journal items grouped by account. Filterable by date range, journal, partner, account.

### 6.6 Custom report builder

The `account_report` + `account_report_line` + `account_report_expression` architecture supports building custom financial reports via XML definitions with multiple computation engines.

---

## 7. Budgeting and Cost Accounting

### 7.1 Budget data model

**Model: `budget`** (header)

| Field | Type | Description |
|---|---|---|
| `name` | Varchar | Budget name |
| `date_from` | Date | Period start |
| `date_to` | Date | Period end |
| `state` | Enum | `draft` → `confirm` → `validate` → `done` / `cancel` |
| `company_id` | FK → company | Company |

**Model: `budget_line`**

| Field | Type | Description |
|---|---|---|
| `budget_id` | FK → budget | Parent |
| `analytic_account_id` | FK → analytic_account | Cost center / project |
| `budgetary_position_id` | FK → budgetary_position | Links to GL accounts |
| `date_from` / `date_to` | Date | Line period |
| `planned_amount` | Decimal | Budgeted amount |
| `practical_amount` | Decimal | Computed: actual from analytic entries |
| `theoretical_amount` | Decimal | Computed: prorated planned for elapsed time |
| `percentage` | Decimal | Computed: practical / theoretical × 100 |

**Budgetary position** (`budget_position`): links a budget category name to multiple GL accounts via M2M relationship.

**Budget control (custom implementation required):** Override `account_move` validation to check budget. Three levels: Warning at threshold, Blocking at 100%, or Ignore. SAP Business One and ERPNext have this natively.

### 7.2 Analytic accounting (Odoo 17+ plans)

**Model: `analytic_plan`** — grouping container for analytic accounts. Fields: `name`, `parent_id` (hierarchy), `default_applicability` (Required/Optional/Unavailable).

**Model: `analytic_account`** — individual cost centers/projects. Fields: `name`, `code`, `plan_id`, `partner_id`, `balance` (computed from analytic lines).

**Model: `analytic_line`** — individual analytic items. Created automatically when journal entries with `analytic_distribution` are posted.

**Multi-plan analytics:** Each journal item stores analytic distribution as JSON: `{"analytic_id_1": 60.0, "analytic_id_2": 40.0}`. Supports simultaneous allocation to multiple plans.

**Distribution models** (`analytic_distribution_model`): auto-apply distributions based on conditions (account prefix, partner, product category).

### 7.3 Cost center structure for textile SME

```
Plan: Departments (Mandatory on Expense accounts)
  ├── Weaving / Dyeing
  ├── Cutting Department
  ├── Sewing Department
  ├── Finishing / QC
  ├── Warehouse / Logistics
  ├── Administration / Finance
  └── Sales / Marketing

Plan: Production Orders (Optional)
  ├── PO-2026-001 (Customer Order A)
  └── PO-2026-002 (Customer Order B)

Plan: Product Lines (Optional)
  ├── Woven Fabrics
  ├── Knit Fabrics
  └── Garments
```

---

## 8. Indonesian Tax Compliance

### 8.1 PPN (VAT) — effective rate 11%

**Legal basis:** UU No. 7/2021 (UU HPP) + PMK 131/2024. Official rate is **12%** since Jan 1, 2025, but non-luxury goods use DPP Nilai Lain = 11/12 × Harga Jual, making the **effective rate 11%**.

**ERP calculation logic:**
```
For non-luxury goods/services (99% of textile transactions):
  DPP = (11/12) × Harga_Jual
  PPN = 12% × DPP = 11% × Harga_Jual

For luxury goods (PPnBM items): PPN = 12% × Harga_Jual
For export: PPN = 0%
```

**Monthly netting:**
```
PPN_Kurang_Bayar = PPN_Keluaran - PPN_Masukan
If > 0: Pay by 15th, file by 20th of following month
If < 0: Compensate next month OR request restitusi
```

**Input PPN crediting conditions:** Valid Faktur Pajak approved by DJP/Coretax, related to taxable business, claimed within 3 months of issuance.

### 8.2 PPh 21 (Employee income tax)

**Progressive rates (on annual PKP):**
- Up to Rp60M: **5%**
- Rp60M–250M: **15%**
- Rp250M–500M: **25%**
- Rp500M–5B: **30%**
- Above Rp5B: **35%**

**PTKP (non-taxable income):** TK/0 = Rp54M, K/0 = Rp58.5M, each dependent +Rp4.5M (max 3).

**TER method (monthly withholding Jan-Nov):**
```
PPh_21_monthly = TER_Rate × Penghasilan_Bruto_Bulanan
```
Categories A (TK/0, TK/1, K/0), B (TK/2, K/1, TK/3, K/2), C (K/3) with rate tables from 0% to 34%.

**December true-up:**
```
Bruto_Annual = Σ(monthly gross Jan-Dec)
Pengurang = Biaya_Jabatan(5%, max Rp6M) + Iuran_Pensiun(max Rp2.4M)
Neto = Bruto - Pengurang
PKP = Neto - PTKP
PPh_Annual = Progressive rate on PKP
PPh_Dec = PPh_Annual - Σ(PPh_Jan-Nov)
```

**Textile sector PPh 21 DTP (2026):** Per PMK 105/2025, employees earning ≤Rp10M/month get PPh 21 borne by government. Employer must pay the PPh amount as cash to employee.

### 8.3 PPh 23 (Services tax)

**15%** on dividends, interest, royalties. **2%** on technical/management/consulting services, rent of non-land assets. **Doubles without NPWP.** Withholder deposits by 10th, files by 20th. Issues Bukti Potong.

### 8.4 PPh 4(2) (Final tax)

Key rates: Rent of land/building **10%**, Construction services **1.75–6%** (varies by certification), UMKM **0.5%** of gross revenue.

### 8.5 PPh 22 (Import tax)

```
Nilai_Impor = CIF + Bea_Masuk + Pungutan_Lainnya
PPh_22 = Rate × Nilai_Impor
```
Rates: With API-P: **2.5%**, Without API: **7.5%**. PPh 22 is creditable against annual corporate PPh.

### 8.6 PPh 25/29 (Corporate tax)

PPh 25 monthly installment = (Prior year PPh - Credits) / 12. Corporate rate: **22%**. SME first Rp4.8B revenue gets 50% discount (effective 11%).

### 8.7 Faktur Pajak and e-Faktur

**NSFP format (Coretax):** 17 digits = 2-digit Kode Transaksi + 2-digit Kode Status + 13-digit Nomor Seri.

**Kode Transaksi:** 01 (general domestic), 02 (government), 03 (other collectors), 04 (DPP Nilai Lain), 07 (PPN tidak dipungut), 08 (dibebaskan).

**Legacy CSV format** (semicolon separated):
```
FK;Kode_Jenis_Transaksi;FG_Pengganti;Nomor_Faktur;Masa_Pajak;Tahun_Pajak;
Tanggal_Faktur;NPWP_Lawan;Nama_Lawan;Alamat_Lawan;Jumlah_DPP;Jumlah_PPN;
Jumlah_PPnBM;ID_Keterangan_Tambahan;FG_Uang_Muka;Uang_Muka_DPP;
Uang_Muka_PPN;Uang_Muka_PPnBM;Referensi

OF;Kode_Objek;Nama_Objek;Harga_Satuan;Jumlah_Barang;Harga_Total;Diskon;
DPP;PPN;Tarif_PPnBM;PPnBM
```

**Coretax (2025+):** XML format, auto-generated NSFP, API via PJAP partners. 2026 is FULL implementation — DJP Online retired.

### 8.8 Tax data model requirements

**Tax master:** `tax_code`, `name`, `rate`, `type` (PPN/PPh21/PPh23/PPh4(2)/PPh22/PPh25), `is_final`, `account_receivable_id`, `account_payable_id`.

**NSFP range:** `start_number`, `end_number`, `current_counter`, `year`, `status`.

**Invoice tax fields:** `kode_transaksi`, `nsfp_number`, `faktur_pajak_date`, `dpp_type`, `dpp_amount`, `ppn_amount`.

**Partner tax fields:** `npwp` (15 or 16 digit), `nik`, `is_pkp`, `api_type` (API-U/API-P), `ptkp_status`, `ter_category`.

### 8.9 Tax journal entry templates

**PPN on sales (Rp100M + PPN 11%):**
```
DR  Piutang Dagang           Rp111,000,000
CR  Penjualan                Rp100,000,000
CR  PPN Keluaran              Rp11,000,000
```

**PPN on purchases (Rp50M + PPN 11%):**
```
DR  Persediaan Bahan Baku     Rp50,000,000
DR  PPN Masukan                Rp5,500,000
CR  Hutang Dagang             Rp55,500,000
```

**Monthly PPN settlement (Kurang Bayar):**
```
DR  PPN Keluaran              Rp11,000,000
CR  PPN Masukan                Rp5,500,000
CR  Hutang PPN Kurang Bayar    Rp5,500,000
```

**PPh 23 on services received (Rp20M, 2%):**
```
DR  Biaya Jasa Konsultan      Rp20,000,000
CR  Hutang PPh 23                Rp400,000
CR  Hutang Dagang             Rp19,600,000
```

**PPh 23 withheld on our service revenue:**
```
DR  Piutang Dagang            Rp19,600,000
DR  PPh 23 Dibayar Dimuka        Rp400,000
CR  Pendapatan Jasa           Rp20,000,000
```

**PPh 21 payroll (Rp150M gross, PPh Rp5M):**
```
DR  Beban Gaji               Rp150,000,000
CR  Hutang PPh 21              Rp5,000,000
CR  Hutang Gaji Karyawan     Rp145,000,000
```

**PPh 22 on import (CIF Rp200M, BM Rp20M):**
```
Nilai_Impor = Rp220M, PPh 22 = 2.5% × 220M = Rp5.5M, PPN = 11% × 220M = Rp24.2M

DR  Persediaan Bahan Baku    Rp220,000,000
DR  PPN Masukan               Rp24,200,000
DR  PPh 22 Dibayar Dimuka      Rp5,500,000
CR  Bank/Hutang              Rp249,700,000
```

### 8.10 SPT filing deadlines

| SPT | Payment Due | Filing Due |
|---|---|---|
| Masa PPN | 15th of M+1 | 20th of M+1 |
| Masa PPh 21 | 10th of M+1 | 20th of M+1 |
| Masa PPh 23 (Unifikasi) | 10th of M+1 | 20th of M+1 |
| Masa PPh 4(2) | 10th or 15th of M+1 | 20th of M+1 |
| Masa PPh 25 | 15th of M+1 | 20th of M+1 |
| Tahunan Badan | Before filing | April 30 |

---

## 9. Textile and Garment Industry Accounting

### 9.1 Cost flow diagram

```
RAW MATERIALS → WIP → FINISHED GOODS → COGS
(Fabric, Trims)   (Cut Panels, Sewn)   (Packed)   (Sold)

Purchase:        Issue to Production:   MO Complete:     Sale:
DR RM Inventory  DR WIP                DR FG Inventory  DR COGS
CR AP            CR RM Inventory       CR WIP           CR FG Inventory
                 Add Labor:
                 DR WIP
                 CR Wages Payable
                 Add Overhead:
                 DR WIP
                 CR Mfg OH Applied
```

### 9.2 Garment COGS calculation

**Unit COGS = Material Cost + Direct Labor + Manufacturing Overhead + Subcontracting**

**Realistic example — Men's Cotton Shirt (1,000 units):**

| Component | Per Unit | Total |
|---|---|---|
| Shell Fabric (1.55m × $4.50/m) | $6.98 | $6,975 |
| Lining/Interlining | $0.80 | $800 |
| Buttons, Labels, Thread | $1.20 | $1,200 |
| Cutting Labor | $0.50 | $500 |
| Sewing Labor | $2.80 | $2,800 |
| Finishing/Pressing | $0.60 | $600 |
| Factory Overhead | $1.50 | $1,500 |
| Waste Allowance (15%) | $1.05 | $1,046 |
| **Total COGS** | **$15.43** | **$15,421** |

### 9.3 BOM cost rollup formula

```
BOM Cost = Σ(Component Qty × Component Unit Cost) + Σ(Operation Duration × Work Center Cost/Hour)

Material Cost = Σ(component_qty × component.standard_price)
Labor Cost = Σ(operation_minutes / 60 × work_center.costs_hour)
Overhead Cost = Σ(operation_minutes / 60 × work_center.costs_hour_account)
```

**Size-dependent BOM consumption:**

| Size | Shell Fabric (m) | Lining (m) |
|---|---|---|
| S | 1.45 | 1.20 |
| M | 1.55 | 1.30 |
| L | 1.65 | 1.40 |
| XL | 1.80 | 1.50 |
| XXL | 1.95 | 1.65 |

Implementation: Separate BOMs per variant, or custom module with size-based consumption factors.

### 9.4 Color-size matrix

Product architecture: `product_template` (Style) → generates `product_product` variants via `product_attribute` (Color, Size). A single style in 8 colors × 7 sizes = **56 SKUs**. Each tracked independently in inventory with own valuation.

**Additional fields needed on product template:** `style_code`, `season` (SS26/AW26), `brand`, `size_scale`.

**SKU pattern:** `{Style}-{Color}-{Size}` (e.g., `CPL-RED-M`).

### 9.5 Fabric roll tracking

Extend `stock_lot` with textile-specific fields: `dye_lot`, `shade_code`, `actual_width` (cm), `actual_length` (m), `roll_weight` (kg), `gsm`, `shrinkage_warp_%`, `shrinkage_weft_%`, `inspection_points` (4-point score), `inspection_status`, `supplier_roll_no`.

**4-point inspection system:** Defects scored 1–4 points by length. Accept threshold: ≤40 points per 100 linear yards.

**Shade grouping rule:** Only rolls from same dye lot (or approved-matching lots) should be issued to the same cutting order.

### 9.6 Waste and shrinkage accounting

**Marker efficiency formula:**
```
Marker Efficiency (%) = (Total Pattern Area / Total Marker Area) × 100
Typical: 80–90%. Cutting Waste = 100% - Marker Efficiency.
```

**Fabric consumption with shrinkage:**
```
Adjusted Consumption = Base Consumption / (1 - Shrinkage%)
e.g., 1.55m / (1 - 0.05) = 1.632m
```

| Waste Type | Treatment |
|---|---|
| Normal waste (10–15% cutting, shrinkage, end-of-roll) | Absorbed into product cost via BOM |
| Abnormal waste (defective cutting, machine error) | Period expense: DR Abnormal Waste Loss / CR WIP |
| Sellable scrap (remnants) | DR Cash / CR Scrap Revenue or CR WIP |

### 9.7 CMT/Subcontracting

**Odoo subcontracting flow:**
1. Create BOM Type = "Subcontracting" with subcontractor(s)
2. PO to subcontractor for finished product triggers component reservation
3. Materials sent to subcontractor location (internal — no valuation impact)
4. Receive finished goods back

**Valuation:** `Product Cost = Components(from our stock) + Subcontractor Service Price`

**Accounting entries on receipt:**
```
DR  Finished Goods Valuation     (component cost + service cost)
CR  Raw Materials Valuation      (component cost)
CR  Stock Input Account          (service cost — cleared when bill posted)
```

### 9.8 Overhead allocation

**Formula:** `Predetermined OH Rate = Estimated Total OH / Estimated Allocation Base`

**Garment factory example:** Rp55M monthly overhead / 3,520 direct labor hours = **Rp15,625 per DLH**. For a shirt at 0.35 DLH: Applied OH = Rp5,469 per unit.

**Variance handling:**
```
Under-applied (Actual > Applied): DR COGS / CR Manufacturing OH
Over-applied (Applied > Actual): DR Manufacturing OH / CR COGS
```

### 9.9 Job costing vs process costing

**Recommended for garment manufacturing: Hybrid approach.**
- **Materials** → Job costing (fabric/trims tracked per production order since different styles use different fabrics)
- **Conversion costs** (labor + overhead) → Process costing (standardized rates per department)

```
Unit Cost = Job-specific Materials + Process-averaged Conversion
```

### 9.10 WIP valuation (equivalent units method)

**Steps:**
1. Track physical flow: Beginning WIP + Started = Completed + Ending WIP
2. Convert partial units to equivalent units (EU) based on completion %
3. Cost per EU = Total Costs / Equivalent Units
4. Allocate to completed goods and ending WIP

**Garment WIP completion stages:**

| Stage | Materials % | Conversion % |
|---|---|---|
| Cut Panels | 100% | 20% |
| Partially Sewn | 100% | 50% |
| Fully Sewn | 100% | 75% |
| Finished/QC | 100% | 90% |
| Packed | 100% | 100% |

### 9.11 Textile-specific data models needed

```
garment_size_curve — Size distribution for planning (XS=5%, S=15%, M=30%...)
garment_marker — Marker efficiency per style, fabric width, lay plan
garment_cutting_order — Links fabric rolls to production orders
garment_cost_sheet — Detailed cost breakdown per style
stock_lot (extended) — Dye lot, shade, width, length, GSM, shrinkage, 4-point score
```

---

## 10. Integration Points

### 10.1 Order-to-Cash complete flow

| Step | Module | Document | Journal Entry |
|---|---|---|---|
| 1 | Sales | sale_order confirmed | None (stock reserved) |
| 2 | Inventory | delivery validated | DR Stock Interim Delivered / CR Stock Valuation (at cost) |
| 3 | Accounting | invoice posted | DR AR / CR Revenue (at price). COGS: DR COGS / CR Stock Interim Delivered (at cost) |
| 4 | Accounting | payment registered | DR Outstanding Receipts / CR AR |
| 5 | Accounting | bank reconciled | DR Bank / CR Outstanding Receipts |

### 10.2 Procure-to-Pay complete flow

| Step | Module | Document | Journal Entry |
|---|---|---|---|
| 1 | Purchase | PO confirmed | None (receipt created) |
| 2 | Inventory | receipt validated | DR Stock Valuation / CR Stock Interim Received (GRNI) |
| 3 | Accounting | vendor bill posted | DR Stock Interim Received / CR AP. Price diff: DR/CR Price Difference |
| 4 | Accounting | payment registered | DR AP / CR Outstanding Payments |
| 5 | Accounting | bank reconciled | DR Outstanding Payments / CR Bank |

### 10.3 Manufacturing flow

| Step | Module | Document | Journal Entry |
|---|---|---|---|
| 1 | Manufacturing | MO confirmed | None (components reserved) |
| 2 | Manufacturing | MO completed | DR Production/WIP / CR Stock Valuation RM (consumption). DR Stock Valuation FG / CR Production/WIP (receipt) |
| 3 | Inventory | FG in warehouse | Stock moves for finished goods |

### 10.4 HR/Payroll flow (Indonesian)

| Component | Debit | Credit |
|---|---|---|
| Basic Salary + Allowances | Salary Expense | Salaries Payable |
| Employee PPh 21 | Salaries Payable | PPh 21 Payable |
| Employee BPJS Kesehatan (1%) | Salaries Payable | BPJS Kes Payable |
| Employee BPJS TK JHT (2%) | Salaries Payable | BPJS TK Payable |
| Employee BPJS TK JP (1%) | Salaries Payable | BPJS JP Payable |
| Company BPJS Kesehatan (4%) | BPJS Kes Expense | BPJS Kes Payable |
| Company BPJS TK JHT (3.7%) | BPJS JHT Expense | BPJS TK Payable |
| Company BPJS TK JKK (0.24–1.74%) | BPJS JKK Expense | BPJS TK Payable |
| Company BPJS TK JKM (0.3%) | BPJS JKM Expense | BPJS TK Payable |
| Company BPJS TK JP (2%) | BPJS JP Expense | BPJS JP Payable |

### 10.5 Automatic journal entry trigger map

| Module | Trigger Event | JE Type |
|---|---|---|
| Sales | Invoice posted | Revenue + AR |
| Sales | Payment registered | AR clearing |
| Purchase | Vendor bill posted | AP entry |
| Purchase | Payment registered | AP clearing |
| Inventory | Stock receipt validated (automated) | Stock Valuation vs Stock Interim |
| Inventory | Delivery validated (automated) | Stock Interim vs Stock Valuation |
| Inventory | Invoice posted (Anglo-Saxon) | COGS vs Stock Interim |
| Inventory | Adjustment validated | Stock Valuation vs Inventory Loss |
| Inventory | Landed cost validated | Stock Valuation vs Clearing |
| Manufacturing | MO completed (automated) | WIP vs Stock Valuation (RM + FG) |
| Payroll | Payslip confirmed | Salary Expense vs Payables/Tax |
| Bank | Statement reconciled | Bank vs Suspense/Outstanding |
| Assets | Depreciation cron | Depreciation Expense vs Accum Depr |

### 10.6 Default account resolution logic

1. Check Product's Income/Expense account
2. If blank → check Product Category
3. For stock accounts → check Location override, then Product Category
4. For taxes → apply Fiscal Position mapping
5. For analytics → apply Analytic Distribution Model rules

### 10.7 Product category configuration for textile SME

```
Raw Materials (Fabric, Yarn, Accessories):
  Costing Method: AVCO
  Inventory Valuation: Automated
  Stock Valuation: 1140 Persediaan Bahan Baku
  Stock Input: 1145 Barang Diterima Belum Ditagih (GRNI)
  Stock Output: 1146 Barang Dikirim Belum Ditagih (GDNI)
  Production Account: 1150 Barang Dalam Proses (WIP)
  Expense Account: 5100 Harga Pokok Produksi

Finished Goods (Garments):
  Costing Method: AVCO
  Inventory Valuation: Automated
  Stock Valuation: 1160 Persediaan Barang Jadi
  Expense Account: 5200 Harga Pokok Penjualan (COGS)
```

### 10.8 Period-end closing process

| Step | Action | Details |
|---|---|---|
| 1 | Cut-off transactions | Ensure all deliveries/receipts/invoices posted |
| 2 | Bank reconciliation | Reconcile all statements, clear outstanding items |
| 3 | GRNI accrual | Review Stock Interim Received balance |
| 4 | Inventory valuation | Verify Stock Valuation matches physical |
| 5 | Manufacturing WIP | Close completed MOs, assess WIP for open MOs |
| 6 | Payroll finalization | Post all payslips, BPJS/PPh 21 remittance |
| 7 | Cost allocation | Post overhead distribution JEs |
| 8 | Depreciation | Run schedule, post depreciation JEs |
| 9 | Currency revaluation | Post unrealized FX gain/loss |
| 10 | Tax reconciliation | Reconcile PPN, prepare SPT |
| 11 | Generate reports | BS, P&L, Trial Balance, Cash Flow |
| 12 | Lock period | Set lock date |

---

## Cross-system comparison summary

| Feature | Odoo 17/18 | SAP Business One | ERPNext |
|---|---|---|---|
| GL Architecture | `account.move.line` IS the GL | Separate GL table | Separate `GL Entry` doctype |
| Invoice Model | Unified `account.move` for all | Separate AR/AP Invoice | Separate Sales/Purchase Invoice |
| CoA Hierarchy | Flat with prefix-based groups | Flat with segmentation | Tree with parent/child |
| Budget Enforcement | Custom dev needed | Native Block/Warn | Native Stop/Warn/Ignore |
| Analytic/Cost Centers | Multi-plan JSON distribution | Dimensions + Distribution Rules | Hierarchical Cost Centers |
| Inventory Valuation | Standard/AVCO/FIFO, Auto/Manual | Standard/AVCO/FIFO | Standard/AVCO/FIFO, Perpetual |
| Manufacturing WIP | Production Account (v17+) | WIP via cost centers | WIP Account on product |
| Bank Reconciliation | Statement-less widget (v17+) | Manual matching | Bank Reconciliation Tool |
| Fixed Assets | Integrated asset model | Separate Asset Master | Separate Asset doctype |
| Indonesian Tax | l10n_id + e-Faktur module | Via partner localization | Community localization |
| Period Closing | Lock dates, no closing entry | Closing voucher required | Period Closing Voucher |

This specification covers the complete logic, data models, business rules, validation constraints, workflow states, calculation formulas, and journal entry templates needed to build a full-featured accounting module for an Indonesian textile/garment SME ERP system. The architecture follows Odoo's proven unified model approach while incorporating Indonesian tax compliance requirements and textile industry-specific cost accounting patterns.