# Financial Reports & AR/AP Fixes Implementation Plan
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans

**Date:** 2026-03-04
**Module:** Finance (`/finance/reports`, `/finance/payments`)
**Bahasa Indonesia:** All labels, statuses, and error messages in Bahasa Indonesia.

---

## Part A: AR/AP Bug Fixes

### Task 1: Fix AR Customer Dropdown

**Problem:** The AR payment registry page (`/finance/payments`) calls `getARPaymentRegistry()` which already returns `allCustomers`, but the UI component may not be wiring the customer dropdown correctly, causing the filter to fail or show empty.

**Files to modify:**
- `/Volumes/Extreme SSD/new-erp-feb/ERP/app/finance/payments/payments-view.tsx` -- Verify customer dropdown uses `registry.allCustomers` from the hook data. Ensure `ComboboxWithCreate` or a searchable `Select` is used (not a plain `<select>`). Wire `customerId` filter param into `useARPayments()`.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/hooks/use-ar-payments.ts` -- The `queryKey` must include all filter params (`paymentsQ`, `invoicesQ`, `customerId`, `paymentPage`, `invoicePage`) so TanStack Query refetches when filters change. Currently it uses `queryKeys.arPayments.all` which is static -- fix to include params.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/query-keys.ts` -- Add parameterized key factory: `arPayments: { all: ['arPayments'] as const, list: (params: Record<string,any>) => ['arPayments', 'list', params] as const }`

**Implementation:**
1. In `use-ar-payments.ts`, change `queryKey` from `queryKeys.arPayments.all` to `queryKeys.arPayments.list({ paymentsQ, invoicesQ, customerId, paymentPage, invoicePage })`.
2. In `payments-view.tsx`, ensure the customer Select/Combobox maps over `data.registry.allCustomers` with `value={c.id}` and `label={c.name}`.
3. When `customerId` changes, the hook auto-refetches because queryKey changed.

---

### Task 2: Verify Invoice Allocation Flow

**Problem:** After fixing the customer dropdown, verify that allocating a payment to an invoice (clicking "Alokasikan" button) correctly:
- Updates `Payment.invoiceId`
- Reduces `Invoice.balanceDue`
- Creates a `JournalEntry` (debit Cash, credit AR)
- Updates invoice status to `PAID` if `balanceDue === 0`, or `PARTIAL` if `balanceDue > 0`

**Files to verify/modify:**
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/actions/finance.ts` -- Find `allocatePaymentToInvoice` or equivalent function. Verify it updates `balanceDue`, posts journal entry, and transitions invoice status.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/app/finance/payments/payments-view.tsx` -- After allocation, invalidate `queryKeys.arPayments.all` AND `queryKeys.financeReports.all` so the reports page reflects changes.

**Key checks:**
- `invoice.balanceDue = invoice.balanceDue - payment.amount`
- If `balanceDue <= 0` then `status = 'PAID'`
- If `balanceDue > 0 && balanceDue < totalAmount` then `status = 'PARTIAL'`
- Journal entry: Debit `1000` (Kas/Bank), Credit `1200` (Piutang Usaha)

---

### Task 3: Ensure SO-Generated Invoices Appear in AR

**Problem:** When a Sales Order is invoiced (`SalesOrder -> Invoice`), the generated invoice must have `type: 'INV_OUT'` and `status: 'ISSUED'` so it appears in the AR open invoices list and AR aging report.

**Files to verify/modify:**
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/actions/finance-invoices.ts` -- Find the `createInvoiceFromSO` or equivalent. Verify it sets `type: 'INV_OUT'`, `status: 'ISSUED'`, `customerId` from the SO, and `balanceDue = totalAmount`.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/actions/sales.ts` -- If invoice creation is triggered from sales flow, verify it calls the finance invoice action correctly.

**Validation:**
- After creating invoice from SO, call `getARAgingReport()` and confirm the new invoice appears in `details[]`.
- After creating invoice from SO, call `getARPaymentRegistry()` and confirm it appears in `openInvoices[]`.

---

## Part B: New Financial Reports (Xero-style)

### Task 4: Statement of Changes in Equity (Laporan Perubahan Ekuitas)

**Description:** Shows how equity accounts changed during a period: opening balance, net income, dividends, capital injections, closing balance.

