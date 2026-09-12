# ULTIMATE AGENT CONTROL PLANE PROMPT — Making the ERP Drivable by an AI Agent (Hermes)

> **Goal.** Let an LLM agent (Hermes / Nous Research) *operate* this Indonesian ERP — read it, reason about
> it, and drive real business transactions — with **SAP-grade discipline**: stable business APIs, document
> principle, dual control, segregation of duties, reversal-not-deletion, full change audit, and simulation
> before posting.
>
> **How to use.** Paste the block between `=== BEGIN PROMPT ===` and `=== END PROMPT ===` into a fresh
> Claude Code / Fable 5 session at repo root. It designs the architecture and produces the contract
> documents. It does **not** write production code until you approve the design.
>
> **Companion documents (read these first — they are the factual basis for this design):**
> `docs/reliability/RELIABILITY_FINDINGS.md`, `docs/reliability/FAILURE_MODES.md`,
> `docs/security/SECURITY_AUDIT_PROMPT.md`.

---

## 0. The one thing that must be understood before anything else

**An AI agent does not tolerate the defects a human clicker survives — it amplifies them.**

A human clicks "Bayar" once, sees a spinner, and waits. An agent times out at 20s and **retries**. It runs
three tool calls **concurrently**. It re-reads state and, seeing a stale value, **acts again**. Every one of
those behaviours lands precisely on a defect the reliability audit already found:

| Agent behaviour | Existing defect it detonates | Finding |
|---|---|---|
| Retries a timed-out mutation | Idempotency is a non-atomic `notes` string scan; no idempotency table | R-07 |
| Runs tool calls concurrently | Non-atomic GL posting (Class A nested tx) → orphan journal entries; pool deadlock | R-01, R-05 |
| Fans out reads while writing | `connection_limit=10` × 20s interactive transactions → pool exhaustion | R-05 |
| Issues two stock ops at once | Unguarded decrements → negative stock, no DB CHECK | R-04 |
| Creates documents in parallel | `count()+1` numbering races; NSFP duplicate legal tax serials | R-03, R-17 |
| Treats a "success" as truth | `createInvoiceFromSalesOrder` returns `success:true` when GL posting **failed** | R-02 |
| Reads a KPI to decide next action | DB outage returns a **zeroed HTTP-200 dashboard** — the agent will "reason" over fake zeros | R-06, R-08 |

**Therefore this architecture has a hard gate: Phase 0 hardening ships before any agent write path is
enabled.** An agent writing into a system that can silently drop journal entries doesn't automate the
business — it automates the corruption of its books.

---

## 1. Decisions already made (do not re-litigate these)

| Decision | Choice | Consequence for the design |
|---|---|---|
| **Autonomy model** | **Tiered** — reads free within scope; writes go through **propose → confirm** with a diff preview; money/GL above threshold requires a **human** approval | Mirrors SAP release strategy + dual control. Every mutating operation needs a proposal object, a diff renderer, and a threshold policy. |
| **Integration surface** | **MCP server layered over a typed operation layer** (`lib/agent/operations/*`) | The operation layer is the contract (BAPI equivalent); MCP is just one transport. Model-agnostic — Hermes is swappable. |
| **First vertical slice** | **Procurement: PR → PO → GRN** | Chosen because `lib/po-state-machine.ts` already enforces legal transitions, and `approvePurchaseOrder` (`procurement.ts:991-1001`) and `acceptGRN` (`grn.ts:382`) are already atomic and guarded — the lowest hardening debt for a real end-to-end slice. |

---

## 2. Ground truth about THIS repo (verified — do not re-derive)

- **Greenfield agent surface.** `components/ai/` is a **UI shell only** (`ai-context.tsx`, `ai-floating-button.tsx`,
  `ai-sidebar.tsx` — React state, no backend). **No LLM or MCP dependency exists in `package.json`.** Nothing
  to retrofit; design it right the first time.
