# Account Hierarchy — parentId + Code-Prefix Grouping

**Date:** 2026-03-26
**Status:** Approved
**Approach:** A — add parentId to GLAccount, auto-group by code prefix, keep 5-type enum

## Problem

The COA page (`/finance/chart-accounts`) has a tree UI component that supports hierarchy rendering, but the backend returns all accounts flat (empty children arrays). Users see a flat list of 43+ accounts with no visual grouping — hard to navigate and doesn't match industry-standard COA presentation.

## Design

### Schema Change

Add self-referential `parentId` to GLAccount:

```prisma
model GLAccount {
  // ... existing fields ...
  parentId  String?    @db.Uuid
  parent    GLAccount? @relation("AccountHierarchy", fields: [parentId], references: [id])
  children  GLAccount[] @relation("AccountHierarchy")
}
```

### Auto-grouping by Code Prefix

Server action builds tree by matching code prefixes:
- Shorter code is parent of longer code with same prefix
- `1000` → parent of `1010`, `1050`, `1100`
- `1100` → parent of `1110`, `1111`
- Root accounts: those with no shorter-code ancestor

The `parentId` field also supports manual override for edge cases.

### Migration

1. Prisma migration: add `parentId` UUID nullable FK to `gl_accounts`
2. Post-migration script: auto-populate `parentId` based on code prefix matching

### Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add parentId, parent, children to GLAccount |
| `prisma/migrations/` | New migration |
| `lib/actions/finance-gl.ts` or `finance.ts` | Update `getChartOfAccountsTree()` to build real tree from parentId |
| `app/finance/chart-accounts/page.tsx` | Already has tree UI — just needs real hierarchical data |
| `prisma/seed-gl.ts` | Add parentId assignments for seeded accounts |

### What Does NOT Change

- AccountType enum (5 types) stays as-is
- All financial reports — unchanged
- All GL posting logic — unchanged
- SYS_ACCOUNTS constants — unchanged
- Balance calculations — unchanged

## Verification

| Step | Action | Expected |
|------|--------|----------|
| 1 | Open `/finance/chart-accounts` | Tree with indentation: 1000 > 1010, 1050, 1110... |
| 2 | Click chevron on parent account | Children collapse/expand |
| 3 | Create account with code 1112 | Auto-appears under 1100 group |
| 4 | Open `/finance/reports` → Neraca | All balances unchanged |
