# RELIABILITY REMEDIATION PLAN — Phase B

> **Status:** planning artifact. No application code, schema, or migration was modified to produce this
> document. Companion to `RELIABILITY_FINDINGS.md` (what is broken), `RELIABILITY_INVENTORY.md` (where),
> `FAILURE_MODES.md` (how it fails in production).
>
> **Scope rules that govern every item below** (from `CLAUDE.md`, non-negotiable):
> - **Ripple Check (5 phases)** is a hard gate for every change under `lib/actions/`, `app/actions/`, or any
>   shared helper. Every entry here pre-computes Phase 1 (duplicate scan) and Phase 2 (consumer trace).
> - **Finance guardrails**: `SYS_ACCOUNTS.*` only (never string literals), `TAX_RATES.*` only (never `0.11`),
>   `ensureSystemAccounts()` before posting, `isCOGSAccount()` for COGS classification.
> - **Canonical finance files**: `finance-ap.ts` / `finance-ar.ts` / `finance-gl.ts` / `finance-invoices.ts` /
>   `finance-reports.ts`. **Never add functions to `finance.ts`.**
> - **Multi-session safety**: no `git add .`, no `git checkout/restore/reset/stash` without confirmation,
>   `git diff <file>` before editing, and each session owns a **non-overlapping file scope**. The
>   parallelization plan in §7 is written to satisfy this.
> - **Testing standard**: `npx vitest` must pass before any item is considered complete.

---

## 0. Five facts discovered during planning that change the plan

These were verified by reading the code while sequencing this work. They amend the Phase A findings and are
load-bearing for the ordering.

**F-1 — `finance.ts` does not contain a *stale copy* of `postJournalEntry`; it contains a *hard fork with a
different signature*.**
`lib/actions/finance-gl.ts:309` is `postJournalEntry(data, txClient?)`. `lib/actions/finance.ts:338` is
`postJournalEntry(data)` — **no `txClient` parameter at all**, and its `data` type omits `invoiceId`,
`paymentId`, and `inventoryTransactionId` (`finance.ts:338-349` vs `finance-gl.ts:309-327`). It also returns
`{ success: true }` with **no `id`** (`finance.ts:437`).

Consequences:
1. You **cannot** fix R-01 Class A inside `finance.ts` by "threading the tx" — the parameter does not exist.
2. Every journal entry posted through the `finance.ts` fork is **created with `invoiceId = NULL`**, so the
   invoice→JE link that R-22's orphan check depends on is *already missing* for those flows. Consolidation is
   therefore not cosmetic governance — it is a prerequisite for detection to work at all.

**F-2 — the codebase already contains the correct consolidation mechanism.**
`lib/actions/finance.ts:2133-2136` is a thin delegating re-export:
```ts
export async function recordMultiBillPayment(...args: Parameters<typeof import("./finance-ap").recordMultiBillPayment>) {
    const { recordMultiBillPayment: fn } = await import("./finance-ap")
    return fn(...args)
}
```
This is `'use server'`-legal (async export), type-safe by construction, and requires **zero changes to the
20 UI import sites**. It is the proven, minimal, in-repo pattern for resolving R-01's governance problem.

**F-3 — threading `tx` into `postJournalEntry` silently disables the period lock.**
`finance-gl.ts:334-342`: when `txClient` is provided it calls `postJournalEntryInner` directly and **skips
`assertPeriodOpen(data.date)`** (only the standalone branch calls it, `:339`). The docstring says "caller is
responsible" (`finance-gl.ts:303-305`). **Every Class A fix must add an explicit `await assertPeriodOpen(date)`
inside the transaction**, or the atomicity fix will ship a fiscal-period-lock regression.

**F-4 — `postJournalEntry` returns `{success:false}`; it does not throw.**
Inside a transaction, a returned failure does **not** roll anything back. The correct pattern is already in
`finance-invoices.ts:1220-1222`:
```ts
if (!glResult?.success) {
    throw new Error(`GL posting failed: ${glResult?.error || 'Unknown error'}`)
}
```
Every Class A/B fix must pair `postJournalEntry(..., tx)` with this throw. Threading `tx` *without* the throw
produces a worse bug than today: a committed document with a silently skipped GL post.

**F-5 — R-03's NSFP feature does not exist in the database.**
`grep -in nsfp prisma/schema.prisma` → **zero matches**. `grep -rl NSFP prisma/migrations/` → **zero matches**.
Yet `lib/actions/finance-efaktur.ts:211,231,242` calls `tx.nSFPRange.*` and `:260` writes `invoice.nsfpNumber`.
There is no `NSFPRange` model and no `Invoice.nsfpNumber` column. This compiles only because
`next.config.ts:7-11` sets `ignoreBuildErrors: true` (R-23). At runtime `tx.nSFPRange` is `undefined` →
`TypeError`, wrapped by the action's `catch`.

Consequence: **R-03 is not currently a live duplicate-serial risk — it is a non-functional feature.** The fix
is therefore *cheaper and safer than rated* (add the model correctly, with `@unique` and atomic `{increment}`,
before anyone turns it on), but its priority moves from "Sev-1 emergency" to "Sev-1 blocker on the e-Faktur
feature launch." R-23 is what let this ship; that raises R-23's priority.

**Bonus (amends R-17):** `JournalEntry` has **no `number` field** (`prisma/schema.prisma:2272-2320`). The
generator at `finance-gl.ts:13-21` (`getNextJournalRef`, `count()+1`) produces `reference`, which is **not
`@unique`**. So JE reference collisions are real but low-harm (traceability confusion, not double-posting).

---

## 1. How to read each remediation entry

