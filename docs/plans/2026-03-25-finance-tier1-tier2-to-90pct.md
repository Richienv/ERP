# Finance Bible — Tier 1 + Tier 2 Push to 90%

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the remaining 15% gap to reach ~90% bible coverage. 11 items across 2 tiers.

**Architecture:** Tier 1 (high impact, 6 items) then Tier 2 (tax compliance, 5 items). Each tier independently valuable.

**Prerequisite:** P0-P3 from `docs/plans/2026-03-24-finance-bible-gap-analysis.md` must be completed (done).

---

## TIER 1: High Impact, Actionable Now
**Effort:** ~2-3 weeks | **Impact:** Audit-ready, trend analysis, fraud prevention

### T1.1 General Ledger Report

**Problem:** No way to see all transactions for a single GL account. Auditors need this. Current reports (P&L, BS, Trial Balance) only show aggregates.

**Files:**
- Add: `lib/actions/finance-reports.ts` — new `getGeneralLedger()` function
- Modify: `app/finance/reports/page.tsx` — add GL report tab/view

**Steps:**
1. Add `getGeneralLedger()` to `lib/actions/finance-reports.ts`:
   ```typescript
   export async function getGeneralLedger(params: {
     accountCode?: string    // Filter by specific account
     startDate?: string
     endDate?: string
     page?: number
     pageSize?: number
   }) {
     // 1. Query JournalLine with entry (date, description, reference, status)
     //    and account (code, name, type)
     // 2. Filter by accountCode, date range, status = POSTED
     // 3. Order by entry.date ASC, then entry.id
     // 4. Paginate
     // 5. Calculate running balance per account
     // 6. Return: items[], totals (debit, credit), openingBalance, closingBalance
   }
   ```
2. Each item should include: `date`, `reference`, `description`, `debit`, `credit`, `runningBalance`, `accountCode`, `accountName`, `entryId`
3. Support filtering by: account code, date range, reference (partial match)
4. Calculate opening balance = SUM(all prior entries for that account)
5. Running balance = opening + cumulative (debit - credit) for ASSET/EXPENSE, (credit - debit) for LIABILITY/EQUITY/REVENUE
6. Add test

**Acceptance:** User can view all transactions for account 1200 (AR) between dates, with running balance.

---

### T1.2 Period Comparison in Reports

**Problem:** P&L and Balance Sheet show single period only. Can't compare this month vs last month or this year vs last year.

**Files:**
- Modify: `lib/actions/finance-reports.ts` — update `getProfitLossStatement()` and `getBalanceSheet()`
- Modify: `app/finance/reports/page.tsx` — add comparison UI controls

**Steps:**
1. Add optional `comparisonPeriod` parameter to `getProfitLossStatement()`:
   ```typescript
   export async function getProfitLossStatement(
     startDate?: string,
     endDate?: string,
     comparisonStartDate?: string,  // NEW
     comparisonEndDate?: string,    // NEW
   )
   ```
2. When comparison dates provided, run the SAME query twice (current + comparison)
3. Return both datasets plus variance:
   ```typescript
   {
     current: ProfitLossData,
     comparison?: ProfitLossData,
     variance?: {
       revenue: { amount: number, pct: number },
       grossProfit: { amount: number, pct: number },
       operatingIncome: { amount: number, pct: number },
       netIncome: { amount: number, pct: number },
     }
   }
   ```
4. Same approach for `getBalanceSheet()` — add `comparisonDate` parameter
5. Variance calculation: `amount = current - comparison`, `pct = (amount / comparison) * 100`
6. Add test

**Acceptance:** P&L shows two columns (current vs prior period) with variance amount and percentage.

---

### T1.3 Three-Way Matching (PO vs GRN vs Bill)

**Problem:** Vendor bills can be approved without checking if quantities/prices match the PO and GRN. Over-billing goes undetected.

**Files:**
- New: `lib/actions/finance-matching.ts`
- Modify: `lib/actions/finance-ap.ts` — call matching before bill approval

