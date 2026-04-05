"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback } from "react"
import { queryKeys } from "@/lib/query-keys"

export interface BankAccountRecord {
    id: string
    code: string
    bankName: string
    accountNumber: string
    accountHolder: string
    branch: string | null
    currency: string
    coaAccountId: string | null
    openingBalance: number
    description: string | null
    isActive: boolean
    coaBalance: number
}

export interface COAAccount {
    id: string
    code: string
    name: string
}

export function useReconciliation() {
    return useQuery({
        queryKey: queryKeys.reconciliation.list(),
        queryFn: async () => {
            const res = await fetch("/api/finance/reconciliation")
            if (!res.ok) throw new Error("Failed to fetch reconciliation data")
            return res.json() as Promise<{
                reconciliations: Array<{
                    id: string
                    glAccountCode: string
                    glAccountName: string
                    statementDate: string
                    periodStart: string
                    periodEnd: string
                    status: string
                    itemCount: number
                    matchedCount: number
                    unmatchedCount: number
                    totalBankAmount: number
                    createdAt: string
                    bankAccountId: string | null
                }>
                bankAccounts: Array<{
                    id: string
                    code: string
                    name: string
                    balance: number
                }>
                bankAccountRecords: BankAccountRecord[]
                coaAccounts: COAAccount[]
                currencies: Array<{ code: string; name: string; symbol: string }>
            }>
        },
    })
}

export function useInvalidateReconciliation() {
    const queryClient = useQueryClient()
    return useCallback(
        () => queryClient.invalidateQueries({ queryKey: queryKeys.reconciliation.all }),
        [queryClient]
    )
}
