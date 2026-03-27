# QA Module Summary — Penjualan & CRM

> **Tanggal:** 2026-03-27
> **Cakupan:** Seluruh modul `/sales/*` — 23 halaman, 26 komponen, 13 hooks, 15 API routes, 36 server actions, 14 alur bisnis
> **Total item inventaris:** 127
> **Total issue ditemukan:** ~170+

---

## 1. Total Subpages & Files Reviewed

| Kategori | Jumlah | Status |
|----------|--------|--------|
| A. Halaman & Route | 23 | Scanned |
| B. Komponen Utama | 26 | Scanned |
| C. Data Hooks | 13 | Scanned |
| D. API Routes | 15 | Scanned |
| E. Server Actions | 36 | Scanned |
| F. Alur End-to-End | 14 | Scanned |
| **TOTAL** | **127** | |

**Detailed QA docs written:** A1 (Dashboard Penjualan) — `A1-dashboard-penjualan.md`
**Module-wide scan:** All 127 items scanned via code review of source files

---

## 2. Key Findings by Area

### 2.1 Sales Pipeline (Quotation → SO → Invoice → Payment)

The pipeline flow is structurally complete:
- **Quotation** → Kanban board with drag-drop status changes, version history, customer credit checks
- **Conversion** → `convertQuotationToSalesOrder()` copies all line items
- **Sales Order** → Full lifecycle: Draft → Confirmed → In-Progress → Delivered → Invoiced → Completed
- **Invoicing** → `generateInvoiceFromSalesOrder()` creates INV_OUT from SO
- **Payment** → `recordPayment()` and `recordARPayment()` with GL posting

**Critical gaps found:**
- GL posting happens OUTSIDE database transactions in almost every financial function — if GL fails, documents are left in committed-but-unbalanced state (13 instances)
- Hardcoded account codes (`'1110'`, `'1101'`, `'4010'`) instead of `SYS_ACCOUNTS` constants (3 instances)
- No concurrent payment protection — two simultaneous payments against one invoice can double-count
- Financial calculations use JavaScript floating-point math, not a decimal library

### 2.2 Customer Management

The customer module is feature-rich but has data integrity issues:
- **CRUD complete**: List (rolodex cards + data table), Create, Detail (tabs: info/contacts/addresses/transactions), Edit (dialog)
- **Indonesian tax compliance**: NPWP, NIK, PKP status, e-Faktur fields present
- **Credit management**: Limits, terms, status (GOOD/WATCH/HOLD/BLOCKED), tier classification

**Key issues:**
- Customer type definitions are duplicated in 3+ files with incompatible shapes (string vs Date, different field names)
- Customer categories use hardcoded mock data in `customer-form.tsx` but real API in `new/page.tsx`
- No server-side pagination — `findMany` returns ALL customers with no limit
- Email, phone, NPWP format validation is frontend-only or absent entirely
- Edit dialog re-fetches data from API instead of receiving it as props (unnecessary network request)

### 2.3 CRM / Leads

Functional but limited:
- **Kanban board** with 4 columns (NEW, FOLLOW_UP, WON, LOST) and drag-drop via dnd-kit
- **Lead creation** form with source tracking, priority, estimated value
- **Status mutation** with optimistic UI updates

**Key issues:**
- Leads API has a hardcoded `take: 500` limit with no pagination
- Lead creation form doesn't check HTTP response status before parsing JSON
- No lead-to-quotation conversion flow in the UI (must create quotation separately)
- Lead stages are limited (no CONTACTED, QUALIFIED, PROPOSAL, NEGOTIATION stages despite enum having them)

### 2.4 Invoicing & AR

Tightly integrated with the finance module:
- **Invoice creation** from SO, from scratch, or via customer invoice form
- **Payment recording** with bank/cash/GIRO methods
- **Credit notes** and sales returns with inventory reversal

**Critical issues:**
- `moveInvoiceToSent()` updates status BEFORE checking for existing GL entry — race condition on double-send
- `recordInvoicePayment()` attempts manual rollback on GL failure (deleting payment by number) — fragile and non-atomic
- No row-level locking on invoice balance updates during concurrent payments