- **Stack:** Next.js 16 App Router, React 19, Prisma → Supabase Postgres via **pgbouncer transaction pooler**,
  Xendit payments. `output: "standalone"`.
- **Scale:** 160 API routes, ~58 `"use server"` files, 57 Prisma models, `lib/po-state-machine.ts` (13 PO statuses).
- **Auth reality:** `middleware.ts:167` **excludes `/api/`** — every route self-authenticates, and **36 routes
  have no auth check at all**. Two divergent authz systems (`lib/authz.ts` vs `lib/auth/role-guard.ts`), both
  auto-granting `ADMIN`; role is read from **client-writable** Supabase `user_metadata` before the DB column.
  **An agent credential minted on top of this inherits all of it.**
- **Atomicity model:** `withPrismaAuth()` wraps every op — including reads — in
  `$transaction(cb, {maxWait:15000, timeout:20000})` (`lib/db.ts:62-67`). `postJournalEntry(data, txClient?)`
  (`finance-gl.ts:309-347`) is atomic **only** when the tx is threaded in; otherwise it opens a second
  independent transaction.
- **Correct reference implementations exist** and must be the template: `finance-invoices.ts:moveInvoiceToSent`
  (`:1195`), `recordInvoicePayment` (`:1420`), `grn.ts:acceptGRN`, `lib/document-numbering.ts:getNextDocNumber`
  (atomic upsert on a unique prefix).
- **Governance trap:** `CLAUDE.md` declares `lib/actions/finance.ts` stale/"never use", but the **live UI imports
  it** (`app/finance/bills/page.tsx:48`, `app/finance/vendor-payments/page.tsx:30`,
  `components/finance/vendor-multi-payment-dialog.tsx:34`, `journal/new/page.tsx:28`). The agent layer must bind
  to the **canonical** actions and the duplicates must be retired, or the agent will drive the broken copies.
- **Untrusted data is everywhere.** Vendor names, customer notes, PDF/Typst inputs, uploaded Excel, webhook
  payloads. All of it can reach an agent's context. Treat every ERP text field as **attacker-controlled** when
  it flows into a prompt.
- **Localization:** Bahasa Indonesia first, IDR, PPN 11%, NPWP/NIK, e-Faktur NSFP serials. Agent-facing messages
  must be bilingual (`message_id` + `message_en`) — the human reviewing a proposal reads Bahasa.
- **Also found while scanning:** `app/api/tenant/route.ts:22` instantiates `new PrismaClient()` **per request**
  (connection leak, compounds R-05) and is a public unauthenticated endpoint.

---

## 3. The SAP standards spine (this is the "SAP big standard" being asked for)

Every row is a real SAP control and the concrete thing to build here. The architecture is judged against this table.

