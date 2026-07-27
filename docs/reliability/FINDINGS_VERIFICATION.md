# FINDINGS VERIFICATION — Adversarial Re-Check of the Phase A Reliability Findings

> **Purpose.** `RELIABILITY_FINDINGS.md` was produced by static analysis. Static analysis produces false
> positives. Before anyone spends engineering effort — especially surgery on GL posting in a live accounting
> system — an independent pass tried to **refute** each Sev-1, defaulting to REFUTED where evidence was
> ambiguous.
>
> **The single biggest methodological gap it found:** the original audit **never checked reachability**.
> Reachability changed the verdict on **5 of 8** findings. Several "critical" defects are in code with zero
> importers. Fixing them would mean touching working systems for no benefit.
>
> **This document supersedes the severities in `RELIABILITY_FINDINGS.md`.** Read them together.

## Verdict summary

| ID | Original | Verdict | Revised | Reachability |
|----|----------|---------|---------|--------------|
| **R-05** Connection exhaustion | Sev-1 | **CONFIRMED** (worse than described) | **Sev-1** | pervasive |
| **R-06** Zeroed HTTP-200 dashboard | Sev-1 | **CONFIRMED** verbatim | **Sev-2** | live |
| **R-01** Non-atomic GL posting | Sev-1 | **PARTIAL** — mechanism real, scope inflated | **Sev-2** | mixed |
| **R-04** Unguarded stock decrements | Sev-1 | **PARTIAL** — 2 live, 2 dead | **Sev-2** | 2 live / 2 dead |
| **R-07** Webhook idempotency | Sev-1 | **PARTIAL** — code claims true, flow unwired | **Sev-3** | dead (pre-launch) |
| **R-02** Invoice success-on-GL-failure | Sev-1 | **PARTIAL** — defect real, path dead | **Sev-4** | dead |
| **R-03** NSFP duplicate tax serials | Sev-1 | **REFUTED** | **DROP** | dead + non-functional |
| **R-18** WO completion posts no GL | Sev-2 | **REFUTED** | **DROP** | live **and correct** |

---

## Dropped — do not staff these

### R-03 · NSFP duplicate tax serials — REFUTED
The feature **does not exist in the database**. `grep -in "nsfp" prisma/schema.prisma` → no matches across
4,033 lines; no match in any migration. There is no `NSFPRange` model and no `Invoice.nsfpNumber` column.
`lib/actions/finance-efaktur.ts:211` calls `tx.nSFPRange.findFirst(...)` — a property that does not exist on
the generated Prisma client. It throws `TypeError` before reaching the counter, and it compiles only because
`next.config.ts` sets `ignoreBuildErrors: true` (which is R-23, the real finding here). `allocateNSFP` has no
external callers; the only outside touch is a type-only import in
`components/finance/efaktur-export-dialog.tsx:19`, erased at compile time.

*The race would be real if the schema existed* — the in-memory `currentCounter + 1` (`:227`) then `update`
(`:242`) is a genuine read-modify-write, and row locking would not save it under READ COMMITTED. But no
serial can be issued at all, so no duplicate serial can be issued. **Reclassify as build-hygiene under R-23,
not a tax-compliance defect.** Anyone assigned to "fix the NSFP race" would be writing a migration for an
unshipped feature.

### R-18 · Manufacturing WO completion posts no GL — REFUTED
The posting exists, is complete, and is **more atomic than the canonical finance paths**.
`app/api/manufacturing/work-orders/[id]/route.ts:312-362` implements a full four-step standard-costing
sequence: DR WIP/CR Raw Materials (`:314-324`), DR WIP/CR Wages Payable (`:327-336`), DR WIP/CR MFG OH
Applied (`:339-348`), and **DR Finished Goods / CR WIP** (`:352-362`) — exactly the entry the finding claimed
never happens. It uses `SYS_ACCOUNTS.*` constants, links `inventoryTransactionId` for traceability, and runs
inside the single `prisma.$transaction` opened at `:758` via `postJournalWithBalanceUpdate(tx, …)` — no
nested transaction, no Class A defect. Both completion routes are covered (incremental `REPORT_PRODUCTION` at
`:787`, and direct transition to `COMPLETED` at `:851-886`).

**Why it was missed:** the search was scoped to callers of `postJournalEntry`/`postInventoryGLEntry` inside
`lib/actions/`. This path lives in an **API route** and uses a **locally defined** helper (`route.ts:57`).
CLAUDE.md's "TBD" marker for WO completion is **stale documentation**, and the audit inherited it.

*Residual real issues (different findings):* `route.ts:57` is a private reimplementation of
`postJournalEntryInner`, so account-type balance-direction logic now lives in two places and can drift; and
this route has no auth check (belongs to R-14).

