# ERP Ripple Check Skill — Design Document

**Date:** 2026-03-24
**Type:** Discipline Skill (hard-gated)
**Structure:** SKILL.md + erp-dependency-map.md

## Problem

When Claude modifies or creates a server action/function in the ERP, related pages, components, types, and GL entries often don't get updated. This has caused:

- **37 duplicated functions** across 5 finance action files with inconsistent implementations
- Pages importing from `finance.ts` (outdated) instead of specialized files (`finance-ap.ts`, etc.)
- Bug fixes in one file not propagating to duplicate copies
- GL account codes hardcoded as string literals instead of using `SYS_ACCOUNTS.*`
- Type/interface changes not reflected in all consumers

## Solution

A **discipline skill** called `erp-ripple-check` that forces Claude to trace all downstream effects of any code change before claiming the task is done.

## Skill Identity

- **Name:** `erp-ripple-check`
- **Type:** Discipline (hard gate — cannot skip)
- **Files:**
  - `SKILL.md` — Process, hard gates, anti-rationalization table (~250 lines)
  - `erp-dependency-map.md` — ERP-specific knowledge: file maps, GL account chains, known problem areas (~150 lines)

### Trigger Conditions

**Triggers when Claude:**
- Edits any file in `lib/actions/`
- Creates a new server action or shared function
- Modifies types/interfaces used across modules
- Fixes a bug in any function imported by 2+ files
- Touches GL posting, PPN calculation, or account codes

**Does NOT trigger when:**
- Editing UI-only code (styling, layout) with no action changes
- Editing a self-contained component with no shared imports
- Documentation-only changes

## Core Process — 5-Phase Ripple Check

### Phase 1: DUPLICATE SCAN

Before writing any code, search for the function name across the entire codebase.

- Grep for the function name in all `.ts`/`.tsx` files
- If found in multiple files → **FLAG IT**
- Either consolidate or delete the stale copy before proceeding
- Known hotspot: `finance.ts` contains stale copies of functions that live in `finance-ap.ts`, `finance-ar.ts`, `finance-gl.ts`, `finance-invoices.ts`

### Phase 2: CONSUMER TRACE

Find every file that imports or calls the modified/created function.

- Grep for `import.*{.*functionName.*}.*from` across all files
- Check for dynamic imports and re-exports
- Build a list: "These N files consume this function"
- Each consumer must be verified in Phase 5

### Phase 3: GL IMPACT TRACE (finance functions only)

If the function touches `postJournalEntry()`, GL accounts, or financial document status:

- Which `SYS_ACCOUNTS.*` constants does it use?
- Which report pages query those accounts? (neraca, laba-rugi, arus-kas, neraca-saldo)
- Does the journal entry balance? (`SUM(debit) === SUM(credit)`)
- Is PPN separated correctly? (DPP vs PPN amount)

### Phase 4: TYPE & INTERFACE CHECK

If the function signature changes (parameters, return type):

- Find all TypeScript interfaces/types that reference this function
- Find all Zod schemas that validate its inputs
- Update all of them consistently

### Phase 5: CONSUMER VERIFICATION

For each consumer found in Phase 2:

- Does it import from the correct (canonical) file?
- Does it pass the correct arguments? (matches new signature)
- Does the UI correctly display the result?
- If it shows financial data, does the data path still work?

## Hard Gate

```
CANNOT claim task is done until:
✅ Phase 1: No duplicate definitions (or explicitly flagged to user)
✅ Phase 2: All consumers identified
✅ Phase 3: GL entries balanced + reports verified (if applicable)
✅ Phase 4: All types/interfaces consistent
✅ Phase 5: Every consumer verified
```

## Anti-Rationalization Table

| Claude thinks... | Reality |
|---|---|
| "I only changed one line, no need to check consumers" | One-line bugs have caused production issues. Check anyway. |
| "This function is only used in one place" | Prove it. Grep first. The finance module has 37 duplicates. |
| "The types haven't changed so consumers are fine" | Behavior change without type change is the hardest bug to catch. |
| "I'll check consumers after I'm done" | No. Check BEFORE you finish. Consumer issues may affect your implementation. |
| "This isn't a finance function, skip GL trace" | If it touches ANY model with a GL relationship, Phase 3 applies. |
| "The duplicate in finance.ts is dead code" | Prove it. If nothing imports it, delete it. If something does, it's a live bug. |
| "I already know all the consumers" | You don't. Run the grep. Trust the search, not your memory. |

## Red Flags — STOP If:

- Creating a new function in `finance.ts` instead of the specialized file
- Hardcoding an account code as a string literal (`'1200'`, `'2000'`)
- Modified a function but haven't grepped for its consumers
- Changing a function signature without updating its Zod schema
- Found a duplicate and thinking "I'll clean it up later"

## Supporting Reference: erp-dependency-map.md

### Finance Action File Map (Canonical Sources)

```
approveVendorBill()     → finance-ap.ts
recordVendorPayment()   → finance-ap.ts
createCustomerInvoice() → finance-invoices.ts
moveInvoiceToSent()     → finance-invoices.ts
recordARPayment()       → finance-ar.ts
postJournalEntry()      → finance-gl.ts
ensureSystemAccounts()  → finance-gl.ts
```

Any copy in `finance.ts` is STALE — delete or replace with re-export.

### GL Account → Report Page Mapping

```
SYS_ACCOUNTS.AR (1200)      → neraca (Current Assets), AR aging report
SYS_ACCOUNTS.AP (2000)      → neraca (Current Liabilities), AP aging report
SYS_ACCOUNTS.REVENUE (4xxx) → laba-rugi (Revenue)
SYS_ACCOUNTS.EXPENSE (5-8xx)→ laba-rugi (Expense)
SYS_ACCOUNTS.BANK_BCA (1110)→ neraca (Asset), arus-kas
SYS_ACCOUNTS.PPN_MASUKAN    → neraca (Asset), tax report
SYS_ACCOUNTS.PPN_KELUARAN   → neraca (Liability), tax report
```

### Module → Action File Mapping

```
Sales pages       → lib/actions/sales.ts, finance-ar.ts, finance-invoices.ts
Procurement pages → lib/actions/procurement.ts, finance-ap.ts, grn.ts
Finance pages     → lib/actions/finance-gl.ts, finance-ar.ts, finance-ap.ts
Manufacturing     → API routes in app/api/manufacturing/
HCM               → lib/actions/hcm (TBD)
```

### Known Problem Areas

- `finance.ts` contains stale copies of 37+ functions — always check specialized files first
- Some pages import from `finance.ts` instead of the canonical specialized files
- PPN calculation has had blanket 11% fallback bugs — only apply when `includeTax === true`
- GL posting outside Prisma transactions can leave documents in wrong status on failure

## Output Format

After completing the ripple check, output:

```
## Ripple Check Complete
- Function: <name>
- File: <canonical path>
- Duplicates found: N (action taken)
- Consumers verified: N/N
  ✅ consumer1.tsx
  ✅ consumer2.tsx
- GL impact: <accounts> → reports verified
- Types: <change summary or "No signature change">
```

## Integration with Existing Skills

- **writing-plans** → Plans touching actions should note "ripple check required"
- **verification-before-completion** → Ripple check runs as part of verification
- **systematic-debugging** → Ripple check helps find all affected code paths
- **test-driven-development** → New consumer paths should have tests
- **Accounting audit SOP** (CLAUDE.md) → Audit checks accounting correctness; ripple check ensures code consistency. They complement each other.