| SAP concept | What it guarantees | What to build in this ERP |
|---|---|---|
| **BAPI** (Business API) | Stable, versioned, documented business operations. Callers never touch tables. | `lib/agent/operations/<domain>/<op>.ts` — business verbs only. The agent **never** sees Prisma, SQL, or generic CRUD. |
| **BAPIRET2** (return structure) | Typed, coded, translatable messages — not stack traces. | `AgentResult` envelope: `{severity: S|I|W|E, code, message_id, message_en, retryable, remediation, fieldErrors[]}`. |
| **BAPI_TRANSACTION_COMMIT / ROLLBACK** | Explicit, bounded transaction control. | One operation = one server-side transaction. **Never** hold a transaction open across agent turns. Fixes R-01/R-05 by construction. |
| **TESTRUN flag / posting simulation** | See the posting before it posts. | `dryRun: true` on every mutation → returns the exact GL lines, stock deltas, and status changes it *would* produce. |
| **Belegprinzip** (document principle) | No posting without a document; posted documents are immutable. | Every agent mutation creates a document + balanced journal entry. Nothing is edited in place after POSTED. |
| **Storno** (reversal, e.g. FB08) | Corrections create a reversal document; history is never destroyed. | The agent toolset contains **no delete operations**. Corrections are `reverse*` operations that post a counter-entry. |
| **Change documents (CDHDR/CDPOS)** | Who changed what, when, before → after. | Append-only `AgentActionLog` with field-level diffs, actor = `(agentPrincipal, onBehalfOfHuman)`, correlation id. |
| **Authorization objects** (activity × org level) | Fine-grained, not role-blob. | Capability = `(operation × scope × limit)`. Not "role: ADMIN". |
| **SoD / GRC risk rules** | Conflicting duties can't be held by one actor. | Deny-matrix, e.g. *create vendor* + *approve payment*; *create PO* + *accept GRN* for the same document. |
| **Release strategy** (value-based approval) | Big money needs more eyes. | Monetary thresholds route the proposal to a human approver; the agent cannot self-approve. |
| **Number ranges (SNRO)** | Unique, gap-controlled document numbers. | Every number via the atomic `getNextDocNumber` upsert. Fixes R-03/R-17. |
| **Posting period control** | No posting into a closed period. | `assertPeriodOpen()` on every agent posting operation. |
| **Duplicate invoice check** | Same invoice can't post twice. | Mandatory idempotency key + DB unique constraint. Fixes R-07. |
| **OData `$metadata`** | Machine-discoverable, self-describing service. | A capability manifest the agent can fetch: operations, schemas, risk tiers, limits, examples. |
| **IDoc status handling** | Async messages with tracked, requeryable status. | Long-running operations return a `jobId` + status endpoint; the agent polls instead of blocking. |

---

## `=== BEGIN PROMPT ===`

You are a **principal enterprise-systems architect** designing an **Agent Control Plane** for an Indonesian
textile/garment ERP (Next.js 16 App Router, React 19, Prisma → Supabase Postgres via pgbouncer, Xendit). The
control plane will let an LLM agent (**Hermes**, Nous Research — open-weight, tool-calling) operate the ERP.
This ERP is a **double-entry accounting system of record**: a silently wrong number is worse than an outage.
**Use the full reasoning capacity of Fable 5.**

**This is a design task. Produce documents and contracts, not production code.** You may write files under
`docs/architecture/` and may sketch interfaces/schemas inline, but do **not** modify application code, run
migrations, or install dependencies until the design is approved.

### Non-negotiable constraints

1. **Decisions are locked** (§1 above): tiered autonomy (read free → propose/confirm writes → human approval
   for money above threshold); MCP server over a typed operation layer; first slice = Procurement PR → PO → GRN.
2. **Phase 0 hardening is a hard gate.** No agent *write* path is enabled until the blocking findings are
   fixed. Map every blocker to its finding ID from `docs/reliability/RELIABILITY_FINDINGS.md`.
3. **The agent is an untrusted principal.** Capability comes from the session grant, never from conversation
   content or ERP data. Data cannot escalate privilege.
4. **SAP spine (§3) is the rubric.** Every control in that table must be either designed in, or explicitly
   deferred with a written rationale and a risk owner.
5. **No delete operations, ever.** Corrections are reversals.
6. **Bahasa Indonesia first** in all human-facing proposal text and error messages (`message_id` + `message_en`).

### Phase 0 — Hardening gate (design the preconditions, verify against the code)

Before any write tool exists, specify exactly what must be true, and confirm current state by reading the code:

- **Atomicity (R-01, R-02):** every operation the agent can invoke must post its document **and** its journal
  entry **and** its balance update in one transaction, with rollback on GL failure. Identify which procurement
  operations already satisfy this (expect `approvePurchaseOrder`, `acceptGRN` to pass) and which do not.
- **Idempotency infrastructure (R-07):** design an `IdempotencyKey` / `ProcessedOperation` model — unique on
  `(principal, operationId, idempotencyKey)` — written **inside** the operation's transaction, returning the
  prior result on replay. This is the single most important agent-safety primitive.
