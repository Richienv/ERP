# ADR-0005 · Agent identity and capability independent of the existing role system

**Status:** Proposed · **Date:** 2026-07-27 · **Deciders:** platform lead, security owner

## Context

The natural approach is to mint an agent user with a role — `ROLE_PURCHASING` — and let the existing
`assertRole` checks do the work. Verified state of that system on 2026-07-27:

- **`assertRole` auto-grants `ADMIN`** (`lib/authz.ts:64-72`). `normalizeRole` (`:60-62`) uppercases and
  strips a `ROLE_` prefix, so `ROLE_ADMIN`, `admin`, `Admin` all collapse to `ADMIN` and bypass every
  allow-list.
- **The role is read from Supabase `user_metadata` first** (`lib/authz.ts:19-21`). The DB `User` row is
  consulted only `if (!role || !employeeId)` (`:24`) and applied only `if (!role)` (`:34`) — the database
  can never override metadata. `user_metadata` is client-writable via
  `supabase.auth.updateUser({ data: { role: 'ADMIN' } })`.
- **A DB failure degrades rather than denies:** caught and logged at `lib/authz.ts:44-46`, falling back to
  `ROLE_STAFF` (`:49`).
- **Two divergent implementations disagree:** `lib/auth/role-guard.ts:63-66` does not strip the `ROLE_`
  prefix, so `ROLE_CEO` fails an allow-list of `CEO` there but passes in `authz.ts`; and its
  `getCurrentUserRole` returns `null` on a DB error (`:42-45`) where `authz.ts` returns a default.
- Identifiers differ: `getAuthzUser().id` is the **Supabase auth UUID** (`lib/authz.ts:52`), not the
  Prisma `User.id`.

An agent credential layered on this has a self-service path to `ADMIN`.

## Decision

The agent's authority comes from a **signed session grant** carrying
`(agentPrincipal, onBehalfOfHuman, capabilities[], tenant, limits, deadline)`, verified server-side on
every call. Capability is `(operation × scope × limit)`, never a role. The grant:

- is signed with a key the Supabase project does not hold;
- resolves `onBehalfOfHuman.userId` to the **Prisma `User.id`** at mint time and stores both identifiers;
- reads nothing from `user_metadata`;
- is refused at mint time if the named human has no active `Employee` record;
- is evaluated at L2 **before** the canonical action's own `assertRole` runs.

Existing `assertRole` calls inside canonical actions remain as defence-in-depth, but their outcome is
never treated as an authorization decision by the control plane.

## Consequences

**Positive.** A compromised `user_metadata` cannot widen agent capability. Scopes and value limits are
expressible (`approve PO, supplier group kain, ≤ Rp 50 juta`) where a role blob is not. Grants are
individually revocable (`jti`) and expire within a working day (max TTL 8 h). Every agent action carries a
dual actor `(agentPrincipal, onBehalfOfHuman)` for SoD and audit — the agent cannot launder a duty
conflict.

**Negative.** A second authorization system to maintain, and a grant-issuance admin flow to build. There
is a real risk of the two drifting: a permission tightened in the ERP UI is not automatically tightened
in agent grants. Mitigated by short TTLs (a stale grant dies the same day) and by a periodic
reconciliation report comparing each grant's capabilities against its human's current ERP permissions.

**Honest limitation.** This makes the *agent's* path safe; it does not fix the underlying auth stack.
`middleware.ts:177` excludes `api/`, ~36 routes have no in-handler auth, and `middleware.ts:103-107`
skips enforcement for requests carrying an attacker-supplied `rsc: 1` header. Anything reachable through
those bypasses the control plane entirely. **Grants must not be minted before the security audit Phase A
completes** — `AGENT_PHASE0_GATE.md` G-13.
