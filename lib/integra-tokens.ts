/**
 * Integra design system — TypeScript token map
 *
 * Bloomberg-lite corporate look. Single accent (#0047FF), warm canvas,
 * hairline borders, NO shadows, mono numerics, dense rows.
 *
 * Usage: `import { INT } from "@/lib/integra-tokens"`
 *        `<div className={INT.panel}>...</div>`
 *
 * For incremental migration: any page wrapped in `<div className="integra-app">`
 * picks up the body font + tnum + canvas color automatically.
 *
 * Source: docs design_handoff_integra_erp/README.md
 */

export const INT = {
    // ───────── App shell ─────────
    appShell: "min-h-screen grid grid-cols-[232px_1fr] bg-[var(--integra-canvas)] text-[var(--integra-ink)]",

    // ───────── Sidebar ─────────
    sidebar: "border-r border-[var(--integra-hairline)] bg-[var(--integra-canvas)] sticky top-0 self-start h-screen overflow-auto flex flex-col",
    sidebarBrand: "flex items-center gap-2.5 px-[18px] py-[14px] border-b border-[var(--integra-hairline)] h-[52px]",
    sidebarBrandMark: "w-[22px] h-[22px] rounded-[4px] bg-[var(--integra-ink)] text-[var(--integra-canvas)] grid place-items-center font-display font-semibold text-[12px] tracking-[-0.04em]",
    sidebarBrandName: "font-display font-semibold tracking-[-0.025em] text-[15px]",
    sidebarBrandEnv: "ml-auto font-mono text-[10.5px] text-[var(--integra-muted)] border border-[var(--integra-hairline-strong)] px-[5px] py-[1px] rounded-[2px] uppercase tracking-[0.08em]",

    sidebarSearch: "px-3 py-2.5 border-b border-[var(--integra-hairline)] flex items-center gap-2",
    sidebarSearchInput: "flex-1 border border-[var(--integra-hairline)] bg-white px-2 py-1.5 text-[13px] text-[var(--integra-ink)] rounded-[2px] outline-none focus:ring-2 focus:ring-[var(--integra-liren-blue)]/30",
    sidebarSearchKbd: "font-mono text-[10.5px] text-[var(--integra-muted)] border border-[var(--integra-hairline-strong)] px-1 py-px rounded-[2px]",

    navSection: "px-2 pt-3 pb-1",
    navTitle: "text-[10px] font-semibold tracking-[0.14em] uppercase text-[var(--integra-muted)] px-2.5 pt-1 pb-1.5",
    navItem: "flex items-center gap-2.5 px-2.5 py-1.5 rounded-[3px] text-[13px] text-[var(--integra-ink-soft)] cursor-pointer select-none hover:bg-[#F1EFE8] hover:text-[var(--integra-ink)] transition-colors",
    navItemActive: "bg-[var(--integra-ink)] text-[var(--integra-canvas)] hover:bg-[var(--integra-ink)] hover:text-[var(--integra-canvas)]",
    navIco: "w-3.5 h-3.5 flex-shrink-0 opacity-75",
    navIcoActive: "opacity-100",
    navCount: "ml-auto font-mono text-[11px] text-[var(--integra-muted)]",
    navCountActive: "text-[var(--integra-canvas)] opacity-60",

    // ───────── Topbar ─────────
    topbar: "sticky top-0 z-10 h-[52px] flex items-center px-[18px] bg-[var(--integra-canvas)] border-b border-[var(--integra-hairline)] gap-4",
    breadcrumb: "text-[13px] text-[var(--integra-muted)] flex items-center gap-1.5",
    breadcrumbCurrent: "text-[var(--integra-ink)]",
    periodSelector: "ml-auto inline-flex items-center border border-[var(--integra-hairline-strong)] rounded-[3px] overflow-hidden",
    periodBtn: "px-3 py-1.5 text-[12px] font-medium font-display text-[var(--integra-ink-soft)] border-r border-[var(--integra-hairline)] last:border-r-0 hover:bg-[#F1EFE8]",
    periodBtnActive: "bg-[var(--integra-ink)] text-[var(--integra-canvas)] hover:bg-[var(--integra-ink)]",

    // ───────── Page head ─────────
    pageHead: "flex items-end justify-between pb-3 mb-3 border-b border-[var(--integra-hairline)]",
    pageTitle: "font-display text-[20px] font-medium tracking-[-0.022em] leading-tight",
    pageSubtitle: "text-[12.5px] text-[var(--integra-muted)] mt-0.5",
    pageMetaRight: "text-[11.5px] text-[var(--integra-muted)] flex items-center gap-3",
    liveDot: "w-1.5 h-1.5 rounded-full bg-[var(--integra-green-ok)] inline-block",

    // ───────── Panel (cards on canvas) ─────────
    panel: "bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px]",
    panelHead: "flex items-center justify-between px-3.5 py-2.5 border-b border-[var(--integra-hairline)]",
    panelTitle: "text-[12.5px] font-display font-medium text-[var(--integra-ink)]",
    panelMeta: "text-[11px] text-[var(--integra-muted)] font-mono",
    panelBody: "p-3.5",
    panelBodyTight: "p-0", // for tables that need full bleed

    // ───────── KPI rail (5 KPIs in one bordered row) ─────────
    kpiRail: "flex items-stretch bg-[var(--integra-canvas-pure)] border border-[var(--integra-hairline)] rounded-[3px] overflow-hidden",
    kpiCell: "flex-1 px-3.5 py-3 border-r border-[var(--integra-hairline)] last:border-r-0 min-h-[92px] flex flex-col justify-between",
    kpiLabel: "text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)]",
    kpiValueRow: "flex items-baseline gap-1.5",
    kpiValue: "font-mono text-[22px] font-medium tracking-[-0.025em] text-[var(--integra-ink)]",
    kpiUnit: "text-[12px] text-[var(--integra-muted)]",
    kpiFoot: "text-[11.5px] text-[var(--integra-muted)] flex items-center gap-1.5",

    // ───────── Delta pills ─────────
    deltaUp: "inline-flex items-center font-mono text-[11.5px] px-1.5 py-px rounded-[2px] bg-[var(--integra-green-ok-bg)] text-[var(--integra-green-ok)]",
    deltaDown: "inline-flex items-center font-mono text-[11.5px] px-1.5 py-px rounded-[2px] bg-[var(--integra-red-bg)] text-[var(--integra-red)]",
    deltaFlat: "inline-flex items-center font-mono text-[11.5px] px-1.5 py-px rounded-[2px] bg-[#F1EFE8] text-[var(--integra-muted)]",

    // ───────── Status pills ─────────
    pillOk: "inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-[2px] bg-[var(--integra-green-ok-bg)] text-[var(--integra-green-ok)]",
    pillWarn: "inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-[2px] bg-[var(--integra-amber-bg)] text-[var(--integra-amber)]",
    pillErr: "inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-[2px] bg-[var(--integra-red-bg)] text-[var(--integra-red)]",
    pillInfo: "inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-[2px] bg-[var(--integra-liren-blue-soft)] text-[var(--integra-liren-blue)]",
    pillNeutral: "inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-[2px] bg-[#F1EFE8] text-[var(--integra-muted)]",
    pillOutline: "inline-flex items-center text-[11px] font-medium px-1.5 py-0.5 rounded-[2px] border border-[var(--integra-hairline-strong)] text-[var(--integra-ink-soft)]",

    // ───────── Buttons ─────────
    btnPrimary: "inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium font-display bg-[var(--integra-ink)] text-[var(--integra-canvas)] border border-[var(--integra-ink)] rounded-[3px] hover:bg-[#000] transition-colors",
    btnSecondary: "inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium font-display bg-[var(--integra-canvas-pure)] text-[var(--integra-ink)] border border-[var(--integra-hairline-strong)] rounded-[3px] hover:border-[var(--integra-ink)] transition-colors",
    btnGhost: "inline-flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium font-display text-[var(--integra-ink-soft)] border border-transparent rounded-[3px] hover:border-[var(--integra-hairline)] transition-colors",
    btnLink: "text-[var(--integra-liren-blue)] hover:underline cursor-pointer",

    // ───────── Tabs (above tables) ─────────
    tabBar: "flex items-center gap-1 border-b border-[var(--integra-hairline)] px-3.5",
    tab: "px-2.5 py-2 text-[12px] font-medium text-[var(--integra-muted)] cursor-pointer hover:text-[var(--integra-ink)] -mb-px border-b-2 border-transparent",
    tabActive: "bg-[var(--integra-liren-blue-soft)] text-[var(--integra-liren-blue)] font-semibold rounded-t-[3px]",

    // ───────── Data table (dense, 30px rows) ─────────
    tableWrap: "w-full overflow-auto",
    table: "w-full border-collapse",
    th: "h-[28px] px-3 text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)] text-left border-b border-[var(--integra-hairline)] bg-[var(--integra-canvas-pure)]",
    thNum: "h-[28px] px-3 text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)] text-right border-b border-[var(--integra-hairline)] bg-[var(--integra-canvas-pure)]",
    td: "h-[30px] px-3 text-[12.5px] text-[var(--integra-ink)] border-b border-[var(--integra-hairline)]",
    tdNum: "h-[30px] px-3 text-[12.5px] font-mono text-[var(--integra-ink)] text-right border-b border-[var(--integra-hairline)]",
    tdCode: "h-[30px] px-3 text-[12px] font-mono text-[var(--integra-ink)] border-b border-[var(--integra-hairline)]",
    tdPrimary: "h-[30px] px-3 text-[12.5px] font-medium text-[var(--integra-ink)] border-b border-[var(--integra-hairline)]",
    tdMuted: "h-[30px] px-3 text-[12.5px] text-[var(--integra-muted)] border-b border-[var(--integra-hairline)]",
    rowHover: "hover:bg-[#FBFAF5] transition-colors",
    rowTotal: "bg-[#FBFAF5] font-medium",

    // ───────── Form inputs ─────────
    input: "w-full h-[32px] px-2.5 text-[13px] bg-[var(--integra-canvas-pure)] text-[var(--integra-ink)] border border-[var(--integra-hairline)] rounded-[3px] outline-none focus:border-[var(--integra-liren-blue)] focus:ring-2 focus:ring-[var(--integra-liren-blue)]/30 placeholder:text-[var(--integra-muted)]",
    label: "text-[10.5px] font-semibold tracking-[0.12em] uppercase text-[var(--integra-muted)] block mb-1",
    select: "w-full h-[32px] px-2.5 text-[13px] bg-[var(--integra-canvas-pure)] text-[var(--integra-ink)] border border-[var(--integra-hairline)] rounded-[3px] outline-none focus:border-[var(--integra-liren-blue)]",

    // ───────── Util bar (used in dock utilization, progress) ─────────
    utilBarTrack: "h-1.5 bg-[#F1EFE8] rounded-[2px] overflow-hidden",
    utilBarFill: "h-full transition-all", // append color via JSX
} as const

