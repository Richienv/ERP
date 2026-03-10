"use client"

import { useEffect, useRef } from "react"

const WARNING_MESSAGE = "Anda memiliki perubahan yang belum disimpan. Yakin ingin keluar?"

/**
 * Hook to warn users before leaving a page with unsaved changes.
 *
 * Usage with React Hook Form:
 *   const form = useForm()
 *   useUnsavedChanges(form.formState.isDirty)
 *
 * Usage with manual state:
 *   const [isDirty, setIsDirty] = useState(false)
 *   useUnsavedChanges(isDirty)
 */
export function useUnsavedChanges(isDirty: boolean) {
  const isDirtyRef = useRef(isDirty)

  // Keep ref in sync
  useEffect(() => {
    isDirtyRef.current = isDirty
  }, [isDirty])

  // Browser/tab close warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return
      e.preventDefault()
      // Modern browsers show their own message, but returnValue is still needed
      e.returnValue = WARNING_MESSAGE
      return WARNING_MESSAGE
    }

    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [])

  // In-app navigation warning (clicking links, back button)
  useEffect(() => {
    if (!isDirty) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest("a[href]") as HTMLAnchorElement | null
      if (!anchor) return

      // Only intercept internal links
      const href = anchor.getAttribute("href")
      if (!href || href.startsWith("http") || href.startsWith("mailto") || href === "#") return

      // Check if it's a real navigation (not just a hash change)
      if (href === window.location.pathname) return

      if (!isDirtyRef.current) return

      const confirmed = window.confirm(WARNING_MESSAGE)
      if (!confirmed) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    // Use capture phase to intercept before React handles it
    document.addEventListener("click", handleClick, true)
    return () => document.removeEventListener("click", handleClick, true)
  }, [isDirty])

  // Browser back/forward button warning
  useEffect(() => {
    if (!isDirty) return

    const handlePopState = () => {
      if (!isDirtyRef.current) return

      const confirmed = window.confirm(WARNING_MESSAGE)
      if (!confirmed) {
        // Push state back to prevent navigation
        window.history.pushState(null, "", window.location.href)
      }
    }

    // Push a state so we can catch back button
    window.history.pushState(null, "", window.location.href)
    window.addEventListener("popstate", handlePopState)
    return () => window.removeEventListener("popstate", handlePopState)
  }, [isDirty])
}
