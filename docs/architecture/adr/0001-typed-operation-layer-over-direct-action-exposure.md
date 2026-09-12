# ADR-0001 · A typed operation layer, not direct server-action exposure

**Status:** Proposed · **Date:** 2026-07-27 · **Deciders:** platform lead, finance lead

## Context

The obvious cheap path is to expose the existing `"use server"` actions to the agent directly — there are
~58 such files and they already encode the business logic. The procurement slice alone offers 41 exported
functions in `lib/actions/procurement.ts`.

But those functions were written for a browser calling them from a form. Verified consequences of exposing
them as-is:

- Return shapes are inconsistent: `{success, error}`, bare arrays, `null`, and `{success:false, data:[]}`
  all appear within one file (`procurement.ts:157, 499, 1387, 2524`).
- Errors are raw Bahasa `Error.message` strings an agent cannot pattern-match
  (`grn.ts:457`, `procurement.ts:1000`).
- Reads swallow DB failures into fabricated data (`procurement.ts:157-159` returns `FALLBACK_VENDORS`).
- Some exports are unauthenticated (`procurement.ts:1069, 1545, 1660, 1746, 1834`) and one is
  permanently broken (`cancelPurchaseOrder` destructures a second callback argument
  `withPrismaAuth` never supplies — `procurement.ts:1071` vs `lib/db.ts:42`).
- None accepts an idempotency key.

Exposing this surface to a retrying, concurrent client makes every one of those a production defect.

## Decision

Introduce `lib/agent/operations/<domain>/<op>.ts` as the contract. Operations wrap **canonical** server
actions. The agent never sees a server action, Prisma, SQL, or a table name.

## Consequences

**Positive.** One return envelope (`AgentResult`). Stable error codes decoupled from Bahasa strings.
`dryRun`, idempotency, capability, and SoD implemented once instead of 41 times. A defective action is
excluded by *not writing an operation for it* — no code change needed. The UI and the agent can diverge
safely.

**Negative.** A second layer to keep in sync; drift is possible. Mitigated by binding every operation to
an explicit `boundAction` (`path:line`) and adding a catalog lint that asserts the target resolves to an
allowlisted canonical module. Real work per operation is ~100 lines, not a wrapper one-liner.

**Rejected alternative — auto-generate tools from Zod schemas of the actions.** The actions have no Zod
schemas, and generation would faithfully reproduce the unguarded and unauthenticated ones. Automation of a
defective surface scales the defect.
