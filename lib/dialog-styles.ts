/**
 * Neo-Brutalist Dialog Style Constants
 * Single source of truth for all create/edit dialog components.
 * Import as: import { NB } from "@/lib/dialog-styles"
 */

export const NB = {
  // Dialog container variants
  content: "max-w-3xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0",
  contentWide: "max-w-4xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0",
  contentNarrow: "max-w-xl p-0 border-2 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] rounded-none overflow-hidden gap-0",

  // Header (always black)
  header: "bg-black text-white px-6 py-4",
  title: "text-lg font-black uppercase tracking-wider text-white flex items-center gap-2",
  subtitle: "text-zinc-400 text-[11px] font-bold mt-0.5",

  // Scroll wrapper
  scroll: "max-h-[72vh]",

  // Section containers
  section: "border-2 border-black",
  sectionHead: "bg-zinc-100 px-4 py-2 border-b-2 border-black flex items-center gap-2",
  sectionTitle: "text-xs font-black uppercase tracking-widest",
  sectionBody: "p-4 space-y-4",

  // Form elements
  label: "text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1 block",
  labelRequired: "text-red-500",
  input: "border-2 border-black font-bold h-10 rounded-none",
  inputMono: "border-2 border-black font-mono font-bold h-10 rounded-none",
  select: "border-2 border-black font-bold h-10 w-full rounded-none",
  textarea: "border-2 border-black font-medium min-h-[60px] rounded-none",

  // Buttons
  cancelBtn: "border-2 border-black font-black uppercase text-xs tracking-wider px-6 h-9 rounded-none bg-white hover:bg-zinc-100",
  submitBtn: "bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider px-8 h-9 rounded-none",
  triggerBtn: "bg-black text-white border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all font-black uppercase text-xs tracking-wider rounded-none",

  // Error & feedback
  error: "text-[10px] text-red-500 font-bold mt-0.5",

  // Table styling (for item tables)
  tableWrap: "border-2 border-black overflow-hidden rounded-none",
  tableHead: "bg-zinc-100 border-b-2 border-black",
  tableHeadCell: "text-[10px] font-black uppercase tracking-widest text-zinc-500 px-3 py-2",
  tableRow: "border-b border-zinc-200 last:border-b-0",
  tableCell: "px-3 py-2 text-sm font-medium",

  // Footer actions row
  footer: "flex items-center justify-end gap-3 pt-2",
} as const
