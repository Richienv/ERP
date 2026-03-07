# Work Center Subkon Tab — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a "Subkon" tab to the Work Centers page (`/manufacturing/work-centers`) so users can manage subkon processes alongside in-house stations. Subkon processes are organized by process type (Jahit, Potong, etc.), each with sub-processes (e.g., "Jahit Lining", "Jahit Body") that can be linked to subcontractor companies and duplicated.

**Architecture:** Add an In-House/Subkon toggle to `stasiun-client.tsx`. The Subkon view shows SUBCONTRACTOR-type ProcessStations grouped by `stationType`, using the existing `parentStation/childStations` hierarchy for sub-processes. Each sub-process card shows its linked subcontractor and can be duplicated. A new dialog creates subkon processes with process type, sub-process label, and optional subcontractor link.

**Tech Stack:** React state, TanStack Query, Prisma `ProcessStation` with `parentStationId`, existing API endpoints

---

### Task 1: Add In-House / Subkon tab toggle to StasiunClient

**Files:**
- Modify: `app/manufacturing/work-centers/stasiun-client.tsx`

**Step 1: Add `operationTab` state**

After the existing `viewMode` state (line 85), add:

```tsx
const [operationTab, setOperationTab] = useState<"in-house" | "subkon">("in-house")
```

**Step 2: Split stations by operation type**

The existing `inHouseStations` filter (line 89) already exists. Add subkon filter:

```tsx
const inHouseStations = initialStations.filter((s: any) => s.operationType !== "SUBCONTRACTOR")
const subkonStations = initialStations.filter((s: any) => s.operationType === "SUBCONTRACTOR")
```

**Step 3: Add tab toggle UI between header and KPI strip**

After the header `</div>` (line 403) and before KPI strip, add the tab toggle:

```tsx
{/* Operation Type Tab */}
<div className="flex border-2 border-black">
    <button
        onClick={() => setOperationTab("in-house")}
        className={cn(
            "flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all border-r-2 border-black",
            operationTab === "in-house"
                ? "bg-emerald-400 text-black"
                : "bg-white text-zinc-400 hover:bg-zinc-50"
        )}
    >
        <Factory className="h-4 w-4" /> In-House
        <span className="text-[9px] font-bold opacity-60">({inHouseStations.length})</span>
    </button>
    <button
        onClick={() => setOperationTab("subkon")}
        className={cn(
            "flex-1 flex items-center justify-center gap-2 px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all",
            operationTab === "subkon"
                ? "bg-amber-400 text-black"
                : "bg-white text-zinc-400 hover:bg-zinc-50"
        )}
    >
        <Truck className="h-4 w-4" /> Subkon
        <span className="text-[9px] font-bold opacity-60">({subkonStations.length})</span>
    </button>
</div>
```

Add `Truck` to the lucide imports.

**Step 4: Conditionally render In-House or Subkon content**

Wrap the existing KPI strip, search/filter bar, and station grid inside `{operationTab === "in-house" && (...)}`. The subkon content will be added in Task 2.

**Step 5: Commit**

```bash
git add app/manufacturing/work-centers/stasiun-client.tsx
git commit -m "feat(work-centers): add In-House/Subkon tab toggle"
```

---

### Task 2: Build the Subkon tab view with process groups and sub-processes

**Files:**
- Modify: `app/manufacturing/work-centers/stasiun-client.tsx`

**Step 1: Group subkon stations by stationType**

```tsx
// Group subkon stations by stationType for the Subkon tab
const subkonByType: Record<string, { parents: any[]; orphans: any[] }> = {}
for (const s of subkonStations) {
    const type = s.stationType || "OTHER"
    if (!subkonByType[type]) subkonByType[type] = { parents: [], orphans: [] }
    if (!s.parentStationId) {
        subkonByType[type].parents.push(s)
    } else {
        subkonByType[type].orphans.push(s)
    }
}
```

Note: `childStations` is already included in the API response (from `process-stations` GET handler), so parent stations already carry their children.

**Step 2: Render the Subkon view**

When `operationTab === "subkon"`, render:

