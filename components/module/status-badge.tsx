"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type BadgeVariant =
  | "draft"
  | "pending"
  | "sent"
  | "approved"
  | "paid"
  | "overdue"
  | "cancelled"
  | "ordered"
  | "production"
  | "shipped"
  | "delivered"
  | "closed"

interface StatusBadgeProps {
  status: string
  variant?: BadgeVariant
  size?: "sm" | "md"
  className?: string
}

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  DRAFT:            { label: "DRAFT",        variant: "draft" },
  PO_DRAFT:         { label: "DRAFT",        variant: "draft" },
  PENDING:          { label: "PENDING",      variant: "pending" },
  PENDING_APPROVAL: { label: "MENUNGGU",     variant: "pending" },
  SUBMITTED:        { label: "DIAJUKAN",     variant: "pending" },
  APPROVED:         { label: "DISETUJUI",    variant: "approved" },
  CONFIRMED:        { label: "DIKONFIRMASI", variant: "approved" },
  TERKIRIM:         { label: "TERKIRIM",     variant: "sent" },
  ISSUED:           { label: "ISSUED",       variant: "sent" },
  SENT:             { label: "DIKIRIM",      variant: "sent" },
  ORDERED:          { label: "ORDERED",      variant: "ordered" },
  VENDOR_CONFIRMED: { label: "VENDOR OK",    variant: "ordered" },
  IN_PRODUCTION:    { label: "PRODUKSI",     variant: "production" },
  IN_PROGRESS:      { label: "PROSES",       variant: "production" },
  READY_TO_SHIP:    { label: "SIAP KIRIM",   variant: "ordered" },
  SHIPPED:          { label: "DIKIRIM",      variant: "shipped" },
  DELIVERED:        { label: "DITERIMA",     variant: "delivered" },
  RECEIVED:         { label: "DITERIMA",     variant: "delivered" },
  PARTIAL_RECEIVED: { label: "SEBAGIAN",     variant: "shipped" },
  PARTIAL:          { label: "SEBAGIAN",     variant: "shipped" },
  LUNAS:            { label: "LUNAS",        variant: "paid" },
  PAID:             { label: "LUNAS",        variant: "paid" },
  COMPLETED:        { label: "SELESAI",      variant: "closed" },
  CLOSED:           { label: "SELESAI",      variant: "closed" },
  JATUH_TEMPO:      { label: "JATUH TEMPO",  variant: "overdue" },
  OVERDUE:          { label: "JATUH TEMPO",  variant: "overdue" },
  CANCELLED:        { label: "DIBATALKAN",   variant: "cancelled" },
  REJECTED:         { label: "DITOLAK",      variant: "cancelled" },
  VOID:             { label: "VOID",         variant: "cancelled" },
  DISPUTED:         { label: "SENGKETA",     variant: "overdue" },
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  draft:      "bg-zinc-100 text-zinc-700 border-zinc-300",
  pending:    "bg-amber-100 text-amber-700 border-amber-300",
  sent:       "bg-zinc-100 text-zinc-700 border-zinc-300",
  approved:   "bg-emerald-100 text-emerald-700 border-emerald-300",
  ordered:    "bg-zinc-100 text-zinc-700 border-zinc-300",
  paid:       "bg-emerald-100 text-emerald-800 border-emerald-400",
  overdue:    "bg-red-100 text-red-700 border-red-300",
  cancelled:  "bg-red-100 text-red-700 border-red-300",
  production: "bg-zinc-100 text-zinc-700 border-zinc-300",
  shipped:    "bg-zinc-100 text-zinc-700 border-zinc-300",
  delivered:  "bg-emerald-100 text-emerald-700 border-emerald-300",
  closed:     "bg-zinc-200 text-zinc-600 border-zinc-400",
}

export function StatusBadge({ status, variant, size = "sm", className }: StatusBadgeProps) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_")
  const mapped = STATUS_MAP[normalized]
  const resolvedVariant = variant ?? mapped?.variant ?? "draft"
  const label = mapped?.label ?? status

  return (
    <span
      className={cn(
        "inline-flex items-center border font-bold uppercase",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-xs px-2.5 py-1",
        VARIANT_STYLES[resolvedVariant],
        className
      )}
    >
      {label}
    </span>
  )
}

export { STATUS_MAP, VARIANT_STYLES }
export type { BadgeVariant, StatusBadgeProps }
