# RELIABILITY INVENTORY — Phase A (Read-Only Audit)

> Master inventory of reliability-relevant surfaces. Companion to `RELIABILITY_FINDINGS.md` (prioritized
> findings) and `FAILURE_MODES.md` (FMEA). Read-only static analysis, 2026-07-25. Every row cites `path:line`.
> Finding IDs (`R-xx`) link rows to the findings report.

## Coverage counts (exhaustiveness)

| Surface | Count | Source |
|---------|-------|--------|
| API routes (`app/api/**/route.ts`) | 160 | `find app/api -name route.ts` |
| Server-action files (`use server`) | 58 files (`lib/actions/` 42, `app/actions/` 8, `actions/` 1, + others) | `grep -rl "use server"` |
| Distinct transactional / GL-posting flows enumerated | ~40 (47 `postJournalEntry` call sites) | Atomicity pass |
| `force-dynamic` routes/pages | 108 | `grep -rl force-dynamic app` |
| `prisma.$transaction` usage sites | 26 files | `grep -rl '\$transaction'` |
| `catch` blocks classified | ~758 | Error-handling pass |
| `{increment}/{decrement}` sites | 100 | Concurrency pass |
| Document-number generators | ~120 | Concurrency pass |
| Test files | 66 | `find __tests__ -name '*.test.ts'` |
| Migrations | 44 | `prisma/migrations/` |
| `@@index` declared / `error.tsx` / `loading.tsx` | 143 / 13 / 120 | Schema + glob |

---

## Table 1 — Transactional atomicity (money & stock write flows)

Legend: **Atomic?** = are all related writes in one `$transaction`; **GL rollback?** = does document revert if GL fails.

| Flow | File:Line | Writes | Atomic? | GL rollback? | Risk | Finding |
|------|-----------|--------|---------|-------------|------|---------|
| Invoice send `moveInvoiceToSent` | `finance-invoices.ts:1065` | status+GL+COGS | ✅ | ✅ | OK (model) | — |
| AR payment `recordInvoicePayment` | `finance-invoices.ts:1299` | payment+invoice+GL+WHT | ✅ | ✅ | OK (model) | — |
| GRN receive `acceptGRN` | `grn.ts:382` | GRN+PO item+invTx+stock+GL | ✅ (guarded) | ✅ | OK (model) | — |
| Stock adjustment `createManualMovement` | `app/actions/inventory.ts:1306` | invTx+stock+GL | ✅ | ✅ | OK | — |
| AR flows (9 GL posts) | `finance-ar.ts:35…1143` | doc+GL | ✅ | ✅ | OK | — |
| Petty cash top-up/disburse | `finance-petty-cash.ts:94,165` | doc+GL | ✅ | ✅ | OK | — |
| DC/Credit note `postDCNote` | `finance-dcnotes.ts:722` | JE+balances+settlement | ✅ | ✅ | OK | — |
| **AP payment `recordVendorPayment`** | `finance-ap.ts:441` / **`finance.ts:2110` (LIVE)** | payment+bill+GL+WHT | ❌ Class A | Partial | **Crit** | R-01 |
| **AP multi-bill `recordMultiBillPayment`** | `finance-ap.ts:621` / **`finance.ts` (LIVE)** | N pay+N bill+GL+WHT | ❌ Class A | Partial | **Crit** | R-01 |
| **AP approve+pay `approveAndPayBill`** | `finance-ap.ts:871,906` / **`finance.ts:2541,2576` (LIVE)** | status+payment+2 GL | ❌ Class A | Partial | **Crit** | R-01 |
| **Invoice-from-SO `createInvoiceFromSalesOrder`** | `finance.ts:1509,1528` | invoice+GL | ❌ Class A + returns success on GL fail | ❌ | **Crit** | R-02 |
| **Depreciation run `postDepreciationRun`** | `finance-fixed-assets.ts:888` (in loop) | run+N entries+N GL | ❌ Class A (N nested) | Partial | **Crit** | R-01 |
| **Payroll disburse / approve** | `app/actions/hcm.ts:1610,1835` | batch+payments+GL | ❌ Class A | Partial | **Crit** | R-01 |
| **Sales return `createSalesReturn`** | `sales.ts:1395` (LIVE) | CN+invoice+settlement, GL after | ❌ Class B | ❌ | **Crit** | R-01 |
| Asset movement `createAssetMovement` | `finance-fixed-assets.ts:1213` | movement+GL | ❌ Class A | Partial | High | R-01 |
| PPN settlement `postPPNSettlement` | `finance-gl.ts:1999` | settlement+GL | ❌ Class A | Partial | High | R-01 |
| Bank recon close `closeReconciliation` | `finance-reconciliation.ts:1749,1764` | recon+GL | ❌ Class A | Partial | High | R-01 |
| WIP adjustment `postWIPAdjustment` | `finance-wip.ts:117` | GL then WO updates | ❌ Class B (no tx) | ❌ | High | R-01 |
| PPh deposit `markWithholdingDeposited` | `finance-pph.ts:120` | GL then updateMany | ❌ Class B | ❌ | High | R-01 |
| Sales invoice approve `approveInvoice` | `sales.ts:279` | status(tx) then GL | ❌ Class B | ❌ | High (dead?) | R-01 |
| Sales payment `recordPayment` | `sales.ts:361` | payment(tx) then GL | ❌ Class B | ❌ | High (dead?) | R-01 |
| **Manufacturing WO completion** | — (none found) | should DR FG / CR WIP | ❌ no GL | n/a | High | R-18 |
| PO create | `app/actions/purchase-order.ts:85` | PO+event | ✅ | n/a | OK (number race) | R-17 |
| PO approve | `procurement.ts:970` | status(guarded)+event | ✅ guarded | — | OK | — |
| PO submit / reject | `procurement.ts:945,1042` | status+event | ✅ but unguarded | — | Med | R-16 |
| SO status transition | `app/api/sales/orders/[id]/transition/route.ts:44` | SO status | ✅ but unguarded | — | Med | R-16 |

