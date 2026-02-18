# Ralph Loop Setup — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Set up dual-mode Ralph Loop infrastructure with ERP-specific guardrails and pre-loaded data consistency audit tasks.

**Architecture:** 12 files: 3 Claude commands, 1 stop hook, 4 bash scripts, 3 plan files, 1 settings update. All customized for this ERP project's verification command (`npx vitest run && npx tsc --noEmit && npm run lint`), Indonesian localization, and TanStack Query cache patterns.

**Tech Stack:** Bash, jq, Claude Code hooks API (v2.1), vitest, tsc, eslint

---

### Task 1: Create guardrails.md with ERP-specific seed signs

**Files:**
- Create: `plans/guardrails.md`

**Step 1: Write the guardrails file**

```markdown
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
```

**Step 2: Verify file was created**

Run: `cat plans/guardrails.md | head -5`
Expected: Shows the header "# Guardrails (Signs)"

**Step 3: Commit**

```bash
git add plans/guardrails.md
git commit -m "chore: add Ralph guardrails with 14 ERP-specific seed signs"
```

---

### Task 2: Create structured progress.md

**Files:**
- Create: `plans/progress.md`

**Step 1: Write the progress file**

```markdown
# Ralph Progress Log

Started: 2026-02-19
Project: ERP Textile (Indonesian SME)

## Codebase Patterns

- **Framework:** Next.js 16 App Router + Turbopack
- **ORM:** Prisma 6.x → PostgreSQL (Supabase)
- **UI:** shadcn/ui + Tailwind v4, neo-brutalist design
- **State:** TanStack Query for reads, server actions for writes
- **Auth:** Supabase Auth (SSR, cookie-based)
- **Localization:** Bahasa Indonesia, IDR currency
- **Test baseline:** 296/301 pass (5 pre-existing failures)

## Key Files

- `lib/query-keys.ts` — centralized query key factory
- `hooks/use-nav-prefetch.ts` — sidebar hover prefetch map
- `lib/actions/` — shared server actions
- `app/actions/` — page-level server actions
- `lib/db.ts` — Prisma singleton for reads
- `lib/dialog-styles.ts` — neo-brutalist dialog styles

---

<!-- Sessions will be appended below in structured format:
## Session YYYY-MM-DDTHH:MM:SSZ
- **Task:** F-XXX — Title
- **Iterations:** N/max
- **Status:** complete | partial | blocked
- **Completed:** [list]
- **Blocked:** [what's blocking]
- **Learned:** [patterns → may become new SIGN-XXX]
- **Files changed:** [key files]
-->
```

**Step 2: Commit**

```bash
git add plans/progress.md
git commit -m "chore: add Ralph structured progress log"
```

---

### Task 3: Create prd.json with data consistency audit tasks

**Files:**
- Create: `plans/prd.json`

**Step 1: Write the prd.json file**

```json
{
  "features": [
    {
      "id": "F-001",
      "title": "Map all mutation→query relationships across modules",
      "priority": "high",
      "passes": false,
      "acceptance_criteria": [
        "Document every create/update/delete mutation in the app",
        "For each mutation, list ALL query keys that should be invalidated",
        "Include cross-module dependencies (e.g. PO confirm → keuangan dashboard)",
        "Output as structured markdown in plans/mutation-query-map.md",
        "No code changes — discovery and documentation only"
      ],
      "notes": "Discovery phase. Map the entire mutation→query dependency graph before fixing anything."
    },
    {
      "id": "F-002",
      "title": "Fix all mutation cache invalidation using the map from F-001",
      "priority": "high",
      "passes": false,
      "acceptance_criteria": [
        "Every mutation listed in plans/mutation-query-map.md calls invalidateQueries() for ALL affected query keys",
        "Cross-module invalidation works (e.g. creating product updates inventory list AND categories page AND dashboard KPIs)",
        "Write tests verifying cache invalidation for critical paths",
        "All existing tests still pass (baseline: 296/301)",
        "No new TypeScript errors introduced",
        "No new lint errors introduced"
      ],
      "notes": "Implementation phase. Use the mutation-query map from F-001 as the source of truth."
    }
  ]
}
```

**Step 2: Verify JSON is valid**

Run: `jq '.' plans/prd.json`
Expected: Pretty-printed JSON without errors

**Step 3: Commit**

```bash
git add plans/prd.json
git commit -m "chore: add Ralph prd.json with data consistency audit tasks"
```

---

### Task 4: Create the stop hook (same-session mode)

**Files:**
- Create: `.claude/hooks/stop-hook.sh`

**Step 1: Write the stop hook script**

Copy the template from `/Users/richiekidnovell/.claude/plugins/cache/ralph-loop-setup/ralph-loop-setup/1.3.3/skills/ralph-loop-setup/hooks/stop-hook-template.sh` but customize:

