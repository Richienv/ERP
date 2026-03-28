"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

/**
 * Reads a URL query param signal and returns a one-shot trigger.
 * Cleans the URL after detection so refresh won't re-trigger.
 *
 * Overloads:
 *   useActionSignal("new")              → triggers on ?new=true
 *   useActionSignal("action", "import") → triggers on ?action=import
 *
 * Usage:
 *   const { triggered, clear } = useActionSignal("new")
 *   // triggered is true once when ?new=true is in the URL
 *   // call clear() after opening the dialog to reset
 */
export function useActionSignal(key: string, expectedValue: string = "true") {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [triggered, setTriggered] = useState(false)

  useEffect(() => {
    const actual = searchParams.get(key)
    if (actual === expectedValue) {
      setTriggered(true)
      // Clean URL: remove the signal param without a full navigation
      const next = new URLSearchParams(searchParams.toString())
      next.delete(key)
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    }
  }, [searchParams, key, expectedValue, router, pathname])

  const clear = useCallback(() => setTriggered(false), [])

  return { triggered, clear }
}
