# ADR-0004 · Idempotency via a unique record written inside the operation's transaction

**Status:** Proposed · **Date:** 2026-07-27 · **Deciders:** platform lead, finance lead
**Blocking:** this is Phase 0 gate item **G-01**, the single most important agent-safety primitive.

## Context

Verified: there is **no** idempotency model anywhere in `prisma/schema.prisma` (grep for
`idempot|processed_?operation` across `prisma/` → zero matches). `AuditLog`
(`schema.prisma:3664-3679`) cannot substitute — it has no unique constraint at all. No mutation in
`lib/actions/procurement.ts` or `lib/actions/grn.ts` accepts a key.

Traced concretely on the best-written write path in the repo:

1. Agent calls `receiveGoods`. Server commits at t=19.8 s. Client deadline fires at t=20.0 s.
2. Agent retries. `grn.ts:448` runs `updateMany({where:{id, status:'DRAFT'}})` → `count === 0` →
   `grn.ts:457` throws `'GRN sudah diproses atau tidak ditemukan.'`
3. The agent is told its operation **failed**. It succeeded.
4. Plausible recovery: create another GRN. `createGRN` (`grn.ts:262`) has no key, and its only protection
   is the remaining-quantity check at `:332-341` — which blocks a retried **full** receipt but **permits a
   retried partial receipt**, producing a second GRN and a second `DR 1300 / CR 2150`.

Idempotency here is quantity-dependent, not structural. `lib/db.ts:152-184` also retries transparently one
layer down, so retries are not hypothetical.

## Decision

`AgentOperationRecord`, `@@unique([principal, operationId, idempotencyKey])`, holding `requestHash`,
`status (IN_FLIGHT|SUCCEEDED|FAILED)`, `resultJson`, `correlationId`. Inserted as the **first statement
inside the operation's `$transaction`**.

- `P2002` + `SUCCEEDED` ⇒ replay `resultJson` verbatim, `replayed:true`, `code:'REPLAYED'`.
- `P2002` + `IN_FLIGHT` ⇒ `IN_PROGRESS`, retryable with backoff. Swept after the 20 s tx timeout + margin.
- Same key, different `requestHash` ⇒ `IDEMPOTENCY_KEY_REUSED`, severity `E`, **never** silently honoured.
- The key is minted at `propose` and carried on the proposal, so the agent cannot mint a fresh one at
  `confirm` and defeat the control.

## Consequences

**Positive.** Retry is safe by construction, not by luck. Because the record commits with the document, a
genuine rollback releases the key — so retrying a real failure with the *same* key is correct, which is
exactly what a retrying agent does. It also gives the agent a truthful answer to "did my call land?", the
question it otherwise cannot answer.

**Negative.** One extra write per mutation and a new failure mode (a stuck `IN_FLIGHT` row), handled by
the sweeper. Requires extending canonical action signatures to accept the key and thread it into their
existing transaction.

**Rejected alternatives.**
- *Key table outside the transaction* — reintroduces the exact "did it commit?" gap it exists to close.
- *Natural-key dedupe (e.g. unique on `(poId, receivedDate, lines)`)* — a legitimate second partial
  receipt on the same day is indistinguishable from a retry.
- *Rely on the guarded status transition alone* — this is today's behaviour, and it returns **failure for
  success**, which is what causes the duplicate.

**Recommended second line of defence.** `JournalEntry.inventoryTransactionId` (`schema.prisma:2294`) is
nullable and non-unique, and the reverse relation is one-to-many (`schema.prisma:429`); `JournalEntry` has
no `number` field and its `reference` (`:2276`) is not unique. Nothing at the DB level prevents posting the
same inventory transaction twice. Add a partial unique index.
