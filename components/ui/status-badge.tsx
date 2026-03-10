import { cn } from "@/lib/utils"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

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

const statusMap: Record<StatusVariant, StatusConfig> = {
  draft: {
    label: "Draft",
    dotColor: "bg-zinc-400",
    bgColor: "bg-zinc-50 dark:bg-zinc-800",
    textColor: "text-zinc-600 dark:text-zinc-400",
    hint: "Belum dikirim",
  },
  pending: {
    label: "Menunggu",
    dotColor: "bg-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    textColor: "text-amber-700 dark:text-amber-400",
    hint: "Menunggu persetujuan",
  },
  in_progress: {
    label: "Diproses",
    dotColor: "bg-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    textColor: "text-blue-700 dark:text-blue-400",
    hint: "Sedang dikerjakan",
  },
  approved: {
    label: "Disetujui",
    dotColor: "bg-green-500",
    bgColor: "bg-green-50 dark:bg-green-950",
    textColor: "text-green-700 dark:text-green-400",
    hint: "Telah disetujui",
  },
  completed: {
    label: "Selesai",
    dotColor: "bg-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
    textColor: "text-emerald-700 dark:text-emerald-400",
    hint: "Proses selesai",
  },
  rejected: {
    label: "Ditolak",
    dotColor: "bg-red-500",
    bgColor: "bg-red-50 dark:bg-red-950",
    textColor: "text-red-700 dark:text-red-400",
    hint: "Ditolak, perlu revisi",
  },
  cancelled: {
    label: "Dibatalkan",
    dotColor: "bg-zinc-400",
    bgColor: "bg-zinc-100 dark:bg-zinc-800",
    textColor: "text-zinc-500 dark:text-zinc-400",
    hint: "Transaksi dibatalkan",
  },
  overdue: {
    label: "Terlambat",
    dotColor: "bg-red-500",
    bgColor: "bg-red-50 dark:bg-red-950",
    textColor: "text-red-700 dark:text-red-400",
    pulse: true,
    hint: "Sudah melewati tenggat waktu",
  },
  partial: {
    label: "Sebagian",
    dotColor: "bg-orange-400",
    bgColor: "bg-orange-50 dark:bg-orange-950",
    textColor: "text-orange-700 dark:text-orange-400",
    hint: "Terpenuhi sebagian",
  },
  paid: {
    label: "Lunas",
    dotColor: "bg-emerald-500",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
    textColor: "text-emerald-700 dark:text-emerald-400",
    hint: "Pembayaran lunas",
  },
  void: {
    label: "Void",
    dotColor: "bg-zinc-400",
    bgColor: "bg-zinc-100 dark:bg-zinc-800",
    textColor: "text-zinc-500 dark:text-zinc-400",
    hint: "Transaksi dibatalkan (void)",
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
        "inline-flex items-center gap-1.5 font-medium border",
        config.bgColor,
        config.textColor,
        "border-current/10",
        size === "sm"
          ? "px-1.5 py-0.5 text-[10px]"
          : "px-2 py-0.5 text-[11px]",
        className
      )}
      role="status"
      aria-label={`Status: ${displayLabel}`}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          config.dotColor,
          size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2",
          config.pulse && "animate-pulse"
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
        <TooltipContent
          side="top"
          className="rounded-none border-2 border-black bg-zinc-900 text-white text-xs px-2 py-1"
        >
          {displayHint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { statusMap, type StatusVariant, type StatusConfig }