| Field | Meaning |
|-------|---------|
| **INVARIANT** | The precise property that must hold after the fix. This is the acceptance criterion. |
| **DIFF SKETCH** | Minimal surgical shape, before → after, at a verified `path:line`. Uses only patterns already proven in this repo. |
| **BLAST RADIUS** | Ripple Check phases 1–2 pre-computed: duplicates found, consumers to verify. |
| **TESTS** | Split into **[mock-OK]** (validatable under `test-setup.ts`'s `mockDeep<PrismaClient>()`) and **[real-DB REQUIRED]** (cannot be validated against a mock — see §1.1). |
| **VERIFY** | How to prove it worked, in this system. |
| **RISK / ROLLBACK** | Risk introduced *by the fix*, and how to undo it. |
| **EFFORT** | S ≤ half day · M ≈ 1–3 days · L ≈ 1–2 weeks |

### 1.1 The test-harness constraint (read before writing any test)

`test-setup.ts:7-10` does `vi.mock('./lib/prisma', () => ({ prisma: mockDeep<PrismaClient>() }))`.

Two hard limits follow:

1. **`mockDeep` cannot express a database.** It has no transactions, no constraints, no isolation, no row
   counts derived from real predicates. Therefore **none** of the following can be tested in the default
   harness: transaction rollback, `updateMany` returning `count: 0` because a `gte` guard failed, unique-
   constraint violations (P2002), CHECK constraints, concurrent interleaving, connection-pool behaviour.
2. **The mock does not even intercept the production path.** `lib/prisma.ts` is one line —
   `export { prisma } from "@/lib/db"` — while every server action goes through `withPrismaAuth()` in
   `lib/db.ts:39`, which closes over `basePrisma` (`lib/db.ts:29`) created inside `lib/db.ts`. Mocking
   `./lib/prisma` replaces the re-export, **not** `lib/db`'s internal reference. This is why all 56 existing
   test files (e.g. `__tests__/accounting-no-orphans.test.ts`, whose own header says *"These tests validate
   LOGIC ONLY (no database calls)"*) test extracted pure helpers.

**Therefore:** every atomicity, concurrency, constraint, and idempotency fix in this plan requires a
**real-Postgres integration harness** (item **T-1** in Milestone 1). Adding "a Vitest test" without it is
theatre. Where an entry says **[real-DB REQUIRED]**, a mocked test is not acceptable evidence.

The productive pattern for **[mock-OK]** tests, already used across `__tests__/`, is: **extract the decision
into a pure function, test the function exhaustively, and let the integration test cover the wiring.**

---

## 2. Sev-1 remediation entries

### R-01 · Non-atomic GL posting on live money flows (Class A + Class B), amplified by a duplicate live fork

**Restatement:** money-moving actions either open a second independent transaction for the GL post (Class A)
or post GL after the document transaction commits (Class B); and the live UI is wired to the non-atomic
`finance.ts` copies, so fixing the canonical files alone changes nothing in production.

This is split into four sub-items because they have different risk profiles and different owners.

---

#### R-01a · Governance: collapse `finance.ts` duplicates into delegating re-exports  ⟵ **do this first**

**INVARIANT:** *There is exactly one implementation of each finance server action in the repository. Every
`@/lib/actions/finance` import resolves, at runtime, to the canonical implementation in
`finance-gl.ts` / `finance-ap.ts` / `finance-ar.ts` / `finance-invoices.ts` / `finance-dcnotes.ts`. Ripple
Check Phase 1 (duplicate scan) returns zero duplicates for every finance action name.*

**DIFF SKETCH** — apply the F-2 pattern, once per forked function.

`lib/actions/finance.ts:338-443` (the `postJournalEntry` fork, ~105 lines):
```ts
// BEFORE — a second, forked implementation with NO txClient param and no invoiceId/paymentId link
export async function postJournalEntry(data: {
    description: string; date: Date; reference: string
    sourceDocumentType?: string
    lines: { accountCode: string; debit: number; credit: number; description?: string }[]
}) {
    /* ~100 lines duplicating finance-gl.ts, missing txClient + FK links */
}

// AFTER — delegate (same shape as the proven finance.ts:2133 wrapper)
export async function postJournalEntry(
    ...args: Parameters<typeof import("./finance-gl").postJournalEntry>
) {
    const { postJournalEntry: fn } = await import("./finance-gl")
    return fn(...args)
}
```

Repeat verbatim for, in this order (cheapest/lowest-risk first):

| `finance.ts` fork | Delegate to | Note |
|---|---|---|
| `postJournalEntry` (`:338`) | `finance-gl.ts:309` | **Do first** — unblocks every other fix; canonical is a strict superset (adds `txClient`, `invoiceId`, `paymentId`, `inventoryTransactionId`, returns `id`) |
| `recordVendorPayment` (`:2044`) | `finance-ap.ts:294` | Verify param shape parity before delegating |
| `approveAndPayBill` (`:2463`) | `finance-ap.ts:792` | " |
| `createInvoiceFromSalesOrder` (`:1376`) | `finance-invoices.ts:833` | Blocked on R-02 (canonical must be atomic first) |
| `createCreditNote` (`:3700`) | `finance-dcnotes.ts` | Also fixes R-30's client-supplied-accountId defect |
| `recordMultiBillPayment` (`:2133`) | `finance-ap.ts:491` | **already delegated** — reference implementation |

Before delegating each one, diff the two signatures. Where they differ, **widen the canonical** (add an
optional param) rather than narrowing it; never change the exported `finance.ts` signature, or the 20 UI
call sites break.

**BLAST RADIUS** — Ripple Check Phase 2, `grep -rn "from ['\"]@/lib/actions/finance['\"]"`, **20 sites**:

*Mutating (must be re-tested by hand):*
- `app/finance/bills/page.tsx:48` — `disputeBill`, `recordMultiBillPayment`
- `app/finance/vendor-payments/page.tsx:30` — `recordVendorPayment`
- `app/finance/journal/new/page.tsx:28` — `postJournalEntry`
- `app/finance/expenses/page.tsx:25` — `recordExpense`
- `components/finance/vendor-multi-payment-dialog.tsx:34` — `recordMultiBillPayment`
- `components/finance/accounting-module-actions.tsx:18` — `postJournalEntry`, `recordVendorPayment`, `createGLAccount`, `getGLAccountsList`, `getVendorBills`
- `components/finance/journal/create-journal-dialog.tsx:29` — `postJournalEntry`
- `components/finance/nota-kredit-tab.tsx:17` — `createCreditNote`
- `components/finance/nota-debit-tab.tsx:15` — `createDebitNote`
- `lib/actions/sales.ts:200` — `postJournalEntry` (**server-to-server**; feeds R-01c)
- `lib/actions/sales.ts:1110` — `createInvoiceFromSalesOrder` (**server-to-server**; feeds R-02)

*Read-only (regression-check only):* `hooks/use-nav-prefetch.ts:15`, `hooks/use-expenses.ts:5`,
`hooks/use-finance-reports.ts:13-14`, `app/actions/dashboard.ts:4`,
`app/finance/receivables/receivables-client.tsx:12`, `app/finance/payables/page.tsx:2`,
`app/finance/payables/payables-client.tsx:13`, `app/accountant/coa/page.tsx:5`.

**TESTS**
- **[mock-OK]** `__tests__/finance-action-canonicality.test.ts` — a *governance* test, not a behaviour test:
  read `lib/actions/finance.ts` as text and assert every exported `async function` body matches the
  delegation shape (`await import("./finance-`) or is on an explicit allowlist. This makes the CLAUDE.md rule
  mechanically enforced instead of aspirational, and it is the one thing that keeps R-01 from regressing.
- **[mock-OK]** signature-parity assertions: `expectTypeOf<Parameters<typeof financeFork>>().toMatchTypeOf<Parameters<typeof canonical>>()`.
- **[real-DB REQUIRED]** after delegating `postJournalEntry`: post a JE from `/finance/journal/new` and assert
  the created `JournalEntry` row now carries `invoiceId`/`paymentId` when supplied (the fork silently dropped
  them — this is a *behaviour improvement* that must be confirmed, not assumed).

**VERIFY**
1. `grep -c "await import(\"./finance-" lib/actions/finance.ts` increases by the number of functions collapsed.
2. `npm run lint && npx vitest` green.
3. Manual smoke on all 11 mutating call sites above; after each, query `journal_entries` and confirm one
   balanced `POSTED` entry with the correct FK link.

**RISK / ROLLBACK** — Medium. The two implementations are not byte-identical: the canonical
`postJournalEntry` **adds** a control-account guard path and FK links; the fork **adds** a best-effort
`logAudit` call (`finance.ts:404-415`) that the canonical lacks. Before deleting the fork, port that
`logAudit` into `postJournalEntryInner` (or accept the audit-trail gap and record it under R-31).
Rollback: `git revert` the single commit — the change is additive-and-delete within one file, and no consumer
signature changed. Ship each delegation as its **own commit** so a single one can be reverted alone.

**EFFORT:** M (postJournalEntry alone: S)

---

#### R-01b · Class A: thread `tx` into every nested `postJournalEntry`

**INVARIANT:** *For every financial document write, the document row change, the `JournalEntry` + `JournalLine`
inserts, and the `GLAccount.balance` increments all commit or abort as a single Postgres transaction. No code
path opens a second pooled connection to post GL while an outer transaction is open.*

**DIFF SKETCH** — canonical shape, from `finance-invoices.ts:1189-1223` (already correct):

```ts
// BEFORE — lib/actions/finance.ts:2109-2122 (recordVendorPayment), inside withPrismaAuth(async (prisma) => {
await ensureSystemAccounts()
const glResult = await postJournalEntry({
    description: `Pembayaran Vendor ${paymentNumber}`,
    date: new Date(),
    reference: paymentNumber,
    lines: [
        { accountCode: SYS_ACCOUNTS.AP,  debit: data.amount, credit: 0, description: 'Pelunasan Hutang Usaha' },
        { accountCode: bankCode,         debit: 0, credit: data.amount, description: bankAccountName },
    ],
})                                   // ← no tx: opens a SECOND transaction on a SECOND pooled connection
if (!glResult?.success) { throw new Error(...) }   // throw is already correct here

// AFTER
await ensureSystemAccounts()
await assertPeriodOpen(paymentDate)  // ← REQUIRED (F-3): the tx branch of postJournalEntry skips this
const glResult = await postJournalEntry({
    /* …identical payload…, plus: */
    paymentId: payment.id,           // ← restore the FK link the fork dropped (F-1) — R-22 depends on it
}, prisma)                           // ← prisma here IS the tx client from withPrismaAuth
if (!glResult?.success) {
    throw new Error(`GL posting failed: ${glResult?.error || 'Unknown error'}`)   // F-4
}
```

Apply the identical three-part edit (`assertPeriodOpen` + `, tx` + throw-on-failure) at every Class A site:

| Site | File:Line | Owner scope |
|---|---|---|
| `recordVendorPayment` | `finance-ap.ts:294` (canonical) + `finance.ts:2110` (until R-01a lands) | Finance/backend |
| `recordMultiBillPayment` | `finance-ap.ts:491` | Finance/backend |
| `approveAndPayBill` (2 nested GL posts) | `finance-ap.ts:792`, sites ~`:871`/`:906` | Finance/backend |
| `postDepreciationRun` | `finance-fixed-assets.ts:888` — **nested inside a `for` loop**; N independent txns | Finance/backend |
| `createAssetMovement` | `finance-fixed-assets.ts:1213` | Finance/backend |
| `postPPNSettlement` | `finance-gl.ts:1999` | Finance/backend |
| `closeReconciliation` | `finance-reconciliation.ts:1749`, `:1764` | Finance/backend |
| payroll disburse / `approvePayrollRun` | `app/actions/hcm.ts:1610`, `:1835` | HCM |

`postDepreciationRun` is the worst offender and deserves its own commit: the loop must be hoisted so the run
header, all N `FixedAssetDeprecEntry` rows, and all N journal entries share one `tx`. If N is large enough to
approach the 20s `timeout` (`lib/db.ts:66`), chunk by asset batch and make each **batch** atomic + idempotent
(a partially-completed depreciation run must be resumable, not re-postable) — do not weaken atomicity to fit
the timeout.

**BLAST RADIUS**
- Phase 1 duplicates: `recordVendorPayment` / `approveAndPayBill` exist twice until R-01a lands. **This is
  exactly why R-01a must precede R-01b.**
- Phase 3 GL impact: `SYS_ACCOUNTS.AP`, `.BANK_*`, `.PPN_MASUKAN`/`.PPN_KELUARAN`, PPh liability accounts,
  accumulated-depreciation + depreciation-expense accounts. Reports affected: Neraca, Laba Rugi, Arus Kas,
  Neraca Saldo, AP Aging.
- Phase 5 consumers: the 11 mutating sites in R-01a, plus `app/hcm/payroll/**` for the HCM sites.

**TESTS**
- **[mock-OK]** extract each flow's line-construction into a pure `buildXxxGLLines(input)` helper and assert:
  balanced (`Σdebit === Σcredit`), correct debit/credit direction per account type, DPP vs PPN separation
  (`TAX_RATES.PPN`), and zero-amount / PPN-disabled edge cases. This mirrors `__tests__/wht-vendor-payment.test.ts`.
- **[real-DB REQUIRED]** the actual invariant: inject a failure *after* the GL post but *before* the
  transaction returns, then assert **zero** `journal_entries` rows and an unchanged document status. A mock
  cannot express this — there is no transaction to roll back.
- **[real-DB REQUIRED]** connection-count assertion for `postDepreciationRun`: run against a pool of 2 and
  confirm it completes (today, N nested transactions deadlock).

**VERIFY** Run `/api/admin/integrity-check` (R-22) before and after a vendor payment: trial balance stays
balanced, orphan-JE count stays 0, `GLAccount.balance` equals the sum of its posted lines. Then force a GL
failure (temporarily point one line at a non-existent account code) and confirm the payment row does **not**
exist afterwards.

**RISK / ROLLBACK** — **High. This is the deep surgery.** Three specific hazards, each already seen in F-3/F-4:
(1) forgetting `assertPeriodOpen` → silent fiscal-lock bypass; (2) forgetting the throw → a *worse* silent
failure than today; (3) longer-held transactions → more timeout pressure until R-05 lands. Mitigate by fixing
**one flow per PR**, each with its integration test. Rollback: per-flow revert.

**EFFORT:** L

---

#### R-01c · Class B: wrap "commit-then-post-GL" flows in one transaction

**INVARIANT:** *No financial document is committed before its journal entry. The GL post happens inside the
same `$transaction` as the document write, or the document write does not happen.*

**DIFF SKETCH** — `lib/actions/sales.ts:1386-1420` (`createSalesReturn`, **LIVE**, wired to
`components/.../sales-return-dialog.tsx:177`). This one diff also closes R-30:

```ts
// BEFORE
const result = await withPrismaAuth(async (tx) => { /* …credit note + invoice + settlement… */ })
// 9. Post GL entry outside transaction        ← the bug, verbatim comment at sales.ts:1388
const ppn = Math.round(subtotal * 0.11)        // ← R-30: hardcoded rate
await ensureSystemAccounts()
await postJournalEntry({
    lines: [{ accountCode: '4010', /* ← R-30: hardcoded code */ … }, …],
})                                             // ← no tx, no success check, no rollback

// AFTER — move the whole block inside, mirroring finance-invoices.ts:1189
const result = await withPrismaAuth(async (tx) => {
    /* …credit note + invoice + settlement (unchanged)… */
    const ppn = Math.round(subtotal * TAX_RATES.PPN)              // lib/tax-rates.ts
    await ensureSystemAccounts()
    await assertPeriodOpen(returnDate)                            // F-3
    const glResult = await postJournalEntry({
        description: `Retur Penjualan ${creditNote.number}`,
        date: returnDate,
        reference: creditNote.number,
        lines: [
            { accountCode: SYS_ACCOUNTS.SALES_RETURN, debit: subtotal, credit: 0, … },  // add to gl-accounts.ts
            { accountCode: SYS_ACCOUNTS.PPN_KELUARAN, debit: ppn,      credit: 0, … },
            { accountCode: SYS_ACCOUNTS.AR,           debit: 0, credit: subtotal + ppn, … },
        ],
    }, tx)
    if (!glResult?.success) throw new Error(`GL posting failed: ${glResult?.error}`)     // F-4
    return { creditNoteId: creditNote.id, creditNoteNumber: creditNote.number }
})
```

Adding `SYS_ACCOUNTS.SALES_RETURN = "4010"` requires the full 4-step protocol from CLAUDE.md: constant in
`lib/gl-accounts.ts`, entry in `ensureSystemAccounts()`, referenced via the constant, and seeded in
`prisma/seed-gl.ts`.

Same treatment for:
- `lib/actions/finance-wip.ts:117` `postWIPAdjustment` — **no transaction wrapper at all**: GL posts, then a
  `for` loop of `prisma.workOrder.update` (`:126+`). Wrap the whole function in `withPrismaAuth` and thread `tx`.
- `lib/actions/finance-pph.ts:120` `markWithholdingDeposited` — GL posts (`:120`), then
  `withholdingTax.updateMany` (`:132`). If the updateMany fails, the deposit is recorded in the GL but the
  records stay undeposited → **double deposit on retry**. Wrap + thread.
- `lib/actions/sales.ts:279` `approveInvoice`, `:361` `recordPayment` — findings mark these "High (dead?)".
  **Determine liveness first** (`grep -rn "approveInvoice\|recordPayment" app components`). If dead, delete
  them (that is the smaller, safer diff and also removes R-30's `'1110'`/`'1101'` at `sales.ts:357-358`); if
  live, wrap them.

**BLAST RADIUS** `components/sales/sales-return-dialog.tsx:177`; WIP consumers under `app/manufacturing/**` and
`components/manufacturing/**`; PPh consumers under `app/finance/**` (`grep -rn "markWithholdingDeposited"`).
Note `lib/actions/sales.ts` is imported very widely — confine edits to these functions and coordinate with the
Sales session (§7).

**TESTS**
- **[mock-OK]** `buildSalesReturnGLLines()` pure helper: balanced, uses `TAX_RATES.PPN`, contra-revenue on the
  debit side, credits AR for the gross. Extend `__tests__/pph-integration.test.ts` for the PPh line shape.
- **[real-DB REQUIRED]** fail the GL post → assert **no** credit note row exists and the invoice's `balanceDue`
  is unchanged. This is the precise regression `FINANCE_BUGS_20260315.md` describes.

**VERIFY** Issue a sales return, then run R-22's orphan check: every non-DRAFT `DebitCreditNote` has ≥1 linked
`POSTED` `JournalEntry`. Confirm Laba Rugi shows the contra-revenue and Neraca still balances.

**RISK / ROLLBACK** — Medium-High. Moving the GL post inside the transaction lengthens it; if
`ensureSystemAccounts()` performs upserts it now runs inside the tx (acceptable — `grn.ts:acceptGRN` and
`finance-invoices.ts` already do this). Rollback per-function revert. Risk of *not* fixing: this is the
single most user-visible corruption path, on a live UI button.

**EFFORT:** M

---

#### R-01d · Governance guard so R-01 cannot regress

**INVARIANT:** *A new `postJournalEntry(...)` call inside a `withPrismaAuth`/`$transaction` callback that omits
the tx client fails CI.*

**DIFF SKETCH** — a lint-shaped Vitest, not a new framework:
```ts
// __tests__/gl-atomicity-guard.test.ts   [mock-OK] — static text analysis, no DB
const files = globSync('lib/actions/**/*.ts', ...).concat(globSync('app/actions/**/*.ts', ...))
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // every postJournalEntry({...}) must close with `}, tx)` / `}, prisma)` — or be on the allowlist
  const bare = [...src.matchAll(/postJournalEntry\(\{[\s\S]*?\n\s*\}\)/g)]
  expect(bare.map(m => `${f}`), 'un-threaded postJournalEntry').toEqual([])
}
```
Seed the allowlist with today's known-bare sites and **shrink it to zero** as R-01b/R-01c land. A shrinking
allowlist is the progress metric for the whole R-01 effort.

**BLAST RADIUS** none (test-only).  **TESTS** is the test.
**VERIFY** the allowlist length monotonically decreases per PR.
**RISK** false positives on unusual formatting → keep the allowlist explicit and reviewed.
**EFFORT:** S

---

### R-02 · `createInvoiceFromSalesOrder` returns `success:true` when GL posting fails

**INVARIANT:** *`createInvoiceFromSalesOrder` returns `{success:true}` if and only if both the `Invoice` row and
a balanced `POSTED` `JournalEntry` linked to it (`journal_entries.invoice_id = invoice.id`) exist and are
committed. On any GL failure the invoice must not exist.*

**DIFF SKETCH** — `lib/actions/finance.ts:1495-1543` (verified verbatim):
```ts
// BEFORE
try {
    const arAccount      = await prisma.gLAccount.findFirst({ where: { code: '1200' } })  // ← hardcoded (R-30)
    const revenueAccount = await prisma.gLAccount.findFirst({ where: { code: '4000' } })  // ← hardcoded (R-30)
    if (arAccount && revenueAccount) {
        const glResult = await postJournalEntry({ … })            // ← no tx, no invoiceId
        if (!glResult?.success) { console.error("GL posting failed:", glResult?.error) }   // ← only logs
    } else {
        console.warn("GL Accounts not found - skipping auto-posting")   // ← silently skips the books
    }
} catch (glError) {
    console.error("Failed to post GL entry (invoice still created):", glError)   // ← swallows
}
return { success: true, invoiceId: invoice.id, invoiceNumber: invoice.number }   // ← ALWAYS true

// AFTER
await ensureSystemAccounts()                 // guarantees AR/Revenue exist — deletes the "skipping" branch
await assertPeriodOpen(issueDate)            // F-3
const glResult = await postJournalEntry({
    description: `Customer Invoice ${invoice.number} - ${salesOrder.customer?.name}${glCurrencyNote}`,
    date: issueDate,
    reference: invoice.number,
    invoiceId: invoice.id,                   // ← FK link (F-1); required by R-22
    lines: [
        { accountCode: SYS_ACCOUNTS.AR,      debit: glAmount, credit: 0, … },
        { accountCode: SYS_ACCOUNTS.REVENUE, debit: 0, credit: glAmount, … },
    ],
}, prisma)                                   // ← tx client from the enclosing withPrismaAuth
if (!glResult?.success) {
    throw new Error(`GL posting failed: ${glResult?.error || 'Unknown error'}`)   // rolls the invoice back
}
```
Note the current lines credit the **gross** `glAmount` to revenue with no PPN split — if this SO path can carry
PPN, the DPP/PPN separation from `finance-invoices.ts:1181-1188` must be ported too (Layer-3 of the audit
checklist). Confirm with the Sales owner before shipping.

**Sequencing note:** fix the **canonical** `finance-invoices.ts:833` first, then make `finance.ts:1376` a
delegating re-export (R-01a). Do not fix `finance.ts:1376` in place — that entrenches the fork.

**BLAST RADIUS** `lib/actions/sales.ts:1110` (server-to-server) and any UI reachable from it; plus the
`finance-invoices.ts` consumers (`grep -rn "createInvoiceFromSalesOrder" app components lib`).

**TESTS**
- **[mock-OK]** pure `buildInvoiceFromSOGLLines(so)`: balanced, `SYS_ACCOUNTS.*` only, DPP/PPN split correct,
  zero-amount SO rejected.
- **[real-DB REQUIRED]** GL failure ⇒ **no invoice row** and `{success:false}`. This is the entire finding;
  it is unprovable under `mockDeep`.

**VERIFY** Create an invoice from an SO; assert exactly one balanced `POSTED` JE with `invoiceId` set, AR
aging reflects it, and Laba Rugi revenue moves by the DPP. Then break the revenue account code and confirm the
invoice does not appear in `/finance/invoices`.

**RISK / ROLLBACK** — Medium. Users who previously got a (broken) invoice will now get an error. That is the
point, but it is a visible behaviour change — ship with a clear Bahasa error message
(`"Faktur dibatalkan: jurnal gagal diposting"`). Rollback: single-function revert.

**EFFORT:** M

---

### R-03 · NSFP e-Faktur serial: non-atomic counter, no unique constraint — **and no schema at all** (F-5)

**INVARIANT:** *Two concurrent `assignNSFP` calls never produce the same `nsfpNumber`. Enforced twice: an
atomic `{increment}` on the range counter (no read-modify-write window) **and** a database `UNIQUE` constraint
on `Invoice.nsfpNumber` as the backstop. A counter increment and its invoice assignment commit together.*

**DIFF SKETCH** — two parts, in this order.

