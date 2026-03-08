"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { getGLAccountsList } from "@/lib/actions/finance"

export interface GLAccountRow {
    id: string
    code: string
    name: string
    type: string
    balance: number | string
}

export interface OpeningBalancesData {
    grouped: Record<string, GLAccountRow[]>
    existingLines: Record<string, { debit: number; credit: number }>
    hasExisting: boolean
    existingEntryId: string | null
}

export function useGLAccounts() {
    return useQuery({
        queryKey: queryKeys.glAccounts.list(),
        queryFn: async () => {
            const accounts = await getGLAccountsList()
            return accounts
        },
        staleTime: 5 * 60 * 1000, // GL accounts don't change often
    })
}

export function useOpeningBalances() {
    return useQuery<OpeningBalancesData>({
        queryKey: queryKeys.openingBalances.list(),
        queryFn: async () => {
            const res = await fetch("/api/finance/opening-balances")
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Gagal memuat data")
            return json.data
        },
    })
}
