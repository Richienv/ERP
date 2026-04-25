"use client"

import * as React from "react"
import { IntegraSidebar } from "./sidebar"

/**
 * Top-level layout wrapper for Integra-styled routes.
 * Replaces the NB SidebarProvider chain. Provides only the sidebar —
 * each page renders its own topbar (breadcrumb + action buttons) so
 * page-specific actions stay co-located with the page.
 *
 * Routes opt in via INTEGRA_ROUTE_PREFIXES in lib/integra-routes.ts.
 */
export function IntegraShell({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="integra-app min-h-screen grid"
            style={{ gridTemplateColumns: "240px 1fr" }}
        >
            <IntegraSidebar />
            <main className="min-w-0 flex flex-col bg-[var(--integra-canvas)]">
                {children}
            </main>
        </div>
    )
}