*(a) Schema first (does not exist today — F-5):*
```prisma
model NSFPRange {
  id             String       @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  year           Int
  startNumber    BigInt
  endNumber      BigInt
  currentCounter BigInt       @default(0)
  status         NSFPStatus   @default(ACTIVE)
  @@index([year, status])
  @@map("nsfp_ranges")
}
// Invoice:
  nsfpNumber     String?      @unique      // ← the backstop R-03 asks for
  kodeTransaksi  String?
```

*(b) Then make the counter atomic — `lib/actions/finance-efaktur.ts:226-247`:*
```ts
// BEFORE  (the comment says "atomically"; the code is a read-modify-write)
const nextCounter = range.currentCounter + BigInt(1)          // :227 — in memory
if (nextCounter > range.endNumber) { …exhaust… }
await tx.nSFPRange.update({ where: { id: range.id }, data: { currentCounter: nextCounter } })  // :242

// AFTER — let Postgres serialize the increment, then validate the value it returned
const bumped = await tx.nSFPRange.update({
    where: { id: range.id, currentCounter: { lt: range.endNumber } },   // guard inside the write
    data:  { currentCounter: { increment: 1 } },                        // atomic
})
const nextCounter = bumped.currentCounter          // authoritative, per-transaction unique
if (nextCounter >= bumped.endNumber) {
    await tx.nSFPRange.update({ where: { id: range.id }, data: { status: 'EXHAUSTED' } })
}
```
`getNextDocNumber` (`lib/document-numbering.ts:19-29`) is the proven in-repo shape for exactly this
(`upsert` + `{ increment: 1 }` on a unique key) — mirror its structure and its docstring.

**BLAST RADIUS** `lib/actions/finance-efaktur.ts` (`assignNSFP` `:167`, bulk `:282`, ranges `:371`/`:410`);
`components/finance/efaktur-export-dialog.tsx:19` (currently type-only). A migration touching `Invoice` ripples
to every finance read — coordinate with whoever owns `prisma/schema.prisma` this cycle (**serialize**, §7).

**TESTS**
- **[mock-OK]** `__tests__/efaktur-helpers.test.ts` already exists — extend for the 17-digit format
  (`kodeTransaksi(2) + kodeStatus(2) + serial(13)`, `finance-efaktur.ts:253-254`), range-exhaustion boundary
  (`nextCounter === endNumber`), and the `EXHAUSTED` transition.
- **[real-DB REQUIRED]** the actual finding: fire 50 concurrent `assignNSFP` calls against one range and assert
  50 distinct serials, zero gaps, and that a deliberate duplicate insert raises P2002. Impossible under a mock.

**VERIFY** After migrating, `SELECT nsfpNumber, COUNT(*) FROM invoices WHERE nsfpNumber IS NOT NULL GROUP BY 1
HAVING COUNT(*) > 1` returns zero rows, and the unique index exists in `pg_indexes`.

**RISK / ROLLBACK** — Low-Medium, *because the feature is currently non-functional* (F-5) — there is no legacy
data to migrate and no user depending on today's behaviour. The real risk is the opposite: **do not enable the
e-Faktur UI before this lands**, or the first concurrent issuance produces duplicate legal serials.
Rollback: drop the migration (no data to preserve).

**EFFORT:** M

---

### R-04 · Unguarded stock decrements → negative stock

**INVARIANT:** *`stock_levels.quantity`, `.reservedQty`, and `.availableQty` are never negative. Every decrement
is a single atomic statement whose `WHERE` clause contains the sufficiency predicate, and a `count === 0`
result raises a user-facing error. A database CHECK constraint backstops the application logic.*

**DIFF SKETCH** — the correct pattern is already in this repo at `app/actions/inventory.ts:1386-1401` and
`lib/actions/stock-transfers.ts:253-266`:

```ts
// BEFORE — app/api/manufacturing/work-orders/[id]/route.ts:175-191 (TOCTOU)
const sourceLevel = await tx.stockLevel.findFirst({ where: { productId, warehouseId } })
if (!sourceLevel || Number(sourceLevel.quantity) < requiredQty) throw new Error(`Insufficient stock…`)
const releaseFromReserved  = Math.min(requiredQty, Number(sourceLevel.reservedQty))
const releaseFromAvailable = requiredQty - releaseFromReserved
await tx.stockLevel.update({                          // ← plain update; the check above is already stale
    where: { id: sourceLevel.id },
    data: { quantity: { decrement: requiredQty },
            reservedQty:  { decrement: releaseFromReserved },
            availableQty: { decrement: releaseFromAvailable } },
})

// AFTER — predicate and mutation in one statement
const updated = await tx.stockLevel.updateMany({
    where: {
        id: sourceLevel.id,
        quantity:     { gte: requiredQty },
        reservedQty:  { gte: releaseFromReserved },
        availableQty: { gte: releaseFromAvailable },
    },
    data: { quantity: { decrement: requiredQty },
            reservedQty:  { decrement: releaseFromReserved },
            availableQty: { decrement: releaseFromAvailable } },
})
if (updated.count === 0) {
    throw new Error(`Stok tidak mencukupi untuk ${item.material.code}. Coba muat ulang halaman.`)
}
```
Keep the `findFirst` for computing the reserved/available split, but treat it as a *hint*: the `updateMany`
guard is what makes it safe.

Same edit at:
- `lib/actions/subcontract.ts:852-860` — currently `findFirst` → plain `update` with **no quantity check at all**
  (worse than TOCTOU). Also note `if (stockLevel)` silently skips the decrement when the row is missing —
  make that an error.
- `lib/actions/stock-reservations.ts:155-165` (reserve, `delta` path) and `:252-258` (consume) — guard
  `availableQty: { gte: delta }` when `delta > 0`.

Plus a DB backstop migration (also covers R-13):
```sql
ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_qty_nonneg      CHECK (quantity     >= 0);
ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_reserved_nonneg CHECK ("reservedQty"  >= 0);
ALTER TABLE stock_levels ADD CONSTRAINT stock_levels_available_nonneg CHECK ("availableQty" >= 0);
```
**Run the pre-check first** — `SELECT * FROM stock_levels WHERE quantity < 0 OR "reservedQty" < 0 OR
"availableQty" < 0` — and reconcile any rows before adding the constraint, or the migration aborts mid-deploy
(the exact failure mode as R-26).

**BLAST RADIUS** `app/api/manufacturing/work-orders/[id]/route.ts` (WO start/consume — check
`components/manufacturing/orders/**`); `lib/actions/subcontract.ts` (`app/subcontract/**`);
`lib/actions/stock-reservations.ts` (imported by WO creation and manufacturing planning — trace with
`grep -rn "stock-reservations"`). The CHECK constraint ripples to **every** stock writer in the system, which
is the point — but it means any *existing* path that quietly went negative will now throw. Run the pre-check
query in production before deploying.

**TESTS**
- **[mock-OK]** `__tests__/reservation-helpers.test.ts` and `negative-stock-policy.test.ts` already exist —
  extend for the reserve/release `delta` arithmetic and the "insufficient" decision boundary.
- **[real-DB REQUIRED]** the finding itself: two concurrent WO starts against 10 units each requesting 8 →
  exactly one succeeds, one gets "Stok tidak mencukupi", final quantity is 2. **`mockDeep` cannot return a
  `count` derived from a real `gte` predicate**, so a mocked version of this test proves nothing.
- **[real-DB REQUIRED]** CHECK constraint rejects a direct negative-setting UPDATE.

**VERIFY** `SELECT COUNT(*) FROM stock_levels WHERE quantity < 0` = 0, permanently, enforced by the constraint.
R-22's stock-ledger reconciliation check stays green.

**RISK / ROLLBACK** — Medium. Operations that "worked" by going negative now fail loudly; expect user reports
that are actually pre-existing data problems surfacing. Stage: ship the `updateMany` guards first, observe for
a week, then add the CHECK constraint. Rollback: `DROP CONSTRAINT` (instant, non-destructive); code revert per file.

**EFFORT:** M

---

### R-05 · Connection-exhaustion design

**INVARIANT:** *A read-only request never holds an interactive Postgres transaction. Per-instance
`connection_limit` × expected concurrent instances stays below the pooler ceiling. No request can hold a
connection past a bounded `maxDuration`.*

**DIFF SKETCH** — three independent, separately-revertable changes.

*(a) Stop wrapping reads in interactive transactions — `lib/db.ts:39-70`.* Add a sibling; do not change
`withPrismaAuth`'s semantics (26 files use `$transaction`, dozens more use `withPrismaAuth`):
```ts
/** Read-only variant: authenticates, then runs against the pooled client WITHOUT opening
 *  an interactive transaction. Use for every function that only performs SELECTs. */
export async function withPrismaRead<T>(operation: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { data: { user }, error } = await withTimeout(supabase.auth.getUser(), 5000)  // ← also fixes R-27
    if (error || !user) throw new Error('Not authenticated')
    return withRetry(() => operation(basePrisma))     // no $transaction
}
```
Then migrate read functions incrementally, **highest-fan-out first**: `app/api/dashboard/route.ts` (~40
queries), `app/api/finance/reports/route.ts` (24 queries), then the `get*` functions in `procurement.ts` /
`sales.ts` / `inventory.ts`. This is a long tail — do it as a background stream, not a blocking PR.

*(b) Reconcile the pool arithmetic — `lib/db.ts:13-22`.* The comment says *"We use 5 per Prisma instance"*
(`:14-15`); the code appends `connection_limit=10` (`:22`). Pick one, justify it in the comment with the real
pooler ceiling, and make it env-driven:
```ts
const limit = process.env.PRISMA_CONNECTION_LIMIT ?? '5'
return `${url}${separator}connection_limit=${limit}`
```

*(c) Bound every route.* Add `export const maxDuration = 30` (10 for light reads) to API routes — start with
`app/api/dashboard/route.ts`, `app/api/finance/reports/route.ts`, `app/api/cache-warm/route.ts`, and the
Xendit routes.

**BLAST RADIUS** `lib/db.ts` is the single highest-fan-out file in the repo. **Treat it as an exclusive lock:
one session, one PR, no concurrent edits** (CLAUDE.md multi-session rule). Adding `withPrismaRead` is purely
additive and safe; *migrating callers to it* is where the risk is, and that must be per-module PRs owned by
each module's session.

**TESTS**
- **[mock-OK]** `withPrismaRead` rejects when `getUser` returns no user; the 5s timeout path returns/throws.
- **[real-DB REQUIRED]** load test: N concurrent dashboard requests against `connection_limit=2` complete
  instead of timing out. Concurrency and pool behaviour are exactly what a mock erases.

**VERIFY** `pg_stat_activity` connection count under synthetic load, before vs after. P95 latency on
`/api/dashboard`. Zero `P2024` (pool timeout) in logs over a week (needs R-21 to be observable).

**RISK / ROLLBACK** — Medium. Reads leaving the transaction lose snapshot consistency across a multi-query
handler: a report could read AR at T1 and AP at T2. **For report endpoints that must be internally consistent
(Neraca, Neraca Saldo, Laba Rugi), keep the transaction** and accept the connection cost — correctness beats
throughput in an accounting system. Rollback: each migrated function reverts independently to `withPrismaAuth`.

**EFFORT:** L (the primitive is S; the migration is the L)

---

### R-06 · Dashboard renders a fully-zeroed, HTTP-200 "healthy" state on DB outage

**INVARIANT:** *A response never represents "failed to load" as "loaded, value is zero." Every aggregate
carries an explicit load status, and the UI renders failure as failure.*

**DIFF SKETCH** — `app/api/dashboard/route.ts:313-340` and the outer `catch` at `:391-398`:
```ts
// BEFORE
const [financials, …] = await Promise.all([
    withTimeout(getDashboardFinancials().catch(e => { console.error(…); return FALLBACK_FINANCIALS }), 4000, …),
    …
])
…
} catch (error) {
    return NextResponse.json({ financials: FALLBACK_FINANCIALS, … })   // 200 OK, all zeros
}

// AFTER — keep partial degradation, but label it
const settled = await Promise.allSettled([...])
const sections = Object.fromEntries(NAMES.map((name, i) => {
    const r = settled[i]
    return [name, r.status === 'fulfilled'
        ? { status: 'ok'     as const, data: r.value }
        : { status: 'failed' as const, data: FALLBACK[name], error: String(r.reason?.message ?? r.reason) }]
}))
const anyFailed = Object.values(sections).some(s => s.status === 'failed')
return NextResponse.json({ ...sections, degraded: anyFailed }, { status: anyFailed ? 207 : 200 })
```
Consumers render a per-card "Gagal memuat data — Coba lagi" state instead of `Rp 0`. Note the existing
"enhance with direct fallback if zero" logic (`:346-374`) is a *symptom* of this design — once sections are
labelled, that heuristic can be deleted, which is a real simplification.

**BLAST RADIUS** `app/api/dashboard/route.ts`, `app/actions/dashboard.ts:1082-1095`/`:1206-1220`, and every
dashboard consumer: `components/dashboard/**` (~40 widgets), `app/dashboard/page.tsx`, `components/manager/**`,
`components/accountant/**`. **This is a wide-but-shallow change** — best done by the Dashboard session in one
PR, since the response shape changes for every widget at once.

**TESTS**
- **[mock-OK]** given a mix of resolved/rejected section promises, the builder emits the right per-section
  `status`, the right `degraded` flag, and HTTP 207 — a pure function over `Promise.allSettled` results.
- Integration optional (a mocked rejection is sufficient here; no DB semantics involved).

**VERIFY** Point `DATABASE_URL` at a dead host in a preview env: the dashboard must show error cards, not
`Rp 0`. This is the acceptance test the finding is really asking for.

**RISK / ROLLBACK** — Medium (wide UI surface, low logical depth). Revert = one commit; but do **not** ship the
API change without the widget changes, or every card renders `undefined`. Single atomic PR.

**EFFORT:** M

---

### R-07 · Xendit webhook: non-atomic idempotency, no GL, swallows errors then returns 200

**INVARIANT:** *Processing a given `(provider, eventId)` exactly once is enforced by a unique database
constraint, not a string scan. The idempotency row, the invoice status change, the payment update, and the
journal entry commit in a single transaction. Any unhandled failure returns a non-2xx so the provider retries.*

**DIFF SKETCH** — infrastructure first, then the handler.

*(a) Table (Milestone 2):*
```prisma
model ProcessedWebhookEvent {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  provider    String                       // "xendit"
  eventId     String                       // payload.id
  eventStatus String                       // SUCCEEDED | FAILED | VOIDED …
  payloadHash String?
  processedAt DateTime @default(now())
  @@unique([provider, eventId, eventStatus])   // ← the idempotency key
  @@map("processed_webhook_events")
}
```

