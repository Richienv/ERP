# BOM Module Improvements — Design & Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add production tracking, authoring speed improvements, and visibility features to the BOM canvas module.

**Architecture:** Extend existing ProductionBOMStep schema with time/completion tracking fields. Add UI features (clone, context menu, timeline, search) as React components integrated into the existing canvas page. Generate SPK PDFs via existing Typst pipeline.

**Tech Stack:** Next.js 16, React 19, @xyflow/react, Prisma 6, TanStack Query, Tailwind CSS v4, Typst (PDF)

---

## Group A: Production Tracking (Schema + Canvas)

### Task 1: Schema — Add time tracking & completion fields to ProductionBOMStep

**Files:**
- Modify: `prisma/schema.prisma` (ProductionBOMStep model)

**What to add to `ProductionBOMStep`:**
```prisma
  estimatedTimePerUnit  Decimal(8,2)?   // minutes per unit
  actualTimeTotal       Decimal(10,2)?  // actual total minutes spent
  completedQty          Int @default(0) // e.g. 150 of 900
  startedAt             DateTime?
  completedAt           DateTime?
```

**Steps:**
1. Add fields to schema
2. Run `npx prisma db push`
3. Run `npx prisma generate`

### Task 2: API — Expose new fields in PATCH and GET

**Files:**
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts` (GET handler already includes steps; PATCH handler needs to save new fields)

**In PATCH handler**, when creating/updating steps, include:
```ts
estimatedTimePerUnit: step.estimatedTimePerUnit ?? null,
actualTimeTotal: step.actualTimeTotal ?? null,
completedQty: step.completedQty ?? 0,
startedAt: step.startedAt ?? null,
completedAt: step.completedAt ?? null,
```

No changes needed for GET — Prisma includes all fields by default.

### Task 3: Canvas — Show progress bar on StationNode

**Files:**
- Modify: `components/manufacturing/bom/station-node.tsx`

**Add to each node footer:**
- If `completedQty > 0` or `step.startedAt`: show a thin progress bar (completedQty / totalProductionQty × 100%)
- Color: emerald-500 fill on zinc-200 track
- Text: "150/900" in tiny mono font below bar
- Only show when there's actual tracking data (not on blank BOMs)

### Task 4: Detail Panel — Add time & completion fields

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx`

**Add to Step Config section:**
- "Est. Waktu/Unit" — number input (minutes), saves to `estimatedTimePerUnit`
- "Waktu Aktual Total" — number input (minutes), saves to `actualTimeTotal`
- "Selesai" — number input with "/totalQty pcs" suffix, saves to `completedQty`
- "Mulai" / "Selesai" — date displays (read-only, set programmatically)
- Auto-calculate: if estimatedTimePerUnit × totalQty exists, show "Est. Total: X jam"
- Auto-calculate: if actualTimeTotal and completedQty, show "Rata-rata: X min/unit"

### Task 5: Cost Summary Strip — Add time estimates

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` (toolbar cost summary strip)

**Add two new KPI boxes to the cost strip:**
- "Est. Waktu Total" — sum of (estimatedTimePerUnit × totalQty) across all steps, formatted as "X jam Y menit"
- "Progress" — sum(completedQty) / (steps.length × totalQty) × 100, shown as percentage with mini bar

---

## Group B: Authoring Speed

### Task 6: Clone BOM

**Files:**
- Modify: `app/api/manufacturing/production-bom/route.ts` (POST handler — add `cloneFromId` param)
- Modify: `app/manufacturing/bom/bom-client.tsx` (add clone button on BOM cards)

**API change:** When POST body includes `cloneFromId`:
1. Fetch source BOM with all items, steps, step-materials, allocations
2. Create new BOM with `version: "v{N+1}"` (auto-increment from source product's max version)
3. Copy all items → map old IDs to new IDs
4. Copy all steps → remap `parentStepIds` and `stepMaterials` using ID maps
5. Copy allocations
6. Return new BOM

**UI:** Add a "Duplikat" icon button on each BOM card in bom-client.tsx. On click → POST with `cloneFromId` → navigate to new BOM canvas.

### Task 7: Right-Click Context Menu on Canvas Nodes

**Files:**
- Modify: `components/manufacturing/bom/station-node.tsx` (add onContextMenu)
- Create: `components/manufacturing/bom/node-context-menu.tsx`

**Menu items:**
- "Hapus Stasiun" — removes step (existing delete)
- "Duplikat Stasiun" — clones step with same station + materials (new sequence)
- "Ganti Stasiun" — opens station picker to swap ProcessStation (keeps materials)
- Separator
- "Tandai Mulai" — sets `startedAt = now()`
- "Tandai Selesai" — sets `completedAt = now(), completedQty = totalQty`

**Implementation:** Use Radix `ContextMenu` from shadcn/ui. The menu dispatches actions back to the parent page via callback props.

### Task 8: Material Search in Material Panel

**Files:**
- Modify: `components/manufacturing/bom/material-panel.tsx`

**Current state:** Already has a search input that filters materials. This task is DONE — verify and skip.

### Task 9: Default Process Template (Quick-Add Preset)

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` (add "Terapkan Template" button)

