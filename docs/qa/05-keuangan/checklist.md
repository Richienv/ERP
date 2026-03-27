# QA Checklist — Modul Keuangan (Finance)

> Generated: 2026-03-27 | Module audit completed: 2026-03-27
> Scope: All pages, subpages, dialogs, components, and report tabs under `/finance`, `/accountant`, and finance-related features.
> **Module Summary**: [`_module-summary.md`](_module-summary.md) — 6 critical issues, 10 medium, 11 low

## Legend

| Symbol | Meaning |
|--------|---------|
| `⬜` | Not tested |
| `✅` | Full QA doc written |
| `✅ᴬ` | Code-audited (module-level review, no standalone QA doc) |
| `⚠️` | Partial / has issues |
| `❌` | Failed / broken |

---

## A. Finance Dashboard

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| A1 | Finance Dashboard (main) | `app/finance/page.tsx` | `/finance` | ✅ [QA](A-finance-dashboard.md) |
| A2 | — KPI Cards (Cash, AR, AP, Margin) | `app/finance/page.tsx` | `/finance` | ✅ [QA](A-finance-dashboard.md) |
| A3 | — Cash Flow Chart (7-day) | `components/finance/cash-flow-chart.tsx` | `/finance` | ✅ [QA](A-finance-dashboard.md) |
| A4 | — Action Items Widget | `components/finance/action-items-widget.tsx` | `/finance` | ✅ [QA](A-finance-dashboard.md) |
| A5 | — Module Quick Links | `components/finance/accounting-module-actions.tsx` | `/finance` | ✅ [QA](A-finance-dashboard.md) |
| A6 | — Module Actions Dialogs (AP, COA, GL, Reports) | `components/finance/accounting-module-actions.tsx` | `/finance` | ✅ [QA](A-finance-dashboard.md) |

---

## B. Invoices (Faktur — AR/AP)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| B1 | Invoice Center (kanban list) | `app/finance/invoices/page.tsx` | `/finance/invoices` | ✅ᴬ |
| B2 | — KPI Strip (Draft, Terkirim, Jatuh Tempo, Lunas) | `app/finance/invoices/page.tsx` | `/finance/invoices` | ✅ᴬ |
| B3 | — Filter Toolbar (search, type, status) | `app/finance/invoices/page.tsx` | `/finance/invoices` | ✅ᴬ |
| B4 | — Create Invoice Dialog (dari SO / PO / manual) | `components/finance/create-invoice-dialog.tsx` | `/finance/invoices` | ✅ᴬ |
| B5 | — Invoice Detail (expand/inline view) | `app/finance/invoices/page.tsx` | `/finance/invoices` | ✅ᴬ |
| B6 | — Send Invoice (WhatsApp / Email) | `app/finance/invoices/page.tsx` | `/finance/invoices` | ⚠️ C1: GL outside txn |
| B7 | — Record Payment Dialog (AR) | `app/finance/invoices/page.tsx` | `/finance/invoices` | ✅ᴬ |
| B8 | — PPh Withholding in Payment | `app/finance/invoices/page.tsx` | `/finance/invoices` | ⚠️ AR-only, no AP |
| B9 | — Edit Draft Invoice | `app/finance/invoices/page.tsx` | `/finance/invoices` | ✅ᴬ |
| B10 | — Invoice Attachments | `components/finance/invoice-attachments.tsx` | `/finance/invoices` | ✅ᴬ |
| B11 | — Audit Log Timeline | `app/finance/invoices/page.tsx` | `/finance/invoices` | ✅ᴬ |
| B12 | — e-Faktur Export Dialog | `components/finance/efaktur-export-dialog.tsx` | `/finance/invoices` | ⚠️ C4,C6: seq+export |
| B13 | Invoice Detail Redirect | `app/finance/invoices/[id]/page.tsx` | `/finance/invoices/[id]` | ✅ᴬ |
| B14 | Loading Skeleton | `app/finance/invoices/loading.tsx` | `/finance/invoices` | ✅ᴬ |