## Table 2 — Concurrency: shared mutable state

| Shared state | File:Line | Pattern | Protection | Race outcome | Risk | Finding |
|--------------|-----------|---------|-----------|--------------|------|---------|
| Document counter | `lib/document-numbering.ts:24` | `upsert {increment}` on unique prefix | atomic + unique | serialized | OK | — |
| Stock (adjust/ship/cut/transfer/PO-return) | `inventory.ts:1387`,`sales.ts:998`,`cutting.ts:404`,`stock-transfers.ts:254`,`procurement.ts:2628` | `updateMany where gte {decrement}` | atomic gte guard | safe | OK | — |
| **Stock (WO material consume)** | `app/api/manufacturing/work-orders/[id]/route.ts:184` | in-mem check → plain `update` | none (TOCTOU) | negative stock | High | R-04 |
| **Stock (subcontract send)** | `subcontract.ts:852` | `findFirst`→plain `update` | none | negative stock | High | R-04 |
| **Stock (reservation reserve/consume)** | `stock-reservations.ts:158,252` | read→plain `update` | none | negative/over-reserve | Med-High | R-04 |
| Stock (inbound increment) | `grn.ts:515`, `inventory.ts:1404` | `findFirst`→create/`increment` | partial-unique index backstop | additive; P2002 edge | Low | R-13 |
| GLAccount.balance | `finance-gl.ts:294…`; `finance-dcnotes.ts:822` | `update {increment}` | atomic increment | safe (denormalized) | Low | — |
| GLAccount.balance (legacy 2-step) | `finance.ts:3522,3749` | two separate `update` | not wrapped (UNVERIFIED) | unbalanced cache on partial | Med | R-01 |
| **NSFP tax serial** | `finance-efaktur.ts:227,242` | in-mem `+1` → `update` | none, **no @unique** | **duplicate legal serials** | **Crit** | R-03 |
| Doc numbers (invoice/PO/SO/payment/etc.) | `finance-invoices.ts:356`, `sales.ts:157,408`, `purchase-order.ts:67`, `hcm.ts:1587` | `count()+1`/`findFirst`→create | `@unique` (most) | 500/409 on loser | Med | R-17 |
| **JournalEntry.number** | `finance-gl.ts:20` | `count()+1` | uniqueness UNVERIFIED | possible silent dup | High | R-17 |