```tsx
{operationTab === "subkon" && (
    <div className="space-y-6">
        {/* Subkon KPI strip */}
        <div className="bg-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-3 divide-x-2 divide-black">
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase text-zinc-500">Total Subkon</p>
                    <p className="text-2xl font-black">{subkonStations.length}</p>
                </div>
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase text-zinc-500">Tipe Proses</p>
                    <p className="text-2xl font-black">{Object.keys(subkonByType).length}</p>
                </div>
                <div className="p-4">
                    <p className="text-[10px] font-black uppercase text-zinc-500">Subkontraktor Terhubung</p>
                    <p className="text-2xl font-black">
                        {new Set(subkonStations.filter((s: any) => s.subcontractorId).map((s: any) => s.subcontractorId)).size}
                    </p>
                </div>
            </div>
        </div>

        {/* Add Subkon Process button */}
        <div className="flex items-center justify-between">
            <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Proses subkon dikelompokkan per tipe — klik proses untuk melihat sub-proses
            </p>
            <Button
                className="h-10 bg-amber-400 text-black hover:bg-amber-500 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] rounded-none font-black uppercase tracking-widest text-xs px-6"
                onClick={() => openSubkonCreate()}
            >
                <Plus className="mr-2 h-4 w-4" /> Tambah Proses Subkon
            </Button>
        </div>

        {/* Process type groups */}
        {Object.entries(subkonByType).map(([type, { parents }]) => {
            const config = getTypeConfig(type)
            const TypeIcon = config.icon
            return (
                <div key={type} className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className={cn("flex items-center gap-1.5 px-3 py-1.5 border text-xs font-black uppercase tracking-widest", config.color)}>
                            <TypeIcon className="h-3.5 w-3.5" />
                            {config.label}
                        </div>
                        <p className="text-[9px] font-bold text-zinc-400 uppercase">
                            {parents.length} proses
                        </p>
                    </div>

                    <div className="space-y-3">
                        {parents.map((station) => renderSubkonProcessCard(station))}
                    </div>
                </div>
            )
        })}
    </div>
)}
```

**Step 3: Build the subkon process card with sub-process rows**

```tsx
const renderSubkonProcessCard = (station: any) => {
    const config = getTypeConfig(station.stationType)
    const children = station.childStations || []
    const isExpanded = !collapsedGroups.has(station.id)

    return (
        <Card key={station.id} className="border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden">
            {/* Process header — clickable to expand/collapse */}
            <button
                className="w-full flex items-center justify-between p-3 border-b-2 border-black bg-amber-50 hover:bg-amber-100 transition-all text-left"
                onClick={() => toggleCollapse(station.id)}
            >
                <div className="flex items-center gap-3">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <div>
                        <p className="text-sm font-black uppercase">{station.name}</p>
                        <p className="text-[9px] font-mono text-zinc-400">{station.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {station.subcontractor?.name && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-200 px-2 py-0.5 border border-amber-300">
                            {station.subcontractor.name}
                        </span>
                    )}
                    <span className="text-[9px] font-bold text-zinc-400">
                        {children.length} sub-proses
                    </span>
                </div>
            </button>

            {/* Sub-processes */}
            {isExpanded && (
                <div className="divide-y divide-zinc-200">
                    {children.map((child: any) => (
                        <div key={child.id} className="flex items-center justify-between p-3 hover:bg-zinc-50 transition-all">
                            <div className="flex items-center gap-3">
                                <div className="h-6 w-6 border border-zinc-300 flex items-center justify-center bg-zinc-100">
                                    <Cog className="h-3 w-3 text-zinc-400" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold">{child.description || child.name}</p>
                                    {child.subcontractor?.name && (
                                        <p className="text-[9px] text-amber-600 font-bold">
                                            → {child.subcontractor.name}
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {Number(child.costPerUnit) > 0 && (
                                    <span className="text-[10px] font-mono font-bold text-zinc-500">
                                        Rp {Number(child.costPerUnit).toLocaleString("id-ID")}/unit
                                    </span>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none"
                                    onClick={() => handleDuplicateSubProcess(station, child)}
                                    title="Duplikat sub-proses"
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none"
                                    onClick={() => openEditSubProcess(child)}
                                    title="Edit sub-proses"
                                >
                                    <Settings className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-none text-red-500"
                                    onClick={(e) => handleDelete(e, child)}
                                    title="Hapus sub-proses"
                                >
                                    <Trash2 className="h-3 w-3" />
                                </Button>
                            </div>
                        </div>
                    ))}

                    {/* Add sub-process button */}
                    <button
                        className="w-full p-2 flex items-center justify-center gap-1 text-[10px] font-bold text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600 transition-all"
                        onClick={() => openAddSubProcess(station)}
                    >
                        <Plus className="h-3 w-3" /> Tambah Sub-Proses
                    </button>
                </div>
            )}
        </Card>
    )
}
```

Add `Copy` to lucide imports.

**Step 4: Commit**

```bash
git add app/manufacturing/work-centers/stasiun-client.tsx
git commit -m "feat(work-centers): build subkon tab with process groups and sub-process cards"
```

---

### Task 3: Add Subkon process creation dialog

**Files:**
- Modify: `app/manufacturing/work-centers/stasiun-client.tsx`

**Step 1: Add dialog state**

