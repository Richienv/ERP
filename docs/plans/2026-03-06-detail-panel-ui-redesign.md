# BOM Detail Panel UI Redesign

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the BOM canvas detail panel to feel cohesive and professional instead of "stitched together"

**Architecture:** Single-file refactor of `detail-panel.tsx`. Replace the flat 3-column layout with a structured card-based design using clear visual sections, consistent spacing, and logical field grouping. Both In-House and Subkon modes get proper section treatment. Material cost breakdown becomes visible for subkon mode too.

**Tech Stack:** React, Tailwind CSS, shadcn/ui, Lucide icons (existing stack)

---

## Current Problems (from screenshot)

1. **Flat stacked fields** — Labels + inputs are just piled vertically with no visual grouping
2. **Disconnected columns** — 3 columns separated by thin border lines look stitched together
3. **Subkon panel** — The amber-bordered box looks like a foreign element bolted on
4. **No material costs for subkon** — When subkon is selected, material cost breakdown disappears
5. **Time Study** — Awkwardly boxed at the bottom, should be collapsible or grouped better
6. **Section headers** — Tiny `text-[9px]` labels don't create enough visual hierarchy
7. **Attachments** — Isolated thin column on the right

## Design: Card-Based Sections

Replace the 3-column flat layout with a **2-row card grid**:

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: [Icon] POTONG  ─── In-House / Subkon toggle ──── X │
├─────────────────────┬───────────────────────────────────────┤
│ ROW 1               │                                       │
│                     │                                       │
│ ┌─ PENGATURAN ────┐ │ ┌─ SUBKON / ALOKASI ───────────────┐ │
│ │ Work Center     │ │ │ (SubkonSelector or InHouseAlloc)  │ │
│ │ Tipe Proses     │ │ │ integrated with consistent style  │ │
│ │ Durasi          │ │ │                                    │ │
│ │ Operator        │ │ └────────────────────────────────────┘ │
│ │ Gaji Bulanan    │ │                                       │
│ │ + calc breakdown│ │ ┌─ LAMPIRAN ────────────────────────┐ │
│ │ Catatan         │ │ │ file list + upload button          │ │
│ └─────────────────┘ │ └────────────────────────────────────┘ │
├─────────────────────┴───────────────────────────────────────┤
│ ROW 2 (full width)                                          │
│                                                             │
│ ┌─ PRODUKSI ──────────┐ ┌─ BIAYA MATERIAL ───────────────┐ │
│ │ Selesai: [__] / 6   │ │ table of materials + costs      │ │
│ │ ████████░░ 67%      │ │ subtotals, labor, total proses  │ │
│ └─────────────────────┘ └─────────────────────────────────┘ │
│                                                             │
│ ┌─ TIME STUDY (collapsible) ──────────────────────────────┐ │
│ │ Estimated time | Actual total | Avg breakdown           │ │
│ └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

1. **Section cards** — Each group gets a white card with a bold section header (text-[10px] font-black uppercase with colored left-border accent)
2. **Consistent header bar** — Station name + toggle + close all in one row at the top
3. **Material costs always visible** — Both in-house and subkon show the material cost table
4. **Production progress** — Gets its own mini-card with progress bar (visual, not just a number input)
5. **Time Study collapsible** — Collapsed by default, expand with a chevron click
6. **Max height with scroll** — Keep `max-h-[420px] overflow-y-auto` but apply to the body below the header

---

### Task 1: Restructure detail-panel.tsx layout

**Files:**
- Modify: `components/manufacturing/bom/detail-panel.tsx`

**Step 1: Rewrite the layout structure**

Replace the entire component body with a new card-based layout:

- **Header bar**: Station icon + name + In-House/Subkon toggle + sequence badge (all in one sticky row)
- **Body**: Scrollable area with grid sections
  - Left column (w-[260px]): "Pengaturan Proses" card with all config fields
  - Right column (flex-1): Stacked cards — Subkon/Allocation + Attachments
- **Bottom row** (full width): Production tracking + Material costs + Time Study

Remove the old `StepConfig`, `MaterialCostBreakdown`, `Attachments` JSX variables. Inline everything into the new layout with proper section wrappers.

**Step 2: Create SectionCard helper**

Add a simple inline component at the top of the file:

