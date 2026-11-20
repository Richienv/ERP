/**
 * Integra Pro style constants (was Neo-Brutalist; values replaced 2026-11-21, keys unchanged)
 * Single source of truth for all UI components — dialogs, pages, toolbars.
 * Import as: import { NB } from "@/lib/dialog-styles"
 */

export const NB = {
  // Dialog container variants
  content: "max-w-3xl sm:max-w-3xl p-0 border border-border shadow-xl rounded-lg overflow-hidden gap-0",
  contentWide: "max-w-4xl sm:max-w-4xl p-0 border border-border shadow-xl rounded-lg overflow-hidden gap-0",
  contentNarrow: "max-w-xl sm:max-w-xl p-0 border border-border shadow-xl rounded-lg overflow-hidden gap-0",

  // Header: dark title bar (desktop-app familiar), white text, larger title
  header: "bg-slate-800 text-white px-5 py-3.5",
  title: "text-base font-semibold text-white flex items-center gap-2",
  subtitle: "text-slate-300 text-sm font-normal mt-0.5",

  // Scroll wrapper
  scroll: "max-h-[72vh]",

  // Section containers — aligned with reference (Catat Penerimaan Baru)
  section: "border border-border rounded-lg bg-white dark:bg-zinc-900 overflow-hidden",
  sectionHead: "bg-slate-50 dark:bg-zinc-800/50 px-3.5 py-2 border-b border-border flex items-center gap-2",
  sectionTitle: "text-sm font-semibold text-slate-700 dark:text-zinc-300",
  sectionHint: "text-sm font-normal text-slate-500 dark:text-zinc-400 ml-auto",
  sectionBody: "p-3.5 space-y-3",

  // Form elements
  label: "text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5 block",
  labelRequired: "text-red-500",
  labelHint: "text-xs font-normal text-slate-500 dark:text-zinc-400 mt-1 block",
  // Form inputs — aligned with reference (h-8, border-1, text-sm)
  input: "border font-normal h-10 text-sm rounded-md px-3 placeholder:text-slate-400 placeholder:font-normal transition-colors",
  inputMono: "border font-mono font-medium h-10 text-sm rounded-md px-3 placeholder:text-slate-400 placeholder:font-normal transition-colors tabular-nums",
  select: "h-10 text-sm rounded-md border transition-colors",
  textarea: "border text-sm rounded-md px-3 py-2 min-h-[72px] placeholder:text-slate-400 placeholder:font-normal transition-colors resize-none",

  // Buttons
  cancelBtn: "border border-slate-300 dark:border-zinc-600 text-slate-700 dark:text-zinc-300 font-medium text-sm px-5 h-10 rounded-md bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 transition-colors",
  submitBtn: "bg-slate-800 text-white font-semibold text-sm px-6 h-10 rounded-md shadow-sm hover:bg-slate-900 active:translate-y-px transition-colors",
  submitBtnGreen: "bg-emerald-600 text-white font-semibold text-sm px-6 h-10 rounded-md shadow-sm hover:bg-emerald-700 active:translate-y-px transition-colors",
  submitBtnOrange: "bg-blue-700 text-white font-semibold text-sm px-6 h-10 rounded-md shadow-sm hover:bg-blue-800 active:translate-y-px transition-colors",
  submitBtnBlue: "bg-blue-700 text-white font-semibold text-sm px-6 h-10 rounded-md shadow-sm hover:bg-blue-800 active:translate-y-px transition-colors",
  triggerBtn: "bg-blue-700 text-white font-semibold text-sm rounded-md shadow-sm hover:bg-blue-800 transition-colors",

  // Toggle / Switch
  toggle: "relative w-11 h-6 rounded-full border transition-colors cursor-pointer",
  toggleActive: "bg-blue-700 border-blue-700",
  toggleInactive: "bg-slate-200 dark:bg-zinc-700 border-slate-300 dark:border-zinc-600",
  toggleThumb: "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",

  // Error & feedback
  error: "text-sm text-red-600 font-medium mt-1",

  // Table styling (for item tables)
  tableWrap: "border border-border overflow-hidden rounded-lg",
  tableHead: "bg-slate-50 dark:bg-zinc-800 border-b border-border",
  tableHeadCell: "text-xs font-semibold text-slate-600 dark:text-zinc-400 px-3 py-2.5",
  tableRow: "border-b border-slate-100 dark:border-zinc-800 last:border-b-0",
  tableCell: "px-3 py-2.5 text-sm",

  // Footer actions row
  footer: "flex items-center justify-end gap-3 pt-2",

  // ─── Active Input Indicator ───
  // When an input/select/filter has a value, apply these to show "active" state.
  // Use conditionally: className={value ? NB.inputActive : NB.inputEmpty}
  inputActive: "border-blue-500 dark:border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 text-slate-900 dark:text-white",
  inputEmpty: "border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900",
  // Icon color when input has value vs empty
  inputIconActive: "text-blue-700",
  inputIconEmpty: "text-slate-500 dark:text-zinc-400",

  // ─── Page Header (Unified Card) ───
  // Outer wrapper: one card with accent bar, 3 internal rows
  pageCard: "relative border border-border rounded-lg shadow-sm overflow-hidden bg-white dark:bg-zinc-900",
  pageAccent: "hidden",
  // Row divider (internal rows share light borders, not heavy black)
  pageRowBorder: "border-b border-slate-100 dark:border-zinc-800",

  // ─── Page Toolbar Buttons ───
  // Secondary actions — joined with border-r-0 between adjacent buttons
  toolbarBtn: "border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 text-sm font-medium h-10 px-4 rounded-md bg-white hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors",
  toolbarBtnJoin: "border-r-0", // add to all except last in group
  // Primary CTA — orange, separated from secondary group by ml-2
  toolbarBtnPrimary: "bg-blue-700 text-white hover:bg-blue-800 font-semibold text-sm px-5 h-10 rounded-md shadow-sm transition-colors ml-2",

  // ─── Filter Toolbar ───
  // Joined search + dropdowns + action in one strip, all h-9
  filterBar: "px-5 py-3 flex items-center justify-between bg-slate-50/70 dark:bg-zinc-800/30",
  filterInput: "border font-normal h-10 text-sm rounded-md pl-9 pr-8 placeholder:text-slate-400 placeholder:font-normal focus:z-10 relative transition-all",
  filterDropdown: "flex items-center gap-2 border border-slate-300 dark:border-zinc-700 h-10 px-3 bg-white dark:bg-zinc-900 text-sm font-normal min-w-[130px] justify-between hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors rounded-md",

  // ─── KPI Strip ───
  // Horizontal cells: label left, count+amount right, divide-x between
  kpiStrip: "flex items-stretch divide-x divide-slate-100 dark:divide-zinc-800",
  kpiCell: "flex-1 px-5 py-4 flex items-center justify-between gap-3 cursor-default",
  kpiLabel: "text-sm font-medium text-slate-600 dark:text-zinc-400",
  kpiCount: "text-2xl font-semibold text-slate-900 dark:text-white tabular-nums",
  kpiAmount: "text-sm font-medium text-slate-500 dark:text-zinc-400 tabular-nums",
} as const
