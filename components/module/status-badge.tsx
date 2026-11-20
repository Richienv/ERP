"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  STATUS_BADGE,
  STATUS_DOT,
  statusLabel,
  statusTone,
  type StatusContext,
  type StatusTone,
} from "@/lib/status-labels"

/** Older colour names some screens still pass; mapped onto the tone families below. */
type BadgeVariant =
  | "draft" | "pending" | "sent" | "approved" | "paid" | "overdue" | "cancelled"
  | "ordered" | "production" | "shipped" | "delivered" | "closed"

const VARIANT_TONE: Record<BadgeVariant, StatusTone> = {
  draft: "draft", pending: "waiting", sent: "progress", approved: "done", paid: "done",
  overdue: "late", cancelled: "stopped", ordered: "progress", production: "progress",
  shipped: "progress", delivered: "done", closed: "draft",
}

interface StatusBadgeProps {
  /** Database status, e.g. "PARTIAL_RECEIVED", "ISSUED", "OVERDUE". */
  status: string
  /** "payment" for invoices and vendor bills (ISSUED → "Belum bayar"). */
  context?: StatusContext
  /** Force a colour family when the status alone is not enough (e.g. an overdue ISSUED bill). */
  tone?: StatusTone
  /** Legacy colour name (kept for existing callers); `tone` wins when both are given. */
  variant?: BadgeVariant
  /** Extra words after the status, e.g. "12 hari" → "Terlambat · 12 hari". */
  detail?: string
  size?: "sm" | "md"
  className?: string
}

/**
 * A status is always a word plus a dot — never colour alone, never an English enum.
 * Labels come from lib/status-labels.ts so every screen says the same thing.
 */
export function StatusBadge({ status, context = "default", tone, variant, detail, size = "sm", className }: StatusBadgeProps) {
  const resolvedTone = tone ?? (variant ? VARIANT_TONE[variant] : statusTone(status, context))
  const label = statusLabel(status, context)

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border font-medium",
        size === "sm" ? "px-2.5 py-0.5 text-xs" : "px-3 py-1 text-sm",
        STATUS_BADGE[resolvedTone],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[resolvedTone])} aria-hidden />
      {label}
      {detail ? <span className="font-normal opacity-80">· {detail}</span> : null}
    </span>
  )
}

export type { StatusBadgeProps, BadgeVariant }
