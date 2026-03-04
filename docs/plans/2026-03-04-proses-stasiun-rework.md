# Proses & Stasiun Rework — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Separate "Tipe Proses" (process types like Potong, Jahit, Glazing — the WHAT) from "Stasiun" (stations like Potong A, Potong B — the WHERE). BOM toolbar adds by process type, then user picks which station when multiple exist.

**Architecture:** Rework the Proses page to manage process types + their stations. Rework BOM toolbar to show process types and let user pick station when >1 exists. No schema changes — `StationType` enum + `ProcessStation` model already support this.

**Tech Stack:** React, TanStack Query, shadcn/ui (Dialog, Select, Popover)

---

## Current Problem

1. **"Tambah Proses" on BOM** currently auto-picks the first IN_HOUSE station of that type. If user has "Potong A" and "Potong B" (both CUTTING), clicking "Potong" always picks "Potong A" — no way to choose.

2. **Proses page** (`/manufacturing/processes`) mixes the concept of "process type" and "station". User enters a "Nama Proses" + "Tipe Proses" but the name IS the station name. There's no way to add a custom process type (e.g., "Glazing") — only the hardcoded `StationType` enum.

3. **Sidebar confusion**: "Stasiun" → `/manufacturing/work-centers` (machine groups), "Proses" → `/manufacturing/processes` (actual stations). These labels are confusing.

## Target Design

### Conceptual Model
```
Tipe Proses (StationType enum)     Stasiun (ProcessStation records)
─────────────────────────────      ──────────────────────────────────
CUTTING (Potong)            ──→    Potong A (In-House, Rp 5.000)
                            ──→    Potong B (In-House, Rp 6.000)
SEWING (Jahit)              ──→    Jahit 1 (In-House, Rp 3.000)
                            ──→    Jahit Overlock (Subkon: PT Mitra)
GLAZING (custom via OTHER)  ──→    Glazing Line 1 (In-House, Rp 8.000)
```

### Flow on BOM Canvas
1. User clicks "Potong" button on toolbar
2. System checks: how many active CUTTING stations exist?
   - **1 station**: Add it directly (current behavior, fast)
   - **>1 stations**: Show a small popover/dropdown listing stations → user picks one
   - **0 stations**: Auto-create a default one (current behavior)

### Proses Page Rework
The page currently works well for managing stations grouped by type. We adjust:
- Rename "Tambah Proses" → "Tambah Stasiun"
- The dialog already has "Tipe Proses" dropdown + "Nama" — this is correct flow (pick type, name the station)
- Add ability to manage custom process types via OTHER type with a custom label field
- Header/subtitle clarification: "Stasiun Produksi — Kelola stasiun kerja per tipe proses"

### Sidebar Rework
- "Stasiun" → rename to "Work Center" or keep but point to processes page
- "Proses" → rename to "Stasiun & Proses"
- Simplify: just have one entry "Stasiun & Proses" pointing to `/manufacturing/processes`

---

## Tasks

