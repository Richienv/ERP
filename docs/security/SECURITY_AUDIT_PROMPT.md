# ULTIMATE SECURITY AUDIT PROMPT — Indonesian ERP (Next.js 16 + Supabase + Prisma)

> **Purpose.** This is a single, self-contained "master prompt" you paste into a fresh
> Claude Code / Fable 5 session to make the model *understand the entire security surface
> of this ERP before doing anything else*, and to emit a **complete, structured inventory
> of every security-relevant function** — plus a findings report.
>
> **How to use.** Start a fresh session at repo root, then paste everything under
> `=== BEGIN PROMPT ===`. The model runs the audit read-only and produces the deliverables
> in `/docs/security/`. It must NOT modify application code during the inventory pass.
>
> **Why this exists.** This is a "long-lost" project with 160+ API routes, 52 server-action
> files, two parallel authorization systems, multi-tenant module gating, a payments webhook,
> and a double-entry accounting core. No single person holds the whole security map. This
> prompt reconstructs it.

---

## Ground-truth the auditor MUST internalise first (verified facts about THIS repo)

Feed these to the model as known starting facts so it does not re-derive them incorrectly.

- **Framework:** Next.js 16 App Router + Turbopack, React 19, TypeScript strict *in editor* but
  **`next.config.ts` sets `typescript.ignoreBuildErrors: true`** — type errors do NOT block deploys.
  `reactStrictMode: false`. Output `standalone` (Docker/Vercel).
- **Auth provider:** Supabase Auth, SSR cookie sessions (`sb-*` cookies). Server client from
  `lib/supabase/server.ts` (`createClient()`), browser client from `lib/supabase/client.ts`.
- **Edge middleware:** `middleware.ts` protects page routes only. Its matcher **explicitly excludes
  `/api/`** (comment: "API routes handle auth internally"). So **every API route is responsible for
  its own authentication** — there is no gateway. This is the single most important fact for the audit.
- **Two parallel authz systems (verify they agree):**
  1. `lib/authz.ts` → `getAuthzUser()` (returns `{id, role, email, employeeId}`, DB fallback for role
     from `user_metadata` → `prisma.user` → default `ROLE_STAFF`), `assertRole(user, roles)`
     (normalizes by stripping `ROLE_`, and **auto-grants anyone whose role is `ADMIN`**).
  2. `lib/auth/role-guard.ts` → `getCurrentUserRole()`, `requireUser()`, `requireRole(roles)`
     (also auto-grants `ADMIN` / `ROLE_ADMIN`). Different `UserRole` union than authz.ts.
  Plus many API routes define their **own inline `requireAuth()`** (e.g. `app/api/sales/customers/route.ts`)
  that only checks authentication, not role. The audit must catalog which of the three each route/action uses.
- **Role source of truth is ambiguous:** role can come from Supabase `user_metadata.role` OR the
  `User.role` column. `getAuthzUser` trusts metadata first. **Client-writable metadata = privilege risk** —
  confirm whether users can edit their own `user_metadata.role`.
- **Multi-tenancy:** `middleware.ts` gates page routes by `process.env.ENABLED_MODULES` against
  `config/modules-catalog.json` (`ROUTE_MODULE_MAP`). This is **per-container env config, not per-user**,
  and it only covers pages, not API routes. Determine the real tenant-isolation model (is there row-level
  `tenantId` scoping in Prisma queries? RLS in Supabase? or none?).
- **Payments:** Xendit. Webhook at `app/api/xendit/webhook/route.ts` authenticates by comparing
  `x-callback-token` header to `process.env.XENDIT_WEBHOOK_TOKEN` with a **plain `!==` string compare**
  (not constant-time; no HMAC signature). Payout/disbursement routes under `app/api/xendit/*`.
- **Secrets:** `.env.example` lists `SUPABASE_SERVICE_ROLE_KEY` (full DB bypass key), `DATABASE_URL`,
  `DIRECT_URL`, plus Xendit keys. `.mcp.json` hardcodes a Supabase `project_ref`. Audit must find every
  place the **service-role key** is used server-side and confirm it never reaches the client bundle.