---

## C. Receivables (Piutang Usaha — AR Hub)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| C1 | Receivables Hub Page | `app/finance/receivables/page.tsx` | `/finance/receivables` | ✅ᴬ |
| C2 | — AR Aging KPI Strip | `app/finance/receivables/page.tsx` | `/finance/receivables` | ✅ᴬ |
| C3 | — Tab: Penerimaan (AR Payments) | `app/finance/receivables/page.tsx` | `/finance/receivables` | ✅ᴬ |
| C4 | — Tab: Nota Kredit (Credit Notes) | `components/finance/nota-kredit-tab.tsx` | `/finance/receivables` | ✅ᴬ |

---

## D. AR Payments (Penerimaan Pembayaran)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| D1 | AR Payments Page | `app/finance/payments/page.tsx` | `/finance/payments` | ✅ᴬ |
| D2 | — AR Payments View (registry, unallocated cash) | `app/finance/payments/payments-view.tsx` | `/finance/payments` | ✅ᴬ |
| D3 | — Record AR Payment | `app/finance/payments/payments-view.tsx` | `/finance/payments` | ✅ᴬ |
| D4 | — Match Payment to Invoice | `app/finance/payments/payments-view.tsx` | `/finance/payments` | ✅ᴬ |
| D5 | Loading Skeleton | `app/finance/payments/loading.tsx` | `/finance/payments` | ✅ᴬ |

---

## E. Payables (Hutang Usaha — AP Hub)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| E1 | Payables Hub Page | `app/finance/payables/page.tsx` | `/finance/payables` | ✅ᴬ |
| E2 | — AP Aging KPI Strip | `app/finance/payables/page.tsx` | `/finance/payables` | ✅ᴬ |
| E3 | — Tab: Tagihan (Bills) | `app/finance/payables/page.tsx` | `/finance/payables` | ✅ᴬ |
| E4 | — Tab: Pembayaran (Vendor Payments) | `app/finance/payables/page.tsx` | `/finance/payables` | ✅ᴬ |
| E5 | — Tab: Nota Debit | `components/finance/nota-debit-tab.tsx` | `/finance/payables` | ✅ᴬ |

---

## F. Bills (Tagihan Vendor — AP)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| F1 | Bills Page (list) | `app/finance/bills/page.tsx` | `/finance/bills` | ✅ᴬ |
| F2 | — Bill KPI Strip (Draft, Open, Overdue, Paid) | `app/finance/bills/page.tsx` | `/finance/bills` | ✅ᴬ |
| F3 | — Bill Detail Dialog | `app/finance/bills/page.tsx` | `/finance/bills` | ✅ᴬ |
| F4 | — Record Payment Dialog (manual) | `app/finance/bills/page.tsx` | `/finance/bills` | ✅ᴬ |
| F5 | — Record Payment Dialog (Xendit) | `app/finance/bills/page.tsx` | `/finance/bills` | ✅ᴬ |
| F6 | — Multi-Bill Select & Pay | `app/finance/bills/page.tsx` | `/finance/bills` | ✅ᴬ |
| F7 | — Dispute Bill | `app/finance/bills/page.tsx` | `/finance/bills` | ✅ᴬ |

---

## G. Vendor Payments (Pembayaran Vendor)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| G1 | Vendor Payments Page (checkbook) | `app/finance/vendor-payments/page.tsx` | `/finance/vendor-payments` | ✅ᴬ |
| G2 | — Record Payment Dialog (with signature) | `app/finance/vendor-payments/page.tsx` | `/finance/vendor-payments` | ✅ᴬ |
| G3 | — Multi-Payment Dialog | `components/finance/vendor-multi-payment-dialog.tsx` | `/finance/vendor-payments` | ✅ᴬ |
| G4 | — Bank Export (CSV, BCA, Danamon formats) | `app/finance/vendor-payments/page.tsx` | `/finance/vendor-payments` | ✅ᴬ |

---

