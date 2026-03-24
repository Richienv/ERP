# ERP Finance Bible — Gap Analysis & Execution Roadmap

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close all accounting gaps between the bible spec (`docs/bible-erp-finance.md`) and the actual ERP implementation. 4 phases, 15 items, prioritized by severity.

**Architecture:** Fix bugs first (P0), then build critical missing features (P1), then important enhancements (P2), then nice-to-haves (P3). Each phase is independently valuable — you can stop after any phase.

**Source of truth:** Gap analysis conducted 2026-03-24 by reading every line of actual code against the 992-line bible spec.

---

## Current State Summary

| Module | Score | Critical Issues |
|--------|-------|----------------|
| GL & COA | 80% | — |
| AP | 65% | — |
| AR | 70% | — |
| Bank & Cash | 35% | BankStatement model missing from schema |
| Fixed Assets | 85% | — |
| Reporting | 80% | — |
| Budgeting | 25% | No cost centers, no enforcement |
| Tax Compliance | 40% | PPh 21 not in GL, PPh 23/25 missing entirely |
| Textile Costing | 55% | Labor+overhead never reach GL |
| Integration | 60% | Payroll GL broken, Manufacturing GL fragmented |

---

## PHASE 0: Fix Critical Bugs
**Effort:** 2-3 days | **Impact:** Stops active data corruption

### 0.1 Fix Payroll GL Imbalance

**Problem:** `approvePayrollRun()` at `app/actions/hcm.ts:1799` sums only `bpjsKesehatan + bpjsKetenagakerjaan` for the BPJS credit line. BPJS JHT (2%) and JP (1%) employee deductions are calculated in `calculatePayslip()` but never posted to GL, causing every payroll journal entry to be unbalanced.

**Files:**
- Fix: `app/actions/hcm.ts` (lines 1799-1841)
- Verify: `lib/hcm-calculations.ts` (lines 144-201, 303-336) — check field mapping
- Test: `__tests__/accounting-integrity.test.ts` — add payroll balance test

**Steps:**
1. Read `buildPayrollDraft()` in `hcm.ts` to trace how `bpjsKesehatan`, `bpjsKetenagakerjaan`, `bpjsJHT`, `bpjsJP` flow from calculation to storage
2. In `approvePayrollRun()` line 1799, change BPJS sum to include ALL employee components:
   ```typescript
   const bpjsTotal = payrollLines.reduce(
     (sum, line) => sum + (line.bpjsKesehatan || 0) + (line.bpjsJHT || 0) + (line.bpjsJP || 0),
     0
   )
   ```
3. Verify the journal entry balances: `gross === net + bpjsTotal + taxTotal`
4. Add test to `accounting-integrity.test.ts`:
   ```typescript
   test('payroll GL entry balances: debit(gross) === credit(net + bpjs + tax)', ...)
   ```
5. Run `npx vitest` to verify

**Acceptance:** Every payroll GL entry has `SUM(debit) === SUM(credit)` within Rp 1 tolerance.

---

### 0.2 Add BankStatement Model to Schema

**Problem:** `lib/actions/finance-ar.ts:371` calls `prisma.bankStatement.createMany()` but `BankStatement` model doesn't exist in `prisma/schema.prisma`. The `importBankStatement()` function throws a runtime error.

**Files:**
- Create model: `prisma/schema.prisma`
- Verify callers: `lib/actions/finance-ar.ts` (lines 371-429)

**Steps:**
1. Add model to `prisma/schema.prisma`:
   ```prisma
   model BankStatement {
     id                String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     bankAccountId     String   @db.Uuid
     date              DateTime @db.Date
     description       String
     reference         String?
     debit             Decimal  @default(0) @db.Decimal(15, 2)
     credit            Decimal  @default(0) @db.Decimal(15, 2)
     isReconciled      Boolean  @default(false)
     matchedPaymentId  String?  @db.Uuid
     matchedInvoiceId  String?  @db.Uuid
     importBatchId     String?
     createdAt         DateTime @default(now())

     bankAccount       GLAccount @relation("BankStatements", fields: [bankAccountId], references: [id])
     matchedPayment    Payment?  @relation(fields: [matchedPaymentId], references: [id])
     matchedInvoice    Invoice?  @relation(fields: [matchedInvoiceId], references: [id])

     @@index([bankAccountId])
     @@index([isReconciled])
     @@index([date])
   }
   ```
