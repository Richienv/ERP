"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getOnboardingTemplates } from "@/lib/actions/hcm-onboarding"

export function useOnboarding() {
    return useQuery({
        queryKey: queryKeys.hcmOnboarding.list(),
        queryFn: async () => {
            const templates = await getOnboardingTemplates()
            return { templates }
        },
    })
}
