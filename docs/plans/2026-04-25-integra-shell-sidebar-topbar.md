# Integra Shell (Sidebar + Topbar) Implementation Plan

> **For Claude:** Execute task-by-task. Commit after each task for rollback safety.

**Goal:** Replace NB sidebar/topbar with pixel-perfect Integra shell for all Integra-enabled routes.

**Architecture:** Build a self-contained `IntegraShell` (no shadcn Sidebar primitives) that renders sidebar + topbar + content. `GlobalLayout` selects shell based on route. Keep old NB shell for unmigrated pages.

**Tech Stack:** Plain divs + sticky positioning + Integra tokens. No new deps.

**Reference:** `/Users/richiekidnovell/Downloads/design_handoff_integra_erp 2/integra.html` lines 47–151 (sidebar CSS), 540–651 (sidebar markup).

---

## Task 1: Build IntegraSidebar component

**Files:**
- Create: `lib/integra-nav-data.ts` — nav sections + items (Umum, Pengadaan, Logistik, Keuangan, SDM, Armada)
- Create: `components/integra/sidebar.tsx`

**Spec:**
- Brand row 52px: 22px dark mark "I", "Integra" wordmark, "PRD" env badge (mono, hairline border)
- Search row: input + ⌘K kbd
- Nav sections: title (10px uppercase tracked), items 13px with 14px icon + optional count (mono 11px, color variants warn/err)
- Active item: `bg-[var(--integra-ink)]` + `text-[var(--integra-canvas)]`
- Hover: `bg-[#F1EFE8]`
- Footer: avatar (24px circle) + user-name + role + chevron, hairline top
- Sticky 100vh, hairline right border, scrollable middle

## Task 2: Build IntegraTopbar component

**Files:**
- Create: `components/integra/topbar.tsx`

**Spec:**
- 52px height, hairline bottom, sticky top
- Left: breadcrumbs (12.5px muted, "/" separator, current page in ink)
- Right: optional period selector + filter button + actions slot
- Auto-derive breadcrumbs from pathname (e.g. `/dashboard` → "Beranda / Dasbor")

## Task 3: Build IntegraShell wrapper

**Files:**
- Create: `components/integra/shell.tsx`

**Spec:**
- 2-col grid: sidebar (240px fixed) + main (1fr)
- Wraps content with `integra-app` class for CSS variable scope
- Renders `<IntegraSidebar />`, `<IntegraTopbar />`, then children inside `<main>`

## Task 4: Wire IntegraShell into GlobalLayout

**Files:**
- Modify: `components/global-layout.tsx`
- Create: `lib/integra-routes.ts` — `INTEGRA_ROUTES` set + `isIntegraRoute(pathname)` helper

**Spec:**
- Add `isIntegraRoute(pathname)` check; if true, render `<IntegraShell>` instead of `<SidebarProvider>` chain
- Initial `INTEGRA_ROUTES`: `/dashboard`
- Auth pages: unchanged

## Task 5: Remove redundant `integra-app` wrapper from dashboard-integra.tsx

**Files:**
- Modify: `app/dashboard/dashboard-integra.tsx`

**Spec:**
- Drop outer `<div className="integra-app min-h-screen">` since shell now provides it
- Drop the now-orphaned topbar markup inside the page (shell handles it)

## Task 6: Verify + commit + push

- Type-check + lint pass on integra files
- Browser visual check: `/dashboard` shows Integra sidebar + topbar matching reference
- Commit each task independently; final push to `feat/integra-mining-pivot`