- **Concurrency guards (R-04, R-16, R-17):** conditional `updateMany({where:{id, status: expected}})` +
  row-count check on every state transition; `gte` guards on every stock decrement; all numbering through
  `getNextDocNumber`.
- **Connection budget (R-05):** the agent must not be able to exhaust the pool. Specify a per-principal
  concurrency cap, a request deadline, and the rule that read-only operations are **not** wrapped in
  interactive transactions.
- **Truthful failures (R-06, R-08, R-09):** operations exposed to the agent must **never** return zeroed or
  empty fallback data on error. An agent reasoning over a fake `Rp 0` is worse than an agent seeing an error.
  Specify the `AgentResult` error path that replaces every fallback in agent-reachable code.
- **Integrity check (R-22):** define the invariant job (trial balance, orphan-JE, balance-vs-lines,
  stock-vs-ledger) that must pass after every agent write batch, and note it depends on the R-12 indexes.
- **Observability (R-21):** correlation id per agent episode threaded through every operation and log line.

Output a **Phase 0 gate checklist** with, for each item: finding ID, current state (verified, with `path:line`),
required state, and whether it blocks reads, writes, or both.

### Phase 1 — The operation contract (BAPI equivalent)

Design `lib/agent/operations/` as the **single source of truth**. Specify:

- **Operation descriptor shape.** Each operation declares: `id` (`domain.verbNoun`, e.g.
  `procurement.createPurchaseRequest`), `version`, bilingual `title`/`description`, `inputSchema` (Zod),
  `outputSchema`, `sideEffects` (documents created, GL accounts touched, stock moved), `requiredCapability`,
  `riskTier` (READ | WRITE_LOW | WRITE_MONEY | IRREVERSIBLE), `dryRunSupported`, `idempotent`,
  `reversalOperation` (the op that undoes it), `preconditions`, and worked `examples`.
- **Binding rule:** operations wrap the **canonical** server actions (`lib/actions/procurement.ts`,
  `lib/actions/grn.ts`, `finance-invoices.ts`, `finance-ap/ar/gl.ts`) — never `lib/actions/finance.ts`, never
  raw Prisma, never generic CRUD. Where the canonical action is non-atomic, the operation is **not exposed**
  until Phase 0 fixes it.
- **Granularity:** business-meaningful verbs a factory manager would recognise (`submitPurchaseRequest`,
  `approvePurchaseOrder`, `receiveGoods`), not table operations. If an operation needs more than ~8 input
  fields or a deeply nested object, it is probably the wrong granularity — split it.
- **The full catalog for the procurement slice**, plus the read operations needed to make it usable
  (list/search/get for PR, PO, GRN, supplier, product, stock level).
- **Capability manifest generation** (the OData `$metadata` equivalent) so the agent can discover operations,
  schemas, and limits at runtime rather than having them hardcoded.

### Phase 2 — Agent protocol layer (MCP)

- MCP server exposing operations as tools; the operation layer stays transport-agnostic.
- **Tool budget discipline:** agents degrade as the tool count grows, and open-weight models degrade faster.
  Specify a per-session cap (target ≤ ~30 tools), scoping by module, and a `describeCapabilities` discovery
  tool rather than exposing everything at once.
- **Schema ergonomics for an open-weight tool-caller:** flat over nested; enums over free text; explicit
  units and currency; ISO dates; no polymorphic unions; every field described in one line. Validate strictly
  and return a **schema-repair error** (which field, what was expected, an example) so the agent can self-correct.
- **Session grant:** a signed, scoped, expiring credential carrying `(agentPrincipal, onBehalfOfHuman,
  capabilities[], tenant, limits, deadline)`. Tenant and limits are enforced **server-side on every call** —
  never trusted from the request.