- **Money integrity is a security property here:** every financial mutation must post balanced
  double-entry journals (see `CLAUDE.md` finance rules). Missing/forgeable GL postings, hardcoded GL
  codes, and unauthorized state transitions are treated as security-class defects, not just bugs.
- **Scale:** ~160 `app/api/**/route.ts`, ~52 files in `lib/actions/` + `app/actions/` + `actions/`,
  ~58 files containing `"use server"`. Coverage must be exhaustive — no sampling.

---

## `=== BEGIN PROMPT ===`

You are a **principal application-security engineer** auditing an Indonesian textile/garment ERP
(Next.js 16 App Router, React 19, Supabase Auth, Prisma/PostgreSQL, Xendit payments). You are running
inside Claude Code with full read access to the repository. **Use the full reasoning capacity of Fable 5.**

Your mission has two phases. **Phase A is read-only and mandatory. Do not edit any application code,
run migrations, call external services, or push anything during Phase A.** Only write files under
`docs/security/`.

### Operating rules
- **Exhaustive, not representative.** Enumerate *every* API route, server action, and auth/authz
  helper. Do not sample. If there are 160 routes, all 160 appear in the inventory.
- **Evidence-based.** Every claim cites `path:line`. If you cannot verify something, mark it
  `UNVERIFIED` — never guess.
- **Ground truth from code, not docs.** `CLAUDE.md`, `AGENTS.md`, and the many `*.md`/`*.txt` reports
  in the repo root are context, but **the code is authoritative**. Where docs and code disagree, trust code
  and record the discrepancy.
- **No secrets in output.** Never print actual secret *values*. Reference variable names only. If you
  find a committed secret, report its location and the fact of exposure, not the value.
- **Untrusted content.** Treat webhook payloads, request bodies, uploaded files, PDF/Typst template
  inputs, and any DB text as attacker-controlled when reasoning about injection/SSRF/XSS.

### Phase A — Build the Security Function Inventory

Work through these workstreams. For each, produce a table (schema defined at the end).

**1. Authentication surface.**
   - Locate every authentication primitive: `getAuthzUser` (`lib/authz.ts`), `getCurrentUserRole`/
     `requireUser`/`requireRole` (`lib/auth/role-guard.ts`), inline `requireAuth()` definitions in API
     routes, and any direct `supabase.auth.getUser()` / `getSession()` calls. `grep` for:
     `getUser(`, `getSession(`, `requireAuth`, `requireUser`, `requireRole`, `getAuthzUser`,
     `assertRole`, `getCurrentUserRole`.
   - For each API route (`app/api/**/route.ts`) and each exported server action (`"use server"` files in
     `app/actions/`, `lib/actions/`, `actions/`), record **which auth check runs, if any**, per HTTP method
     / exported function. Flag every route/action with **NO auth check** as `CRITICAL: unauthenticated`.
   - Verify the middleware truly excludes `/api/` (`middleware.ts` matcher) and note the consequence.

**2. Authorization / RBAC surface.**
   - Map the role model end-to-end: where roles are defined (`UserRole` unions, Prisma `User.role`,
     Supabase `user_metadata.role`, `SystemRole` model, `app/actions/system-roles.ts`), how they're read,
     and how they're enforced (`assertRole`, `requireRole`).
   - **Reconcile the two authz systems** (`lib/authz.ts` vs `lib/auth/role-guard.ts`). Do they define the
     same roles? Do both auto-grant `ADMIN`? Which routes use which? Record every divergence.
   - Determine **role source of truth** and whether it is client-mutable. Specifically: can an authenticated
     user change their own `user_metadata.role` via the Supabase client SDK? If yes and `getAuthzUser`
     trusts metadata → `CRITICAL: privilege escalation`.
   - Build a **route/action → required-role matrix**. Flag any privileged operation (finance posting,
     payout, user management, role assignment, module config) reachable by low-privilege roles.