## H. Credit / Debit Notes (Nota Kredit & Nota Debit)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| H1 | DC Notes Page (list) | `app/finance/credit-notes/page.tsx` | `/finance/credit-notes` | ✅ᴬ |
| H2 | — Filter (type: CN/DN, status) | `app/finance/credit-notes/page.tsx` | `/finance/credit-notes` | ✅ᴬ |
| H3 | — Create DC Note Dialog (multi-step) | `components/finance/create-dcnote-dialog.tsx` | `/finance/credit-notes` | ✅ᴬ |
| H4 | — Post DC Note to GL | `app/finance/credit-notes/page.tsx` | `/finance/credit-notes` | ✅ᴬ |
| H5 | — Settlement Dialog (apply to invoice) | `components/finance/dcnote-settlement-dialog.tsx` | `/finance/credit-notes` | ✅ᴬ |
| H6 | — Void DC Note | `app/finance/credit-notes/page.tsx` | `/finance/credit-notes` | ✅ᴬ |

---

## I. Chart of Accounts (Bagan Akun)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| I1 | COA Page (hierarchical tree) | `app/finance/chart-accounts/page.tsx` | `/finance/chart-accounts` | ✅ᴬ |
| I2 | — Search & Filter by Type | `app/finance/chart-accounts/page.tsx` | `/finance/chart-accounts` | ✅ᴬ |
| I3 | — Create Account Dialog | `app/finance/chart-accounts/page.tsx` | `/finance/chart-accounts` | ✅ᴬ |
| I4 | — Balance Equation Validation | `app/finance/chart-accounts/page.tsx` | `/finance/chart-accounts` | ✅ᴬ |
| I5 | — Recursive AccountNode Expand/Collapse | `app/finance/chart-accounts/page.tsx` | `/finance/chart-accounts` | ✅ᴬ |

---

## J. General Journal (Jurnal Umum)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| J1 | Journal List Page | `app/finance/journal/page.tsx` | `/finance/journal` | ✅ᴬ |
| J2 | — Search & Filter (status, date) | `app/finance/journal/page.tsx` | `/finance/journal` | ✅ᴬ |
| J3 | — Export CSV | `app/finance/journal/page.tsx` | `/finance/journal` | ✅ᴬ |
| J4 | — Create Journal Dialog (quick) | `components/finance/journal/create-journal-dialog.tsx` | `/finance/journal` | ✅ᴬ |
| J5 | — Closing Journal Dialog | `components/finance/closing-journal-dialog.tsx` | `/finance/journal` | ✅ᴬ |
| J6 | Create Journal Entry Page (full form) | `app/finance/journal/new/page.tsx` | `/finance/journal/new` | ✅ᴬ |
| J7 | — Multi-line Debit/Credit Entry | `app/finance/journal/new/page.tsx` | `/finance/journal/new` | ✅ᴬ |
| J8 | — Balance Validation (debit = credit) | `app/finance/journal/new/page.tsx` | `/finance/journal/new` | ✅ᴬ |
| J9 | — Account Selection (GL picker) | `app/finance/journal/new/page.tsx` | `/finance/journal/new` | ✅ᴬ |

---

## K. Account Transactions (Transaksi Akun)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| K1 | Transactions Page | `app/finance/transactions/page.tsx` | `/finance/transactions` | ✅ᴬ |
| K2 | — Filter by Type (Piutang, Hutang, etc.) | `app/finance/transactions/page.tsx` | `/finance/transactions` | ✅ᴬ |
| K3 | — Search Transactions | `app/finance/transactions/page.tsx` | `/finance/transactions` | ✅ᴬ |
| K4 | — Expandable Transaction Lines | `app/finance/transactions/page.tsx` | `/finance/transactions` | ✅ᴬ |

---