2. Add reverse relations to GLAccount, Payment, Invoice models
3. Run `npx prisma migrate dev --name add_bank_statement_model`
4. Run `npx prisma generate`
5. Verify `importBankStatement()` no longer throws

**Acceptance:** `importBankStatement()` creates records successfully. `getUnreconciledBankLines()` returns data.

---

### 0.3 Link Manufacturing GL to InventoryTransaction

**Problem:** `postJournalWithBalanceUpdate()` in `app/api/manufacturing/work-orders/[id]/route.ts:267-285` creates JournalEntry without setting `inventoryTransactionId`, breaking the audit trail between inventory movements and GL entries.

**Files:**
- Fix: `app/api/manufacturing/work-orders/[id]/route.ts` (lines 267-285)
- Reference: `lib/actions/inventory-gl.ts` (see how PO_RECEIVE links transactions)

**Steps:**
1. Read `executeProductionPosting()` to find where PRODUCTION_OUT and PRODUCTION_IN InventoryTransactions are created (lines 214-226, 253-265)
2. Capture the transaction IDs
3. Pass `inventoryTransactionId` to `postJournalWithBalanceUpdate()` calls at lines 267-285:
   ```typescript
   await postJournalWithBalanceUpdate(tx, {
     description: `WO ${workOrder.number} - Material to WIP`,
     inventoryTransactionId: productionOutTx.id,  // ← ADD THIS
     lines: [...]
   })
   ```
4. Verify `postJournalWithBalanceUpdate()` (lines 57-111) accepts and stores `inventoryTransactionId`
5. Add test: query JournalEntry after WO completion, verify `inventoryTransactionId` is set

**Acceptance:** After WO completion, every JournalEntry has a non-null `inventoryTransactionId` linking back to the InventoryTransaction.

---

## PHASE 1: Build Critical Missing Features
**Effort:** 2-3 weeks | **Impact:** Makes the books correct

### 1.1 Add Employer BPJS to GL + Separate Tax Accounts

**Problem:** Employer BPJS contributions (~11% of payroll) are calculated in `hcm-calculations.ts` but never posted to GL. PPh 21 is co-mingled with PPN in account 2110.

**Files:**
- Schema: `prisma/schema.prisma` — no changes needed (GL accounts are dynamic)
- GL accounts: `lib/gl-accounts.ts` — add new SYS_ACCOUNTS
- Payroll posting: `app/actions/hcm.ts` (lines 1765-1884)
- Account seeding: `prisma/seed-gl.ts`

**Steps:**
1. Add new system accounts to `lib/gl-accounts.ts`:
   ```typescript
   SYS_ACCOUNTS = {
     ...existing,
     SALARY_EXPENSE:        "6200",  // Beban Gaji & Upah
     BPJS_EMPLOYER_EXPENSE: "6210",  // Beban BPJS Perusahaan
     PAYROLL_PAYABLE:       "2130",  // Hutang Gaji Karyawan
     PPH21_PAYABLE:         "2111",  // Hutang PPh 21
     BPJS_KES_PAYABLE:      "2140",  // Hutang BPJS Kesehatan
     BPJS_JHT_PAYABLE:      "2141",  // Hutang BPJS JHT
     BPJS_JP_PAYABLE:       "2142",  // Hutang BPJS JP
     BPJS_JKK_PAYABLE:      "2143",  // Hutang BPJS JKK
     BPJS_JKM_PAYABLE:      "2144",  // Hutang BPJS JKM
   }
   ```
2. Add all to `ensureSystemAccounts()` upsert list
3. Add to `prisma/seed-gl.ts` for fresh databases
4. Rewrite `approvePayrollRun()` GL posting to produce correct journal:
   ```
   DR  Beban Gaji (6200)               = gross salary
   DR  Beban BPJS Perusahaan (6210)    = employer BPJS total
     CR  Hutang Gaji (2130)            = net salary
     CR  Hutang PPh 21 (2111)          = PPh 21
     CR  Hutang BPJS Kes (2140)        = employee 1% + employer 4%
     CR  Hutang BPJS JHT (2141)        = employee 2% + employer 3.7%
     CR  Hutang BPJS JP (2142)         = employee 1% + employer 2%
     CR  Hutang BPJS JKK (2143)        = employer 0.89%
     CR  Hutang BPJS JKM (2144)        = employer 0.3%
   ```
