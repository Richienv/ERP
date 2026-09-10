# ULTIMATE SYSTEM RELIABILITY AUDIT PROMPT — Indonesian ERP (Next.js 16 + Supabase + Prisma)

> **Companion to** `SECURITY_AUDIT_PROMPT.md`. Security asks "can someone break in?" This asks
> **"will the system stay correct and available under real load, partial failures, and concurrency?"**
> Paste the block between `=== BEGIN PROMPT ===` and `=== END PROMPT ===` into a fresh Claude Code /
> Fable 5 session at repo root. Phase A is **read-only** — it produces a complete reliability inventory
> and findings report under `docs/reliability/`. It must NOT modify application code.
>
> **Why.** This ERP is an accounting system of record: an unavailable page is bad, but a *silently wrong
> number* is worse. Reliability here = availability **and** data integrity under failure. There is already
> a documented class of "data not flowing between modules" bugs (`FINANCE_BUGS_20260315.md`) — the audit
> must find the systemic causes, not just the symptoms.

---

## Ground-truth the auditor MUST internalise first (verified facts about THIS repo)

- **Runtime:** Next.js 16 App Router (Turbopack), React 19, deployed `output: "standalone"` on Vercel
  (serverless functions) and/or Docker. Serverless = **cold starts + per-invocation DB connections**.
- **Type safety is OFF at build:** `next.config.ts` → `typescript.ignoreBuildErrors: true`. Type errors
  ship to production. `reactStrictMode: false`. This is the #1 reliability posture weakness — a whole class
  of bugs that the compiler would catch is invisible in CI.
- **Database:** Supabase Postgres via **pgbouncer transaction pooler** (`DATABASE_URL` with
  `?pgbouncer=true`, port 6543) plus a `DIRECT_URL` session pooler (5432) for migrations. Environment is
  **IPv4-only** (see `DB_CONNECTION_FIX.md`). Transaction-mode pooling means: **prepared statements can
  break**, `$transaction` interactive callbacks hold a pooled connection, and connection limits are easy
  to exhaust from concurrent serverless invocations. Prisma singleton is re-exported: `lib/prisma.ts` →
  `lib/db.ts`. Audit `lib/db.ts` for the singleton pattern, connection limits, and pool config.
- **Caching / freshness tension:** ~**108 routes/pages export `force-dynamic`** (no caching — every
  request hits the DB), while `next.config.ts` sets client `staleTimes` (dynamic 30s / static 300s) and
  there's an `app/api/cache-warm/route.ts` warming endpoint. This is a load-vs-staleness balancing act —
  audit for both stale reads (users seeing old financial data) and DB overload (unbounded force-dynamic).
- **Silent mock fallback:** `lib/db-fallbacks.ts` exists and is referenced across actions. **Falling back
  to fake/mock data on a DB error makes an outage look like success** — users act on fabricated numbers.
  Every consumer of a fallback must be found and classified: acceptable (dev-only) vs dangerous
  (production financial reads).
- **Atomicity gaps:** only ~26 files use `prisma.$transaction`. Many financial flows must post a document
  change **and** a balanced GL journal **and** update balances **atomically**. Any multi-write flow that
  is not wrapped in one transaction can leave **half-committed state** (e.g. invoice ISSUED but no journal)
  — this is exactly the `FINANCE_BUGS_20260315.md` symptom ("invoice sent but not in AR").
- **Concurrency:** stock levels, sequential document codes (`CUST-YYYY-####`, invoice numbers), and
  balances are read-modify-write. Without row locks / atomic upserts / unique constraints these race under
  concurrent requests (double-spend stock, duplicate codes, lost balance updates).
- **Idempotency:** the Xendit webhook (`app/api/xendit/webhook/route.ts`) dedupes by scanning
  `payment.notes` for a marker string — fragile (string match, not a unique key/constraint). Assess replay
  and double-processing of payouts.
