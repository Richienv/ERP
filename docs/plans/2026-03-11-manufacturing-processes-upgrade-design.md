# Manufacturing Processes Page Upgrade

**Date:** 2026-03-11
**Status:** Approved

## Problem

The "Tambah Tipe Proses" dialog only has a name field — users must create first, then separately click the card to set icon & color. The page also lacks KPIs, search, and card management actions (deactivate/delete).

## Design

### 1. KPI Strip (3 cards)

| Proses Aktif | Total Work Center | Perlu Perhatian |
|---|---|---|
| Count of active process types | Sum of WC across all types | Types with 0 work centers (red highlight if > 0) |

### 2. Toolbar Row

- Search input to filter cards by name
- Toggle: show/hide inactive process types
- "+ Tambah Proses" button

### 3. Enhanced "Tambah Tipe Proses" Dialog

- Name field (existing)
- Icon picker: 6-column grid, 23 icons from station-config.ts, default Cog
- Color picker: 6-column grid, 12 color circles from station-config.ts, default zinc
- Live card preview that updates as user picks icon/color

### 4. Card Quick Actions (dropdown menu)

- **Ubah Tampilan** — opens existing appearance editor popover
- **Nonaktifkan / Aktifkan** — toggle active status (custom/OTHER types only)
- **Hapus** — delete custom types with 0 work centers (with confirmation)
- Built-in types: only show "Ubah Tampilan"

### 5. Inactive Card State

- Grayscale + opacity-50 styling
- "Nonaktif" badge
- Hidden by default, shown via filter toggle

## Out of Scope

- Drag-to-reorder (no meaningful order for process types)
- Production stats per type (dashboard's responsibility)
- Inline name editing (popover handles appearance)

## Files to Modify

- `app/manufacturing/processes/page.tsx` — main page (KPI strip, toolbar, card actions, inactive state)
- `app/manufacturing/processes/page.tsx` — inline "Tambah" dialog (add icon/color pickers + preview)
- `app/api/manufacturing/process-stations/route.ts` — PATCH for deactivate, ensure DELETE works
- `app/api/manufacturing/process-stations/[id]/route.ts` — PATCH isActive, DELETE