---

## Confirmed — fund this first

### R-05 · Connection exhaustion — CONFIRMED, and worse than reported
The refutation hypothesis ("most routes use bare `prisma`, so severity is overstated") was tested and
**failed**:

```
withPrismaAuth call sites:  297   (finance.ts 36, procurement.ts 26, finance-gl.ts 25, sales.ts 23, …)
direct prisma.$transaction:  28
```

`withPrismaAuth` dominates by ~10× and is what the entire server-action layer uses. Read-only actions are
demonstrably wrapped in interactive transactions: `getVendorBills` (`finance-ap.ts:85`), `getJournalEntries`
(`finance-gl.ts:354`), `getChartOfAccountsTree` (`finance.ts:2166`). `connection_limit=10` confirmed
(`lib/db.ts:22`) against its own comment saying the pooler allows ~15 and "we use 5" (`:14-15`).
`grep -rn "maxDuration"` → zero matches.

**Two amplifiers the original audit missed:**
1. **The retry logic amplifies starvation instead of shedding load.** P2024 ("timed out fetching a
   connection") is classified `canRetry:true` (`lib/db.ts:111-117`) and retried twice by `withRetry`
   (`:142`). Under pool pressure this adds load precisely when the pool is exhausted.
2. **`Promise.all` inside a `withPrismaAuth` callback serializes** — one transaction is one connection is one
   query at a time, so intended parallelism is silently lost and the connection is held longer.

**Also resolved:** `DB_CONNECTION_FIX.md:15` documents port **6543 with `?pgbouncer=true`** — Supabase's
*transaction*-mode pooler, contradicting `lib/db.ts:13`'s "session-mode pooler" comment. The prepared-statement
hazard is therefore mitigated, but transaction-mode pinning means each interactive transaction pins a server
connection for its full duration — **the pool-pressure claim holds and arguably worsens.**

**Partial correction to R-27:** `supabase.auth.getUser()` (`lib/db.ts:51-53`) runs *before* `$transaction`, so
its unbounded latency costs request latency but does **not** hold a DB connection.

### R-06 · Zeroed HTTP-200 dashboard — CONFIRMED verbatim
`app/api/dashboard/route.ts:391-405` catches and returns `FALLBACK_*` zeros; `NextResponse.json()` with no
`{status}` defaults to **200**. `app/actions/dashboard.ts:1082-1095` is 14 chained `.catch(() => 0/[]/{zeros})`
plus a whole-function zeroed catch at `:1114-1119`. No `loaded`/`failed` discriminator exists in the payload.
**Downgraded to Sev-2** only because it is a read-only display path that corrupts no data and loses no money —
though one field, `qualityStatus.passRate: -1` (`:23`), proves a failure sentinel was reachable and simply
wasn't applied to the money fields.

---

## Partially confirmed — scope corrected

### R-01 · Non-atomic GL posting — mechanism real, blast radius inflated
**The mechanism survives.** `withPrismaAuth` always calls `$transaction` on the module-level `basePrisma`
(`lib/db.ts:62-67`) with no AsyncLocalStorage, no tx propagation, no re-entrancy guard — so a nested
`withPrismaAuth` genuinely opens a second transaction on a second connection. The fork in
`finance-gl.ts:333-342` is exactly as described.

**But the headline sites are dead code.** `approveAndPayBill` has **zero callers** in either
`finance-ap.ts:792` or `finance.ts:2463`. `finance-ap.ts:recordVendorPayment` is unreachable — the UI imports
`recordVendorPayment` from `@/lib/actions/finance`, not `finance-ap`. So "every AP payment, payroll run, and
sales return" is **not** accurate.

**The one live orphan window** (buried in the original report, and the real finding):
`recordMultiBillPayment` (`finance-ap.ts:491`) is live via a re-export shim at `finance.ts:2133-2136`,
consumed by `app/finance/bills/page.tsx:325` and `components/finance/vendor-multi-payment-dialog.tsx:197`.
Failing sequence: outer tx T1 creates payments and updates bills → `finance-ap.ts:621` posts GL in an
independent T2 which **commits** → `finance-ap.ts:634` `withholdingTax.create` fails → T1 rolls back →
**orphan DR AP / CR Bank journal entry with no Payment row**, and the AP subledger no longer ties to control
account 2000.

⚠️ **Important for remediation:** `recordMultiBillPayment` reaches `finance-ap` through a **dynamic-import
shim**. A naive "delete the `finance.ts` duplicates" fix would break the live path.

### R-04 · Unguarded stock decrements — 2 live, 2 dead
- **CONFIRMED LIVE** — `app/api/manufacturing/work-orders/[id]/route.ts:175-191`: classic TOCTOU (check at
  `:175`, plain `{decrement}` at `:184`) under READ COMMITTED. Two concurrent `REPORT_PRODUCTION` PATCHes on
  WOs sharing a material both pass the check → stock goes negative. Wired to
  `app/manufacturing/orders/orders-client.tsx:207,248` and three other clients.
- **CONFIRMED LIVE** — `lib/actions/subcontract.ts:826-860`: same shape, reached via
  `components/subcontract/shipment-tracking.tsx:101`. Nuance: the guard is on `availableQty`, so *that* goes
  negative before `quantity` does.
- **REFUTED on reachability** — `lib/actions/stock-reservations.ts` has **zero importers** repo-wide. The WO
  route defines its own private `reserveStockForWorkOrder` (`route.ts:538`); `consumeReservation` is never
  called. Site 3 also only moves `availableQty`/`reservedQty`, never physical `quantity`.

**DB backstop sub-claim CONFIRMED:** `grep -rn "CHECK (" prisma/migrations/` → zero matches.
Fix remains cheap (`updateMany` + `where:{quantity:{gte}}` + count check, per the correct pattern at
`app/actions/inventory.ts:1387`), so it is still worth doing at Sev-2.

### R-07 · Webhook idempotency — every code claim true, flow unreachable
All four sub-claims verified in `app/api/xendit/webhook/route.ts`: non-atomic marker check (`:52` vs
`:72-77`), `SUCCEEDED` sets `PAID`/`balanceDue:0` (`:62-68`) with no GL and no transaction, errors swallowed
then **200** returned (`:130-148`, with an explicit comment *"Return 200 anyway to prevent Xendit from
retrying"*), and `findFirst` on a non-unique `Payment.reference` (`schema.prisma:1945`).

**But nothing can trigger it.** No code path initiates a payout — `app/api/xendit/payout/route.ts` contains no
`prisma` reference at all and never creates a `Payment` row, so no `reference_id` can ever match. The handler
logs `Payment not found` (`:128`). **Downgraded to Sev-3, latent/pre-launch.**

⚠️ **Flag for whoever finishes the integration:** `recordVendorPayment` lets a user type a free-text
`reference` (`finance-ap.ts:351`). The day payouts go live, an arbitrary user-typed string becomes the
webhook's join key on a non-unique column.

> **Note the distinction from the security audit:** "unreachable from the UI" is *not* "unreachable from the
> internet." `/api/xendit/payout` is unauthenticated and directly callable by anyone — see the security
> findings. Having no UI caller is precisely why deleting it is safe.

### R-02 · Invoice success-on-GL-failure — defect real, path dead
The code defect is verbatim as reported (`finance.ts:1528-1543`; both the `!glResult?.success` branch and the
`catch (glError)` branch fall through to `return {success:true}`), and is slightly worse than described — the
invoice is created `status:'ISSUED'` (`:1443`) with `balanceDue: total` (`:1450`), so it lands in AR aging
with no journal entry.

**But the UI does not call it.** `components/finance/create-invoice-dialog.tsx:13-17` imports
`createInvoiceFromSalesOrder` from `@/lib/actions/finance-invoices` — the canonical file, which creates
`status:'DRAFT'` (`:915`) with no GL (correct accrual behaviour; GL is deferred to `moveInvoiceToSent`). The
only importer of the `finance.ts` copy is `lib/actions/sales.ts:1110`, whose consumer
`generateInvoiceFromSalesOrder` has **zero callers**. **Downgraded to Sev-4 — dead-code deletion.**

---

## Two new defects found during verification (not in the original report)

- **`lib/actions/subcontract.ts:881-883`** — GL posting for `SUBCONTRACT_OUT` is wrapped in
  `try/catch { console.error }`, so the stock movement and inventory transaction commit while the
  DR WIP / CR Inventory journal is **silently skipped**. This is a textbook Class B on a **live** path
  (`components/subcontract/shipment-tracking.tsx:101`) that the report does not mention.
- **`app/api/manufacturing/work-orders/[id]/route.ts:57`** — `postJournalWithBalanceUpdate` is a private
  reimplementation of `postJournalEntryInner`; account-type balance-direction logic exists in two places and
  can drift.

---

## Method lessons for future audits

1. **Grep importers before assigning severity.** Reachability flipped 5 of 8 verdicts. A critical bug in
   unreachable code is not a priority; it is cleanup.
2. **Do not treat `CLAUDE.md` as ground truth in either direction.** The audit inherited "WO GL is TBD"
   (false → R-18 dropped) and "the UI imports `finance.ts`" (true for AP payments, false for invoices →
   R-02 downgraded).
3. **Verify the schema exists before reporting a data-integrity defect** (R-03 referenced a model that was
   never migrated).
