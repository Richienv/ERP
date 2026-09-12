"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

export async function fetchAttendancePage() {
    const res = await fetch("/api/hcm/attendance-full")
    if (!res.ok) throw new Error("Failed to fetch attendance")
    return res.json()
}

export function useAttendance() {
    return useQuery({
        queryKey: queryKeys.hcmAttendance.list(),
        queryFn: fetchAttendancePage,
        ...CACHE_TIERS.REALTIME,
    })
}
