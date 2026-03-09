"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface TransactionLine {
    id: string
    accountCode: string
    accountName: string
    accountType: string
    description: string | null
    debit: number
    credit: number
}

interface TransactionEntry {
    id: string
    date: string
    description: string
    reference: string | null
    invoiceId: string | null
    invoiceNumber: string | null
    invoiceType: string | null
    paymentId: string | null
    paymentNumber: string | null
    paymentMethod: string | null
    lines: TransactionLine[]
}

interface AccountInfo {
    id: string
    code: string
    name: string
    type: string
    balance: number
}

export interface AccountTransactionsData {
    entries: TransactionEntry[]
    accounts: AccountInfo[]
}

export function useAccountTransactions() {
    return useQuery<AccountTransactionsData>({
        queryKey: queryKeys.accountTransactions.list(),
        queryFn: async () => {
            const res = await fetch("/api/finance/transactions?limit=500")
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Failed to load transactions")
            return { entries: json.entries ?? [], accounts: json.accounts ?? [] }
        },
        staleTime: 2 * 60 * 1000,
    })
}
