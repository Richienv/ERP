"use client"

import { useBackgroundRefresh } from "@/hooks/use-background-refresh"

/**
 * Invisible component that handles background data freshness.
 * Renders nothing — purely a hook mount point for global-layout.
 */
export function BackgroundRefresh() {
    useBackgroundRefresh()
    return null
}
