# Stasiun Page Rework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Machine-based work-centers page with a Station-based page. "Tambah Mesin" → "Tambah Stasiun". Each station belongs to a process type (Potong, Jahit, etc.). Stations added here appear in BOM Canvas.

**Architecture:** Rewrite the work-centers-client.tsx to use `useProcessStations()` instead of `useMachines()`. Show stations grouped by process type with cards. Dialog creates ProcessStation records (not Machine records).

**Tech Stack:** React, TanStack Query, shadcn/ui, existing ProcessStation API

---

## Current vs Target

| Aspect | Current (Mesin) | Target (Stasiun) |
|--------|----------------|-------------------|
| Title | "Pusat Kerja & Routing" | "Stasiun Produksi" |
| Button | "Tambah Mesin" | "Tambah Stasiun" |
| Data source | `useMachines()` → Machine model | `useProcessStations()` → ProcessStation model |
| Cards show | Machine code, brand, capacity, health | Station name, process type, cost/unit, active status |
| Grouping | Flat list with status filter | Grouped by process type (Potong, Jahit, etc.) |
| KPIs | Total machines, running, down, OEE | Total stasiun, per-type counts, active count |
| Dialog | Machine form (code, brand, capacity, health) | Station form (nama, tipe proses, biaya/unit) |
| API | `/api/manufacturing/machines` | `/api/manufacturing/process-stations` |

## Key Insight

The `ProcessStation` model already exists and has everything needed:
- `name` (station name, e.g., "Potong A")
- `stationType` (process type, e.g., CUTTING)
- `costPerUnit` (labor cost)
- `operationType` (IN_HOUSE / SUBCONTRACTOR)
- `isActive` (active/inactive toggle)

The ProcessStation API already supports full CRUD. The `useProcessStations()` hook already exists. We just need to rewrite the UI.

---

### Task 1: Rewrite work-centers-client.tsx as station page

**Files:**
- Rewrite: `app/manufacturing/work-centers/work-centers-client.tsx`
- Modify: `app/manufacturing/work-centers/page.tsx` (change data source)

**What:** Replace the machine grid with a station grid grouped by process type. Keep the same neo-brutalist card style but show station data instead of machine data.

**Step 1: Update page.tsx to use useProcessStations**

```tsx
"use client"
import { useProcessStations } from "@/hooks/use-process-stations"
import { TablePageSkeleton } from "@/components/ui/page-skeleton"
import { StasiunClient } from "./stasiun-client"

export default function StasiunPage() {
    const { data: stations, isLoading } = useProcessStations({ includeInactive: true })
    if (isLoading) return <TablePageSkeleton accentColor="bg-teal-400" />
    return <StasiunClient stations={stations || []} />
}
```

**Step 2: Create stasiun-client.tsx (replaces work-centers-client.tsx)**

Layout:
1. **Header**: "Stasiun Produksi" + "Tambah Stasiun" button
2. **KPI Strip**: Total Stasiun | Aktif | Nonaktif | Tipe Proses
3. **Search + Filter**: Search by name/code, filter by process type (Potong, Jahit, etc.)
4. **Card Grid**: Grouped by stationType, each card shows:
   - Station name (bold, large)
   - Process type badge (colored by STATION_COLORS)
   - Operation type: "In-House" or "Subkon: PT Mitra"
   - Cost per unit: "Rp 5.000/unit"
   - Active/Inactive badge
   - Edit, Toggle Active, Delete buttons (on hover)

**Step 3: Create station dialog**

Simple dialog with:
- Nama Stasiun (text input, required)
- Tipe Proses (select from StationType enum + config labels)
- Tipe Operasi (In-House / Subkontrak toggle)
- Biaya per Unit (number input)

Uses existing API: `POST /api/manufacturing/process-stations`

**Card design (neo-brutalist):**
```
┌──────────────────────────────────┐
│ [✂] POTONG A              [1]   │ ← icon + name + sequence badge
│ ─────────────────────────────── │
│ Tipe: CUTTING                    │ ← colored type badge
│ In-House          Rp 5.000/unit  │ ← operation type + cost
│ ─────────────────────────────── │
│ STN-CUT-1234      ✏️ ⚡ 🗑️      │ ← code + action buttons
└──────────────────────────────────┘
```

---

### Task 2: Clean up old machine references (optional)

**Files:**
- Keep: `app/api/manufacturing/machines/` (Machine API still exists for other use)
- Keep: `hooks/use-machines.ts` (may be used elsewhere)
- Remove: Old `work-centers-client.tsx` content (replaced by stasiun-client)

The Machine model stays in schema — it's still used by Routing and maintenance. We just stop showing it on this page.

---

## Execution Order

Task 1 is the main work. Task 2 is cleanup.

## Verification

1. Go to `/manufacturing/work-centers` (sidebar "Stasiun")
2. Should show "Stasiun Produksi" header with "+ Tambah Stasiun" button
3. KPI strip: total stations, active count, process type count
4. Cards grouped by process type (Potong, Jahit, etc.)
5. Click "+ Tambah Stasiun" → dialog with name, type, cost fields
6. Create "Potong C" → card appears under CUTTING group
7. Go to BOM canvas → "Potong C" should be available when clicking "Potong" button