```tsx
function SectionCard({ title, icon, accent = "border-zinc-300", children, collapsible, defaultOpen = true }: {
    title: string
    icon?: React.ReactNode
    accent?: string
    children: React.ReactNode
    collapsible?: boolean
    defaultOpen?: boolean
}) {
    const [open, setOpen] = useState(defaultOpen)
    return (
        <div className={`border border-zinc-200 bg-white ${!collapsible || open ? '' : ''}`}>
            <button
                onClick={collapsible ? () => setOpen(!open) : undefined}
                className={`w-full flex items-center gap-2 px-3 py-2 border-l-[3px] ${accent} ${collapsible ? 'cursor-pointer hover:bg-zinc-50' : 'cursor-default'}`}
            >
                {icon}
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 flex-1 text-left">{title}</span>
                {collapsible && (
                    <ChevronDown className={`h-3 w-3 text-zinc-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
            </button>
            {(!collapsible || open) && (
                <div className="px-3 pb-3 pt-1">
                    {children}
                </div>
            )}
        </div>
    )
}
```

**Step 3: Build the header bar**

```tsx
<div className="flex items-center gap-3 px-4 py-2.5 border-b-2 border-black bg-zinc-50">
    <div className={`p-1.5 ${isSubkon ? 'bg-amber-500' : 'bg-emerald-500'} text-white`}>
        <StationIcon className="h-4 w-4" />
    </div>
    <div className="flex-1 min-w-0">
        <h3 className="font-black text-sm uppercase truncate">{step.station?.name}</h3>
        {isSubkon && step.subkonProcessType && (
            <p className="text-[10px] font-bold text-amber-600">{step.subkonProcessType}</p>
        )}
    </div>
    {/* In-House/Subkon toggle — compact pill style */}
    <div className="flex border-2 border-black">
        <button onClick={() => onToggleSubkon(false)}
            className={`px-3 py-1 text-[9px] font-black uppercase flex items-center gap-1 ${!isSubkon ? 'bg-emerald-400 text-black' : 'bg-white text-zinc-400 hover:bg-zinc-50'}`}>
            <Building2 className="h-3 w-3" /> In-House
        </button>
        <button onClick={() => onToggleSubkon(true)}
            className={`px-3 py-1 text-[9px] font-black uppercase flex items-center gap-1 border-l-2 border-black ${isSubkon ? 'bg-amber-400 text-black' : 'bg-white text-zinc-400 hover:bg-zinc-50'}`}>
            <Truck className="h-3 w-3" /> Subkon
        </button>
    </div>
</div>
```

**Step 4: Build the body grid**

```
<div className="max-h-[380px] overflow-y-auto px-4 py-3">
    <div className="flex gap-4">
        {/* LEFT: Pengaturan Proses */}
        <div className="w-[260px] shrink-0 space-y-3">
            <SectionCard title="Pengaturan Proses" icon={<Cog .../>} accent="border-emerald-400">
                ... Work Center select (if !isSubkon && multiple)
                ... Tipe Proses input (if isSubkon)
                ... Duration input
                ... Operator input (if !isSubkon)
                ... Gaji Bulanan + breakdown (if !isSubkon)
                ... Catatan textarea
            </SectionCard>
        </div>

        {/* RIGHT: Subkon/Allocation + Attachments */}
        <div className="flex-1 space-y-3">
            {isSubkon ? (
                <SectionCard title="Subkontraktor" icon={<Truck .../>} accent="border-amber-400">
                    <SubkonSelector ... />
                </SectionCard>
            ) : showAllocPanel ? (
                <SectionCard title="Distribusi Work Center" icon={<GitBranch .../>} accent="border-emerald-400">
                    <InHouseAllocator ... />
                    ... cancel button
                </SectionCard>
            ) : (
                <button to open alloc panel ... />
            )}

            <SectionCard title="Lampiran" icon={<Paperclip .../>} accent="border-blue-400">
                ... file list + upload
            </SectionCard>
        </div>
    </div>

    {/* BOTTOM ROW — full width */}
    <div className="mt-3 grid grid-cols-[1fr_2fr] gap-3">
        {/* Production tracking card */}
        <SectionCard title="Produksi" icon={<CheckCircle2 .../>} accent="border-emerald-400">
            ... Selesai input + progress bar
        </SectionCard>

        {/* Material cost breakdown — ALWAYS visible */}
        <SectionCard title="Biaya Material" icon={<span>Rp</span>} accent="border-emerald-400">
            ... material table (existing MaterialCostBreakdown content)
        </SectionCard>
    </div>

    {/* TIME STUDY — collapsible */}
    <div className="mt-3">
        <SectionCard title="Time Study" icon={<Timer .../>} accent="border-blue-400" collapsible defaultOpen={false}>
            ... existing time study fields
        </SectionCard>
    </div>
</div>
```

**Step 5: Add production progress bar to the Production card**

Instead of just a number input, add a visual progress bar:

```tsx
{(step.completedQty ?? 0) > 0 && totalQty > 0 && (
    <div className="mt-2">
        <div className="h-2 bg-zinc-200 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${Math.min(100, ((step.completedQty || 0) / totalQty) * 100)}%` }}
            />
        </div>
        <p className="text-[9px] font-bold text-zinc-400 mt-0.5 text-right">
            {((step.completedQty || 0) / totalQty * 100).toFixed(0)}% selesai
        </p>
    </div>
)}
```

**Step 6: Import ChevronDown**

Add `ChevronDown` to the lucide-react import.

**Step 7: Verify TypeScript compiles**

Run: `cd "/Volumes/Extreme SSD/new-erp-feb/ERP" && npx tsc --noEmit 2>&1 | grep detail-panel`
Expected: No errors from detail-panel.tsx

**Step 8: Commit**

```bash
git add components/manufacturing/bom/detail-panel.tsx
git commit -m "refactor(bom): redesign detail panel with card-based sections layout"
```
