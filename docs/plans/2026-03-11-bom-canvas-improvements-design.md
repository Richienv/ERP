# BOM Canvas Improvements — Design Doc
**Date:** 2026-03-11
**Scope:** Manufacturing → Bill of Materials → Canvas Detail Page
**Approach:** Option B — Central BOMCanvasContext + isolated feature hooks

---

## Architecture

Extract all canvas state from the 1565-line `[id]/page.tsx` into a `BOMCanvasContext`. Each feature becomes an isolated hook. The page file drops to ~300 lines.

```
app/manufacturing/bom/[id]/
├── page.tsx                        ← thin shell (~300 lines)
├── bom-canvas-context.tsx          ← NEW: all canvas state + mutations
└── hooks/
    ├── use-auto-save.ts            ← NEW
    ├── use-stock-availability.ts   ← NEW
    ├── use-price-drift.ts          ← NEW
    └── use-critical-path.ts        ← NEW
```

**Context owns:** `items`, `steps`, `totalQty`, `isDirty`, `selectedStepId`
All existing components (`BOMCanvas`, `MaterialPanel`, `DetailPanel`, `TimelineView`) read from context.

---

## Features (Highest → Lowest Priority)

### 🔴 1. Auto-Save (Local + Server Draft)

**Hook:** `useAutoSave(state, bomId)`

- Debounces 30s after any `isDirty` change
- **Local:** writes to `localStorage` key `bom-draft-{bomId}` (JSON snapshot)
- **Server:** calls `PATCH /api/manufacturing/production-bom/{id}` with `isDraft: true`
- On page load: if local draft exists newer than server version → banner "Draft tersimpan X menit lalu — Pulihkan?" with Restore / Discard
- Toolbar: orange dot next to SIMPAN when unsaved

### 🔴 2. Material Stock Availability

**Hook:** `useStockAvailability(items)`

- Calls `GET /api/inventory/stock-levels?productIds=...` (batch, on mount)
- Material panel: colored dot per item — 🟢 cukup / 🟡 hampir habis / 🔴 kurang
- Tooltip: "Stok: 250m — Butuh: 300m — Kurang 50m"
- Informational only, does not block

### 🟡 3. Progress Bars → Real WorkOrder.completedQty

- Add `completedQty` aggregation from WorkOrders per `bomStepId` to the existing API select
- StationNode reads `step.completedQty / stepTarget`
- Auto-refetches every 60s **only when SPK has been generated**
- No new API endpoint needed — extend existing `GET /api/manufacturing/production-bom/{id}`

### 🟡 4. Material Price Drift Warning

**Hook:** `usePriceDrift(items)`

- Calls `GET /api/inventory/prices?productIds=...` on mount
- Compares current price vs price at last BOM save
- Yellow banner above material panel if any price changed
- "Hitung ulang HPP?" button → recalculates cost summary + marks `isDirty`

### 🟡 5. Critical Path Highlight

**Hook:** `useCriticalPath(steps)`

- Uses existing `calcCriticalPathDuration` in `bom-step-helpers.ts`
- Returns `Set<stepId>` of steps on the critical path
- StationNode: `⚡` badge + amber border for critical path steps
- Timeline: solid fill for critical path bars, striped for non-critical

### 🟢 6. Working Hours → System Setting

- Add `workingHoursPerMonth` key to system settings (key-value store or new field)
- `bom-cost-helpers.ts` reads from settings instead of hardcoded `172`
- `/settings` page gets a "Manufaktur" section
- New API: `GET /api/system/settings`
- Default: 172

### 🟢 7. Process Templates → User-Editable

- New DB model: `BOMTemplate` (id, name, description, steps: Json, createdBy)
- Templates dialog on canvas toolbar (built-in 3 + user-created)
- "Simpan sebagai Template" button when BOM has ≥2 steps
- New API: `GET/POST /api/manufacturing/bom-templates`, `DELETE /api/manufacturing/bom-templates/{id}`

### 🟢 8. SPK Re-Generation

- "Reset SPK" button — confirmation dialog: "Ini akan menghapus X SPK yang sudah dibuat"
- Deletes all WorkOrders for this BOM
- SPK button re-enables after reset
- New API: `DELETE /api/manufacturing/production-bom/{id}/work-orders`

---

## Data Flow Summary

```
BOMCanvasContext
├── useAutoSave          → localStorage + PATCH /api/.../production-bom/{id}
├── useStockAvailability → GET /api/inventory/stock-levels
├── usePriceDrift        → GET /api/inventory/prices
├── useCriticalPath      → pure compute (bom-step-helpers.ts)
└── page.tsx             → GET /api/.../production-bom/{id} (adds completedQty)

New API endpoints:
├── GET  /api/inventory/stock-levels?productIds=...
├── GET  /api/inventory/prices?productIds=...
├── GET  /api/system/settings
├── GET  /api/manufacturing/bom-templates
├── POST /api/manufacturing/bom-templates
├── DELETE /api/manufacturing/bom-templates/{id}
└── DELETE /api/manufacturing/production-bom/{id}/work-orders
```

---

## What Does NOT Change

- React Flow canvas rendering logic
- Timeline Gantt drag behavior
- SPK generation endpoint and readiness checks
- Cost calculation helpers (`bom-cost-helpers.ts`, `bom-step-helpers.ts`)
- All existing component JSX (only prop source changes from page → context)