## L. Cashflow Planning (Perencanaan Arus Kas)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| L1 | Planning Layout (month nav, tabs) | `app/finance/planning/layout.tsx` | `/finance/planning/*` | ✅ᴬ |
| L2 | Planning Board (auto/manual items) | `app/finance/planning/page.tsx` | `/finance/planning` | ✅ᴬ |
| L3 | — Cashflow Planning Board | `components/finance/cashflow-planning-board.tsx` | `/finance/planning` | ✅ᴬ |
| L4 | — Create Cashflow Item Dialog | `components/finance/create-cashflow-item-dialog.tsx` | `/finance/planning` | ✅ᴬ |
| L5 | — Accuracy Trend | `app/finance/planning/page.tsx` | `/finance/planning` | ✅ᴬ |
| L6 | — Forecast View | `app/finance/planning/page.tsx` | `/finance/planning` | ✅ᴬ |
| L7 | — Upcoming Obligations | `app/finance/planning/page.tsx` | `/finance/planning` | ✅ᴬ |
| L8 | Simulasi (Scenario) Page | `app/finance/planning/simulasi/page.tsx` | `/finance/planning/simulasi` | ✅ᴬ |
| L9 | — Scenario Sidebar (create/load/delete) | `components/finance/cashflow-simulasi-sidebar.tsx` | `/finance/planning/simulasi` | ✅ᴬ |
| L10 | — Scenario Board (toggle items, override amounts) | `components/finance/cashflow-simulasi-board.tsx` | `/finance/planning/simulasi` | ✅ᴬ |
| L11 | — Scenario Dialog (create/rename) | `components/finance/cashflow-scenario-dialog.tsx` | `/finance/planning/simulasi` | ✅ᴬ |
| L12 | Aktual (Actual vs Plan) Page | `app/finance/planning/aktual/page.tsx` | `/finance/planning/aktual` | ✅ᴬ |
| L13 | — Aktual Board (weekly breakdown) | `components/finance/cashflow-aktual-board.tsx` | `/finance/planning/aktual` | ✅ᴬ |
| L14 | Cashflow Forecast Redirect | `app/finance/cashflow-forecast/page.tsx` | `/finance/cashflow-forecast` | ✅ᴬ |

---

## M. Bank Reconciliation (Rekonsiliasi Bank)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| M1 | Reconciliation Page | `app/finance/reconciliation/page.tsx` | `/finance/reconciliation` | ✅ᴬ |
| M2 | — Bank Reconciliation View | `components/finance/bank-reconciliation-view.tsx` | `/finance/reconciliation` | ✅ᴬ |
| M3 | — Import Bank Statement | `components/finance/bank-reconciliation-view.tsx` | `/finance/reconciliation` | ✅ᴬ |
| M4 | — Auto-Match | `components/finance/bank-reconciliation-view.tsx` | `/finance/reconciliation` | ✅ᴬ |
| M5 | — Manual Match / Unmatch | `components/finance/bank-reconciliation-view.tsx` | `/finance/reconciliation` | ✅ᴬ |
| M6 | — Batch Match Multiple Items | `components/finance/bank-reconciliation-view.tsx` | `/finance/reconciliation` | ✅ᴬ |
| M7 | — Exclude / Include Items | `components/finance/bank-reconciliation-view.tsx` | `/finance/reconciliation` | ✅ᴬ |
| M8 | — Close Reconciliation | `components/finance/bank-reconciliation-view.tsx` | `/finance/reconciliation` | ✅ᴬ |

---

## N. Expenses (Beban / Pengeluaran)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| N1 | Expenses Page | `app/finance/expenses/page.tsx` | `/finance/expenses` | ✅ᴬ |
| N2 | — Record Expense Form (category, account, amount) | `app/finance/expenses/page.tsx` | `/finance/expenses` | ✅ᴬ |
| N3 | — Expense List (history) | `app/finance/expenses/page.tsx` | `/finance/expenses` | ✅ᴬ |

---

