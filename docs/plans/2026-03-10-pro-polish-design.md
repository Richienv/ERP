# Professional Polish: Command Palette, Error Boundaries, Empty States

**Date:** 2026-03-10
**Branch:** feat/csa-parity
**Status:** Approved

## A: Command Palette (Cmd+K)

- New: `components/command-palette.tsx`
- Mounted once in `components/global-layout.tsx`
- Uses existing `cmdk` primitives from `components/ui/command.tsx`
- Groups: Navigasi (all nav items from sidebar-nav-data), Aksi Cepat (create shortcuts)
- Cmd+K opens, typing filters, Enter navigates, Escape closes
- Neo-brutalist style: rounded-none border-2 border-black shadow
- Hint button in site-header showing ⌘K

## B: Error Boundaries

- New: `components/ui/error-fallback.tsx` — reusable error UI
- "Coba Lagi" retry button + collapsible error details
- Create `error.tsx` in: app/, app/dashboard/, app/inventory/, app/sales/, app/procurement/, app/finance/, app/manufacturing/, app/hcm/, app/subcontract/, app/cutting/, app/costing/, app/documents/, app/settings/
- All thin files importing ErrorFallback
- Style: neo-brutalist card, centered, icon + heading + description + retry

## C: Empty States

- New: `components/ui/empty-state.tsx`
- Props: icon, title, description, actionLabel?, actionHref?, onAction?
- Centered flex column, muted 48px icon, title, description, optional action button
- Not auto-injected — provided as component for teams to use

## Files

- Create: `components/command-palette.tsx`
- Create: `components/ui/error-fallback.tsx`
- Create: `components/ui/empty-state.tsx`
- Create: 13x `error.tsx` files
- Modify: `components/global-layout.tsx` (mount CommandPalette)
- Modify: `components/site-header.tsx` (add Cmd+K hint button)
