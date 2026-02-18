# Ralph Loop Setup — ERP Textile Project Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create implementation plan from this design.

**Goal:** Set up autonomous Ralph Loop infrastructure (both modes) with ERP-specific guardrails and pre-loaded data consistency audit as first task batch.

**Architecture:** Dual-mode Ralph — fresh-context (external bash, new Claude session per iteration) for multi-task backlogs + same-session (stop hook) for single focused tasks. Full monitoring dashboard, cost tracking, and structured cross-session memory.

**Tech Stack:** Bash scripts, Claude Code hooks, jq for JSON processing, vitest + tsc + eslint for verification.

---

## 1. Files to Create

| File | Purpose |
|------|---------|
| `.claude/commands/ralph-loop.md` | Start command (both modes) |
| `.claude/commands/ralph-cancel.md` | Cancel/stop command |
| `.claude/commands/ralph-planner.md` | Plan tasks from GitHub issues |
| `.claude/hooks/stop-hook.sh` | Same-session verification hook |
| `scripts/ralph/ralph.sh` | Fresh-context external loop |
| `scripts/ralph/ralph-stop.sh` | Stop script (kills processes, cleans state) |
| `scripts/ralph/ralph-status.sh` | Live status dashboard with cost tracking |
| `scripts/ralph/ralph-tail.sh` | Log tail helper |
| `plans/prd.json` | Task backlog (pre-loaded with data consistency audit) |
| `plans/progress.md` | Structured cross-session memory |
| `plans/guardrails.md` | ERP-specific learned constraints (13 seed signs) |
| `.claude/settings.json` | Updated with stop hook registration |

## 2. Verification Command (Scoped)

**Per-iteration (fast, scoped to changed files):**
```bash
npx vitest related $(git diff --name-only HEAD~1) && npx tsc --noEmit && npm run lint
```

**On task completion (full suite):**
```bash
npx vitest run && npx tsc --noEmit && npm run lint
```

If `vitest related` finds no related tests, falls through to tsc + lint only. The full suite runs as a gate before marking a task as `passes: true` in prd.json.

## 3. ERP-Specific Guardrails (Seeds)

```markdown
### SIGN-001: Verify Before Complete
Run verification command before outputting completion promise.

### SIGN-002: Check All Tasks Before Complete
Re-read prd.json to confirm ALL tasks pass before outputting COMPLETE.

### SIGN-003: Document Learnings
Update progress.md with structured session notes after each task.

### SIGN-004: Small Focused Changes
Keep changes incremental. Commit after each logical unit of work.

### SIGN-005: Use Skip for Manual Tasks
Set skip: true for tasks requiring human intervention.

### SIGN-006: Reference GitHub Issues in Commits
Include "Fixes #N" in commit messages when task has github_issue.

### SIGN-007: End-to-End Cache Invalidation
Every mutation must invalidateQueries() for ALL consumers across the entire app,
not just the local component. Before implementing any mutation, ask:
"What OTHER pages/components display this data?" and invalidate those too.

### SIGN-008: All UI Text in Bahasa Indonesia
Labels, statuses, error messages, toast notifications — all in Bahasa Indonesia.
Use industry terms Indonesian factory workers actually use (CMT, potong, jahit).

### SIGN-009: Neo-Brutalist Styling
border-2 border-black, shadow-[4px_4px_0px_0px_rgba(0,0,0,1)], white fill.
Import dialog styles from @/lib/dialog-styles.ts.

### SIGN-010: Full-Width Responsive Layout
Use className="mf-page" on page containers.
Never use max-w-[1600px] or fixed-width containers.

### SIGN-011: TanStack Query for All Reads
Never use useEffect + fetch + setLoading.
Always useQuery from @tanstack/react-query.
Use queryClient.invalidateQueries() instead of router.refresh().

### SIGN-012: Read-Only Queries Use Prisma Singleton
Read-only queries: prisma from @/lib/db + await requireAuth().
Only mutations use withPrismaAuth (which wraps in $transaction).

### SIGN-013: "use server" Export Restrictions
All exports from "use server" files must be async functions.
Move constants, objects, arrays to lib/*-helpers.ts files.
export type { ... } from "..." is allowed.

### SIGN-014: Do Not Fix Pre-Existing Test Failures
Baseline: 296/301 tests pass. 5 failures in app/actions/inventory.test.ts
are pre-existing (cookies scope + pool exhaustion). Do NOT attempt to fix
these unless explicitly tasked. They are not regressions.
```

## 4. Structured progress.md Format

```markdown
# Ralph Progress Log

## Session YYYY-MM-DDTHH:MM:SSZ
- **Task:** F-XXX — Title
- **Iterations:** N/max
- **Status:** complete | partial | blocked
- **Completed:** [list of what was done]
- **Blocked:** [what's blocking, if any]
- **Learned:** [new patterns, gotchas → may become new SIGN-XXX]
- **Files changed:** [key files modified]
```

This structured format lets Ralph parse its own history reliably across fresh-context sessions.

## 5. Pre-loaded prd.json (First Task Batch)

Two-phase approach: discover first, then fix with the map.

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

## 6. Cost Tracking

The `ralph-status.sh` dashboard already tracks token usage per run:
- Input tokens, output tokens, cache read tokens
- Accumulated cost in USD across all iterations
- Displayed in the live dashboard and stored in `.claude/ralph-status.local.json`

This lets you check in the morning and see "this overnight run cost ~$X" with full breakdown.

## 7. Usage After Setup

```bash
# Data consistency audit (fresh-context, recommended)
/ralph-loop --next --verbose --monitor

# Single focused task (same-session)
/ralph-loop "Fix the stock level calculation bug" --max-iterations 15

# Plan from GitHub issues
/ralph-planner --labels bug,P1

# Monitor running loop
./scripts/ralph/ralph-status.sh --watch

# Cancel running loop
/ralph-cancel --force
```