export type IntegraToken = keyof typeof INT

// ─────────────────────────────────────────────────────────────────
// IDR formatting helpers (locked: thousands=., decimal=,)
// ─────────────────────────────────────────────────────────────────

const idrFormatter = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
})

const idrShortFormatter = new Intl.NumberFormat("id-ID", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
})

/** Format full IDR amount with thousands separator (id-ID). */
export function fmtIDR(n: number): string {
    return idrFormatter.format(Math.round(n))
}

/** Format IDR in jt (juta) — e.g. 4_281_600_000 → "4.281,6 jt" */
export function fmtIDRJt(n: number): string {
    if (Math.abs(n) >= 1_000_000_000) {
        return idrShortFormatter.format(n / 1_000_000_000) + " M"
    }
    if (Math.abs(n) >= 1_000_000) {
        return idrShortFormatter.format(n / 1_000_000) + " jt"
    }
    if (Math.abs(n) >= 1_000) {
        return idrShortFormatter.format(n / 1_000) + " rb"
    }
    return idrFormatter.format(n)
}

/** Format percentage (id-ID): 0.084 → "8,4%" */
export function fmtPct(n: number, decimals = 1): string {
    return new Intl.NumberFormat("id-ID", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    }).format(n * 100) + "%"
}

/** Date: 25/04 (in-table) */
export function fmtDateShort(d: Date): string {
    return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "2-digit" }).format(d)
}

/** Date+time: 25 Apr 14:32 WIB (sync time, audit log) */
export function fmtDateTime(d: Date): string {
    const date = new Intl.DateTimeFormat("id-ID", {
        day: "2-digit", month: "short", year: undefined,
    }).format(d)
    const time = new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(d)
    return `${date} ${time} WIB`
}
