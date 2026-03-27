# Module Summary — Keuangan (Finance)

> **Audit date**: 2026-03-27
> **Module status**: 50% (per CLAUDE.md)
> **Scope**: 29 pages, 36 components, 14 server action files, 15 API routes, 4 shared libraries

---

## 1. Documentation Status

| Metric | Count |
|--------|-------|
| **Total checklist items** | 186 |
| **Detailed QA docs written** | 1 (Section A — Finance Dashboard) |
| **Sections code-reviewed** | 24 / 24 (all sections audited at code level) |
| **Server actions audited** | 14 / 14 (double-entry bookkeeping verified) |
| **Tax compliance audited** | Full (PPN, PPh, e-Faktur) |
| **Test coverage audited** | Full (20 test files found, gaps identified) |

---

## 2. Key Findings

### 2.1 Accounting Workflows

The finance module covers a complete accounting lifecycle:

| Workflow | Status | Notes |
|----------|--------|-------|
| **Chart of Accounts** | Functional | Hierarchical tree, PSAK-aligned, system accounts via `SYS_ACCOUNTS` |
| **Double-Entry Bookkeeping** | 95% compliant | 19/21 actions create proper journal entries. 1 critical bug in `moveInvoiceToSent()` — GL posting outside transaction |
| **AR Cycle** | Functional | Invoice → Send → Payment → Credit Note. PPh withholding supported on AR side |
| **AP Cycle** | Functional | Bill from PO/PR → Approve → Pay. Multi-bill payment, Xendit integration |
| **Bank Reconciliation** | Functional | Import → Auto-match (3-pass confidence scoring) → Manual match → Close |
| **Fixed Assets** | Functional | Register → Categorize → Depreciate (SL, DB, UoP) → Dispose. 4 report types |
| **Cashflow Planning** | Functional | Planning board, scenario simulation, actual vs forecast, accuracy tracking |
| **Period-End Closing** | Functional | Fiscal period management, closing journal, year-end closing dialog |
| **Opening Balances** | Functional | GL, AP (vendor bills), AR (customer invoices) tabs |
| **Petty Cash** | Functional | Top-up and disburse with GL posting, on-the-fly account creation |
| **Budget** | Functional | Create budget, monthly lines, budget vs actual comparison |
| **Expenses** | Functional | Record expenses with category, account selection, GL posting |

### 2.2 Tax Compliance (PPN, PPh, e-Faktur)

**Overall assessment: NOT production-ready. Critical gaps in export detection, AP withholding, and e-Faktur validation.**

#### PPN (VAT — 11%)
| Feature | Status | Risk |
|---------|--------|------|
| PPN calculation on invoices | ✅ Working (11%) | — |
| PPN Masukan (Input Tax) tracking | ✅ On AP bills | — |
| PPN Keluaran (Output Tax) tracking | ✅ On AR invoices | — |
| PPN Settlement (Masukan vs Keluaran) | ✅ `postPPNSettlement()` in GL | — |
| **0% PPN for export invoices** | **MISSING** | **CRITICAL — exports charged 11%** |
| PPN carry-forward / refund eligibility | MISSING | HIGH |
| SPT Masa PPN format generation | MISSING | HIGH |
| Mixed PPN rates per invoice line | MISSING | MEDIUM |

#### PPh (Withholding Tax)
| Feature | Status | Risk |
|---------|--------|------|
| PPh recording on AR payment (customer withholds) | ✅ Working | — |
| PPh type selection (21, 23, 4(2)) | ✅ UI dropdown | — |
| PPh deposit to tax authority (`markWithholdingDeposited`) | ✅ With GL posting | — |
| PPh summary report | ✅ Grouped by type | — |
| PPh helper functions (rates, deadlines) | ✅ In `pph-helpers.ts` | — |
| **PPh deposit deadline enforcement** | **MISSING** | **CRITICAL — no 10th-of-month warning** |
| **AP withholding (we withhold from vendors)** | **MISSING** | **CRITICAL — only AR side implemented** |
| NPWP-based rate adjustment (2x if no NPWP) | EXISTS but never called | HIGH |
| Bukti Potong validation (uniqueness, timeliness) | MISSING | HIGH |
| SPT filing tracking | MISSING | HIGH |

