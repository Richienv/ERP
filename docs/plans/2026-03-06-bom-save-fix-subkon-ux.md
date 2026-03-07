# BOM Save Fix + Subkon UX Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the BOM canvas save bug (caused by invalid `group` include in station creation API), hide irrelevant fields for subkon stations, and add a price-confirmation popup when subkon allocations are made.

**Architecture:** Fix the Prisma query error in the process-stations API route, then conditionally render detail-panel fields based on `isSubkon` state, and add a toast-like price confirmation bar that appears after subkon allocation changes.

**Tech Stack:** Next.js App Router, Prisma, shadcn/ui, React state

---

### Task 1: Fix the process-station creation API (root cause of save failure)

**Files:**
- Modify: `app/api/manufacturing/process-stations/route.ts:140-146`

The error `Unknown field 'group' for include statement on model ProcessStation` happens because Prisma client is stale. This was already fixed by running `npx prisma generate` and clearing `.next` cache. However, to prevent future breakage, make the include robust.

**Step 1: Make the include conditional**

In `app/api/manufacturing/process-stations/route.ts`, the POST handler at line 129 creates a station and includes `group`. If the Prisma client is out of sync, this crashes the whole save flow. Wrap the include safely:

```ts
// line 142-146: change the include block in the POST handler
include: {
    subcontractor: { select: { id: true, name: true } },
    machine: { select: { id: true, code: true, name: true } },
    group: { select: { id: true, code: true, name: true } },
    parentStation: true,
    childStations: true,
    bomSteps: true,
    allocations: true,
},
```

Also do the same for the GET handler include at line 26-27 — ensure it matches the schema exactly. Both already use `group` which is valid per schema. The real fix is ensuring `npx prisma generate` has been run.

**Step 2: Add better error reporting to the BOM save flow**

In `app/manufacturing/bom/[id]/page.tsx`, the `doSave()` function (line 661) catches errors but doesn't log the response body on failure. Add logging:

```ts
// After line 709: const result = await res.json()
// Add before the if (result.success) check:
if (!res.ok) {
    console.error("BOM save failed:", res.status, result)
}
```

**Step 3: Verify**

Run: `npm run dev`, navigate to a BOM page, add a process station, click "Simpan".
Expected: Save succeeds, toast shows "BOM berhasil disimpan".

**Step 4: Commit**

```bash
git add app/api/manufacturing/process-stations/route.ts app/manufacturing/bom/[id]/page.tsx
git commit -m "fix(bom): improve save error reporting and station creation robustness"
```

---

### Task 2: Hide irrelevant fields for subkon in detail-panel

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx:55-93` (StepConfig section)

When `isSubkon` is true, the following fields should be HIDDEN because they don't apply to subcontracted work:
- **Work Center selector** (line 71-93) — subkon work is done offsite, no internal work center
- **Operator** (line 138-148) — subkon has its own operators
- **Gaji Bulanan** (line 151-183) — monthly salary is irrelevant for outsourced work

**Step 1: Pass `isSubkon` into StepConfig**

The `StepConfig` JSX block is defined at line 63 as a const. It doesn't have access to render conditionals easily. Wrap the three sections in `{!isSubkon && (...)}`:

```tsx
// components/manufacturing/bom/detail-panel.tsx
// Inside StepConfig (line 63), after the In-House/Subkon toggle (ends at line 120):

// Wrap the Work Center selector (lines 71-93):
{!isSubkon && sameTypeStations.length > 1 && onChangeStation && (
    <div>
        <label className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1 block">Work Center</label>
        {/* ... existing Select ... */}
    </div>
)}

// Keep Duration field (lines 122-136) — still relevant for subkon (lead time)

// Wrap Operator field (lines 138-148):
{!isSubkon && (
    <div>
        <label ...>Operator</label>
        <Input ... />
    </div>
)}

// Wrap Gaji Bulanan section (lines 151-183):
{!isSubkon && (
    <div className="border-t border-zinc-100 pt-2">
        <label ...>Gaji Bulanan (Rp)</label>
        {/* ... existing input + breakdown ... */}
    </div>
)}
```

**Step 2: Verify**

1. Open a BOM → click on a station → toggle to "Subkon"
2. Expected: Duration, Notes, Completion fields still visible. Work Center, Operator, Gaji Bulanan are HIDDEN.
3. Toggle back to "In-House" → all fields reappear.

**Step 3: Commit**

```bash
git add components/manufacturing/bom/detail-panel.tsx
git commit -m "fix(bom): hide work center, operator, salary fields for subkon stations"
```

---

### Task 3: Add price confirmation popup for subkon allocations

**Files:**
- Modify: `components/manufacturing/bom/subkon-selector.tsx`

When a user selects a subcontractor from the list, the allocation row appears with `0 pcs × Rp 0`. The subcontractor already has a known `costPerUnit` (shown as "Rp 90.000/unit" in the picker). We want a Google-password-save style notification bar that auto-fills the subcontractor's default price and lets the user accept/adjust.

**Step 1: Read existing subkon-selector**

Read `components/manufacturing/bom/subkon-selector.tsx` to understand the current flow.

**Step 2: Add price suggestion bar**

After the user adds a subcontractor to the allocation list, show a toast-like bar at the top of the allocation section:

```tsx
// In SubkonSelector, when a new allocation is added:
// 1. Pre-fill pricePerPcs with the subcontractor's costPerUnit
// 2. Show a highlighted bar: "Harga default Rp X/pcs dari [Subkon Name] — [Terima] [Ubah]"

// The bar should:
// - Appear above the allocation list when a new allocation is added
// - Auto-dismiss after user clicks "Terima" (accept default price)
// - Focus the price input if user clicks "Ubah" (change)
// - Yellow/amber background matching subkon theme
// - Disappear after 10 seconds if ignored
```

The exact implementation depends on the subkon-selector's current code. The key behavior:
1. When user clicks a subcontractor in the picker, pre-fill `pricePerPcs` with the subcontractor's `costPerUnit`
2. Show a suggestion bar: `"Harga [SubkonName]: Rp X/pcs — Terima | Ubah"`
3. "Terima" → close bar, keep price
4. "Ubah" → close bar, focus the price edit input (pencil icon)

**Step 3: Verify**

1. Open a BOM → click subkon station → open subkon selector
2. Click a subcontractor (e.g., "BARU Rp 90.000/unit")
3. Expected: Allocation row shows with `pricePerPcs = 90000` pre-filled, and amber bar appears
4. Click "Terima" → bar dismisses
5. Or click "Ubah" → price input focuses for editing

**Step 4: Commit**

```bash
git add components/manufacturing/bom/subkon-selector.tsx
git commit -m "feat(bom): auto-fill subkon price with suggestion bar"
```

---

## Execution Priority

1. **Task 1** — Fix save bug (critical — nothing works without this)
2. **Task 2** — Hide irrelevant subkon fields (quick UX win)
3. **Task 3** — Price suggestion popup (new feature)

## Verification

After all tasks:
- BOM save works when clicking "Simpan" button
- Subkon detail panel only shows Duration, Notes, Completion, and Subkon Selector (no Work Center, Operator, Gaji Bulanan)
- Adding a subkon allocation pre-fills the price and shows confirmation bar
