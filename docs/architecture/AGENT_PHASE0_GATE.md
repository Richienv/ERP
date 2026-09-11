# AGENT PHASE 0 — HARDENING GATE

> **This is the document to read first.** It states what must be true **before** Hermes is allowed to
> read, and before it is allowed to write.
>
> **Method.** Every "current state" below was **read on 2026-07-27**, not inherited from the audit. Where
> the code has moved on from `docs/reliability/RELIABILITY_FINDINGS.md`, that is stated. Where the audit
> **understated** the problem, that is stated too. Findings are `R-01…R-32` from the audit; `T-*` and `G-*`
> items are new, found while tracing `receiveGoods → acceptGRN → stock + GL`.
>
> **Gate rule.** No agent **write** path ships until every `BLOCKS: WRITES` / `BOTH` item below is
> `DONE`. No agent **read** path ships until every `BLOCKS: READS` / `BOTH` item is `DONE`.

---

## 0. Summary

| | Count |
|---|---|
| Findings assessed | 32 (R-01…R-32) + 10 new (T-1…T-10) |
| **Blocking READS** | 6 |
| **Blocking WRITES** | 14 |
| **Blocking BOTH** | 5 |
| Not applicable to the procurement slice (tracked for later domains) | 12 |
| **Already fixed / better than the audit reported** | 3 (R-17 partial, R-26, R-04 partial) |
| **Worse than the audit reported** | 3 (R-14/authz, R-16, and posting-period control — entirely absent) |

**The three items that matter most, in order:**

1. **G-01 (R-07) — idempotency.** There is no idempotency model anywhere in the schema. Without it,
   an agent retry after a timeout is a double posting. Everything else is secondary.
2. **G-07 (R-08, R-09, R-06) — truthful reads.** Every read the slice needs currently converts a DB
   outage into a plausible empty list or fabricated vendor rows. An agent reasoning over those acts.
3. **G-06 (T-1) — posting-period control.** Not in the audit at all. `assertPeriodOpen` is **skipped on
   exactly the code path the agent uses**. The agent can post into a closed fiscal period.

---

## 1. Blocking gate items

### G-01 · Idempotency infrastructure — **BLOCKS: WRITES** · findings **R-07**, new

**Current state (verified).** No idempotency model exists. A grep across the whole `prisma/` tree for
`idempot|processed_?operation|processedevent` returns **zero matches**. `AuditLog`
(`prisma/schema.prisma:3664-3679`) cannot substitute: it has **no unique constraint at all**, its `userId`
and `entityId` are unconstrained `String` with no FKs, and it has no correlation id. No mutation in
`lib/actions/procurement.ts` or `lib/actions/grn.ts` accepts an idempotency key.

The audit's R-07 describes this for the Xendit webhook only (`app/api/xendit/webhook/route.ts:50-55`
non-atomic `notes.includes(...)` check-then-act). **For the agent it is systemic, not webhook-specific.**

Traced concretely (`AGENT_CONTROL_PLANE_ARCHITECTURE.md §3.3`): a retried `acceptGRN` hits the guard at
`grn.ts:448-458`, gets `count === 0`, and throws `'GRN sudah diproses atau tidak ditemukan.'` (`:457`) —
returning **failure for an operation that succeeded**. `createGRN` is protected only by the
remaining-quantity check at `grn.ts:332-341`, which blocks a retried *full* receipt but **permits a
retried partial receipt**, creating a second GRN and, on acceptance, a second `DR 1300 / CR 2150`.

**Required state.**
- `AgentOperationRecord` model, `@@unique([principal, operationId, idempotencyKey])`, with
  `requestHash`, `status (IN_FLIGHT|SUCCEEDED|FAILED)`, `resultJson`, `correlationId`.
- Inserted as the **first statement inside** the operation's `$transaction`, so it commits/rolls back with
  the document.
- `P2002` → read the stored row → replay `resultJson` verbatim with `replayed:true, code:'REPLAYED'`.
- `requestHash` mismatch on the same key → `IDEMPOTENCY_KEY_REUSED`, severity `E`, not retryable.
- A sweeper reaps `IN_FLIGHT` rows older than the 20 s tx timeout + margin.
- Every catalog mutation requires a UUID key at L1; a call without one never reaches the operation layer.