*(b) Handler — `app/api/xendit/webhook/route.ts:44-148`:*
```ts
// BEFORE
const payment = await prisma.payment.findFirst({ where: { reference: reference_id } })   // :44, not unique
const statusMarker = `[Xendit:${status}:${id}]`
if (payment.notes?.includes(statusMarker)) return NextResponse.json({ received: true, duplicate: true })  // :50-55
switch (status) {
  case 'SUCCEEDED':
    await prisma.invoice.update({ where: { id: payment.invoiceId }, data: { status: 'PAID', balanceDue: 0 } })  // separate write
    await prisma.payment.update({ where: { id: payment.id }, data: { notes: … } })                              // separate write
    break                                                     // ← no postJournalEntry anywhere
}
} catch (dbError) { console.error(…) }                        // :130-133 swallowed
return NextResponse.json({ received: true, … })               // :136-140 always 200 → Xendit never retries

// AFTER
try {
  await withPrismaAuth(async (tx) => {
    // 1. Claim the event — unique violation IS the duplicate check, atomically
    try {
      await tx.processedWebhookEvent.create({ data: { provider: 'xendit', eventId: id, eventStatus: status } })
    } catch (e) {
      if (e.code === 'P2002') return { duplicate: true }      // already processed — safe no-op
      throw e
    }
    // 2. State change + GL, same transaction
    const payment = await tx.payment.findFirstOrThrow({ where: { reference: reference_id }, include: { invoice: true } })
    if (status === 'SUCCEEDED' && payment.invoiceId) {
      const inv = payment.invoice!
      const newBalance = Math.max(0, Number(inv.balanceDue) - Number(payment.amount))   // ← never blanket-zero
      await tx.invoice.update({
        where: { id: payment.invoiceId },
        data: { balanceDue: newBalance, status: newBalance === 0 ? 'PAID' : 'PARTIAL' },
      })
      await ensureSystemAccounts()
      await assertPeriodOpen(new Date())
      const gl = await postJournalEntry({
        description: `Pembayaran Xendit ${payment.number}`, date: new Date(), reference: payment.number,
        invoiceId: payment.invoiceId, paymentId: payment.id,
        lines: [ { accountCode: SYS_ACCOUNTS.BANK_BCA, debit: Number(payment.amount), credit: 0 },
                 { accountCode: SYS_ACCOUNTS.AR,       debit: 0, credit: Number(payment.amount) } ],
      }, tx)
      if (!gl?.success) throw new Error(`GL posting failed: ${gl?.error}`)
    }
    return { duplicate: false }
  })
  return NextResponse.json({ received: true })
} catch (err) {
  console.error('[xendit-webhook] processing failed', err)
  return NextResponse.json({ error: 'processing failed' }, { status: 500 })   // ← let Xendit retry
}
```
Two supporting changes: add `@@unique` (or `@@index`) on `Payment.reference` so `findFirst` can't match the
wrong row (`:44`), and verify the Xendit callback-token signature before any of this.

**BLAST RADIUS** `app/api/xendit/payout/route.ts`, `lib/xendit.ts`, `lib/actions/xendit.ts`, and every AR read
(the `balanceDue` semantics change from "zeroed" to "decremented"). Coordinate with Finance-AR.

**TESTS**
- **[mock-OK]** signature verification accepts/rejects; the status→state-transition decision table
  (SUCCEEDED/FAILED/VOIDED/PENDING/ACCEPTED); the partial-payment balance arithmetic as a pure function.
- **[real-DB REQUIRED]** replay the *same* event 20× concurrently → exactly one `Payment`/JE effect and 19
  duplicate no-ops. **The P2002 race is the whole finding; `mockDeep` has no unique index.**
- **[real-DB REQUIRED]** a GL failure mid-handler leaves no `ProcessedWebhookEvent` row (so the retry can
  actually succeed) — this is a subtle and important assertion.

**VERIFY** Replay a captured webhook payload against staging twice; assert one JE, correct `balanceDue`, and a
500 (not 200) when the DB is unavailable.

**RISK / ROLLBACK** — **High: this is a live money path.** Returning non-2xx changes provider behaviour —
confirm Xendit's retry/backoff policy and its dead-letter behaviour *before* shipping (ops item O-4).
Rollback: revert the handler; the `ProcessedWebhookEvent` table is additive and can stay.

**EFFORT:** M

---

### R-08 · ~80 financial/business reads swallow DB errors as empty data

**INVARIANT:** *A read function never returns a value that is indistinguishable from "no data" when the cause
was an error. Callers can always tell empty-result from failed-query.*

**DIFF SKETCH** — introduce one shared type and adopt it by blast radius, not alphabetically:
```ts
// lib/types.ts
export type Result<T> = { ok: true; data: T } | { ok: false; error: string }

// BEFORE — lib/actions/procurement.ts:497
export async function getRequests() {
    try { return await withPrismaAuth(async (p) => p.purchaseRequest.findMany({ … })) }
    catch (e) { console.error(e); return [] }            // ← outage looks like "no requests"
}

// AFTER
export async function getRequests(): Promise<Result<PurchaseRequestRow[]>> {
    try { return { ok: true, data: await withPrismaRead(async (p) => p.purchaseRequest.findMany({ … })) } }
    catch (e: any) { console.error('[getRequests]', e); return { ok: false, error: e?.message ?? 'Gagal memuat data' } }
}
```
**Ordering (highest user-decision impact first):** finance reads → procurement (`procurement.ts:497,1535,2053`)
→ inventory (`app/actions/inventory.ts:1683,1824`) → sales (`sales.ts:85,530,956`) → dashboard/HCM.
`lib/actions/ceo-flags.ts:82` is special: it masks a **missing migration** as `[]` — fix that one immediately
and separately, it is a one-line lie about schema state.

**BLAST RADIUS** Every consumer of each converted function must handle the new shape. **This is a signature
change → Ripple Check Phase 4 + 5 apply in full.** Convert **one module per PR**, and within a PR convert
*all* consumers of the touched functions.

**TESTS** **[mock-OK]** and sufficient: force the mocked client to reject and assert `{ok:false}` propagates
with a message; assert an empty result still yields `{ok:true, data:[]}`. This is the one large finding that
the existing harness *can* cover well.

**VERIFY** With the DB down in a preview env, each converted page shows a retry state, never an empty table.

**RISK / ROLLBACK** — Medium, spread thin. The risk is *incomplete* conversion leaving mixed shapes. Enforce
one-module-per-PR and let TypeScript find consumers — **which only works once R-23 makes type errors visible**
(`next.config.ts:7-11` currently hides them). **R-23 should land before this item starts.**

**EFFORT:** L (S per module × ~8 modules)

---

### R-09 · `db-fallbacks` returns fake data for financial reads on error

**INVARIANT:** *Fabricated or empty fallback data is never returned from a production code path. Fallbacks are
gated to `NODE_ENV === 'development'` and are visibly labelled in the UI.*

**DIFF SKETCH**
```ts
// BEFORE — lib/actions/procurement.ts:157-159
catch (error) { console.error(…); return FALLBACK_VENDORS }

// AFTER
catch (error: any) {
    console.error('[getVendors]', error)
    if (process.env.NODE_ENV === 'development' && process.env.USE_DB_FALLBACKS === 'true') {
        console.warn('[getVendors] returning DEV fallback data')
        return FALLBACK_VENDORS
    }
    throw error       // or { ok:false } once R-08 has converted this function
}
```
Sites: `procurement.ts:157-159` (`getVendors`), `:1385-1387` (`getPurchaseOrders`), `grn.ts:79-98`
(`getPendingPOsForReceiving` — its `safeQuery` **discards the error field**, fix that too),
`app/actions/purchase-order.ts:36-38` (`getProductsForPO`).

**BLAST RADIUS** `app/procurement/**`, `components/procurement/**`, `lib/db-fallbacks.ts`. Naturally merges
with R-08's procurement PR — **do them together**.

**TESTS** **[mock-OK]**: with `NODE_ENV='production'` a rejected query throws/returns `{ok:false}`; with
`NODE_ENV='development'` + the flag, fallbacks are returned.

**VERIFY** Grep `FALLBACK_` under `lib/actions/` and `app/actions/`: every remaining reference sits behind the
dev guard.

**RISK / ROLLBACK** — Low. Revert per-function.  **EFFORT:** S

---

## 3. Sev-2 remediation entries

### R-10 · `cache-warm` — unauthenticated fan-out that caches nothing

**INVARIANT:** *`/api/cache-warm` requires authentication (or a shared secret), stores what it computes, and
concurrent invocations for the same key coalesce into one database round-trip.*

**DIFF SKETCH**
```ts
// BEFORE — app/api/cache-warm/route.ts (GET ~:94, POST :112-130)
const result = await getDashboardStats()                 // computed, returned, then discarded
return NextResponse.json({ success: true, key, dataCount: … })
…
export async function POST(request: NextRequest) {
    const { keys } = await request.json()                 // no auth, no bound on keys.length
    const results = await Promise.allSettled(keys.map(k => fetch(`${origin}/api/cache-warm?key=${k}`)))
}

// AFTER
export const maxDuration = 30
const WARMERS: Record<string, () => Promise<unknown>> = {
    'dashboard-stats': unstable_cache(getDashboardStats, ['dashboard-stats'], { revalidate: 60, tags: ['dashboard'] }),
    …
}
async function assertAuthorized(req: NextRequest) {
    if (req.headers.get('x-cache-warm-secret') === process.env.CACHE_WARM_SECRET) return
    const { createClient } = await import('@/lib/supabase/server')
    const { data: { user } } = await (await createClient()).auth.getUser()
    if (!user) throw new Response('Unauthorized', { status: 401 })
}
export async function POST(req: NextRequest) {
    await assertAuthorized(req)
    const { keys } = await req.json()
    if (!Array.isArray(keys) || keys.length > 16) return NextResponse.json({ error: 'keys: max 16' }, { status: 400 })
    const valid = keys.filter(k => k in WARMERS)                     // allowlist, no self-fetch
    await Promise.allSettled(valid.map(k => WARMERS[k]()))           // in-process; unstable_cache dedupes
    return NextResponse.json({ warmed: valid.length })
}
```
Removing the self-`fetch` loop is the single biggest win: it halves the connection cost and eliminates the
amplification vector.

**BLAST RADIUS** `lib/performance/procurement-prefetch.ts:109` (the client trigger) must send the auth header
or be made a no-op for unauthenticated users. Grep `cache-warm` across `app/` and `components/`.

**TESTS** **[mock-OK]**: unauthenticated POST → 401; `keys.length > 16` → 400; unknown keys filtered out; the
warmer map is invoked exactly once per key.

**VERIFY** Query count for a POST of 16 keys, before vs after (expect ~16 → ~16 *cached*, with subsequent
calls inside the revalidate window issuing zero queries). Confirm 401 for an anonymous POST.

**RISK / ROLLBACK** — Low. `unstable_cache` on financial aggregates introduces staleness — cap `revalidate` at
60s and **never cache money-critical reads** (AR balances, invoice status). Rollback: revert one file.

**EFFORT:** S

---

### R-11 · Client cache serves stale financial data

**INVARIANT:** *Money-mutable data (invoice status, `balanceDue`, AR/AP aging, stock levels) is never served
from cache older than a few seconds without a background refetch, and is never persisted to IndexedDB.*

**DIFF SKETCH** — `lib/query-client.tsx:23-42`. The `CACHE_TIERS` referenced in the comment at `:25` **does not
exist in the file** — define it:
```ts
export const CACHE_TIERS = {
    /** Money-mutable: invoices, payments, AR/AP, stock. Always revalidate. */
    live:      { staleTime: 0,               gcTime: 5 * 60 * 1000, refetchOnWindowFocus: true,  networkMode: 'online' as const },
    /** Slow-moving business data: customers, vendors, products. */
    warm:      { staleTime: 60 * 1000,       gcTime: 60 * 60 * 1000 },
    /** Reference data: COA, categories, UoM. */
    reference: { staleTime: 30 * 60 * 1000,  gcTime: 24 * 60 * 60 * 1000 },
}

// and exclude live queries from IndexedDB persistence:
persistOptions: {
    persister: idbPersister,
    dehydrateOptions: {
        shouldDehydrateQuery: (q) => !(q.queryKey[0] as string)?.startsWith('finance')
                                  && !(q.queryKey[0] as string)?.startsWith('stock'),
    },
}
```
Then apply `...CACHE_TIERS.live` to the finance/stock hooks (`hooks/use-finance-reports.ts`,
`hooks/use-expenses.ts`, `hooks/use-nav-prefetch.ts`, and the invoice/payment query hooks).

**BLAST RADIUS** `lib/query-client.tsx` (global provider — **exclusive-lock file**), plus every `useQuery` on
financial data. Defaults stay unchanged, so this is opt-in per hook and safely incremental.

**TESTS** **[mock-OK]**: `CACHE_TIERS.live.staleTime === 0`; `shouldDehydrateQuery` returns false for
`['finance', …]` and `['stock', …]` and true for `['products']`.

**VERIFY** Two browsers: pay an invoice in A; B shows PAID on next focus without a manual reload. Reload B
offline and confirm no stale financial figures are restored from IndexedDB.

**RISK / ROLLBACK** — Low-Medium: more refetches → more DB load, which **interacts with R-05**. Ship R-11
after or with the R-05 read-path work. Rollback: revert one file.

**EFFORT:** S

---

### R-12 · Missing indexes on hot finance/traceability FK columns  ⟵ **first code change of the whole plan**

**INVARIANT:** *Every foreign key used as a lookup predicate by a report, a traceability query, or the
integrity checker is backed by an index. `EXPLAIN` on the invoice→JE and payment→JE lookups shows an index
scan, not a seq scan.*

**DIFF SKETCH** — `prisma/schema.prisma`, `JournalEntry` (verified: `:2290-2294` declare the FK scalars;
`:2317-2318` declare only `@@index([date])` and `@@index([isReconciled])`):
```prisma
model JournalEntry {
  …
  @@index([date])
  @@index([isReconciled])
  @@index([invoiceId])                  // + these five
  @@index([paymentId])
  @@index([salesOrderId])
  @@index([purchaseOrderId])
  @@index([inventoryTransactionId])
}
model Payment              { … @@index([customerId]) @@index([supplierId]) }
model PurchaseOrderItem    { … @@index([purchaseOrderId]) }
model InventoryTransaction { … @@index([purchaseOrderId]) @@index([salesOrderId])
                                @@index([workOrderId])    @@index([adjustmentId]) }
```
Generate the migration, then hand-edit it to `CREATE INDEX CONCURRENTLY` so it does not lock hot tables:
```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS "journal_entries_invoiceId_idx" ON "journal_entries"("invoiceId");
-- …one statement per index
```
`CONCURRENTLY` cannot run inside a transaction block — this migration must be applied outside Prisma's default
transactional wrapper (or split into its own deploy step). Note this for the operator.

**BLAST RADIUS** Index-only; **zero application-code consumers**. This is why it goes first. It does touch
`prisma/schema.prisma`, which is a shared file — **serialize with R-03/R-04/R-13 schema work** (§7).

**TESTS** No unit test. **[real-DB REQUIRED]** `EXPLAIN ANALYZE` before/after on
`SELECT * FROM journal_entries WHERE "invoiceId" = $1` and the PO-with-lines join.

**VERIFY** `SELECT indexname FROM pg_indexes WHERE tablename IN ('journal_entries','payments','purchase_order_items','inventory_transactions')` lists all twelve. R-22's checker runtime drops.

**RISK / ROLLBACK** — **Lowest risk in this plan.** Marginal write-amplification and disk. Rollback:
`DROP INDEX CONCURRENTLY`.  **EFFORT:** S

---

### R-13 · No DB backstop for stock/quantity integrity + `Int` vs `Decimal` ledger mismatch

**INVARIANT:** *The inventory movement ledger can represent every quantity the stock ledger can hold.
`SUM(InventoryTransaction.quantity)` per (product, warehouse, location) equals `StockLevel.quantity` exactly,
with no truncation.*