- Change `VERIFY_COMMAND` to: `npx vitest related $(git diff --name-only HEAD~1) 2>/dev/null; npx tsc --noEmit && npm run lint`
- Keep `PROGRESS_FILE`, `PRD_FILE`, `GUARDRAILS_FILE` as defaults (they match our paths)

The only line that changes from the template:

```bash
# Line 23: Change from
VERIFY_COMMAND="pnpm verify"
# To
VERIFY_COMMAND="npx vitest related \$(git diff --name-only HEAD~1) 2>/dev/null; npx tsc --noEmit && npm run lint"
```

**Step 2: Make executable**

Run: `chmod +x .claude/hooks/stop-hook.sh`

**Step 3: Verify**

Run: `head -30 .claude/hooks/stop-hook.sh`
Expected: Shows the customized VERIFY_COMMAND

**Step 4: Commit**

```bash
git add .claude/hooks/stop-hook.sh
git commit -m "chore: add Ralph same-session stop hook with ERP verification"
```

---

### Task 5: Update .claude/settings.json with hook registration

**Files:**
- Modify: `.claude/settings.json`

**Step 1: Update settings.json**

The current file only has `enabledPlugins`. Add the hook registration:

```json
{
  "enabledPlugins": {
    "superpowers@claude-plugins-official": true
  },
  "hooks": {
    "Stop": [
      {
        "type": "command",
        "command": "bash .claude/hooks/stop-hook.sh"
      }
    ]
  }
}
```

**Step 2: Verify JSON is valid**

Run: `jq '.' .claude/settings.json`
Expected: Pretty-printed JSON

**Step 3: Commit**

```bash
git add .claude/settings.json
git commit -m "chore: register Ralph stop hook in settings.json"
```

---

### Task 6: Create ralph.sh (fresh-context external loop)

**Files:**
- Create: `scripts/ralph/ralph.sh`

**Step 1: Write the script**

Copy from template at `/Users/richiekidnovell/.claude/plugins/cache/ralph-loop-setup/ralph-loop-setup/1.3.3/skills/ralph-loop-setup/templates/ralph-fresh.sh` but customize:

- Line 30: Change `VERIFY_COMMAND="pnpm verify"` to `VERIFY_COMMAND="npx vitest run && npx tsc --noEmit && npm run lint"`

Note: Fresh-context mode uses the FULL test suite (not `vitest related`) because each iteration is a complete task boundary. The scoped `vitest related` is only for the stop hook (same-session, mid-task iterations).

**Step 2: Make executable**

Run: `chmod +x scripts/ralph/ralph.sh`

**Step 3: Verify**

Run: `head -35 scripts/ralph/ralph.sh`
Expected: Shows customized VERIFY_COMMAND

**Step 4: Commit**

```bash
git add scripts/ralph/ralph.sh
git commit -m "chore: add Ralph fresh-context loop script"
```

---

### Task 7: Create helper scripts (stop, status, tail)

**Files:**
- Create: `scripts/ralph/ralph-stop.sh`
- Create: `scripts/ralph/ralph-status.sh`
- Create: `scripts/ralph/ralph-tail.sh`

**Step 1: Write ralph-stop.sh**

Copy verbatim from template: `/Users/richiekidnovell/.claude/plugins/cache/ralph-loop-setup/ralph-loop-setup/1.3.3/skills/ralph-loop-setup/templates/ralph-stop.sh`

No customization needed.

**Step 2: Write ralph-status.sh**

Copy verbatim from template: `/Users/richiekidnovell/.claude/plugins/cache/ralph-loop-setup/ralph-loop-setup/1.3.3/skills/ralph-loop-setup/templates/ralph-status.sh`

No customization needed — already includes token/cost tracking.

**Step 3: Write ralph-tail.sh**

Copy verbatim from template: `/Users/richiekidnovell/.claude/plugins/cache/ralph-loop-setup/ralph-loop-setup/1.3.3/skills/ralph-loop-setup/templates/ralph-tail.sh`

No customization needed.

**Step 4: Make all executable**

Run: `chmod +x scripts/ralph/ralph-stop.sh scripts/ralph/ralph-status.sh scripts/ralph/ralph-tail.sh`

**Step 5: Commit**

```bash
git add scripts/ralph/ralph-stop.sh scripts/ralph/ralph-status.sh scripts/ralph/ralph-tail.sh
git commit -m "chore: add Ralph helper scripts (stop, status, tail)"
```

---

### Task 8: Create Claude commands (ralph-loop, ralph-cancel, ralph-planner)

**Files:**
- Create: `.claude/commands/ralph-loop.md`
- Create: `.claude/commands/ralph-cancel.md`
- Create: `.claude/commands/ralph-planner.md`

**Step 1: Write ralph-loop.md**