**Second line of defence (recommended, T-6):** `JournalEntry.inventoryTransactionId`
(`schema.prisma:2294`) is nullable and non-unique, and the reverse relation is `journalEntries
JournalEntry[]` (`schema.prisma:429`) — one-to-many. `JournalEntry` has **no `number` field** and its
`reference` (`:2276`) is not unique. Nothing at the DB level prevents the same inventory transaction being
posted twice. Add a partial unique index on `(inventoryTransactionId)` where
`sourceDocumentType LIKE 'INVENTORY_%'`.

---

### G-02 · Truthful atomicity for exposed operations — **BLOCKS: WRITES** · findings **R-01**, **R-02**, new **T-8**

**Current state (verified — better than the audit implies for this slice).**
`acceptGRN` (`grn.ts:382`) is genuinely atomic: `withPrismaAuth` → `$transaction` (`lib/db.ts:63-66`); the
GL call threads the tx (`grn.ts:551` → `inventory-gl.ts:174` → `finance-gl.ts:332-333`); and GL failure
is **blocking** because `postInventoryGLEntry` checks the result and re-throws
(`inventory-gl.ts:176-181`). `createDirectPurchase` (`procurement.ts:2229`) and `createPurchaseReturn`
(`:2530`) are likewise correct — GL threaded at `:2418`/`:2438` and `:2672`/`:2678`, with
`if (!glResult?.success) throw` at `:2439-2441` and `:2680-2682`.

**The residual gap in the slice (T-8).** `approvePurchaseOrder` closes its `withPrismaAuth` block at
`procurement.ts:1016` and *then* calls `await recordPendingBillFromPO(po)` at `:1019` — **outside the
transaction, and without checking the result.** That function returns `{success:false, error:"Finance Sync
Failed"}` on any error (`finance-invoices.ts:822`). The same pattern recurs at `procurement.ts:1313` with
the failure explicitly swallowed at `:1315-1316`.

**Severity is bounded and this is important to state precisely:** the bill is created at `status:'DRAFT'`
with **no `postJournalEntry` call** (`finance-invoices.ts:795-813`). That is *correct* accrual behaviour —
expense recognises when the bill is approved, not when the PO is approved (`CLAUDE.md` Layer 6). So the
failure mode is "PO approved, draft bill missing", **not** "books unbalanced".

**Required state.**
- The operation checks the return value and emits `severity:'W', code:'BILL_SYNC_PENDING'`.
- `outputSchema.draftBill.created` exposes the fact machine-readably.
- The invariant job (G-05) asserts "every `APPROVED` PO has a non-cancelled `INV_IN`".
- **Binding ban enforced in code:** an ESLint `no-restricted-imports` rule scoped to `lib/agent/**`
  forbidding `lib/actions/finance.ts`, plus a catalog lint asserting every `boundAction` resolves to an
  allowlisted canonical module. R-02's `createInvoiceFromSalesOrder` lives in `finance.ts:1528-1543`; it is
  out of the slice but must be structurally unreachable, not merely un-referenced.
- **Not exposed until fixed** (rule 5): the four operations in catalog §5.

---

### G-03 · Guarded state transitions on every exposed operation — **BLOCKS: WRITES** · finding **R-16**

**Current state (verified — the audit is accurate and the picture is mixed within a single file).**

Guarded correctly (`updateMany({where:{id, status: expected}})` + `count === 0 ⇒ throw`):

| Action | `path:line` |
|---|---|
| `approvePurchaseRequest` | `procurement.ts:618-627` |
| `convertPRToPO` item dedupe | `procurement.ts:893-901` |
| `approvePurchaseOrder` | `procurement.ts:991-1001` |
| `markAsOrdered` | `procurement.ts:1167` + count `:1175` |
| `markAsVendorConfirmed` | `procurement.ts:1206-1213` |
| `markAsShipped` | `procurement.ts:1245-1252` |
| `acceptGRN` status flip | `grn.ts:448-458` |
| `acceptGRN` over-receive | `grn.ts:473-491` |
| `rejectGRN` | `grn.ts:693-713` |
| `createPurchaseReturn` stock decrement | `procurement.ts:2628-2642` (`gte` guard) |

