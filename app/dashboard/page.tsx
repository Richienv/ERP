import { DashboardIntegra } from "./dashboard-integra"

export const dynamic = "force-dynamic"

/**
 * Dashboard page — Integra design (Bloomberg-lite corporate).
 *
 * Migrated from <DashboardPageClient /> (NB style) to <DashboardIntegra />
 * Apr 25, 2026. Old dashboard-client.tsx kept for reference / fallback.
 */
export default function DashboardPage() {
    return <DashboardIntegra />
}