- **Verify the tool-call format** for the specific Hermes deployment (Hermes emits tool calls in its own
  convention, and behaviour differs between Hermes versions and hosting runtimes). Do not assume — confirm
  against the deployment, and keep MCP in front so the model is swappable.

### Phase 3 — Safety & governance

- **Capability model:** `(operation × scope × limit)` — e.g. *approve PO, supplier group X, ≤ Rp 50 juta*.
  Explicitly reject role-blob authorization; note that the existing `assertRole` auto-grants `ADMIN` and that
  roles derive from client-writable metadata, so the agent grant must be independent of it.
- **Segregation of Duties matrix:** enumerate the conflicting pairs the control plane must deny (e.g. create
  supplier + approve payment; create PO + accept its own GRN; create invoice + record its payment).
- **Propose → confirm protocol:** `propose*` returns a `proposalId`, a **human-readable Bahasa diff**, the
  simulated GL/stock effect (from `dryRun`), a TTL, and a single-use token. `confirm(proposalId)` executes.
  Specify what invalidates a proposal (state drift, expiry, prior execution) — a proposal must never execute
  against changed underlying state.
- **Threshold policy:** which value bands and operation types force a human approver, and how that approval is
  captured and audited.
- **Prompt-injection defense:** ERP data (supplier names, notes, PDFs, Excel, webhook payloads) is untrusted
  input. Specify the boundary: data is rendered as data, never as instructions; capability is never inferred
  from content; and any operation whose parameters originated in ERP free-text is flagged for review.
- **Kill switch:** a single flag that disables all agent writes immediately, plus per-capability revocation.
- **Reversal-only corrections:** `reverse*` operations, no deletes, no hard edits of posted documents.

### Phase 4 — Back-and-forth ergonomics (the "reliable, easy" requirement)

This is what makes the loop actually work in practice. Specify each:

- **Mandatory idempotency key** on every mutation, unique-constrained, replay returns the original result.
- **`dryRun` on every mutation**, returning the exact deltas — this is what the agent shows the human.
- **The `AgentResult` envelope** (BAPIRET2 equivalent) for *every* return, success or failure: severity, stable
  code, bilingual message, `retryable`, `remediation`, `fieldErrors[]`. Errors must **teach the agent what to
  do next**, not describe a stack.
- **Bounded reads:** hard max page size, cursor pagination, field projection, and a payload-size ceiling —
  agents blow their context on unbounded lists. State the caps explicitly and log what was truncated.
- **Read-your-writes:** agent reads bypass the client cache layer (`lib/query-client.tsx` serves 5-minute
  stale data from IndexedDB — R-11); the agent must never act on stale AR/stock state.
- **Deadlines & timeouts** propagated per call; long operations return a `jobId` with a queryable status
  (IDoc equivalent) rather than blocking a connection.
- **Concurrency cap per principal**, sized against the DB connection budget.
- **Correlation id** per episode, threaded through every operation, log line, and audit row.

### Phase 5 — Observability, audit & evaluation

- **`AgentActionLog`** (append-only): correlation id, principal + on-behalf-of, operation, inputs (redacted),
  proposal, human decision, before/after diff, result, duration. This is the change-document equivalent and is
  the artifact an auditor will ask for.
- **Episode replay** for debugging and incident review.
- **Evaluation harness** before any autonomy increase: golden task set (does it complete real workflows),
  **must-refuse set** (does it decline out-of-scope, over-threshold, and injected instructions), schema
  adherence rate, and idempotency-under-retry tests.
- **Post-write integrity assertion:** the invariant job must pass after agent batches; a failure trips the
  kill switch.

### Phase 6 — Rollout

Sequence with explicit entry/exit criteria per stage: **shadow** (agent proposes, nothing executes, humans
score) → **propose/confirm** (human confirms every write) → **thresholded autonomy** (small-value writes
auto-execute, money still gated) → next domain. Define what evidence is required to advance a stage and what
triggers rollback.

### Deliverables (write these files)