5. Remove keyword-based account resolution fallback — use `SYS_ACCOUNTS.*` directly
6. Fix `finance-cashflow.ts:242,257` to use `BPJS_*_RATE` constants from `hcm-calculations.ts` instead of hardcoded 4% and 5.74%
7. Add tests for payroll GL balance and BPJS breakdown

**Acceptance:** Payroll GL entry uses dedicated accounts, balances perfectly, and includes all employer contributions.

---

### 1.2 Implement PPh 23 Withholding on Vendor Payments

**Problem:** Bible section 8.3 requires 2% withholding on service payments to vendors. Zero implementation exists.

**Files:**
- Schema: `prisma/schema.prisma` — add fields to Supplier and Invoice
- GL accounts: `lib/gl-accounts.ts` — add PPH23_PAYABLE
- Payment logic: `lib/actions/finance-ap.ts` — modify `recordVendorPayment()`
- New report: `lib/actions/finance-reports.ts` — add `getPPh23Report()`

**Steps:**
1. Add to Supplier model:
   ```prisma
   pph23Rate       Decimal?  @db.Decimal(5, 2)  // Default 2%, can be 15% for dividends
   isServiceVendor Boolean   @default(false)
   ```
2. Add SYS_ACCOUNT:
   ```typescript
   PPH23_PAYABLE: "2112"  // Hutang PPh 23
   PPH23_PREPAID: "1340"  // PPh 23 Dibayar Dimuka (when WE are withheld)
   ```
3. Modify `recordVendorPayment()` in `finance-ap.ts`:
   - If supplier.isServiceVendor && supplier.pph23Rate > 0:
     ```
     withholding = paymentAmount × pph23Rate
     netPayment = paymentAmount - withholding

     DR  AP (2000)           = paymentAmount
       CR  Bank              = netPayment
       CR  PPh 23 Payable    = withholding
     ```
   - If no withholding: existing flow (DR AP, CR Bank)
4. Add `getPPh23Report(startDate, endDate)`:
   - Query all payments with PPh 23 withholding
   - Return: vendor, NPWP, DPP, PPh amount, payment date
   - This feeds SPT Masa PPh 23 Unifikasi filing
5. Add Bukti Potong PPh 23 generation (optional — PDF with vendor info, DPP, rate, amount)
6. Add tests

**Acceptance:** Vendor payment to service vendor correctly withholds PPh 23, posts to separate GL account, and appears in PPh 23 report.

---

### 1.3 Add Labor + Overhead to Manufacturing GL

**Problem:** `executeProductionPosting()` only posts material cost to GL. `calculateActualCostOnCompletion()` computes labor + overhead but stores result only in `WorkOrder.actualCostTotal`, not GL.

**Files:**
- Fix: `app/api/manufacturing/work-orders/[id]/route.ts` (lines 267-285)
- GL accounts: `lib/gl-accounts.ts` — add LABOR_EXPENSE, MFG_OVERHEAD
- Reference: `lib/wo-cost-helpers.ts` (cost calculation)

**Steps:**
1. Add SYS_ACCOUNTS:
   ```typescript
   DIRECT_LABOR:       "5110",  // Beban Tenaga Kerja Langsung
   MFG_OVERHEAD:       "5120",  // Beban Overhead Pabrik
   WAGES_PAYABLE:      "2150",  // Hutang Upah
   MFG_OH_APPLIED:     "2160",  // Overhead Pabrik Dibebankan
   ```
2. In `executeProductionPosting()`, after material GL posting, add:
   ```
   Step 3: Labor to WIP
   DR  WIP (1320)                = laborCost
     CR  Wages Payable (2150)    = laborCost

   Step 4: Overhead to WIP
   DR  WIP (1320)                = overheadCost
     CR  MFG OH Applied (2160)   = overheadCost
   ```
