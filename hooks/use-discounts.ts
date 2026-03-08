"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/query-keys"
import { toast } from "sonner"

export type DiscountSchemeRow = {
    id: string
    code: string
    name: string
    description: string | null
    type: "PERCENTAGE" | "FIXED" | "TIERED"
    scope: "GLOBAL" | "PRICELIST" | "CUSTOMER" | "PRODUCT" | "CATEGORY"
    value: string | null
    tieredRules: any
    isActive: boolean
    validFrom: string | null
    validTo: string | null
    minOrderValue: string | null
    priceListId: string | null
    customerId: string | null
    productId: string | null
    categoryId: string | null
    priceList: { id: string; name: string; code: string } | null
    customer: { id: string; name: string; code: string } | null
    product: { id: string; name: string; code: string } | null
    category: { id: string; name: string; code: string } | null
    createdAt: string
    updatedAt: string
}

export type DiscountSummary = {
    total: number
    active: number
    percentage: number
    fixed: number
    tiered: number
}

export function useDiscounts() {
    return useQuery({
        queryKey: queryKeys.discounts.list(),
        queryFn: async () => {
            const res = await fetch("/api/sales/discounts")
            if (!res.ok) throw new Error("Gagal memuat data diskon")
            const json = await res.json()
            return {
                schemes: (json.data ?? []) as DiscountSchemeRow[],
                summary: (json.summary ?? {}) as DiscountSummary,
            }
        },
    })
}

export function useCreateDiscount() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: Record<string, any>) => {
            const res = await fetch("/api/sales/discounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Gagal membuat skema diskon")
            return json.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
            toast.success("Skema diskon berhasil dibuat")
        },
        onError: (err: Error) => {
            toast.error(err.message)
        },
    })
}

export function useUpdateDiscount() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (data: Record<string, any>) => {
            const res = await fetch("/api/sales/discounts", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Gagal mengubah skema diskon")
            return json.data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
            toast.success("Skema diskon berhasil diperbarui")
        },
        onError: (err: Error) => {
            toast.error(err.message)
        },
    })
}

export function useDeleteDiscount() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/sales/discounts?id=${id}`, {
                method: "DELETE",
            })
            const json = await res.json()
            if (!res.ok) throw new Error(json.error || "Gagal menghapus skema diskon")
            return json
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.discounts.all })
            toast.success("Skema diskon berhasil dihapus")
        },
        onError: (err: Error) => {
            toast.error(err.message)
        },
    })
}
