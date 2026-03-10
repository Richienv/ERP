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
    paymentSupplierId: string | null
    paymentCustomerId: string | null
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

export interface TransactionFilters {
    dateFrom?: string
    dateTo?: string
    accounts?: string[]
    search?: string
}

export function useAccountTransactions(filters?: TransactionFilters) {
    const params = new URLSearchParams()
    params.set("limit", "500")
    if (filters?.dateFrom) params.set("dateFrom", filters.dateFrom)
    if (filters?.dateTo) params.set("dateTo", filters.dateTo)
    if (filters?.accounts?.length) params.set("accounts", filters.accounts.join(","))
    if (filters?.search) params.set("search", filters.search)

    return useQuery<AccountTransactionsData>({
        queryKey: [...queryKeys.accountTransactions.list(), filters ?? {}],
        queryFn: async () => {
            const res = await fetch(`/api/finance/transactions?${params.toString()}`)
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Failed to load transactions")
            return { entries: json.entries ?? [], accounts: json.accounts ?? [] }
        },
        staleTime: 2 * 60 * 1000,
    })
}