## O. Petty Cash (Kas Kecil)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| O1 | Petty Cash Page | `app/finance/petty-cash/page.tsx` | `/finance/petty-cash` | ✅ [QA](O-petty-cash.md) |
| O2 | — Top-Up Dialog | `app/finance/petty-cash/page.tsx` | `/finance/petty-cash` | ✅ [QA](O-petty-cash.md) |
| O3 | — Disbursement Dialog | `app/finance/petty-cash/page.tsx` | `/finance/petty-cash` | ✅ [QA](O-petty-cash.md) |
| O4 | — Transaction History | `app/finance/petty-cash/page.tsx` | `/finance/petty-cash` | ✅ [QA](O-petty-cash.md) |
| O5 | — Create Account On-The-Fly (Combobox) | `app/finance/petty-cash/page.tsx` | `/finance/petty-cash` | ✅ [QA](O-petty-cash.md) |

---

## P. Fixed Assets (Aset Tetap)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| P1 | Fixed Assets Register Page | `app/finance/fixed-assets/page.tsx` | `/finance/fixed-assets` | ✅ᴬ |
| P2 | — KPI Strip (total, active, cost, accum depr, NBV) | `app/finance/fixed-assets/page.tsx` | `/finance/fixed-assets` | ✅ᴬ |
| P3 | — Filter (status, category) | `app/finance/fixed-assets/page.tsx` | `/finance/fixed-assets` | ✅ᴬ |
| P4 | — Create Asset Dialog | `components/finance/fixed-assets/create-asset-dialog.tsx` | `/finance/fixed-assets` | ✅ᴬ |
| P5 | — Asset Movement Dialog (dispose/sell/transfer) | `components/finance/fixed-assets/asset-movement-dialog.tsx` | `/finance/fixed-assets` | ⚠️ M7: hardcoded BANK_BCA |
| P6 | Categories Page | `app/finance/fixed-assets/categories/page.tsx` | `/finance/fixed-assets/categories` | ✅ᴬ |
| P7 | — Create/Edit Category Dialog | `app/finance/fixed-assets/categories/page.tsx` | `/finance/fixed-assets/categories` | ✅ᴬ |
| P8 | — Default Depreciation Method & Useful Life | `app/finance/fixed-assets/categories/page.tsx` | `/finance/fixed-assets/categories` | ✅ᴬ |
| P9 | Depreciation Runs Page | `app/finance/fixed-assets/depreciation/page.tsx` | `/finance/fixed-assets/depreciation` | ✅ᴬ |
| P10 | — Preview Depreciation Run | `app/finance/fixed-assets/depreciation/page.tsx` | `/finance/fixed-assets/depreciation` | ✅ᴬ |
| P11 | — Post Depreciation to Journal | `app/finance/fixed-assets/depreciation/page.tsx` | `/finance/fixed-assets/depreciation` | ✅ᴬ |
| P12 | — Reverse Depreciation Run | `app/finance/fixed-assets/depreciation/page.tsx` | `/finance/fixed-assets/depreciation` | ✅ᴬ |
| P13 | Reports Page (4 tabs) | `app/finance/fixed-assets/reports/page.tsx` | `/finance/fixed-assets/reports` | ✅ᴬ |
| P14 | — Tab: Asset Register | `app/finance/fixed-assets/reports/page.tsx` | `/finance/fixed-assets/reports` | ✅ᴬ |
| P15 | — Tab: Depreciation Schedule | `app/finance/fixed-assets/reports/page.tsx` | `/finance/fixed-assets/reports` | ✅ᴬ |
| P16 | — Tab: Asset Movements | `app/finance/fixed-assets/reports/page.tsx` | `/finance/fixed-assets/reports` | ✅ᴬ |
| P17 | — Tab: Net Book Value Summary | `app/finance/fixed-assets/reports/page.tsx` | `/finance/fixed-assets/reports` | ✅ᴬ |
| P18 | Settings Page (depreciation methods info) | `app/finance/fixed-assets/settings/page.tsx` | `/finance/fixed-assets/settings` | ✅ᴬ |

---

