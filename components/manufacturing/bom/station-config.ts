import {
    Scissors, Shirt, Droplets, Printer, Sparkles,
    ShieldCheck, Package, Wrench, Cog, Flame, Zap,
    Wind, Brush, Hammer, Factory, Gem, Layers,
    Stamp, PaintBucket, CircleDot, Gauge, Ribbon, Waypoints, Pipette,
} from "lucide-react"

// ── COLOR THEMES ──
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

export function getIconByName(name: string | null | undefined) {
    return ICON_OPTIONS.find(o => o.name === name)?.icon || Cog
}

export function getColorTheme(key: string | null | undefined) {
    return COLOR_THEMES[key || ""] || COLOR_THEMES.zinc
}

// ── BUILT-IN STATION TYPE → DEFAULT ICON + COLOR ──
export const STATION_TYPE_DEFAULTS: Record<string, { icon: typeof Cog; colorKey: string }> = {
    CUTTING:    { icon: Scissors,    colorKey: "red" },
    SEWING:     { icon: Shirt,       colorKey: "blue" },
    WASHING:    { icon: Droplets,    colorKey: "cyan" },
    PRINTING:   { icon: Printer,     colorKey: "purple" },
    EMBROIDERY: { icon: Sparkles,    colorKey: "pink" },
    QC:         { icon: ShieldCheck, colorKey: "green" },
    PACKING:    { icon: Package,     colorKey: "amber" },
    FINISHING:  { icon: Wrench,      colorKey: "zinc" },
}
