# Subkon Process Type Label — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a BOM step is set to Subkon mode, replace the hidden Work Center selector with a "Tipe Proses" text input so users can label what the subkon does (e.g., "Jahit Lining", "Obras Pinggir"). This gives subkon steps context that was lost when Work Center was hidden.

**Architecture:** Add a `subkonProcessType` nullable String field to `ProductionBOMStep` in Prisma schema, create a migration, then render a text input in the detail-panel when `isSubkon` is true — placed above the Duration field (same position as the old Work Center selector). Wire it through the save flow.

**Tech Stack:** Prisma migration, Next.js App Router, React state, shadcn/ui Input

---

### Task 1: Add `subkonProcessType` field to Prisma schema + migrate

**Files:**
- Modify: `prisma/schema.prisma` (model `ProductionBOMStep`, around line 2756)

**Step 1: Add the field**

In `prisma/schema.prisma`, inside the `ProductionBOMStep` model, after the `useSubkon` field (line 2756), add:

```prisma
  subkonProcessType  String?                // Label tipe proses subkon (e.g. "Jahit Lining", "Obras")
```

**Step 2: Generate migration**

```bash
npx prisma migrate dev --name add_subkon_process_type
```

**Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/
git commit -m "feat(schema): add subkonProcessType field to ProductionBOMStep"
```

---

### Task 2: Add "Tipe Proses" input to detail-panel for subkon mode

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx`

**Step 1: Add the input field**

In the `StepConfig` JSX block, right after the "Tipe Operasi" toggle (line 120, after the closing `</div>` of the toggle), and BEFORE the Duration field (line 122), add a conditional block that only shows when `isSubkon`:

```tsx
{/* Tipe Proses — only for subkon, replaces Work Center */}
{isSubkon && (
    <div>
        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">
            <Cog className="h-3 w-3 inline mr-1" /> Tipe Proses
        </label>
        <Input
            type="text"
            value={step.subkonProcessType || ""}
            onChange={(e) => onUpdateStep("subkonProcessType", e.target.value || null)}
            className="h-8 text-xs border-zinc-200 rounded-none"
            placeholder="cth: Jahit Lining, Obras, Bordir..."
        />
    </div>
)}
```

This goes above Duration so the layout reads: Toggle → Tipe Proses → Durasi → Catatan → Selesai

**Step 2: Verify**

1. Open a BOM → click a station → toggle to "Subkon"
2. "Tipe Proses" input should appear between the toggle and Duration
3. Toggle back to "In-House" → "Tipe Proses" disappears, Work Center reappears (if multiple stations of same type)
4. Type a process type label → it should persist in the step state

**Step 3: Commit**

```bash
git add components/manufacturing/bom/detail-panel.tsx
git commit -m "feat(bom): add Tipe Proses input for subkon steps in detail panel"
```

---

### Task 3: Wire `subkonProcessType` through save and load flows

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` (~line 677-683, save payload construction)
- Modify: `app/api/manufacturing/production-bom/[id]/route.ts` (~line 180-196, step create data)

**Step 1: Add to save payload**

In `app/manufacturing/bom/[id]/page.tsx`, in the `doSave()` function where the step payload is built (around line 677), add `subkonProcessType`:

```ts
// After: operatorName: step.operatorName || null,
subkonProcessType: step.subkonProcessType || null,
```

**Step 2: Add to API create**

In `app/api/manufacturing/production-bom/[id]/route.ts`, in the step creation data block (line 180-196), add:

```ts
// After: operatorName: step.operatorName || null,
subkonProcessType: step.subkonProcessType || null,
```

**Step 3: Add to GET response**

Check the GET handler in `app/api/manufacturing/production-bom/[id]/route.ts` — ensure the step select/include returns `subkonProcessType`. Since it likely uses `select: { ... }` or just includes all fields, verify it's covered. If using explicit select, add `subkonProcessType: true`.

**Step 4: Add to initial step construction (page.tsx)**

In `app/manufacturing/bom/[id]/page.tsx`, wherever new steps are constructed (handleAddStationToCanvas ~line 237, handleQuickAddByType ~line 320, handleDuplicate ~line 516), add `subkonProcessType: null` to the initial step objects. Also in handleDuplicate, copy the value: `subkonProcessType: source.subkonProcessType || null`.

**Step 5: Verify**

1. Open BOM → set a station to Subkon → type "Jahit Lining" in Tipe Proses
2. Click Simpan → should save successfully
3. Reload page → the "Jahit Lining" label should persist

**Step 6: Commit**

```bash
git add app/manufacturing/bom/[id]/page.tsx app/api/manufacturing/production-bom/[id]/route.ts
git commit -m "feat(bom): persist subkonProcessType through save/load flow"
```

---

## Execution Priority

1. **Task 1** — Schema migration (required for data persistence)
2. **Task 2** — UI input field (visible change)
3. **Task 3** — Wire through save/load (makes it persistent)

## Verification

After all tasks:
- Subkon steps show "Tipe Proses" input between the toggle and Duration
- In-House steps show Work Center selector (unchanged)
- Tipe Proses value saves and loads correctly
- Existing BOM data is unaffected (field is nullable)
