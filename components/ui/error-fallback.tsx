"use client"

import { useState } from "react"
import { IconAlertTriangle, IconChevronDown, IconChevronUp, IconRefresh } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

interface ErrorFallbackProps {
  error: Error & { digest?: string }
  reset: () => void
  moduleName?: string
}

export function ErrorFallback({ error, reset, moduleName }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="flex flex-1 items-center justify-center p-4 md:p-8">
      <div
        role="alert"
        className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm md:p-8"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-amber-50 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:ring-amber-800">
            <IconAlertTriangle aria-hidden className="size-7 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              {moduleName ? `Halaman ${moduleName} belum bisa dibuka` : "Halaman ini belum bisa dibuka"}
            </h2>
            <p className="text-[15px] leading-relaxed text-muted-foreground">
              Ada gangguan saat memuat halaman ini.
              Silakan tekan tombol di bawah untuk mencoba lagi.
            </p>
          </div>

          <Button onClick={reset} size="lg" className="h-11 min-w-40 px-6 text-[15px] font-semibold">
            <IconRefresh aria-hidden className="size-[18px]" />
            Coba lagi
          </Button>

          <p className="text-sm text-muted-foreground">
            Jika masih gagal, hubungi admin dan tunjukkan detail di bawah ini.
          </p>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            aria-expanded={showDetails}
            className="flex items-center gap-1 rounded-sm text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            {showDetails ? (
              <>
                <IconChevronUp aria-hidden className="size-4" />
                Sembunyikan detail
              </>
            ) : (
              <>
                <IconChevronDown aria-hidden className="size-4" />
                Lihat detail untuk admin
              </>
            )}
          </button>

          {showDetails && (
            <div className="max-h-40 w-full overflow-auto rounded-md border border-border bg-muted/60 p-3 text-left">
              <p className="break-all font-mono text-xs text-red-700 dark:text-red-400">
                {error.message}
              </p>
              {error.digest && (
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                  Kode: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
