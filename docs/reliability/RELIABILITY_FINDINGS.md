# RELIABILITY FINDINGS — Phase A (Read-Only Audit)

> **Audit date:** 2026-07-25 · **Method:** static code analysis (5 parallel specialist passes), read-only, no
> code executed / no DB queried. Every claim cites `path:line`. Items needing runtime/env access are marked
> **UNVERIFIED**.
> **System:** Indonesian ERP — Next.js 16 App Router, React 19, Prisma → Supabase Postgres (pgbouncer),
> Xendit. This is a **double-entry accounting system of record**, so *silently wrong numbers* are rated as
> severe as outages.

## Executive summary

The books can go wrong in two structural ways that recur across the codebase:

1. **Non-atomic GL posting.** `postJournalEntry()` behaves differently depending on whether a transaction
   client is threaded into it. Dozens of **live money flows** either (a) open a *second, independent*
   transaction for the GL post while the document write is in the outer transaction (**Class A** — orphan/
   unbalanced on partial failure + connection-pool deadlock), or (b) commit the document first and post GL
   *afterwards* with no rollback (**Class B** — the exact "document exists but no journal entry" symptom in
   `FINANCE_BUGS_20260315.md`). The canonical send/payment paths are correct and prove the right pattern —
   but **the live UI imports the non-atomic "stale" copies in `finance.ts`.**
2. **Silent-wrong-data on failure.** The dominant read pattern is `catch → return []/null` or
   `catch → return zeroed fallback`. A DB outage renders as legitimate-looking **Rp 0 / empty lists** with
   HTTP 200 and no error surfaced — including a fully-zeroed CEO dashboard.

Add a **connection-exhaustion** design (interactive 20s transactions × `connection_limit=10` × serverless
fan-out against a small pgbouncer pool), an **unauthenticated `cache-warm` fan-out** that caches nothing,
**duplicate legal tax serials** from a non-atomic NSFP counter with no unique constraint, and **negative
stock** from unguarded decrements — and the reliability posture is **not production-safe for accounting**
without the Sev-1/Sev-2 fixes below.

### Severity counts

| Severity | Count | Theme |
|----------|-------|-------|
| **Sev-1 (Critical)** | 9 | Corrupts the books / loses money / silent-wrong-data at scale |
| **Sev-2 (High)** | 11 | Availability loss, stale financial reads, integrity gaps under load |
| **Sev-3 (Medium)** | 8 | Latent risk, degraded UX, ops hygiene |
| **Sev-4 (Low)** | 4 | Cleanups / defense-in-depth |

### Fix these five first

1. **R-01** Consolidate the UI onto atomic finance actions & thread the tx into every `postJournalEntry` (Class A/B).
2. **R-02** `createInvoiceFromSalesOrder` returns `success:true` even when GL posting fails — make it atomic.
3. **R-03** NSFP tax-serial generator is non-atomic and has no unique constraint → duplicate government serials.
4. **R-04** Unguarded stock decrements → negative stock (WO consume, subcontract, reservations).
5. **R-05** Connection-exhaustion design: 20s interactive transactions wrap every op (incl. reads) at `connection_limit=10`.

---

## Sev-1 — Critical

### R-01 · Non-atomic GL posting on live money flows (Class A + Class B), amplified by duplicate live code
**Category:** atomicity · **CWE-662 (improper synchronization) / integrity**
**Root mechanism:** `postJournalEntry(data, txClient?)` (`lib/actions/finance-gl.ts:309-347`) — **with** `txClient`
it joins the caller's transaction (atomic); **without** it, it opens its **own** `withPrismaAuth` transaction
on a second pooled connection (`finance-gl.ts:337-342`; the file's own docstring at `:227-229` warns this
causes "nested withPrismaAuth deadlocks / connection pool exhaustion").

**Class A (nested independent GL transaction) — live paths:**
- `lib/actions/finance.ts:2110` `recordVendorPayment`, `:2541`/`:2576` `approveAndPayBill` (two nested GL
  txns), `recordMultiBillPayment` (`finance.ts`, also `finance-ap.ts:621`) — **these are the UI-wired copies**.
- Mirror bug in the "canonical" file: `finance-ap.ts:441` `recordVendorPayment`, `:621`, `:871`/`:906`.
- `app/actions/hcm.ts:1610` payroll disbursement, `:1835` `approvePayrollRun`.
- `lib/actions/finance-fixed-assets.ts:888` `postDepreciationRun` (nested GL **inside a `for` loop** → N
  independent txns → high pool-exhaustion risk), `:1213` `createAssetMovement`.