```tsx
const [subkonDialogOpen, setSubkonDialogOpen] = useState(false)
const [subkonParentStation, setSubkonParentStation] = useState<any>(null) // when adding sub-process
const [subkonFormName, setSubkonFormName] = useState("")
const [subkonFormType, setSubkonFormType] = useState("SEWING")
const [subkonFormDesc, setSubkonFormDesc] = useState("") // sub-process description
const [subkonFormCost, setSubkonFormCost] = useState("")
const [subkonFormSubcontractorId, setSubkonFormSubcontractorId] = useState<string>("__none__")
```

**Step 2: Add dialog open handlers**

```tsx
const openSubkonCreate = () => {
    setSubkonParentStation(null)
    setSubkonFormName("")
    setSubkonFormType("SEWING")
    setSubkonFormDesc("")
    setSubkonFormCost("")
    setSubkonFormSubcontractorId("__none__")
    setSubkonDialogOpen(true)
}

const openAddSubProcess = (parentStation: any) => {
    setSubkonParentStation(parentStation)
    setSubkonFormName("")
    setSubkonFormType(parentStation.stationType)
    setSubkonFormDesc("")
    setSubkonFormCost("")
    setSubkonFormSubcontractorId("__none__")
    setSubkonDialogOpen(true)
}

const openEditSubProcess = (station: any) => {
    setEditingStation(station)
    setSubkonParentStation(null) // editing mode
    setSubkonFormName(station.name)
    setSubkonFormType(station.stationType)
    setSubkonFormDesc(station.description || "")
    setSubkonFormCost(String(Number(station.costPerUnit || 0)))
    setSubkonFormSubcontractorId(station.subcontractorId || "__none__")
    setSubkonDialogOpen(true)
}
```

**Step 3: Add the save handler**

```tsx
const handleSaveSubkon = async () => {
    const name = subkonFormName.trim() || subkonFormDesc.trim()
    if (!name) { toast.error("Nama proses wajib diisi"); return }
    setSaving(true)
    try {
        const isEditing = editingStation && subkonDialogOpen
        const code = isEditing
            ? editingStation.code
            : `SUB-${subkonFormType.substring(0, 3)}-${String(Date.now()).slice(-4)}`

        const body: any = {
            code,
            name: subkonFormName.trim() || subkonFormDesc.trim(),
            stationType: subkonFormType,
            operationType: "SUBCONTRACTOR",
            costPerUnit: Number(subkonFormCost) || 0,
            description: subkonFormDesc.trim() || null,
            subcontractorId: subkonFormSubcontractorId === "__none__" ? null : subkonFormSubcontractorId,
            parentStationId: subkonParentStation?.id || null,
        }

        const url = isEditing
            ? `/api/manufacturing/process-stations/${editingStation.id}`
            : "/api/manufacturing/process-stations"

        const res = await fetch(url, {
            method: isEditing ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        const result = await res.json()

        if (result.success) {
            toast.success(isEditing ? "Proses subkon diperbarui" : subkonParentStation ? "Sub-proses ditambahkan" : "Proses subkon dibuat")
            invalidateAll()
            setSubkonDialogOpen(false)
            setEditingStation(null)
        } else {
            toast.error(result.error || "Gagal menyimpan")
        }
    } catch {
        toast.error("Gagal menyimpan")
    } finally {
        setSaving(false)
    }
}
```

**Step 4: Add duplicate handler**

```tsx
const handleDuplicateSubProcess = async (parent: any, child: any) => {
    setSaving(true)
    try {
        const code = `SUB-${child.stationType?.substring(0, 3) || "OTH"}-${String(Date.now()).slice(-4)}`
        const body = {
            code,
            name: `${child.name} (Copy)`,
            stationType: child.stationType,
            operationType: "SUBCONTRACTOR",
            costPerUnit: Number(child.costPerUnit) || 0,
            description: child.description || null,
            subcontractorId: child.subcontractorId || null,
            parentStationId: parent.id,
        }
        const res = await fetch("/api/manufacturing/process-stations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        })
        const result = await res.json()
        if (result.success) {
            toast.success("Sub-proses berhasil diduplikat")
            invalidateAll()
        } else {
            toast.error(result.error || "Gagal menduplikat")
        }
    } catch {
        toast.error("Gagal menduplikat")
    } finally {
        setSaving(false)
    }
}
```

**Step 5: Build the dialog UI**

