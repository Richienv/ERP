"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { CACHE_TIERS } from "@/lib/cache-tiers"

export async function fetchOnboardingPage() {
    const res = await fetch("/api/hcm/onboarding-data")
    if (!res.ok) throw new Error("Failed to fetch onboarding")
    return res.json()
}

export function useOnboarding() {
    return useQuery({
        queryKey: queryKeys.hcmOnboarding.list(),
        queryFn: fetchOnboardingPage,
        ...CACHE_TIERS.MASTER,
    })
}
