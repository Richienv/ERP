import Link from "next/link"
import { IconInbox } from "@tabler/icons-react"
import type { Icon } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

interface EmptyStateProps {
  icon?: Icon
  title: string
  description?: string
  actionLabel?: string
  actionHref?: string
  onAction?: () => void
  className?: string
}

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
      className="rounded-none border-2 border-black bg-zinc-900 text-white hover:bg-zinc-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-semibold"
    >
      {actionHref ? <Link href={actionHref}>{actionLabel}</Link> : actionLabel}
    </Button>
  )

  return (
    <div className={`flex flex-col items-center justify-center py-16 px-4 ${className || ""}`}>
      <div className="flex items-center justify-center w-16 h-16 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-4">
        <IconComponent className="w-8 h-8 text-zinc-300 dark:text-zinc-600" />
      </div>
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
          {description}
        </p>
      )}
      {actionButton}
    </div>
  )
}
