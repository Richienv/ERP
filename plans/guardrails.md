# Guardrails (Signs)

Learned constraints that prevent repeated failures. Append-only — mistakes evaporate, lessons accumulate.

---

### SIGN-001: Verify Before Complete
**Trigger:** About to output completion promise
**Instruction:** Run full verification command first. Never claim completion without fresh test output.
**Reason:** False completion claims waste iterations and break trust.

### SIGN-002: Check All Tasks Before Complete
**Trigger:** Current task passes
**Instruction:** Re-read prd.json and confirm ALL features have `passes: true` before outputting `<promise>COMPLETE</promise>`.
**Reason:** Completing one task ≠ completing the batch. Premature completion halts the loop.

### SIGN-003: Document Learnings in progress.md
**Trigger:** After completing or making progress on any task
**Instruction:** Update plans/progress.md with structured session notes (Task, Iterations, Status, Completed, Blocked, Learned).
**Reason:** Fresh-context mode loses conversation history. File I/O is the only memory that persists.

### SIGN-004: Small Focused Changes
**Trigger:** Planning any code change
**Instruction:** Keep changes incremental. One logical unit per commit. Don't bundle unrelated changes.
**Reason:** Small commits are easier to verify, review, and revert. Large changes mask bugs.

### SIGN-005: Use Skip for Manual Tasks
**Trigger:** Task requires human intervention (account creation, API key setup, dashboard config)
**Instruction:** Set `skip: true` and `skipReason` in prd.json. Do not attempt manual tasks.
**Reason:** Attempting manual tasks wastes iterations and may cause damage.

### SIGN-006: Reference GitHub Issues in Commits
**Trigger:** Committing changes for a task with `github_issue` field
**Instruction:** Include `Fixes #N` in commit message body.
**Reason:** Links commits to issues for traceability and auto-closing.

### SIGN-007: End-to-End Cache Invalidation
**Trigger:** Implementing any create/update/delete mutation
**Instruction:** Before writing the mutation, list ALL pages/components that display this data. Call `queryClient.invalidateQueries()` for EVERY affected query key, including cross-module dependencies. A mutation that only updates the local component is a broken implementation.
**Reason:** Data consistency across modules is non-negotiable. Inventory showing 7 while PO shows 6 is unacceptable.

### SIGN-008: All UI Text in Bahasa Indonesia
**Trigger:** Adding any user-facing text (labels, statuses, errors, toasts, placeholders)
**Instruction:** Write all text in Bahasa Indonesia. Use industry terms Indonesian factory workers actually use: CMT, potong, jahit, gudang, stok, dll.
**Reason:** Target users are Indonesian textile/garment SMEs.

### SIGN-009: Neo-Brutalist Styling
**Trigger:** Creating or modifying any UI component
**Instruction:** Use `border-2 border-black`, `shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]`, white fill. Import dialog styles from `@/lib/dialog-styles.ts`.
**Reason:** Consistent design system across the entire app.

### SIGN-010: Full-Width Responsive Layout
**Trigger:** Creating or modifying any page layout
**Instruction:** Use `className="mf-page"` on page containers. Never use `max-w-[1600px]` or fixed-width containers. Must look good on 11" to 16" screens.
**Reason:** Full-width responsive is the mandatory standard.

### SIGN-011: TanStack Query for All Reads
**Trigger:** Fetching data for display
**Instruction:** Always use `useQuery` from `@tanstack/react-query`. Never use `useEffect + fetch + setLoading`. Use `queryClient.invalidateQueries()` instead of `router.refresh()`. Prefer `fetch()` to API routes for reads.
**Reason:** TanStack Query provides caching, deduplication, and instant loading via prefetch.

### SIGN-012: Read-Only Queries Use Prisma Singleton
**Trigger:** Writing a server action or API route that only reads data
**Instruction:** Use `prisma` from `@/lib/db` + `await requireAuth()`. Only mutations should use `withPrismaAuth` (which wraps in `$transaction` and consumes pool slots).
**Reason:** Prevents connection pool exhaustion on read-heavy pages.

### SIGN-013: "use server" Export Restrictions
**Trigger:** Adding exports to a `"use server"` file
**Instruction:** ALL exports must be async functions. Move constants, objects, arrays to `lib/*-helpers.ts`. `export type { ... }` is allowed.
**Reason:** Next.js runtime requirement. Sync exports from server files cause build errors.

### SIGN-014: Do Not Fix Pre-Existing Test Failures
**Trigger:** Seeing test failures in `app/actions/inventory.test.ts`
**Instruction:** Baseline is 296/301 tests pass. 5 failures are pre-existing (cookies scope + pool exhaustion). Do NOT attempt to fix these unless explicitly tasked. They are not regressions from your work.
**Reason:** Fixing unrelated pre-existing failures wastes iterations and risks introducing new bugs.

### SIGN-015: Never Hardcode GL Account Codes
**Trigger:** Writing any server action that references a GL account code (e.g., '1100', '2100', '1010', '4000')
**Instruction:** ALWAYS use `SYS_ACCOUNTS` from `lib/gl-accounts.ts`. Call `await ensureSystemAccounts()` before `postJournalEntry()`. If a new account code is needed, add it to `SYS_ACCOUNTS` and `SYSTEM_ACCOUNT_DEFS` first.
**Reason:** Finance bugs B-012 through B-018 were ALL caused by hardcoded codes not matching the database. The codes in the seed file and the codes in the server actions were different, causing "Account code not found" errors and empty COA/reports.

### SIGN-016: Every Financial Transaction Needs a Journal Entry
**Trigger:** Implementing any feature that creates, modifies, or settles a financial document (invoice, bill, payment, credit note, petty cash, fixed asset depreciation, inventory adjustment)
**Instruction:** The transaction MUST call `postJournalEntry()` with balanced debit/credit lines. If GL posting fails, revert the document status. See CLAUDE.md "Finance Module — Double-Entry Bookkeeping Rules" for standard patterns.
**Reason:** Without journal entries, data exists in the module's table but never appears in COA, financial reports, or aging reports. This was the #1 bug pattern found in the March 2026 finance audit.

### SIGN-017: Import from Domain-Specific Finance Files
**Trigger:** Writing imports for finance server actions
**Instruction:** Import from domain-specific files (`finance-ar.ts`, `finance-ap.ts`, `finance-gl.ts`, `finance-invoices.ts`, `finance-reports.ts`), NOT from the monolithic `finance.ts`. The monolithic file has deprecated/inferior implementations.
**Reason:** The `finance.ts` getARPaymentRegistry had a broken 100-invoice hard limit with client-side filtering. The correct implementation in `finance-ar.ts` uses DB-level filtering. 7 hooks were found importing from the wrong file.
