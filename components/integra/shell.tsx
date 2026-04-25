"use client"

import * as React from "react"
import { IntegraSidebar } from "./sidebar"

/**
 * Top-level layout wrapper for ALL authenticated routes.
 * Provides the Integra sidebar (sticky, hairline) + main content area.
 * Pages render their own topbar (breadcrumb + action buttons) so
 * page-specific actions stay co-located with the page.
 *
 * Pages still using legacy NB styling will sit inside this shell — the
 * sidebar/topbar chrome is unified; page content keeps its own look until
 * migrated.
 */
export function IntegraShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="integra-app h-screen grid overflow-hidden"
            style={{ gridTemplateColumns: "240px 1fr" }}
        >
            <IntegraSidebar />
            <main className="min-w-0 overflow-auto bg-[var(--integra-canvas)]">
                {children}
            </main>
        </div>
    )
}