#### e-Faktur (Electronic Tax Invoice)
| Feature | Status | Risk |
|---------|--------|------|
| CSV export with 19 DJP columns | ✅ Working | — |
| NPWP padding (15 digits) | ✅ Correct | — |
| Date format (DD/MM/YYYY) | ✅ Correct | — |
| **Sequential invoice numbering validation** | **MISSING** | **CRITICAL — DJP rejects non-sequential** |
| **Export vs domestic distinction** | **MISSING** | **CRITICAL — KD_JENIS_TRANSAKSI hardcoded "01"** |
| Replacement invoice tracking (FG_PENGGANTI) | MISSING | MEDIUM |
| Advance payment handling (FG_UANG_MUKA) | MISSING | MEDIUM |
| Posted-to-e-Faktur status tracking | MISSING | MEDIUM |

### 2.3 Financial Reporting

| Report | Status | Notes |
|--------|--------|-------|
| Laba Rugi (P&L) | ✅ | Revenue, COGS, operating expenses, other income/expense, net income. Depreciation separated. Drill-down to transactions |
| Neraca (Balance Sheet) | ✅ | Current/fixed/other assets, current/long-term liabilities, equity. Balance check diagnostic if unbalanced |
| Arus Kas (Cash Flow) | ✅ | Operating, investing, financing activities. Beginning/ending cash |
| Neraca Saldo (Trial Balance) | ✅ | Debit/credit columns with drill-down. Reconciliation preview dialog |
| Perubahan Ekuitas | ✅ | Equity changes statement |
| AR Aging | ✅ | Aging buckets, customer breakdown |
| AP Aging | ✅ | Aging buckets, vendor breakdown |
| Inventory Turnover | ✅ | Cross-module report |
| Laporan Pajak PPN | ✅ | PPN Keluaran vs Masukan, net status |
| Laporan PPh | ✅ | By type, deposited vs outstanding, deposit action |
| Budget vs Actual | ✅ | Variance analysis |
| **Comparative P&L (period-over-period)** | ✅ | Component exists but usage unclear |
| **All reports in single API call** | ✅ | `useFinanceReportsAll()` — tab switching is instant |

---

## 3. All Issues — Prioritized by Severity

### CRITICAL (Production Blockers)

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| C1 | **`moveInvoiceToSent()` GL posting outside transaction** | `lib/actions/finance-invoices.ts` | Invoice marked ISSUED but if crash occurs before GL post, no journal entry exists. Violates double-entry bookkeeping. |
| C2 | **Export invoices charged 11% PPN** | `lib/actions/finance.ts:1173` | Indonesia law: exports = 0% PPN. All export invoices will have incorrect tax. |
| C3 | **AP withholding (PPh) not implemented** | `lib/actions/finance-ap.ts` | When paying vendors for services, system doesn't withhold PPh 23. Only AR side (customer withholds) exists. |
| C4 | **e-Faktur sequential numbering not validated** | `lib/actions/finance-efaktur.ts` | DJP rejects e-Faktur submissions with non-sequential invoice numbers. No gap/duplicate detection. |
| C5 | **PPh deposit deadline not enforced** | `lib/actions/finance-pph.ts` | PPh deposits must be by 10th of M+1. `getDepositDeadline()` exists but is NEVER CALLED. Can accumulate unpaid PPh indefinitely. |
| C6 | **e-Faktur export/domestic distinction hardcoded** | `lib/actions/finance-efaktur.ts` | `KD_JENIS_TRANSAKSI` always "01" (domestic). No support for "02" (export). |

