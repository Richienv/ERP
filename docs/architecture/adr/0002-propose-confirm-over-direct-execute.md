# ADR-0002 · Propose → confirm, not direct execute

**Status:** Proposed · **Date:** 2026-07-27 · **Deciders:** platform lead, finance lead, CEO

## Context

Locked decision (design prompt §1): tiered autonomy. This ADR records *why*, and the non-obvious
mechanics that make it real rather than ceremonial.

This ERP is a double-entry system of record. A wrong number that looks right is worse than an outage,
because an outage is noticed. The agent's proposals are generated from ERP data that includes
attacker-influenceable free text (`Supplier.name`, `GRNItem.inspectionNotes`,
`PurchaseRequest.notes`), so a plausible-looking proposal is exactly what an injection produces.

## Decision

Every mutation is two calls. `operation(args, dryRun:true)` returns a `proposalId`, a Bahasa diff, and the
simulated GL/stock effect. `agent.confirmProposal(proposalId)` executes. Money above threshold requires a
human approver who is not the agent's `onBehalfOfHuman`.

Three mechanics that turn this from ceremony into a control:

1. **The confirm carries only a `proposalId`.** The parameters executed are the ones stored server-side on
   the proposal, not resent by the model. An injected instruction in turn *n+1* cannot alter what a
   proposal approved in turn *n* does.
2. **`stateFingerprint`.** A hash over every entity `updatedAt`, every displayed status/quantity/amount,
   **and derived facts** such as a PO line's remaining quantity — recomputed inside the transaction before
   any write. Mismatch ⇒ `PROPOSAL_STALE`, no write. `updatedAt` alone is insufficient because a sibling
   GRN's acceptance changes what the diff meant without touching the PO row.
3. **The proposal is a database row, not an open transaction.** The transaction opens at confirm. Holding
   one across an agent turn would consume a connection from a pool of 10 (`lib/db.ts:22`) for the duration
   of the model's thinking, which is the failure mode ADR-0004 exists to avoid.

## Consequences

**Positive.** A human sees the actual journal entry before it is a journal entry. Latency for a wrong
action is bounded by review, not by discovery. `dryRun` doubles as the SAP TESTRUN equivalent. Proposals
are auditable artefacts — the exact rendered Bahasa diff is stored verbatim.

**Negative.** Every write is two round trips and needs a diff renderer. Review fatigue is a real failure
mode: a human who rubber-stamps 200 proposals is not a control. Mitigated by measuring the unmodified-
approval rate — paradoxically, a rate ≥ 98 % is what *justifies* promoting an operation to self-confirm at
Stage 3, so the metric turns fatigue into a signal rather than a silent weakness.

**Rejected alternative — direct execute with post-hoc reversal.** Reversal requires a working reversal
path. `createPurchaseReturn` (`procurement.ts:2530`) currently has no `assertRole` and an unguarded
`returnedQty` increment (`:2648-2651`). You cannot build "undo later" on an undo that is itself unsafe.