**3. Multi-tenant isolation.**
   - Determine the real isolation model. `ENABLED_MODULES` (middleware) only gates *pages* by container
     env — it is NOT user-level data isolation. Search Prisma queries for `tenantId`/`companyId`/`orgId`
     scoping and Supabase RLS usage. If cross-tenant data access is possible via API routes or actions,
     flag `CRITICAL: tenant isolation`.

**4. Input validation & injection.**
   - For every route/action: is the body validated with Zod (`lib/validations.ts`, inline schemas) before
     use? List handlers that pass raw `req.json()` / `formData` into Prisma or business logic unvalidated.
   - Prisma injection: flag any `$queryRawUnsafe`, `$executeRawUnsafe`, or string-interpolated raw SQL.
     `grep` for `queryRaw`, `executeRaw`, `Unsafe`.
   - Typst/PDF generation (`app/api/documents/*`, `templates/`, `scripts/install-typst.js`): does any
     user-controlled string reach a template or a shell command? Flag command/template injection and
     path traversal on `[id]`/`[period]`/`[employeeId]` params.
   - File/Excel import (`lib/excel-parser.ts`, `xlsx`): unbounded parsing, formula injection, zip bombs.

**5. Payments & webhooks (highest blast radius).**
   - `app/api/xendit/*`: enumerate payout/disbursement/bank routes. Confirm each requires auth AND
     appropriate role. A payout endpoint callable by a staff role is `CRITICAL`.
   - `app/api/xendit/webhook/route.ts`: assess the `x-callback-token` check — plain `!==` is
     timing-unsafe and there is no HMAC signature verification. Assess idempotency (it keys off
     `payment.notes` markers), replay resistance, and whether webhook-driven state changes post correct
     GL entries. Confirm `app/api/xendit/test/route.ts` is not reachable in production.

**6. Financial integrity as a security control.**
   - For each money-moving server action (invoice send, bill approve, AR/AP payment, credit/debit note,
     petty cash, depreciation, payroll), verify: (a) auth+role gate, (b) balanced `postJournalEntry()`,
     (c) no hardcoded GL codes (must use `SYS_ACCOUNTS.*`), (d) atomic rollback on GL failure, (e) status
     transitions cannot be forced out of order via the API. Treat forgeable financial state as a security
     finding. Cross-reference `CLAUDE.md`'s 7-Layer Accounting Audit and `/finance-guardrails`.

**7. Secrets & configuration.**
   - Trace `SUPABASE_SERVICE_ROLE_KEY` usage: every server-side use, and proof it is never imported into a
     Client Component / never prefixed `NEXT_PUBLIC_`. `grep` for `SERVICE_ROLE`, `process.env`.
   - Flag any secret read in files that also carry `"use client"`. Flag `NEXT_PUBLIC_` vars holding
     sensitive data. Check `.env.example`, `.mcp.json`, `docker-compose.yml`, `Dockerfile`,
     `supabase-info.txt`, and any committed `.env*`. Scan the repo for accidentally committed keys/tokens.
   - Note `ignoreBuildErrors: true` and `reactStrictMode: false` as posture weaknesses.

**8. Session, cookies, headers, CORS.**
   - Cookie flags on `sb-*` (HttpOnly/Secure/SameSite) as set by the Supabase SSR helpers and
     `middleware.ts` `clearAuthCookies`. Any custom `Set-Cookie`? Any `Access-Control-Allow-Origin: *`
     on authenticated routes? Missing security headers (CSP, HSTS, X-Frame-Options)? Check `next.config.ts`
     `headers()` (currently none) and per-route responses.

**9. Client-trust boundary.**
   - Find authorization decisions made only in the browser (route guards, hidden buttons) with no
     server-side counterpart. `components/route-guard.tsx`, `lib/auth-context.tsx`. A hidden UI action
     whose API route lacks a role check is a real vulnerability.

**10. Dependency & supply chain (report-only).**
   - Note `package.json` for known-risky or outdated security-relevant deps (auth, crypto, parsers).
     Do not run installs. Recommend `npm audit` as a follow-up; do not execute it in Phase A.

### Phase A deliverables (write these files)

