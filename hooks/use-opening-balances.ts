"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getGLAccountsGrouped, checkOpeningBalanceExists } from "@/lib/actions/finance-gl"

export function useOpeningBalances(year: number) {
    return useQuery({
        queryKey: [...queryKeys.openingBalances.list(), year],
        queryFn: async () => {
            const [accountsResult, existsResult] = await Promise.all([
                getGLAccountsGrouped(),
                checkOpeningBalanceExists(year),
            ])
            return {
                // `success` is a plain boolean on the action's return type, so it
                // cannot discriminate the union — probe for the payload key too.
                accounts: accountsResult.success && "data" in accountsResult ? accountsResult.data : null,
                alreadyExists: existsResult.exists,
            }
        },
    })
}