**DIFF SKETCH** — verified: `StockLevel.quantity` is `Decimal @db.Decimal(18,4)`
(`prisma/schema.prisma:381`, with a docstring citing migration `20260423160000_stock_level_decimal`), while
`InventoryTransaction.quantity` is bare `Int` (`:408`). A 2.5 m fabric receipt is unrepresentable in the ledger.
```prisma
// prisma/schema.prisma:408
- quantity   Int              // Positive for IN, Negative for OUT
+ /// Decimal(18,4) — must match StockLevel.quantity precision (see :381) so the
+ /// ledger reconciles to stock levels without truncation.
+ quantity   Decimal @db.Decimal(18, 4)
```
Migration: `ALTER TABLE inventory_transactions ALTER COLUMN quantity TYPE numeric(18,4);` — widening is
lossless and does not rewrite semantics. Follow the precedent already set by
`20260423160000_stock_level_decimal`; the docstring at `:1745` shows this convention exists in the codebase.

The application ripple is the real work: every `Number(tx.quantity)` and every arithmetic site must handle
`Decimal`. Search `grep -rn "\.quantity" lib/actions/ app/actions/ app/api/ | grep -i "inventorytransaction\|invTx"`.

CHECK constraints ship with R-04.

**BLAST RADIUS** `app/actions/inventory.ts`, `lib/actions/grn.ts`, `lib/actions/stock-transfers.ts`,
`lib/actions/cutting.ts`, `lib/actions/subcontract.ts`, `app/api/manufacturing/work-orders/[id]/route.ts`,
inventory reports/exports. **Wide.** Depends on R-23 to surface the type ripple at compile time.

**TESTS**
- **[mock-OK]** `__tests__/inventory-logic.test.ts` — extend for fractional quantities end-to-end through the
  pure helpers; assert no `Math.round`/`| 0` truncation remains.
- **[real-DB REQUIRED]** insert 2.5, read back 2.5000; ledger sum equals stock level for a fractional series.

**VERIFY** R-22's stock reconciliation check returns zero discrepancies after a fractional receipt.

**RISK / ROLLBACK** — Medium-High **because of the code ripple**, not the migration. Narrowing back to `Int`
would be lossy, so rollback is forward-only: keep the column `Decimal` and revert code. **Do this last among
the schema items**, after R-23 gives you a type-checker.

**EFFORT:** M

---

### R-14 · 36 of 160 API routes have no in-handler auth

**INVARIANT:** *Every `app/api/**/route.ts` either performs an authentication check before any data access, or
appears on an explicit, reviewed allowlist of signature/secret-gated endpoints (`xendit/webhook`, `health`).*

**DIFF SKETCH** — one shared helper, then mechanical adoption:
```ts
// lib/auth/api-guard.ts (new)
export async function requireApiUser() {
    const { createClient } = await import('@/lib/supabase/server')
    const { data: { user }, error } = await (await createClient()).auth.getUser()
    if (error || !user) throw new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    return user
}

// each route
export async function GET(req: NextRequest) {
    await requireApiUser()          // ← one line
    …
}
```
**Do `app/api/system/fix-cn-partial` first** — it is a *data-mutating* "fix" endpoint reachable
unauthenticated; strongly consider deleting it outright. Then the 7 `app/api/finance/cashflow-*` routes, then
`app/api/procurement/dashboard`, then `app/api/dashboard/*`.

Also correct the misleading comment at `middleware.ts:167-176` — it asserts "API routes handle auth
internally," which is false for 36 files. Comments that lie are how this class of bug persists.

**BLAST RADIUS** Per-route and shallow, but any client calling these routes without cookies breaks — check
`lib/performance/procurement-prefetch.ts` and server-to-server callers first.

**TESTS** **[mock-OK]** and genuinely valuable here: a table-driven test that enumerates
`app/api/**/route.ts`, greps each for an auth call or allowlist membership, and fails on any new unguarded
route. This converts a one-time cleanup into a permanent invariant.

**VERIFY** `curl` each route with no cookie → 401. The enumeration test's allowlist is short and reviewed.

**RISK / ROLLBACK** — Low-Medium (risk of breaking an internal caller). Ship in batches of ~10 routes.

**EFFORT:** M

---

### R-15 · No timeouts / retries / `maxDuration` on outbound calls

**INVARIANT:** *No outbound call (HTTP, child process, file parse) can block a serverless invocation
indefinitely. Every route declares a `maxDuration` shorter than the platform ceiling.*

**DIFF SKETCH** — copy the one bounded call that already exists (`middleware.ts:54-56`):
```ts
// lib/with-timeout.ts (promote the middleware pattern to a shared helper)
export async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
    let t: NodeJS.Timeout
    const timeout = new Promise<never>((_, rej) => { t = setTimeout(() => rej(new Error(`${label} timeout ${ms}ms`)), ms) })
    try { return await Promise.race([p, timeout]) } finally { clearTimeout(t!) }
}

// app/api/xendit/payout/route.ts:82,139 — MONEY PATH
export const maxDuration = 30
const ctl = new AbortController()
const timer = setTimeout(() => ctl.abort(), 10_000)
try { const res = await xenditClient.createPayout({ …, signal: ctl.signal }) } finally { clearTimeout(timer) }

// lib/services/document-service.ts:85 — child process
const child = spawn(typstBin, args)
const killer = setTimeout(() => child.kill('SIGKILL'), 20_000)
child.on('close', () => clearTimeout(killer))

// lib/excel-parser.ts:21 — synchronous XLSX.read blocks the event loop
// (a) reject files over a size cap before parsing; (b) longer-term, move to a background job.
if (buffer.byteLength > 5 * 1024 * 1024) throw new Error('File terlalu besar (maks 5MB)')
```
**Xendit timeout caution:** a timed-out payout request may still have executed server-side. Never auto-retry a
`createPayout` on timeout — reconcile via `getPayoutById` + the idempotency key instead.

**BLAST RADIUS** `app/api/xendit/**`, `lib/xendit.ts`, `lib/services/document-service.ts` (all
`app/api/documents/**` routes), `lib/excel-parser.ts` (all import flows).

**TESTS** **[mock-OK]**: `withTimeout` rejects with the labelled error and clears its timer; the oversize-file
guard rejects. **[real-DB not required]**, but a manual staging test against a slow endpoint is worthwhile.

**VERIFY** No function invocations at the platform max duration in logs (needs R-21). PDF generation against a
hung Typst binary returns an error in ≤20s.

**RISK / ROLLBACK** — Low. Too-tight timeouts cause spurious failures — start generous (10s outbound, 20s
child process) and tighten with data. Rollback per file.

**EFFORT:** M

---

### R-16 · Unguarded status transitions → concurrent double-transition

**INVARIANT:** *A document status transition succeeds only if the document is still in the status the caller
observed. Two concurrent conflicting transitions: exactly one succeeds, the other gets a "sudah diproses"
error.*

**DIFF SKETCH** — the correct pattern is verbatim in this repo at `lib/actions/procurement.ts:991-1001`:
```ts
// BEFORE — app/api/sales/orders/[id]/transition/route.ts:44-89
const so = await tx.salesOrder.findUnique({ where: { id }, … })       // :45 — read
const allowed = VALID_TRANSITIONS[so.status] || []
if (!allowed.includes(targetStatus)) throw new Error(`Transisi tidak valid: …`)
const updated = await tx.salesOrder.update({ where: { id }, data: updateData, … })   // :83 — unguarded

// AFTER
const res = await tx.salesOrder.updateMany({
    where: { id, status: so.status },        // ← the status we validated against
    data: updateData,
})
if (res.count === 0) {
    throw new Error('Pesanan sudah diproses oleh pengguna lain. Refresh halaman.')
}
const updated = await tx.salesOrder.findUniqueOrThrow({ where: { id }, include: { items: { include: { product: true } }, customer: true } })
```
Same edit at `lib/actions/procurement.ts:945` (`submitPOForApproval`) and `:1042` (`rejectPurchaseOrder`).
Sweep for others: `grep -rn "status:.*'\(APPROVED\|CONFIRMED\|CANCELLED\|POSTED\)'" lib/actions app/api | grep "\.update("`.

**BLAST RADIUS** `app/sales/orders/**`, `components/sales/order-execution-card.tsx`, `app/procurement/orders/**`,
`components/procurement/po-details-sheet.tsx`, `lib/po-state-machine.ts` (13 statuses, **zero tests** — R-20).

**TESTS**
- **[mock-OK]** the transition table itself: `lib/po-state-machine.ts` and `VALID_TRANSITIONS` — exhaustively
  assert every allowed/forbidden pair. This closes an R-20 gap and is pure logic, ideal for the harness.
- **[real-DB REQUIRED]** concurrent Confirm + Cancel on one SO → exactly one wins. `mockDeep` returns whatever
  `count` you tell it to; it cannot prove serialization.

**VERIFY** Two browser tabs, simultaneous conflicting transitions: one succeeds, one shows the Bahasa error.

**RISK / ROLLBACK** — Low. Occasional benign "refresh" errors under contention. Revert per file.

**EFFORT:** S

---

### R-17 · Racy document-number generation

**INVARIANT:** *Every generated document number is unique by construction — produced by an atomic counter
increment inside the same transaction as the document insert — not by counting existing rows.*

**DIFF SKETCH** — `lib/document-numbering.ts:19-29` is the proven primitive (`upsert` + `{increment:1}` on the
unique `prefix`), already used by `grn.ts:277-282`:
```ts
// BEFORE — lib/actions/finance-invoices.ts:355-362 (verified)
const count = await prisma.invoice.count({
    where: { type: invoiceType, number: { startsWith: `${prefix}-${year}` } },
})
const invoiceNumber = `${prefix}-${year}-${String(count + 1).padStart(4, '0')}`
// ↑ also WRONG after any deletion/cancellation: count()+1 reuses a burned number

// AFTER
import { getNextDocNumber } from '@/lib/document-numbering'
const invoiceNumber = await getNextDocNumber(prisma, `${prefix}-${year}`, 4)   // prisma = tx client
```
Apply at: `finance-invoices.ts:356` (invoice/bill), `lib/actions/sales.ts:157` & `:408` (SO / payment),
`app/actions/purchase-order.ts:67` (PO), `app/actions/hcm.ts:1587` (payroll),
`app/api/sales/customers/route.ts:30-47` (customer code), and **`finance-gl.ts:13-21` `getNextJournalRef`**
(which is `count()+1` on a **non-unique** `reference` — see the bonus note in §0).

`getNextDocNumber` takes the tx client as its first argument, so the counter rolls back with the document —
the semantics you want.

**Backfill note:** seed `DocumentCounter` from existing maxima before cutover, or numbering restarts at 1:
```sql
INSERT INTO document_counters (prefix, value)
SELECT 'INV-2026', COALESCE(MAX(CAST(split_part(number,'-',3) AS int)), 0) FROM invoices WHERE number LIKE 'INV-2026-%'
ON CONFLICT (prefix) DO UPDATE SET value = GREATEST(document_counters.value, EXCLUDED.value);
```
**This backfill is the highest-risk part of R-17** — get it right per prefix, in one migration, verified against
production maxima.

**BLAST RADIUS** Every document-creation path and any code parsing number formats (exports, Typst templates
under `templates/`, search). Format must remain byte-identical — verify the pad width per prefix.

**TESTS**
- **[mock-OK]** format/pad correctness for each prefix.
- **[real-DB REQUIRED]** 100 concurrent creations → 100 distinct sequential numbers, zero P2002. The entire
  finding is a race.

**VERIFY** `SELECT number, COUNT(*) FROM invoices GROUP BY 1 HAVING COUNT(*)>1` → zero. `document_counters`
values ≥ the observed maxima.

**RISK / ROLLBACK** — Medium (the backfill). Ship **one prefix per PR**, verify the counter, move on. Rollback:
revert the call site; `DocumentCounter` rows are harmless if unused.

**EFFORT:** M

---

### R-18 · Manufacturing WO completion posts no GL

**INVARIANT:** *Completing a work order moves value out of WIP and into Finished Goods in the same transaction
as the status change: DR Finished Goods (actual material + labour + overhead consumed), CR WIP. No work order
reaches COMPLETED without a linked balanced `POSTED` journal entry.*

**DIFF SKETCH** — first **verify a WO-completion action exists** (findings mark this UNVERIFIED):
`grep -rn "COMPLETED" app/api/manufacturing/work-orders lib/actions/*.ts | grep -i "status"`. Then, inside
that transaction, following the `grn.ts:acceptGRN` model:
```ts
await ensureSystemAccounts()
await assertPeriodOpen(completionDate)
const fgValue = await computeWOFinishedGoodsValue(tx, workOrderId)   // material + labour + overhead
const gl = await postJournalEntry({
    description: `Penyelesaian Work Order ${wo.number}`,
    date: completionDate,
    reference: wo.number,
    lines: [
        { accountCode: SYS_ACCOUNTS.FINISHED_GOODS, debit: fgValue, credit: 0, description: `Barang Jadi - ${wo.number}` },
        { accountCode: SYS_ACCOUNTS.WIP,            debit: 0, credit: fgValue, description: `WIP - ${wo.number}` },
    ],
}, tx)
if (!gl?.success) throw new Error(`GL posting failed: ${gl?.error}`)
```
Requires `SYS_ACCOUNTS.FINISHED_GOODS` via the 4-step protocol (constant → `ensureSystemAccounts()` → usage →
`seed-gl.ts`). `SYS_ACCOUNTS.WIP` already exists (used at `finance-wip.ts:109`).

**BLAST RADIUS** `app/manufacturing/orders/**`, `components/manufacturing/orders/**`,
`app/api/manufacturing/work-orders/**`, and downstream COGS recognition
(`__tests__/cogs-recognition.test.ts`, `finance-invoices.ts` COGS block). Also update the CLAUDE.md Layer-5
table row from "TBD" to the implemented action name — that table is the project's contract.

**TESTS**
- **[mock-OK]** `computeWOFinishedGoodsValue` as a pure function over material/labour/overhead inputs; the GL
  line builder is balanced and directionally correct (`__tests__/bom-costing.test.ts`,
  `material-variance.test.ts` are the right neighbours).
- **[real-DB REQUIRED]** completing a WO produces exactly one balanced JE and WIP nets to ~0 for a fully
  consumed order.

**VERIFY** After completion: Neraca shows FG up / WIP down by the same amount; R-22 reports zero WOs in
COMPLETED without a JE.

**RISK / ROLLBACK** — Medium-High: this is **new accounting policy**, not a bug fix. The valuation formula must
be agreed with the accountant before implementation, or you will post confidently wrong numbers. Roll out
behind a feature check and reconcile a month of historical WOs before enabling. Rollback: disable the GL block
(WOs still complete).

**EFFORT:** L

---

### R-19 · Prisma fully mocked in tests — DB-integrity classes structurally untestable  ⟵ **enabling item**

**INVARIANT:** *Every invariant in this plan that depends on transactions, constraints, isolation, or
concurrency has a test that runs against real PostgreSQL.*