Copy from template: `/Users/richiekidnovell/.claude/plugins/cache/ralph-loop-setup/ralph-loop-setup/1.3.3/skills/ralph-loop-setup/templates/ralph-loop-command.md`

No customization needed — the command reads VERIFY_COMMAND from the hook/script.

**Step 2: Write ralph-cancel.md**

Copy from template: `/Users/richiekidnovell/.claude/plugins/cache/ralph-loop-setup/ralph-loop-setup/1.3.3/skills/ralph-loop-setup/templates/ralph-cancel-command.md`

No customization needed.

**Step 3: Write ralph-planner.md**

Copy from template: `/Users/richiekidnovell/.claude/plugins/cache/ralph-loop-setup/ralph-loop-setup/1.3.3/skills/ralph-loop-setup/templates/ralph-planner.md`

No customization needed.

**Step 4: Commit**

```bash
git add .claude/commands/ralph-loop.md .claude/commands/ralph-cancel.md .claude/commands/ralph-planner.md
git commit -m "chore: add Ralph Claude commands (loop, cancel, planner)"
```

---

### Task 9: Update .gitignore for Ralph runtime files

**Files:**
- Modify: `.gitignore`

**Step 1: Add Ralph runtime exclusions**

Append to `.gitignore`:

```
# Ralph Loop runtime files (not committed)
.claude/ralph-loop.local.md
.claude/ralph-state.local.md
.claude/ralph-status.local.json
scripts/ralph/runs/
```

The `plans/` files (prd.json, progress.md, guardrails.md) ARE committed — they're persistent state. Only runtime state files are excluded.

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add Ralph runtime files to .gitignore"
```

---

### Task 10: Update MEMORY.md with data consistency standard

**Files:**
- Modify: `/Users/richiekidnovell/.claude/projects/-Volumes-Extreme-SSD-new-erp-feb-ERP/memory/MEMORY.md`

**Step 1: Add Data Consistency standard**

Add after the "Project Conventions" section:

```markdown
## Standard: Cross-Module Data Consistency

**MANDATORY.** Every button click, every update, must be reflected across ALL connected pages and modules.

- If inventory shows quantity 7, procurement MUST also show 7
- If a PO is confirmed, the procurement page, keuangan dashboard, and inventory alerts ALL update
- Before implementing any mutation: ask "What OTHER pages display this data?" and invalidate ALL of them
- Use `queryClient.invalidateQueries({ queryKey: queryKeys.<domain>.all })` for prefix-match invalidation
- A mutation that only updates the local component is a BROKEN implementation
- This is tested via Ralph Loop guardrail SIGN-007

## Ralph Loop Setup

- **Installed:** 2026-02-19
- **Verify command (fresh-context):** `npx vitest run && npx tsc --noEmit && npm run lint`
- **Verify command (same-session):** `npx vitest related $(git diff --name-only HEAD~1); npx tsc --noEmit && npm run lint`
- **Plans dir:** `plans/` (prd.json, progress.md, guardrails.md)
- **Scripts:** `scripts/ralph/` (ralph.sh, ralph-stop.sh, ralph-status.sh, ralph-tail.sh)
- **Commands:** `/ralph-loop`, `/ralph-cancel`, `/ralph-planner`
- **Test baseline:** 296/301 pass (5 pre-existing failures — do NOT fix unless tasked)
```

**Step 2: No commit needed** (MEMORY.md is in Claude's auto-memory, not in the repo)

---

### Task 11: Verify full setup works

**Step 1: Verify all files exist**

Run: `ls -la .claude/commands/ .claude/hooks/ scripts/ralph/ plans/`

Expected: All files present:
- `.claude/commands/ralph-loop.md`, `ralph-cancel.md`, `ralph-planner.md`
- `.claude/hooks/stop-hook.sh`
- `scripts/ralph/ralph.sh`, `ralph-stop.sh`, `ralph-status.sh`, `ralph-tail.sh`
- `plans/prd.json`, `progress.md`, `guardrails.md`

**Step 2: Verify all scripts are executable**

Run: `ls -la scripts/ralph/*.sh .claude/hooks/*.sh | awk '{print $1, $NF}'`

Expected: All show `-rwx` permissions

**Step 3: Verify prd.json is valid**

Run: `jq '.features | length' plans/prd.json`

Expected: `2`

**Step 4: Verify settings.json has hook**

Run: `jq '.hooks.Stop[0].command' .claude/settings.json`

Expected: `"bash .claude/hooks/stop-hook.sh"`

**Step 5: Dry run to verify fresh-context mode works**

Run: `./scripts/ralph/ralph.sh --max-iterations 1 2>&1 | head -20`

Expected: Shows Ralph header, finds 2 pending tasks, attempts to spawn Claude

**Step 6: Final commit**

```bash
git add -A
git commit -m "chore: complete Ralph Loop setup with ERP-specific configuration"
```
