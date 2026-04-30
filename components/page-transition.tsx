"use client"

import { usePathname } from "next/navigation"
import { type ReactNode } from "react"

/**
 * Page transition — CSS-only fade-in (was framer-motion, removed for perf).
 * key={pathname} retriggers the animation on route change.
 *
 * The fade-in keyframe is defined in app/globals.css as `pageFadeIn`.
 */
export function PageTransition({ children }: { children: ReactNode }) {
    const pathname = usePathname()

    return (
        <div
            key={pathname}
            className="flex-1 flex flex-col page-fade-in"
        >
            {children}
        </div>
    )
}