**DIFF SKETCH** — add a second, opt-in harness; **do not touch the existing one** (56 files depend on it):
```ts
// vitest.integration.config.ts  (new — sits beside vitest.config.ts)
export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        environment: 'node',
        include: ['__tests__/integration/**/*.test.ts'],
        setupFiles: ['./test-setup.integration.ts'],   // NO mockDeep; real client at TEST_DATABASE_URL
        globals: true,
        fileParallelism: false,                        // shared DB — serialize files
        testTimeout: 30_000,
    },
})
```
```ts
// test-setup.integration.ts
// - assert TEST_DATABASE_URL is set and is NOT the production URL (hard fail otherwise)
// - `prisma migrate deploy` once per run
// - per-test: truncate in FK order, or wrap in a transaction and roll back
// - stub only Supabase auth (same shape as test-setup.ts:18-27); the Prisma client is REAL
```
```json
// package.json scripts
"test": "vitest run",
"test:integration": "vitest run --config vitest.integration.config.ts",
"typecheck": "tsc --noEmit"
```
Note F-5's second half: mocking `./lib/prisma` does not intercept `withPrismaAuth`'s internal `basePrisma`
reference, so the integration harness is the *only* way to exercise real server actions at all — not merely
the only way to test concurrency.

**BLAST RADIUS** None on application code. Adds a CI service container (Postgres) or a Supabase branch DB.

**TESTS** The harness is validated by the first integration test that uses it (R-04's concurrent-decrement
test is the ideal first customer — small, self-contained, and proves transactions + row counts work).

**VERIFY** `npm run test:integration` passes locally and in CI; `npx vitest` (the mocked suite) is unaffected.

**RISK / ROLLBACK** — Low, additive. The real risk is *cost*: someone must own CI DB provisioning. Without it,
**every [real-DB REQUIRED] test in this plan is unwritable**, which is why this is a Milestone 1 item.

**EFFORT:** M

---

### R-20 · High-risk areas with zero test coverage

**INVARIANT:** *Each of the five ranked areas has at least one test that would fail today.*

**PLAN** — not a diff; a checklist, each landing **with** its remediation PR:

| Area | Test | Harness | Lands with |
|---|---|---|---|
| 1. Inventory concurrency on `StockLevel` | 2 concurrent decrements, one wins | **integration** | R-04 |
| 2. API-route auth + validation | route-enumeration + allowlist test | mock | R-14 |
| 3. Idempotency (payment / invoice / GRN / webhook) | replay same event 20× | **integration** | R-07 |
| 4. PO state machine (13 statuses) | exhaustive transition table over `lib/po-state-machine.ts` | mock | R-16 |
| 5. Pooled-DB failure / partial-commit rollback | forced mid-tx failure ⇒ no rows | **integration** | R-01b, R-02 |

Item 4 is pure logic, needs no DB, covers a 13-status machine with zero tests today, and can be written by
anyone **right now** — the single best-value test in the plan.

**EFFORT:** M (distributed across the other PRs)

---

## 4. Sev-3 remediation entries

### R-21 · No observability (799 raw `console.*`, no error tracking, no health check)

**INVARIANT:** *Every unhandled server error reaches an alerting channel within one minute, carrying a
correlation ID that ties it to a request. Liveness and DB reachability are externally probeable.*

**DIFF SKETCH**
```ts
// app/api/health/route.ts (new) — no auth, no business data
export const dynamic = 'force-dynamic'
export const maxDuration = 10
export async function GET() {
    const t0 = Date.now()
    try {
        await prisma.$queryRaw`SELECT 1`
        return NextResponse.json({ status: 'ok', db: 'up', latencyMs: Date.now() - t0, version: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev' })
    } catch (e: any) {
        return NextResponse.json({ status: 'degraded', db: 'down', error: e?.message }, { status: 503 })
    }
}

// lib/logger.ts (new) — thin wrapper; do NOT rewrite 799 call sites at once
export const logger = {
    info:  (msg: string, ctx?: object) => console.log(JSON.stringify({ level: 'info',  msg, ...ctx, ts: Date.now() })),
    warn:  (msg: string, ctx?: object) => console.warn(JSON.stringify({ level: 'warn',  msg, ...ctx, ts: Date.now() })),
    error: (msg: string, err?: unknown, ctx?: object) => console.error(JSON.stringify({ level: 'error', msg, err: String(err), ...ctx, ts: Date.now() })),
}
// instrumentation.ts — Sentry init (Next.js 16 supports this hook natively)
```
Adopt `logger` **only in newly touched code**; migrate the 799 sites opportunistically. A big-bang
console→logger sweep is churn that conflicts with every other session's diff — explicitly avoid it.

**BLAST RADIUS** New files + `instrumentation.ts`. Near-zero.

**TESTS** **[mock-OK]** logger emits valid JSON with a level; health route returns 503 when `$queryRaw` rejects.

**VERIFY** `curl /api/health` → 200/`db:up`; kill the DB → 503. Trigger a deliberate error and see it in Sentry.

**RISK / ROLLBACK** — Low. `/api/health` must **never** leak connection strings or business data. Revert = delete files.

**EFFORT:** S (health + logger) · M (Sentry wiring + alert routing)

---

### R-22 · No runtime financial-invariant check  ⟵ **the fix multiplier**

**INVARIANT:** *On a schedule, the system asserts and reports: (1) global trial balance
`SUM(debit) == SUM(credit)`; (2) zero orphan documents — every Invoice in ISSUED/PARTIAL/PAID/OVERDUE has ≥1
linked POSTED JournalEntry; (3) `GLAccount.balance == SUM` of its posted lines; (4) per
(product, warehouse, location), `StockLevel.quantity == SUM(InventoryTransaction.quantity)`.*

**DIFF SKETCH**
```ts
// app/api/admin/integrity-check/route.ts (new)
export const maxDuration = 60
export async function GET(req: NextRequest) {
    await requireAdmin(req)                         // R-14's guard, admin-scoped
    const checks = await Promise.all([
        checkTrialBalance(), checkOrphanDocuments(), checkAccountBalances(), checkStockLedger(),
    ])
    const failed = checks.filter(c => !c.ok)
    return NextResponse.json({ ok: failed.length === 0, checks }, { status: failed.length ? 500 : 200 })
}

// lib/actions/finance-integrity.ts (new — a NEW canonical file, never finance.ts)
export async function checkOrphanDocuments() {
    const orphans = await prisma.$queryRaw`
        SELECT i.id, i.number, i.status FROM invoices i
        WHERE i.status NOT IN ('DRAFT','CANCELLED','VOID')
          AND NOT EXISTS (SELECT 1 FROM journal_entries je
                          WHERE je."invoiceId" = i.id AND je.status = 'POSTED')`   // ← needs the R-12 index
    return { name: 'no-orphan-invoices', ok: orphans.length === 0, detail: orphans.slice(0, 50) }
}
```
The trial-balance SQL already exists inside the reports (`finance-reports.ts:247`, `:1018`) — **extract it into
`finance-integrity.ts` and have both the report and the checker call it**, rather than writing a third copy
(that is precisely how `finance.ts` became a fork).

**Run this checker against production *before* starting R-01b/R-02.** It is your baseline: it tells you how many
orphans already exist, and it is how you will prove the atomicity fixes worked.

**BLAST RADIUS** New file + new route. Reads only. Must **not** be added to `finance.ts`.

**TESTS**
- **[mock-OK]** each check's *classification* logic (which statuses require a JE — mirror
  `__tests__/accounting-no-orphans.test.ts`, which already encodes exactly this rule).
- **[real-DB REQUIRED]** seed a deliberate orphan and a deliberately unbalanced entry; the checker must find both.

**VERIFY** Deliberately create an orphan on staging (issue an invoice with the GL account renamed) — the
checker returns 500 with that invoice listed.

**RISK / ROLLBACK** — Low, read-only. Performance is the concern: **without R-12's indexes these queries seq-scan
`journal_entries`** and could themselves become an availability problem. Hence R-12 → R-22 ordering. Rollback:
delete the route.

**EFFORT:** M

---

### R-23 · `ignoreBuildErrors: true` ships type errors to production

**INVARIANT:** *No commit reaches the default branch with a TypeScript error.* (Interim: the error count is
published and strictly non-increasing.)

**DIFF SKETCH** — do **not** flip the flag first; that will fail the build immediately given F-5's evidence
(`tx.nSFPRange` against a model that does not exist is guaranteed to be one of many errors).
```
Step 1  add "typecheck": "tsc --noEmit" to package.json (S)
Step 2  run it, commit the baseline count to docs/reliability/typecheck-baseline.txt
Step 3  CI job: fail only if the count INCREASES (ratchet)
Step 4  burn down by module (each module's session owns its own errors)
Step 5  when zero → remove ignoreBuildErrors from next.config.ts:7-11
```

**BLAST RADIUS** CI config + `next.config.ts` (step 5 only). No runtime change.

**TESTS** CI is the test.
**VERIFY** The baseline count decreases each week; step 5 lands with a green `next build`.
**RISK / ROLLBACK** — Low if ratcheted; **High if flipped in one go** (blocks all deploys). Rollback: revert the flag.
**EFFORT:** S (steps 1–3) · L (step 4 burn-down)

> **Why this matters more than its Sev-3 rating:** R-08 and R-13 are signature/type changes across many
> consumers. Without a type-checker, Ripple Check Phase 5 ("every consumer verified") is done by hand and by
> hope. **R-23 steps 1–3 should land in Milestone 1.**

---

### R-24 · Committed DB password + hardcoded `project_ref`  → **OPERATIONS, not code**

**INVARIANT:** *No credential valid for a production system exists in git history.*

**ACTION (ops — see §9-O1):** rotate the Postgres password in the Supabase dashboard; update `DATABASE_URL` /
`DIRECT_URL` in every deploy environment; **then** scrub `DB_CONNECTION_FIX.md`. Editing or deleting the file
does **not** un-publish the secret — anyone with a clone still has it. `.mcp.json:5`'s `project_ref` is
low-severity info disclosure; move to an env var opportunistically.

**Code follow-up (S):** add a CI secret-scan (`gitleaks`) so this cannot recur.

**VERIFY** The old password fails authentication. `gitleaks detect` is green on new commits.
**RISK** — rotating breaks any deploy target not updated: **inventory every consumer of the credential first**
(Vercel envs, local `.env`, CI, MCP config, any scheduled job).
**EFFORT:** S (ops) + S (CI scan)

---

### R-25 · Destructive migration without data preservation

**INVARIANT:** *No migration drops a table or type without either a verified-empty precondition or a data
migration into its successor. Every migration has a documented rollback.*

**DIFF SKETCH** — `20260306000000_add_debit_credit_notes` has already shipped, so this is forward-looking
policy plus one verification:
```sql
-- Pattern for future destructive migrations:
-- 1. copy
INSERT INTO debit_credit_notes (id, number, …) SELECT id, number, … FROM credit_notes;
-- 2. verify (abort the migration if counts differ)
DO $$ BEGIN IF (SELECT COUNT(*) FROM credit_notes) <> (SELECT COUNT(*) FROM debit_credit_notes WHERE …)
   THEN RAISE EXCEPTION 'row count mismatch — aborting'; END IF; END $$;
-- 3. rename, don't drop (reversible for one release)
ALTER TABLE credit_notes RENAME TO credit_notes_deprecated_20260306;
```
Add `docs/reliability/MIGRATION_POLICY.md`: no bare `DROP` in the same release that introduces the successor;
rename-then-drop-next-release; every migration ships a `-- ROLLBACK:` comment block.

**Immediate action:** confirm whether production `credit_notes` data was actually lost. If so, that is an
incident, not a plan item.

**BLAST RADIUS** Process only.  **TESTS** n/a — enforce by review checklist.
**VERIFY** Migration reviews cite the policy.  **RISK** — none.  **EFFORT:** S

---

### R-26 · Partial-unique migration can abort mid-deploy

**INVARIANT:** *A migration either applies fully or does not start. Data preconditions are checked and
resolved before any DDL that can fail on existing data.*

**DIFF SKETCH**
```sql
-- BEFORE (20260423140000_stock_level_partial_unique): DELETE zero-qty dupes, then CREATE UNIQUE INDEX
--   → aborts if NON-zero duplicates exist (the migration's own comment says so)

-- AFTER pattern: fail fast and loud, before touching anything
DO $$ DECLARE dupes int; BEGIN
  SELECT COUNT(*) INTO dupes FROM (
    SELECT "productId","warehouseId" FROM stock_levels WHERE "locationId" IS NULL
    GROUP BY 1,2 HAVING COUNT(*) > 1 AND SUM(quantity) <> 0) d;
  IF dupes > 0 THEN
    RAISE EXCEPTION 'Aborting: % non-zero duplicate stock_levels. Consolidate first (see MIGRATION_POLICY).', dupes;
  END IF;
END $$;
CREATE UNIQUE INDEX CONCURRENTLY … ;
```
Ship a `scripts/precheck-migration.ts` run against production **before** deploy, alongside the same query.

**BLAST RADIUS** Migration + a script. Directly relevant to R-04's CHECK constraints and R-12's indexes —
**use this pre-check pattern for both.**

**TESTS** **[real-DB REQUIRED]** apply the migration to a DB seeded with non-zero duplicates → clean abort, no
partial state.

**VERIFY** The pre-check script runs green against a production snapshot before deploy.
**RISK** — Low (fails earlier and more loudly).  **EFFORT:** S

---

### R-27 · Auth call before transaction has no timeout

**INVARIANT:** *`supabase.auth.getUser()` on the request path is bounded; it can never delay opening or holding
a database transaction indefinitely.*

**DIFF SKETCH** — `lib/db.ts:51-53`, adopting the bounded pattern from `middleware.ts:54-56`:
```ts
// BEFORE
const { data: { user }, error: authError } = await supabase.auth.getUser()

// AFTER
const { data: { user }, error: authError } = await withTimeout(
    supabase.auth.getUser(), 5000, 'supabase.auth.getUser',
)   // withTimeout from R-15's lib/with-timeout.ts
```

**BLAST RADIUS** `lib/db.ts` — every server action. **Ship this with R-05's `lib/db.ts` PR** (same exclusive-lock
file, same reviewer, one round of regression). Do not open a second concurrent PR on `lib/db.ts`.

**TESTS** **[mock-OK]** a `getUser` that never resolves causes rejection at ~5s; the happy path is unaffected.
**VERIFY** No `withPrismaAuth` call exceeds 5s + query time in traces (needs R-21).
**RISK** — Low-Medium: a slow-but-working auth call now fails. 5s matches the existing middleware choice, so
behaviour is consistent across the app. Rollback: one line.
**EFFORT:** S

---

### R-28 · `error.tsx` gaps

**INVARIANT:** *Every top-level route segment has an error boundary, so one failing sub-route degrades to a
scoped error, not a whole-module blank page.*

**DIFF SKETCH** — verified present: `app/error.tsx` plus `costing`, `cutting`, `dashboard`, `documents`,
`finance`, `hcm`, `inventory`, `manufacturing`, `procurement`, `sales`, `settings`, `subcontract`.
**Missing:** `accountant`, `manager`, `staff`, `reports`, `fleet`, `admin`. Copy `app/finance/error.tsx`
verbatim into each, adjusting the module name, and follow the NB design system (`border-2 border-black`,
`shadow-[4px_4px...]`, `rounded-none`, Bahasa copy: *"Terjadi kesalahan — Coba lagi"*).