3. Update Step 2 (WIP → FG) to use full cost:
   ```
   DR  Finished Goods (1300)     = materialCost + laborCost + overheadCost
     CR  WIP (1320)              = materialCost + laborCost + overheadCost
   ```
4. Call `calculateActualCostOnCompletion()` BEFORE GL posting so the costs are available
5. Also add `PRODUCTION_IN` case to `lib/actions/inventory-gl.ts` for consistency:
   ```typescript
   case 'PRODUCTION_IN': {
     pair = { debitAccount: finishedGoods, creditAccount: wip }
     break
   }
   ```
6. Fix edge case: direct COMPLETED transition (lines 774-810) must also post GL
7. Add tests

**Acceptance:** After WO completion, WIP account (1320) nets to zero. Finished Goods (1300) includes material + labor + overhead.

---

## PHASE 2: Important Enhancements
**Effort:** 2-3 weeks | **Impact:** Compliance and usability

### 2.1 e-Faktur: NSFP Tracking + Kode Transaksi

**Problem:** e-Faktur CSV export hardcodes `kodeTransaksi: '01'` and uses invoice number instead of DJP-issued NSFP serial. 2026 is full Coretax year.

**Files:**
- Schema: `prisma/schema.prisma` — add fields to Invoice + new NSFPRange model
- Helpers: `lib/finance-efaktur-helpers.ts` — update CSV generation
- Actions: `lib/actions/finance-efaktur.ts` — add NSFP allocation

**Steps:**
1. Add to Invoice model:
   ```prisma
   kodeTransaksi    String?   @db.VarChar(2)   // 01, 02, 03, 04, 07, 08
   nsfpNumber       String?   @db.VarChar(17)  // Full 17-digit NSFP
   fakturPajakDate  DateTime? @db.Date
   dppType          String?   @default("STANDARD") // STANDARD, NILAI_LAIN
   ```
2. Add NSFP range model:
   ```prisma
   model NSFPRange {
     id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     year          Int
     startNumber   BigInt
     endNumber     BigInt
     currentCounter BigInt
     status        String   @default("ACTIVE") // ACTIVE, EXHAUSTED
     createdAt     DateTime @default(now())
     @@unique([year, startNumber])
   }
   ```
3. Add `allocateNSFP(invoiceId)` function — assigns next serial from active range
4. Update `invoiceToEFakturRow()` to use `invoice.kodeTransaksi` (not hardcoded '01') and `invoice.nsfpNumber` (not invoice.number)
5. Add kode transaksi logic: detect export invoices (customer.taxStatus === 'EXEMPT' + foreign address) → '07', government → '02', default → '01'
6. Add multi-rate PPN: if `invoice.dppType === 'NILAI_LAIN'`, calculate `DPP = 11/12 × price`
7. Add tests

**Acceptance:** Each e-Faktur CSV row has a proper NSFP number and correct kode transaksi.

---

### 2.2 Auto-Mark Invoices OVERDUE

**Problem:** Invoice status stays ISSUED even after due date passes. Users must manually change to OVERDUE.

**Files:**
- New: `lib/actions/finance-cron.ts` or add to existing actions
- Alternative: Add check to `getInvoiceKanbanData()` and `getARAgingReport()`

**Steps:**
1. Create function `markOverdueInvoices()`:
   ```typescript
   async function markOverdueInvoices() {
     const now = new Date()
     const result = await prisma.invoice.updateMany({
       where: {
         type: 'INV_OUT',
         status: { in: ['ISSUED', 'PARTIAL'] },
         dueDate: { lt: now },
       },
       data: { status: 'OVERDUE' },
     })
     return result.count
   }
   ```
2. Option A: Call this at the start of `getInvoiceKanbanData()` and `getARAgingReport()` (lazy evaluation)
3. Option B: Set up a daily cron via API endpoint (`/api/cron/mark-overdue`) callable by external scheduler
4. Also mark AP bills overdue: same logic for `INV_IN`
5. Add test

**Acceptance:** Invoices past due date automatically show as OVERDUE without manual intervention.

---

### 2.3 Payment Term → Due Date Auto-Calculation

