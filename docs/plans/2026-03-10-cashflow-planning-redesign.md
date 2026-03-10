# Cashflow Planning Board — Unified Redesign

## Problem
Two separate pages (Proyeksi Arus Kas + Perencanaan Arus Kas) that are boring, static, and don't feel like a planning tool. Management needs a single board for Monday planning meetings.

## Solution
Combine both pages into one **Weekly Swim-Lane Planning Board** at `/finance/planning`. Update sidebar to point there. Remove old forecast page link.

## Design

### Section 1: Top Strip — Cash Position & Controls
- **Left**: Total cash now (big bold number) + cash runway gauge ("Cukup sampai Minggu ke-X")
- **Center**: Month navigator (prev/next arrows + month label)
- **Right**: Bank account filter pills + "Tambah Item" button + "Snapshot" button
- Planning/Riil toggle as segmented control

### Section 2: Weekly Swim-Lane Board (Hero Section)
- **4 columns** representing weeks 1-4 of the month
- Each column divided into:
  - **Kas Masuk** (green zone, top half) — inflow items
  - **Kas Keluar** (red zone, bottom half) — outflow items
- Items rendered as **cards**:
  - Category color badge left border (Gaji=orange, AR=emerald, AP=red, PO=indigo, BPJS=amber, Manual=zinc)
  - Amount (bold), description (truncated), bank tag
  - Solid border = confirmed/riil, dashed border = estimasi/planning
- **Column footer**: Weekly subtotal (masuk, keluar, net) + running balance
- **Current week** gets highlighted border (emerald glow)
- Click manual item card → edit dialog
- Click auto item card → detail popover

### Section 3: Summary Bar
- Horizontal strip: Saldo Awal | Total Masuk | Total Keluar | Net | Saldo Akhir Proyeksi
- Compact, always visible between board and details

### Section 4: Accuracy & History (Collapsible)
- Variance table (planned vs actual) when snapshot exists
- 3-month accuracy trend bars
- Last month reference

### Sidebar Changes
- "Proyeksi Arus Kas" → rename to "Perencanaan Arus Kas" → points to `/finance/planning`
- Remove duplicate link if any

## Files to Change
- `components/finance/cashflow-planning-board.tsx` — full rewrite as swim-lane board
- `app/finance/planning/page.tsx` — update to use new component
- `app/finance/cashflow-forecast/page.tsx` — redirect to /finance/planning or remove
- `lib/sidebar-nav-data.ts` — update nav link
- No backend changes needed — all data APIs stay the same