**Unguarded — plain `update({where:{id}})` after a read-then-check:**

| Action | `path:line` | Consequence |
|---|---|---|
| `rejectPurchaseRequest` | `procurement.ts:742` (check at `:730-731`) | asymmetric with the guarded approve at `:618` — concurrent approve+reject both pass |
| `submitPOForApproval` | `procurement.ts:945` | the only PO lifecycle transition missing the guard |
| `rejectPurchaseOrder` | `procurement.ts:1042` | |
| `cancelPurchaseOrder` | `procurement.ts:1082` | plus G-10 |
| `confirmPurchaseOrder` | `procurement.ts:1287` | plus a bare-global re-read at `:1307` |
| `createPurchaseReturn` `returnedQty` | `procurement.ts:2648-2651` | over-return check at `:2617-2620` is read-then-write |
| SO transition route | `app/api/sales/orders/[id]/transition/route.ts:89` (read at `:47`) | out of slice |

**Required state.** Every transition in an exposed operation uses the guarded pattern and maps
`count === 0` to a stable code. Until then the six unguarded procurement actions are **BLOCKED** in the
catalog (§5) and emit no MCP tool.

---

### G-04 · Connection budget — **BLOCKS: BOTH** · findings **R-05**, **R-27**, new **T-2**, **T-3**, **T-4**

**Current state (verified — worse than the audit, because the traced operation compounds it).**
`withPrismaAuth` wraps **every** operation, reads included, in
`$transaction(cb, {maxWait:15000, timeout:20000})` (`lib/db.ts:62-67`), at `connection_limit=10`
(`lib/db.ts:22`) while the file's own comment says the pooler allows ~15 and "we use 5" (`:13-15`).
`supabase.auth.getUser()` is awaited with no timeout before the tx opens (`lib/db.ts:51-53` = R-27).

New, found while tracing:

- **T-3:** `getEmployeeForUserEmail` is declared at `grn.ts:41-48` against the module-scope singleton
  `prisma` (`grn.ts:3`) and is invoked at `grn.ts:446` — i.e. **inside** the transaction opened at `:388`.
  Every `acceptGRN` therefore holds **two** connections.
- **T-2:** `assertPeriodOpen` also uses the singleton (`lib/period-helpers.ts:1,15`), so once G-06 lands
  it would add a **third** unless it is made tx-aware first.
- **T-4:** `recalculateVendorRating` is fired **unawaited** at `grn.ts:657-659` and issues four further
  singleton-client queries (`grn.ts:784-853`), including an unbounded `gRNItem.aggregate` over the whole
  supplier history (`:825-832`).
- `procurement.ts` has the same leak at `:1307` (bare global inside the flow) and `:2245`,
  and calls `ensureSystemAccounts()` with no tx client while a tx is open at `:2657`.
- **Verified: there is no `maxDuration` on any route and no `AbortController` anywhere** in `app/` or
  `lib/` (grep: zero hits for both). R-15 stands in full.

**Required state.**
1. Agent **read** operations are not wrapped in interactive transactions.
2. T-2, T-3 threaded onto the tx client; T-4 becomes a queued job with a `jobId`.
3. Per-principal concurrency cap (2 writes / 4 reads), enforced at L2 with a bounded queue.
4. Per-call deadline **shorter** than the 20 s tx timeout — 15 s writes, 8 s reads — so the client gives
   up *after* the server, not before. (A client that gives up first creates precisely the
   "did it commit?" ambiguity that G-01 exists to resolve.)
5. `maxDuration` on the MCP route; the middleware's 5 s `getUser` race (`middleware.ts:54-56`) adopted in
   `withPrismaAuth`.
6. Confirm `?pgbouncer=true` is in the real `DATABASE_URL` (still **UNVERIFIED** — needs env access).

---

### G-05 · Runtime integrity invariants — **BLOCKS: WRITES** · findings **R-22**, **R-12**

