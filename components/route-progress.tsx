"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef } from "react"

import { isModifiedClick, resolveInternalNavHref } from "@/lib/route-progress"

/**
 * SAP-style route bar: starts on pointerdown of an in-app link (felt instant),
 * completes when the pathname actually changes. First paint stays quiet.
 */
export function RouteProgress() {
    const pathname = usePathname()
    const barRef = useRef<HTMLDivElement>(null)
    const trickleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
    const progressRef = useRef(0)
    const startedRef = useRef(false)
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
            barRef.current.style.opacity = value >= 100 || value <= 0 ? "0" : "1"
        }
    }, [])

    const startTrickle = useCallback(() => {
        const trickle = () => {
            const current = progressRef.current
            if (current >= 80) return
            const step = current < 30 ? 10 : current < 50 ? 5 : current < 70 ? 2 : 0.6
            setProgress(Math.min(current + step, 80))
            trickleTimer.current = setTimeout(trickle, 120)
        }
        trickle()
    }, [setProgress])

    const start = useCallback(() => {
        if (startedRef.current) return
        startedRef.current = true
        clearTimers()

        if (barRef.current) {
            barRef.current.style.transition = "none"
            setProgress(0)
            barRef.current.offsetHeight // eslint-disable-line @typescript-eslint/no-unused-expressions
            barRef.current.style.transition =
                "transform 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 220ms ease"
        }
        setProgress(14)
        startTrickle()
    }, [clearTimers, setProgress, startTrickle])

    const complete = useCallback(() => {
        if (!startedRef.current) {
            start()
        }
        clearTimers()
        if (barRef.current) {
            barRef.current.style.transition =
                "transform 160ms cubic-bezier(0.4, 0, 0.2, 1), opacity 200ms ease 80ms"
        }
        setProgress(100)
        hideTimer.current = setTimeout(() => {
            if (barRef.current) {
                barRef.current.style.transition = "none"
                setProgress(0)
            }
            startedRef.current = false
        }, 280)
    }, [clearTimers, setProgress, start])

    useEffect(() => {
        const onPointerDown = (event: PointerEvent) => {
            if (isModifiedClick(event)) return
            const next = resolveInternalNavHref(
                event.target,
                pathname,
                window.location.origin,
                window.location.search,
            )
            if (next) start()
        }

        document.addEventListener("pointerdown", onPointerDown, true)
        return () => document.removeEventListener("pointerdown", onPointerDown, true)
    }, [pathname, start])

    const completeRef = useRef(complete)
    completeRef.current = complete

    useEffect(() => {
        if (isFirstMount.current) {
            isFirstMount.current = false
            return
        }
        completeRef.current()
        return () => {
            clearTimers()
        }
    }, [pathname, clearTimers])

    return (
        <div
            className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
            aria-hidden="true"
        >
            <div
                ref={barRef}
                className="h-full w-full origin-left bg-orange-500"
                style={{
                    transform: "scaleX(0)",
                    opacity: 0,
                    willChange: "transform, opacity",
                }}
            />
        </div>
    )
}
