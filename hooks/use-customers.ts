"use client"

import { useQuery } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

interface CustomerItem {
    id: string
    code: string
    name: string
    customerType: string
    city: string
    phone: string
    email: string
    creditStatus: string
    totalOrderValue: number
    lastOrderDate: string | null
    isActive: boolean
    isProspect: boolean
}

interface CustomerSummary {
    totalCustomers: number
    totalProspects: number
    activeCustomers: number
    creditWatch: number
    totalRevenue: number
}

interface CustomersResponse {
    success: boolean
    data: CustomerItem[]
    summary?: CustomerSummary
    error?: string
}

export type { CustomerItem, CustomerSummary }

async function fetchCustomers(): Promise<{ customers: CustomerItem[]; summary: CustomerSummary }> {
    const response = await fetch("/api/sales/customers")
    const payload: CustomersResponse = await response.json()
    if (!payload.success) throw new Error(payload.error || "Failed to load customers")
    return {
        customers: payload.data || [],
        summary: payload.summary || {
            totalCustomers: 0,
            totalProspects: 0,
            activeCustomers: 0,
            creditWatch: 0,
            totalRevenue: 0,
        },
    }
}

export function useCustomers() {
    return useQuery({
        queryKey: queryKeys.customers.list(),
        queryFn: fetchCustomers,
    })
}