**Current state (verified).** Trial-balance sums exist only inside on-demand reports
(`lib/actions/finance-reports.ts:247, 1018`); there is no scheduled or post-write invariant job.
R-12's index gaps are confirmed against the schema: `JournalEntry` carries only `@@index([date])`
(`schema.prisma:2317`) and `@@index([isReconciled])` (`:2318`) — `invoiceId`, `paymentId`,
`salesOrderId`, `purchaseOrderId`, `inventoryTransactionId` (`:2290-2294`) are **all unindexed**, so every
document→GL traceability lookup is a sequential scan. `GRNItem` has only `@@index([grnId])`
(`schema.prisma:1462`) — `poItemId` and `productId` are unindexed. And **there is not one `CHECK`
constraint in the entire migration history** (grep `CHECK (` across `prisma/migrations/` → zero matches):
no `quantity >= 0`, no `debit >= 0`, no per-entry balance enforcement.

**Required state.** A protected `/api/admin/integrity-check` asserting, after every agent write batch:

| Invariant | Query shape |
|---|---|
| Trial balance | `SUM(JournalLine.debit) === SUM(JournalLine.credit)` over `status:'POSTED'` |
| No orphan JE | every `JournalEntry` has ≥2 `JournalLine`s and each entry balances |
| Balance vs lines | `GLAccount.balance` === signed sum of its lines, per account type |
| Stock vs ledger | `StockLevel.quantity` === running sum of `InventoryTransaction.quantity` per (product, warehouse) — **see G-11, currently impossible for fractional units** |
| Receipt integrity | every `ACCEPTED` GRN line has a matching `InventoryTransaction` **and** a `POSTED` `JournalEntry` |
| PO/bill integrity | every `APPROVED` PO has a non-cancelled `INV_IN` (covers T-8) |
| Over-receipt | no `PurchaseOrderItem` where `receivedQty > quantity` (covers G-10) |

**A failure trips the kill switch (L0).** Depends on the R-12 indexes to run at agent cadence.

---

### G-06 · Posting-period control — **BLOCKS: WRITES** · **NEW (T-1) — not in the audit**

**Current state (verified).** `postJournalEntry` calls `assertPeriodOpen` **only on the standalone
branch**: `finance-gl.ts:332-334` returns `postJournalEntryInner(txClient, data)` immediately when a tx
client is supplied, and `assertPeriodOpen(data.date)` is at `:338` — *after* that return. The docstring at
`:305-307` admits it ("skips withPrismaAuth and assertPeriodOpen (caller is responsible for both)").

The caller is **not** responsible in practice:
- `lib/actions/grn.ts` never imports or calls `assertPeriodOpen` (grep: zero hits in the file).
- `lib/actions/procurement.ts` **imports it at `:14` and never calls it** — a dead import. So
  `createDirectPurchase` (GL at `:2418`), `createPurchaseReturn` (GL at `:2672`) and `saveLandedCost`
  (GL at `:1905`) all post with no period check.
- The comment at `inventory-gl.ts:165-167` claims the delegate gets "the control-account guard, period
  assertion, balance check … for free". **It gets two of the three.**

**Net effect: an agent can post inventory receipts into a closed fiscal period.** SAP spine row
"posting period control" is currently *absent* on the agent's path, not merely weak.

**Required state.** `assertPeriodOpen(tx, date)` — a tx-accepting variant (fixing T-2) — as mandatory
step ② of every posting operation, before any write, using the **business event date**. Mapped to
`code:'PERIOD_CLOSED'`, severity `E`, not retryable.

---

### G-07 · Truthful reads — **BLOCKS: READS** · findings **R-08**, **R-09**, **R-06**

**Current state (verified — every read the slice needs is affected).**

