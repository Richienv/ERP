"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Eye,
  Pencil,
  Send,
  Download,
  Trash2,
  CreditCard,
  Check,
  Printer,
} from "lucide-react"

type ActionIcon = "view" | "edit" | "send" | "download" | "delete" | "pay" | "approve" | "print"
type ActionVariant = "default" | "primary" | "danger"

interface ActionButton {
  icon: ActionIcon
  onClick: () => void
  tooltip?: string
  disabled?: boolean
  variant?: ActionVariant
  label?: string
}

interface ActionButtonGroupProps {
  actions: ActionButton[]
  size?: "sm" | "md"
  className?: string
}

const ICON_MAP: Record<ActionIcon, React.ElementType> = {
  view: Eye,
  edit: Pencil,
  send: Send,
  download: Download,
  delete: Trash2,
  pay: CreditCard,
  approve: Check,
  print: Printer,
}

const LABELED_VARIANT_STYLES: Record<ActionVariant, string> = {
  default:
    "bg-black text-white border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-y-[2px] active:shadow-none",
  primary:
    "bg-[#2E7D32] text-white border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-y-[2px] active:shadow-none",
  danger:
    "bg-red-600 text-white border-2 border-black shadow-[3px_3px_0px_0px_#000] hover:translate-y-[1px] hover:shadow-[2px_2px_0px_0px_#000] active:translate-y-[2px] active:shadow-none",
}

export function ActionButtonGroup({ actions, size = "sm", className }: ActionButtonGroupProps) {
  const iconSize = size === "sm" ? 14 : 16

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {actions.map((action, i) => {
        const Icon = ICON_MAP[action.icon]

        if (action.label) {
          return (
            <button
              key={i}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.tooltip}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                LABELED_VARIANT_STYLES[action.variant ?? "primary"],
                action.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
              )}
            >
              <Icon size={iconSize} />
              {action.label}
            </button>
          )
        }

        return (
          <button
            key={i}
            type="button"
            onClick={action.onClick}
            disabled={action.disabled}
            title={action.tooltip}
            className={cn(
              "flex items-center justify-center border border-gray-200 hover:border-black hover:bg-gray-50 transition-colors",
              size === "sm" ? "w-7 h-7" : "w-8 h-8",
              action.variant === "danger" && "hover:border-red-400 hover:bg-red-50 hover:text-red-600",
              action.disabled && "opacity-50 cursor-not-allowed pointer-events-none"
            )}
          >
            <Icon size={iconSize} />
          </button>
        )
      })}
    </div>
  )
}

export type { ActionButton, ActionButtonGroupProps, ActionIcon, ActionVariant }
