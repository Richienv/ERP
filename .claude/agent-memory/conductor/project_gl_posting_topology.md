---
name: GL posting topology — where cross-module invariants actually break
description: postJournalEntry's txClient path skips the fiscal-period lock, COGS has two competing posting paths, runIntegrityChecks is dead code, and finance.ts holds live stale copies.
type: project
---

Four structural facts about how GL posting is wired. All four are load-bearing when
planning ANY cross-module financial feature.

1. **`postJournalEntry(data, txClient)` only calls `assertPeriodOpen` on the
   standalone path** (`lib/actions/finance-gl.ts`, the `if (txClient)` early return).
   Every module posting passes a txClient, so the month-end lock is enforced only by
   whatever the *caller* remembers to do. Several callers post with a user-supplied
   or source-document date while checking `assertPeriodOpen(new Date())` — that
   combination is a silent backdate into a closed period.

2. **COGS / Inventory relief has two independent posting paths** that both fire in
   the normal Order-to-Cash flow: `postInventoryGLEntry('SO_SHIPMENT')` at shipment
   (`lib/actions/sales.ts`) and the COGS-recognition block in `moveInvoiceToSent`
   (`lib/actions/finance-invoices.ts`). Shipment auto-creates the invoice, so both
   run for the same goods. Neither checks the other.

3. **`runIntegrityChecks()` (`lib/actions/finance-gl.ts`) has no callers.** It
   implements AR/AP subledger-vs-GL tie-out, trial balance, and the balance-sheet
   equation. `lib/actions/finance-close.ts` deliberately skips it (comment: "that
   helper upserts system accounts"). It has no Inventory-vs-1300 and no GR/IR-2150
   check.

4. **`lib/actions/finance.ts` is not purely a re-export shim.** Some exports delegate
   to the canonical domain file, but others (`createCreditNote`, `createDebitNote`,
   `recordExpense`, the aging reports) are full independent implementations, and UI
   files import them directly. `createCreditNote` there writes `prisma.journalEntry.create`
   and mutates `GLAccount.balance` by hand, bypassing `postJournalEntry` entirely.

**Why:** These are the root causes behind repeated "books don't tie out" reports. They
are not visible from reading any single module — each one only appears when you trace
a flow across two modules.

**How to apply:** When designing a cross-module plan, do not assume "it goes through
`postJournalEntry`, so the period lock and the invariants hold." Require each plan to
name (a) the date the journal is posted on and the date the period check uses, and
(b) every other code path that already relieves the same account. Before recommending
`finance.ts` as an import source, check whether that specific export delegates or
duplicates.
