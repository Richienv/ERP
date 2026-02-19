# Ralph Loop — AI Agent Guide

## What Is Ralph Loop

Ralph Loop is a Claude Code plugin that creates autonomous development loops. It intercepts Claude's exit attempts and re-feeds the original prompt, allowing iterative self-improvement on a task until completion criteria are met or the iteration limit is reached.

Each iteration sees all file modifications and git history from previous attempts, creating a self-correcting feedback loop.

---

## Installation

```bash
# Install the plugin
claude plugin install ralph-loop

# Verify installation
claude /help
```

---

## Command Syntax

```bash
/ralph-loop "<prompt>" --max-iterations <N> --completion-promise "<text>"
```

| Parameter | Required | Description |
|-----------|----------|-------------|
| `prompt` | Yes | The task description with explicit success criteria |
| `--max-iterations` | Yes (safety) | Maximum loop cycles before forced stop (always set this) |
| `--completion-promise` | Recommended | Exact string Claude outputs when task is complete |

---

## The Golden Rules

### 1. ALWAYS Set `--max-iterations`

This is your safety net. The completion promise uses exact string matching which is unreliable. Iterations are your real protection against infinite loops and runaway API costs.

```bash
# Good — has a safety limit
/ralph-loop "Fix auth bugs" --max-iterations 20 --completion-promise "DONE"

# Dangerous — no limit
/ralph-loop "Fix auth bugs" --completion-promise "DONE"
```

### 2. Write Prompts With Binary Success Criteria

Ralph works best when success is **programmatically verifiable** (tests pass, build succeeds, lint clean). Vague prompts lead to infinite loops.

```bash
# BAD — vague, no measurable success
/ralph-loop "Make the dashboard better" --max-iterations 20

# GOOD — binary, testable success
/ralph-loop "Fix all TypeScript compilation errors in src/inventory/.
Run 'npm run typecheck' after each fix.
Output DONE when 'npm run typecheck' exits with code 0 and zero errors." \
--max-iterations 25 --completion-promise "DONE"
```

### 3. Mechanical Tasks Over Judgment Tasks

Ralph excels at repetitive, well-defined work. It struggles with ambiguous decisions.

**Use Ralph for:**
- Fixing all lint/type errors across a codebase
- Writing tests for existing code until coverage threshold met
- Migrating files from one pattern to another
- Fixing failing CI pipelines
- Batch refactoring (renaming, restructuring imports)
- Generating boilerplate across many files
- Database migration scripts with validation

**Don't use Ralph for:**
- "Make the UI look better" (subjective)
- Architecture decisions
- Security-critical code (always review manually)
- Exploratory prototyping where "done" is unclear

### 4. Include Failure Handling in Your Prompt

Tell Claude what to do if it gets stuck so it doesn't waste iterations spinning.

```bash
/ralph-loop "Implement cache invalidation for all mutation endpoints.
Run tests after each change.

Success criteria:
- All existing tests still pass
- New tests verify cache is invalidated after each mutation
- npm run test exits with 0

If stuck after 15 iterations:
- Document what is blocking progress
- List what was attempted
- Suggest alternative approaches
- Output STUCK

Output DONE when all criteria met." \
--max-iterations 20 --completion-promise "DONE"
```

---

## Prompt Engineering Patterns

### Pattern 1: TDD Loop (Test-Driven Development)

```bash
/ralph-loop "Implement the stock adjustment API endpoint following TDD:
1. Write a failing test for POST /api/inventory/adjustments
2. Implement minimum code to pass
3. Run 'npm test -- --grep adjustment'
4. If tests fail, debug and fix
5. Add next test case (validation, edge cases, auth)
6. Repeat until:
   - All CRUD operations tested
   - Input validation tested (negative qty, missing fields)
   - Auth/permission tested
   - All tests green

Output DONE when 'npm test' shows all passing with >80% coverage
for the adjustments module." \
--max-iterations 30 --completion-promise "DONE"
```

### Pattern 2: Bug Fix Batch

```bash
/ralph-loop "Fix all cache invalidation bugs in the ERP system.

Known issues:
1. Adding product doesn't update Kelola Produk page
2. Stock adjustment doesn't update Riwayat Penyesuaian
3. Adding fabric roll doesn't update Fabric Rolls list
4. Confirming PO doesn't update Pesanan Pembelian status

For each issue:
- Find the mutation function
- Add queryClient.invalidateQueries() after successful mutation
- Add optimistic update where appropriate
- Write a test verifying cache invalidation

Run 'npm test' after fixing each issue.
Output DONE when all 4 issues fixed and all tests pass." \
--max-iterations 25 --completion-promise "DONE"
```

### Pattern 3: Multi-Phase Build

Break large tasks into sequential phases.

```bash
# Phase 1
/ralph-loop "Phase 1: Create database schema for Indonesian tax invoice (Faktur Pajak).
Tables: invoices, invoice_items, tax_details.
Include PPN (11%) calculation fields.
Run migrations and verify schema.
Output PHASE1_DONE when migrations succeed." \
--max-iterations 15 --completion-promise "PHASE1_DONE"

# Phase 2
/ralph-loop "Phase 2: Build API endpoints for invoice CRUD.
Use existing schema from Phase 1.
Include validation for Indonesian tax ID (NPWP) format.
All endpoints tested.
Output PHASE2_DONE when all tests pass." \
--max-iterations 20 --completion-promise "PHASE2_DONE"

# Phase 3
/ralph-loop "Phase 3: Build PDF generation for Faktur Pajak.
Match DJP (Direktorat Jenderal Pajak) format standards.
Validate output renders correctly.
Output PHASE3_DONE when PDF generates without errors." \
--max-iterations 20 --completion-promise "PHASE3_DONE"
```