- `lib/actions/finance-gl.ts:1999` `postPPNSettlement`; `finance-reconciliation.ts:1749/1764` `closeReconciliation`.

**Class B (GL posted after the document transaction commits, no rollback) — live paths:**
- `lib/actions/sales.ts:1395` `createSalesReturn` (**LIVE** — wired to `components/.../sales-return-dialog.tsx:177`);
  GL posted "outside transaction" (`sales.ts:1388`), also hardcodes `'4010'` (`:1401`) and `0.11` (`:1391`).
- `lib/actions/finance-wip.ts:117` `postWIPAdjustment` (no tx wrapper at all); `finance-pph.ts:120`
  `markWithholdingDeposited` (double-deposit if the follow-up `updateMany` fails after GL).

**Failure scenario:** During `approveAndPayBill`, the approval JE commits in its own transaction; the payment
JE or a later write fails → **bill approved & GL half-posted, books unbalanced**, or under load the outer
transaction holds 1 of 10 connections while the nested GL requests another → **deadlock → 20s timeout → 500**.
**Blast radius:** every AP payment, payroll run, depreciation run, and sales return — i.e. most outbound money.
**Governance amplifier:** `CLAUDE.md` says `finance.ts` is stale/"never use", but the live UI imports it —
`app/finance/bills/page.tsx:48`, `app/finance/vendor-payments/page.tsx:30`,
`components/finance/accounting-module-actions.tsx:18`, `vendor-multi-payment-dialog.tsx:34`,
`nota-kredit-tab.tsx:17`, `journal/new/page.tsx:28`. **Fixing only the canonical file will not fix production.**
**Fix:** thread `prisma`/`tx` into every `postJournalEntry({…}, tx)` so GL joins the document transaction;
wrap Class B flows in `$transaction`; consolidate the UI onto the canonical atomic actions and delete the
`finance.ts` duplicates. Reference implementations already correct: `finance-invoices.ts:moveInvoiceToSent`
(`:1195`), `recordInvoicePayment` (`:1420`), `grn.ts:acceptGRN`.

### R-02 · `createInvoiceFromSalesOrder` reports success even when GL posting fails
**Category:** silent-wrong-data / atomicity · **CWE-703**
`lib/actions/finance.ts:1528-1543` — if `postJournalEntry` returns `{success:false}` it only `console.error`s
(`:1528`), and if it throws, `catch (glError)` logs *"Failed to post GL entry (invoice still created)"*
(`:1535`); **both paths fall through to `return {success:true, invoiceId}`** (`:1539`). An AR invoice then
exists with revenue/PPN **never posted to the GL** — directly the `FINANCE_BUGS` B-012/B-014 pattern. Still
live: `finance.ts` is imported by 23 files including `lib/actions/sales.ts`.
**Fix:** make invoice + GL atomic; return `{success:false}` and roll back on GL failure. Migrate callers to
`finance-invoices.ts`.

### R-03 · NSFP e-Faktur tax-serial generator: non-atomic counter + no unique constraint → duplicate legal serials
**Category:** concurrency / integrity · **CWE-362**
`lib/actions/finance-efaktur.ts:227` computes `range.currentCounter + BigInt(1)` **in memory** then
`update {currentCounter: nextCounter}` (`:242`) — a read-modify-write, **not** an atomic `{increment}`
(despite the "atomically" comment at `:226`). And `Invoice.nsfpNumber` has **no `@unique`** in the schema.
**Failure scenario:** two invoices issued concurrently read the same `currentCounter` → **same NSFP
number**, with no DB constraint to stop it → **duplicate Indonesian government tax serial numbers** on real
faktur pajak (a compliance defect, not just a bug).
**Fix:** atomic `update {currentCounter:{increment:1}}` returning the new value (or a `DocumentCounter`-style
upsert), **and** add `@unique` on `nsfpNumber`.

### R-04 · Unguarded stock decrements → negative stock (no `gte` guard, no DB CHECK)
**Category:** concurrency · **CWE-362**
Several decrements skip the atomic `updateMany … where quantity gte …` guard used elsewhere:
- `app/api/manufacturing/work-orders/[id]/route.ts:175-191` — in-memory check then plain `update {decrement}`
  (TOCTOU); two concurrent WO starts both pass → stock negative.
