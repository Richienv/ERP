---
name: The 78-file test suite reimplements logic instead of importing it
description: Most __tests__ files define a local copy of the rule under test, so passing tests do not prove the server action behaves correctly — several assert behavior the real code does not have.
type: project
---

The bulk of `__tests__/` tests helper functions **defined inside the test file itself**
rather than importing the server action. `fiscal-period-enforcement.test.ts` is the
clearest example: its docstring says "postJournalEntry() must reject", it defines a
local `validateFiscalPeriod()`, and asserts "should block system-generated entries to
closed periods" — which the real `postJournalEntry` does **not** do on the txClient
path. `cogs-recognition.test.ts` has the same shape and therefore cannot see the
duplicate COGS posting.

Genuinely-imported-logic tests do exist (`bill-from-received.test.ts`,
`invoice-posting-accounts.test.ts`, `payroll-gl.ts` helpers) — those are the ones
worth trusting, and they exist because the logic was extracted into a pure
`lib/*.ts` helper first.

**Why:** It makes the suite actively misleading for audit purposes: a green run reads
as "invariants enforced" when it only means "a copy of the rule is self-consistent."

**How to apply:** Never cite a passing test as evidence an invariant holds — open the
test and check whether it imports the real function. When planning finance work,
prefer the pattern that already works here: extract the rule into a pure helper in
`lib/` (like `lib/payroll-gl.ts` or `lib/bill-from-received.ts`), then have both the
server action and the test import it.