**BLAST RADIUS** Six new leaf files. Zero risk to existing code.
**TESTS** n/a (UI boundary). Manual: throw in a page, confirm the scoped boundary renders.
**VERIFY** `find app -maxdepth 2 -name error.tsx | wc -l` covers every module directory.
**RISK** — none.  **EFFORT:** S — **the single best first-day task for a new contributor.**

---

## 5. Sev-4 remediation entries

### R-29 · Duplicate receive path

**INVARIANT:** *There is exactly one code path that receives goods against a PO, and it guards against
double-receipt.*
**DIFF SKETCH** `app/actions/inventory.ts:1010-1178` (`receiveGoodsFromPO`) duplicates `grn.ts:acceptGRN`
without a PO-status/double-receive guard. **First determine liveness** (`grep -rn "receiveGoodsFromPO" app components`).
If dead → delete (the best possible diff). If live → make it a delegating wrapper over `acceptGRN`, exactly as
in R-01a.
**BLAST RADIUS** `app/inventory/**`, `app/procurement/receiving/**`, `components/inventory/goods-receipt-dialog.tsx`.
**TESTS** **[real-DB REQUIRED]** receiving the same PO line twice → second attempt rejected.
**VERIFY** `quantityReceived <= quantityOrdered` for all PO items.
**RISK** — Medium if live (changes receiving behaviour). **EFFORT:** M

### R-30 · Hardcoded GL codes / tax rates

**INVARIANT:** *Zero string-literal GL account codes and zero numeric tax-rate literals in `lib/actions/`,
`app/actions/`, and `app/api/`.*
**DIFF SKETCH** Verified sites: `lib/actions/sales.ts:357-358` (`'1110'`, `'1101'`), `:1391` (`0.11`), `:1401`
(`'4010'`); `lib/actions/finance.ts:1499,1502` (`'1200'`, `'4000'`); `finance.ts:createCreditNote` accepts
**client-supplied account IDs** (worst of the set — a malicious or buggy client can direct a posting to any
account). Replace with `SYS_ACCOUNTS.*` / `TAX_RATES.*`; for `createCreditNote`, derive accounts server-side.
Most of these are already inside the R-01c and R-02 diffs — **fold them in rather than opening a separate PR
on the same lines.**
Add the guard test:
```ts
// __tests__/no-hardcoded-gl-codes.test.ts   [mock-OK]
const offenders = grepAll(/accountCode:\s*['"]\d{4}['"]/g, ['lib/actions/**','app/actions/**','app/api/**'])
expect(offenders).toEqual([])
const rates = grepAll(/\*\s*0\.(11|22)\b/g, [...])
expect(rates).toEqual([])
```
**BLAST RADIUS** Sales + finance actions. **TESTS** the guard test above. **VERIFY** guard test green.
**RISK** — Low, but requires the constants to actually exist in `seed-gl.ts` and `ensureSystemAccounts()`.
**EFFORT:** S

### R-31 · Best-effort audit-log swallows

**INVARIANT:** *An audit-log failure never fails the business transaction, but is always visible in logs at
`warn` with entity context.*
**DIFF SKETCH** `finance.ts:419,1301,3538`; `finance-ap.ts:371`; `app/actions/inventory.ts:889,1769,1939`:
```ts
- } catch { /* audit is best-effort */ }
+ } catch (e) { logger.warn('audit-log write failed', { entityType, entityId, err: String(e) }) }
```
Related: R-01a must **port `finance.ts:404-415`'s `logAudit` call into `postJournalEntryInner`** before the fork
is deleted, or JE creation loses its audit entry.
**BLAST RADIUS** Local. **TESTS** **[mock-OK]** a rejecting audit write does not fail the caller and does log.
**VERIFY** grep for empty `catch {}` near `logAudit` → zero. **RISK** — none. **EFFORT:** S

### R-32 · Client `fetch` has no `AbortController`

**INVARIANT:** *In-flight client requests are cancelled on unmount/navigation; abandoned queries do not hold
server or DB resources.*
**DIFF SKETCH**
```ts
// BEFORE
useQuery({ queryKey: ['invoices'], queryFn: () => fetch('/api/finance/invoices').then(r => r.json()) })
// AFTER — TanStack Query passes an AbortSignal to queryFn
useQuery({ queryKey: ['invoices'], queryFn: ({ signal }) => fetch('/api/finance/invoices', { signal }).then(r => r.json()) })
```
Apply across `hooks/**` and `components/**`. Interacts with R-11 (`networkMode: 'offlineFirst'` changes retry
semantics) — **do it after R-11**.
**BLAST RADIUS** Wide but shallow, client-only. **TESTS** **[mock-OK]** the queryFn forwards `signal`.
**VERIFY** DevTools: pending requests cancel on navigation. **RISK** — Low. **EFFORT:** S

---

## 6. SEQUENCING

### 6.1 The governance decision (task requirement (c)) — **recommendation: CONSOLIDATE FIRST**

The choice is between *fix-both-then-consolidate* and *consolidate-first*. **Consolidate first.** Reasons, in
order of force:

1. **Fix-both is not actually possible for the most important function.** `finance.ts:338`'s
   `postJournalEntry` has **no `txClient` parameter** (F-1). "Threading the tx" cannot be done there without
   first rewriting it into the canonical shape — at which point you have written the canonical function twice.
2. **The fork silently breaks the detector you are about to build.** It drops `invoiceId`/`paymentId`
   (F-1), so R-22's orphan check would report every `finance.ts`-posted entry as an orphan — you would spend
   the first week of remediation chasing false positives created by the duplicate.
3. **Consolidation is mechanical, small, and independently revertable.** The pattern already exists in-repo
   (`finance.ts:2133`, F-2), it is `'use server'`-legal, and it changes **zero** of the 20 UI import sites.
   The reviewable diff is "delete ~100 lines, add 4."
4. **Fix-both doubles the surface of the highest-risk work.** R-01b is the deep surgery of this entire plan.
   Doing it twice, in two divergent shapes, in a system where the two copies have already drifted, is how the
   fork happened in the first place.
5. **The risk asymmetry is stark.** Consolidation's worst case is a signature mismatch, caught at review or by
   a type test. Fix-both's worst case is that the two copies drift *again* and production keeps running the
   wrong one — the status quo the audit found.

**Therefore:** R-01a (`postJournalEntry` delegation) is the **first application-code change** of the
remediation, ahead of every atomicity fix. Each subsequent delegation is its own commit.

*One caveat, honoured in R-01a's Risk section:* the fork is not a strict subset — it carries a `logAudit` call
(`finance.ts:404-415`) the canonical lacks. Port that first, in the same PR. Do not lose an audit trail while
fixing the books.

### 6.2 Milestones

Ordering satisfies: **(a)** detection before correctness — R-12 → R-22 lands before R-01b/R-02 so silent bugs
become loud *and measurable*; **(b)** primitives before dependents — integration harness, idempotency table,
`DocumentCounter` backfill, and NSFP schema all precede the fixes that consume them; **(c)** governance
resolved first, per §6.1.

---

#### **M0 — OPERATIONS (day 0, zero code, runs in parallel with everything)**
| # | Item | Finding | Effort |
|---|---|---|---|
| O-1 | **Rotate the Postgres password** committed in `DB_CONNECTION_FIX.md`; update every deploy env; then scrub the file | R-24 | S |
| O-2 | **Verify `?pgbouncer=true`** is present in the real `DATABASE_URL`; if absent, add it (prevents intermittent `prepared statement "s0" already exists`) | R-05 | S |
| O-3 | **Confirm the platform function timeout** and the pooler's true connection ceiling; reconcile against `connection_limit` (`lib/db.ts:22`) | R-05 | S |
| O-4 | **Confirm Xendit's webhook retry/backoff policy** and callback-token config before R-07 changes the response code | R-07 | S |
| O-5 | **Provision a CI/test Postgres** (branch DB or container) — hard prerequisite for R-19 | R-19 | S |
| O-6 | Run the production baseline queries: negative stock, duplicate document numbers, orphan invoices, `credit_notes` row count | R-04/R-17/R-22/R-25 | S |

**O-6 is the highest-value hour in this plan.** It tells you whether the books are *already* wrong, which
changes how urgently everything below is scheduled.

#### **M1 — Detection, governance, and enablement (make bugs loud before fixing them)**
| # | Item | Finding | Effort | Parallel? |
|---|---|---|---|---|
| 1.1 | `@@index` migration (`CREATE INDEX CONCURRENTLY`) | R-12 | S | ✅ |
| 1.2 | `/api/health` + `lib/logger.ts` + Sentry via `instrumentation.ts` | R-21 | S/M | ✅ |
| 1.3 | Six missing `error.tsx` boundaries | R-28 | S | ✅ |
| 1.4 | `typecheck` script + baseline + CI ratchet (steps 1–3 only) | R-23 | S | ✅ |
| 1.5 | **`postJournalEntry` fork → delegating re-export** (port `logAudit` first) | R-01a | S | ⚠️ serialize (finance.ts) |
| 1.6 | Integration-test harness (`vitest.integration.config.ts`) | R-19 | M | ✅ |
| 1.7 | `/api/admin/integrity-check` — **depends on 1.1** | R-22 | M | after 1.1 |
| 1.8 | `gl-atomicity-guard` + `finance-action-canonicality` + `no-hardcoded-gl-codes` guard tests | R-01d, R-30 | S | ✅ |
| 1.9 | PO state-machine transition-table test (pure logic, zero deps) | R-16/R-20 | S | ✅ |

**Exit criterion:** you can *measure* the problem. Run 1.7 against production and record the orphan count,
trial-balance delta, and stock discrepancies. **That number is the remediation's KPI.**

#### **M2 — Infrastructure primitives (unblock the fixes that need them)**
| # | Item | Finding | Effort | Depends on |
|---|---|---|---|---|
| 2.1 | `ProcessedWebhookEvent` model + migration | R-07 | S | — |
| 2.2 | `DocumentCounter` backfill migration (per prefix, from production maxima) | R-17 | M | O-6 |
| 2.3 | `NSFPRange` model + `Invoice.nsfpNumber @unique` (**does not exist today** — F-5) | R-03 | M | — |
| 2.4 | Migration pre-check script + `MIGRATION_POLICY.md` | R-25, R-26 | S | — |
| 2.5 | Remaining `finance.ts` delegations (vendor payment, approve+pay, credit note) | R-01a | M | 1.5 |
| 2.6 | `lib/with-timeout.ts` shared helper (extracted from `middleware.ts:54-56`) | R-15, R-27 | S | — |

**All schema items (2.1–2.4, plus 1.1) touch `prisma/schema.prisma` → strictly serialized, one owner.**

#### **M3 — Atomicity (the deep surgery; one flow per PR)**
| # | Item | Finding | Effort | Depends on |
|---|---|---|---|---|
| 3.1 | `createInvoiceFromSalesOrder` atomic (canonical, then delegate) | R-02 | M | 1.5, 1.6, 1.7 |
| 3.2 | AP: `recordVendorPayment`, `recordMultiBillPayment`, `approveAndPayBill` | R-01b | M | 2.5 |
| 3.3 | `postDepreciationRun` (hoist the loop) + `createAssetMovement` | R-01b | M | 3.2 |
| 3.4 | HCM payroll disburse + `approvePayrollRun` | R-01b | M | 1.6 |
| 3.5 | `postPPNSettlement`, `closeReconciliation` | R-01b | S | 3.2 |
| 3.6 | Class B: `createSalesReturn` (+R-30), `postWIPAdjustment`, `markWithholdingDeposited` | R-01c | M | 1.6 |
| 3.7 | Decide liveness of `sales.ts:279/361`: delete or wrap | R-01c, R-30 | S | — |

**Gate between every PR:** run `/api/admin/integrity-check`. Orphan count must be **non-increasing**.

#### **M4 — Concurrency & idempotency**
| # | Item | Finding | Effort | Depends on |
|---|---|---|---|---|
| 4.1 | Stock `gte` guards (WO route, subcontract, reservations) | R-04 | M | 1.6 |
| 4.2 | `CHECK (quantity >= 0)` migration (after the O-6 pre-check) | R-04/R-13 | S | 4.1, O-6 |
| 4.3 | Status-transition guards (SO route, `submitPOForApproval`, `rejectPurchaseOrder`) | R-16 | S | 1.9 |
| 4.4 | Numbering → `getNextDocNumber`, one prefix per PR | R-17 | M | 2.2 |
| 4.5 | Atomic NSFP `{increment}` | R-03 | S | 2.3 |
| 4.6 | Xendit webhook rewrite (idempotency row + GL + non-2xx) | R-07 | M | 2.1, O-4 |

#### **M5 — Availability under load**
| # | Item | Finding | Effort | Depends on |
|---|---|---|---|---|
| 5.1 | `withPrismaRead` primitive + `getUser` 5s bound (**one PR, `lib/db.ts` exclusive**) | R-05, R-27 | M | 2.6 |
| 5.2 | `connection_limit` reconciliation (env-driven) | R-05 | S | O-3 |
| 5.3 | `maxDuration` + `AbortController` on Xendit / Typst / Excel | R-15 | M | 2.6 |
| 5.4 | `cache-warm`: auth + real caching + allowlist, drop the self-fetch | R-10 | S | — |
| 5.5 | Migrate read paths to `withPrismaRead` (dashboard, reports, then per-module) | R-05 | L | 5.1 |
| 5.6 | `CACHE_TIERS` + exclude financial queries from IndexedDB | R-11 | S | — |
| 5.7 | `AbortController` signals in TanStack queries | R-32 | S | 5.6 |

#### **M6 — Truthful reads**
| # | Item | Finding | Effort | Depends on |
|---|---|---|---|---|
| 6.1 | Dashboard per-section status + `degraded` flag + widget states | R-06 | M | — |
| 6.2 | `Result<T>` type + finance reads | R-08 | M | 1.4 |
| 6.3 | Procurement reads + kill production fallbacks (**merge R-08 & R-09**) | R-08, R-09 | M | 6.2 |
| 6.4 | Inventory / sales / HCM reads | R-08 | M | 6.2 |
| 6.5 | `ceo-flags.ts:82` — stop masking a missing migration as `[]` | R-08 | S | — |

#### **M7 — Coverage, policy, and cleanup**
| # | Item | Finding | Effort |
|---|---|---|---|
| 7.1 | API-route auth: `fix-cn-partial` first, then batches of 10 | R-14 | M |
| 7.2 | WO-completion GL (**requires accountant sign-off on the valuation formula**) | R-18 | L |
| 7.3 | `InventoryTransaction.quantity` → `Decimal` + code ripple | R-13 | M |
| 7.4 | Consolidate/delete `receiveGoodsFromPO` | R-29 | M |
| 7.5 | Audit-log `warn` logging | R-31 | S |
| 7.6 | Type-error burn-down → remove `ignoreBuildErrors` | R-23 | L |
| 7.7 | Opportunistic `console.*` → `logger` migration | R-21 | L |

---

## 7. PARALLELIZATION PLAN (CLAUDE.md multi-session file scoping)

**Exclusive-lock files — one session, one open PR at a time, no exceptions:**