**Problem:** `createCustomerInvoice()` doesn't read `customer.paymentTerm`. Due date defaults to 30 days. Hardcoded `if/else` at `finance-invoices.ts:1259` misses NET_45 and NET_90.

**Files:**
- Fix: `lib/actions/finance-invoices.ts` (lines 1259-1263, line 1082)
- Fix: `lib/actions/finance.ts` (duplicate code at lines 1259-1263)
- Add: Helper function `calculateDueDate(paymentTerm, issueDate)`

**Steps:**
1. Create `lib/payment-term-helpers.ts`:
   ```typescript
   const TERM_DAYS: Record<PaymentTerm, number> = {
     CASH: 0, COD: 0, NET_15: 15, NET_30: 30,
     NET_45: 45, NET_60: 60, NET_90: 90,
   }

   export function calculateDueDate(term: PaymentTerm, issueDate: Date): Date {
     const days = TERM_DAYS[term] ?? 30
     const due = new Date(issueDate)
     due.setDate(due.getDate() + days)
     return due
   }
   ```
2. In `createCustomerInvoice()`: lookup `customer.paymentTerm`, call `calculateDueDate()`
3. In `createInvoiceFromSalesOrder()`: use `salesOrder.paymentTerm` with `calculateDueDate()`
4. Remove hardcoded `if/else` chains in both files
5. Add `paymentTerm` field to Invoice model so the term is persisted (not lost after creation)
6. Add test: verify NET_90 customer gets 90-day due date

**Acceptance:** Invoice due dates correctly reflect customer/SO payment terms. All 7 term types work.

---

### 2.4 Fix Bank Reconciliation: Import + Matching

**Problem:** After 0.2 adds BankStatement model, the import and matching need to actually work.

**Files:**
- Fix: `lib/actions/finance-ar.ts` (lines 371-429) — update to use new model
- New: BCA/Mandiri CSV parser
- Fix: `components/accountant/bank-reconciliation.tsx` — replace demo with real data

**Steps:**
1. Implement `importBankStatement(bankAccountId, rows[])` — bulk create BankStatement records
2. Add BCA CSV parser: parse date (DD/MM/YYYY), description, debit, credit, balance columns
3. Implement `getUnreconciledItems(bankAccountId)` — returns unmatched bank lines + unmatched GL entries for that account
4. Implement `matchBankLine(bankStatementId, journalEntryId)` — links them, marks reconciled
5. Add basic auto-suggest: match by amount + date proximity (within 3 days)
6. Update UI component to use real data instead of demo
7. Add test

**Acceptance:** User can import BCA CSV, see unmatched items side-by-side, and reconcile them.

---

## PHASE 3: Nice-to-Have Enhancements
**Effort:** 4-6 weeks | **Impact:** Professional-grade features

### 3.1 WIP Valuation by Production Stage

**Problem:** No way to value partially-complete work orders at period end. WIP account (1320) only has material cost, no stage-based valuation.

**Files:**
- Schema: `prisma/schema.prisma` — add fields to WorkOrder
- New: `lib/actions/finance-wip.ts`
- GL: period-end adjustment journal

**Steps:**
1. Add to WorkOrder model: `completionPct Decimal?`, `wipValue Decimal?`, `lastWIPValuationDate DateTime?`
2. Define completion stages (from bible section 9.10):
   ```
   Cut Panels:     Materials 100%, Conversion 20%
   Partially Sewn: Materials 100%, Conversion 50%
   Fully Sewn:     Materials 100%, Conversion 75%
   Finished/QC:    Materials 100%, Conversion 90%
   Packed:         Materials 100%, Conversion 100%
   ```
3. Create `calculateWIPValuation(asOfDate)`:
   - For each open WO: `wipValue = materialCost + (laborCost + overheadCost) × conversionPct`
   - Total WIP = sum across all open WOs
4. Create `postWIPAdjustment(asOfDate)`:
   - Compare calculated WIP vs GL account 1320 balance
   - Post adjustment: DR/CR WIP, CR/DR WIP Variance
5. Add WIP aging report: WOs grouped by age (0-30, 31-60, 60+ days)

**Acceptance:** Period-end WIP account reflects actual partially-complete work value.

---

### 3.2 Cost Center Budgeting