### 2.5 Pricing & Discounts

- **Price lists**: Gallery view with booklet-style detail sheet, CRUD complete
- **Discount schemes**: Flat, percentage, tiered scoping (global/customer/product/category)

**Issues:**
- Discount scope target fields accept raw text UUIDs with no lookup validation
- Price list deletion doesn't check for linked discounts or customers
- No discount-to-quotation application visible in the quotation form

### 2.6 Salesperson & Commission

- **Master data**: CRUD with auto-generated codes
- **Commission report**: Date-range filtered with per-salesperson breakdown

**Issues:**
- Commission date range has no start <= end validation
- Salesperson code auto-generation has a race condition under concurrent requests
- Commission calculation uses simple `total * rate / 100` with no documentation

---

## 3. All Issues — Prioritized by Severity

### CRITICAL (13 issues) — Must fix before production

| # | Issue | Location | Category |
|---|-------|----------|----------|
| C1 | GL posting outside transaction in `approveInvoice()` — invoice ISSUED without GL entry if posting fails | `lib/actions/sales.ts:279` | GL Integrity / Atomicity |
| C2 | GL posting outside transaction in `recordPayment()` — payment committed without GL if posting fails | `lib/actions/sales.ts:361` | GL Integrity / Atomicity |
| C3 | Hardcoded account codes `'1110'`, `'1101'` in `recordPayment()` — violates SYS_ACCOUNTS pattern | `lib/actions/sales.ts:357-358` | GL Integrity |
| C4 | Hardcoded account code `'4010'` in `createSalesReturn()` — not in SYS_ACCOUNTS | `lib/actions/sales.ts:1404` | GL Integrity |
| C5 | GL posting outside transaction in `createSalesReturn()` — credit note without GL | `lib/actions/sales.ts:1397` | GL Integrity / Atomicity |
| C6 | GL posting outside transaction in `createCreditNote()` — no success check | `lib/actions/finance-ar.ts:221` | GL Integrity |
| C7 | GL posting outside transaction in `processRefund()` — no success check | `lib/actions/finance-ar.ts:299` | GL Integrity |
| C8 | GL posting outside transaction in `createPaymentVoucher()` — no success check | `lib/actions/finance-ar.ts:406` | GL Integrity |
| C9 | GL posting outside transaction in `processGIROClearing()` — no success check | `lib/actions/finance-ar.ts:471` | GL Integrity |
| C10 | `moveInvoiceToSent()` updates status before GL check — double-posting vulnerability | `lib/actions/finance-invoices.ts:780` | GL Integrity / Idempotency |
| C11 | `recordInvoicePayment()` manual rollback on GL failure is fragile and non-atomic | `lib/actions/finance-invoices.ts:1157` | Atomicity |
| C12 | Concurrent payment race condition — no row-level locking on invoice balance | `lib/actions/finance-ar.ts:949` | Race Condition |
| C13 | JavaScript floating-point used for financial calculations — rounding errors | Multiple files | Data Integrity |

### MEDIUM (35+ issues) — Should fix in next sprint