| Read | `path:line` | Behaviour on DB error |
|---|---|---|
| `getPendingPOsForReceiving` | `grn.ts:79-98` **and** `:134-137` | `safeQuery(..., FALLBACK_PENDING_POS)` **discarding the `error` field** (`lib/db.ts:209` returns `{data, error, fromCache}`; `grn.ts:79` destructures only `{data: orders}`), then `catch → []` |
| `getAllGRNs` | `grn.ts:189-192` | `catch → []` |
| `getGRNById` | `grn.ts:252-255` | `catch → null` |
| `getWarehousesForGRN` | `grn.ts:742-745` | `catch → []` |
| `getEmployeesForGRN` | `grn.ts:769-772` | `catch → []` |
| `getVendors` | `procurement.ts:157-159` | **`catch → FALLBACK_VENDORS` — fabricated supplier rows** |
| `getAllPurchaseOrders` | `procurement.ts:1385-1387` | **`catch → FALLBACK_PURCHASE_ORDERS`** |
| `getPurchaseRequests` | `procurement.ts:497-499` | `catch → []` |
| `getPendingApprovalPOs` | `procurement.ts:1535-1537` | `catch → []` |
| `getProcurementStats` | `procurement.ts:170-174`, `:200-264`, `:420-455` | per-query fallbacks **and** an all-zero whole-function catch |
| `getSupplierScorecard` | `procurement.ts:2051-2053` | `catch → null` |
| `getPOTemplates` | `procurement.ts:1737-1739` | `catch → []` |

R-06's zeroed-dashboard pattern (`app/api/dashboard/route.ts:391-398`) is the same class at module scale.

**Why this blocks reads, not just writes.** A human sees an empty list and reloads. **An agent sees an
empty list and concludes** — "tidak ada PO yang menunggu penerimaan", then proposes creating a duplicate
PO. `FALLBACK_VENDORS` is worse than empty: it returns *fabricated suppliers* the agent could raise a PR
against. A read the agent cannot trust must **fail**, not return `[]`.

**Required state.** Agent-reachable reads call variants that throw; the operation layer maps to
`severity:'E', code:'READ_FAILED', retryable:true`. `FALLBACK_*` is dev-only. Plus: bounded page sizes
(default 25, max 100), cursor pagination, field projection, a 32 KB payload ceiling, and a `truncated`
block naming what was cut.

---

### G-08 · Document numbering — **BLOCKS: WRITES (narrowly)** · findings **R-17**, **R-03**

**Current state (verified — substantially better than the audit reported for this slice).**
`lib/actions/procurement.ts` contains **zero** `count()+1` or `findFirst orderBy desc` numbering patterns.
Everything routes through the atomic `getNextDocNumber` upsert (`lib/document-numbering.ts:19-30`, backed
by `DocumentCounter @@unique([prefix])` at `schema.prisma:3938`):

| Document | `path:line` |
|---|---|
| PR number | `procurement.ts:546` |
| PO number | `procurement.ts:850` |
| direct-purchase PO / GRN / BILL | `procurement.ts:2259` / `:2311` / `:2386` |
| debit note | `procurement.ts:2576` |
| GRN number | `grn.ts:282` |
| inventory JE reference | `inventory-gl.ts:96-101` |

**The one residual gap reachable from the slice:** vendor-bill numbering at
`finance-invoices.ts:777-784` uses `invoice.count({where:{type:'INV_IN', number:{startsWith: billBaseNumber}}})`
then `-NN`, reached from `approvePurchaseOrder` at `procurement.ts:1019`.

**Required state.** Route bill numbering through `getNextDocNumber`; confirm `Invoice.number` uniqueness.
R-03 (NSFP, `finance-efaktur.ts:227-242`, plus the missing `@unique` on `Invoice.nsfpNumber`) is **not
reachable from the procurement slice** but is an absolute blocker for any future AR operation — a
duplicate Indonesian government tax serial is a compliance defect, not a bug. Tracked, not gating Stage 1.
Note also `DocumentCounter` has no tenant or year-reset column (`schema.prisma:3931-3940`).

---

### G-09 · Canonical reads for the slice — **BLOCKS: READS** · new

**Current state.** Four reads the catalog requires do not exist as canonical actions: PR detail, PO
detail, product search for procurement, and stock level by product. Binding rule 2 forbids writing them as
raw Prisma inside `lib/agent/**`.