**Implementation:** Add a dropdown button "Template Proses" next to the quick-add row. Options:
- "Garmen Lengkap" → adds: Potong → Jahit → QC → Packing (connected in sequence)
- "CMT" → adds: Potong → Jahit → Finishing (connected)
- "Sablon + Jahit" → adds: Sablon → Jahit → QC → Packing (connected)

Each template is a hardcoded array of `{ stationType, sequence }` entries. On click:
1. Auto-create ProcessStations if they don't exist (reuse existing `handleQuickAddByType` logic)
2. Auto-connect them in sequence via `parentStepIds`
3. No DB persistence for templates themselves — they're just preset configs

---

## Group C: Visibility & Reporting

### Task 10: SPK PDF Download Button (Wire Existing API)

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` (add PDF download button)

**The API already exists:** `GET /api/manufacturing/production-bom/[id]/pdf`

**Add button** next to "Generate SPK" in toolbar: "Download PDF" with FileDown icon.
On click → `window.open(\`/api/manufacturing/production-bom/${id}/pdf\`)` — opens PDF in new tab.

### Task 11: Edit History / Audit Log

**Files:**
- Modify: `prisma/schema.prisma` (add BOMEditLog model)
- Create: `app/api/manufacturing/production-bom/[id]/history/route.ts`
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts` (PATCH — log changes)
- Create: `components/manufacturing/bom/edit-history-drawer.tsx`
- Modify: `app/manufacturing/bom/[id]/page.tsx` (add History button)

**New Prisma model:**
```prisma
model BOMEditLog {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  bomId     String   @db.Uuid
  bom       ProductionBOM @relation(fields: [bomId], references: [id], onDelete: Cascade)
  action    String   // "SAVE", "ADD_STEP", "REMOVE_STEP", "ADD_MATERIAL", "GENERATE_SPK"
  summary   String   // human-readable: "Menambah stasiun Jahit", "Mengubah 3 step"
  details   Json?    // optional diff payload
  userId    String?  @db.Uuid
  createdAt DateTime @default(now())
  @@index([bomId])
  @@map("bom_edit_logs")
}
```

**PATCH handler change:** After successful save, create a BOMEditLog entry with action "SAVE" and summary of what changed (steps added/removed/modified count).

**History drawer:** A right-side sheet showing timeline of edits. Each entry: date + action badge + summary text.

### Task 12: Timeline / Sequence View (Parallel Process Visualization)

**Files:**
- Create: `components/manufacturing/bom/timeline-view.tsx`
- Modify: `app/manufacturing/bom/[id]/page.tsx` (add view toggle: Canvas | Timeline)

**Implementation:** A horizontal timeline/Gantt-lite showing:
- Each step as a bar, width proportional to `estimatedTimePerUnit × totalQty`
- Steps with shared `parentStepIds` (siblings) shown on separate rows (parallel)
- Sequential steps shown end-to-end
- Color: station type color
- Progress fill based on `completedQty / totalQty`
- Click a bar → opens detail panel (same as canvas click)

**Not a full Gantt chart** — just a simplified sequence diagram. Uses plain divs with flex/grid, no external library.

---

## Execution Order

1. **Task 1** — Schema changes (foundation for everything)
2. **Task 2** — API changes (expose new fields)
3. **Task 3 + 4** — Canvas progress bar + Detail panel fields (parallel)
4. **Task 5** — Cost summary strip time estimates
5. **Task 6** — Clone BOM
6. **Task 7** — Right-click context menu
7. **Task 9** — Process templates
8. **Task 10** — PDF download button (quick win)
9. **Task 11** — Edit history
10. **Task 12** — Timeline view
11. **Task 8** — Verify material search (already done)

Total: ~10 implementation tasks (Task 8 is just verification).