### Task 1: BOM toolbar — station picker when >1 station exists

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` (lines 215-268 handleQuickAddByType, lines 846-864 toolbar)

**What:** When clicking a process type button (Potong, Jahit, etc.), if multiple active IN_HOUSE stations of that type exist, show a Popover listing them so user can choose.

**Step 1: Create station picker popover state**

Add state near line 214:
```tsx
const [stationPickerType, setStationPickerType] = useState<string | null>(null)
const [stationPickerAnchor, setStationPickerAnchor] = useState<HTMLElement | null>(null)
```

**Step 2: Rework handleQuickAddByType**

Replace the current logic (lines 215-268) with:
```tsx
const handleQuickAddByType = useCallback(async (stationType: string, anchorEl?: HTMLElement) => {
    // Find all active IN_HOUSE stations of this type
    const candidates = (allStations || []).filter((s: any) =>
        s.stationType === stationType && s.operationType !== "SUBCONTRACTOR" && s.isActive !== false
    )

    if (candidates.length === 1) {
        // Only one → add directly
        handleAddStationToCanvas(candidates[0].id)
        return
    }

    if (candidates.length > 1) {
        // Multiple → show picker
        setStationPickerType(stationType)
        setStationPickerAnchor(anchorEl || null)
        return
    }

    // None exist → auto-create default station
    setCreatingStationType(stationType)
    const config = STATION_TYPE_CONFIG.find((c) => c.type === stationType)
    const label = config?.label || stationType
    const code = `STN-${stationType.substring(0, 3)}-${String(Date.now()).slice(-4)}`
    try {
        const res = await fetch("/api/manufacturing/process-stations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, name: label, stationType, operationType: "IN_HOUSE", costPerUnit: 0 }),
        })
        const result = await res.json()
        if (result.success) {
            queryClient.invalidateQueries({ queryKey: queryKeys.processStations.all })
            handleAddStationToCanvas(result.data.id)
            // Need to also add station to local state since query might not refetch yet
            const station = result.data
            const tempId = `step-${Date.now()}`
            dirtySetSteps((prev) => {
                const lastStep = prev[prev.length - 1]
                return [...prev, {
                    id: tempId, stationId: station.id, station,
                    sequence: prev.length + 1, durationMinutes: null, notes: null,
                    parentStepIds: lastStep ? [lastStep.id] : [],
                    materials: [], allocations: [], attachments: [],
                }]
            })
            toast.success(`Stasiun "${label}" dibuat & ditambahkan`)
        } else {
            toast.error(result.error || "Gagal membuat stasiun")
        }
    } catch {
        toast.error("Gagal membuat stasiun")
    } finally {
        setCreatingStationType(null)
    }
}, [allStations, handleAddStationToCanvas, queryClient, dirtySetSteps])
```

**Step 3: Add station picker popover in toolbar**

After the toolbar buttons section (after line 864), add:
```tsx
{/* Station Picker Popover */}
{stationPickerType && (
    <Popover open={!!stationPickerType} onOpenChange={(open) => { if (!open) setStationPickerType(null) }}>
        <PopoverTrigger asChild>
            <span /> {/* Anchor to button position */}
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0 border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]" align="start">
            <div className="px-3 py-2 bg-zinc-50 border-b-2 border-black">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Pilih Stasiun {STATION_TYPE_CONFIG.find(c => c.type === stationPickerType)?.label}
                </p>
            </div>
            <div className="py-1">
                {(allStations || [])
                    .filter((s: any) => s.stationType === stationPickerType && s.operationType !== "SUBCONTRACTOR" && s.isActive !== false)
                    .map((station: any) => (
                        <button
                            key={station.id}
                            onClick={() => {
                                handleAddStationToCanvas(station.id)
                                setStationPickerType(null)
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-zinc-100 transition-colors flex items-center justify-between"
                        >
                            <div>
                                <p className="text-xs font-bold">{station.name}</p>
                                <p className="text-[9px] font-mono text-zinc-400">{station.code}</p>
                            </div>
                            {Number(station.costPerUnit) > 0 && (
                                <span className="text-[9px] font-bold text-emerald-600">
                                    Rp {Number(station.costPerUnit).toLocaleString("id-ID")}
                                </span>
                            )}
                        </button>
                    ))}
            </div>
        </PopoverContent>
    </Popover>
)}
```

**Step 4: Update button onClick to pass element ref**

In toolbar buttons (line 857), change:
```tsx
onClick={() => handleQuickAddByType(cfg.type)}
```
to:
```tsx
onClick={(e) => handleQuickAddByType(cfg.type, e.currentTarget)}
```

**Alternative simpler approach:** Instead of a Popover anchored to the button, use a simple Dialog/sheet that lists stations. This is simpler and avoids Popover positioning complexity.

Actually, the simplest approach: use a **dropdown** that appears inline. When `stationPickerType` is set, render a small list below the toolbar row. Keep it simple.

---

### Task 2: Rework Proses page labels and flow

**Files:**
- Modify: `app/manufacturing/processes/page.tsx`

**What:** Clarify the page so it's obvious that "Tipe Proses" = the category (Potong, Jahit) and "Stasiun" = the actual work station (Potong A, Potong B). The current code already works correctly — just needs label/copy adjustments.

**Step 1: Update page header**

Change lines 175-180:
```tsx
<h1>Proses & Stasiun Produksi</h1>
<p>Kelola tipe proses (Potong, Jahit, dll) dan stasiun kerja di setiap tipe</p>
```

**Step 2: Update dialog labels**

The dialog currently says "Nama Proses" — change to "Nama Stasiun":
- Line 293: `"Nama Proses"` → `"Nama Stasiun"`
- Line 297: placeholder `"cth: Potong, Jahit Overlock"` → `"cth: Potong A, Jahit Line 1, Glazing Utama"`
- Line 284: Dialog title `"Tambah Proses Baru"` → `"Tambah Stasiun Baru"`
- Line 287: Description stays as is but clarify: `"Stasiun baru akan tersedia di BOM Canvas"`

**Step 3: Update button label**

Line 186: `"Tambah Proses"` → `"+ Tambah Stasiun"`

**Step 4: Add helpful description per type group**

In the type group header (line 213), add station count clarity:
```tsx
<p className="text-[9px] font-bold text-zinc-400 uppercase">
    {type} · {typeStations.length} stasiun
    {typeStations.filter((s: any) => s.isActive).length < typeStations.length &&
        ` (${typeStations.filter((s: any) => s.isActive).length} aktif)`}
</p>
```

---

### Task 3: Update sidebar navigation labels

**Files:**
- Modify: `components/app-sidebar.tsx` (manufacturing section, ~line 212-245)

**What:** Rename sidebar entries to be clearer about what each page manages.

**Changes:**
- `"Stasiun"` (currently → `/manufacturing/work-centers`) → `"Work Center"`
- `"Proses"` (currently → `/manufacturing/processes`) → `"Stasiun & Proses"`

This makes it clear:
- "Stasiun & Proses" = manage your process stations (Potong A, Jahit 1, etc.)
- "Work Center" = machine groups and capacity planning

---

### Task 4: Add "OTHER" custom type support with label

**Files:**
- Modify: `app/manufacturing/processes/page.tsx` (dialog section)

**What:** When user selects "Lainnya (OTHER)" as process type, show an additional text field for custom label (e.g., "Glazing", "Embossing"). This label gets stored in the station `description` field and displayed in the type group header.

**Step 1: Add custom label state in dialog**

```tsx
const [formCustomLabel, setFormCustomLabel] = useState("")
```

**Step 2: Show custom label field when type is OTHER**

After the "Tipe Proses" select (line 314), add:
```tsx
{formType === "OTHER" && (
    <div className="space-y-1.5">
        <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            Label Kustom (opsional)
        </label>
        <Input
            value={formCustomLabel}
            onChange={(e) => setFormCustomLabel(e.target.value)}
            placeholder="cth: Glazing, Embossing, Laser Cut"
            className="border-2 border-black rounded-none h-10 font-bold"
        />
        <p className="text-[9px] text-zinc-400">Digunakan sebagai nama grup tipe proses</p>
    </div>
)}
```

**Step 3: Store custom label in description**

In `handleSave`, when creating with type OTHER and customLabel:
```tsx
body: JSON.stringify({
    code,
    name: formName.trim(),
    stationType: formType,
    operationType: "IN_HOUSE",
    costPerUnit: Number(formCost) || 0,
    description: formType === "OTHER" && formCustomLabel.trim() ? formCustomLabel.trim() : undefined,
}),
```

**Step 4: Display custom label in group header**

In the type group header, check if any station in the OTHER group has a description and use it as group label:
```tsx
const groupLabel = type === "OTHER"
    ? (typeStations.find((s: any) => s.description)?.description || config.label)
    : config.label
```

---

## Execution Order

Task 1 (BOM station picker) → Task 2 (Proses page labels) → Task 3 (Sidebar) → Task 4 (OTHER custom type)

Tasks 2, 3, 4 are simple label/copy changes. Task 1 is the main logic change.

## Verification

1. **BOM Canvas** (`/manufacturing/bom/{id}`):
   - Create 2 CUTTING stations (Potong A, Potong B) on Proses page
   - Click "Potong" on BOM toolbar → should show picker with both options
   - Pick "Potong B" → card should show "Potong B" station

2. **Proses page** (`/manufacturing/processes`):
   - Header should say "Proses & Stasiun Produksi"
   - Dialog should say "Nama Stasiun" not "Nama Proses"
   - Selecting "Lainnya" should show custom label field

3. **Sidebar**: "Stasiun & Proses" should appear under Manufaktur