**Files to create/modify:**
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/actions/finance-reports.ts` -- Add `getEquityChangesStatement(startDate, endDate)` server action.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/app/finance/reports/page.tsx` -- Add `"equity_changes"` to `ReportType`, add tab button and render section.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/hooks/use-finance-reports.ts` -- Add `getEquityChangesStatement` to the parallel fetch.

**Server action `getEquityChangesStatement(startDate, endDate)`:**
```
Interface EquityChangesData {
  items: {
    accountCode: string
    accountName: string
    openingBalance: number
    netIncome: number        // only for Retained Earnings row
    dividends: number        // debit entries to equity accounts with "Dividen" description
    capitalChanges: number   // other debit/credit entries to equity accounts
    closingBalance: number
  }[]
  totalOpening: number
  totalClosing: number
  period: { startDate: string; endDate: string }
}
```

**Key calculation:**
1. Query all `GLAccount` where `type = 'EQUITY'` (code 3xxx).
2. For each account, get `openingBalance` = account balance from journal lines BEFORE `startDate`.
3. Get all journal lines for equity accounts within `[startDate, endDate]` where `entry.status = 'POSTED'`.
4. `closingBalance = openingBalance + credits - debits` (equity has CREDIT normal balance).
5. Add a synthetic "Laba Ditahan Periode Ini" row using `getProfitLossStatement(startDate, endDate).netIncome`.

**UI (Bahasa Indonesia labels):**
- Header: "Laporan Perubahan Ekuitas"
- Columns: Akun | Saldo Awal | Laba Bersih | Dividen | Perubahan Modal | Saldo Akhir

---

### Task 5: Inventory Turnover Report (Laporan Perputaran Persediaan)

**Description:** Shows how fast inventory moves. Critical for textile/garment businesses to identify slow-moving fabric/materials.

**Files to create/modify:**
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/actions/finance-reports.ts` -- Add `getInventoryTurnoverReport(startDate, endDate)` server action.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/app/finance/reports/page.tsx` -- Add `"inventory_turnover"` to `ReportType`, tab button, render section.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/hooks/use-finance-reports.ts` -- Add to parallel fetch.

**Server action `getInventoryTurnoverReport(startDate, endDate)`:**
```
Interface InventoryTurnoverData {
  items: {
    productId: string
    productName: string
    sku: string
    category: string
    openingStock: number
    received: number         // PO_RECEIVE + PRODUCTION_IN transactions
    issued: number           // SO_SHIPMENT + PRODUCTION_OUT transactions
    closingStock: number
    avgInventory: number     // (opening + closing) / 2
    cogs: number             // issued * unit cost
    turnoverRatio: number    // cogs / avgInventory (or issued / avgInventory in units)
    daysOnHand: number       // 365 / turnoverRatio (or period_days / turnoverRatio)
  }[]
  summary: {
    totalCOGS: number
    avgTurnover: number
    slowMovingCount: number  // items with turnoverRatio < 1
    fastMovingCount: number  // items with turnoverRatio > 4
  }
  period: { startDate: string; endDate: string }
}
```

**Key calculation:**
1. Query `Product` with their `StockLevel` for current stock.
2. Query `InventoryTransaction` within `[startDate, endDate]` grouped by `productId` and `type`.
3. `openingStock = closingStock - received + issued` (back-calculate).
4. `avgInventory = (openingStock + closingStock) / 2`.
5. `turnoverRatio = issued / avgInventory` (in units, simpler for textile SME).
6. `daysOnHand = periodDays / turnoverRatio`.
7. Flag items where `turnoverRatio < 1` as "Lambat Bergerak".

**UI (Bahasa Indonesia labels):**
- Header: "Laporan Perputaran Persediaan"
- Columns: Produk | SKU | Kategori | Stok Awal | Masuk | Keluar | Stok Akhir | Rasio Perputaran | Hari di Gudang
- Color code: Red for `daysOnHand > 90`, Yellow for `> 45`, Green for `<= 45`.

---

### Task 6: Tax Report / PPN Report (Laporan PPN)

**Description:** Shows PPN (Pajak Pertambahan Nilai / VAT) collected from sales vs PPN paid on purchases. Indonesian tax compliance requires this monthly.

