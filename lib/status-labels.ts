/**
 * One place that turns a database status (PARTIAL_RECEIVED, ISSUED, OVERDUE…) into the words an
 * admin says out loud ("Diterima sebagian", "Belum bayar", "Terlambat").
 *
 * Why: users are 40–60+ and read Bahasa Indonesia. A status must be a word, never an English
 * enum and never colour alone (WCAG 1.4.1; ui-ux-master skill, layer 8). Pages used to print
 * `status.replace(/_/g, " ")`, which showed "PARTIAL RECEIVED" and "VENDOR CONFIRMED".
 *
 * Context matters: on a bill or invoice "ISSUED" means *belum dibayar*, and "PARTIAL" means
 * *dibayar sebagian*. On a purchase order "PARTIAL" means part of the goods arrived.
 */

export type StatusTone = "draft" | "waiting" | "progress" | "done" | "late" | "stopped"

/** "default" for orders, requests and documents; "payment" for invoices and vendor bills. */
export type StatusContext = "default" | "payment"

interface StatusWord {
  label: string
  tone: StatusTone
}

const DEFAULT_WORDS: Record<string, StatusWord> = {
  DRAFT: { label: "Draf", tone: "draft" },
  PO_DRAFT: { label: "Draf", tone: "draft" },
  PR_CREATED: { label: "Permintaan dibuat", tone: "draft" },
  GAP_DETECTED: { label: "Stok kurang", tone: "waiting" },
  PENDING: { label: "Menunggu", tone: "waiting" },
  PENDING_APPROVAL: { label: "Menunggu persetujuan", tone: "waiting" },
  SUBMITTED: { label: "Diajukan", tone: "waiting" },
  APPROVED: { label: "Disetujui", tone: "done" },
  CONFIRMED: { label: "Dikonfirmasi", tone: "done" },
  ISSUED: { label: "Diterbitkan", tone: "progress" },
  SENT: { label: "Terkirim", tone: "progress" },
  ORDERED: { label: "Sudah dipesan", tone: "progress" },
  VENDOR_CONFIRMED: { label: "Dikonfirmasi vendor", tone: "progress" },
  IN_PRODUCTION: { label: "Diproduksi", tone: "progress" },
  IN_PROGRESS: { label: "Sedang dikerjakan", tone: "progress" },
  READY_TO_SHIP: { label: "Siap kirim", tone: "progress" },
  SHIPPED: { label: "Dalam perjalanan", tone: "progress" },
  PARTIAL_RECEIVED: { label: "Diterima sebagian", tone: "progress" },
  PARTIAL_ACCEPTED: { label: "Diterima sebagian", tone: "progress" },
  PARTIAL: { label: "Sebagian", tone: "progress" },
  RECEIVED: { label: "Diterima lengkap", tone: "done" },
  ACCEPTED: { label: "Diterima", tone: "done" },
  INSPECTING: { label: "Sedang diperiksa", tone: "waiting" },
  DELIVERED: { label: "Terkirim ke pelanggan", tone: "done" },
  INVOICED: { label: "Sudah ditagih", tone: "done" },
  PAID: { label: "Lunas", tone: "done" },
  COMPLETED: { label: "Selesai", tone: "done" },
  CLOSED: { label: "Ditutup", tone: "done" },
  POSTED: { label: "Diposting", tone: "done" },
  OVERDUE: { label: "Terlambat", tone: "late" },
  DISPUTED: { label: "Dipersoalkan", tone: "late" },
  ON_HOLD: { label: "Ditahan", tone: "waiting" },
  REJECTED: { label: "Ditolak", tone: "stopped" },
  CANCELLED: { label: "Dibatalkan", tone: "stopped" },
  VOID: { label: "Dibatalkan (void)", tone: "stopped" },
  PLANNED: { label: "Direncanakan", tone: "draft" },
  ACTIVE: { label: "Aktif", tone: "done" },
  INACTIVE: { label: "Nonaktif", tone: "stopped" },
}

const PAYMENT_WORDS: Record<string, StatusWord> = {
  ISSUED: { label: "Belum bayar", tone: "waiting" },
  SENT: { label: "Belum bayar", tone: "waiting" },
  UNPAID: { label: "Belum bayar", tone: "waiting" },
  PARTIAL: { label: "Dibayar sebagian", tone: "progress" },
  PARTIALLY_PAID: { label: "Dibayar sebagian", tone: "progress" },
  PAID: { label: "Lunas", tone: "done" },
  OVERDUE: { label: "Terlambat", tone: "late" },
  DUE_TODAY: { label: "Jatuh tempo hari ini", tone: "waiting" },
}

function normalize(status: string): string {
  return status.trim().toUpperCase().replace(/[\s-]+/g, "_")
}

/** Look up the Indonesian word for a status, or null when it is unknown. */
export function findStatusWord(
  status: string | null | undefined,
  context: StatusContext = "default",
): StatusWord | null {
  if (!status) return null
  const key = normalize(String(status))
  if (context === "payment" && PAYMENT_WORDS[key]) return PAYMENT_WORDS[key]
  return DEFAULT_WORDS[key] ?? null
}

/**
 * The word to show for a status. Unknown statuses fall back to sentence case without
 * underscores ("SOME_NEW_STATE" → "Some new state"), never a shouting enum.
 */
export function statusLabel(status: string | null | undefined, context: StatusContext = "default"): string {
  if (!status) return "—"
  const word = findStatusWord(status, context)
  if (word) return word.label
  const plain = String(status).replace(/_/g, " ").trim().toLowerCase()
  return plain.charAt(0).toUpperCase() + plain.slice(1)
}

/** The colour family for a status: draft (slate), waiting (amber), progress (blue), done (green), late/stopped (red). */
export function statusTone(status: string | null | undefined, context: StatusContext = "default"): StatusTone {
  return findStatusWord(status, context)?.tone ?? "draft"
}

/** Tailwind classes for the dot that sits next to the word (colour is the second signal, not the first). */
export const STATUS_DOT: Record<StatusTone, string> = {
  draft: "bg-slate-400",
  waiting: "bg-amber-500",
  progress: "bg-blue-600",
  done: "bg-emerald-600",
  late: "bg-red-600",
  stopped: "bg-slate-500",
}

/** Badge surface + text classes per tone (AA contrast: 800 text on 50 background). */
export const STATUS_BADGE: Record<StatusTone, string> = {
  draft: "bg-slate-50 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
  waiting: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
  progress: "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800",
  done: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
  late: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800",
  stopped: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
}