## Table 3 — Idempotency of retryable / external endpoints

| Endpoint | File:Line | Mechanism | Atomic? | Gap | Risk | Finding |
|----------|-----------|-----------|---------|-----|------|---------|
| Xendit webhook | `app/api/xendit/webhook/route.ts:50-148` | `notes.includes(marker)` scan | ❌ (check-then-act, separate writes) | no unique key, no GL, swallows→200 | **Crit** | R-07 |
| AR/AP payment recording | `finance-invoices.ts`, `finance-ar.ts:974`, `finance-ap.ts` | none (no client idempotency key) | — | double-submit → double payment+GL | High | R-07 |
| SO→WO creation | `app/api/sales/orders/[id]/create-work-orders/route.ts` | UNVERIFIED | — | possible double-WO | Med | R-07 |

## Table 4 — Connection / caching / external-call timeouts

| Item | File:Line | Finding | Risk | ID |
|------|-----------|---------|------|----|
| Prisma singleton | `lib/db.ts:8-39` | correct (globalThis + version stamp) | OK | — |
| `connection_limit=10` vs comment "5" | `lib/db.ts:14-22` | contradictory; serverless × pool ceiling | High | R-05 |
| Interactive `$transaction` wraps every op incl reads | `lib/db.ts:62-67` | holds pooled conn ≤20s | High | R-05 |
| `pgbouncer=true` not added by app | `lib/db.ts:16-23` | depends on operator env | UNVERIFIED/High | R-05 |
| `force-dynamic` × 108, no `maxDuration` | app-wide | live DB hit per request | High | R-05 |
| Dashboard nested fan-out (~40 queries) | `app/api/dashboard/route.ts:321` | worst exhaustion candidate | High | R-05 |
| Financial reports fan-out (24 queries) | `app/api/finance/reports/route.ts` | heavy per-request load | Med | R-05 |
| `cache-warm` — caches nothing, unauth POST fan-out | `app/api/cache-warm/route.ts:94,122` | self-DoS stampede | High | R-10 |
| No server-side caching (`unstable_cache`/`cache()` = 0) | app-wide | DB hammered, no dedupe | Med | R-05 |
| Client `staleTime 5min` + IndexedDB `offlineFirst` | `lib/query-client.tsx:25-58` | act-on-stale-AR | High | R-11 |
| Supabase `getUser` (middleware) | `middleware.ts:54-56` | **5s race — reference pattern** | OK | — |
| Supabase `getUser` (per-query) | `lib/db.ts:51-53` | no timeout before tx | Med | R-27 |
| Xendit `createPayout`/`getPayoutById` | `app/api/xendit/payout/route.ts:82,139` | no timeout (money path) | High | R-15 |
| Typst PDF `spawn` | `lib/services/document-service.ts:85` | no child kill/timeout | Med | R-15 |
| Excel `XLSX.read` (sync) | `lib/excel-parser.ts:21` | blocks event loop | Med | R-15 |

## Table 5 — Error handling classification (~758 catch blocks)

| Category | Approx. count | Representative sites | Risk | ID |
|----------|---------------|---------------------|------|----|
| (a) propagates (`throw`) | moderate | `finance-reports.ts:312,540` | OK | — |
| (b) typed error result `{success:false}` | large (dominant for mutations) | `finance-ap/ar/invoices`, `hcm.ts:427` | OK | — |
| (c) **swallows** `return []/null` (reads) | ~80 | `procurement.ts:497,1535`, `sales.ts:85,530,956`, `inventory.ts:1683,1824`, `ceo-flags.ts:82` | High | R-08 |
| (d) **mock fallback** on error | 8 | `procurement.ts:159,1387`, `purchase-order.ts:38`, `grn.ts:97`, `dashboard route:323-398` | Crit/High | R-06,R-09 |
| **log-but-return-success** (books) | 3 | `finance.ts:1528` (invoice), `procurement.ts:1315` (bill), `finance-reconciliation.ts:676` | Crit | R-02 |