```tsx
{/* Subkon Process Dialog */}
<Dialog open={subkonDialogOpen} onOpenChange={(open) => { setSubkonDialogOpen(open); if (!open) setEditingStation(null) }}>
    <DialogContent className="border-2 border-black rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md">
        <DialogHeader>
            <DialogTitle className="text-sm font-black uppercase tracking-widest">
                {editingStation ? "Edit Proses Subkon" : subkonParentStation ? `Tambah Sub-Proses — ${subkonParentStation.name}` : "Tambah Proses Subkon"}
            </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
            {/* Nama */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Nama Proses</label>
                <Input value={subkonFormName} onChange={(e) => setSubkonFormName(e.target.value)}
                    placeholder="cth: Jahit Lining, Obras Pinggir" className="border-2 border-black rounded-none h-10 font-bold" />
            </div>

            {/* Tipe Proses — disabled if adding sub-process (inherits from parent) */}
            {!subkonParentStation && (
                <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Tipe Proses</label>
                    <Select value={subkonFormType} onValueChange={setSubkonFormType}>
                        <SelectTrigger className="border-2 border-black rounded-none h-10 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent className="border-2 border-black rounded-none">
                            {STATION_TYPE_CONFIG.map((c) => (
                                <SelectItem key={c.type} value={c.type}>{c.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Deskripsi sub-proses */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Deskripsi / Jenis Pekerjaan</label>
                <Input value={subkonFormDesc} onChange={(e) => setSubkonFormDesc(e.target.value)}
                    placeholder="cth: Jahit Lining, Jahit Body, Obras" className="border-2 border-black rounded-none h-10 font-bold" />
            </div>

            {/* Subkontraktor (optional) */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Hubungkan ke Subkontraktor (Opsional)</label>
                <Select value={subkonFormSubcontractorId} onValueChange={setSubkonFormSubcontractorId}>
                    <SelectTrigger className="border-2 border-black rounded-none h-10 font-bold"><SelectValue placeholder="Pilih subkontraktor..." /></SelectTrigger>
                    <SelectContent className="border-2 border-black rounded-none">
                        <SelectItem value="__none__" className="text-zinc-400">Tanpa Subkontraktor</SelectItem>
                        {/* subcontractors extracted from existing SUBCONTRACTOR stations */}
                        {Array.from(
                            new Map(subkonStations
                                .filter((s: any) => s.subcontractor?.id)
                                .map((s: any) => [s.subcontractor.id, s.subcontractor.name])
                            ).entries()
                        ).map(([id, name]) => (
                            <SelectItem key={id} value={id}>{name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Biaya per Unit */}
            <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Biaya per Unit (Rp)</label>
                <Input type="number" value={subkonFormCost} onChange={(e) => setSubkonFormCost(e.target.value)}
                    placeholder="0" className="border-2 border-black rounded-none h-10 font-bold" />
            </div>

            <Button className="w-full h-10 bg-amber-400 text-black hover:bg-amber-500 border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] rounded-none font-black uppercase tracking-widest text-xs"
                onClick={handleSaveSubkon} disabled={saving}>
                {saving ? "Menyimpan..." : editingStation ? "Simpan Perubahan" : "Tambah Proses Subkon"}
            </Button>
        </div>
    </DialogContent>
</Dialog>
```

**Step 6: Commit**

```bash
git add app/manufacturing/work-centers/stasiun-client.tsx
git commit -m "feat(work-centers): subkon process creation dialog with sub-process support"
```

---

### Task 4: Ensure API supports `parentStationId` and `subcontractorId` in PATCH

**Files:**
- Modify: `app/api/manufacturing/process-stations/[id]/route.ts` (if it exists, check the PATCH handler)

**Step 1: Check PATCH handler**

The PATCH handler should already accept `parentStationId` and `subcontractorId` based on the existing POST handler. Verify and add if missing.

Check that `parentStationId` can be set/unset via PATCH. If the PATCH handler doesn't include connect/disconnect logic for these relations, add it.

**Step 2: Commit if changes needed**

```bash
git add app/api/manufacturing/process-stations/
git commit -m "fix(api): ensure PATCH supports parentStationId for sub-process hierarchy"
```

---

## Execution Priority

1. **Task 1** — Tab toggle (structural change, quick)
2. **Task 2** — Subkon view with cards (visual output)
3. **Task 3** — Dialog + CRUD (full functionality)
4. **Task 4** — API verification

## Verification

After all tasks:
- `/manufacturing/work-centers` shows In-House/Subkon tab toggle
- In-House tab works exactly as before (no regression)
- Subkon tab shows process types grouped by stationType
- Each process can be expanded to show sub-processes (childStations)
- "Tambah Proses Subkon" creates a new subkon process with type + description
- "Tambah Sub-Proses" adds a child to an existing process
- Sub-processes can be duplicated (creates a copy under same parent)
- Sub-processes can be linked to subcontractor companies
- Edit and delete work on sub-processes

**Sebelumnya:** Subkon stations were completely hidden from the Work Centers page — only manageable from within BOM canvas.
**Sekarang:** Full subkon process management with hierarchy (process → sub-process), subcontractor linking, and duplication — all from the Work Centers page.
**Kenapa penting:** Users can set up their subkon process catalog independently of any specific BOM, then reuse it across multiple products.