**Required state.** Add `getPurchaseRequestById` and `getPurchaseOrderById` to
`lib/actions/procurement.ts`; add `getProductsForProcurement` and `getStockLevelForProduct` to the
canonical inventory action module. All four must throw on error (G-07), support cursor pagination and
field projection, and be usable by the UI too — they are not agent-only shims.

---

### G-10 · Reversal path & the duplicate receive path — **BLOCKS: WRITES** · findings **R-29**, new

**Current state (verified — two distinct problems).**

**(a) The reversal is unsafe.** `createPurchaseReturn` (`procurement.ts:2530`) is the Storno for
`receiveGoods` (`RETURN_OUT`: `DR 2150 / CR 1300`, `inventory-gl.ts:154-156`). It calls `getAuthzUser()`
at `:2531` but has **no `assertRole`** — any authenticated user can issue a debit note, decrement stock
and post to AP/Inventory/PPN. Its stock decrement is exemplary (`gte`-guarded `updateMany` at
`:2628-2642`), but the sibling `purchaseOrderItem.update({returnedQty:{increment}})` at `:2648-2651` is
**unguarded** and the over-return check at `:2617-2620` is read-then-write, so two concurrent returns can
push `returnedQty` past `receivedQty`. It also calls `ensureSystemAccounts()` at `:2657` with no tx client
while a tx is open.

**(b) There are two live receive paths (R-29 — confirmed live).** `receiveGoodsFromPO`
(`app/actions/inventory.ts:1010`) is wired to `components/inventory/goods-receipt-dialog.tsx:106`. It has
an over-receive check (`app/actions/inventory.ts:1042-1058`) that even aggregates accepted GRN quantities
— but it is a **read-then-check in memory**, with no `updateMany` guard. `acceptGRN`'s guard
(`grn.ts:473-483`) is atomic and would block a concurrent agent double-receive; the dialog path's would
not. **So an agent receiving via `acceptGRN` while a human receives via the dialog can over-receive**, and
the resulting `receivedQty > quantity` is invisible to both.

**Required state.**
- Add `assertRole` and guard `returnedQty` on `createPurchaseReturn`; thread `ensureSystemAccounts` onto
  the tx. Only then can `procurement.reversePurchaseReceipt` be exposed.
- Consolidate `receiveGoodsFromPO` onto `acceptGRN`, or convert its check to the guarded `updateMany`
  pattern. **One receipt path.**
- **Consequence for Stage 1:** `procurement.receiveGoods` posts to the GL and its `reversalOperation` is
  currently BLOCKED. Per the SAP *Storno* rule and the forced-escalation rule
  (`AGENT_SAFETY_MODEL.md §4.3`), it may run in Stages 1–2 **only** under mandatory human approval, and it
  may **not** enter Stage 3 until G-10 ships.

---

### G-11 · Stock ledger can represent fabric — **BLOCKS: WRITES (fractional UoM)** · findings **R-13**, new **T-7**

**Current state (verified).** `StockLevel.quantity` is `Decimal(18,4)` (`schema.prisma:381`, migrated by
`20260423160000_stock_level_decimal`) while `InventoryTransaction.quantity` is still `Int`
(`schema.prisma:408`). `GRNItem.quantityOrdered/Received/Accepted/Rejected` are also all `Int`
(`schema.prisma:1445-1448`), as are `PurchaseOrderItem.quantity/receivedQty/returnedQty`
(`schema.prisma:1277-1279`) — so the integer constraint runs the full length of the PR→PO→GRN chain.

**This is a textile ERP.** Receiving 2.5 m of fabric cannot be written truthfully to the movement ledger,
so the stock-vs-ledger invariant in G-05 **can never pass** for fractional units, and the agent's
`ledgerReconciles` flag would be permanently `false`.

**Required state.** Migrate `InventoryTransaction.quantity` and the `GRNItem` quantity columns to
`Decimal(18,4)`. **Until then**, `procurement.createGoodsReceipt` and `procurement.receiveGoods` reject
non-integer quantities with `code:'FRACTIONAL_QTY_UNSUPPORTED'` and a Bahasa remediation directing the
user to the manual path — an explicit refusal rather than a silent truncation.

---