### MEDIUM

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | **No error state on Finance Dashboard** | `app/finance/page.tsx` | If `useFinanceDashboard` query fails, page shows skeleton forever. No error message, no retry. |
| M2 | **`recordInvoicePayment()` GL posting outside transaction** | `lib/actions/finance-invoices.ts` | GL posting is outside `withPrismaAuth()` to avoid deadlock. Manual rollback exists but not atomic. |
| M3 | **Duplicate PPh GL account codes** | `lib/gl-accounts.ts` | `PPH_21_PAYABLE: "2210"` and `PPH21_PAYABLE: "2310"` both exist. Different codes used in different places — could cause GL imbalances. |
| M4 | **Tax rates hardcoded, not configurable** | `lib/tax-rates.ts` | PPN 11%, PPh 23 2% etc. are `const`. Cannot accommodate regulatory changes without code deployment. |
| M5 | **NPWP-based PPh rate adjustment exists but never called** | `pph-helpers.ts` | `adjustRateForNpwp()` doubles PPh 23 if vendor has no NPWP. Function exists but is never invoked. |
| M6 | **No PPN carry-forward / refund eligibility** | Reports | Report shows net PPN but no settlement rules, no carry-forward from prior month. |
| M7 | **Asset sale hardcodes `BANK_BCA`** | `lib/actions/finance-fixed-assets.ts:969` | `createAssetMovement()` for SALE uses `SYS_ACCOUNTS.BANK_BCA` — should be configurable per transaction. |
| M8 | **`AccountingModuleActions` uses rounded-2xl Card** | `components/finance/accounting-module-actions.tsx` | Non-NB design in an otherwise NB-styled dashboard page. Visual inconsistency. |
| M9 | **No SPT filing tracking** | Database schema | No table for monthly SPT (Tax Return) filing status. Cannot prove filing compliance. |
| M10 | **No bukti potong validation** | `lib/actions/finance-pph.ts` | Tax certificate numbers not validated for uniqueness, format, or timeliness (5-day rule). |

### LOW

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| L1 | **ActionItemsWidget imported but never used** | `app/finance/page.tsx:14` | Dead import. Page renders its own inline action items widget. |
| L2 | **Action items always show 4 items regardless** | `app/finance/page.tsx` | Zero-count items still display as `type: 'info'`. Noise when no real action needed. |
| L3 | **No date validation in Report dialog** | `accounting-module-actions.tsx` | Start date can be after end date. No client-side check. |
| L4 | **Quick journal dialog limited to 2 lines** | `accounting-module-actions.tsx` | Only 1 debit + 1 credit. Not communicated that complex journals need `/finance/journal/new`. |
| L5 | **"Rekonsiliasi" quick link goes to `/finance/reports`** | `app/finance/page.tsx` | Misleading — should link to `/finance/reconciliation`. |
| L6 | **Master data loads on every mount (not cached)** | `accounting-module-actions.tsx` | `useEffect` fetches vendors, bills, GL accounts without TanStack Query caching. |
| L7 | **`any` type usage in dashboard rendering** | `app/finance/page.tsx` | `item: any` in `map()` calls loses type safety. Data is typed at server but cast to `any` at render. |
| L8 | **Mixed Supabase + Prisma in getFinancialMetrics** | `lib/actions/finance-reports.ts` | Dual data path (Supabase primary, Prisma fallback) adds complexity. |
| L9 | **No PPh rate input validation in UI** | `app/finance/invoices/page.tsx` | PPh rate field allows any value (0%, 100%, negative). No bounds check. |
| L10 | **No e-Faktur format validation before export** | `lib/actions/finance-efaktur.ts` | No check for NOMOR_FAKTUR format, ALAMAT_LENGKAP length (max 250), DPP >= 0. |
| L11 | **No replacement invoice (FG_PENGGANTI) support** | `lib/actions/finance-efaktur.ts` | Corrected invoices cannot be properly documented in e-Faktur. |

---

## 4. Missing Test Coverage

### Current State: 20 test files found