## Q. Financial Reports (Laporan Keuangan)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| Q1 | Reports Hub Page | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q2 | — KPI Cards (Revenue, Expense, Net, Margin) | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q3 | — Date Range Filter | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q4 | — Download Report (CSV / XLSX) | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q5 | — Report: Laba Rugi (P&L) | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q6 | — Report: Neraca (Balance Sheet) | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q7 | — Report: Arus Kas (Cash Flow) | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q8 | — Report: Neraca Saldo (Trial Balance) | `components/finance/reports/trial-balance-panel.tsx` | `/finance/reports` | ✅ᴬ |
| Q9 | — Report: Perubahan Ekuitas (Equity Changes) | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q10 | — Report: AR Aging | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q11 | — Report: AP Aging | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q12 | — Report: Inventory Turnover | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q13 | — Report: Laporan Pajak PPN (Tax) | `app/finance/reports/page.tsx` | `/finance/reports` | ⚠️ C2: 0% export missing |
| Q14 | — Report: Laporan PPh (Withholding Tax) | `app/finance/reports/page.tsx` | `/finance/reports` | ⚠️ C3,C5: AP+deadline |
| Q15 | — Report: Budget vs Actual | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q16 | — Drill-Down Panel (click account to see txns) | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q17 | — Balance Check Diagnostic (BS unbalanced) | `app/finance/reports/page.tsx` | `/finance/reports` | ✅ᴬ |
| Q18 | — Reconciliation Preview Dialog | `components/finance/reports/reconciliation-preview-dialog.tsx` | `/finance/reports` | ✅ᴬ |
| Q19 | — Comparative Report View | `components/finance/reports/comparative-report-view.tsx` | `/finance/reports` | ✅ᴬ |

---

## R. Opening Balances (Saldo Awal)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| R1 | Opening Balances Page | `app/finance/opening-balances/page.tsx` | `/finance/opening-balances` | ✅ᴬ |
| R2 | — Tab: GL Balances | `components/finance/opening-balances-gl.tsx` | `/finance/opening-balances` | ✅ᴬ |
| R3 | — Tab: AP (Vendor Bills) | `components/finance/opening-balances-apar.tsx` | `/finance/opening-balances` | ✅ᴬ |
| R4 | — Tab: AR (Customer Invoices) | `components/finance/opening-balances-apar.tsx` | `/finance/opening-balances` | ✅ᴬ |

---

## S. Fiscal Periods (Periode Fiskal)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| S1 | Fiscal Periods Page | `app/finance/fiscal-periods/page.tsx` | `/finance/fiscal-periods` | ✅ᴬ |
| S2 | — Generate Fiscal Year | `app/finance/fiscal-periods/page.tsx` | `/finance/fiscal-periods` | ✅ᴬ |
| S3 | — Close Period (with AlertDialog) | `app/finance/fiscal-periods/page.tsx` | `/finance/fiscal-periods` | ✅ᴬ |
| S4 | — Reopen Period | `app/finance/fiscal-periods/page.tsx` | `/finance/fiscal-periods` | ✅ᴬ |
| S5 | — Year-End Closing Dialog | `components/finance/closing-year-dialog.tsx` | `/finance/fiscal-periods` | ✅ᴬ |

---

## T. Currencies (Mata Uang)

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| T1 | Currencies Page | `app/finance/currencies/page.tsx` | `/finance/currencies` | ✅ᴬ |
| T2 | — Add Currency Dialog | `app/finance/currencies/page.tsx` | `/finance/currencies` | ✅ᴬ |
| T3 | — Exchange Rate History | `app/finance/currencies/page.tsx` | `/finance/currencies` | ✅ᴬ |
| T4 | — Add / Delete Exchange Rate | `app/finance/currencies/page.tsx` | `/finance/currencies` | ✅ᴬ |
| T5 | — Delete Currency | `app/finance/currencies/page.tsx` | `/finance/currencies` | ✅ᴬ |

---

## U. Accountant Module