## Table 6 — Schema constraints & indexes

| Item | Location | Status | Risk | ID |
|------|----------|--------|------|----|
| Doc number/code `@unique` | Invoice/PO/SO/etc. | present | OK | — |
| `DocumentCounter @@unique([prefix])` | schema `:3931` | present | OK | — |
| Partial-unique stock (locationId NULL) | migration `20260423140000` | present | OK | — |
| **`Invoice.nsfpNumber @unique`** | schema | **missing** | Crit | R-03 |
| **`CHECK quantity >= 0`** on stock_levels | migrations | **missing** | High | R-04/R-13 |
| **`InventoryTransaction.quantity Int`** vs StockLevel Decimal | schema `:409` vs `:381` | mismatch | High | R-13 |
| `JournalEntry.invoiceId/paymentId/salesOrderId/purchaseOrderId/inventoryTransactionId @@index` | schema `~:2290-2294` | **missing** | High | R-12 |
| `Payment.customerId/supplierId @@index` | schema `~:1939` | **missing** | High | R-12 |
| `PurchaseOrderItem.purchaseOrderId @@index` | schema `~:1350` | **missing** | High | R-12 |
| `InventoryTransaction.purchaseOrderId/salesOrderId/workOrderId/adjustmentId @@index` | schema `~:415-418` | **missing** | High | R-12 |
| Idempotency/processed-event table | — | **missing** | Crit | R-07 |
| Optimistic-concurrency `version` column | StockLevel/Invoice/GLAccount/PO | **missing** | Med | R-16 |

## Table 7 — Tests vs risk

| Risk area | Blast radius | Coverage | ID |
|-----------|-------------|----------|----|
| Finance / double-entry / GL logic | Catastrophic | **Strong** (mocked) | — |
| Manufacturing state machines | High | Partial | R-20 |
| Inventory logic (single-actor) | High | Partial (logic only) | R-20 |
| **Inventory concurrency race on StockLevel** | Catastrophic | **ZERO** | R-04/R-20 |
| **PO state machine (13 statuses)** | High | **ZERO** | R-16/R-20 |
| **API-route auth + validation** | High | **ZERO** | R-14/R-20 |
| **Pooled-DB failure / partial-commit rollback** | High | **ZERO** | R-01/R-20 |
| **Idempotency (payment/GRN/webhook replay)** | High | **ZERO** | R-07/R-20 |
| Harness note: Prisma fully mocked | `test-setup.ts:7-10` | DB integrity untestable | R-19 |

## Table 8 — Build / deploy / observability / migrations

| Item | Location | Finding | Risk | ID |
|------|----------|---------|------|----|
| `typescript.ignoreBuildErrors: true` | `next.config.ts:7-11` | type errors ship | Med | R-23 |
| `reactStrictMode: false` | `next.config.ts:12` | latent effect bugs undetected | Low | — |
| Committed DB password | `DB_CONNECTION_FIX.md` | rotate credential | Med (ops) | R-24 |
| `.mcp.json` hardcoded project_ref | `.mcp.json:5` | info disclosure | Low | R-24 |
| `.env` handling | `.gitignore:32-38` | correct (only `.env.example` tracked) | OK | — |
| Structured logging / error tracking / health check | app-wide | **none** (799 raw console.*) | Med | R-21 |
| Runtime financial-invariant job | — | none (only on-demand reports) | Med | R-22 |
| Destructive drop of `credit_notes` | migration `20260306000000` | no data preservation | Med | R-25 |
| Partial-unique migration abort risk | migration `20260423140000` | can half-migrate | Med | R-26 |
| `error.tsx` coverage | 13/132 segments | gaps: accountant/manager/staff/reports/fleet/admin | Med | R-28 |
| `loading.tsx` coverage | 120/132 (~91%) | good | OK | — |
