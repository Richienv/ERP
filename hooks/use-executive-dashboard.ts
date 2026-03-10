"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export function useExecutiveDashboard() {
    return useQuery({
        queryKey: queryKeys.executiveDashboard.list(),
        queryFn: async () => {
            const [dashRes, mfgRes] = await Promise.all([
                fetch("/api/dashboard"),
                fetch("/api/manufacturing/dashboard").catch(() => null),
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
}
