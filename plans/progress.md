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