**Problem:** Budgets are by GL account only. No departmental tracking. No enforcement.

**Files:**
- Schema: `prisma/schema.prisma` — new CostCenter model, modify BudgetLine
- Actions: `lib/actions/finance-budget.ts` — add cost center dimension
- Optional: enforcement hook in `postJournalEntry()`

**Steps:**
1. Add CostCenter model:
   ```prisma
   model CostCenter {
     id     String @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
     code   String @unique
     name   String
     type   String // PRODUCTION, ADMIN, SALES
     budgetLines BudgetLine[]
     journalLines JournalLine[]
   }
   ```
2. Add `costCenterId` to JournalLine and BudgetLine models
3. Update `getBudgetVsActual()` to group by cost center
4. Optional: add budget enforcement in `postJournalEntry()`:
   - Before posting, check if expense + new amount > budget for that account+costCenter
   - If over budget: warn (log) but don't block (soft enforcement)
5. Seed cost centers for textile factory: Cutting, Sewing, Finishing, Warehouse, Admin, Sales
6. Add tests

**Acceptance:** Budget report shows by department. Journal entries optionally tagged with cost center.

---

### 3.3 Dunning Workflow

**Problem:** No automated overdue follow-up. No escalation. No collection tracking.

**Files:**
- Schema: `prisma/schema.prisma` — new DunningRule, CollectionActivity models
- New: `lib/actions/finance-dunning.ts`
- UI: new component or tab in receivables page

**Steps:**
1. Add models:
   ```prisma
   model DunningRule {
     id          String @id
     level       Int    // 1, 2, 3
     daysAfterDue Int   // e.g., 7, 30, 60
     action      String // EMAIL, SMS, LETTER, BLOCK
     template    String? // Email/letter template
     isActive    Boolean @default(true)
   }

   model CollectionActivity {
     id         String   @id
     invoiceId  String   @db.Uuid
     type       String   // CALL, EMAIL, SMS, LETTER, VISIT
     date       DateTime @default(now())
     notes      String?
     outcome    String?  // PROMISED, NO_ANSWER, DISPUTED, PAID
     nextAction DateTime?
     createdBy  String?
     invoice    Invoice  @relation(fields: [invoiceId], references: [id])
   }
   ```
2. Add `invoice.lastDunningLevel Int?`, `invoice.nextDunningDate DateTime?`
3. Create `processDunning()` — runs through overdue invoices, applies rules by level
4. Create `logCollectionActivity(invoiceId, type, notes, outcome)` — manual tracking
5. Add collection activity tab to receivables page
6. Optional: integrate with email sending (if email service exists)

**Acceptance:** Overdue invoices automatically escalate through dunning levels. Collection activities are logged.

---

### 3.4 Multi-Rate PPN (0% for Exports)

**Problem:** All invoices use hardcoded 11% PPN. Export invoices should use 0%.

**Files:**
- Fix: `lib/actions/finance-invoices.ts` (line 199)
- Schema: add `taxRate` to Invoice model

**Steps:**
1. Add to Invoice: `taxRate Decimal? @db.Decimal(5,2)` — nullable, defaults to 11% when `includeTax=true`
2. In `createCustomerInvoice()`:
   - If customer is foreign / export: `taxRate = 0`, `kodeTransaksi = '07'`
   - If customer is PKP: `taxRate = 11`
   - If customer is NON_PKP: `taxRate = 0` (or no tax)
3. Replace `Math.round(subtotal * 0.11)` with `Math.round(subtotal * (taxRate / 100))`
4. Update `moveInvoiceToSent()` GL posting to handle 0% (skip PPN_KELUARAN line if taxAmount === 0)
5. Update e-Faktur CSV to use correct rate

**Acceptance:** Export invoices have 0% PPN. Domestic invoices keep 11%. GL entries are correct for both.

---

### 3.5 PPh 21 December True-Up + Per-Employee PTKP

**Problem:** PPh 21 uses fixed PTKP TK/0 (Rp54M) for all employees. No marital status tracking. No December annual recalculation.

**Files:**
- Schema: `prisma/schema.prisma` — add fields to Employee
- Fix: `lib/hcm-calculations.ts` — parameterize PTKP