**Steps:**
1. Create `lib/actions/finance-matching.ts`:
   ```typescript
   export async function performThreeWayMatch(billId: string): Promise<{
     status: 'MATCH' | 'EXCEPTION' | 'NO_PO'
     poMatch?: {
       poNumber: string
       poItems: Array<{ productName: string, poQty: number, poPrice: number }>
     }
     grnMatch?: {
       grnNumbers: string[]
       grnItems: Array<{ productName: string, receivedQty: number }>
     }
     billItems: Array<{ productName: string, billQty: number, billPrice: number }>
     exceptions: Array<{
       type: 'QTY_MISMATCH' | 'PRICE_MISMATCH' | 'NO_GRN'
       product: string
       expected: number
       actual: number
       variance: number
       variancePct: number
     }>
   }>
   ```
2. Logic:
   - Find the PO linked to the bill (via `invoice.purchaseOrderId`)
   - Find GRNs linked to the PO (via `GoodsReceivedNote.purchaseOrderId`)
   - Compare: Bill qty <= GRN received qty (can't bill more than received)
   - Compare: Bill price within tolerance of PO price (±5% default)
   - Flag exceptions for mismatches
3. Modify `approveVendorBill()` in `finance-ap.ts`:
   - Before approval, call `performThreeWayMatch(billId)`
   - If `status === 'EXCEPTION'`: still approve but include warning in result
   - Store match result on the bill (add `matchStatus` field to Invoice: `MATCHED` | `EXCEPTION` | `NO_PO`)
4. Add `matchStatus` and `matchExceptions` (JSON) to Invoice model in schema
5. Add test

**Acceptance:** Approving a bill that doesn't match PO/GRN returns warnings with specific exceptions. Bill still gets approved (warning, not blocking).

---

### T1.4 Monthly PPN Settlement Journal

**Problem:** Monthly PPN netting (Keluaran - Masukan = Kurang Bayar / Lebih Bayar) is not automated. Accountant must manually create the journal.

**Files:**
- Add to: `lib/actions/finance-gl.ts` or new `lib/actions/finance-tax.ts`

**Steps:**
1. Create `postPPNSettlement(month: number, year: number)`:
   ```typescript
   // 1. Calculate PPN Keluaran total for the month
   //    SUM(taxAmount) from invoices WHERE type=INV_OUT, status NOT IN (DRAFT, CANCELLED, VOID), issueDate in month
   // 2. Calculate PPN Masukan total for the month
   //    SUM(taxAmount) from invoices WHERE type=INV_IN, status NOT IN (DRAFT, CANCELLED, VOID), issueDate in month
   // 3. Net = Keluaran - Masukan
   // 4. If Net > 0 (Kurang Bayar):
   //    DR PPN Keluaran (2110)    = keluaranTotal
   //    CR PPN Masukan (1330)     = masukanTotal
   //    CR Hutang PPN KB (new)    = net
   // 5. If Net < 0 (Lebih Bayar):
   //    DR PPN Keluaran (2110)    = keluaranTotal
   //    DR Piutang PPN LB (new)   = abs(net)
   //    CR PPN Masukan (1330)     = masukanTotal
   ```
2. Add two new SYS_ACCOUNTS:
   ```typescript
   PPN_KURANG_BAYAR: "2115"  // Hutang PPN Kurang Bayar
   PPN_LEBIH_BAYAR:  "1335"  // Piutang PPN Lebih Bayar
   ```
3. Add `previewPPNSettlement(month, year)` — shows amounts without posting
4. Prevent double-posting: check if settlement journal already exists for that month
5. Add test

**Acceptance:** Accountant previews PPN settlement for March 2026, sees Keluaran vs Masukan, clicks post. Balanced journal created.

---

### T1.5 SPT Masa PPh 21 Report

**Problem:** No monthly PPh 21 filing report. Can't submit SPT Masa PPh 21 to DJP.

**Files:**
- Add to: `lib/actions/finance-reports.ts` or new `lib/actions/finance-tax-reports.ts`

**Steps:**
1. Create `getSPTMasaPPh21(month: number, year: number)`:
   ```typescript
   // 1. Find the approved payroll run for this period
   // 2. Extract per-employee data:
   //    - NIK, NPWP, nama, PTKP status
   //    - Penghasilan bruto (gross)
   //    - Biaya jabatan (5% max 500K/month)
   //    - Iuran pensiun/JHT (employee BPJS)
   //    - Penghasilan neto
   //    - PPh 21 terutang (withheld)
   // 3. Summary:
   //    - Total penghasilan bruto
   //    - Total PPh 21 dipotong
   //    - Employee count by PTKP category
   // 4. Return in SPT 1721 format
   ```
2. Include both TER-based monthly (Jan-Nov) and progressive annual (Dec) calculations
3. Group employees by PTKP category (A, B, C) for the TER section
4. Return data structured for SPT Masa 1721 Induk form fields
5. Add CSV export option for bulk upload to e-SPT/Coretax

**Acceptance:** Accountant generates PPh 21 report for March 2026, sees per-employee breakdown matching SPT form fields.

---

### T1.6 Budget Enforcement (Soft Warning)

**Problem:** Budgets exist but are reporting-only. No warning when spending exceeds budget.

**Files:**
- Modify: `lib/actions/finance-gl.ts` — add check in `postJournalEntry()`
- Add: budget warning helper

**Steps:**
1. Create `checkBudgetWarning(accountCode, amount, date)`:
   ```typescript
   // 1. Find active budget for this year
   // 2. Find budget line for this account + month
   // 3. Calculate: spent = SUM(journal lines for this account this month)
   // 4. If (spent + amount) > budgetLine.amount:
   //    return { warning: true, budgetAmount, spentSoFar, thisEntry, overBy }
   // 5. If no budget: return { warning: false }
   ```
2. In `postJournalEntry()`, after balance check but before posting:
   - For each EXPENSE line, call `checkBudgetWarning()`
   - If ANY warning: still post, but include warnings in result
   - Return: `{ success: true, warnings: [...] }`
3. DO NOT block the journal — just return warnings. Let the UI decide to show them.
4. If costCenterId is on the journal line, also check by cost center
5. Add test

**Acceptance:** Posting a journal that exceeds budget returns `{ success: true, warnings: ["Beban Transportasi (6100) melebihi budget bulan ini: Rp 5,000,000 dari Rp 3,000,000 (+67%)"] }`.

---

## TIER 2: Indonesian Tax Compliance
**Effort:** ~2-3 weeks | **Impact:** Full tax compliance for 2026

### T2.1 PPh 4(2) Final Tax

**Problem:** No withholding for building rent (10%) or construction services (1.75-6%). Required by Indonesian tax law.

**Files:**
- Schema: `prisma/schema.prisma` — add fields to Supplier/Invoice
- GL: `lib/gl-accounts.ts` — add PPH42_PAYABLE
- Logic: `lib/actions/finance-ap.ts` — modify payment flow
- Report: `lib/actions/finance-reports.ts` — add PPh 4(2) report

**Steps:**
1. Add SYS_ACCOUNT: `PPH42_PAYABLE: "2113"` (Hutang PPh 4(2))
2. Add to Supplier model:
   ```prisma
   pph42Rate       Decimal?  @db.Decimal(5, 2)  // 10% for rent, varies for construction
   pph42Category   String?   // SEWA_TANAH_BANGUNAN, JASA_KONSTRUKSI, etc.
   ```
3. In `recordVendorPayment()`, same pattern as PPh 23:
   - Check if supplier has `pph42Rate > 0`
   - Withhold: `amount × pph42Rate / 100`
   - GL: DR AP, CR Bank (net), CR PPh 4(2) Payable (withholding)
4. Add `pph42Amount` to Payment model
5. Add `getPPh42Report(startDate, endDate)` — same structure as PPh 23 report
6. Add test

**Acceptance:** Paying a building rent bill auto-withholds 10% PPh 4(2), posts to separate GL account, appears in report.

---

### T2.2 PPh 22 Import Tax

**Problem:** No withholding for imported materials. 2.5% (with API-P) or 7.5% (without API).

**Files:**
- Schema: add fields to Supplier
- GL: add PPH22_PREPAID account
- Logic: modify GRN or bill flow

**Steps:**
1. Add SYS_ACCOUNT: `PPH22_PREPAID: "1345"` (PPh 22 Dibayar Dimuka — this is a prepaid tax ASSET)
2. Add to Supplier: `isImportVendor Boolean @default(false)`, `apiType String?` (API_U, API_P)
3. When approving an import bill:
   - Calculate PPh 22: `nilaiImpor × rate` (2.5% with API-P, 7.5% without)
   - GL: DR Expense/Inventory + DR PPN Masukan + DR PPh 22 Prepaid, CR AP (total)
   - The PPh 22 is a PREPAID asset (creditable against annual PPh 25)
4. Add `pph22Amount` to Invoice model (or Payment)
5. Add `getPPh22Report(startDate, endDate)`
6. Add test

**Acceptance:** Import bill for Rp200M + BM Rp20M correctly calculates PPh 22 = 2.5% × Rp220M = Rp5.5M. Posted as prepaid tax asset.

---

### T2.3 PPh 25/29 Corporate Tax Installments

**Problem:** No monthly corporate tax installment tracking. PPh 25 = prior year tax / 12.

**Files:**
- New: `lib/actions/finance-tax.ts`
- Schema: new `PPh25Installment` model or use journal entries

**Steps:**
1. Add SYS_ACCOUNTS:
   ```typescript
   PPH25_PREPAID: "1350"  // PPh 25 Dibayar Dimuka (monthly installment — ASSET)
   PPH29_PAYABLE: "2116"  // Hutang PPh 29 (annual underpayment — LIABILITY)
   ```
2. Create `calculatePPh25Monthly(priorYearTax, credits)`:
   ```typescript
   // Monthly installment = (priorYearTax - credits) / 12
   // Credits = PPh 22 prepaid + PPh 23 prepaid + PPh 24 (foreign tax credit)
   ```
3. Create `postPPh25Installment(month, year, amount)`:
   ```
   DR  PPh 25 Dibayar Dimuka (1350)  = installment
     CR  Bank                         = installment
   ```
4. Create `calculatePPh29Annual(fiscalYear)`:
   ```typescript
   // PPh terutang = 22% × PKP (or 11% for SME first Rp4.8B)
   // PPh 29 = PPh terutang - PPh 22 - PPh 23 - PPh 25 installments
   // If > 0: underpayment (kurang bayar)
   // If < 0: overpayment (lebih bayar)
   ```
5. Add test

**Acceptance:** Accountant enters prior year tax, system calculates monthly PPh 25. Posts to GL each month. Annual calculation shows PPh 29 (kurang/lebih bayar).

---

### T2.4 SPT Masa PPN Report

**Problem:** No formatted monthly PPN return for Coretax filing.

**Files:**
- Add to: `lib/actions/finance-reports.ts` or `lib/actions/finance-tax-reports.ts`

**Steps:**
1. Create `getSPTMasaPPN(month: number, year: number)`:
   ```typescript
   // A. Pajak Keluaran (Output Tax)
   //    - All INV_OUT invoices for the month
   //    - Group by kodeTransaksi (01, 02, 07, etc.)
   //    - Per invoice: NSFP, customer NPWP, DPP, PPN
   //    - Total PPN Keluaran
   //
   // B. Pajak Masukan (Input Tax)
   //    - All INV_IN bills for the month
   //    - Per bill: faktur number, vendor NPWP, DPP, PPN
   //    - Total PPN Masukan
   //
   // C. Perhitungan
   //    - PPN Keluaran - PPN Masukan = Kurang/Lebih Bayar
   //    - Kompensasi dari bulan lalu (if any)
   //    - PPN yang harus disetor
   //
   // D. Filing info
   //    - Payment deadline: 15th of M+1
   //    - Filing deadline: 20th of M+1
   ```
2. Return structured data matching SPT Masa PPN form fields
3. Include CSV/XML export for Coretax upload
4. Add test

**Acceptance:** SPT Masa PPN for March 2026 shows Keluaran vs Masukan breakdown with per-invoice detail, ready for Coretax filing.

---

### T2.5 Coretax XML Export

**Problem:** e-Faktur export is CSV only. 2026 requires XML for Coretax submission.

**Files:**
- New: `lib/finance-efaktur-xml.ts`
- Modify: `lib/actions/finance-efaktur.ts` — add XML export action

**Steps:**
1. Create `lib/finance-efaktur-xml.ts`:
   ```typescript
   export function generateEFakturXML(invoices: EFakturInvoice[]): string {
     // Build XML following DJP Coretax schema:
     // <TaxInvoice>
     //   <Header>
     //     <TransactionCode>01</TransactionCode>
     //     <TaxInvoiceNumber>0010000000000001</TaxInvoiceNumber>
     //     <TaxInvoiceDate>2026-03-15</TaxInvoiceDate>
     //     <SellerTIN>01.234.567.8-901.000</SellerTIN>
     //     <BuyerTIN>09.876.543.2-109.000</BuyerTIN>
     //     <BuyerName>PT Customer</BuyerName>
     //   </Header>
     //   <Detail>
     //     <ItemName>Kain Cotton</ItemName>
     //     <Quantity>100</Quantity>
     //     <UnitPrice>50000</UnitPrice>
     //     <TotalPrice>5000000</TotalPrice>
     //     <DPP>5000000</DPP>
     //     <PPN>550000</PPN>
     //   </Detail>
     //   <Summary>
     //     <TotalDPP>5000000</TotalDPP>
     //     <TotalPPN>550000</TotalPPN>
     //   </Summary>
     // </TaxInvoice>
   }
   ```
2. Add `exportEFakturXML(invoiceIds)` to `finance-efaktur.ts`
3. Validate NPWP format (15 or 16 digit for Coretax)
4. Add test with XML parsing validation

**Acceptance:** XML export generates valid Coretax-compatible e-Faktur XML for selected invoices.

---

## SQL Migration (run after implementation)

```sql
-- T1.3: Three-way matching fields on Invoice
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "matchStatus" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "matchExceptions" JSONB;

-- T2.1: PPh 4(2) fields
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "pph42Rate" DECIMAL(5,2);
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "pph42Category" TEXT;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "pph42Amount" DECIMAL(15,2) DEFAULT 0;

-- T2.2: PPh 22 fields
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "isImportVendor" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "apiType" TEXT;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "pph22Amount" DECIMAL(15,2) DEFAULT 0;

-- New GL accounts
INSERT INTO "gl_accounts" ("id", "code", "name", "type", "balance", "isSystem", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid(), '1335', 'Piutang PPN Lebih Bayar', 'ASSET', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), '1345', 'PPh 22 Dibayar Dimuka', 'ASSET', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), '1350', 'PPh 25 Dibayar Dimuka', 'ASSET', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), '2113', 'Hutang PPh 4(2)', 'LIABILITY', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), '2115', 'Hutang PPN Kurang Bayar', 'LIABILITY', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid(), '2116', 'Hutang PPh 29', 'LIABILITY', 0, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
```

---

## File Impact Summary

| File | Tier | Changes |
|------|------|---------|
| `lib/actions/finance-reports.ts` | T1.1, T1.2, T1.5, T2.4 | GL report, period comparison, SPT PPh 21, SPT PPN |
| `lib/actions/finance-matching.ts` | T1.3 | New: three-way matching |
| `lib/actions/finance-ap.ts` | T1.3, T2.1 | Matching call before approval, PPh 4(2) withholding |
| `lib/actions/finance-gl.ts` | T1.4, T1.6 | PPN settlement, budget warning check |
| `lib/actions/finance-tax.ts` | T2.3 | New: PPh 25/29 corporate tax |
| `lib/finance-efaktur-xml.ts` | T2.5 | New: XML export for Coretax |
| `lib/actions/finance-efaktur.ts` | T2.5 | Add XML export action |
| `lib/gl-accounts.ts` | T1.4, T2.1-T2.3 | 6 new accounts |
| `prisma/schema.prisma` | T1.3, T2.1, T2.2 | matchStatus, PPh fields on Supplier/Invoice |
| `app/finance/reports/page.tsx` | T1.1, T1.2 | GL report tab, comparison controls |

---

## Estimated Timeline

| Tier | Items | Effort | Cumulative |
|------|-------|--------|------------|
| T1: High Impact | 6 | 2-3 weeks | 3 weeks |
| T2: Tax Compliance | 5 | 2-3 weeks | 6 weeks |

**After T1:** Audit-ready with GL report, trend analysis, fraud prevention, PPN settlement, PPh 21 filing, budget warnings.
**After T2:** Full Indonesian tax compliance — PPh 4(2), 22, 25/29, SPT PPN, Coretax XML. Production-ready for 2026 tax year.