### G-12 · Observability & correlation — **BLOCKS: BOTH** · findings **R-21**, **R-31**

**Current state (verified).** 799 raw `console.*` calls, no structured logging, no correlation ids, no
error tracking, no health endpoint. `acceptGRN` alone emits 12 unstructured `console.log`s
(`grn.ts:386, 405, 420, 442, 459, 492, 512, 531, 542, 561, 575, 602, 651`). Audit-log writes are
best-effort with swallowed failures (R-31: `finance.ts:419, 1301, 3538`; `finance-ap.ts:371`;
`app/actions/inventory.ts:889, 1769, 1939`).

**Required state.** `correlationId` per episode threaded through every operation, log line, and audit row;
a structured logger; `/api/health`. **`AgentActionLog` is written inside the operation's transaction and
its failure aborts the operation** — the opposite of the R-31 pattern. An agent action that cannot be
logged does not happen.

---

### G-13 · Credential hygiene before minting agent grants — **BLOCKS: BOTH** · findings **R-24**, **R-14**

**Current state (verified).** R-24: a plaintext Postgres password sits in git history via
`DB_CONNECTION_FIX.md`; editing the file does not un-publish it. R-14/§6 of the design prompt: the
`middleware.ts` matcher excludes `api/` (`middleware.ts:177`), ~36 routes self-authenticate or don't, and
**additionally** `middleware.ts:103-107` returns without auth enforcement whenever the request carries an
`rsc: 1` or `next-router-prefetch: 1` header — both attacker-supplied — so even "protected" page routes
are reachable unauthenticated. `app/api/tenant/route.ts:20` instantiates `new PrismaClient()` per request
and is explicitly public (`:5-6`), swallowing all errors into a 200 (`:40`).

**Required state.** Rotate the Supabase DB password. Run the security audit Phase A. **Honest statement:
the control plane cannot fix this.** The MCP server is a single authenticated entry point and inherits
none of it — but anything an attacker can reach through an unauthenticated route **bypasses the control
plane entirely**, which makes every control in `AGENT_SAFETY_MODEL.md` moot for that path. Grants must not
be minted before Phase A completes.

---

## 2. Non-blocking findings — assessed and tracked

| Finding | Assessment for the agent slice |
|---|---|
| **R-02** `createInvoiceFromSalesOrder` returns `success:true` on GL failure (`finance.ts:1528-1543`) | Out of the procurement slice. Structurally unreachable once the `finance.ts` import ban (G-02) is enforced. **Blocks any future AR operation.** |
| **R-03** NSFP duplicate tax serials | Out of slice. **Absolute blocker for AR.** Tracked in G-08. |
| **R-04** Unguarded stock decrements | The slice's only decrement is `createPurchaseReturn`, which is **correctly `gte`-guarded** (`procurement.ts:2628-2642`) — better than the audit's general claim. The unguarded sites (`app/api/manufacturing/work-orders/[id]/route.ts:175-191`, `subcontract.ts:852-860`, `stock-reservations.ts:118-165`) are out of slice but **block the manufacturing domain**. No DB `CHECK` exists anywhere (G-05). |
| **R-06** Zeroed dashboard | Same class as G-07; the dashboard is not an agent read source in Stage 1. Blocks any future `dashboard.*` read operation. |
| **R-10** `cache-warm` stampede | Not on the agent path, but the agent adds concurrent load to the same pool. Mitigated by G-04's caps; fix before Stage 3. |
| **R-11** Client cache 5-min stale / IndexedDB | **Designed around**: agent reads are server-side and never traverse TanStack Query (`AGENT_CONTROL_PLANE_ARCHITECTURE.md §5`). Not blocking. |
| **R-15** No timeouts / `maxDuration` | Verified: **zero** `maxDuration` and **zero** `AbortController` in `app/` or `lib/`. Folded into G-04. |
| **R-18** WO completion posts no GL | Out of slice. **Blocks the manufacturing domain entirely** — an agent completing work orders would silently drift COGS. |
| **R-19 / R-20** Prisma fully mocked in tests (`test-setup.ts:7-10`), zero coverage on concurrency/idempotency/PO state machine | Does not block the *slice*, but **blocks stage advancement**: the eval harness cannot certify idempotency-under-retry against a mocked Prisma. DB-backed integration tests are a Stage-2 exit criterion (`AGENT_ROLLOUT_PLAN.md §3`). |
| **R-23** `ignoreBuildErrors: true` (`next.config.ts:7-11`) | Removes the main guard against contract drift between the descriptors and the canonical actions. `tsc --noEmit` in CI, gating `lib/agent/**`, is a Stage-2 exit criterion. |
| **R-25** Destructive migration | Historical. Not agent-relevant. |
| **R-26** Partial-unique migration | **Already applied** — `20260423140000_stock_level_partial_unique` creates `stock_levels_warehouse_no_location_unique … WHERE "locationId" IS NULL`. This is what makes `acceptGRN`'s `findFirst`→`create` branch (`grn.ts:515-541`) fail **closed** (P2002 → rollback) rather than silently duplicating (T-10). Correct for accounting; the `AgentResult` mapper must translate P2002 on that index to `STOCK_ROW_CONFLICT`, `retryable:true`. Should still become an `upsert`. |
| **R-28** `error.tsx` gaps | UI-only. Not agent-relevant. |
| **R-30** Hardcoded GL codes / tax rates | The slice's GL path is clean — `inventory-gl.ts:56-62` uses `SYS_ACCOUNTS.*` throughout. The violations (`sales.ts:357-358, 1391, 1401`) are out of slice. Blocks the sales domain. |
| **R-31** Best-effort audit-log swallows | Folded into G-12: `AgentActionLog` must **not** follow this pattern. |
| **R-32** Client `fetch` without `AbortController` | Browser-only. Not agent-relevant. |

