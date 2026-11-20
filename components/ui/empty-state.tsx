import Link from "next/link"
import { IconInbox } from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: Icon
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}

/** Calm "nothing here yet" panel: one icon, one sentence, at most one obvious button. */
export function EmptyState({
  icon: IconComponent = IconInbox,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  className,
}: EmptyStateProps) {
  const actionButton = actionLabel && (
    <Button
      onClick={onAction}
      asChild={!!actionHref}
      size="lg"
      className="mt-6 h-11 min-w-40 px-6 text-[15px] font-semibold"
    >
      {actionHref ? <Link href={actionHref}>{actionLabel}</Link> : actionLabel}
    </Button>
  )

  return (
    <div className={cn("flex flex-col items-center justify-center px-4 py-14 text-center", className)}>
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200 dark:bg-zinc-800 dark:ring-zinc-700">
        <IconComponent aria-hidden className="size-7 text-slate-500 dark:text-zinc-400" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {actionButton}
    </div>
  )
}