- `lib/actions/subcontract.ts:852-860` — `findFirst` → plain `update {decrement}`, no qty check at all.
- `lib/actions/stock-reservations.ts:118-165` (reserve) and `:252-258` (consume) — read-then-plain-update.
There is **no DB `CHECK (quantity >= 0)`** anywhere (`grep CHECK` across migrations → none), so nothing
backstops the app logic. Correct pattern already used in `app/actions/inventory.ts:1387`,
`sales.ts:998`, `cutting.ts:404`, `stock-transfers.ts:254`.
**Fix:** convert to `updateMany({where:{…, quantity:{gte:qty}}, data:{decrement}})` + row-count check; add a
DB CHECK constraint on `stock_levels`.

### R-05 · Connection-exhaustion design (serverless × interactive transactions × small pool)
**Category:** connection/availability · **CWE-400**
`withPrismaAuth()` wraps **every** operation — including read-only ones — in
`$transaction(cb, {maxWait:15000, timeout:20000})` (`lib/db.ts:62-67`), and `getDatasourceUrl()` sets
`connection_limit=10` (`lib/db.ts:22`) while its own comment says the pooler allows only ~15 and "we use 5"
(`:14-15`). On Vercel, each concurrent function instance is its own client with its own pool; a few cold
starts (dashboard + `cache-warm`) blow past the pooler ceiling. No `maxDuration` is set on any route, so a
stuck call holds its connection until the platform timeout. **UNVERIFIED:** whether `?pgbouncer=true` is in
the real `DATABASE_URL` — if missing, Prisma against pgbouncer transaction mode throws
`prepared statement "s0" already exists` intermittently (`DB_CONNECTION_FIX.md` implies past incidents).
**Fix:** don't wrap read-only ops in interactive transactions; reduce/verify `connection_limit`; set
`maxDuration`; confirm `pgbouncer=true`; prefer short atomic `updateMany`/`upsert` over long interactive txns.

### R-06 · Dashboard renders a fully-zeroed, HTTP-200 "healthy" state on DB outage
**Category:** silent-wrong-data · **CWE-703**
`app/api/dashboard/route.ts:391-398` wraps the whole response in `catch → return all FALLBACK_* zeros`
(defined `:13-37`) with 200 OK; per-section `.catch(() => FALLBACK_…)` at `:323-340`; and
`app/actions/dashboard.ts:1082-1095`/`:1206-1220` `.catch(() => 0/[])` per KPI. A DB outage shows the CEO
**Rp 0 revenue / profit / AR** as if real. **Fix:** distinguish "loaded, value is 0" from "failed to load";
return an error state the UI renders as such.

### R-07 · Xendit webhook: non-atomic idempotency, no GL, swallows errors then returns 200 (no retry)
**Category:** idempotency / integrity · **CWE-362 / CWE-703**
`app/api/xendit/webhook/route.ts`: idempotency is a **non-atomic** `payment.notes.includes('[Xendit:…]')`
check-then-act (`:50-55` read, `:72-116` write) → concurrent redeliveries both pass and double-process; the
`SUCCEEDED` branch flips `invoice.status=PAID, balanceDue=0` (`:59-80`) with **no `postJournalEntry` and no
`$transaction`** (a late/replayed webhook can zero a `balanceDue` after a partial payment); invoice-update
and payment-update are **separate writes** (partial-update possible); and DB errors are swallowed with a
**200 response** (`:130-148`), so Xendit never retries → **permanently lost status update**. `findFirst` on
`Payment.reference` (`:44`, not unique) can also match the wrong payment.
**Fix:** a unique `(paymentId, provider, eventId)` idempotency row inserted **inside** the state-change
transaction; post GL; return non-2xx on failure so Xendit retries.

### R-08 · ~80 financial/business reads swallow DB errors as empty data
**Category:** silent-wrong-data · **CWE-703**
`catch → return []/null` on reads that users act on: procurement `getRequests`/pending-POs/scorecard
(`procurement.ts:497,1535,2053`), GRN queue (`grn.ts:79-98` — `safeQuery` fallback that **discards the
error field**), sales quotations/pricelists/SO (`sales.ts:85,530,956`), inventory audits/movements
(`app/actions/inventory.ts:1683,1824`), plus dashboard/exec, HCM, costing/cutting/subcontract. A DB failure
looks like "nothing here." `lib/actions/ceo-flags.ts:82` even masks a **missing migration** as `[]`.
**Fix:** return a typed `{data, error}` so pages can show a retry/error state; start with finance/
procurement/inventory/dashboard reads.

