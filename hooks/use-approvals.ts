"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getPendingApprovalPOs } from "@/lib/actions/procurement"

export function useApprovals() {
    return useQuery({
        queryKey: queryKeys.approvals.list(),
        queryFn: async () => {
            const pendingPOs = await getPendingApprovalPOs()
            return { pendingPOs }
        },
    })
}
