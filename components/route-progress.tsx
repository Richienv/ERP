"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef, useCallback } from "react"

export function RouteProgress() {
  const pathname = usePathname()
  const barRef = useRef<HTMLDivElement>(null)
  const trickleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const progressRef = useRef(0)
  const isFirstMount = useRef(true)

  const clearTimers = useCallback(() => {
    if (trickleTimer.current) {
      clearTimeout(trickleTimer.current)
      trickleTimer.current = null
    }
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  const setProgress = useCallback((value: number) => {
    progressRef.current = value
    if (barRef.current) {
      barRef.current.style.transform = `scaleX(${value / 100})`
      barRef.current.style.opacity = value >= 100 ? "0" : "1"
    }
  }, [])

  const startTrickle = useCallback(() => {
    const trickle = () => {
      const current = progressRef.current
      if (current >= 80) return

      // Slow down as we approach 80%
      const step = current < 30 ? 8 : current < 50 ? 4 : current < 70 ? 2 : 0.5
      setProgress(Math.min(current + step, 80))

      trickleTimer.current = setTimeout(trickle, 150 + Math.random() * 100)
    }
    trickle()
  }, [setProgress])

  useEffect(() => {
    // Skip animation on first mount
    if (isFirstMount.current) {
      isFirstMount.current = false
      return
    }

    // Cancel any in-progress animation
    clearTimers()

    // Reset and start
    if (barRef.current) {
      barRef.current.style.transition = "none"
      setProgress(0)

      // Force reflow so the reset takes effect before we animate
      barRef.current.offsetHeight // eslint-disable-line @typescript-eslint/no-unused-expressions

      barRef.current.style.transition =
        "transform 300ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms ease 200ms"
    }

    // Start trickling toward 80%
    startTrickle()

    // Complete after a short delay (route has already changed when useEffect fires)
    const completeTimer = setTimeout(() => {
      clearTimers()
      setProgress(100)

      // Reset after fade out
      hideTimer.current = setTimeout(() => {
        if (barRef.current) {
          barRef.current.style.transition = "none"
          setProgress(0)
        }
      }, 600)
    }, 300)

    return () => {
      clearTimeout(completeTimer)
      clearTimers()
    }
  }, [pathname, clearTimers, setProgress, startTrickle])

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none"
      aria-hidden="true"
    >
      <div
        ref={barRef}
        className="h-full w-full origin-left bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.4)]"
        style={{
          transform: "scaleX(0)",
          opacity: 0,
          willChange: "transform, opacity",
        }}
      />
    </div>
  )
}