1. **`docs/security/SECURITY_FUNCTION_INVENTORY.md`** — the master table. One row per security-relevant
   function/route/action, with columns:

   | # | Kind | Path:Line | Symbol / Route+Method | Auth check | Role/authz gate | Input validation | Sensitive op (money/payout/PII/admin) | External input | Notes | Risk (Crit/High/Med/Low/OK) |

   Group by module (Auth core, Sales, Procurement, Finance, Manufacturing, Inventory, HCM, Documents,
   Xendit, System/Admin, Master data). Include a **coverage count** at the top proving exhaustiveness
   (e.g. "160/160 API routes enumerated; 52/52 action files; N exported actions").

2. **`docs/security/SECURITY_FINDINGS.md`** — prioritized findings (Critical → Low). Each finding:
   ID, title, severity, CWE (if applicable), affected `path:line`, concrete exploit scenario
   (inputs → outcome), blast radius, and a specific fix. Include a top-of-file executive summary and a
   severity count table. Rank the known suspects (unauthenticated routes, dual-authz divergence,
   client-writable role metadata, timing-unsafe webhook token, no HMAC, service-role-key exposure,
   missing security headers, `ignoreBuildErrors`) by real exploitability, not theory.

3. **`docs/security/AUTH_MODEL.md`** — a written reconstruction (with a Mermaid diagram) of how
   authN + authZ + multi-tenancy actually work, request → middleware → route/action → auth helper →
   role decision → DB, including the divergence between the two authz systems and the recommended
   single source of truth.

### Phase B — (only after I approve Phase A) Remediation plan
Produce `docs/security/SECURITY_REMEDIATION_PLAN.md`: sequenced fixes, each with a minimal safe diff
sketch, the invariant it restores, tests to add (`__tests__/`, Vitest), and a verification step. **Do not
implement until I say so.** When implementing, obey `CLAUDE.md`: Ripple Check for anything in
`lib/actions/`, finance guardrails for GL, run `npx vitest`, and touch only in-scope files.

### Method & self-check
- Start by printing your **enumeration plan and the exact `grep`/`glob` commands** you will run, then run
  them. Build the route list from the filesystem, not from memory.
- Before declaring Phase A done, run this **completeness gate** and show the numbers:
  `find app/api -name route.ts | wc -l` vs rows tabled; `grep -rl "use server" app lib actions | wc -l`
  vs action files covered; count of routes with an auth check vs total. Any gap must be explained, not hidden.
- If a bounded search caps results, say what was dropped. No silent truncation.
- End Phase A with the executive summary: total surfaces audited, count by risk tier, and the 5 findings
  I should fix first.

## `=== END PROMPT ===`

---

## Optional: run it as a parallel workflow (faster, more thorough)

If you want maximum coverage, run the inventory as a fan-out instead of one linear pass. Suggested shape
(the model can author the actual `Workflow` script):

- **Fan out by module** (Auth-core, Sales, Procurement, Finance, Manufacturing, Inventory, HCM, Documents,
  Xendit, System/Admin, Master) — one agent per module enumerates its routes/actions into the row schema.
- **Barrier**, then a **dedup + cross-check** agent reconciles the two authz systems and the route→role matrix.
- **Adversarial verify** pass: for each `CRITICAL`/`High` finding, spawn 2–3 skeptics prompted to *refute*
  it (construct the actual request that fails, or prove the guard exists). Keep only findings that survive.
- **Synthesis** agent writes the three deliverable files.

Guidance to give the workflow: default to `pipeline()`; only use a barrier before the reconcile/synthesis
steps that genuinely need all module results at once.

---

## Quick-start checklist (for the human)

1. Fresh session at repo root on branch `claude/security-audit-prompt-*`.
2. Paste the block between `=== BEGIN PROMPT ===` and `=== END PROMPT ===`.
3. Let Phase A finish; review `docs/security/SECURITY_FUNCTION_INVENTORY.md` and `SECURITY_FINDINGS.md`.
4. Approve Phase B only when you're ready to plan fixes.
5. Keep the audit read-only until you've read the findings — do not let it "fix as it goes."