### R-09 · `db-fallbacks` returns fake data for financial reads on error
**Category:** silent-wrong-data · **CWE-703**
`getVendors` (`procurement.ts:157-159`), `getPurchaseOrders` (`:1385-1387`), `getPendingPOsForReceiving`
(`grn.ts:79-98`), `getProductsForPO` (`app/actions/purchase-order.ts:36-38`) return empty `FALLBACK_*` on DB
error → outstanding POs/vendors silently vanish; users may duplicate documents or assume nothing exists.
(Note: fallbacks are empty/zero, not fabricated large values, which bounds the blast radius — but for
accounting a silent Rp 0 / missing invoice is itself wrong.) **Fix:** surface the error; reserve fallbacks
for dev only.

---

## Sev-2 — High

### R-10 · `cache-warm` — unauthenticated fan-out that caches nothing (self-DoS stampede)
`app/api/cache-warm/route.ts`: the GET runs heavy multi-query actions but **stores nothing** (`:94-100`, no
`unstable_cache`), so it produces pure DB load with zero caching benefit; the POST does
`Promise.allSettled(keys.map(fetch(self)))` (`:122-130`) with **no auth, no dedupe, no lock**. Triggered
from the client on prefetch/idle (`lib/performance/procurement-prefetch.ts:109`) → N users × 16 heavy
actions with no coalescing = **stampede**, and an attacker can POST a huge `keys` array for a self-inflicted
DB storm. **Fix:** authenticate it, actually cache results (`unstable_cache`/React `cache`), add a lock/dedupe.

### R-11 · Client cache serves stale financial data (act-on-stale-AR)
`lib/query-client.tsx`: `staleTime: 5min` (`:25`), `gcTime: 7 days` (`:26`), `refetchOnWindowFocus:false`
(`:28`), `networkMode:"offlineFirst"` (`:31`), persisted to **IndexedDB for 7 days** (`:43-58`). A user can
see a paid invoice as unpaid for up to 5 minutes (instantly on reload from IndexedDB) and **record a
duplicate payment or chase a settled customer**. The referenced per-query `CACHE_TIERS` overrides are not
defined in the file (**UNVERIFIED** whether money-sensitive queries shorten `staleTime`). **Fix:** short/zero
`staleTime` + `refetchOnWindowFocus:true` for financial queries; don't serve money data `offlineFirst`.

### R-12 · Missing indexes on hot finance/traceability FK columns
`prisma/schema.prisma`: `JournalEntry.invoiceId/paymentId/salesOrderId/purchaseOrderId/inventoryTransactionId`
(~`:2290-2294`) have **no `@@index`** — every invoice→GL / payment→GL traceability lookup (the core of the
data-flow audit SOP) is a seq scan; `Payment.customerId/supplierId` (~`:1939`), `PurchaseOrderItem.purchaseOrderId`
(~`:1350`, the PO-with-lines join), and `InventoryTransaction.purchaseOrderId/salesOrderId/workOrderId/adjustmentId`
(~`:415-418`) are likewise unindexed. These degrade as GL volume grows and make the recommended runtime
reconciliation jobs too slow to run. **Fix:** add `@@index` on each.

### R-13 · No DB backstop for stock/quantity integrity
No `CHECK (quantity >= 0)` on `stock_levels` (R-04), and **`InventoryTransaction.quantity` is `Int`** (`:409`)
while **`StockLevel.quantity` is `Decimal(18,4)`** (`:381`) — fractional fabric receipts (2.5m) cannot be
recorded truthfully in the movement ledger, so the ledger won't reconcile to stock levels. **Fix:** add CHECK
constraints; make the transaction ledger `Decimal` to match.