---

## 3. Gate checklist

### Before any agent **READ** ships

| Item | Findings | Status |
|---|---|---|
| G-07 truthful reads (no fallbacks, bounded pages, payload ceiling) | R-08, R-09, R-06 | ☐ |
| G-09 canonical detail reads added | new | ☐ |
| G-04 reads out of interactive transactions; concurrency cap; deadlines | R-05, R-27, T-2/3/4 | ☐ |
| G-12 correlation id + structured logging | R-21 | ☐ |
| G-13 DB password rotated; security audit Phase A complete | R-24, R-14 | ☐ |

### Before any agent **WRITE** ships — everything above, plus

| Item | Findings | Status |
|---|---|---|
| **G-01 `AgentOperationRecord` idempotency, inside the transaction** | R-07 | ☐ |
| G-02 atomicity verified per exposed op; `finance.ts` import ban enforced in CI | R-01, R-02, T-8 | ☐ |
| G-03 guarded transitions on every exposed op | R-16 | ☐ |
| G-05 invariant job + R-12 indexes; auto-trips the kill switch | R-22, R-12 | ☐ |
| **G-06 `assertPeriodOpen(tx, date)` on every posting operation** | **new T-1** | ☐ |
| G-08 bill numbering via `getNextDocNumber` | R-17 | ☐ |
| G-10 reversal path safe; single receive path | R-29, new | ☐ |
| G-11 fractional quantities: migrate or explicitly refuse | R-13, T-7 | ☐ |
| G-12 `AgentActionLog` written inside the transaction, failure aborts | R-21, R-31 | ☐ |
| Kill switch (L0–L5) implemented and tested | new | ☐ |
| Session grant issuance/verification independent of `assertRole` and `user_metadata` | R-14, `authz.ts:19-21, 64-72` | ☐ |

### Before **Stage 3** (thresholded autonomy) — additionally

| Item | Findings | Status |
|---|---|---|
| G-10(a) `procurement.reversePurchaseReceipt` exposed — no un-undoable money op without a reversal | R-29 | ☐ |
| DB-backed integration tests for idempotency, concurrency, PO state machine | R-19, R-20 | ☐ |
| `tsc --noEmit` gating `lib/agent/**` in CI | R-23 | ☐ |
| `cache-warm` authenticated and actually caching | R-10 | ☐ |
| Eval harness thresholds met | — | ☐ |