### Pattern 4: Overnight Batch Script

Run multiple Ralph loops sequentially while you sleep.

```bash
#!/bin/bash
# overnight-work.sh

cd /path/to/erp-project

# Task 1: Fix all TypeScript errors
claude -p "/ralph-loop 'Fix all TypeScript errors. Run npm run typecheck. Output DONE when zero errors.' --max-iterations 30 --completion-promise 'DONE'"

# Task 2: Add missing tests
claude -p "/ralph-loop 'Write unit tests for all untested API routes in src/api/. Target 80% coverage. Run npm test -- --coverage. Output DONE when coverage >= 80%.' --max-iterations 40 --completion-promise 'DONE'"

# Task 3: Generate API docs
claude -p "/ralph-loop 'Generate OpenAPI/Swagger docs for all endpoints. Validate with swagger-cli validate. Output DONE when validation passes.' --max-iterations 15 --completion-promise 'DONE'"
```

```bash
chmod +x overnight-work.sh
./overnight-work.sh
```

---

## Cost Management

Ralph loops consume API credits proportional to iterations x context size.

| Loop Size | Estimated Cost | Use Case |
|-----------|---------------|----------|
| 5-10 iterations | $5-15 | Small focused fix |
| 15-25 iterations | $15-40 | Feature implementation |
| 30-50 iterations | $40-100+ | Large refactor or multi-file migration |

**Cost reduction tips:**
- Start with `--max-iterations 10` and increase only if needed
- Keep the codebase context small (use `.claudeignore` to exclude irrelevant files)
- Break large tasks into phases instead of one massive loop
- Use specific file paths in prompts to reduce context scanning
- Monitor usage in your Claude Code dashboard

---

## ERP Project — Ready-to-Use Prompts

### Fix State/Reactivity Bugs (The Most Common Bug Pattern)

```bash
/ralph-loop "Audit and fix all mutation-without-invalidation bugs in the app.

Search all files in src/ for mutation calls (POST, PUT, DELETE, PATCH).
For each mutation:
1. Check if queryClient.invalidateQueries() is called on success
2. If missing, add appropriate cache invalidation
3. For list pages, also add optimistic updates for instant UI feedback

Modules to check:
- Inventory (products, stock adjustments, fabric rolls, transfers)
- Pengadaan (purchase orders, vendors)
- Penjualan (sales orders)
- Keuangan (invoices, AR, AP)

Run 'npm test' after each module.
Output DONE when all mutations have cache invalidation and tests pass." \
--max-iterations 30 --completion-promise "DONE"
```

### Fix Session Expiry Issues

```bash
/ralph-loop "Fix the session expiry (SESI KEDALUWARSA) bug.

The issue: users randomly get session expired errors on page navigation
even with valid sessions.

Investigate:
1. Check token refresh logic in auth middleware
2. Verify token is sent on all API requests (check axios interceptors)
3. Check if token refresh race conditions exist
4. Verify session timeout configuration matches backend

Fix the root cause. Add tests for:
- Token refresh on 401 response
- Concurrent request handling during refresh
- Navigation with valid vs expired tokens

Run 'npm test' after fixes.
Output DONE when session handling is robust and tests pass." \
--max-iterations 20 --completion-promise "DONE"
```

### Stock Status Logic Fix

```bash
/ralph-loop "Fix stock status calculation logic.

Bug: Products show 'Kritis' (critical) status even when actual stock
is well above minimum stock level.

Find the stock status calculation function.
Fix logic so status is:
- 'Aman' (safe) when stock > min_stock * 2
- 'Rendah' (low) when stock > min_stock but <= min_stock * 2
- 'Kritis' (critical) when stock <= min_stock
- 'Habis' (empty) when stock = 0

Write tests covering all edge cases including zero min_stock.
Run tests.
Output DONE when logic is correct and all tests pass." \
--max-iterations 15 --completion-promise "DONE"
```

### Generate WhatsApp Bot Endpoints

```bash
/ralph-loop "Build WhatsApp webhook endpoints for OIC bot integration.

Implement:
1. POST /api/webhook/whatsapp — receive incoming messages
2. Message parser for Indonesian text commands (cek stok, buat PO, dll)
3. Response formatter for WhatsApp-friendly text
4. Stock check command: 'cek stok [product name]'
5. PO status command: 'status PO [number]'
6. Daily summary command: 'laporan hari ini'

Each command must:
- Validate input
- Query existing ERP database
- Return formatted Indonesian response
- Handle errors gracefully with user-friendly messages

Write integration tests for each command.
Output DONE when all tests pass." \
--max-iterations 35 --completion-promise "DONE"
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Loop never completes | Lower ambition in prompt, add clearer success criteria |
| Loop exits early | Check completion-promise isn't accidentally in output text |
| Too expensive | Reduce max-iterations, narrow scope, break into phases |
| Stuck in infinite fix loop | Add "if stuck after N iterations, document blockers" to prompt |
| Wrong approach on every iteration | Your prompt needs more guardrails — specify the approach, not just the goal |
| jq dependency error (Windows) | Use WSL instead of Git Bash |

---

## Key Principles Summary

1. **Always set `--max-iterations`** — your financial safety net
2. **Binary success criteria** — tests pass or they don't, no gray area
3. **Mechanical > judgment** — repetitive well-defined tasks, not creative decisions
4. **Phase large tasks** — 3 focused loops beats 1 massive loop
5. **Include stuck-handling** — tell Claude what to do when blocked
6. **Start small** — test with 5-10 iterations before committing to 50
7. **Review the output** — Ralph automates execution, not accountability
8. **Never ship security code unreviewed** — always human-review auth, payment, permissionss