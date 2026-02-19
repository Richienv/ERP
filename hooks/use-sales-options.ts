"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface OptionRecord {
    id: string
    code?: string
    name: string
    email?: string | null
}

interface SalesOptionsResponse {
    success: boolean
    data?: {
        customers?: OptionRecord[]
        users?: OptionRecord[]
    }
    error?: string
}

export type { OptionRecord }

async function fetchSalesOptions(): Promise<{ customers: OptionRecord[]; users: OptionRecord[] }> {
    const response = await fetch("/api/sales/options")
    const payload: SalesOptionsResponse = await response.json()
    if (!payload.success || !payload.data) {
        throw new Error(payload.error || "Failed to load sales options")
    }
    return {
        customers: payload.data.customers || [],
        users: payload.data.users || [],
    }
}

export function useSalesOptions() {
    return useQuery({
        queryKey: queryKeys.salesOptions.list(),
        queryFn: fetchSalesOptions,
    })
}
