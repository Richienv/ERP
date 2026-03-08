"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"

export interface SalespersonRow {
    id: string
    code: string
    name: string
    phone: string | null
    email: string | null
    commissionRate: number
    isActive: boolean
    orderCount: number
    quotationCount: number
    totalSales: number
    commissionEarned: number
    createdAt: string
    updatedAt: string
}

export interface SalespersonsSummary {
    total: number
    active: number
    totalSalesAll: number
    totalCommissionAll: number
}

export function useSalespersons() {
    return useQuery({
        queryKey: queryKeys.salespersons.list(),
        queryFn: async () => {
            const res = await fetch("/api/sales/salespersons")
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Gagal memuat salesperson")
            return {
                salespersons: (json.data ?? []) as SalespersonRow[],
                summary: (json.summary ?? {}) as SalespersonsSummary,
            }
        },
    })
}

export interface CommissionReportItem {
    id: string
    code: string
    name: string
    commissionRate: number
    orderCount: number
    totalSales: number
    totalCommission: number
    orders: {
        id: string
        number: string
        customerName: string
        total: number
        commission: number
        status: string
        orderDate: string
    }[]
}

export function useCommissionReport(startDate?: string, endDate?: string) {
    return useQuery({
        queryKey: queryKeys.salespersons.commissionReport(startDate, endDate),
        queryFn: async () => {
            const params = new URLSearchParams()
            if (startDate) params.set("startDate", startDate)
            if (endDate) params.set("endDate", endDate)
            const res = await fetch(`/api/sales/salespersons/commission-report?${params}`)
            const json = await res.json()
            if (!json.success) throw new Error(json.error || "Gagal memuat laporan komisi")
            return {
                report: (json.data ?? []) as CommissionReportItem[],
                summary: json.summary ?? {},
            }
        },
    })
}

export function useInvalidateSalespersons() {
    const queryClient = useQueryClient()
    return () => {
        queryClient.invalidateQueries({ queryKey: queryKeys.salespersons.all })
    }
}