| # | Issue | Location | Category |
|---|-------|----------|----------|
| M1 | Status badges show raw English enum values (CONFIRMED, IN_PROGRESS) — should be Bahasa Indonesia | `app/sales/page.tsx`, `order-execution-card.tsx`, all status displays | Localization |
| M2 | No Zod schema validation on any server action inputs | All `lib/actions/*.ts` | Validation |
| M3 | Customer API returns ALL rows with no pagination | `app/api/sales/customers/route.ts:80` | Performance |
| M4 | Leads API has hardcoded `take: 500` limit with no offset | `app/api/sales/leads/route.ts:79` | Performance |
| M5 | Customer type definitions duplicated in 3+ files with incompatible shapes | `customer-rolodex-card.tsx`, `customer-data-table.tsx`, `use-customers.ts` | Type Safety |
| M6 | Customer categories use mock data in `customer-form.tsx` but real API in `new/page.tsx` | `components/sales/customer-form.tsx:48` | Data Integrity |
| M7 | Edit dialog re-fetches customer data from API instead of accepting props | `components/sales/customer-edit-dialog.tsx:67` | Performance |
| M8 | Hardcoded PPN rate (11%) in sales return dialog | `components/sales/sales-return-dialog.tsx:143` | Business Logic |
| M9 | Hardcoded PPN rate (11%) in amend order dialog | `components/sales/amend-order-dialog.tsx:80` | Business Logic |
| M10 | Quick order dialog hardcodes payment term to NET_30 | `components/sales/quick-order-dialog.tsx:155` | Business Logic |
| M11 | Win probability calculation uses magic numbers (3, 7 days / 75, 50, 25%) | `components/sales/quotation-kanban.tsx:75-78` | Business Logic |
| M12 | Credit limit warning threshold hardcoded to 80% | `components/sales/quotation-form.tsx:241` | Business Logic |
| M13 | AR Outstanding health threshold hardcoded to Rp 50M | `app/sales/page.tsx:113` | Business Logic |
| M14 | Customer tier thresholds hardcoded (Rp 2B platinum, Rp 500M gold) | `customer-rolodex-card.tsx:68-71` | Business Logic |
| M15 | Sales order data table date formatting casts to Date without null check | `sales-order-data-table.tsx:169` | Null Safety |
| M16 | Quotation detail accesses `item.product.name` without null check on product | `app/sales/quotations/[id]/page.tsx:151` | Null Safety |
| M17 | Quotation kanban calls `.split(' ')` on salesperson without null check | `quotation-kanban.tsx:216` | Null Safety |
| M18 | Customer detail address access doesn't use safe optional chaining | `app/sales/customers/[id]/page.tsx:80-81` | Null Safety |
| M19 | Transaction date sorting in customer API crashes if date is null | `app/api/sales/customers/[id]/route.ts:176` | Null Safety |
| M20 | Email/phone/NPWP format validation absent in backend | `app/api/sales/customers/route.ts` | Validation |
| M21 | Credit limit accepts negative values (backend) | `app/api/sales/customers/route.ts:224` | Validation |
| M22 | Discount scope target fields accept raw UUID strings with no lookup | `discount-form-dialog.tsx:430-469` | Validation |
| M23 | Commission date range has no start <= end validation | `app/sales/salespersons/page.tsx:81-83` | Validation |
| M24 | Quotation form allows submission with empty items array | `components/sales/quotation-form.tsx:281` | Validation |
| M25 | No quantity upper limit in sales order form | `sales-order-form.tsx:309` | Validation |
| M26 | Order stats KPI counts ALL orders (no date filter) vs Revenue MTD (monthly) — confusing mix | `app/sales/page.tsx:53-57` | UX / Data |
| M27 | Dashboard widgets contain hardcoded mock data (fake customer names, values) | `sales-pipeline.tsx`, `sales-action-center.tsx` | Production Readiness |
| M28 | No auto-refresh on dashboard page — stale data if tab left open | `app/sales/page.tsx` | UX |
| M29 | `accentColor` prop on `CardPageSkeleton` is dead — skeleton hardcodes orange gradient | `components/ui/page-skeleton.tsx` | Dead Code |
| M30 | Missing response `.ok` check in lead creation form | `app/sales/leads/new/page.tsx:84` | Error Handling |
| M31 | Export to Excel has no try-catch error handling | `app/sales/orders/page.tsx:82-98` | Error Handling |
| M32 | No fetch timeout (AbortController) on any client-side fetch call | All client components | Reliability |
| M33 | Missing accessibility: ARIA labels on icon-only buttons, color-only status indicators | Multiple components | Accessibility |
| M34 | `formatIDR()` utility duplicated in 5+ files instead of using shared `lib/utils.ts` | Multiple files | Code Quality |
| M35 | Auth check in `getSalesOrderForReturn()` uses basePrisma, bypassing RLS | `lib/actions/sales.ts:1441` | Auth / Security |

### LOW (25+ issues) — Backlog / tech debt