| # | Subpage / Feature | File Path | Route | Status |
|---|---|---|---|---|
| U1 | Accountant Command Center | `app/accountant/page.tsx` | `/accountant` | ✅ᴬ |
| U2 | — Financial Command Center (KPIs) | `components/accountant/financial-command-center.tsx` | `/accountant` | ✅ᴬ |
| U3 | — Invoice Aging (AI strategies) | `components/accountant/invoice-aging.tsx` | `/accountant` | ✅ᴬ |
| U4 | — Bank Reconciliation (AI matching) | `components/accountant/bank-reconciliation.tsx` | `/accountant` | ✅ᴬ |
| U5 | Accountant COA Page | `app/accountant/coa/page.tsx` | `/accountant/coa` | ✅ᴬ |

---

## V. Finance API Routes

| # | Endpoint | File Path | Methods | Status |
|---|---|---|---|---|
| V1 | `/api/finance/transactions` | `app/api/finance/transactions/route.ts` | GET | ✅ᴬ |
| V2 | `/api/finance/reconciliation` | `app/api/finance/reconciliation/route.ts` | GET | ✅ᴬ |
| V3 | `/api/finance/opening-balances` | `app/api/finance/opening-balances/route.ts` | GET, POST | ✅ᴬ |
| V4 | `/api/finance/currencies` | `app/api/finance/currencies/route.ts` | GET, POST, DELETE | ✅ᴬ |
| V5 | `/api/finance/fiscal-periods` | `app/api/finance/fiscal-periods/route.ts` | GET, POST | ✅ᴬ |
| V6 | `/api/finance/cashflow-plan` | `app/api/finance/cashflow-plan/route.ts` | GET | ✅ᴬ |
| V7 | `/api/finance/cashflow-forecast` | `app/api/finance/cashflow-forecast/route.ts` | GET | ✅ᴬ |
| V8 | `/api/finance/cashflow-actual` | `app/api/finance/cashflow-actual/route.ts` | GET | ✅ᴬ |
| V9 | `/api/finance/cashflow-accuracy` | `app/api/finance/cashflow-accuracy/route.ts` | GET | ✅ᴬ |
| V10 | `/api/finance/cashflow-upcoming` | `app/api/finance/cashflow-upcoming/route.ts` | GET | ✅ᴬ |
| V11 | `/api/finance/cashflow-scenarios` | `app/api/finance/cashflow-scenarios/route.ts` | GET, POST | ✅ᴬ |
| V12 | `/api/finance/cashflow-scenarios/[id]` | `app/api/finance/cashflow-scenarios/[id]/route.ts` | GET, PUT, DELETE | ✅ᴬ |
| V13 | `/api/finance/invoices/[id]/attachments` | `app/api/finance/invoices/[id]/attachments/route.ts` | GET, POST | ✅ᴬ |
| V14 | `/api/finance/invoice-attachments/[id]` | `app/api/finance/invoice-attachments/[id]/route.ts` | DELETE | ✅ᴬ |
| V15 | `/api/finance/reports` | `app/api/finance/reports/route.ts` | GET | ✅ᴬ |

---

## W. Server Actions (Backend Logic)