**Steps:**
1. Add to Employee model:
   ```prisma
   maritalStatus    String?  @default("TK")  // TK, K
   dependentCount   Int      @default(0)      // 0-3
   ptkpCategory     String?  // Computed: TK/0, TK/1, K/0, K/1, K/2, K/3
   ```
2. Add PTKP lookup:
   ```typescript
   const PTKP = {
     'TK/0': 54_000_000, 'TK/1': 58_500_000, 'TK/2': 63_000_000, 'TK/3': 67_500_000,
     'K/0': 58_500_000, 'K/1': 63_000_000, 'K/2': 67_500_000, 'K/3': 72_000_000,
   }
   ```
3. Update `calculateMonthlyPPh21()` to accept employee's PTKP category
4. Add December true-up function:
   ```typescript
   function calculateDecemberPPh21(annualGross, annualBPJS, ptkp) {
     const neto = annualGross - biayaJabatan - iuranPensiun
     const pkp = neto - ptkp
     const annualTax = progressiveRate(pkp)
     const decemberTax = annualTax - sumJanNovTax
     return decemberTax
   }
   ```
5. In payroll for December: use true-up instead of monthly estimate
6. Add tests for each PTKP category and December scenarios

**Acceptance:** Each employee's PPh 21 reflects their actual family status. December payroll reconciles the full year.

---

## File Impact Summary

| File | Phase | Changes |
|------|-------|---------|
| `prisma/schema.prisma` | 0,1,2,3 | BankStatement model, Invoice tax fields, Employee PTKP, Supplier PPh23, NSFPRange, CostCenter, DunningRule, CollectionActivity |
| `lib/gl-accounts.ts` | 1 | Add ~12 new SYS_ACCOUNTS (payroll, PPh, BPJS, manufacturing) |
| `app/actions/hcm.ts` | 0,1 | Fix BPJS sum, rewrite GL posting with dedicated accounts |
| `lib/hcm-calculations.ts` | 1,3 | Parameterize PTKP, add December true-up |
| `lib/actions/finance-ap.ts` | 1 | Add PPh 23 withholding to vendor payment |
| `lib/actions/finance-invoices.ts` | 2,3 | Payment term auto-calc, multi-rate PPN, kodeTransaksi |
| `lib/actions/finance-ar.ts` | 0,2 | Fix bank statement model references, import/matching |
| `lib/finance-efaktur-helpers.ts` | 2 | Dynamic kodeTransaksi, NSFP from range |
| `app/api/manufacturing/work-orders/[id]/route.ts` | 0,1 | Link inventoryTransactionId, add labor+overhead GL |
| `lib/actions/inventory-gl.ts` | 1 | Add PRODUCTION_IN case |
| `lib/actions/finance-reports.ts` | 1 | Add PPh 23 report |
| `lib/actions/finance-cashflow.ts` | 1 | Use actual BPJS rates, not hardcoded |
| `lib/actions/finance-cron.ts` | 2 | New: markOverdueInvoices() |
| `lib/payment-term-helpers.ts` | 2 | New: calculateDueDate() |
| `lib/actions/finance-budget.ts` | 3 | Add cost center dimension |
| `lib/actions/finance-dunning.ts` | 3 | New: dunning workflow |
| `lib/actions/finance-wip.ts` | 3 | New: WIP valuation |
| `__tests__/accounting-integrity.test.ts` | 0,1 | Add payroll, PPh 23, manufacturing GL tests |

---

## Estimated Timeline

| Phase | Items | Effort | Cumulative |
|-------|-------|--------|------------|
| P0: Bug fixes | 3 | 2-3 days | 3 days |
| P1: Critical gaps | 3 | 2-3 weeks | ~3 weeks |
| P2: Important | 4 | 2-3 weeks | ~6 weeks |
| P3: Nice-to-have | 5 | 4-6 weeks | ~12 weeks |

**After P0:** Books stop getting worse (bugs fixed)
**After P1:** Books are correct (all transactions reach GL with right accounts)
**After P2:** Tax compliance and usability (e-Faktur, auto-overdue, payment terms, bank recon)
**After P3:** Professional-grade (WIP valuation, cost centers, dunning, multi-rate PPN, per-employee tax)
