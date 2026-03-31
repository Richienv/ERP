/**
 * Neo-Brutalist Style Constants
 * Single source of truth for all UI components — dialogs, pages, toolbars.
 * Import as: import { NB } from "@/lib/dialog-styles"
 */

export const NB = {
  // Dialog container variants
  content: "max-w-3xl sm:max-w-3xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0",
  contentWide: "max-w-4xl sm:max-w-4xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0",
  contentNarrow: "max-w-xl sm:max-w-xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0",

  // Header (always black) — aligned with reference (Catat Penerimaan Baru)
  header: "bg-black text-white px-5 py-3",
  title: "text-sm font-black uppercase tracking-wider text-white flex items-center gap-2",
  subtitle: "text-zinc-400 text-[11px] font-bold mt-0.5",

  // Scroll wrapper
  scroll: "max-h-[72vh]",

  // Section containers — aligned with reference (Catat Penerimaan Baru)
  section: "border border-zinc-200 dark:border-zinc-700",
  sectionHead: "bg-zinc-50 dark:bg-zinc-800/50 px-3 py-1.5 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-2",
  sectionTitle: "text-[10px] font-black uppercase tracking-widest text-zinc-500",
  sectionHint: "text-[10px] font-medium text-zinc-400 dark:text-zinc-500 ml-auto",
  sectionBody: "p-3 space-y-3",

  // Form elements
  label: "text-[11px] font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-400 mb-1 block",
  labelRequired: "text-red-500",
  labelHint: "text-[10px] font-medium text-zinc-400 dark:text-zinc-500 mt-0.5 block",
  // Form inputs — aligned with reference (h-8, border-1, text-sm)
  input: "border font-medium h-8 text-sm rounded-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal transition-colors",
  inputMono: "border font-mono font-bold h-8 text-sm rounded-none placeholder:text-zinc-400 placeholder:italic placeholder:font-normal transition-colors",
  select: "h-8 text-sm rounded-none border transition-colors",
  textarea: "border text-sm rounded-none px-3 py-2 min-h-[60px] placeholder:text-zinc-400 placeholder:italic placeholder:font-normal transition-colors resize-none",

  // Buttons
  cancelBtn: "border border-zinc-300 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 font-bold uppercase text-xs tracking-wider px-6 h-9 rounded-none bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700",
  submitBtn: "bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider px-8 h-11 rounded-none",
  submitBtnGreen: "bg-emerald-500 text-white border-2 border-emerald-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-emerald-600 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider px-8 h-11 rounded-none",
  submitBtnOrange: "bg-orange-500 text-white border-2 border-orange-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-orange-600 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider px-8 h-11 rounded-none",
  submitBtnBlue: "bg-blue-500 text-white border-2 border-blue-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:bg-blue-600 hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-[4px] active:shadow-none transition-all font-black uppercase text-xs tracking-wider px-8 h-11 rounded-none",
  triggerBtn: "bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider rounded-none",

  // Toggle / Switch
  toggle: "relative w-11 h-6 rounded-none border-2 transition-colors cursor-pointer",
  toggleActive: "bg-emerald-500 border-emerald-600",
  toggleInactive: "bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600",
  toggleThumb: "absolute top-0.5 w-4 h-4 bg-white rounded-none shadow transition-transform",

  // Error & feedback
  error: "text-[10px] text-red-500 font-bold mt-0.5",

  // Table styling (for item tables)
  tableWrap: "border-2 border-black overflow-hidden rounded-none",
  tableHead: "bg-zinc-100 dark:bg-zinc-800 border-b-2 border-black",
  tableHeadCell: "text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2",
  tableRow: "border-b border-zinc-200 dark:border-zinc-700 last:border-b-0",
  tableCell: "px-3 py-2 text-sm font-medium",

  // Footer actions row
  footer: "flex items-center justify-end gap-3 pt-2",

  // ─── Active Input Indicator ───
  // When an input/select/filter has a value, apply these to show "active" state.
  // Use conditionally: className={value ? NB.inputActive : NB.inputEmpty}
  inputActive: "border-orange-400 dark:border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 text-zinc-900 dark:text-white",
  inputEmpty: "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900",
  // Icon color when input has value vs empty
  inputIconActive: "text-orange-500",
  inputIconEmpty: "text-zinc-500 dark:text-zinc-400",

  // ─── Page Header (Unified Card) ───
  // Outer wrapper: one card with accent bar, 3 internal rows
  pageCard: "border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden bg-white dark:bg-zinc-900",
  pageAccent: "h-1 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-500",
  // Row divider (internal rows share light borders, not heavy black)
  pageRowBorder: "border-b border-zinc-200 dark:border-zinc-800",

  // ─── Page Toolbar Buttons ───
  // Secondary actions — joined with border-r-0 between adjacent buttons
  toolbarBtn: "border border-zinc-300 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-wider h-9 px-3.5 rounded-none hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors",
  toolbarBtnJoin: "border-r-0", // add to all except last in group
  // Primary CTA — orange, separated from secondary group by ml-2
  toolbarBtnPrimary: "bg-orange-500 text-white border border-orange-600 hover:bg-orange-600 font-bold uppercase text-[10px] tracking-wider px-4 h-9 rounded-none transition-colors ml-2",

  // ─── Filter Toolbar ───
  // Joined search + dropdowns + action in one strip, all h-9
  filterBar: "px-5 py-2.5 flex items-center justify-between bg-zinc-50/80 dark:bg-zinc-800/30",
  filterInput: "border font-medium h-9 text-xs rounded-none pl-9 pr-8 placeholder:text-zinc-400 placeholder:font-normal focus:z-10 relative transition-all",
  filterDropdown: "flex items-center gap-2 border border-zinc-300 dark:border-zinc-700 border-r-0 h-9 px-3 bg-white dark:bg-zinc-900 text-xs font-medium min-w-[120px] justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors rounded-none",

  // ─── KPI Strip ───
  // Horizontal cells: label left, count+amount right, divide-x between
  kpiStrip: "flex items-center divide-x divide-zinc-200 dark:divide-zinc-800",
  kpiCell: "flex-1 px-4 py-3 flex items-center justify-between gap-3 cursor-default",
  kpiLabel: "text-[11px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400",
  kpiCount: "text-xl font-black text-zinc-900 dark:text-white",
  kpiAmount: "text-xs font-mono font-bold text-zinc-500 dark:text-zinc-400",
} as const