- **Error handling:** ~34 action files have `catch` blocks. Audit whether they **swallow** errors (return
  empty/`success:false` or fall back to mock) vs **propagate** — swallowing turns failures into silent
  data corruption. `next.config.ts` has no `headers()`; there's no visible global error boundary strategy
  to confirm.
- **Secret hygiene affecting ops:** `DB_CONNECTION_FIX.md` contains a **plaintext database password** and
  `.mcp.json` a hardcoded Supabase `project_ref`. A committed live DB credential is an availability risk
  (must be rotated) as well as a security one. Report the file/location — never reprint the value.
- **Tests:** ~65 `*.test.ts` files exist, **heavily concentrated in finance/accounting** (double-entry,
  aging, reconciliation, closing). Coverage is thin-to-absent for inventory concurrency, procurement/
  manufacturing state machines, API-route auth/validation, and the pooled-DB failure modes. Vitest config
  in `vitest.config.ts`, setup in `test-setup.ts`.
- **State machines:** `lib/po-state-machine.ts` (13 PO statuses) and sales/manufacturing status flows.
  Illegal or non-atomic transitions are a correctness-reliability risk.

---

## `=== BEGIN PROMPT ===`

You are a **principal reliability / SRE + data-integrity engineer** auditing an Indonesian ERP
(Next.js 16 App Router, React 19, Supabase Postgres via pgbouncer, Prisma, Xendit payments) that is the
**system of record for double-entry accounting**. You run inside Claude Code with full read access.
**Use the full reasoning capacity of Fable 5.**

Reliability here has two equally weighted halves: **Availability** (does it stay up under load, cold
starts, and partial failures?) and **Correctness/Integrity** (are the numbers always right — no
half-committed transactions, no silent fake data, no lost updates?). A silently wrong balance is a
Sev-1, same as an outage.

**Phase A is read-only and mandatory. Do not edit application code, run migrations, hit external services,
or push. Only write files under `docs/reliability/`.**

### Operating rules
- **Exhaustive, not representative.** Enumerate every server action and API route that performs a write,
  every `$transaction`, every `catch`, every `force-dynamic`, and every consumer of `lib/db-fallbacks.ts`.
- **Evidence-based** — every claim cites `path:line`; unverifiable → `UNVERIFIED`, never guessed.
- **Code is authoritative** over the many `*.md`/`*.txt` reports; record doc-vs-code discrepancies.
- **No secret values in output** — reference names/locations only.
- **Failure-first mindset:** for each surface, ask "what happens when the DB is slow, the pool is
  exhausted, the request retries, two users click at once, or the process dies mid-write?"

### Phase A — Reliability workstreams (produce a table per stream)

**1. Transactional integrity (highest priority).**
   - List every server action that performs **2+ related writes** (document + GL journal + balance
     update; stock movement + level; PO transition + event). For each, verify it's wrapped in a single
     `prisma.$transaction`. Flag any multi-write flow that is not atomic as `CRITICAL: partial-commit`.
   - Specifically check the finance flows named in `CLAUDE.md`'s cross-module GL table (invoice send,
     bill approve, AR/AP payment, GRN, credit/debit note, petty cash, depreciation, payroll): does the
     GL post inside the same transaction as the status change, and does a GL failure roll back the
     document? Cross-reference `FINANCE_BUGS_20260315.md` — map each documented "data not flowing" bug to
     its transactional root cause and check for the same pattern elsewhere.

**2. Concurrency & race conditions.**
   - Find read-modify-write on shared state: stock levels, account balances, sequential codes/numbers
     (`generateCustomerCode`, invoice/PO numbering), reservation counts. For each, determine protection:
     DB unique constraint, `SELECT ... FOR UPDATE`, atomic `update`/`upsert` with `increment`, or none.
     Flag unprotected ones (`double-spend stock`, `duplicate document numbers`, `lost balance update`).
   - Assess idempotency of all externally-triggered or retryable endpoints (Xendit webhook, any endpoint
     a client may double-submit). Flag the webhook's `notes`-string dedupe as fragile and specify the
     constraint-based fix.

