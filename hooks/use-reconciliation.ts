"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getReconciliations, getBankAccounts } from "@/lib/actions/finance-reconciliation"

export function useReconciliation() {
    return useQuery({
        queryKey: queryKeys.reconciliation.list(),
        queryFn: async () => {
            const [reconciliations, bankAccounts] = await Promise.all([
                getReconciliations(),
                getBankAccounts(),
            ])
            return { reconciliations, bankAccounts }
        },
    })
}
