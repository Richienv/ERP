import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

/*
 * Status in words, never colour alone: every badge is a dot + an Indonesian word.
 * Colour families (Integra Pro):
 *   green  = done        (approved, completed, paid)
 *   amber  = attention   (pending)
 *   red    = late/error  (rejected, overdue)
 *   blue   = in progress (in_progress, partial)
 *   slate  = draft/neutral (draft, cancelled, void)
 * Text uses the 800 step on the 50 step background: WCAG AA at text-xs and up.
 */

type StatusVariant =
  | "draft"
  | "pending"
  | "in_progress"
  | "approved"
  | "completed"
  | "rejected"
  | "cancelled"
  | "overdue"
  | "partial"
  | "paid"
  | "void"

interface StatusConfig {
  label: string
  dotColor: string
  bgColor: string
  textColor: string
  pulse?: boolean
  hint?: string
}

const TONE = {
  green: {
    dotColor: "bg-emerald-600",
    bgColor: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/60 dark:border-emerald-800",
    textColor: "text-emerald-800 dark:text-emerald-300",
  },
  amber: {
    dotColor: "bg-amber-500",
    bgColor: "bg-amber-50 border-amber-200 dark:bg-amber-950/60 dark:border-amber-800",
    textColor: "text-amber-800 dark:text-amber-300",
  },
  red: {
    dotColor: "bg-red-600",
    bgColor: "bg-red-50 border-red-200 dark:bg-red-950/60 dark:border-red-800",
    textColor: "text-red-800 dark:text-red-300",
  },
  blue: {
    dotColor: "bg-blue-600",
    bgColor: "bg-blue-50 border-blue-200 dark:bg-blue-950/60 dark:border-blue-800",
    textColor: "text-blue-800 dark:text-blue-300",
  },
  slate: {
    dotColor: "bg-slate-400",
    bgColor: "bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-700",
    textColor: "text-slate-700 dark:text-zinc-300",
  },
} as const

const statusMap: Record<StatusVariant, StatusConfig> = {
  draft: {
    label: "Draf",
    ...TONE.slate,
    hint: "Belum dikirim",
  },
  pending: {
    label: "Menunggu",
    ...TONE.amber,
    hint: "Menunggu persetujuan",
  },
  in_progress: {
    label: "Diproses",
    ...TONE.blue,
    hint: "Sedang dikerjakan",
  },
  approved: {
    label: "Disetujui",
    ...TONE.green,
    hint: "Telah disetujui",
  },
  completed: {
    label: "Selesai",
    ...TONE.green,
    hint: "Proses selesai",
  },
  rejected: {
    label: "Ditolak",
    ...TONE.red,
    hint: "Ditolak, perlu revisi",
  },
  cancelled: {
    label: "Dibatalkan",
    ...TONE.slate,
    hint: "Transaksi dibatalkan",
  },
  overdue: {
    label: "Terlambat",
    ...TONE.red,
    pulse: true,
    hint: "Sudah melewati jatuh tempo",
  },
  partial: {
    label: "Sebagian",
    ...TONE.blue,
    hint: "Terpenuhi sebagian",
  },
  paid: {
    label: "Lunas",
    ...TONE.green,
    hint: "Pembayaran lunas",
  },
  void: {
    label: "Batal (void)",
    ...TONE.slate,
    hint: "Dokumen di-void, tidak berlaku lagi",
  },
}

interface StatusBadgeProps {
  /** Use a predefined status variant */
  status?: StatusVariant
  /** Override the display label */
  label?: string
  /** Override the tooltip hint */
  hint?: string
  /** Custom color config for module-specific statuses */
  customConfig?: Partial<StatusConfig>
  /** Additional className */
  className?: string
  /** Size variant */
  size?: "sm" | "default"
}

export function StatusBadge({
  status = "draft",
  label: labelOverride,
  hint: hintOverride,
  customConfig,
  className,
  size = "default",
}: StatusBadgeProps) {
  const config = { ...statusMap[status], ...customConfig }
  const displayLabel = labelOverride || config.label
  const displayHint = hintOverride || config.hint

  const badge = (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border font-medium leading-none",
        config.bgColor,
        config.textColor,
        size === "sm"
          ? "px-2 py-1 text-xs"
          : "px-2.5 py-1 text-[13.5px]",
        className
      )}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      <span
        aria-hidden
        className={cn(
          "rounded-full shrink-0",
          config.dotColor,
          size === "sm" ? "size-1.5" : "size-2",
          config.pulse && "animate-pulse motion-reduce:animate-none"
        )}
      />
      {displayLabel}
    </span>
  )

  if (!displayHint) return badge

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent side="top" className="text-sm">
          {displayHint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { statusMap, type StatusVariant, type StatusConfig }