**3. Database connection & pooling under serverless.**
   - Inspect `lib/db.ts` (+ `lib/prisma.ts`): Prisma singleton correctness (no new client per request/
     hot-reload leak), `connection_limit`, and compatibility with **pgbouncer transaction mode**
     (prepared-statement pitfalls, long interactive `$transaction` callbacks holding pooled connections).
   - Estimate connection-exhaustion risk: `force-dynamic` route count × concurrency vs pool size. Flag
     unbounded fan-out (e.g. dashboard/page-data routes issuing many parallel queries per request).
   - Note the IPv4-only + pooler constraints from `DB_CONNECTION_FIX.md` and any migration-path fragility.

**4. Error handling & failure surfacing.**
   - Classify every `catch` in `lib/actions/`, `app/actions/`, `actions/`, and API routes as:
     (a) propagates, (b) returns typed error, (c) **swallows silently**, or (d) **falls back to mock/fake
     data**. Enumerate every consumer of `lib/db-fallbacks.ts` and mark production financial reads that
     could show fabricated numbers as `CRITICAL: silent-wrong-data`.
   - Check for missing `await` on promises, unhandled rejections, and empty-catch `{}`.
   - Assess user-facing failure UX: are there `error.tsx` / `loading.tsx` boundaries per route segment?
     Do server actions return actionable errors or generic strings?

**5. Caching, freshness & staleness.**
   - Enumerate `force-dynamic` usage and, conversely, anything cached/memoized (`unstable_cache`, React
     `cache`, `staleTimes`, TanStack Query configs in `lib/query-client.tsx`). Flag places where a user
     could **act on stale financial data** (e.g. AR balance cached while a payment posts) and, separately,
     where over-use of `force-dynamic` needlessly hammers the DB. Assess `app/api/cache-warm` correctness
     and whether it can stampede.

**6. Input & data-shape robustness (reliability angle).**
   - Beyond security validation: `Number()`/`parseFloat` on money without guards (NaN → corrupt totals),
     floating-point money math instead of integer minor units / Decimal, timezone handling for
     Indonesian locale on period-sensitive reports (journal date vs posting date), null/empty handling on
     required relations. Flag anything that can silently produce a wrong-but-not-crashing result.

**7. State-machine integrity.**
   - Audit `lib/po-state-machine.ts` and sales/manufacturing status flows: are illegal transitions
     rejected server-side, are transitions atomic with their side effects (stock, GL, events), and can a
     concurrent double-transition corrupt state?

**8. External dependencies & timeouts.**
   - Every outbound call (Xendit SDK, Supabase auth, Typst/PDF generation, Excel parsing): does it have a
     timeout, retry-with-backoff, and a defined behavior on failure? Unbounded external calls block
     serverless functions and exhaust connections. The middleware already wraps `getUser()` in a 5s race —
     check whether data-path calls have similar guards.

**9. Migrations & schema safety.**
   - Review `prisma/migrations/` and seed scripts for destructive/irreversible steps, missing indexes on
     hot query columns (foreign keys used in dashboard aggregations), and constraints that *should* exist
     to enforce integrity (unique document numbers, non-negative stock check constraints).

**10. Observability & recovery.**
   - What signal exists when things break? Inventory logging (`console.*`), any error tracking, health
     checks, and whether financial invariants are verifiable at runtime (a reconciliation/trial-balance
     check). Recommend the minimum observability to detect the `FINANCE_BUGS` class automatically.

**11. Build/deploy posture.**
   - `ignoreBuildErrors: true` and `reactStrictMode: false`: quantify the risk and recommend a path to
     turning type-checking back on in CI (even as a non-blocking report first). Note committed
     credentials (`DB_CONNECTION_FIX.md`) as an operational risk requiring rotation.

**12. Test coverage vs risk.**
   - Map existing `__tests__/*` against the risk surface. Coverage is strong in finance/accounting; find
     the **high-risk, zero-coverage** areas (inventory concurrency, PO/manufacturing state machines,
     API-route auth+validation, pooled-DB failure, idempotency) and rank them by (blast radius × current
     coverage gap).