| Area | Files | Coverage |
|------|-------|----------|
| Journal reversals | 1 | ✅ Good |
| AR bank charges & bad debt | 2 | ✅ Good |
| WHT on vendor payments | 1 | ✅ Good |
| PPh helpers & integration | 2 | ✅ Good |
| Bank reconciliation matching | 2 | ✅ Good |
| Closing journal & period-end | 4 | ✅ Good |
| GL control account restrictions | 1 | ✅ Good |
| COGS recognition | 1 | ✅ Good |
| Currency helpers | 1 | ✅ Good |
| Payment term helpers | 1 | ✅ Good |
| Cashflow planning & accuracy | 2 | ✅ Good |
| Cross-module consistency | 1 | ✅ Good |
| Finance helpers & audit | 2 | ✅ Good |

### ZERO Test Coverage (Critical Gaps)

| Gap | Priority | Estimated Tests Needed | Why Critical |
|-----|----------|----------------------|-------------|
| **Invoice creation GL posting** | P0 | 50+ | Core transaction — no tests for AR/AP invoice journal entries |
| **Payment recording GL posting** | P0 | 40+ | Payments are the most common transaction — untested |
| **Fixed asset depreciation** | P1 | 30+ | Depreciation calculations (SL, DB, UoP) and GL posting untested |
| **e-Faktur export format** | P1 | 20+ | Tax authority submission format — compliance risk if wrong |
| **Report generation accuracy** | P1 | 60+ | P&L, BS, CF — zero tests for any financial report |
| **PPN (VAT) calculations** | P1 | 15+ | Tax-inclusive vs exclusive, export 0%, mixed rates |
| **Opening/closing balances** | P2 | 25+ | Balance carryforward, multi-period continuity |
| **Multi-currency GL impact** | P2 | 20+ | Realized/unrealized FX gain/loss untested |
| **Budget vs actual variance** | P3 | 15+ | GL-level budget comparison untested |
| **Manual journal entry server action** | P3 | 10+ | `postJournalEntry()` success path never tested directly |

---

## 5. Recommended QA Test Cases for Stakeholder Demo

### Demo Scenario: "A Day in the Life of an Indonesian SME Accountant"

#### Test Case 1: Full AR Cycle (Invoice → Payment)
```
1. Open /finance/invoices
2. Create invoice from Sales Order (via CreateInvoiceDialog)
3. Verify KPI strip updates (Draft count +1)
4. Send invoice (WhatsApp/Email)
5. Verify status changes to ISSUED
6. Record payment (full amount)
7. Verify GL: DR Bank, CR Piutang Usaha
8. Verify KPI: Lunas count +1
9. Check /finance/reports → P&L shows revenue
10. Check /finance/reports → Balance Sheet shows bank increase
```

#### Test Case 2: Full AP Cycle (Bill → Payment)
```
1. Open /finance/bills
2. View bill from PO (auto-created on GRN)
3. Approve bill → verify GL: DR Expense, CR Hutang Usaha
4. Record payment (manual transfer)
5. Verify GL: DR Hutang Usaha, CR Bank
6. Check vendor payment appears in /finance/vendor-payments
7. Export payment CSV in BCA format
```

#### Test Case 3: PPh Withholding on AR Payment
```
1. Open /finance/invoices → select ISSUED invoice
2. Record payment with "Dipotong PPh oleh Customer" checked
3. Select PPh 23, rate 2%
4. Verify: net received = total - PPh amount
5. Verify GL: DR Bank (net), DR PPh Dibayar Dimuka (PPh), CR Piutang
6. Open /finance/reports → PPh Report tab
7. Verify PPh 23 line shows outstanding
8. Mark as deposited → verify GL: DR PPh Payable, CR Bank
```

#### Test Case 4: PPN Tax Report
```
1. Create several AR invoices (with PPN) and AP bills (with PPN)
2. Open /finance/reports → Laporan Pajak PPN tab
3. Verify PPN Keluaran matches AR invoice tax amounts
4. Verify PPN Masukan matches AP bill tax amounts
5. Verify net PPN status (KURANG_BAYAR or LEBIH_BAYAR)
```