1. `docs/architecture/AGENT_CONTROL_PLANE_ARCHITECTURE.md` — the design, with a Mermaid diagram of
   agent → MCP → operation layer → canonical action → transaction → GL, showing where the trust boundary,
   transaction boundary, and approval gate sit.
2. `docs/architecture/AGENT_OPERATION_CATALOG.md` — the full procurement-slice contract: every operation with
   its descriptor, Zod schemas, risk tier, capability, reversal, and worked examples.
3. `docs/architecture/AGENT_SAFETY_MODEL.md` — capability model, SoD matrix, thresholds, propose/confirm
   protocol, injection defense, kill switch.
4. `docs/architecture/AGENT_PHASE0_GATE.md` — the hardening checklist mapped to finding IDs with verified
   current state.
5. `docs/architecture/AGENT_ROLLOUT_PLAN.md` — staged rollout with entry/exit criteria and the eval harness.
6. `docs/architecture/adr/` — short ADRs for the consequential choices (operation layer vs direct action
   exposure; propose/confirm vs direct execute; MCP vs REST; idempotency strategy; agent identity model).

### Method & self-check

- Start by printing your plan and the files you will read, then read them. Ground every claim about current
  behaviour in `path:line` — do not assume the audit's findings still hold without spot-checking the code.
- For the procurement slice, **trace one operation end-to-end** (`receiveGoods` → `acceptGRN` → stock + GL) and
  prove the transaction boundary and idempotency story concretely. A design that can't survive one traced
  example won't survive sixty operations.
- Before finishing: walk the SAP spine table (§3) row by row and state, for each, **designed / deferred (why)**.
- End with: the 5 riskiest aspects of letting an agent drive this ERP, and what specifically mitigates each.

## `=== END PROMPT ===`

---

## 4. Optional: run it as a parallel workflow

- Fan out by concern — (a) Phase 0 gate verification against code, (b) procurement operation catalog,
  (c) safety/SoD/capability model, (d) protocol & schema ergonomics, (e) observability/eval — one agent each.
- Barrier → a reconcile agent checks the catalog against the safety model (every `WRITE_MONEY` op has a
  threshold, a reversal, and a dry-run) and against the Phase 0 gate (no op exposed whose underlying action is
  non-atomic).
- **Adversarial pass:** red-team agents attempt to design an exploit path — an injected supplier name that
  steers an operation, a retry that double-posts, a proposal replayed against drifted state, an SoD bypass via
  two chained low-risk operations. Anything that succeeds becomes a required control.
- Synthesis agent writes the deliverables.

---

## 5. Quick-start checklist (for the human)

1. Ensure `docs/reliability/RELIABILITY_FINDINGS.md` is present — the prompt depends on it.
2. Fresh session at repo root; paste the `BEGIN…END` block.
3. Review `AGENT_PHASE0_GATE.md` **first** — it tells you what must be fixed before Hermes can write anything.
4. Approve the design, then implement Phase 0 hardening, then the procurement slice in shadow mode.
5. Do not skip shadow mode. The eval harness is how you learn whether Hermes is reliable enough at
   tool-calling *for your workflows* before it can move money.

---

## 6. Honest risk note

Two things this design cannot fix, and you should decide on deliberately:

- **The auth foundation.** Agent capabilities will be layered on a system where 36 API routes have no auth,
  two authz systems disagree, and roles come from client-writable metadata. The agent grant is designed to be
  independent of that — but anything the agent can reach through an unauthenticated route bypasses the control
  plane entirely. **Run the security audit Phase A before enabling agent writes.**
- **Open-weight tool-calling reliability.** Hermes is strong at function calling, but strict-schema adherence
  and refusal behaviour under adversarial input are empirical questions for your deployment, not assumptions.
  The eval harness in Phase 5 exists specifically to measure this before you grant autonomy — treat its
  results, not the model's reputation, as the decision input.
