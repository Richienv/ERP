# Manufacturing Processes Page Upgrade — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the manufacturing processes page with KPI strip, search/filter, enhanced create dialog (icon+color pickers), and card management actions (deactivate/delete).

**Architecture:** Single page rewrite of `app/manufacturing/processes/page.tsx`. No API changes needed — existing endpoints support all operations. Uses station-config.ts for icon/color options.

**Tech Stack:** React, TanStack Query, Lucide icons, shadcn/ui (Dialog, Popover, DropdownMenu, Input)

---

### Task 1: KPI Strip

**Files:**
- Modify: `app/manufacturing/processes/page.tsx:184-206`

**What:** Add 3 KPI cards between header and grid:
- Proses Aktif — count of active types (allTypes with activeCount > 0 or stationCount > 0)
- Total Work Center — sum of stationCount across all types
- Perlu Perhatian — types with 0 work centers (red if > 0)

**How:** Compute from existing `allTypes` array, render as 3-col grid with neo-brutalist cards.

---

### Task 2: Search + Inactive Filter in Toolbar

**Files:**
- Modify: `app/manufacturing/processes/page.tsx`

**What:**
- Add `searchTerm` state + filter allTypes by label match
- Add `showInactive` toggle state
- Move "+ Tambah Proses" button into toolbar row with search + toggle

---

### Task 3: Enhanced Create Dialog

**Files:**
- Modify: `app/manufacturing/processes/page.tsx:286-325`

**What:** Add to dialog:
- `formIcon` state (default "Cog"), `formColor` state (default "zinc")
- Icon picker: 6-col grid reusing ICON_OPTIONS from station-config
- Color picker: 6-col grid reusing COLOR_THEMES from station-config
- Live card preview
- Send iconName + colorTheme in POST body (already supported by API)

---

### Task 4: Card Dropdown Menu (Deactivate/Delete)

**Files:**
- Modify: `app/manufacturing/processes/page.tsx:209-282`

**What:**
- Replace Palette icon with DropdownMenu ("..." button) on each card
- Menu items: "Ubah Tampilan" (opens popover), "Nonaktifkan/Aktifkan" (PATCH isActive), "Hapus" (DELETE with confirmation)
- Built-in types: only "Ubah Tampilan"
- Delete: only if stationCount === 0, uses ConfirmDialog
- Deactivate: PATCH all stations of that type

---

### Task 5: Inactive Card Styling

**Files:**
- Modify: `app/manufacturing/processes/page.tsx`

**What:**
- Cards where all stations are inactive: opacity-50, grayscale filter
- Show "Nonaktif" badge instead of "X aktif"
- Hidden by default, visible when showInactive toggle is on
