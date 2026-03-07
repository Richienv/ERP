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
- **Test baseline:** 316/321 pass (5 pre-existing failures)

## Key Files

- `lib/query-keys.ts` — centralized query key factory
- `hooks/use-nav-prefetch.ts` — sidebar hover prefetch map
- `lib/actions/` — shared server actions
- `app/actions/` — page-level server actions
- `lib/db.ts` — Prisma singleton for reads
- `lib/dialog-styles.ts` — neo-brutalist dialog styles

---

## Session 2026-02-19T06:00:00Z — Ralph Loop Audit (F-001 to F-011)
- **Status:** COMPLETE — All 11 features pass
- **Completed:** 63 mutation points audited and fixed across all modules
- **Key fix:** Removed all unstable_cache wrappers (caused stale data on TanStack Query refetch)
- **Key fix:** Auth redirect race condition in middleware.ts (cache warming killed sessions)
- **Key fix:** Login page race condition (router.push before cookies sync)
- **Key fix:** Added inline supplier creation in material-input-form.tsx
- **Key fix:** Added SupplierCategory model + vendor categories multi-select
- **Key fix:** Added 10s refetchInterval to vendor list for real-time multi-user sync

## Session 2026-02-19 — Meeting Bug List (T-001 to T-010)
- **Source:** bug-list-meeting-19feb2026.md
- **Already fixed from prior work:** BUG-001, BUG-002, BUG-003, BUG-007, FEAT-001 (categories), FEAT-004 (supplier inline)
- **Remaining:** T-001 to T-009 (T-010 skipped — needs human review)
- **Approach:** Parallel agents via dispatching-parallel-agents skill

## Session 2026-03-08 — CSA Parity Sprint (CSA-001 to CSA-020)
- **Source:** docs/csa_vs_erp_comparison.json — 274 CSA features mapped against ERP
- **Filtered:** 20 tasks selected for Indonesian textile SME relevance (skipped enterprise bloat like multi-site, POS, complex security)
- **Priority:** 7 high, 7 medium, 6 low
- **Key areas:** UOM conversion, opening balances (GL/AP/AR/Stock), costing methods, direct purchase, returns workflows, closing journal, discount system, exchange rates
- **Branch:** feat/csa-parity
- **Verify command:** `npx vitest run && npx tsc --noEmit && npm run lint`