### R-14 · 36 of 160 API routes have no in-handler auth (middleware excludes `/api`)
`middleware.ts:167` matcher excludes `api/` ("routes handle auth internally"), but ~36 route files call no
`getUser`/`createClient`/role-guard — including `app/api/finance/cashflow-*` (7), `app/api/system/fix-cn-partial`
(a **data-mutating** "fix" endpoint), `app/api/procurement/dashboard`, `app/api/dashboard/*`. Reliability
angle: unauthenticated mutating endpoints are also an integrity risk. (Cross-listed in the security audit.)
**Fix:** add auth to each; treat webhook/cache-warm as signature/secret-gated exceptions.

### R-15 · No timeouts / retries / `maxDuration` on outbound calls
No `AbortController` anywhere and no `maxDuration` on any route. Unbounded: Xendit `createPayout`
(`app/api/xendit/payout/route.ts:82`) and `getPayoutById` (`:139`) — **money path**; Typst PDF `spawn`
(`lib/services/document-service.ts:85`, no child-process kill/timeout); synchronous `XLSX.read`
(`lib/excel-parser.ts:21`) **blocks the event loop** on large uploads. A hung call holds the serverless slot
(and, on `withPrismaAuth` paths, a DB connection) until the platform max. The middleware's 5s `getUser` race
(`middleware.ts:54-56`) is the only bounded call and is the pattern to copy. **Fix:** add timeouts +
`maxDuration`; move Excel parsing off the request path or bound it.

### R-16 · Unguarded status transitions → concurrent double-transition (lost update)
`submitPOForApproval` (`procurement.ts:945`) and `rejectPurchaseOrder` (`:1042`) use plain
`update({where:{id}})`; the **SO transition route** reads at `app/api/sales/orders/[id]/transition/route.ts:47`
and does an unguarded `update` at `:89` — concurrent Confirm + Cancel both succeed, last write wins.
`approvePurchaseOrder` shows the correct guard (`updateMany({where:{id,status:current}})` + count check,
`procurement.ts:991-1001`). **Fix:** add `where:{ id, status: current }` + `count===0` check to every transition.

### R-17 · Racy document-number generation
`count()+1` / `findFirst orderBy desc` then compute-then-create, outside any lock: customer code
(`app/api/sales/customers/route.ts:30-47`), invoice/payment/quotation/SO/PO/employee/payroll numbers
(`finance-invoices.ts:356`, `sales.ts:157,408`, `purchase-order.ts:67`, `hcm.ts:1587`, etc.). Where a
`@unique` exists this degrades to a spurious 500/409 (availability); where it doesn't —
**`JournalEntry.number`** (`finance-gl.ts:20`, uniqueness UNVERIFIED) and **`nsfpNumber`** (R-03) — it's
**silent duplication**. GRN already does this right via `getNextDocNumber` upsert (`grn.ts:277-282`).
**Fix:** route all numbering through the atomic `DocumentCounter` upsert.

### R-18 · Manufacturing WO completion posts no GL (Layer-5 gap)
No `postJournalEntry`/`postInventoryGLEntry` found in any work-order-completion path (CLAUDE.md marks it
"TBD"). Finished-goods value never moves DR Finished Goods / CR WIP → **COGS/inventory valuation drifts**.
**UNVERIFIED** whether a WO-complete action exists at all. **Fix:** implement atomic WO-completion GL.

### R-19 · Prisma fully mocked in tests — DB-integrity classes are structurally untestable
`test-setup.ts:7-10` uses `mockDeep<PrismaClient>()`; `getUser` is hardwired authenticated (`:12-27`). The
66 tests validate pure logic/call-shape only — **no** test exercises SQL correctness, transaction rollback,
constraint enforcement, pool behavior, or the auth branches (mocked-authenticated). So the highest-risk
areas below have **zero** coverage.

### R-20 · High-risk areas with zero test coverage
Ranked by (blast radius × gap): (1) **inventory concurrency race on `StockLevel`** (R-04); (2) **API-route
auth+validation** (R-14); (3) **idempotency** (payments/invoices/GRN/webhook — R-07); (4) **PO state machine**
(13 statuses, `lib/po-state-machine.ts`, no test); (5) **pooled-DB failure / partial-commit rollback** (R-01,
R-05). **Fix:** add DB-backed integration tests for these before/with the remediation.

---

## Sev-3 — Medium

- **R-21 · No observability.** 799 raw `console.*` (no structured/leveled logging, no correlation IDs); **no**
  error tracking (no Sentry/Datadog/OTel), **no** health-check endpoint. Production errors are invisible
  beyond raw platform logs. **Fix:** add `/api/health` (SELECT 1), a `logger` wrapper + Sentry via
  `instrumentation.ts`.
