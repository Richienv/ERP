"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

/** Themes in app/layout.tsx with a dark surface; everything else gets light toasts. */
const DARK_THEMES = new Set(["dark", "autumn", "earth"])

/*
 * Calm, large toasts for older eyes: bottom-right, 6 s, close button, 15 px title,
 * 14 px description, and status colours that pass WCAG AA (Tailwind 50/200/800 steps).
 * Sonner injects its own unlayered CSS, so class overrides below use Tailwind's "!".
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { resolvedTheme } = useTheme()
  const theme: ToasterProps["theme"] = resolvedTheme && DARK_THEMES.has(resolvedTheme) ? "dark" : "light"
  const isDark = theme === "dark"

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-right"
      duration={6000}
      richColors
      closeButton
      gap={12}
      containerAriaLabel="Notifikasi"
      icons={{
        success: <CircleCheckIcon className="size-5" />,
        info: <InfoIcon className="size-5" />,
        warning: <TriangleAlertIcon className="size-5" />,
        error: <OctagonXIcon className="size-5" />,
        loading: <Loader2Icon className="size-5 animate-spin" />,
        close: <XIcon className="size-4" />,
      }}
      toastOptions={{
        closeButtonAriaLabel: "Tutup notifikasi",
        style: { padding: "14px 44px 14px 16px", gap: "12px", alignItems: "flex-start" },
        classNames: {
          toast: "text-[15px]! leading-snug! shadow-lg!",
          title: "font-semibold! leading-snug!",
          description: "text-[14px]! leading-snug! mt-0.5 opacity-90",
          icon: "size-5! mt-px",
          content: "min-w-0",
          // Close button sits inside the toast, top right, large enough to hit
          closeButton:
            "size-7! top-2.5! border-0! bg-transparent! opacity-70 hover:opacity-100 hover:bg-black/5! dark:hover:bg-white/10!",
          actionButton:
            "h-8! rounded-md! px-3! text-[14px]! font-semibold! bg-primary! text-primary-foreground! self-center",
          cancelButton: "h-8! rounded-md! px-3! text-[14px]! font-medium! self-center",
        },
      }}
      style={
        {
          "--width": "400px",
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          // Close button inside the card on the right instead of hanging off the top-left corner
          "--toast-close-button-start": "unset",
          "--toast-close-button-end": "8px",
          "--toast-close-button-transform": "none",
          // Status colours (AA contrast): green done, red error, amber attention, blue information
          "--success-bg": isDark ? "#052e16" : "#f0fdf4",
          "--success-border": isDark ? "#166534" : "#bbf7d0",
          "--success-text": isDark ? "#bbf7d0" : "#166534",
          "--error-bg": isDark ? "#450a0a" : "#fef2f2",
          "--error-border": isDark ? "#991b1b" : "#fecaca",
          "--error-text": isDark ? "#fecaca" : "#991b1b",
          "--warning-bg": isDark ? "#451a03" : "#fffbeb",
          "--warning-border": isDark ? "#92400e" : "#fde68a",
          "--warning-text": isDark ? "#fde68a" : "#92400e",
          "--info-bg": isDark ? "#172554" : "#eff6ff",
          "--info-border": isDark ? "#1e40af" : "#bfdbfe",
          "--info-text": isDark ? "#bfdbfe" : "#1e40af",
          fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