| # | Action File | Key Functions | Status |
|---|---|---|---|
| W1 | `lib/actions/finance.ts` | Main hub — getFinancialMetrics, createCustomerInvoice, recordARPayment, etc. | ✅ᴬ |
| W2 | `lib/actions/finance-ar.ts` | AR — provisionBadDebt, writeOffBadDebt, createCreditNote, processRefund, GIRO | ✅ᴬ |
| W3 | `lib/actions/finance-ap.ts` | AP — getVendorBills, approveVendorBill, recordMultiBillPayment, disputeBill | ✅ᴬ |
| W4 | `lib/actions/finance-gl.ts` | GL — postJournalEntry, createGLAccount, openingBalances, closingJournal, trialBalance | ✅ᴬ |
| W5 | `lib/actions/finance-invoices.ts` | Invoices — createCustomerInvoice, updateDraftInvoice, createBillFromPO/SO/PR | ⚠️ C1: GL outside txn |
| W6 | `lib/actions/finance-cashflow.ts` | Cashflow — planning, scenarios, forecast, actuals, upcoming obligations | ✅ᴬ |
| W7 | `lib/actions/finance-budget.ts` | Budget — getBudgets, getBudgetVsActual, createBudget, saveBudgetLines | ✅ᴬ |
| W8 | `lib/actions/finance-reconciliation.ts` | Recon — create, import, autoMatch, close, exclude/include | ✅ᴬ |
| W9 | `lib/actions/finance-fixed-assets.ts` | FA — categories, assets, depreciation runs, movements, reports | ⚠️ M7: hardcoded bank |
| W10 | `lib/actions/finance-petty-cash.ts` | Petty Cash — topUp, disburse, expense/bank accounts | ✅ᴬ |
| W11 | `lib/actions/finance-pph.ts` | PPh — getWithholdingTaxes, markDeposited, getPPhSummary | ⚠️ C3,C5: AP+deadline |
| W12 | `lib/actions/finance-dcnotes.ts` | DC Notes — create, post, settle, void | ✅ᴬ |
| W13 | `lib/actions/finance-efaktur.ts` | e-Faktur — getEligibleInvoices, exportCSV | ⚠️ C4,C6: seq+export |
| W14 | `lib/actions/finance-reports.ts` | Reports — dashboard, metrics, equity changes, inventory turnover, tax | ✅ᴬ |

---

## X. Shared Finance Libraries

| # | Library | File Path | Purpose | Status |
|---|---|---|---|---|
| X1 | GL Account Constants | `lib/gl-accounts.ts` | SYS_ACCOUNTS, ensureSystemAccounts(), isCOGSAccount() | ⚠️ M3: duplicate PPh codes |
| X2 | Tax Rate Constants | `lib/tax-rates.ts` | TAX_RATES (PPN, PPh 21/23, Corporate) | ⚠️ M4: hardcoded, not configurable |
| X3 | Finance Dashboard Hook | `hooks/use-finance-dashboard.ts` | useFinanceDashboard() | ✅ᴬ |
| X4 | Finance Reports Hook | `hooks/use-finance-reports.ts` | useFinanceReportsAll() | ✅ᴬ |

---

## Summary

| Section | Feature Area | Items | ✅ | ✅ᴬ | ⚠️ |
|---------|-------------|-------|---|------|-----|
| A | Finance Dashboard | 6 | 6 | — | — |
| B | Invoices (AR/AP) | 14 | — | 11 | 3 |
| C | Receivables Hub | 4 | — | 4 | — |
| D | AR Payments | 5 | — | 5 | — |
| E | Payables Hub | 5 | — | 5 | — |
| F | Bills (AP) | 7 | — | 7 | — |
| G | Vendor Payments | 4 | — | 4 | — |
| H | Credit/Debit Notes | 6 | — | 6 | — |
| I | Chart of Accounts | 5 | — | 5 | — |
| J | General Journal | 9 | — | 9 | — |
| K | Account Transactions | 4 | — | 4 | — |
| L | Cashflow Planning | 14 | — | 14 | — |
| M | Bank Reconciliation | 8 | — | 8 | — |
| N | Expenses | 3 | — | 3 | — |
| O | Petty Cash | 5 | — | 5 | — |
| P | Fixed Assets | 18 | — | 17 | 1 |
| Q | Financial Reports | 19 | — | 17 | 2 |
| R | Opening Balances | 4 | — | 4 | — |
| S | Fiscal Periods | 5 | — | 5 | — |
| T | Currencies | 5 | — | 5 | — |
| U | Accountant Module | 5 | — | 5 | — |
| V | API Routes | 15 | — | 15 | — |
| W | Server Actions | 14 | — | 10 | 4 |
| X | Shared Libraries | 4 | — | 2 | 2 |
| **TOTAL** | | **186** | **6** | **168** | **12** |

> **Full QA doc** (✅): 6 items (Section A)
> **Code-audited** (✅ᴬ): 168 items — reviewed at code level, findings in [`_module-summary.md`](_module-summary.md)
> **Issues flagged** (⚠️): 12 items — 6 critical, 10 medium, 11 low (see summary)
