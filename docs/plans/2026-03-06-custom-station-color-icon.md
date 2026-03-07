# Custom Process Station Color & Icon — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When creating a custom process (stationType=OTHER, e.g. "Bakar"), allow the user to pick a color theme and an icon so it shows up as a colourful button in the toolbar — just like the built-in types (Potong=red, Jahit=blue, etc.) instead of the current plain gray Cog.

**Architecture:** Add `iconName` and `colorTheme` nullable String fields to `ProcessStation`. In the "Work Center Kustom" dialog, add a color picker (grid of preset color swatches) and an icon picker (grid of ~16 curated icons). When rendering the toolbar, canvas nodes, and timeline, use these stored values instead of hardcoded gray/Cog for OTHER-type stations.

**Tech Stack:** Prisma db push, Next.js, React state, Lucide icons, Tailwind color presets

---

### Task 1: Add `iconName` and `colorTheme` to ProcessStation schema

**Files:**
- Modify: `prisma/schema.prisma` (model `ProcessStation`, around line 2694)

**Step 1: Add the fields**

In `prisma/schema.prisma`, inside `ProcessStation`, after the `description` field (line 2694):

```prisma
  iconName        String?                // Lucide icon name for custom OTHER stations (e.g. "Flame", "Zap")
  colorTheme      String?                // Color theme key (e.g. "red", "blue", "purple") for toolbar/canvas
```

**Step 2: Push schema**

```bash
npx prisma db push
```

**Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): add iconName and colorTheme to ProcessStation"
```

---

### Task 2: Create shared color/icon config

**Files:**
- Create: `components/manufacturing/bom/station-config.ts`

Create a single shared config file that all consumers (toolbar, canvas, timeline, dialog) import from. This eliminates the current duplication of color maps across files.

```ts
// components/manufacturing/bom/station-config.ts
import {
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, Package, Wrench, Cog, Flame, Zap,
    Wind, Brush, Hammer, Factory, Gem, Layers,
    Stamp, PaintBucket, CircleDot, Gauge, Ribbon, Waypoints, Pipette,
} from "lucide-react"

