"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface SalesOrderItem {
    id: string
    number: string
    customer: {
        id: string
        code: string
        name: string
    }
    orderDate: string
    requestedDate: string | null
    status: string
    paymentTerm: string
    total: number
    itemCount: number
    notes: string
    quotationNumber: string | null
}

interface SalesOrderSummary {
    totalOrders: number
    totalValue: number
    draft: number
    confirmed: number
    inProgress: number
    delivered: number
    invoiced: number
    completed: number
    cancelled: number
}

interface SalesOrdersResponse {
    success: boolean
    data: SalesOrderItem[]
    summary?: SalesOrderSummary
    error?: string
}

export type { SalesOrderItem, SalesOrderSummary }

const emptySummary: SalesOrderSummary = {
    totalOrders: 0,
    totalValue: 0,
    draft: 0,
    confirmed: 0,
    inProgress: 0,
    delivered: 0,
    invoiced: 0,
    completed: 0,
    cancelled: 0,
}

async function fetchSalesOrders(): Promise<{ orders: SalesOrderItem[]; summary: SalesOrderSummary }> {
    const response = await fetch("/api/sales/orders")
    const payload: SalesOrdersResponse = await response.json()
    if (!payload.success) throw new Error(payload.error || "Gagal memuat sales order")
    return {
        orders: payload.data || [],
        summary: payload.summary || emptySummary,
    }
}

export function useSalesOrders() {
    return useQuery({
        queryKey: queryKeys.salesOrders.list(),
        queryFn: fetchSalesOrders,
    })
}
