import { DashboardPageClient } from "./dashboard-client"

export const dynamic = "force-dynamic"

/**
 * Dashboard page — renders instantly, client handles data loading.
 *
 * Three-layer cache strategy:
 * 1. IndexedDB (returning users) → instant render (<200ms)
 * 2. API fetch /api/dashboard (new users) → skeleton → data (<2s)
 * 3. Background revalidation keeps data fresh silently
 *
 * Previously, this page awaited 5 server actions (20+ DB queries) in a blocking
 * server prefetch, causing 3-5s loading.tsx even for returning users with
 * IndexedDB cache. Removing the blocking prefetch lets IndexedDB shine.
 */
export default function DashboardPage() {
    return <DashboardPageClient />
}
