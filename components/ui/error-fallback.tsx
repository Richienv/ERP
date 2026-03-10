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
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="w-full max-w-md border-2 border-black bg-white dark:bg-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] p-8">
        <div className="flex flex-col items-center text-center gap-4">
          <div className="flex items-center justify-center w-16 h-16 bg-red-50 dark:bg-red-950 border-2 border-red-200 dark:border-red-800">
            <IconAlertTriangle className="w-8 h-8 text-red-500" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Terjadi Kesalahan
            </h2>
            <p className="text-sm text-muted-foreground">
              {moduleName
                ? `Modul ${moduleName} mengalami masalah. Silakan coba lagi.`
                : "Halaman ini mengalami masalah. Silakan coba lagi."}
            </p>
          </div>

          <Button
            onClick={reset}
            className="rounded-none border-2 border-black bg-zinc-900 text-white hover:bg-zinc-800 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] font-semibold"
          >
            <IconRefresh className="w-4 h-4 mr-2" />
            Coba Lagi
          </Button>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showDetails ? (
              <>
                <IconChevronUp className="w-3 h-3" />
                Sembunyikan detail
              </>
            ) : (
              <>
                <IconChevronDown className="w-3 h-3" />
                Lihat detail error
              </>
            )}
          </button>

          {showDetails && (
            <div className="w-full text-left bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 p-3 overflow-auto max-h-40">
              <p className="text-xs font-mono text-red-600 dark:text-red-400 break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs font-mono text-muted-foreground mt-2">
                  Digest: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
