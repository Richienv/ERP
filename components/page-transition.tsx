"use client"

import { type ReactNode } from "react"

/** Instant paint — no fade, no popLayout jump. */
export function PageTransition({ children }: { children: ReactNode }) {
    return <div className="flex-1 flex flex-col">{children}</div>
}