| # | Issue | Location | Category |
|---|-------|----------|----------|
| L1 | Invoice cells in dashboard link to generic `/finance/invoices`, not individual detail | `app/sales/page.tsx:411` | UX |
| L2 | `BarChart3` and `Square` imported but unused | `app/sales/page.tsx:12,16` | Dead Code |
| L3 | No loading skeleton per section on dashboard — all-or-nothing | `app/sales/page.tsx` | UX |
| L4 | Credit status BLOCKED not handled in rolodex card color mapping | `customer-rolodex-card.tsx:182` | UX |
| L5 | Prospect + HOLD credit status shows confusing recommendation | `customer-rolodex-card.tsx:76-101` | UX |
| L6 | WhatsApp button disabled without tooltip explaining why | `customer-rolodex-card.tsx:224` | UX |
| L7 | Indonesian provinces hardcoded in form (34 items) | `customer-form.tsx:36-45` | Maintainability |
| L8 | `Intl.NumberFormat` created on every render (no memoization) | Multiple components | Performance |
| L9 | No concurrent edit detection across module | All edit dialogs | Data Integrity |
| L10 | Price list deletion doesn't check for linked discounts | `price-book-gallery.tsx:100` | Data Integrity |
| L11 | Empty state messages inconsistent across module | Multiple pages | UX |
| L12 | Date locale hardcoded to `"id-ID"` with no user preference support | Multiple components | Localization |
| L13 | Currency hardcoded to IDR with no multi-currency option | Multiple components | Localization |
| L14 | No field-level validation messages — only toast errors on submit | All forms | UX |
| L15 | Commission calculation has no documentation or named constants | `commission-report/route.ts:65-72` | Maintainability |
| L16 | Inconsistent API response wrapping (`success`/`data`/`message` shapes vary) | `app/api/sales/*/route.ts` | API Contract |
| L17 | `useQuery` caching behavior not documented across hooks | `hooks/use-*.ts` | Maintainability |
| L18 | Status enum values inconsistent: "IN_PROGRESS" vs "PROCESSING" normalization | `orders/page.tsx:53` | Data Quality |
| L19 | Revision history date formatting hardcoded to `"id-ID"` | `revision-history-panel.tsx:65` | Localization |
| L20 | Sales return quantity validation skipped if all items have qty=0 | `sales-return-dialog.tsx:155` | Validation |
| L21 | Fulfillment tracker percentage display truncates decimals without rounding | `fulfillment-tracker.tsx:20` | Display |
| L22 | Color-size grid `updateCell` may use stale closure reference | `color-size-quotation-grid.tsx:73` | State Management |
| L23 | No confirmation dialog for salesperson deletion beyond browser `confirm()` | `salespersons/page.tsx` | UX |
| L24 | Salesperson auto-code generation has race condition under concurrency | `app/api/sales/salespersons/route.ts:116-128` | Race Condition |
| L25 | Booklet viewer legal disclaimer hardcoded, no link to T&Cs | `booklet-viewer.tsx:205` | Legal |

---

## 4. Missing Test Coverage

The Sales & CRM module has **zero automated tests**. Per CLAUDE.md: "Test coverage is low — only inventory module has tests currently."

### Critical Test Gaps

| Priority | Area | What Needs Testing |
|----------|------|--------------------|
| P0 | GL Posting Atomicity | Every server action that posts journal entries must be tested for: (1) success path creates balanced GL entries, (2) GL failure reverts document status, (3) concurrent calls don't double-post |
| P0 | Payment Concurrency | Simulate 2 concurrent payments against same invoice → verify final balance is correct |
| P0 | Financial Calculations | Test IDR rounding at boundaries (e.g., 11% PPN on Rp 91 = Rp 10.01 → should round correctly) |
| P1 | Quotation → SO Conversion | End-to-end: create quotation, accept, convert to SO → verify all line items copied, GL not created yet |
| P1 | Invoice Lifecycle | Draft → Issued → Partial Payment → Full Payment → verify GL entries at each step, balance updates |
| P1 | Sales Return + Credit Note | Create SO → Invoice → Partial payment → Return → verify: inventory restored, credit note GL entries, invoice balance adjusted |
| P1 | Customer CRUD | Create with all field types, update, verify NPWP/email validation, credit limit enforcement |
| P2 | Lead Pipeline | Create → drag-drop status change → verify optimistic update + rollback on failure |
| P2 | Discount Application | Create tiered discount → apply to quotation → verify calculation |
| P2 | Commission Calculation | Create salesperson → assign to SO → verify commission amount per period |
| P3 | Edge Cases | Empty database, null customer on order, zero-amount invoice, 100+ items in quotation |
| P3 | API Pagination | Verify `/api/sales/customers` doesn't crash with 10,000+ rows (currently no pagination) |