**Files to create/modify:**
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/actions/finance-reports.ts` -- Add `getPPNReport(startDate, endDate)` server action.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/app/finance/reports/page.tsx` -- Add `"ppn"` to `ReportType`, tab button, render section.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/hooks/use-finance-reports.ts` -- Add to parallel fetch.

**Server action `getPPNReport(startDate, endDate)`:**
```
Interface PPNReportData {
  ppnKeluaran: {                     // Output VAT (from sales)
    invoices: {
      number: string
      customerName: string
      date: Date
      dpp: number                    // Dasar Pengenaan Pajak (tax base)
      ppn: number                    // 11% of DPP
    }[]
    totalDPP: number
    totalPPN: number
  }
  ppnMasukan: {                      // Input VAT (from purchases)
    bills: {
      number: string
      supplierName: string
      date: Date
      dpp: number
      ppn: number
    }[]
    totalDPP: number
    totalPPN: number
  }
  summary: {
    ppnKeluaran: number              // Total output VAT
    ppnMasukan: number               // Total input VAT
    ppnKurangBayar: number           // Net VAT payable (keluaran - masukan, if positive)
    ppnLebihBayar: number            // Net VAT refundable (masukan - keluaran, if positive)
  }
  period: { startDate: string; endDate: string }
}
```

**Key calculation:**
1. Query `Invoice` where `type = 'INV_OUT'` and `status NOT IN ('CANCELLED', 'VOID', 'DRAFT')` within period -> PPN Keluaran.
2. `dpp = invoice.subtotal`, `ppn = invoice.taxAmount`.
3. Query `Invoice` where `type = 'INV_IN'` same filters -> PPN Masukan.
4. `ppnKurangBayar = max(0, totalPPNKeluaran - totalPPNMasukan)`.
5. `ppnLebihBayar = max(0, totalPPNMasukan - totalPPNKeluaran)`.

**UI (Bahasa Indonesia labels):**
- Header: "Laporan PPN (Pajak Pertambahan Nilai)"
- Two sections: "PPN Keluaran (Penjualan)" and "PPN Masukan (Pembelian)"
- Summary card at top: PPN Keluaran | PPN Masukan | Kurang Bayar / Lebih Bayar
- PPN rate assumption: 11% (standard Indonesian PPN rate)

---

### Task 7: Budget vs Actual Report (Laporan Anggaran vs Realisasi)

**Description:** Compare budgeted amounts per GL account against actual journal entries. Requires a new `Budget` Prisma model.

**Files to create/modify:**
- `/Volumes/Extreme SSD/new-erp-feb/ERP/prisma/schema.prisma` -- Add `Budget` and `BudgetLine` models.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/actions/finance-reports.ts` -- Add `getBudgetVsActualReport(budgetId)` server action.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/lib/actions/finance.ts` -- Add `createBudget()`, `updateBudget()`, `getBudgets()` CRUD actions.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/app/finance/reports/page.tsx` -- Add `"budget_vs_actual"` to `ReportType`, with budget selector dropdown.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/hooks/use-finance-reports.ts` -- Add to parallel fetch (or separate hook for budget-specific queries).

**New Prisma models:**
```prisma
model Budget {
  id          String       @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String       // e.g. "Anggaran 2026"
  startDate   DateTime
  endDate     DateTime
  description String?
  isActive    Boolean      @default(true)
  lines       BudgetLine[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@map("budgets")
}

model BudgetLine {
  id        String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  budgetId  String  @db.Uuid
  accountId String  @db.Uuid
  month     Int     // 1-12 (allows monthly budgeting)
  amount    Decimal @db.Decimal(15, 2)

  budget  Budget    @relation(fields: [budgetId], references: [id], onDelete: Cascade)
  account GLAccount @relation(fields: [accountId], references: [id])

  @@unique([budgetId, accountId, month])
  @@index([budgetId])
  @@map("budget_lines")
}
```

**NOTE:** Add `budgetLines BudgetLine[]` to the existing `GLAccount` model.

**Migration:** `npx prisma migrate dev --name add_budget_model`

**Server action `getBudgetVsActualReport(budgetId)`:**
```
Interface BudgetVsActualData {
  budgetName: string
  period: { startDate: string; endDate: string }
  rows: {
    accountCode: string
    accountName: string
    accountType: string
    budgetAmount: number       // Sum of BudgetLine.amount for this account across selected months
    actualAmount: number       // Sum of JournalLine debit-credit for this account in the period
    variance: number           // budgetAmount - actualAmount
    variancePercent: number    // (variance / budgetAmount) * 100
    status: 'under' | 'on_track' | 'over'  // over if actual > budget * 1.1
  }[]
  totals: {
    totalBudget: number
    totalActual: number
    totalVariance: number
  }
}
```

**Key calculation:**
1. Load `Budget` with `lines` (include `account`).
2. Group `BudgetLine` by `accountId`, sum `amount` across months in the budget period.
3. For each account, query `JournalLine` entries within `[budget.startDate, budget.endDate]` where `entry.status = 'POSTED'`.
4. For EXPENSE accounts: `actual = sum(debit) - sum(credit)`.
5. For REVENUE accounts: `actual = sum(credit) - sum(debit)`.
6. `variance = budget - actual` (positive = under budget = good for expenses).
7. `status = actual > budget * 1.1 ? 'over' : actual > budget * 0.9 ? 'on_track' : 'under'`.

**UI (Bahasa Indonesia labels):**
- Header: "Laporan Anggaran vs Realisasi"
- Budget selector dropdown at top (fetch from `getBudgets()`)
- Columns: Kode Akun | Nama Akun | Anggaran | Realisasi | Selisih | Selisih % | Status
- Color code: Red for "over", Green for "under", Yellow for "on_track"
- Summary row at bottom with totals

---

## Part C: Enhance Existing Reports

### Task 8: Xero-style Report UI Enhancement

**Description:** Upgrade the reports page with a polished, professional look inspired by Xero's report interface. Add comparative periods (this year vs last year), print-friendly layout, and better export.

**Files to modify:**
- `/Volumes/Extreme SSD/new-erp-feb/ERP/app/finance/reports/page.tsx` -- Major UI overhaul.
- `/Volumes/Extreme SSD/new-erp-feb/ERP/hooks/use-finance-reports.ts` -- Fetch comparative period data.

**UI Improvements:**

1. **Report Navigation Sidebar** (left side, within the page):
   - Group reports into categories:
     - "Laporan Utama": Laba Rugi, Neraca, Arus Kas
     - "Laporan Pajak": PPN
     - "Laporan Piutang/Hutang": AR Aging, AP Aging
     - "Laporan Lainnya": Neraca Saldo, Perubahan Ekuitas, Perputaran Persediaan, Anggaran vs Realisasi
   - Active report highlighted

2. **Report Header Bar:**
   - Report title (large, bold)
   - Period display: "1 Januari 2026 - 4 Maret 2026" (Indonesian date format)
   - Quick period presets: "Bulan Ini", "Kuartal Ini", "Tahun Ini", "Tahun Lalu"
   - Custom date range picker (existing dialog)
   - Export button (CSV/XLS -- already exists, keep)
   - Print button: `window.print()` with `@media print` CSS

3. **Comparative Periods (for P&L and Balance Sheet):**
   - Add toggle: "Bandingkan dengan Periode Sebelumnya"
   - When enabled, show two columns: "Periode Ini" and "Periode Lalu"
   - Calculate percentage change between periods
   - Fetch by calling `getProfitLossStatement()` twice with different date ranges

4. **Print-friendly CSS:**
   - Add `@media print` styles to hide sidebar, header, export buttons
   - Report content fills full page width
   - Add company name and "Dicetak pada: [date]" footer
   - Page breaks between report sections

5. **Report type update:**
   ```ts
   type ReportType = "pnl" | "bs" | "cf" | "tb" | "ar_aging" | "ap_aging"
                   | "equity_changes" | "inventory_turnover" | "ppn" | "budget_vs_actual"
   ```

**Comparative period calculation:**
- If current period is `2026-01-01` to `2026-03-04`:
  - Previous period: `2025-01-01` to `2025-03-04` (same duration, one year back)
- Show `change = current - previous` and `changePercent = ((current - previous) / |previous|) * 100`

---

## Execution Order

Recommended sequence (dependencies noted):

| Order | Task | Dependencies | Estimated Effort |
|-------|------|-------------|-----------------|
| 1 | Task 1: Fix AR customer dropdown | None | Small |
| 2 | Task 2: Verify allocation flow | Task 1 | Small |
| 3 | Task 3: SO invoices in AR | None | Small |
| 4 | Task 6: PPN Report | None | Medium |
| 5 | Task 4: Equity Changes Statement | None | Medium |
| 6 | Task 5: Inventory Turnover | None | Medium |
| 7 | Task 7: Budget vs Actual | Needs Prisma migration | Large |
| 8 | Task 8: Xero-style UI | Tasks 4-7 (all reports exist) | Large |

---

## Testing Checklist

For each task, verify:
- [ ] Server action returns correct data shape (no undefined/null crashes)
- [ ] Empty state renders gracefully (no data = "Tidak ada data untuk periode ini")
- [ ] Date range filtering works correctly
- [ ] Export to CSV/XLS includes the new report data
- [ ] TanStack Query invalidation works after mutations
- [ ] Page loads with `TablePageSkeleton` while fetching
- [ ] All labels in Bahasa Indonesia
- [ ] `npx vitest` passes after each task
- [ ] `npx tsc --noEmit` passes (no type errors)

---

## Key File Reference

| File | Purpose |
|------|---------|
| `lib/actions/finance-reports.ts` | All report server actions (P&L, BS, CF already here) |
| `lib/actions/finance.ts` | AR/AP registry, Trial Balance, Aging reports, CRUD |
| `lib/actions/finance-ar.ts` | Credit notes, refund logic |
| `lib/actions/finance-gl.ts` | Journal entry posting |
| `lib/actions/finance-invoices.ts` | Invoice CRUD |
| `hooks/use-finance-reports.ts` | TanStack Query hook for reports page |
| `hooks/use-ar-payments.ts` | TanStack Query hook for AR payments page |
| `app/finance/reports/page.tsx` | Reports page UI (all report types rendered here) |
| `app/finance/payments/payments-view.tsx` | AR payment allocation UI |
| `prisma/schema.prisma` | Database models (Budget model to be added) |
| `lib/query-keys.ts` | Query key factories for cache management |
