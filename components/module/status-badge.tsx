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
  DRAFT:            { label: "Draf",                variant: "draft" },
  PO_DRAFT:         { label: "Draf",                variant: "draft" },
  PENDING:          { label: "Menunggu",            variant: "pending" },
  PENDING_APPROVAL: { label: "Menunggu persetujuan", variant: "pending" },
  SUBMITTED:        { label: "Diajukan",            variant: "pending" },
  APPROVED:         { label: "Disetujui",           variant: "approved" },
  CONFIRMED:        { label: "Dikonfirmasi",        variant: "approved" },
  TERKIRIM:         { label: "Terkirim",            variant: "sent" },
  ISSUED:           { label: "Diterbitkan",         variant: "sent" },
  SENT:             { label: "Dikirim",             variant: "sent" },
  ORDERED:          { label: "Dipesan",             variant: "ordered" },
  VENDOR_CONFIRMED: { label: "Dikonfirmasi vendor", variant: "ordered" },
  IN_PRODUCTION:    { label: "Produksi",            variant: "production" },
  IN_PROGRESS:      { label: "Diproses",            variant: "production" },
  READY_TO_SHIP:    { label: "Siap kirim",          variant: "ordered" },
  SHIPPED:          { label: "Dalam perjalanan",    variant: "shipped" },
  DELIVERED:        { label: "Diterima",            variant: "delivered" },
  RECEIVED:         { label: "Diterima",            variant: "delivered" },
  PARTIAL_RECEIVED: { label: "Diterima sebagian",   variant: "shipped" },
  PARTIAL:          { label: "Sebagian",            variant: "shipped" },
  LUNAS:            { label: "Lunas",               variant: "paid" },
  PAID:             { label: "Lunas",               variant: "paid" },
  COMPLETED:        { label: "Selesai",             variant: "closed" },
  CLOSED:           { label: "Selesai",             variant: "closed" },
  JATUH_TEMPO:      { label: "Jatuh tempo",         variant: "overdue" },
  OVERDUE:          { label: "Terlambat",           variant: "overdue" },
  CANCELLED:        { label: "Dibatalkan",          variant: "cancelled" },
  REJECTED:         { label: "Ditolak",             variant: "cancelled" },
  VOID:             { label: "Batal (void)",        variant: "cancelled" },
  DISPUTED:         { label: "Sengketa",            variant: "overdue" },
}

// Status is always a word plus a dot — never colour alone. Blue = in progress, amber = needs
// attention, green = done, red = late or stopped, slate = draft / closed.
const VARIANT_STYLES: Record<BadgeVariant, string> = {
  draft:      "bg-slate-50 text-slate-700 border-slate-200",
  pending:    "bg-amber-50 text-amber-800 border-amber-200",
  sent:       "bg-blue-50 text-blue-800 border-blue-200",
  approved:   "bg-emerald-50 text-emerald-800 border-emerald-200",
  ordered:    "bg-blue-50 text-blue-800 border-blue-200",
  paid:       "bg-emerald-50 text-emerald-800 border-emerald-200",
  overdue:    "bg-red-50 text-red-800 border-red-200",
  cancelled:  "bg-red-50 text-red-700 border-red-200",
  production: "bg-blue-50 text-blue-800 border-blue-200",
  shipped:    "bg-sky-50 text-sky-800 border-sky-200",
  delivered:  "bg-emerald-50 text-emerald-800 border-emerald-200",
  closed:     "bg-slate-100 text-slate-600 border-slate-200",
}

const DOT: Record<BadgeVariant, string> = {
  draft: "bg-slate-400", pending: "bg-amber-500", sent: "bg-blue-600", approved: "bg-emerald-600",
  ordered: "bg-blue-600", paid: "bg-emerald-600", overdue: "bg-red-600", cancelled: "bg-red-500",
  production: "bg-blue-600", shipped: "bg-sky-500", delivered: "bg-emerald-600", closed: "bg-slate-400",
}

export function StatusBadge({ status, variant, size = "sm", className }: StatusBadgeProps) {
  const normalized = status.toUpperCase().replace(/\s+/g, "_")
  const mapped = STATUS_MAP[normalized]
  const resolvedVariant = variant ?? mapped?.variant ?? "draft"
  const label = mapped?.label ?? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase().replace(/_/g, " ")

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        size === "sm" ? "text-xs px-2.5 py-0.5" : "text-sm px-3 py-1",
        VARIANT_STYLES[resolvedVariant],
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[resolvedVariant])} aria-hidden />
      {label}
    </span>
  )
}

export { STATUS_MAP, VARIANT_STYLES }
export type { BadgeVariant, StatusBadgeProps }