### Phase A deliverables (write these files)

1. **`docs/reliability/RELIABILITY_INVENTORY.md`** — master tables (one per workstream). For the write-path
   table use columns:

   | # | Action/Route | Path:Line | Writes (#) | Atomic ($transaction)? | Concurrency protection | Error handling (propagate/swallow/mock) | External calls (timeout?) | Failure mode | Risk (Crit/High/Med/Low/OK) |

   Include a **coverage count** proving exhaustiveness (write-actions enumerated / total; `$transaction`
   sites; `force-dynamic` count; `db-fallbacks` consumers; `catch` blocks classified).

2. **`docs/reliability/RELIABILITY_FINDINGS.md`** — prioritized (Sev1→Sev4). Each: ID, title, severity,
   category (atomicity / concurrency / connection / silent-wrong-data / staleness / timeout / build), the
   concrete failure scenario (trigger → what breaks → what the user sees), blast radius, and a specific
   fix. Executive summary + severity counts on top. Explicitly tie each `FINANCE_BUGS_20260315.md` bug to
   a root cause and note whether the same pattern exists elsewhere.

3. **`docs/reliability/FAILURE_MODES.md`** — an FMEA-style table: for each failure mode (DB pool exhausted,
   cold start, mid-write crash, webhook replay, concurrent stock decrement, stale AR read), record
   likelihood, detectability, impact, current mitigation, and recommended mitigation. Include a Mermaid
   diagram of the request → pooled-DB → transaction → GL path showing where atomicity boundaries must sit.

### Phase B — (only after I approve) Remediation plan
`docs/reliability/RELIABILITY_REMEDIATION_PLAN.md`: sequenced fixes with minimal diff sketches, the
invariant each restores, the Vitest tests to add, and a verification step. Obey `CLAUDE.md`: Ripple Check
for `lib/actions/` changes, finance guardrails for GL, `npx vitest` after each change, scope discipline.
**Do not implement until I approve.**

### Method & self-check
- First print your enumeration plan and the exact `grep`/`glob`/`find` commands, then run them; build lists
  from the filesystem, not memory.
- Completeness gate before declaring Phase A done — show the numbers: count of write-actions vs tabled;
  `grep -rl '\$transaction' lib app | wc -l` vs atomic flows verified; `grep -rl force-dynamic app | wc -l`;
  consumers of `lib/db-fallbacks.ts`; `catch` blocks classified. Any gap explained, not hidden.
- End Phase A with: total surfaces audited, count by severity, and the 5 reliability defects to fix first
  (bias toward atomicity + silent-wrong-data, since those corrupt the books).

## `=== END PROMPT ===`

---

## Optional: run it as a parallel workflow

- Fan out by concern (Atomicity, Concurrency, Connection/pooling, Error-handling, Caching/staleness,
  State-machines, External-timeouts, Migrations, Observability, Tests) — one agent per concern fills its
  table.
- Barrier → a reconcile agent cross-links findings to `FINANCE_BUGS_20260315.md` and dedupes.
- Adversarial verify: for each Sev1/Sev2, spawn skeptics that must *construct the exact failing sequence*
  (the concurrent requests, the retry, the mid-write kill) or prove the guard exists. Keep only survivors.
- Synthesis agent writes the three deliverables.
- Default to `pipeline()`; barrier only before reconcile/synthesis.

---

## How this pairs with the security audit

Run **both** prompts and you get the full "understand everything" picture the project needs:

| Prompt | Question it answers | Deliverables |
|--------|--------------------|--------------|
| `SECURITY_AUDIT_PROMPT.md` | Can it be attacked / accessed improperly? | Function inventory, findings, auth model |
| `SYSTEM_RELIABILITY_AUDIT_PROMPT.md` | Will it stay up and stay correct? | Reliability inventory, findings, FMEA |

Recommended order: **reliability first** (a system that silently corrupts its own books is a bigger
immediate risk here than most security issues), then security. Both are read-only in Phase A; review the
findings before authorizing any fixes.