### Recommended Test File Structure

```
__tests__/
  sales/
    server-actions/
      sales-gl-integrity.test.ts     # P0: GL posting atomicity
      payment-concurrency.test.ts    # P0: Race conditions
      financial-calculations.test.ts # P0: Rounding, PPN
    workflows/
      quotation-to-so.test.ts        # P1: Conversion flow
      invoice-lifecycle.test.ts      # P1: Full lifecycle
      sales-return.test.ts           # P1: Return + credit note
    api/
      customers-api.test.ts          # P1: CRUD + validation
      leads-api.test.ts              # P2: Pipeline
      discounts-api.test.ts          # P2: Calculation
    components/
      quotation-kanban.test.tsx       # P2: Drag-drop
      customer-form.test.tsx          # P2: Validation UX
```

---

## 5. Recommended QA Test Cases for Stakeholder Demo

### Demo Scenario 1: "Happy Path — Pesanan Tekstil Baru" (10 min)

| Step | Action | Expected Result | Verify |
|------|--------|----------------|--------|
| 1 | Open `/sales` | Dashboard loads with KPIs, recent orders, CRM snapshot | All sections render, no blank areas |
| 2 | Click "Customer Master" quick link | Customer list page loads | Rolodex cards displayed |
| 3 | Click "+ Buat Pelanggan" | New customer form opens | All fields visible |
| 4 | Fill form: PT Demo Garment, COMPANY, Jakarta, NET_30 | Form validates | No errors, toast success |
| 5 | Navigate to `/sales/quotations/new?customerId={id}` | Quotation form with customer pre-filled | Customer name shown |
| 6 | Add 3 line items (fabric products), set prices & PPN 11% | Totals calculate correctly | Grand total = subtotal + PPN |
| 7 | Save quotation | Redirects to quotation list | New quote visible in DRAFT column |
| 8 | Drag quotation to SENT column | Status updates | Badge changes to SENT |
| 9 | Click "Konversi ke SO" on quotation | SO created | All items copied, redirect to SO detail |
| 10 | Click "Buat Work Order" on SO detail | Work orders created | Toast success, button disabled after |

### Demo Scenario 2: "Piutang — Invoice & Pembayaran" (8 min)

| Step | Action | Expected Result | Verify |
|------|--------|----------------|--------|
| 1 | From SO detail, click "Buat Invoice" | Invoice generated from SO | Invoice detail page opens |
| 2 | Verify invoice line items | Match SO items | Amounts, PPN correct |
| 3 | Send invoice (click Kirim) | Status → ISSUED | GL journal entry created (Debit: Piutang, Credit: Pendapatan + PPN) |
| 4 | Record partial payment (50%) | Status → PARTIAL | GL entry: Debit Bank, Credit Piutang. Balance updates. |
| 5 | Record remaining payment | Status → PAID | Balance = 0, GL balanced |
| 6 | Check `/sales` dashboard | Revenue MTD updated, AR Outstanding decreased | KPI values match |

### Demo Scenario 3: "Retur Penjualan" (5 min)

| Step | Action | Expected Result | Verify |
|------|--------|----------------|--------|
| 1 | Open completed SO | Detail page with delivered items | Fulfillment tracker shows 100% |
| 2 | Click "Retur" from dropdown | Sales return dialog opens | Items listed with delivered qty |
| 3 | Select items, enter return qty, choose reason "Cacat" | Totals calculate | Credit note preview amount correct |
| 4 | Submit return | Credit note created | Toast: "Retur berhasil dibuat" |
| 5 | Verify GL | Journal entry exists | Debit: Retur Penjualan, Credit: Piutang |