| File | Why | Owner |
|---|---|---|
| `prisma/schema.prisma` | every schema item collides (R-03, R-04, R-12, R-13, R-07) | **Schema session** |
| `lib/db.ts` | every server action depends on it (R-05, R-27) | **Backend session** |
| `lib/actions/finance.ts` | consolidation target (R-01a, R-02, R-30) | **Finance-backend session** |
| `lib/query-client.tsx` | global provider (R-11, R-32) | **Frontend session** |
| `lib/gl-accounts.ts` + `prisma/seed-gl.ts` | new `SYS_ACCOUNTS` from R-01c, R-18, R-30 | **Finance-backend session** |

**Session assignment (non-overlapping scopes):**

| Session | Scope | Owns |
|---|---|---|
| **S1 Schema/DB** | `prisma/**`, `lib/db.ts` | 1.1, 2.1–2.4, 4.2, 5.1, 5.2, 7.3 |
| **S2 Finance-backend** | `lib/actions/finance*.ts` | 1.5, 1.7, 2.5, 3.1–3.3, 3.5, 6.2 |
| **S3 Ops/Manufacturing** | `app/api/manufacturing/**`, `lib/actions/subcontract.ts`, `stock-reservations.ts`, `finance-wip.ts` | 4.1, 3.6 (WIP part), 7.2 |
| **S4 Sales/Procurement** | `lib/actions/sales.ts`, `procurement.ts`, `grn.ts`, `app/api/sales/**` | 3.6 (sales return), 3.7, 4.3, 6.3, 6.4 |
| **S5 HCM** | `app/actions/hcm.ts`, `app/hcm/**` | 3.4, 4.4 (payroll prefix) |
| **S6 Platform/Frontend** | `app/api/health`, `instrumentation.ts`, `error.tsx`, `lib/query-client.tsx`, `hooks/**` | 1.2, 1.3, 1.4, 5.4, 5.6, 5.7, 6.1 |
| **S7 Test/CI** | `__tests__/**`, `vitest*.config.ts`, CI | 1.6, 1.8, 1.9, and every test in the plan |

**Safe to run fully in parallel (no file overlap):**
`1.1 ∥ 1.2 ∥ 1.3 ∥ 1.4 ∥ 1.6 ∥ 1.8 ∥ 1.9` — all of Milestone 1 except 1.5 and 1.7.
`5.4 ∥ 5.6 ∥ 6.1` — different modules.
`3.4 (HCM) ∥ 3.6 (sales return) ∥ 4.1 (manufacturing)` — different owners, different files.

**Must be serialized:**
- 1.5 → 2.5 → 3.1/3.2 — all touch `lib/actions/finance.ts`.
- 1.1 → 1.7 — the integrity checker needs the indexes to be fast enough to schedule.
- 2.2 → 4.4 — the counter backfill must precede any switch to `getNextDocNumber`.
- 2.1 → 4.6 — the idempotency table must exist before the webhook uses it.
- 2.3 → 4.5 — the NSFP model must exist before the counter can be made atomic.
- 4.1 → 4.2 — application guards land and soak before the CHECK constraint.
- 5.1 → 5.5 — the primitive before its adopters.
- All `prisma/schema.prisma` items, one at a time, regardless of module.

**Given the small clean working tree observed at planning time** (`git status --porcelain` → empty, branch
`claude/security-audit-prompt-x773ot`), start by branching per session and honouring the CLAUDE.md worktree
recommendation for S1/S2 in particular, since their files are the highest-collision.

---

## 8. DO FIRST / DO NOT TOUCH YET

### ✅ DO FIRST — safe to start this hour, in parallel, by different people

1. **O-1 rotate the DB password** (ops, no code — the clock has been running since it was committed).
2. **O-6 run the baseline queries.** Negative stock, duplicate numbers, orphan invoices. One hour, and it
   tells you whether this is a *prevention* project or an *incident*.
3. **1.1 the `@@index` migration.** Pure win, zero consumers, unblocks the detector. (`CONCURRENTLY`.)
4. **1.3 the six `error.tsx` files.** Copy-paste, zero risk, immediate UX improvement.
5. **1.2 `/api/health` + `logger.ts`.** New files only.
6. **1.4 `tsc --noEmit` baseline.** Does not change the build yet; produces the map for R-08/R-13.
7. **1.9 the PO state-machine test.** Pure logic, no dependencies, closes a zero-coverage area on a
   13-status machine.
8. **1.6 the integration harness.** Nothing downstream is provable without it.
9. **1.5 `postJournalEntry` → delegation** (port `logAudit` first). The gate for all of Milestone 3.

### ⛔ DO NOT TOUCH YET — these will hurt you if started early

1. **Any Class A/B atomicity fix (R-01b/R-01c/R-02) before 1.5 lands.** You would be fixing the copy that
   production does not run, and — for `postJournalEntry` — you *cannot* fix the live copy without
   consolidating first (F-1).
2. **`CHECK (quantity >= 0)` (4.2) before the O-6 pre-check and before 4.1 has soaked.** A single pre-existing
   negative row aborts the migration mid-deploy — precisely R-26's failure mode.
3. **Flipping `ignoreBuildErrors: false` (R-23 step 5).** Given F-5, the codebase certainly does not typecheck
   today. Ratchet; do not flip.
4. **`getNextDocNumber` cutover (4.4) before the `DocumentCounter` backfill (2.2).** Numbering restarts at 1
   and collides with existing documents.
5. **The Xendit webhook rewrite (4.6) before O-4.** Changing 200 → 500 changes provider behaviour; confirm the
   retry policy before you rely on it.
6. **The R-08 `Result<T>` conversion before R-23 steps 1–3.** Without a type-checker, Ripple Check Phase 5
   across ~80 read functions is manual and will miss consumers.
7. **The 799 `console.*` → `logger` sweep.** It touches nearly every file and will conflict with every other
   session's diff. Opportunistic migration only.
8. **Enabling the e-Faktur UI.** F-5: the model does not exist; the feature cannot work, and turning it on
   after 2.3 but before 4.5 is what would actually produce duplicate legal tax serials.
9. **`R-05` read-path migration (5.5) on financial reports.** Neraca / Neraca Saldo / Laba Rugi need a
   consistent snapshot; leaving those in a transaction is the correct trade for an accounting system.

---

## 9. QUICK WINS vs DEEP SURGERY

### Quick wins — cheap, safe, independently revertable (target: all of these in week 1)

| Item | Finding | Effort | Why it's safe |
|---|---|---|---|
| `@@index` migration | R-12 | S | zero code consumers; `DROP INDEX` to revert |
| Six `error.tsx` files | R-28 | S | new leaf files only |
| `/api/health` | R-21 | S | new route, reads nothing sensitive |
| `logger.ts` | R-21 | S | new file; adopt opportunistically |
| `typecheck` script + baseline | R-23 (1–3) | S | reporting only, no build change |
| `lib/with-timeout.ts` | R-15/R-27 | S | extracted from proven `middleware.ts` code |
| `cache-warm` auth + allowlist | R-10 | S | one file; removes an attack surface |
| Status-transition guards | R-16 | S | pattern copied verbatim from `procurement.ts:991` |
| `CACHE_TIERS` | R-11 | S | one file; defaults unchanged |
| Guard tests (atomicity / canonicality / hardcoded codes) | R-01d/R-30 | S | test-only; prevents regression |
| PO state-machine test | R-16/R-20 | S | pure logic |
| Audit-log `warn` | R-31 | S | log-level only |
| Migration pre-check script | R-26 | S | read-only script |

### Deep surgery — needs a senior owner, integration tests, and staged rollout

| Item | Finding | Effort | Why it's hard |
|---|---|---|---|
| **GL atomicity consolidation + tx threading** | R-01a/b/c | L | forked signatures, 20 consumers, `assertPeriodOpen` skip (F-3), throw-vs-return (F-4), 8+ money flows |
| `createInvoiceFromSalesOrder` | R-02 | M | live path; also needs a PPN-split decision |
| Read-path detransactionalization | R-05 | L | `lib/db.ts` is the highest-fan-out file; snapshot-consistency trade-offs |
| `Result<T>` conversion (~80 reads) | R-08 | L | signature change × many consumers; needs a type-checker |
| Xendit webhook rewrite | R-07 | M | live money path; provider-behaviour change |
| Numbering cutover + backfill | R-17 | M | backfill must be exactly right per prefix |
| WO-completion GL | R-18 | L | **new accounting policy**, not a bug fix; needs accountant sign-off |
| `InventoryTransaction` → `Decimal` | R-13 | M | wide arithmetic ripple |
| Type-error burn-down | R-23 (4–5) | L | unknown error count, cross-module |

---

## 10. OPERATIONS-NOT-CODE ITEMS (explicit callout)

These cannot be fixed by a pull request. **Assign them to a human with production access today.**

| # | Action | Finding | Why code cannot fix it |
|---|---|---|---|
| **O-1** | **Rotate the Postgres password** committed in `DB_CONNECTION_FIX.md`; update `DATABASE_URL`/`DIRECT_URL` in Vercel, CI, local `.env`, and `.mcp.json` consumers; **then** scrub the file | R-24 | The secret is in git history. Editing or deleting the file does not un-publish it — every existing clone still has it. Only rotation invalidates it. |
| **O-2** | **Verify `?pgbouncer=true`** is present in the production `DATABASE_URL` | R-05 | `lib/db.ts:16-23` deliberately does not add it — it depends on the operator's env. Its absence causes intermittent `prepared statement "s0" already exists` against pgbouncer transaction mode. **UNVERIFIED in the audit; verify before tuning anything else.** |
| **O-3** | **Confirm the platform function timeout** and the pooler's real connection ceiling; reconcile against `connection_limit=10` (`lib/db.ts:22`) vs the comment claiming 5 (`:14-15`) | R-05 | The correct `maxDuration` and `connection_limit` values are properties of the deployment, not the code. Guessing produces either premature kills or a pool blowout. |
| **O-4** | **Confirm Xendit's webhook retry/backoff and dead-letter policy**; verify the callback-token secret is configured | R-07 | R-07 deliberately changes 200 → 500 so the provider retries. If Xendit does not retry, or retries only twice, that change *loses* events instead of recovering them. |
| **O-5** | **Provision a CI/test Postgres** (Supabase branch DB or a container service) | R-19 | Every `[real-DB REQUIRED]` test in this plan is unwritable without it. |
| **O-6** | **Run the production baseline queries** (negative stock, duplicate numbers, orphan invoices, `credit_notes` row count) | R-04/R-17/R-22/R-25 | Determines whether the books are *already* wrong — i.e. whether this is a remediation project or an active incident. Also a hard precondition for the R-04 CHECK constraint and the R-17 backfill. |
| **O-7** | **Decide the WO finished-goods valuation formula** with the accountant | R-18 | An accounting-policy decision. Implementing it without sign-off means posting confidently wrong numbers to the ledger. |

---

## 11. EFFORT SUMMARY

| Finding | Sev | Effort | Milestone | Parallel-safe |
|---|---|---|---|---|
| R-01a governance consolidation | 1 | M | M1.5 / M2.5 | ⚠️ serialize (`finance.ts`) |
| R-01b Class A tx threading | 1 | **L** | M3.2–3.5 | ⚠️ one flow per PR |
| R-01c Class B wrapping | 1 | M | M3.6 | ✅ (different files) |
| R-01d atomicity guard test | 1 | S | M1.8 | ✅ |
| R-02 invoice-from-SO atomic | 1 | M | M3.1 | ⚠️ after R-01a |
| R-03 NSFP (schema + atomic) | 1 | M | M2.3 → M4.5 | ⚠️ schema serialize |
| R-04 stock guards + CHECK | 1 | M | M4.1, M4.2 | ✅ then ⚠️ |
| R-05 connection design | 1 | **L** | M5.1, 5.2, 5.5 | ⚠️ `lib/db.ts` exclusive |
| R-06 dashboard error state | 1 | M | M6.1 | ✅ |
| R-07 webhook idempotency+GL | 1 | M | M2.1 → M4.6 | ✅ |
| R-08 typed read results | 1 | **L** | M6.2–6.5 | ✅ one module per PR |
| R-09 kill prod fallbacks | 1 | S | M6.3 | ✅ (merge with R-08) |
| R-10 cache-warm | 2 | S | M5.4 | ✅ |
| R-11 client cache tiers | 2 | S | M5.6 | ✅ |
| R-12 indexes | 2 | **S** | **M1.1** | ✅ |
| R-13 Decimal ledger | 2 | M | M7.3 | ⚠️ schema serialize |
| R-14 API-route auth | 2 | M | M7.1 | ✅ batches of 10 |
| R-15 timeouts / maxDuration | 2 | M | M5.3 | ✅ |
| R-16 transition guards | 2 | S | M4.3 | ✅ |
| R-17 numbering | 2 | M | M2.2 → M4.4 | ⚠️ one prefix per PR |
| R-18 WO completion GL | 2 | **L** | M7.2 | ⚠️ needs O-7 |
| R-19 integration harness | 2 | M | **M1.6** | ✅ |
| R-20 zero-coverage areas | 2 | M | distributed | ✅ |
| R-21 observability | 3 | S/M | M1.2 | ✅ |
| R-22 integrity check | 3 | M | M1.7 | ⚠️ after R-12 |
| R-23 typecheck ratchet | 3 | S / **L** | M1.4 / M7.6 | ✅ |
| R-24 credential rotation | 3 | S | **M0-O1** | ops |
| R-25 migration policy | 3 | S | M2.4 | ✅ |
| R-26 migration pre-check | 3 | S | M2.4 | ✅ |
| R-27 auth timeout | 3 | S | M5.1 | ⚠️ with R-05 |
| R-28 error boundaries | 3 | **S** | **M1.3** | ✅ |
| R-29 duplicate receive path | 4 | M | M7.4 | ✅ |
| R-30 hardcoded codes/rates | 4 | S | folded into M3 | ✅ |
| R-31 audit-log warn | 4 | S | M7.5 | ✅ |
| R-32 client abort signals | 4 | S | M5.7 | ✅ |

**Rough totals:** S ≈ 16 items · M ≈ 12 · L ≈ 6. Milestones M0+M1 are almost entirely S and can land in a week
with 3–4 parallel sessions. M3 (atomicity) is the long pole and should be sequenced one flow at a time
regardless of available capacity — **parallelism does not help correctness work on a shared ledger.**

---

## 12. Per-PR definition of done

Every PR in this plan:

- [ ] Ripple Check output block pasted in the description (function, canonical file, duplicates found,
      consumers verified N/N, GL impact → reports, type changes).
- [ ] `npx vitest` green; `npm run test:integration` green where the item is `[real-DB REQUIRED]`.
- [ ] `npm run lint` green; `npm run typecheck` count not increased.
- [ ] For any finance change: `/api/admin/integrity-check` run before and after, orphan count non-increasing,
      trial balance still balanced.
- [ ] No new `SYS_ACCOUNTS`-bypassing string literal; no new numeric tax-rate literal.
- [ ] No new function added to `lib/actions/finance.ts`.
- [ ] Only files in this session's declared scope are staged (`git add <file>`, never `git add .`).
- [ ] A CLAUDE.md **Sebelumnya / Sekarang / Kenapa penting** note where the change is user-visible.