- **R-22 · No runtime financial-invariant check.** Trial-balance sums exist only inside on-demand reports
  (`finance-reports.ts:247,1018`); there is no scheduled job asserting `SUM(debit)==SUM(credit)`, every
  ISSUED invoice has a POSTED JE, `GLAccount.balance` == sum of its lines, or `StockLevel` == running sum of
  `InventoryTransaction`. This is exactly what would auto-detect the `FINANCE_BUGS` class. **Fix:** add a
  protected `/api/admin/integrity-check` (needs R-12 indexes to be fast).
- **R-23 · `ignoreBuildErrors: true`** (`next.config.ts:7-11`) — type errors ship to prod, removing the main
  automated guard against the Ripple-Check "data not flowing between modules" class. **Fix:** run `tsc
  --noEmit` in CI (non-blocking report first, then gate).
- **R-24 · Committed DB password (operational).** `DB_CONNECTION_FIX.md` contains a plaintext Postgres
  password in git history — **must be rotated** in Supabase (editing the file does not un-publish it);
  `.mcp.json:5` hardcodes the Supabase `project_ref`. (Value not reproduced.)
- **R-25 · Destructive migration without data preservation.** `20260306000000_add_debit_credit_notes` hard
  `DROP TABLE credit_notes` + `DROP TYPE` with no data copy into the new `DebitCreditNote` model; no down-
  migrations exist (all rollback is manual). **Fix:** data-migration step before drops; document rollback.
- **R-26 · Partial-unique migration can abort mid-deploy.** `20260423140000_stock_level_partial_unique`
  `DELETE`s zero-qty dupes then `CREATE UNIQUE INDEX`; its own comment warns non-zero duplicates must be
  consolidated first or the index creation fails, leaving the DB half-migrated. **Fix:** pre-check/consolidate.
- **R-27 · Auth call before transaction has no timeout.** `withPrismaAuth` awaits `supabase.auth.getUser()`
  (`lib/db.ts:51-53`) with no bound before opening the tx → unbounded latency on every wrapped call. **Fix:**
  adopt the middleware 5s race.
- **R-28 · `error.tsx` gaps.** Present for 12 modules + root, but missing for `accountant`, `manager`,
  `staff`, `reports`, `fleet`, `admin`; sub-route failures show the whole-module error page. **Fix:** add
  scoped boundaries.

## Sev-4 — Low

- **R-29 · Duplicate receive path** `receiveGoodsFromPO` (`app/actions/inventory.ts:1010-1178`) duplicates
  `acceptGRN` without a PO-status/double-receive guard. Consolidate.
- **R-30 · Hardcoded GL codes / tax rates** violating project rules: `sales.ts` `'1110'`/`'1101'` (`:357-358`),
  `'4010'` (`:1401`), `0.11` (`:1391`); `finance.ts:createCreditNote` takes client-supplied account IDs
  instead of `SYS_ACCOUNTS`. Use constants.
- **R-31 · Best-effort audit-log swallows** (`finance.ts:419,1301,3538`; `finance-ap.ts:371`;
  `app/actions/inventory.ts:889,1769,1939`) can silently gap the audit trail. Acceptable but log at `warn`.
- **R-32 · Client `fetch` has no `AbortController`** on unmount/navigation → in-flight requests pile onto the
  DB. Add abort signals to TanStack queries.

---

## Coverage & confidence

- **Enumerated:** ~40 distinct transactional flows / 47 `postJournalEntry` call sites (tx-threading verified
  programmatically for each); 108 `force-dynamic` files; ~758 `catch` blocks (dangerous ones enumerated);
  all `{increment}/{decrement}` sites (100) and number generators (~120); full schema `@unique`/`@@index`
  review; 66 test files mapped; 44 migrations scanned.
- **UNVERIFIED (need runtime/env):** whether `?pgbouncer=true` is in the real `DATABASE_URL`; `JournalEntry.number`
  & `Payment.reference` uniqueness; whether `CACHE_TIERS` shortens financial `staleTime`; existence of a WO-
  completion GL action; full bodies of `recordInvoicePayment`/`recordVendorPayment` for double-submit
  idempotency; platform function timeout.
- **Method:** read-only static analysis; no code executed, no DB queried, no build/test run. The committed DB
  password was located but not reproduced.
