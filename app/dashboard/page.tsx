import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { cookies } from "next/headers"
import { DashboardPageClient } from "./dashboard-client"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
    const queryClient = new QueryClient()
    const cookieStore = await cookies()
    const cookieHeader = cookieStore.getAll().map(c => `${c.name}=${c.value}`).join("; ")
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"

    await queryClient.prefetchQuery({
        queryKey: queryKeys.executiveDashboard.list(),
        queryFn: async () => {
            const [dashRes, mfgRes] = await Promise.all([
                fetch(`${baseUrl}/api/dashboard`, { headers: { Cookie: cookieHeader } }),
                fetch(`${baseUrl}/api/manufacturing/dashboard`, { headers: { Cookie: cookieHeader } }).catch(() => null),
            ])

            if (!dashRes.ok) throw new Error("Failed to fetch dashboard data")
            const dashData = await dashRes.json()

            let mfgData = null
            if (mfgRes?.ok) {
                const mfgJson = await mfgRes.json()
                mfgData = mfgJson?.data ?? null
            }

            return { ...dashData, manufacturing: mfgData }
        },
    })

    return (
        <HydrationBoundary state={dehydrate(queryClient)}>
            <DashboardPageClient />
        </HydrationBoundary>
    )
}