// ── COLOR THEMES ──
// Each theme has: toolbar (Tailwind classes), hex (for timeline/canvas inline styles)
export const COLOR_THEMES: Record<string, {
    toolbar: string
    hex: { bg: string; border: string; text: string; accent: string }
}> = {
    red:    { toolbar: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",       hex: { bg: "#fef2f2", border: "#fca5a5", text: "#b91c1c", accent: "#f87171" } },
    blue:   { toolbar: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",    hex: { bg: "#eff6ff", border: "#93c5fd", text: "#1d4ed8", accent: "#60a5fa" } },
    cyan:   { toolbar: "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100",    hex: { bg: "#ecfeff", border: "#67e8f9", text: "#0e7490", accent: "#22d3ee" } },
    purple: { toolbar: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100", hex: { bg: "#faf5ff", border: "#c4b5fd", text: "#7c3aed", accent: "#a78bfa" } },
    pink:   { toolbar: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",    hex: { bg: "#fdf2f8", border: "#f9a8d4", text: "#be185d", accent: "#f472b6" } },
    green:  { toolbar: "bg-green-50 text-green-600 border-green-200 hover:bg-green-100", hex: { bg: "#f0fdf4", border: "#86efac", text: "#15803d", accent: "#4ade80" } },
    amber:  { toolbar: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100", hex: { bg: "#fffbeb", border: "#fcd34d", text: "#b45309", accent: "#fbbf24" } },
    orange: { toolbar: "bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100", hex: { bg: "#fff7ed", border: "#fdba74", text: "#c2410c", accent: "#fb923c" } },
    teal:   { toolbar: "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100",    hex: { bg: "#f0fdfa", border: "#5eead4", text: "#0f766e", accent: "#2dd4bf" } },
    indigo: { toolbar: "bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100", hex: { bg: "#eef2ff", border: "#a5b4fc", text: "#4338ca", accent: "#818cf8" } },
    rose:   { toolbar: "bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100",    hex: { bg: "#fff1f2", border: "#fda4af", text: "#be123c", accent: "#fb7185" } },
    zinc:   { toolbar: "bg-zinc-50 text-zinc-600 border-zinc-300 hover:bg-zinc-100",    hex: { bg: "#f4f4f5", border: "#a1a1aa", text: "#3f3f46", accent: "#71717a" } },
}

// ── ICON OPTIONS ──
// Curated icons suitable for manufacturing processes
export const ICON_OPTIONS = [
    { name: "Cog",         icon: Cog,         label: "Gir" },
    { name: "Flame",       icon: Flame,       label: "Api" },
    { name: "Zap",         icon: Zap,         label: "Listrik" },
    { name: "Wind",        icon: Wind,        label: "Angin" },
    { name: "Brush",       icon: Brush,       label: "Kuas" },
    { name: "Hammer",      icon: Hammer,      label: "Palu" },
    { name: "Factory",     icon: Factory,     label: "Pabrik" },
    { name: "Gem",         icon: Gem,         label: "Permata" },
    { name: "Layers",      icon: Layers,      label: "Layer" },
    { name: "Stamp",       icon: Stamp,       label: "Stempel" },
    { name: "PaintBucket", icon: PaintBucket, label: "Cat" },
    { name: "CircleDot",   icon: CircleDot,   label: "Titik" },
    { name: "Gauge",       icon: Gauge,       label: "Gauge" },
    { name: "Scissors",    icon: Scissors,    label: "Gunting" },
    { name: "Shirt",       icon: Shirt,       label: "Baju" },
    { name: "Droplets",    icon: Droplets,    label: "Tetes" },
    { name: "Printer",     icon: Printer,     label: "Cetak" },
    { name: "Sparkles",    icon: Sparkles,    label: "Bintang" },
    { name: "ShieldCheck", icon: ShieldCheck, label: "QC" },
    { name: "Package",     icon: Package,     label: "Paket" },
    { name: "Wrench",      icon: Wrench,      label: "Kunci" },
    { name: "Pipette",     icon: Pipette,     label: "Pipet" },
    { name: "Ribbon",      icon: Ribbon,      label: "Pita" },
    { name: "Waypoints",   icon: Waypoints,   label: "Jalur" },
] as const

// Helper: get icon component by name string
export function getIconByName(name: string | null | undefined) {
    return ICON_OPTIONS.find(o => o.name === name)?.icon || Cog
}

// Helper: get color theme by key (falls back to zinc/gray)
export function getColorTheme(key: string | null | undefined) {
    return COLOR_THEMES[key || ""] || COLOR_THEMES.zinc
}

// ── BUILT-IN STATION TYPE DEFAULTS ──
// Maps StationType enum → default icon + color (used for non-OTHER types)
export const STATION_TYPE_DEFAULTS: Record<string, { icon: typeof Cog; color: string; colorKey: string }> = {
    CUTTING:    { icon: Scissors,    color: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",       colorKey: "red" },
    SEWING:     { icon: Shirt,       color: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",    colorKey: "blue" },
    WASHING:    { icon: Droplets,    color: "bg-cyan-50 text-cyan-600 border-cyan-200 hover:bg-cyan-100",    colorKey: "cyan" },
    PRINTING:   { icon: Printer,     color: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100", colorKey: "purple" },
    EMBROIDERY: { icon: Sparkles,    color: "bg-pink-50 text-pink-600 border-pink-200 hover:bg-pink-100",    colorKey: "pink" },
    QC:         { icon: ShieldCheck, color: "bg-green-50 text-green-600 border-green-200 hover:bg-green-100", colorKey: "green" },
    PACKING:    { icon: Package,     color: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100", colorKey: "amber" },
    FINISHING:  { icon: Wrench,      color: "bg-zinc-50 text-zinc-600 border-zinc-200 hover:bg-zinc-100",    colorKey: "zinc" },
}
```

**Step 2: Commit**

```bash
git add components/manufacturing/bom/station-config.ts
git commit -m "feat(bom): create shared station color/icon config"
```

---

### Task 3: Add color & icon pickers to CreateStationDialog

**Files:**
- Modify: `components/manufacturing/bom/create-station-dialog.tsx`

**Step 1: Add `iconName` and `colorTheme` to the station form schema**

```ts
const stationSchema = z.object({
    // ... existing fields ...
    iconName: z.string().optional(),
    colorTheme: z.string().optional(),
})
```

Add default values:
```ts
iconName: "Cog",
colorTheme: "zinc",
```

**Step 2: Add color picker grid**

After the description field and before the footer, when `stationType === "OTHER"`, render:

```tsx
{stationType === "OTHER" && (
    <>
        {/* Color Picker */}
        <div>
            <label className={NB.label}>Warna</label>
            <div className="grid grid-cols-6 gap-1.5">
                {Object.entries(COLOR_THEMES).map(([key, theme]) => (
                    <button
                        key={key}
                        type="button"
                        onClick={() => stationForm.setValue("colorTheme", key)}
                        className={`h-7 w-full border-2 rounded-none transition-all ${theme.toolbar.split(" ").slice(0,1).join(" ")} ${
                            field.value === key ? "border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] scale-110" : "border-transparent hover:border-zinc-300"
                        }`}
                    />
                ))}
            </div>
        </div>

        {/* Icon Picker */}
        <div>
            <label className={NB.label}>Ikon</label>
            <div className="grid grid-cols-8 gap-1.5">
                {ICON_OPTIONS.map((opt) => {
                    const Ic = opt.icon
                    return (
                        <button
                            key={opt.name}
                            type="button"
                            onClick={() => stationForm.setValue("iconName", opt.name)}
                            className={`h-8 w-full flex items-center justify-center border-2 rounded-none transition-all ${
                                iconName === opt.name ? "border-black bg-zinc-100 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" : "border-zinc-200 hover:border-black"
                            }`}
                            title={opt.label}
                        >
                            <Ic className="h-4 w-4" />
                        </button>
                    )
                })}
            </div>
        </div>
    </>
)}
```

**Step 3: Pass `iconName` and `colorTheme` in the POST body**

The `onStationSubmit` sends `JSON.stringify(values)` — since iconName and colorTheme are now in the form values, they'll be sent automatically.

**Step 4: Commit**

```bash
git add components/manufacturing/bom/create-station-dialog.tsx
git commit -m "feat(bom): add color/icon pickers to custom station dialog"
```

---

### Task 4: Handle `iconName` and `colorTheme` in the process-stations API

**Files:**
- Modify: `app/api/manufacturing/process-stations/route.ts`

**Step 1: Add to POST handler**

In the station creation data, include the new fields:

```ts
iconName: body.iconName || null,
colorTheme: body.colorTheme || null,
```

**Step 2: Add to GET handler include/select**

Ensure `iconName` and `colorTheme` are included in the response. If the GET handler uses `include` (returning all scalar fields), no change is needed. If it uses `select`, add the fields.

**Step 3: Commit**

```bash
git add app/api/manufacturing/process-stations/route.ts
git commit -m "feat(bom): persist iconName/colorTheme in station API"
```

---

### Task 5: Use stored color/icon in toolbar, canvas, and timeline

**Files:**
- Modify: `app/manufacturing/bom/[id]/page.tsx` (toolbar — `dynamicProcessTypes` + `STATION_TYPE_CONFIG`)
- Modify: `components/manufacturing/bom/station-node.tsx` (canvas node icons)
- Modify: `components/manufacturing/bom/timeline-view.tsx` (timeline bar colors)

**Step 1: Update `dynamicProcessTypes` in page.tsx**

Replace the hardcoded gray/Cog for custom OTHER types with the station's stored values:

```ts
const custom = customDescriptions.map(desc => {
    // Find a representative station to get its color/icon
    const repStation = otherStations.find((s: any) => s.description === desc)
    const colorKey = repStation?.colorTheme || "zinc"
    const theme = getColorTheme(colorKey)
    const IconComp = getIconByName(repStation?.iconName)
    return {
        type: `OTHER:${desc}`,
        label: desc,
        icon: IconComp,
        color: theme.toolbar,
        isCustom: true,
        description: desc,
    }
})
```

Import `getColorTheme`, `getIconByName` from `./station-config` (adjust path relative to page.tsx → `@/components/manufacturing/bom/station-config`).

Also update `STATION_TYPE_CONFIG` to import from the shared config or keep as-is since it only covers built-in types.

**Step 2: Update station-node.tsx**

The station node currently uses a hardcoded `STATION_ICONS` map. Update to also check the station's `iconName`:

```ts
import { getIconByName, STATION_TYPE_DEFAULTS } from "./station-config"

// In the component:
const Icon = station?.stationType === "OTHER" && station?.iconName
    ? getIconByName(station.iconName)
    : STATION_ICONS[station?.stationType] || Cog
```

**Step 3: Update timeline-view.tsx**

The timeline uses `STATION_COLORS`. For OTHER-type steps, use the station's `colorTheme`:

```ts
import { getColorTheme } from "./station-config"

// When looking up colors:
const st = step.station?.stationType || "OTHER"
const c = st === "OTHER" && step.station?.colorTheme
    ? getColorTheme(step.station.colorTheme).hex
    : STATION_COLORS[st] || STATION_COLORS.OTHER
```

**Step 4: Also include iconName/colorTheme in the BOM GET response**

The BOM GET handler at `app/api/manufacturing/production-bom/[id]/route.ts` selects specific station fields (line 38-42). Add `iconName` and `colorTheme` to the station select:

```ts
station: {
    select: {
        id: true, code: true, name: true, stationType: true,
        operationType: true, costPerUnit: true,
        iconName: true, colorTheme: true,  // ← ADD
        subcontractor: { select: { id: true, name: true } },
    },
},
```

**Step 5: Commit**

```bash
git add app/manufacturing/bom/[id]/page.tsx components/manufacturing/bom/station-node.tsx components/manufacturing/bom/timeline-view.tsx app/api/manufacturing/production-bom/[id]/route.ts
git commit -m "feat(bom): use stored color/icon for custom process types in toolbar, canvas, timeline"
```

---

## Execution Priority

1. **Task 1** — Schema (required for persistence)
2. **Task 2** — Shared config (other tasks import from this)
3. **Task 3** — Dialog UX (user-facing creation flow)
4. **Task 4** — API persistence
5. **Task 5** — Render in toolbar/canvas/timeline

## Verification

After all tasks:
- Click "+ Work Center Kustom" → select "Lainnya" type → color swatches and icon grid appear
- Pick orange + Flame icon → save as "Bakar"
- Toolbar shows "Bakar" with orange background and Flame icon (not gray Cog)
- Canvas node shows Flame icon for this station
- Timeline bar uses orange color scheme
- Existing built-in types (Potong, Jahit, etc.) are unchanged