#### Test Case 5: Bank Reconciliation
```
1. Open /finance/reconciliation
2. Create new reconciliation for Bank BCA
3. Import bank statement (CSV upload)
4. Run Auto-Match → verify confidence scores (HIGH/MEDIUM/LOW)
5. Manually match remaining items
6. Exclude irrelevant items
7. Close reconciliation → verify GL auto-posting for bank charges
```

#### Test Case 6: Fixed Asset Depreciation
```
1. Open /finance/fixed-assets → create category (Mesin, SL, 5 years)
2. Create asset (Mesin Jahit, Rp 50.000.000)
3. Open /finance/fixed-assets/depreciation
4. Preview depreciation run → verify monthly amount (Rp 833.333)
5. Post depreciation → verify GL: DR Beban Penyusutan, CR Akumulasi
6. Check /finance/fixed-assets/reports → NBV decreased
```

#### Test Case 7: Period-End Closing
```
1. Open /finance/reports → Neraca Saldo (Trial Balance)
2. Verify debit total = credit total
3. Open /finance/fiscal-periods
4. Close current period → verify posting blocked for closed period
5. Open /finance/journal → Closing Journal Dialog
6. Preview closing entries (revenue/expense → retained earnings)
7. Post closing journal
8. Verify Balance Sheet: retained earnings updated
```

#### Test Case 8: Cashflow Planning & Simulation
```
1. Open /finance/planning → view auto-populated items from AR/AP
2. Add manual cashflow item (e.g., yearly insurance payment)
3. Switch to Simulasi tab → create scenario "Optimistic"
4. Toggle items, override amounts
5. Switch to Aktual tab → compare actual vs planned
6. Check accuracy trend widget
```

#### Test Case 9: Credit Note & Settlement
```
1. Open /finance/credit-notes → create Sales CN (customer return)
2. Post to GL → verify DR Revenue, CR Piutang
3. Open Settlement dialog → apply to outstanding invoice
4. Verify invoice balanceDue reduced
5. Check AR Aging report updated
```

#### Test Case 10: Dashboard KPIs Accuracy
```
1. Open /finance → verify 4 KPI cards
2. Cross-check Posisi Kas against /finance/chart-accounts (sum of cash accounts)
3. Cross-check Piutang against /finance/receivables aging total
4. Cross-check Utang against /finance/payables aging total
5. Cross-check Laba Bersih against /finance/reports → P&L net margin
```

---

## Appendix: Architecture Notes

### Server Action Split (14 files)
| File | Functions | Domain |
|------|-----------|--------|
| `finance.ts` | 50+ | Legacy hub (being split) |
| `finance-ar.ts` | 15 | Accounts Receivable |
| `finance-ap.ts` | 10 | Accounts Payable |
| `finance-gl.ts` | 25+ | General Ledger |
| `finance-invoices.ts` | 13 | Invoice CRUD |
| `finance-cashflow.ts` | 15 | Cashflow planning |
| `finance-budget.ts` | 4 | Budget management |
| `finance-reconciliation.ts` | 15 | Bank reconciliation |
| `finance-fixed-assets.ts` | 20 | Fixed asset lifecycle |
| `finance-petty-cash.ts` | 7 | Petty cash |
| `finance-pph.ts` | 3 | PPh withholding |
| `finance-dcnotes.ts` | 7 | Debit/Credit notes |
| `finance-efaktur.ts` | 2 | e-Faktur export |
| `finance-reports.ts` | 10 | Financial reports |

### Data Flow Pattern
```
UI Page → TanStack Query hook → Server Action → withPrismaAuth() → Prisma → PostgreSQL
                                       ↓
                              postJournalEntry() → GL balance updates
```

### Key Design Decisions
1. **Double-entry enforced at action level** — every financial transaction must call `postJournalEntry()`
2. **System accounts centralized** — `lib/gl-accounts.ts` prevents hardcoded account codes
3. **Tax rates centralized** — `lib/tax-rates.ts` (but hardcoded, not DB-configurable)
4. **Consolidated report API** — `useFinanceReportsAll()` fetches all report data in one call, tab switching is instant
5. **Supabase + Prisma dual path** — metrics use Supabase direct, with Prisma fallback