### Demo Scenario 4: "CRM Pipeline — Lead ke Quotation" (5 min)

| Step | Action | Expected Result | Verify |
|------|--------|----------------|--------|
| 1 | Open `/sales/leads` | Kanban board with 4 columns | Columns: NEW, FOLLOW_UP, WON, LOST |
| 2 | Click "+ Lead Baru" | New lead form | All fields visible |
| 3 | Fill: "PT Tekstil Maju", estimated Rp 500M, HIGH priority | Form submits | Toast success, new card in NEW column |
| 4 | Drag lead to FOLLOW_UP | Status updates optimistically | Card moves, badge changes |
| 5 | Drag lead to WON | Status updates | Card in WON column, value added to pipeline |
| 6 | Navigate to quotation → create for this customer | Quotation flow starts | Customer pre-linked |

### Demo Scenario 5: "Edge Case — Data Kosong" (3 min)

| Step | Action | Expected Result | Verify |
|------|--------|----------------|--------|
| 1 | Open `/sales` on fresh database | Empty dashboard | "Belum ada sales order", "Belum ada quotation", no crash |
| 2 | Open `/sales/customers` | Empty customer list | No crash, "Belum ada pelanggan" or empty card grid |
| 3 | Open `/sales/leads` | Empty kanban | Columns visible with 0 count, no crash |
| 4 | Open `/sales/orders` | Empty orders list | Clean empty state |

### Demo Scenario 6: "Salesperson & Komisi" (3 min)

| Step | Action | Expected Result | Verify |
|------|--------|----------------|--------|
| 1 | Open `/sales/salespersons` | Master Data tab active | Table with columns |
| 2 | Create salesperson: "Ahmad", 5% commission | Code auto-generated | Toast success, row appears |
| 3 | Switch to "Laporan Komisi" tab | Commission table loads | Empty initially |
| 4 | Set date range, click Terapkan | Report generates | Shows commission amounts per salesperson |

---

## Appendix: Architecture Assessment

### Module Health Score

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Feature Completeness** | 7/10 | Full pipeline exists; discount-to-quotation application missing; lead stages limited |
| **Data Integrity** | 3/10 | GL posting is not atomic in any financial function. Critical. |
| **Input Validation** | 4/10 | Frontend-only in most places; no Zod in server actions |
| **Error Handling** | 5/10 | Error boundaries exist; API error responses inconsistent |
| **Localization** | 6/10 | Mostly Bahasa but status enums, some labels still English |
| **Performance** | 5/10 | No pagination on customers/leads; client-side filtering |
| **Test Coverage** | 0/10 | Zero tests |
| **Code Quality** | 5/10 | Duplicated types, duplicated formatters, inconsistent patterns |
| **Accessibility** | 3/10 | Missing ARIA labels, color-only indicators, no keyboard nav testing |
| **Security** | 6/10 | Supabase auth present; some RLS bypass; no rate limiting |

### Top 5 Recommendations (Priority Order)

1. **Fix GL Atomicity** — Move all `postJournalEntry()` calls inside `$transaction` blocks. This is the single most critical issue affecting financial accuracy.

2. **Add Server-Side Validation** — Implement Zod schemas on all server action inputs. Add server-side pagination to customer and lead APIs.

3. **Write P0 Tests** — GL integrity tests, payment concurrency tests, financial calculation tests. These protect against regression on the most dangerous code paths.

4. **Centralize Constants** — Move all hardcoded account codes to `SYS_ACCOUNTS`, all tax rates to `TAX_RATES`, all tier thresholds to config. Create shared `formatIDR` utility.

5. **Unify Type Definitions** — Create single source-of-truth TypeScript interfaces for Customer, SalesOrder, Quotation, Lead in `lib/types.ts`. Remove duplicated interfaces from components.
